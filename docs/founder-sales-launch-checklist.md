# Founding Partner sales launch checklist

> Superseded on July 18, 2026: this document records the earlier one-payment implementation review. The canonical public offer is now a $299/year recurring subscription. Do not use the historical Checkout or launch steps below for a new sale; use the recurring membership instructions in `README.md`.

Review date: July 18, 2026  
Historical offer reviewed: Optimize Local Connect Founding Partner — $299 USD payment  
Planned production URL: `https://optimizelocalai.com`

## Readiness decision

**Not production-ready yet. Do not deploy the Founder checkout as live payment traffic.** The code-level controls and non-payment browser states pass, but a real Stripe test-mode checkout, signed webhook, database fulfillment, onboarding submission, admin approval/activation, public listing, and suspension cycle could not be executed because the local environment and live host do not have the required Stripe configuration. The live host also does not yet contain this reviewed build.

## Completed functionality

- `/founders` presents the one-time $299 offer, limitations, audience, benefits, process, FAQ, and repeated server-backed CTA.
- Checkout parameters are constructed server-side with `mode=payment`, one $299 USD line item, quantity one, customer creation, business-name collection, success/cancel URLs, and attempt metadata.
- Stripe webhook verification uses the raw body and `stripe-signature`, retrieves authoritative Stripe state, validates succeeded payment/product/amount/currency/metadata, and writes through an atomic database function.
- Payment, event, checkout-session, payment-intent, and onboarding uniqueness constraints make webhook redelivery idempotent.
- The success page validates the session ID shape and reads only the verified database record; query parameters cannot mark a payment paid.
- Paid onboarding access is exchanged server-side for an HttpOnly, SameSite cookie. The form supports drafts, validation, submission, image checks, and lifecycle statuses.
- `/admin/founders` and `/admin/founders/[id]` require a verified Super Admin on both reads and mutations. Admin actions cannot alter provider payment facts.
- Marketplace database functions expose only paid, approved, consented, active Founding Partners and exclude payment IDs, billing data, review notes, and internal notes.
- Public search/category/location/profile/contact/SEO/empty-state behavior is implemented.
- Suspension changes the organization/listing state used by public marketplace queries, so suspended vendors are excluded.

Issues fixed during this review:

- Removed nested homepage links around the reusable `Logo`, which caused a React hydration mismatch on Founder and marketplace pages.
- Moved Supabase client creation inside the guarded checkout block so missing configuration returns `checkout=unavailable` instead of an unhandled error.
- Added a safe payment-lookup failure state to `/founders/success`; database/configuration failures do not change payment state or expose secrets.
- Added regression tests for missing configuration, malformed session IDs, and invalid nested marketplace branding links.

## Automated test results

Command: `npm test`

- 78 tests passed, 0 failed, 0 skipped.
- TypeScript `tsc --noEmit` passed.
- ESLint passed after removing one unused import found by the first run.
- Focused checks cover fixed $299 parameters, signed webhook entry, authoritative Stripe retrieval, amount/product/metadata validation, duplicate webhook/payment/onboarding constraints, success-page trust boundaries, onboarding validation/access, Super Admin authorization, audited admin transitions, and marketplace visibility predicates.

Important limit: several payment/admin tests are contract tests against code and SQL. They do not replace a real Stripe test event and live Supabase transaction.

## Manual browser results

