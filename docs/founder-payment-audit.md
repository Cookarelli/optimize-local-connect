# Founder membership sales and payment audit

> Historical audit. The canonical public offer was subsequently changed to a $299/year recurring subscription; see `README.md` and `docs/stripe-membership-production-audit.md` for the newer architecture.

Audit date: 2026-07-18. Scope: the full repository, with emphasis on the one-time $299 Founding Partner journey. No application behavior was changed.

## Executive finding

The repository has a strong Founding Fifty data model, a polished offer/availability page, atomic seat holds, a protected admin review screen, and an atomic provisioning procedure. It does **not** yet have a production checkout. The current checkout adapter redirects every claim to one generic PayPal payment link and ignores the claim ID, amount, currency, return URL, and cancel URL. Automatic payment-to-claim reconciliation therefore cannot work with this adapter; manual Super Admin approval is the only dependable completion path.

The advertised one-link journey also stops new vendors at an invite-only sign-in screen. After payment confirmation, only a minimal vendor profile is provisioned; there is no onboarding UI for services, coverage, credentials, or a complete marketplace listing.

## Current architecture

- **Framework/UI:** Next.js 16 App Router, React 19 Server Components and Server Actions, TypeScript, Tailwind CSS 4, TanStack React Query, Zod.
- **Routing:** filesystem App Router under `app/`; route groups `(auth)` and `(platform)`; `proxy.ts` refreshes sessions and protects platform prefixes.
- **Database:** hosted Supabase PostgreSQL accessed through Supabase/PostgREST and RPC functions. Forward-only SQL is in `supabase/migrations/`; there is no Prisma ORM. The empty `db/` and `drizzle/` directories are not used.
- **Authentication:** Supabase Auth with SSR cookies. Password, magic-link, Google OAuth, recovery, and organization invitations exist. The documented/default product is invite-only; magic-link sign-in explicitly sets `shouldCreateUser: false`.
- **Authorization:** application role checks plus PostgreSQL RLS. Global administration is `profiles.is_super_admin`; vendor access is through `organization_members`.
- **Hosting:** Vinext/Vite builds a Cloudflare Worker-compatible app for the OpenAI Sites deployment surface (`.openai/hosting.json`, `vite.config.ts`, `worker/index.ts`). Sites D1/R2 bindings are `null`; Supabase remains the external system of record. The worker also redirects `www.optimizelocalai.com` to the apex. Repository configuration does not prove which hosted environment variables, Supabase migrations, DNS, or PayPal webhook are currently live.
- **Payments:** PayPal only. There is no Stripe package, Stripe environment variable, Stripe route, or Stripe webhook. The implemented PayPal pieces are a generic payment-link adapter and a signature-verifying webhook handler.

## Relevant application inventory

### Pages and components

- `app/page.tsx`: public marketing page. Its `#pricing` section is property-management pricing, while its Founding Fifty section links to the founder offer.
- `app/founding-fifty/page.tsx`: public $299 offer, benefits, live/fallback seat board, and seat selection.
- `app/founding-fifty/claim/[seatId]/page.tsx`: authenticated business-information intake and order summary.
- `src/components/founding-fifty/claim-form.tsx`: business/contact/city/description/logo/terms form.
- `app/founding-fifty/confirmation/[claimId]/page.tsx`: authenticated claim-status page; reads database state rather than URL payment parameters.
- `app/(platform)/vendor/membership/page.tsx`: Free, Verified, Premium, and Founding Partner catalog. Founding Partner links back to the Founding Fifty page; Premium only opens email.
- `app/(platform)/vendor/page.tsx`: vendor operations dashboard and current membership summary.
- `app/(platform)/onboarding/page.tsx`: placeholder telling users without an organization to wait for assignment; it is not vendor onboarding.
- `app/(platform)/marketplace/page.tsx` and `app/(platform)/marketplace/[slug]/page.tsx`: authenticated marketplace search and vendor detail.
- `app/(platform)/admin/page.tsx`: admin landing; its platform-wide controls are rendered only for Super Admin.
- `app/(platform)/admin/founding-fifty/page.tsx`: Super Admin seat, claim, manual payment, display, revenue, reservation, reassignment, and resend UI.
- `app/(auth)/sign-in/*`, `src/components/auth/sign-in-form.tsx`, and `app/auth/callback/route.ts`: authentication gate encountered by a buyer.

### Server actions and API routes

