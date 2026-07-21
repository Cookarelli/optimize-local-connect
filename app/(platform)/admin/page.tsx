import Link from "next/link";
import { ArrowRight, Building2, ClipboardList, Store, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { PropertyOperationsDashboard } from "@/src/components/dashboard/property-operations-dashboard";
import { getRoleHome } from "@/src/lib/auth/routing";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
const cards=[
  ["Service Requests","Review and manually assign property-manager opportunities.","/admin/service-requests",ClipboardList],
  ["Vendor Pipeline","Manage outbound vendor recruiting prospects.","/admin/vendor-pipeline",Users],
  ["Founding Vendors","Review Founder enrollment and membership status.","/admin/founding-vendors",Store],
  ["Property Manager Request Entry","Submit a service request from the property-manager workspace.","/property-manager/service-requests",Building2],
  ["Vendor Opportunities","View the assigned-vendor opportunity experience.","/vendor/opportunities",Store],
  ["Vendor Dashboard Demo","Open the sales demonstration dashboard.","/demo/vendor-dashboard",Building2],
] as const;
export default async function AdminDashboardPage(){const user=await requireUser();const membership=user.memberships[0];if(!user.isSuperAdmin){if(!membership||!["owner","admin"].includes(membership.role)||membership.organizationType!=="property_management")redirect(getRoleHome(user));return <PropertyOperationsDashboard user={user} membership={membership} mode="admin"/>;}const db=await createSupabaseServerClient();const [{count:requests},{count:vendors}]=await Promise.all([db.from("property_manager_service_requests").select("id",{count:"exact",head:true}),db.from("vendor_profiles").select("organization_id",{count:"exact",head:true})]);return <div><p className="text-sm font-semibold text-emerald-700">Platform administration</p><h1 className="mt-1 text-4xl font-semibold tracking-tight">Platform Control Center</h1><p className="mt-3 text-sm text-slate-500">Secure cross-platform control for Optimize Local Connect.</p><div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([title,copy,href,Icon])=><Link key={href} href={href} className="rounded-2xl border border-slate-200 bg-white p-6 hover:border-emerald-300"><Icon className="size-6 text-emerald-700"/><h2 className="mt-5 font-bold">{title}</h2><p className="mt-2 text-sm text-slate-500">{copy}</p>{title==="Service Requests"?<p className="mt-3 text-xs font-bold text-emerald-700">{requests??0} current records</p>:title==="Vendor Pipeline"?<p className="mt-3 text-xs font-bold text-emerald-700">{vendors??0} vendor profiles</p>:null}<span className="mt-5 inline-flex items-center text-sm font-bold text-slate-950">Open <ArrowRight className="ml-2 size-4"/></span></Link>)}</div></div>}
