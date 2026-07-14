import { BadgeCheck, Clock3, Star } from "lucide-react";
import { EmptyState, PageHeader } from "@/src/components/ui/page-header";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

type Vendor = { organization_id: string; verification_status: string; average_rating: number | null; completed_job_count: number; response_time_minutes: number | null; organizations: { name: string } | null };

export default async function MarketplacePage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("vendor_profiles").select("organization_id, verification_status, average_rating, completed_job_count, response_time_minutes, organizations(name)").eq("verification_status", "verified").order("completed_job_count", { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  const vendors = (data ?? []) as unknown as Vendor[];
  return <div><PageHeader eyebrow="Local network" title="Verified vendor marketplace" description="Qualified local partners with structured credentials and an accountable performance history." /><div className="mt-8">{vendors.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{vendors.map((vendor) => <article key={vendor.organization_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><h2 className="font-bold text-slate-950">{vendor.organizations?.name ?? "Verified vendor"}</h2><p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><BadgeCheck className="size-4" /> Verified</p></div>{vendor.average_rating ? <span className="flex items-center gap-1 text-sm font-bold"><Star className="size-4 fill-amber-400 text-amber-400" /> {vendor.average_rating}</span> : null}</div><div className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm"><div><p className="text-xs text-slate-400">Completed jobs</p><p className="mt-1 font-semibold">{vendor.completed_job_count}</p></div><div><p className="text-xs text-slate-400">Response</p><p className="mt-1 flex items-center gap-1 font-semibold"><Clock3 className="size-3.5" />{vendor.response_time_minutes ? `${vendor.response_time_minutes} min` : "New partner"}</p></div></div></article>)}</div> : <EmptyState title="No verified vendors in this market yet" description="Verified service partners will appear as the local marketplace is activated." />}</div></div>;
}