- `app/founding-fifty/claim/[seatId]/actions.ts`: validates input, calls `claim_founding_seat`, uploads an optional logo, and redirects to PayPal or confirmation.
- `app/(platform)/admin/founding-fifty/actions.ts`: manual confirmation, rejection/release, reservation, display edits, reassignment, and confirmation resend enqueueing.
- `app/(platform)/admin/founding-fifty/export/route.ts`: Super Admin CSV export of seat display data.
- `app/api/payments/paypal/webhook/route.ts`: verifies PayPal webhook signatures, stores an idempotent event, and calls claim confirmation/outcome RPCs.
- `app/api/vendor-memberships/route.ts`: authenticated membership catalog/current membership read.
- `app/api/marketplace/vendors/route.ts`: authenticated marketplace search.
- `app/(auth)/sign-in/actions.ts`: password, magic-link, Google OAuth, and sign-out actions.

### Payment and marketplace domain code

- `src/domain/founding-fifty/payment.ts`: payment contract, event classification, claim-ID extraction, and generic PayPal payment-link adapter.
- `src/lib/founding-fifty/paypal.ts`: server-only PayPal OAuth and webhook-signature verification.
- `src/lib/founding-fifty/board.ts`: database-backed availability with a non-live configured fallback.
- `src/domain/founding-fifty/catalog.ts`: 25 industries, benefits, and initial reservations.
- `src/domain/vendor-memberships/catalog.ts`: application membership catalog.
- `src/domain/vendor-memberships/marketplace.ts`: marketplace result parsing.
- `src/lib/supabase/{browser,server,admin,proxy}.ts`: anon/session/service-role clients and auth proxy.

### Database tables directly involved

- **Identity/ownership:** `profiles`, `organizations`, `organization_members`, `user_preferences`, `organization_invitations`.
- **Founder sale/payment:** `founding_programs`, `founding_verticals`, `founding_seats`, `founding_claims`, `founding_benefits`, `founding_member_benefits`, `founding_payment_events`.
- **Membership/listing:** `vendor_profiles`, `vendor_membership_levels`, `vendor_memberships`, `vendor_membership_events`, `vendor_badges`, `vendor_badge_awards`, `vendor_categories`, `vendor_category_assignments`, `vendor_services`, `vendor_service_offerings`, `cities`, `vendor_service_cities`, `vendor_verifications`, `vendor_marketplace_media`, `vendor_coupons`, `vendor_reviews`.
- **Operations:** `audit_events` and `outbox_events`.

The primary schema is in migrations `202607140001`, `002`, `004`, `008`, and `010`. Migration `008` owns the Founding Fifty lifecycle; migration `010` normalizes confirmed members to the governed `founding_partner` tier with a $29,900 one-time price and capacity 50.

## Existing payment flow

1. `/founding-fifty` reads the active program, benefits, verticals, and 50 seats. Without Supabase public configuration it renders a non-live fallback and disables claim buttons.
2. A vendor selects an available seat. The claim route requires an existing authenticated Supabase user.
3. `claim_founding_seat` locks the seat row, expires an old hold if needed, inserts the business/contact record, creates a 30-minute hold, and writes an audit event. A partial unique index prevents two active holds for one seat.
4. The optional logo is stored in the public `founding-fifty-logos` bucket.
5. If `NEXT_PUBLIC_PAYPAL_PAYMENT_URL` exists, `PayPalPaymentLinkAdapter` redirects to exactly that URL and marks the claim `awaiting_verification`. If it is absent, the buyer goes directly to the pending confirmation page.
6. A Super Admin can manually enter a payment reference and confirm. Alternatively, a verified PayPal webhook can confirm only if its JSON contains the claim UUID in `custom_id`, `invoice_id`, or `claim_id`.
7. `confirm_founding_claim` atomically creates a vendor organization/profile/owner membership when needed, activates 12 months of Founding Partner/Premium entitlements, awards badges and benefits, claims the permanent seat, writes audit/outbox records, and makes a repeated confirmation a no-op.

## What currently works

- The offer clearly states $299 one-time, limited capacity, included benefits, and live seat availability.
- Database pricing is stored as 29,900 cents/USD, and the Founding Partner catalog is capacity-limited to 50.
- Seat claiming is transactional and concurrency-safe; unsuccessful and expired claims are retained.
- The confirmation page does not trust `?payment=success` or similar browser parameters.
- PayPal secrets and the Supabase service-role key are imported only by `server-only` modules; no secret key is intentionally shipped to browser code. The Supabase anon key and payment-link URL are public by design.
- PayPal webhook signatures are checked with PayPal before event processing.
- Provider webhook event IDs are unique, and membership activation has a separate idempotency ledger.
- Super Admin pages/actions and the CSV export perform server-side role checks and are backed by RLS/procedure checks. No unsecured founder-admin route was found.
- Marketplace membership placement, badges, entitlements, credential checks, and listing/search schema exist.
- `npm run build` succeeds. `npm test` passes 48 tests, TypeScript, and lint; lint reports one non-blocking `<img>` performance warning.

