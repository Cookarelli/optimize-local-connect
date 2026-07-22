import type { Metadata } from "next";
import Link from "next/link";
import {
  Award,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Check,
  ClipboardCheck,
  Clock3,
  Handshake,
  ListChecks,
  LockKeyhole,
  MapPin,
  MessageSquareText,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  Wrench,
} from "lucide-react";
import { Logo } from "@/src/components/brand/logo";
import { GuestFoundingCheckoutForm } from "@/src/components/founding-partner/guest-checkout-form";
import { FOUNDING_PARTNER_PLAN, FOUNDING_PARTNER_RENEWAL_DISCLOSURE, formatVendorPlanPrice, normalizeVendorPlanKey } from "@/src/domain/vendor-memberships/catalog";
import { FOUNDING_VENDOR_RESERVED_CATEGORIES, FOUNDING_VENDOR_RESERVATION_SUMMARY } from "@/src/domain/founding-partner/reserved-spots";

const founderPrice = formatVendorPlanPrice(FOUNDING_PARTNER_PLAN);

export const metadata: Metadata = {
  title: "Vendor Memberships",
  description:
    "Choose the plan that fits your business: Founder, Preferred, or Network.",
  alternates: { canonical: "https://www.optimizelocalai.com/memberships" },
  openGraph: {
    title: "Optimize Local Connect Vendor Memberships",
    description: `${founderPrice}. Preferred visibility, early access, and Founder recognition while the membership remains eligible.`,
    images: [{ url: "/og-founders.png", width: 1536, height: 1024, alt: "Optimize Local Connect Vendor Memberships" }],
  },
  twitter: { card: "summary_large_image", images: ["/og-founders.png"] },
};

const benefits = [
  [Award, "Founder badge", "Founder recognition remains active while your annual membership is current."],
  [Store, "Enhanced vendor profile", "A richer place to present your business, experience, and customer-facing details."],
  [SearchCheck, "Priority marketplace placement", "Preferred visibility during the founding period, subject to relevance, verification, and marketplace rules."],
  [MapPin, "Services and service areas", "List what you do and the communities your team is prepared to serve."],
  [Handshake, "Direct contact opportunities", "Qualified buyers can request service or contact your business through your marketplace profile."],
  [Sparkles, "Early product access", "Get access to selected new marketplace tools as they become available."],
  [MessageSquareText, "A voice in the product", "Share practical feedback from the field and help us prioritize what local vendors need."],
  [ShieldCheck, "Annual membership", `Your ${founderPrice} Founder membership renews annually unless you cancel before the renewal date.`],
] as const;

const audiences = [
  "Plumbers",
  "Electricians",
  "HVAC companies",
  "Flooring installers",
  "Landscapers",
  "Remodelers",
  "Appliance professionals",
  "Cleaning companies",
  "Handymen",
  "Other local home-service vendors",
];

const steps = [
  ["01", "Join", `Enter your business details and complete Stripe's hosted checkout. Your ${founderPrice} annual membership begins immediately.`],
  ["02", "Submit business details", "Tell us who you serve, what work you perform, and where your team operates."],
  ["03", "Profile reviewed", "We review business information and may request credentials before the listing is published."],
  ["04", "Listing activated", "Approved profiles become available in the marketplace with their Founding Partner recognition."],
] as const;

const faqs = [
  ["Is this a subscription?", `Yes. The Founder membership is ${founderPrice} per year and renews annually unless you cancel before the renewal date.`],
  ["Are leads or revenue guaranteed?", "No. Optimize Local Connect does not guarantee leads, jobs, revenue, marketplace rank, or a return on the membership. The opportunity is preferred visibility and early participation in a growing local marketplace."],
  ["What happens after payment?", "Stripe sends the payment result directly to our server. After the payment is verified, we save your Founding Partner record and prepare your business information for review. A browser confirmation alone never activates a membership."],
  ["Can any business join?", "The offer is intended for legitimate local service businesses. Applications may be reviewed for fit, quality, category availability, and the information or credentials needed for a trustworthy marketplace."],
  ["When will the marketplace be fully available?", "Optimize Local Connect is being introduced in stages. Founding Partners are joining during the early marketplace period, before every planned buyer, market, and tool is available."],
  ["What information is needed?", "Stripe first collects your email and business name. After verified payment, you will add a contact name, phone, website if available, service category, city, and a short business description for review."],
] as const;

