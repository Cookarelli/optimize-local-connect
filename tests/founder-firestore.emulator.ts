import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertFails, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";

const projectId = "demo-optimize-local-connect";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_PROJECT_ID = projectId;
process.env.GCLOUD_PROJECT = projectId;

const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
const rulesEnvironment = await initializeTestEnvironment({ projectId, firestore: { host: "127.0.0.1", port: 8080, rules } });
const service = await import("../src/lib/founder-categories/firestore");
const { getFounderFirestore } = await import("../src/lib/firebase/admin");
const { getApps, deleteApp } = await import("firebase-admin/app");
const db = getFounderFirestore();

test.beforeEach(async () => {
  await rulesEnvironment.clearFirestore();
  await service.seedFounderCategories(db);
});

test.after(async () => {
  await rulesEnvironment.cleanup();
  await Promise.all(getApps().map((app) => deleteApp(app)));
});

const identity = (businessName: string, email: string) => ({ businessName, contactName: "Test Owner", email, phone: "555-555-0123" });

test("seed creates exactly 25 canonical categories and required initial state", async () => {
  const snapshot = await db.collection("founderCategories").orderBy("displayOrder").get();
  assert.equal(snapshot.size, 25);
  assert.deepEqual(snapshot.docs.map((item) => item.id), [
    "roofing", "flooring", "plumbing-sewer", "electrical", "hvac", "landscaping-snow",
    "general-contractor-remodeling", "drywall-plaster", "painting", "cleaning-janitorial",
    "pest-control", "tree-service", "water-fire-mold-restoration", "garage-doors",
    "appliance-repair", "locksmith-security", "windows-glass", "siding", "gutters",
    "concrete-masonry", "fencing", "junk-removal-hauling", "moving",
    "catering-party-catering", "handyman-property-maintenance",
  ]);
  assert.deepEqual(snapshot.docs.filter((item) => item.data().status === "available").map((item) => item.id), snapshot.docs.map((item) => item.id).filter((slug) => !["flooring", "roofing", "appliance-repair"].includes(slug)));
  assert.equal(snapshot.docs.find((item) => item.id === "flooring")?.data().publicBusinessName, "Flooring Trends");
  assert.equal(snapshot.docs.find((item) => item.id === "flooring")?.data().status, "claimed");
  assert.equal(snapshot.docs.find((item) => item.id === "roofing")?.data().publicBusinessName, "CLA Exteriors");
  assert.equal(snapshot.docs.find((item) => item.id === "roofing")?.data().status, "claimed");
  assert.equal(snapshot.docs.find((item) => item.id === "appliance-repair")?.data().status, "reserved");
  assert.equal(snapshot.docs.find((item) => item.id === "catering-party-catering")?.data().status, "available");
});

