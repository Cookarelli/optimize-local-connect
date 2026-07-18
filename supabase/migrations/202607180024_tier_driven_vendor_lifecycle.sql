begin;

-- Canonical paid tier identifiers. Existing foreign keys reference level IDs,
-- so renaming codes preserves all memberships and event history.
update public.vendor_membership_levels set code='network',name='Network Member' where code='network_member';
update public.vendor_membership_levels set code='preferred',name='Preferred Vendor' where code='premium';
update public.vendor_enrollments set intended_plan_key=case intended_plan_key when 'founding_vendor' then 'founding_partner' when 'network_member' then 'network' when 'preferred_vendor' then 'preferred' else intended_plan_key end;
alter table public.vendor_enrollments drop constraint if exists vendor_enrollments_intended_plan_key_check;
alter table public.vendor_enrollments add constraint vendor_enrollments_intended_plan_key_check check(intended_plan_key in ('founding_partner','network','preferred'));

alter table public.vendor_membership_levels
  add column if not exists payment_required boolean not null default true,
  add column if not exists manual_approval_required boolean not null default true,
  add column if not exists publication_eligible boolean not null default false,
  add column if not exists publicly_purchasable boolean not null default false,
  add column if not exists badge_code text,
  add column if not exists badge_label text,
  add column if not exists placement_priority integer not null default 0;

update public.vendor_membership_levels set
  payment_required=true,manual_approval_required=true,publication_eligible=true,publicly_purchasable=true,
  badge_code=case code when 'founding_partner' then 'founding_partner' when 'preferred' then 'preferred_vendor' else null end,
  badge_label=case code when 'founding_partner' then 'Founding Partner' when 'preferred' then 'Preferred Vendor' else null end,
  placement_priority=case code when 'founding_partner' then 30 when 'preferred' then 20 when 'network' then 10 else 0 end,
  features=features||case code
    when 'founding_partner' then '{"directory_visibility":true,"opportunities":true,"vendor_dashboard":true,"property_manager_perk":true,"preferred_placement":true,"founder_badge":true}'::jsonb
    when 'preferred' then '{"directory_visibility":true,"opportunities":true,"vendor_dashboard":true,"property_manager_perk":true,"preferred_placement":true,"founder_badge":false}'::jsonb
    else '{"directory_visibility":true,"opportunities":true,"vendor_dashboard":true,"property_manager_perk":false,"preferred_placement":false,"founder_badge":false}'::jsonb end
where code in ('founding_partner','network','preferred');

alter table public.vendor_profiles
  add column if not exists public_email text,
  add column if not exists contact_name text,
  add column if not exists logo_url text,
  add column if not exists headline text,
  add column if not exists google_business_profile_url text,
  add column if not exists operating_hours text,
  add column if not exists languages_spoken text[] not null default array['English']::text[],
  add column if not exists offers_free_estimates boolean not null default false,
  add column if not exists offers_financing boolean not null default false,
  add column if not exists emergency_available boolean not null default false,
  add column if not exists license_applicable boolean not null default false,
  add column if not exists insurance_status text,
  add column if not exists public_display_consent boolean not null default false,
  add column if not exists approval_status text not null default 'pending',
  add column if not exists lifecycle_status text not null default 'payment_pending',
  add column if not exists publication_status text not null default 'unpublished',
  add column if not exists profile_completed_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists suspended_at timestamptz,
  add column if not exists disabled_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists lifecycle_evaluated_at timestamptz;
alter table public.vendor_profiles add constraint vendor_profiles_approval_status_check check(approval_status in ('pending','approved','changes_requested','rejected'));
alter table public.vendor_profiles add constraint vendor_profiles_lifecycle_status_check check(lifecycle_status in ('payment_pending','onboarding_incomplete','pending_approval','eligible','suspended','inactive'));
alter table public.vendor_profiles add constraint vendor_profiles_publication_status_check check(publication_status in ('unpublished','published','suspended'));
alter table public.vendor_profiles add constraint vendor_profiles_public_email_check check(public_email is null or public_email~*'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');

-- Preserve approved Founder profiles in the generic read model.
update public.vendor_profiles vp set
  description=coalesce(vp.description,f.company_bio,f.business_description),public_email=coalesce(vp.public_email,f.customer_email),
  contact_name=coalesce(vp.contact_name,f.contact_name,f.customer_name),logo_url=coalesce(vp.logo_url,f.logo_url),
  google_business_profile_url=coalesce(vp.google_business_profile_url,f.google_business_profile_url),operating_hours=coalesce(vp.operating_hours,f.operating_hours),
  languages_spoken=case when cardinality(vp.languages_spoken)=0 then f.languages_spoken else vp.languages_spoken end,
  offers_free_estimates=f.offers_free_estimates,offers_financing=f.offers_financing,emergency_available=f.emergency_service_available,
  license_applicable=f.license_applicable,insurance_status=coalesce(vp.insurance_status,f.insurance_status),public_display_consent=f.public_display_consent,
  approval_status=case when f.approved_at is not null then 'approved' else vp.approval_status end,
  approved_at=coalesce(vp.approved_at,f.approved_at),profile_completed_at=coalesce(vp.profile_completed_at,f.submitted_at)
