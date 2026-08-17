import type { Role } from "@/src/domain/auth/roles";

export function getInvitableRoles(role: Role, organizationType: "property_management" | "vendor"): Role[] {
  const operational: Role[] = organizationType === "vendor" ? ["vendor", "technician"] : ["manager", "staff"];
  return role === "owner" ? ["owner", "admin", ...operational] : operational;
}
