import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { Logo } from "@/src/components/brand/logo";
import { resolveFoundingPartnerOnboardingAccess } from "@/src/lib/founding-partner/onboarding-access";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Founding Partner application received", robots: { index: false, follow: false } };

const statusCopy: Record<string, { title: string; description: string }> = {
  submitted: { title: "Your profile is under review.", description: "Your application and verified payment are visible to the Optimize Local Connect review team. We will contact you if anything else is needed." },
  under_review: { title: "Your profile is under review.", description: "Our team is reviewing the marketplace information and business verification details you submitted." },
  approved: { title: "Your application is approved.", description: "Your profile has been approved and is being prepared for marketplace activation." },
  active: { title: "Your Founding Partner profile is active.", description: "Your approved marketplace profile is active. Thank you for helping build Optimize Local Connect." },
  changes_requested: { title: "Updates are needed.", description: "The review team requested changes before the application can be approved." },
  rejected: { title: "The application was not approved.", description: "The review team was unable to approve this application. Contact us if you believe additional information should be considered." },
  suspended: { title: "This profile is suspended.", description: "The marketplace profile is currently suspended pending administrative review." },
};

export default async function FoundingPartnerConfirmationPage() {
  const access = await resolveFoundingPartnerOnboardingAccess();
  if (!access) redirect("/founders?onboarding=access_required");
  if (access.status === "paid_onboarding_incomplete") redirect("/founders/onboarding");
  const admin = createSupabaseAdminClient();
  const { data: onboarding } = await admin.from("founding_partner_onboardings").select("status,business_name,customer_email,submitted_at,review_notes").eq("id", access.onboardingId).maybeSingle();
  if (!onboarding) redirect("/founders?onboarding=access_required");
  const copy = statusCopy[onboarding.status] ?? statusCopy.submitted;
  const needsChanges = onboarding.status === "changes_requested";

  return <main className="grid min-h-dvh place-items-center bg-[#f7f8f4] px-5 py-12 text-slate-950"><div className="w-full max-w-2xl"><div className="mb-8 flex justify-center"><Link href="/"><Logo /></Link></div><section className="rounded-[2rem] border border-slate-200 bg-white p-7 text-center shadow-xl shadow-slate-950/5 sm:p-12">{needsChanges ? <Clock3 aria-hidden="true" className="mx-auto size-14 text-amber-600" /> : <CheckCircle2 aria-hidden="true" className="mx-auto size-14 text-emerald-600" />}<p className="mt-7 text-xs font-black uppercase tracking-[.18em] text-emerald-700">Founding Partner application</p><h1 className="mt-3 text-3xl font-semibold tracking-[-.04em] sm:text-5xl">{copy.title}</h1><p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-slate-600">{copy.description}</p>{onboarding.review_notes ? <p className="mx-auto mt-5 max-w-xl rounded-xl bg-amber-50 p-4 text-left text-sm text-amber-900"><strong className="block">Review note</strong><span className="mt-1 block">{onboarding.review_notes}</span></p> : null}<div className="mt-8 rounded-2xl bg-slate-50 p-5 text-sm"><p className="font-bold">{onboarding.business_name ?? "Founding Partner application"}</p><p className="mt-1 text-slate-500">{onboarding.customer_email}</p>{onboarding.submitted_at ? <p className="mt-2 text-xs text-slate-400">Submitted {new Date(onboarding.submitted_at).toLocaleString("en-US")}</p> : null}</div><div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">{needsChanges ? <Link href="/founders/onboarding" className="inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-black text-white hover:bg-emerald-700">Update application</Link> : null}<Link href="/founders" className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-200 px-6 text-sm font-bold text-slate-700 hover:bg-slate-50">Return to Founding Partner page</Link></div><p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-slate-400"><ShieldCheck aria-hidden="true" className="size-3.5" />Your payment and submission remain linked in the admin review record.</p></section></div></main>;
}
