import { z } from "zod";
import { can } from "@/src/lib/auth/authorization";
import { getCurrentUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const schema=z.object({startDate:z.iso.date(),endDate:z.iso.date(),scopeType:z.enum(["organization","portfolio"]).default("organization"),prepareAiReport:z.boolean().default(false),question:z.string().trim().min(3).max(2000).optional(),reportFormat:z.enum(["executive_summary","portfolio_review","community_report","city_comparison","structured_json"]).default("executive_summary")}).strict().refine(value=>!value.prepareAiReport||Boolean(value.question),{message:"A question is required for AI reporting."});

export async function POST(request:Request){
  const user=await getCurrentUser(); if(!user)return Response.json({error:"Authentication required."},{status:401});
  const membership=user.memberships[0]; if(!membership||!can(user,"reports:view",membership.organizationId))return Response.json({error:"Reporting access required."},{status:403});
  const parsed=schema.safeParse(await request.json().catch(()=>null)); if(!parsed.success)return Response.json({error:"Invalid snapshot request.",details:parsed.error.flatten()},{status:400});
  const supabase=await createSupabaseServerClient();
  const {data:snapshotId,error}=await supabase.rpc("create_impact_snapshot",{target_organization_id:membership.organizationId,target_start_date:parsed.data.startDate,target_end_date:parsed.data.endDate,target_scope_type:parsed.data.scopeType,target_scope_id:membership.organizationId});
  if(error||!snapshotId)return Response.json({error:"Impact snapshot could not be created."},{status:500});
  let reportRequestId:null|string=null;
  if(parsed.data.prepareAiReport){const {data:snapshot}=await supabase.from("impact_snapshots").select("metrics,methodology_versions,source_cutoff_at").eq("id",snapshotId).single();const {data:report,error:reportError}=await supabase.from("impact_report_requests").insert({snapshot_id:snapshotId,requested_by:user.id,status:"queued",question:parsed.data.question!,report_format:parsed.data.reportFormat,input_snapshot:snapshot??{}}).select("id").single();if(reportError)return Response.json({snapshotId,error:"Snapshot created, but the AI report request could not be queued."},{status:500});reportRequestId=report.id;}
  return Response.json({snapshotId,reportRequestId,providerAssigned:false},{status:201,headers:{"Cache-Control":"no-store"}});
}
