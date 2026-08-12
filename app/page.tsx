import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  Building2,
  Check,
  Gift,
  Handshake,
  House,
  Network,
  Radio,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Store,
  Target,
  Wrench,
} from "lucide-react";
import { Logo } from "@/src/components/brand/logo";
import { PLATFORM_BRAND } from "@/src/domain/platform/brand";
import {
  FOUNDING_MEMBER_OFFER,
  FOUNDING_PARTNER_PLAN,
  formatVendorPlanPrice,
} from "@/src/domain/vendor-memberships/catalog";

const founderPrice = formatVendorPlanPrice(FOUNDING_PARTNER_PLAN);

const pillars = [
  {
    title: "Trusted Businesses",
    copy: "Compare approved profiles using current service, location, credential, emergency-service, and business-provided details.",
    icon: ShieldCheck,
  },
  {
    title: "Member Benefits",
    copy: "Find preferred pricing, priority service, and other private benefits offered by eligible participating businesses.",
    icon: Gift,
  },
  {
    title: "Smarter Matches",
    copy: "Connect Match is the roadmap toward recommendations shaped by the need—not simply a longer list of businesses.",
    icon: SearchCheck,
  },
  {
    title: "Local Connections",
    copy: "Create useful relationships among customers, property managers, organizations, and businesses that can refer one another.",
    icon: Network,
  },
] as const;

const networkStages = [
  {
    label: "Available Now",
    title: "Search, compare, and connect directly",
    copy: "Browse approved profiles by category and service area. Review business-provided services, credentials, emergency-service details, and eligible member benefits before contacting a business.",
  },
  {
    label: "Growing With the Network",
    title: "Richer local context",
    copy: "Each participating business, service area, specialty, reviewed profile, and member benefit can make discovery more useful as the network expands.",
  },
  {
    label: "Where Connect is going",
    title: "Request Once, Connect Match, and better referrals",
    copy: "Future matching can consider appropriate context, availability, trusted relationships, and legitimate outcomes. These capabilities are product direction—not live recommendations today.",
  },
] as const;

const intelligenceLoop = [
  "Describe the need once",
  "Understand location, property, timing, and specialty",
  "Identify relevant participating businesses",
  "Make a direct local connection",
  "Learn from legitimate relationships and outcomes",
  "Improve future best-fit recommendations",
] as const;

const reputationSignals = [
  { label: "Profile review", status: "Available now" },
  { label: "Specialties + service areas", status: "Available now" },
  { label: "Business-provided credentials", status: "Available now" },
  { label: "Emergency service", status: "Available now" },
  { label: "Reviews + recommendations", status: "Future signal" },
  { label: "Response behavior", status: "Future signal" },
  { label: "Job outcomes", status: "Future signal" },
  { label: "Repeat relationships", status: "Future signal" },
  { label: "Property-manager experience", status: "Future signal" },
  { label: "Vendor referrals", status: "Future signal" },
] as const;

const memberBenefits = [
  "Preferred Member Pricing",
  "Priority service or scheduling",
  "Free or discounted delivery",
  "Service-call benefits",
  "Member-only packages",
  "Multi-property pricing",
  "Special upgrades",
  "Free estimates",
] as const;

const localConnections = [
  [House, "Homeowner → service provider"],
  [Building2, "Property manager → vendor"],
  [Store, "Business → business"],
  [Wrench, "Contractor → specialist"],
] as const;

const propertyServices = [
  "Plumbing",
  "Electrical",
  "HVAC",
  "Appliances",
  "Cleaning",
  "Landscaping",
  "Roofing",
  "Locksmiths",
  "Restoration",
  "Urgent repairs",
] as const;

const urgentServices = [
  "Plumbing emergencies",
  "HVAC",
  "Electrical",
  "Restoration",
  "Locksmiths",
  "Towing",
  "Tree and storm service",
  "Urgent property repair",
] as const;

