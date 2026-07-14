import Link from "next/link";
import { ArrowRight, Award, Building2, ShieldCheck, Store, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { PropertyOperationsDashboard } from "@/src/components/dashboard/property-operations-dashboard";
import { getRoleHome } from "@/src/lib/auth/routing";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export default async function AdminDashboardPage() {
  const user = await requireUser();
  const membership = user.memberships[0];
  if (!user.isSuperAdmin) {
    if (!membership || !["owner", "admin"].includes(membership.role) || membership.organizationType !== "property_management") redirect(getRoleHome(user));
    return <PropertyOperationsDashboard user={user} membership={membership} mode="admin" />;
  }

  const supabase = await createSupabaseServerClient();
  const [organizations, properties, vendors, members] = await Promise.all([
    supabase.from("organizations").select("id", { count: "exact", head: true }),
    supabase.from("properties").select("id", { count: "exact", head: true }),
    supabase.from("vendor_profiles").select("organization_id", { count: "exact", head: true }).eq("verification_status", "verified"),
    supabase.from("organization_members").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);
  const metrics = [["Organizations", organizations.count ?? 0, Building2], ["Properties", properties.count ?? 0, ShieldCheck], ["Verified vendors", vendors.count ?? 0, Store], ["Active members", members.count ?? 0, Users]] as const;
  return <div><p className="text-sm font-semibold text-emerald-700">Platform administration</p><h1 className="mt-1 text-3xl font-semibold tracking-[-.035em] text-slate-950 sm:text-4xl">Connect control center</h1><p className="mt-2 text-sm text-slate-500">Cross-organization, industry vertical, and marketplace oversight.</p><section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value, Icon]) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex justify-between"><div><p className="text-sm text-slate-500">{label}</p><p className="mt-3 text-3xl font-bold">{value.toLocaleString()}</p></div><span className="grid size-10 place-items-center rounded-xl bg-emerald-50"><Icon className="size-5 text-emerald-700" /></span></div></article>)}</section><Link href="/admin/founding-fifty" className="mt-8 flex items-center justify-between rounded-2xl bg-slate-950 p-6 text-white transition hover:bg-emerald-800"><span className="flex items-center gap-4"><span className="grid size-11 place-items-center rounded-xl bg-amber-300 text-amber-950"><Award className="size-5" /></span><span><span className="block font-bold">Manage the Founding Fifty</span><span className="mt-1 block text-sm text-slate-400">Seats, payments, reservations, member display, revenue, and exports</span></span></span><ArrowRight className="size-5" /></Link></div>;
}
