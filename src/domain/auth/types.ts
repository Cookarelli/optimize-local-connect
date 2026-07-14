import type { Role } from "./roles";

export interface Membership {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationType: "property_management" | "vendor";
  role: Role;
}

export interface AppUser {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  isSuperAdmin: boolean;
  memberships: Membership[];
}
