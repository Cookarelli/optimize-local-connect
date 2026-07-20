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

test("homepage exposes a direct Founding Vendor enrollment CTA above the fold", () => {
  assert.match(homepage, /Become a Founding Vendor/);
  assert.match(homepage, /ArrowLink href="\/founders"/);
  assert.match(homepage, /ArrowLink href="\/founders">Become a Founding Vendor/);
  assert.match(homepage, /Vendor Login/);
  assert.match(homepage, /Staff Login/);
});

test("Founding Vendor enrollment is public and server-controlled", () => {
  assert.match(foundersPage, /GuestFoundingCheckoutForm/);
  assert.match(foundersAction, /create_guest_founding_vendor_checkout/);
  assert.match(foundersAction, /STRIPE_FOUNDING_VENDOR_PRICE_ID/);
  assert.doesNotMatch(foundersAction, /requireUser\(|getCurrentUser\(/);
  assert.match(pricingPage, /founding\?"\/founders"/);
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
