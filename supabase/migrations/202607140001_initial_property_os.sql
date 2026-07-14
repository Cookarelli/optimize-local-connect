begin;

create extension if not exists "pgcrypto";

create type public.organization_type as enum ('property_management', 'vendor');
create type public.membership_role as enum ('owner', 'admin', 'property_manager', 'vendor', 'technician', 'future_resident');
create type public.membership_status as enum ('invited', 'active', 'suspended');
create type public.property_status as enum ('active', 'inactive', 'onboarding');
create type public.request_priority as enum ('routine', 'soon', 'urgent', 'emergency');
create type public.request_status as enum ('draft', 'open', 'matching', 'quoted', 'awarded', 'in_progress', 'completed', 'cancelled');
create type public.bid_status as enum ('submitted', 'withdrawn', 'accepted', 'declined');
create type public.work_order_status as enum ('scheduled', 'en_route', 'on_site', 'blocked', 'completed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  phone text,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.markets (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  city text not null,
  state_code text not null check (char_length(state_code) = 2),
  country_code text not null default 'US' check (char_length(country_code) = 2),
  timezone text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  type public.organization_type not null,
  name text not null check (char_length(name) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  legal_name text,
  website_url text,
  phone text,
  status text not null default 'active' check (status in ('active', 'suspended', 'onboarding')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_markets (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (organization_id, market_id)
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.membership_role not null,
  status public.membership_status not null default 'invited',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 160),
  address_line_1 text not null,
  address_line_2 text,
  city text not null,
  state_code text not null check (char_length(state_code) = 2),
  postal_code text not null,
  unit_count integer not null default 1 check (unit_count > 0),
  status public.property_status not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.vendor_profiles (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  description text,
  years_in_business integer check (years_in_business >= 0),
  license_number text,
  insurance_expires_on date,
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected', 'expired')),
  verified_at timestamptz,
  average_rating numeric(3,2) check (average_rating between 0 and 5),
  completed_job_count integer not null default 0 check (completed_job_count >= 0),
  response_time_minutes integer check (response_time_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vendor_trades (
  vendor_organization_id uuid not null references public.vendor_profiles(organization_id) on delete cascade,
  trade_id uuid not null references public.trades(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (vendor_organization_id, trade_id)
);

create table public.organization_vendor_relationships (
  id uuid primary key default gen_random_uuid(),
  property_organization_id uuid not null references public.organizations(id) on delete cascade,
  vendor_organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'active', 'paused', 'blocked')),
  preferred boolean not null default false,
  private_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_organization_id, vendor_organization_id),
  check (property_organization_id <> vendor_organization_id)
);

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete restrict,
  trade_id uuid references public.trades(id) on delete set null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 4 and 180),
  description text not null check (char_length(description) between 10 and 5000),
  location_detail text,
  priority public.request_priority not null default 'routine',
  status public.request_status not null default 'draft',
  desired_by timestamptz,
  published_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bids (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  vendor_organization_id uuid not null references public.organizations(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'USD' check (char_length(currency) = 3),
  scope text not null check (char_length(scope) between 10 and 5000),
  earliest_start_at timestamptz,
  estimated_completion_at timestamptz,
  status public.bid_status not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_request_id, vendor_organization_id)
);

create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null unique references public.service_requests(id) on delete restrict,
  bid_id uuid unique references public.bids(id) on delete restrict,
  property_organization_id uuid not null references public.organizations(id) on delete restrict,
  vendor_organization_id uuid not null references public.organizations(id) on delete restrict,
  assigned_technician_id uuid references auth.users(id) on delete set null,
  status public.work_order_status not null default 'scheduled',
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  completion_notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  topic text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'processed', 'failed')),
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index organization_members_user_idx on public.organization_members (user_id, status);
create index organization_markets_market_idx on public.organization_markets (market_id, organization_id);
create index properties_org_status_idx on public.properties (organization_id, status);
create index properties_market_idx on public.properties (market_id);
create index vendor_profiles_verification_idx on public.vendor_profiles (verification_status);
create index service_requests_org_status_idx on public.service_requests (organization_id, status, created_at desc);
create index service_requests_property_idx on public.service_requests (property_id, created_at desc);
create index service_requests_trade_published_idx on public.service_requests (trade_id, published_at) where published_at is not null;
create index bids_request_status_idx on public.bids (service_request_id, status);
create index bids_vendor_idx on public.bids (vendor_organization_id, created_at desc);
create index work_orders_property_org_idx on public.work_orders (property_organization_id, status);
create index work_orders_vendor_org_idx on public.work_orders (vendor_organization_id, status);
create index work_orders_technician_idx on public.work_orders (assigned_technician_id, status);
create index audit_events_org_time_idx on public.audit_events (organization_id, occurred_at desc);
create index outbox_pending_idx on public.outbox_events (available_at) where status in ('pending', 'failed');

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_super_admin from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_organization_id and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

