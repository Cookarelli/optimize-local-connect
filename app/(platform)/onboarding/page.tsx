import Link from "next/link";
import { Building2, Clock3, LockKeyhole } from "lucide-react";
import { redirect } from "next/navigation";
import { Logo } from "@/src/components/brand/logo";
import { VendorOrganizationSignupForm } from "@/src/components/vendor/vendor-organization-signup-form";
import { getVendorPlan, normalizeVendorPlanKey } from "@/src/domain/vendor-memberships/catalog";
import { getRoleHome } from "@/src/lib/auth/routing";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const user = await requireUser();
  const requestedPlan = (await searchParams).plan;
  const plan = getVendorPlan(normalizeVendorPlanKey(requestedPlan ?? "") ?? "");
  if (!plan) {
    if (user.isSuperAdmin || user.memberships.length) redirect(getRoleHome(user));
    return <section className="mx-auto max-w-2xl py-20 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-100"><Clock3 className="size-6 text-amber-800" /></span><h1 className="mt-6 text-3xl font-semibold tracking-tight">Choose how you are joining Connect.</h1><p className="mt-3 text-slate-600">Select a vendor membership to create a new service-business workspace, or ask an existing organization owner for an invitation.</p><Link href="/pricing" className="mt-7 inline-flex min-h-11 items-center rounded-full bg-slate-950 px-5 text-sm font-bold text-white">View vendor memberships</Link></section>;
  }

  const admin = createSupabaseAdminClient();
  const [{ data: enrollment }, { data: profile }] = await Promise.all([
    admin.from("vendor_enrollments").select("vendor_organization_id,contact_name,contact_phone,website_url,intended_plan_key,status")
      .eq("owner_user_id", user.id).eq("intended_plan_key", plan.key).in("status", ["payment_pending", "checkout_created"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("profiles").select("full_name,phone").eq("id", user.id).maybeSingle(),
  ]);
  let organization: { name: string; legal_name: string | null; website_url: string | null; phone: string | null } | null = null;
  if (enrollment) {
    const result = await admin.from("organizations").select("name,legal_name,website_url,phone")
      .eq("id", enrollment.vendor_organization_id).eq("status", "onboarding").maybeSingle();
    organization = result.data;
  }

  return <main className="min-h-dvh bg-[#f7f8f4] px-5 py-10 text-slate-950 sm:py-16">
    <div className="mx-auto max-w-3xl"><div className="mb-8 flex items-center justify-between"><Logo/><span className="inline-flex items-center gap-2 text-xs font-bold text-slate-500"><LockKeyhole className="size-4"/>Private enrollment</span></div>
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <span className="grid size-12 place-items-center rounded-2xl bg-emerald-50"><Building2 className="size-6 text-emerald-700"/></span>
        <p className="mt-7 text-xs font-black uppercase tracking-[.16em] text-emerald-700">{enrollment ? "Resume vendor enrollment" : "Create your vendor workspace"}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-.04em] sm:text-5xl">Business details before billing.</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">We create an unpublished organization and pending {plan.name} membership first. Stripe Checkout opens only after those records are saved successfully.</p>
        <div className="mt-6 rounded-2xl bg-slate-950 p-5 text-white"><p className="text-xs font-black uppercase tracking-wider text-emerald-400">Selected membership</p><div className="mt-2 flex items-end justify-between gap-4"><p className="text-xl font-bold">{plan.name}</p><p className="text-lg font-bold">${plan.amountCents/100}/{plan.interval}</p></div></div>
        <VendorOrganizationSignupForm plan={plan.key} defaults={{ businessName: organization?.name, legalName: organization?.legal_name ?? "", contactName: enrollment?.contact_name ?? profile?.full_name ?? "", phone: enrollment?.contact_phone ?? organization?.phone ?? profile?.phone ?? "", website: enrollment?.website_url ?? organization?.website_url ?? "" }} />
      </section>
    </div>
  </main>;
}
