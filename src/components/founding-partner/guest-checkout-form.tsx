"use client";

import { useActionState } from "react";
import { startGuestMembershipCheckout, type GuestCheckoutState } from "@/app/founders/actions";
import type { PublicFounderCategory } from "@/src/domain/founder-categories/public";

const initialState: GuestCheckoutState = { status: "idle" };

export function GuestFoundingCheckoutForm({ categories }: { categories: PublicFounderCategory[] }) {
  const [state, action, pending] = useActionState(startGuestMembershipCheckout, initialState);
  return <form action={action} className="grid gap-3 rounded-2xl border border-white/15 bg-white/[.06] p-4 text-left sm:grid-cols-2">
    <input type="hidden" name="plan" value="founding_partner" />
    <input required name="businessName" placeholder="Business name" className="min-h-11 rounded-xl border border-white/15 bg-white px-3 text-sm text-slate-950" />
    <input required name="contactName" placeholder="Contact name" className="min-h-11 rounded-xl border border-white/15 bg-white px-3 text-sm text-slate-950" />
    <input required name="email" type="email" autoComplete="email" placeholder="Work email" className="min-h-11 rounded-xl border border-white/15 bg-white px-3 text-sm text-slate-950" />
    <input required name="phone" type="tel" autoComplete="tel" placeholder="Phone" className="min-h-11 rounded-xl border border-white/15 bg-white px-3 text-sm text-slate-950" />
    <label className="text-sm font-semibold text-white sm:col-span-2">Founder category<select required name="primaryServiceCategory" defaultValue="" className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-white px-3 text-sm text-slate-950"><option value="" disabled>Select an available category</option>{categories.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}</select></label>
    <button type="submit" disabled={pending} className="min-h-11 rounded-full bg-emerald-400 px-5 text-sm font-bold text-slate-950 hover:bg-emerald-300 disabled:opacity-60 sm:col-span-2">{pending ? "Opening secure checkout…" : "Continue to secure checkout"}</button>
    {state.message ? <p role="alert" className="text-sm font-semibold text-rose-200 sm:col-span-2">{state.message}</p> : null}
  </form>;
}
