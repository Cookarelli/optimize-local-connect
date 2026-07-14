import { notFound } from "next/navigation";
import type { Permission } from "@/src/domain/auth/roles";
import { hasPermission } from "@/src/domain/auth/roles";
import type { AppUser, Membership } from "@/src/domain/auth/types";

export function getMembership(
  user: AppUser,
  organizationId: string,
): Membership | undefined {
  return user.memberships.find(
    (membership) => membership.organizationId === organizationId,
  );
}

export function can(
  user: AppUser,
  permission: Permission,
  organizationId?: string,
): boolean {
  if (user.isSuperAdmin) return true;
  if (!organizationId) {
    return user.memberships.some((membership) =>
      hasPermission(membership.role, permission),
    );
  }

  const membership = getMembership(user, organizationId);
  return membership ? hasPermission(membership.role, permission) : false;
}

export function authorize(
  user: AppUser,
  permission: Permission,
  organizationId?: string,
): void {
  if (!can(user, permission, organizationId)) notFound();
}
