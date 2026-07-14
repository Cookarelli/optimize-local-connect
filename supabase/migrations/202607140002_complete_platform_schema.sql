begin;

-- ---------------------------------------------------------------------------
-- Canonical vocabulary and geographic normalization
-- ---------------------------------------------------------------------------

alter type public.bid_status rename to quote_status;
alter table public.trades rename to vendor_categories;
alter table public.vendor_trades rename to vendor_category_assignments;
alter table public.vendor_category_assignments rename column trade_id to vendor_category_id;
alter table public.service_requests rename column trade_id to vendor_category_id;
alter table public.bids rename to quotes;
alter table public.work_orders rename column bid_id to quote_id;
alter index public.bids_request_status_idx rename to quotes_request_status_idx;
alter index public.bids_vendor_idx rename to quotes_vendor_idx;
alter index public.service_requests_trade_published_idx rename to service_requests_category_published_idx;

alter function public.user_has_vendor_bid(uuid) rename to user_has_vendor_quote;

drop policy if exists "requests_read_authorized" on public.service_requests;
create policy "requests_read_authorized" on public.service_requests
for select to authenticated using (
  public.is_organization_member(organization_id)
  or public.is_super_admin()
  or public.user_has_vendor_quote(id)
  or (
    published_at is not null
    and status in ('open','matching','quoted')
    and exists (
      select 1
      from public.organization_members m
      join public.organizations o on o.id = m.organization_id and o.type = 'vendor'
      join public.organization_markets om on om.organization_id = o.id
      join public.properties p on p.id = property_id and p.market_id = om.market_id
      join public.vendor_category_assignments vca
        on vca.vendor_organization_id = o.id
       and vca.vendor_category_id = service_requests.vendor_category_id
      where m.user_id = auth.uid() and m.status = 'active'
    )
  )
);

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  state_code text not null check (char_length(state_code) between 1 and 8),
  country_code text not null default 'US' check (char_length(country_code) = 2),
  timezone text not null,
  latitude numeric(9,6),
  longitude numeric(9,6),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_code, state_code, slug),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180)
);

insert into public.cities (slug, name, state_code, country_code, timezone)
select distinct
  trim(both '-' from lower(regexp_replace(trim(m.city), '[^a-zA-Z0-9]+', '-', 'g'))),
  m.city,
  m.state_code,
  m.country_code,
  m.timezone
from public.markets m
on conflict (country_code, state_code, slug) do nothing;

alter table public.markets add column name text;
update public.markets set name = city where name is null;
alter table public.markets alter column name set not null;
alter table public.markets add constraint markets_name_length check (char_length(name) between 1 and 160);

create table public.market_cities (
  market_id uuid not null references public.markets(id) on delete cascade,
  city_id uuid not null references public.cities(id) on delete restrict,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (market_id, city_id)
);

insert into public.market_cities (market_id, city_id, is_primary)
select m.id, c.id, true
from public.markets m
join public.cities c
  on c.name = m.city
 and c.state_code = m.state_code
 and c.country_code = m.country_code
on conflict (market_id, city_id) do nothing;

create unique index market_cities_one_primary_idx
on public.market_cities (market_id) where is_primary;
create index market_cities_city_idx on public.market_cities (city_id, market_id);

alter table public.properties add column city_id uuid references public.cities(id) on delete restrict;

insert into public.cities (slug, name, state_code, country_code, timezone)
select distinct
  trim(both '-' from lower(regexp_replace(trim(p.city), '[^a-zA-Z0-9]+', '-', 'g'))),
  p.city,
  p.state_code,
  coalesce(m.country_code, 'US'),
  coalesce(m.timezone, 'America/Chicago')
from public.properties p
join public.markets m on m.id = p.market_id
where p.city_id is null
on conflict (country_code, state_code, slug) do nothing;

update public.properties p
set city_id = c.id
from public.markets m, public.cities c
where p.market_id = m.id
  and p.city_id is null
  and c.name = p.city
  and c.state_code = p.state_code
  and c.country_code = m.country_code;

insert into public.market_cities (market_id, city_id, is_primary)
select distinct p.market_id, p.city_id, false
from public.properties p
where p.city_id is not null
on conflict (market_id, city_id) do nothing;

insert into public.organization_markets (organization_id, market_id)
select distinct p.organization_id, p.market_id
from public.properties p
on conflict (organization_id, market_id) do nothing;

alter table public.properties alter column city_id set not null;
alter table public.properties add constraint properties_market_city_fk
  foreign key (market_id, city_id) references public.market_cities(market_id, city_id) on delete restrict;
alter table public.properties add constraint properties_organization_market_fk
  foreign key (organization_id, market_id) references public.organization_markets(organization_id, market_id) on delete restrict;
create index properties_city_idx on public.properties (city_id, organization_id);

alter table public.markets drop column city;
alter table public.markets drop column state_code;
alter table public.markets drop column country_code;
alter table public.markets drop column timezone;
alter table public.properties drop column city;
alter table public.properties drop column state_code;

-- ---------------------------------------------------------------------------
-- Supporting enums
-- ---------------------------------------------------------------------------

create type public.verification_status as enum ('pending', 'in_review', 'verified', 'rejected', 'expired');
create type public.verification_type as enum ('identity', 'business_registration', 'trade_license', 'insurance', 'background_check', 'tax_document', 'bank_account');
create type public.review_status as enum ('pending', 'published', 'hidden', 'disputed');
create type public.invoice_status as enum ('draft', 'issued', 'partially_paid', 'paid', 'void', 'overdue');
create type public.payment_status as enum ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded');
create type public.notification_channel as enum ('in_app', 'email', 'sms', 'push');
create type public.notification_status as enum ('queued', 'sent', 'delivered', 'read', 'failed', 'cancelled');
create type public.conversation_type as enum ('direct', 'request', 'work_order', 'support');
create type public.warranty_claim_status as enum ('draft', 'submitted', 'reviewing', 'approved', 'denied', 'scheduled', 'completed', 'cancelled');
create type public.appliance_status as enum ('active', 'out_of_service', 'retired', 'replaced');
create type public.ai_actor_type as enum ('user', 'assistant', 'system', 'tool');
create type public.ai_run_status as enum ('queued', 'running', 'requires_approval', 'succeeded', 'failed', 'cancelled');

-- ---------------------------------------------------------------------------
-- Users, managers, vendor catalog, membership, badges, and verification
-- ---------------------------------------------------------------------------

create table public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  locale text not null default 'en-US',
  timezone text,
  email_notifications boolean not null default true,
  sms_notifications boolean not null default false,
  push_notifications boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.property_manager_profiles (
  membership_id uuid primary key references public.organization_members(id) on delete cascade,
  employee_code text,
  title text,
  license_number text,
  license_state_code text,
  emergency_contact_phone text,
  is_on_call boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.property_manager_assignments (
  property_id uuid not null references public.properties(id) on delete cascade,
  membership_id uuid not null references public.property_manager_profiles(membership_id) on delete cascade,
  is_primary boolean not null default false,
  starts_on date not null default current_date,
  ends_on date,
  created_at timestamptz not null default now(),
  primary key (property_id, membership_id),
  check (ends_on is null or ends_on >= starts_on)
);

create unique index property_manager_assignments_primary_idx
on public.property_manager_assignments (property_id)
where is_primary and ends_on is null;
create index property_manager_assignments_member_idx
on public.property_manager_assignments (membership_id, starts_on desc);

alter table public.vendor_categories add column description text;
alter table public.vendor_categories add column icon_key text;
alter table public.vendor_categories add column sort_order integer not null default 0;

create table public.vendor_services (
  id uuid primary key default gen_random_uuid(),
  vendor_category_id uuid not null references public.vendor_categories(id) on delete restrict,
  slug text not null,
  name text not null check (char_length(name) between 2 and 160),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vendor_category_id, slug)
);

create table public.vendor_service_offerings (
  vendor_organization_id uuid not null references public.vendor_profiles(organization_id) on delete cascade,
  vendor_service_id uuid not null references public.vendor_services(id) on delete cascade,
  base_price_cents integer check (base_price_cents is null or base_price_cents >= 0),
  currency text not null default 'USD' check (char_length(currency) = 3),
  minimum_charge_cents integer check (minimum_charge_cents is null or minimum_charge_cents >= 0),
  emergency_available boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (vendor_organization_id, vendor_service_id)
);

