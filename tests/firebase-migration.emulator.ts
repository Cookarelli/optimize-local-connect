import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

const projectId = "demo-optimize-local-connect";
process.env.FIREBASE_PROJECT_ID = projectId;
process.env.GCLOUD_PROJECT = projectId;
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
const authFixture = new URL("./fixtures/firebase-auth-export.json", import.meta.url).pathname;
const authConflictFixture = new URL("./fixtures/firebase-auth-conflicts.json", import.meta.url).pathname;
const dataFixture = new URL("./fixtures/firebase-data-export.json", import.meta.url).pathname;

function run(script: string, fixture: string, apply = false) {
  const args = ["--conditions=react-server", "--import", "tsx", script, fixture, ...(apply ? ["--apply"] : [])];
  return JSON.parse(execFileSync(process.execPath, args, { cwd: new URL("..", import.meta.url), env: process.env, encoding: "utf8" })) as Record<string, unknown>;
}

test("Auth migration dry run and apply are conflict-aware and idempotent", () => {
  const dryRun = run("scripts/firebase-migration/import-auth.ts", authFixture);
  assert.equal(dryRun.mode, "dry-run");
  assert.equal(dryRun.importable, 5);
  assert.equal(dryRun.passwordUsers, 3);
  assert.equal(dryRun.googleUsers, 1);
  assert.equal(dryRun.activationFallback, 1);
  const applied = run("scripts/firebase-migration/import-auth.ts", authFixture, true);
  assert.equal(applied.importable, 5);
  const retry = run("scripts/firebase-migration/import-auth.ts", authFixture);
  assert.equal(retry.importable, 0);
  assert.equal(retry.existingUsersSkipped, 5);
});

test("Auth migration reports malformed and duplicate source identities without applying", () => {
  const dryRun = run("scripts/firebase-migration/import-auth.ts", authConflictFixture);
  assert.equal(dryRun.mode, "dry-run");
  assert.deepEqual(dryRun.conflicts, [
    "duplicate_source_email:duplicate-user@example.test",
    "invalid_uid:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  ]);
  assert.throws(() => run("scripts/firebase-migration/import-auth.ts", authConflictFixture, true), /conflicts must be resolved/);
});

test("Data migration imports one request model and produces stable checksums on retry", async () => {
  const { getPlatformFirestore } = await import("../src/lib/firebase/admin");
  const db = getPlatformFirestore();
  await Promise.all([
    db.doc("organizations/founder-authoritative-org").set({ name: "Authoritative Founder", type: "vendor", status: "active", activeMembershipId: "founder-authoritative-membership" }),
    db.doc("memberships/founder-authoritative-membership").set({ organizationId: "founder-authoritative-org", tier: "founding_partner", status: "manually_granted", categorySlug: "flooring", paymentSource: "manually_granted" }),
    db.doc("vendorProfiles/founder-authoritative-org").set({ organizationId: "founder-authoritative-org", businessName: "Authoritative Founder" }),
  ]);
  const first = run("scripts/firebase-migration/import-data.ts", dataFixture);
  assert.equal(first.mode, "dry-run");
  assert.equal(first.ignoredLegacyRequestRows, 1);
  assert.equal(first.requestModelImported, "property_manager_service_requests");
  assert.deepEqual(first.conflicts, [
    "organizations/founder-authoritative-org:existing_firestore_wins",
    "vendorProfiles/founder-authoritative-org:existing_firestore_wins",
    "memberships/founder-authoritative-membership:existing_firestore_wins",
  ]);
  const applied = run("scripts/firebase-migration/import-data.ts", dataFixture, true);
  const retry = run("scripts/firebase-migration/import-data.ts", dataFixture, true);
  assert.equal(applied.plannedWritesChecksum, retry.plannedWritesChecksum);
  assert.equal((await db.collection("serviceRequests").get()).size, 1);
  assert.equal((await db.doc("serviceRequests/66666666-6666-4666-8666-666666666666").get()).data()?.categorySlug, "plumbing-sewer");
  assert.equal((await db.collection("serviceRequests/66666666-6666-4666-8666-666666666666/events").get()).size, 1);
  assert.equal((await db.doc("organizations/33333333-3333-4333-8333-333333333333").get()).data()?.activeMembershipId, "55555555-5555-4555-8555-555555555555");
  assert.equal((await db.doc("organizations/founder-authoritative-org").get()).data()?.name, "Authoritative Founder");
  assert.equal((await db.doc("memberships/founder-authoritative-membership").get()).data()?.paymentSource, "manually_granted");
});
