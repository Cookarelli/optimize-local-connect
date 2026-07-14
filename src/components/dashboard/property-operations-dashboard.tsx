import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Building2, ClipboardList, Store } from "lucide-react";
import type { AppUser, Membership } from "@/src/domain/auth/types";
import { can } from "@/src/lib/auth/authorization";
import { ImpactWidgets } from "@/src/components/impact/impact-widgets";
import { getImpactRange, getOrganizationImpactSummary } from "@/src/lib/impact/summary";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

async function getCounts(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const [properties, requests, vendors, completed] = await Promise.all([
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "active"),
    supabase.from("service_requests").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).in("status", ["open", "matching", "quoted", "awarded", "in_progress"]),
    supabase.from("organization_vendor_relationships").select("id", { count: "exact", head: true }).eq("property_organization_id", organizationId).eq("status", "active"),
    supabase.from("service_requests").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "completed"),
  ]);
  return { properties: properties.count ?? 0, requests: requests.count ?? 0, vendors: vendors.count ?? 0, completed: completed.count ?? 0 };
}

export async function PropertyOperationsDashboard({ user, membership, mode }: { user: AppUser; membership: Membership; mode: "admin" | "manager" }) {
  const [counts,impact] = await Promise.all([getCounts(membership.organizationId),getOrganizationImpactSummary(membership.organizationId,getImpactRange("30d"))]);
  const firstName = (user.fullName || user.email).split(/[ @]/)[0];
  const metrics = [
    ["Active properties", counts.properties, Building2, "text-sky-700", "bg-sky-50"],
    ["Open requests", counts.requests, ClipboardList, "text-amber-700", "bg-amber-50"],
    ["Trusted vendors", counts.vendors, BadgeCheck, "text-emerald-700", "bg-emerald-50"],
    ["Completed jobs", counts.completed, Store, "text-violet-700", "bg-violet-50"],
  ] as const;
  return <div><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-emerald-700">{mode === "admin" ? "Organization administration" : "Property operations"}</p><h1 className="mt-1 text-3xl font-semibold tracking-[-.035em] text-slate-950 sm:text-4xl">Good to see you, {firstName}.</h1><p className="mt-2 text-sm text-slate-500">Here’s the current shape of {membership.organizationName}.</p></div>{can(user, "service_requests:create", membership.organizationId) ? <Link href="/requests/new" className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-emerald-700">Request service <ArrowUpRight className="ml-2 size-4" /></Link> : null}</div>
    <section aria-label="Workspace actions" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Link href="/requests/new" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 transition hover:border-emerald-400"><p className="text-sm font-bold text-emerald-900">Request service</p><p className="mt-1 text-xs leading-5 text-emerald-800/75">Capture an issue and route it to the right provider.</p></Link><Link href="/marketplace" className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300"><p className="text-sm font-bold text-slate-900">Find local vendors</p><p className="mt-1 text-xs leading-5 text-slate-500">Compare trusted coverage, credentials, and response history.</p></Link><Link href="/properties" className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300"><p className="text-sm font-bold text-slate-900">My properties</p><p className="mt-1 text-xs leading-5 text-slate-500">Keep the places your team serves organized.</p></Link><Link href="/impact" className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300"><p className="text-sm font-bold text-slate-900">Community impact</p><p className="mt-1 text-xs leading-5 text-slate-500">View savings only when governed records support them.</p></Link></section>
    <section aria-label="Portfolio metrics" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value, Icon, color, bg]) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-sm text-slate-500">{label}</p><p className="mt-3 text-3xl font-bold tracking-tight">{value.toLocaleString()}</p></div><span className={`grid size-10 place-items-center rounded-xl ${bg}`}><Icon className={`size-5 ${color}`} /></span></div></article>)}</section>
    <ImpactWidgets summary={impact} title="Portfolio impact · last 30 days" /><section className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]"><article className="min-h-80 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between"><div><h2 className="font-bold text-slate-950">Active service requests</h2><p className="mt-1 text-sm text-slate-500">Work requiring attention across your portfolio.</p></div><Link href="/requests" className="text-sm font-semibold text-emerald-700">View all</Link></div><div className="grid min-h-52 place-items-center text-center"><div><ClipboardList className="mx-auto size-7 text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-700">{counts.requests === 0 ? "No active requests" : `${counts.requests} requests are currently active`}</p><p className="mt-1 text-xs text-slate-500">Request details and assignments appear here as work is created.</p></div></div></article><article className="rounded-2xl bg-slate-950 p-6 text-white shadow-sm"><p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-400">Workspace access</p><h2 className="mt-3 text-xl font-bold capitalize">{membership.role.replaceAll("_", " ")}</h2><p className="mt-3 text-sm leading-6 text-slate-400">Actions are scoped to this role and enforced again by database row-level security.</p><div className="mt-8 border-t border-slate-800 pt-5"><p className="text-xs text-slate-500">Organization</p><p className="mt-1 text-sm font-semibold">{membership.organizationName}</p></div></article></section></div>;
}
