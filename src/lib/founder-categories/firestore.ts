import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import {
  FOUNDER_CATEGORY_CATALOG,
  FOUNDER_CURRENCY,
  FOUNDER_LIST_PRICE_CENTS,
  FOUNDER_RESERVATION_TTL_MS,
  initialFounderCategoryState,
  isFounderCategorySlug,
  type FounderCategorySlug,
  type FounderPaymentSource,
} from "@/src/domain/founder-categories/catalog";
import type { PublicFounderCategory } from "@/src/domain/founder-categories/public";
import { getFounderFirestore } from "@/src/lib/firebase/admin";
import { getVendorPlanByCode } from "@/src/domain/vendor-memberships/catalog";
import { slugify } from "@/src/lib/firebase/platform";

const FOUNDER_PLAN = getVendorPlanByCode("founding_partner")!;

type CheckoutIdentity = { businessName: string; contactName: string; email: string; phone: string };
type FounderReservation = { id: string; organizationId: string; membershipId: string; expiresAt: Timestamp; checkoutSessionId: string | null };
type FounderCategoryDocument = {
  displayName: string; slug: FounderCategorySlug; displayOrder: number; status: "available" | "reserved" | "claimed";
  publicBusinessName: string | null; claimedOrganizationId: string | null; membershipId: string | null;
  paymentSource: FounderPaymentSource | null; reservation: FounderReservation | null; createdAt: Timestamp; updatedAt: Timestamp;
};

function normalized(value: string) { return value.trim().replace(/\s+/g, " "); }
function digest(value: string) { return createHash("sha256").update(value).digest("hex").slice(0, 32); }
function organizationIdFor(identity: { businessName: string; email?: string }) { return `org_${digest(`${normalized(identity.businessName).toLowerCase()}|${identity.email?.trim().toLowerCase() ?? ""}`)}`; }
function membershipIdFor(organizationId: string, categorySlug: string) { return `founder_${digest(`${organizationId}|${categorySlug}`)}`; }
function referenceId(prefix: string, value: string) { return `${prefix}_${digest(value)}`; }
function asMillis(value: unknown) { return value instanceof Timestamp ? value.toMillis() : value instanceof Date ? value.getTime() : 0; }
function publicCategory(data: FounderCategoryDocument) {
  return { displayName: data.displayName, slug: data.slug, displayOrder: data.displayOrder, status: data.status, publicBusinessName: data.status === "claimed" ? data.publicBusinessName : null };
}
function availableCategory(current: FounderCategoryDocument, now: Timestamp): FounderCategoryDocument {
  return { ...current, status: "available", publicBusinessName: null, claimedOrganizationId: null, membershipId: null, paymentSource: null, reservation: null, updatedAt: now };
}
function validateMoney(amountCents: number, currency: string) {
  if (!Number.isInteger(amountCents) || amountCents <= 0 || !/^[A-Z]{3}$/.test(currency.toUpperCase())) throw new Error("Invalid Founder payment amount.");
}

export async function seedFounderCategories(db: Firestore = getFounderFirestore()) {
  const snapshot = await db.collection("founderCategories").get();
  const canonicalSlugs = new Set<string>(FOUNDER_CATEGORY_CATALOG.map((category) => category.slug));
  const unexpected = snapshot.docs.filter((doc) => !canonicalSlugs.has(doc.id));
  if (unexpected.length) throw new Error("Unexpected Founder category documents exist; seed aborted.");
  const existing = new Map(snapshot.docs.map((doc) => [doc.id, doc.data()]));
  const now = Timestamp.now();
  const batch = db.batch();
  for (const definition of FOUNDER_CATEGORY_CATALOG) {
    const current = existing.get(definition.slug) as FounderCategoryDocument | undefined;
    if (current && (current.slug !== definition.slug || current.displayName !== definition.displayName || current.displayOrder !== definition.displayOrder)) {
      throw new Error(`Founder category definition mismatch: ${definition.slug}`);
    }
    const state = initialFounderCategoryState(definition.slug);
    const data: FounderCategoryDocument = current ?? {
      ...definition, status: state.status, publicBusinessName: state.publicBusinessName,
      claimedOrganizationId: null, membershipId: null, paymentSource: state.paymentSource, reservation: null, createdAt: now, updatedAt: now,
    };
    if (!current) batch.create(db.doc(`founderCategories/${definition.slug}`), data);
    batch.set(db.doc(`publicFounderCategories/${definition.slug}`), publicCategory(data));
  }
  await batch.commit();
  return { total: FOUNDER_CATEGORY_CATALOG.length };
}

