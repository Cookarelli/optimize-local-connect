import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, Award, Building2, Check, Clock3, Crown, MapPin, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Logo } from "@/src/components/brand/logo";
import type { FoundingSeat } from "@/src/domain/founding-fifty/types";
import { PLATFORM_BRAND } from "@/src/domain/platform/brand";
import { formatFoundingNumber, getFoundingBoard } from "@/src/lib/founding-fifty/board";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Founding Fifty",
  description: "Fifty local businesses. Twenty-five industries. One mission: build stronger local economies.",
  openGraph: {
    title: "The Founding Fifty",
    description: "50 Local Businesses. 25 Industries. One Mission.",
    images: [{ url: "/og-founding-fifty.png", width: 1536, height: 1024, alt: "The Founding Fifty — 50 Local Businesses. 25 Industries. One Mission." }],
  },
  twitter: { card: "summary_large_image", images: ["/og-founding-fifty.png"] },
};

const statusCopy = {
  available: "Available",
  pending_payment: "Temporarily held",
  claimed: "Founding member",
  reserved: "Reserved",
  disabled: "Unavailable",
} as const;

function SeatCard({ seat, priceCents }: { seat: FoundingSeat; priceCents: number }) {
  const available = seat.status === "available";
  const claimed = seat.status === "claimed";
  return <article className={`flex min-h-60 flex-col rounded-[1.5rem] border p-5 transition ${available ? "border-emerald-200 bg-emerald-50/60 shadow-sm hover:-translate-y-0.5 hover:shadow-lg" : claimed ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white" : "border-slate-200 bg-slate-50"}`}>
    <div className="flex items-center justify-between gap-3">
      <span className={`text-lg font-black tracking-[-.03em] ${claimed ? "text-amber-700" : "text-slate-900"}`}>{formatFoundingNumber(seat.seatNumber)}</span>
      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em] ${available ? "bg-emerald-700 text-white" : claimed ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-600"}`}>{statusCopy[seat.status]}</span>
    </div>
    {claimed ? <div className="mt-5 flex flex-1 flex-col">
      <div className="relative grid size-14 place-items-center overflow-hidden rounded-2xl border border-amber-200 bg-white text-lg font-black text-amber-700">{seat.logoUrl ? <Image src={seat.logoUrl} alt="" fill sizes="56px" unoptimized className="object-contain p-1" /> : seat.businessName?.slice(0, 2).toUpperCase()}</div>
      <h3 className="mt-4 text-lg font-bold text-slate-950">{seat.businessName}</h3>
      {seat.city ? <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><MapPin className="size-3.5" />{seat.city}</p> : null}
      <p className="mt-auto flex items-center gap-1.5 pt-5 text-xs font-bold text-amber-700"><Award className="size-4" />Founding Fifty</p>
    </div> : available ? <div className="flex flex-1 flex-col">
      <p className="mt-5 text-2xl font-bold tracking-tight">${(priceCents / 100).toLocaleString("en-US")} <span className="text-xs font-semibold text-slate-500">one-time</span></p>
      <ul className="mt-4 space-y-2 text-xs leading-5 text-slate-600"><li className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-emerald-700" />12 months Premium</li><li className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-emerald-700" />Permanent badge and number</li><li className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-emerald-700" />Preferred renewal pricing</li></ul>
      <Link href="/founders" className="mt-auto inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-emerald-700">Start secure checkout <ArrowRight className="ml-2 size-4" /></Link>
    </div> : <div className="flex flex-1 flex-col justify-center py-6"><p className="text-lg font-bold text-slate-800">{seat.businessName ?? statusCopy[seat.status]}</p>{seat.status === "pending_payment" ? <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><Clock3 className="size-3.5" />Checkout in progress</p> : null}<p className="mt-4 text-xs leading-5 text-slate-500">This seat cannot accept another payment.</p></div>}
  </article>;
}

