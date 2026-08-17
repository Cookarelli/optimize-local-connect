import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import type { AppUser } from "@/src/domain/auth/types";
import type { Role } from "@/src/domain/auth/roles";
import { getPlatformFirestore } from "@/src/lib/firebase/admin";
import { requireOrganizationMembership } from "@/src/lib/firebase/authorization";
import { organizationMembershipId } from "@/src/lib/firebase/platform";

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export async function createFirebaseOrganizationInvitation(input: { user: AppUser; organizationId: string; email: string; role: Role }) {
  requireOrganizationMembership(input.user, input.organizationId, ["owner", "admin"]);
  const db = getPlatformFirestore();
  const organization = await db.doc(`organizations/${input.organizationId}`).get();
  if (!organization.exists) throw new Error("Organization not found.");
  const type = organization.data()?.type;
  const allowed = type === "vendor" ? ["owner", "admin", "vendor", "technician"] : ["owner", "admin", "manager", "staff"];
  if (!allowed.includes(input.role)) throw new Error("That role is not valid for this organization.");
  const rawToken = randomBytes(48).toString("base64url");
  const invitationId = randomUUID();
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000);
  await db.doc(`organizationInvitations/${invitationId}`).create({
    organizationId: input.organizationId,
    organizationType: type,
    email: input.email.trim().toLowerCase(),
    role: input.role,
    tokenHash: tokenHash(rawToken),
    status: "pending",
    invitedBy: input.user.id,
    expiresAt,
    acceptedBy: null,
    acceptedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  return { invitationId, rawToken, expiresAt: expiresAt.toDate() };
}

export async function acceptFirebaseOrganizationInvitation(input: { user: AppUser; rawToken: string }) {
  if (!input.user.email) throw new Error("A verified account email is required.");
  const db = getPlatformFirestore();
  const match = await db.collection("organizationInvitations").where("tokenHash", "==", tokenHash(input.rawToken)).limit(1).get();
  if (match.empty) throw new Error("Invitation is invalid or expired.");
  const invitationRef = match.docs[0]!.ref;
  const now = Timestamp.now();
  await db.runTransaction(async (transaction) => {
    const invitationSnapshot = await transaction.get(invitationRef);
    const invitation = invitationSnapshot.data();
    if (!invitation || invitation.status !== "pending" || invitation.expiresAt?.toMillis() <= now.toMillis() || invitation.email !== input.user.email.toLowerCase()) {
      throw new Error("Invitation is invalid, expired, or belongs to another email.");
    }
    const membershipRef = db.doc(`organizationMemberships/${organizationMembershipId(invitation.organizationId, input.user.id)}`);
    const membershipSnapshot = await transaction.get(membershipRef);
    transaction.set(membershipRef, {
      organizationId: invitation.organizationId,
      userId: input.user.id,
      organizationType: invitation.organizationType,
      role: invitation.role,
      status: "active",
      invitedAt: invitation.createdAt,
      acceptedAt: now,
      ...(membershipSnapshot.exists ? {} : { createdAt: now }),
      updatedAt: now,
    }, { merge: true });
    transaction.update(invitationRef, { status: "accepted", acceptedBy: input.user.id, acceptedAt: now, updatedAt: now });
    transaction.set(db.doc(`users/${input.user.id}`), { activeOrganizationId: invitation.organizationId, updatedAt: now }, { merge: true });
  });
}