export async function getPublicFounderCategories(db: Firestore = getFounderFirestore()): Promise<PublicFounderCategory[]> {
  const snapshot = await db.collection("publicFounderCategories").orderBy("displayOrder").get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return { name: data.displayName, slug: data.slug, displayOrder: data.displayOrder, state: data.status, businessName: data.status === "claimed" ? data.publicBusinessName ?? null : null } as PublicFounderCategory;
  });
}

export async function listFounderCategoriesForAdmin(db: Firestore = getFounderFirestore()) {
  const snapshot = await db.collection("founderCategories").orderBy("displayOrder").get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function reserveFounderCategory(input: CheckoutIdentity & { categorySlug: string }, db: Firestore = getFounderFirestore()) {
  if (!isFounderCategorySlug(input.categorySlug)) throw new Error("Unknown Founder category.");
  const identity = { businessName: normalized(input.businessName), contactName: normalized(input.contactName), email: input.email.trim().toLowerCase(), phone: input.phone.trim() };
  if (identity.businessName.length < 2 || identity.contactName.length < 2 || !identity.email.includes("@") || identity.phone.length < 7) throw new Error("Invalid Founder business details.");
  const organizationId = organizationIdFor(identity);
  const membershipId = membershipIdFor(organizationId, input.categorySlug);
  const reservationId = randomUUID();
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + FOUNDER_RESERVATION_TTL_MS);
  const categoryRef = db.doc(`founderCategories/${input.categorySlug}`);
  const publicRef = db.doc(`publicFounderCategories/${input.categorySlug}`);
  const organizationRef = db.doc(`organizations/${organizationId}`);
  const membershipRef = db.doc(`memberships/${membershipId}`);
  const occupancyRef = db.doc(`founderOccupancies/${organizationId}`);

  return db.runTransaction(async (transaction) => {
    const categorySnapshot = await transaction.get(categoryRef);
    if (!categorySnapshot.exists) throw new Error("Unknown Founder category.");
    let category = categorySnapshot.data() as FounderCategoryDocument;
    const priorReservation = category.reservation;
    const priorMembershipRef = priorReservation ? db.doc(`memberships/${priorReservation.membershipId}`) : null;
    const priorOccupancyRef = priorReservation ? db.doc(`founderOccupancies/${priorReservation.organizationId}`) : null;
    const [organizationSnapshot, membershipSnapshot, occupancySnapshot, priorMembershipSnapshot, priorOccupancySnapshot] = await Promise.all([
      transaction.get(organizationRef), transaction.get(membershipRef), transaction.get(occupancyRef),
      priorMembershipRef ? transaction.get(priorMembershipRef) : Promise.resolve(null), priorOccupancyRef ? transaction.get(priorOccupancyRef) : Promise.resolve(null),
    ]);

    if (category.status === "reserved" && category.paymentSource === null && priorReservation) {
      if (priorReservation.organizationId === organizationId && asMillis(priorReservation.expiresAt) > now.toMillis()) {
        return { organizationId, membershipId: priorReservation.membershipId, reservationId: priorReservation.id, categorySlug: input.categorySlug, expiresAt: priorReservation.expiresAt.toDate(), checkoutAttemptNumber: 1 };
      }
      if (asMillis(priorReservation.expiresAt) <= now.toMillis()) {
        if (priorMembershipSnapshot?.exists) transaction.set(priorMembershipRef!, { status: "expired", updatedAt: now }, { merge: true });
        if (priorOccupancySnapshot?.exists && priorOccupancySnapshot.data()?.reservationId === priorReservation.id) transaction.delete(priorOccupancyRef!);
        category = availableCategory(category, now);
      }
    }
    if (category.status !== "available") throw new Error("Founder category is unavailable.");
    if (occupancySnapshot.exists) {
      const occupancy = occupancySnapshot.data();
      if (occupancy && (occupancy.status === "claimed" || asMillis(occupancy.expiresAt) > now.toMillis())) throw new Error("Organization already occupies a Founder category.");
    }
    const reservation: FounderReservation = { id: reservationId, organizationId, membershipId, expiresAt, checkoutSessionId: null };
    const nextCategory: FounderCategoryDocument = { ...category, status: "reserved", publicBusinessName: identity.businessName, claimedOrganizationId: organizationId, membershipId, paymentSource: null, reservation, updatedAt: now };
    transaction.set(organizationRef, { type: "vendor", status: organizationSnapshot.data()?.status ?? "pending", name: identity.businessName, normalizedName: identity.businessName.toLowerCase(), slug: organizationSnapshot.data()?.slug ?? slugify(identity.businessName), contactName: identity.contactName, contactEmail: identity.email, contactPhone: identity.phone, primaryEmail: identity.email, primaryPhone: identity.phone, activeMembershipId: organizationSnapshot.data()?.activeMembershipId ?? null, pendingMembershipId: membershipId, ...(organizationSnapshot.exists ? {} : { createdAt: now }), updatedAt: now }, { merge: true });
    transaction.set(membershipRef, { tier: "founding_partner", priority: 30, organizationId, categorySlug: input.categorySlug, status: "pending", paymentSource: null, listPriceCents: FOUNDER_LIST_PRICE_CENTS, actualAmountPaidCents: null, currency: FOUNDER_CURRENCY, stripe: null, paypal: null, reservationId, reservationExpiresAt: expiresAt, checkoutAttemptNumber: 1, entitlementsVersion: 1, entitlementSnapshot: FOUNDER_PLAN.entitlements, ...(membershipSnapshot.exists ? {} : { createdAt: now }), updatedAt: now }, { merge: true });
    transaction.set(occupancyRef, { organizationId, categorySlug: input.categorySlug, membershipId, reservationId, status: "pending", expiresAt, updatedAt: now });
    transaction.set(categoryRef, nextCategory);
    transaction.set(publicRef, publicCategory(nextCategory));
    return { organizationId, membershipId, reservationId, categorySlug: input.categorySlug, expiresAt: expiresAt.toDate(), checkoutAttemptNumber: 1 };
  });
}

