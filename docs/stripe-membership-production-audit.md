# Stripe, memberships, entitlements, and Property Manager Perk production audit

> Historical pre-change audit. Its one-time-versus-annual conflict has been resolved in favor of the $299/year recurring Founding Partner subscription. Remaining production configuration findings are still relevant until separately verified.

Audit date: 2026-07-18  
Production origin: `https://optimizelocalai.com`  
Deployment recommendation: **NO-GO**

No deployment or production database mutation was performed during this audit. No secret value was copied into source, printed in this report, rotated, or overwritten.

## Executive result

The repository now has a single server-only Stripe client, signature-verified webhook handlers, centralized recurring-plan configuration, centralized TypeScript entitlements, database idempotency, a verified legacy-payment reconciliation path, and isolated Stripe Connect destination charges.

Production is not ready to sell memberships yet:

1. The linked production Supabase database contains migrations through `202607140018` only. Migrations `019`, `020`, `021`, and `022` are not applied.
2. The Sites production environment does not contain `STRIPE_WEBHOOK_SECRET`, `STRIPE_FOUNDING_PRODUCT_ID`, or any of the three recurring membership Price IDs.
3. The live Stripe product catalog has no Founding Vendor, Network Member, or Preferred Vendor products/prices.
4. Stripe has no standard billing webhook destination for `/api/payments/stripe/webhook`.
5. The public homepage Founder CTA and `/founders` still represent the legacy one-time first-year flow, while `/pricing` represents an annual recurring Founder subscription.
6. A newly signed-in vendor without an organization cannot self-create a vendor organization, so the recurring pricing CTA cannot yet complete the acquisition journey for a brand-new business.
7. The public marketplace read model remains specific to approved legacy Founder onboarding records. Network and Preferred membership entitlements do not yet create a publishable public profile by themselves.

## Architecture map

### A. Membership payments to Optimize Local Connect

These are direct platform revenue. Stripe Connect is not involved and the 3% marketplace application fee is not applied.

| Flow | Entry point | Stripe mode | Authority | Database result |
|---|---|---|---|---|
| Direct Founding Partner | `/founders` → `startFoundingPartnerCheckout` | One-time Checkout `payment` | Signed standard webhook plus retrieved Checkout Session and PaymentIntent | `founding_partner_checkout_attempts`, `founding_partner_payments`, one `founding_partner_onboardings` |
| Legacy Founding Fifty claim | `/founding-fifty/claim/[seatId]` | One-time Checkout `payment` | Signed standard webhook plus retrieved Checkout Session | `founding_claims`, `founding_payment_events`, then governed membership activation |
| Founding Vendor | `/vendor/membership` | Recurring Checkout `subscription`, $299/year | Signed standard webhook plus current Subscription retrieval | `vendor_billing_customers`, `vendor_memberships`, `vendor_membership_provider_events` |
| Network Member | `/vendor/membership` | Recurring Checkout `subscription`, $19/month | Same | Same |
| Preferred Vendor | `/vendor/membership` | Recurring Checkout `subscription`, $49/month | Same | Same |
| Billing management | `/vendor/membership` | Stripe Customer Portal | Authenticated organization role plus stored Customer mapping | Stripe remains billing authority; webhooks synchronize changes |

Canonical standard billing endpoint:

```text
POST /api/payments/stripe/webhook
```

Required subscription events:

```text
checkout.session.completed
checkout.session.expired
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
```

### B. Future marketplace/connected-account payments

These are optional payments for services sold through the marketplace. They are not vendor membership dues.

| Capability | Entry point | Stripe model | Database |
|---|---|---|---|
| Connected account onboarding | `/payments/connect` | V2 recipient account, Express dashboard | `stripe_connected_accounts` |
| Platform product creation | `/payments/connect` | Product and Price on platform account | `marketplace_products`, mapped to connected account |
| Storefront purchase | `/storefront` | Destination charge with `transfer_data.destination` | `marketplace_orders` |
| Platform fee | Checkout PaymentIntent | `STRIPE_CONNECT_APPLICATION_FEE_BPS=300` | Stored as `application_fee_cents` |
| Snapshot webhook | `/api/payments/stripe/marketplace-webhook` | Signed snapshot event | `stripe_connect_events` |
| Account requirements webhook | `/api/payments/stripe/connect-events` | Signed V2 thin event | `stripe_connect_events` |

Connect onboarding is optional for membership buyers. Membership Checkout never passes `transfer_data`, a connected account, or an application fee.

## Stripe implementation inventory

### Shared Stripe client

