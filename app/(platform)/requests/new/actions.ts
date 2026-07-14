"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/src/lib/auth/authorization";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const requestSchema = z.object({
  organizationId: z.string().uuid(),
  propertyId: z.string().uuid(),
  tradeId: z.string().uuid(),
  title: z.string().trim().min(4).max(180),
  description: z.string().trim().min(10).max(5000),
  locationDetail: z.string().trim().max(300).optional(),
  priority: z.enum(["routine", "soon", "urgent", "emergency"]),
});

export async function createServiceRequest(formData: FormData) {
  const user = await requireUser();
  const input = requestSchema.parse({ organizationId: formData.get("organizationId"), propertyId: formData.get("propertyId"), tradeId: formData.get("tradeId"), title: formData.get("title"), description: formData.get("description"), locationDetail: formData.get("locationDetail") || undefined, priority: formData.get("priority") });
  authorize(user, "service_requests:create", input.organizationId);
  const supabase = await createSupabaseServerClient();
  const { data: property } = await supabase.from("properties").select("id").eq("id", input.propertyId).eq("organization_id", input.organizationId).single();
  if (!property) throw new Error("The selected property does not belong to this organization.");
  const { data, error } = await supabase.from("service_requests").insert({ organization_id: input.organizationId, property_id: input.propertyId, trade_id: input.tradeId, requested_by: user.id, title: input.title, description: input.description, location_detail: input.locationDetail, priority: input.priority, status: "open", published_at: new Date().toISOString() }).select("id").single();
  if (error) throw new Error(`Unable to create service request: ${error.message}`);
  redirect(`/requests/${data.id}`);
}
