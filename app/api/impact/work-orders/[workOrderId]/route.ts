import { z } from "zod";
import { can } from "@/src/lib/auth/authorization";
import { getCurrentUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const inputSchema=z.object({
  baselineCostCents:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  actualCostCents:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  baselineHours:z.number().finite().min(0).max(1_000_000),
  actualHours:z.number().finite().min(0).max(1_000_000),
  localSpendingRetainedCents:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  confidence:z.number().min(0).max(1).default(.8),
  source:z.enum(["invoice","user_attested","admin","import","ai_assisted"]).default("user_attested"),
  metadata:z.record(z.string(),z.unknown()).default({}),
}).strict();

export async function POST(request:Request,{params}:{params:Promise<{workOrderId:string}>}){
  const user=await getCurrentUser(); if(!user)return Response.json({error:"Authentication required."},{status:401});
  const {workOrderId}=await params; if(!z.string().uuid().safeParse(workOrderId).success)return Response.json({error:"Invalid work order."},{status:400});
  const parsed=inputSchema.safeParse(await request.json().catch(()=>null)); if(!parsed.success)return Response.json({error:"Invalid impact observation.",details:parsed.error.flatten()},{status:400});
  const supabase=await createSupabaseServerClient();
  const {data:work}=await supabase.from("work_orders").select("property_organization_id,status").eq("id",workOrderId).single();
  if(!work||!can(user,"service_requests:update",work.property_organization_id))return Response.json({error:"Work order access required."},{status:403});
  if(work.status!=="completed")return Response.json({error:"Impact can only be recorded after completion."},{status:409});
  const {data,error}=await supabase.rpc("record_work_order_impact",{target_work_order_id:workOrderId,target_baseline_cost_cents:parsed.data.baselineCostCents,target_actual_cost_cents:parsed.data.actualCostCents,target_baseline_hours:parsed.data.baselineHours,target_actual_hours:parsed.data.actualHours,target_local_spending_retained_cents:parsed.data.localSpendingRetainedCents,target_confidence:parsed.data.confidence,target_source:parsed.data.source,target_metadata:parsed.data.metadata});
  if(error){console.error("Impact observation failed",{code:error.code});return Response.json({error:"Impact could not be recorded."},{status:500});}
  return Response.json({workOrderId,impact:data},{status:201,headers:{"Cache-Control":"no-store"}});
}
