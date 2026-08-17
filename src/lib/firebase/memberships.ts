import "server-only";

import { Timestamp, type Firestore } from "firebase-admin/firestore";
import type { AppUser } from "@/src/domain/auth/types";
import { getVendorPlan, type VendorMembershipStatus, type VendorPlanKey } from "@/src/domain/vendor-memberships/catalog";
import type { CommercialMembershipDocument } from "@/src/domain/firebase-platform/types";
import { getPlatformFirestore } from "@/src/lib/firebase/admin";
import { requireOrganizationMembership } from "@/src/lib/firebase/authorization";
import { pendingCommercialMembershipId } from "@/src/lib/firebase/platform";

const OPERATIONAL_STATUSES = new Set<VendorMembershipStatus>(["active", "trialing", "past_due", "complimentary", "manually_granted"]);

export function isOperationalMembership(data: { status?: string; currentPeriodEndsAt?: Timestamp | null }, now = Timestamp.now()) {
  if (!OPERATIONAL_STATUSES.has(data.status as VendorMembershipStatus)) return false;
  return data.status !== "past_due" || Boolean(data.currentPeriodEndsAt && data.currentPeriodEndsAt.toMillis() > now.toMillis());
}

export async function reserveFirebaseCommercialMembership(input: { user: AppUser; organizationId: string; tier: Exclude<VendorPlanKey, "founding_partner"> }, db: Firestore = getPlatformFirestore()) {
  requireOrganizationMembership(input.user, input.organizationId, ["owner", "admin"]);
  const plan = getVendorPlan(input.tier);
  if (!plan || plan.key === "founding_partner") throw new Error("Use Founder category enrollment for a Founding Member.");
  const organizationRef = db.doc(`organizations/${input.organizationId}`);
  const membershipId = pendingCommercialMembershipId(input.organizationId, plan.key);
  const membershipRef = db.doc(`memberships/${membershipId}`);
  const now = Timestamp.now();
  return db.runTransaction(async (transaction) => {
    const [organizationSnapshot, membershipSnapshot] = await Promise.all([transaction.get(organizationRef), transaction.get(membershipRef)]);
    const organization = organizationSnapshot.data();
    if (!organization || organization.type !== "vendor" || organization.status === "suspended") throw new Error("Vendor organization is unavailable.");
    if (organization.activeMembershipId) {
      const active = await transaction.get(db.doc(`memberships/${organization.activeMembershipId}`));
      const activeData = active.data();
      if (activeData && isOperationalMembership(activeData)) throw new Error("Organization already has an active membership.");
    }
    const existing = membershipSnapshot.data();
    if (existing && isOperationalMembership(existing)) throw new Error("Organization already has an active membership.");
    const attempt = Number(existing?.checkoutAttemptNumber ?? 0) + 1;
    transaction.set(membershipRef, {
      organizationId: input.organizationId,
      tier: plan.key,
      priority: plan.placementPriority,
      status: "pending",
      categorySlug: null,
      paymentSource: "stripe",
      listPriceCents: plan.amountCents,
      actualAmountPaidCents: null,
      currency: plan.currency,
      stripe: existing?.stripe ?? null,
      paypal: null,
      currentPeriodEndsAt: null,
      cancelAtPeriodEnd: false,
      checkoutAttemptNumber: attempt,
      entitlementsVersion: 1,
      entitlementSnapshot: plan.entitlements,
      ...(membershipSnapshot.exists ? {} : { createdAt: now }),
      updatedAt: now,
    }, { merge: true });
    transaction.update(organizationRef, { pendingMembershipId: membershipId, updatedAt: now });
    return { membershipId, checkoutAttemptNumber: attempt, plan, stripeCustomerId: existing?.stripe?.customerId as string | undefined };
  });
}

export async function attachFirebaseMembershipCheckout(input: { membershipId: string; organizationId: string; customerId: string; checkoutSessionId: string; priceId: string }, db: Firestore = getPlatformFirestore()) {
  const now = Timestamp.now();
  await db.runTransaction(async (transaction) => {
    const ref = db.doc(`memberships/${input.membershipId}`);
    const snapshot = await transaction.get(ref);
    const data = snapshot.data();
    if (!data || data.organizationId !== input.organizationId || data.status !== "pending") throw new Error("Pending membership is unavailable.");
    transaction.update(ref, { stripe: { customerId: input.customerId, checkoutSessionId: input.checkoutSessionId, subscriptionId: null, priceId: input.priceId }, updatedAt: now });
  });
}

