import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FOUNDING_PARTNER_PLAN, formatVendorPlanPrice, isPremiumMembership, validatePurchasableVendorPlanStripeConfig, VENDOR_MEMBERSHIP_PLANS } from "../src/domain/vendor-memberships/catalog";
import { canAccessVendorDashboard, canAppearInDirectory, canReceiveOpportunities, canUsePropertyManagerPerk, hasFounderBadge, hasPreferredPlacement } from "../src/domain/vendor-memberships/entitlements";
import {membershipStatusFromStripe} from "../src/domain/vendor-memberships/status";

const migration = readFileSync(new URL("../supabase/migrations/202607140010_vendor_marketplace_memberships.sql", import.meta.url), "utf8");
const subscriptionMigration = readFileSync(new URL("../supabase/migrations/202607180021_vendor_subscription_memberships.sql", import.meta.url), "utf8");
const reconciliationMigration = readFileSync(new URL("../supabase/migrations/202607180022_stripe_membership_reconciliation.sql", import.meta.url), "utf8");
const membershipStripe = readFileSync(new URL("../src/lib/stripe/memberships.ts", import.meta.url), "utf8");
const webhook = readFileSync(new URL("../app/api/payments/stripe/webhook/route.ts", import.meta.url), "utf8");
const foundersPage = readFileSync(new URL("../app/founders/page.tsx", import.meta.url), "utf8");
const foundersCheckoutButton = readFileSync(new URL("../src/components/founding-partner/checkout-submit-button.tsx", import.meta.url), "utf8");
const foundersAction = readFileSync(new URL("../app/founders/actions.ts", import.meta.url), "utf8");
const homepage = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const pricingPage = readFileSync(new URL("../app/pricing/page.tsx", import.meta.url), "utf8");
const legacyFoundingPage = readFileSync(new URL("../app/founding-fifty/page.tsx", import.meta.url), "utf8");

test("vendor membership catalog exposes only the three paid launch plans", () => {
  assert.deepEqual(VENDOR_MEMBERSHIP_PLANS.map(plan => plan.key), ["founding_partner","network","preferred"]);
  assert.equal(VENDOR_MEMBERSHIP_PLANS.find(plan => plan.key === "network")?.amountCents, 1900);
  assert.equal(VENDOR_MEMBERSHIP_PLANS.find(plan => plan.key === "preferred")?.amountCents, 4900);
  assert.equal(VENDOR_MEMBERSHIP_PLANS.find(plan => plan.key === "founding_partner")?.capacity, 50);
  assert.ok(VENDOR_MEMBERSHIP_PLANS.every(plan=>plan.paymentRequired&&plan.manualApprovalRequired&&plan.publicationEligible&&plan.publiclyPurchasable));
  assert.equal(FOUNDING_PARTNER_PLAN.name, "Founding Partner");
  assert.equal(FOUNDING_PARTNER_PLAN.amountCents, 29900);
  assert.equal(FOUNDING_PARTNER_PLAN.currency, "USD");
  assert.equal(FOUNDING_PARTNER_PLAN.interval, "year");
  assert.equal(FOUNDING_PARTNER_PLAN.checkoutMode, "subscription");
  assert.equal(FOUNDING_PARTNER_PLAN.stripeProductEnv, "STRIPE_FOUNDING_PRODUCT_ID");
  assert.equal(FOUNDING_PARTNER_PLAN.stripePriceEnv, "STRIPE_FOUNDING_VENDOR_PRICE_ID");
  assert.equal(formatVendorPlanPrice(FOUNDING_PARTNER_PLAN), "$299/year");
});

