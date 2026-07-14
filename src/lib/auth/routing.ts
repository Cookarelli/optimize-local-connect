import type { AppUser, Membership } from "@/src/domain/auth/types";

export const AUTHENTICATED_HOME = "/dashboard";

export function safeInternalPath(value: string | null | undefined, fallback = AUTHENTICATED_HOME) {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}

export function getRoleHome(user: AppUser): string {
  if (user.isSuperAdmin) return "/admin";

  const membership = user.memberships[0];
  if (!membership) return "/onboarding";
  return getMembershipHome(membership);
}

export function getMembershipHome(membership: Membership): string {
  if (membership.organizationType === "vendor" || membership.role === "vendor" || membership.role === "technician") {
    return "/vendor";
  }
  if (membership.role === "owner" || membership.role === "admin") return "/admin";
  if (membership.role === "property_manager") return "/manager";
  return "/resident";
}
