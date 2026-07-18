begin;

-- Corrective migration: prior migrations may already exist in production, so
-- redefine functions additively instead of rewriting deployed history.

create or replace function public.reserve_vendor_membership_checkout(
  target_vendor_organization_id uuid,target_level_code text,target_customer_id text,target_price_id text,
  target_interval text,target_amount_cents integer,target_currency text
) returns uuid language plpgsql security definer set search_path='' as $$
declare level_id uuid; created_id uuid; plan_capacity integer; active_count integer;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'service role required'; end if;
  if target_customer_id!~'^cus_' or target_price_id!~'^price_' or target_interval not in ('month','year') or target_amount_cents<=0 or upper(target_currency)<>'USD' then raise exception 'invalid checkout configuration'; end if;
  if exists(select 1 from public.vendor_memberships where vendor_organization_id=target_vendor_organization_id and status in ('pending','trialing','active','past_due','complimentary','manually_granted')) then raise exception 'active membership already exists'; end if;
  select id,capacity into level_id,plan_capacity from public.vendor_membership_levels where code=target_level_code and is_active and billing_model='subscription' for update;
  if level_id is null then raise exception 'membership level unavailable'; end if;
  if plan_capacity is not null then
    select count(*) into active_count from public.vendor_memberships where membership_level_id=level_id and status in ('pending','trialing','active','complimentary','manually_granted');
    if active_count>=plan_capacity then raise exception 'membership capacity reached'; end if;
  end if;
  insert into public.vendor_memberships(vendor_organization_id,membership_level_id,status,starts_at,source,stripe_customer_id,stripe_price_id,billing_interval,amount_cents,currency,renewal_amount_cents)
  values(target_vendor_organization_id,level_id,'pending',now(),'self_service',target_customer_id,target_price_id,target_interval,target_amount_cents,'USD',target_amount_cents)
  returning id into created_id;
  return created_id;
end $$;

