import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc } from "firebase/firestore";
import { Timestamp } from "firebase-admin/firestore";
import type { AppUser, Membership } from "../src/domain/auth/types";

const projectId = "demo-optimize-local-connect";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_PROJECT_ID = projectId;
process.env.GCLOUD_PROJECT = projectId;

const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
const environment = await initializeTestEnvironment({ projectId, firestore: { host: "127.0.0.1", port: 8080, rules } });
const { getPlatformFirestore } = await import("../src/lib/firebase/admin");
const { emptyVendorProfile, rebuildPublicMarketplaceProjection } = await import("../src/lib/firebase/vendor-profiles");
const {
  assignFirebaseServiceRequest,
  getFirebaseServiceRequestForPm,
  listEligibleFirebaseVendors,
  markFirebaseServiceRequestReviewing,
  respondToFirebaseOpportunity,
  submitFirebaseServiceRequest,
  transitionFirebaseServiceRequest,
} = await import("../src/lib/firebase/service-requests");
const { reserveFirebaseRequestMediaUpload, validateFirebaseImage } = await import("../src/lib/firebase/storage");
const { searchFirebaseMarketplace } = await import("../src/lib/firebase/marketplace");
const { getApps, deleteApp } = await import("firebase-admin/app");
const db = getPlatformFirestore();

const now = () => Timestamp.now();
const membership = (id: string, organizationId: string, organizationName: string, organizationType: Membership["organizationType"], role: Membership["role"]): Membership => ({ id, organizationId, organizationName, organizationType, role });
const appUser = (id: string, access: Membership[] = [], isSuperAdmin = false): AppUser => ({ id, email: `${id}@example.test`, fullName: id, avatarUrl: null, isSuperAdmin, memberships: access });
const admin = appUser("platform-admin", [], true);
const pm = appUser("pm-owner", [membership("pm-org:pm-owner", "pm-org", "PM Company", "property_management", "owner")]);
const otherPm = appUser("other-pm", [membership("other-org:other-pm", "other-org", "Other PM", "property_management", "owner")]);
const vendorOne = appUser("vendor-one", [membership("vendor-one:vendor-one", "vendor-one", "Vendor One", "vendor", "owner")]);
const vendorTwo = appUser("vendor-two", [membership("vendor-two:vendor-two", "vendor-two", "Vendor Two", "vendor", "owner")]);
const multiVendor = appUser("multi-vendor", [membership("multi-vendor-one:multi-vendor", "multi-vendor-one", "Multi Vendor One", "vendor", "owner"), membership("multi-vendor-two:multi-vendor", "multi-vendor-two", "Multi Vendor Two", "vendor", "admin")]);

async function seedOrganizationAccess(user: AppUser, organizationId: string, type: "property_manager" | "vendor", status = "active") {
  const access = user.memberships.find((item) => item.organizationId === organizationId);
  await db.doc(`organizations/${organizationId}`).set({ type, status: "active", name: access?.organizationName ?? organizationId, normalizedName: organizationId, slug: organizationId, activeMembershipId: null, pendingMembershipId: null, createdAt: now(), updatedAt: now() });
  await db.doc(`organizationMemberships/${organizationId}:${user.id}`).set({ organizationId, userId: user.id, organizationType: type, role: access?.role ?? "owner", status, createdAt: now(), updatedAt: now() });
}

async function seedPmFoundation() {
  await seedOrganizationAccess(pm, "pm-org", "property_manager");
  await seedOrganizationAccess(otherPm, "other-org", "property_manager");
  await db.doc("properties/property-one").set({ organizationId: "pm-org", name: "Oak Apartments", address: { line1: "1 Oak St", line2: null, city: "Madison", stateCode: "WI", postalCode: "53703" }, serviceAreaKey: "madison-wi", status: "active", createdBy: pm.id, createdAt: now(), updatedAt: now() });
}

async function seedEligibleVendor(user: AppUser, organizationId: string, tier: "founding_partner" | "preferred" | "network", priority: 30 | 20 | 10) {
  await seedOrganizationAccess(user, organizationId, "vendor");
  const access = user.memberships.find((item) => item.organizationId === organizationId)!;
  const membershipId = `${organizationId}-membership`;
  await db.doc(`organizations/${organizationId}`).update({ activeMembershipId: membershipId });
  await db.doc(`memberships/${membershipId}`).set({ organizationId, tier, priority, status: "active", categorySlug: tier === "founding_partner" ? "plumbing-sewer" : null, paymentSource: tier === "founding_partner" ? "manually_granted" : "stripe", listPriceCents: 100, actualAmountPaidCents: 100, currency: "USD", stripe: tier === "founding_partner" ? null : { customerId: `cus_${organizationId}`, checkoutSessionId: null, subscriptionId: `sub_${organizationId}`, priceId: `price_${organizationId}` }, paypal: null, currentPeriodEndsAt: Timestamp.fromMillis(Date.now() + 86_400_000), cancelAtPeriodEnd: false, checkoutAttemptNumber: 1, entitlementsVersion: 1, entitlementSnapshot: {}, createdAt: now(), updatedAt: now() });
  const profile = emptyVendorProfile({ organizationId, businessName: access.organizationName });
  await db.doc(`vendorProfiles/${organizationId}`).set({ ...profile, description: "A complete and verified service description for emulator marketplace testing.", primaryCategorySlug: "plumbing-sewer", services: ["Drain repair"], serviceAreaKeys: ["madison-wi"], publicPhone: "555-555-0100", publicEmail: `${organizationId}@example.test`, publicDisplayConsent: true, approvalState: "approved", publicationState: "published", updatedAt: now() });
  const result = await rebuildPublicMarketplaceProjection(organizationId, db);
  assert.equal(result.published, true);
}

