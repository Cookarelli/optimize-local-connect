begin;

alter table public.vendor_memberships
  add column if not exists onboarding_version integer not null default 1 check(onboarding_version>0),
  add column if not exists checkout_attempt_number integer not null default 1 check(checkout_attempt_number>0);

create table public.vendor_enrollments(
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  vendor_organization_id uuid not null unique references public.vendor_profiles(organization_id) on delete cascade,
  membership_id uuid not null unique references public.vendor_memberships(id) on delete cascade,
  intended_plan_key text not null check(intended_plan_key in ('founding_vendor','network_member','preferred_vendor')),
  normalized_business_name text not null,
  contact_name text not null check(char_length(contact_name) between 2 and 120),
  contact_email text not null check(contact_email=lower(contact_email)),
  contact_phone text,
  website_url text,
  onboarding_version integer not null default 1 check(onboarding_version>0),
  status text not null default 'payment_pending' check(status in ('payment_pending','checkout_created','active','canceled','abandoned')),
  last_checkout_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id,normalized_business_name)
);

create index vendor_enrollments_status_idx on public.vendor_enrollments(status,updated_at desc);
create trigger set_vendor_enrollments_updated_at before update on public.vendor_enrollments
for each row execute function public.set_updated_at();

alter table public.vendor_enrollments enable row level security;
create policy "vendor_enrollments_read_owner_admin" on public.vendor_enrollments for select to authenticated using(
  owner_user_id=auth.uid() or public.has_organization_role(vendor_organization_id,array['owner','admin']::public.membership_role[]) or public.is_super_admin()
);

create or replace function public.create_or_resume_vendor_enrollment(
  target_user_id uuid,target_business_name text,target_legal_name text,target_contact_name text,
  target_contact_email text,target_contact_phone text,target_website_url text,target_plan_key text,
  target_level_code text,target_price_id text,target_interval text,target_amount_cents integer,
  target_currency text,target_onboarding_version integer default 1
)
returns table(enrollment_id uuid,vendor_organization_id uuid,membership_id uuid,checkout_attempt_number integer,enrollment_status text)
language plpgsql security definer set search_path='' as $$
declare
  normalized_name text:=lower(regexp_replace(trim(target_business_name),'\s+',' ','g'));
  normalized_email text:=lower(trim(target_contact_email));
  normalized_phone text:=nullif(regexp_replace(coalesce(target_contact_phone,''),'[^0-9+]','','g'),'');
  normalized_website text:=nullif(trim(target_website_url),'');
  auth_email text; base_slug text; organization_id uuid; level_id uuid; member_id uuid;
  selected_enrollment public.vendor_enrollments%rowtype; selected_membership public.vendor_memberships%rowtype;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'service role required'; end if;
  select lower(email) into auth_email from auth.users where id=target_user_id;
  if auth_email is null or auth_email<>normalized_email then raise exception 'authenticated user email mismatch'; end if;
  if char_length(normalized_name) not between 2 and 160 or char_length(trim(target_contact_name)) not between 2 and 120 or normalized_phone is null or char_length(normalized_phone)<7 then raise exception 'invalid enrollment details'; end if;
  if target_plan_key not in ('founding_vendor','network_member','preferred_vendor') or target_interval not in ('month','year') or target_amount_cents<=0 or upper(target_currency)<>'USD' or target_price_id!~'^price_' or target_onboarding_version<=0 then raise exception 'invalid membership configuration'; end if;
  select id into level_id from public.vendor_membership_levels where code=target_level_code and is_active and billing_model='subscription';
  if level_id is null then raise exception 'membership level unavailable'; end if;

  select * into selected_enrollment from public.vendor_enrollments
  where owner_user_id=target_user_id and normalized_business_name=normalized_name for update;
  if found then
    if selected_enrollment.intended_plan_key<>target_plan_key then raise exception 'pending enrollment uses a different membership tier'; end if;
    select * into selected_membership from public.vendor_memberships where id=selected_enrollment.membership_id for update;
    if selected_membership.status in ('active','trialing','past_due','complimentary','manually_granted') then raise exception 'active membership already exists'; end if;
    if selected_membership.external_subscription_id is not null then raise exception 'existing subscription requires administrative review'; end if;
    if selected_membership.status in ('expired','canceled','cancelled') then
      update public.vendor_memberships set status='pending',stripe_checkout_session_id=null,stripe_price_id=target_price_id,
        billing_interval=target_interval,amount_cents=target_amount_cents,currency=upper(target_currency),renewal_amount_cents=target_amount_cents,
        checkout_attempt_number=public.vendor_memberships.checkout_attempt_number+1,updated_at=now() where id=selected_membership.id
      returning * into selected_membership;
    end if;
    update public.vendor_enrollments set contact_name=trim(target_contact_name),contact_phone=normalized_phone,
      website_url=normalized_website,status='payment_pending',last_checkout_error=null,updated_at=now() where id=selected_enrollment.id;
    return query select selected_enrollment.id,selected_enrollment.vendor_organization_id,selected_membership.id,selected_membership.checkout_attempt_number,'payment_pending'::text;
    return;
  end if;

  base_slug:=trim(both '-' from regexp_replace(lower(trim(target_business_name)),'[^a-z0-9]+','-','g'));
  if base_slug='' then raise exception 'business name cannot produce a valid slug'; end if;
  insert into public.organizations(type,name,slug,legal_name,website_url,phone,status)
  values('vendor',trim(target_business_name),left(base_slug,130)||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,10),nullif(trim(target_legal_name),''),normalized_website,normalized_phone,'onboarding')
  returning id into organization_id;
  insert into public.vendor_profiles(organization_id,verification_status) values(organization_id,'pending');
  insert into public.organization_members(organization_id,user_id,role,status) values(organization_id,target_user_id,'owner','active') returning id into member_id;
  insert into public.user_preferences(user_id,active_organization_id) values(target_user_id,organization_id)
  on conflict(user_id) do update set active_organization_id=excluded.active_organization_id,updated_at=now();
  insert into public.vendor_memberships(vendor_organization_id,membership_level_id,status,starts_at,source,stripe_price_id,billing_interval,amount_cents,currency,renewal_amount_cents,onboarding_version,checkout_attempt_number)
  values(organization_id,level_id,'pending',now(),'self_service',target_price_id,target_interval,target_amount_cents,upper(target_currency),target_amount_cents,target_onboarding_version,1)
  returning id,public.vendor_memberships.checkout_attempt_number into member_id,checkout_attempt_number;
  insert into public.vendor_enrollments(owner_user_id,vendor_organization_id,membership_id,intended_plan_key,normalized_business_name,contact_name,contact_email,contact_phone,website_url,onboarding_version)
  values(target_user_id,organization_id,member_id,target_plan_key,normalized_name,trim(target_contact_name),normalized_email,normalized_phone,normalized_website,target_onboarding_version)
  returning id into enrollment_id;
  vendor_organization_id:=organization_id; membership_id:=member_id; enrollment_status:='payment_pending';
  return next;
