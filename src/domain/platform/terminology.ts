import type { Role } from "@/src/domain/auth/roles";

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  super_admin: "Super Admin",
  owner: "Owner",
  admin: "Admin",
  property_manager: "Property Manager",
  vendor: "Local Provider",
  technician: "Technician",
  future_resident: "Future Resident",
};

export function getRoleLabel(role: Role): string {
  return ROLE_LABELS[role];
}
