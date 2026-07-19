begin;

-- A paid guest checkout is intentionally separate from vendor_enrollments:
-- that table requires an authenticated owner.  This reservation becomes an
-- organization membership only after the checkout email has been verified.
create table public.vendor_membership_guest_claims (
  id uuid primary key default gen_random_uuid(),
  vendor_organization_id uuid not null unique references public.vendor_profiles(organization_id) on delete cascade,
  membership_id uuid not null unique references public.vendor_memberships(id) on delete cascade,
  purchaser_email text not null check (purchaser_email = lower(trim(purchaser_email)) and purchaser_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  contact_name text not null check (char_length(trim(contact_name)) between 2 and 120),
  contact_phone text not null check (char_length(contact_phone) between 7 and 32),
  primary_service_category text not null check (char_length(trim(primary_service_category)) between 2 and 120),
  stripe_checkout_session_id text unique check (stripe_checkout_session_id is null or stripe_checkout_session_id like 'cs_%'),
  stripe_customer_id text unique check (stripe_customer_id is null or stripe_customer_id like 'cus_%'),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','expired','failed')),
  paid_at timestamptz,
  claimed_by_user_id uuid unique references public.profiles(id) on delete restrict,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((payment_status = 'paid') = (paid_at is not null)),
  check ((claimed_by_user_id is null) = (claimed_at is null))
);

create index vendor_membership_guest_claims_pending_email_idx
  on public.vendor_membership_guest_claims (purchaser_email, created_at desc)
  where claimed_by_user_id is null;

create or replace function public.create_guest_founding_vendor_checkout(
  target_business_name text, target_contact_name text, target_contact_email text,
  target_contact_phone text, target_primary_service_category text,
  target_price_id text, target_interval text, target_amount_cents integer, target_currency text
) returns table(claim_id uuid, vendor_organization_id uuid, membership_id uuid, checkout_attempt_number integer)
language plpgsql security definer set search_path='' as $$
declare normalized_name text:=lower(regexp_replace(trim(target_business_name),'\s+',' ','g'));
  normalized_email text:=lower(trim(target_contact_email)); normalized_phone text:=nullif(regexp_replace(trim(target_contact_phone),'[^0-9+]','','g'),'');
  base_slug text; organization_id uuid; level_id uuid; member_id uuid; capacity_limit integer; pending_count integer;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'service role required'; end if;
  if char_length(normalized_name) not between 2 and 160 or char_length(trim(target_contact_name)) not between 2 and 120 or normalized_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or normalized_phone is null or char_length(normalized_phone)<7 or char_length(trim(target_primary_service_category)) not between 2 and 120 then raise exception 'invalid founding vendor details'; end if;
  if target_price_id !~ '^price_' or target_interval <> 'year' or target_amount_cents <> 29900 or upper(target_currency) <> 'USD' then raise exception 'invalid founding membership configuration'; end if;
  select id, capacity into level_id, capacity_limit from public.vendor_membership_levels where code='founding_partner' and is_active and billing_model='subscription' and publicly_purchasable for update;
  if level_id is null then raise exception 'founding membership unavailable'; end if;
  if capacity_limit is not null then
    select count(*) into pending_count from public.vendor_memberships where membership_level_id=level_id and status in ('pending','trialing','active','past_due','complimentary','manually_granted');
    if pending_count >= capacity_limit then raise exception 'founding membership capacity reached'; end if;
  end if;
  base_slug:=trim(both '-' from regexp_replace(normalized_name,'[^a-z0-9]+','-','g'));
  if base_slug='' then raise exception 'business name cannot produce a valid slug'; end if;
  insert into public.organizations(type,name,slug,phone,status) values('vendor',trim(target_business_name),left(base_slug,130)||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,10),normalized_phone,'onboarding') returning id into organization_id;
  insert into public.vendor_profiles(organization_id,verification_status,public_email,contact_name) values(organization_id,'pending',normalized_email,trim(target_contact_name));
  insert into public.vendor_memberships(vendor_organization_id,membership_level_id,status,starts_at,source,stripe_price_id,billing_interval,amount_cents,currency,renewal_amount_cents,onboarding_version,checkout_attempt_number)
    values(organization_id,level_id,'pending',now(),'guest_founding_checkout',target_price_id,target_interval,target_amount_cents,'USD',target_amount_cents,1,1) returning id into member_id;
  select vm.checkout_attempt_number into checkout_attempt_number from public.vendor_memberships vm where vm.id=member_id;
  insert into public.vendor_membership_guest_claims(vendor_organization_id,membership_id,purchaser_email,contact_name,contact_phone,primary_service_category)
    values(organization_id,member_id,normalized_email,trim(target_contact_name),normalized_phone,trim(target_primary_service_category)) returning id into claim_id;
  vendor_organization_id:=organization_id; membership_id:=member_id; return next;
