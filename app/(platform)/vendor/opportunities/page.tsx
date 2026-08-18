import Link from "next/link";
import { requireUser } from "@/src/lib/auth/session";
import { isFirebaseOperationalBackend } from "@/src/lib/firebase/platform";
import { listFirebaseVendorOpportunities } from "@/src/lib/firebase/service-requests";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export default async function VendorOpportunitiesPage(){
  const user=await requireUser();const vendor=user.memberships.find(m=>m.organizationType==="vendor");if(!vendor)return null;
  if(isFirebaseOperationalBackend()){
    const assignments=await listFirebaseVendorOpportunities(user,vendor.organizationId);
    return <div><p className="text-sm font-semibold text-emerald-700">Vendor workspace</p><h1 className="mt-1 text-4xl font-semibold">Opportunities</h1><p className="mt-3 max-w-3xl text-sm text-slate-500">Eligible opportunities are manually assigned using category, service area, membership, and publication rules. Connect Match is not AI.</p><div className="mt-8 grid gap-4">{assignments.map(item=><Link key={item.id} href={`/vendor/opportunities/${String(item.requestId)}`} className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-emerald-300"><p className="font-bold">{item.request!.categoryName}</p><p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.request!.problemDescription}</p><p className="mt-3 text-xs text-slate-500">{item.request!.serviceAreaKey} · {String(item.status)}</p></Link>)}</div>{!assignments.length?<section className="mt-8 rounded-2xl border border-dashed p-10 text-center"><p className="font-bold text-slate-800">New opportunities will appear here.</p><p className="mt-2 text-sm text-slate-500">Keep your approved profile, active membership, service categories, and service areas current so administrators can identify eligible work.</p></section>:null}</div>;
  }
  const db=await createSupabaseServerClient();const {data:rawData}=await db.from("property_manager_service_requests").select("id,priority,status,problem_description,submitted_at,assigned_at,properties(city_id,cities(name,state_code)),vendor_categories(name)").eq("assigned_vendor_organization_id",vendor.organizationId).order("submitted_at",{ascending:false});const data=rawData??[];
  return <div><h1 className="text-4xl font-semibold">Opportunities</h1><div className="mt-8 grid gap-4">{data.map(item=><Link key={item.id} href={`/vendor/opportunities/${item.id}`} className="rounded-2xl border bg-white p-5"><p>{item.problem_description}</p></Link>)}</div></div>;
}
