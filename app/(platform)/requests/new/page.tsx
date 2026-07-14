import { createServiceRequest } from "./actions";
import { PageHeader } from "@/src/components/ui/page-header";
import { authorize } from "@/src/lib/auth/authorization";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const inputClass = "mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

export default async function NewRequestPage() {
  const user = await requireUser();
  const membership = user.memberships[0];
  if (!membership) return null;
  authorize(user, "service_requests:create", membership.organizationId);
  const supabase = await createSupabaseServerClient();
  const [{ data: properties }, { data: trades }] = await Promise.all([supabase.from("properties").select("id, name").eq("organization_id", membership.organizationId).eq("status", "active").order("name"), supabase.from("trades").select("id, name").eq("is_active", true).order("name")]);
  return <div><PageHeader eyebrow="Work" title="New service request" description="Capture the issue once. Property OS publishes it to qualified vendors in the property’s market." /><form action={createServiceRequest} className="mt-8 grid max-w-3xl gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2"><input type="hidden" name="organizationId" value={membership.organizationId} /><label className="text-sm font-medium text-slate-700">Property<select className={inputClass} name="propertyId" required defaultValue=""><option value="" disabled>Select property</option>{properties?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Trade<select className={inputClass} name="tradeId" required defaultValue=""><option value="" disabled>Select trade</option>{trades?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-sm font-medium text-slate-700 sm:col-span-2">What needs attention?<input className={inputClass} name="title" required minLength={4} maxLength={180} placeholder="Example: No cooling in unit 204" /></label><label className="text-sm font-medium text-slate-700 sm:col-span-2">Describe the issue<textarea className={`${inputClass} min-h-32 py-3`} name="description" required minLength={10} maxLength={5000} /></label><label className="text-sm font-medium text-slate-700">Location detail <span className="font-normal text-slate-400">(optional)</span><input className={inputClass} name="locationDetail" placeholder="Unit, room, or access point" /></label><label className="text-sm font-medium text-slate-700">Priority<select className={inputClass} name="priority" defaultValue="routine"><option value="routine">Routine</option><option value="soon">Soon</option><option value="urgent">Urgent</option><option value="emergency">Emergency</option></select></label><div className="sm:col-span-2"><button type="submit" disabled={!properties?.length} className="min-h-11 rounded-full bg-slate-950 px-6 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">Publish request</button>{!properties?.length ? <p className="mt-2 text-sm text-amber-700">Add an active property before creating a request.</p> : null}</div></form></div>;
}