end $$;

create or replace function public.attach_vendor_membership_customer(target_membership_id uuid,target_customer_id text)
returns void language plpgsql security definer set search_path='' as $$ begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' or target_customer_id!~'^cus_' then raise exception 'invalid trusted request'; end if;
  update public.vendor_memberships set stripe_customer_id=target_customer_id,updated_at=now() where id=target_membership_id and status='pending';
  if not found then raise exception 'pending membership not found'; end if;
end $$;

create or replace function public.reserve_existing_vendor_membership_checkout(
  target_vendor_organization_id uuid,target_user_id uuid,target_level_code text,target_price_id text,
  target_interval text,target_amount_cents integer,target_currency text
)
returns uuid language plpgsql security definer set search_path='' as $$
declare level_id uuid; created_id uuid; plan_capacity integer; active_count integer;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'service role required'; end if;
  if not exists(select 1 from public.organization_members where organization_id=target_vendor_organization_id and user_id=target_user_id and status='active' and role in ('owner','admin')) then raise exception 'not authorized for membership checkout'; end if;
  if target_price_id!~'^price_' or target_interval not in ('month','year') or target_amount_cents<=0 or upper(target_currency)<>'USD' then raise exception 'invalid checkout configuration'; end if;
  if exists(select 1 from public.vendor_memberships where vendor_organization_id=target_vendor_organization_id and status in ('pending','trialing','active','past_due','complimentary','manually_granted')) then raise exception 'active membership already exists'; end if;
  select id,capacity into level_id,plan_capacity from public.vendor_membership_levels where code=target_level_code and is_active and billing_model='subscription' for update;
  if level_id is null then raise exception 'membership level unavailable'; end if;
  if plan_capacity is not null then
    select count(*) into active_count from public.vendor_memberships where membership_level_id=level_id and status in ('pending','trialing','active','complimentary','manually_granted');
    if active_count>=plan_capacity then raise exception 'membership capacity reached'; end if;
  end if;
  insert into public.vendor_memberships(vendor_organization_id,membership_level_id,status,starts_at,source,stripe_price_id,billing_interval,amount_cents,currency,renewal_amount_cents,onboarding_version,checkout_attempt_number)
  values(target_vendor_organization_id,level_id,'pending',now(),'self_service',target_price_id,target_interval,target_amount_cents,upper(target_currency),target_amount_cents,1,1)
  returning id into created_id;
  return created_id;
end $$;

