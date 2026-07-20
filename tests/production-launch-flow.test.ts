import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const homepage = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const foundersPage = readFileSync(new URL("../app/founders/page.tsx", import.meta.url), "utf8");
const foundersAction = readFileSync(new URL("../app/founders/actions.ts", import.meta.url), "utf8");
const pricingPage = readFileSync(new URL("../app/pricing/page.tsx", import.meta.url), "utf8");
const origin = readFileSync(new URL("../src/lib/auth/origin.ts", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const signInAction = readFileSync(new URL("../app/(auth)/sign-in/actions.ts", import.meta.url), "utf8");
const callback = readFileSync(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8");
const webhook = readFileSync(new URL("../app/api/payments/stripe/webhook/route.ts", import.meta.url), "utf8");
const vendorMembershipPage = readFileSync(new URL("../app/(platform)/vendor/membership/page.tsx", import.meta.url), "utf8");
const legacyFoundersPage = readFileSync(new URL("../app/founding-fifty/page.tsx", import.meta.url), "utf8");
const legacyFoundersClaimPage = readFileSync(new URL("../app/founding-fifty/claim/[seatId]/page.tsx", import.meta.url), "utf8");

test("homepage exposes a direct Founding Vendor enrollment CTA above the fold", () => {
  assert.match(homepage, /Become a Founding Vendor/);
  assert.match(homepage, /Founding Vendor Enrollment Now Open/);
  assert.match(homepage, /ArrowLink href="\/founders"/);
  assert.match(homepage, /ArrowLink href="\/founders">Become a Founding Vendor/);
  assert.match(homepage, /Vendor Login/);
  assert.match(homepage, /Staff Login/);
  assert.match(homepage, /FOUNDING_VENDOR_RESERVATION_SUMMARY/);
  assert.match(homepage, /FOUNDING_VENDOR_RESERVED_CATEGORIES/);
  assert.match(homepage, /Become a Founding Vendor<\/ArrowLink>/);
});

test("Founder enrollment CTAs use the public guest checkout route", () => {
  assert.match(pricingPage, /founding\?"\/founders"/);
  assert.match(vendorMembershipPage, /plan\.key==="founding_partner"\?<Link href="\/founders"/);
  assert.match(legacyFoundersPage, /redirect\("\/founders"\)/);
  assert.match(legacyFoundersClaimPage, /redirect\("\/founders"\)/);
  assert.doesNotMatch(pricingPage, /founding\?`?\/sign-in/);
});

test("the Founder page shows the current reserved-spot counter and categories", () => {
  assert.match(foundersPage, /FOUNDING_VENDOR_RESERVATION_SUMMARY/);
  assert.match(foundersPage, /FOUNDING_VENDOR_RESERVED_CATEGORIES/);
  assert.match(foundersPage, /category} occupied/);
  assert.doesNotMatch(foundersPage, /Renews automatically|per year|Annual membership/);
});

test("Founding Vendor enrollment is public and server-controlled", () => {
  assert.match(foundersPage, /GuestFoundingCheckoutForm/);
  assert.match(foundersAction, /create_guest_founding_vendor_checkout/);
  assert.match(foundersAction, /STRIPE_FOUNDING_VENDOR_PRICE_ID/);
  assert.doesNotMatch(foundersAction, /requireUser\(|getCurrentUser\(/);
  assert.match(pricingPage, /founding\?"\/founders"/);
});

test("guest checkout validation failures log Zod issue categories without customer values", () => {
  assert.match(foundersAction, /guest_founding_checkout_validation_failed/);
  assert.match(foundersAction, /stage: "validating_form"/);
  assert.match(foundersAction, /issueCodes: parsed\.error\.issues/);
  assert.match(foundersAction, /issuePaths: parsed\.error\.issues/);
});

test("guest checkout pending membership failures identify the database stage", () => {
  assert.match(foundersAction, /stage = "pending_membership_creation"/);
  assert.match(foundersAction, /asCheckoutError\(stage, reservationError\)/);
  assert.match(foundersAction, /failedStage: stage/);
});

test("guest checkout product and price configuration failures identify their stage", () => {
  assert.match(foundersAction, /stage = "validating_price_product"/);
  assert.match(foundersAction, /getVendorPlanProductId\(FOUNDING_PARTNER_PLAN\)/);
  assert.match(foundersAction, /getVendorPlanPriceId\(FOUNDING_PARTNER_PLAN\)/);
});

test("guest checkout payload construction is a named pre-session stage", () => {
  assert.match(foundersAction, /stage = "constructing_checkout_session_payload"/);
  assert.match(foundersAction, /const checkoutPayload =/);
  assert.match(foundersAction, /createVendorMembershipCheckout\(checkoutPayload\)/);
});

test("guest checkout failures retain safe diagnostics for thrown objects and preserve the customer message", () => {
  assert.match(foundersAction, /guest_founding_checkout_failed/);
  assert.match(foundersAction, /errorName: name/);
  assert.match(foundersAction, /unknownErrorDetails/);
  assert.match(foundersAction, /failedStage: stage/);
  assert.match(foundersAction, /environmentPresent:/);
  assert.match(foundersAction, /STRIPE_FOUNDING_VENDOR_PRICE_ID/);
  assert.match(foundersAction, /stripeCheckoutSessionCreationAttempted/);
  assert.match(foundersAction, /failureTiming: stripeApiCallAttempted \? "after_stripe_api_call" : "before_stripe_api_call"/);
  assert.match(foundersAction, /"loading_configuration"/);
  assert.match(foundersAction, /"database_lookup"/);
  assert.match(foundersAction, /asCheckoutError\(stage, attachError\)/);
  assert.match(foundersAction, /Secure checkout is temporarily unavailable\. Please try again shortly\./);
});

test("production redirects require the configured HTTPS app origin and preserve claim authentication", () => {
  assert.match(origin, /NEXT_PUBLIC_APP_URL is required in production/);
  assert.doesNotMatch(origin, /localhost/);
  assert.doesNotMatch(layout, /http:\/\/localhost/);
  assert.match(signInAction, /emailRedirectTo: `\$\{origin\}\/auth\/callback\?next=/);
  assert.match(callback, /safeInternalPath/);
  assert.match(callback, /new URL\(next, url\.origin\)/);
});

test("the signed Stripe webhook route is registered in application source", () => {
  assert.match(webhook, /export async function POST/);
  assert.match(webhook, /constructStripeWebhookEvent/);
  assert.match(webhook, /processVendorMembershipStripeEvent/);
});