test("every publicly purchasable paid tier requires a distinct Stripe Product and Price", () => {
  assert.deepEqual(VENDOR_MEMBERSHIP_PLANS.map(plan=>[plan.key,plan.stripeProductEnv,plan.stripePriceEnv]),[
    ["founding_partner","STRIPE_FOUNDING_PRODUCT_ID","STRIPE_FOUNDING_VENDOR_PRICE_ID"],
    ["network","STRIPE_NETWORK_PRODUCT_ID","STRIPE_NETWORK_MEMBER_PRICE_ID"],
    ["preferred","STRIPE_PREFERRED_PRODUCT_ID","STRIPE_PREFERRED_VENDOR_PRICE_ID"],
  ]);
  const configured = validatePurchasableVendorPlanStripeConfig({
    STRIPE_FOUNDING_PRODUCT_ID:"prod_founder",
    STRIPE_FOUNDING_VENDOR_PRICE_ID:"price_founder",
    STRIPE_NETWORK_PRODUCT_ID:"prod_network",
    STRIPE_NETWORK_MEMBER_PRICE_ID:"price_network",
    STRIPE_PREFERRED_PRODUCT_ID:"prod_preferred",
    STRIPE_PREFERRED_VENDOR_PRICE_ID:"price_preferred",
  });
  assert.deepEqual(configured.map(item=>item.key),["founding_partner","network","preferred"]);
  assert.equal(new Set(configured.map(item=>item.productId)).size,configured.length);
  assert.equal(new Set(configured.map(item=>item.priceId)).size,configured.length);
  assert.throws(()=>validatePurchasableVendorPlanStripeConfig({}),/STRIPE_FOUNDING_PRODUCT_ID/);
});

test("centralized entitlements require a current paid or explicitly granted status",()=>{
  const founder={code:"founding_partner",status:"active"};const network={code:"network",status:"active"};const preferred={code:"preferred",status:"active"};
  assert.equal(canAppearInDirectory(founder),true);assert.equal(canAppearInDirectory(network),true);assert.equal(canAppearInDirectory({code:"network",status:"past_due"}),false);
  assert.equal(hasFounderBadge({code:"founding_partner",status:"past_due",currentPeriodEndsAt:"2999-01-01T00:00:00.000Z"}),true);
  assert.equal(canUsePropertyManagerPerk(network),false);assert.equal(canUsePropertyManagerPerk(preferred),true);assert.equal(hasFounderBadge(founder),true);assert.equal(hasPreferredPlacement(preferred),true);assert.equal(canReceiveOpportunities(network),true);assert.equal(canAccessVendorDashboard(network),true);
});

test("subscription migration supports requested statuses and prevents duplicate current memberships",()=>{
  for(const status of ["pending","active","trialing","past_due","canceled","expired","complimentary","manually_granted"]) assert.match(subscriptionMigration,new RegExp(`'${status}'`));
  assert.match(subscriptionMigration,/unique index vendor_memberships_current_idx/);assert.match(subscriptionMigration,/active membership already exists/);assert.match(subscriptionMigration,/unique\(provider,provider_event_id\)/);
});

test("Stripe lifecycle events map to safe membership statuses",()=>{
  assert.equal(membershipStatusFromStripe("customer.subscription.created","trialing"),"trialing");
  assert.equal(membershipStatusFromStripe("invoice.paid","past_due"),"active");
  assert.equal(membershipStatusFromStripe("invoice.payment_failed","active"),"past_due");
  assert.equal(membershipStatusFromStripe("customer.subscription.deleted","active"),"canceled");
  assert.equal(membershipStatusFromStripe("customer.subscription.updated","unpaid"),"past_due");
  assert.equal(membershipStatusFromStripe("customer.subscription.updated","incomplete_expired"),"expired");
});

test("Stripe memberships verify configured Prices and process the required signed events",()=>{
  for(const event of ["checkout.session.completed","customer.subscription.created","customer.subscription.updated","customer.subscription.deleted","invoice.paid","invoice.payment_failed"]) assert.match(membershipStripe,new RegExp(event.replaceAll(".","\\.")));
  assert.match(membershipStripe,/attachedProductId!==productId/);assert.match(membershipStripe,/price\.unit_amount!==plan\.amountCents/);assert.match(membershipStripe,/price\.recurring\?\.interval!==plan\.interval/);assert.match(webhook,/constructStripeWebhookEvent/);assert.match(webhook,/processVendorMembershipStripeEvent/);
  assert.match(membershipStripe,/mode:plan\.checkoutMode/);
  assert.match(membershipStripe,/membershipStatusFromStripe\(event\.type,subscription\.status\)/);
});

test("membership webhook retries are idempotent and failed deliveries remain retryable",()=>{
  assert.match(membershipStripe,/prior\?\.processed_at/);
  assert.match(reconciliationMigration,/provider_event_id=target_event_id and processed_at is not null/);
  assert.match(reconciliationMigration,/on conflict\(provider,provider_event_id\) do update/);
  assert.match(reconciliationMigration,/active membership already exists[\s\S]*complimentary[\s\S]*manually_granted/);
});

