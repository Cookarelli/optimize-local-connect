import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FOUNDING_MEMBER_OFFER, FOUNDING_PARTNER_PLAN, formatVendorPlanPrice } from "@/src/domain/vendor-memberships/catalog";

type FoundingMemberAvailabilityProps = {
  tone?: "light" | "dark";
  ctaHref?: string;
  className?: string;
};

export function FoundingMemberAvailability({ tone = "light", ctaHref, className = "" }: FoundingMemberAvailabilityProps) {
  const claimedPercent = Math.round((FOUNDING_MEMBER_OFFER.claimed / FOUNDING_MEMBER_OFFER.capacity) * 100);
  const dark = tone === "dark";
  const surface = dark ? "border-white/15 bg-white/[.06] text-white" : "border-emerald-200 bg-white text-slate-950";
  const muted = dark ? "text-slate-300" : "text-slate-600";
  const track = dark ? "bg-white/15" : "bg-emerald-100";

  return <section className={`rounded-[1.5rem] border p-5 shadow-sm sm:p-6 ${surface} ${className}`} aria-labelledby="founding-member-availability-title">
    <p id="founding-member-availability-title" className={`text-xs font-black uppercase tracking-[.16em] ${dark ? "text-emerald-300" : "text-emerald-700"}`}>{FOUNDING_MEMBER_OFFER.name}</p>
    <div className="mt-3 flex items-end justify-between gap-4"><div><p className="text-4xl font-semibold tracking-[-.05em]">{formatVendorPlanPrice(FOUNDING_PARTNER_PLAN)}</p><p className={`mt-1 text-sm font-semibold ${dark ? "text-emerald-300" : "text-emerald-700"}`}>{FOUNDING_MEMBER_OFFER.monthlyComparison}</p><p className={`mt-2 max-w-sm text-sm leading-6 ${muted}`}>A full year of local visibility and access within the Optimize Local Connect network.</p></div><p className={`shrink-0 text-right text-xs font-semibold ${muted}`}>Limited to<br />{FOUNDING_MEMBER_OFFER.capacity} members</p></div>
    <div className="mt-6" aria-label={`${FOUNDING_MEMBER_OFFER.claimed} of ${FOUNDING_MEMBER_OFFER.capacity} Founding Spots Claimed; ${FOUNDING_MEMBER_OFFER.remaining} Spots Remaining`}>
      <div className={`h-2 overflow-hidden rounded-full ${track}`} role="progressbar" aria-valuemin={0} aria-valuemax={FOUNDING_MEMBER_OFFER.capacity} aria-valuenow={FOUNDING_MEMBER_OFFER.claimed} aria-valuetext={`${FOUNDING_MEMBER_OFFER.claimed} of ${FOUNDING_MEMBER_OFFER.capacity} Founding Spots Claimed`}><div className="h-full rounded-full bg-emerald-400" style={{ width: `${claimedPercent}%` }} /></div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-5 gap-y-1"><p className={`text-sm font-semibold ${muted}`}>{FOUNDING_MEMBER_OFFER.claimed} of {FOUNDING_MEMBER_OFFER.capacity} Founding Spots Claimed</p><p className={`text-lg font-black ${dark ? "text-emerald-300" : "text-emerald-800"}`}>{FOUNDING_MEMBER_OFFER.remaining} Spots Remaining</p></div>
    </div>
    {ctaHref ? <Link href={ctaHref} className={`mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-full px-5 text-sm font-black transition ${dark ? "bg-white text-emerald-800 hover:bg-emerald-50" : "bg-slate-950 text-white hover:bg-emerald-700"}`}>{FOUNDING_MEMBER_OFFER.cta}<ArrowRight aria-hidden="true" className="ml-2 size-4" /></Link> : null}
  </section>;
}
