begin;

alter table public.founding_partner_onboardings drop constraint if exists founding_partner_onboardings_status_check;
update public.founding_partner_onboardings set status=case status
  when 'pending' then 'paid_onboarding_incomplete'
  when 'profile_submitted' then 'submitted'
  else status end;
alter table public.founding_partner_onboardings alter column status set default 'paid_onboarding_incomplete';
alter table public.founding_partner_onboardings add constraint founding_partner_onboardings_status_check check (
  status in ('payment_pending','paid_onboarding_incomplete','submitted','under_review','approved','changes_requested','rejected','active','suspended')
);

alter table public.founding_partner_onboardings
  add column if not exists owner_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists access_token_hash text,
  add column if not exists access_token_expires_at timestamptz,
  add column if not exists years_in_business integer check (years_in_business is null or years_in_business between 0 and 250),
  add column if not exists primary_service_category text,
  add column if not exists additional_service_categories text[] not null default '{}',
  add column if not exists services_offered text[] not null default '{}',
  add column if not exists service_area_cities text[] not null default '{}',
  add column if not exists service_radius_miles integer check (service_radius_miles is null or service_radius_miles between 0 and 500),
  add column if not exists customer_type text check (customer_type is null or customer_type in ('residential','commercial','both')),
  add column if not exists emergency_service_available boolean not null default false,
  add column if not exists operating_hours text,
  add column if not exists license_applicable boolean not null default false,
  add column if not exists license_number text,
  add column if not exists insurance_status text check (insurance_status is null or insurance_status in ('insured','pending','not_insured','not_applicable')),
  add column if not exists preferred_contact_method text check (preferred_contact_method is null or preferred_contact_method in ('email','phone','text')),
  add column if not exists google_business_profile_url text,
  add column if not exists facebook_page_url text,
  add column if not exists other_social_links text[] not null default '{}',
  add column if not exists profile_headline text check (profile_headline is null or char_length(profile_headline) between 5 and 120),
  add column if not exists company_bio text check (company_bio is null or char_length(company_bio) between 40 and 4000),
  add column if not exists logo_url text,
  add column if not exists featured_image_url text,
  add column if not exists offers_free_estimates boolean not null default false,
  add column if not exists offers_financing boolean not null default false,
  add column if not exists languages_spoken text[] not null default '{}',
  add column if not exists accuracy_confirmed boolean not null default false,
  add column if not exists public_display_consent boolean not null default false,
  add column if not exists terms_privacy_accepted boolean not null default false,
  add column if not exists consent_version text,
  add column if not exists consented_at timestamptz,
  add column if not exists last_saved_at timestamptz;

update public.founding_partner_onboardings
set primary_service_category=coalesce(primary_service_category,service_category)
where primary_service_category is null and service_category is not null;

create unique index if not exists founding_partner_onboarding_access_token_idx
on public.founding_partner_onboardings(access_token_hash) where access_token_hash is not null;
create index if not exists founding_partner_onboarding_owner_idx
on public.founding_partner_onboardings(owner_user_id,updated_at desc) where owner_user_id is not null;

drop function if exists public.submit_founding_partner_onboarding(text,text,text,text,text,text,text,text);

