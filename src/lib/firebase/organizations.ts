import "server-only";

import { Timestamp } from "firebase-admin/firestore";
import type { AppUser } from "@/src/domain/auth/types";
import { getPlatformFirestore } from "@/src/lib/firebase/admin";
import { requireOrganizationMembership } from "@/src/lib/firebase/authorization";
import { normalizedText, organizationMembershipId, slugify, stableDigest, vendorOrganizationId } from "@/src/lib/firebase/platform";

export async function setFirebaseActiveOrganization(user: AppUser, organizationId: string) {
  requireOrganizationMembership(user, organizationId);
  const now = Timestamp.now();
  await getPlatformFirestore().doc(`users/${user.id}`).set({ activeOrganizationId: organizationId, updatedAt: now }, { merge: true });
}
export async function establishVendorOrganization(input: {
  user: AppUser;
  businessName: string;
  legalName?: string | null;
  contactName: string;
  phone: string;
  websiteUrl?: string | null;
}) {
  const db = getPlatformFirestore();
  const businessName = normalizedText(input.businessName);
  const organizationId = vendorOrganizationId(input.user.id, businessName);
  const membershipId = organizationMembershipId(organizationId, input.user.id);
  const organizationRef = db.doc(`organizations/${organizationId}`);
  const accessRef = db.doc(`organizationMemberships/${membershipId}`);
  const userRef = db.doc(`users/${input.user.id}`);
  const now = Timestamp.now();
  await db.runTransaction(async (transaction) => {
    const [organizationSnapshot, accessSnapshot] = await Promise.all([transaction.get(organizationRef), transaction.get(accessRef)]);
    if (organizationSnapshot.exists && (!accessSnapshot.exists || accessSnapshot.data()?.status !== "active")) {
      throw new Error("That organization already exists and is not owned by this account.");
    }
    transaction.set(organizationRef, {
      type: "vendor",
      status: organizationSnapshot.data()?.status ?? "pending",
      name: businessName,
      normalizedName: businessName.toLowerCase(),
      slug: organizationSnapshot.data()?.slug ?? slugify(businessName),
      legalName: input.legalName ? normalizedText(input.legalName) : null,
      contactName: normalizedText(input.contactName),
      primaryEmail: input.user.email.toLowerCase(),
      primaryPhone: input.phone.trim(),
      websiteUrl: input.websiteUrl ?? null,
      activeMembershipId: organizationSnapshot.data()?.activeMembershipId ?? null,
      pendingMembershipId: organizationSnapshot.data()?.pendingMembershipId ?? null,
      ...(organizationSnapshot.exists ? {} : { createdAt: now }),
      updatedAt: now,
    }, { merge: true });
    transaction.set(accessRef, {
      organizationId,
      userId: input.user.id,
      organizationType: "vendor",
      role: "owner",
      status: "active",
      invitedAt: null,
      acceptedAt: accessSnapshot.data()?.acceptedAt ?? now,
      ...(accessSnapshot.exists ? {} : { createdAt: now }),
      updatedAt: now,
    }, { merge: true });
    transaction.set(userRef, { activeOrganizationId: organizationId, updatedAt: now }, { merge: true });
  });
  return { organizationId, organizationMembershipId: membershipId };
}

export async function establishPropertyManagerOrganization(input: { user: AppUser; organizationName: string }) {
  const db = getPlatformFirestore();
  const organizationName = normalizedText(input.organizationName);
  const organizationId = `pm_${stableDigest(`${input.user.id}|${organizationName.toLowerCase()}`)}`;
  const membershipId = organizationMembershipId(organizationId, input.user.id);
  const organizationRef = db.doc(`organizations/${organizationId}`);
  const membershipRef = db.doc(`organizationMemberships/${membershipId}`);
  const now = Timestamp.now();
  await db.runTransaction(async (transaction) => {
    const [organization, membership] = await Promise.all([transaction.get(organizationRef), transaction.get(membershipRef)]);
    if (organization.exists && (!membership.exists || membership.data()?.status !== "active")) throw new Error("That property-management organization already exists and is not owned by this account.");
    transaction.set(organizationRef, {
      type: "property_manager",
      status: "active",
      name: organizationName,
      normalizedName: organizationName.toLowerCase(),
      slug: organization.data()?.slug ?? slugify(organizationName),
      legalName: organization.data()?.legalName ?? null,
      primaryEmail: input.user.email.toLowerCase(),
      primaryPhone: organization.data()?.primaryPhone ?? null,
      websiteUrl: organization.data()?.websiteUrl ?? null,
      activeMembershipId: null,
      pendingMembershipId: null,
      ...(organization.exists ? {} : { createdAt: now }),
      updatedAt: now,
    }, { merge: true });
    transaction.set(membershipRef, {
      organizationId,
      userId: input.user.id,
      organizationType: "property_manager",
      role: "owner",
      status: "active",
      invitedAt: null,
      acceptedAt: membership.data()?.acceptedAt ?? now,
      ...(membership.exists ? {} : { createdAt: now }),
      updatedAt: now,
    }, { merge: true });
    transaction.set(db.doc(`users/${input.user.id}`), { activeOrganizationId: organizationId, updatedAt: now }, { merge: true });
  });
  return { organizationId, organizationMembershipId: membershipId };
}
