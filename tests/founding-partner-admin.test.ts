import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../supabase/migrations/202607140017_founding_partner_admin.sql", import.meta.url), "utf8");
const listPage = readFileSync(new URL("../app/(platform)/admin/founders/page.tsx", import.meta.url), "utf8");
const detailPage = readFileSync(new URL("../app/(platform)/admin/founders/[id]/page.tsx", import.meta.url), "utf8");
const actions = readFileSync(new URL("../app/(platform)/admin/founders/actions.ts", import.meta.url), "utf8");
const legacyActions = readFileSync(new URL("../app/(platform)/admin/founding-fifty/actions.ts", import.meta.url), "utf8");

test("Founder admin pages and every mutation require verified Super Admin authorization", () => {
  assert.match(listPage, /requireUser\(\)/);
  assert.match(listPage, /if \(!user\.isSuperAdmin\) redirect/);
  assert.match(detailPage, /requireUser\(\)/);
  assert.match(detailPage, /if \(!user\.isSuperAdmin\) redirect/);
  assert.match(actions, /if \(!user\.isSuperAdmin\) throw/);
  assert.match(legacyActions, /admin_manage_founding_partner/);
  assert.match(migration, /if not public\.is_super_admin\(\) then raise exception 'super admin required'/);
});

test("admin workflow cannot alter or manufacture provider payment verification", () => {
  assert.doesNotMatch(migration, /update public\.founding_partner_payments/);
  assert.match(migration, /payment\.payment_status<>'paid'/);
  assert.match(migration, /payment\.amount_paid_cents<>29900/);
  assert.match(migration, /payment\.currency<>'USD'/);
  assert.match(detailPage, /Admin actions cannot change the amount or mark a payment as verified/);
});

test("significant Founder changes are timestamped, attributed, and immutable", () => {
  assert.match(migration, /create table public\.founding_partner_admin_events/);
  assert.match(migration, /actor_user_id uuid references public\.profiles/);
  assert.match(migration, /status_changed_at=now\(\)/);
  for (const field of ["approved_at", "changes_requested_at", "rejected_at", "activated_at", "suspended_at"]) assert.match(migration, new RegExp(`${field}=case`));
  assert.match(migration, /values\(onboarding\.id,auth\.uid\(\)/);
  assert.match(migration, /Founding Partner admin history is immutable/);
});

test("activation creates a governed marketplace profile without claiming credential verification", () => {
  assert.match(migration, /insert into public\.organizations/);
  assert.match(migration, /insert into public\.vendor_profiles/);
  assert.match(migration, /verification_status\)\s*values[\s\S]*'pending'/);
  assert.match(migration, /activate_vendor_membership\(vendor_org,'founding_partner'/);
  assert.match(migration, /vendor_badges where code='founding_partner'/);
  assert.match(migration, /update public\.organizations set status='suspended'/);
});

test("Founder list includes required metrics, filters, pagination, and responsive records", () => {
  for (const copy of ["Total payments", "Total revenue", "Onboarding incomplete", "Submitted for review", "Approved", "Active listings", "Payment status", "Application status", "Primary category", "Payment date"]) assert.match(listPage, new RegExp(copy));
  assert.match(listPage, /PAGE_SIZE = 25/);
  assert.match(listPage, /CopyContactButton label="Email"/);
  assert.match(listPage, /hidden overflow-x-auto[\s\S]*lg:block/);
  assert.match(listPage, /grid gap-4 lg:hidden/);
});

test("Founder detail exposes the complete record and audited review controls", () => {
  for (const section of ["Payment details", "Business details", "Services and service areas", "Verification details", "Marketplace profile", "Internal notes", "Status history"]) assert.match(detailPage, new RegExp(section));
  for (const action of ["approve", "request_changes", "reject", "activate", "suspend"]) assert.match(detailPage, new RegExp(`value="${action}"`));
});