test("legacy Founder reconciliation requires provider verification and does not grant membership",()=>{
  assert.match(reconciliationMigration,/reconcile_verified_founding_partner_checkout/);
  assert.match(reconciliationMigration,/amount_paid_cents<>29900/);
  assert.match(reconciliationMigration,/coalesce\(auth\.jwt\(\)->>'role',''\)<>'service_role'/);
  assert.doesNotMatch(reconciliationMigration,/activate_vendor_membership/);
});

test("Premium and Founding Partner receive Premium placement", () => {
  assert.equal(isPremiumMembership("premium"), true);
  assert.equal(isPremiumMembership("founding_partner"), true);
  assert.equal(isPremiumMembership("verified"), false);
});

test("historical Founder seed is superseded by the canonical annual subscription migration", () => {
  assert.match(migration, /'one_time',29900,50/);
  assert.match(subscriptionMigration, /name='Founding Partner'/);
  assert.match(subscriptionMigration, /annual_price_cents=29900/);
  assert.match(subscriptionMigration, /billing_model='subscription'/);
  assert.match(subscriptionMigration, /one_time_price_cents=null/);
});

test("Premium entitlements match the marketplace growth package", () => {
  for (const entitlement of ["ai_placement","homepage_placement","videos","coupons","analytics","push_notifications"]) assert.match(migration, new RegExp(`"${entitlement}":true`));
  assert.match(migration, /vendor_marketplace_media_entitlement/);
  assert.match(migration, /vendor_coupons_entitlement/);
});

test("Verified placement requires current license and insurance evidence", () => {
  assert.match(migration, /verification_type='trade_license'[\s\S]*status='verified'/);
  assert.match(migration, /verification_type='insurance'[\s\S]*status='verified'/);
  assert.match(migration, /vp\.verification_status='verified' and license\.ok and insurance\.ok is_verified/);
});

test("membership activation is capacity-safe, idempotent, and audited", () => {
  assert.match(migration, /from public\.vendor_membership_levels where code=target_level_code and is_active for update/);
  assert.match(migration, /membership capacity reached/);
  assert.match(migration, /idempotency_key text not null unique/);
  assert.match(migration, /vendor_membership_events_immutable/);
  assert.match(migration, /vendor_membership\.activated/);
});

test("future Founding Fifty confirmations normalize to Founding Partner", () => {
  assert.match(migration, /external_subscription_id like 'founding-fifty:%'/);
  assert.match(migration, /new\.membership_level_id:=selected_level\.id/);
  assert.match(migration, /founding_partner_badge_mirror/);
});

test("marketplace search discloses paid placement and preserves performance ordering", () => {
  assert.match(migration, /level\.code in \('premium','founding_partner'\)/);
  assert.match(migration, /order by membership_rank desc,is_verified desc,average_rating desc nulls last,completed_job_count desc,name/);
});

test("Founding Partner sales page states the annual recurring offer and its limits", () => {
  assert.match(foundersPage, /founderPrice/);
  assert.match(foundersPage, /renews automatically every 12 months until canceled/i);
  assert.match(foundersPage, /first \$\{founderPrice\} charge is collected immediately/i);
  assert.match(foundersPage, /does not guarantee leads, jobs, revenue/i);
  assert.match(foundersPage, /Applications may be reviewed/i);
});

test("Founding Partner CTAs enter the authenticated annual membership workflow", () => {
  assert.match(foundersPage, /startFoundingPartnerCheckout/);
  assert.match(foundersPage, /<form action=\{startFoundingPartnerCheckout\}>/);
  assert.match(foundersAction, /\/onboarding\?plan=/);
  assert.match(foundersAction, /FOUNDING_PARTNER_PLAN\.key/);
  assert.doesNotMatch(foundersAction, /createFoundingPartnerStripeCheckout/);
  assert.match(foundersCheckoutButton, /Become a Founding Partner/);
  assert.match(foundersPage, /Secure checkout through Stripe/);
  assert.doesNotMatch(foundersPage, /fake success|payment=success/);
});

test("no active public offer page describes Founding Partner as one-time", () => {
  for (const page of [homepage, foundersPage, pricingPage, legacyFoundingPage]) {
    assert.doesNotMatch(page, /(?:Founding Partner|Founding Vendor|Founder)[^\n]{0,160}one[- ]time|one[- ]time[^\n]{0,160}(?:Founding Partner|Founding Vendor|Founder)/i);
  }
  assert.match(legacyFoundingPage, /redirect\("\/founders"\)/);
});