export async function attachFounderStripeCheckout(input: { categorySlug: string; organizationId: string; membershipId: string; reservationId: string; customerId: string; checkoutSessionId: string }, db: Firestore = getFounderFirestore()) {
  const categoryRef = db.doc(`founderCategories/${input.categorySlug}`); const membershipRef = db.doc(`memberships/${input.membershipId}`);
  await db.runTransaction(async (transaction) => {
    const [categorySnapshot, membershipSnapshot] = await Promise.all([transaction.get(categoryRef), transaction.get(membershipRef)]);
    const category = categorySnapshot.data() as FounderCategoryDocument | undefined; const membership = membershipSnapshot.data();
    if (!category || !membership || category.status !== "reserved" || category.membershipId !== input.membershipId || category.reservation?.id !== input.reservationId || membership.organizationId !== input.organizationId) throw new Error("Founder checkout reservation not found.");
    const now = Timestamp.now();
    transaction.update(categoryRef, { "reservation.checkoutSessionId": input.checkoutSessionId, updatedAt: now });
    transaction.update(membershipRef, { stripe: { customerId: input.customerId, checkoutSessionId: input.checkoutSessionId, subscriptionId: null, priceId: null }, updatedAt: now });
  });
}

export async function releaseFounderReservation(input: { categorySlug: string; membershipId: string; reservationId: string; eventId?: string }, db: Firestore = getFounderFirestore()) {
  const categoryRef = db.doc(`founderCategories/${input.categorySlug}`); const publicRef = db.doc(`publicFounderCategories/${input.categorySlug}`);
  const membershipRef = db.doc(`memberships/${input.membershipId}`); const eventRef = input.eventId ? db.doc(`founderPaymentEvents/${referenceId("stripe", input.eventId)}`) : null;
  return db.runTransaction(async (transaction) => {
    const [categorySnapshot, membershipSnapshot, eventSnapshot] = await Promise.all([transaction.get(categoryRef), transaction.get(membershipRef), eventRef ? transaction.get(eventRef) : Promise.resolve(null)]);
    if (eventSnapshot?.exists) return false;
    const category = categorySnapshot.data() as FounderCategoryDocument | undefined;
    if (!category || !membershipSnapshot.exists || category.status !== "reserved" || category.paymentSource !== null || category.membershipId !== input.membershipId || category.reservation?.id !== input.reservationId) return false;
    const occupancyRef = db.doc(`founderOccupancies/${category.reservation.organizationId}`); const organizationRef = db.doc(`organizations/${category.reservation.organizationId}`);
    const [occupancySnapshot, organizationSnapshot] = await Promise.all([transaction.get(occupancyRef), transaction.get(organizationRef)]);
    const now = Timestamp.now(); const nextCategory = availableCategory(category, now);
    transaction.set(categoryRef, nextCategory); transaction.set(publicRef, publicCategory(nextCategory));
    transaction.update(membershipRef, { status: "expired", reservationExpiresAt: null, updatedAt: now });
    if (organizationSnapshot.exists && organizationSnapshot.data()?.pendingMembershipId === input.membershipId) transaction.update(organizationRef, { pendingMembershipId: null, updatedAt: now });
    if (occupancySnapshot.exists && occupancySnapshot.data()?.reservationId === input.reservationId) transaction.delete(occupancyRef);
    if (eventRef) transaction.create(eventRef, { provider: "stripe", eventId: input.eventId, eventType: "checkout.session.expired", membershipId: input.membershipId, processedAt: now });
    return true;
  });
}

