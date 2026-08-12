import { ArrowRight } from "lucide-react";
import { FOUNDING_MEMBER_OFFER, FOUNDING_PARTNER_PLAN, formatVendorPlanPrice } from "@/src/domain/vendor-memberships/catalog";

type FoundingMemberAvailabilityProps = {
  tone?: "light" | "dark";
  ctaHref?: string;
  className?: string;
};

export function FoundingMemberAvailability({ tone = "light", ctaHref, className = "" }: FoundingMemberAvailabilityProps) {
  const dark = tone === "dark";
  const surface = dark ? "border-white/15 bg-white/[.06] text-white" : "border-emerald-200 bg-white text-slate-950";
  const muted = dark ? "text-slate-300" : "text-slate-600";

  return <section className={`rounded-[1.5rem] border p-5 shadow-sm sm:p-6 ${surface} ${className}`} aria-labelledby="founding-member-availability-title">
    <p id="founding-member-availability-title" className={`text-xs font-black uppercase tracking-[.16em] ${dark ? "text-emerald-300" : "text-emerald-700"}`}>{FOUNDING_MEMBER_OFFER.name}</p>
    <div className="mt-3 flex items-end justify-between gap-4"><div><p className="text-4xl font-semibold tracking-[-.05em]">{formatVendorPlanPrice(FOUNDING_PARTNER_PLAN)}</p><p className={`mt-1 text-sm font-semibold ${dark ? "text-emerald-300" : "text-emerald-700"}`}>{FOUNDING_MEMBER_OFFER.monthlyComparison}</p><p className={`mt-2 max-w-sm text-sm leading-6 ${muted}`}>Original-network recognition, reviewed visibility, and a full year of Connect participation.</p></div><p className={`shrink-0 text-right text-xs font-semibold ${muted}`}>{FOUNDING_MEMBER_OFFER.capacity} original<br />positions</p></div>
    <p className={`mt-5 rounded-xl border px-4 py-3 text-xs font-semibold leading-5 ${dark ? "border-white/10 bg-white/[.04] text-slate-300" : "border-emerald-100 bg-emerald-50 text-emerald-900"}`}>Founder category eligibility is confirmed during onboarding. Founder positions are limited to one eligible business per selected category. Payment does not by itself guarantee category eligibility or exclusivity.</p>
    {ctaHref ? <a href={ctaHref} className={`mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-full px-5 text-sm font-black transition ${dark ? "bg-white text-emerald-800 hover:bg-emerald-50" : "bg-slate-950 text-white hover:bg-emerald-700"}`}>{FOUNDING_MEMBER_OFFER.cta}<ArrowRight aria-hidden="true" className="ml-2 size-4" /></a> : null}
  </section>;
}
