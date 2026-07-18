import Link from "next/link";
import { ArrowLeft, ArrowRight, Banknote, CheckCircle2, ClipboardCheck, Clock3, Search, ShieldCheck, Store, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { CopyContactButton } from "@/src/components/admin/copy-contact-button";
import { FOUNDER_APPLICATION_STATUSES, FOUNDER_PAYMENT_STATUSES, founderApplicationBadge, founderPaymentBadge, founderStatusLabel } from "@/src/domain/founding-partner/admin";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;
const input = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
type Params = { q?: string; payment?: string; status?: string; category?: string; date?: string; page?: string; result?: string };
type Payment = { id: string; payment_status: string; amount_paid_cents: number; currency: string; customer_email: string; paid_at: string };
type Founder = { id: string; payment_id: string; status: string; business_name: string | null; contact_name: string | null; customer_email: string; phone: string | null; primary_service_category: string | null; submitted_at: string | null; updated_at: string };

function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function cleanSearch(value: string | undefined) { return (value ?? "").replace(/[%_,().]/g, " ").trim().slice(0, 100); }
function validDate(value: string | undefined) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""; }
function buildPageHref(params: Params, page: number) {
  const search = new URLSearchParams();
  for (const key of ["q", "payment", "status", "category", "date"] as const) if (params[key]) search.set(key, params[key]!);
  if (page > 1) search.set("page", String(page));
  return `/admin/founders${search.size ? `?${search}` : ""}`;
}
function money(cents: number, currency = "USD") { return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100); }
function dateTime(value: string | null) { return value ? new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—"; }

export default async function FoundersAdminPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireUser();
  if (!user.isSuperAdmin) redirect("/dashboard");
  const raw = await searchParams;
  const q = cleanSearch(one(raw.q));
  const paymentFilter = FOUNDER_PAYMENT_STATUSES.includes(one(raw.payment) as typeof FOUNDER_PAYMENT_STATUSES[number]) ? one(raw.payment)! : "";
  const statusFilter = FOUNDER_APPLICATION_STATUSES.includes(one(raw.status) as typeof FOUNDER_APPLICATION_STATUSES[number]) ? one(raw.status)! : "";
  const categoryFilter = (one(raw.category) ?? "").slice(0, 160);
  const dateFilter = validDate(one(raw.date));
  const page = Math.max(1, Math.min(1000, Number.parseInt(one(raw.page) ?? "1", 10) || 1));
  const supabase = await createSupabaseServerClient();

  const [{ data: allPayments, error: paymentsError }, { data: allFounders, error: foundersError }] = await Promise.all([
    supabase.from("founding_partner_payments").select("id,payment_status,amount_paid_cents,currency,customer_email,paid_at").order("paid_at", { ascending: false }),
    supabase.from("founding_partner_onboardings").select("id,payment_id,status,business_name,contact_name,customer_email,phone,primary_service_category,submitted_at,updated_at"),
  ]);
  const payments = (allPayments ?? []) as Payment[];
  const founders = (allFounders ?? []) as Founder[];
  const paymentMap = new Map(payments.map(payment => [payment.id, payment]));
  const categories = [...new Set(founders.map(item => item.primary_service_category).filter(Boolean) as string[])].sort();
  const paymentIds = new Set(payments.filter(payment => {
    if (paymentFilter && payment.payment_status !== paymentFilter) return false;
    if (dateFilter && !payment.paid_at.startsWith(dateFilter)) return false;
    return true;
  }).map(payment => payment.id));
  const filtered = founders.filter(item => {
    if (!paymentIds.has(item.payment_id)) return false;
    if (statusFilter && item.status !== statusFilter) return false;
    if (categoryFilter && item.primary_service_category !== categoryFilter) return false;
    if (q && ![item.business_name, item.contact_name, item.customer_email, item.phone].some(value => value?.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  }).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const revenue = payments.filter(item => item.payment_status === "paid").reduce((sum, item) => sum + item.amount_paid_cents, 0);
  const metrics = [
    ["Total payments", payments.length, Users],
    ["Total revenue", money(revenue), Banknote],
    ["Onboarding incomplete", founders.filter(item => item.status === "paid_onboarding_incomplete").length, Clock3],
    ["Submitted for review", founders.filter(item => item.status === "submitted").length, ClipboardCheck],
    ["Approved", founders.filter(item => item.status === "approved").length, CheckCircle2],
    ["Active listings", founders.filter(item => item.status === "active").length, Store],
  ] as const;
  const loadError = paymentsError || foundersError;

  return <div>
    <Link href="/admin" className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-slate-900"><ArrowLeft className="mr-2 size-4" />Admin overview</Link>
    <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-semibold text-emerald-700">Founder administration</p><h1 className="mt-1 text-3xl font-semibold tracking-[-.04em] sm:text-5xl">Founding Partners</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">Verified payments, application review, and marketplace activation—kept separate and auditable.</p></div><div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800"><ShieldCheck className="size-4" />Super Admin only</div></div>
    {raw.result === "updated" ? <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Founder record updated.</p> : raw.result === "error" ? <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-800">The requested change could not be completed. Open the record and confirm its current status.</p> : null}
    <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">{metrics.map(([label, value, Icon]) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-3 text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</p></div><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50"><Icon className="size-4.5 text-emerald-700" /></span></div></article>)}</section>

    <form action="/admin/founders" className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.5fr_repeat(4,1fr)_auto]"><label className="relative"><span className="sr-only">Search Founding Partners</span><Search className="absolute left-3.5 top-3.5 size-4 text-slate-400" /><input className={`${input} pl-10`} name="q" defaultValue={q} placeholder="Business, contact, email, or phone" /></label><label><span className="sr-only">Payment status</span><select className={input} name="payment" defaultValue={paymentFilter}><option value="">All payment statuses</option>{FOUNDER_PAYMENT_STATUSES.map(value => <option key={value} value={value}>{founderStatusLabel(value)}</option>)}</select></label><label><span className="sr-only">Application status</span><select className={input} name="status" defaultValue={statusFilter}><option value="">All application statuses</option>{FOUNDER_APPLICATION_STATUSES.map(value => <option key={value} value={value}>{founderStatusLabel(value)}</option>)}</select></label><label><span className="sr-only">Primary category</span><select className={input} name="category" defaultValue={categoryFilter}><option value="">All categories</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></label><label><span className="sr-only">Payment date</span><input className={input} name="date" type="date" defaultValue={dateFilter} /></label><button className="min-h-11 rounded-xl bg-slate-950 px-5 text-sm font-black text-white hover:bg-emerald-700">Filter</button></div>
      <div className="mt-3 flex items-center justify-between"><p className="text-xs text-slate-400">{filtered.length.toLocaleString()} matching record{filtered.length === 1 ? "" : "s"}</p><Link href="/admin/founders" className="text-xs font-bold text-emerald-700">Clear filters</Link></div>
    </form>

    {loadError ? <section className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-6"><h2 className="font-bold text-rose-900">Founder records are temporarily unavailable</h2><p className="mt-2 text-sm text-rose-800">Refresh the page. If the problem continues, check the database connection and migration status.</p></section> : visible.length === 0 ? <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="text-lg font-bold">No Founding Partners match these filters</h2><p className="mt-2 text-sm text-slate-500">Clear one or more filters, or wait for the first verified checkout.</p></section> : <>
      <div className="mt-6 hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm lg:block"><table className="w-full min-w-[1280px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-[.12em] text-slate-500"><tr>{["Business", "Contact", "Primary category", "Verified payment", "Application", "Paid", "Submitted", "Last updated", "Actions"].map(label => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{visible.map(founder => { const payment = paymentMap.get(founder.payment_id)!; return <tr key={founder.id} className="align-top hover:bg-slate-50/60"><td className="px-4 py-4"><Link href={`/admin/founders/${founder.id}`} className="font-bold text-slate-950 hover:text-emerald-700">{founder.business_name ?? "Onboarding incomplete"}</Link><p className="mt-1 text-xs text-slate-400">{founder.customer_email}</p></td><td className="px-4 py-4"><p>{founder.contact_name ?? "—"}</p><p className="mt-1 text-xs text-slate-500">{founder.phone ?? "—"}</p></td><td className="px-4 py-4 text-slate-600">{founder.primary_service_category ?? "—"}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${founderPaymentBadge(payment.payment_status)}`}>{founderStatusLabel(payment.payment_status)}</span><p className="mt-2 font-bold">{money(payment.amount_paid_cents, payment.currency)}</p></td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${founderApplicationBadge(founder.status)}`}>{founderStatusLabel(founder.status)}</span></td><td className="px-4 py-4 text-xs text-slate-500">{dateTime(payment.paid_at)}</td><td className="px-4 py-4 text-xs text-slate-500">{dateTime(founder.submitted_at)}</td><td className="px-4 py-4 text-xs text-slate-500">{dateTime(founder.updated_at)}</td><td className="px-4 py-4"><div className="flex flex-col items-start gap-2"><Link href={`/admin/founders/${founder.id}`} className="inline-flex min-h-9 items-center rounded-lg bg-slate-950 px-3 text-xs font-bold text-white">View application</Link><div className="flex gap-2"><CopyContactButton label="Email" value={founder.customer_email} /><CopyContactButton label="Phone" value={founder.phone} /></div></div></td></tr>; })}</tbody></table></div>
      <div className="mt-6 grid gap-4 lg:hidden">{visible.map(founder => { const payment = paymentMap.get(founder.payment_id)!; return <article key={founder.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">{founder.business_name ?? "Onboarding incomplete"}</h2><p className="mt-1 text-xs text-slate-500">{founder.contact_name ?? "No contact yet"} · {founder.primary_service_category ?? "No category"}</p></div><span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${founderApplicationBadge(founder.status)}`}>{founderStatusLabel(founder.status)}</span></div><div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-xs"><div><p className="text-slate-400">Payment</p><p className="mt-1 font-bold">{money(payment.amount_paid_cents, payment.currency)} · {founderStatusLabel(payment.payment_status)}</p></div><div><p className="text-slate-400">Paid</p><p className="mt-1 font-bold">{dateTime(payment.paid_at)}</p></div><div><p className="text-slate-400">Email</p><p className="mt-1 break-all font-bold">{founder.customer_email}</p></div><div><p className="text-slate-400">Phone</p><p className="mt-1 font-bold">{founder.phone ?? "—"}</p></div></div><div className="mt-4 flex flex-wrap gap-2"><Link href={`/admin/founders/${founder.id}`} className="inline-flex min-h-9 items-center rounded-lg bg-slate-950 px-3 text-xs font-bold text-white">View application <ArrowRight className="ml-1.5 size-3.5" /></Link><CopyContactButton label="Email" value={founder.customer_email} /><CopyContactButton label="Phone" value={founder.phone} /></div></article>; })}</div>
      <nav aria-label="Founder pagination" className="mt-6 flex items-center justify-between"><Link aria-disabled={safePage === 1} href={safePage === 1 ? buildPageHref(raw, 1) : buildPageHref(raw, safePage - 1)} className={`rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold ${safePage === 1 ? "pointer-events-none opacity-40" : "hover:bg-slate-50"}`}>Previous</Link><p className="text-xs text-slate-500">Page {safePage} of {pageCount}</p><Link aria-disabled={safePage === pageCount} href={safePage === pageCount ? buildPageHref(raw, pageCount) : buildPageHref(raw, safePage + 1)} className={`rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold ${safePage === pageCount ? "pointer-events-none opacity-40" : "hover:bg-slate-50"}`}>Next</Link></nav>
    </>}
  </div>;
}
