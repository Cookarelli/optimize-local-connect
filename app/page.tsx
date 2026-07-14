import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock3,
  MapPin,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Logo } from "@/src/components/brand/logo";

const benefits = [
  { icon: Clock3, title: "Move work forward faster", copy: "One clean workflow from service request to completed job—without the text chains and status chasing." },
  { icon: ShieldCheck, title: "Hire with confidence", copy: "Build a trusted bench of verified, insured local vendors and preserve performance history across every market." },
  { icon: Sparkles, title: "Ready for intelligent operations", copy: "Structured property, vendor, and work data creates the foundation for automation and useful AI—not gimmicks." },
];

const steps = [
  ["01", "Request", "A manager captures the issue once, with the property, priority, access details, and scope."],
  ["02", "Match", "Property OS surfaces qualified vendors available in the local market and relevant trade."],
  ["03", "Resolve", "Teams compare quotes, award work, track progress, and retain a complete operational record."],
];

export default function Home() {
  return (
    <main className="min-h-dvh overflow-hidden bg-[#f7f8f4] text-slate-950">
      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Logo />
        <nav aria-label="Primary navigation" className="hidden items-center gap-8 md:flex">
          <a href="#platform" className="text-sm font-medium text-slate-600 hover:text-slate-950">Platform</a>
          <a href="#how-it-works" className="text-sm font-medium text-slate-600 hover:text-slate-950">How it works</a>
          <a href="#marketplace" className="text-sm font-medium text-slate-600 hover:text-slate-950">Marketplace</a>
        </nav>
        <Link href="/sign-in" className="inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">Sign in</Link>
      </header>

      <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-14 sm:px-8 lg:grid-cols-[1.02fr_.98fr] lg:px-10 lg:pb-32 lg:pt-20">
        <div className="relative z-10 max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[.12em] text-emerald-800">
            <MapPin aria-hidden="true" className="size-3.5" /> Built for local property operations
          </div>
          <h1 className="text-[clamp(3rem,7vw,6.5rem)] font-semibold leading-[.92] tracking-[-.065em] text-slate-950">Less chasing.<br /><span className="text-emerald-700">More resolved.</span></h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600 sm:text-xl">The operating system connecting property managers with verified local vendors—across every property, trade, and city.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a href="#early-access" className="inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">Request early access <ArrowRight aria-hidden="true" className="ml-2 size-4" /></a>
            <a href="#how-it-works" className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">See how it works</a>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
            <span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-600" /> Multi-city by design</span>
            <span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-600" /> Role-based access</span>
          </div>
        </div>

        <div aria-label="Property operations workflow preview" className="relative mx-auto w-full max-w-xl lg:mr-0">
          <div aria-hidden="true" className="absolute -inset-16 rounded-full bg-emerald-200/45 blur-3xl" />
          <div className="relative rounded-[2rem] border border-white/80 bg-white/90 p-4 shadow-[0_35px_90px_rgba(15,23,42,.14)] backdrop-blur sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-5">
              <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-slate-400">Live operations</p><p className="mt-1 text-lg font-bold">Westside portfolio</p></div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">12 active</span>
            </div>
            <div className="grid gap-3 py-5 sm:grid-cols-3">
              {[['24','Properties'],['7','Vendors'],['94%','On time']].map(([value,label]) => <div key={label} className="rounded-2xl bg-slate-50 p-4"><p className="text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>)}
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-amber-50"><Wrench className="size-5 text-amber-700" /></span><div><p className="text-sm font-semibold">No cooling · Unit 204</p><p className="text-xs text-slate-500">Riverview Flats · HVAC</p></div></div><span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">Urgent</span></div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-4"><span className="flex items-center gap-2 text-xs text-slate-500"><BadgeCheck className="size-4 text-emerald-600" /> 3 verified matches</span><span className="text-xs font-semibold text-slate-800">Review vendors →</span></div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-slate-100 p-4"><p className="text-xs text-slate-500">Response time</p><p className="mt-1 text-lg font-bold">18 min</p></div><div className="rounded-2xl border border-slate-100 p-4"><p className="text-xs text-slate-500">Open quotes</p><p className="mt-1 text-lg font-bold">6</p></div></div>
          </div>
        </div>
      </section>

      <section id="platform" className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-2xl"><p className="section-kicker">Operations without the overhead</p><h2 className="section-title">Simple on the surface.<br />Serious underneath.</h2><p className="section-copy">Every interaction is designed for the person handling an urgent issue from a phone. Underneath, Property OS keeps the controls enterprise teams expect.</p></div>
          <div className="mt-14 grid gap-5 md:grid-cols-3">{benefits.map(({icon: Icon,title,copy}) => <article key={title} className="rounded-[1.5rem] border border-slate-200 p-6 sm:p-8"><span className="grid size-11 place-items-center rounded-xl bg-emerald-50"><Icon aria-hidden="true" className="size-5 text-emerald-700" /></span><h3 className="mt-8 text-xl font-bold tracking-tight">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p></article>)}</div>
        </div>
      </section>

      <section id="how-it-works" className="bg-slate-950 py-24 text-white sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10"><p className="section-kicker text-emerald-400">One connected workflow</p><h2 className="section-title max-w-3xl text-white">From “something broke” to done.</h2><div className="mt-14 grid gap-px overflow-hidden rounded-[1.75rem] bg-slate-700 md:grid-cols-3">{steps.map(([number,title,copy]) => <article key={number} className="bg-slate-900 p-7 sm:p-9"><span className="text-sm font-bold text-emerald-400">{number}</span><h3 className="mt-16 text-2xl font-bold">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-400">{copy}</p></article>)}</div></div>
      </section>

      <section id="marketplace" className="bg-[#edf5ee] py-24 sm:py-32"><div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:items-center lg:px-10"><div><p className="section-kicker">A marketplace with memory</p><h2 className="section-title">Your best local vendors become an operational advantage.</h2><p className="section-copy">Discover qualified service partners by city and trade. Verify credentials, compare real performance, and keep the relationship history with your organization—not in someone’s phone.</p></div><div className="grid gap-4 sm:grid-cols-2">{[[Building2,'Property teams','Control every request, bid, assignment, and outcome.'],[Wrench,'Local vendors','Win the right work and give crews clean job context.'],[BadgeCheck,'Verified network','Track insurance, specialties, coverage, and performance.'],[MapPin,'Market intelligence','Expand city by city without rebuilding your playbook.']].map(([Icon,title,copy]) => { const C = Icon as typeof Building2; return <article key={title as string} className="rounded-2xl bg-white p-5 shadow-sm"><C className="size-5 text-emerald-700" /><h3 className="mt-5 font-bold">{title as string}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{copy as string}</p></article>})}</div></div></section>

      <section id="early-access" className="bg-white py-24 sm:py-32"><div className="mx-auto max-w-5xl px-5 text-center sm:px-8"><div className="rounded-[2rem] bg-emerald-700 px-6 py-16 text-white sm:px-14"><p className="text-sm font-bold uppercase tracking-[.18em] text-emerald-200">Early access</p><h2 className="mt-4 text-4xl font-semibold tracking-[-.04em] sm:text-6xl">Run local properties with less friction.</h2><p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-emerald-100">We’re onboarding property management teams and verified service partners market by market.</p><a href="mailto:hello@optimizelocal.com?subject=Property%20OS%20Early%20Access" className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50">Request access <ArrowRight className="ml-2 size-4" /></a></div></div></section>

      <footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10"><Logo /><p className="text-sm text-slate-500">Save time, money, and headaches.</p></div></footer>
    </main>
  );
}
