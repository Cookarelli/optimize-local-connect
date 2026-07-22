/* eslint-disable @next/next/no-img-element */

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Eye,
  Handshake,
  MapPin,
  Search,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import { Logo } from "@/src/components/brand/logo";

export const metadata: Metadata = {
  title: "Vendor Dashboard Demo",
  description: "A preview of the Optimize Local Connect vendor experience.",
  robots: { index: false, follow: false },
};

const metrics = [
  [Eye, "Profile Views", "148"],
  [Search, "Property Manager Searches", "37"],
  [BellRing, "Lead Requests", "8"],
  [TrendingUp, "Jobs Won", "3"],
  [CircleDollarSign, "Estimated Revenue Generated", "$2,460"],
  [Clock3, "Average Response Time", "14 min"],
] as const;

const opportunities = [
  ["Emergency HVAC", "No heat in a 12-unit building", "Rockford", "Immediate", "$850–$1,400"],
  ["Seasonal maintenance", "Furnace inspections for 18 units", "Loves Park", "This week", "$1,200–$1,800"],
  ["Replacement quote", "Two rooftop units", "Machesney Park", "Within 30 days", "$6,000–$10,000"],
] as const;

const activity = [
  "Property manager viewed your profile",
  "New HVAC opportunity matched",
  "Vendor profile saved by a property manager",
  "Founder badge displayed in search results",
  "Lead request sent to your business",
];

const benefits = [
  "Founder recognition",
  "Priority marketplace placement",
  "Direct property manager visibility",
  "Lead and opportunity notifications",
  "Verified profile",
  "Exclusive property manager offers",
  "Performance insights",
  "Founder pricing locked in",
];

