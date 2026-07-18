import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { classifyPayPalEvent, extractClaimId, PayPalPaymentLinkAdapter } from "../src/domain/founding-fifty/payment";

const migration = readFileSync(new URL("../supabase/migrations/202607140008_founding_fifty.sql", import.meta.url), "utf8");
const checkoutMigration = readFileSync(new URL("../supabase/migrations/202607140014_founder_checkout_hardening.sql", import.meta.url), "utf8");
const stripeWebhook = readFileSync(new URL("../app/api/payments/stripe/webhook/route.ts", import.meta.url), "utf8");
const stripeAdapter = readFileSync(new URL("../src/lib/founding-fifty/stripe.ts", import.meta.url), "utf8");

test("PayPal outcomes distinguish verified, failed, cancelled, and irrelevant events", () => {
  assert.equal(classifyPayPalEvent("PAYMENT.CAPTURE.COMPLETED"), "verified");
  assert.equal(classifyPayPalEvent("PAYMENT.CAPTURE.DENIED"), "failed");
  assert.equal(classifyPayPalEvent("CHECKOUT.ORDER.CANCELLED"), "cancelled");
  assert.equal(classifyPayPalEvent("CUSTOMER.DISPUTE.CREATED"), "ignored");
});

test("claim IDs are extracted only from supported PayPal correlation fields", () => {
  const claimId = "1194b7d8-9a90-4f58-8dda-11f4364e29a7";
  assert.equal(extractClaimId({ resource: { purchase_units: [{ custom_id: claimId }] } }), claimId);
  assert.equal(extractClaimId({ id: claimId }), null);
  assert.equal(extractClaimId({ resource: { custom_id: "not-a-uuid" } }), null);
});

test("payment-link mode never represents a browser redirect as verified payment", async () => {
  const checkout = await new PayPalPaymentLinkAdapter("https://www.paypal.com/ncp/payment/test").createCheckout({ claimId: crypto.randomUUID(), amountCents: 29900, currency: "USD", returnUrl: "https://connect.test/return", cancelUrl: "https://connect.test/cancel" });
  assert.equal(checkout.mode, "payment_link");
  assert.equal(checkout.claimStatus, "awaiting_verification");
  assert.equal(checkout.providerReference, null);
});

test("database claim path locks seats and permits only one active hold", () => {
  assert.match(migration, /from public\.founding_seats where id=target_seat_id for update/i);
  assert.match(migration, /founding_claims_one_active_hold_idx[\s\S]*where status in \('pending_payment','payment_submitted','awaiting_verification'\)/i);
});

test("expired holds and unsuccessful payments release seats without erasing claims", () => {
  assert.match(migration, /release_expired_founding_holds/);
  assert.match(migration, /status='expired'/);
  assert.match(migration, /target_status not in \('payment_failed','payment_cancelled'\)/);
  assert.match(migration, /set status='available',hold_expires_at=null/);
});

test("manual approval and webhook verification use the same atomic confirmation", () => {
  assert.match(migration, /confirm_founding_claim/);
  assert.match(migration, /public\.is_super_admin\(\).*service_role/);
  assert.match(migration, /now\(\)\+interval '12 months'/);
  assert.match(migration, /'founding_fifty'/);
});

test("permanent founding numbers require an explicit audited reassignment", () => {
  assert.match(migration, /REASSIGN PERMANENT FOUNDING NUMBER/);
  assert.match(migration, /founding_fifty\.permanent_number_reassigned/);
  assert.match(migration, /unique \(program_id, seat_number\)/);
});

test("unauthorized seat mutation is excluded by RLS and admin procedures", () => {
  assert.match(migration, /alter table public\.founding_seats enable row level security/);
  assert.match(migration, /founding_configuration_admin_seats[\s\S]*public\.is_super_admin\(\)/);
  assert.match(migration, /if not public\.is_super_admin\(\) then raise exception 'super admin required'/);
});

test("duplicate webhook events are rejected at the database boundary", () => {
  assert.match(migration, /unique \(provider, provider_event_id\)/);
});

test("Stripe Checkout binds a server-priced session to the claim and product", () => {
  assert.match(stripeAdapter, /client_reference_id: input\.claimId/);
  assert.match(stripeAdapter, /metadata\[claim_id\]/);
  assert.match(stripeAdapter, /price_data\]\[unit_amount\]/);
  assert.match(stripeAdapter, /STRIPE_FOUNDING_PRODUCT_ID/);
});

test("Stripe fulfillment requires a signed, retrieved, fully-paid $299 session", () => {
  assert.match(stripeWebhook, /verifyStripeWebhook/);
  assert.match(stripeWebhook, /retrieveAndVerifyStripeCheckout/);
  assert.match(stripeAdapter, /payment_status !== "paid"/);
  assert.match(stripeAdapter, /amount_total !== 29900/);
  assert.match(stripeAdapter, /session\.currency\?\.toLowerCase\(\) !== "usd"/);
});

test("claim owners no longer receive broad direct update permission", () => {
  assert.match(checkoutMigration, /drop policy if exists "founding_claims_update_own_logo"/);
  assert.match(checkoutMigration, /revoke update on public\.founding_claims from authenticated/);
  assert.match(checkoutMigration, /set_founding_claim_logo/);
  assert.match(checkoutMigration, /set_founding_claim_checkout/);
});
