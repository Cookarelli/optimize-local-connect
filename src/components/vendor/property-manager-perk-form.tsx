"use client";

import { useActionState, useState } from "react";
import { Gift, LoaderCircle } from "lucide-react";
import { updatePropertyManagerPerk, type PerkActionState } from "@/app/(platform)/vendor/perk-actions";
import { PROPERTY_MANAGER_PERK_TYPES, propertyManagerPerkSuggestions } from "@/src/domain/vendor-memberships/property-manager-perk";

const initialState: PerkActionState = { status: "idle" };
const input = "mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

type Props = { eligible: boolean; category: string | null; perk: { enabled: boolean; title: string | null; description: string | null; type: string | null; terms: string | null; expirationDate: string | null } };

export function PropertyManagerPerkForm({ eligible, category, perk }: Props) {
  const [state, action, pending] = useActionState(updatePropertyManagerPerk, initialState);
  const [enabled, setEnabled] = useState(perk.enabled);
  const [title, setTitle] = useState(perk.title ?? "");
  const [description, setDescription] = useState(perk.description ?? "");
  const [type, setType] = useState(perk.type ?? "custom");
  const [terms, setTerms] = useState(perk.terms ?? "");
  return <section className="mt-8 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
    <div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-50"><Gift className="size-5 text-amber-700" /></span><div><p className="text-xs font-black uppercase tracking-[.14em] text-amber-700">Marketplace differentiator</p><h2 className="mt-1 text-xl font-bold">Property Manager Perk</h2><p className="mt-2 text-sm leading-6 text-slate-500">Create, replace, or disable the one offer shown on your public profile.</p></div></div>
    {!eligible ? <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">An active Premium or Founding Partner membership is required to publish a perk.</div> : <form action={action} className="mt-6 grid gap-5 lg:grid-cols-[1fr_.8fr]">
      <div className="space-y-4"><label className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold"><input type="checkbox" name="propertyManagerPerkEnabled" checked={enabled} onChange={event=>setEnabled(event.target.checked)} className="mt-0.5 size-4 accent-emerald-700" />Enable public display</label><div><p className="text-xs font-bold text-slate-500">Suggested for {category ?? "your category"}</p><div className="mt-2 flex flex-wrap gap-2">{propertyManagerPerkSuggestions(category).map(item=><button type="button" key={item.title} onClick={()=>{setTitle(item.title);setType(item.type);setEnabled(true);}} className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-emerald-50">{item.title}</button>)}</div></div><label className="block text-sm font-semibold">Title<input className={input} name="propertyManagerPerkTitle" value={title} onChange={event=>setTitle(event.target.value)} maxLength={80} /></label><label className="block text-sm font-semibold">Type<select className={input} name="propertyManagerPerkType" value={type} onChange={event=>setType(event.target.value)}>{PROPERTY_MANAGER_PERK_TYPES.map(item=><option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label><label className="block text-sm font-semibold">Description<textarea className={`${input} min-h-24 py-3`} name="propertyManagerPerkDescription" value={description} onChange={event=>setDescription(event.target.value)} maxLength={280} /></label><label className="block text-sm font-semibold">Terms <span className="font-normal text-slate-400">(optional)</span><textarea className={`${input} min-h-20 py-3`} name="propertyManagerPerkTerms" value={terms} onChange={event=>setTerms(event.target.value)} maxLength={500} /></label><label className="block text-sm font-semibold">Expiration <span className="font-normal text-slate-400">(optional)</span><input className={input} type="date" name="propertyManagerPerkExpirationDate" defaultValue={perk.expirationDate ?? ""} /></label><button disabled={pending} className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50">{pending ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : null}Save perk</button>{state.message ? <p role="status" className={`rounded-xl p-3 text-sm font-semibold ${state.status === "success" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>{state.message}</p> : null}</div>
      <aside className="h-fit rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-[10px] font-black uppercase tracking-[.14em] text-amber-700">Property Manager Perk · Preview</p><h3 className="mt-3 text-xl font-bold text-amber-950">{title || "Your offer title"}</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-amber-900/75">{description || "Explain exactly what a property manager receives."}</p>{terms ? <p className="mt-4 border-t border-amber-200 pt-3 text-xs text-amber-900/65"><strong>Terms:</strong> {terms}</p> : null}</aside>
    </form>}
  </section>;
}
