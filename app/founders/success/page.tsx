import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, LockKeyhole, XCircle } from "lucide-react";
import { z } from "zod";
import { Logo } from "@/src/components/brand/logo";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Founding Partner payment status", robots: { index: false, follow: false } };

const sessionSchema = z.string().regex(/^cs_(test_|live_)?[A-Za-z0-9]+$/);

export default async function FoundingPartnerSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id: sessionIdValue } = await searchParams;
  const sessionId = sessionSchema.safeParse(sessionIdValue);
  let payment: { id: string; payment_status: string; amount_paid_cents: number; currency: string; customer_email: string } | null = null;
  let onboarding: { status: string } | null = null;

  if (sessionId.success) {
    const admin = createSupabaseAdminClient();
    const { data } = await admin.from("founding_partner_payments")
      .select("id,payment_status,amount_paid_cents,currency,customer_email")
      .eq("checkout_session_id", sessionId.data)
      .maybeSingle();
    payment = data;
    if (payment) {
      const { data: onboardingData } = await admin.from("founding_partner_onboardings").select("status").eq("payment_id", payment.id).maybeSingle();
      onboarding = onboardingData;
    }
  }

  const paid = payment?.payment_status === "paid" && payment.amount_paid_cents === 29900 && payment.currency === "USD" && Boolean(onboarding);
  const invalid = !sessionId.success;
  return <main className="grid min-h-dvh place-items-center bg-[#f7f8f4] px-5 py-12 text-slate-950">
    <div className="w-full max-w-2xl">
      <div className="mb-8 flex justify-center"><Link href="/"><Logo /></Link></div>
      <section className="rounded-[2rem] border border-slate-200 bg-white p-7 text-center shadow-xl shadow-slate-950/5 sm:p-12">
        {paid ? <CheckCircle2 aria-hidden="true" className="mx-auto size-14 text-emerald-600" /> : invalid ? <XCircle aria-hidden="true" className="mx-auto size-14 text-rose-600" /> : <Clock3 aria-hidden="true" className="mx-auto size-14 text-amber-600" />}
        <p className="mt-7 text-xs font-black uppercase tracking-[.18em] text-emerald-700">Optimize Local Connect Founding Partner</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-.04em] sm:text-5xl">{paid ? "Payment confirmed." : invalid ? "We could not identify that checkout." : "Payment verification is in progress."}</h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-slate-600">{paid
          ? "Stripe confirmed your one-time $299 payment directly to our server. Your pending Founding Partner record is ready for the next step."
          : invalid
            ? "Return to the Founding Partner page to begin a new secure checkout. No payment status was inferred from this page address."
            : "Stripe may still be delivering the verified payment notification. Refresh this page in a moment. Your membership is not marked paid until our server processes that notification."}</p>
        {paid && sessionId.success ? <div className="mt-9"><Link href={`/founders/onboarding/access?session_id=${encodeURIComponent(sessionId.data)}`} className="inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-black text-white hover:bg-emerald-700">Complete your business profile <ArrowRight aria-hidden="true" className="ml-2 size-4" /></Link><p className="mt-4 text-xs text-slate-500">Receipt email: {payment?.customer_email}</p></div> : <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"><Link href={invalid ? "/founders" : sessionId.success ? `/founders/success?session_id=${encodeURIComponent(sessionId.data)}` : "/founders"} className="inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-black text-white hover:bg-emerald-700">{invalid ? "Return to Founding Partner offer" : "Refresh payment status"}</Link></div>}
        <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-slate-400"><LockKeyhole aria-hidden="true" className="size-3.5" />This page reads the verified database record. The URL is never treated as proof of payment.</p>
      </section>
    </div>
  </main>;
}
