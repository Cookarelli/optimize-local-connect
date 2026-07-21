import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { filterProspects, prospectsToCsv, type VendorProspect } from "../src/domain/vendor-pipeline/catalog";

const page = readFileSync(new URL("../app/(platform)/admin/vendor-pipeline/page.tsx", import.meta.url), "utf8");
const actions = readFileSync(new URL("../app/(platform)/admin/vendor-pipeline/actions.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/202607200028_vendor_pipeline.sql", import.meta.url), "utf8");
const prospect = (overrides: Partial<VendorProspect> = {}): VendorProspect => ({ id: "00000000-0000-4000-8000-000000000001", business_name: "Perfect Temp", contact_name: "Pat", phone: "815-555-0100", email: "pat@example.com", website: null, city: "Rockford", industry: "HVAC", google_rating: 4.9, google_review_count: 186, membership_target: "Founder", sales_stage: "Called", last_contact_at: null, next_follow_up_at: new Date().toISOString(), notes: "Call after 2pm", created_at: "2026-07-20T00:00:00Z", updated_at: "2026-07-20T00:00:00Z", ...overrides });

test("vendor pipeline requires Super Admin access in the page, actions, and database", () => { assert.match(page, /requireUser\(\)/); assert.match(page, /!user\.isSuperAdmin/); assert.match(actions, /!user\.isSuperAdmin/); assert.match(migration, /enable row level security/); });
test("prospects can be created and edited through validated server actions", () => { assert.match(actions, /createVendorProspect/); assert.match(actions, /updateVendorProspect/); assert.match(actions, /prospectSchema/); assert.match(actions, /\.insert\(values/); assert.match(actions, /\.update\(values/); });
test("search and filters narrow the current pipeline", () => { const rows = [prospect(), prospect({ id: "00000000-0000-4000-8000-000000000002", business_name: "Northside Plumbing", phone: "779-555-0100", industry: "Plumbing", sales_stage: "Paid" })]; assert.equal(filterProspects(rows, { q: "815-555" }).length, 1); assert.equal(filterProspects(rows, { industry: "Plumbing", stage: "Paid" }).length, 1); });
test("quick contact stages update the last-contact timestamp", () => { assert.match(actions, /setVendorProspectStage/); assert.match(actions, /last_contact_at: new Date\(\)\.toISOString\(\)/); assert.match(actions, /z\.enum\(CONTACT_STAGES\)/); });
test("CSV export covers the requested columns and escapes notes", () => { const csv = prospectsToCsv([prospect({ notes: 'Say "hello", then follow up' })]); assert.match(csv, /Business Name/); assert.match(csv, /Google Review Count/); assert.match(csv, /"Say ""hello"", then follow up"/); assert.match(page, /vendor-pipeline\/export/); });
