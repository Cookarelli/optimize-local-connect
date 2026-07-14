import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, BrainCircuit, Building2, CalendarDays, HeartHandshake, TrendingUp } from "lucide-react";
import { ImpactWidgets } from "@/src/components/impact/impact-widgets";
import { formatImpactCurrency } from "@/src/domain/impact/metrics";
import { authorize } from "@/src/lib/auth/authorization";
import { getImpactRange, getOrganizationImpactSummary } from "@/src/lib/impact/summary";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata:Metadata={title:"Impact Engine",description:"Measure savings, time returned, completed jobs, response performance, vendor growth, and local spending retained.",openGraph:{title:"Optimize Local Impact Engine",description:"Measure What Matters.",images:[{url:"/og-impact-engine.png",width:1536,height:1024,alt:"Optimize Local Impact Engine — Measure What Matters."}]},twitter:{card:"summary_large_image",images:["/og-impact-engine.png"]}};
const ranges = [["30d","30 days"],["90d","90 days"],["365d","12 months"]] as const;

export default async function ImpactPage({searchParams}:{searchParams:Promise<{range?:string}>}) {
  const user=await requireUser();
  const membership=user.memberships[0];
  if(!membership) return null;
  authorize(user,"reports:view",membership.organizationId);
  const requested=(await searchParams).range;
  const rangeKey=ranges.some(([key])=>key===requested)?requested:"30d";
  const range=getImpactRange(rangeKey);
  const supabase=await createSupabaseServerClient();
  const [summary,{data:series}]=await Promise.all([
    getOrganizationImpactSummary(membership.organizationId,range),
    supabase.rpc("get_impact_timeseries",{target_organization_id:membership.organizationId,target_start_date:range.startDate,target_end_date:range.endDate}),
  ]);
  const points=((series??[]) as Array<{metric_date:string;estimated_money_saved_cents:number|string;local_spending_retained_cents:number|string;jobs_completed:number|string}>).map(item=>({date:item.metric_date,savings:Number(item.estimated_money_saved_cents),local:Number(item.local_spending_retained_cents),jobs:Number(item.jobs_completed)}));
  const max=Math.max(...points.map(point=>point.savings),1);
  return <div><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-semibold text-emerald-700">Optimize Local Impact Engine</p><h1 className="mt-1 text-3xl font-semibold tracking-[-.035em] text-slate-950 sm:text-4xl">Portfolio impact</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Measured outcomes and clearly labeled estimates for {membership.organizationName}. Every total retains its source, methodology, confidence, and reporting period.</p></div><nav className="flex flex-wrap gap-2" aria-label="Reporting period">{ranges.map(([key,label])=><Link key={key} href={`/impact?range=${key}`} className={`rounded-full px-4 py-2 text-xs font-bold ${rangeKey===key?"bg-slate-950 text-white":"border border-slate-200 bg-white text-slate-600"}`}>{label}</Link>)}</nav></div>
    <ImpactWidgets summary={summary} title={`${ranges.find(([key])=>key===rangeKey)?.[1]} impact`} />
    <section className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_.6fr]"><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start justify-between"><div><h2 className="font-bold">Estimated savings trend</h2><p className="mt-1 text-sm text-slate-500">Daily observations within the selected reporting period.</p></div><BarChart3 className="size-5 text-emerald-700" /></div>{points.length?<div className="mt-8 flex h-56 items-end gap-1" aria-label="Daily estimated savings chart">{points.map(point=><div key={point.date} className="group relative flex min-w-1 flex-1 items-end" title={`${point.date}: ${formatImpactCurrency(point.savings)}`}><span className="w-full rounded-t bg-emerald-500/70 transition group-hover:bg-emerald-600" style={{height:`${Math.max((point.savings/max)*100,2)}%`}} /></div>)}</div>:<div className="grid min-h-56 place-items-center text-center"><div><TrendingUp className="mx-auto size-7 text-slate-300"/><p className="mt-3 text-sm font-medium text-slate-700">No impact observations in this period</p><p className="mt-1 text-xs text-slate-500">Completed work and approved baselines will populate this report.</p></div></div>}<div className="mt-4 flex justify-between border-t border-slate-100 pt-3 text-[10px] text-slate-400"><span>{range.startDate}</span><span>{range.endDate}</span></div></article>
      <div className="grid gap-4"><article className="rounded-2xl bg-emerald-700 p-6 text-white"><HeartHandshake className="size-6 text-emerald-200"/><p className="mt-8 text-xs font-bold uppercase tracking-wider text-emerald-200">Community savings since launch</p><p className="mt-2 text-4xl font-semibold tracking-tight">{formatImpactCurrency(summary.community_savings_since_launch_cents)}</p><p className="mt-3 text-sm leading-6 text-emerald-100">Cumulative estimated savings retained across this organization’s Connect activity.</p></article><article className="rounded-2xl border border-slate-200 bg-white p-5"><Building2 className="size-5 text-slate-700"/><p className="mt-5 text-xs text-slate-500">Portfolio savings</p><p className="mt-1 text-2xl font-bold">{formatImpactCurrency(summary.portfolio_savings_cents??summary.estimated_money_saved_cents)}</p></article><article className="rounded-2xl border border-slate-200 bg-white p-5"><BrainCircuit className="size-5 text-violet-700"/><p className="mt-5 text-sm font-bold">AI-ready reporting</p><p className="mt-2 text-xs leading-5 text-slate-500">Governed snapshots can be sent to any configured Optimize AI provider without changing metric calculations.</p><p className="mt-4 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400"><CalendarDays className="size-3.5"/>Versioned methodologies</p></article></div>
    </section>
  </div>;
}