from public.founding_partner_onboardings f where f.vendor_organization_id=vp.organization_id;

create or replace function public.vendor_profile_completion(target_vendor_organization_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'complete',cardinality(array_remove(array[
      case when char_length(trim(o.name))<2 then 'business_name' end,
      case when char_length(coalesce(trim(vp.description),''))<40 then 'description' end,
      case when vp.public_email is null then 'public_email' end,
      case when not exists(select 1 from public.vendor_category_assignments x where x.vendor_organization_id=o.id) then 'category' end,
      case when not exists(select 1 from public.vendor_service_offerings x where x.vendor_organization_id=o.id and x.is_active) then 'service' end,
      case when not exists(select 1 from public.vendor_service_cities x where x.vendor_organization_id=o.id and x.is_active) then 'service_area' end,
      case when not vp.public_display_consent then 'public_display_consent' end
    ],null))=0,
    'missing',to_jsonb(array_remove(array[
      case when char_length(trim(o.name))<2 then 'business_name' end,
      case when char_length(coalesce(trim(vp.description),''))<40 then 'description' end,
      case when vp.public_email is null then 'public_email' end,
      case when not exists(select 1 from public.vendor_category_assignments x where x.vendor_organization_id=o.id) then 'category' end,
      case when not exists(select 1 from public.vendor_service_offerings x where x.vendor_organization_id=o.id and x.is_active) then 'service' end,
      case when not exists(select 1 from public.vendor_service_cities x where x.vendor_organization_id=o.id and x.is_active) then 'service_area' end,
      case when not vp.public_display_consent then 'public_display_consent' end
    ],null)))
  from public.organizations o join public.vendor_profiles vp on vp.organization_id=o.id
  where o.id=target_vendor_organization_id and o.type='vendor';
$$;

