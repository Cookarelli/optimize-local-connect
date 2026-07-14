import Link from "next/link";
import { Plus } from "lucide-react";
import { EmptyState, PageHeader } from "@/src/components/ui/page-header";
import { can } from "@/src/lib/auth/authorization";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export default async function RequestsPage() {
  const user = await requireUser();
  const membership = user.memberships[0];
  const supabase = await createSupabaseServerClient();
  const { data: requests, error } = membership ? await supabase.from("service_requests").select("id, title, priority, status, created_at, properties(name), vendor_categories(name)").eq("organization_id", membership.organizationId).order("created_at", { ascending: false }).limit(50) : { data: [], error: null };
  if (error) throw new Error(error.message);
  const allowed = membership && can(user, "service_requests:create", membership.organizationId);

  return <div><PageHeader eyebrow="Work" title="Service requests" description="Track issues from intake through vendor matching, award, and completion." action={allowed ? <Link href="/requests/new" className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white"><Plus className="mr-2 size-4" /> New request</Link> : undefined} /><div className="mt-8">{requests?.length ? <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{requests.map((request) => <Link href={`/requests/${request.id}`} key={request.id} className="grid gap-3 border-b border-slate-100 p-5 last:border-0 hover:bg-slate-50 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-950">{request.title}</h2><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${request.priority === "emergency" || request.priority === "urgent" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}>{request.priority}</span></div><p className="mt-1 text-sm text-slate-500">{(request.properties as unknown as { name: string } | null)?.name ?? "Property"} · {(request.vendor_categories as unknown as { name: string } | null)?.name ?? "Unassigned category"}</p></div><span className="text-xs font-semibold capitalize text-slate-500">{request.status.replaceAll("_", " ")}</span></Link>)}</div> : <EmptyState title="No service requests" description="When something needs attention, create a request once and manage the entire vendor workflow here." />}</div></div>;
}
