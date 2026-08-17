import "server-only";

import { randomUUID } from "node:crypto";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import type { AppUser } from "@/src/domain/auth/types";
import type { PropertyDocument } from "@/src/domain/firebase-platform/types";
import { getPlatformFirestore } from "@/src/lib/firebase/admin";
import { requireOrganizationMembership } from "@/src/lib/firebase/authorization";
import { normalizeServiceArea, normalizedText } from "@/src/lib/firebase/platform";

export async function createFirebaseProperty(input: { user: AppUser; organizationId: string; name: string; addressLine1: string; addressLine2?: string | null; city: string; stateCode: string; postalCode: string }, db: Firestore = getPlatformFirestore()) {
  requireOrganizationMembership(input.user, input.organizationId, ["owner", "admin", "manager"]);
  const organization = await db.doc(`organizations/${input.organizationId}`).get();
  if (!organization.exists || organization.data()?.type !== "property_manager" || organization.data()?.status !== "active") throw new Error("Property-management organization is unavailable.");
  const id = randomUUID();
  const now = Timestamp.now();
  const city = normalizedText(input.city);
  const stateCode = input.stateCode.trim().toUpperCase();
  const serviceAreaKey = normalizeServiceArea(`${city}-${stateCode}`);
  const batch = db.batch();
  batch.create(db.doc(`properties/${id}`), {
    organizationId: input.organizationId,
    name: normalizedText(input.name),
    address: { line1: normalizedText(input.addressLine1), line2: input.addressLine2 ? normalizedText(input.addressLine2) : null, city, stateCode, postalCode: input.postalCode.trim() },
    serviceAreaKey,
    status: "active",
    createdBy: input.user.id,
    createdAt: now,
    updatedAt: now,
  });
  batch.set(db.doc(`serviceAreas/${serviceAreaKey}`), { key: serviceAreaKey, name: `${city}, ${stateCode}`, city, stateCode, status: "active", updatedAt: now, createdAt: now }, { merge: true });
  await batch.commit();
  return id;
}

export async function listFirebaseProperties(user: AppUser, organizationId: string, db: Firestore = getPlatformFirestore()) {
  requireOrganizationMembership(user, organizationId);
  const snapshot = await db.collection("properties").where("organizationId", "==", organizationId).where("status", "==", "active").orderBy("name").get();
  return snapshot.docs.map((document) => ({ id: document.id, ...(document.data() as PropertyDocument) }));
}