## Incomplete, broken, mocked, or missing

### Checkout and payment verification

- The generic PayPal link adapter ignores every checkout input. It does not create an order, set the amount, attach `claimId` as `custom_id`, set return/cancel URLs, or save a PayPal order/capture ID.
- Because the outgoing payment has no claim correlation, the current webhook cannot normally find the claim. The documented automatic path and the implemented payment-link path do not connect.
- The webhook treats `CHECKOUT.ORDER.APPROVED` as paid. Approval is not the same as a completed capture.
- Webhook processing does not validate captured amount (must be 299.00), currency (USD), merchant/payee, order/capture status, or that the provider reference belongs to the stored claim before provisioning.
- The action hard-codes 29,900 cents instead of using the claim/program amount, and it does not check the result of the post-claim status update.
- `PAYPAL_FOUNDING_FIFTY_PLAN_OR_PRODUCT_ID` is documented but unused.
- There is no server-side create-order/capture endpoint, checkout-session table/state, refund/dispute handling, reconciliation job, or end-to-end PayPal sandbox test.
- A payment completed after the 30-minute hold expires will be recorded but cannot be provisioned automatically; this creates a paid-but-unfulfilled support case.

### Vendor acquisition and onboarding

- A brand-new vendor cannot use the link end-to-end: the claim page redirects to an invite-only sign-in flow, and email magic links refuse to create users.
- The claim form saves business information before payment, but confirmation copies only name and description into the vendor organization/profile. Website and phone are not copied; the text city/industry are not normalized into city coverage, categories, or services.
- There is no post-payment onboarding form for legal/business details, service categories, service offerings, coverage cities, license, insurance, or listing review/submission status.
- `/onboarding` is only a “workspace is being assigned” placeholder.
- Confirmation-email actions only enqueue `outbox_events`; no repository worker consumes those events or sends email.
- Marketplace and its API are authentication-only. A newly created unverified vendor may appear in the security-definer search result, but its detail page can be unreadable to other users until verification because direct organization reads are RLS-restricted.
- The confirmation page does not poll or refresh automatically while a webhook is processing.
- The admin CSV exports seat display data, not the complete claim/contact/payment review record.

## Security, integrity, and duplication risks

| Severity | Risk |
| --- | --- |
| Critical | `founding_claims_update_own_logo` is not column-limited. An authenticated owner of a pending claim has table `UPDATE` permission and can update any claim columns allowed by the row check, including status/payment-related fields. The UI uses it only for `logo_url`, but the database boundary does not enforce that intent. |
| Critical | A verified webhook can provision from `CHECKOUT.ORDER.APPROVED`, without proving capture or validating $299/USD/payee. |
| High | The generic payment link has no claim/order correlation, so automatic fulfillment is effectively broken and manual matching can attach the wrong transaction. |
| High | `confirm_founding_claim` creates a new vendor organization whenever `claim.vendor_id` is null. It does not look for an existing vendor membership owned by the buyer, so repeat purchases can create duplicate vendor organizations/profiles. |
| High | The unique `payment_reference` constraint receives the webhook event ID, not the PayPal order/capture transaction ID. Event idempotency is good, but transaction reuse/reconciliation is not modeled correctly. |
| Medium | Claims accept an editable email that is not required to match the authenticated account email. This can misdirect confirmations and complicate ownership/review. |
| Medium | Public logo upload checks declared MIME type and size but not decoded image content. |
| Medium | No rate limiting, bot protection, or abuse controls exist around account creation/claim attempts. Authentication currently reduces anonymous spam but also blocks acquisition. |
| Operational | Repository state cannot establish that production migrations, PayPal live credentials/webhook ID, SMTP, or hosted runtime variables are configured. `PAYPAL_MODE` defaults to sandbox. |

## Shortest production-ready path

Keep the existing Supabase schema, seat lifecycle, admin UI, and PayPal provider, but replace payment-link mode with a server-created PayPal Orders flow.

1. **Harden the database first.** Add a forward-only migration that revokes broad claim updates and exposes a narrow `set_founding_claim_logo` RPC; model unique provider order and capture IDs; add a trusted payment-confirmation function that requires verified amount/currency; and define existing-vendor reuse/one-business rules.
2. **Create a real PayPal order server-side.** Read amount/currency from the saved claim, set `custom_id = claim.id`, set return/cancel URLs, save the PayPal order ID, and redirect to its approval URL. Never accept price or paid state from the browser.
3. **Confirm only completed capture.** Process `PAYMENT.CAPTURE.COMPLETED`; validate order/capture ID, custom ID, 299.00 USD, merchant/payee, and claim state before calling the atomic provisioning function. Store the transaction ID separately from the event ID. Define late-payment and refund/dispute handling.
4. **Open a controlled buyer account path.** Add founder-specific email OTP account creation (or an equivalent signed guest-claim flow) so a vendor sent the offer link can create an account and return to the selected seat without an admin invitation.
5. **Complete onboarding and review.** Copy basic organization fields at confirmation, then collect normalized services, coverage, and credentials; introduce an explicit listing review status; surface all claim/payment data to Super Admin.
6. **Add delivery and verification.** Implement an outbox consumer for confirmation email, add PayPal sandbox integration tests plus duplicate/late/amount-mismatch tests, and run one staging purchase/webhook/refund cycle before enabling live mode.

