export const ROLES = [
  "super_admin",
  "owner",
  "admin",
  "property_manager",
  "vendor",
  "technician",
  "future_resident",
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "platform:manage",
  "markets:manage",
  "organization:view",
  "organization:update",
  "billing:manage",
  "members:view",
  "members:invite",
  "members:manage",
  "properties:view",
  "properties:create",
  "properties:update",
  "properties:delete",
  "service_requests:view",
  "service_requests:create",
  "service_requests:assign",
  "service_requests:update",
  "marketplace:view",
  "marketplace:invite_vendor",
  "quotes:view",
  "quotes:create",
  "quotes:award",
  "vendor_profile:view",
  "vendor_profile:manage",
  "work_orders:view",
  "work_orders:update",
  "reports:view",
  "resident_portal:view",
  "resident_requests:create",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL_PERMISSIONS = new Set<Permission>(PERMISSIONS);

export const ROLE_PERMISSIONS: Readonly<Record<Role, ReadonlySet<Permission>>> = {
  super_admin: ALL_PERMISSIONS,
  owner: new Set([
    "organization:view",
    "organization:update",
    "billing:manage",
    "members:view",
    "members:invite",
    "members:manage",
    "properties:view",
    "properties:create",
    "properties:update",
    "properties:delete",
    "service_requests:view",
    "service_requests:create",
    "service_requests:assign",
    "service_requests:update",
    "marketplace:view",
    "marketplace:invite_vendor",
    "quotes:view",
    "quotes:award",
    "vendor_profile:view",
    "work_orders:view",
    "reports:view",
  ]),
  admin: new Set([
    "organization:view",
    "organization:update",
    "members:view",
    "members:invite",
    "members:manage",
    "properties:view",
    "properties:create",
    "properties:update",
    "properties:delete",
    "service_requests:view",
    "service_requests:create",
    "service_requests:assign",
    "service_requests:update",
    "marketplace:view",
    "marketplace:invite_vendor",
    "quotes:view",
    "quotes:award",
    "vendor_profile:view",
    "work_orders:view",
    "reports:view",
  ]),
  property_manager: new Set([
    "organization:view",
    "members:view",
    "properties:view",
    "properties:create",
    "properties:update",
    "service_requests:view",
    "service_requests:create",
    "service_requests:assign",
    "service_requests:update",
    "marketplace:view",
    "marketplace:invite_vendor",
    "quotes:view",
    "quotes:award",
    "vendor_profile:view",
    "work_orders:view",
    "reports:view",
  ]),
  vendor: new Set([
    "organization:view",
    "organization:update",
    "members:view",
    "members:invite",
    "vendor_profile:view",
    "vendor_profile:manage",
    "service_requests:view",
    "quotes:view",
    "quotes:create",
    "work_orders:view",
    "work_orders:update",
  ]),
  technician: new Set([
    "organization:view",
    "service_requests:view",
    "work_orders:view",
    "work_orders:update",
  ]),
  future_resident: new Set([
    "resident_portal:view",
    "resident_requests:create",
  ]),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function hasAnyPermission(
  role: Role,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function isRole(value: string): value is Role {
  return ROLES.includes(value as Role);
}
