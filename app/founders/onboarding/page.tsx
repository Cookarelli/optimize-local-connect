import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Circle, LockKeyhole, Save, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { Logo } from "@/src/components/brand/logo";
import { FoundingPartnerOnboardingForm } from "@/src/components/founding-partner/onboarding-form";
import { resolveFoundingPartnerOnboardingAccess } from "@/src/lib/founding-partner/onboarding-access";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Complete your Founding Partner profile", robots: { index: false, follow: false } };

export default async function FoundingPartnerOnboardingPage() {
  const access = await resolveFoundingPartnerOnboardingAccess();
  if (!access) redirect("/founders?onboarding=access_required");
  if (!["paid_onboarding_incomplete", "changes_requested"].includes(access.status)) redirect("/founders/onboarding/confirmation");

  const admin = createSupabaseAdminClient();
  const [{ data: payment }, { data: onboarding }] = await Promise.all([
    admin.from("founding_partner_payments").select("customer_email,customer_name,payment_status,amount_paid_cents,currency").eq("id", access.paymentId).eq("payment_status", "paid").maybeSingle(),
    admin.from("founding_partner_onboardings").select("*").eq("id", access.onboardingId).eq("payment_id", access.paymentId).maybeSingle(),
  ]);
  if (!payment || !onboarding) redirect("/founders?onboarding=payment_not_verified");

  return <main className="min-h-dvh bg-[#f7f8f4] text-slate-950">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex min-h-18 max-w-[90rem] items-center justify-between px-5 py-3 sm:px-8 lg:px-12"><Link href="/"><Logo /></Link><span className="inline-flex items-center gap-2 text-xs font-bold text-slate-500"><LockKeyhole aria-hidden="true" className="size-3.5" />Secure paid application</span></div></header>
    <div className="mx-auto grid max-w-[90rem] gap-8 px-5 py-8 sm:px-8 sm:py-12 lg:grid-cols-[18rem_minmax(0,1fr)] lg:px-12">
      <aside className="h-fit space-y-5 lg:sticky lg:top-6">
        <section className="rounded-[1.5rem] bg-slate-950 p-6 text-white"><ShieldCheck aria-hidden="true" className="size-7 text-emerald-400" /><p className="mt-7 text-xs font-black uppercase tracking-[.16em] text-emerald-400">Payment confirmed</p><p className="mt-3 text-3xl font-semibold tracking-[-.05em]">$299.00</p><p className="mt-1 text-xs text-slate-400">One-time Founding Partner payment</p><div className="mt-6 border-t border-white/10 pt-5"><p className="text-sm font-bold">{payment.customer_name ?? "Founding Partner"}</p><p className="mt-1 break-all text-xs text-slate-400">{payment.customer_email}</p></div></section>
        <section aria-label="Application progress" className="rounded-[1.5rem] border border-slate-200 bg-white p-5"><p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">Application progress</p><ol className="mt-5 space-y-4 text-sm"><li className="flex gap-3"><CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-600" /><span><strong className="block">Payment verified</strong><span className="text-xs text-slate-500">Completed</span></span></li><li className="flex gap-3"><Save aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-600" /><span><strong className="block">Business profile</strong><span className="text-xs text-slate-500">Save as you work</span></span></li><li className="flex gap-3"><Circle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-300" /><span><strong className="block">Admin review</strong><span className="text-xs text-slate-500">Begins after submission</span></span></li></ol></section>
      </aside>
      <section className="min-w-0">
        <div className="mb-7"><p className="section-kicker">Founding Partner onboarding</p><h1 className="mt-3 text-3xl font-semibold tracking-[-.04em] sm:text-5xl">Build your marketplace profile.</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">Complete each section, save a draft at any time, then submit the application for review. Fields marked required are required only for final submission.</p>{access.status === "changes_requested" ? <p role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Changes were requested for this application. Update the profile and submit it again when ready.{onboarding.review_notes ? <span className="mt-2 block font-normal">Admin note: {onboarding.review_notes}</span> : null}</p> : null}</div>
        <FoundingPartnerOnboardingForm application={onboarding} customerEmail={payment.customer_email} customerName={payment.customer_name} />
      </section>
    </div>
  </main>;
}
