"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/src/lib/auth/authorization";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const propertySchema = z.object({
  organizationId: z.string().uuid(),
  marketId: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  addressLine1: z.string().trim().min(3).max(200),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2).max(100),
  stateCode: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  postalCode: z.string().trim().min(5).max(12),
  unitCount: z.coerce.number().int().positive().max(100000),
});

export async function createProperty(formData: FormData) {
  const user = await requireUser();
  const input = propertySchema.parse({ organizationId: formData.get("organizationId"), marketId: formData.get("marketId"), name: formData.get("name"), addressLine1: formData.get("addressLine1"), addressLine2: formData.get("addressLine2") || undefined, city: formData.get("city"), stateCode: formData.get("stateCode"), postalCode: formData.get("postalCode"), unitCount: formData.get("unitCount") });
  authorize(user, "properties:create", input.organizationId);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("properties").insert({ organization_id: input.organizationId, market_id: input.marketId, name: input.name, address_line_1: input.addressLine1, address_line_2: input.addressLine2, city: input.city, state_code: input.stateCode, postal_code: input.postalCode, unit_count: input.unitCount });
  if (error) throw new Error(`Unable to create property: ${error.message}`);
  redirect("/properties");
}