## Files to modify

Minimum payment slice:

- `src/domain/founding-fifty/payment.ts`
- `src/lib/founding-fifty/paypal.ts`
- `app/founding-fifty/claim/[seatId]/actions.ts`
- `app/api/payments/paypal/webhook/route.ts`
- `app/founding-fifty/confirmation/[claimId]/page.tsx`
- `.env.example`
- `tests/founding-fifty.test.ts` plus new webhook/integration tests
- a new forward-only migration after `202607140013_public_marketplace_search_execute.sql`

Follow-on acquisition/onboarding slice:

- `app/(auth)/sign-in/actions.ts` and `src/components/auth/sign-in-form.tsx` (or a dedicated founder access route)
- `app/founding-fifty/claim/[seatId]/page.tsx`
- `src/components/founding-fifty/claim-form.tsx`
- `app/(platform)/onboarding/page.tsx` and new vendor onboarding actions/components
- `app/(platform)/admin/founding-fifty/page.tsx` and export route
- outbox delivery worker/route (new)
- marketplace detail/search policy or listing-review changes
- `docs/founding-fifty.md`, `docs/vendor-memberships.md`, and `docs/authentication.md`

## Environment variables

Currently required/documented:

- `NEXT_PUBLIC_APP_URL` — canonical origin.
- `NEXT_PUBLIC_SUPABASE_URL` — public Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — browser-safe anon key; RLS remains mandatory.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, required by the webhook/admin delivery paths.
- `PAYPAL_CLIENT_ID` — server-only.
- `PAYPAL_CLIENT_SECRET` — server-only.
- `PAYPAL_WEBHOOK_ID` — server-only.
- `PAYPAL_MODE` — `sandbox` or `live`; explicitly set `live` in production.
- `NEXT_PUBLIC_PAYPAL_PAYMENT_URL` — current generic-link mode only; remove after Orders integration.
- `PAYPAL_FOUNDING_FIFTY_PLAN_OR_PRODUCT_ID` — currently unused; remove unless a deliberate PayPal product contract needs it.

Likely additions depend on implementation: a server-only expected PayPal merchant ID and email-provider/API credentials for the outbox consumer. Do not add Stripe variables unless the provider decision changes.

## Database changes required

- Replace broad owner updates on `founding_claims` with a narrow, audited logo-update function/policy.
- Add distinct, unique `provider_order_id` and `provider_capture_id` (or a normalized checkout/payment-attempt table); do not use webhook event IDs as transaction references.
- Persist expected amount/currency and verified captured amount/currency/payee/status for reconciliation.
- Add a safe association/reuse rule for an authenticated user's existing vendor organization and a uniqueness rule matching the business decision (for example, one Founding Partner membership per vendor organization).
- Extend confirmation to copy organization phone/website and use the governed `activate_vendor_membership` path directly rather than relying on trigger normalization.
- Add listing onboarding/review state and normalized category/city/service/credential writes if those are required before marketplace publication.
- Add indexes for provider order/capture lookup and unresolved/late payment reconciliation.

## Risks and blockers

- **Launch blocker:** no correlated provider-created checkout and insufficient capture validation.
- **Launch blocker:** overly broad claim update permission.
- **Business-flow blocker:** new vendors require a pre-existing invited account.
- **Fulfillment blocker:** no email/outbox processor and no complete vendor onboarding/review workflow.
- **Configuration blocker:** live PayPal merchant, webhook registration, hosted secrets, production Supabase migration state, SMTP, and callback allowlists must be verified outside the repository.
- **Policy decision needed:** whether one vendor may buy multiple industry seats, how existing vendor organizations are matched/reused, what happens to late successful payments, and the refund/cancellation terms.

## Exact next implementation step

Create migration `202607140014_founder_checkout_hardening.sql` to close the broad `founding_claims` update policy and add unique PayPal order/capture reconciliation fields (with expected and captured amount/currency). Then replace the generic payment-link adapter with server-created PayPal Orders using `custom_id = claim.id`. This is the first coherent slice that makes every later UI/onboarding step safe to build on.