end $$;

create or replace function public.attach_guest_founding_vendor_checkout(target_claim_id uuid, target_membership_id uuid, target_customer_id text, target_checkout_session_id text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'service role required'; end if;
  if target_customer_id !~ '^cus_' or target_checkout_session_id !~ '^cs_' then raise exception 'invalid stripe checkout identifiers'; end if;
  update public.vendor_membership_guest_claims set stripe_customer_id=target_customer_id,stripe_checkout_session_id=target_checkout_session_id,updated_at=now() where id=target_claim_id and membership_id=target_membership_id and payment_status='pending';
  if not found then raise exception 'guest founding checkout reservation not found'; end if;
  update public.vendor_memberships set stripe_customer_id=target_customer_id,stripe_checkout_session_id=target_checkout_session_id,updated_at=now() where id=target_membership_id and status='pending';
  if not found then raise exception 'pending membership not found'; end if;
end $$;

create or replace function public.record_guest_founding_vendor_payment(target_membership_id uuid, target_customer_id text, target_customer_email text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'service role required'; end if;
  update public.vendor_membership_guest_claims gc set payment_status='paid',paid_at=coalesce(gc.paid_at,now()),updated_at=now()
  from public.vendor_memberships vm
  where gc.membership_id=target_membership_id and vm.id=gc.membership_id and vm.stripe_customer_id=target_customer_id
    and gc.stripe_customer_id=target_customer_id and gc.purchaser_email=lower(trim(target_customer_email))
    and vm.status in ('active','trialing','past_due');
end $$;

create or replace function public.get_guest_founding_vendor_claim_status(target_checkout_session_id text)
returns text language sql stable security definer set search_path='' as $$
  select case when claimed_by_user_id is not null then 'claimed' else payment_status end
  from public.vendor_membership_guest_claims where stripe_checkout_session_id=target_checkout_session_id;
$$;

create or replace function public.claim_guest_founding_vendor_membership(target_checkout_session_id text, target_user_id uuid, target_user_email text)
returns uuid language plpgsql security definer set search_path='' as $$
declare claim public.vendor_membership_guest_claims%rowtype;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'service role required'; end if;
  select * into claim from public.vendor_membership_guest_claims where stripe_checkout_session_id=target_checkout_session_id for update;
  if not found or claim.payment_status<>'paid' then raise exception 'paid membership claim not found'; end if;
  if claim.purchaser_email<>lower(trim(target_user_email)) then raise exception 'checkout email does not match this account'; end if;
  if not exists(select 1 from public.profiles where id=target_user_id) then raise exception 'account profile not ready'; end if;
  if claim.claimed_by_user_id is not null and claim.claimed_by_user_id<>target_user_id then raise exception 'membership has already been claimed'; end if;
  insert into public.organization_members(organization_id,user_id,role,status) values(claim.vendor_organization_id,target_user_id,'owner','active') on conflict(organization_id,user_id) do update set role='owner',status='active',updated_at=now();
  insert into public.user_preferences(user_id,active_organization_id) values(target_user_id,claim.vendor_organization_id) on conflict(user_id) do update set active_organization_id=excluded.active_organization_id,updated_at=now();
  update public.vendor_membership_guest_claims set claimed_by_user_id=target_user_id,claimed_at=coalesce(claimed_at,now()),updated_at=now() where id=claim.id;
  return claim.vendor_organization_id;
end $$;

alter table public.vendor_membership_guest_claims enable row level security;
revoke all on table public.vendor_membership_guest_claims from public, anon, authenticated;
revoke execute on function public.create_guest_founding_vendor_checkout(text,text,text,text,text,text,text,integer,text) from public,anon,authenticated;
revoke execute on function public.attach_guest_founding_vendor_checkout(uuid,uuid,text,text) from public,anon,authenticated;
revoke execute on function public.record_guest_founding_vendor_payment(uuid,text,text) from public,anon,authenticated;
revoke execute on function public.get_guest_founding_vendor_claim_status(text) from public,anon,authenticated;
revoke execute on function public.claim_guest_founding_vendor_membership(text,uuid,text) from public,anon,authenticated;
grant execute on function public.create_guest_founding_vendor_checkout(text,text,text,text,text,text,text,integer,text) to service_role;
grant execute on function public.attach_guest_founding_vendor_checkout(uuid,uuid,text,text) to service_role;
grant execute on function public.record_guest_founding_vendor_payment(uuid,text,text) to service_role;
grant execute on function public.get_guest_founding_vendor_claim_status(text) to service_role;
grant execute on function public.claim_guest_founding_vendor_membership(text,uuid,text) to service_role;

commit;