async function submitRequest() {
  return submitFirebaseServiceRequest({ user: pm, organizationId: "pm-org", propertyId: "property-one", categorySlug: "plumbing-sewer", categoryName: "Plumbing / Sewer", problemDescription: "A drain line is backing up in the first-floor utility room.", priority: "today", contactPreference: "email", contactName: "Property Manager", contactEmail: pm.email, accessInstructions: "Call before arrival." }, db);
}

test.beforeEach(async () => {
  await environment.clearFirestore();
  await seedPmFoundation();
  await db.doc(`platformAdmins/${admin.id}`).set({ status: "active", createdAt: now(), updatedAt: now() });
});

test.after(async () => {
  await environment.cleanup();
  await Promise.all(getApps().map((app) => deleteApp(app)));
});

test("tenant rules deny cross-organization and inactive access while allowing platform admins", async () => {
  const requestId = await submitRequest();
  const pmClient = environment.authenticatedContext(pm.id).firestore();
  const otherClient = environment.authenticatedContext(otherPm.id).firestore();
  const inactiveClient = environment.authenticatedContext("inactive-user").firestore();
  const adminClient = environment.authenticatedContext(admin.id).firestore();
  await db.doc("organizationMemberships/pm-org:inactive-user").set({ organizationId: "pm-org", userId: "inactive-user", role: "staff", status: "suspended" });
  await assertSucceeds(getDoc(doc(pmClient, "serviceRequests", requestId)));
  await assertFails(getDoc(doc(otherClient, "serviceRequests", requestId)));
  await assertFails(getDoc(doc(inactiveClient, "organizations", "pm-org")));
  await assertSucceeds(getDoc(doc(adminClient, "serviceRequestPrivate", requestId)));
  await assert.rejects(() => getFirebaseServiceRequestForPm(otherPm, "pm-org", requestId, db), /access/i);
});

test("marketplace projection enforces eligibility, tier order, and public-field isolation", async () => {
  await seedEligibleVendor(vendorOne, "vendor-one", "network", 10);
  await seedEligibleVendor(vendorTwo, "vendor-two", "preferred", 20);
  const ineligible = appUser("vendor-hidden", [membership("vendor-hidden:vendor-hidden", "vendor-hidden", "Hidden Vendor", "vendor", "owner")]);
  await seedOrganizationAccess(ineligible, "vendor-hidden", "vendor");
  await db.doc("memberships/vendor-hidden-membership").set({ organizationId: "vendor-hidden", tier: "founding_partner", priority: 30, status: "active", currentPeriodEndsAt: Timestamp.fromMillis(Date.now() + 86_400_000) });
  await db.doc("organizations/vendor-hidden").update({ activeMembershipId: "vendor-hidden-membership" });
  const hiddenProfile = emptyVendorProfile({ organizationId: "vendor-hidden", businessName: "Hidden Vendor" });
  await db.doc("vendorProfiles/vendor-hidden").set({ ...hiddenProfile, publicationState: "published", approvalState: "pending" });
  assert.equal((await rebuildPublicMarketplaceProjection("vendor-hidden", db)).published, false);
  const result = await searchFirebaseMarketplace({ q: "vendor", category: "plumbing-sewer", location: "Madison, WI" });
  assert.deepEqual(result.vendors.map((item) => item.name), ["Vendor Two", "Vendor One"]);
  const publicData = (await db.doc("publicMarketplaceVendors/vendor-two").get()).data()!;
  assert.equal(publicData.primaryCategoryName, "Plumbing / Sewer");
  for (const forbidden of ["stripe", "userId", "reviewNote", "license", "primaryEmail", "activeMembershipId"]) assert.equal(forbidden in publicData, false);
  const anonymous = environment.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(anonymous, "publicMarketplaceVendors", "vendor-two")));
  await assertFails(getDoc(doc(anonymous, "vendorProfiles", "vendor-two")));
});

