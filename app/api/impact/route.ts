import { z } from "zod";
import { IMPACT_METRICS, parseImpactSummary } from "@/src/domain/impact/metrics";
import { can } from "@/src/lib/auth/authorization";
import { getCurrentUser } from "@/src/lib/auth/session";
import { getImpactRange } from "@/src/lib/impact/summary";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const querySchema=z.object({range:z.enum(["30d","90d","365d"]).default("30d")});

export async function GET(request:Request){
  const user=await getCurrentUser(); if(!user)return Response.json({error:"Authentication required."},{status:401});
  const membership=user.memberships[0]; if(!membership||!can(user,"reports:view",membership.organizationId))return Response.json({error:"Reporting access required."},{status:403});
  const url=new URL(request.url); const parsed=querySchema.safeParse({range:url.searchParams.get("range")??undefined});
  if(!parsed.success)return Response.json({error:"Invalid reporting range."},{status:400});
  const range=getImpactRange(parsed.data.range); const supabase=await createSupabaseServerClient();
  const [{data,error},{data:series, error:seriesError}]=await Promise.all([
    supabase.rpc("get_organization_impact_summary",{target_organization_id:membership.organizationId,target_start_date:range.startDate,target_end_date:range.endDate}),
    supabase.rpc("get_impact_timeseries",{target_organization_id:membership.organizationId,target_start_date:range.startDate,target_end_date:range.endDate}),
  ]);
  if(error||seriesError)return Response.json({error:"Impact reporting is unavailable."},{status:500});
  return Response.json({organizationId:membership.organizationId,range,metrics:IMPACT_METRICS,summary:parseImpactSummary(data),series},{headers:{"Cache-Control":"private, no-store"}});
}
