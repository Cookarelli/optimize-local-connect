import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock3 } from "lucide-react";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

export const metadata: Metadata = { title: "Payment status" };

export default async function MarketplacePaymentSuccess({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id: rawSessionId } = await searchParams;
  const sessionId = z.string().startsWith("cs_").max(255).safeParse(rawSessionId);
  const admin = createSupabaseAdminClient();
  const { data: order } = sessionId.success ? await admin.from("marketplace_orders")
    .select("status,amount_cents,currency,customer_email,marketplace_products(name),organizations!marketplace_orders_seller_organization_id_fkey(name)")
    .eq("stripe_checkout_session_id", sessionId.data)
    .maybeSingle() : { data: null };
  const paid = order?.status === "paid";
  return <main className="grid min-h-dvh place-items-center bg-slate-50 p-5"><section className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10">{paid?<CheckCircle2 className="mx-auto size-12 text-emerald-600"/>:<Clock3 className="mx-auto size-12 text-amber-600"/>}<h1 className="mt-5 text-3xl font-semibold tracking-tight">{paid?"Payment confirmed":"Payment is processing"}</h1><p className="mt-3 text-sm leading-6 text-slate-600">{paid?`Stripe verified your payment. A receipt is being sent to ${order.customer_email}.`:"The redirect is not proof of payment. This page will show confirmed only after the signed Stripe webhook records the charge."}</p>{order?<p className="mt-5 rounded-xl bg-slate-50 p-4 font-bold">{(order.marketplace_products as unknown as {name:string}|null)?.name} · ${(order.amount_cents/100).toFixed(2)} {order.currency}</p>:<p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">No matching order is available. Check the link or contact support.</p>}<div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center"><Link href="/storefront" className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-bold text-white">Back to storefront</Link>{!paid&&order?<a href="" className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 px-5 text-sm font-bold">Refresh status</a>:null}</div></section></main>;
}

