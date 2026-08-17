import "server-only";

import type { AppUser, Membership } from "@/src/domain/auth/types";
import type { Role } from "@/src/domain/auth/roles";

export function requirePlatformAdmin(user: AppUser) {
  if (!user.isSuperAdmin) throw new Error("Super Admin access required.");
  return user;
}
export function requireOrganizationMembership(user: AppUser, organizationId: string, roles?: readonly Role[]): Membership {
  const membership = user.memberships.find((item) => item.organizationId === organizationId);
  if (!membership || (roles && !roles.includes(membership.role))) throw new Error("Organization access required.");
  return membership;
}

export function activeOrganizationMembership(user: AppUser, type?: "property_management" | "vendor") {
  const membership = user.memberships.find((item) => !type || item.organizationType === type);
  if (!membership) throw new Error("An active organization is required.");
  return membership;
}
