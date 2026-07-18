"use client";

import { useActionState } from "react";
import { ArrowRight, LoaderCircle, ShieldCheck } from "lucide-react";
import { createVendorOrganizationAndCheckout, type VendorEnrollmentState } from "@/app/(platform)/onboarding/actions";
import { FOUNDING_PARTNER_PLAN, formatVendorPlanPrice, type VendorPlanKey } from "@/src/domain/vendor-memberships/catalog";

const initialState: VendorEnrollmentState = { status: "idle" };

export function VendorOrganizationSignupForm({ plan, defaults }: {
  plan: VendorPlanKey;
  defaults: { businessName?: string; legalName?: string; contactName?: string; phone?: string; website?: string };
}) {
  const [state, action, pending] = useActionState(createVendorOrganizationAndCheckout, initialState);
  const field = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
  const error = (name: string) => state.fieldErrors?.[name];
  return <form action={action} className="mt-8 grid gap-5 sm:grid-cols-2">
    <input type="hidden" name="plan" value={plan} />
    <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-semibold">Public business name</span><input name="businessName" required minLength={2} maxLength={160} defaultValue={defaults.businessName} className={field} aria-invalid={Boolean(error("businessName"))} />{error("businessName")?<span className="mt-1 block text-xs text-rose-700">{error("businessName")}</span>:null}</label>
    <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-semibold">Legal business name <span className="font-normal text-slate-400">(optional)</span></span><input name="legalName" maxLength={160} defaultValue={defaults.legalName} className={field} /></label>
    <label><span className="mb-1.5 block text-sm font-semibold">Primary contact</span><input name="contactName" required minLength={2} maxLength={120} autoComplete="name" defaultValue={defaults.contactName} className={field} aria-invalid={Boolean(error("contactName"))} />{error("contactName")?<span className="mt-1 block text-xs text-rose-700">{error("contactName")}</span>:null}</label>
    <label><span className="mb-1.5 block text-sm font-semibold">Business phone</span><input name="phone" required type="tel" autoComplete="tel" defaultValue={defaults.phone} className={field} aria-invalid={Boolean(error("phone"))} />{error("phone")?<span className="mt-1 block text-xs text-rose-700">{error("phone")}</span>:null}</label>
    <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-semibold">Website <span className="font-normal text-slate-400">(optional)</span></span><input name="website" type="url" inputMode="url" placeholder="https://example.com" defaultValue={defaults.website} className={field} aria-invalid={Boolean(error("website"))} />{error("website")?<span className="mt-1 block text-xs text-rose-700">{error("website")}</span>:null}</label>
    {state.message?<p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800 sm:col-span-2">{state.message}</p>:null}
    <div className="rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600 sm:col-span-2"><ShieldCheck className="mb-2 size-5 text-emerald-700" />Your organization remains unpublished and payment-pending until Stripe confirms the subscription. Repeating this form resumes the same pending enrollment.</div>
    <button disabled={pending} className="inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-black text-white disabled:opacity-60 sm:col-span-2">{pending?<LoaderCircle className="mr-2 size-4 animate-spin"/>:null}{pending?"Preparing secure Checkout…":plan===FOUNDING_PARTNER_PLAN.key?`Continue to Stripe · ${formatVendorPlanPrice(FOUNDING_PARTNER_PLAN)}`:"Continue to Stripe"}<ArrowRight className="ml-2 size-4"/></button>
  </form>;
}
