# Optimize Local Connect™

An AI-powered community operating platform from **Optimize Local™** that connects local organizations with trusted providers, shared workflows, and better decisions.

**Company tagline:** Optimize Local. Maximize Savings.

**Mission:** Save Time. Save Money. Strengthen Communities.

> “We're not building software. We're building stronger local economies—one optimized decision at a time.”

## Platform evolution

Optimize Local Connect is not a rebuild of the original property platform. It preserves the production authentication, permissions, marketplace, work-order, review, role, and Supabase foundations while making industry context explicit and modular.

Property Management is Version 1. HOAs, Homeowners, Realtors, Local Governments, Schools, Healthcare, Nonprofits, and Service Marketplaces are registered as planned community-marketplace verticals. Every vertical composes the same reusable identity, organization, geography, provider marketplace, communication, analytics, audit, event, and Optimize AI™ foundations. Existing property- and vendor-named database tables remain stable to protect migrations, APIs, policies, and deployed data.

## What is implemented

- Multi-tenant PostgreSQL schema for shared platform foundations and the Property Management launch vertical
- Unlimited cities and markets with organization-scoped access
- Additive industry-vertical registry, reusable module catalog, and organization activation model
- Local provider marketplace, service requests, quotes, work orders, invoices, reviews, warranties, and appliance inventory
- Supabase Auth with password, magic-link, Google OAuth, recovery, and expiring organization invitations
- Provider-ready Microsoft and Apple sign-in configuration
- Seven application roles with explicit permissions and PostgreSQL row-level security
- Mobile-first public experience and authenticated, role-routed workspaces
- Optimize AI™ provider-neutral decision engine, auditable ranking API, governed tool execution, transactional outbox, and immutable audit events

## Stack

- Next.js App Router, React Server Components, TypeScript, Tailwind CSS
- Supabase Auth and PostgreSQL
- TanStack React Query
- Zod input and environment validation
- Vinext/Cloudflare build target for the Sites deployment surface

Prisma is intentionally not included. Supabase/PostgREST plus PostgreSQL RLS is the primary data-access and authorization boundary. A second ORM abstraction would duplicate the schema model and obscure policy behavior.

## Local setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and add the project URL and anon key.
3. Apply every file in `supabase/migrations` in filename order with `supabase db push` or the SQL editor.
4. Configure the Supabase Auth site URL as `http://localhost:3000` and allow `http://localhost:3000/auth/callback` as a redirect URL.
5. Run `npm run dev`.

The product is invite-only by default. Create the first authenticated user, then set `profiles.is_super_admin = true` from the Supabase dashboard. Platform administrators can then create organizations and memberships through trusted server-side workflows.

## Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
```

## Founding Partner Stripe checkout development

The canonical `/founders` offer is a **$299/year recurring subscription**. The first charge is collected immediately in hosted Stripe Checkout and the subscription renews automatically every 12 months until canceled. The public CTA sends the customer through sign-in to the vendor membership flow; the server selects the configured annual Price and uses Stripe Checkout `subscription` mode. Only signed Stripe webhooks update membership status.

Add these server-side values to `.env.local`:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_FOUNDING_PRODUCT_ID=prod_...
STRIPE_FOUNDING_VENDOR_PRICE_ID=price_...
```

- `STRIPE_SECRET_KEY` is the Stripe test-mode secret key. Never prefix it with `NEXT_PUBLIC_` or expose it in browser code.
- `STRIPE_WEBHOOK_SECRET` is printed by the local Stripe listener. It is different from the Dashboard endpoint secret.
- `STRIPE_FOUNDING_PRODUCT_ID` and `STRIPE_FOUNDING_VENDOR_PRICE_ID` identify the Stripe Product and recurring annual Price for **Optimize Local Connect Founding Partner**: 29,900 cents, USD, yearly. IDs are never hardcoded in source.
- `NEXT_PUBLIC_APP_URL` must be `http://localhost:3000` locally and the canonical HTTPS origin in production.
- The existing Supabase URL, anon key, and server-only service-role key are also required because checkout capacity, payments, and onboarding are persisted in Supabase.

Apply all Supabase migrations, start the app, then forward Stripe test events:

```bash
npx supabase db push
npm run dev
stripe login
stripe listen --events checkout.session.completed,checkout.session.expired,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_failed --forward-to localhost:3000/api/payments/stripe/webhook
```

Copy the listener's `whsec_...` value into `.env.local`, restart the app, visit `/founders`, and click **Become a Founding Partner**. Sign in to a vendor organization and complete Checkout. In Stripe test mode use card number `4242 4242 4242 4242`, any future expiration date, any three-digit CVC, and any valid postal code. Do not use real card details in test mode.

After payment, confirm the subscription-backed membership in the Supabase SQL editor:

```sql
select vm.status, vm.external_subscription_id, vm.stripe_customer_id,
       vm.stripe_price_id, vm.amount_cents, vm.currency,
       vm.billing_interval, vm.next_billing_at, vml.code
from public.vendor_memberships vm
join public.vendor_membership_levels vml on vml.id = vm.membership_level_id
where vml.code = 'founding_partner'
order by vm.created_at desc
limit 10;
```

A successful test shows `active`, `29900`, `USD`, `year`, `founding_partner`, and one Stripe subscription ID. Re-delivering the same event must not create another membership or provider-event row.

## Recurring vendor memberships

Apply `202607180021_vendor_subscription_memberships.sql` and then the additive corrective migration `202607180022_stripe_membership_reconciliation.sql` after the Founder, Connect, and Property Manager Perk migrations. Create three recurring Products and Prices on the Stripe platform account and configure:

```bash
STRIPE_FOUNDING_PRODUCT_ID=prod_...
STRIPE_FOUNDING_VENDOR_PRICE_ID=price_...   # $299 USD recurring yearly
STRIPE_NETWORK_PRODUCT_ID=prod_...
STRIPE_NETWORK_MEMBER_PRICE_ID=price_...    # $19 USD recurring monthly
STRIPE_PREFERRED_PRODUCT_ID=prod_...
STRIPE_PREFERRED_VENDOR_PRICE_ID=price_...  # $49 USD recurring monthly
```

The application retrieves each Price before Checkout and rejects inactive Prices or a mismatched Product, amount, currency, or interval. `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`, and the Supabase variables remain required. The existing `/api/payments/stripe/webhook` destination must subscribe to:

```text
checkout.session.completed
checkout.session.expired
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
```

Enable and configure the Stripe Customer Portal for subscription cancellation, payment-method updates, and invoices. Portal plan switching should remain disabled until a deliberate plan-change workflow and Founder-designation policy are approved. The portal return URL is created server-side from `NEXT_PUBLIC_APP_URL`.

Historical $299 Founder payments remain authoritative in `founding_partner_payments` for reconciliation. They are not the canonical public offer and must not be silently converted into subscriptions or charged again. New Founding Partner purchases use the annual Stripe Price. Founder benefits remain attached while the membership is active, trialing, or in the time-bounded `past_due` billing grace state.

A Super Admin may reconcile a legitimate older Payment Link or Checkout purchase from `/admin/founders` by entering its `cs_...` Checkout Session ID. The server retrieves the session directly from Stripe and requires the configured Founder Product, one paid $299 USD line item, a successful matching PaymentIntent, and a Stripe Customer. Reconciliation creates only the payment and onboarding records; it does not activate directory access before review. Email alone is never accepted.

For local subscription testing:

```bash
stripe listen --events checkout.session.completed,checkout.session.expired,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_failed --forward-to localhost:3000/api/payments/stripe/webhook
```

Use Stripe test card `4242 4242 4242 4242`, then verify one current membership and an idempotent event ledger:

```sql
select vm.status,vm.external_subscription_id,vm.stripe_customer_id,vm.stripe_price_id,
       vm.amount_cents,vm.currency,vm.next_billing_at,vml.code
from public.vendor_memberships vm join public.vendor_membership_levels vml on vml.id=vm.membership_level_id
order by vm.created_at desc limit 10;

### New vendor enrollment before Checkout

Apply `202607180023_vendor_self_service_enrollment.sql` after the subscription migrations. A new vendor selects a plan, verifies their identity, and submits business/contact details at `/onboarding?plan=...`. One database transaction creates or resumes the private `vendor_enrollments` record, an `onboarding` organization, its pending vendor profile, an active owner relationship, and a `pending` membership. Stripe is not called until that transaction succeeds.

Checkout metadata includes `organization_id`, `user_id`, `membership_record_id`, `membership_tier`, and `onboarding_version`. Stripe customer and Checkout identifiers are attached to the pending membership when available. Repeated form submissions reuse the normalized owner/business enrollment; network failures reuse the same Checkout idempotency key; expired Checkout Sessions increment the attempt number and remain resumable. Only a verified subscription webhook moves the organization out of onboarding status.

select provider_event_id,event_type,membership_id,processed_at,processing_error
from public.vendor_membership_provider_events order by created_at desc limit 20;
```

## Stripe Connect marketplace development

Connect is separate from the $299 Founder purchase. Founder payments are direct platform revenue. Connect is an optional organization-level payment rail for future services sold by property managers or vendors. Organizations can still transact outside the platform.

Install dependencies and apply `202607180019_stripe_connect_marketplace.sql`, then add:

```bash
# PLACEHOLDER: use sk_test_... locally; never expose this to browser code.
STRIPE_SECRET_KEY=sk_test_...
# Approved marketplace fee: 300 basis points = 3%.
STRIPE_CONNECT_APPLICATION_FEE_BPS=300
# Snapshot endpoint signing secret from Stripe CLI or Dashboard.
STRIPE_MARKETPLACE_WEBHOOK_SECRET=whsec_...
# Thin V2 Account-event destination signing secret.
STRIPE_CONNECT_THIN_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

The integration uses stripe-node `22.3.2` and one server-only Stripe client. It does not set an API version: the SDK uses its bundled version automatically. V2 account creation never sends legacy top-level `type`; it creates an Express-dashboard recipient account with the platform responsible for fees and losses.

Start two local listeners in separate terminals. Snapshot Checkout events and V2 thin Account events require separate destinations and separate signing secrets:

```bash
stripe listen \
  --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.expired \
  --forward-to localhost:3000/api/payments/stripe/marketplace-webhook

stripe listen \
  --thin-events 'v2.core.account[requirements].updated,v2.core.account[configuration.recipient].capability_status_updated' \
  --forward-thin-to localhost:3000/api/payments/stripe/connect-events
```

Sign in as an organization owner or admin and visit `/payments/connect`. Click **Onboard to collect payments**, complete Stripe’s test onboarding, and create a storefront product. Visit `/storefront` and use test card `4242 4242 4242 4242`. The success page remains in a processing state until the signed snapshot webhook records the payment.

Confirm records with:

```sql
select organization_id, stripe_account_id from public.stripe_connected_accounts;
select name, unit_amount_cents, currency, active from public.marketplace_products;
select stripe_checkout_session_id, stripe_payment_intent_id, amount_cents,
       application_fee_cents, status, paid_at
from public.marketplace_orders order by created_at desc;
select stripe_event_id, event_type, payload_style, processed_at, processing_error
from public.stripe_connect_events order by created_at desc;
```

Important: Connect does not eliminate card-processing costs. With destination charges, Stripe debits processing fees, refunds, and disputes from the platform balance. The application fee must be chosen to recover those costs and any commission. Refund tooling is intentionally not exposed until the business policy for approvals, transfer reversal, partial refunds, and disputes is finalized.

## Security model

Application permission checks shape the UI and protect server operations. PostgreSQL RLS independently controls every tenant-owned table. Never use the service-role key in browser code. Administrative invitations and platform mutations must run in a trusted server context, validate the actor, and write an `audit_events` row in the same business transaction.

Read [architecture](docs/architecture.md), [Optimize AI](docs/optimize-ai.md), [Impact Engine](docs/impact-engine.md), [Optimize Local Exchange](docs/optimize-local-exchange.md), [vendor marketplace memberships](docs/vendor-memberships.md), [vertical modules](docs/platform-verticals.md), [permissions](docs/permissions.md), [database schema](docs/database-schema.md), and [authentication](docs/authentication.md) before adding a capability.