const faqs = [
  [
    "Is Optimize Local Connect another business directory?",
    "Discovery is one useful layer, but the direction is broader: trusted business context, member benefits, referrals, and increasingly useful matching. A directory tells you who exists. Connect is being built to understand who you should call.",
  ],
  [
    "How does Connect choose businesses?",
    "Today, visitors search approved profiles by category, service area, and business-provided details. Membership may govern visibility and recognition. Connect Match is the future direction for best-fit recommendations using appropriate context and legitimate network signals; it is not a live recommendation engine today.",
  ],
  [
    "Do businesses pay to become the top recommendation?",
    "No. Paid membership can provide profile access, recognition, and governed visibility, but it does not establish that a business is the best fit. Trusted and future best-fit recommendations remain separate from paid placement.",
  ],
  [
    "What are Connect Member Benefits?",
    "They are benefits offered by participating businesses specifically to eligible Connect members. Examples may include preferred pricing, priority service, a delivery benefit, a free estimate, or multi-property pricing. Each business sets its own benefit and terms.",
  ],
  [
    "Is Connect only for property management?",
    "No. Property management is the first major use case because it creates frequent, real-world local service needs. The same network model can extend to homeowners, realtors, businesses, HOAs, organizations, and community institutions.",
  ],
  [
    "What is a Founding Member?",
    `A Founding Member joins during the network's original buildout. The ${founderPrice} annual membership includes reviewed network participation and Founder recognition while eligible. There are ${FOUNDING_MEMBER_OFFER.capacity} original positions; current availability and category eligibility are confirmed during enrollment. Membership does not guarantee leads, revenue, ranking, or category exclusivity.`,
  ],
] as const;

function ArrowLink({ href, children, light = false }: { href: string; children: React.ReactNode; light?: boolean }) {
  return (
    <Link
      href={href}
      className={`group inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${light ? "border border-slate-200 bg-white text-slate-950 hover:border-emerald-300 hover:bg-emerald-50" : "bg-slate-950 text-white shadow-lg shadow-slate-950/10 hover:-translate-y-0.5 hover:bg-emerald-700"}`}
    >
      {children}
      <ArrowRight aria-hidden="true" className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
    </Link>
  );
}

