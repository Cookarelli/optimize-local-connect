begin;

create table public.founding_programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  total_seats integer not null check (total_seats > 0),
  price_cents integer not null check (price_cents > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'draft' check (status in ('draft','active','paused','completed','archived')),
  launch_market_id uuid references public.markets(id) on delete set null,
  hold_minutes integer not null default 30 check (hold_minutes between 5 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.founding_verticals (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.founding_programs(id) on delete cascade,
  name text not null,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null,
  display_order integer not null check (display_order > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, slug),
  unique (program_id, display_order)
);

create table public.founding_seats (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.founding_programs(id) on delete cascade,
  vertical_id uuid not null references public.founding_verticals(id) on delete restrict,
  seat_number smallint not null check (seat_number between 1 and 9999),
  status text not null default 'available' check (status in ('available','pending_payment','claimed','reserved','disabled')),
  vendor_id uuid references public.vendor_profiles(organization_id) on delete restrict,
  reserved_business_name text,
  display_business_name text,
  display_city text,
  logo_url text,
  hold_expires_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, seat_number),
  unique (vertical_id, seat_number),
  check ((status = 'pending_payment') = (hold_expires_at is not null)),
  check (status <> 'claimed' or (vendor_id is not null and claimed_at is not null))
);
create index founding_seats_board_idx on public.founding_seats (program_id, status, seat_number);
create index founding_seats_vertical_idx on public.founding_seats (vertical_id, seat_number);

create table public.founding_claims (
  id uuid primary key default gen_random_uuid(),
  seat_id uuid not null references public.founding_seats(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  vendor_id uuid references public.vendor_profiles(organization_id) on delete restrict,
  business_name text not null check (char_length(business_name) between 2 and 160),
  contact_name text not null check (char_length(contact_name) between 2 and 160),
  email text not null,
  phone text not null,
  website text,
  industry text not null,
  city text not null,
  business_description text not null check (char_length(business_description) between 20 and 1200),
  logo_url text,
  terms_version text not null,
  terms_accepted_at timestamptz not null,
  status text not null default 'pending_payment' check (status in ('pending_payment','payment_submitted','awaiting_verification','confirmed','rejected','expired','payment_failed','payment_cancelled')),
  payment_provider text not null check (payment_provider ~ '^[a-z][a-z0-9_-]*$'),
  payment_reference text,
  payment_amount_cents integer not null check (payment_amount_cents > 0),
  submitted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  rejected_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (confirmed_at is null or status = 'confirmed'),
  check (rejected_at is null or status = 'rejected')
);
create unique index founding_claims_one_active_hold_idx on public.founding_claims (seat_id)
where status in ('pending_payment','payment_submitted','awaiting_verification');
create index founding_claims_user_idx on public.founding_claims (user_id, created_at desc);
create index founding_claims_admin_idx on public.founding_claims (status, expires_at, created_at);
create unique index founding_claims_payment_reference_idx on public.founding_claims (payment_provider, payment_reference) where payment_reference is not null;

create table public.founding_benefits (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.founding_programs(id) on delete cascade,
  name text not null,
  description text not null,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, name)
);

create table public.founding_member_benefits (
  id uuid primary key default gen_random_uuid(),
  seat_id uuid not null references public.founding_seats(id) on delete cascade,
  benefit_id uuid not null references public.founding_benefits(id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz,
  status text not null default 'active' check (status in ('scheduled','active','expired','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seat_id, benefit_id),
  check (end_at is null or end_at > start_at)
);

create table public.founding_payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  claim_id uuid references public.founding_claims(id) on delete set null,
  verification_status text not null check (verification_status in ('verified','rejected','ignored')),
  payload jsonb not null,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);
create index founding_payment_events_claim_idx on public.founding_payment_events (claim_id, processed_at desc);

do $$ declare table_name text; begin
  foreach table_name in array array['founding_programs','founding_verticals','founding_seats','founding_claims','founding_benefits','founding_member_benefits'] loop
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

insert into public.vendor_membership_levels (code, name, description, rank, monthly_price_cents, annual_price_cents, quote_limit_per_month, features)
values ('premium', 'Premium', 'Premium placement and growth tools for leading local providers.', 15, 4900, 58800, null, '{"ai_placement":true,"homepage_placement":true,"videos":true,"coupons":true,"analytics":true,"push_notifications":true}'::jsonb)
on conflict (code) do update set name=excluded.name, description=excluded.description, monthly_price_cents=excluded.monthly_price_cents, annual_price_cents=excluded.annual_price_cents, features=excluded.features, is_active=true;

insert into public.vendor_badges (code, name, description, icon_key, color_key)
values ('founding_fifty', 'Founding Fifty', 'One of the first fifty local businesses helping build Optimize Local Connect.', 'award', 'emerald')
on conflict (code) do update set name=excluded.name, description=excluded.description, is_active=true;

insert into public.founding_programs (name, slug, total_seats, price_cents, currency, status, hold_minutes)
values ('The Founding Fifty', 'founding-fifty', 50, 29900, 'USD', 'active', 30)
on conflict (slug) do update set name=excluded.name, total_seats=excluded.total_seats, price_cents=excluded.price_cents, currency=excluded.currency, hold_minutes=excluded.hold_minutes;

with program as (select id from public.founding_programs where slug='founding-fifty'), seed(name,slug,description,display_order) as (values
('Roofing, Gutters & Siding','roofing-gutters-siding','Exterior protection, roofing, gutter, and siding specialists.',1),
('Appliance Sales & Repair','appliance-sales-repair','Local appliance sales, diagnostics, maintenance, and repair.',2),
('Cleaning Services','cleaning-services','Residential, commercial, turn, and specialty cleaning.',3),
('HVAC','hvac','Heating, cooling, ventilation, and indoor-air services.',4),
('Plumbing','plumbing','Routine, emergency, and project-based plumbing services.',5),
('Electrical','electrical','Licensed electrical repair, installation, and emergency service.',6),
('General Contracting','general-contracting','Construction, renovation, and general project delivery.',7),
('Landscaping & Lawn Care','landscaping-lawn-care','Grounds, lawn, landscape, and seasonal property care.',8),
('Pest Control','pest-control','Residential and commercial pest prevention and treatment.',9),
('Painting','painting','Interior, exterior, residential, and commercial painting.',10),
('Flooring & Carpet','flooring-carpet','Flooring installation, repair, and carpet services.',11),
('Restoration & Remediation','restoration-remediation','Water, fire, mold, and damage restoration specialists.',12),
('Locksmith & Access Control','locksmith-access-control','Locks, keys, access systems, and emergency entry.',13),
('Garage Doors & Gates','garage-doors-gates','Garage door, gate, and operator installation and repair.',14),
('Windows & Glass','windows-glass','Window, glass, glazing, and screen services.',15),
('Pool & Spa Services','pool-spa-services','Pool and spa maintenance, repair, and renovation.',16),
('Security & Low Voltage','security-low-voltage','Security, camera, alarm, network, and low-voltage systems.',17),
('Moving & Junk Removal','moving-junk-removal','Local moving, hauling, cleanout, and junk removal.',18),
('Waste & Recycling','waste-recycling','Waste, recycling, dumpster, and material recovery services.',19),
('Tree Services','tree-services','Tree care, trimming, removal, and emergency response.',20),
('Concrete & Masonry','concrete-masonry','Concrete, brick, stone, flatwork, and structural masonry.',21),
('Fencing','fencing','Residential and commercial fencing and gate services.',22),
('Handyman & Maintenance','handyman-maintenance','General repairs, turns, punch lists, and preventive maintenance.',23),
('Real Estate Services','real-estate-services','Brokerage, transaction, inspection, and property support.',24),
('Professional Business Services','professional-business-services','Local legal, accounting, insurance, marketing, and business support.',25)
)
insert into public.founding_verticals (program_id,name,slug,description,display_order)
select program.id,seed.name,seed.slug,seed.description,seed.display_order from program cross join seed
on conflict (program_id,slug) do update set name=excluded.name,description=excluded.description,display_order=excluded.display_order,active=true;

insert into public.founding_seats (program_id,vertical_id,seat_number)
select v.program_id,v.id,((v.display_order-1)*2)+slot
from public.founding_verticals v
join public.founding_programs p on p.id=v.program_id and p.slug='founding-fifty'
cross join generate_series(1,2) slot
on conflict (program_id,seat_number) do nothing;

with p as (select id from public.founding_programs where slug='founding-fifty'), benefit(name,description,display_order) as (values
('12 Months Premium','The first twelve months of Premium membership are included.',1),
('Permanent Founding Fifty Badge','A permanent badge recognizing the business as one of the original fifty.',2),
('Permanent Founding Number','A unique number from #001 through #050 that remains with the confirmed business.',3),
('Locked Preferred Renewal Pricing','Preferred renewal pricing is locked after the included first year.',4),
('Early Feature Voting','Participate in structured voting on selected early platform capabilities.',5),
('Quarterly Founder Roundtables','Invitation to quarterly conversations with the founder and cohort.',6),
('Founding Fifty Wall Placement','Permanent recognition on the Founding Fifty wall.',7),
('Community Spotlight Eligibility','Eligibility for community and business spotlight features.',8)
)
insert into public.founding_benefits (program_id,name,description,display_order)
select p.id,benefit.name,benefit.description,benefit.display_order from p cross join benefit
on conflict (program_id,name) do update set description=excluded.description,display_order=excluded.display_order,active=true;

update public.founding_seats s set status='reserved',reserved_business_name=r.business_name
from (values (1,'CLA Exteriors'),(3,'Afrodita Appliances'),(5,'Clean to a T')) r(seat_number,business_name)
join public.founding_programs p on p.slug='founding-fifty'
where s.program_id=p.id and s.seat_number=r.seat_number and s.status='available';

create or replace function public.release_expired_founding_holds(target_program_id uuid default null)
returns integer language plpgsql security definer set search_path='' as $$
declare released integer;
begin
  update public.founding_claims c set status='expired',updated_at=now()
  from public.founding_seats s
  where c.seat_id=s.id and c.status in ('pending_payment','payment_submitted','awaiting_verification') and c.expires_at <= now()
    and (target_program_id is null or s.program_id=target_program_id);
  update public.founding_seats s set status='available',hold_expires_at=null,updated_at=now()
  where s.status='pending_payment' and s.hold_expires_at <= now() and (target_program_id is null or s.program_id=target_program_id);
  get diagnostics released = row_count;
  return released;
end $$;

create or replace function public.claim_founding_seat(
  target_seat_id uuid, claim_business_name text, claim_contact_name text, claim_email text,
  claim_phone text, claim_website text, claim_industry text, claim_city text,
  claim_description text, claim_terms_version text, claim_payment_provider text
) returns uuid language plpgsql security definer set search_path='' as $$
declare seat public.founding_seats%rowtype; program public.founding_programs%rowtype; claim_id uuid; expiry timestamptz;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into seat from public.founding_seats where id=target_seat_id for update;
  if not found then raise exception 'seat not found'; end if;
  select * into program from public.founding_programs where id=seat.program_id and status='active';
  if not found then raise exception 'program is not accepting claims'; end if;
  if seat.status='pending_payment' and seat.hold_expires_at <= now() then
    update public.founding_claims set status='expired',updated_at=now() where seat_id=seat.id and status in ('pending_payment','payment_submitted','awaiting_verification');
    seat.status := 'available';
  end if;
  if seat.status <> 'available' then raise exception 'seat is not available'; end if;
  expiry := now() + make_interval(mins => program.hold_minutes);
  insert into public.founding_claims (seat_id,user_id,business_name,contact_name,email,phone,website,industry,city,business_description,terms_version,terms_accepted_at,status,payment_provider,payment_amount_cents,expires_at)
  values (seat.id,auth.uid(),trim(claim_business_name),trim(claim_contact_name),lower(trim(claim_email)),trim(claim_phone),nullif(trim(claim_website),''),trim(claim_industry),trim(claim_city),trim(claim_description),claim_terms_version,now(),'pending_payment',claim_payment_provider,program.price_cents,expiry)
  returning id into claim_id;
  update public.founding_seats set status='pending_payment',hold_expires_at=expiry,updated_at=now() where id=seat.id;
  insert into public.audit_events (actor_user_id,action,entity_type,entity_id,metadata) values (auth.uid(),'founding_fifty.claim_created','founding_claim',claim_id,jsonb_build_object('seat_number',seat.seat_number));
  return claim_id;
end $$;

create or replace function public.confirm_founding_claim(target_claim_id uuid, target_payment_reference text, confirmation_source text default 'manual_admin')
returns uuid language plpgsql security definer set search_path='' as $$
declare claim public.founding_claims%rowtype; seat public.founding_seats%rowtype; vendor_org uuid; premium_level uuid; founding_badge uuid; actor uuid := auth.uid();
begin
  if not (public.is_super_admin() or coalesce(auth.jwt()->>'role','')='service_role') then raise exception 'super admin required'; end if;
  select * into claim from public.founding_claims where id=target_claim_id for update;
  if not found then raise exception 'claim not found'; end if;
  if claim.status='confirmed' then return claim.vendor_id; end if;
  if claim.status not in ('pending_payment','payment_submitted','awaiting_verification') then raise exception 'claim cannot be confirmed from current status'; end if;
  select * into seat from public.founding_seats where id=claim.seat_id for update;
  if seat.status <> 'pending_payment' then raise exception 'seat is no longer held'; end if;
  vendor_org := claim.vendor_id;
  if vendor_org is null then
    insert into public.organizations (type,name,slug)
    values ('vendor',claim.business_name,'founding-'||replace(claim.id::text,'-','')) returning id into vendor_org;
    insert into public.vendor_profiles (organization_id,description) values (vendor_org,claim.business_description);
    insert into public.organization_members (organization_id,user_id,role,status) values (vendor_org,claim.user_id,'owner','active') on conflict (organization_id,user_id) do update set status='active';
  end if;
  select id into premium_level from public.vendor_membership_levels where code='premium';
  select id into founding_badge from public.vendor_badges where code='founding_fifty';
  update public.vendor_memberships set status='expired',current_period_ends_at=coalesce(current_period_ends_at,now()) where vendor_organization_id=vendor_org and status in ('trialing','active','past_due','paused');
  insert into public.vendor_memberships (vendor_organization_id,membership_level_id,status,starts_at,current_period_ends_at,external_subscription_id)
  values (vendor_org,premium_level,'active',now(),now()+interval '12 months','founding-fifty:'||claim.id);
  insert into public.vendor_badge_awards (vendor_organization_id,vendor_badge_id,awarded_by,reason)
  values (vendor_org,founding_badge,actor,'Permanent Founding Fifty member #'||lpad(seat.seat_number::text,3,'0'));
  update public.founding_claims set status='confirmed',vendor_id=vendor_org,payment_reference=coalesce(target_payment_reference,payment_reference),confirmed_at=now(),updated_at=now(),metadata=metadata||jsonb_build_object('confirmation_source',confirmation_source) where id=claim.id;
  update public.founding_seats set status='claimed',vendor_id=vendor_org,reserved_business_name=null,display_business_name=claim.business_name,display_city=claim.city,logo_url=claim.logo_url,hold_expires_at=null,claimed_at=now(),updated_at=now() where id=seat.id;
  insert into public.founding_member_benefits (seat_id,benefit_id,start_at,end_at,status)
  select seat.id,b.id,now(),case when b.name='12 Months Premium' then now()+interval '12 months' else null end,'active' from public.founding_benefits b where b.program_id=seat.program_id on conflict (seat_id,benefit_id) do nothing;
  insert into public.outbox_events (organization_id,topic,payload) values (vendor_org,'founding_fifty.claim_confirmed',jsonb_build_object('claim_id',claim.id,'seat_number',seat.seat_number,'email',claim.email));
  insert into public.audit_events (organization_id,actor_user_id,action,entity_type,entity_id,metadata) values (vendor_org,actor,'founding_fifty.claim_confirmed','founding_claim',claim.id,jsonb_build_object('seat_number',seat.seat_number,'source',confirmation_source));
  return vendor_org;
end $$;

create or replace function public.admin_update_founding_seat(target_seat_id uuid,target_action text,target_business_name text default null,target_claim_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare seat public.founding_seats%rowtype;
begin
  if not public.is_super_admin() then raise exception 'super admin required'; end if;
  select * into seat from public.founding_seats where id=target_seat_id for update;
  if not found then raise exception 'seat not found'; end if;
  if target_action='reserve' and seat.status='available' then update public.founding_seats set status='reserved',reserved_business_name=trim(target_business_name),updated_at=now() where id=seat.id;
  elsif target_action='release' and seat.status='reserved' then update public.founding_seats set status='available',reserved_business_name=null,updated_at=now() where id=seat.id;
  elsif target_action='disable' and seat.status='available' then update public.founding_seats set status='disabled',updated_at=now() where id=seat.id;
  elsif target_action='enable' and seat.status='disabled' then update public.founding_seats set status='available',updated_at=now() where id=seat.id;
  elsif target_action='reject_claim' and target_claim_id is not null and seat.status='pending_payment' then
    update public.founding_claims set status='rejected',rejected_at=now(),updated_at=now() where id=target_claim_id and seat_id=seat.id and status in ('pending_payment','payment_submitted','awaiting_verification');
    update public.founding_seats set status='available',hold_expires_at=null,updated_at=now() where id=seat.id;
  else raise exception 'action is not valid for current seat status'; end if;
  insert into public.audit_events (actor_user_id,action,entity_type,entity_id,metadata) values (auth.uid(),'founding_fifty.admin_'||target_action,'founding_seat',seat.id,jsonb_build_object('seat_number',seat.seat_number));
end $$;

create or replace function public.record_founding_payment_outcome(target_claim_id uuid,target_status text,target_payment_reference text default null)
returns void language plpgsql security definer set search_path='' as $$
declare claim public.founding_claims%rowtype;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'service role required'; end if;
  if target_status not in ('payment_failed','payment_cancelled') then raise exception 'invalid payment outcome'; end if;
  select * into claim from public.founding_claims where id=target_claim_id for update;
  if not found then raise exception 'claim not found'; end if;
  if claim.status='confirmed' then return; end if;
  update public.founding_claims set status=target_status,payment_reference=coalesce(target_payment_reference,payment_reference),updated_at=now() where id=claim.id;
  update public.founding_seats set status='available',hold_expires_at=null,updated_at=now() where id=claim.seat_id and status='pending_payment';
end $$;

create or replace function public.admin_reassign_founding_seat(target_seat_id uuid,target_vendor_id uuid,confirmation_phrase text)
returns void language plpgsql security definer set search_path='' as $$
declare seat public.founding_seats%rowtype;
begin
  if not public.is_super_admin() then raise exception 'super admin required'; end if;
  if confirmation_phrase <> 'REASSIGN PERMANENT FOUNDING NUMBER' then raise exception 'explicit reassignment confirmation required'; end if;
  select * into seat from public.founding_seats where id=target_seat_id for update;
  if not found or seat.status <> 'claimed' then raise exception 'only a claimed seat can be reassigned'; end if;
  if not exists(select 1 from public.vendor_profiles where organization_id=target_vendor_id) then raise exception 'target vendor not found'; end if;
  update public.founding_seats set vendor_id=target_vendor_id,updated_at=now() where id=seat.id;
  insert into public.audit_events (organization_id,actor_user_id,action,entity_type,entity_id,metadata)
  values (target_vendor_id,auth.uid(),'founding_fifty.permanent_number_reassigned','founding_seat',seat.id,jsonb_build_object('seat_number',seat.seat_number,'previous_vendor_id',seat.vendor_id,'new_vendor_id',target_vendor_id));
end $$;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('founding-fifty-logos','founding-fifty-logos',true,5000000,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "founding_fifty_logos_public_read" on storage.objects for select to anon,authenticated using (bucket_id='founding-fifty-logos');
create policy "founding_fifty_logos_insert_own" on storage.objects for insert to authenticated with check (bucket_id='founding-fifty-logos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "founding_fifty_logos_update_own" on storage.objects for update to authenticated using (bucket_id='founding-fifty-logos' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_super_admin())) with check (bucket_id='founding-fifty-logos' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_super_admin()));
create policy "founding_fifty_logos_delete_admin" on storage.objects for delete to authenticated using (bucket_id='founding-fifty-logos' and public.is_super_admin());

alter table public.founding_programs enable row level security;
alter table public.founding_verticals enable row level security;
alter table public.founding_seats enable row level security;
alter table public.founding_claims enable row level security;
alter table public.founding_benefits enable row level security;
alter table public.founding_member_benefits enable row level security;
alter table public.founding_payment_events enable row level security;

create policy "founding_programs_public_read" on public.founding_programs for select to anon,authenticated using (status in ('active','completed') or public.is_super_admin());
create policy "founding_verticals_public_read" on public.founding_verticals for select to anon,authenticated using (active or public.is_super_admin());
create policy "founding_seats_public_read" on public.founding_seats for select to anon,authenticated using (true);
create policy "founding_benefits_public_read" on public.founding_benefits for select to anon,authenticated using (active or public.is_super_admin());
create policy "founding_claims_read_own" on public.founding_claims for select to authenticated using (user_id=auth.uid() or public.is_super_admin());
create policy "founding_claims_update_own_logo" on public.founding_claims for update to authenticated using (user_id=auth.uid() and status in ('pending_payment','payment_submitted','awaiting_verification')) with check (user_id=auth.uid());
create policy "founding_claims_admin_all" on public.founding_claims for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "founding_member_benefits_read_member" on public.founding_member_benefits for select to authenticated using (exists(select 1 from public.founding_seats s where s.id=seat_id and (public.is_organization_member(s.vendor_id) or public.is_super_admin())));
create policy "founding_payment_events_admin" on public.founding_payment_events for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "founding_configuration_admin_programs" on public.founding_programs for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "founding_configuration_admin_verticals" on public.founding_verticals for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "founding_configuration_admin_seats" on public.founding_seats for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "founding_configuration_admin_benefits" on public.founding_benefits for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

grant select on public.founding_programs,public.founding_verticals,public.founding_seats,public.founding_benefits to anon,authenticated;
grant insert,update,delete on public.founding_programs,public.founding_verticals,public.founding_seats,public.founding_benefits to authenticated;
grant select,update on public.founding_claims to authenticated;
grant select on public.founding_member_benefits to authenticated;
grant all on public.founding_programs,public.founding_verticals,public.founding_seats,public.founding_claims,public.founding_benefits,public.founding_member_benefits,public.founding_payment_events to service_role;
grant execute on function public.release_expired_founding_holds(uuid) to anon,authenticated,service_role;
grant execute on function public.claim_founding_seat(uuid,text,text,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.confirm_founding_claim(uuid,text,text) to authenticated,service_role;
grant execute on function public.admin_update_founding_seat(uuid,text,text,uuid) to authenticated;
grant execute on function public.record_founding_payment_outcome(uuid,text,text) to service_role;
grant execute on function public.admin_reassign_founding_seat(uuid,uuid,text) to authenticated;

comment on table public.founding_programs is 'Versioned founding-member programs with governed seat counts, price, currency, market, and hold duration.';
comment on table public.founding_verticals is 'The 25 public industry categories available within a founding program.';
comment on table public.founding_seats is 'The authoritative permanent founding-number registry; claimed numbers are never reassigned outside explicit Super Admin workflows.';
comment on table public.founding_claims is 'Immutable claim history including abandoned, expired, failed, cancelled, rejected, and confirmed payment outcomes.';
comment on table public.founding_payment_events is 'Idempotent verified payment webhook event ledger.';

commit;