type VerifiedStripeFounder = {
  eventId: string; eventType: string; categorySlug: string; organizationId: string; membershipId: string; reservationId: string;
  checkoutSessionId?: string | null; subscriptionId: string; customerId: string; priceId: string; status: "active" | "trialing" | "past_due";
  periodEnd: Date; paidAt: Date; actualAmountPaidCents: number; currency: string;
};

export async function claimFounderFromVerifiedStripe(input: VerifiedStripeFounder, db: Firestore = getFounderFirestore()) {
  validateMoney(input.actualAmountPaidCents, input.currency);
  const categoryRef = db.doc(`founderCategories/${input.categorySlug}`); const publicRef = db.doc(`publicFounderCategories/${input.categorySlug}`);
  const membershipRef = db.doc(`memberships/${input.membershipId}`); const occupancyRef = db.doc(`founderOccupancies/${input.organizationId}`);
  const organizationRef = db.doc(`organizations/${input.organizationId}`);
  const eventRef = db.doc(`founderPaymentEvents/${referenceId("stripe", input.eventId)}`); const paymentRef = db.doc(`founderPayments/${referenceId("stripe", input.subscriptionId)}`);
  return db.runTransaction(async (transaction) => {
    const [eventSnapshot, categorySnapshot, membershipSnapshot, occupancySnapshot, paymentSnapshot, organizationSnapshot] = await Promise.all([transaction.get(eventRef), transaction.get(categoryRef), transaction.get(membershipRef), transaction.get(occupancyRef), transaction.get(paymentRef), transaction.get(organizationRef)]);
    if (eventSnapshot.exists) return input.membershipId;
    const category = categorySnapshot.data() as FounderCategoryDocument | undefined; const membership = membershipSnapshot.data();
    if (!category || !membership || membership.organizationId !== input.organizationId || membership.categorySlug !== input.categorySlug || membership.reservationId !== input.reservationId) throw new Error("Founder membership mapping mismatch.");
    const sameClaim = category.status === "claimed" && category.membershipId === input.membershipId && category.claimedOrganizationId === input.organizationId;
    const validReservation = category.status === "reserved" && category.paymentSource === null && category.membershipId === input.membershipId && category.reservation?.id === input.reservationId;
    if (!sameClaim && !validReservation) throw new Error("Founder category reservation is no longer valid.");
    if (paymentSnapshot.exists && paymentSnapshot.data()?.membershipId !== input.membershipId) throw new Error("Stripe subscription already belongs to another membership.");
    if (occupancySnapshot.exists && occupancySnapshot.data()?.membershipId !== input.membershipId) throw new Error("Organization already occupies another Founder category.");
    const checkoutSessionId = input.checkoutSessionId ?? membership.stripe?.checkoutSessionId ?? null;
    if (!checkoutSessionId?.startsWith("cs_") || !input.subscriptionId.startsWith("sub_") || !input.customerId.startsWith("cus_") || !input.priceId.startsWith("price_")) throw new Error("Verified Stripe references are incomplete.");
    const now = Timestamp.now(); const nextCategory: FounderCategoryDocument = { ...category, status: "claimed", publicBusinessName: category.publicBusinessName ?? "Founding Member", claimedOrganizationId: input.organizationId, membershipId: input.membershipId, paymentSource: "stripe_paid", reservation: null, updatedAt: now };
    transaction.set(categoryRef, nextCategory); transaction.set(publicRef, publicCategory(nextCategory));
    transaction.set(membershipRef, { status: input.status, priority: 30, paymentSource: "stripe_paid", listPriceCents: FOUNDER_LIST_PRICE_CENTS, actualAmountPaidCents: input.actualAmountPaidCents, currency: input.currency.toUpperCase(), stripe: { customerId: input.customerId, checkoutSessionId, subscriptionId: input.subscriptionId, priceId: input.priceId }, paypal: null, currentPeriodEndsAt: Timestamp.fromDate(input.periodEnd), paidAt: Timestamp.fromDate(input.paidAt), reservationExpiresAt: null, entitlementsVersion: 1, entitlementSnapshot: FOUNDER_PLAN.entitlements, updatedAt: now }, { merge: true });
    transaction.set(organizationRef, { type: "vendor", status: "active", activeMembershipId: input.membershipId, pendingMembershipId: null, ...(organizationSnapshot.exists ? {} : { createdAt: now }), updatedAt: now }, { merge: true });
    transaction.set(occupancyRef, { organizationId: input.organizationId, categorySlug: input.categorySlug, membershipId: input.membershipId, status: "claimed", reservationId: null, expiresAt: null, updatedAt: now });
    if (!paymentSnapshot.exists) transaction.create(paymentRef, { provider: "stripe", paymentSource: "stripe_paid", organizationId: input.organizationId, membershipId: input.membershipId, categorySlug: input.categorySlug, listPriceCents: FOUNDER_LIST_PRICE_CENTS, actualAmountPaidCents: input.actualAmountPaidCents, currency: input.currency.toUpperCase(), checkoutSessionId, subscriptionId: input.subscriptionId, customerId: input.customerId, priceId: input.priceId, paidAt: Timestamp.fromDate(input.paidAt), createdAt: now });
    transaction.create(eventRef, { provider: "stripe", eventId: input.eventId, eventType: input.eventType, membershipId: input.membershipId, categorySlug: input.categorySlug, processedAt: now });
    return input.membershipId;
  });
}

