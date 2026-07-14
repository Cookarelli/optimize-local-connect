import type { Metadata } from "next";
import Link from "next/link";
import { Award, BadgeCheck, Clock3, MapPin, Search, ShieldCheck, Siren, Sparkles, Star } from "lucide-react";
import { EmptyState } from "@/src/components/ui/page-header";
import { parseMarketplaceVendors } from "@/src/domain/vendor-memberships/marketplace";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const metadata: Metadata = {
  title: "Local Vendor Marketplace",
  description: "Find trusted local providers by service, city, credentials, availability, and performance.",
  openGraph: { images: [{ url: "/og-vendor-marketplace.png", width: 1536, height: 1024, alt: "Optimize Local Connect Vendor Marketplace" }] },
  twitter: { card: "summary_large_image", images: ["/og-vendor-marketplace.png"] },
};

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const enabled = (value: string | string[] | undefined) => one(value) === "true";
const uuid = (value: string | undefined) => value && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value) ? value : null;
const safeWebsite = (value: string | null) => value && /^https?:\/\//i.test(value) ? value : null;

const chip = "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-600 has-[:checked]:border-emerald-700 has-[:checked]:bg-emerald-50 has-[:checked]:text-emerald-800";

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const q = one(params.q)?.trim().slice(0, 120) ?? "";
  const city = uuid(one(params.city));
  const category = uuid(one(params.category));
  const filters = { verified: enabled(params.verified), premium: enabled(params.premium), emergency: enabled(params.emergency), licensed: enabled(params.licensed), insured: enabled(params.insured) };
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, { data: cities }, { data: categories }] = await Promise.all([
    supabase.rpc("search_vendor_marketplace", {
      search_query: q || null, city_filter: city, category_filter: category,
      verified_only: filters.verified, premium_only: filters.premium, emergency_only: filters.emergency,
      licensed_only: filters.licensed, insured_only: filters.insured, result_limit: 50, result_offset: 0,
    }),
    supabase.from("cities").select("id,name,state_code").eq("is_active", true).order("name"),
    supabase.from("vendor_categories").select("id,name").eq("is_active", true).order("name"),
  ]);
  if (error && error.code !== "PGRST202") throw new Error(error.message);
  const vendors = error ? [] : parseMarketplaceVendors(data);
  const total = vendors[0]?.total_count ?? 0;

  return <div>
    <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-5 py-9 text-white sm:px-8 sm:py-12 lg:px-12">
      <div aria-hidden className="absolute -right-20 -top-28 size-80 rounded-full border-[55px] border-emerald-400/5" />
      <div className="relative max-w-3xl"><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-400">Trusted local network</p><h1 className="mt-4 text-4xl font-semibold leading-none tracking-[-.05em] sm:text-6xl">The right local vendor.<br /><span className="text-emerald-400">Found with confidence.</span></h1><p className="mt-5 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Search real service coverage, current credentials, emergency availability, and accountable performance across every Connect market.</p></div>
    </section>

    <form className="relative -mt-4 mx-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-950/5 sm:mx-6 sm:p-5 lg:mx-10" action="/marketplace">
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_auto]"><label className="relative"><span className="sr-only">Search vendors</span><Search className="absolute left-3.5 top-3.5 size-4 text-slate-400" /><input name="q" defaultValue={q} className="min-h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-emerald-600" placeholder="Company or service" /></label><label><span className="sr-only">City</span><select name="city" defaultValue={city ?? ""} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Every city</option>{(cities ?? []).map(item => <option key={item.id} value={item.id}>{item.name}, {item.state_code}</option>)}</select></label><label><span className="sr-only">Category</span><select name="category" defaultValue={category ?? ""} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Every service</option>{(categories ?? []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button className="min-h-11 rounded-xl bg-emerald-700 px-6 text-sm font-black text-white hover:bg-emerald-800">Search</button></div>
      <fieldset className="mt-4 flex flex-wrap gap-2"><legend className="sr-only">Marketplace filters</legend>{[["verified","Verified",BadgeCheck],["premium","Premium",Sparkles],["emergency","Emergency",Siren],["licensed","Licensed",ShieldCheck],["insured","Insured",ShieldCheck]].map(([key,label,Icon]) => { const C = Icon as typeof BadgeCheck; return <label key={key as string} className={chip}><input className="sr-only" type="checkbox" name={key as string} value="true" defaultChecked={filters[key as keyof typeof filters]} /><C className="size-3.5" />{label as string}</label>})}<Link href="/marketplace" className="inline-flex min-h-10 items-center px-3 text-xs font-bold text-slate-400 hover:text-slate-900">Clear filters</Link></fieldset>
    </form>

    <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.15em] text-emerald-700">Marketplace results</p><h2 className="mt-1 text-2xl font-bold tracking-tight">{total ? `${total.toLocaleString()} local provider${total === 1 ? "" : "s"}` : "Local providers"}</h2></div><Link href="/vendor/membership" className="text-sm font-bold text-emerald-700 hover:text-emerald-900">Compare vendor memberships →</Link></div>

    <div className="mt-5">{vendors.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{vendors.map(vendor => <article key={vendor.vendor_organization_id} className={`relative flex flex-col overflow-hidden rounded-[1.6rem] border bg-white p-5 shadow-sm ${vendor.is_featured ? "border-emerald-300 ring-1 ring-emerald-100" : "border-slate-200"}`}>
      {vendor.is_featured ? <div className="-mx-5 -mt-5 mb-5 flex min-h-8 items-center justify-between bg-emerald-700 px-5 text-[10px] font-black uppercase tracking-[.14em] text-white"><span className="flex items-center gap-1.5"><Sparkles className="size-3" />Premium placement</span><span>{vendor.membership_name}</span></div> : null}
      <div className="flex items-start gap-3"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-slate-950 text-sm font-black text-emerald-300">{vendor.name.split(/\s+/).slice(0,2).map(word=>word[0]).join("").toUpperCase()}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><h3 className="truncate font-bold text-slate-950"><Link href={`/marketplace/${vendor.slug}`} className="hover:text-emerald-700">{vendor.name}</Link></h3>{vendor.badges.includes("founding_partner") ? <span title="Founding Partner"><Award className="size-4 text-amber-600" /></span> : null}{vendor.is_verified ? <span title="License and insurance verified"><BadgeCheck className="size-4 text-emerald-600" /></span> : null}</div><p className="mt-1 text-xs font-semibold text-slate-500">{vendor.membership_name}</p></div>{vendor.average_rating ? <span className="flex items-center gap-1 text-sm font-black"><Star className="size-4 fill-amber-400 text-amber-400" />{vendor.average_rating.toFixed(1)}</span> : null}</div>
      <p className="mt-5 line-clamp-3 min-h-15 text-sm leading-5 text-slate-600">{vendor.description ?? "Local provider building a trusted performance record on Optimize Local Connect."}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">{vendor.categories.slice(0,3).map(item=><span key={item.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{item.name}</span>)}</div>
      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs"><div><p className="text-slate-400">Coverage</p><p className="mt-1 flex items-center gap-1 font-bold"><MapPin className="size-3.5 text-emerald-700" />{vendor.cities[0] ? `${vendor.cities[0].name}${vendor.cities.length > 1 ? ` +${vendor.cities.length-1}` : ""}` : "Ask provider"}</p></div><div><p className="text-slate-400">Response</p><p className="mt-1 flex items-center gap-1 font-bold"><Clock3 className="size-3.5 text-emerald-700" />{vendor.response_time_minutes != null ? `${vendor.response_time_minutes} min` : "New partner"}</p></div></div>
      <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-slate-500">{vendor.is_licensed?<span className="flex items-center gap-1"><ShieldCheck className="size-3 text-emerald-600"/>License current</span>:null}{vendor.is_insured?<span className="flex items-center gap-1"><ShieldCheck className="size-3 text-emerald-600"/>Insurance current</span>:null}{vendor.emergency_available?<span className="flex items-center gap-1 text-rose-600"><Siren className="size-3"/>Emergency</span>:null}</div>
      <div className="mt-auto grid grid-cols-2 gap-2 pt-6"><Link href={`/requests/new?vendor=${vendor.vendor_organization_id}`} className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-3 text-xs font-black text-white hover:bg-emerald-700">Request quote</Link>{safeWebsite(vendor.website_url) ? <a href={safeWebsite(vendor.website_url)!} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 px-3 text-xs font-black text-slate-700 hover:bg-slate-50">View website</a> : vendor.phone ? <a href={`tel:${vendor.phone}`} className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 px-3 text-xs font-black text-slate-700 hover:bg-slate-50">Contact</a> : <span className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-100 text-xs font-bold text-slate-400">Contact via quote</span>}</div>
    </article>)}</div> : <EmptyState title="No providers match these filters" description="Broaden the city, service, or credential filters to see more trusted local options." />}</div>
  </div>;
}