export default function Home() {
  return (
    <main id="top" className="min-h-dvh overflow-hidden bg-[#f7f8f4] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-[#f7f8f4]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-[90rem] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Logo />
          <nav aria-label="Primary navigation" className="hidden items-center gap-7 xl:flex">
            <a href="#what-connect-does" className="text-sm font-medium text-slate-600 transition hover:text-slate-950">What Connect Does</a>
            <a href="#intelligence" className="text-sm font-medium text-slate-600 transition hover:text-slate-950">Network Intelligence</a>
            <a href="#member-benefits" className="text-sm font-medium text-slate-600 transition hover:text-slate-950">Member Benefits</a>
            <a href="#property-management" className="text-sm font-medium text-slate-600 transition hover:text-slate-950">Property Management</a>
            <Link href="/company" className="text-sm font-medium text-slate-600 transition hover:text-slate-950">About</Link>
          </nav>
          <details className="relative xl:hidden">
            <summary className="grid size-11 cursor-pointer list-none place-items-center rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700" aria-label="Open navigation">Menu</summary>
            <nav aria-label="Mobile public navigation" className="absolute right-0 top-13 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              <a href="#what-connect-does" className="block rounded-xl px-3 py-3 text-sm font-semibold text-slate-700">What Connect Does</a>
              <a href="#intelligence" className="block rounded-xl px-3 py-3 text-sm font-semibold text-slate-700">Network Intelligence</a>
              <a href="#member-benefits" className="block rounded-xl px-3 py-3 text-sm font-semibold text-slate-700">Member Benefits</a>
              <a href="#property-management" className="block rounded-xl px-3 py-3 text-sm font-semibold text-slate-700">Property Management</a>
              <Link href="/marketplace" className="block rounded-xl px-3 py-3 text-sm font-semibold text-slate-700">Explore the Network</Link>
              <Link href="/sign-in" className="block rounded-xl px-3 py-3 text-sm font-semibold text-slate-700">Sign in</Link>
              <Link href="/memberships" className="mt-1 flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-3 text-sm font-black text-white">{FOUNDING_MEMBER_OFFER.cta}</Link>
            </nav>
          </details>
          <div className="hidden items-center gap-2 sm:flex">
            <Link href="/sign-in" className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-slate-700 hover:bg-white">Sign in</Link>
            <Link href="/memberships" className="inline-flex min-h-11 items-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700">{FOUNDING_MEMBER_OFFER.cta}</Link>
          </div>
        </div>
      </header>

      <section className="relative isolate">
        <div aria-hidden="true" className="hero-orb hero-orb-one" />
        <div aria-hidden="true" className="hero-orb hero-orb-two" />
        <div className="mx-auto grid min-h-[calc(100dvh-4.5rem)] max-w-[90rem] items-center gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[1.04fr_.96fr] lg:px-12 lg:py-24">
          <div className="relative z-10 max-w-4xl animate-rise">
            <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/80 px-3.5 py-2 text-xs font-bold uppercase tracking-[.14em] text-emerald-800 shadow-sm backdrop-blur"><Sparkles aria-hidden="true" className="size-3.5" /> The intelligent local business network</p>
            <h1 className="mt-8 text-[clamp(3.2rem,6vw,6.7rem)] font-semibold leading-[.9] tracking-[-.064em] text-slate-950">Find the right local business.<br /><span className="text-emerald-700">Not just another list of them.</span></h1>
            <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-600 sm:text-xl">A directory tells you who exists. Connect is being built to understand who you should call—with trusted local context, member benefits, referrals, and smarter matching over time.</p>
            <p className="mt-6 flex max-w-2xl items-start gap-2.5 text-base font-bold leading-7 text-slate-800"><Network aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-700" />{PLATFORM_BRAND.northStar}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row"><ArrowLink href="/memberships">{FOUNDING_MEMBER_OFFER.cta}</ArrowLink><ArrowLink href="/marketplace" light>Browse Businesses</ArrowLink></div>
            <p className="mt-6 max-w-2xl text-sm leading-6 text-slate-500">Founding membership provides network access and reviewed marketplace visibility. It does not guarantee leads, rank, jobs, or revenue.</p>
          </div>

          <div className="relative mx-auto w-full max-w-2xl animate-rise-delayed lg:mr-0">
            <div className="hero-dashboard relative rounded-[2rem] border border-white/80 bg-white/88 p-4 shadow-[0_40px_120px_rgba(15,23,42,.18)] backdrop-blur-xl sm:p-6">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-5"><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-emerald-700">One shared local network</p><p className="mt-1 text-lg font-bold">Useful connections, not isolated lists</p></div><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">Growing now</span></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {localConnections.map(([Icon, label], index) => <div key={label} className="flex min-h-24 items-center gap-3 rounded-2xl border border-slate-100 bg-[#fafbf8] p-4"><span className={`grid size-11 shrink-0 place-items-center rounded-xl ${index === 2 ? "bg-slate-950 text-emerald-400" : "bg-emerald-50 text-emerald-700"}`}><Icon aria-hidden="true" className="size-5" /></span><p className="text-sm font-bold leading-5">{label}</p></div>)}
              </div>
              <div className="mt-3 rounded-2xl bg-slate-950 p-5 text-white"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-emerald-400">Product direction</p><p className="mt-2 text-2xl font-semibold tracking-tight">From nearby to best fit</p></div><SearchCheck aria-hidden="true" className="size-7 text-emerald-400" /></div><p className="mt-3 text-sm leading-6 text-slate-400">Future matching can use legitimate activity and relevant context. It is not presented as fully operational today.</p></div>
            </div>
          </div>
        </div>
      </section>

      <section id="what-connect-does" className="scroll-mt-24 border-y border-slate-200 bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-[90rem] px-5 sm:px-8 lg:px-12">
          <div className="max-w-4xl"><p className="section-kicker">What Connect does</p><h2 className="section-title">A local network built around better decisions—not bigger lists.</h2><p className="section-copy">People get clearer business information and direct connections. Participating businesses gain a credible presence, member-benefit tools, and a network designed to create stronger local relationships.</p></div>
          <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">{pillars.map(({ title, copy, icon: Icon }, index) => <article key={title} className="rounded-[1.75rem] border border-slate-200 bg-[#fafbf8] p-7 transition hover:-translate-y-1 hover:border-emerald-300 hover:bg-white hover:shadow-xl hover:shadow-emerald-950/5"><div className="flex items-center justify-between"><span className="grid size-12 place-items-center rounded-2xl bg-slate-950"><Icon aria-hidden="true" className="size-5 text-emerald-400" /></span><span className="text-xs font-black text-emerald-700">0{index + 1}</span></div><h3 className="mt-10 text-2xl font-bold tracking-tight">{title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{copy}</p></article>)}</div>
        </div>
      </section>

      <section className="bg-[#f1f3ee] py-20 sm:py-28">
        <div className="mx-auto max-w-[90rem] px-5 sm:px-8 lg:px-12">
          <div className="max-w-3xl"><p className="section-kicker">Product status</p><h2 className="section-title">Useful now. More intelligent over time.</h2><p className="section-copy">A clear view of what people can use today, what improves through participation, and what remains on the roadmap.</p></div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-200 lg:grid-cols-3">{networkStages.map((stage, index) => <article key={stage.label} className="bg-white p-7 sm:p-9"><span className={`inline-flex rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[.14em] ${index === 0 ? "bg-emerald-100 text-emerald-900" : index === 1 ? "bg-amber-100 text-amber-900" : "bg-indigo-100 text-indigo-900"}`}>{stage.label}</span><h3 className="mt-8 text-2xl font-bold tracking-tight">{stage.title}</h3><p className="mt-4 text-sm leading-7 text-slate-600">{stage.copy}</p></article>)}</div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white py-24 sm:py-28">
        <div className="mx-auto grid max-w-[90rem] gap-12 px-5 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:px-12">
          <div><p className="section-kicker">Trusted local reputation</p><h2 className="section-title">A star rating is one signal. Trust is the full picture.</h2><p className="section-copy">Useful local reputation can include what a business does, where it works, what it can document, how it responds, and whether people choose to work with it again. Connect will only use signals that are appropriate, explainable, and genuinely supported.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">{reputationSignals.map((signal) => <article key={signal.label} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-[#fafbf8] p-5"><span className="text-sm font-bold text-slate-800">{signal.label}</span><span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[.1em] ${signal.status === "Available now" ? "bg-emerald-100 text-emerald-900" : "bg-indigo-100 text-indigo-900"}`}>{signal.status}</span></article>)}</div>
        </div>
      </section>

      <section id="intelligence" className="scroll-mt-24 bg-slate-950 py-24 text-white sm:py-32">
        <div className="mx-auto grid max-w-[90rem] gap-14 px-5 sm:px-8 lg:grid-cols-[.85fr_1.15fr] lg:px-12">
          <div className="max-w-xl"><p className="section-kicker text-emerald-400">Network intelligence</p><h2 className="section-title text-white">More participation. Better local intelligence.</h2><p className="section-copy text-slate-400">Traditional discovery is search, scan a long list, and guess. Connect is moving toward a more useful path: understand the need, identify relevant businesses, make a connection, and learn from legitimate outcomes.</p><p className="mt-8 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5 text-lg font-bold leading-7 text-emerald-200">Not the most businesses. The right businesses.</p></div>
          <ol className="grid gap-3">{intelligenceLoop.map((step, index) => <li key={step} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.045] p-4 sm:p-5"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-400 text-xs font-black text-emerald-950">{index + 1}</span><p className="text-sm font-semibold leading-6 text-slate-200">{step}</p></li>)}</ol>
        </div>
      </section>

      <section className="bg-[#f1f3ee] py-24 sm:py-28">
        <div className="mx-auto grid max-w-[90rem] gap-12 px-5 sm:px-8 lg:grid-cols-[.92fr_1.08fr] lg:items-center lg:px-12">
          <div><p className="section-kicker">Request Once + Connect Match</p><h2 className="section-title">Explain the need once. Find better-fit local options.</h2><p className="section-copy">Instead of repeating the same problem to several businesses, Request Once is the roadmap for capturing the context once. Connect Match can then help identify participating businesses that fit the situation.</p><span className="mt-7 inline-flex rounded-full bg-indigo-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.14em] text-indigo-900">Example of where Connect is going</span></div>
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5 sm:p-8"><div className="rounded-2xl bg-slate-950 p-5 text-white"><p className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-400">Request Once · example</p><p className="mt-3 text-lg font-semibold leading-7">“I need an electrician tomorrow for an older six-unit property in Loves Park.”</p></div><div className="my-5 flex items-center justify-center"><ArrowRight aria-hidden="true" className="size-5 rotate-90 text-emerald-700" /></div><div className="grid gap-3 sm:grid-cols-2">{["Location", "Property type", "Urgency", "Specialty", "Provider coverage", "Availability"].map((context) => <div key={context} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-[#fafbf8] p-4 text-sm font-bold"><Target aria-hidden="true" className="size-4 text-emerald-700" />{context}</div>)}</div><p className="mt-5 text-xs leading-5 text-slate-500">This is a product-direction illustration, not a live match or recommendation.</p></div>
        </div>
      </section>

      <section id="member-benefits" className="scroll-mt-24 bg-white py-24 sm:py-32">
        <div className="mx-auto grid max-w-[90rem] gap-14 px-5 sm:px-8 lg:grid-cols-[.85fr_1.15fr] lg:items-start lg:px-12">
          <div className="lg:sticky lg:top-28"><p className="section-kicker">Connect Member Benefits</p><h2 className="section-title">Local membership should actually get you something.</h2><p className="section-copy">Eligible participating businesses can provide private benefits specifically to Connect members—useful reasons to build a relationship, not a race to become the cheapest option.</p><div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-xs font-black uppercase tracking-[.14em] text-emerald-800">Available now</p><p className="mt-2 text-sm leading-6 text-emerald-950/75">Eligible profiles can publish a member benefit with business-defined terms. The kinds and reach of these benefits can grow with participation.</p></div></div>
          <div className="grid gap-3 sm:grid-cols-2">{memberBenefits.map((benefit) => <div key={benefit} className="flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 bg-[#fafbf8] px-5 text-sm font-bold text-slate-800"><Check aria-hidden="true" className="size-4 shrink-0 text-emerald-700" />{benefit}</div>)}</div>
        </div>
      </section>

      <section className="bg-[#e3f4e9] py-24 sm:py-32">
        <div className="mx-auto grid max-w-[90rem] gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_.9fr] lg:items-center lg:px-12">
          <div><p className="section-kicker">Business-to-business referrals</p><h2 className="section-title">The network behind your network.</h2><p className="section-copy">When a job crosses into another specialty, Connect is intended to help businesses find and recommend trusted local partners instead of starting another search from scratch.</p><p className="mt-6 text-sm leading-7 text-slate-600">These handoffs can help members create opportunities for one another instead of relying only on consumer searches. The referral workflow and referral intelligence remain on the roadmap.</p><span className="mt-7 inline-flex rounded-full bg-slate-950 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.14em] text-emerald-300">Roadmap direction—not yet a complete referral workflow</span></div>
          <div className="rounded-[2rem] border border-emerald-900/10 bg-white/75 p-6 shadow-xl shadow-emerald-950/5 sm:p-8"><Handshake aria-hidden="true" className="size-8 text-emerald-700" /><div className="mt-8 space-y-3">{["Roofer → carpenter", "Plumber → electrician", "Realtor → cleaner", "Property manager → appliance provider", "Contractor → specialist"].map((item) => <div key={item} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4"><span className="text-sm font-bold">{item}</span><ArrowRight aria-hidden="true" className="size-4 text-emerald-700" /></div>)}</div></div>
        </div>
      </section>

      <section id="property-management" className="scroll-mt-24 bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-[90rem] px-5 sm:px-8 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[1fr_.9fr] lg:items-end"><div className="max-w-4xl"><p className="section-kicker">First major use case</p><h2 className="section-title">Property management proves the network every day.</h2><p className="section-copy">Property managers repeatedly need dependable local businesses across many categories. Those recurring, real-world needs make property management a practical place to improve coordination and learn what useful local connections require.</p></div><aside className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50 p-7"><Building2 aria-hidden="true" className="size-7 text-emerald-700" /><p className="mt-6 text-lg font-bold text-emerald-950">The model extends beyond property management.</p><p className="mt-3 text-sm leading-7 text-emerald-900/75">Homeowners, realtors, businesses, HOAs, organizations, community institutions, and additional markets can use the same trusted-business and connection model.</p></aside></div>
          <div className="mt-12 flex flex-wrap gap-2">{propertyServices.map((service) => <span key={service} className="rounded-full border border-slate-200 bg-[#fafbf8] px-4 py-2 text-sm font-semibold text-slate-700">{service}</span>)}</div>
        </div>
      </section>

      <section className="bg-[#fff3ee] py-24 sm:py-28">
        <div className="mx-auto grid max-w-[90rem] gap-12 px-5 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:items-center lg:px-12">
          <div><span className="grid size-14 place-items-center rounded-2xl bg-orange-100 text-orange-700"><BellRing aria-hidden="true" className="size-6" /></span><p className="section-kicker mt-8 text-orange-700">Urgent and response-based services</p><h2 className="section-title">Availability matters most when waiting is costly.</h2><p className="section-copy">Profiles can indicate emergency-service capability today. Future availability signals could make urgent matching more useful and precise.</p><div className="mt-6 flex flex-wrap gap-2">{["Taking work", "Limited availability", "Booked"].map((status) => <span key={status} className="rounded-full border border-orange-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-orange-900">{status}</span>)}</div><p className="mt-6 text-xs font-semibold leading-5 text-slate-500">These live availability states are roadmap concepts and are not currently displayed on provider profiles. Connect does not replace 911, police, fire, EMS, or government emergency dispatch.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">{urgentServices.map((service) => <div key={service} className="flex min-h-16 items-center gap-3 rounded-2xl border border-orange-200 bg-white/80 px-5 text-sm font-bold"><Radio aria-hidden="true" className="size-4 shrink-0 text-orange-700" />{service}</div>)}</div>
        </div>
      </section>

      <section className="bg-slate-950 py-24 text-white sm:py-28">
        <div className="mx-auto grid max-w-[90rem] gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_.9fr] lg:items-center lg:px-12">
              <div><p className="section-kicker text-emerald-400">For local businesses</p><h2 className="section-title text-white">Help build the network from the beginning.</h2><p className="section-copy text-slate-400">Founding Members join while the original network, categories, reputation layer, member-benefit model, and matching direction are being developed. Membership is {founderPrice} per year and limited to {FOUNDING_MEMBER_OFFER.capacity} original positions, with current availability confirmed during enrollment.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><ArrowLink href="/memberships">{FOUNDING_MEMBER_OFFER.cta}</ArrowLink><ArrowLink href="/marketplace" light>Explore the Network</ArrowLink></div><p className="mt-5 text-xs leading-5 text-slate-500">Category eligibility is reviewed. Membership does not guarantee category exclusivity, leads, jobs, revenue, rank, or designation as the best match.</p></div>
          <div className="rounded-[2rem] border border-white/10 bg-white/[.05] p-7 sm:p-9"><BadgeCheck aria-hidden="true" className="size-7 text-emerald-400" /><h3 className="mt-7 text-2xl font-bold">Trust remains separate from paid visibility.</h3><p className="mt-4 text-sm leading-7 text-slate-400">Paid membership may provide profile access, recognition, and governed visibility. It does not override relevance, business information, profile review, or future trust and matching signals.</p></div>
        </div>
      </section>

      <section id="faq" className="bg-white py-24 sm:py-28">
        <div className="mx-auto grid max-w-[90rem] gap-14 px-5 sm:px-8 lg:grid-cols-[.65fr_1.35fr] lg:px-12"><div><p className="section-kicker">FAQ</p><h2 className="section-title">Clear about what Connect is—and where it is going.</h2><p className="section-copy text-base">Questions about participation? Email <a href="mailto:hello@optimizelocal.com" className="font-bold text-emerald-700 hover:text-emerald-800">hello@optimizelocal.com</a>.</p></div><div className="divide-y divide-slate-200 border-y border-slate-200">{faqs.map(([question, answer]) => <details key={question} className="group py-1"><summary className="flex min-h-18 cursor-pointer list-none items-center justify-between gap-5 py-5 text-left font-bold text-slate-900"><span>{question}</span><span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-lg font-light transition group-open:rotate-45">+</span></summary><p className="max-w-3xl pb-6 pr-12 text-sm leading-7 text-slate-600">{answer}</p></details>)}</div></div>
      </section>

      <section className="bg-white px-5 pb-5 sm:px-8 sm:pb-8 lg:px-12 lg:pb-12">
        <div className="relative mx-auto max-w-[90rem] overflow-hidden rounded-[2rem] bg-emerald-700 px-6 py-16 text-white sm:px-12 sm:py-20 lg:px-20"><div aria-hidden="true" className="absolute -right-24 -top-24 size-80 rounded-full border-[50px] border-white/5" /><div className="relative z-10 grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-200">Connect locally. Grow together.</p><h2 className="mt-5 max-w-4xl text-4xl font-semibold leading-[.96] tracking-[-.05em] sm:text-6xl lg:text-7xl">The local network that gets smarter every time you use it.</h2></div><div className="flex flex-col gap-3 sm:flex-row lg:flex-col"><ArrowLink href="/marketplace" light>Explore the Network</ArrowLink><ArrowLink href="/memberships" light>{FOUNDING_MEMBER_OFFER.cta}</ArrowLink></div></div></div>
      </section>

      <footer className="bg-white"><div className="mx-auto grid max-w-[90rem] gap-10 px-5 py-10 sm:px-8 md:grid-cols-[1fr_auto] md:items-end lg:px-12"><div><Logo /><p className="mt-5 max-w-md text-sm leading-6 text-slate-500">{PLATFORM_BRAND.description}</p></div><div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-500"><a href="#what-connect-does" className="hover:text-slate-900">What Connect Does</a><Link href="/marketplace" className="hover:text-slate-900">Network</Link><Link href="/memberships" className="hover:text-slate-900">Memberships</Link><Link href="/company" className="hover:text-slate-900">Company</Link><Link href="/sign-in" className="hover:text-slate-900">Sign in</Link></div></div><div className="mx-auto flex max-w-[90rem] flex-col gap-3 border-t border-slate-200 px-5 py-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12"><p>© 2026 {PLATFORM_BRAND.parentName}. {PLATFORM_BRAND.productName} is a platform of Optimize Local™.</p><p>{PLATFORM_BRAND.mission}</p></div></footer>
    </main>
  );
}