- `src/lib/stripe/client.ts` — only `new Stripe(...)` initialization; server-only.
- `src/lib/founding-fifty/stripe.ts` — legacy/direct Founder Checkout and standard webhook verification.
- `src/lib/stripe/memberships.ts` — recurring Price verification, subscription Checkout, and webhook synchronization.
- `src/lib/stripe/connect.ts` — V2 connected accounts, platform products, destination charges, and 3% fee calculation.

### Server actions and checkout UI

- `app/founders/actions.ts` — anonymous direct one-time Founder Checkout and paid onboarding.
- `app/(platform)/vendor/membership/actions.ts` — authenticated subscription Checkout and Customer Portal.
- `app/(platform)/payments/connect/actions.ts` — connected account and platform product operations.
- `app/storefront/actions.ts` — destination-charge Checkout.
- `app/(platform)/admin/founders/actions.ts` — verified legacy $299 Checkout reconciliation.
- `app/(platform)/admin/founding-fifty/actions.ts` — Stripe-verified manual claim confirmation.
- `app/founders/page.tsx`, `app/pricing/page.tsx`, `app/(platform)/vendor/membership/page.tsx`, and `app/storefront/page.tsx` — checkout entry surfaces.

### Webhooks

- `/api/payments/stripe/webhook` uses `STRIPE_WEBHOOK_SECRET` for platform membership and Founder payments.
- `/api/payments/stripe/marketplace-webhook` uses `STRIPE_MARKETPLACE_WEBHOOK_SECRET` for destination-charge Checkout snapshots.
- `/api/payments/stripe/connect-events` uses `STRIPE_CONNECT_THIN_WEBHOOK_SECRET` for V2 account thin events.

All read the raw request body before verification. Missing server configuration returns 500, a missing signature returns 400, and an invalid signature returns 401. No webhook grants access from redirect parameters.

## Plan and entitlement architecture

`src/domain/vendor-memberships/catalog.ts` is the canonical application plan map:

| Public plan | Canonical key | Existing DB code | Price |
|---|---|---|---|
| Founding Vendor | `founding_vendor` | `founding_partner` | $299/year |
| Network Member | `network_member` | `network_member` | $19/month |
| Preferred Vendor | `preferred_vendor` | `premium` | $49/month |

The key-to-code mapping intentionally preserves deployed database history while presenting consistent public names.

`src/domain/vendor-memberships/entitlements.ts` contains:

- `canAppearInDirectory`
- `canUsePropertyManagerPerk`
- `hasFounderBadge`
- `hasPreferredPlacement`
- `canReceiveOpportunities`
- `canAccessVendorDashboard`

Eligible statuses are `active`, `trialing`, `complimentary`, and `manually_granted`, subject to the paid-through date. `past_due`, `canceled`, `expired`, `paused`, and pending records do not grant access.

Database enforcement uses `public.vendor_has_entitlement`. Service-request RLS requires the `opportunities` entitlement. The corrective migration also prevents direct authenticated database writes from enabling or changing a public Perk without the current `property_manager_perk` entitlement.

## Property Manager Perk

Implemented safeguards:

- One set of fields on `vendor_profiles` and Founder onboarding records, with safe defaults.
- Controlled categories matching marketplace filter values.
- 80-character title, 280-character description, and 500-character terms limits.
- Plain-text validation and prohibited-claim checks in TypeScript and PostgreSQL.
- Disabled and expired Perks do not display.
- Founder and Preferred plans are entitled; Network access is centrally configurable and currently disabled.
- Server action checks organization role and current membership.
- Database trigger in migration `022` prevents direct API bypass when enabling/changing an entitled Perk.

Known limitation: current public Perk display is part of the Founder-specific public read model. Preferred profiles need the generalized paid-vendor publication flow before public Perks can launch for that tier.

## Duplicate and conflict findings

### Safe/intentional coexistence

- There is one Stripe client initialization.
- The three webhook endpoints are not duplicates; each has a distinct Stripe event domain and secret.
- Public plan keys differ from legacy DB codes through one centralized mapping rather than scattered aliases.
- `canceled` is canonical for new code; legacy `cancelled` and `paused` remain database-compatible so deployed records are not invalidated.

### Conflicts requiring product decisions or follow-up work

1. Three $299-era concepts coexist: Founding Fifty claims, direct Founding Partner first-year purchases, and recurring Founding Vendor subscriptions.
2. `/founders` says one-time; `/pricing` says annual recurring. Both are technically accurate for their separate implementations, but they cannot both be the canonical public launch offer.
3. The supplied sandbox Payment Link is not part of the repository Checkout metadata contract. It must not be used as the production fulfillment path.
4. Recurring Checkout requires an authenticated vendor organization. Public sign-in currently leaves new users waiting for an invitation instead of creating a vendor workspace.
5. The public marketplace requires an immutable verified $299 legacy payment plus approved Founder onboarding. A paid Network or Preferred membership alone cannot appear publicly.
6. Founder designation after a future plan switch needs a written policy. Customer Portal plan switching should remain disabled until this is decided.

