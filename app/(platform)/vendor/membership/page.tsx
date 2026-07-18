import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Award, BadgeCheck, Check, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { VENDOR_MEMBERSHIP_PLANS } from "@/src/domain/vendor-memberships/catalog";
import { getRoleHome } from "@/src/lib/auth/routing";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const metadata: Metadata = { title: "Vendor Memberships" };

export default async function VendorMembershipPage() {
  const user = await requireUser();
  const membership = user.memberships[0];
  if (!membership || membership.organizationType !== "vendor" || !["owner","admin","vendor"].includes(membership.role)) redirect(getRoleHome(user));
  const supabase = await createSupabaseServerClient();
  const [{ data: current }, { data: verificationRows }, { data: founding }] = await Promise.all([
    supabase.from("vendor_memberships").select("status,current_period_ends_at,locked_renewal_price_cents,vendor_membership_levels(code,name)").eq("vendor_organization_id",membership.organizationId).in("status",["trialing","active","past_due","paused"]).order("starts_at",{ascending:false}).limit(1).maybeSingle(),
    supabase.from("vendor_verifications").select("verification_type,status,expires_on").eq("vendor_organization_id",membership.organizationId).in("verification_type",["trade_license","insurance"]),
    supabase.from("founding_programs").select("total_seats,founding_seats(count)").eq("slug","founding-fifty").eq("founding_seats.status","claimed").maybeSingle(),
  ]);
  const level = current?.vendor_membership_levels as unknown as { code: string; name: string } | null;
  const currentCode = level?.code ?? "free";
  const credential = (type: string) => verificationRows?.some(row => row.verification_type===type && row.status==="verified" && (!row.expires_on || row.expires_on>=new Date().toISOString().slice(0,10))) ?? false;
  const claimed = (founding?.founding_seats as unknown as { count: number }[] | null)?.[0]?.count ?? 0;
  const available = Math.max(0,(founding?.total_seats ?? 50)-claimed);

  return <div><Link href="/vendor" className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-slate-900"><ArrowLeft className="mr-2 size-4" />Vendor overview</Link>
    <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">Marketplace growth</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.045em] sm:text-5xl">Choose how your business grows.</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">Membership improves marketplace tools and placement. Optimize Score and customer reviews remain performance-based.</p></div><div className="rounded-2xl bg-slate-950 px-5 py-4 text-white"><p className="text-[10px] font-black uppercase tracking-[.14em] text-emerald-400">Current membership</p><p className="mt-1 text-xl font-bold">{level?.name ?? "Free"}</p>{current?.current_period_ends_at?<p className="mt-1 text-xs text-slate-400">Current period through {new Date(current.current_period_ends_at).toLocaleDateString("en-US")}</p>:null}</div></div>

    <section className="mt-8 grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-3"><div className="flex gap-3"><ShieldCheck className={`size-5 ${credential("trade_license")?"text-emerald-600":"text-slate-300"}`}/><div><p className="text-sm font-bold">License</p><p className="mt-1 text-xs text-slate-500">{credential("trade_license")?"Verified and current":"Verification required"}</p></div></div><div className="flex gap-3"><ShieldCheck className={`size-5 ${credential("insurance")?"text-emerald-600":"text-slate-300"}`}/><div><p className="text-sm font-bold">Insurance</p><p className="mt-1 text-xs text-slate-500">{credential("insurance")?"Verified and current":"Verification required"}</p></div></div><div className="flex gap-3"><Award className="size-5 text-amber-600"/><div><p className="text-sm font-bold">Founding Partner</p><p className="mt-1 text-xs text-slate-500">{available} of 50 seats remain</p></div></div></section>

    <section className="mt-8 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">{VENDOR_MEMBERSHIP_PLANS.map(plan=>{const active=currentCode===plan.code;return <article key={plan.code} className={`relative flex flex-col rounded-[1.6rem] border p-6 ${plan.featured?"border-emerald-400 bg-slate-950 text-white shadow-xl":"border-slate-200 bg-white"}`}>
      {plan.featured?<span className="absolute right-5 top-5 rounded-full bg-emerald-400 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-950">Growth plan</span>:null}<div className={`grid size-10 place-items-center rounded-xl ${plan.featured?"bg-white/10 text-emerald-400":"bg-emerald-50 text-emerald-700"}`}>{plan.code==="founding_partner"?<Award className="size-5"/>:plan.code==="verified"?<BadgeCheck className="size-5"/>:plan.code==="premium"?<Sparkles className="size-5"/>:<Check className="size-5"/>}</div><h2 className="mt-7 text-xl font-bold">{plan.name}</h2><p className="mt-4 text-4xl font-semibold tracking-tight">{plan.price}</p><p className={`mt-1 text-xs ${plan.featured?"text-slate-400":"text-slate-500"}`}>{plan.cadence}</p><p className={`mt-5 min-h-18 text-sm leading-6 ${plan.featured?"text-slate-300":"text-slate-600"}`}>{plan.description}</p><ul className={`mt-6 space-y-3 border-t pt-5 ${plan.featured?"border-white/10":"border-slate-100"}`}>{plan.features.map(feature=><li key={feature} className="flex gap-2 text-xs leading-5"><Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500"/>{feature}</li>)}</ul>
      <div className="mt-auto pt-7">{active?<span className={`inline-flex min-h-11 w-full items-center justify-center rounded-full text-xs font-black ${plan.featured?"bg-white/10 text-emerald-300":"bg-emerald-50 text-emerald-800"}`}><LockKeyhole className="mr-2 size-3.5"/>Current plan</span>:plan.code==="founding_partner"?<Link href="/founders" className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-amber-300 px-4 text-xs font-black text-amber-950 hover:bg-amber-200">View Founding Partner offer</Link>:plan.code==="premium"?<a href={`mailto:hello@optimizelocal.com?subject=Premium%20Membership&body=Organization:%20${encodeURIComponent(membership.organizationName)}%0AOrganization%20ID:%20${membership.organizationId}`} className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-emerald-400 px-4 text-xs font-black text-emerald-950 hover:bg-emerald-300">Request Premium activation</a>:<span className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-slate-200 px-4 text-center text-[11px] font-bold text-slate-500">Managed through credential review</span>}</div>
    </article>})}</section>
    {current?.locked_renewal_price_cents!=null?<p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">Your locked renewal price is ${(current.locked_renewal_price_cents/100).toLocaleString("en-US",{minimumFractionDigits:2})} per month after the included Premium year.</p>:null}
  </div>;
}
