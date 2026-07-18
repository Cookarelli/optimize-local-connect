begin;

alter table public.founding_partner_onboardings
  add column if not exists internal_notes text,
  add column if not exists status_changed_at timestamptz not null default now(),
  add column if not exists approved_at timestamptz,
  add column if not exists changes_requested_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists suspended_at timestamptz;

create index if not exists founding_partner_onboardings_updated_idx
  on public.founding_partner_onboardings(updated_at desc);
create index if not exists founding_partner_onboardings_category_idx
  on public.founding_partner_onboardings(primary_service_category,status);
create index if not exists founding_partner_onboardings_search_idx
  on public.founding_partner_onboardings using gin (
    to_tsvector('simple',coalesce(business_name,'')||' '||coalesce(contact_name,'')||' '||coalesce(customer_email,'')||' '||coalesce(phone,''))
  );

create table public.founding_partner_admin_events (
  id bigint generated always as identity primary key,
  onboarding_id uuid not null references public.founding_partner_onboardings(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('notes_updated','review_started','approved','changes_requested','rejected','activated','suspended')),
  from_status text,
  to_status text,
  notes text,
  occurred_at timestamptz not null default now()
);
create index founding_partner_admin_events_record_idx
  on public.founding_partner_admin_events(onboarding_id,occurred_at desc);

create or replace function public.prevent_founding_partner_admin_event_mutation()
returns trigger language plpgsql set search_path='' as $$
begin
  raise exception 'Founding Partner admin history is immutable';
end $$;
create trigger founding_partner_admin_events_immutable
before update or delete on public.founding_partner_admin_events
for each row execute function public.prevent_founding_partner_admin_event_mutation();

alter table public.founding_partner_admin_events enable row level security;
create policy "founding_partner_admin_events_read" on public.founding_partner_admin_events
for select to authenticated using (public.is_super_admin());
grant select on public.founding_partner_admin_events to authenticated;
grant all on public.founding_partner_admin_events to service_role;

create or replace function public.admin_manage_founding_partner(
  target_onboarding_id uuid,
  target_action text,
  target_notes text default null
) returns text language plpgsql security definer set search_path='' as $$
declare
  onboarding public.founding_partner_onboardings%rowtype;
  payment public.founding_partner_payments%rowtype;
  previous_status text;
  next_status text;
  vendor_org uuid;
  category_id uuid;
  service_id uuid;
  badge_id uuid;
  membership_id uuid;
  base_slug text;
  item text;
  city_name text;
  parsed_state_code text;
  city_id uuid;
