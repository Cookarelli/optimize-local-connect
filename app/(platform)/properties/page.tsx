import Link from "next/link";
import { MapPin, Plus } from "lucide-react";
import { EmptyState, PageHeader } from "@/src/components/ui/page-header";
import { can } from "@/src/lib/auth/authorization";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export default async function PropertiesPage() {
  const user = await requireUser();
  const membership = user.memberships[0];
  const supabase = await createSupabaseServerClient();
  const { data: properties, error } = membership ? await supabase.from("properties").select("id, name, address_line_1, postal_code, unit_count, status, cities(name, state_code)").eq("organization_id", membership.organizationId).order("name") : { data: [], error: null };
  if (error) throw new Error(error.message);
  const allowed = membership && can(user, "properties:create", membership.organizationId);

  return <div><PageHeader eyebrow="Property Management" title="Properties" description="The places your team is responsible for, organized by market." action={allowed ? <Link href="/properties/new" className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white"><Plus className="mr-2 size-4" /> Add property</Link> : undefined} /><div className="mt-8">{properties?.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{properties.map((property) => { const city = property.cities as unknown as { name: string; state_code: string } | null; return <article key={property.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><h2 className="font-bold text-slate-950">{property.name}</h2><p className="mt-2 flex items-start gap-2 text-sm leading-5 text-slate-500"><MapPin className="mt-0.5 size-4 shrink-0" />{property.address_line_1}<br />{city?.name}, {city?.state_code} {property.postal_code}</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold capitalize text-emerald-700">{property.status}</span></div><p className="mt-6 border-t border-slate-100 pt-4 text-sm font-medium text-slate-600">{property.unit_count.toLocaleString()} {property.unit_count === 1 ? "unit" : "units"}</p></article>})}</div> : <EmptyState title="No properties yet" description="Add the first property to begin creating service requests and matching local providers." />}</div></div>;
}