create or replace function public.authorize_and_prepare_vendor_membership_checkout(target_membership_id uuid,target_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare membership public.vendor_memberships%rowtype; level_code text;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'service role required'; end if;
  select * into membership from public.vendor_memberships where id=target_membership_id for update;
  if not found then raise exception 'membership not found'; end if;
  if not exists(select 1 from public.organization_members where organization_id=membership.vendor_organization_id and user_id=target_user_id and status='active' and role in ('owner','admin')) then raise exception 'not authorized for membership checkout'; end if;
  if membership.status in ('active','trialing','past_due','complimentary','manually_granted') then raise exception 'active membership already exists'; end if;
  if membership.external_subscription_id is not null then raise exception 'existing subscription requires administrative review'; end if;
  if membership.status in ('expired','canceled','cancelled') then
    update public.vendor_memberships set status='pending',stripe_checkout_session_id=null,
      checkout_attempt_number=public.vendor_memberships.checkout_attempt_number+1,updated_at=now()
    where id=membership.id returning * into membership;
  end if;
  if membership.status<>'pending' then raise exception 'membership checkout is not resumable'; end if;
  select code into level_code from public.vendor_membership_levels where id=membership.membership_level_id and is_active;
  return jsonb_build_object('organization_id',membership.vendor_organization_id,'membership_id',membership.id,'status',membership.status,
    'checkout_session_id',membership.stripe_checkout_session_id,'stripe_customer_id',membership.stripe_customer_id,
    'stripe_price_id',membership.stripe_price_id,'checkout_attempt_number',membership.checkout_attempt_number,
    'onboarding_version',membership.onboarding_version,'level_code',level_code);
end $$;

create or replace function public.attach_vendor_membership_checkout(target_membership_id uuid,target_checkout_session_id text)
returns void language plpgsql security definer set search_path='' as $$ begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'service role required'; end if;
  if target_checkout_session_id!~'^cs_' then raise exception 'invalid checkout session'; end if;
  update public.vendor_memberships set stripe_checkout_session_id=target_checkout_session_id,updated_at=now() where id=target_membership_id and status='pending';
  if not found then raise exception 'pending membership not found'; end if;
  update public.vendor_enrollments set status='checkout_created',last_checkout_error=null,updated_at=now() where membership_id=target_membership_id;
end $$;

create or replace function public.record_vendor_membership_checkout_failure(target_membership_id uuid,target_error_code text)
returns void language plpgsql security definer set search_path='' as $$ begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'service role required'; end if;
  update public.vendor_enrollments set status='payment_pending',last_checkout_error=left(coalesce(target_error_code,'checkout_failed'),120),updated_at=now()
  where membership_id=target_membership_id;
end $$;

create or replace function public.sync_vendor_enrollment_status()
returns trigger language plpgsql security definer set search_path='' as $$ begin
  if new.status in ('active','trialing','past_due','complimentary','manually_granted') then
    update public.vendor_enrollments set status='active',last_checkout_error=null,updated_at=now() where membership_id=new.id;
    update public.organizations set status='active',updated_at=now() where id=new.vendor_organization_id and status='onboarding';
  elsif new.status in ('canceled','cancelled') then
    update public.vendor_enrollments set status='canceled',updated_at=now() where membership_id=new.id;
  elsif new.status='expired' then
    update public.vendor_enrollments set status='payment_pending',updated_at=now() where membership_id=new.id;
  end if;
  return new;
end $$;
create trigger sync_vendor_enrollment_after_membership after update of status on public.vendor_memberships
for each row when(old.status is distinct from new.status) execute function public.sync_vendor_enrollment_status();

revoke all on table public.vendor_enrollments from anon;
revoke execute on function public.create_or_resume_vendor_enrollment(uuid,text,text,text,text,text,text,text,text,text,text,integer,text,integer) from public,anon,authenticated;
revoke execute on function public.attach_vendor_membership_customer(uuid,text) from public,anon,authenticated;
revoke execute on function public.reserve_existing_vendor_membership_checkout(uuid,uuid,text,text,text,integer,text) from public,anon,authenticated;
revoke execute on function public.authorize_and_prepare_vendor_membership_checkout(uuid,uuid) from public,anon,authenticated;
revoke execute on function public.record_vendor_membership_checkout_failure(uuid,text) from public,anon,authenticated;
grant execute on function public.create_or_resume_vendor_enrollment(uuid,text,text,text,text,text,text,text,text,text,text,integer,text,integer) to service_role;
grant execute on function public.attach_vendor_membership_customer(uuid,text) to service_role;
grant execute on function public.reserve_existing_vendor_membership_checkout(uuid,uuid,text,text,text,integer,text) to service_role;
grant execute on function public.authorize_and_prepare_vendor_membership_checkout(uuid,uuid) to service_role;
grant execute on function public.record_vendor_membership_checkout_failure(uuid,text) to service_role;
grant select on public.vendor_enrollments to authenticated;

comment on table public.vendor_enrollments is 'Private, resumable owner-to-organization enrollment state created atomically before Stripe Checkout.';
commit;
