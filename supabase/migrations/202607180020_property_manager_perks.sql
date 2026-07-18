begin;

alter table public.vendor_profiles
  add column if not exists property_manager_perk_enabled boolean not null default false,
  add column if not exists property_manager_perk_title text,
  add column if not exists property_manager_perk_description text,
  add column if not exists property_manager_perk_type text,
  add column if not exists property_manager_perk_terms text,
  add column if not exists property_manager_perk_expiration_date date,
  add column if not exists property_manager_perk_verified boolean not null default false,
  add column if not exists property_manager_perk_updated_at timestamptz;

alter table public.founding_partner_onboardings
  add column if not exists property_manager_perk_enabled boolean not null default false,
  add column if not exists property_manager_perk_title text,
  add column if not exists property_manager_perk_description text,
  add column if not exists property_manager_perk_type text,
  add column if not exists property_manager_perk_terms text,
  add column if not exists property_manager_perk_expiration_date date,
  add column if not exists property_manager_perk_verified boolean not null default false,
  add column if not exists property_manager_perk_updated_at timestamptz;

alter table public.vendor_profiles add constraint vendor_profiles_property_manager_perk_check check (
  (not property_manager_perk_enabled or (char_length(coalesce(trim(property_manager_perk_title),'')) between 3 and 80 and char_length(coalesce(trim(property_manager_perk_description),'')) between 10 and 280 and coalesce(property_manager_perk_type,'') in ('priority_response','free_estimate','discount','free_service','multi_property_pricing','custom')))
  and (property_manager_perk_title is null or (char_length(property_manager_perk_title)<=80 and property_manager_perk_title!~'[<>]'))
  and (property_manager_perk_description is null or (char_length(property_manager_perk_description)<=280 and property_manager_perk_description!~'[<>]'))
  and (property_manager_perk_terms is null or (char_length(property_manager_perk_terms)<=500 and property_manager_perk_terms!~'[<>]'))
  and (property_manager_perk_type is null or property_manager_perk_type in ('priority_response','free_estimate','discount','free_service','multi_property_pricing','custom'))
  and concat_ws(' ',property_manager_perk_title,property_manager_perk_description,property_manager_perk_terms)!~*'\m(guaranteed (leads?|revenue|results?|savings)|officially endorsed by optimize local|best (vendor|contractor|company) in)\M'
);

alter table public.founding_partner_onboardings add constraint founding_partner_onboardings_property_manager_perk_check check (
  (not property_manager_perk_enabled or (char_length(coalesce(trim(property_manager_perk_title),'')) between 3 and 80 and char_length(coalesce(trim(property_manager_perk_description),'')) between 10 and 280 and coalesce(property_manager_perk_type,'') in ('priority_response','free_estimate','discount','free_service','multi_property_pricing','custom')))
  and (property_manager_perk_title is null or (char_length(property_manager_perk_title)<=80 and property_manager_perk_title!~'[<>]'))
  and (property_manager_perk_description is null or (char_length(property_manager_perk_description)<=280 and property_manager_perk_description!~'[<>]'))
  and (property_manager_perk_terms is null or (char_length(property_manager_perk_terms)<=500 and property_manager_perk_terms!~'[<>]'))
  and (property_manager_perk_type is null or property_manager_perk_type in ('priority_response','free_estimate','discount','free_service','multi_property_pricing','custom'))
  and concat_ws(' ',property_manager_perk_title,property_manager_perk_description,property_manager_perk_terms)!~*'\m(guaranteed (leads?|revenue|results?|savings)|officially endorsed by optimize local|best (vendor|contractor|company) in)\M'
);

update public.vendor_membership_levels
set features=features||'{"property_manager_perk":true}'::jsonb,
    entitlement_version=entitlement_version+1,
    updated_at=now()
where code in ('premium','founding_partner') and not coalesce((features->>'property_manager_perk')::boolean,false);