## $299 Founder payment status

Current repository public `/founders` checkout:

- Server-created Stripe Checkout Session.
- One-time `payment` mode.
- Exactly $299 USD.
- Creates a Stripe Customer.
- Stores checkout attempt, Customer ID, Checkout Session ID, PaymentIntent ID, amount, currency, email/name, and paid timestamp.
- Requires signed webhook verification and a fresh Stripe retrieval.
- Creates one onboarding record idempotently.
- Does not create a Stripe Subscription and will not renew automatically.
- Grants no public membership until a Super Admin approves and activates the onboarding.
- Is not manageable as a subscription through Customer Portal.

The recurring Founding Vendor path is separate and will renew annually, but only after its production Price, environment variable, webhook, migrations, and authenticated-vendor acquisition path exist.

## Existing payment reconciliation

Migration `202607180022_stripe_membership_reconciliation.sql` and `/admin/founders` add an administrative reconciliation workflow for a legitimate older Checkout or Payment Link purchase.

The admin supplies a `cs_...` Checkout Session ID. The server retrieves Stripe and verifies:

- Checkout is complete and paid.
- Mode is one-time payment.
- Exactly one line item is present.
- Product matches `STRIPE_FOUNDING_PRODUCT_ID`.
- Amount is exactly 29,900 cents USD.
- PaymentIntent succeeded for the same amount/currency.
- A Stripe Customer and customer email exist.

The database operation is service-role-only, verifies the actor is a Super Admin, is duplicate-safe by Checkout Session and PaymentIntent, creates only the payment/onboarding records, and does not activate membership. Email-only reconciliation is impossible.

## Migrations

Remote migration inspection found production applied through `202607140018`.

Pending, in required order:

1. `202607180019_stripe_connect_marketplace.sql`
2. `202607180020_property_manager_perks.sql`
3. `202607180021_vendor_subscription_memberships.sql`
4. `202607180022_stripe_membership_reconciliation.sql`

`npx supabase db push --linked --dry-run` identified exactly these four pending migrations. The dry run made no database changes.

Migration `022` is corrective and additive. It does not rewrite already-applied history. It adds verified reconciliation and Perk enforcement, expands duplicate membership protection to granted memberships, centralizes normalized Stripe status input, and makes processed webhook events return without replaying side effects.

## Production environment variables

### Required for Supabase and public runtime

- `NEXT_PUBLIC_APP_URL` — browser-safe canonical HTTPS origin.
- `NEXT_PUBLIC_SUPABASE_URL` — browser-safe.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — browser-usable Supabase anon credential, stored as a Sites secret to reduce accidental disclosure.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only secret.

### Required for membership billing and legacy Founder fulfillment

- `STRIPE_SECRET_KEY` — server-only secret.
- `STRIPE_WEBHOOK_SECRET` — server-only standard billing endpoint secret.
- `STRIPE_FOUNDING_PRODUCT_ID` — server-only configuration for the legacy/direct $299 Product.
- `STRIPE_FOUNDING_VENDOR_PRICE_ID` — server-only $299/year recurring Price.
- `STRIPE_NETWORK_MEMBER_PRICE_ID` — server-only $19/month recurring Price.
- `STRIPE_PREFERRED_VENDOR_PRICE_ID` — server-only $49/month recurring Price.

### Required for Stripe Connect marketplace payments

- `STRIPE_CONNECT_APPLICATION_FEE_BPS=300` — non-secret business configuration.
- `STRIPE_MARKETPLACE_WEBHOOK_SECRET` — server-only snapshot endpoint secret.
- `STRIPE_CONNECT_THIN_WEBHOOK_SECRET` — server-only thin-event endpoint secret.

### Sites production configuration observed

Configured by name: `NEXT_PUBLIC_APP_URL`, the three Supabase variables, `STRIPE_SECRET_KEY`, and all three Connect variables.

Missing by name: `STRIPE_WEBHOOK_SECRET`, `STRIPE_FOUNDING_PRODUCT_ID`, `STRIPE_FOUNDING_VENDOR_PRICE_ID`, `STRIPE_NETWORK_MEMBER_PRICE_ID`, and `STRIPE_PREFERRED_VENDOR_PRICE_ID`.

## Stripe Dashboard inspection

Live-mode findings:

- Seven active products exist, but none are the three Optimize Local Connect membership products.
- Connect thin destination is active at `/api/payments/stripe/connect-events`, uses Thin payloads, and listens to the two required V2 account events.
- Marketplace destination is active at `/api/payments/stripe/marketplace-webhook`, uses Snapshot payloads, and listens to completed, async-payment-succeeded, and expired Checkout events.
- No standard billing destination exists for `/api/payments/stripe/webhook`.
- Customer Portal allows invoice history, customer/payment-method updates, and cancellation at period end.
- Customer Portal plan switching is disabled, which is the safe current setting.
- Customer Portal Terms and Privacy links are not configured.