type LegacyStripeReconciliation = Omit<VerifiedStripeFounder, "eventId" | "eventType" | "organizationId" | "membershipId" | "reservationId" | "checkoutSessionId"> & { checkoutSessionId: string; businessName: string; customerEmail: string; organizationId?: string | null };
export async function reconcileLegacyStripeFounder(input: LegacyStripeReconciliation, db: Firestore = getFounderFirestore()) {
  if (!isFounderCategorySlug(input.categorySlug)) throw new Error("Unknown Founder category.");
  validateMoney(input.actualAmountPaidCents, input.currency);
  const businessName = normalized(input.businessName); const organizationId = input.organizationId ?? organizationIdFor({ businessName, email: input.customerEmail });
  const membershipId = membershipIdFor(organizationId, input.categorySlug); const paymentId = referenceId("stripe", input.subscriptionId);
  const categoryRef = db.doc(`founderCategories/${input.categorySlug}`); const publicRef = db.doc(`publicFounderCategories/${input.categorySlug}`);
  const organizationRef = db.doc(`organizations/${organizationId}`); const membershipRef = db.doc(`memberships/${membershipId}`); const occupancyRef = db.doc(`founderOccupancies/${organizationId}`); const paymentRef = db.doc(`founderPayments/${paymentId}`); const eventRef = db.doc(`founderPaymentEvents/${referenceId("stripe_reconcile", input.checkoutSessionId)}`);
  return db.runTransaction(async (transaction) => {
    const [categorySnapshot, organizationSnapshot, membershipSnapshot, occupancySnapshot, paymentSnapshot, eventSnapshot] = await Promise.all([transaction.get(categoryRef), transaction.get(organizationRef), transaction.get(membershipRef), transaction.get(occupancyRef), transaction.get(paymentRef), transaction.get(eventRef)]);
    if (eventSnapshot.exists) return { organizationId, membershipId };
    const category = categorySnapshot.data() as FounderCategoryDocument | undefined;
    if (!category) throw new Error("Unknown Founder category.");
    const placeholder = category.status === "claimed" && category.paymentSource === "reserved_without_membership" && category.publicBusinessName?.toLowerCase() === businessName.toLowerCase();
    const sameClaim = category.status === "claimed" && category.paymentSource === "stripe_paid" && category.membershipId === membershipId;
    if (category.status !== "available" && !placeholder && !sameClaim) throw new Error("Founder category is unavailable.");
    if (paymentSnapshot.exists && paymentSnapshot.data()?.membershipId !== membershipId) throw new Error("Stripe subscription already reconciled.");
    if (occupancySnapshot.exists && occupancySnapshot.data()?.membershipId !== membershipId) throw new Error("Organization already occupies another Founder category.");
    const existingMembership = membershipSnapshot.data();
    if (existingMembership?.stripe?.subscriptionId && existingMembership.stripe.subscriptionId !== input.subscriptionId) throw new Error("Founder membership has conflicting Stripe references.");
    const now = Timestamp.now(); const nextCategory: FounderCategoryDocument = { ...category, status: "claimed", publicBusinessName: businessName, claimedOrganizationId: organizationId, membershipId, paymentSource: "stripe_paid", reservation: null, updatedAt: now };
    transaction.set(organizationRef, { type: "vendor", status: organizationSnapshot.data()?.status ?? "active", name: businessName, normalizedName: businessName.toLowerCase(), slug: organizationSnapshot.data()?.slug ?? slugify(businessName), contactEmail: input.customerEmail.toLowerCase(), primaryEmail: input.customerEmail.toLowerCase(), activeMembershipId: membershipId, pendingMembershipId: null, ...(organizationSnapshot.exists ? {} : { createdAt: now }), updatedAt: now }, { merge: true });
    transaction.set(membershipRef, { tier: "founding_partner", priority: 30, organizationId, categorySlug: input.categorySlug, status: input.status, paymentSource: "stripe_paid", listPriceCents: FOUNDER_LIST_PRICE_CENTS, actualAmountPaidCents: input.actualAmountPaidCents, currency: input.currency.toUpperCase(), stripe: { customerId: input.customerId, checkoutSessionId: input.checkoutSessionId, subscriptionId: input.subscriptionId, priceId: input.priceId }, paypal: null, currentPeriodEndsAt: Timestamp.fromDate(input.periodEnd), paidAt: Timestamp.fromDate(input.paidAt), entitlementsVersion: 1, entitlementSnapshot: FOUNDER_PLAN.entitlements, ...(membershipSnapshot.exists ? {} : { createdAt: now }), updatedAt: now }, { merge: true });
    transaction.set(occupancyRef, { organizationId, categorySlug: input.categorySlug, membershipId, status: "claimed", reservationId: null, expiresAt: null, updatedAt: now });
    transaction.set(categoryRef, nextCategory); transaction.set(publicRef, publicCategory(nextCategory));
    if (!paymentSnapshot.exists) transaction.create(paymentRef, { provider: "stripe", paymentSource: "stripe_paid", organizationId, membershipId, categorySlug: input.categorySlug, listPriceCents: FOUNDER_LIST_PRICE_CENTS, actualAmountPaidCents: input.actualAmountPaidCents, currency: input.currency.toUpperCase(), checkoutSessionId: input.checkoutSessionId, subscriptionId: input.subscriptionId, customerId: input.customerId, priceId: input.priceId, paidAt: Timestamp.fromDate(input.paidAt), createdAt: now });
    transaction.create(eventRef, { provider: "stripe", eventType: "legacy_checkout_reconciled", checkoutSessionId: input.checkoutSessionId, membershipId, categorySlug: input.categorySlug, processedAt: now });
    return { organizationId, membershipId };
  });
}

