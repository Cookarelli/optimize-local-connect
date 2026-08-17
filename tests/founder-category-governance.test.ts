import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FOUNDER_CATEGORY_CATALOG, initialFounderCategoryState } from "../src/domain/founder-categories/catalog";
import { INITIAL_RESERVED_SEATS } from "../src/domain/founding-fifty/catalog";

const checkoutAction = readFileSync(new URL("../app/founders/actions.ts", import.meta.url), "utf8");
const checkoutForm = readFileSync(new URL("../src/components/founding-partner/guest-checkout-form.tsx", import.meta.url), "utf8");
const checkoutStripe = readFileSync(new URL("../src/lib/stripe/memberships.ts", import.meta.url), "utf8");
const firestoreService = readFileSync(new URL("../src/lib/founder-categories/firestore.ts", import.meta.url), "utf8");
const reconciliation = readFileSync(new URL("../src/lib/stripe/founder-subscription-reconciliation.ts", import.meta.url), "utf8");
const adminActions = readFileSync(new URL("../app/(platform)/admin/founders/actions.ts", import.meta.url), "utf8");
const adminPage = readFileSync(new URL("../app/(platform)/admin/founder-categories/page.tsx", import.meta.url), "utf8");
const membershipsPage = readFileSync(new URL("../app/memberships/page.tsx", import.meta.url), "utf8");
const publicLoader = readFileSync(new URL("../src/lib/founder-categories/public.ts", import.meta.url), "utf8");
const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const categoryRoute = readFileSync(new URL("../app/marketplace/category/[slug]/page.tsx", import.meta.url), "utf8");
const onboardingSchema = readFileSync(new URL("../src/domain/founding-partner/onboarding.ts", import.meta.url), "utf8");
const onboardingForm = readFileSync(new URL("../src/components/founding-partner/onboarding-form.tsx", import.meta.url), "utf8");

test("canonical Founder catalog contains exactly the approved 25 ordered categories", () => {
  assert.equal(FOUNDER_CATEGORY_CATALOG.length, 25);
  assert.deepEqual(FOUNDER_CATEGORY_CATALOG.map((category) => category.displayOrder), Array.from({ length: 25 }, (_, index) => index + 1));
  assert.equal(new Set(FOUNDER_CATEGORY_CATALOG.map((category) => category.slug)).size, 25);
});

test("Catering replaces Excavation in the canonical Founder source", () => {
  assert.ok(FOUNDER_CATEGORY_CATALOG.some((category) => category.displayName === "Catering / Party Catering" && category.slug === "catering-party-catering"));
  assert.ok(!FOUNDER_CATEGORY_CATALOG.some((category) => /excavation|drainage/i.test(`${category.displayName} ${category.slug}`)));
});

test("current Founder onboarding validation and dropdowns use the canonical catalog", () => {
  assert.match(onboardingSchema, /FOUNDER_CATEGORY_DISPLAY_NAMES/);
  assert.match(onboardingForm, /FOUNDER_CATEGORY_DISPLAY_NAMES\.map/);
  assert.doesNotMatch(onboardingSchema, /FOUNDING_VERTICAL_CATALOG/);
  assert.doesNotMatch(onboardingForm, /FOUNDING_VERTICAL_CATALOG/);
});

test("initial business state keeps Flooring claimed, Roofing available, and Appliance Repair reserved", () => {
  assert.deepEqual(initialFounderCategoryState("flooring"), { status: "claimed", publicBusinessName: "Flooring Trends", paymentSource: "reserved_without_membership" });
  assert.deepEqual(initialFounderCategoryState("roofing"), { status: "available", publicBusinessName: null, paymentSource: null });
  assert.deepEqual(initialFounderCategoryState("appliance-repair"), { status: "reserved", publicBusinessName: null, paymentSource: "reserved_without_membership" });
  assert.deepEqual(initialFounderCategoryState("catering-party-catering"), { status: "available", publicBusinessName: null, paymentSource: null });
  assert.equal(FOUNDER_CATEGORY_CATALOG.filter((category) => initialFounderCategoryState(category.slug).status === "available").length, 23);
  assert.equal(Object.values(INITIAL_RESERVED_SEATS).includes("CLA Exteriors"), false);
});