No Stripe setting was changed during inspection.

## Files changed by this reconciliation audit

- `src/lib/founding-fifty/stripe.ts`
- `src/lib/stripe/memberships.ts`
- `src/lib/stripe/connect.ts`
- `src/lib/auth/origin.ts`
- `src/domain/vendor-memberships/status.ts`
- `app/api/payments/stripe/webhook/route.ts`
- `app/api/payments/stripe/marketplace-webhook/route.ts`
- `app/api/payments/stripe/connect-events/route.ts`
- `app/(platform)/vendor/membership/actions.ts`
- `app/(platform)/vendor/membership/page.tsx`
- `app/(platform)/vendor/page.tsx`
- `app/(platform)/vendor/perk-actions.ts`
- `app/(platform)/admin/founders/actions.ts`
- `app/(platform)/admin/founders/page.tsx`
- `app/(platform)/admin/founding-fifty/actions.ts`
- `app/(platform)/admin/founding-fifty/page.tsx`
- `app/pricing/page.tsx`
- `supabase/migrations/202607180022_stripe_membership_reconciliation.sql`
- `tests/founding-fifty.test.ts`
- `tests/founding-partner-checkout.test.ts`
- `tests/property-manager-perk.test.ts`
- `tests/stripe-connect.test.ts`
- `tests/vendor-memberships.test.ts`
- `README.md`
- `docs/stripe-membership-production-audit.md`

## Exact production test procedure

Do not use real cards until the complete sandbox sequence passes.

1. Apply migrations `019` through `022` to a staging/sandbox Supabase project first.
2. Create the three recurring membership products and Prices in a Stripe sandbox.
3. Set sandbox environment values, including the standard `STRIPE_WEBHOOK_SECRET` and three `price_...` IDs.
4. Add the standard billing webhook destination and seven required events.
5. Create or invite a test vendor organization and owner account.
6. Visit `/pricing`, select Founding Vendor, sign in, and confirm the intended plan remains selected.
7. Start Checkout from `/vendor/membership`; confirm Stripe shows $299 USD per year and no application fee/connected-account transfer.
8. Pay with Stripe test card `4242 4242 4242 4242`.
9. Confirm the success page remains processing until the signed webhook updates the database.
10. Confirm exactly one `vendor_memberships` row contains the Stripe Customer, Checkout Session, Subscription, Price, 29,900-cent amount, USD currency, annual interval, status, and next billing date.
11. Confirm exactly one processed provider-event row per Stripe event.
12. Redeliver each event and confirm no duplicate membership, membership event, or badge award.
13. Test failed renewal and confirm `past_due` removes directory, opportunity, dashboard, and Perk entitlements.
14. Test cancellation-at-period-end and confirm access remains through the paid-through date, then disappears after the deletion/end event.
15. Confirm Customer Portal opens only for the authenticated vendor organization.
16. Test one direct legacy `/founders` payment separately; confirm it is one-time, produces payment/onboarding records, and does not activate before admin review.
17. Reconcile the same legacy Checkout Session twice and confirm one payment/onboarding record.
18. Approve and activate a Founder; confirm public visibility and Perk display. Suspend it and confirm it disappears.
19. Confirm a paid Network and Preferred member cannot appear publicly until their approved public-profile workflow exists.
20. Repeat the complete sequence using live-mode products with an internal real purchase, then refund according to an approved refund policy.

## Remaining risks and blockers

- Pending production migrations mean current Connect webhooks target tables that do not exist in production.
- Membership billing products, Prices, environment variables, and standard webhook are missing in live mode.
- New-vendor self-service organization creation is missing.
- Public marketplace onboarding/publication is Founder-specific and does not launch Network/Preferred listings.
- Public Founder offer terms conflict between one-time and annual-recurring routes.
- No completed sandbox or live recurring membership transaction has verified the deployed Worker, Stripe webhooks, Supabase writes, and entitlement revocation together.
- Refund, dispute, transfer-reversal, and marketplace order-support policies/tools remain intentionally absent.
- Customer Portal legal links are missing.
- Production event destinations show no deliveries yet, so runtime delivery health has not been demonstrated.

## Deployment recommendation

**NO-GO.**

The production build and automated safety checks can pass while the production system remains nonfunctional because Stripe membership configuration and four database migrations are missing. Resolve the public Founder billing model, create the live Stripe products/prices and standard webhook, add the missing environment variables, apply migrations in staging then production, complete the acquisition/publication gaps, and execute the full sandbox procedure before deployment.
