import { z } from "zod";
import { parseImpactSummary } from "@/src/domain/impact/metrics";
import { getCurrentUser } from "@/src/lib/auth/session";
import { getImpactRange } from "@/src/lib/impact/summary";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export async function GET(request:Request){
  const user=await getCurrentUser(); if(!user)return Response.json({error:"Authentication required."},{status:401}); if(!user.isSuperAdmin)return Response.json({error:"Not found."},{status:404});
  const url=new URL(request.url);const parsed=z.enum(["30d","90d","365d"]).safeParse(url.searchParams.get("range")??"30d");if(!parsed.success)return Response.json({error:"Invalid range."},{status:400});const range=getImpactRange(parsed.data);
  const supabase=await createSupabaseServerClient();const [{data,error},{data:series,error:seriesError}]=await Promise.all([supabase.rpc("get_platform_impact_summary",{target_start_date:range.startDate,target_end_date:range.endDate}),supabase.rpc("get_impact_timeseries",{target_organization_id:null,target_start_date:range.startDate,target_end_date:range.endDate})]);
  if(error||seriesError)return Response.json({error:"Impact reporting is unavailable."},{status:500});
  return Response.json({range,summary:parseImpactSummary(data),series},{headers:{"Cache-Control":"private, no-store"}});
}
