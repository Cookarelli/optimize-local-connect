import "server-only";

import { cookies } from "next/headers";
import type { AppUser, Membership } from "@/src/domain/auth/types";
import type { Role } from "@/src/domain/auth/roles";
import { getFirebaseAdminAuth, getPlatformFirestore } from "@/src/lib/firebase/admin";
import { FIREBASE_SESSION_COOKIE } from "@/src/lib/firebase/platform";

type MembershipData = {
  organizationId?: string;
  userId?: string;
  organizationType?: "property_manager" | "vendor";
  role?: Role;
  status?: string;
};

export async function getFirebaseCurrentUser(): Promise<AppUser | null> {
  const sessionCookie = (await cookies()).get(FIREBASE_SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;

  let decoded;
  try {
    decoded = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie, true);
  } catch {
    return null;
  }

  const db = getPlatformFirestore();
  const [userSnapshot, adminSnapshot, membershipSnapshot] = await Promise.all([
    db.doc(`users/${decoded.uid}`).get(),
    db.doc(`platformAdmins/${decoded.uid}`).get(),
    db.collection("organizationMemberships").where("userId", "==", decoded.uid).where("status", "==", "active").get(),
  ]);
  const userData = userSnapshot.data();
  const activeOrganizationId = typeof userData?.activeOrganizationId === "string" ? userData.activeOrganizationId : null;
  const membershipRows = membershipSnapshot.docs.map((document) => ({ id: document.id, ...(document.data() as MembershipData) }))
    .filter((item): item is typeof item & Required<Pick<MembershipData, "organizationId" | "organizationType" | "role">> => Boolean(item.organizationId && item.organizationType && item.role));
  const organizationSnapshots = membershipRows.length
    ? await db.getAll(...membershipRows.map((item) => db.doc(`organizations/${item.organizationId}`)))
    : [];
  const organizations = new Map(organizationSnapshots.filter((item) => item.exists).map((item) => [item.id, item.data()]));
  const memberships: Membership[] = membershipRows.flatMap((item) => {
    const organization = organizations.get(item.organizationId);
    const validRoles = item.organizationType === "property_manager" ? ["owner", "admin", "manager", "staff", "property_manager"] : ["owner", "admin", "vendor", "technician"];
    if (!organization || organization.status === "suspended" || organization.type !== item.organizationType || !validRoles.includes(item.role)) return [];
    const organizationType: Membership["organizationType"] = item.organizationType === "property_manager" ? "property_management" : "vendor";
    return [{
      id: item.id,
      organizationId: item.organizationId,
      organizationName: typeof organization.name === "string" ? organization.name : "Organization",
      // Preserve the UI's established spelling while Firestore uses the
      // canonical property_manager organization type.
      organizationType,
      role: item.role,
    }];
  }).sort((left, right) => Number(right.organizationId === activeOrganizationId) - Number(left.organizationId === activeOrganizationId));

  return {
    id: decoded.uid,
    email: decoded.email ?? "",
    fullName: typeof userData?.displayName === "string" ? userData.displayName : decoded.name ?? null,
    avatarUrl: typeof userData?.avatarUrl === "string" ? userData.avatarUrl : decoded.picture ?? null,
    isSuperAdmin: adminSnapshot.exists && adminSnapshot.data()?.status === "active",
    memberships,
  };
}
