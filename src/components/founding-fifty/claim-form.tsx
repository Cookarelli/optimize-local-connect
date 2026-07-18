"use client";

import { useActionState } from "react";
import { AlertCircle, ArrowRight, ImageUp, LockKeyhole } from "lucide-react";
import { createFoundingClaim, type ClaimState } from "@/app/founding-fifty/claim/[seatId]/actions";

const initialState: ClaimState = { status: "idle" };
const input = "mt-1.5 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

export function FoundingClaimForm({ seatId, industry, email, contactName }: { seatId: string; industry: string; email: string; contactName: string }) {
  const [state, action, pending] = useActionState(createFoundingClaim, initialState);
  return <form action={action} encType="multipart/form-data" className="grid gap-5 sm:grid-cols-2">
    <input type="hidden" name="seatId" value={seatId} />
    <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Business name<input className={input} name="businessName" required minLength={2} maxLength={160} autoComplete="organization" /></label>
    <label className="text-sm font-semibold text-slate-700">Owner or contact name<input className={input} name="contactName" required defaultValue={contactName} autoComplete="name" /></label>
    <label className="text-sm font-semibold text-slate-700">Email<input className={input} name="email" type="email" required defaultValue={email} autoComplete="email" /></label>
    <label className="text-sm font-semibold text-slate-700">Phone<input className={input} name="phone" type="tel" required autoComplete="tel" /></label>
    <label className="text-sm font-semibold text-slate-700">Website <span className="font-normal text-slate-400">(optional)</span><input className={input} name="website" type="url" placeholder="https://" autoComplete="url" /></label>
    <label className="text-sm font-semibold text-slate-700">Industry<input className={input} name="industry" required readOnly value={industry} /></label>
    <label className="text-sm font-semibold text-slate-700">City<input className={input} name="city" required autoComplete="address-level2" /></label>
    <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Short business description<textarea className={`${input} min-h-32 py-3`} name="description" required minLength={20} maxLength={1200} placeholder="Tell the community what your business does and who you serve." /></label>
    <label className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-slate-700 sm:col-span-2"><span className="flex items-center gap-2"><ImageUp className="size-4 text-emerald-700" />Business logo <span className="font-normal text-slate-400">(optional)</span></span><input className="mt-3 block w-full text-sm font-normal file:mr-3 file:rounded-full file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:font-bold file:text-white" name="logo" type="file" accept="image/jpeg,image/png,image/webp" /><span className="mt-2 block text-xs font-normal text-slate-400">JPG, PNG, or WebP up to 5 MB.</span></label>
    <label className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600 sm:col-span-2"><input type="checkbox" name="terms" value="accepted" required className="mt-1 size-4 shrink-0 accent-emerald-700" /><span>I agree to the Founding Fifty terms, understand the $299 payment is required, and acknowledge that the seat is not permanently assigned until payment is verified.</span></label>
    {state.status === "error" ? <div role="alert" className="flex gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 sm:col-span-2"><AlertCircle className="mt-0.5 size-4 shrink-0" />{state.message}</div> : null}
    <div className="sm:col-span-2"><button type="submit" disabled={pending} className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60 sm:w-auto">{pending ? "Holding your seat…" : "Continue to secure checkout"}<ArrowRight className="ml-2 size-4" /></button><p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><LockKeyhole className="size-3.5" />Payment is processed by Stripe and verified server-side. A browser success message never claims a seat.</p></div>
  </form>;
}