create or replace function public.evaluate_vendor_organization_activation(target_vendor_organization_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.organizations%rowtype;vp public.vendor_profiles%rowtype;vm public.vendor_memberships%rowtype;level public.vendor_membership_levels%rowtype;
  completion jsonb;payment_ok boolean:=false;blocked boolean;next_lifecycle text:='inactive';publish boolean:=false;
begin
  select * into o from public.organizations where id=target_vendor_organization_id and type='vendor' for update;
  if not found then raise exception 'vendor organization not found'; end if;
  select * into vp from public.vendor_profiles where organization_id=o.id for update;
  select * into vm from public.vendor_memberships where vendor_organization_id=o.id order by created_at desc limit 1;
  if found then select * into level from public.vendor_membership_levels where id=vm.membership_level_id; end if;
  completion:=coalesce(public.vendor_profile_completion(o.id),'{"complete":false,"missing":["profile"]}'::jsonb);
  payment_ok:=level.id is not null and level.publication_eligible and (not level.payment_required or vm.status in ('active','trialing','complimentary','manually_granted') or (vm.status='past_due' and vm.current_period_ends_at>now()));
  blocked:=o.status='suspended' or vp.suspended_at is not null or vp.disabled_at is not null or vp.deleted_at is not null;
  if blocked then next_lifecycle:='suspended';
  elsif not payment_ok then next_lifecycle:=case when vm.id is null or vm.status='pending' then 'payment_pending' else 'inactive' end;
  elsif not coalesce((completion->>'complete')::boolean,false) then next_lifecycle:='onboarding_incomplete';
  elsif level.manual_approval_required and vp.approval_status<>'approved' then next_lifecycle:='pending_approval';
  else next_lifecycle:='eligible';publish:=true; end if;
  update public.vendor_profiles set lifecycle_status=next_lifecycle,publication_status=case when blocked then 'suspended' when publish then 'published' else 'unpublished' end,
    profile_completed_at=case when coalesce((completion->>'complete')::boolean,false) then coalesce(profile_completed_at,now()) else null end,lifecycle_evaluated_at=now(),updated_at=now() where organization_id=o.id;
  if publish and o.status<>'active' then update public.organizations set status='active',updated_at=now() where id=o.id;
  elsif not publish and o.status='active' then update public.organizations set status='onboarding',updated_at=now() where id=o.id; end if;
  return jsonb_build_object('organization_id',o.id,'tier',level.code,'membership_status',vm.status,'payment_satisfied',payment_ok,'profile',completion,'approval_status',vp.approval_status,'lifecycle_status',next_lifecycle,'publication_eligible',publish);
end $$;

create or replace function public.sync_vendor_lifecycle_after_membership()
returns trigger language plpgsql security definer set search_path='' as $$ begin
  perform public.evaluate_vendor_organization_activation(new.vendor_organization_id);return new;
end $$;
drop trigger if exists evaluate_vendor_lifecycle_after_membership on public.vendor_memberships;
create trigger evaluate_vendor_lifecycle_after_membership after insert or update of status,membership_level_id,current_period_ends_at on public.vendor_memberships
for each row execute function public.sync_vendor_lifecycle_after_membership();

create or replace function public.sync_vendor_tier_badge()
returns trigger language plpgsql security definer set search_path='' as $$
declare configured_badge text;badge_id uuid;
begin
  select badge_code into configured_badge from public.vendor_membership_levels where id=new.membership_level_id;
  update public.vendor_badge_awards set revoked_at=coalesce(revoked_at,now()) where vendor_organization_id=new.vendor_organization_id and revoked_at is null
    and vendor_badge_id in(select id from public.vendor_badges where code in ('founding_partner','preferred_vendor'))
    and (configured_badge is null or vendor_badge_id<>(select id from public.vendor_badges where code=configured_badge));
  if configured_badge is not null and (new.status in ('active','trialing','complimentary','manually_granted') or (new.status='past_due' and new.current_period_ends_at>now())) then
    select id into badge_id from public.vendor_badges where code=configured_badge and is_active;
    if badge_id is not null and not exists(select 1 from public.vendor_badge_awards where vendor_organization_id=new.vendor_organization_id and vendor_badge_id=badge_id and revoked_at is null) then
      insert into public.vendor_badge_awards(vendor_organization_id,vendor_badge_id,reason) values(new.vendor_organization_id,badge_id,'Current '||configured_badge||' tier entitlement');
    end if;
  elsif configured_badge is not null then update public.vendor_badge_awards set revoked_at=coalesce(revoked_at,now()) where vendor_organization_id=new.vendor_organization_id and vendor_badge_id=(select id from public.vendor_badges where code=configured_badge) and revoked_at is null; end if;
  return new;
end $$;
drop trigger if exists sync_vendor_tier_badge_after_membership on public.vendor_memberships;
create trigger sync_vendor_tier_badge_after_membership after insert or update of status,membership_level_id,current_period_ends_at on public.vendor_memberships for each row execute function public.sync_vendor_tier_badge();

create or replace function public.process_vendor_membership_stripe_event(
  target_event_id text,target_event_type text,target_membership_id uuid,target_vendor_organization_id uuid,
  target_level_code text,target_subscription_id text,target_customer_id text,target_price_id text,target_status text,
  target_period_end timestamptz,target_cancel_at_period_end boolean,target_amount_cents integer,target_currency text,target_payload jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare membership public.vendor_memberships%rowtype;level_id uuid;prior_membership_id uuid;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'service role required'; end if;
  if target_status not in ('pending','active','trialing','past_due','canceled','expired') then raise exception 'invalid normalized membership status'; end if;
  select membership_id into prior_membership_id from public.vendor_membership_provider_events where provider='stripe' and provider_event_id=target_event_id and processed_at is not null;
  if found then return prior_membership_id; end if;
  insert into public.vendor_membership_provider_events(provider_event_id,event_type,provider_object_id,payload) values(target_event_id,target_event_type,target_subscription_id,target_payload)
    on conflict(provider,provider_event_id) do update set event_type=excluded.event_type,provider_object_id=excluded.provider_object_id,payload=excluded.payload;
  select * into membership from public.vendor_memberships where id=target_membership_id or external_subscription_id=target_subscription_id order by(id=target_membership_id) desc limit 1 for update;
  if not found then raise exception 'membership checkout reservation not found'; end if;
  if membership.vendor_organization_id<>target_vendor_organization_id or membership.stripe_customer_id<>target_customer_id or (membership.external_subscription_id is not null and membership.external_subscription_id<>target_subscription_id) or (membership.external_subscription_id is null and membership.stripe_price_id<>target_price_id) then raise exception 'membership provider mapping mismatch'; end if;
  select id into level_id from public.vendor_membership_levels where code=target_level_code and is_active;
  if level_id is null then raise exception 'membership level unavailable'; end if;
  update public.vendor_memberships set membership_level_id=level_id,status=target_status,external_subscription_id=target_subscription_id,stripe_price_id=target_price_id,current_period_ends_at=target_period_end,
    next_billing_at=target_period_end,cancel_at_period_end=coalesce(target_cancel_at_period_end,false),amount_cents=target_amount_cents,renewal_amount_cents=target_amount_cents,
    currency=upper(target_currency),source='billing_webhook',last_payment_failed_at=case when target_event_type='invoice.payment_failed' then now() else last_payment_failed_at end,updated_at=now() where id=membership.id;
  insert into public.vendor_membership_events(vendor_organization_id,vendor_membership_id,event_type,to_level_code,source,idempotency_key,metadata)
    values(target_vendor_organization_id,membership.id,case when target_event_type='invoice.paid' then 'renewed' when target_event_type='invoice.payment_failed' then 'payment_failed' when target_status='canceled' then 'cancelled' when target_status='expired' then 'expired' else 'changed' end,
      target_level_code,'billing_webhook','stripe:'||target_event_id,jsonb_build_object('stripe_subscription_id',target_subscription_id,'stripe_event_type',target_event_type)) on conflict(idempotency_key) do nothing;
  update public.vendor_membership_provider_events set membership_id=membership.id,processed_at=now(),processing_error=null where provider='stripe' and provider_event_id=target_event_id;
  return membership.id;
end $$;

-- Payment updates enrollment state, then delegates organization activation to
-- the shared evaluator. It never publishes solely because payment succeeded.
create or replace function public.sync_vendor_enrollment_status()
returns trigger language plpgsql security definer set search_path='' as $$ begin
  if new.status in ('active','trialing','past_due','complimentary','manually_granted') then
    update public.vendor_enrollments set status='active',last_checkout_error=null,updated_at=now() where membership_id=new.id;
  elsif new.status in ('canceled','cancelled') then update public.vendor_enrollments set status='canceled',updated_at=now() where membership_id=new.id;
  elsif new.status='expired' then update public.vendor_enrollments set status='payment_pending',updated_at=now() where membership_id=new.id; end if;
  perform public.evaluate_vendor_organization_activation(new.vendor_organization_id);return new;
end $$;

create or replace function public.sync_legacy_founder_to_vendor_lifecycle()
returns trigger language plpgsql security definer set search_path='' as $$ begin
  if new.vendor_organization_id is not null and exists(select 1 from public.vendor_profiles where organization_id=new.vendor_organization_id) then
    update public.vendor_profiles set description=coalesce(new.company_bio,new.business_description,description),public_email=coalesce(new.customer_email,public_email),
      contact_name=coalesce(new.contact_name,new.customer_name,contact_name),logo_url=coalesce(new.logo_url,logo_url),google_business_profile_url=coalesce(new.google_business_profile_url,google_business_profile_url),
      operating_hours=coalesce(new.operating_hours,operating_hours),languages_spoken=case when cardinality(new.languages_spoken)>0 then new.languages_spoken else languages_spoken end,
      offers_free_estimates=new.offers_free_estimates,offers_financing=new.offers_financing,emergency_available=new.emergency_service_available,
      license_applicable=new.license_applicable,insurance_status=coalesce(new.insurance_status,insurance_status),public_display_consent=new.public_display_consent,
      approval_status=case when new.status in ('approved','active') then 'approved' when new.status='changes_requested' then 'changes_requested' when new.status='rejected' then 'rejected' else approval_status end,
      approved_at=case when new.status in ('approved','active') then coalesce(approved_at,new.approved_at,now()) else approved_at end,updated_at=now()
    where organization_id=new.vendor_organization_id;
    perform public.evaluate_vendor_organization_activation(new.vendor_organization_id);
  end if;return new;
end $$;
drop trigger if exists sync_legacy_founder_lifecycle_after_onboarding on public.founding_partner_onboardings;
create trigger sync_legacy_founder_lifecycle_after_onboarding after insert or update of status,vendor_organization_id,business_name,business_description,company_bio,primary_service_category,services_offered,service_area_cities,public_display_consent on public.founding_partner_onboardings for each row execute function public.sync_legacy_founder_to_vendor_lifecycle();

create or replace function public.admin_manage_vendor_lifecycle(target_vendor_organization_id uuid,target_action text,target_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prior text;result jsonb;
begin
  if not public.is_super_admin() then raise exception 'super admin required'; end if;
  if target_action not in ('approve','request_changes','reject','suspend','restore','recheck') then raise exception 'unsupported vendor lifecycle action'; end if;
  select approval_status into prior from public.vendor_profiles where organization_id=target_vendor_organization_id for update;
  if not found then raise exception 'vendor profile not found'; end if;
  if target_action='approve' then update public.vendor_profiles set approval_status='approved',approved_at=now(),approved_by=auth.uid(),suspended_at=null where organization_id=target_vendor_organization_id;
  elsif target_action='request_changes' then update public.vendor_profiles set approval_status='changes_requested' where organization_id=target_vendor_organization_id;
  elsif target_action='reject' then update public.vendor_profiles set approval_status='rejected' where organization_id=target_vendor_organization_id;
  elsif target_action='suspend' then update public.vendor_profiles set suspended_at=now(),publication_status='suspended' where organization_id=target_vendor_organization_id;update public.organizations set status='suspended' where id=target_vendor_organization_id;
  elsif target_action='restore' then update public.vendor_profiles set suspended_at=null,publication_status='unpublished' where organization_id=target_vendor_organization_id;update public.organizations set status='onboarding' where id=target_vendor_organization_id and status='suspended'; end if;
  result:=public.evaluate_vendor_organization_activation(target_vendor_organization_id);
  insert into public.audit_events(actor_user_id,action,entity_type,entity_id,metadata) values(auth.uid(),'vendor.lifecycle_'||target_action,'vendor_organization',target_vendor_organization_id,jsonb_build_object('prior_approval_status',prior,'notes',left(coalesce(target_notes,''),4000),'result',result));
  return result;
end $$;

create or replace function public.create_or_resume_vendor_enrollment(
  target_user_id uuid,target_business_name text,target_legal_name text,target_contact_name text,
  target_contact_email text,target_contact_phone text,target_website_url text,target_plan_key text,
  target_level_code text,target_price_id text,target_interval text,target_amount_cents integer,
  target_currency text,target_onboarding_version integer default 1
)
returns table(enrollment_id uuid,vendor_organization_id uuid,membership_id uuid,checkout_attempt_number integer,enrollment_status text)
language plpgsql security definer set search_path='' as $$
declare normalized_name text:=lower(regexp_replace(trim(target_business_name),'\s+',' ','g'));normalized_email text:=lower(trim(target_contact_email));
  normalized_phone text:=nullif(regexp_replace(coalesce(target_contact_phone,''),'[^0-9+]','','g'),'');normalized_website text:=nullif(trim(target_website_url),'');
  auth_email text;base_slug text;organization_id uuid;level_id uuid;member_id uuid;selected_enrollment public.vendor_enrollments%rowtype;selected_membership public.vendor_memberships%rowtype;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'service role required'; end if;
  select lower(email) into auth_email from auth.users where id=target_user_id;
  if auth_email is null or auth_email<>normalized_email then raise exception 'authenticated user email mismatch'; end if;
  if char_length(normalized_name) not between 2 and 160 or char_length(trim(target_contact_name)) not between 2 and 120 or normalized_phone is null or char_length(normalized_phone)<7 then raise exception 'invalid enrollment details'; end if;
  if target_plan_key not in ('founding_partner','network','preferred') or target_level_code<>target_plan_key or target_interval not in ('month','year') or target_amount_cents<=0 or upper(target_currency)<>'USD' or target_price_id!~'^price_' or target_onboarding_version<=0 then raise exception 'invalid membership configuration'; end if;
  select id into level_id from public.vendor_membership_levels where code=target_level_code and is_active and billing_model='subscription' and publicly_purchasable;
  if level_id is null then raise exception 'membership level unavailable'; end if;
  select * into selected_enrollment from public.vendor_enrollments where owner_user_id=target_user_id and normalized_business_name=normalized_name for update;
  if found then
    if selected_enrollment.intended_plan_key<>target_plan_key then raise exception 'pending enrollment uses a different membership tier'; end if;
    select * into selected_membership from public.vendor_memberships where id=selected_enrollment.membership_id for update;
    if selected_membership.status in ('active','trialing','past_due','complimentary','manually_granted') then raise exception 'active membership already exists'; end if;
    if selected_membership.external_subscription_id is not null then raise exception 'existing subscription requires administrative review'; end if;
    if selected_membership.status in ('expired','canceled','cancelled') then update public.vendor_memberships set status='pending',stripe_checkout_session_id=null,stripe_price_id=target_price_id,billing_interval=target_interval,amount_cents=target_amount_cents,currency=upper(target_currency),renewal_amount_cents=target_amount_cents,checkout_attempt_number=public.vendor_memberships.checkout_attempt_number+1,updated_at=now() where id=selected_membership.id returning * into selected_membership; end if;
    update public.vendor_enrollments set contact_name=trim(target_contact_name),contact_phone=normalized_phone,website_url=normalized_website,status='payment_pending',last_checkout_error=null,updated_at=now() where id=selected_enrollment.id;
    return query select selected_enrollment.id,selected_enrollment.vendor_organization_id,selected_membership.id,selected_membership.checkout_attempt_number,'payment_pending'::text;return;
  end if;
  base_slug:=trim(both '-' from regexp_replace(lower(trim(target_business_name)),'[^a-z0-9]+','-','g'));if base_slug='' then raise exception 'business name cannot produce a valid slug'; end if;
  insert into public.organizations(type,name,slug,legal_name,website_url,phone,status) values('vendor',trim(target_business_name),left(base_slug,130)||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,10),nullif(trim(target_legal_name),''),normalized_website,normalized_phone,'onboarding') returning id into organization_id;
  insert into public.vendor_profiles(organization_id,verification_status,public_email,contact_name) values(organization_id,'pending',normalized_email,trim(target_contact_name));
  insert into public.organization_members(organization_id,user_id,role,status) values(organization_id,target_user_id,'owner','active');
  insert into public.user_preferences(user_id,active_organization_id) values(target_user_id,organization_id) on conflict(user_id) do update set active_organization_id=excluded.active_organization_id,updated_at=now();
  insert into public.vendor_memberships(vendor_organization_id,membership_level_id,status,starts_at,source,stripe_price_id,billing_interval,amount_cents,currency,renewal_amount_cents,onboarding_version,checkout_attempt_number)
  values(organization_id,level_id,'pending',now(),'self_service',target_price_id,target_interval,target_amount_cents,upper(target_currency),target_amount_cents,target_onboarding_version,1) returning id,public.vendor_memberships.checkout_attempt_number into member_id,checkout_attempt_number;
  insert into public.vendor_enrollments(owner_user_id,vendor_organization_id,membership_id,intended_plan_key,normalized_business_name,contact_name,contact_email,contact_phone,website_url,onboarding_version)
  values(target_user_id,organization_id,member_id,target_plan_key,normalized_name,trim(target_contact_name),normalized_email,normalized_phone,normalized_website,target_onboarding_version) returning id into enrollment_id;
  vendor_organization_id:=organization_id;membership_id:=member_id;enrollment_status:='payment_pending';return next;
end $$;

create or replace function public.save_vendor_profile_onboarding(target_vendor_organization_id uuid,target_user_id uuid,target_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare business_name text:=trim(target_payload->>'business_name');description text:=trim(target_payload->>'description');public_email text:=lower(trim(target_payload->>'public_email'));
  phone text:=nullif(trim(target_payload->>'phone'),'');website text:=nullif(trim(target_payload->>'website_url'),'');category_name text:=trim(target_payload->>'primary_category');
  service_names text[]:=array(select trim(value) from jsonb_array_elements_text(coalesce(target_payload->'services','[]'::jsonb)) where trim(value)<>'');
  area_names text[]:=array(select trim(value) from jsonb_array_elements_text(coalesce(target_payload->'service_areas','[]'::jsonb)) where trim(value)<>'');
  category_id uuid;service_id uuid;city_id uuid;item text;base_slug text;city_name text;state_code text;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'service role required'; end if;
  if not exists(select 1 from public.organization_members where organization_id=target_vendor_organization_id and user_id=target_user_id and status='active' and role in ('owner','admin')) then raise exception 'not authorized'; end if;
  if char_length(business_name) not between 2 and 160 or char_length(description) not between 40 and 2000 or public_email!~*'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or category_name='' or cardinality(service_names)=0 or cardinality(area_names)=0 then raise exception 'profile is incomplete'; end if;
  update public.organizations set name=business_name,phone=phone,website_url=website,updated_at=now() where id=target_vendor_organization_id and type='vendor';
  update public.vendor_profiles set description=description,public_email=public_email,public_display_consent=coalesce((target_payload->>'public_display_consent')::boolean,false),updated_at=now() where organization_id=target_vendor_organization_id;
  base_slug:=trim(both '-' from lower(regexp_replace(category_name,'[^a-zA-Z0-9]+','-','g')));
  insert into public.vendor_categories(slug,name,is_active,sort_order) values(base_slug,category_name,true,100) on conflict(slug) do update set name=excluded.name,is_active=true returning id into category_id;
  delete from public.vendor_category_assignments where vendor_organization_id=target_vendor_organization_id;
  insert into public.vendor_category_assignments(vendor_organization_id,vendor_category_id) values(target_vendor_organization_id,category_id);
  update public.vendor_service_offerings set is_active=false where vendor_organization_id=target_vendor_organization_id;
  foreach item in array service_names loop
    base_slug:=left(trim(both '-' from lower(regexp_replace(item,'[^a-zA-Z0-9]+','-','g'))),120)||'-'||substr(md5(item),1,6);
    insert into public.vendor_services(vendor_category_id,slug,name,is_active) values(category_id,base_slug,left(item,160),true) on conflict(vendor_category_id,slug) do update set name=excluded.name,is_active=true returning id into service_id;
    insert into public.vendor_service_offerings(vendor_organization_id,vendor_service_id,is_active) values(target_vendor_organization_id,service_id,true) on conflict(vendor_organization_id,vendor_service_id) do update set is_active=true;
  end loop;
  update public.vendor_service_cities set is_active=false where vendor_organization_id=target_vendor_organization_id;
  foreach item in array area_names loop
    city_name:=trim(split_part(item,',',1));state_code:=upper(trim(split_part(item,',',2)));if state_code!~'^[A-Z]{2}$' then raise exception 'service areas must use City, ST'; end if;
    base_slug:=trim(both '-' from lower(regexp_replace(city_name,'[^a-zA-Z0-9]+','-','g')));
    insert into public.cities(slug,name,state_code,country_code,timezone,is_active) values(base_slug,city_name,state_code,'US','America/Chicago',true) on conflict(country_code,state_code,slug) do update set name=excluded.name,is_active=true returning id into city_id;
    insert into public.vendor_service_cities(vendor_organization_id,city_id,is_active) values(target_vendor_organization_id,city_id,true) on conflict(vendor_organization_id,city_id) do update set is_active=true;
  end loop;
  return public.evaluate_vendor_organization_activation(target_vendor_organization_id);
end $$;

create or replace function public.search_public_vendors(
  search_query text default null,category_filter text default null,location_filter text default null,perk_filter text default null,
  result_limit integer default 24,result_offset integer default 0
) returns table(
  slug text,name text,logo_url text,description text,primary_category text,additional_categories text[],service_areas text[],phone text,
  public_email text,website_url text,google_business_profile_url text,operating_hours text,languages_spoken text[],offers_free_estimates boolean,
  emergency_available boolean,license_listed boolean,insurance_status text,membership_code text,membership_name text,badge_label text,is_founding_partner boolean,
  property_manager_perk_enabled boolean,property_manager_perk_title text,property_manager_perk_description text,property_manager_perk_type text,
  property_manager_perk_terms text,property_manager_perk_expiration_date date,total_count bigint
) language sql stable security definer set search_path='' as $$
  with eligible as (
    select o.slug,o.name,vp.logo_url,vp.description,coalesce(categories.names[1],'Local services') primary_category,
      coalesce(categories.names[2:cardinality(categories.names)],array[]::text[]) additional_categories,coalesce(areas.names,array[]::text[]) service_areas,
      o.phone,vp.public_email,o.website_url,vp.google_business_profile_url,vp.operating_hours,vp.languages_spoken,vp.offers_free_estimates,
      vp.emergency_available,(vp.license_applicable and vp.license_number is not null) license_listed,vp.insurance_status,
      level.code membership_code,level.name membership_name,level.badge_label,(level.code='founding_partner') is_founding_partner,level.placement_priority,
      (coalesce((level.features->>'property_manager_perk')::boolean,false) and vp.property_manager_perk_enabled and vp.property_manager_perk_title is not null
        and vp.property_manager_perk_description is not null and (vp.property_manager_perk_expiration_date is null or vp.property_manager_perk_expiration_date>=current_date)) perk_visible,
      vp.property_manager_perk_title,vp.property_manager_perk_description,vp.property_manager_perk_type,vp.property_manager_perk_terms,vp.property_manager_perk_expiration_date
    from public.organizations o join public.vendor_profiles vp on vp.organization_id=o.id and vp.lifecycle_status='eligible' and vp.publication_status='published'
    join lateral(select vm.* from public.vendor_memberships vm where vm.vendor_organization_id=o.id order by vm.created_at desc limit 1) vm on true
    join public.vendor_membership_levels level on level.id=vm.membership_level_id and level.publication_eligible
    left join lateral(select array_agg(vc.name order by vca.created_at,vc.name) names from public.vendor_category_assignments vca join public.vendor_categories vc on vc.id=vca.vendor_category_id and vc.is_active where vca.vendor_organization_id=o.id) categories on true
    left join lateral(select array_agg(c.name||', '||c.state_code order by c.name) names from public.vendor_service_cities vsc join public.cities c on c.id=vsc.city_id and c.is_active where vsc.vendor_organization_id=o.id and vsc.is_active) areas on true
    where o.type='vendor' and o.status='active' and vp.suspended_at is null and vp.disabled_at is null and vp.deleted_at is null
      and (vm.status in ('active','trialing','complimentary','manually_granted') or (vm.status='past_due' and vm.current_period_ends_at>now()))
  ),filtered as(select * from eligible e where
    (search_query is null or trim(search_query)='' or e.name ilike '%'||trim(search_query)||'%' or e.description ilike '%'||trim(search_query)||'%' or e.primary_category ilike '%'||trim(search_query)||'%' or exists(select 1 from unnest(e.additional_categories) x where x ilike '%'||trim(search_query)||'%') or exists(select 1 from unnest(e.service_areas) x where x ilike '%'||trim(search_query)||'%'))
    and (category_filter is null or trim(category_filter)='' or trim(both '-' from lower(regexp_replace(e.primary_category,'[^a-zA-Z0-9]+','-','g')))=category_filter or exists(select 1 from unnest(e.additional_categories) x where trim(both '-' from lower(regexp_replace(x,'[^a-zA-Z0-9]+','-','g')))=category_filter))
    and (location_filter is null or trim(location_filter)='' or exists(select 1 from unnest(e.service_areas) x where lower(x)=lower(trim(location_filter))))
    and (perk_filter is null or trim(perk_filter)='' or (e.perk_visible and (perk_filter='any' or e.property_manager_perk_type=perk_filter))))
  select e.slug,e.name,e.logo_url,e.description,e.primary_category,e.additional_categories,e.service_areas,e.phone,e.public_email,e.website_url,
    e.google_business_profile_url,e.operating_hours,e.languages_spoken,e.offers_free_estimates,e.emergency_available,e.license_listed,e.insurance_status,
    e.membership_code,e.membership_name,e.badge_label,e.is_founding_partner,e.perk_visible,
    case when e.perk_visible then e.property_manager_perk_title end,case when e.perk_visible then e.property_manager_perk_description end,
    case when e.perk_visible then e.property_manager_perk_type end,case when e.perk_visible then e.property_manager_perk_terms end,
    case when e.perk_visible then e.property_manager_perk_expiration_date end,count(*) over()
  from filtered e order by e.placement_priority desc,e.perk_visible desc,e.name limit least(greatest(result_limit,1),100) offset greatest(result_offset,0);
$$;

create or replace function public.get_public_vendor_profile(target_slug text)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('slug',o.slug,'name',o.name,'logoUrl',vp.logo_url,'foundingPartner',level.code='founding_partner','tierCode',level.code,
    'membershipName',level.name,'badgeLabel',level.badge_label,'primaryCategory',coalesce(categories.names[1],'Local services'),
    'additionalCategories',coalesce(categories.names[2:cardinality(categories.names)],array[]::text[]),'description',vp.description,
    'servicesOffered',coalesce(services.names,array[]::text[]),'serviceAreas',coalesce(areas.names,array[]::text[]),'serviceRadiusMiles',null,'customerType','both',
    'phone',o.phone,'email',vp.public_email,'website',o.website_url,'googleBusinessProfileUrl',vp.google_business_profile_url,'operatingHours',vp.operating_hours,
    'languagesSpoken',vp.languages_spoken,'offersFreeEstimates',vp.offers_free_estimates,'offersFinancing',vp.offers_financing,'emergencyAvailable',vp.emergency_available,
    'licenseApplicable',vp.license_applicable,'licenseNumber',case when vp.license_applicable then vp.license_number else null end,'insuranceStatus',vp.insurance_status,
    'yearsInBusiness',vp.years_in_business,'featuredImageUrl',media.external_url,'publicDisplayConsent',vp.public_display_consent,
    'propertyManagerPerk',case when coalesce((level.features->>'property_manager_perk')::boolean,false) and vp.property_manager_perk_enabled and vp.property_manager_perk_title is not null and vp.property_manager_perk_description is not null and (vp.property_manager_perk_expiration_date is null or vp.property_manager_perk_expiration_date>=current_date) then jsonb_build_object('enabled',true,'title',vp.property_manager_perk_title,'description',vp.property_manager_perk_description,'type',vp.property_manager_perk_type,'terms',vp.property_manager_perk_terms,'expirationDate',vp.property_manager_perk_expiration_date) else null end)
  from public.organizations o join public.vendor_profiles vp on vp.organization_id=o.id and vp.lifecycle_status='eligible' and vp.publication_status='published'
  join lateral(select vm.* from public.vendor_memberships vm where vm.vendor_organization_id=o.id order by vm.created_at desc limit 1) vm on true
  join public.vendor_membership_levels level on level.id=vm.membership_level_id and level.publication_eligible
  left join lateral(select array_agg(vc.name order by vca.created_at,vc.name) names from public.vendor_category_assignments vca join public.vendor_categories vc on vc.id=vca.vendor_category_id and vc.is_active where vca.vendor_organization_id=o.id) categories on true
  left join lateral(select array_agg(vs.name order by vs.name) names from public.vendor_service_offerings vso join public.vendor_services vs on vs.id=vso.vendor_service_id and vs.is_active where vso.vendor_organization_id=o.id and vso.is_active) services on true
  left join lateral(select array_agg(c.name||', '||c.state_code order by c.name) names from public.vendor_service_cities vsc join public.cities c on c.id=vsc.city_id and c.is_active where vsc.vendor_organization_id=o.id and vsc.is_active) areas on true
  left join lateral(select m.external_url from public.vendor_marketplace_media m where m.vendor_organization_id=o.id and m.is_published order by m.sort_order,m.created_at limit 1) media on true
  where o.slug=target_slug and o.type='vendor' and o.status='active' and vp.suspended_at is null and vp.disabled_at is null and vp.deleted_at is null
    and (vm.status in ('active','trialing','complimentary','manually_granted') or (vm.status='past_due' and vm.current_period_ends_at>now())) limit 1;
$$;

create or replace function public.get_public_vendor_filters()
returns jsonb language sql stable security definer set search_path='' as $$
  with vendors as(select * from public.search_public_vendors(null,null,null,null,100,0)),categories as(select item name,trim(both '-' from lower(regexp_replace(item,'[^a-zA-Z0-9]+','-','g'))) slug,count(*) count from vendors cross join lateral unnest(array_prepend(primary_category,additional_categories)) item group by item),locations as(select item name,count(*) count from vendors cross join lateral unnest(service_areas) item group by item)
  select jsonb_build_object('categories',coalesce((select jsonb_agg(jsonb_build_object('name',name,'slug',slug,'count',count) order by name) from categories),'[]'::jsonb),'locations',coalesce((select jsonb_agg(jsonb_build_object('name',name,'count',count) order by name) from locations),'[]'::jsonb));
$$;

revoke execute on function public.vendor_profile_completion(uuid) from public;
revoke execute on function public.evaluate_vendor_organization_activation(uuid) from public,anon,authenticated;
revoke execute on function public.admin_manage_vendor_lifecycle(uuid,text,text) from public,anon;
grant execute on function public.vendor_profile_completion(uuid) to authenticated,service_role;
grant execute on function public.evaluate_vendor_organization_activation(uuid) to service_role;
grant execute on function public.admin_manage_vendor_lifecycle(uuid,text,text) to authenticated,service_role;
revoke execute on function public.create_or_resume_vendor_enrollment(uuid,text,text,text,text,text,text,text,text,text,text,integer,text,integer) from public,anon,authenticated;
revoke execute on function public.save_vendor_profile_onboarding(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.create_or_resume_vendor_enrollment(uuid,text,text,text,text,text,text,text,text,text,text,integer,text,integer) to service_role;
grant execute on function public.save_vendor_profile_onboarding(uuid,uuid,jsonb) to service_role;
revoke execute on function public.search_public_vendors(text,text,text,text,integer,integer) from public;
revoke execute on function public.get_public_vendor_profile(text) from public;
revoke execute on function public.get_public_vendor_filters() from public;
grant execute on function public.search_public_vendors(text,text,text,text,integer,integer) to anon,authenticated,service_role;
grant execute on function public.get_public_vendor_profile(text) to anon,authenticated,service_role;
grant execute on function public.get_public_vendor_filters() to anon,authenticated,service_role;

comment on function public.evaluate_vendor_organization_activation is 'Single tier-driven payment, profile, approval, suspension, and publication evaluator. Payment alone never publishes.';
commit;
