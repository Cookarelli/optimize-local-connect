begin;

update public.founding_partner_onboardings
set approved_at=coalesce(approved_at,reviewed_at,status_changed_at,updated_at)
where status in ('approved','active') and approved_at is null;

create or replace function public.search_public_founding_partners(
  search_query text default null,
  category_filter text default null,
  location_filter text default null,
  result_limit integer default 24,
  result_offset integer default 0
) returns table(
  slug text,
  name text,
  logo_url text,
  description text,
  primary_category text,
  additional_categories text[],
  service_areas text[],
  phone text,
  public_email text,
  website_url text,
  google_business_profile_url text,
  operating_hours text,
  languages_spoken text[],
  offers_free_estimates boolean,
  emergency_available boolean,
  license_listed boolean,
  insurance_status text,
  total_count bigint
) language sql stable security definer set search_path='' as $$
  with eligible as (
    select
      o.slug,f.business_name name,f.logo_url,
      coalesce(f.company_bio,f.business_description) description,
      f.primary_service_category primary_category,f.additional_service_categories additional_categories,
      f.service_area_cities service_areas,f.phone,f.customer_email public_email,f.website website_url,
      f.google_business_profile_url,f.operating_hours,f.languages_spoken,f.offers_free_estimates,
      f.emergency_service_available emergency_available,(f.license_applicable and f.license_number is not null) license_listed,f.insurance_status,
      coalesce(level.rank,0) placement_priority
    from public.founding_partner_onboardings f
    join public.founding_partner_payments p on p.id=f.payment_id
      and p.payment_status='paid' and p.amount_paid_cents=29900 and p.currency='USD' and p.membership_type='founding_partner'
    join public.organizations o on o.id=f.vendor_organization_id and o.type='vendor' and o.status='active'
    join public.vendor_profiles vp on vp.organization_id=o.id
    join public.vendor_memberships vm on vm.vendor_organization_id=o.id and vm.status='active'
    join public.vendor_membership_levels level on level.id=vm.membership_level_id and level.code='founding_partner'
    where f.status='active' and f.approved_at is not null and f.activated_at is not null and f.public_display_consent
  ), filtered as (
    select * from eligible e where
      (search_query is null or trim(search_query)='' or
        e.name ilike '%'||trim(search_query)||'%' or e.description ilike '%'||trim(search_query)||'%' or
        e.primary_category ilike '%'||trim(search_query)||'%' or
        exists(select 1 from unnest(e.additional_categories) item where item ilike '%'||trim(search_query)||'%') or
        exists(select 1 from unnest(e.service_areas) item where item ilike '%'||trim(search_query)||'%'))
      and (category_filter is null or trim(category_filter)='' or
        trim(both '-' from lower(regexp_replace(e.primary_category,'[^a-zA-Z0-9]+','-','g')))=category_filter or
        exists(select 1 from unnest(e.additional_categories) item where trim(both '-' from lower(regexp_replace(item,'[^a-zA-Z0-9]+','-','g')))=category_filter))
      and (location_filter is null or trim(location_filter)='' or
        exists(select 1 from unnest(e.service_areas) item where lower(item)=lower(trim(location_filter))))
  )
  select e.slug,e.name,e.logo_url,e.description,e.primary_category,e.additional_categories,e.service_areas,e.phone,e.public_email,
    e.website_url,e.google_business_profile_url,e.operating_hours,e.languages_spoken,e.offers_free_estimates,e.emergency_available,
    e.license_listed,e.insurance_status,count(*) over() total_count
  from filtered e
  order by e.placement_priority desc,e.name
  limit least(greatest(result_limit,1),100) offset greatest(result_offset,0);
$$;

