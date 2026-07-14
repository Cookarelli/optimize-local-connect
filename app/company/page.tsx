import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  CircleDollarSign,
  HeartHandshake,
  MapPin,
  Network,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/src/components/brand/logo";
import { COMPANY_VALUES, PLATFORM_BRAND } from "@/src/domain/platform/brand";

export const metadata: Metadata = {
  title: { absolute: `Company | ${PLATFORM_BRAND.parentName}` },
  description: PLATFORM_BRAND.philosophy,
  openGraph: {
    title: `${PLATFORM_BRAND.parentName} | Technology should make communities stronger.`,
    description: PLATFORM_BRAND.philosophy,
    images: [{ url: "/og-company.png", width: 1536, height: 1024, alt: `${PLATFORM_BRAND.parentName} — Technology should make communities stronger.` }],
  },
};

const impactLoop = [
  {
    number: "01",
    title: "Connect locally",
    description: "Bring people and trusted businesses into one accountable community network.",
    icon: Network,
  },
  {
    number: "02",
    title: "Decide smarter",
    description: "Turn local context, verified trust, and AI-assisted insight into better choices.",
    icon: BrainCircuit,
  },
  {
    number: "03",
    title: "Measure impact",
    description: "Make time saved, money retained, and community value visible over time.",
    icon: CircleDollarSign,
  },
];

function CompanyHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-[#f7f8f4]/88 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-[90rem] items-center justify-between px-5 sm:px-8 lg:px-12">
        <Logo />
        <nav aria-label="Company navigation" className="hidden items-center gap-7 lg:flex">
          <a href="#mission" className="text-sm font-medium text-slate-600 transition hover:text-slate-950">Mission</a>
          <a href="#vision" className="text-sm font-medium text-slate-600 transition hover:text-slate-950">Vision</a>
          <a href="#values" className="text-sm font-medium text-slate-600 transition hover:text-slate-950">Values</a>
          <a href="#founder-story" className="text-sm font-medium text-slate-600 transition hover:text-slate-950">Founder story</a>
          <a href="#about" className="text-sm font-medium text-slate-600 transition hover:text-slate-950">About</a>
        </nav>
        <Link href="/" className="inline-flex min-h-11 items-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700">Explore Connect</Link>
      </div>
    </header>
  );
}

