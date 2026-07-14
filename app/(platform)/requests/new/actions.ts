"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/src/lib/auth/authorization";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const requestSchema = z.object({
  organizationId: z.string().uuid(),
  propertyId: z.string().uuid(),
  vendorCategoryId: z.string().uuid(),
  title: z.string().trim().min(4).max(180),
  description: z.string().trim().min(10).max(5000),
  locationDetail: z.string().trim().max(300).optional(),
  priority: z.enum(["routine", "soon", "urgent", "emergency"]),
  assignedVendorOrganizationId: z.string().uuid().optional(),
});

export async function createServiceRequest(formData: FormData) {
  const user = await requireUser();
  const input = requestSchema.parse({ organizationId: formData.get("organizationId"), propertyId: formData.get("propertyId"), vendorCategoryId: formData.get("vendorCategoryId"), title: formData.get("title"), description: formData.get("description"), locationDetail: formData.get("locationDetail") || undefined, priority: formData.get("priority"), assignedVendorOrganizationId: formData.get("assignedVendorOrganizationId") || undefined });
  authorize(user, "service_requests:create", input.organizationId);
  const supabase = await createSupabaseServerClient();
  const { data: property } = await supabase.from("properties").select("id").eq("id", input.propertyId).eq("organization_id", input.organizationId).single();
  if (!property) throw new Error("The selected property does not belong to this organization.");
  if (input.assignedVendorOrganizationId) {
    const { data: vendor } = await supabase.from("vendor_profiles").select("organization_id").eq("organization_id",input.assignedVendorOrganizationId).single();
    if (!vendor) throw new Error("The selected provider is no longer available.");
  }
  const { data, error } = await supabase.from("service_requests").insert({ organization_id: input.organizationId, property_id: input.propertyId, vendor_category_id: input.vendorCategoryId, assigned_vendor_organization_id: input.assignedVendorOrganizationId, requested_by: user.id, title: input.title, description: input.description, location_detail: input.locationDetail, priority: input.priority, status: "open", published_at: new Date().toISOString() }).select("id").single();
  if (error) throw new Error(`Unable to create service request: ${error.message}`);
  redirect(`/requests/${data.id}`);
}
