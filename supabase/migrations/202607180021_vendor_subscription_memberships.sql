begin;

alter table public.vendor_memberships drop constraint if exists vendor_memberships_status_check;
alter table public.vendor_memberships add constraint vendor_memberships_status_check check (status in ('pending','active','trialing','past_due','canceled','cancelled','paused','expired','complimentary','manually_granted'));
drop index if exists public.vendor_memberships_current_idx;
create unique index vendor_memberships_current_idx on public.vendor_memberships(vendor_organization_id)
where status in ('pending','trialing','active','past_due','complimentary','manually_granted');

alter table public.vendor_memberships
  add column if not exists stripe_customer_id text check(stripe_customer_id is null or stripe_customer_id like 'cus_%'),
  add column if not exists stripe_checkout_session_id text unique check(stripe_checkout_session_id is null or stripe_checkout_session_id like 'cs_%'),
  add column if not exists stripe_price_id text check(stripe_price_id is null or stripe_price_id like 'price_%'),
  add column if not exists billing_interval text check(billing_interval is null or billing_interval in ('month','year')),
  add column if not exists amount_cents integer check(amount_cents is null or amount_cents>0),
  add column if not exists currency text check(currency is null or currency~'^[A-Z]{3}$'),
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists next_billing_at timestamptz,
  add column if not exists renewal_amount_cents integer check(renewal_amount_cents is null or renewal_amount_cents>0),
  add column if not exists last_payment_failed_at timestamptz;

