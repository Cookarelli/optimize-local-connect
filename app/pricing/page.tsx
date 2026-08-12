import type { Metadata } from "next";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Logo } from "@/src/components/brand/logo";
import { FoundingMemberAvailability } from "@/src/components/founding-partner/founding-member-availability";
import {
  formatVendorPlanPrice,
  VENDOR_MEMBERSHIP_PLANS,
} from "@/src/domain/vendor-memberships/catalog";

export const metadata: Metadata = {
  title: "Local Business Membership Pricing",
  description: "Business memberships for reviewed visibility and participation in the Optimize Local Connect network.",
};

export default function PricingPage() {
  return <main className="min-h-dvh bg-[#f7f8f4] text-slate-950">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex min-h-18 max-w-[90rem] items-center justify-between px-5 sm:px-8 lg:px-12"><Logo /><Link href="/sign-in" className="text-sm font-bold">Business Login</Link></div></header>
    <section className="bg-slate-950 px-5 py-16 text-center text-white sm:py-24"><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-400">The intelligent local business network</p><h1 className="mx-auto mt-4 max-w-4xl text-4xl font-semibold tracking-[-.05em] sm:text-6xl">Choose the network presence that fits your business.</h1><p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-300">Public profiles require an active membership and profile approval. Membership provides network access, recognition, and governed visibility—not guaranteed leads, revenue, project volume, or best-match status.</p></section>
    <section className="mx-auto grid max-w-[90rem] gap-5 px-5 py-12 sm:px-8 lg:grid-cols-3 lg:px-12 lg:py-20">{VENDOR_MEMBERSHIP_PLANS.filter((plan) => plan.publiclyPurchasable).map((plan) => {
      const founding = plan.key === "founding_partner";
      return <article key={plan.key} className={`flex flex-col rounded-[1.75rem] border p-7 ${founding ? "border-emerald-400 bg-emerald-50 shadow-xl shadow-emerald-950/5 lg:-translate-y-2" : "border-slate-200 bg-white"}`}>
        {founding ? <FoundingMemberAvailability ctaHref="/memberships" /> : <><div className="flex items-center justify-between"><span className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Sparkles className="size-5" /></span></div><h2 className="mt-7 text-2xl font-bold">{plan.name}</h2><p className="mt-4 text-4xl font-semibold">{formatVendorPlanPrice(plan)}</p><p className="mt-5 min-h-18 text-sm leading-6 opacity-75">{plan.description}</p><p className="mb-5 text-xs font-semibold opacity-75">Renews automatically each {plan.interval} unless canceled.</p><ul className="mt-6 space-y-3 border-t border-current/10 pt-5">{plan.features.map((feature) => <li key={feature} className="flex gap-2 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />{feature}</li>)}</ul><Link href={`/memberships?plan=${plan.key}#checkout`} className="mt-auto inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-black text-white hover:bg-emerald-700">{plan.key === "preferred" ? "Join Preferred" : "Join Network"}</Link></>}
      </article>;
    })}</section>
  </main>;
}