const membershipCards = [
  { key: "founding_partner", name: "Founder", price: "$299/year", badge: "Founder Badge", features: ["Highest placement", "Founder recognition", "Early access", "Featured profile"] },
  { key: "preferred", name: "Preferred", price: "$49/month", badge: "Preferred Badge", features: ["Higher placement", "Preferred badge", "Enhanced profile"] },
  { key: "network", name: "Network", price: "$19/month", badge: "Network Badge", features: ["Listed in marketplace", "Vendor profile", "Opportunity access"] },
] as const;

export default async function FoundersPage({ searchParams }: { searchParams: Promise<{ checkout?: string; onboarding?: string; plan?: string }> }) {
  const { checkout, onboarding, plan: requestedPlan } = await searchParams;
  const selectedPlan = normalizeVendorPlanKey(requestedPlan ?? "") ?? "founding_partner";
  const checkoutMessage = checkout === "cancelled"
    ? "Checkout was cancelled. You were not charged and can restart whenever you are ready."
    : checkout === "sold_out"
      ? "Founding Partner enrollment is currently full. No payment session was created."
      : checkout === "unavailable"
        ? "Secure checkout is temporarily unavailable. Please try again shortly."
        : onboarding === "access_required"
          ? "Open the secure profile link from your verified payment confirmation, or sign in with the email used at checkout."
          : onboarding === "payment_not_verified"
            ? "We could not find a verified paid Founding Partner record for that profile link."
            : onboarding === "access_unavailable"
              ? "Profile access is temporarily unavailable. Please try the link from your payment confirmation again."
              : null;
  return (
    <main className="min-h-dvh bg-[#f7f8f4] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-[#f7f8f4]/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-18 max-w-[90rem] items-center justify-between gap-4 px-5 py-3 sm:px-8 lg:px-12">
          <Logo />
          <nav aria-label="Founding Partner page" className="flex items-center gap-1 sm:gap-3">
            <a href="#details" className="hidden min-h-11 items-center rounded-full px-4 text-sm font-semibold text-slate-600 hover:bg-white lg:inline-flex">What you receive</a>
            <a href="#faq" className="hidden min-h-11 items-center rounded-full px-4 text-sm font-semibold text-slate-600 hover:bg-white sm:inline-flex">FAQ</a>
            <a href="#checkout" className="inline-flex min-h-11 items-center rounded-full bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">Join now</a>
          </nav>
        </div>
      </header>

      {checkoutMessage ? <div role="status" className={`border-b px-5 py-3 text-center text-sm font-semibold ${checkout === "cancelled" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-rose-200 bg-rose-50 text-rose-800"}`}>{checkoutMessage}</div> : null}

      <section className="relative isolate overflow-hidden bg-slate-950 text-white">
        <div aria-hidden="true" className="absolute -right-48 -top-52 size-[42rem] rounded-full border-[100px] border-emerald-400/[.055]" />
        <div aria-hidden="true" className="absolute -bottom-56 -left-56 size-[34rem] rounded-full bg-emerald-500/[.06] blur-3xl" />
        <div className="relative mx-auto grid max-w-[90rem] gap-14 px-5 py-18 sm:px-8 sm:py-24 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:px-12 lg:py-30">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3.5 py-2 text-xs font-black uppercase tracking-[.16em] text-amber-300">
              <Award aria-hidden="true" className="size-3.5" /> Limited Founding Partner opportunity
            </p>
            <h1 className="mt-7 max-w-5xl text-[clamp(3.2rem,7.5vw,7.4rem)] font-semibold leading-[.88] tracking-[-.065em]">
              Choose the plan that fits your <span className="text-emerald-400">business.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
              Join Optimize Local Connect early and give your service business preferred visibility with property managers, real estate professionals, landlords, homeowners, and other local buyers.
            </p>
            <div id="reserved-spots" className="mt-6 flex max-w-2xl flex-wrap items-center gap-2 scroll-mt-24" aria-label={FOUNDING_VENDOR_RESERVATION_SUMMARY}><span className="rounded-full bg-amber-300 px-3 py-1.5 text-xs font-black uppercase tracking-[.1em] text-amber-950">{FOUNDING_VENDOR_RESERVATION_SUMMARY}</span>{FOUNDING_VENDOR_RESERVED_CATEGORIES.map((category) => <span key={category} className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-white">{category} occupied</span>)}</div>
            <div id="checkout" className="mt-9 max-w-xl scroll-mt-24"><GuestFoundingCheckoutForm defaultPlan={selectedPlan} /></div>
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-300"><LockKeyhole aria-hidden="true" className="size-4 text-emerald-400" />Secure checkout through Stripe</p>
            <p className="mt-5 max-w-xl text-sm leading-6 text-slate-400">Click to open Stripe’s hosted checkout. After Stripe verifies payment with our server, you will complete the business profile that goes to admin review.</p>
          </div>

          <aside className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.06] shadow-2xl shadow-black/20 backdrop-blur">
            <div className="border-b border-white/10 p-6 sm:p-8">
              <p className="text-xs font-black uppercase tracking-[.18em] text-emerald-400">Founding Partner membership</p>
              <div className="mt-5 flex items-end gap-3"><span className="text-7xl font-semibold tracking-[-.07em]">${FOUNDING_PARTNER_PLAN.amountCents / 100}</span><span className="pb-2 text-sm font-bold text-slate-400">per year</span></div>
              <p className="mt-3 text-sm font-semibold text-emerald-300">Renews annually unless you cancel before the renewal date.</p>
              <p className="mt-5 text-base leading-7 text-slate-300">One good job can cover the cost. The membership creates opportunity; it does not promise leads or revenue.</p>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
              {["Founding Partner badge", "Enhanced profile", "Priority placement", "No auto-renewal"].map((item) => (
                <p key={item} className="flex gap-2 text-sm leading-6 text-slate-200"><Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-emerald-400" />{item}</p>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section id="plans" className="scroll-mt-24 border-b border-slate-200 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-[90rem] px-5 sm:px-8 lg:px-12">
          <p className="section-kicker">Membership plans</p>
          <h2 className="section-title">Choose the presence that fits your business.</h2>
          <div className="mt-9 grid gap-4 lg:grid-cols-3">
            {membershipCards.map((plan) => <article key={plan.key} className={`flex flex-col rounded-[1.5rem] border p-6 ${plan.key === "founding_partner" ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-[#f7f8f4]"}`}><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">{plan.badge}</p><h3 className="mt-4 text-2xl font-bold">{plan.name}</h3><p className="mt-3 text-3xl font-semibold">{plan.price}</p><ul className="mt-6 space-y-3 border-t border-slate-200 pt-5">{plan.features.map(feature => <li key={feature} className="flex gap-2 text-sm text-slate-600"><Check aria-hidden="true" className="size-4 shrink-0 text-emerald-600" />{feature}</li>)}</ul><a href={`/memberships?plan=${plan.key}#checkout`} className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-bold text-white hover:bg-emerald-700">Choose Plan</a></article>)}
          </div>
        </div>
      </section>

      <section aria-label="Offer summary" className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-[90rem] gap-px bg-slate-200 sm:grid-cols-3">
          {[
            [BriefcaseBusiness, "Built for working service businesses", "A straightforward annual membership through Stripe."],
            [Users, "Reach local decision-makers", "A profile designed for the people who hire local vendors."],
            [Clock3, "Join during the early marketplace period", "Receive early-partner recognition as Connect grows."],
          ].map(([Icon, title, copy]) => {
            const ItemIcon = Icon as typeof Building2;
            return <div key={title as string} className="flex gap-4 bg-white px-5 py-7 sm:px-8 lg:px-12"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-50"><ItemIcon aria-hidden="true" className="size-5 text-emerald-700" /></span><div><h2 className="font-bold">{title as string}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{copy as string}</p></div></div>;
          })}
        </div>
      </section>

      <section id="details" className="scroll-mt-24 py-20 sm:py-28">
        <div className="mx-auto max-w-[90rem] px-5 sm:px-8 lg:px-12">
          <div className="max-w-3xl">
            <p className="section-kicker">What you receive</p>
            <h2 className="section-title">A stronger marketplace presence from the start.</h2>
            <p className="section-copy">Practical tools and recognition for local vendors who want to establish their presence early—not a promise of leads.</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map(([Icon, title, copy]) => <article key={title} className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm"><span className="grid size-11 place-items-center rounded-2xl bg-emerald-50"><Icon aria-hidden="true" className="size-5 text-emerald-700" /></span><h3 className="mt-7 text-lg font-bold">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-500">{copy}</p></article>)}
          </div>
        </div>
      </section>

      <section className="bg-[#e3f4e9] py-20 sm:py-28">
        <div className="mx-auto grid max-w-[90rem] gap-12 px-5 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:items-start lg:px-12">
          <div className="lg:sticky lg:top-28">
            <p className="section-kicker">Who it is for</p>
            <h2 className="section-title">Local experts who want to be easier to hire.</h2>
            <p className="section-copy">Best suited to established or growing home-service businesses that serve a defined local area and are willing to keep their information current.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {audiences.map((audience) => <div key={audience} className="flex min-h-16 items-center gap-3 rounded-2xl border border-emerald-900/10 bg-white/80 px-5 text-sm font-bold text-slate-800"><Wrench aria-hidden="true" className="size-4 shrink-0 text-emerald-700" />{audience}</div>)}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-[90rem] px-5 sm:px-8 lg:px-12">
          <div className="max-w-3xl"><p className="section-kicker">How it works</p><h2 className="section-title">From checkout to a reviewed marketplace profile.</h2></div>
          <ol className="mt-12 grid gap-px overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-200 md:grid-cols-2 xl:grid-cols-4">
            {steps.map(([number, title, copy]) => <li key={number} className="bg-white p-6 sm:p-8"><span className="font-mono text-sm font-bold text-emerald-700">{number}</span><h3 className="mt-10 text-xl font-bold">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-500">{copy}</p></li>)}
          </ol>
        </div>
      </section>

      <section className="bg-slate-950 py-20 text-white sm:py-28">
        <div className="mx-auto grid max-w-[90rem] gap-12 px-5 sm:px-8 lg:grid-cols-[.85fr_1.15fr] lg:items-center lg:px-12">
          <div><ShieldCheck aria-hidden="true" className="size-8 text-emerald-400" /><p className="mt-7 text-xs font-black uppercase tracking-[.18em] text-emerald-400">Trust and transparency</p><h2 className="mt-4 text-4xl font-semibold leading-tight tracking-[-.05em] sm:text-6xl">Early opportunity.<br />Clear expectations.</h2></div>
          <div className="grid gap-4">
            {[
              [SearchCheck, "No guaranteed leads or revenue", "Visibility can create opportunities, but buyer demand, job volume, ranking, and business results are never guaranteed."],
              [ClipboardCheck, "Quality and category review", "We may review applications, business details, credentials, service fit, and category availability before publishing a listing."],
              [ListChecks, "A marketplace still growing", "This is an early Founding Partner opportunity. Buyer participation, service areas, and marketplace tools will expand over time."],
            ].map(([Icon, title, copy]) => {
              const ItemIcon = Icon as typeof BadgeCheck;
              return <article key={title as string} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[.055] p-5 sm:p-6"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-400/10"><ItemIcon aria-hidden="true" className="size-5 text-emerald-400" /></span><div><h3 className="font-bold">{title as string}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{copy as string}</p></div></article>;
            })}
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-24 bg-white py-20 sm:py-28">
        <div className="mx-auto grid max-w-[90rem] gap-12 px-5 sm:px-8 lg:grid-cols-[.65fr_1.35fr] lg:px-12">
          <div><p className="section-kicker">FAQ</p><h2 className="section-title">The practical questions, answered.</h2></div>
          <div className="divide-y divide-slate-200 border-y border-slate-200">
            {faqs.map(([question, answer]) => <details key={question} className="group py-1"><summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-4 text-left font-bold marker:hidden"><span>{question}</span><span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-lg transition group-open:rotate-45">+</span></summary><p className="max-w-3xl pb-6 pr-12 text-sm leading-7 text-slate-600">{answer}</p></details>)}
          </div>
        </div>
      </section>

      <section className="px-5 pb-5 sm:px-8 sm:pb-8 lg:px-12 lg:pb-12">
        <div className="relative mx-auto max-w-[90rem] overflow-hidden rounded-[2rem] bg-emerald-700 px-6 py-14 text-white sm:px-12 sm:py-18 lg:px-18">
          <div aria-hidden="true" className="absolute -right-28 -top-28 size-80 rounded-full border-[52px] border-white/[.06]" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-200">Optimize Local Connect Founder</p><h2 className="mt-5 max-w-4xl text-4xl font-semibold leading-[.98] tracking-[-.05em] sm:text-6xl">Make your local business easier to find—and easier to choose.</h2><p className="mt-5 max-w-2xl text-base leading-7 text-emerald-100">{founderPrice}. Renews annually unless canceled. Limited availability; no guaranteed leads.</p><p className="mt-3 max-w-2xl text-xs leading-5 text-emerald-200">{FOUNDING_PARTNER_RENEWAL_DISCLOSURE}</p></div>
            <div className="flex flex-col items-start gap-3 lg:items-stretch"><a href="#checkout" className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-bold text-emerald-800 hover:bg-emerald-50">Join now</a><a href="#reserved-spots" className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/25 px-5 text-sm font-bold text-white hover:bg-white/10">Review reserved categories</a></div>
          </div>
        </div>
      </section>

      <footer className="bg-white">
        <div className="mx-auto flex max-w-[90rem] flex-col gap-6 px-5 py-9 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <Logo />
          <div className="flex flex-wrap gap-5 text-sm text-slate-500"><Link href="/">Platform</Link><Link href="/company">Company</Link><Link href="/memberships">Vendor Memberships</Link><Link href="/sign-in">Vendor or Staff Login</Link></div>
        </div>
      </footer>
    </main>
  );
}
