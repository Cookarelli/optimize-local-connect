import { cache } from "react";
import { redirect } from "next/navigation";
import type { AppUser } from "@/src/domain/auth/types";
import type { Role } from "@/src/domain/auth/roles";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

type MembershipRow = {
  id: string;
  organization_id: string;
  role: Role;
  organizations: {
    name: string;
    type: "property_management" | "vendor";
  } | null;
};

export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, { data: memberships, error }, { data: preferences }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, avatar_url, is_super_admin")
      .eq("id", user.id)
      .single(),
    supabase
      .from("organization_members")
      .select("id, organization_id, role, organizations(name, type)")
      .eq("user_id", user.id)
      .eq("status", "active"),
    supabase
      .from("user_preferences")
      .select("active_organization_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (error) throw new Error(`Unable to load memberships: ${error.message}`);

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    isSuperAdmin: profile?.is_super_admin ?? false,
    memberships: ((memberships ?? []) as unknown as MembershipRow[])
      .filter((membership) => membership.organizations)
      .map((membership) => ({
        id: membership.id,
        organizationId: membership.organization_id,
        organizationName: membership.organizations!.name,
        organizationType: membership.organizations!.type,
        role: membership.role,
      }))
      .sort((a, b) => Number(b.organizationId === preferences?.active_organization_id) - Number(a.organizationId === preferences?.active_organization_id)),
  };
});

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}
