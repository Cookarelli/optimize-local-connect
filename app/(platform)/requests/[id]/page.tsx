import { notFound } from "next/navigation";
import { BadgeCheck, Building2, CalendarClock, MapPin, Wrench } from "lucide-react";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

type RequestDetail = {
  id: string; title: string; description: string; location_detail: string | null; priority: string; status: string; created_at: string;
  properties: { name: string; address_line_1: string; city: string; state_code: string } | null;
  trades: { name: string } | null;
};

type Bid = { id: string; amount_cents: number; status: string; earliest_start_at: string | null; organizations: { name: string } | null };

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, { data: bidData }] = await Promise.all([
    supabase.from("service_requests").select("id, title, description, location_detail, priority, status, created_at, properties(name, address_line_1, city, state_code), trades(name)").eq("id", id).single(),
    supabase.from("bids").select("id, amount_cents, status, earliest_start_at, organizations(name)").eq("service_request_id", id).order("amount_cents"),
  ]);
  if (error || !data) notFound();
  const request = data as unknown as RequestDetail;
  const bids = (bidData ?? []) as unknown as Bid[];

  return <div><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-emerald-700">Service request</p><h1 className="mt-1 text-3xl font-semibold tracking-[-.035em] text-slate-950">{request.title}</h1><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700">{request.status.replaceAll("_", " ")}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${request.priority === "urgent" || request.priority === "emergency" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{request.priority}</span></div></div></div><div className="mt-8 grid gap-6 xl:grid-cols-[1.3fr_.7fr]"><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold">Issue details</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">{request.description}</p>{request.location_detail ? <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600"><MapPin className="mr-2 inline size-4" />{request.location_detail}</p> : null}<dl className="mt-7 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2"><div><dt className="text-xs text-slate-400">Property</dt><dd className="mt-1 flex items-center gap-2 text-sm font-semibold"><Building2 className="size-4 text-slate-400" />{request.properties?.name}</dd></div><div><dt className="text-xs text-slate-400">Trade</dt><dd className="mt-1 flex items-center gap-2 text-sm font-semibold"><Wrench className="size-4 text-slate-400" />{request.trades?.name}</dd></div></dl></section><aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-bold">Vendor bids</h2><span className="text-xs font-semibold text-slate-400">{bids.length}</span></div>{bids.length ? <div className="mt-4 space-y-3">{bids.map((bid) => <div key={bid.id} className="rounded-xl border border-slate-100 p-4"><p className="flex items-center gap-1.5 text-sm font-semibold"><BadgeCheck className="size-4 text-emerald-600" />{bid.organizations?.name ?? "Vendor"}</p><p className="mt-3 text-xl font-bold">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(bid.amount_cents / 100)}</p>{bid.earliest_start_at ? <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><CalendarClock className="size-3.5" />Available {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(bid.earliest_start_at))}</p> : null}</div>)}</div> : <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">Qualified vendors can respond while this request is published in the marketplace.</p>}</aside></div></div>;
}