create or replace function public.has_organization_role(target_organization_id uuid, allowed_roles public.membership_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_super_admin() or exists (
    select 1 from public.organization_members m
    where m.organization_id = target_organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any(allowed_roles)
  );
$$;

create or replace function public.shares_organization_with(target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid() and mine.status = 'active'
      and theirs.user_id = target_user_id and theirs.status = 'active'
  );
$$;

create or replace function public.user_has_vendor_bid(target_request_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.bids b
    join public.organization_members m on m.organization_id = b.vendor_organization_id
    where b.service_request_id = target_request_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','markets','organizations','organization_members','properties','vendor_profiles','organization_vendor_relationships','service_requests','bids','work_orders']
  loop
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.markets enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_markets enable row level security;
alter table public.organization_members enable row level security;
alter table public.properties enable row level security;
alter table public.trades enable row level security;
alter table public.vendor_profiles enable row level security;
alter table public.vendor_trades enable row level security;
alter table public.organization_vendor_relationships enable row level security;
alter table public.service_requests enable row level security;
alter table public.bids enable row level security;
alter table public.work_orders enable row level security;
alter table public.audit_events enable row level security;
alter table public.outbox_events enable row level security;

create policy "profiles_read_authorized" on public.profiles for select to authenticated using (id = auth.uid() or public.is_super_admin() or public.shares_organization_with(id));
create policy "profiles_update_self" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and is_super_admin = false);

create policy "markets_read_authenticated" on public.markets for select to authenticated using (true);
create policy "markets_manage_super_admin" on public.markets for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "trades_read_authenticated" on public.trades for select to authenticated using (true);
create policy "trades_manage_super_admin" on public.trades for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy "organizations_read_members" on public.organizations for select to authenticated using (public.is_organization_member(id) or public.is_super_admin());
create policy "organizations_read_verified_vendors" on public.organizations for select to authenticated using (type = 'vendor' and exists (select 1 from public.vendor_profiles vp where vp.organization_id = id and vp.verification_status = 'verified'));
create policy "organizations_update_admins" on public.organizations for update to authenticated using (public.has_organization_role(id, array['owner','admin']::public.membership_role[])) with check (public.has_organization_role(id, array['owner','admin']::public.membership_role[]));
create policy "organizations_create_super_admin" on public.organizations for insert to authenticated with check (public.is_super_admin());

create policy "organization_markets_read_members" on public.organization_markets for select to authenticated using (public.is_organization_member(organization_id) or public.is_super_admin());
create policy "organization_markets_manage_admins" on public.organization_markets for all to authenticated using (public.has_organization_role(organization_id, array['owner','admin']::public.membership_role[])) with check (public.has_organization_role(organization_id, array['owner','admin']::public.membership_role[]));

create policy "memberships_read_organization" on public.organization_members for select to authenticated using (user_id = auth.uid() or public.is_organization_member(organization_id) or public.is_super_admin());
create policy "memberships_manage_admins" on public.organization_members for all to authenticated using (public.has_organization_role(organization_id, array['owner','admin']::public.membership_role[])) with check (public.has_organization_role(organization_id, array['owner','admin']::public.membership_role[]));

create policy "properties_read_members" on public.properties for select to authenticated using (public.is_organization_member(organization_id) or public.is_super_admin());
create policy "properties_create_managers" on public.properties for insert to authenticated with check (public.has_organization_role(organization_id, array['owner','admin','property_manager']::public.membership_role[]));
create policy "properties_update_managers" on public.properties for update to authenticated using (public.has_organization_role(organization_id, array['owner','admin','property_manager']::public.membership_role[])) with check (public.has_organization_role(organization_id, array['owner','admin','property_manager']::public.membership_role[]));
create policy "properties_delete_admins" on public.properties for delete to authenticated using (public.has_organization_role(organization_id, array['owner','admin']::public.membership_role[]));

create policy "vendor_profiles_read_authenticated" on public.vendor_profiles for select to authenticated using (true);
create policy "vendor_profiles_manage_vendor" on public.vendor_profiles for all to authenticated using (public.has_organization_role(organization_id, array['owner','admin','vendor']::public.membership_role[])) with check (public.has_organization_role(organization_id, array['owner','admin','vendor']::public.membership_role[]));
create policy "vendor_trades_read_authenticated" on public.vendor_trades for select to authenticated using (true);
create policy "vendor_trades_manage_vendor" on public.vendor_trades for all to authenticated using (public.has_organization_role(vendor_organization_id, array['owner','admin','vendor']::public.membership_role[])) with check (public.has_organization_role(vendor_organization_id, array['owner','admin','vendor']::public.membership_role[]));

create policy "vendor_relationships_read_parties" on public.organization_vendor_relationships for select to authenticated using (public.is_organization_member(property_organization_id) or public.is_organization_member(vendor_organization_id) or public.is_super_admin());
create policy "vendor_relationships_manage_property_admins" on public.organization_vendor_relationships for all to authenticated using (public.has_organization_role(property_organization_id, array['owner','admin','property_manager']::public.membership_role[])) with check (public.has_organization_role(property_organization_id, array['owner','admin','property_manager']::public.membership_role[]));

create policy "requests_read_authorized" on public.service_requests for select to authenticated using (
  public.is_organization_member(organization_id)
  or public.is_super_admin()
  or public.user_has_vendor_bid(id)
  or (published_at is not null and status in ('open','matching','quoted') and exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id = m.organization_id and o.type = 'vendor'
    join public.organization_markets om on om.organization_id = o.id
    join public.properties p on p.id = property_id and p.market_id = om.market_id
    join public.vendor_trades vt on vt.vendor_organization_id = o.id and vt.trade_id = service_requests.trade_id
    where m.user_id = auth.uid() and m.status = 'active'
  ))
);
create policy "requests_create_managers" on public.service_requests for insert to authenticated with check (requested_by = auth.uid() and public.has_organization_role(organization_id, array['owner','admin','property_manager']::public.membership_role[]));
create policy "requests_update_managers" on public.service_requests for update to authenticated using (public.has_organization_role(organization_id, array['owner','admin','property_manager']::public.membership_role[])) with check (public.has_organization_role(organization_id, array['owner','admin','property_manager']::public.membership_role[]));