| Scenario | Result | Evidence / limitation |
| --- | --- | --- |
| `/founders` desktop (1280×720) | Pass | Offer, $299 price, limitations, three CTAs, FAQ, and trust copy render; no horizontal overflow. |
| `/founders` mobile (390×844) | Pass | No horizontal overflow; visible CTAs are 48px tall; cancel message and offer remain readable. |
| CTA with missing infrastructure configuration | Pass, fails closed | Returns “Secure checkout is temporarily unavailable” without a runtime error or secret disclosure. |
| Canceled checkout state | Pass, state only | `/founders?checkout=cancelled` clearly says no charge occurred. An actual Stripe-hosted cancellation is blocked by missing Stripe setup. |
| Missing session ID | Pass | Shows invalid-checkout state and never infers payment. |
| Fabricated session ID | Pass, configuration-limited | Shows a safe lookup-unavailable state with local configuration absent. With configured DB, an unknown valid-shaped ID is expected to remain “verification in progress.” |
| Repeated success refresh | Code verified | Read-only lookup; no fulfillment or mutation occurs on this page. Not exercised against a paid record. |
| Unauthorized onboarding/admin direct access | Code verified only | Server-side access and Super Admin checks are present. A configured auth session/test account is required for browser verification. |
| Full payment → webhook → onboarding → admin → marketplace → suspension | **Blocked** | No Stripe test secret, webhook secret, or Founder product ID is configured. |
| Supplied Stripe sandbox Payment Link | Valid Stripe page, incompatible with fulfillment | `https://buy.stripe.com/test_5kQcN778Ce3DdfK3nH0Fi00` charges $299 and collects email, full name, business name, and phone. It is named “Optimize Local Connect Founder Membership,” includes an unverified “one of only 50” claim, and does not create the server-side checkout-attempt metadata required by this application's webhook. |
| Declined Stripe card | **Blocked** | Requires a real Stripe test-mode Checkout Session. |
| Duplicate webhook event | Automated pass; manual blocked | Unique provider event/session/intent/payment/onboarding constraints are present. Requires signed webhook replay for end-to-end proof. |
| Webhook-before-redirect / redirect-before-webhook | Code verified; manual blocked | Fulfillment is webhook-only; success page shows pending until the verified DB row exists. Requires Stripe test mode to exercise ordering. |
| Database outage | Partial pass | Checkout and success lookup fail safely. Onboarding/admin transactional outage recovery was not exercised against a configured failing database. |
| Duplicate customer email | Known limitation | Duplicate webhook fulfillment is prevented, but separate legitimate Checkout Sessions may use the same email. The product rule for shared/multi-location emails must be decided before enforcing uniqueness. |

## Required production environment variables

Configure these in the production hosting dashboard; never prefix Stripe secrets with `NEXT_PUBLIC_`.

```text
NEXT_PUBLIC_APP_URL=https://optimizelocalai.com
NEXT_PUBLIC_SUPABASE_URL=<production Supabase project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<production anon key>
SUPABASE_SERVICE_ROLE_KEY=<production service-role key>
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_FOUNDING_PRODUCT_ID=prod_...
```

Current hosted configuration audit:

- Present: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Missing: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_FOUNDING_PRODUCT_ID`.
- Local development currently has none of the required application values.

Use Stripe test-mode values (`sk_test_...`, test product ID, test endpoint secret) for staging/local verification. Do not mix test and live IDs.

## Required Stripe dashboard configuration

1. Create or confirm one product named **Optimize Local Connect Founding Partner**.
2. The application creates inline one-time price data fixed at **$299.00 USD** and binds it to `STRIPE_FOUNDING_PRODUCT_ID`; do not configure a recurring price for this flow.
3. Create a webhook endpoint for:
   - `checkout.session.completed`
   - `checkout.session.expired`
4. Copy the endpoint signing secret into `STRIPE_WEBHOOK_SECRET`.
5. Keep Stripe in test mode until the entire final test below passes, then configure the corresponding live product, live secret key, and live webhook signing secret.

The supplied sandbox Payment Link must not replace the server-created Checkout Session. It may be archived or edited for separate use, but the `/founders` CTA must continue through the application's server action so the Checkout Session contains `founder_checkout_id` and `membership_type` metadata and is tied to a reserved database attempt.

Required production webhook URL:

```text
https://optimizelocalai.com/api/payments/stripe/webhook
```

For local forwarding after installing Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/payments/stripe/webhook
```

## Required database migrations

The linked Supabase migration history was previously verified through these Founder migrations:

- `202607140015_founding_partner_checkout.sql`
- `202607140016_founding_partner_onboarding.sql`
- `202607140017_founding_partner_admin.sql`
- `202607140018_public_founding_partner_marketplace.sql`

