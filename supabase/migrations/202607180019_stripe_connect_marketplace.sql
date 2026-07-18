-- Stripe Connect marketplace payments.
-- Founder membership payments intentionally remain in founding_partner_payments:
-- they are platform revenue and must never be transferred to a connected account.

create table public.stripe_connected_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete restrict,
  stripe_account_id text not null unique check (stripe_account_id like 'acct_%'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.marketplace_products (
  id uuid primary key default gen_random_uuid(),
  seller_organization_id uuid not null references public.organizations(id) on delete restrict,
  stripe_connected_account_id uuid not null references public.stripe_connected_accounts(id) on delete restrict,
  stripe_product_id text not null unique check (stripe_product_id like 'prod_%'),
  stripe_price_id text not null unique check (stripe_price_id like 'price_%'),
  name text not null check (char_length(name) between 2 and 120),
  description text check (description is null or char_length(description) <= 1000),
  unit_amount_cents integer not null check (unit_amount_cents between 50 and 99999999),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products(id) on delete restrict,
  seller_organization_id uuid not null references public.organizations(id) on delete restrict,
  payer_organization_id uuid references public.organizations(id) on delete restrict,
  stripe_checkout_session_id text not null unique check (stripe_checkout_session_id like 'cs_%'),
  stripe_payment_intent_id text unique check (stripe_payment_intent_id is null or stripe_payment_intent_id like 'pi_%'),
  stripe_customer_id text check (stripe_customer_id is null or stripe_customer_id like 'cus_%'),
  amount_cents integer not null check (amount_cents > 0),
  application_fee_cents integer not null check (application_fee_cents >= 0 and application_fee_cents <= amount_cents),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'checkout_created' check (status in ('checkout_created','processing','paid','failed','expired','refunded','partially_refunded')),
  customer_email text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stripe_connect_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  payload_style text not null check (payload_style in ('snapshot','thin')),
  related_object_id text,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now()
);

create index marketplace_products_public_idx on public.marketplace_products (active, created_at desc);
create index marketplace_orders_seller_idx on public.marketplace_orders (seller_organization_id, created_at desc);
create index marketplace_orders_payer_idx on public.marketplace_orders (payer_organization_id, created_at desc);

alter table public.stripe_connected_accounts enable row level security;
alter table public.marketplace_products enable row level security;
alter table public.marketplace_orders enable row level security;
alter table public.stripe_connect_events enable row level security;

create policy "connect_accounts_read_organization" on public.stripe_connected_accounts for select to authenticated using (
  public.has_organization_role(organization_id, array['owner','admin']::public.membership_role[])
);
create policy "marketplace_products_public_read" on public.marketplace_products for select using (active);
create policy "marketplace_products_seller_read" on public.marketplace_products for select to authenticated using (
  public.has_organization_role(seller_organization_id, array['owner','admin','vendor']::public.membership_role[])
);
create policy "marketplace_orders_party_read" on public.marketplace_orders for select to authenticated using (
  public.is_organization_member(seller_organization_id) or (payer_organization_id is not null and public.is_organization_member(payer_organization_id))
);

comment on table public.stripe_connected_accounts is 'Organization-to-Stripe V2 connected-account mapping. Live onboarding status is read directly from Stripe.';
comment on table public.marketplace_products is 'Platform-level Stripe products sold for an organization through destination charges.';
comment on table public.marketplace_orders is 'Immutable marketplace checkout economics and provider identifiers; webhook-confirmed status only.';
comment on table public.stripe_connect_events is 'Idempotency ledger for Stripe Connect snapshot and V2 thin event destinations.';