create table public.vendor_service_cities (
  vendor_organization_id uuid not null references public.vendor_profiles(organization_id) on delete cascade,
  city_id uuid not null references public.cities(id) on delete cascade,
  travel_fee_cents integer check (travel_fee_cents is null or travel_fee_cents >= 0),
  emergency_available boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (vendor_organization_id, city_id)
);

create index vendor_services_category_idx on public.vendor_services (vendor_category_id, is_active, name);
create index vendor_service_offerings_service_idx on public.vendor_service_offerings (vendor_service_id, is_active, vendor_organization_id);
create index vendor_service_cities_city_idx on public.vendor_service_cities (city_id, is_active, vendor_organization_id);

create table public.vendor_membership_levels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name text not null unique,
  description text,
  rank integer not null unique check (rank >= 0),
  monthly_price_cents integer not null default 0 check (monthly_price_cents >= 0),
  annual_price_cents integer not null default 0 check (annual_price_cents >= 0),
  quote_limit_per_month integer check (quote_limit_per_month is null or quote_limit_per_month >= 0),
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vendor_memberships (
  id uuid primary key default gen_random_uuid(),
  vendor_organization_id uuid not null references public.vendor_profiles(organization_id) on delete cascade,
  membership_level_id uuid not null references public.vendor_membership_levels(id) on delete restrict,
  status text not null check (status in ('trialing', 'active', 'past_due', 'paused', 'cancelled', 'expired')),
  starts_at timestamptz not null,
  current_period_ends_at timestamptz,
  cancelled_at timestamptz,
  external_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_ends_at is null or current_period_ends_at > starts_at)
);

create unique index vendor_memberships_current_idx
on public.vendor_memberships (vendor_organization_id)
where status in ('trialing', 'active', 'past_due', 'paused');

create table public.vendor_badges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name text not null unique,
  description text not null,
  icon_key text,
  color_key text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vendor_badge_awards (
  id uuid primary key default gen_random_uuid(),
  vendor_organization_id uuid not null references public.vendor_profiles(organization_id) on delete cascade,
  vendor_badge_id uuid not null references public.vendor_badges(id) on delete cascade,
  awarded_by uuid references public.profiles(id) on delete set null,
  reason text,
  awarded_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (vendor_organization_id, vendor_badge_id, awarded_at),
  check (expires_at is null or expires_at > awarded_at),
  check (revoked_at is null or revoked_at >= awarded_at)
);

create index vendor_badge_awards_vendor_active_idx
on public.vendor_badge_awards (vendor_organization_id, awarded_at desc)
where revoked_at is null;

-- Files are immutable storage metadata. Bytes live in Supabase Storage.
create table public.files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  bucket text not null,
  object_path text not null,
  original_filename text not null,
  content_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  visibility text not null default 'private' check (visibility in ('private', 'organization', 'participants', 'public')),
  scan_status text not null default 'pending' check (scan_status in ('pending', 'clean', 'quarantined', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (bucket, object_path)
);

create index files_org_created_idx on public.files (organization_id, created_at desc) where deleted_at is null;
create index files_uploader_idx on public.files (uploaded_by, created_at desc);

create table public.vendor_verifications (
  id uuid primary key default gen_random_uuid(),
  vendor_organization_id uuid not null references public.vendor_profiles(organization_id) on delete cascade,
  verification_type public.verification_type not null,
  status public.verification_status not null default 'pending',
  submitted_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reference_number text,
  issuing_authority text,
  issued_on date,
  expires_on date,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  review_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_on is null or issued_on is null or expires_on >= issued_on),
  check (reviewed_at is null or reviewed_at >= submitted_at)
);

create table public.vendor_verification_files (
  vendor_verification_id uuid not null references public.vendor_verifications(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (vendor_verification_id, file_id)
);

create index vendor_verifications_vendor_status_idx
on public.vendor_verifications (vendor_organization_id, status, verification_type);
create index vendor_verifications_expiry_idx
on public.vendor_verifications (expires_on)
where status = 'verified' and expires_on is not null;

-- ---------------------------------------------------------------------------
-- Requests, vertical request details, quotes, work orders, reviews
-- ---------------------------------------------------------------------------

alter table public.service_requests add column request_number bigint generated always as identity;
alter table public.service_requests add column vendor_service_id uuid references public.vendor_services(id) on delete set null;
alter table public.service_requests add column assigned_vendor_organization_id uuid references public.vendor_profiles(organization_id) on delete set null;
alter table public.service_requests add column source text not null default 'web' check (source in ('web', 'mobile', 'email', 'sms', 'phone', 'api', 'ai'));
alter table public.service_requests add column access_instructions text;
alter table public.service_requests add column budget_cents integer check (budget_cents is null or budget_cents >= 0);
alter table public.service_requests add constraint service_requests_number_unique unique (request_number);
create index service_requests_assigned_vendor_idx on public.service_requests (assigned_vendor_organization_id, status, created_at desc);
create index service_requests_service_idx on public.service_requests (vendor_service_id, status, created_at desc);

create table public.cleaning_requests (
  service_request_id uuid primary key references public.service_requests(id) on delete cascade,
  cleaning_type text not null check (cleaning_type in ('turnover', 'common_area', 'deep_clean', 'routine', 'post_construction', 'biohazard', 'other')),
  estimated_square_feet integer check (estimated_square_feet is null or estimated_square_feet > 0),
  bedrooms smallint check (bedrooms is null or bedrooms >= 0),
  bathrooms numeric(3,1) check (bathrooms is null or bathrooms >= 0),
  supplies_provided boolean not null default false,
  recurring boolean not null default false,
  recurrence_rule text,
  special_instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not recurring or recurrence_rule is not null)
);

