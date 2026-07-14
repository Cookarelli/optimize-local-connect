import { createProperty } from "./actions";
import { PageHeader } from "@/src/components/ui/page-header";
import { authorize } from "@/src/lib/auth/authorization";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const inputClass = "mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

export default async function NewPropertyPage() {
  const user = await requireUser();
  const membership = user.memberships[0];
  if (!membership) return null;
  authorize(user, "properties:create", membership.organizationId);
  const supabase = await createSupabaseServerClient();
  const { data: markets, error } = await supabase.from("organization_markets").select("market_id, markets(city, state_code)").eq("organization_id", membership.organizationId);
  if (error) throw new Error(error.message);
  return <div><PageHeader eyebrow="Portfolio" title="Add a property" description="Create a market-scoped property record for requests, vendor matching, and reporting." /><form action={createProperty} className="mt-8 grid max-w-3xl gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2"><input type="hidden" name="organizationId" value={membership.organizationId} /><label className="text-sm font-medium text-slate-700 sm:col-span-2">Property name<input className={inputClass} name="name" required minLength={2} maxLength={160} /></label><label className="text-sm font-medium text-slate-700 sm:col-span-2">Market<select className={inputClass} name="marketId" required defaultValue=""><option value="" disabled>Select a market</option>{markets?.map((item) => { const market = item.markets as unknown as { city: string; state_code: string } | null; return <option key={item.market_id} value={item.market_id}>{market?.city}, {market?.state_code}</option> })}</select></label><label className="text-sm font-medium text-slate-700 sm:col-span-2">Street address<input className={inputClass} name="addressLine1" required /></label><label className="text-sm font-medium text-slate-700 sm:col-span-2">Suite or building <span className="font-normal text-slate-400">(optional)</span><input className={inputClass} name="addressLine2" /></label><label className="text-sm font-medium text-slate-700">City<input className={inputClass} name="city" required /></label><label className="text-sm font-medium text-slate-700">State<input className={inputClass} name="stateCode" required minLength={2} maxLength={2} /></label><label className="text-sm font-medium text-slate-700">Postal code<input className={inputClass} name="postalCode" required /></label><label className="text-sm font-medium text-slate-700">Unit count<input className={inputClass} name="unitCount" type="number" required min={1} defaultValue={1} /></label><div className="sm:col-span-2"><button type="submit" className="min-h-11 rounded-full bg-slate-950 px-6 text-sm font-semibold text-white hover:bg-emerald-700">Create property</button></div></form></div>;
}