Before deployment, run `npx supabase migration list` and confirm local and remote versions still match. Apply any missing migration with the repository's normal Supabase deployment process before accepting a payment.

## Hosting deployment steps

1. Resolve every launch blocker below.
2. Add the seven required production variables to the Sites production project.
3. Run `npm test` and `npm run build` from a clean worktree.
4. Commit the review fixes and checklist.
5. Publish this exact commit to the existing Sites project; do not create a duplicate project.
6. Confirm the deployment health check and `/founders` response.
7. Register the production webhook URL in Stripe live mode and update `STRIPE_WEBHOOK_SECRET` if it was created after deployment.
8. Execute the final live test procedure before sending the sales link broadly.

## Final live test procedure

First complete this once in Stripe test mode on the deployed host, then perform one controlled real $299 live-mode purchase and refund it if business policy permits.

1. Open `/founders` in a private desktop window and a real mobile browser.
2. Click the CTA and confirm Stripe Checkout shows one one-time **$299.00 USD** line item and the correct product name.
3. Complete test payment with Stripe card `4242 4242 4242 4242`, any future expiry, any CVC, and a unique test email/business name.
4. In Stripe, confirm `checkout.session.completed` returned HTTP 200 from the required webhook URL.
5. Confirm exactly one payment row contains the Stripe customer/session/intent IDs, 29900 cents, USD, paid status, email/name, membership type, and paid timestamp.
6. Replay the same webhook event and confirm no duplicate payment or onboarding row appears.
7. Refresh the success page repeatedly; confirm it remains paid without additional writes and opens onboarding through the server exchange route.
8. Submit invalid/incomplete onboarding and verify inline errors; save a draft; reload; complete and submit the application.
9. Sign in as a non-admin and confirm both admin routes deny access. Sign in as Super Admin and verify the submitted record and immutable payment facts.
10. Approve and activate the vendor. Confirm the Founder badge/profile appears in search, category, location, and detail views without private fields.
11. Suspend the vendor and confirm it disappears from all public queries and direct profile access.
12. Exercise Stripe's declined test card `4000 0000 0000 0002` and confirm no paid/onboarding record is created.
13. Start and cancel a new checkout; confirm the no-charge cancel state.
14. Test redirect-before-webhook by temporarily delaying forwarding, then webhook-before-redirect by completing Checkout while the browser is closed. Both must converge on one paid record and one onboarding record.
15. Review logs for useful error context and absence of keys, raw signatures, billing details, or service-role credentials.

## Known limitations

- Customer-email uniqueness is intentionally not enforced because the business rule for owners managing multiple locations/businesses with one email is undefined. Duplicate Stripe sessions are still recorded separately so a real second charge is never discarded.
- The success page does not poll automatically; a vendor may need to use “Refresh payment status” while a delayed webhook is arriving.
- Image uploads accept JPG, PNG, and WebP up to 5 MB; there is no document-verification upload workflow.
- Automated tests validate substantial source/SQL contracts but do not run Stripe or Supabase emulators.

## Launch blockers

- [ ] Create/confirm the Stripe test and live Founder products and provide their product IDs.
- [ ] Rename or replace the supplied sandbox product so its customer-facing name is “Optimize Local Connect Founding Partner” and remove the unsupported “one of only 50” statement.
- [ ] Configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_FOUNDING_PRODUCT_ID` on the live host.
- [ ] Configure local/staging Supabase and Stripe test-mode environment variables.
- [ ] Install/authenticate Stripe CLI or otherwise deliver signed test webhooks.
- [ ] Execute and pass the complete test-mode journey, including webhook replay and event-order tests.
- [ ] Execute onboarding submission with a real paid database record.
- [ ] Verify authenticated non-admin denial and Super Admin review/approval/activation/suspension with real accounts.
- [ ] Confirm public listing appearance and removal after suspension against the production database.
- [ ] Decide whether multiple Founding Partner purchases may share one customer email and, if not, define a pre-checkout identity/deduplication policy.
- [ ] Re-run migration parity and production build checks.
- [ ] Deploy the reviewed commit; the current live site has not received it.