export default function VendorDashboardDemoPage() {
  return (
    <main className="min-h-dvh bg-[#f7f8f4] text-slate-950">
      <header className="border-b border-slate-200/80 bg-[#f7f8f4]/95">
        <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-5 px-5 py-4 sm:px-8 lg:px-12">
          <Logo priority />
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black uppercase tracking-[.14em] text-emerald-800">Sales preview</span>
        </div>
      </header>

      <section className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-center sm:px-8">
        <p className="text-sm font-semibold text-amber-950"><span className="font-black">Vendor Dashboard Demo</span><span className="mx-2 text-amber-400">•</span>All figures are sample data showing the future vendor experience.</p>
      </section>

      <section className="relative isolate overflow-hidden bg-slate-950 text-white">
        <div aria-hidden="true" className="absolute -right-36 -top-36 size-[32rem] rounded-full border-[80px] border-emerald-400/[.07]" />
        <div className="relative mx-auto max-w-[90rem] px-5 py-14 sm:px-8 sm:py-18 lg:px-12 lg:py-22">
          <div className="flex flex-col gap-9 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[.2em] text-emerald-400">Welcome back, vendor</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-.055em] sm:text-6xl">Perfect Temp Heating <span className="text-emerald-400">&amp; Cooling</span></h1>
              <div className="mt-6 flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-300">
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-amber-200"><img src="/brand/optimize-local-connect/founder-vendor.png" alt="" className="size-5 object-contain" />Founding Vendor #4</span>
                <span className="inline-flex items-center gap-1.5"><MapPin className="size-4 text-emerald-400" />Rockford, Illinois</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:min-w-80">
              <div className="rounded-2xl border border-white/10 bg-white/[.06] px-5 py-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-slate-400">Profile status</p><p className="mt-2 flex items-center gap-2 font-bold text-emerald-300"><BadgeCheck className="size-5" />Verified</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[.06] px-5 py-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-slate-400">Profile completion</p><p className="mt-2 font-bold text-white">92%</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[92%] rounded-full bg-emerald-400" /></div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[90rem] px-5 py-14 sm:px-8 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="section-kicker">Marketplace performance</p><h2 className="section-title">Your sample performance snapshot.</h2></div><p className="rounded-full bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600">Demo metrics</p></div>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map(([Icon, label, value]) => <article key={label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><span className="grid size-11 place-items-center rounded-2xl bg-emerald-50"><Icon className="size-5 text-emerald-700" /></span><p className="mt-7 text-sm font-semibold text-slate-500">{label}</p><p className="mt-1 text-3xl font-bold tracking-[-.05em]">{value}</p></article>)}
        </div>
      </section>

      <section className="border-y border-emerald-900/10 bg-[#e3f4e9] py-16 sm:py-20">
        <div className="mx-auto grid max-w-[90rem] gap-10 px-5 sm:px-8 lg:grid-cols-[.85fr_1.15fr] lg:items-center lg:px-12">
          <div><p className="section-kicker">Property manager network</p><h2 className="section-title">Be visible where local work begins.</h2><p className="section-copy">Property managers can discover, save, and contact qualified vendors when they need dependable help for their buildings.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">{[[Users, "Growing", "property-manager relationships"], [Building2, "100+", "local homes served"], [MapPin, "Rockford-area", "network"], [TrendingUp, "Growing", "weekly"]].map(([Icon, value, label]) => { const NetworkIcon = Icon as typeof Users; return <div key={label as string} className="rounded-3xl border border-emerald-900/10 bg-white/85 p-6"><NetworkIcon className="size-5 text-emerald-700" /><p className="mt-7 text-2xl font-bold tracking-[-.04em]">{value as string}</p><p className="mt-1 text-sm font-semibold text-slate-500">{label as string}</p></div>; })}</div>
        </div>
      </section>

      <section className="mx-auto max-w-[90rem] px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
        <p className="section-kicker">Active opportunities</p><h2 className="section-title">The work you could see next.</h2><p className="section-copy">Sample opportunities demonstrate how qualified vendor matches will be presented.</p>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">{opportunities.map(([title, detail, place, urgency, value]) => <article key={title} className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-4"><span className="grid size-11 place-items-center rounded-2xl bg-slate-100"><Wrench className="size-5 text-slate-700" /></span><span className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-800">{urgency}</span></div><h3 className="mt-7 text-xl font-bold">{title}</h3><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{detail}</p><div className="mt-6 space-y-2 border-t border-slate-100 pt-5 text-sm"><p className="flex items-center gap-2 font-semibold text-slate-700"><MapPin className="size-4 text-emerald-700" />{place}</p><p className="font-bold text-emerald-800">Estimated value: {value}</p></div><button disabled className="mt-6 min-h-11 rounded-full border border-slate-200 bg-slate-50 px-5 text-sm font-bold text-slate-400">View Opportunity · Demo only</button></article>)}</div>
      </section>

      <section className="bg-white py-16 sm:py-20"><div className="mx-auto grid max-w-[90rem] gap-10 px-5 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:px-12"><div><p className="section-kicker">Recent activity</p><h2 className="section-title">A pulse on your visibility.</h2></div><ol className="divide-y divide-slate-200 rounded-3xl border border-slate-200 px-6">{activity.map((item, index) => <li key={item} className="flex gap-4 py-5"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-50 text-xs font-black text-emerald-800">0{index + 1}</span><p className="pt-1 text-sm font-semibold text-slate-700">{item}</p></li>)}</ol></div></section>

      <section className="mx-auto max-w-[90rem] px-5 py-16 sm:px-8 sm:py-20 lg:px-12"><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="section-kicker">Vendor profile preview</p><h2 className="section-title">How managers see your business.</h2></div><span className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black uppercase tracking-[.12em] text-white"><Eye className="size-3.5" />Preview Marketplace Profile</span></div>
        <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-900/5"><div className="grid lg:grid-cols-[.85fr_1.15fr]"><div className="bg-slate-950 p-7 text-white sm:p-10"><img src="/brand/optimize-local-connect/founder-vendor.png" alt="Founding Vendor badge" className="h-16 w-auto object-contain" /><p className="mt-10 text-xs font-black uppercase tracking-[.18em] text-emerald-400">Featured HVAC provider</p><h3 className="mt-4 text-3xl font-semibold tracking-[-.05em]">Perfect Temp Heating &amp; Cooling</h3><p className="mt-5 text-sm leading-7 text-slate-300">Reliable heating and cooling service for multifamily properties, homeowners, and local businesses across the Rockford area.</p><div className="mt-8 flex items-center gap-2 text-amber-300"><Star className="size-5 fill-current" /><span className="font-bold text-white">4.9</span><span className="text-sm text-slate-400">186 reviews</span></div></div><div className="p-7 sm:p-10"><div className="grid gap-7 sm:grid-cols-2"><div><p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">Service categories</p><p className="mt-3 font-bold">HVAC repair · Furnaces · AC installation</p></div><div><p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">Service area</p><p className="mt-3 font-bold">Rockford · Loves Park · Machesney Park</p></div><div><p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">Availability</p><p className="mt-3 flex items-center gap-2 font-bold text-emerald-800"><Clock3 className="size-4" />24/7 emergency service</p></div><div><p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">Contact</p><p className="mt-3 font-bold">(815) 555-0148<br />perfecttemp.example</p></div></div><div className="mt-9 rounded-2xl bg-emerald-50 p-5"><p className="flex items-center gap-2 text-sm font-black text-emerald-900"><Handshake className="size-5" />Property manager offer</p><p className="mt-2 text-sm font-semibold leading-6 text-emerald-800">10% off first service call for Optimize Local Connect members.</p></div></div></div></article>
      </section>

      <section className="bg-slate-950 py-16 text-white sm:py-20"><div className="mx-auto grid max-w-[90rem] gap-10 px-5 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:px-12"><div><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-400">Membership benefits</p><h2 className="mt-4 text-4xl font-semibold leading-[.98] tracking-[-.05em] sm:text-6xl">A presence built to get remembered.</h2></div><div className="grid gap-3 sm:grid-cols-2">{benefits.map((benefit) => <p key={benefit} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.06] p-4 text-sm font-bold text-slate-100"><CheckCircle2 className="size-5 shrink-0 text-emerald-400" />{benefit}</p>)}</div></div></section>

      <section className="mx-auto max-w-[90rem] px-5 py-16 sm:px-8 sm:py-20 lg:px-12"><div className="max-w-3xl"><p className="section-kicker">How the connection works</p><h2 className="section-title">Simple for everyone involved.</h2></div><ol className="mt-10 grid overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-200 md:grid-cols-4">{[[Users, "Property Manager"], [Target, "Submits a service need"], [Sparkles, "Optimize Local Connect matches qualified vendors"], [BellRing, "Vendor receives and responds to the opportunity"]].map(([Icon, copy], index) => { const StepIcon = Icon as typeof Users; return <li key={copy as string} className="relative bg-white p-6 sm:p-8"><span className="text-xs font-black text-emerald-700">0{index + 1}</span><StepIcon className="mt-10 size-6 text-emerald-700" /><p className="mt-4 text-lg font-bold leading-6">{copy as string}</p>{index < 3 ? <ArrowRight aria-hidden="true" className="absolute -right-3 top-1/2 z-10 hidden size-6 -translate-y-1/2 rounded-full bg-slate-950 p-1 text-white md:block" /> : null}</li>; })}</ol></section>

      <section className="px-5 pb-5 sm:px-8 sm:pb-8 lg:px-12 lg:pb-12"><div className="mx-auto max-w-[90rem] rounded-[2rem] bg-emerald-700 px-7 py-14 text-white sm:px-12 sm:py-18"><div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between"><div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-200">Ready for your own profile?</p><h2 className="mt-4 text-4xl font-semibold tracking-[-.055em] sm:text-6xl">Become a Founding Vendor — $299 One Time</h2><p className="mt-5 text-base leading-7 text-emerald-100">Join early, establish your marketplace presence, and be ready when local property managers are looking.</p></div><div className="flex flex-col gap-3 sm:flex-row"><Link href="/founders" className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-black text-emerald-800 hover:bg-emerald-50">Become a Founding Vendor</Link><Link href="/marketplace" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/30 px-6 text-sm font-black text-white hover:bg-white/10">View Marketplace Experience</Link></div></div></div></section>
    </main>
  );
}
