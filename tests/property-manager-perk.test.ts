import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canDisplayPropertyManagerPerk, canUsePropertyManagerPerk, propertyManagerPerkSchema, propertyManagerPerkSuggestions } from "../src/domain/vendor-memberships/property-manager-perk";

const migration = readFileSync(new URL("../supabase/migrations/202607180020_property_manager_perks.sql", import.meta.url), "utf8");
const reconciliationMigration = readFileSync(new URL("../supabase/migrations/202607180022_stripe_membership_reconciliation.sql", import.meta.url), "utf8");
const directory = readFileSync(new URL("../src/components/marketplace/vendor-marketplace-directory.tsx", import.meta.url), "utf8");
const profile = readFileSync(new URL("../app/marketplace/[slug]/page.tsx", import.meta.url), "utf8");

test("Property Manager Perk is centralized to active Premium and Founder memberships", () => {
  assert.equal(canUsePropertyManagerPerk("founding_partner", "active"), true);
  assert.equal(canUsePropertyManagerPerk("premium", "active"), true);
  assert.equal(canUsePropertyManagerPerk("verified", "active"), false);
  assert.equal(canUsePropertyManagerPerk("founding_partner", "paused"), false);
});

test("enabled perks require useful plain text and reject misleading claims", () => {
  const base = { enabled: true, title: "Priority scheduling", description: "Property managers receive priority scheduling when availability permits.", type: "priority_response", terms: "New requests only.", expirationDate: "" } as const;
  assert.equal(propertyManagerPerkSchema.safeParse(base).success, true);
  assert.equal(propertyManagerPerkSchema.safeParse({ ...base, title: "" }).success, false);
  assert.equal(propertyManagerPerkSchema.safeParse({ ...base, description: "<script>alert(1)</script>" }).success, false);
  assert.equal(propertyManagerPerkSchema.safeParse({ ...base, title: "Guaranteed results" }).success, false);
});

test("expired or ineligible perks are not displayable", () => {
  const perk = { enabled: true, title: "Free estimates", description: "Free written estimates for qualifying property work.", type: "free_estimate" as const, terms: "", expirationDate: "2026-01-01" };
  assert.equal(canDisplayPropertyManagerPerk(perk, "founding_partner", "active", new Date("2026-07-18T12:00:00Z")), false);
  assert.equal(canDisplayPropertyManagerPerk({ ...perk, expirationDate: "" }, "verified"), false);
});

test("industry-aware suggestions include the requested service categories", () => {
  assert.ok(propertyManagerPerkSuggestions("Appliance Repair").some(item => item.title.includes("diagnostic")));
  assert.ok(propertyManagerPerkSuggestions("HVAC").some(item => item.title.includes("no-heat")));
  assert.ok(propertyManagerPerkSuggestions("Flooring").some(item => item.title.includes("measurements")));
});

test("migration preserves vendors, gates public data by entitlement, and exposes searchable perk fields", () => {
  assert.match(migration, /add column if not exists property_manager_perk_enabled boolean not null default false/);
  assert.match(migration, /vendor_has_entitlement\(o\.id,'property_manager_perk'\)/);
  assert.match(migration, /property_manager_perk_expiration_date>=current_date/);
  assert.match(migration, /perk_filter='any'/);
  assert.match(directory, /Has Property Manager Perk/);
  assert.match(directory, /Property Manager Perk/);
  assert.match(profile, /profile\.propertyManagerPerk/);
  assert.match(reconciliationMigration, /vendor_profiles_perk_entitlement/);
  assert.match(reconciliationMigration, /vendor_has_entitlement\(new\.organization_id,'property_manager_perk'\)/);
});
