import { NextResponse } from "next/server";
import { filterProspects, prospectsToCsv, type PipelineFilters, type VendorProspect } from "@/src/domain/vendor-pipeline/catalog";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

export async function GET(request: Request) {
  const user = await requireUser(); if (!user.isSuperAdmin) return new NextResponse("Forbidden", { status: 403 });
  const url = new URL(request.url);
  if (url.searchParams.get("template") === "1") return new NextResponse(prospectsToCsv([]), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=vendor-pipeline-template.csv" } });
  const filters: PipelineFilters = { q: url.searchParams.get("q") ?? undefined, industry: url.searchParams.get("industry") ?? undefined, stage: url.searchParams.get("stage") ?? undefined, target: url.searchParams.get("target") ?? undefined, due: url.searchParams.get("due") ?? undefined };
  const { data, error } = await createSupabaseAdminClient().from("vendor_prospects").select("*").order("updated_at", { ascending: false });
  if (error) return new NextResponse("Unable to export pipeline", { status: 500 });
  return new NextResponse(prospectsToCsv(filterProspects((data ?? []) as VendorProspect[], filters)), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=vendor-pipeline.csv" } });
}