export async function manuallyGrantFounder(input: { categorySlug: string; businessName: string; organizationId?: string | null }, db: Firestore = getFounderFirestore()) {
  if (!isFounderCategorySlug(input.categorySlug)) throw new Error("Unknown Founder category.");
  const businessName = normalized(input.businessName); const organizationId = input.organizationId ?? organizationIdFor({ businessName }); const membershipId = membershipIdFor(organizationId, input.categorySlug);
  const categoryRef = db.doc(`founderCategories/${input.categorySlug}`); const publicRef = db.doc(`publicFounderCategories/${input.categorySlug}`); const organizationRef = db.doc(`organizations/${organizationId}`); const membershipRef = db.doc(`memberships/${membershipId}`); const occupancyRef = db.doc(`founderOccupancies/${organizationId}`);
  return db.runTransaction(async (transaction) => {
    const [categorySnapshot, organizationSnapshot, membershipSnapshot, occupancySnapshot] = await Promise.all([transaction.get(categoryRef), transaction.get(organizationRef), transaction.get(membershipRef), transaction.get(occupancyRef)]);
    const category = categorySnapshot.data() as FounderCategoryDocument | undefined; if (!category) throw new Error("Unknown Founder category.");
    const sameGrant = category.status === "claimed" && category.paymentSource === "manually_granted" && category.membershipId === membershipId;
    if (sameGrant) return { organizationId, membershipId };
    const placeholder = category.status === "claimed" && category.paymentSource === "reserved_without_membership" && category.publicBusinessName?.toLowerCase() === businessName.toLowerCase();
    if (category.status !== "available" && !placeholder) throw new Error("Founder category is unavailable.");
    if (occupancySnapshot.exists && occupancySnapshot.data()?.membershipId !== membershipId) throw new Error("Organization already occupies another Founder category.");
    const existingMembership = membershipSnapshot.data(); if (existingMembership?.paymentSource && existingMembership.paymentSource !== "manually_granted") throw new Error("Founder membership already has a payment source.");
    const now = Timestamp.now(); const nextCategory: FounderCategoryDocument = { ...category, status: "claimed", publicBusinessName: businessName, claimedOrganizationId: organizationId, membershipId, paymentSource: "manually_granted", reservation: null, updatedAt: now };
    transaction.set(organizationRef, { type: "vendor", status: organizationSnapshot.data()?.status ?? "active", name: businessName, normalizedName: businessName.toLowerCase(), slug: organizationSnapshot.data()?.slug ?? slugify(businessName), activeMembershipId: membershipId, pendingMembershipId: null, ...(organizationSnapshot.exists ? {} : { createdAt: now }), updatedAt: now }, { merge: true });
    transaction.set(membershipRef, { tier: "founding_partner", priority: 30, organizationId, categorySlug: input.categorySlug, status: "manually_granted", paymentSource: "manually_granted", listPriceCents: FOUNDER_LIST_PRICE_CENTS, actualAmountPaidCents: null, currency: FOUNDER_CURRENCY, stripe: null, paypal: null, entitlementsVersion: 1, entitlementSnapshot: FOUNDER_PLAN.entitlements, ...(membershipSnapshot.exists ? {} : { createdAt: now }), updatedAt: now }, { merge: true });
    transaction.set(occupancyRef, { organizationId, categorySlug: input.categorySlug, membershipId, status: "claimed", reservationId: null, expiresAt: null, updatedAt: now }); transaction.set(categoryRef, nextCategory); transaction.set(publicRef, publicCategory(nextCategory));
    return { organizationId, membershipId };
  });
}