create table public.vendor_billing_customers(
  vendor_organization_id uuid primary key references public.vendor_profiles(organization_id) on delete cascade,
  stripe_customer_id text not null unique check(stripe_customer_id like 'cus_%'),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.vendor_membership_provider_events(
  id uuid primary key default gen_random_uuid(),provider text not null default 'stripe',provider_event_id text not null,
  event_type text not null,provider_object_id text,membership_id uuid references public.vendor_memberships(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,processed_at timestamptz,processing_error text,created_at timestamptz not null default now(),
  unique(provider,provider_event_id)
);

update public.vendor_membership_levels set is_public=false,features=features||'{"directory_visibility":false}'::jsonb where code in ('free','verified');
insert into public.vendor_membership_levels(code,name,description,rank,monthly_price_cents,annual_price_cents,quote_limit_per_month,features,is_active,billing_model,capacity,entitlement_version,display_order,is_public)
values
('network_member','Network Member','Paid standard listing and property-manager network access.',10,1900,22800,null,'{"directory_visibility":true,"marketplace_profile":true,"opportunities":true,"vendor_dashboard":true,"property_manager_perk":false,"preferred_placement":false,"founder_badge":false}'::jsonb,true,'subscription',null,1,20,true)
on conflict(code) do update set name=excluded.name,description=excluded.description,rank=excluded.rank,monthly_price_cents=excluded.monthly_price_cents,annual_price_cents=excluded.annual_price_cents,features=excluded.features,is_active=true,billing_model='subscription',is_public=true;
update public.vendor_membership_levels set name='Preferred Vendor',rank=20,monthly_price_cents=4900,annual_price_cents=58800,billing_model='subscription',one_time_price_cents=null,is_public=true,
features=features||'{"directory_visibility":true,"opportunities":true,"vendor_dashboard":true,"property_manager_perk":true,"preferred_placement":true,"founder_badge":false}'::jsonb where code='premium';
update public.vendor_membership_levels set name='Founding Partner',description='Annual Founding Partner membership with Founder recognition and premium visibility while active or in the approved billing grace period.',rank=30,monthly_price_cents=0,annual_price_cents=29900,billing_model='subscription',one_time_price_cents=null,is_public=true,
features=features||'{"directory_visibility":true,"opportunities":true,"vendor_dashboard":true,"property_manager_perk":true,"preferred_placement":true,"founder_badge":true}'::jsonb where code='founding_partner';
update public.vendor_memberships vm set entitlements_snapshot=level.features,updated_at=now() from public.vendor_membership_levels level where level.id=vm.membership_level_id and level.code in ('network_member','premium','founding_partner') and vm.status in ('trialing','active','complimentary','manually_granted');
insert into public.vendor_badges(code,name,description,icon_key,color_key) values('preferred_vendor','Preferred Vendor','Enhanced placement for an active Preferred Vendor membership.','badge-check','emerald') on conflict(code) do update set name=excluded.name,description=excluded.description,is_active=true;

create or replace function public.vendor_has_entitlement(target_vendor_organization_id uuid,target_entitlement text)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((select (coalesce(nullif(vm.entitlements_snapshot,'{}'::jsonb),vml.features)->>target_entitlement)::boolean
    from public.vendor_memberships vm join public.vendor_membership_levels vml on vml.id=vm.membership_level_id
    where vm.vendor_organization_id=target_vendor_organization_id and vm.status in ('trialing','active','past_due','complimentary','manually_granted')
      and (vm.current_period_ends_at is null or vm.current_period_ends_at>now())
      and (vm.status<>'past_due' or (vm.current_period_ends_at is not null and vm.current_period_ends_at>now()))
    order by vml.rank desc,vm.starts_at desc limit 1),false);
$$;

drop policy if exists "requests_read_authorized" on public.service_requests;
create policy "requests_read_authorized" on public.service_requests for select to authenticated using (
  public.is_organization_member(organization_id) or public.is_super_admin() or public.user_has_vendor_bid(id)
  or (published_at is not null and status in ('open','matching','quoted') and exists (
    select 1 from public.organization_members m join public.organizations o on o.id=m.organization_id and o.type='vendor'
    join public.organization_markets om on om.organization_id=o.id join public.properties p on p.id=property_id and p.market_id=om.market_id
    join public.vendor_trades vt on vt.vendor_organization_id=o.id and vt.trade_id=service_requests.trade_id
    where m.user_id=auth.uid() and m.status='active' and public.vendor_has_entitlement(o.id,'opportunities')
  ))
);

create or replace function public.reserve_vendor_membership_checkout(target_vendor_organization_id uuid,target_level_code text,target_customer_id text,target_price_id text,target_interval text,target_amount_cents integer,target_currency text)
returns uuid language plpgsql security definer set search_path='' as $$
declare level_id uuid; created_id uuid; plan_capacity integer; active_count integer;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'service role required'; end if;
  if target_customer_id!~'^cus_' or target_price_id!~'^price_' or target_interval not in ('month','year') or target_amount_cents<=0 or upper(target_currency)<>'USD' then raise exception 'invalid checkout configuration'; end if;
  if exists(select 1 from public.vendor_memberships where vendor_organization_id=target_vendor_organization_id and status in ('pending','trialing','active','past_due')) then raise exception 'active membership already exists'; end if;
  select id,capacity into level_id,plan_capacity from public.vendor_membership_levels where code=target_level_code and is_active and billing_model='subscription' for update;
  if level_id is null then raise exception 'membership level unavailable'; end if;
  if plan_capacity is not null then select count(*) into active_count from public.vendor_memberships where membership_level_id=level_id and status in ('pending','trialing','active','complimentary','manually_granted'); if active_count>=plan_capacity then raise exception 'membership capacity reached'; end if; end if;
  insert into public.vendor_memberships(vendor_organization_id,membership_level_id,status,starts_at,source,stripe_customer_id,stripe_price_id,billing_interval,amount_cents,currency,renewal_amount_cents)
  values(target_vendor_organization_id,level_id,'pending',now(),'self_service',target_customer_id,target_price_id,target_interval,target_amount_cents,'USD',target_amount_cents) returning id into created_id;
  return created_id;
end $$;

create or replace function public.attach_vendor_membership_checkout(target_membership_id uuid,target_checkout_session_id text)
returns void language plpgsql security definer set search_path='' as $$ begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'service role required'; end if;
  if target_checkout_session_id!~'^cs_' then raise exception 'invalid checkout session'; end if;
  update public.vendor_memberships set stripe_checkout_session_id=target_checkout_session_id,updated_at=now() where id=target_membership_id and status='pending';
  if not found then raise exception 'pending membership not found'; end if;
end $$;

create or replace function public.fail_vendor_membership_checkout(target_membership_id uuid)
returns void language plpgsql security definer set search_path='' as $$ begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'service role required'; end if;
  update public.vendor_memberships set status='expired',current_period_ends_at=coalesce(current_period_ends_at,now()),updated_at=now() where id=target_membership_id and status='pending';
end $$;

create or replace function public.process_vendor_membership_stripe_event(target_event_id text,target_event_type text,target_membership_id uuid,target_vendor_organization_id uuid,target_level_code text,target_subscription_id text,target_customer_id text,target_price_id text,target_status text,target_period_end timestamptz,target_cancel_at_period_end boolean,target_amount_cents integer,target_currency text,target_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare membership public.vendor_memberships%rowtype; normalized_status text; level_id uuid; badge_id uuid;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'service role required'; end if;
  insert into public.vendor_membership_provider_events(provider_event_id,event_type,provider_object_id,payload) values(target_event_id,target_event_type,target_subscription_id,target_payload) on conflict(provider,provider_event_id) do nothing;
  select * into membership from public.vendor_memberships where id=target_membership_id or external_subscription_id=target_subscription_id order by (id=target_membership_id) desc limit 1 for update;
  if not found then raise exception 'membership checkout reservation not found'; end if;
  if membership.vendor_organization_id<>target_vendor_organization_id or membership.stripe_customer_id<>target_customer_id or membership.stripe_price_id<>target_price_id then raise exception 'membership provider mapping mismatch'; end if;
  select id into level_id from public.vendor_membership_levels where code=target_level_code and is_active;
  if level_id is null then raise exception 'membership level unavailable'; end if;
  normalized_status:=case when target_event_type='invoice.payment_failed' then 'past_due' when target_event_type='customer.subscription.deleted' then 'canceled' when target_status='active' then 'active' when target_status='trialing' then 'trialing' when target_status in ('past_due','unpaid','incomplete') then 'past_due' when target_status in ('canceled','paused') then 'canceled' else 'pending' end;
  update public.vendor_memberships set membership_level_id=level_id,status=normalized_status,external_subscription_id=target_subscription_id,current_period_ends_at=target_period_end,next_billing_at=target_period_end,cancel_at_period_end=coalesce(target_cancel_at_period_end,false),amount_cents=target_amount_cents,renewal_amount_cents=target_amount_cents,currency=upper(target_currency),source='billing_webhook',last_payment_failed_at=case when target_event_type='invoice.payment_failed' then now() else last_payment_failed_at end,updated_at=now() where id=membership.id;
  if normalized_status in ('active','trialing','past_due') and target_level_code in ('founding_partner','premium') then
    select id into badge_id from public.vendor_badges where code=case when target_level_code='founding_partner' then 'founding_partner' else 'preferred_vendor' end;
    if badge_id is not null and not exists(select 1 from public.vendor_badge_awards where vendor_organization_id=target_vendor_organization_id and vendor_badge_id=badge_id and revoked_at is null) then
      insert into public.vendor_badge_awards(vendor_organization_id,vendor_badge_id,reason) values(target_vendor_organization_id,badge_id,'Active paid '||target_level_code||' membership');
    end if;
  elsif target_level_code='premium' then
    update public.vendor_badge_awards set revoked_at=coalesce(revoked_at,now()) where vendor_organization_id=target_vendor_organization_id and vendor_badge_id=(select id from public.vendor_badges where code='preferred_vendor') and revoked_at is null;
  end if;
  insert into public.vendor_membership_events(vendor_organization_id,vendor_membership_id,event_type,to_level_code,source,idempotency_key,metadata)
  values(target_vendor_organization_id,membership.id,case when target_event_type='invoice.paid' then 'renewed' when target_event_type='invoice.payment_failed' then 'payment_failed' when normalized_status='canceled' then 'cancelled' else 'changed' end,target_level_code,'billing_webhook','stripe:'||target_event_id,jsonb_build_object('stripe_subscription_id',target_subscription_id,'stripe_event_type',target_event_type)) on conflict(idempotency_key) do nothing;
  update public.vendor_membership_provider_events set membership_id=membership.id,processed_at=now(),processing_error=null where provider='stripe' and provider_event_id=target_event_id;
  return membership.id;
end $$;

alter table public.vendor_billing_customers enable row level security; alter table public.vendor_membership_provider_events enable row level security;
create policy "billing_customers_read_vendor" on public.vendor_billing_customers for select to authenticated using(public.has_organization_role(vendor_organization_id,array['owner','admin','vendor']::public.membership_role[]));
create policy "membership_provider_events_admin_read" on public.vendor_membership_provider_events for select to authenticated using(public.is_super_admin());
revoke execute on function public.reserve_vendor_membership_checkout(uuid,text,text,text,text,integer,text) from public,anon,authenticated;
revoke execute on function public.attach_vendor_membership_checkout(uuid,text) from public,anon,authenticated;
revoke execute on function public.fail_vendor_membership_checkout(uuid) from public,anon,authenticated;
revoke execute on function public.process_vendor_membership_stripe_event(text,text,uuid,uuid,text,text,text,text,text,timestamptz,boolean,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_vendor_membership_checkout(uuid,text,text,text,text,integer,text) to service_role;
grant execute on function public.attach_vendor_membership_checkout(uuid,text) to service_role;
grant execute on function public.fail_vendor_membership_checkout(uuid) to service_role;
grant execute on function public.process_vendor_membership_stripe_event(text,text,uuid,uuid,text,text,text,text,text,timestamptz,boolean,integer,text,jsonb) to service_role;
commit;