test("request acceptance protects private data, is idempotent, and reaches completion", async () => {
  await seedEligibleVendor(vendorOne, "vendor-one", "preferred", 20);
  const requestId = await submitRequest();
  await markFirebaseServiceRequestReviewing({ user: admin, requestId }, db);
  const eligible = await listEligibleFirebaseVendors({ user: admin, requestId }, db);
  assert.deepEqual(eligible.map((item) => item.id), ["vendor-one"]);
  await assignFirebaseServiceRequest({ user: admin, requestId, vendorOrganizationId: "vendor-one" }, db);
  const vendorClient = environment.authenticatedContext(vendorOne.id).firestore();
  const unrelatedClient = environment.authenticatedContext("unrelated-vendor").firestore();
  await assertSucceeds(getDoc(doc(vendorClient, "serviceRequests", requestId)));
  await assertFails(getDoc(doc(vendorClient, "serviceRequestPrivate", requestId)));
  await assertFails(getDoc(doc(unrelatedClient, "serviceRequests", requestId)));
  assert.deepEqual(await respondToFirebaseOpportunity({ user: vendorOne, requestId, action: "accept" }, db), { duplicate: false, status: "accepted" });
  assert.deepEqual(await respondToFirebaseOpportunity({ user: vendorOne, requestId, action: "accept" }, db), { duplicate: true, status: "accepted" });
  await assertSucceeds(getDoc(doc(vendorClient, "serviceRequestPrivate", requestId)));
  assert.deepEqual(await transitionFirebaseServiceRequest({ user: vendorOne, requestId, status: "in_progress" }, db), { duplicate: false });
  assert.deepEqual(await transitionFirebaseServiceRequest({ user: vendorOne, requestId, status: "completed" }, db), { duplicate: false });
  assert.equal((await db.doc(`serviceRequests/${requestId}`).get()).data()?.status, "completed");
  const notificationTypes = (await db.collection("notifications").get()).docs.map((item) => item.data().type).sort();
  assert.deepEqual(notificationTypes, ["opportunity_accepted", "opportunity_assigned", "request_completed", "request_in_progress"]);
  assert.ok((await db.collection(`serviceRequests/${requestId}/events`).get()).size >= 5);
});

test("decline retries are idempotent and reassignment leaves one active assignment", async () => {
  await seedEligibleVendor(vendorOne, "vendor-one", "preferred", 20);
  await seedEligibleVendor(vendorTwo, "vendor-two", "network", 10);
  const requestId = await submitRequest();
  await markFirebaseServiceRequestReviewing({ user: admin, requestId }, db);
  await assignFirebaseServiceRequest({ user: admin, requestId, vendorOrganizationId: "vendor-one" }, db);
  assert.deepEqual(await respondToFirebaseOpportunity({ user: vendorOne, requestId, action: "decline", reason: "Outside capacity" }, db), { duplicate: false, status: "declined" });
  assert.deepEqual(await respondToFirebaseOpportunity({ user: vendorOne, requestId, action: "decline", reason: "retry" }, db), { duplicate: true, status: "declined" });
  await assignFirebaseServiceRequest({ user: admin, requestId, vendorOrganizationId: "vendor-two" }, db);
  const active = await db.collection("serviceRequestAssignments").where("requestId", "==", requestId).where("status", "==", "assigned").get();
  assert.equal(active.size, 1);
  assert.equal(active.docs[0]!.data().vendorOrganizationId, "vendor-two");
  assert.equal((await db.doc(`serviceRequests/${requestId}`).get()).data()?.declinedVendorOrganizationIds.includes("vendor-one"), true);
});

test("multi-organization vendor actions resolve the assigned organization", async () => {
  await seedEligibleVendor(multiVendor, "multi-vendor-one", "network", 10);
  await seedEligibleVendor(multiVendor, "multi-vendor-two", "preferred", 20);
  const requestId = await submitRequest();
  await markFirebaseServiceRequestReviewing({ user: admin, requestId }, db);
  await assignFirebaseServiceRequest({ user: admin, requestId, vendorOrganizationId: "multi-vendor-two" }, db);
  assert.deepEqual(await respondToFirebaseOpportunity({ user: multiVendor, requestId, action: "accept" }, db), { duplicate: false, status: "accepted" });
  assert.equal((await db.doc(`serviceRequests/${requestId}`).get()).data()?.acceptedVendorOrganizationId, "multi-vendor-two");
});

test("request media reservations are limited to five deterministic private paths", async () => {
  const requestId = await submitRequest();
  const paths = [];
  for (let index = 0; index < 5; index += 1) paths.push(await reserveFirebaseRequestMediaUpload({ user: pm, requestId, assetId: `asset_identifier_${index}` }, db));
  assert.equal(new Set(paths).size, 5);
  await assert.rejects(() => reserveFirebaseRequestMediaUpload({ user: pm, requestId, assetId: "asset_identifier_six" }, db), /at most five/i);
});

test("image validation rejects content-type spoofing", () => {
  assert.doesNotThrow(() => validateFirebaseImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png", "request"));
  assert.throws(() => validateFirebaseImage(new TextEncoder().encode("<html>not an image</html>"), "image/png", "request"), /do not match/i);
});
