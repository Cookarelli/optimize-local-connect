import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Award, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { Logo } from "@/src/components/brand/logo";
import { formatFoundingNumber } from "@/src/lib/founding-fifty/board";
import { getCurrentUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function FoundingConfirmationPage({ params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/founding-fifty/confirmation/${claimId}`)}`);
  const supabase = await createSupabaseServerClient();
  const { data: claim } = await supabase.from("founding_claims").select("id,business_name,status,expires_at,confirmed_at,founding_seats(seat_number,founding_verticals(name))").eq("id", claimId).eq("user_id", user.id).single();
  if (!claim) notFound();
  const seat = claim.founding_seats as unknown as { seat_number: number; founding_verticals: { name: string } | null } | null;
  if (!seat) notFound();
  const confirmed = claim.status === "confirmed";
  const failed = ["rejected", "expired", "payment_failed", "payment_cancelled"].includes(claim.status);
  return <main className="grid min-h-dvh place-items-center bg-[#f7f8f4] px-5 py-12 text-slate-950"><div className="w-full max-w-2xl"><div className="mb-8 flex justify-center"><Link href="/"><Logo /></Link></div><section className="rounded-[2rem] border border-slate-200 bg-white p-7 text-center shadow-xl shadow-slate-950/5 sm:p-12">{confirmed ? <CheckCircle2 className="mx-auto size-14 text-emerald-600" /> : failed ? <XCircle className="mx-auto size-14 text-rose-600" /> : <Clock3 className="mx-auto size-14 text-amber-600" />}<p className="mt-7 text-xs font-black uppercase tracking-[.18em] text-emerald-700">The Founding Fifty · {formatFoundingNumber(seat.seat_number)}</p><h1 className="mt-3 text-3xl font-semibold tracking-[-.04em] sm:text-5xl">{confirmed ? "Welcome to the Founding Fifty." : failed ? "This seat hold has ended." : "Your seat is awaiting verification."}</h1><p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-slate-600">{confirmed ? `${claim.business_name} is now the permanent Founding Fifty member for ${seat.founding_verticals?.name}. Your Premium year, badge, benefits, and founding number are active.` : failed ? "No permanent assignment was made. Your claim remains in our records, and any available seat can be claimed again." : "We saved your claim and temporarily protected the seat. Stripe confirmation normally arrives within moments; the seat becomes permanent only after the server verifies the completed $299 payment."}</p>{confirmed ? <div className="mx-auto mt-8 grid size-24 place-items-center rounded-[2rem] bg-amber-50"><Award className="size-11 text-amber-700" /></div> : null}<div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/founding-fifty" className="inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-black text-white hover:bg-emerald-700">View Founding Fifty Wall <ArrowRight className="ml-2 size-4" /></Link><Link href="/dashboard" className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-200 px-6 text-sm font-bold text-slate-700 hover:bg-slate-50">Go to dashboard</Link></div></section></div></main>;
}
