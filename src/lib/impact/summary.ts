import type { ImpactSummary } from "@/src/domain/impact/metrics";
import { EMPTY_IMPACT_SUMMARY, parseImpactSummary } from "@/src/domain/impact/metrics";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export type ImpactRange = { startDate: string; endDate: string };

export function getImpactRange(range: string | undefined): ImpactRange {
  const end = new Date();
  const start = new Date(end);
  const days = range === "365d" ? 365 : range === "90d" ? 90 : 30;
  start.setUTCDate(start.getUTCDate()-days+1);
  return { startDate: start.toISOString().slice(0,10), endDate: end.toISOString().slice(0,10) };
}

export async function getOrganizationImpactSummary(organizationId: string, range: ImpactRange): Promise<ImpactSummary> {
  const supabase = await createSupabaseServerClient();
  const { data,error } = await supabase.rpc("get_organization_impact_summary",{target_organization_id:organizationId,target_start_date:range.startDate,target_end_date:range.endDate});
  return error ? EMPTY_IMPACT_SUMMARY : parseImpactSummary(data);
}