export async function reconcilePaypalFounder(input: { categorySlug: string; businessName: string; organizationId?: string | null; contactEmail?: string | null; paypalReferenceId: string; actualAmountPaidCents: number; currency: string; paidAt: Date }, db: Firestore = getFounderFirestore()) {
  if (!isFounderCategorySlug(input.categorySlug)) throw new Error("Unknown Founder category."); validateMoney(input.actualAmountPaidCents, input.currency);
  const paypalReference = input.paypalReferenceId.trim(); if (paypalReference.length < 3) throw new Error("PayPal transaction reference is required.");
  const businessName = normalized(input.businessName); const organizationId = input.organizationId ?? organizationIdFor({ businessName, email: input.contactEmail ?? undefined }); const membershipId = membershipIdFor(organizationId, input.categorySlug); const paymentId = referenceId("paypal", paypalReference.toLowerCase());
  const categoryRef = db.doc(`founderCategories/${input.categorySlug}`); const publicRef = db.doc(`publicFounderCategories/${input.categorySlug}`); const organizationRef = db.doc(`organizations/${organizationId}`); const membershipRef = db.doc(`memberships/${membershipId}`); const occupancyRef = db.doc(`founderOccupancies/${organizationId}`); const paymentRef = db.doc(`founderPayments/${paymentId}`); const referenceRef = db.doc(`paypalPaymentReferences/${paymentId}`);
  return db.runTransaction(async (transaction) => {
    const [categorySnapshot, organizationSnapshot, membershipSnapshot, occupancySnapshot, paymentSnapshot, referenceSnapshot] = await Promise.all([transaction.get(categoryRef), transaction.get(organizationRef), transaction.get(membershipRef), transaction.get(occupancyRef), transaction.get(paymentRef), transaction.get(referenceRef)]);
    if (paymentSnapshot.exists || referenceSnapshot.exists) throw new Error("Duplicate PayPal transaction reference.");
    const category = categorySnapshot.data() as FounderCategoryDocument | undefined; if (!category || category.status !== "available") throw new Error("Founder category is unavailable.");
    if (occupancySnapshot.exists) throw new Error("Organization already occupies a Founder category."); if (membershipSnapshot.exists) throw new Error("Founder membership already exists.");
    const now = Timestamp.now(); const nextCategory: FounderCategoryDocument = { ...category, status: "claimed", publicBusinessName: businessName, claimedOrganizationId: organizationId, membershipId, paymentSource: "paypal_paid", reservation: null, updatedAt: now };
    transaction.set(organizationRef, { type: "vendor", status: organizationSnapshot.data()?.status ?? "active", name: businessName, normalizedName: businessName.toLowerCase(), slug: organizationSnapshot.data()?.slug ?? slugify(businessName), activeMembershipId: membershipId, pendingMembershipId: null, ...(input.contactEmail ? { contactEmail: input.contactEmail.toLowerCase(), primaryEmail: input.contactEmail.toLowerCase() } : {}), ...(organizationSnapshot.exists ? {} : { createdAt: now }), updatedAt: now }, { merge: true });
    transaction.create(membershipRef, { tier: "founding_partner", priority: 30, organizationId, categorySlug: input.categorySlug, status: "active", paymentSource: "paypal_paid", listPriceCents: FOUNDER_LIST_PRICE_CENTS, actualAmountPaidCents: input.actualAmountPaidCents, currency: input.currency.toUpperCase(), stripe: null, paypal: { referenceId: paypalReference }, entitlementsVersion: 1, entitlementSnapshot: FOUNDER_PLAN.entitlements, paidAt: Timestamp.fromDate(input.paidAt), createdAt: now, updatedAt: now });
    transaction.set(occupancyRef, { organizationId, categorySlug: input.categorySlug, membershipId, status: "claimed", reservationId: null, expiresAt: null, updatedAt: now }); transaction.set(categoryRef, nextCategory); transaction.set(publicRef, publicCategory(nextCategory));
    transaction.create(paymentRef, { provider: "paypal", paymentSource: "paypal_paid", organizationId, membershipId, categorySlug: input.categorySlug, listPriceCents: FOUNDER_LIST_PRICE_CENTS, actualAmountPaidCents: input.actualAmountPaidCents, currency: input.currency.toUpperCase(), paypalReferenceId: paypalReference, paidAt: Timestamp.fromDate(input.paidAt), createdAt: now });
    transaction.create(referenceRef, { paypalReferenceId: paypalReference, paymentId, membershipId, createdAt: now });
    return { organizationId, membershipId };
  });
}

export async function setFounderCategoryReserved(input: { categorySlug: string; reserved: boolean }, db: Firestore = getFounderFirestore()) {
  if (!isFounderCategorySlug(input.categorySlug)) throw new Error("Unknown Founder category.");
  const categoryRef = db.doc(`founderCategories/${input.categorySlug}`); const publicRef = db.doc(`publicFounderCategories/${input.categorySlug}`);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(categoryRef); const category = snapshot.data() as FounderCategoryDocument | undefined; if (!category) throw new Error("Unknown Founder category.");
    if (input.reserved && category.status !== "available") throw new Error("Only an available category can be reserved.");
    if (!input.reserved && (category.status !== "reserved" || category.paymentSource !== "reserved_without_membership" || category.membershipId !== null)) throw new Error("Only an unclaimed manual reservation can be released.");
    const now = Timestamp.now(); const nextCategory: FounderCategoryDocument = input.reserved ? { ...category, status: "reserved", publicBusinessName: null, claimedOrganizationId: null, membershipId: null, paymentSource: "reserved_without_membership", reservation: null, updatedAt: now } : availableCategory(category, now);
    transaction.set(categoryRef, nextCategory); transaction.set(publicRef, publicCategory(nextCategory));
  });
}