update public.vendor_memberships vm
set entitlements_snapshot=entitlements_snapshot||'{"property_manager_perk":true}'::jsonb,updated_at=now()
from public.vendor_membership_levels level
where level.id=vm.membership_level_id and level.code in ('premium','founding_partner')
  and vm.status in ('trialing','active','past_due')
  and (vm.current_period_ends_at is null or vm.current_period_ends_at>now())
  and (vm.status<>'past_due' or (vm.current_period_ends_at is not null and vm.current_period_ends_at>now()));

create or replace function public.save_founding_partner_perk(target_onboarding_id uuid,target_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare onboarding public.founding_partner_onboardings%rowtype;
declare enabled boolean:=coalesce((target_payload->>'enabled')::boolean,false);
declare title text:=nullif(trim(target_payload->>'title'),'');
declare description text:=nullif(trim(target_payload->>'description'),'');
declare terms text:=nullif(trim(target_payload->>'terms'),'');
declare perk_type text:=coalesce(nullif(target_payload->>'type',''),'custom');
declare expiration date:=nullif(target_payload->>'expiration_date','')::date;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'service role required'; end if;
  select * into onboarding from public.founding_partner_onboardings where id=target_onboarding_id for update;
  if not found then raise exception 'onboarding record not found'; end if;
  if onboarding.status not in ('paid_onboarding_incomplete','changes_requested') then raise exception 'onboarding is not editable'; end if;
  if enabled and (char_length(coalesce(title,'')) not between 3 and 80 or char_length(coalesce(description,'')) not between 10 and 280) then raise exception 'enabled perk is incomplete'; end if;
  if perk_type not in ('priority_response','free_estimate','discount','free_service','multi_property_pricing','custom') then raise exception 'invalid perk type'; end if;
  if coalesce(title,'')~'[<>]' or coalesce(description,'')~'[<>]' or coalesce(terms,'')~'[<>]' then raise exception 'perk must be plain text'; end if;
  if char_length(coalesce(terms,''))>500 then raise exception 'perk terms are too long'; end if;
  if concat_ws(' ',title,description,terms)~*'\m(guaranteed (leads?|revenue|results?|savings)|officially endorsed by optimize local|best (vendor|contractor|company) in)\M' then raise exception 'misleading perk claim'; end if;
  update public.founding_partner_onboardings set
    property_manager_perk_enabled=enabled,property_manager_perk_title=title,property_manager_perk_description=description,
    property_manager_perk_type=perk_type,property_manager_perk_terms=terms,property_manager_perk_expiration_date=expiration,
    property_manager_perk_verified=false,property_manager_perk_updated_at=now(),updated_at=now()
  where id=target_onboarding_id;
  return target_onboarding_id;
end $$;

revoke execute on function public.save_founding_partner_perk(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_founding_partner_perk(uuid,jsonb) to service_role;

create or replace function public.sync_founding_partner_perk_to_vendor_profile()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='active' and new.vendor_organization_id is not null then
    update public.vendor_profiles set
      property_manager_perk_enabled=new.property_manager_perk_enabled,
      property_manager_perk_title=new.property_manager_perk_title,
      property_manager_perk_description=new.property_manager_perk_description,
      property_manager_perk_type=new.property_manager_perk_type,
      property_manager_perk_terms=new.property_manager_perk_terms,
      property_manager_perk_expiration_date=new.property_manager_perk_expiration_date,
      property_manager_perk_verified=new.property_manager_perk_verified,
      property_manager_perk_updated_at=coalesce(new.property_manager_perk_updated_at,now())
    where organization_id=new.vendor_organization_id
      and (property_manager_perk_updated_at is null or property_manager_perk_updated_at<=coalesce(new.property_manager_perk_updated_at,new.updated_at));
  end if;
  return new;
end $$;
create trigger sync_founding_partner_perk_after_activation after insert or update of status,property_manager_perk_enabled,property_manager_perk_title,property_manager_perk_description,property_manager_perk_type,property_manager_perk_terms,property_manager_perk_expiration_date
on public.founding_partner_onboardings for each row execute function public.sync_founding_partner_perk_to_vendor_profile();

drop function if exists public.search_public_founding_partners(text,text,text,integer,integer);
create function public.search_public_founding_partners(
  search_query text default null,category_filter text default null,location_filter text default null,perk_filter text default null,
  result_limit integer default 24,result_offset integer default 0
) returns table(
  slug text,name text,logo_url text,description text,primary_category text,additional_categories text[],service_areas text[],phone text,
  public_email text,website_url text,google_business_profile_url text,operating_hours text,languages_spoken text[],offers_free_estimates boolean,
  emergency_available boolean,license_listed boolean,insurance_status text,property_manager_perk_enabled boolean,property_manager_perk_title text,
  property_manager_perk_description text,property_manager_perk_type text,property_manager_perk_terms text,property_manager_perk_expiration_date date,total_count bigint
) language sql stable security definer set search_path='' as $$
  with eligible as (
    select o.slug,f.business_name name,f.logo_url,coalesce(f.company_bio,f.business_description) description,
      f.primary_service_category primary_category,f.additional_service_categories additional_categories,f.service_area_cities service_areas,
      f.phone,f.customer_email public_email,f.website website_url,f.google_business_profile_url,f.operating_hours,f.languages_spoken,
      f.offers_free_estimates,f.emergency_service_available emergency_available,(f.license_applicable and f.license_number is not null) license_listed,
      f.insurance_status,coalesce(level.rank,0) placement_priority,
      (public.vendor_has_entitlement(o.id,'property_manager_perk') and vp.property_manager_perk_enabled
        and vp.property_manager_perk_title is not null and vp.property_manager_perk_description is not null
        and (vp.property_manager_perk_expiration_date is null or vp.property_manager_perk_expiration_date>=current_date)) perk_visible,
      vp.property_manager_perk_title, vp.property_manager_perk_description, vp.property_manager_perk_type,
      vp.property_manager_perk_terms,vp.property_manager_perk_expiration_date
    from public.founding_partner_onboardings f
    join public.founding_partner_payments p on p.id=f.payment_id and p.payment_status='paid' and p.amount_paid_cents=29900 and p.currency='USD' and p.membership_type='founding_partner'
    join public.organizations o on o.id=f.vendor_organization_id and o.type='vendor' and o.status='active'
    join public.vendor_profiles vp on vp.organization_id=o.id
    join public.vendor_memberships vm on vm.vendor_organization_id=o.id and vm.status in ('active','trialing','past_due')
      and (vm.current_period_ends_at is null or vm.current_period_ends_at>now())
      and (vm.status<>'past_due' or (vm.current_period_ends_at is not null and vm.current_period_ends_at>now()))
    join public.vendor_membership_levels level on level.id=vm.membership_level_id and level.code='founding_partner'
    where f.status='active' and f.approved_at is not null and f.activated_at is not null and f.public_display_consent
  ), filtered as (
    select * from eligible e where
      (search_query is null or trim(search_query)='' or e.name ilike '%'||trim(search_query)||'%' or e.description ilike '%'||trim(search_query)||'%' or e.primary_category ilike '%'||trim(search_query)||'%' or exists(select 1 from unnest(e.additional_categories) item where item ilike '%'||trim(search_query)||'%') or exists(select 1 from unnest(e.service_areas) item where item ilike '%'||trim(search_query)||'%'))
      and (category_filter is null or trim(category_filter)='' or trim(both '-' from lower(regexp_replace(e.primary_category,'[^a-zA-Z0-9]+','-','g')))=category_filter or exists(select 1 from unnest(e.additional_categories) item where trim(both '-' from lower(regexp_replace(item,'[^a-zA-Z0-9]+','-','g')))=category_filter))
      and (location_filter is null or trim(location_filter)='' or exists(select 1 from unnest(e.service_areas) item where lower(item)=lower(trim(location_filter))))
      and (perk_filter is null or trim(perk_filter)='' or (e.perk_visible and (perk_filter='any' or e.property_manager_perk_type=perk_filter)))
  )
  select e.slug,e.name,e.logo_url,e.description,e.primary_category,e.additional_categories,e.service_areas,e.phone,e.public_email,e.website_url,
    e.google_business_profile_url,e.operating_hours,e.languages_spoken,e.offers_free_estimates,e.emergency_available,e.license_listed,e.insurance_status,
    e.perk_visible,case when e.perk_visible then e.property_manager_perk_title end,case when e.perk_visible then e.property_manager_perk_description end,
    case when e.perk_visible then e.property_manager_perk_type end,case when e.perk_visible then e.property_manager_perk_terms end,
    case when e.perk_visible then e.property_manager_perk_expiration_date end,count(*) over()
  from filtered e order by e.placement_priority desc,e.perk_visible desc,e.name
  limit least(greatest(result_limit,1),100) offset greatest(result_offset,0);
$$;

create or replace function public.get_public_founding_partner_profile(target_slug text)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'slug',o.slug,'name',f.business_name,'logoUrl',f.logo_url,'foundingPartner',true,'primaryCategory',f.primary_service_category,
    'additionalCategories',f.additional_service_categories,'description',coalesce(f.company_bio,f.business_description),'servicesOffered',f.services_offered,
    'serviceAreas',f.service_area_cities,'serviceRadiusMiles',f.service_radius_miles,'customerType',f.customer_type,'phone',f.phone,'email',f.customer_email,
    'website',f.website,'googleBusinessProfileUrl',f.google_business_profile_url,'operatingHours',f.operating_hours,'languagesSpoken',f.languages_spoken,
    'offersFreeEstimates',f.offers_free_estimates,'offersFinancing',f.offers_financing,'emergencyAvailable',f.emergency_service_available,
    'licenseApplicable',f.license_applicable,'licenseNumber',case when f.license_applicable then f.license_number else null end,'insuranceStatus',f.insurance_status,
    'yearsInBusiness',f.years_in_business,'featuredImageUrl',f.featured_image_url,'publicDisplayConsent',f.public_display_consent,
    'propertyManagerPerk',case when public.vendor_has_entitlement(o.id,'property_manager_perk') and vp.property_manager_perk_enabled
      and vp.property_manager_perk_title is not null and vp.property_manager_perk_description is not null
      and (vp.property_manager_perk_expiration_date is null or vp.property_manager_perk_expiration_date>=current_date)
      then jsonb_build_object('enabled',true,'title',vp.property_manager_perk_title,'description',vp.property_manager_perk_description,'type',vp.property_manager_perk_type,'terms',vp.property_manager_perk_terms,'expirationDate',vp.property_manager_perk_expiration_date) else null end
  )
  from public.founding_partner_onboardings f
  join public.founding_partner_payments p on p.id=f.payment_id and p.payment_status='paid' and p.amount_paid_cents=29900 and p.currency='USD' and p.membership_type='founding_partner'
  join public.organizations o on o.id=f.vendor_organization_id and o.type='vendor' and o.status='active' and o.slug=target_slug
  join public.vendor_profiles vp on vp.organization_id=o.id
  where f.status='active' and f.approved_at is not null and f.activated_at is not null and f.public_display_consent
    and exists(select 1 from public.vendor_memberships vm join public.vendor_membership_levels level on level.id=vm.membership_level_id
      where vm.vendor_organization_id=o.id and vm.status in ('active','trialing','past_due') and level.code='founding_partner'
        and (vm.current_period_ends_at is null or vm.current_period_ends_at>now())
        and (vm.status<>'past_due' or (vm.current_period_ends_at is not null and vm.current_period_ends_at>now())))
  limit 1;
$$;

revoke execute on function public.search_public_founding_partners(text,text,text,text,integer,integer) from public;
grant execute on function public.search_public_founding_partners(text,text,text,text,integer,integer) to anon,authenticated,service_role;
grant execute on function public.get_public_founding_partner_profile(text) to anon,authenticated,service_role;

comment on column public.vendor_profiles.property_manager_perk_enabled is 'Public display toggle; the active membership entitlement and expiration are also required.';
comment on function public.save_founding_partner_perk is 'Service-role-only paid onboarding perk draft update with server-side validation.';

commit;