test("Founder exclusivity uses Firebase Admin transactions and independent occupancy documents", () => {
  assert.match(firestoreService, /db\.runTransaction/);
  assert.match(firestoreService, /founderOccupancies/);
  assert.match(firestoreService, /Organization already occupies a Founder category/);
  assert.match(firestoreService, /Founder category is unavailable/);
  assert.doesNotMatch(firestoreService, /createSupabase|\.rpc\(/);
});

test("public checkout reserves Firestore before creating application Stripe Checkout", () => {
  assert.match(checkoutAction, /reserveFounderCategory/);
  assert.match(checkoutAction, /createVendorMembershipCheckout\(checkoutPayload\)/);
  assert.ok(checkoutAction.indexOf("await reserveFounderCategory") < checkoutAction.indexOf("createVendorMembershipCheckout(checkoutPayload)"));
  assert.match(checkoutAction, /attachFounderStripeCheckout/);
  assert.match(checkoutForm, /categories: PublicFounderCategory\[\]/);
  assert.match(checkoutForm, /value=\{category\.slug\}/);
  assert.match(publicLoader, /category\.state === "available"/);
});

test("Stripe metadata and verified webhooks carry and enforce Founder identifiers", () => {
  for (const field of ["organization_id", "membership_record_id", "membership_tier", "founder_category_id", "founder_category_slug", "founder_reservation_id"]) assert.match(checkoutStripe, new RegExp(field));
  assert.match(checkoutStripe, /claimFounderFromVerifiedStripe/);
  assert.match(checkoutStripe, /releaseFounderReservation/);
  assert.match(firestoreService, /founderPaymentEvents/);
  assert.match(firestoreService, /transaction\.create\(eventRef/);
});

test("reservation release is scoped to the exact membership and reservation and cannot release a claim", () => {
  assert.match(firestoreService, /category\.status !== "reserved"/);
  assert.match(firestoreService, /category\.paymentSource !== null/);
  assert.match(firestoreService, /category\.reservation\?\.id !== input\.reservationId/);
  assert.match(checkoutAction, /checkout\.sessions\.expire\(createdCheckoutSessionId\)/);
  assert.match(checkoutAction, /releaseFounderReservation/);
});

test("public documents and Security Rules expose only sanitized Founder status", () => {
  assert.match(rules, /match \/publicFounderCategories\/\{slug\}/);
  assert.match(rules, /keys\(\)\.hasOnly/);
  for (const privateField of ["contactEmail", "customerId", "subscriptionId", "paypalReferenceId", "membershipId"]) assert.doesNotMatch(rules.match(/hasOnly\(\[[\s\S]*?\]\)/)?.[0] ?? "", new RegExp(privateField));
  assert.match(rules, /allow read, write: if false/);
  assert.match(membershipsPage, /FounderCategoryStatus categories=\{founderAvailability\.categories\}/);
});

test("Stripe, manual grant, PayPal, and reservation admin workflows are server-only", () => {
  for (const action of ["reconcileCurrentFounderSubscription", "manuallyGrantFounderCategory", "reconcilePaypalFounderSale", "manageFounderCategoryReservation"]) assert.match(adminActions, new RegExp(action));
  assert.match(adminActions, /reconcileLegacyStripeFounder/);
  assert.match(adminActions, /manuallyGrantFounder/);
  assert.match(adminActions, /reconcilePaypalFounder/);
  assert.match(adminActions, /setFounderCategoryReserved/);
  assert.match(adminPage, /listFounderCategoriesForAdmin/);
  assert.match(adminPage, /categories\.length/);
});

test("legacy Stripe reconciliation retrieves and validates a real paid annual subscription", () => {
  assert.match(reconciliation, /checkout\.sessions\.retrieve/);
  assert.match(reconciliation, /session\.payment_status !== "paid"/);
  assert.match(reconciliation, /session\.amount_total !== FOUNDING_PARTNER_PLAN\.amountCents/);
  assert.match(reconciliation, /price\.id !== expectedPriceId/);
  assert.doesNotMatch(reconciliation, /paymentIntents\.create|checkout\.sessions\.create|subscriptions\.create/);
});

test("marketplace category routes recognize canonical Founder names without replacing Supabase marketplace data", () => {
  assert.match(categoryRoute, /FOUNDER_CATEGORY_CATALOG\.find/);
  assert.match(categoryRoute, /\^\[a-z0-9\]\+\(\?:-\[a-z0-9\]\+\)\*\$/);
  assert.match(categoryRoute, /createSupabaseServerClient/);
});

test("Founder purchase fails closed and does not use the legacy Founder Payment Link", () => {
  assert.match(publicLoader, /Fail closed/);
  assert.match(membershipsPage, /Founder checkout is temporarily paused/);
  assert.doesNotMatch(membershipsPage, /VENDOR_MEMBERSHIP_PAYMENT_LINKS\.founding_partner/);
  assert.match(membershipsPage, /GuestFoundingCheckoutForm/);
});
