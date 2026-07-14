import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Building2, LineChart } from "lucide-react";
import { ImpactWidgets } from "@/src/components/impact/impact-widgets";
import { EMPTY_IMPACT_SUMMARY, formatImpactCurrency, parseImpactSummary } from "@/src/domain/impact/metrics";
import { getImpactRange } from "@/src/lib/impact/summary";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const dynamic="force-dynamic";
const ranges=[["30d","30 days"],["90d","90 days"],["365d","12 months"]] as const;

export default async function AdminImpactPage({searchParams}:{searchParams:Promise<{range?:string}>}){
  const user=await requireUser(); if(!user.isSuperAdmin) redirect("/dashboard");
  const requested=(await searchParams).range;
  const rangeKey=ranges.some(([key])=>key===requested)?requested:"30d";
  const range=getImpactRange(rangeKey);
  const supabase=await createSupabaseServerClient();
  const [{data:summaryData},{data:series},{data:rows}]=await Promise.all([
    supabase.rpc("get_platform_impact_summary",{target_start_date:range.startDate,target_end_date:range.endDate}),
    supabase.rpc("get_impact_timeseries",{target_organization_id:null,target_start_date:range.startDate,target_end_date:range.endDate}),
    supabase.from("daily_impact_metrics").select("organization_id,estimated_money_saved_cents,estimated_hours_saved,jobs_completed,local_spending_retained_cents,organizations(name)").gte("metric_date",range.startDate).lte("metric_date",range.endDate),
  ]);
  const summary=summaryData?parseImpactSummary(summaryData):EMPTY_IMPACT_SUMMARY;
  const points=((series??[]) as Array<{metric_date:string;estimated_money_saved_cents:number|string}>).map(item=>({date:item.metric_date,savings:Number(item.estimated_money_saved_cents)}));
  const max=Math.max(...points.map(point=>point.savings),1);
  const organizations=new Map<string,{name:string;savings:number;hours:number;jobs:number;local:number}>();
  for(const row of rows??[]){const org=row.organizations as unknown as {name:string}|null;const current=organizations.get(row.organization_id)??{name:org?.name??"Organization",savings:0,hours:0,jobs:0,local:0};current.savings+=Number(row.estimated_money_saved_cents);current.hours+=Number(row.estimated_hours_saved);current.jobs+=Number(row.jobs_completed);current.local+=Number(row.local_spending_retained_cents);organizations.set(row.organization_id,current);}
  const ranked=[...organizations.entries()].sort((a,b)=>b[1].savings-a[1].savings);
  return <div><Link href="/admin" className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-slate-900"><ArrowLeft className="mr-2 size-4"/>Admin overview</Link><div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-semibold text-emerald-700">Platform reporting</p><h1 className="mt-1 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Community impact</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Cross-organization reporting with measured and estimated outcomes kept distinct at the source.</p></div><nav className="flex gap-2">{ranges.map(([key,label])=><Link key={key} href={`/admin/impact?range=${key}`} className={`rounded-full px-4 py-2 text-xs font-bold ${rangeKey===key?"bg-slate-950 text-white":"border border-slate-200 bg-white text-slate-600"}`}>{label}</Link>)}</nav></div><ImpactWidgets summary={summary} title="Platform impact" admin />
    <section className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_.75fr]"><article className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex justify-between"><div><h2 className="font-bold">Community savings trend</h2><p className="mt-1 text-sm text-slate-500">Daily platform-wide estimated savings.</p></div><LineChart className="size-5 text-emerald-700"/></div>{points.length?<div className="mt-8 flex h-60 items-end gap-1">{points.map(point=><div key={point.date} title={`${point.date}: ${formatImpactCurrency(point.savings)}`} className="flex min-w-1 flex-1 items-end"><span className="w-full rounded-t bg-emerald-500/75" style={{height:`${Math.max(point.savings/max*100,2)}%`}}/></div>)}</div>:<div className="grid min-h-60 place-items-center text-sm text-slate-500">No observations in this period.</div>}</article><article className="rounded-2xl bg-slate-950 p-6 text-white"><Building2 className="size-6 text-emerald-400"/><p className="mt-8 text-xs uppercase tracking-wider text-slate-400">Organizations reporting</p><p className="mt-2 text-5xl font-semibold">{summary.organization_count??organizations.size}</p><p className="mt-5 text-sm leading-6 text-slate-400">Community savings since launch</p><p className="mt-1 text-3xl font-bold text-emerald-300">{formatImpactCurrency(summary.community_savings_since_launch_cents)}</p></article></section>
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-200 p-5"><h2 className="font-bold">Organization impact</h2><p className="mt-1 text-sm text-slate-500">Ranked by estimated savings for the selected period.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Organization</th><th className="px-5 py-3">Est. savings</th><th className="px-5 py-3">Hours</th><th className="px-5 py-3">Jobs</th><th className="px-5 py-3">Local retained</th></tr></thead><tbody className="divide-y divide-slate-100">{ranked.length?ranked.map(([id,item])=><tr key={id}><td className="px-5 py-4 font-semibold">{item.name}</td><td className="px-5 py-4">{formatImpactCurrency(item.savings)}</td><td className="px-5 py-4">{Math.round(item.hours).toLocaleString()}</td><td className="px-5 py-4">{item.jobs.toLocaleString()}</td><td className="px-5 py-4">{formatImpactCurrency(item.local)}</td></tr>):<tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500">No organization observations in this period.</td></tr>}</tbody></table></div></section>
  </div>;
}