create or replace function public.save_founding_partner_onboarding(
  target_onboarding_id uuid,target_payload jsonb,target_submit boolean default false
) returns uuid language plpgsql security definer set search_path='' as $$
declare onboarding public.founding_partner_onboardings%rowtype;
declare next_status text;
declare additional_categories text[] := array(select jsonb_array_elements_text(coalesce(target_payload->'additional_service_categories','[]'::jsonb)));
declare offered_services text[] := array(select jsonb_array_elements_text(coalesce(target_payload->'services_offered','[]'::jsonb)));
declare coverage_cities text[] := array(select jsonb_array_elements_text(coalesce(target_payload->'service_area_cities','[]'::jsonb)));
declare social_links text[] := array(select jsonb_array_elements_text(coalesce(target_payload->'other_social_links','[]'::jsonb)));
declare spoken_languages text[] := array(select jsonb_array_elements_text(coalesce(target_payload->'languages_spoken','[]'::jsonb)));
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'service role required'; end if;
  select * into onboarding from public.founding_partner_onboardings where id=target_onboarding_id for update;
  if not found then raise exception 'onboarding record not found'; end if;
  if onboarding.status not in ('paid_onboarding_incomplete','changes_requested') then raise exception 'onboarding is not editable'; end if;

  if target_submit then
    if nullif(trim(target_payload->>'business_name'),'') is null or nullif(trim(target_payload->>'contact_name'),'') is null or nullif(trim(target_payload->>'phone'),'') is null then raise exception 'business contact information is incomplete'; end if;
    if nullif(trim(target_payload->>'business_description'),'') is null or nullif(trim(target_payload->>'years_in_business'),'') is null then raise exception 'business information is incomplete'; end if;
    if nullif(trim(target_payload->>'primary_service_category'),'') is null or cardinality(offered_services)=0 or cardinality(coverage_cities)=0 then raise exception 'service information is incomplete'; end if;
    if nullif(trim(target_payload->>'service_radius_miles'),'') is null or nullif(trim(target_payload->>'customer_type'),'') is null or nullif(trim(target_payload->>'operating_hours'),'') is null then raise exception 'service coverage information is incomplete'; end if;
    if coalesce((target_payload->>'license_applicable')::boolean,false) and nullif(trim(target_payload->>'license_number'),'') is null then raise exception 'license number is required when licensing applies'; end if;
    if nullif(trim(target_payload->>'insurance_status'),'') is null or nullif(trim(target_payload->>'preferred_contact_method'),'') is null then raise exception 'verification information is incomplete'; end if;
    if nullif(trim(target_payload->>'profile_headline'),'') is null or nullif(trim(target_payload->>'company_bio'),'') is null or cardinality(spoken_languages)=0 then raise exception 'marketplace profile is incomplete'; end if;
    if not coalesce((target_payload->>'accuracy_confirmed')::boolean,false) or not coalesce((target_payload->>'public_display_consent')::boolean,false) or not coalesce((target_payload->>'terms_privacy_accepted')::boolean,false) then raise exception 'all required consents must be accepted'; end if;
  end if;

  next_status := case when target_submit then 'submitted' when onboarding.status='changes_requested' then 'changes_requested' else 'paid_onboarding_incomplete' end;
  update public.founding_partner_onboardings set
    status=next_status,
    business_name=nullif(trim(target_payload->>'business_name'),''),
    contact_name=nullif(trim(target_payload->>'contact_name'),''),
    phone=nullif(trim(target_payload->>'phone'),''),
    website=nullif(trim(target_payload->>'website'),''),
    business_description=nullif(trim(target_payload->>'business_description'),''),
    years_in_business=nullif(target_payload->>'years_in_business','')::integer,
    primary_service_category=nullif(trim(target_payload->>'primary_service_category'),''),
    service_category=nullif(trim(target_payload->>'primary_service_category'),''),
    additional_service_categories=additional_categories,
    services_offered=offered_services,
    service_area_cities=coverage_cities,
    city=coverage_cities[1],
    service_radius_miles=nullif(target_payload->>'service_radius_miles','')::integer,
    customer_type=nullif(target_payload->>'customer_type',''),
    emergency_service_available=coalesce((target_payload->>'emergency_service_available')::boolean,false),
    operating_hours=nullif(trim(target_payload->>'operating_hours'),''),
    license_applicable=coalesce((target_payload->>'license_applicable')::boolean,false),
    license_number=case when coalesce((target_payload->>'license_applicable')::boolean,false) then nullif(trim(target_payload->>'license_number'),'') else null end,
    insurance_status=nullif(target_payload->>'insurance_status',''),
    preferred_contact_method=nullif(target_payload->>'preferred_contact_method',''),
    google_business_profile_url=nullif(trim(target_payload->>'google_business_profile_url'),''),
    facebook_page_url=nullif(trim(target_payload->>'facebook_page_url'),''),
    other_social_links=social_links,
    profile_headline=nullif(trim(target_payload->>'profile_headline'),''),
    company_bio=nullif(trim(target_payload->>'company_bio'),''),
    logo_url=nullif(trim(target_payload->>'logo_url'),''),
    featured_image_url=nullif(trim(target_payload->>'featured_image_url'),''),
    offers_free_estimates=coalesce((target_payload->>'offers_free_estimates')::boolean,false),
    offers_financing=coalesce((target_payload->>'offers_financing')::boolean,false),
    languages_spoken=spoken_languages,
    accuracy_confirmed=coalesce((target_payload->>'accuracy_confirmed')::boolean,false),
    public_display_consent=coalesce((target_payload->>'public_display_consent')::boolean,false),
    terms_privacy_accepted=coalesce((target_payload->>'terms_privacy_accepted')::boolean,false),
    consent_version=case when target_submit then 'founding-partner-2026-07-18' else consent_version end,
    consented_at=case when target_submit then now() else consented_at end,
    submitted_at=case when target_submit then now() else submitted_at end,
    last_saved_at=now(),updated_at=now()
  where id=onboarding.id;

  insert into public.audit_events(action,entity_type,entity_id,metadata)
  values(case when target_submit then 'founding_partner.application_submitted' else 'founding_partner.application_draft_saved' end,
    'founding_partner_onboarding',onboarding.id,jsonb_build_object('payment_id',onboarding.payment_id,'status',next_status));
  return onboarding.id;
end $$;

revoke execute on function public.save_founding_partner_onboarding(uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.save_founding_partner_onboarding(uuid,jsonb,boolean) to service_role;

comment on column public.founding_partner_onboardings.access_token_hash is 'SHA-256 hash of the current HttpOnly post-payment onboarding bearer credential.';
comment on function public.save_founding_partner_onboarding is 'Idempotently saves an authorized draft or submits a complete paid Founding Partner application.';

commit;