create or replace function public.process_vendor_membership_stripe_event(
  target_event_id text,target_event_type text,target_membership_id uuid,target_vendor_organization_id uuid,
  target_level_code text,target_subscription_id text,target_customer_id text,target_price_id text,
  target_status text,target_period_end timestamptz,target_cancel_at_period_end boolean,
  target_amount_cents integer,target_currency text,target_payload jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare membership public.vendor_memberships%rowtype; level_id uuid; badge_id uuid; prior_membership_id uuid;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'service role required'; end if;
  if target_status not in ('pending','active','trialing','past_due','canceled','expired') then raise exception 'invalid normalized membership status'; end if;

  select membership_id into prior_membership_id from public.vendor_membership_provider_events
  where provider='stripe' and provider_event_id=target_event_id and processed_at is not null;
  if found then return prior_membership_id; end if;

  insert into public.vendor_membership_provider_events(provider_event_id,event_type,provider_object_id,payload)
  values(target_event_id,target_event_type,target_subscription_id,target_payload)
  on conflict(provider,provider_event_id) do update set
    event_type=excluded.event_type,provider_object_id=excluded.provider_object_id,payload=excluded.payload;

  select * into membership from public.vendor_memberships
  where id=target_membership_id or external_subscription_id=target_subscription_id
  order by (id=target_membership_id) desc limit 1 for update;
  if not found then raise exception 'membership checkout reservation not found'; end if;
  if membership.vendor_organization_id<>target_vendor_organization_id or membership.stripe_customer_id<>target_customer_id or membership.stripe_price_id<>target_price_id then raise exception 'membership provider mapping mismatch'; end if;
  select id into level_id from public.vendor_membership_levels where code=target_level_code and is_active;
  if level_id is null then raise exception 'membership level unavailable'; end if;

  update public.vendor_memberships set
    membership_level_id=level_id,status=target_status,external_subscription_id=target_subscription_id,
    current_period_ends_at=target_period_end,next_billing_at=target_period_end,
    cancel_at_period_end=coalesce(target_cancel_at_period_end,false),amount_cents=target_amount_cents,
    renewal_amount_cents=target_amount_cents,currency=upper(target_currency),source='billing_webhook',
    last_payment_failed_at=case when target_event_type='invoice.payment_failed' then now() else last_payment_failed_at end,
    updated_at=now()
  where id=membership.id;

  if target_status in ('active','trialing','past_due') and target_level_code in ('founding_partner','premium') then
    select id into badge_id from public.vendor_badges where code=case when target_level_code='founding_partner' then 'founding_partner' else 'preferred_vendor' end;
    if badge_id is not null and not exists(select 1 from public.vendor_badge_awards where vendor_organization_id=target_vendor_organization_id and vendor_badge_id=badge_id and revoked_at is null) then
      insert into public.vendor_badge_awards(vendor_organization_id,vendor_badge_id,reason)
      values(target_vendor_organization_id,badge_id,'Active paid '||target_level_code||' membership');
    end if;
  end if;
  if target_level_code<>'premium' or target_status not in ('active','trialing','past_due') then
    update public.vendor_badge_awards set revoked_at=coalesce(revoked_at,now())
    where vendor_organization_id=target_vendor_organization_id
      and vendor_badge_id=(select id from public.vendor_badges where code='preferred_vendor') and revoked_at is null;
  end if;
  if target_level_code='founding_partner' and target_status not in ('active','trialing','past_due') then
    update public.vendor_badge_awards set revoked_at=coalesce(revoked_at,now())
    where vendor_organization_id=target_vendor_organization_id
      and vendor_badge_id=(select id from public.vendor_badges where code='founding_partner') and revoked_at is null;
  end if;

  insert into public.vendor_membership_events(vendor_organization_id,vendor_membership_id,event_type,to_level_code,source,idempotency_key,metadata)
  values(target_vendor_organization_id,membership.id,
    case when target_event_type='invoice.paid' then 'renewed' when target_event_type='invoice.payment_failed' then 'payment_failed' when target_status='canceled' then 'cancelled' when target_status='expired' then 'expired' else 'changed' end,
    target_level_code,'billing_webhook','stripe:'||target_event_id,
    jsonb_build_object('stripe_subscription_id',target_subscription_id,'stripe_event_type',target_event_type))
  on conflict(idempotency_key) do nothing;
  update public.vendor_membership_provider_events set membership_id=membership.id,processed_at=now(),processing_error=null
  where provider='stripe' and provider_event_id=target_event_id;
  return membership.id;
end $$;

-- A Super Admin action first retrieves this Checkout Session from Stripe and
-- validates the live provider object. This RPC then records the verified values
-- idempotently without granting membership before onboarding review.
create or replace function public.reconcile_verified_founding_partner_checkout(
  target_attempt_id uuid,target_actor_user_id uuid,target_checkout_session_id text,target_customer_id text,
  target_payment_intent_id text,target_customer_email text,target_customer_name text,target_paid_at timestamptz,
  target_provider_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare program_id uuid; payment_id uuid; onboarding_id uuid; existing_payment public.founding_partner_payments%rowtype;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'service role required'; end if;
  if not exists(select 1 from public.profiles where id=target_actor_user_id and is_super_admin) then raise exception 'verified Super Admin required'; end if;
  if target_checkout_session_id!~'^cs_(test_|live_)?[A-Za-z0-9]+$' or target_customer_id!~'^cus_[A-Za-z0-9]+$' or target_payment_intent_id!~'^pi_[A-Za-z0-9]+$' then raise exception 'invalid Stripe identifiers'; end if;
  if target_customer_email is null or position('@' in target_customer_email)<2 then raise exception 'customer email required'; end if;
  if target_paid_at>now()+interval '5 minutes' then raise exception 'invalid payment timestamp'; end if;

  select * into existing_payment from public.founding_partner_payments
  where checkout_session_id=target_checkout_session_id or payment_intent_id=target_payment_intent_id for update;
  if found then
    if existing_payment.checkout_session_id<>target_checkout_session_id or existing_payment.payment_intent_id<>target_payment_intent_id
      or existing_payment.amount_paid_cents<>29900 or existing_payment.currency<>'USD' or existing_payment.payment_status<>'paid' then
      raise exception 'conflicting founder payment record';
    end if;
    select id into onboarding_id from public.founding_partner_onboardings where payment_id=existing_payment.id;
    if onboarding_id is null then
      insert into public.founding_partner_onboardings(payment_id,customer_email,customer_name)
      values(existing_payment.id,existing_payment.customer_email,existing_payment.customer_name) returning id into onboarding_id;
    end if;
    return onboarding_id;
  end if;

  select id into program_id from public.founding_programs where slug='founding-fifty' for update;
  if program_id is null then raise exception 'founding program not found'; end if;
  insert into public.founding_partner_checkout_attempts(id,program_id,status,checkout_session_id,expected_amount_cents,expected_currency,membership_type,expires_at)
  values(target_attempt_id,program_id,'paid',target_checkout_session_id,29900,'USD','founding_partner',target_paid_at);
  insert into public.founding_partner_payments(
    checkout_attempt_id,provider_customer_id,checkout_session_id,payment_intent_id,amount_paid_cents,currency,
    payment_status,customer_email,customer_name,membership_type,paid_at,provider_metadata
  ) values(
    target_attempt_id,target_customer_id,target_checkout_session_id,target_payment_intent_id,29900,'USD','paid',
    lower(trim(target_customer_email)),nullif(trim(target_customer_name),''),'founding_partner',target_paid_at,
    coalesce(target_provider_metadata,'{}'::jsonb)||jsonb_build_object('reconciled_by',target_actor_user_id,'reconciliation_source','stripe_api_verified_admin')
  ) returning id into payment_id;
  insert into public.founding_partner_onboardings(payment_id,customer_email,customer_name)
  values(payment_id,lower(trim(target_customer_email)),nullif(trim(target_customer_name),'')) returning id into onboarding_id;
  insert into public.audit_events(actor_user_id,action,entity_type,entity_id,metadata)
  values(target_actor_user_id,'founding_partner.payment_reconciled','founding_partner_payment',payment_id,
    jsonb_build_object('checkout_session_id',target_checkout_session_id,'amount_cents',29900,'currency','USD'));
  return onboarding_id;
end $$;

create or replace function public.enforce_property_manager_perk_entitlement()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.property_manager_perk_enabled and (
    not coalesce(old.property_manager_perk_enabled,false)
    or new.property_manager_perk_title is distinct from old.property_manager_perk_title
    or new.property_manager_perk_description is distinct from old.property_manager_perk_description
    or new.property_manager_perk_type is distinct from old.property_manager_perk_type
    or new.property_manager_perk_terms is distinct from old.property_manager_perk_terms
    or new.property_manager_perk_expiration_date is distinct from old.property_manager_perk_expiration_date
  ) and not public.vendor_has_entitlement(new.organization_id,'property_manager_perk') then
    raise exception 'active Property Manager Perk entitlement required';
  end if;
  return new;
end $$;
drop trigger if exists vendor_profiles_perk_entitlement on public.vendor_profiles;
create trigger vendor_profiles_perk_entitlement before update of
  property_manager_perk_enabled,property_manager_perk_title,property_manager_perk_description,
  property_manager_perk_type,property_manager_perk_terms,property_manager_perk_expiration_date
on public.vendor_profiles for each row execute function public.enforce_property_manager_perk_entitlement();

revoke execute on function public.reserve_vendor_membership_checkout(uuid,text,text,text,text,integer,text) from public,anon,authenticated;
revoke execute on function public.process_vendor_membership_stripe_event(text,text,uuid,uuid,text,text,text,text,text,timestamptz,boolean,integer,text,jsonb) from public,anon,authenticated;
revoke execute on function public.reconcile_verified_founding_partner_checkout(uuid,uuid,text,text,text,text,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_vendor_membership_checkout(uuid,text,text,text,text,integer,text) to service_role;
grant execute on function public.process_vendor_membership_stripe_event(text,text,uuid,uuid,text,text,text,text,text,timestamptz,boolean,integer,text,jsonb) to service_role;
grant execute on function public.reconcile_verified_founding_partner_checkout(uuid,uuid,text,text,text,text,text,timestamptz,jsonb) to service_role;

comment on function public.reconcile_verified_founding_partner_checkout is 'Records an exact Stripe-API-verified legacy $299 Founder Checkout Session for onboarding and admin review; it does not grant membership by email or redirect state.';
comment on function public.enforce_property_manager_perk_entitlement is 'Prevents direct authenticated API writes from enabling or changing a public perk without a current database entitlement.';

commit;