create or replace function public.get_public_founding_partner_profile(target_slug text)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'slug',o.slug,
    'name',f.business_name,
    'logoUrl',f.logo_url,
    'foundingPartner',true,
    'primaryCategory',f.primary_service_category,
    'additionalCategories',f.additional_service_categories,
    'description',coalesce(f.company_bio,f.business_description),
    'servicesOffered',f.services_offered,
    'serviceAreas',f.service_area_cities,
    'serviceRadiusMiles',f.service_radius_miles,
    'customerType',f.customer_type,
    'phone',f.phone,
    'email',f.customer_email,
    'website',f.website,
    'googleBusinessProfileUrl',f.google_business_profile_url,
    'operatingHours',f.operating_hours,
    'languagesSpoken',f.languages_spoken,
    'offersFreeEstimates',f.offers_free_estimates,
    'offersFinancing',f.offers_financing,
    'emergencyAvailable',f.emergency_service_available,
    'licenseApplicable',f.license_applicable,
    'licenseNumber',case when f.license_applicable then f.license_number else null end,
    'insuranceStatus',f.insurance_status,
    'yearsInBusiness',f.years_in_business,
    'featuredImageUrl',f.featured_image_url,
    'publicDisplayConsent',f.public_display_consent
  )
  from public.founding_partner_onboardings f
  join public.founding_partner_payments p on p.id=f.payment_id
    and p.payment_status='paid' and p.amount_paid_cents=29900 and p.currency='USD' and p.membership_type='founding_partner'
  join public.organizations o on o.id=f.vendor_organization_id and o.type='vendor' and o.status='active' and o.slug=target_slug
  join public.vendor_profiles vp on vp.organization_id=o.id
  where f.status='active' and f.approved_at is not null and f.activated_at is not null and f.public_display_consent
    and exists(
      select 1 from public.vendor_memberships vm join public.vendor_membership_levels level on level.id=vm.membership_level_id
      where vm.vendor_organization_id=o.id and vm.status='active' and level.code='founding_partner'
    )
  limit 1;
$$;

create or replace function public.get_public_founding_partner_filters()
returns jsonb language sql stable security definer set search_path='' as $$
  with eligible as (
    select f.primary_service_category,f.additional_service_categories,f.service_area_cities
    from public.founding_partner_onboardings f
    join public.founding_partner_payments p on p.id=f.payment_id and p.payment_status='paid' and p.amount_paid_cents=29900 and p.currency='USD' and p.membership_type='founding_partner'
    join public.organizations o on o.id=f.vendor_organization_id and o.type='vendor' and o.status='active'
    join public.vendor_profiles vp on vp.organization_id=o.id
    where f.status='active' and f.approved_at is not null and f.activated_at is not null and f.public_display_consent
      and exists(select 1 from public.vendor_memberships vm join public.vendor_membership_levels level on level.id=vm.membership_level_id where vm.vendor_organization_id=o.id and vm.status='active' and level.code='founding_partner')
  ), categories as (
    select item name,trim(both '-' from lower(regexp_replace(item,'[^a-zA-Z0-9]+','-','g'))) slug,count(*) count
    from eligible cross join lateral unnest(array_prepend(primary_service_category,additional_service_categories)) item
    where item is not null and trim(item)<>'' group by item
  ), locations as (
    select item name,count(*) count from eligible cross join lateral unnest(service_area_cities) item
    where trim(item)<>'' group by item
  )
  select jsonb_build_object(
    'categories',coalesce((select jsonb_agg(jsonb_build_object('name',name,'slug',slug,'count',count) order by name) from categories),'[]'::jsonb),
    'locations',coalesce((select jsonb_agg(jsonb_build_object('name',name,'count',count) order by name) from locations),'[]'::jsonb)
  );
$$;

revoke execute on function public.search_public_founding_partners(text,text,text,integer,integer) from public;
revoke execute on function public.get_public_founding_partner_profile(text) from public;
revoke execute on function public.get_public_founding_partner_filters() from public;
grant execute on function public.search_public_founding_partners(text,text,text,integer,integer) to anon,authenticated,service_role;
grant execute on function public.get_public_founding_partner_profile(text) to anon,authenticated,service_role;
grant execute on function public.get_public_founding_partner_filters() to anon,authenticated,service_role;

comment on function public.search_public_founding_partners is 'Public-safe Founder marketplace search. Eligibility requires an immutable verified $299 payment, approved and active onboarding, active organization, active Founding Partner membership, and public-display consent.';
comment on function public.get_public_founding_partner_profile is 'Public-safe Founder profile read model that excludes payment, admin, review, and document data.';

commit;
