"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/src/lib/auth/authorization";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const propertySchema = z.object({
  organizationId: z.string().uuid(),
  marketId: z.string().uuid(),
  cityId: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  addressLine1: z.string().trim().min(3).max(200),
  addressLine2: z.string().trim().max(200).optional(),
  postalCode: z.string().trim().min(5).max(12),
  unitCount: z.coerce.number().int().positive().max(100000),
});

export async function createProperty(formData: FormData) {
  const user = await requireUser();
  const input = propertySchema.parse({ organizationId: formData.get("organizationId"), marketId: formData.get("marketId"), cityId: formData.get("cityId"), name: formData.get("name"), addressLine1: formData.get("addressLine1"), addressLine2: formData.get("addressLine2") || undefined, postalCode: formData.get("postalCode"), unitCount: formData.get("unitCount") });
  authorize(user, "properties:create", input.organizationId);
  const supabase = await createSupabaseServerClient();
  const { data: coveredCity } = await supabase
    .from("market_cities")
    .select("city_id")
    .eq("market_id", input.marketId)
    .eq("city_id", input.cityId)
    .single();
  if (!coveredCity) throw new Error("The selected city does not belong to this market.");
  const { error } = await supabase.from("properties").insert({ organization_id: input.organizationId, market_id: input.marketId, city_id: input.cityId, name: input.name, address_line_1: input.addressLine1, address_line_2: input.addressLine2, postal_code: input.postalCode, unit_count: input.unitCount });
  if (error) throw new Error(`Unable to create property: ${error.message}`);
  redirect("/properties");
}
