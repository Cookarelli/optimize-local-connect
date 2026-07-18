import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildFoundingPartnerCheckoutParams,
  FOUNDING_PARTNER_AMOUNT_CENTS,
  FOUNDING_PARTNER_CURRENCY,
  FOUNDING_PARTNER_MEMBERSHIP_TYPE,
  FOUNDING_PARTNER_PRODUCT_NAME,
  isFoundingPartnerStripeEvent,
} from "../src/domain/founding-partner/checkout";

const migration = readFileSync(new URL("../supabase/migrations/202607140015_founding_partner_checkout.sql", import.meta.url), "utf8");
const webhook = readFileSync(new URL("../app/api/payments/stripe/webhook/route.ts", import.meta.url), "utf8");
const stripe = readFileSync(new URL("../src/lib/founding-fifty/stripe.ts", import.meta.url), "utf8");
const successPage = readFileSync(new URL("../app/founders/success/page.tsx", import.meta.url), "utf8");
const checkoutAction = readFileSync(new URL("../app/founders/actions.ts", import.meta.url), "utf8");
const foundersPage = readFileSync(new URL("../app/founders/page.tsx", import.meta.url), "utf8");

test("legacy Founding Partner payment parameters remain fixed for historical reconciliation", () => {
  const attemptId = "11111111-1111-4111-8111-111111111111";
  const params = buildFoundingPartnerCheckoutParams({
    attemptId,
    productId: "prod_test123",
    successUrl: "https://connect.test/founders/success?session_id={CHECKOUT_SESSION_ID}",
    cancelUrl: "https://connect.test/founders?checkout=cancelled",
    expiresAtEpochSeconds: 2_000_000_000,
  });
  assert.equal(FOUNDING_PARTNER_PRODUCT_NAME, "Optimize Local Connect Founding Partner");
  assert.equal(FOUNDING_PARTNER_AMOUNT_CENTS, 29900);
  assert.equal(FOUNDING_PARTNER_CURRENCY, "USD");
  assert.equal(params.get("mode"), "payment");
  assert.equal(params.get("line_items[0][price_data][unit_amount]"), "29900");
  assert.equal(params.get("line_items[0][price_data][currency]"), "usd");
  assert.equal(params.get("line_items[0][price_data][product]"), "prod_test123");
  assert.equal(params.get("line_items[0][quantity]"), "1");
  assert.equal(params.get("customer_creation"), "always");
  assert.equal(params.get("name_collection[business][enabled]"), "true");
  assert.equal(params.get("client_reference_id"), attemptId);
  assert.equal(params.get("metadata[founder_checkout_id]"), attemptId);
  assert.equal(params.get("metadata[membership_type]"), FOUNDING_PARTNER_MEMBERSHIP_TYPE);
  assert.equal(params.get("success_url"), "https://connect.test/founders/success?session_id={CHECKOUT_SESSION_ID}");
  assert.equal(params.get("cancel_url"), "https://connect.test/founders?checkout=cancelled");
});

test("only completed and expired Checkout events enter the Founding Partner processor", () => {
  assert.equal(isFoundingPartnerStripeEvent("checkout.session.completed"), true);
  assert.equal(isFoundingPartnerStripeEvent("checkout.session.expired"), true);
  assert.equal(isFoundingPartnerStripeEvent("payment_intent.created"), false);
});

test("webhook verification retrieves Stripe state and validates customer, intent, product, amount, and metadata", () => {
  assert.match(webhook, /constructStripeWebhookEvent\(payload,signature\)/);
  assert.match(webhook, /Missing Stripe signature/);
  assert.match(webhook, /retrieveAndVerifyFoundingPartnerCheckout\(object\.id\)/);
  for (const contract of ["customerId", "paymentIntentId", "amountPaidCents", "customerEmail", "customerName", "membershipType", "paidAt"]) assert.match(webhook, new RegExp(contract));
  assert.match(stripe, /paymentIntent\.status !== "succeeded"/);
  assert.match(stripe, /paymentIntent\.amount_received !== FOUNDING_PARTNER_AMOUNT_CENTS/);
  assert.match(stripe, /productId !== env\.STRIPE_FOUNDING_PRODUCT_ID/);
  assert.match(stripe, /session\.metadata\.founder_checkout_id !== attemptId/);
});

test("database payment and onboarding writes are idempotent and duplicate-safe", () => {
  assert.match(migration, /checkout_attempt_id uuid not null unique/);
  assert.match(migration, /checkout_session_id text not null unique/);
  assert.match(migration, /payment_intent_id text not null unique/);
  assert.match(migration, /payment_id uuid not null unique/);
  assert.match(migration, /on conflict\(provider,provider_event_id\) do nothing/);
  assert.match(migration, /on conflict\(checkout_session_id\) do nothing returning id/);
  assert.match(migration, /on conflict\(payment_id\) do nothing/);
  assert.match(migration, /create or replace function public\.process_founding_partner_payment/);
});

test("success page reads verified database state instead of trusting the session query", () => {
  assert.match(successPage, /from\("founding_partner_payments"\)/);
  assert.match(successPage, /payment_status === "paid"/);
  assert.match(successPage, /amount_paid_cents === 29900/);
  assert.doesNotMatch(successPage, /retrieveAndVerifyFoundingPartnerCheckout|payment=success/);
});

test("public Founder CTA no longer creates a legacy one-time Checkout Session", () => {
  assert.doesNotMatch(checkoutAction, /createFoundingPartnerStripeCheckout|reserve_founding_partner_checkout/);
  assert.match(checkoutAction, /FOUNDING_PARTNER_PLAN\.key/);
  assert.match(checkoutAction, /\/sign-in\?next=/);
  assert.match(foundersPage, /subscription checkout/i);
  assert.match(successPage, /lookupFailed/);
  assert.match(successPage, /Your payment status was not changed/);
});

test("missing and malformed Checkout session ids cannot create a paid state", () => {
  assert.match(successPage, /const sessionSchema = z\.string\(\)\.regex/);
  assert.match(successPage, /const invalid = !sessionId\.success/);
  assert.match(successPage, /No payment status was inferred from this page address/);
});
