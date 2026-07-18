import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isPremiumMembership, VENDOR_MEMBERSHIP_PLANS } from "../src/domain/vendor-memberships/catalog";

const migration = readFileSync(new URL("../supabase/migrations/202607140010_vendor_marketplace_memberships.sql", import.meta.url), "utf8");
const foundersPage = readFileSync(new URL("../app/founders/page.tsx", import.meta.url), "utf8");
const foundersCheckoutButton = readFileSync(new URL("../src/components/founding-partner/checkout-submit-button.tsx", import.meta.url), "utf8");

test("vendor membership catalog exposes the four canonical plans", () => {
  assert.deepEqual(VENDOR_MEMBERSHIP_PLANS.map(plan => plan.code), ["free","verified","premium","founding_partner"]);
  assert.equal(VENDOR_MEMBERSHIP_PLANS.find(plan => plan.code === "premium")?.price, "$49");
  assert.equal(VENDOR_MEMBERSHIP_PLANS.find(plan => plan.code === "founding_partner")?.capacity, 50);
});

test("Premium and Founding Partner receive Premium placement", () => {
  assert.equal(isPremiumMembership("premium"), true);
  assert.equal(isPremiumMembership("founding_partner"), true);
  assert.equal(isPremiumMembership("verified"), false);
});

test("Founding Partner terms are stored as governed product data", () => {
  assert.match(migration, /'founding_partner','Founding Partner'/);
  assert.match(migration, /'one_time',29900,50/);
  assert.match(migration, /"premium_included_months":12/);
  assert.match(migration, /"permanent_founding_badge":true/);
  assert.match(migration, /"locked_renewal_pricing":true/);
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

test("Founding Partner sales page states the governed offer and its limits", () => {
  assert.match(foundersPage, /\$299 one-time/);
  assert.match(foundersPage, /first 12 months of Premium/i);
  assert.match(foundersPage, /locked preferred rate of \$49 per month/i);
  assert.match(foundersPage, /does not guarantee leads, jobs, revenue/i);
  assert.match(foundersPage, /Applications may be reviewed/i);
});

test("Founding Partner CTAs enter the real category and checkout workflow", () => {
  assert.match(foundersPage, /startFoundingPartnerCheckout/);
  assert.match(foundersPage, /<form action=\{startFoundingPartnerCheckout\}>/);
  assert.match(foundersCheckoutButton, /Become a Founding Partner/);
  assert.match(foundersPage, /Secure checkout through Stripe/);
  assert.doesNotMatch(foundersPage, /fake success|payment=success/);
});