export default async function FoundingFiftyPage() {
  const board = await getFoundingBoard();
  const progress = Math.round((board.claimedCount / board.program.totalSeats) * 100);
  return <main className="min-h-dvh bg-[#f7f8f4] text-slate-950">
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-[#f7f8f4]/90 backdrop-blur-xl"><div className="mx-auto flex h-18 max-w-[90rem] items-center justify-between px-5 sm:px-8 lg:px-12"><Link href="/"><Logo /></Link><div className="flex items-center gap-2"><Link href="/founders" className="hidden min-h-11 items-center rounded-full px-4 text-sm font-semibold text-slate-600 hover:bg-white sm:inline-flex">Offer details</Link><Link href="/sign-in?next=/founding-fifty" className="inline-flex min-h-11 items-center rounded-full bg-slate-950 px-5 text-sm font-bold text-white hover:bg-emerald-700">Sign in</Link></div></div></header>

    <section className="relative isolate overflow-hidden bg-slate-950 text-white"><div aria-hidden className="absolute -right-40 -top-40 size-[38rem] rounded-full border-[90px] border-emerald-400/5" /><div className="mx-auto grid max-w-[90rem] gap-14 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1.15fr_.85fr] lg:items-end lg:px-12 lg:py-36"><div><div className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3.5 py-2 text-xs font-black uppercase tracking-[.18em] text-amber-300"><Crown className="size-3.5" /> The Founding Fifty</div><h1 className="mt-7 text-[clamp(3.4rem,8vw,8rem)] font-semibold leading-[.86] tracking-[-.07em]">50 Local<br />Businesses.<br /><span className="text-emerald-400">25 Industries.</span><br />One Mission.</h1><p className="mt-8 max-w-2xl text-lg leading-8 text-slate-300">The first fifty businesses helping build the future of how local companies, property managers, and communities work together.</p><div className="mt-9 flex flex-col gap-3 sm:flex-row"><a href="#availability" className="inline-flex min-h-12 items-center justify-center rounded-full bg-emerald-400 px-6 text-sm font-black text-emerald-950 hover:bg-emerald-300">View Available Industries <ArrowDown className="ml-2 size-4" /></a><a href="#benefits" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 px-6 text-sm font-bold text-white hover:bg-white/5">See member benefits</a></div></div>
      <aside className="rounded-[2rem] border border-white/10 bg-white/[.055] p-6 backdrop-blur sm:p-8"><div className="flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-slate-400">Founding wall progress</p><p className="mt-3 text-5xl font-semibold tracking-[-.05em]">{board.claimedCount}<span className="text-xl text-slate-500"> / 50</span></p></div><Award className="size-10 text-amber-300" strokeWidth={1.4} /></div><div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-300" style={{ width: `${progress}%` }} /></div><p className="mt-4 text-sm leading-6 text-slate-400">{board.claimedCount} of 50 Founding Fifty seats claimed. Only two seats are available in each industry.</p><div className="mt-7 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white/5 p-4"><p className="text-2xl font-bold">25</p><p className="mt-1 text-xs text-slate-400">Launch industries</p></div><div className="rounded-2xl bg-white/5 p-4"><p className="text-2xl font-bold">$299</p><p className="mt-1 text-xs text-slate-400">One-time</p></div></div></aside>
    </div></section>

    <section className="border-b border-slate-200 bg-white py-8"><div className="mx-auto grid max-w-[90rem] gap-5 px-5 text-sm text-slate-600 sm:grid-cols-3 sm:px-8 lg:px-12">{[[ShieldCheck,"Permanent founding number","Each confirmed member keeps its unique number."],[Users,"Two per industry","Real category exclusivity without invented scarcity."],[Building2,"Built for local impact","A cohort committed to stronger local economies."]].map(([Icon,title,copy])=>{const C=Icon as typeof ShieldCheck;return <div key={title as string} className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50"><C className="size-4.5 text-emerald-700" /></span><div><p className="font-bold text-slate-900">{title as string}</p><p className="mt-1 text-xs leading-5">{copy as string}</p></div></div>})}</div></section>

    <section id="availability" className="scroll-mt-24 py-20 sm:py-28"><div className="mx-auto max-w-[90rem] px-5 sm:px-8 lg:px-12"><div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div className="max-w-3xl"><p className="section-kicker">Live availability</p><h2 className="section-title">Choose your industry.<br />Claim your place.</h2><p className="section-copy">Each industry has exactly two permanent Founding Fifty numbers. Holds last {board.program.holdMinutes} minutes while checkout is completed.</p></div><div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm"><span className="font-bold text-emerald-700">{board.program.totalSeats - board.unavailableCount}</span> seats currently available</div></div>
      {!board.isLive ? <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">Live seat status is temporarily unavailable. The direct Founding Partner checkout will verify total program capacity before creating a payment session.</div> : null}
      <div className="mt-14 grid gap-6 xl:grid-cols-2">{board.verticals.map((vertical)=><section key={vertical.id} id={vertical.slug} className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.15em] text-emerald-700">Industry {vertical.displayOrder.toString().padStart(2,"0")}</p><h3 className="mt-2 text-2xl font-bold tracking-tight">{vertical.name}</h3><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{vertical.description}</p></div><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-sm font-black text-emerald-300">2</span></div><div className="mt-6 grid gap-3 sm:grid-cols-2">{vertical.seats.map((seat)=><SeatCard key={seat.id} seat={seat} priceCents={board.program.priceCents} />)}</div></section>)}</div>
    </div></section>

    <section id="benefits" className="scroll-mt-24 bg-white py-20 sm:py-28"><div className="mx-auto max-w-[90rem] px-5 sm:px-8 lg:px-12"><div className="max-w-3xl"><p className="section-kicker">Founding member benefits</p><h2 className="section-title">Recognition that lasts.<br />Access that matters.</h2><p className="section-copy">Designed for the local businesses willing to help shape a better way for communities to work together.</p></div><div className="mt-14 grid gap-px overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">{board.benefits.map((benefit,index)=><article key={benefit.id} className="bg-white p-6 sm:p-7"><span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-sm font-black text-emerald-700">{(index+1).toString().padStart(2,"0")}</span><h3 className="mt-8 text-lg font-bold">{benefit.name}</h3><p className="mt-3 text-sm leading-6 text-slate-500">{benefit.description}</p></article>)}</div></div></section>

    <section className="bg-emerald-700 px-5 py-20 text-white sm:px-8 sm:py-28"><div className="mx-auto max-w-5xl text-center"><Sparkles className="mx-auto size-7 text-emerald-200" /><blockquote className="mt-7 text-4xl font-semibold leading-tight tracking-[-.045em] sm:text-6xl">“We’re not building software.<br />We’re building stronger local economies—one optimized decision at a time.”</blockquote><p className="mt-8 text-xs font-black uppercase tracking-[.2em] text-emerald-200">{PLATFORM_BRAND.parentName}</p><a href="#availability" className="mt-10 inline-flex min-h-12 items-center rounded-full bg-white px-6 text-sm font-black text-emerald-800 hover:bg-emerald-50">Become One of the Founding Fifty <ArrowRight className="ml-2 size-4" /></a></div></section>
    <footer className="bg-white"><div className="mx-auto flex max-w-[90rem] flex-col gap-6 px-5 py-9 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12"><Logo /><div className="flex flex-wrap gap-5 text-sm text-slate-500"><Link href="/">Platform</Link><Link href="/company">Company</Link><Link href="/sign-in?next=/founding-fifty">Sign in</Link></div></div></footer>
  </main>;
}
