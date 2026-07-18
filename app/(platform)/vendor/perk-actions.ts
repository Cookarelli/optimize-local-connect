"use server";

import { revalidatePath } from "next/cache";
import { canUsePropertyManagerPerk, propertyManagerPerkFromFormData } from "@/src/domain/vendor-memberships/property-manager-perk";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export type PerkActionState = { status: "idle" | "success" | "error"; message?: string; fieldErrors?: Record<string, string> };

export async function updatePropertyManagerPerk(_state: PerkActionState, formData: FormData): Promise<PerkActionState> {
  const user = await requireUser();
  const membership = user.memberships.find(item => item.organizationType === "vendor" && ["owner", "admin", "vendor"].includes(item.role));
  if (!membership) return { status: "error", message: "A vendor owner, admin, or vendor role is required." };

  const parsed = propertyManagerPerkFromFormData(formData);
  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>;
    return { status: "error", message: "Review the highlighted perk fields.", fieldErrors: Object.fromEntries(Object.entries(flattened).map(([key, messages]) => [key, messages?.[0] ?? "Check this field."])) };
  }

  const supabase = await createSupabaseServerClient();
  const { data: activeMembership } = await supabase.from("vendor_memberships")
    .select("status,vendor_membership_levels(code)")
    .eq("vendor_organization_id", membership.organizationId)
    .in("status", ["trialing", "active", "complimentary", "manually_granted"])
    .order("starts_at", { ascending: false }).limit(1).maybeSingle();
  const level = activeMembership?.vendor_membership_levels as unknown as { code: string } | null;
  if (!canUsePropertyManagerPerk(level?.code, activeMembership?.status)) return { status: "error", message: "An eligible active Founding or Preferred Vendor membership is required to publish this perk." };

  const perk = parsed.data;
  const { error } = await supabase.from("vendor_profiles").update({
    property_manager_perk_enabled: perk.enabled,
    property_manager_perk_title: perk.title || null,
    property_manager_perk_description: perk.description || null,
    property_manager_perk_type: perk.type,
    property_manager_perk_terms: perk.terms || null,
    property_manager_perk_expiration_date: perk.expirationDate || null,
    property_manager_perk_verified: false,
    property_manager_perk_updated_at: new Date().toISOString(),
  }).eq("organization_id", membership.organizationId);
  if (error) {
    console.error("property_manager_perk_update_failed", { organizationId: membership.organizationId, errorCode: error.code });
    return { status: "error", message: "The perk could not be saved. Please try again." };
  }
  revalidatePath("/vendor");
  revalidatePath("/marketplace");
  return { status: "success", message: perk.enabled ? "Property Manager Perk saved and enabled." : "Property Manager Perk saved and disabled." };
}
