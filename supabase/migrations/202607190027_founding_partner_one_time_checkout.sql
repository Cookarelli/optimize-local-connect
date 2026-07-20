begin;

-- Founding Partner is a lifetime, one-time payment. Network and Preferred
-- remain recurring subscription tiers.
update public.vendor_membership_levels
set billing_model='one_time',monthly_price_cents=0,annual_price_cents=0,
  one_time_price_cents=29900,
  description='One-time Founding Partner membership with Founder recognition and premium visibility.'
where code='founding_partner';

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
  if target_price_id !~ '^price_' or target_interval is not null or target_amount_cents <> 29900 or upper(target_currency) <> 'USD' then raise exception 'invalid founding membership configuration'; end if;
  select id, capacity into level_id, capacity_limit from public.vendor_membership_levels where code='founding_partner' and is_active and billing_model='one_time' and publicly_purchasable for update;
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
    values(organization_id,level_id,'pending',now(),'guest_founding_checkout',target_price_id,null,target_amount_cents,'USD',null,1,1) returning id into member_id;
  select vm.checkout_attempt_number into checkout_attempt_number from public.vendor_memberships vm where vm.id=member_id;
  insert into public.vendor_membership_guest_claims(vendor_organization_id,membership_id,purchaser_email,contact_name,contact_phone,primary_service_category)
    values(organization_id,member_id,normalized_email,trim(target_contact_name),normalized_phone,trim(target_primary_service_category)) returning id into claim_id;
  vendor_organization_id:=organization_id; membership_id:=member_id; return next;
end $$;

create or replace function public.process_one_time_vendor_membership_checkout(
  target_event_id text,target_event_type text,target_membership_id uuid,target_vendor_organization_id uuid,
  target_checkout_session_id text,target_payment_intent_id text,target_customer_id text,target_price_id text,
  target_amount_cents integer,target_currency text,target_payload jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare membership public.vendor_memberships%rowtype;level_id uuid;prior_membership_id uuid;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'service role required'; end if;
  if target_event_type<>'checkout.session.completed' or target_checkout_session_id!~'^cs_' or target_payment_intent_id!~'^pi_' or target_customer_id!~'^cus_' or target_price_id!~'^price_' or target_amount_cents<>29900 or upper(target_currency)<>'USD' then raise exception 'invalid one-time founding payment'; end if;
  select membership_id into prior_membership_id from public.vendor_membership_provider_events where provider='stripe' and provider_event_id=target_event_id and processed_at is not null;
  if found then return prior_membership_id; end if;
  insert into public.vendor_membership_provider_events(provider_event_id,event_type,provider_object_id,payload)
    values(target_event_id,target_event_type,target_payment_intent_id,target_payload)
    on conflict(provider,provider_event_id) do update set event_type=excluded.event_type,provider_object_id=excluded.provider_object_id,payload=excluded.payload;
  select * into membership from public.vendor_memberships where id=target_membership_id for update;
  if not found then raise exception 'membership checkout reservation not found'; end if;
  if membership.vendor_organization_id<>target_vendor_organization_id or membership.stripe_customer_id<>target_customer_id or membership.stripe_checkout_session_id<>target_checkout_session_id or membership.stripe_price_id<>target_price_id or membership.billing_interval is not null then raise exception 'one-time membership provider mapping mismatch'; end if;
  select id into level_id from public.vendor_membership_levels where code='founding_partner' and is_active and billing_model='one_time';
  if level_id is null or membership.membership_level_id<>level_id then raise exception 'one-time founding membership unavailable'; end if;
  update public.vendor_memberships set status='active',external_subscription_id=null,billing_interval=null,current_period_ends_at=null,next_billing_at=null,cancel_at_period_end=false,
    amount_cents=target_amount_cents,renewal_amount_cents=null,currency=upper(target_currency),updated_at=now() where id=membership.id;
  insert into public.vendor_membership_events(vendor_organization_id,vendor_membership_id,event_type,to_level_code,source,idempotency_key,metadata)
    values(target_vendor_organization_id,membership.id,'activated','founding_partner','guest_founding_checkout','stripe:'||target_event_id,jsonb_build_object('stripe_checkout_session_id',target_checkout_session_id,'stripe_payment_intent_id',target_payment_intent_id,'stripe_event_type',target_event_type)) on conflict(idempotency_key) do nothing;
  update public.vendor_membership_provider_events set membership_id=membership.id,processed_at=now(),processing_error=null where provider='stripe' and provider_event_id=target_event_id;
  return membership.id;
end $$;

commit;
