import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../supabase/migrations/202607140018_public_founding_partner_marketplace.sql", import.meta.url), "utf8");
const lifecycleMigration = readFileSync(new URL("../supabase/migrations/202607180024_tier_driven_vendor_lifecycle.sql", import.meta.url), "utf8");
const directory = readFileSync(new URL("../src/components/marketplace/vendor-marketplace-directory.tsx", import.meta.url), "utf8");
const profile = readFileSync(new URL("../app/marketplace/[slug]/page.tsx", import.meta.url), "utf8");
const category = readFileSync(new URL("../app/marketplace/category/[slug]/page.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../app/api/marketplace/vendors/route.ts", import.meta.url), "utf8");
const home = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../src/components/marketplace/public-marketplace-shell.tsx", import.meta.url), "utf8");

test("public Founder visibility requires verified payment, approved activation, consent, and active marketplace records", () => {
  assert.match(migration, /p\.payment_status='paid' and p\.amount_paid_cents=29900 and p\.currency='USD'/);
  assert.match(migration, /p\.membership_type='founding_partner'/);
  assert.match(migration, /f\.status='active' and f\.approved_at is not null and f\.activated_at is not null and f\.public_display_consent/);
  assert.match(migration, /o\.type='vendor' and o\.status='active'/);
  assert.match(migration, /vm\.status='active' and level\.code='founding_partner'/);
});

test("public marketplace functions are anonymous-safe and exclude private administrative and billing fields", () => {
  assert.match(migration, /grant execute on function public\.search_public_founding_partners[\s\S]*to anon,authenticated,service_role/);
  assert.match(migration, /grant execute on function public\.get_public_founding_partner_profile[\s\S]*to anon,authenticated,service_role/);
  for (const privateField of ["internal_notes", "review_notes", "payment_intent_id", "checkout_session_id", "provider_customer_id", "provider_metadata"]) assert.doesNotMatch(migration, new RegExp(privateField));
  assert.doesNotMatch(api, /getCurrentUser|Authentication required/);
  assert.match(api, /Cache-Control": "public/);
});

test("generic marketplace publication requires the shared lifecycle for every paid tier",()=>{
  assert.match(lifecycleMigration,/search_public_vendors/);assert.match(lifecycleMigration,/get_public_vendor_profile/);
  assert.match(lifecycleMigration,/vp\.lifecycle_status='eligible' and vp\.publication_status='published'/);
  assert.match(lifecycleMigration,/level\.publication_eligible/);
  assert.match(lifecycleMigration,/level\.code membership_code/);
  for(const privateField of ["internal_notes","payment_intent_id","checkout_session_id","provider_customer_id"])assert.doesNotMatch(lifecycleMigration,new RegExp(`jsonb_build_object[^;]*${privateField}`));
});

test("the marketplace is a public route rather than inheriting the authenticated platform layout", () => {
  assert.equal(existsSync(new URL("../app/marketplace/page.tsx", import.meta.url)), true);
  assert.equal(existsSync(new URL("../app/(platform)/marketplace/page.tsx", import.meta.url)), false);
});

test("public users can search, browse categories and locations, open profiles, and contact vendors", () => {
  for (const control of ["Search business, service, or category", "Every category", "Every service area", "View profile", "Call vendor", "Email vendor"]) assert.match(directory, new RegExp(control));
  assert.match(directory, /\/marketplace\/category\/\$\{item\.slug\}/);
  assert.match(profile, /mailto:\$\{profile\.email\}/);
  assert.match(profile, /tel:\$\{profile\.phone\}/);
  assert.match(profile, /Google Business Profile/);
});

test("vendor and category pages provide marketplace-specific SEO metadata and honest empty states", () => {
  assert.match(profile, /generateMetadata/);
  assert.match(profile, /alternates: \{ canonical:/);
  assert.match(category, /generateMetadata/);
  assert.match(category, /Providers \| Optimize Local Connect/);
  assert.match(directory, /Listings appear only after payment is current/);
});

test("production homepage no longer presents invented marketplace vendors", () => {
  for (const inventedVendor of ["AirRight Mechanical", "Metro Climate Co.", "North Texas Comfort"]) assert.doesNotMatch(home, new RegExp(inventedVendor));
  assert.match(home, /Browse active partners/);
});

test("public marketplace branding does not render invalid nested links", () => {
  assert.doesNotMatch(shell, /<Link href="\/">\s*<Logo \/>\s*<\/Link>/);
  assert.match(shell, /<Logo \/>/);
});
