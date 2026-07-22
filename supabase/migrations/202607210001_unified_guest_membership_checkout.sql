begin;

create or replace function public.create_guest_vendor_membership_checkout(
  target_business_name text, target_contact_name text, target_contact_email text,
  target_contact_phone text, target_primary_service_category text, target_plan_code text,
  target_price_id text, target_interval text, target_amount_cents integer, target_currency text
) returns table(claim_id uuid, vendor_organization_id uuid, membership_id uuid, checkout_attempt_number integer)
language plpgsql security definer set search_path='' as $$
declare normalized_name text:=lower(regexp_replace(trim(target_business_name),'\s+',' ','g'));
  normalized_email text:=lower(trim(target_contact_email)); normalized_phone text:=nullif(regexp_replace(trim(target_contact_phone),'[^0-9+]','','g'),'');
  base_slug text; organization_id uuid; level_id uuid; member_id uuid; capacity_limit integer; pending_count integer;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'service role required'; end if;
  if char_length(normalized_name) not between 2 and 160 or char_length(trim(target_contact_name)) not between 2 and 120 or normalized_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or normalized_phone is null or char_length(normalized_phone)<7 or char_length(trim(target_primary_service_category)) not between 2 and 120 then raise exception 'invalid vendor details'; end if;
  if target_plan_code not in ('founding_partner','preferred','network') or target_price_id !~ '^price_' or target_interval not in ('month','year') or target_amount_cents<=0 or upper(target_currency)<>'USD' then raise exception 'invalid membership configuration'; end if;
  select id,capacity into level_id,capacity_limit from public.vendor_membership_levels where code=target_plan_code and is_active and billing_model='subscription' and publicly_purchasable for update;
  if level_id is null then raise exception 'membership unavailable'; end if;
  if capacity_limit is not null then select count(*) into pending_count from public.vendor_memberships where membership_level_id=level_id and status in ('pending','trialing','active','past_due','complimentary','manually_granted'); if pending_count>=capacity_limit then raise exception 'membership capacity reached'; end if; end if;
  base_slug:=trim(both '-' from regexp_replace(normalized_name,'[^a-z0-9]+','-','g'));
  if base_slug='' then raise exception 'business name cannot produce a valid slug'; end if;
  insert into public.organizations(type,name,slug,phone,status) values('vendor',trim(target_business_name),left(base_slug,130)||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,10),normalized_phone,'onboarding') returning id into organization_id;
  insert into public.vendor_profiles(organization_id,verification_status,public_email,contact_name) values(organization_id,'pending',normalized_email,trim(target_contact_name));
  insert into public.vendor_memberships(vendor_organization_id,membership_level_id,status,starts_at,source,stripe_price_id,billing_interval,amount_cents,currency,renewal_amount_cents,onboarding_version,checkout_attempt_number) values(organization_id,level_id,'pending',now(),'guest_membership_checkout',target_price_id,target_interval,target_amount_cents,'USD',target_amount_cents,1,1) returning id into member_id;
  insert into public.vendor_membership_guest_claims(vendor_organization_id,membership_id,purchaser_email,contact_name,contact_phone,primary_service_category) values(organization_id,member_id,normalized_email,trim(target_contact_name),normalized_phone,trim(target_primary_service_category)) returning id into claim_id;
  vendor_organization_id:=organization_id; membership_id:=member_id; checkout_attempt_number:=1; return next;
end $$;

create or replace function public.attach_guest_vendor_membership_checkout(target_claim_id uuid,target_membership_id uuid,target_customer_id text,target_checkout_session_id text)
returns void language plpgsql security definer set search_path='' as $$ begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' or target_customer_id !~ '^cus_' or target_checkout_session_id !~ '^cs_' then raise exception 'invalid checkout identifiers'; end if;
  update public.vendor_membership_guest_claims set stripe_customer_id=target_customer_id,stripe_checkout_session_id=target_checkout_session_id,updated_at=now() where id=target_claim_id and membership_id=target_membership_id and payment_status='pending';
  if not found then raise exception 'guest membership checkout reservation not found'; end if;
  update public.vendor_memberships set stripe_customer_id=target_customer_id,stripe_checkout_session_id=target_checkout_session_id,updated_at=now() where id=target_membership_id and status='pending';
  if not found then raise exception 'pending membership not found'; end if;
end $$;

revoke execute on function public.create_guest_vendor_membership_checkout(text,text,text,text,text,text,text,text,integer,text) from public,anon,authenticated;
revoke execute on function public.attach_guest_vendor_membership_checkout(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.create_guest_vendor_membership_checkout(text,text,text,text,text,text,text,text,integer,text) to service_role;
grant execute on function public.attach_guest_vendor_membership_checkout(uuid,uuid,text,text) to service_role;

commit;