export default function CompanyPage() {
  return (
    <main className="min-h-dvh overflow-hidden bg-[#f7f8f4] text-slate-950">
      <CompanyHeader />

      <section className="relative isolate">
        <div aria-hidden="true" className="absolute -right-48 top-20 -z-10 size-[42rem] rounded-full bg-[radial-gradient(circle,rgba(167,243,208,.72),rgba(209,250,229,.18)_58%,transparent_72%)]" />
        <div className="mx-auto flex min-h-[calc(100dvh-4.5rem)] max-w-[90rem] flex-col justify-between px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <div className="max-w-6xl animate-rise">
            <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3.5 py-2 text-xs font-bold uppercase tracking-[.16em] text-emerald-800 shadow-sm"><Sparkles className="size-3.5" /> Company · {PLATFORM_BRAND.parentName}</p>
            <h1 className="mt-8 text-[clamp(3.8rem,8.5vw,8.8rem)] font-semibold leading-[.86] tracking-[-.075em]">Technology should<br />make communities<br /><span className="text-emerald-700">stronger.</span></h1>
          </div>
          <div className="mt-14 grid gap-8 border-t border-slate-300 pt-8 lg:grid-cols-[1fr_1.35fr] lg:items-end">
            <p className="text-sm font-bold uppercase tracking-[.18em] text-slate-500">Our reason for building</p>
            <p className="max-w-3xl text-xl leading-8 text-slate-700 sm:text-2xl sm:leading-9">{PLATFORM_BRAND.philosophy}</p>
          </div>
          <a href="#mission" aria-label="Continue to our mission" className="mt-12 grid size-12 place-items-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:-translate-y-0.5 hover:border-emerald-400"><ArrowDown className="size-4" /></a>
        </div>
      </section>

      <section id="mission" className="bg-slate-950 py-24 text-white sm:py-32">
        <div className="mx-auto grid max-w-[90rem] gap-14 px-5 sm:px-8 lg:grid-cols-[.55fr_1.45fr] lg:px-12">
          <div><p className="section-kicker text-emerald-400">01 · Mission</p><p className="mt-6 max-w-xs text-sm leading-6 text-slate-400">The filter behind every product, partnership, and decision.</p></div>
          <div>
            <h2 className="text-5xl font-semibold leading-[.95] tracking-[-.055em] sm:text-7xl lg:text-8xl">{PLATFORM_BRAND.mission}</h2>
            <p className="mt-10 max-w-3xl text-lg leading-8 text-slate-300">We build practical intelligence that removes friction from local decisions. When work moves faster, spending becomes smarter, and trusted businesses win on merit, more value stays in the places that created it.</p>
          </div>
        </div>
      </section>

      <section className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-[90rem] px-5 sm:px-8 lg:px-12">
          <div className="max-w-3xl"><p className="section-kicker">How impact compounds</p><h2 className="section-title">A stronger local decision creates the next one.</h2></div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-200 lg:grid-cols-3">
            {impactLoop.map(({ number, title, description, icon: Icon }) => (
              <article key={number} className="group bg-[#fafbf8] p-7 transition hover:bg-white sm:p-9">
                <div className="flex items-center justify-between"><span className="text-sm font-black text-emerald-700">{number}</span><span className="grid size-11 place-items-center rounded-2xl bg-white shadow-sm"><Icon className="size-5 text-slate-700" /></span></div>
                <h3 className="mt-20 text-3xl font-semibold tracking-[-.035em]">{title}</h3>
                <p className="mt-4 max-w-sm text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="vision" className="bg-[#e7f5ec] py-24 sm:py-32">
        <div className="mx-auto grid max-w-[90rem] gap-12 px-5 sm:px-8 lg:grid-cols-[.7fr_1.3fr] lg:items-center lg:px-12">
          <div>
            <p className="section-kicker">02 · Vision</p>
            <div className="mt-10 grid size-40 place-items-center rounded-[2.5rem] bg-emerald-700 text-white shadow-[0_30px_80px_rgba(4,120,87,.22)] sm:size-52"><MapPin className="size-16" strokeWidth={1.15} /></div>
          </div>
          <div>
            <h2 className="text-5xl font-semibold leading-[.98] tracking-[-.055em] sm:text-7xl">{PLATFORM_BRAND.vision}</h2>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-slate-700">We see local economies where trust travels, good businesses are easier to find, and organizations can understand the community impact of the choices they make.</p>
          </div>
        </div>
      </section>

      <section id="values" className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-[90rem] px-5 sm:px-8 lg:px-12">
          <div className="max-w-3xl"><p className="section-kicker">03 · Values</p><h2 className="section-title">Principles that hold as we grow.</h2></div>
          <div className="mt-16 border-t border-slate-200">
            {COMPANY_VALUES.map((value, index) => (
              <article key={value.name} className="grid gap-5 border-b border-slate-200 py-8 sm:grid-cols-[6rem_1fr_1fr] sm:items-start sm:py-10">
                <span className="font-mono text-xs font-bold text-emerald-700">0{index + 1}</span>
                <h3 className="text-2xl font-semibold tracking-[-.025em] sm:text-3xl">{value.name}</h3>
                <p className="max-w-xl text-sm leading-7 text-slate-600 sm:text-base">{value.statement}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="founder-story" className="bg-[#f1f3ee] py-24 sm:py-32">
        <div className="mx-auto grid max-w-[90rem] gap-14 px-5 sm:px-8 lg:grid-cols-[.65fr_1.35fr] lg:px-12">
          <div><p className="section-kicker">04 · Founder story</p><div className="mt-10 flex items-center gap-3 text-sm font-semibold text-slate-600"><HeartHandshake className="size-5 text-emerald-700" /> Built from a local conviction</div></div>
          <div className="max-w-4xl">
            <h2 className="text-4xl font-semibold leading-[1.02] tracking-[-.045em] sm:text-6xl">Optimize Local began with a simple observation: communities lose value when good local decisions are harder than they should be.</h2>
            <div className="mt-10 grid gap-6 text-base leading-8 text-slate-600 md:grid-cols-2">
              <p>People want to hire businesses they can trust. Local businesses want a fair opportunity to earn lasting relationships. Organizations want to make responsible decisions without adding hours of research and follow-up.</p>
              <p>The missing piece was not another directory. It was a trusted intelligence layer—technology that connects context, accountability, and action while keeping people in control.</p>
            </div>
            <blockquote className="mt-14 border-l-2 border-emerald-600 pl-6 text-3xl font-semibold leading-tight tracking-[-.035em] text-slate-900 sm:text-4xl">“{PLATFORM_BRAND.manifesto}”</blockquote>
          </div>
        </div>
      </section>

      <section id="about" className="bg-white py-24 sm:py-32">
        <div className="mx-auto grid max-w-[90rem] gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_1fr] lg:items-end lg:px-12">
          <div>
            <p className="section-kicker">05 · About Optimize Local</p>
            <h2 className="section-title">One company.<br />A platform for stronger local economies.</h2>
          </div>
          <div className="rounded-[2rem] bg-slate-950 p-7 text-white sm:p-10">
            <Logo inverse />
            <p className="mt-12 text-xl leading-8 text-slate-300">{PLATFORM_BRAND.parentName} builds AI-powered community technology. {PLATFORM_BRAND.productName} is its shared operating platform, {PLATFORM_BRAND.aiName} optimizes decisions across it, and Property Management is Version 1 of a reusable community-marketplace foundation.</p>
            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              {["Local-first intelligence", "Verified business networks", "Human-centered AI", "Measurable community impact"].map((item) => <span key={item} className="flex items-center gap-2 text-sm text-slate-300"><BadgeCheck className="size-4 text-emerald-400" />{item}</span>)}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 pb-5 sm:px-8 sm:pb-8 lg:px-12 lg:pb-12">
        <div className="mx-auto flex max-w-[90rem] flex-col gap-9 overflow-hidden rounded-[2rem] bg-emerald-700 px-7 py-14 text-white sm:px-12 sm:py-16 lg:flex-row lg:items-end lg:justify-between lg:px-16">
          <div><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-200">{PLATFORM_BRAND.companyTagline}</p><h2 className="mt-5 max-w-4xl text-4xl font-semibold leading-[.98] tracking-[-.05em] sm:text-6xl">Every optimized decision can strengthen a community.</h2></div>
          <Link href="/" className="group inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-white px-6 text-sm font-bold text-slate-950 transition hover:bg-emerald-50">Explore the platform<ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" /></Link>
        </div>
      </section>

      <footer className="bg-white">
        <div className="mx-auto flex max-w-[90rem] flex-col gap-5 border-t border-slate-200 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <p>© 2026 {PLATFORM_BRAND.parentName}. {PLATFORM_BRAND.mission}</p>
          <div className="flex gap-6"><Link href="/" className="hover:text-slate-950">Connect</Link><Link href="/sign-in" className="hover:text-slate-950">Sign in</Link><a href="mailto:hello@optimizelocal.com" className="hover:text-slate-950">Contact</a></div>
        </div>
      </footer>
    </main>
  );
}