begin
  if not public.is_super_admin() then raise exception 'super admin required'; end if;
  if target_action not in ('save_notes','start_review','approve','request_changes','reject','activate','suspend') then raise exception 'unsupported Founder action'; end if;
  if target_notes is not null and char_length(target_notes)>4000 then raise exception 'notes are too long'; end if;

  select * into onboarding from public.founding_partner_onboardings where id=target_onboarding_id for update;
  if not found then raise exception 'Founding Partner application not found'; end if;
  select * into payment from public.founding_partner_payments where id=onboarding.payment_id;
  if not found then raise exception 'payment record not found'; end if;
  previous_status:=onboarding.status;

  if target_action='save_notes' then
    update public.founding_partner_onboardings set internal_notes=nullif(trim(target_notes),'') where id=onboarding.id;
    insert into public.founding_partner_admin_events(onboarding_id,actor_user_id,action,from_status,to_status,notes)
    values(onboarding.id,auth.uid(),'notes_updated',previous_status,previous_status,nullif(trim(target_notes),''));
    return previous_status;
  end if;

  if payment.payment_status<>'paid' or payment.amount_paid_cents<>29900 or payment.currency<>'USD' then
    raise exception 'verified paid $299 USD payment required';
  end if;

  if target_action='start_review' then
    if previous_status not in ('submitted','changes_requested') then raise exception 'application cannot enter review from its current status'; end if;
    next_status:='under_review';
  elsif target_action='approve' then
    if previous_status not in ('submitted','under_review','changes_requested') then raise exception 'application cannot be approved from its current status'; end if;
    next_status:='approved';
  elsif target_action='request_changes' then
    if previous_status not in ('submitted','under_review','approved') then raise exception 'changes cannot be requested from the current status'; end if;
    if char_length(coalesce(trim(target_notes),''))<5 then raise exception 'change request notes are required'; end if;
    next_status:='changes_requested';
  elsif target_action='reject' then
    if previous_status not in ('submitted','under_review','approved','changes_requested') then raise exception 'application cannot be rejected from its current status'; end if;
    if char_length(coalesce(trim(target_notes),''))<5 then raise exception 'rejection notes are required'; end if;
    next_status:='rejected';
  elsif target_action='activate' then
    if previous_status not in ('approved','suspended','active') then raise exception 'only an approved or suspended application can be activated'; end if;
    if onboarding.business_name is null or onboarding.primary_service_category is null or cardinality(onboarding.service_area_cities)=0 then raise exception 'application profile is incomplete'; end if;
    next_status:='active';
    vendor_org:=onboarding.vendor_organization_id;
    if vendor_org is null then
      base_slug:=trim(both '-' from lower(regexp_replace(onboarding.business_name,'[^a-zA-Z0-9]+','-','g')));
      if base_slug='' then base_slug:='founding-partner'; end if;
      insert into public.organizations(type,name,legal_name,slug,website_url,phone,status)
      values('vendor',onboarding.business_name,onboarding.business_name,left(base_slug,140)||'-'||substr(replace(onboarding.id::text,'-',''),1,8),onboarding.website,onboarding.phone,'active')
      returning id into vendor_org;
      update public.founding_partner_onboardings set vendor_organization_id=vendor_org where id=onboarding.id;
    else
      update public.organizations set name=onboarding.business_name,website_url=onboarding.website,phone=onboarding.phone,status='active' where id=vendor_org;
    end if;

    insert into public.vendor_profiles(organization_id,description,years_in_business,license_number,verification_status)
    values(vendor_org,coalesce(onboarding.company_bio,onboarding.business_description),onboarding.years_in_business,onboarding.license_number,'pending')
    on conflict(organization_id) do update set description=excluded.description,years_in_business=excluded.years_in_business,license_number=excluded.license_number;

    select id into category_id from public.vendor_categories where lower(name)=lower(onboarding.primary_service_category) limit 1;
    if category_id is null then
      base_slug:=trim(both '-' from lower(regexp_replace(onboarding.primary_service_category,'[^a-zA-Z0-9]+','-','g')));
      insert into public.vendor_categories(slug,name,is_active,sort_order)
      values(base_slug,onboarding.primary_service_category,true,100)
      on conflict(slug) do update set is_active=true returning id into category_id;
    end if;
    insert into public.vendor_category_assignments(vendor_organization_id,vendor_category_id)
    values(vendor_org,category_id) on conflict do nothing;

    foreach item in array onboarding.services_offered loop
      base_slug:=left(trim(both '-' from lower(regexp_replace(item,'[^a-zA-Z0-9]+','-','g'))),120)||'-'||substr(md5(item),1,6);
      insert into public.vendor_services(vendor_category_id,slug,name,is_active)
      values(category_id,base_slug,left(item,160),true)
      on conflict(vendor_category_id,slug) do update set name=excluded.name,is_active=true returning id into service_id;
      insert into public.vendor_service_offerings(vendor_organization_id,vendor_service_id,emergency_available,is_active)
      values(vendor_org,service_id,onboarding.emergency_service_available,true)
      on conflict(vendor_organization_id,vendor_service_id) do update set emergency_available=excluded.emergency_available,is_active=true;
    end loop;

    foreach item in array onboarding.service_area_cities loop
      city_name:=trim(split_part(item,',',1));
      parsed_state_code:=upper(trim(split_part(item,',',2)));
      if city_name<>'' and parsed_state_code~'^[A-Z]{2}$' then
        base_slug:=trim(both '-' from lower(regexp_replace(city_name,'[^a-zA-Z0-9]+','-','g')));
        select id into city_id from public.cities where country_code='US' and state_code=parsed_state_code and slug=base_slug limit 1;
        if city_id is null then
          insert into public.cities(slug,name,state_code,country_code,timezone,is_active)
          values(base_slug,city_name,parsed_state_code,'US','America/Chicago',true)
          on conflict(country_code,state_code,slug) do update set is_active=true returning id into city_id;
        end if;
        insert into public.vendor_service_cities(vendor_organization_id,city_id,emergency_available,is_active)
        values(vendor_org,city_id,onboarding.emergency_service_available,true)
        on conflict(vendor_organization_id,city_id) do update set emergency_available=excluded.emergency_available,is_active=true;
      end if;
    end loop;

    select id into membership_id from public.vendor_memberships vm join public.vendor_membership_levels ml on ml.id=vm.membership_level_id
    where vm.vendor_organization_id=vendor_org and ml.code='founding_partner' and vm.status in ('active','paused') order by vm.created_at desc limit 1;
    if membership_id is null then
      perform public.activate_vendor_membership(vendor_org,'founding_partner','founding_program','founder-activation:'||onboarding.id,'founder-payment:'||payment.id,null,jsonb_build_object('onboarding_id',onboarding.id,'payment_id',payment.id));
    else
      update public.vendor_memberships set status='active',updated_at=now() where id=membership_id and status='paused';
    end if;
    select id into badge_id from public.vendor_badges where code='founding_partner';
    if badge_id is not null and not exists(select 1 from public.vendor_badge_awards where vendor_organization_id=vendor_org and vendor_badge_id=badge_id and revoked_at is null) then
      insert into public.vendor_badge_awards(vendor_organization_id,vendor_badge_id,awarded_by,reason)
      values(vendor_org,badge_id,auth.uid(),'Approved paid Optimize Local Connect Founding Partner');
    end if;
    if onboarding.featured_image_url is not null and not exists(select 1 from public.vendor_marketplace_media where vendor_organization_id=vendor_org and external_url=onboarding.featured_image_url) then
      insert into public.vendor_marketplace_media(vendor_organization_id,media_type,external_url,title,alt_text,is_published)
      values(vendor_org,'image',onboarding.featured_image_url,onboarding.business_name||' featured image',onboarding.business_name||' business photo',true);
    end if;
  elsif target_action='suspend' then
    if previous_status<>'active' then raise exception 'only an active listing can be suspended'; end if;
    next_status:='suspended';
    if onboarding.vendor_organization_id is not null then
      update public.organizations set status='suspended' where id=onboarding.vendor_organization_id;
      update public.vendor_memberships set status='paused',updated_at=now() where vendor_organization_id=onboarding.vendor_organization_id and status='active';
    end if;
  end if;

  update public.founding_partner_onboardings set
    status=next_status,
    status_changed_at=now(),
    reviewed_at=case when next_status='under_review' then now() else reviewed_at end,
    approved_at=case when next_status='approved' then now() else approved_at end,
    changes_requested_at=case when next_status='changes_requested' then now() else changes_requested_at end,
    rejected_at=case when next_status='rejected' then now() else rejected_at end,
    activated_at=case when next_status='active' then coalesce(activated_at,now()) else activated_at end,
    suspended_at=case when next_status='suspended' then now() else suspended_at end,
    review_notes=case when next_status in ('changes_requested','rejected') then nullif(trim(target_notes),'') else review_notes end
  where id=onboarding.id;

  insert into public.founding_partner_admin_events(onboarding_id,actor_user_id,action,from_status,to_status,notes)
  values(onboarding.id,auth.uid(),case target_action when 'start_review' then 'review_started' when 'approve' then 'approved' when 'request_changes' then 'changes_requested' when 'reject' then 'rejected' when 'activate' then 'activated' else 'suspended' end,previous_status,next_status,nullif(trim(target_notes),''));
  insert into public.audit_events(actor_user_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'founding_partner.admin_'||target_action,'founding_partner_onboarding',onboarding.id,jsonb_build_object('from_status',previous_status,'to_status',next_status,'payment_id',payment.id));
  return next_status;
end $$;

revoke execute on function public.admin_manage_founding_partner(uuid,text,text) from public,anon;
grant execute on function public.admin_manage_founding_partner(uuid,text,text) to authenticated;
grant execute on function public.admin_manage_founding_partner(uuid,text,text) to service_role;

comment on table public.founding_partner_admin_events is 'Immutable administrator status and notes history for paid Founding Partner applications.';
comment on function public.admin_manage_founding_partner is 'Super Admin-only Founder review and marketplace activation; the provider-verified payment ledger is never mutated.';

commit;
