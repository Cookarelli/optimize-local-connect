"use client";

import { useActionState } from "react";
import { startGuestMembershipCheckout, type GuestCheckoutState } from "@/app/founders/actions";
import { VENDOR_MEMBERSHIP_PLANS } from "@/src/domain/vendor-memberships/catalog";

const initialState: GuestCheckoutState = { status: "idle" };

export function GuestFoundingCheckoutForm() {
  const [state, action, pending] = useActionState(startGuestMembershipCheckout, initialState);
  return <form action={action} className="grid gap-3 rounded-2xl border border-white/15 bg-white/[.06] p-4 text-left sm:grid-cols-2">
    <label className="text-sm font-semibold text-white sm:col-span-2">Membership plan<select required name="plan" defaultValue="founding_partner" className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-white px-3 text-sm text-slate-950">{VENDOR_MEMBERSHIP_PLANS.map(plan=><option key={plan.key} value={plan.key}>{plan.name} · ${plan.amountCents / 100}/{plan.interval}</option>)}</select></label>
    <input required name="businessName" placeholder="Business name" className="min-h-11 rounded-xl border border-white/15 bg-white px-3 text-sm text-slate-950" />
    <input required name="contactName" placeholder="Contact name" className="min-h-11 rounded-xl border border-white/15 bg-white px-3 text-sm text-slate-950" />
    <input required name="email" type="email" autoComplete="email" placeholder="Work email" className="min-h-11 rounded-xl border border-white/15 bg-white px-3 text-sm text-slate-950" />
    <input required name="phone" type="tel" autoComplete="tel" placeholder="Phone" className="min-h-11 rounded-xl border border-white/15 bg-white px-3 text-sm text-slate-950" />
    <input required name="primaryServiceCategory" placeholder="Primary service category" className="min-h-11 rounded-xl border border-white/15 bg-white px-3 text-sm text-slate-950 sm:col-span-2" />
    <button type="submit" disabled={pending} className="min-h-11 rounded-full bg-emerald-400 px-5 text-sm font-bold text-slate-950 hover:bg-emerald-300 disabled:opacity-60 sm:col-span-2">{pending ? "Opening secure checkout…" : "Continue to secure checkout"}</button>
    {state.message ? <p role="alert" className="text-sm font-semibold text-rose-200 sm:col-span-2">{state.message}</p> : null}
  </form>;
}
