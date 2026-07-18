import type { Metadata } from "next";
import { ArrowUpRight, CheckCircle2, CircleAlert, CreditCard, Store } from "lucide-react";
import { createProduct, startConnectOnboarding } from "./actions";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { getConnectedAccountStatus } from "@/src/lib/stripe/connect";

export const metadata: Metadata = { title: "Connected payments" };

export default async function ConnectedPaymentsPage() {
  const user = await requireUser();
  const membership = user.memberships[0];
  const canManage = membership && ["owner", "admin"].includes(membership.role);
  const connectConfigured = process.env.STRIPE_SECRET_KEY?.startsWith("sk_")
    && Boolean(process.env.NEXT_PUBLIC_APP_URL)
    && /^\d+$/.test(process.env.STRIPE_CONNECT_APPLICATION_FEE_BPS ?? "");
  const supabase = await createSupabaseServerClient();
  const { data: mapping } = membership ? await supabase.from("stripe_connected_accounts")
    .select("stripe_account_id")
    .eq("organization_id", membership.organizationId)
    .maybeSingle() : { data: null };

  let liveStatus: Awaited<ReturnType<typeof getConnectedAccountStatus>> | null = null;
  let statusError: string | null = null;
  if (mapping?.stripe_account_id) {
    try { liveStatus = await getConnectedAccountStatus(mapping.stripe_account_id); }
    catch { statusError = "Stripe status is temporarily unavailable. No stored status was substituted."; }
  }

  const { data: products } = membership ? await supabase.from("marketplace_products")
    .select("id,name,description,unit_amount_cents,currency,active,created_at")
    .eq("seller_organization_id", membership.organizationId)
    .order("created_at", { ascending: false }) : { data: [] };

  return <div className="mx-auto max-w-5xl">
    <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">Optional platform payments</p>
    <h1 className="mt-2 text-4xl font-semibold tracking-[-.045em] text-slate-950 sm:text-5xl">Get paid through Connect.</h1>
    <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">Connect a Stripe Express account to receive marketplace service payments. Your organization can still arrange and collect payments outside Optimize Local Connect.</p>
    {!connectConfigured?<p className="mt-6 rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-900">Connected payments are not configured on this environment. An operator must add STRIPE_SECRET_KEY, NEXT_PUBLIC_APP_URL, and STRIPE_CONNECT_APPLICATION_FEE_BPS.</p>:null}

    <section className="mt-8 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><CreditCard className="size-5" /></span><div><h2 className="text-xl font-bold">Stripe account</h2><p className="text-xs text-slate-500">Status is read directly from Stripe</p></div></div>
      <div className="mt-5 space-y-2 text-sm">{liveStatus ? <><p className="flex items-center gap-2">{liveStatus.onboardingComplete?<CheckCircle2 className="size-4 text-emerald-600"/>:<CircleAlert className="size-4 text-amber-600"/>}Onboarding: <strong>{liveStatus.onboardingComplete?"Complete":"Action required"}</strong></p><p className="flex items-center gap-2">{liveStatus.readyToReceivePayments?<CheckCircle2 className="size-4 text-emerald-600"/>:<CircleAlert className="size-4 text-amber-600"/>}Transfers: <strong>{liveStatus.transferStatus}</strong></p></> : <p className="text-slate-500">{statusError ?? "No Stripe account connected yet."}</p>}</div></div>
      {canManage ? <form action={startConnectOnboarding}><button disabled={!connectConfigured} className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-bold text-white enabled:hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">{mapping?"Continue Stripe onboarding":"Onboard to collect payments"}<ArrowUpRight className="ml-2 size-4"/></button></form> : <p className="text-sm text-slate-500">Ask an organization owner or admin to manage onboarding.</p>}</div>
    </section>

    <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.15fr]">
      <form action={createProduct} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm"><Store className="size-6 text-emerald-700"/><h2 className="mt-4 text-xl font-bold">Create a storefront item</h2><p className="mt-2 text-xs leading-5 text-slate-500">Products are created on the platform and mapped to this connected organization.</p><div className="mt-5 space-y-4"><label className="block text-sm font-bold">Name<input name="name" required minLength={2} maxLength={120} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 font-normal" placeholder="HVAC service call"/></label><label className="block text-sm font-bold">Description<textarea name="description" maxLength={1000} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal" placeholder="What the customer receives"/></label><label className="block text-sm font-bold">Price (USD)<input name="price" required inputMode="decimal" pattern="\d+(\.\d{1,2})?" className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 font-normal" placeholder="149.00"/></label><button disabled={!connectConfigured || !canManage || !liveStatus?.readyToReceivePayments} className="min-h-11 w-full rounded-full bg-emerald-700 px-5 text-sm font-bold text-white enabled:hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300">Publish product</button></div></form>
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Your products</h2>{products?.length?<div className="mt-5 space-y-3">{products.map(product=><article key={product.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4"><div className="flex items-start justify-between gap-4"><div><h3 className="font-bold">{product.name}</h3><p className="mt-1 text-xs text-slate-500">{product.description||"No description"}</p></div><p className="shrink-0 font-bold text-emerald-700">${(product.unit_amount_cents/100).toFixed(2)}</p></div></article>)}</div>:<p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No products yet. Complete onboarding, then publish the first item.</p>}</div>
    </section>
    <aside className="mt-6 rounded-2xl bg-amber-50 p-5 text-sm leading-6 text-amber-950"><strong>Fees and responsibility:</strong> card processing is not free. For destination charges, Optimize Local Connect pays Stripe processing fees and is responsible for refunds and disputes. The configured application fee should deliberately cover those costs and any platform commission.</aside>
  </div>;
}