create table public.carpet_cleaning_requests (
  service_request_id uuid primary key references public.service_requests(id) on delete cascade,
  estimated_square_feet integer check (estimated_square_feet is null or estimated_square_feet > 0),
  room_count smallint check (room_count is null or room_count > 0),
  staircase_count smallint check (staircase_count is null or staircase_count >= 0),
  carpet_material text,
  stain_types text[] not null default '{}',
  pet_treatment_required boolean not null default false,
  furniture_moving_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.emergency_requests (
  service_request_id uuid primary key references public.service_requests(id) on delete cascade,
  emergency_type text not null check (emergency_type in ('fire', 'flood', 'gas', 'electrical', 'security', 'no_heat', 'no_cooling', 'lockout', 'structural', 'other')),
  people_at_risk boolean not null default false,
  utilities_shut_off boolean not null default false,
  emergency_services_contacted boolean not null default false,
  incident_started_at timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.profiles(id) on delete set null,
  escalation_level smallint not null default 1 check (escalation_level between 1 and 5),
  safety_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quotes add column quote_number bigint generated always as identity;
alter table public.quotes add column valid_until timestamptz;
alter table public.quotes add column labor_cents integer not null default 0 check (labor_cents >= 0);
alter table public.quotes add column materials_cents integer not null default 0 check (materials_cents >= 0);
alter table public.quotes add column tax_cents integer not null default 0 check (tax_cents >= 0);
alter table public.quotes add column terms text;
alter table public.quotes add constraint quotes_number_unique unique (quote_number);
alter table public.quotes add constraint quotes_validity check (valid_until is null or valid_until > created_at);

create table public.quote_line_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  description text not null,
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer generated always as (round(quantity * unit_price_cents)::integer) stored,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index quote_line_items_quote_idx on public.quote_line_items (quote_id, sort_order, id);

alter table public.work_orders add column work_order_number bigint generated always as identity;
alter table public.work_orders add column assigned_by uuid references public.profiles(id) on delete set null;
alter table public.work_orders add column accepted_at timestamptz;
alter table public.work_orders add column actual_start_at timestamptz;
alter table public.work_orders add column actual_end_at timestamptz;
alter table public.work_orders add column not_to_exceed_cents integer check (not_to_exceed_cents is null or not_to_exceed_cents >= 0);
alter table public.work_orders add constraint work_orders_number_unique unique (work_order_number);
alter table public.work_orders add constraint work_orders_actual_time_order check (actual_end_at is null or actual_start_at is null or actual_end_at >= actual_start_at);

create table public.vendor_reviews (
  id uuid primary key default gen_random_uuid(),
  vendor_organization_id uuid not null references public.vendor_profiles(organization_id) on delete cascade,
  property_organization_id uuid not null references public.organizations(id) on delete cascade,
  work_order_id uuid not null unique references public.work_orders(id) on delete restrict,
  reviewer_user_id uuid not null references public.profiles(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  quality_rating smallint check (quality_rating between 1 and 5),
  timeliness_rating smallint check (timeliness_rating between 1 and 5),
  communication_rating smallint check (communication_rating between 1 and 5),
  value_rating smallint check (value_rating between 1 and 5),
  title text,
  body text,
  status public.review_status not null default 'pending',
  vendor_response text,
  vendor_responded_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vendor_reviews_vendor_published_idx
on public.vendor_reviews (vendor_organization_id, published_at desc)
where status = 'published';
create index vendor_reviews_property_org_idx on public.vendor_reviews (property_organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Invoicing and payments
-- ---------------------------------------------------------------------------

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number bigint generated always as identity unique,
  work_order_id uuid references public.work_orders(id) on delete restrict,
  property_organization_id uuid not null references public.organizations(id) on delete restrict,
  vendor_organization_id uuid not null references public.vendor_profiles(organization_id) on delete restrict,
  issued_by uuid not null references public.profiles(id) on delete restrict,
  status public.invoice_status not null default 'draft',
  currency text not null default 'USD' check (char_length(currency) = 3),
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  total_cents integer generated always as (subtotal_cents + tax_cents - discount_cents) stored,
  amount_paid_cents integer not null default 0 check (amount_paid_cents >= 0),
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  memo text,
  external_invoice_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_cents <= subtotal_cents + tax_cents),
  check (amount_paid_cents <= subtotal_cents + tax_cents - discount_cents),
  check (due_at is null or issued_at is null or due_at >= issued_at)
);

create table public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer generated always as (round(quantity * unit_price_cents)::integer) stored,
  taxable boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  payer_organization_id uuid not null references public.organizations(id) on delete restrict,
  payee_organization_id uuid not null references public.organizations(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'USD' check (char_length(currency) = 3),
  status public.payment_status not null default 'pending',
  payment_method_type text,
  external_payment_id text unique,
  failure_code text,
  failure_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (payer_organization_id <> payee_organization_id)
);

create index invoices_property_org_idx on public.invoices (property_organization_id, status, created_at desc);
create index invoices_vendor_org_idx on public.invoices (vendor_organization_id, status, created_at desc);
create index invoices_due_idx on public.invoices (due_at) where status in ('issued', 'partially_paid', 'overdue');
create index invoice_line_items_invoice_idx on public.invoice_line_items (invoice_id, sort_order, id);
create index payments_invoice_idx on public.payments (invoice_id, created_at desc);
create index payments_parties_idx on public.payments (payer_organization_id, payee_organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Notifications, favorites, conversations, and messages
-- ---------------------------------------------------------------------------

create table public.notification_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_key text not null,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  push_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, event_key)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  channel public.notification_channel not null default 'in_app',
  event_key text not null,
  title text not null,
  body text not null,
  action_url text,
  status public.notification_status not null default 'queued',
  deduplication_key text,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index notifications_deduplication_idx
on public.notifications (user_id, channel, deduplication_key)
where deduplication_key is not null;
create index notifications_user_unread_idx
on public.notifications (user_id, created_at desc)
where read_at is null and status <> 'cancelled';
create index notifications_delivery_queue_idx
on public.notifications (scheduled_for, created_at)
where status = 'queued';

create table public.user_vendor_favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  vendor_organization_id uuid not null references public.vendor_profiles(organization_id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  primary key (user_id, vendor_organization_id, organization_id)
);

create index user_vendor_favorites_vendor_idx
on public.user_vendor_favorites (vendor_organization_id, organization_id);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  conversation_type public.conversation_type not null default 'direct',
  service_request_id uuid references public.service_requests(id) on delete cascade,
  work_order_id uuid references public.work_orders(id) on delete cascade,
  subject text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  last_message_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (conversation_type = 'request' and service_request_id is not null)
    or (conversation_type = 'work_order' and work_order_id is not null)
    or (conversation_type in ('direct', 'support'))
  )
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  muted_until timestamptz,
  left_at timestamptz,
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_user_id uuid not null references public.profiles(id) on delete restrict,
  reply_to_message_id uuid references public.messages(id) on delete set null,
  body text not null check (char_length(body) between 1 and 10000),
  metadata jsonb not null default '{}'::jsonb,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index conversations_org_last_message_idx on public.conversations (organization_id, last_message_at desc nulls last);
create index conversations_request_idx on public.conversations (service_request_id) where service_request_id is not null;
create index conversations_work_order_idx on public.conversations (work_order_id) where work_order_id is not null;
create index conversation_participants_user_idx on public.conversation_participants (user_id, joined_at desc) where left_at is null;
create index messages_conversation_created_idx on public.messages (conversation_id, created_at, id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Warranty programs and appliance inventory
-- ---------------------------------------------------------------------------

create table public.warranty_programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  provider_name text not null,
  policy_number text,
  coverage_summary text,
  deductible_cents integer not null default 0 check (deductible_cents >= 0),
  starts_on date not null,
  ends_on date,
  contact_phone text,
  contact_email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on),
  unique (organization_id, name, starts_on)
);

create table public.property_warranty_enrollments (
  id uuid primary key default gen_random_uuid(),
  warranty_program_id uuid not null references public.warranty_programs(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  external_contract_id text,
  starts_on date not null,
  ends_on date,
  status text not null default 'active' check (status in ('pending', 'active', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (warranty_program_id, property_id, starts_on),
  check (ends_on is null or ends_on >= starts_on)
);

create table public.appliances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  unit_identifier text,
  category text not null,
  manufacturer text,
  model_number text,
  serial_number text,
  asset_tag text,
  purchase_date date,
  installed_date date,
  warranty_expires_on date,
  expected_life_months integer check (expected_life_months is null or expected_life_months > 0),
  replacement_cost_cents integer check (replacement_cost_cents is null or replacement_cost_cents >= 0),
  status public.appliance_status not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, asset_tag),
  check (installed_date is null or purchase_date is null or installed_date >= purchase_date)
);

create unique index appliances_serial_unique_idx
on public.appliances (manufacturer, serial_number)
where serial_number is not null;
create index appliances_property_idx on public.appliances (property_id, status, category);
create index appliances_warranty_expiry_idx on public.appliances (warranty_expires_on) where status = 'active';

create table public.appliance_service_history (
  id uuid primary key default gen_random_uuid(),
  appliance_id uuid not null references public.appliances(id) on delete cascade,
  service_request_id uuid references public.service_requests(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  service_type text not null check (service_type in ('inspection', 'maintenance', 'repair', 'replacement', 'installation', 'recall')),
  performed_at timestamptz not null,
  vendor_organization_id uuid references public.vendor_profiles(organization_id) on delete set null,
  notes text,
  cost_cents integer check (cost_cents is null or cost_cents >= 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (service_request_id is not null or work_order_id is not null or notes is not null)
);

create index appliance_service_history_appliance_idx on public.appliance_service_history (appliance_id, performed_at desc);

create table public.warranty_claims (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.property_warranty_enrollments(id) on delete restrict,
  service_request_id uuid references public.service_requests(id) on delete set null,
  appliance_id uuid references public.appliances(id) on delete set null,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  claim_number text,
  status public.warranty_claim_status not null default 'draft',
  issue_summary text not null,
  requested_amount_cents integer check (requested_amount_cents is null or requested_amount_cents >= 0),
  approved_amount_cents integer check (approved_amount_cents is null or approved_amount_cents >= 0),
  submitted_at timestamptz,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrollment_id, claim_number),
  check (resolved_at is null or submitted_at is null or resolved_at >= submitted_at)
);

create index warranty_programs_org_active_idx on public.warranty_programs (organization_id, is_active, ends_on);
create index warranty_enrollments_property_idx on public.property_warranty_enrollments (property_id, status, ends_on);
create index warranty_claims_enrollment_idx on public.warranty_claims (enrollment_id, status, created_at desc);
create index warranty_claims_request_idx on public.warranty_claims (service_request_id) where service_request_id is not null;

-- ---------------------------------------------------------------------------
-- File attachment joins with real foreign keys
-- ---------------------------------------------------------------------------

create table public.property_files (
  property_id uuid not null references public.properties(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete restrict,
  purpose text not null default 'document',
  created_at timestamptz not null default now(),
  primary key (property_id, file_id)
);

create table public.service_request_files (
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete restrict,
  purpose text not null default 'attachment',
  created_at timestamptz not null default now(),
  primary key (service_request_id, file_id)
);

create table public.work_order_files (
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete restrict,
  purpose text not null default 'attachment',
  created_at timestamptz not null default now(),
  primary key (work_order_id, file_id)
);

create table public.invoice_files (
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete restrict,
  purpose text not null default 'invoice',
  created_at timestamptz not null default now(),
  primary key (invoice_id, file_id)
);

create table public.message_files (
  message_id uuid not null references public.messages(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (message_id, file_id)
);

create table public.warranty_claim_files (
  warranty_claim_id uuid not null references public.warranty_claims(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete restrict,
  purpose text not null default 'evidence',
  created_at timestamptz not null default now(),
  primary key (warranty_claim_id, file_id)
);

-- ---------------------------------------------------------------------------
-- Analytics and future AI interactions
-- ---------------------------------------------------------------------------

create table public.analytics_events (
  id bigint generated always as identity,
  occurred_at timestamptz not null default now(),
  organization_id uuid references public.organizations(id) on delete set null,
  market_id uuid references public.markets(id) on delete set null,
  city_id uuid references public.cities(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  session_id uuid,
  event_name text not null,
  entity_type text,
  entity_id uuid,
  source text not null default 'web',
  properties jsonb not null default '{}'::jsonb,
  primary key (occurred_at, id)
) partition by range (occurred_at);

create table public.analytics_events_default
partition of public.analytics_events default;

create index analytics_events_default_org_time_idx
on public.analytics_events_default (organization_id, occurred_at desc);
create index analytics_events_default_name_time_idx
on public.analytics_events_default (event_name, occurred_at desc);

create table public.daily_organization_metrics (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metric_date date not null,
  market_id uuid references public.markets(id) on delete cascade,
  open_request_count integer not null default 0,
  completed_request_count integer not null default 0,
  average_response_minutes numeric(12,2),
  average_completion_minutes numeric(12,2),
  quoted_amount_cents bigint not null default 0,
  invoiced_amount_cents bigint not null default 0,
  paid_amount_cents bigint not null default 0,
  active_vendor_count integer not null default 0,
  active_property_count integer not null default 0,
  computed_at timestamptz not null default now()
);

create unique index daily_organization_metrics_scope_idx
on public.daily_organization_metrics (
  organization_id,
  metric_date,
  coalesce(market_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
create index daily_organization_metrics_market_date_idx
on public.daily_organization_metrics (market_id, metric_date desc);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  context_type text check (context_type is null or context_type in ('general', 'property', 'request', 'work_order', 'vendor', 'invoice', 'analytics')),
  context_id uuid,
  model_provider text,
  model_name text,
  prompt_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  ai_conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  actor_type public.ai_actor_type not null,
  user_id uuid references public.profiles(id) on delete set null,
  content jsonb not null,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  model_name text,
  created_at timestamptz not null default now()
);

create table public.ai_tool_runs (
  id uuid primary key default gen_random_uuid(),
  ai_message_id uuid not null references public.ai_messages(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  tool_name text not null,
  idempotency_key text not null unique,
  status public.ai_run_status not null default 'queued',
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error jsonb,
  requires_human_approval boolean not null default false,
  approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (not requires_human_approval or approved_at is null or approved_by is not null),
  check (completed_at is null or started_at is null or completed_at >= started_at)
);

create table public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  ai_message_id uuid not null references public.ai_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating in (-1, 1)),
  reason text,
  created_at timestamptz not null default now(),
  unique (ai_message_id, user_id)
);

create index ai_conversations_user_idx on public.ai_conversations (user_id, updated_at desc) where archived_at is null;
create index ai_conversations_org_idx on public.ai_conversations (organization_id, updated_at desc);
create index ai_messages_conversation_idx on public.ai_messages (ai_conversation_id, created_at, id);
create index ai_tool_runs_status_idx on public.ai_tool_runs (status, created_at) where status in ('queued', 'running', 'requires_approval');

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------

create or replace function public.user_can_access_request(target_request_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_super_admin() or exists (
    select 1
    from public.service_requests sr
    where sr.id = target_request_id
      and (
        public.is_organization_member(sr.organization_id)
        or public.is_organization_member(sr.assigned_vendor_organization_id)
        or public.user_has_vendor_quote(sr.id)
      )
  );
$$;

create or replace function public.user_can_access_work_order(target_work_order_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_super_admin() or exists (
    select 1
    from public.work_orders wo
    where wo.id = target_work_order_id
      and (
        public.is_organization_member(wo.property_organization_id)
        or public.is_organization_member(wo.vendor_organization_id)
        or wo.assigned_technician_id = auth.uid()
      )
  );
$$;

create or replace function public.user_can_access_invoice(target_invoice_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_super_admin() or exists (
    select 1
    from public.invoices i
    where i.id = target_invoice_id
      and (
        public.is_organization_member(i.property_organization_id)
        or public.is_organization_member(i.vendor_organization_id)
      )
  );
$$;

create or replace function public.is_conversation_participant(target_conversation_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_super_admin() or exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = target_conversation_id
      and cp.user_id = auth.uid()
      and cp.left_at is null
  );
$$;

create or replace function public.user_can_access_file(target_file_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_super_admin() or exists (
    select 1 from public.files f
    where f.id = target_file_id
      and f.deleted_at is null
      and (
        f.uploaded_by = auth.uid()
        or f.visibility = 'public'
        or public.is_organization_member(f.organization_id)
        or exists (
          select 1 from public.service_request_files rf
          where rf.file_id = f.id and public.user_can_access_request(rf.service_request_id)
        )
        or exists (
          select 1 from public.work_order_files wf
          where wf.file_id = f.id and public.user_can_access_work_order(wf.work_order_id)
        )
        or exists (
          select 1 from public.invoice_files inf
          where inf.file_id = f.id and public.user_can_access_invoice(inf.invoice_id)
        )
        or exists (
          select 1
          from public.message_files mf
          join public.messages msg on msg.id = mf.message_id
          where mf.file_id = f.id and public.is_conversation_participant(msg.conversation_id)
        )
      )
  );
$$;

grant execute on function public.user_can_access_request(uuid) to authenticated;
grant execute on function public.user_can_access_work_order(uuid) to authenticated;
grant execute on function public.user_can_access_invoice(uuid) to authenticated;
grant execute on function public.is_conversation_participant(uuid) to authenticated;
grant execute on function public.user_can_access_file(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Updated-at triggers
-- ---------------------------------------------------------------------------

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'cities', 'user_preferences', 'property_manager_profiles',
    'vendor_services', 'vendor_service_offerings', 'vendor_membership_levels',
    'vendor_memberships', 'vendor_badges', 'vendor_verifications',
    'cleaning_requests', 'carpet_cleaning_requests', 'emergency_requests',
    'vendor_reviews', 'invoices', 'payments', 'notification_preferences',
    'conversations', 'warranty_programs', 'property_warranty_enrollments',
    'appliances', 'warranty_claims', 'ai_conversations'
  ]
  loop
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end $$;

-- Keep conversation ordering correct without trusting the client.
create or replace function public.touch_conversation_last_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations
  set last_message_at = new.created_at, updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger touch_conversation_after_message
after insert on public.messages
for each row execute function public.touch_conversation_last_message();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.cities enable row level security;
alter table public.market_cities enable row level security;
alter table public.user_preferences enable row level security;
alter table public.property_manager_profiles enable row level security;
alter table public.property_manager_assignments enable row level security;
alter table public.vendor_services enable row level security;
alter table public.vendor_service_offerings enable row level security;
alter table public.vendor_service_cities enable row level security;
alter table public.vendor_membership_levels enable row level security;
alter table public.vendor_memberships enable row level security;
alter table public.vendor_badges enable row level security;
alter table public.vendor_badge_awards enable row level security;
alter table public.files enable row level security;
alter table public.vendor_verifications enable row level security;
alter table public.vendor_verification_files enable row level security;
alter table public.cleaning_requests enable row level security;
alter table public.carpet_cleaning_requests enable row level security;
alter table public.emergency_requests enable row level security;
alter table public.quote_line_items enable row level security;
alter table public.vendor_reviews enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_line_items enable row level security;
alter table public.payments enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.user_vendor_favorites enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.warranty_programs enable row level security;
alter table public.property_warranty_enrollments enable row level security;
alter table public.appliances enable row level security;
alter table public.appliance_service_history enable row level security;
alter table public.warranty_claims enable row level security;
alter table public.property_files enable row level security;
alter table public.service_request_files enable row level security;
alter table public.work_order_files enable row level security;
alter table public.invoice_files enable row level security;
alter table public.message_files enable row level security;
alter table public.warranty_claim_files enable row level security;
alter table public.analytics_events enable row level security;
alter table public.analytics_events_default enable row level security;
alter table public.daily_organization_metrics enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_tool_runs enable row level security;
alter table public.ai_feedback enable row level security;

create policy "cities_read_authenticated" on public.cities for select to authenticated using (true);
create policy "cities_manage_super_admin" on public.cities for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "market_cities_read_authenticated" on public.market_cities for select to authenticated using (true);
create policy "market_cities_manage_super_admin" on public.market_cities for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy "preferences_manage_self" on public.user_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "manager_profiles_read_org" on public.property_manager_profiles for select to authenticated using (
  public.is_super_admin() or exists (
    select 1 from public.organization_members m
    where m.id = membership_id and (m.user_id = auth.uid() or public.is_organization_member(m.organization_id))
  )
);
create policy "manager_profiles_manage_admins" on public.property_manager_profiles for all to authenticated using (
  exists (select 1 from public.organization_members m where m.id = membership_id and public.has_organization_role(m.organization_id, array['owner','admin']::public.membership_role[]))
) with check (
  exists (select 1 from public.organization_members m where m.id = membership_id and public.has_organization_role(m.organization_id, array['owner','admin']::public.membership_role[]))
);
create policy "manager_assignments_read_org" on public.property_manager_assignments for select to authenticated using (
  exists (select 1 from public.properties p where p.id = property_id and (public.is_organization_member(p.organization_id) or public.is_super_admin()))
);
create policy "manager_assignments_manage_admins" on public.property_manager_assignments for all to authenticated using (
  exists (select 1 from public.properties p where p.id = property_id and public.has_organization_role(p.organization_id, array['owner','admin']::public.membership_role[]))
) with check (
  exists (select 1 from public.properties p where p.id = property_id and public.has_organization_role(p.organization_id, array['owner','admin']::public.membership_role[]))
);

create policy "vendor_services_read_authenticated" on public.vendor_services for select to authenticated using (true);
create policy "vendor_services_manage_super_admin" on public.vendor_services for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "vendor_offerings_read_authenticated" on public.vendor_service_offerings for select to authenticated using (true);
create policy "vendor_offerings_manage_vendor" on public.vendor_service_offerings for all to authenticated using (
  public.has_organization_role(vendor_organization_id, array['owner','admin','vendor']::public.membership_role[])
) with check (
  public.has_organization_role(vendor_organization_id, array['owner','admin','vendor']::public.membership_role[])
);
create policy "vendor_service_cities_read_authenticated" on public.vendor_service_cities for select to authenticated using (true);
create policy "vendor_service_cities_manage_vendor" on public.vendor_service_cities for all to authenticated using (
  public.has_organization_role(vendor_organization_id, array['owner','admin','vendor']::public.membership_role[])
) with check (
  public.has_organization_role(vendor_organization_id, array['owner','admin','vendor']::public.membership_role[])
);

create policy "membership_levels_read_authenticated" on public.vendor_membership_levels for select to authenticated using (is_active or public.is_super_admin());
create policy "membership_levels_manage_super_admin" on public.vendor_membership_levels for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "vendor_memberships_read_vendor" on public.vendor_memberships for select to authenticated using (public.is_organization_member(vendor_organization_id) or public.is_super_admin());

create policy "badges_read_authenticated" on public.vendor_badges for select to authenticated using (is_active or public.is_super_admin());
create policy "badges_manage_super_admin" on public.vendor_badges for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "badge_awards_read_authenticated" on public.vendor_badge_awards for select to authenticated using (revoked_at is null or public.is_super_admin());
create policy "badge_awards_manage_super_admin" on public.vendor_badge_awards for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy "files_read_authorized" on public.files for select to authenticated using (public.user_can_access_file(id));
create policy "files_create_members" on public.files for insert to authenticated with check (
  uploaded_by = auth.uid() and (organization_id is null or public.is_organization_member(organization_id))
);
create policy "files_update_uploader" on public.files for update to authenticated using (
  uploaded_by = auth.uid() or public.is_super_admin()
) with check (
  uploaded_by = auth.uid() or public.is_super_admin()
);

create policy "verifications_read_vendor" on public.vendor_verifications for select to authenticated using (public.is_organization_member(vendor_organization_id) or public.is_super_admin());
create policy "verifications_submit_vendor" on public.vendor_verifications for insert to authenticated with check (
  submitted_by = auth.uid() and public.has_organization_role(vendor_organization_id, array['owner','admin','vendor']::public.membership_role[])
);
create policy "verifications_update_authorized" on public.vendor_verifications for update to authenticated using (
  public.is_super_admin() or (status in ('pending','rejected','expired') and public.has_organization_role(vendor_organization_id, array['owner','admin','vendor']::public.membership_role[]))
) with check (
  public.is_super_admin() or public.has_organization_role(vendor_organization_id, array['owner','admin','vendor']::public.membership_role[])
);
create policy "verification_files_read_vendor" on public.vendor_verification_files for select to authenticated using (
  exists (select 1 from public.vendor_verifications v where v.id = vendor_verification_id and (public.is_organization_member(v.vendor_organization_id) or public.is_super_admin()))
);
create policy "verification_files_manage_vendor" on public.vendor_verification_files for all to authenticated using (
  exists (select 1 from public.vendor_verifications v where v.id = vendor_verification_id and public.has_organization_role(v.vendor_organization_id, array['owner','admin','vendor']::public.membership_role[]))
) with check (
  exists (select 1 from public.vendor_verifications v where v.id = vendor_verification_id and public.has_organization_role(v.vendor_organization_id, array['owner','admin','vendor']::public.membership_role[]))
);

create policy "cleaning_details_read_request" on public.cleaning_requests for select to authenticated using (public.user_can_access_request(service_request_id));
create policy "cleaning_details_manage_request" on public.cleaning_requests for all to authenticated using (
  exists (select 1 from public.service_requests r where r.id = service_request_id and public.has_organization_role(r.organization_id, array['owner','admin','property_manager']::public.membership_role[]))
) with check (
  exists (select 1 from public.service_requests r where r.id = service_request_id and public.has_organization_role(r.organization_id, array['owner','admin','property_manager']::public.membership_role[]))
);
create policy "carpet_details_read_request" on public.carpet_cleaning_requests for select to authenticated using (public.user_can_access_request(service_request_id));
create policy "carpet_details_manage_request" on public.carpet_cleaning_requests for all to authenticated using (
  exists (select 1 from public.service_requests r where r.id = service_request_id and public.has_organization_role(r.organization_id, array['owner','admin','property_manager']::public.membership_role[]))
) with check (
  exists (select 1 from public.service_requests r where r.id = service_request_id and public.has_organization_role(r.organization_id, array['owner','admin','property_manager']::public.membership_role[]))
);
create policy "emergency_details_read_request" on public.emergency_requests for select to authenticated using (public.user_can_access_request(service_request_id));
create policy "emergency_details_manage_request" on public.emergency_requests for all to authenticated using (
  exists (select 1 from public.service_requests r where r.id = service_request_id and public.has_organization_role(r.organization_id, array['owner','admin','property_manager']::public.membership_role[]))
) with check (
  exists (select 1 from public.service_requests r where r.id = service_request_id and public.has_organization_role(r.organization_id, array['owner','admin','property_manager']::public.membership_role[]))
);

create policy "quote_items_read_parties" on public.quote_line_items for select to authenticated using (
  exists (
    select 1 from public.quotes q
    join public.service_requests r on r.id = q.service_request_id
    where q.id = quote_id
      and (
        public.is_organization_member(q.vendor_organization_id)
        or public.is_organization_member(r.organization_id)
        or public.is_super_admin()
      )
  )
);
create policy "quote_items_manage_vendor" on public.quote_line_items for all to authenticated using (
  exists (
    select 1 from public.quotes q
    where q.id = quote_id
      and q.status = 'submitted'
      and public.has_organization_role(q.vendor_organization_id, array['owner','admin','vendor']::public.membership_role[])
  )
) with check (
  exists (
    select 1 from public.quotes q
    where q.id = quote_id
      and q.status = 'submitted'
      and public.has_organization_role(q.vendor_organization_id, array['owner','admin','vendor']::public.membership_role[])
  )
);

create policy "reviews_read_authorized" on public.vendor_reviews for select to authenticated using (
  status = 'published'
  or public.is_organization_member(vendor_organization_id)
  or public.is_organization_member(property_organization_id)
  or public.is_super_admin()
);
create policy "reviews_create_property_team" on public.vendor_reviews for insert to authenticated with check (
  reviewer_user_id = auth.uid()
  and public.has_organization_role(property_organization_id, array['owner','admin','property_manager']::public.membership_role[])
  and exists (
    select 1 from public.work_orders wo
    where wo.id = work_order_id
      and wo.property_organization_id = property_organization_id
      and wo.vendor_organization_id = vendor_organization_id
      and wo.status = 'completed'
  )
);
create policy "reviews_update_parties" on public.vendor_reviews for update to authenticated using (
  reviewer_user_id = auth.uid()
  or public.has_organization_role(vendor_organization_id, array['owner','admin','vendor']::public.membership_role[])
  or public.is_super_admin()
) with check (
  reviewer_user_id = auth.uid()
  or public.has_organization_role(vendor_organization_id, array['owner','admin','vendor']::public.membership_role[])
  or public.is_super_admin()
);

create policy "invoices_read_parties" on public.invoices for select to authenticated using (public.user_can_access_invoice(id));
create policy "invoices_create_vendor" on public.invoices for insert to authenticated with check (
  issued_by = auth.uid()
  and public.has_organization_role(vendor_organization_id, array['owner','admin','vendor']::public.membership_role[])
  and exists (
    select 1 from public.work_orders wo
    where wo.id = work_order_id
      and wo.property_organization_id = property_organization_id
      and wo.vendor_organization_id = vendor_organization_id
  )
);
create policy "invoices_update_vendor" on public.invoices for update to authenticated using (
  status in ('draft','issued')
  and public.has_organization_role(vendor_organization_id, array['owner','admin','vendor']::public.membership_role[])
) with check (
  public.has_organization_role(vendor_organization_id, array['owner','admin','vendor']::public.membership_role[])
);
create policy "invoice_items_read_parties" on public.invoice_line_items for select to authenticated using (public.user_can_access_invoice(invoice_id));
create policy "invoice_items_manage_vendor" on public.invoice_line_items for all to authenticated using (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_id and i.status = 'draft'
      and public.has_organization_role(i.vendor_organization_id, array['owner','admin','vendor']::public.membership_role[])
  )
) with check (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_id and i.status = 'draft'
      and public.has_organization_role(i.vendor_organization_id, array['owner','admin','vendor']::public.membership_role[])
  )
);
create policy "payments_read_parties" on public.payments for select to authenticated using (
  public.is_organization_member(payer_organization_id)
  or public.is_organization_member(payee_organization_id)
  or public.is_super_admin()
);

create policy "notification_preferences_manage_self" on public.notification_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications_read_self" on public.notifications for select to authenticated using (user_id = auth.uid() or public.is_super_admin());
create policy "notifications_mark_self" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "favorites_manage_self" on public.user_vendor_favorites for all to authenticated using (
  user_id = auth.uid() and public.is_organization_member(organization_id)
) with check (
  user_id = auth.uid() and public.is_organization_member(organization_id)
);

create policy "conversations_read_participants" on public.conversations for select to authenticated using (public.is_conversation_participant(id));
create policy "conversations_create_member" on public.conversations for insert to authenticated with check (
  created_by = auth.uid() and (organization_id is null or public.is_organization_member(organization_id))
);
create policy "conversations_update_participants" on public.conversations for update to authenticated using (public.is_conversation_participant(id)) with check (public.is_conversation_participant(id));
create policy "participants_read_conversation" on public.conversation_participants for select to authenticated using (public.is_conversation_participant(conversation_id));
create policy "participants_add_by_creator" on public.conversation_participants for insert to authenticated with check (
  exists (select 1 from public.conversations c where c.id = conversation_id and c.created_by = auth.uid())
  or user_id = auth.uid()
);
create policy "participants_update_self" on public.conversation_participants for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "messages_read_participants" on public.messages for select to authenticated using (public.is_conversation_participant(conversation_id));
create policy "messages_create_participants" on public.messages for insert to authenticated with check (
  sender_user_id = auth.uid() and public.is_conversation_participant(conversation_id)
);
create policy "messages_update_sender" on public.messages for update to authenticated using (sender_user_id = auth.uid()) with check (sender_user_id = auth.uid());

create policy "warranty_programs_read_org" on public.warranty_programs for select to authenticated using (public.is_organization_member(organization_id) or public.is_super_admin());
create policy "warranty_programs_manage_admins" on public.warranty_programs for all to authenticated using (
  public.has_organization_role(organization_id, array['owner','admin']::public.membership_role[])
) with check (
  public.has_organization_role(organization_id, array['owner','admin']::public.membership_role[])
);
create policy "warranty_enrollments_read_org" on public.property_warranty_enrollments for select to authenticated using (
  exists (select 1 from public.properties p where p.id = property_id and (public.is_organization_member(p.organization_id) or public.is_super_admin()))
);
create policy "warranty_enrollments_manage_admins" on public.property_warranty_enrollments for all to authenticated using (
  exists (select 1 from public.properties p where p.id = property_id and public.has_organization_role(p.organization_id, array['owner','admin']::public.membership_role[]))
) with check (
  exists (select 1 from public.properties p where p.id = property_id and public.has_organization_role(p.organization_id, array['owner','admin']::public.membership_role[]))
);

create policy "appliances_read_org" on public.appliances for select to authenticated using (public.is_organization_member(organization_id) or public.is_super_admin());
create policy "appliances_manage_property_team" on public.appliances for all to authenticated using (
  public.has_organization_role(organization_id, array['owner','admin','property_manager']::public.membership_role[])
) with check (
  public.has_organization_role(organization_id, array['owner','admin','property_manager']::public.membership_role[])
);
create policy "appliance_history_read_org" on public.appliance_service_history for select to authenticated using (
  exists (select 1 from public.appliances a where a.id = appliance_id and (public.is_organization_member(a.organization_id) or public.is_super_admin()))
);
create policy "appliance_history_create_authorized" on public.appliance_service_history for insert to authenticated with check (
  created_by = auth.uid() and exists (
    select 1 from public.appliances a
    where a.id = appliance_id
      and (
        public.has_organization_role(a.organization_id, array['owner','admin','property_manager']::public.membership_role[])
        or (vendor_organization_id is not null and public.is_organization_member(vendor_organization_id))
      )
  )
);
create policy "warranty_claims_read_org" on public.warranty_claims for select to authenticated using (
  exists (
    select 1
    from public.property_warranty_enrollments e
    join public.properties p on p.id = e.property_id
    where e.id = enrollment_id and (public.is_organization_member(p.organization_id) or public.is_super_admin())
  )
);
create policy "warranty_claims_manage_property_team" on public.warranty_claims for all to authenticated using (
  exists (
    select 1
    from public.property_warranty_enrollments e
    join public.properties p on p.id = e.property_id
    where e.id = enrollment_id and public.has_organization_role(p.organization_id, array['owner','admin','property_manager']::public.membership_role[])
  )
) with check (
  exists (
    select 1
    from public.property_warranty_enrollments e
    join public.properties p on p.id = e.property_id
    where e.id = enrollment_id and public.has_organization_role(p.organization_id, array['owner','admin','property_manager']::public.membership_role[])
  )
);

create policy "property_files_read_org" on public.property_files for select to authenticated using (
  exists (select 1 from public.properties p where p.id = property_id and (public.is_organization_member(p.organization_id) or public.is_super_admin()))
);
create policy "property_files_manage_team" on public.property_files for all to authenticated using (
  exists (select 1 from public.properties p where p.id = property_id and public.has_organization_role(p.organization_id, array['owner','admin','property_manager']::public.membership_role[]))
) with check (
  exists (select 1 from public.properties p where p.id = property_id and public.has_organization_role(p.organization_id, array['owner','admin','property_manager']::public.membership_role[]))
);
create policy "request_files_read_request" on public.service_request_files for select to authenticated using (public.user_can_access_request(service_request_id));
create policy "request_files_manage_request" on public.service_request_files for all to authenticated using (public.user_can_access_request(service_request_id)) with check (public.user_can_access_request(service_request_id));
create policy "work_order_files_read_order" on public.work_order_files for select to authenticated using (public.user_can_access_work_order(work_order_id));
create policy "work_order_files_manage_order" on public.work_order_files for all to authenticated using (public.user_can_access_work_order(work_order_id)) with check (public.user_can_access_work_order(work_order_id));
create policy "invoice_files_read_invoice" on public.invoice_files for select to authenticated using (public.user_can_access_invoice(invoice_id));
create policy "invoice_files_manage_invoice" on public.invoice_files for all to authenticated using (public.user_can_access_invoice(invoice_id)) with check (public.user_can_access_invoice(invoice_id));
create policy "message_files_read_message" on public.message_files for select to authenticated using (
  exists (select 1 from public.messages m where m.id = message_id and public.is_conversation_participant(m.conversation_id))
);
create policy "message_files_manage_sender" on public.message_files for all to authenticated using (
  exists (select 1 from public.messages m where m.id = message_id and m.sender_user_id = auth.uid())
) with check (
  exists (select 1 from public.messages m where m.id = message_id and m.sender_user_id = auth.uid())
);
create policy "warranty_claim_files_read_claim" on public.warranty_claim_files for select to authenticated using (
  exists (
    select 1
    from public.warranty_claims wc
    join public.property_warranty_enrollments e on e.id = wc.enrollment_id
    join public.properties p on p.id = e.property_id
    where wc.id = warranty_claim_id and (public.is_organization_member(p.organization_id) or public.is_super_admin())
  )
);
create policy "warranty_claim_files_manage_claim" on public.warranty_claim_files for all to authenticated using (
  exists (
    select 1
    from public.warranty_claims wc
    join public.property_warranty_enrollments e on e.id = wc.enrollment_id
    join public.properties p on p.id = e.property_id
    where wc.id = warranty_claim_id and public.has_organization_role(p.organization_id, array['owner','admin','property_manager']::public.membership_role[])
  )
) with check (
  exists (
    select 1
    from public.warranty_claims wc
    join public.property_warranty_enrollments e on e.id = wc.enrollment_id
    join public.properties p on p.id = e.property_id
    where wc.id = warranty_claim_id and public.has_organization_role(p.organization_id, array['owner','admin','property_manager']::public.membership_role[])
  )
);

create policy "analytics_insert_member" on public.analytics_events for insert to authenticated with check (
  (user_id is null or user_id = auth.uid()) and (organization_id is null or public.is_organization_member(organization_id))
);
create policy "analytics_read_admins" on public.analytics_events for select to authenticated using (
  organization_id is not null and public.has_organization_role(organization_id, array['owner','admin']::public.membership_role[])
  or public.is_super_admin()
);
create policy "analytics_default_insert_member" on public.analytics_events_default for insert to authenticated with check (
  (user_id is null or user_id = auth.uid()) and (organization_id is null or public.is_organization_member(organization_id))
);
create policy "analytics_default_read_admins" on public.analytics_events_default for select to authenticated using (
  organization_id is not null and public.has_organization_role(organization_id, array['owner','admin']::public.membership_role[])
  or public.is_super_admin()
);
create policy "daily_metrics_read_org" on public.daily_organization_metrics for select to authenticated using (
  public.is_organization_member(organization_id) or public.is_super_admin()
);

create policy "ai_conversations_manage_owner" on public.ai_conversations for all to authenticated using (
  user_id = auth.uid() and public.is_organization_member(organization_id)
) with check (
  user_id = auth.uid() and public.is_organization_member(organization_id)
);
create policy "ai_messages_read_owner" on public.ai_messages for select to authenticated using (
  exists (select 1 from public.ai_conversations c where c.id = ai_conversation_id and c.user_id = auth.uid())
  or public.is_super_admin()
);
create policy "ai_messages_create_user" on public.ai_messages for insert to authenticated with check (
  actor_type = 'user' and user_id = auth.uid()
  and exists (select 1 from public.ai_conversations c where c.id = ai_conversation_id and c.user_id = auth.uid())
);
create policy "ai_tool_runs_read_requester" on public.ai_tool_runs for select to authenticated using (
  requested_by = auth.uid()
  or public.has_organization_role(organization_id, array['owner','admin']::public.membership_role[])
  or public.is_super_admin()
);
create policy "ai_tool_runs_approve_admin" on public.ai_tool_runs for update to authenticated using (
  status = 'requires_approval'
  and public.has_organization_role(organization_id, array['owner','admin']::public.membership_role[])
) with check (
  public.has_organization_role(organization_id, array['owner','admin']::public.membership_role[])
);
create policy "ai_feedback_manage_self" on public.ai_feedback for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Security hardening for privilege and tenant keys
-- ---------------------------------------------------------------------------

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.protect_profile_privilege()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and new.is_super_admin is distinct from old.is_super_admin then
    raise exception 'is_super_admin can only be changed by a trusted server context';
  end if;
  return new;
end;
$$;

create trigger protect_profile_privilege_before_update
before update on public.profiles
for each row execute function public.protect_profile_privilege();

drop policy if exists "memberships_manage_admins" on public.organization_members;
create policy "memberships_insert_authorized" on public.organization_members for insert to authenticated with check (
  public.has_organization_role(organization_id, array['owner']::public.membership_role[])
  or (
    role not in ('owner','admin')
    and public.has_organization_role(organization_id, array['admin']::public.membership_role[])
  )
);
create policy "memberships_update_authorized" on public.organization_members for update to authenticated using (
  public.has_organization_role(organization_id, array['owner']::public.membership_role[])
  or (
    role not in ('owner','admin')
    and public.has_organization_role(organization_id, array['admin']::public.membership_role[])
  )
) with check (
  public.has_organization_role(organization_id, array['owner']::public.membership_role[])
  or (
    role not in ('owner','admin')
    and public.has_organization_role(organization_id, array['admin']::public.membership_role[])
  )
);
create policy "memberships_delete_authorized" on public.organization_members for delete to authenticated using (
  public.has_organization_role(organization_id, array['owner']::public.membership_role[])
  or (
    role not in ('owner','admin')
    and public.has_organization_role(organization_id, array['admin']::public.membership_role[])
  )
);

create or replace function public.prevent_key_reassignment()
returns trigger language plpgsql set search_path = '' as $$
declare key_name text;
begin
  foreach key_name in array tg_argv
  loop
    if (to_jsonb(new) -> key_name) is distinct from (to_jsonb(old) -> key_name) then
      raise exception '% cannot be reassigned on %', key_name, tg_table_name;
    end if;
  end loop;
  return new;
end;
$$;

create trigger properties_protect_keys before update on public.properties
for each row execute function public.prevent_key_reassignment('organization_id');
create trigger requests_protect_keys before update on public.service_requests
for each row execute function public.prevent_key_reassignment('organization_id', 'property_id', 'requested_by');
create trigger quotes_protect_keys before update on public.quotes
for each row execute function public.prevent_key_reassignment('service_request_id', 'vendor_organization_id', 'submitted_by');
create trigger work_orders_protect_keys before update on public.work_orders
for each row execute function public.prevent_key_reassignment('service_request_id', 'property_organization_id', 'vendor_organization_id');
create trigger invoices_protect_keys before update on public.invoices
for each row execute function public.prevent_key_reassignment('work_order_id', 'property_organization_id', 'vendor_organization_id', 'issued_by');
create trigger payments_protect_keys before update on public.payments
for each row execute function public.prevent_key_reassignment('invoice_id', 'payer_organization_id', 'payee_organization_id');
create trigger reviews_protect_keys before update on public.vendor_reviews
for each row execute function public.prevent_key_reassignment('vendor_organization_id', 'property_organization_id', 'work_order_id', 'reviewer_user_id');

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

insert into public.vendor_membership_levels
  (code, name, description, rank, monthly_price_cents, annual_price_cents, quote_limit_per_month, features)
values
  ('free', 'Free', 'Verified profile and limited marketplace access.', 0, 0, 0, 5, '{"verified_profile": true}'::jsonb),
  ('local_pro', 'Local Pro', 'Full local marketplace access and performance insights.', 10, 9900, 99000, null, '{"verified_profile": true, "analytics": true, "priority_matching": false}'::jsonb),
  ('market_leader', 'Market Leader', 'Priority placement, advanced analytics, and multi-city tools.', 20, 24900, 249000, null, '{"verified_profile": true, "analytics": true, "priority_matching": true, "multi_city": true}'::jsonb)
on conflict (code) do nothing;

insert into public.vendor_badges (code, name, description, icon_key, color_key)
values
  ('verified', 'Verified', 'Identity, business, license, and insurance checks are current.', 'badge-check', 'emerald'),
  ('fast_responder', 'Fast Responder', 'Maintains a qualifying median first-response time.', 'zap', 'amber'),
  ('top_rated', 'Top Rated', 'Maintains the platform rating and completed-job threshold.', 'star', 'violet'),
  ('emergency_ready', 'Emergency Ready', 'Offers verified after-hours emergency coverage.', 'siren', 'rose'),
  ('warranty_specialist', 'Warranty Specialist', 'Experienced with covered repairs and warranty claims.', 'shield-check', 'sky')
on conflict (code) do nothing;

insert into public.vendor_services (vendor_category_id, slug, name)
select vc.id, services.slug, services.name
from public.vendor_categories vc
join (
  values
    ('appliance-repair', 'diagnostics', 'Appliance Diagnostics'),
    ('appliance-repair', 'repair', 'Appliance Repair'),
    ('electrical', 'emergency-electrical', 'Emergency Electrical'),
    ('electrical', 'fixture-repair', 'Fixture and Outlet Repair'),
    ('general-maintenance', 'unit-turn', 'Unit Turn Maintenance'),
    ('hvac', 'no-cooling', 'No-Cooling Service'),
    ('hvac', 'preventive-maintenance', 'HVAC Preventive Maintenance'),
    ('landscaping', 'routine-grounds', 'Routine Grounds Maintenance'),
    ('locksmith', 'emergency-lockout', 'Emergency Lockout'),
    ('pest-control', 'general-pest', 'General Pest Control'),
    ('plumbing', 'emergency-plumbing', 'Emergency Plumbing'),
    ('plumbing', 'leak-repair', 'Leak Repair'),
    ('restoration', 'water-mitigation', 'Water Mitigation'),
    ('roofing', 'leak-repair', 'Roof Leak Repair')
) as services(category_slug, slug, name) on services.category_slug = vc.slug
on conflict (vendor_category_id, slug) do nothing;

-- ---------------------------------------------------------------------------
-- Database-native table documentation
-- ---------------------------------------------------------------------------

comment on table public.profiles is 'Application user profile keyed one-to-one to auth.users; contains global platform-admin status.';
comment on table public.user_preferences is 'Per-user locale, timezone, channel defaults, and quiet-hour preferences.';
comment on table public.cities is 'Canonical unlimited city registry with country, subdivision, timezone, and optional coordinates.';
comment on table public.markets is 'Named operating regions used to launch and manage marketplace coverage.';
comment on table public.market_cities is 'Many-to-many membership of cities in operating markets, including one primary city per market.';
comment on table public.organizations is 'Tenant root for property-management companies and vendor companies.';
comment on table public.organization_markets is 'Markets in which an organization operates.';
comment on table public.organization_members is 'User membership, role, and status within an organization.';
comment on table public.property_manager_profiles is 'Property-manager-specific employment and licensing data attached to an organization membership.';
comment on table public.property_manager_assignments is 'Effective-dated assignment of property managers to properties.';
comment on table public.properties is 'Physical managed properties owned by a property-management tenant and scoped to a city and market.';
comment on table public.vendor_categories is 'Platform-controlled top-level vendor service categories, formerly named trades.';
comment on table public.vendor_services is 'Specific purchasable services within a vendor category.';
comment on table public.vendor_profiles is 'Marketplace profile and aggregate verification/performance data for a vendor organization.';
comment on table public.vendor_category_assignments is 'Categories a vendor organization is qualified to serve.';
comment on table public.vendor_service_offerings is 'Specific services, pricing hints, and emergency availability offered by a vendor.';
comment on table public.vendor_service_cities is 'City-level vendor service coverage and optional travel fee.';
comment on table public.vendor_membership_levels is 'Platform-configured vendor subscription tiers and entitlements.';
comment on table public.vendor_memberships is 'Effective vendor subscription history; at most one current membership per vendor.';
comment on table public.vendor_badges is 'Platform badge definitions and display metadata.';
comment on table public.vendor_badge_awards is 'Effective-dated badge awards granted to vendor organizations.';
comment on table public.vendor_verifications is 'Individual business, license, insurance, identity, tax, bank, and background verification checks.';
comment on table public.vendor_verification_files is 'Evidence files attached to a vendor verification check.';
comment on table public.organization_vendor_relationships is 'Private property-company relationship with a vendor, including preferred and blocked states.';
comment on table public.service_requests is 'Canonical maintenance/service request with property, category, service, urgency, publication, and assignment state.';
comment on table public.cleaning_requests is 'Cleaning-specific one-to-one details for a service request.';
comment on table public.carpet_cleaning_requests is 'Carpet-cleaning-specific one-to-one details for a service request.';
comment on table public.emergency_requests is 'Emergency-specific safety, acknowledgement, and escalation details for a service request.';
comment on table public.quotes is 'Vendor quote submitted for a service request, formerly named bids.';
comment on table public.quote_line_items is 'Normalized quantity and price lines belonging to a quote.';
comment on table public.work_orders is 'Awarded and scheduled execution record connecting a request, quote, property company, vendor, and technician.';
comment on table public.vendor_reviews is 'Verified post-completion vendor review tied to exactly one work order.';
comment on table public.invoices is 'Vendor invoice issued to a property organization, normally for a completed work order.';
comment on table public.invoice_line_items is 'Normalized quantity, price, and taxability lines belonging to an invoice.';
comment on table public.payments is 'Payment-provider-neutral payment transaction associated with an invoice.';
comment on table public.notification_preferences is 'Per-event channel choices for a user.';
comment on table public.notifications is 'Durable multi-channel notification delivery and read-status record.';
comment on table public.user_vendor_favorites is 'A user favorite of a vendor within an organization context.';
comment on table public.conversations is 'Direct, request, work-order, or support message thread.';
comment on table public.conversation_participants is 'Conversation participant state including read, mute, and leave timestamps.';
comment on table public.messages is 'Immutable conversation message with edit and soft-delete timestamps.';
comment on table public.files is 'Immutable Supabase Storage object metadata with ownership, visibility, checksum, and malware-scan state.';
comment on table public.property_files is 'Files attached to a property with a declared purpose.';
comment on table public.service_request_files is 'Files attached to a service request with a declared purpose.';
comment on table public.work_order_files is 'Files attached to a work order with a declared purpose.';
comment on table public.invoice_files is 'Files attached to an invoice with a declared purpose.';
comment on table public.message_files is 'Files attached to a message.';
comment on table public.warranty_programs is 'Organization-level warranty or service-contract program definition.';
comment on table public.property_warranty_enrollments is 'Effective property enrollment in a warranty program.';
comment on table public.warranty_claims is 'Warranty claim connected to an enrollment and optionally to a request and appliance.';
comment on table public.warranty_claim_files is 'Evidence and decision files attached to a warranty claim.';
comment on table public.appliances is 'Property appliance and equipment inventory with lifecycle, warranty, and cost data.';
comment on table public.appliance_service_history is 'Inspection, maintenance, repair, replacement, installation, and recall history for an appliance.';
comment on table public.analytics_events is 'Partitioned append-only product and operational analytics event stream.';
comment on table public.analytics_events_default is 'Default partition receiving analytics events until time-based partitions are provisioned.';
comment on table public.daily_organization_metrics is 'Pre-aggregated daily organization and optional market metrics for dashboards.';
comment on table public.ai_conversations is 'Organization-scoped, user-owned AI interaction thread with model and prompt provenance.';
comment on table public.ai_messages is 'Structured user, assistant, system, and tool content within an AI conversation.';
comment on table public.ai_tool_runs is 'Idempotent AI tool execution record with human-approval and execution state.';
comment on table public.ai_feedback is 'Per-user positive or negative feedback on an AI message.';
comment on table public.audit_events is 'Append-only security and business audit log.';
comment on table public.outbox_events is 'Transactional outbox for reliable asynchronous integrations, notifications, and AI work.';

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

commit;
