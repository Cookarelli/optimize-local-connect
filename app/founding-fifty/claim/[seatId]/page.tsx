import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Award, Check } from "lucide-react";
import { Logo } from "@/src/components/brand/logo";
import { FoundingClaimForm } from "@/src/components/founding-fifty/claim-form";
import { formatFoundingNumber } from "@/src/lib/founding-fifty/board";
import { getCurrentUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ClaimSeatPage({ params }: { params: Promise<{ seatId: string }> }) {
  const { seatId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/founding-fifty/claim/${seatId}`)}`);
  const supabase = await createSupabaseServerClient();
  const { data: seat } = await supabase.from("founding_seats").select("id,seat_number,status,founding_verticals(name),founding_programs(price_cents,hold_minutes)").eq("id", seatId).single();
  if (!seat || seat.status !== "available") notFound();
  const vertical = seat.founding_verticals as unknown as { name: string } | null;
  const program = seat.founding_programs as unknown as { price_cents: number; hold_minutes: number } | null;
  if (!vertical || !program) notFound();
  return <main className="min-h-dvh bg-[#f7f8f4] text-slate-950"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-5 sm:px-8"><Link href="/"><Logo /></Link><Link href="/founding-fifty" className="flex min-h-11 items-center text-sm font-bold text-slate-600"><ArrowLeft className="mr-2 size-4" />Availability</Link></div></header><div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:px-8 sm:py-16 lg:grid-cols-[.65fr_1.35fr]"><aside className="h-fit rounded-[2rem] bg-slate-950 p-7 text-white lg:sticky lg:top-6"><div className="flex items-center justify-between"><Award className="size-7 text-amber-300" /><span className="text-2xl font-black text-amber-300">{formatFoundingNumber(seat.seat_number)}</span></div><p className="mt-10 text-xs font-black uppercase tracking-[.16em] text-emerald-400">Your industry seat</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">{vertical.name}</h1><p className="mt-6 text-5xl font-semibold tracking-[-.05em]">${(program.price_cents/100).toLocaleString("en-US")}</p><p className="mt-2 text-sm text-slate-400">one-time payment</p><ul className="mt-8 space-y-3 border-t border-white/10 pt-7 text-sm text-slate-300">{["12 months of Premium","Permanent Founding Fifty badge","Permanent founding number","Locked preferred renewal pricing"].map(item=><li key={item} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />{item}</li>)}</ul><p className="mt-8 rounded-xl bg-white/5 p-3 text-xs leading-5 text-slate-400">Submitting this form creates a {program.hold_minutes}-minute hold. The permanent assignment occurs only after verified payment.</p></aside><section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-9"><p className="section-kicker">Claim {formatFoundingNumber(seat.seat_number)}</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Tell us about your business.</h2><p className="mt-3 text-sm leading-6 text-slate-500">Most businesses finish this in a few minutes. Your contact details stay private.</p><div className="mt-8"><FoundingClaimForm seatId={seat.id} industry={vertical.name} email={user.email} contactName={user.fullName ?? ""} /></div></section></div></main>;
}
