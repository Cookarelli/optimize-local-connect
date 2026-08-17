import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const homepage = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const foundersPage = readFileSync(new URL("../app/founders/page.tsx", import.meta.url), "utf8");
const foundersAction = readFileSync(new URL("../app/founders/actions.ts", import.meta.url), "utf8");
const pricingPage = readFileSync(new URL("../app/pricing/page.tsx", import.meta.url), "utf8");
const origin = readFileSync(new URL("../src/lib/auth/origin.ts", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const brand = readFileSync(new URL("../src/domain/platform/brand.ts", import.meta.url), "utf8");
const signInAction = readFileSync(new URL("../app/(auth)/sign-in/actions.ts", import.meta.url), "utf8");
const callback = readFileSync(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8");
const webhook = readFileSync(new URL("../app/api/payments/stripe/webhook/route.ts", import.meta.url), "utf8");
const viteConfig = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
const vendorMembershipPage = readFileSync(new URL("../app/(platform)/vendor/membership/page.tsx", import.meta.url), "utf8");
const legacyFoundersPage = readFileSync(new URL("../app/founding-fifty/page.tsx", import.meta.url), "utf8");
const legacyFoundersClaimPage = readFileSync(new URL("../app/founding-fifty/claim/[seatId]/page.tsx", import.meta.url), "utf8");

test("homepage exposes a direct Founding Member enrollment CTA above the fold", () => {
  assert.match(homepage, /FOUNDING_MEMBER_OFFER\.cta/);
  assert.match(homepage, /The intelligent local business network/);
  assert.match(homepage, /ArrowLink href="\/memberships"/);
  assert.match(homepage, /ArrowLink href="\/memberships">\{FOUNDING_MEMBER_OFFER\.cta\}/);
  assert.match(homepage, /Sign in/);
  assert.doesNotMatch(homepage, /FOUNDING_MEMBER_OFFER\.(claimed|remaining)/);
  assert.match(homepage, /\{FOUNDING_MEMBER_OFFER\.cta\}<\/ArrowLink>/);
});

test("public metadata positions Connect as an intelligent local business network", () => {
  assert.match(layout, /Optimize Local Connect \| Intelligent Local Business Network/);
  assert.match(layout, /twitter:[\s\S]*description: PLATFORM_BRAND\.description/);
  assert.match(brand, /Discover trusted local businesses, member benefits, referrals, and smarter matching/);
});

test("Founder purchase CTAs use governed checkout while other membership routes remain intact", () => {
  assert.match(pricingPage, /FoundingMemberAvailability ctaHref="\/memberships#founder-checkout"/);
  assert.match(vendorMembershipPage, /founding\?<Link href="\/founders"/);
  assert.match(legacyFoundersPage, /redirect\("\/memberships"\)/);
  assert.match(legacyFoundersClaimPage, /redirect\("\/memberships"\)/);
  assert.doesNotMatch(pricingPage, /founding\?`?\/sign-in/);
});

test("the Founders route forwards visitors to the current membership offer", () => {
  assert.match(foundersPage, /permanentRedirect\("\/memberships"\)/);
});

test("Founding Member enrollment is public and server-controlled", () => {
  assert.match(foundersPage, /permanentRedirect\("\/memberships"\)/);
  assert.match(foundersAction, /reserveFounderCategory/);
  assert.match(foundersAction, /attachFounderStripeCheckout/);
  assert.doesNotMatch(foundersAction, /requireUser\(|getCurrentUser\(/);
  assert.match(pricingPage, /FoundingMemberAvailability ctaHref="\/memberships#founder-checkout"/);
});

test("guest checkout validation failures log Zod issue categories without customer values", () => {
  assert.match(foundersAction, /guest_membership_checkout_validation_failed/);
  assert.match(foundersAction, /stage: "validating_form"/);
  assert.match(foundersAction, /issueCodes: parsed\.error\.issues/);
  assert.match(foundersAction, /issuePaths: parsed\.error\.issues/);
});

test("guest checkout pending membership failures identify the database stage", () => {
  assert.match(foundersAction, /stage = "pending_membership_creation"/);
  assert.match(foundersAction, /reservation = await reserveFounderCategory/);
  assert.match(foundersAction, /failedStage: stage/);
});

test("guest checkout product and price configuration failures identify their stage", () => {
  assert.match(foundersAction, /stage = "validating_price_product"/);
  assert.match(foundersAction, /getVendorPlanProductId\(plan\)/);
  assert.match(foundersAction, /getVendorPlanPriceId\(plan\)/);
});

test("guest checkout payload construction is a named pre-session stage", () => {
  assert.match(foundersAction, /stage = "constructing_checkout_session_payload"/);
  assert.match(foundersAction, /const checkoutPayload =/);
  assert.match(foundersAction, /createVendorMembershipCheckout\(checkoutPayload\)/);
});

test("guest checkout failures retain safe diagnostics for thrown objects and preserve the customer message", () => {
  assert.match(foundersAction, /guest_membership_checkout_failed/);
  assert.match(foundersAction, /errorName: name/);
  assert.match(foundersAction, /unknownErrorDetails/);
  assert.match(foundersAction, /failedStage: stage/);
  assert.match(foundersAction, /environmentPresent:/);
  assert.match(foundersAction, /FIREBASE_PROJECT_ID/);
  assert.match(foundersAction, /stripeCheckoutSessionCreationAttempted/);
  assert.match(foundersAction, /failureTiming: stripeApiCallAttempted \? "after_stripe_api_call" : "before_stripe_api_call"/);
  assert.match(foundersAction, /"loading_configuration"/);
  assert.match(foundersAction, /"database_lookup"/);
  assert.match(foundersAction, /releaseFounderReservation/);
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

test("Vercel keeps Firebase Admin as traced Node dependencies", () => {
  assert.match(viteConfig, /firebase-admin\/firestore/);
  assert.match(viteConfig, /@google-cloud\/firestore/);
  assert.match(viteConfig, /traceDeps: \["firebase-admin", "@google-cloud\/firestore"\]/);
  assert.match(viteConfig, /rsc: \{ resolve: \{ external: vercelServerExternals \} \}/);
  assert.match(viteConfig, /ssr: \{ resolve: \{ external: vercelServerExternals \} \}/);
});
