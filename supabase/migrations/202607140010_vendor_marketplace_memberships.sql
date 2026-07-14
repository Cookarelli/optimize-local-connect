begin;

-- Marketplace memberships are commercial products, not authorization roles.
-- Entitlements are versioned and snapshotted on activation so historical access
-- remains explainable when the public catalog changes.
alter table public.vendor_membership_levels
  add column if not exists billing_model text not null default 'free'
    check (billing_model in ('free','subscription','one_time')),
  add column if not exists one_time_price_cents integer
    check (one_time_price_cents is null or one_time_price_cents >= 0),
  add column if not exists capacity integer
    check (capacity is null or capacity > 0),
  add column if not exists entitlement_version integer not null default 1
    check (entitlement_version > 0),
  add column if not exists display_order integer not null default 0,
  add column if not exists is_public boolean not null default true;

alter table public.vendor_memberships
  add column if not exists source text not null default 'admin'
    check (source in ('self_service','admin','founding_program','migration','billing_webhook')),
  add column if not exists entitlements_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists locked_renewal_price_cents integer
    check (locked_renewal_price_cents is null or locked_renewal_price_cents >= 0),
  add column if not exists locked_renewal_currency text
    check (locked_renewal_currency is null or char_length(locked_renewal_currency) = 3),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.vendor_membership_levels set is_active=false,is_public=false,
  rank=case code when 'local_pro' then 110 when 'market_leader' then 120 else rank end
where code in ('local_pro','market_leader');

insert into public.vendor_membership_levels
  (code,name,description,rank,monthly_price_cents,annual_price_cents,quote_limit_per_month,features,is_active,billing_model,one_time_price_cents,capacity,entitlement_version,display_order,is_public)
values
  ('free','Free','A professional marketplace profile with the essentials to start building local relationships.',0,0,0,5,
    '{"marketplace_profile":true,"standard_search":true}'::jsonb,true,'free',null,null,1,10,true),
  ('verified','Verified','Current license and insurance verification with priority marketplace search.',10,0,0,null,
    '{"marketplace_profile":true,"license_verification":true,"insurance_verification":true,"priority_search":true}'::jsonb,true,'free',null,null,1,20,true),
  ('premium','Premium','Growth tools and intelligent placement for established local providers.',20,4900,58800,null,
    '{"marketplace_profile":true,"license_verification":true,"insurance_verification":true,"priority_search":true,"ai_placement":true,"homepage_placement":true,"videos":true,"coupons":true,"analytics":true,"push_notifications":true}'::jsonb,true,'subscription',null,null,2,30,true),
  ('founding_partner','Founding Partner','Permanent recognition for one of the first fifty businesses, including the first year of Premium and locked renewal pricing.',30,0,0,null,
    '{"marketplace_profile":true,"license_verification":true,"insurance_verification":true,"priority_search":true,"ai_placement":true,"homepage_placement":true,"videos":true,"coupons":true,"analytics":true,"push_notifications":true,"premium_included_months":12,"permanent_founding_badge":true,"locked_renewal_pricing":true}'::jsonb,true,'one_time',29900,50,1,40,true)
on conflict (code) do update set
  name=excluded.name,description=excluded.description,rank=excluded.rank,
  monthly_price_cents=excluded.monthly_price_cents,annual_price_cents=excluded.annual_price_cents,
  quote_limit_per_month=excluded.quote_limit_per_month,features=excluded.features,
  is_active=excluded.is_active,billing_model=excluded.billing_model,
  one_time_price_cents=excluded.one_time_price_cents,capacity=excluded.capacity,
  entitlement_version=excluded.entitlement_version,display_order=excluded.display_order,is_public=excluded.is_public;

insert into public.vendor_badges (code,name,description,icon_key,color_key)
values ('founding_partner','Founding Partner','Permanent recognition as one of the first fifty local businesses building Optimize Local Connect.','award','amber')
on conflict (code) do update set name=excluded.name,description=excluded.description,icon_key=excluded.icon_key,color_key=excluded.color_key,is_active=true;

