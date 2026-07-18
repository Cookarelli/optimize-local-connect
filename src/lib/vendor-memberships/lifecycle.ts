import "server-only";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

const resultSchema=z.object({organization_id:z.string().uuid(),tier:z.string().nullable(),membership_status:z.string().nullable(),payment_satisfied:z.boolean(),profile:z.object({complete:z.boolean(),missing:z.array(z.string())}),approval_status:z.string(),lifecycle_status:z.string(),publication_eligible:z.boolean()});
export async function evaluateOrganizationActivation(organizationId:string){
  const admin=createSupabaseAdminClient();
  const {data,error}=await admin.rpc("evaluate_vendor_organization_activation",{target_vendor_organization_id:organizationId});
  if(error)throw error;return resultSchema.parse(data);
}
export const evaluatePublicationEligibility=evaluateOrganizationActivation;