export async function processVerifiedFirebaseMembershipEvent(input: {
  eventId: string;
  eventType: string;
  providerObjectId: string;
  organizationId: string;
  membershipId: string;
  tier: VendorPlanKey;
  status: VendorMembershipStatus;
  customerId: string;
  subscriptionId: string;
  checkoutSessionId: string | null;
  priceId: string;
  amountCents: number;
  currency: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}, db: Firestore = getPlatformFirestore()) {
  const plan = getVendorPlan(input.tier);
  if (!plan || input.tier === "founding_partner" || input.priceId !== process.env[plan.stripePriceEnv] || input.amountCents !== plan.amountCents || input.currency.toUpperCase() !== plan.currency) {
    throw new Error("Verified Stripe state does not match the Firebase membership plan.");
  }
  const eventRef = db.doc(`paymentProviderEvents/stripe:${input.eventId}`);
  const membershipRef = db.doc(`memberships/${input.membershipId}`);
  const organizationRef = db.doc(`organizations/${input.organizationId}`);
  const now = Timestamp.now();
  return db.runTransaction(async (transaction) => {
    const [eventSnapshot, membershipSnapshot, organizationSnapshot] = await Promise.all([
      transaction.get(eventRef), transaction.get(membershipRef), transaction.get(organizationRef),
    ]);
    if (eventSnapshot.data()?.processedAt) return { duplicate: true };
    const membership = membershipSnapshot.data();
    if (!membership || membership.organizationId !== input.organizationId || membership.tier !== input.tier || !organizationSnapshot.exists) throw new Error("Membership metadata does not match Firestore state.");
    const operational = isOperationalMembership({ status: input.status, currentPeriodEndsAt: input.currentPeriodEnd ? Timestamp.fromDate(input.currentPeriodEnd) : null }, now);
    const currentActiveId = organizationSnapshot.data()?.activeMembershipId as string | null | undefined;
    if (operational && currentActiveId && currentActiveId !== input.membershipId) {
      const currentActive = await transaction.get(db.doc(`memberships/${currentActiveId}`));
      const currentActiveData = currentActive.data();
      if (currentActiveData && isOperationalMembership(currentActiveData, now)) throw new Error("Organization already has a different operational membership.");
    }
    transaction.set(eventRef, {
      provider: "stripe", providerEventId: input.eventId, eventType: input.eventType, providerObjectId: input.providerObjectId,
      organizationId: input.organizationId, membershipId: input.membershipId, verificationStatus: "verified", processedAt: now, createdAt: now,
    });
    transaction.set(membershipRef, {
      status: input.status,
      priority: plan.placementPriority,
      paymentSource: "stripe",
      actualAmountPaidCents: input.amountCents,
      stripe: { customerId: input.customerId, checkoutSessionId: input.checkoutSessionId ?? membership.stripe?.checkoutSessionId ?? null, subscriptionId: input.subscriptionId, priceId: input.priceId },
      currentPeriodEndsAt: input.currentPeriodEnd ? Timestamp.fromDate(input.currentPeriodEnd) : null,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      updatedAt: now,
    }, { merge: true });
    transaction.update(organizationRef, {
      activeMembershipId: operational ? input.membershipId : organizationSnapshot.data()?.activeMembershipId === input.membershipId ? null : organizationSnapshot.data()?.activeMembershipId ?? null,
      pendingMembershipId: organizationSnapshot.data()?.pendingMembershipId === input.membershipId ? null : organizationSnapshot.data()?.pendingMembershipId ?? null,
      status: operational ? "active" : organizationSnapshot.data()?.status ?? "pending",
      updatedAt: now,
    });
    return { duplicate: false, operational };
  });
}

export async function expireFirebaseMembershipCheckout(input: { eventId: string; membershipId: string; organizationId: string; checkoutSessionId: string }, db: Firestore = getPlatformFirestore()) {
  const eventRef = db.doc(`paymentProviderEvents/stripe:${input.eventId}`);
  const membershipRef = db.doc(`memberships/${input.membershipId}`);
  const organizationRef = db.doc(`organizations/${input.organizationId}`);
  const now = Timestamp.now();
  await db.runTransaction(async (transaction) => {
    const [event, membership, organization] = await Promise.all([transaction.get(eventRef), transaction.get(membershipRef), transaction.get(organizationRef)]);
    if (event.data()?.processedAt) return;
    if (!membership.exists || membership.data()?.organizationId !== input.organizationId) throw new Error("Membership metadata does not match Firestore state.");
    transaction.set(eventRef, { provider: "stripe", providerEventId: input.eventId, eventType: "checkout.session.expired", providerObjectId: input.checkoutSessionId, organizationId: input.organizationId, membershipId: input.membershipId, verificationStatus: "verified", processedAt: now, createdAt: now });
    transaction.update(membershipRef, { status: "expired", updatedAt: now });
    if (organization.exists && organization.data()?.pendingMembershipId === input.membershipId) transaction.update(organizationRef, { pendingMembershipId: null, updatedAt: now });
  });
}

export async function getFirebaseOrganizationMembership(organizationId: string, db: Firestore = getPlatformFirestore()) {
  const organization = await db.doc(`organizations/${organizationId}`).get();
  const membershipId = organization.data()?.activeMembershipId ?? organization.data()?.pendingMembershipId;
  if (!membershipId) return null;
  const membership = await db.doc(`memberships/${membershipId}`).get();
  return membership.exists ? { id: membership.id, ...(membership.data() as CommercialMembershipDocument) } : null;
}
