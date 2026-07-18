begin;

create table public.founding_partner_checkout_attempts (
  id uuid primary key,
  program_id uuid not null references public.founding_programs(id) on delete restrict,
  status text not null default 'reserved' check (status in ('reserved','checkout_created','paid','expired','failed')),
  checkout_session_id text unique,
  expected_amount_cents integer not null default 29900 check (expected_amount_cents = 29900),
  expected_currency text not null default 'USD' check (expected_currency = 'USD'),
  membership_type text not null default 'founding_partner' check (membership_type = 'founding_partner'),
  expires_at timestamptz not null,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index founding_partner_checkout_capacity_idx on public.founding_partner_checkout_attempts(status,expires_at);

create table public.founding_partner_payments (
  id uuid primary key default gen_random_uuid(),
  checkout_attempt_id uuid not null unique references public.founding_partner_checkout_attempts(id) on delete restrict,
  payment_provider text not null default 'stripe' check (payment_provider = 'stripe'),
  provider_customer_id text not null check (provider_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  checkout_session_id text not null unique check (checkout_session_id ~ '^cs_(test_|live_)?[A-Za-z0-9]+$'),
  payment_intent_id text not null unique check (payment_intent_id ~ '^pi_[A-Za-z0-9]+$'),
  amount_paid_cents integer not null check (amount_paid_cents = 29900),
  currency text not null check (currency = 'USD'),
  payment_status text not null check (payment_status in ('paid','refunded','partially_refunded','disputed')),
  customer_email text not null check (customer_email = lower(customer_email)),
  customer_name text,
  membership_type text not null check (membership_type = 'founding_partner'),
  paid_at timestamptz not null,
  provider_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index founding_partner_payments_admin_idx on public.founding_partner_payments(paid_at desc,payment_status);

create table public.founding_partner_onboardings (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.founding_partner_payments(id) on delete restrict,
  vendor_organization_id uuid references public.vendor_profiles(organization_id) on delete set null,
  status text not null default 'pending' check (status in ('pending','profile_submitted','under_review','approved','rejected')),
  customer_email text not null check (customer_email = lower(customer_email)),
  customer_name text,
  business_name text check (business_name is null or char_length(business_name) between 2 and 160),
  contact_name text check (contact_name is null or char_length(contact_name) between 2 and 160),
  phone text,
  website text,
  service_category text,
  city text,
  business_description text check (business_description is null or char_length(business_description) between 20 and 1200),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index founding_partner_onboardings_admin_idx on public.founding_partner_onboardings(status,created_at desc);

create trigger set_founding_partner_checkout_attempts_updated_at before update on public.founding_partner_checkout_attempts for each row execute function public.set_updated_at();
create trigger set_founding_partner_payments_updated_at before update on public.founding_partner_payments for each row execute function public.set_updated_at();
create trigger set_founding_partner_onboardings_updated_at before update on public.founding_partner_onboardings for each row execute function public.set_updated_at();

alter table public.founding_partner_checkout_attempts enable row level security;
alter table public.founding_partner_payments enable row level security;
alter table public.founding_partner_onboardings enable row level security;

create policy "founding_partner_checkout_attempts_admin_read" on public.founding_partner_checkout_attempts for select to authenticated using (public.is_super_admin());
create policy "founding_partner_payments_admin_read" on public.founding_partner_payments for select to authenticated using (public.is_super_admin());
create policy "founding_partner_onboardings_admin_read" on public.founding_partner_onboardings for select to authenticated using (public.is_super_admin());
create policy "founding_partner_onboardings_admin_update" on public.founding_partner_onboardings for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

grant select on public.founding_partner_checkout_attempts,public.founding_partner_payments,public.founding_partner_onboardings to authenticated;
grant update on public.founding_partner_onboardings to authenticated;
grant all on public.founding_partner_checkout_attempts,public.founding_partner_payments,public.founding_partner_onboardings to service_role;

create or replace function public.reserve_founding_partner_checkout(target_attempt_id uuid,target_expires_at timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare program public.founding_programs%rowtype; capacity_used integer;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'service role required'; end if;
  if target_expires_at < now()+interval '30 minutes' or target_expires_at > now()+interval '35 minutes' then raise exception 'invalid checkout expiration'; end if;
  select * into program from public.founding_programs where slug='founding-fifty' and status='active' for update;
  if not found then raise exception 'founding partner enrollment is unavailable'; end if;

  update public.founding_partner_checkout_attempts set status='expired',updated_at=now()
  where status in ('reserved','checkout_created') and expires_at + interval '1 hour' <= now();

  select
    (select count(*) from public.founding_claims where status='confirmed') +
    (select count(*) from public.founding_partner_checkout_attempts
      where status='paid' or (status in ('reserved','checkout_created') and expires_at + interval '1 hour' > now()))
  into capacity_used;
  if capacity_used >= program.total_seats then raise exception 'founding partner capacity reached'; end if;

  insert into public.founding_partner_checkout_attempts(id,program_id,expires_at)
  values(target_attempt_id,program.id,target_expires_at);
  return target_attempt_id;
end $$;

create or replace function public.attach_founding_partner_checkout(target_attempt_id uuid,target_checkout_session_id text,target_expires_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'service role required'; end if;
  if target_checkout_session_id !~ '^cs_(test_|live_)?[A-Za-z0-9]+$' then raise exception 'invalid checkout session'; end if;
  update public.founding_partner_checkout_attempts set
    status='checkout_created',checkout_session_id=target_checkout_session_id,expires_at=target_expires_at,updated_at=now()
  where id=target_attempt_id and status='reserved' and target_expires_at >= now();
  if not found then raise exception 'checkout reservation is unavailable'; end if;
end $$;

create or replace function public.fail_founding_partner_checkout(target_attempt_id uuid,target_failure_code text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'service role required'; end if;
  update public.founding_partner_checkout_attempts set status='failed',failure_code=left(target_failure_code,80),updated_at=now()
  where id=target_attempt_id and status in ('reserved','checkout_created');
end $$;

create or replace function public.process_founding_partner_payment(
  target_event_id text,target_event_type text,target_attempt_id uuid,target_checkout_session_id text,
  target_customer_id text,target_payment_intent_id text,target_amount_paid_cents integer,target_currency text,
  target_payment_status text,target_customer_email text,target_customer_name text,target_membership_type text,
  target_paid_at timestamptz,target_payload jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare attempt public.founding_partner_checkout_attempts%rowtype; created_payment_id uuid; created_onboarding_id uuid; inserted_payment boolean := false;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'service role required'; end if;
  if target_event_id !~ '^evt_[A-Za-z0-9]+$' or target_event_type <> 'checkout.session.completed' then raise exception 'invalid payment event'; end if;
  if target_amount_paid_cents <> 29900 or upper(target_currency) <> 'USD' or target_payment_status <> 'paid' or target_membership_type <> 'founding_partner' then raise exception 'invalid founding partner payment'; end if;
  if target_customer_email is null or position('@' in target_customer_email) < 2 then raise exception 'customer email required'; end if;
  if target_customer_id is null or target_customer_id !~ '^cus_[A-Za-z0-9]+$' then raise exception 'invalid Stripe customer'; end if;
  if target_payment_intent_id is null or target_payment_intent_id !~ '^pi_[A-Za-z0-9]+$' then raise exception 'invalid Stripe payment intent'; end if;

  select * into attempt from public.founding_partner_checkout_attempts
  where id=target_attempt_id and checkout_session_id=target_checkout_session_id for update;
  if not found then raise exception 'checkout attempt not found'; end if;
  if attempt.expected_amount_cents <> target_amount_paid_cents or attempt.expected_currency <> upper(target_currency) or attempt.membership_type <> target_membership_type then raise exception 'checkout expectation mismatch'; end if;

  insert into public.founding_payment_events(provider,provider_event_id,event_type,verification_status,payload)
  values('stripe',target_event_id,target_event_type,'verified',target_payload)
  on conflict(provider,provider_event_id) do nothing;

  insert into public.founding_partner_payments(
    checkout_attempt_id,provider_customer_id,checkout_session_id,payment_intent_id,amount_paid_cents,currency,
    payment_status,customer_email,customer_name,membership_type,paid_at,provider_metadata
  ) values(
    attempt.id,target_customer_id,target_checkout_session_id,target_payment_intent_id,target_amount_paid_cents,upper(target_currency),
    target_payment_status,lower(trim(target_customer_email)),nullif(trim(target_customer_name),''),target_membership_type,target_paid_at,
    jsonb_build_object('stripe_event_id',target_event_id)
  ) on conflict(checkout_session_id) do nothing returning id into created_payment_id;

  if created_payment_id is null then
    select p.id into created_payment_id from public.founding_partner_payments p
    where checkout_session_id=target_checkout_session_id and checkout_attempt_id=attempt.id
      and payment_intent_id=target_payment_intent_id and amount_paid_cents=target_amount_paid_cents
      and currency=upper(target_currency) and payment_status='paid';
    if created_payment_id is null then raise exception 'conflicting payment record'; end if;
  else
    inserted_payment := true;
  end if;

  update public.founding_partner_checkout_attempts set status='paid',failure_code=null,updated_at=now() where id=attempt.id;
  insert into public.founding_partner_onboardings(payment_id,customer_email,customer_name)
  values(created_payment_id,lower(trim(target_customer_email)),nullif(trim(target_customer_name),''))
  on conflict(payment_id) do nothing
  returning id into created_onboarding_id;
  if created_onboarding_id is null then select o.id into created_onboarding_id from public.founding_partner_onboardings o where o.payment_id=created_payment_id; end if;

  if inserted_payment then
    insert into public.audit_events(action,entity_type,entity_id,metadata)
    values('founding_partner.payment_confirmed','founding_partner_payment',created_payment_id,jsonb_build_object('checkout_session_id',target_checkout_session_id,'amount_cents',target_amount_paid_cents,'currency',upper(target_currency)));
    insert into public.outbox_events(topic,payload)
    values('founding_partner.payment_confirmed',jsonb_build_object('payment_id',created_payment_id,'onboarding_id',created_onboarding_id,'email',lower(trim(target_customer_email))));
  end if;
  return created_onboarding_id;
end $$;

create or replace function public.expire_founding_partner_checkout(
  target_event_id text,target_event_type text,target_attempt_id uuid,target_checkout_session_id text,target_payload jsonb
) returns void language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'service role required'; end if;
  if target_event_type <> 'checkout.session.expired' then raise exception 'invalid expiration event'; end if;
  insert into public.founding_payment_events(provider,provider_event_id,event_type,verification_status,payload)
  values('stripe',target_event_id,target_event_type,'verified',target_payload)
  on conflict(provider,provider_event_id) do nothing;
  update public.founding_partner_checkout_attempts set status='expired',updated_at=now()
  where id=target_attempt_id and checkout_session_id=target_checkout_session_id and status in ('reserved','checkout_created');
end $$;

create or replace function public.submit_founding_partner_onboarding(
  target_checkout_session_id text,target_business_name text,target_contact_name text,target_phone text,
  target_website text,target_service_category text,target_city text,target_business_description text
) returns uuid language plpgsql security definer set search_path='' as $$
declare payment public.founding_partner_payments%rowtype; onboarding public.founding_partner_onboardings%rowtype;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'service role required'; end if;
  select * into payment from public.founding_partner_payments where checkout_session_id=target_checkout_session_id and payment_status='paid' for update;
  if not found then raise exception 'verified payment required'; end if;
  select * into onboarding from public.founding_partner_onboardings where payment_id=payment.id for update;
  if not found then raise exception 'onboarding record not found'; end if;
  if onboarding.status='profile_submitted' then return onboarding.id; end if;
  if onboarding.status <> 'pending' then raise exception 'onboarding is not editable'; end if;
  if target_business_name is null or target_contact_name is null or char_length(trim(target_business_name)) not between 2 and 160 or char_length(trim(target_contact_name)) not between 2 and 160 then raise exception 'invalid business or contact name'; end if;
  if target_phone is null or target_service_category is null or target_city is null or char_length(trim(target_phone)) not between 7 and 40 or char_length(trim(target_service_category)) not between 2 and 160 or char_length(trim(target_city)) not between 2 and 160 then raise exception 'invalid business profile'; end if;
  if target_business_description is null or char_length(trim(target_business_description)) not between 20 and 1200 then raise exception 'invalid business description'; end if;
  if nullif(trim(target_website),'') is not null and trim(target_website) !~ '^https?://' then raise exception 'invalid website'; end if;
  update public.founding_partner_onboardings set
    business_name=trim(target_business_name),contact_name=trim(target_contact_name),phone=trim(target_phone),
    website=nullif(trim(target_website),''),service_category=trim(target_service_category),city=trim(target_city),
    business_description=trim(target_business_description),status='profile_submitted',submitted_at=now(),updated_at=now()
  where id=onboarding.id;
  insert into public.audit_events(action,entity_type,entity_id,metadata)
  values('founding_partner.profile_submitted','founding_partner_onboarding',onboarding.id,jsonb_build_object('payment_id',payment.id));
  return onboarding.id;
end $$;

revoke execute on function public.claim_founding_seat(uuid,text,text,text,text,text,text,text,text,text,text) from public,anon,authenticated;
revoke execute on function public.reserve_founding_partner_checkout(uuid,timestamptz) from public,anon,authenticated;
revoke execute on function public.attach_founding_partner_checkout(uuid,text,timestamptz) from public,anon,authenticated;
revoke execute on function public.fail_founding_partner_checkout(uuid,text) from public,anon,authenticated;
revoke execute on function public.process_founding_partner_payment(text,text,uuid,text,text,text,integer,text,text,text,text,text,timestamptz,jsonb) from public,anon,authenticated;
revoke execute on function public.expire_founding_partner_checkout(text,text,uuid,text,jsonb) from public,anon,authenticated;
revoke execute on function public.submit_founding_partner_onboarding(text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.reserve_founding_partner_checkout(uuid,timestamptz) to service_role;
grant execute on function public.attach_founding_partner_checkout(uuid,text,timestamptz) to service_role;
grant execute on function public.fail_founding_partner_checkout(uuid,text) to service_role;
grant execute on function public.process_founding_partner_payment(text,text,uuid,text,text,text,integer,text,text,text,text,text,timestamptz,jsonb) to service_role;
grant execute on function public.expire_founding_partner_checkout(text,text,uuid,text,jsonb) to service_role;
grant execute on function public.submit_founding_partner_onboarding(text,text,text,text,text,text,text,text) to service_role;

comment on table public.founding_partner_payments is 'Authoritative Stripe payment ledger for the direct Founding Partner checkout.';
comment on table public.founding_partner_onboardings is 'Exactly one admin-review onboarding record per verified Founding Partner payment.';
comment on function public.process_founding_partner_payment is 'Idempotently records a verified $299 Stripe payment and creates its pending onboarding record.';

commit;