create policy "bids_read_parties" on public.bids for select to authenticated using (public.is_organization_member(vendor_organization_id) or public.is_super_admin() or exists (select 1 from public.service_requests r where r.id = service_request_id and public.is_organization_member(r.organization_id)));
create policy "bids_create_vendor" on public.bids for insert to authenticated with check (submitted_by = auth.uid() and public.has_organization_role(vendor_organization_id, array['owner','admin','vendor']::public.membership_role[]));
create policy "bids_update_vendor" on public.bids for update to authenticated using (public.has_organization_role(vendor_organization_id, array['owner','admin','vendor']::public.membership_role[])) with check (public.has_organization_role(vendor_organization_id, array['owner','admin','vendor']::public.membership_role[]));

create policy "work_orders_read_parties" on public.work_orders for select to authenticated using (public.is_organization_member(property_organization_id) or public.is_organization_member(vendor_organization_id) or assigned_technician_id = auth.uid() or public.is_super_admin());
create policy "work_orders_manage_property" on public.work_orders for insert to authenticated with check (public.has_organization_role(property_organization_id, array['owner','admin','property_manager']::public.membership_role[]));
create policy "work_orders_update_parties" on public.work_orders for update to authenticated using (public.has_organization_role(property_organization_id, array['owner','admin','property_manager']::public.membership_role[]) or public.has_organization_role(vendor_organization_id, array['owner','admin','vendor']::public.membership_role[]) or assigned_technician_id = auth.uid()) with check (public.is_organization_member(property_organization_id) or public.is_organization_member(vendor_organization_id));

create policy "audit_events_read_admins" on public.audit_events for select to authenticated using (public.has_organization_role(organization_id, array['owner','admin']::public.membership_role[]) or public.is_super_admin());
create policy "audit_events_insert_members" on public.audit_events for insert to authenticated with check (actor_user_id = auth.uid() and (organization_id is null or public.is_organization_member(organization_id)));
create policy "outbox_events_super_admin_only" on public.outbox_events for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.has_organization_role(uuid, public.membership_role[]) to authenticated;
grant execute on function public.shares_organization_with(uuid) to authenticated;
grant execute on function public.user_has_vendor_bid(uuid) to authenticated;

insert into public.trades (slug, name) values
  ('appliance-repair', 'Appliance Repair'),
  ('electrical', 'Electrical'),
  ('general-maintenance', 'General Maintenance'),
  ('hvac', 'HVAC'),
  ('landscaping', 'Landscaping'),
  ('locksmith', 'Locksmith'),
  ('pest-control', 'Pest Control'),
  ('plumbing', 'Plumbing'),
  ('restoration', 'Restoration'),
  ('roofing', 'Roofing')
on conflict (slug) do nothing;

commit;