create table public.vendor_membership_events (
  id bigint generated always as identity primary key,
  vendor_organization_id uuid not null references public.vendor_profiles(organization_id) on delete cascade,
  vendor_membership_id uuid references public.vendor_memberships(id) on delete set null,
  event_type text not null check (event_type in ('activated','renewed','changed','paused','resumed','cancelled','expired','payment_failed')),
  from_level_code text,
  to_level_code text,
  actor_user_id uuid references public.profiles(id) on delete set null,
  source text not null,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index vendor_membership_events_vendor_time_idx on public.vendor_membership_events(vendor_organization_id,occurred_at desc);

create or replace function public.prevent_vendor_membership_event_mutation()
returns trigger language plpgsql set search_path='' as $$ begin raise exception 'vendor membership events are immutable'; end $$;
create trigger vendor_membership_events_immutable before update or delete on public.vendor_membership_events
for each row execute function public.prevent_vendor_membership_event_mutation();

create table public.vendor_marketplace_media (
  id uuid primary key default gen_random_uuid(),
  vendor_organization_id uuid not null references public.vendor_profiles(organization_id) on delete cascade,
  media_type text not null check (media_type in ('image','video')),
  file_id uuid references public.files(id) on delete restrict,
  external_url text,
  title text check (title is null or char_length(title) <= 160),
  alt_text text check (alt_text is null or char_length(alt_text) <= 300),
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((file_id is not null)::integer + (external_url is not null)::integer = 1)
);
create index vendor_marketplace_media_vendor_idx on public.vendor_marketplace_media(vendor_organization_id,is_published,sort_order);

create table public.vendor_coupons (
  id uuid primary key default gen_random_uuid(),
  vendor_organization_id uuid not null references public.vendor_profiles(organization_id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9_-]{3,40}$'),
  title text not null check (char_length(title) between 3 and 160),
  description text,
  discount_type text not null check (discount_type in ('percent','fixed_amount','custom')),
  discount_value integer check (discount_value is null or discount_value > 0),
  currency text check (currency is null or char_length(currency)=3),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  redemption_limit integer check (redemption_limit is null or redemption_limit > 0),
  redemption_count integer not null default 0 check (redemption_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(vendor_organization_id,code),
  check (ends_at is null or ends_at > starts_at),
  check (redemption_limit is null or redemption_count <= redemption_limit),
  check ((discount_type='percent' and discount_value between 1 and 100 and currency is null)
    or (discount_type='fixed_amount' and discount_value is not null and currency is not null)
    or (discount_type='custom'))
);
create index vendor_coupons_marketplace_idx on public.vendor_coupons(vendor_organization_id,ends_at)
where is_active;

create or replace function public.vendor_has_entitlement(target_vendor_organization_id uuid,target_entitlement text)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((
    select (coalesce(nullif(vm.entitlements_snapshot,'{}'::jsonb),vml.features)->>target_entitlement)::boolean
    from public.vendor_memberships vm
    join public.vendor_membership_levels vml on vml.id=vm.membership_level_id
    where vm.vendor_organization_id=target_vendor_organization_id
      and vm.status in ('trialing','active')
      and (vm.current_period_ends_at is null or vm.current_period_ends_at>now())
    order by vml.rank desc,vm.starts_at desc limit 1
  ),false);
$$;

create or replace function public.hydrate_vendor_membership_entitlements()
returns trigger language plpgsql security definer set search_path='' as $$
declare selected_level public.vendor_membership_levels%rowtype;
begin
  if new.external_subscription_id like 'founding-fifty:%' then
    select * into selected_level from public.vendor_membership_levels where code='founding_partner';
    new.membership_level_id:=selected_level.id;
    new.source:='founding_program';
    new.locked_renewal_price_cents:=coalesce(new.locked_renewal_price_cents,4900);
    new.locked_renewal_currency:=coalesce(new.locked_renewal_currency,'USD');
    new.metadata:=coalesce(new.metadata,'{}'::jsonb)||jsonb_build_object('program','founding-fifty');
  else
    select * into selected_level from public.vendor_membership_levels where id=new.membership_level_id;
  end if;
  if selected_level.id is null then raise exception 'membership level not found'; end if;
  if new.entitlements_snapshot='{}'::jsonb then new.entitlements_snapshot:=selected_level.features; end if;
  return new;
end $$;
create trigger vendor_memberships_hydrate_entitlements before insert on public.vendor_memberships
for each row execute function public.hydrate_vendor_membership_entitlements();

create or replace function public.mirror_founding_partner_badge()
returns trigger language plpgsql security definer set search_path='' as $$
declare legacy_badge uuid; partner_badge uuid; current_membership_id uuid;
begin
  select id into legacy_badge from public.vendor_badges where code='founding_fifty';
  if new.vendor_badge_id<>legacy_badge then return new; end if;
  select id into partner_badge from public.vendor_badges where code='founding_partner';
  insert into public.vendor_badge_awards(vendor_organization_id,vendor_badge_id,awarded_by,reason,awarded_at,expires_at)
  values(new.vendor_organization_id,partner_badge,new.awarded_by,replace(new.reason,'Founding Fifty','Founding Partner'),new.awarded_at,new.expires_at)
  on conflict(vendor_organization_id,vendor_badge_id,awarded_at) do nothing;
  select vm.id into current_membership_id from public.vendor_memberships vm
  join public.vendor_membership_levels vml on vml.id=vm.membership_level_id
  where vm.vendor_organization_id=new.vendor_organization_id and vml.code='founding_partner'
  order by vm.starts_at desc limit 1;
  if current_membership_id is not null then
    insert into public.vendor_membership_events(vendor_organization_id,vendor_membership_id,event_type,to_level_code,actor_user_id,source,idempotency_key,metadata,occurred_at)
    values(new.vendor_organization_id,current_membership_id,'activated','founding_partner',new.awarded_by,'founding_program','founding-program:'||new.id,jsonb_build_object('badge_award_id',new.id),new.awarded_at)
    on conflict(idempotency_key) do nothing;
  end if;
  return new;
end $$;
create trigger founding_partner_badge_mirror after insert on public.vendor_badge_awards
for each row execute function public.mirror_founding_partner_badge();

create or replace function public.enforce_vendor_marketplace_entitlement()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='vendor_marketplace_media' and to_jsonb(new)->>'media_type'='video'
     and not public.vendor_has_entitlement(new.vendor_organization_id,'videos') then
    raise exception 'video publishing requires the videos entitlement';
  end if;
  if tg_table_name='vendor_coupons'
     and not public.vendor_has_entitlement(new.vendor_organization_id,'coupons') then
    raise exception 'coupon publishing requires the coupons entitlement';
  end if;
  return new;
end $$;
create trigger vendor_marketplace_media_entitlement before insert or update on public.vendor_marketplace_media
for each row execute function public.enforce_vendor_marketplace_entitlement();
create trigger vendor_coupons_entitlement before insert or update on public.vendor_coupons
for each row execute function public.enforce_vendor_marketplace_entitlement();
create trigger set_vendor_marketplace_media_updated_at before update on public.vendor_marketplace_media for each row execute function public.set_updated_at();
create trigger set_vendor_coupons_updated_at before update on public.vendor_coupons for each row execute function public.set_updated_at();

create or replace function public.activate_vendor_membership(
  target_vendor_organization_id uuid,target_level_code text,target_source text,
  target_idempotency_key text,target_external_subscription_id text default null,
  target_locked_renewal_price_cents integer default null,target_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare selected_level public.vendor_membership_levels%rowtype; new_membership_id uuid; current_level_code text; active_count integer;
begin
  if not (public.is_super_admin() or coalesce(auth.jwt()->>'role','')='service_role') then raise exception 'trusted membership activation required'; end if;
  if exists(select 1 from public.vendor_membership_events where idempotency_key=target_idempotency_key) then
    return (select vendor_membership_id from public.vendor_membership_events where idempotency_key=target_idempotency_key);
  end if;
  select * into selected_level from public.vendor_membership_levels where code=target_level_code and is_active for update;
  if not found then raise exception 'membership level not found'; end if;
  if selected_level.capacity is not null then
    select count(*) into active_count from public.vendor_memberships vm
    where vm.membership_level_id=selected_level.id and vm.status in ('trialing','active');
    if active_count >= selected_level.capacity then raise exception 'membership capacity reached'; end if;
  end if;
  select vml.code into current_level_code from public.vendor_memberships vm join public.vendor_membership_levels vml on vml.id=vm.membership_level_id
  where vm.vendor_organization_id=target_vendor_organization_id and vm.status in ('trialing','active','past_due','paused') order by vm.starts_at desc limit 1;
  update public.vendor_memberships set status='expired',current_period_ends_at=coalesce(current_period_ends_at,now()),updated_at=now()
  where vendor_organization_id=target_vendor_organization_id and status in ('trialing','active','past_due','paused');
  insert into public.vendor_memberships(vendor_organization_id,membership_level_id,status,starts_at,current_period_ends_at,external_subscription_id,source,entitlements_snapshot,locked_renewal_price_cents,locked_renewal_currency,metadata)
  values(target_vendor_organization_id,selected_level.id,'active',now(),
    case when selected_level.code='founding_partner' then now()+interval '12 months' else null end,
    target_external_subscription_id,target_source,selected_level.features,target_locked_renewal_price_cents,
    case when target_locked_renewal_price_cents is null then null else 'USD' end,target_metadata)
  returning id into new_membership_id;
  insert into public.vendor_membership_events(vendor_organization_id,vendor_membership_id,event_type,from_level_code,to_level_code,actor_user_id,source,idempotency_key,metadata)
  values(target_vendor_organization_id,new_membership_id,case when current_level_code is null then 'activated' else 'changed' end,current_level_code,selected_level.code,auth.uid(),target_source,target_idempotency_key,target_metadata);
  insert into public.audit_events(organization_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(target_vendor_organization_id,auth.uid(),'vendor_membership.activated','vendor_membership',new_membership_id,jsonb_build_object('level',selected_level.code,'source',target_source));
  return new_membership_id;
end $$;

-- Move confirmed Founding Fifty businesses to the governed Founding Partner tier.
do $$ declare founding_level uuid; founding_badge uuid; legacy_badge uuid; begin
  select id into founding_level from public.vendor_membership_levels where code='founding_partner';
  select id into founding_badge from public.vendor_badges where code='founding_partner';
  select id into legacy_badge from public.vendor_badges where code='founding_fifty';
  update public.vendor_memberships vm set membership_level_id=founding_level,source='founding_program',
    entitlements_snapshot=(select features from public.vendor_membership_levels where id=founding_level),
    locked_renewal_price_cents=4900,locked_renewal_currency='USD',
    metadata=vm.metadata||jsonb_build_object('program','founding-fifty')
  where vm.external_subscription_id like 'founding-fifty:%';
  insert into public.vendor_badge_awards(vendor_organization_id,vendor_badge_id,awarded_by,reason,awarded_at)
  select a.vendor_organization_id,founding_badge,a.awarded_by,replace(a.reason,'Founding Fifty','Founding Partner'),a.awarded_at
  from public.vendor_badge_awards a where a.vendor_badge_id=legacy_badge and a.revoked_at is null
  on conflict (vendor_organization_id,vendor_badge_id,awarded_at) do nothing;
  insert into public.vendor_membership_events(vendor_organization_id,vendor_membership_id,event_type,to_level_code,source,idempotency_key,metadata,occurred_at)
  select vm.vendor_organization_id,vm.id,'activated','founding_partner','migration','migration:founding-partner:'||vm.id,
    jsonb_build_object('program','founding-fifty'),vm.starts_at
  from public.vendor_memberships vm where vm.external_subscription_id like 'founding-fifty:%'
  on conflict(idempotency_key) do nothing;
end $$;

create or replace function public.search_vendor_marketplace(
  search_query text default null,city_filter uuid default null,category_filter uuid default null,
  verified_only boolean default false,premium_only boolean default false,emergency_only boolean default false,
  licensed_only boolean default false,insured_only boolean default false,result_limit integer default 50,result_offset integer default 0
) returns table(
  vendor_organization_id uuid,slug text,name text,description text,website_url text,phone text,years_in_business integer,
  average_rating numeric,completed_job_count integer,response_time_minutes integer,verification_status text,
  membership_code text,membership_name text,is_featured boolean,is_verified boolean,is_licensed boolean,is_insured boolean,
  emergency_available boolean,categories jsonb,cities jsonb,badges jsonb,total_count bigint
) language sql stable security definer set search_path='' as $$
  with candidates as (
    select vp.organization_id,o.slug,o.name,vp.description,o.website_url,o.phone,vp.years_in_business,
      vp.average_rating,vp.completed_job_count,vp.response_time_minutes,vp.verification_status,
      coalesce(level.code,'free') membership_code,coalesce(level.name,'Free') membership_name,coalesce(level.rank,0) membership_rank,
      coalesce(level.code in ('premium','founding_partner'),false) is_featured,
      vp.verification_status='verified' and license.ok and insurance.ok is_verified,
      license.ok is_licensed,insurance.ok is_insured,emergency.ok emergency_available,
      cats.items categories,covered.items cities,badge_list.items badges
    from public.vendor_profiles vp join public.organizations o on o.id=vp.organization_id and o.status='active'
    left join lateral (
      select vml.* from public.vendor_memberships vm join public.vendor_membership_levels vml on vml.id=vm.membership_level_id
      where vm.vendor_organization_id=vp.organization_id and vm.status in ('trialing','active')
        and (vm.current_period_ends_at is null or vm.current_period_ends_at>now())
      order by vml.rank desc,vm.starts_at desc limit 1
    ) level on true
    cross join lateral (select exists(select 1 from public.vendor_verifications v where v.vendor_organization_id=vp.organization_id and v.verification_type='trade_license' and v.status='verified' and (v.expires_on is null or v.expires_on>=current_date)) ok) license
    cross join lateral (select exists(select 1 from public.vendor_verifications v where v.vendor_organization_id=vp.organization_id and v.verification_type='insurance' and v.status='verified' and (v.expires_on is null or v.expires_on>=current_date)) ok) insurance
    cross join lateral (select exists(select 1 from public.vendor_service_offerings vso where vso.vendor_organization_id=vp.organization_id and vso.is_active and vso.emergency_available) ok) emergency
    cross join lateral (select coalesce(jsonb_agg(distinct jsonb_build_object('id',vc.id,'name',vc.name)) filter(where vc.id is not null),'[]'::jsonb) items from public.vendor_category_assignments vca join public.vendor_categories vc on vc.id=vca.vendor_category_id where vca.vendor_organization_id=vp.organization_id) cats
    cross join lateral (select coalesce(jsonb_agg(distinct jsonb_build_object('id',c.id,'name',c.name,'stateCode',c.state_code)) filter(where c.id is not null),'[]'::jsonb) items from public.vendor_service_cities vsc join public.cities c on c.id=vsc.city_id where vsc.vendor_organization_id=vp.organization_id and vsc.is_active) covered
    cross join lateral (select coalesce(jsonb_agg(distinct vb.code) filter(where vb.code is not null),'[]'::jsonb) items from public.vendor_badge_awards vba join public.vendor_badges vb on vb.id=vba.vendor_badge_id where vba.vendor_organization_id=vp.organization_id and vba.revoked_at is null and (vba.expires_at is null or vba.expires_at>now())) badge_list
    where (search_query is null or trim(search_query)='' or o.name ilike '%'||trim(search_query)||'%' or vp.description ilike '%'||trim(search_query)||'%')
      and (city_filter is null or exists(select 1 from public.vendor_service_cities x where x.vendor_organization_id=vp.organization_id and x.city_id=city_filter and x.is_active))
      and (category_filter is null or exists(select 1 from public.vendor_category_assignments x where x.vendor_organization_id=vp.organization_id and x.vendor_category_id=category_filter))
  ), filtered as (
    select * from candidates where (not verified_only or is_verified) and (not premium_only or is_featured)
      and (not emergency_only or emergency_available) and (not licensed_only or is_licensed) and (not insured_only or is_insured)
  )
  select organization_id,slug,name,description,website_url,phone,years_in_business,average_rating,completed_job_count,response_time_minutes,
    verification_status,membership_code,membership_name,is_featured,is_verified,is_licensed,is_insured,emergency_available,categories,cities,badges,count(*) over()
  from filtered order by membership_rank desc,is_verified desc,average_rating desc nulls last,completed_job_count desc,name
  limit least(greatest(result_limit,1),100) offset greatest(result_offset,0);
$$;

alter table public.vendor_membership_events enable row level security;
alter table public.vendor_marketplace_media enable row level security;
alter table public.vendor_coupons enable row level security;
create policy "membership_events_read_vendor" on public.vendor_membership_events for select to authenticated using(public.is_organization_member(vendor_organization_id) or public.is_super_admin());
create policy "marketplace_media_read_published" on public.vendor_marketplace_media for select to authenticated using(is_published or public.is_organization_member(vendor_organization_id) or public.is_super_admin());
create policy "marketplace_media_manage_vendor" on public.vendor_marketplace_media for all to authenticated using(public.has_organization_role(vendor_organization_id,array['owner','admin','vendor']::public.membership_role[])) with check(public.has_organization_role(vendor_organization_id,array['owner','admin','vendor']::public.membership_role[]));
create policy "coupons_read_active" on public.vendor_coupons for select to authenticated using((is_active and starts_at<=now() and (ends_at is null or ends_at>now())) or public.is_organization_member(vendor_organization_id) or public.is_super_admin());
create policy "coupons_manage_vendor" on public.vendor_coupons for all to authenticated using(public.has_organization_role(vendor_organization_id,array['owner','admin','vendor']::public.membership_role[])) with check(public.has_organization_role(vendor_organization_id,array['owner','admin','vendor']::public.membership_role[]));

grant execute on function public.vendor_has_entitlement(uuid,text) to authenticated,service_role;
grant execute on function public.activate_vendor_membership(uuid,text,text,text,text,integer,jsonb) to authenticated,service_role;
grant execute on function public.search_vendor_marketplace(text,uuid,uuid,boolean,boolean,boolean,boolean,boolean,integer,integer) to authenticated;

comment on table public.vendor_membership_events is 'Immutable, idempotent lifecycle history for vendor commercial memberships.';
comment on table public.vendor_marketplace_media is 'Vendor marketplace gallery and Premium-gated video metadata; file bytes remain in Storage.';
comment on table public.vendor_coupons is 'Premium-gated vendor offers with validity and redemption controls.';
comment on function public.search_vendor_marketplace is 'Tenant-safe marketplace search with membership placement, current credential checks, categories, cities, and badges.';

commit;