test("concurrent reservations allow exactly one buyer", async () => {
  const results = await Promise.allSettled([
    service.reserveFounderCategory({ ...identity("Painter One", "one@example.com"), categorySlug: "painting" }, db),
    service.reserveFounderCategory({ ...identity("Painter Two", "two@example.com"), categorySlug: "painting" }, db),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal((await db.doc("founderCategories/painting").get()).data()?.status, "reserved");
});

test("duplicate category is rejected and an exact released reservation can safely retry", async () => {
  const first = await service.reserveFounderCategory({ ...identity("Moving One", "moving-one@example.com"), categorySlug: "moving" }, db);
  await assert.rejects(() => service.reserveFounderCategory({ ...identity("Moving Two", "moving-two@example.com"), categorySlug: "moving" }, db), /unavailable/i);
  assert.equal(await service.releaseFounderReservation({ categorySlug: "moving", membershipId: first.membershipId, reservationId: first.reservationId, eventId: "evt_expired_one" }, db), true);
  assert.equal((await db.doc("founderCategories/moving").get()).data()?.status, "available");
  const retry = await service.reserveFounderCategory({ ...identity("Moving One", "moving-one@example.com"), categorySlug: "moving" }, db);
  assert.notEqual(retry.reservationId, first.reservationId);
  assert.equal(await service.releaseFounderReservation({ categorySlug: "moving", membershipId: first.membershipId, reservationId: first.reservationId }, db), false);
  assert.equal((await db.doc("founderCategories/moving").get()).data()?.reservation.id, retry.reservationId);
});

test("verified Stripe webhook claim is idempotent", async () => {
  const reservation = await service.reserveFounderCategory({ ...identity("Glass One", "glass@example.com"), categorySlug: "windows-glass" }, db);
  await service.attachFounderStripeCheckout({ ...reservation, customerId: "cus_test_founder", checkoutSessionId: "cs_test_founder" }, db);
  const claim = {
    eventId: "evt_test_founder", eventType: "checkout.session.completed", categorySlug: "windows-glass",
    organizationId: reservation.organizationId, membershipId: reservation.membershipId, reservationId: reservation.reservationId,
    checkoutSessionId: "cs_test_founder", subscriptionId: "sub_test_founder", customerId: "cus_test_founder", priceId: "price_test_founder",
    status: "active" as const, periodEnd: new Date("2027-08-16T12:00:00Z"), paidAt: new Date("2026-08-16T12:00:00Z"),
    actualAmountPaidCents: 49_900, currency: "USD",
  };
  await service.claimFounderFromVerifiedStripe(claim, db);
  await service.claimFounderFromVerifiedStripe(claim, db);
  assert.equal((await db.collection("memberships").get()).size, 1);
  assert.equal((await db.collection("founderPayments").get()).size, 1);
  assert.equal((await db.collection("founderPaymentEvents").get()).size, 1);
  assert.equal((await db.doc("founderCategories/windows-glass").get()).data()?.paymentSource, "stripe_paid");
});

test("Flooring Trends legacy Stripe reconciliation is idempotent and uses genuine-shaped references", async () => {
  const input = {
    categorySlug: "flooring", businessName: "Flooring Trends", customerEmail: "elise@example.com",
    checkoutSessionId: "cs_live_flooring", subscriptionId: "sub_live_flooring", customerId: "cus_live_flooring", priceId: "price_live_founder",
    status: "active" as const, periodEnd: new Date("2027-08-15T12:00:00Z"), paidAt: new Date("2026-08-15T12:00:00Z"),
    actualAmountPaidCents: 49_900, currency: "USD",
  };
  const first = await service.reconcileLegacyStripeFounder(input, db);
  const second = await service.reconcileLegacyStripeFounder(input, db);
  assert.deepEqual(second, first);
  assert.equal((await db.collection("memberships").where("categorySlug", "==", "flooring").get()).size, 1);
  assert.equal((await db.collection("founderPayments").where("categorySlug", "==", "flooring").get()).size, 1);
  assert.equal((await db.doc("founderCategories/flooring").get()).data()?.publicBusinessName, "Flooring Trends");
});

test("CLA manual grant is idempotent and fabricates no payment metadata", async () => {
  const first = await service.manuallyGrantFounder({ categorySlug: "roofing", businessName: "CLA Exteriors" }, db);
  const second = await service.manuallyGrantFounder({ categorySlug: "roofing", businessName: "CLA Exteriors" }, db);
  assert.deepEqual(second, first);
  const membership = (await db.doc(`memberships/${first.membershipId}`).get()).data();
  assert.equal(membership?.paymentSource, "manually_granted");
  assert.equal(membership?.stripe, null);
  assert.equal(membership?.paypal, null);
  assert.equal((await db.collection("founderPayments").get()).size, 0);
});

test("PayPal reconciliation records a discounted actual amount and rejects duplicate or occupied claims", async () => {
  await service.reconcilePaypalFounder({ categorySlug: "fencing", businessName: "Fence Co", contactEmail: "owner@fence.example", paypalReferenceId: "PAYPAL-REAL-001", actualAmountPaidCents: 39_900, currency: "USD", paidAt: new Date("2026-08-16T12:00:00Z") }, db);
  const payment = (await db.collection("founderPayments").where("categorySlug", "==", "fencing").get()).docs[0]?.data();
  assert.equal(payment?.listPriceCents, 49_900);
  assert.equal(payment?.actualAmountPaidCents, 39_900);
  assert.equal(payment?.paymentSource, "paypal_paid");
  await assert.rejects(() => service.reconcilePaypalFounder({ categorySlug: "tree-service", businessName: "Tree Co", paypalReferenceId: "PAYPAL-REAL-001", actualAmountPaidCents: 49_900, currency: "USD", paidAt: new Date() }, db), /duplicate/i);
  await assert.rejects(() => service.reconcilePaypalFounder({ categorySlug: "fencing", businessName: "Fence Two", paypalReferenceId: "PAYPAL-REAL-002", actualAmountPaidCents: 49_900, currency: "USD", paidAt: new Date() }, db), /unavailable/i);
});

test("public rules expose only sanitized category fields and deny all Founder writes", async () => {
  const anonymous = rulesEnvironment.unauthenticatedContext().firestore();
  const publicSnapshot = await getDocs(collection(anonymous, "publicFounderCategories"));
  assert.equal(publicSnapshot.size, 25);
  for (const publicDoc of publicSnapshot.docs) {
    assert.deepEqual(Object.keys(publicDoc.data()).sort(), ["displayName", "displayOrder", "publicBusinessName", "slug", "status"]);
  }
  await assertFails(getDoc(doc(anonymous, "founderCategories", "flooring")));
  await assertFails(setDoc(doc(anonymous, "publicFounderCategories", "flooring"), { status: "available" }));
  const authenticated = rulesEnvironment.authenticatedContext("malicious-client").firestore();
  await assertFails(setDoc(doc(authenticated, "founderCategories", "flooring"), { status: "available" }));
  await assertFails(setDoc(doc(authenticated, "memberships", "forged"), { status: "active", paymentSource: "stripe_paid" }));
});
