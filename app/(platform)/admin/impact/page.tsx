import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BadgeCheck, Banknote, BriefcaseBusiness, Building2, Clock3, LineChart, MapPinned, Siren, TimerReset, TrendingUp, Users } from "lucide-react";
import { EMPTY_IMPACT_SUMMARY, formatImpactCurrency, formatImpactDuration, parseImpactSummary } from "@/src/domain/impact/metrics";
import { getImpactRange } from "@/src/lib/impact/summary";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const dynamic="force-dynamic";
const ranges=[["30d","30 days"],["90d","90 days"],["365d","12 months"]] as const;
type CityImpact={city_id:string;city_name:string;state_code:string;estimated_money_saved_cents:number|string;estimated_hours_saved:number|string;jobs_completed:number|string;local_spending_retained_cents:number|string;vendor_response_minutes:number|string|null;emergency_response_minutes:number|string|null;vendor_growth:number|string;verified_vendor_count:number|string};

export default async function AdminImpactPage({searchParams}:{searchParams:Promise<{range?:string}>}){
  const user=await requireUser(); if(!user.isSuperAdmin) redirect("/dashboard");
  const requested=(await searchParams).range;
  const rangeKey=ranges.some(([key])=>key===requested)?requested:"30d";
  const range=getImpactRange(rangeKey);
  const supabase=await createSupabaseServerClient();
  const [{data:summaryData},{data:series},{data:rows},{data:cityData}]=await Promise.all([
    supabase.rpc("get_platform_impact_summary",{target_start_date:range.startDate,target_end_date:range.endDate}),
    supabase.rpc("get_impact_timeseries",{target_organization_id:null,target_start_date:range.startDate,target_end_date:range.endDate}),
    supabase.from("daily_impact_metrics").select("organization_id,estimated_money_saved_cents,estimated_hours_saved,jobs_completed,local_spending_retained_cents,organizations(name)").gte("metric_date",range.startDate).lte("metric_date",range.endDate),
    supabase.rpc("get_city_impact_summary",{target_start_date:range.startDate,target_end_date:range.endDate}),
  ]);
  const summary=summaryData?parseImpactSummary(summaryData):EMPTY_IMPACT_SUMMARY;
  const points=((series??[]) as Array<{metric_date:string;estimated_money_saved_cents:number|string}>).map(item=>({date:item.metric_date,savings:Number(item.estimated_money_saved_cents)}));
  const max=Math.max(...points.map(point=>point.savings),1);
  const cities=(cityData??[]) as CityImpact[];
  const maxCitySavings=Math.max(...cities.map(city=>Number(city.estimated_money_saved_cents)),1);
  const organizations=new Map<string,{name:string;savings:number;hours:number;jobs:number;local:number}>();
  for(const row of rows??[]){const org=row.organizations as unknown as {name:string}|null;const current=organizations.get(row.organization_id)??{name:org?.name??"Organization",savings:0,hours:0,jobs:0,local:0};current.savings+=Number(row.estimated_money_saved_cents);current.hours+=Number(row.estimated_hours_saved);current.jobs+=Number(row.jobs_completed);current.local+=Number(row.local_spending_retained_cents);organizations.set(row.organization_id,current);}
  const ranked=[...organizations.entries()].sort((a,b)=>b[1].savings-a[1].savings);
  const metrics=[
    ["Estimated community savings",formatImpactCurrency(summary.estimated_money_saved_cents),Banknote,"Estimated","emerald"],
    ["Hours saved",Math.round(summary.estimated_hours_saved).toLocaleString(),Clock3,"Estimated","sky"],
    ["Jobs completed",Math.round(summary.jobs_completed).toLocaleString(),BriefcaseBusiness,"Measured","violet"],
    ["Communities served",Math.round(summary.communities_served??0).toLocaleString(),MapPinned,"Measured since launch","amber"],
    ["Verified vendors",Math.round(summary.verified_vendor_count??0).toLocaleString(),BadgeCheck,"Current credentials","emerald"],
    ["Property managers",Math.round(summary.property_manager_count??0).toLocaleString(),Users,"Active users","sky"],
    ["Average response time",formatImpactDuration(summary.vendor_response_minutes),TimerReset,"Measured","slate"],
    ["Emergency response",formatImpactDuration(summary.emergency_response_minutes),Siren,"Measured","rose"],
    ["Vendor growth",Math.round(summary.vendor_growth).toLocaleString(),TrendingUp,"Measured","violet"],
  ] as const;
  const colors={emerald:"bg-emerald-50 text-emerald-700",sky:"bg-sky-50 text-sky-700",violet:"bg-violet-50 text-violet-700",amber:"bg-amber-50 text-amber-700",slate:"bg-slate-100 text-slate-700",rose:"bg-rose-50 text-rose-700"} as const;

  return <div><Link href="/admin" className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-slate-900"><ArrowLeft className="mr-2 size-4"/>Admin overview</Link>
    <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-semibold text-emerald-700">Optimize Local Impact Engine</p><h1 className="mt-1 text-3xl font-semibold tracking-[-.035em] sm:text-5xl">Community impact</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">A platform-wide view of time returned, savings created, local work completed, and communities strengthened—without blending estimates into measured outcomes.</p></div><nav className="flex gap-2">{ranges.map(([key,label])=><Link key={key} href={`/admin/impact?range=${key}`} className={`rounded-full px-4 py-2 text-xs font-bold ${rangeKey===key?"bg-slate-950 text-white":"border border-slate-200 bg-white text-slate-600"}`}>{label}</Link>)}</nav></div>

    <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{metrics.map(([label,value,Icon,kind,color])=><article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-sm text-slate-500">{label}</p><p className="mt-3 text-3xl font-bold tracking-tight">{value}</p></div><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${colors[color]}`}><Icon className="size-5"/></span></div><p className="mt-4 text-[10px] font-black uppercase tracking-wider text-slate-400">{kind}</p></article>)}</section>

    <section className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_.75fr]"><article className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex justify-between"><div><h2 className="font-bold">Community savings trend</h2><p className="mt-1 text-sm text-slate-500">Daily platform-wide estimated savings.</p></div><LineChart className="size-5 text-emerald-700"/></div>{points.length?<div className="mt-8 flex h-60 items-end gap-1" aria-label="Community savings trend">{points.map(point=><div key={point.date} title={`${point.date}: ${formatImpactCurrency(point.savings)}`} className="flex min-w-1 flex-1 items-end"><span className="w-full rounded-t bg-emerald-500/75" style={{height:`${Math.max(point.savings/max*100,2)}%`}}/></div>)}</div>:<div className="grid min-h-60 place-items-center text-sm text-slate-500">No observations in this period.</div>}</article><article className="rounded-2xl bg-slate-950 p-6 text-white"><Building2 className="size-6 text-emerald-400"/><p className="mt-8 text-xs uppercase tracking-wider text-slate-400">Organizations reporting</p><p className="mt-2 text-5xl font-semibold">{summary.organization_count??organizations.size}</p><p className="mt-5 text-sm leading-6 text-slate-400">Community savings since launch</p><p className="mt-1 text-3xl font-bold text-emerald-300">{formatImpactCurrency(summary.community_savings_since_launch_cents)}</p></article></section>

    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.14em] text-emerald-700">Future city comparisons</p><h2 className="mt-2 text-xl font-bold">Impact by community</h2><p className="mt-1 text-sm text-slate-500">Comparable city-level observations for the selected period.</p></div><MapPinned className="size-5 text-emerald-700"/></div>{cities.length?<div className="mt-7 space-y-5">{cities.slice(0,8).map(city=><article key={city.city_id}><div className="flex items-end justify-between gap-4"><div><p className="text-sm font-bold">{city.city_name}, {city.state_code}</p><p className="mt-1 text-xs text-slate-500">{Number(city.jobs_completed).toLocaleString()} jobs · {Number(city.verified_vendor_count).toLocaleString()} verified vendors</p></div><p className="text-sm font-black text-emerald-700">{formatImpactCurrency(Number(city.estimated_money_saved_cents))}</p></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-300" style={{width:`${Math.max(Number(city.estimated_money_saved_cents)/maxCitySavings*100,2)}%`}}/></div></article>)}</div>:<div className="mt-7 grid min-h-40 place-items-center rounded-xl bg-slate-50 text-center"><div><MapPinned className="mx-auto size-6 text-slate-300"/><p className="mt-3 text-sm font-semibold text-slate-700">City comparisons are ready</p><p className="mt-1 text-xs text-slate-500">Cities appear when governed impact observations include completed local work.</p></div></div>}</section>

    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-200 p-5"><h2 className="font-bold">Organization impact</h2><p className="mt-1 text-sm text-slate-500">Ranked by estimated savings for the selected period.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Organization</th><th className="px-5 py-3">Est. savings</th><th className="px-5 py-3">Hours</th><th className="px-5 py-3">Jobs</th><th className="px-5 py-3">Local retained</th></tr></thead><tbody className="divide-y divide-slate-100">{ranked.length?ranked.map(([id,item])=><tr key={id}><td className="px-5 py-4 font-semibold">{item.name}</td><td className="px-5 py-4">{formatImpactCurrency(item.savings)}</td><td className="px-5 py-4">{Math.round(item.hours).toLocaleString()}</td><td className="px-5 py-4">{item.jobs.toLocaleString()}</td><td className="px-5 py-4">{formatImpactCurrency(item.local)}</td></tr>):<tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500">No organization observations in this period.</td></tr>}</tbody></table></div></section>
  </div>;
}
