import Link from "next/link";
import { MembershipClaimStatus } from "@/src/components/founding-partner/membership-claim-status";
import { getCurrentUser } from "@/src/lib/auth/session";
import { safeInternalPath } from "@/src/lib/auth/routing";
import { claimGuestFoundingMembership } from "./actions";

const sessionPattern = /^cs_[A-Za-z0-9_]+$/;

export default async function MembershipClaimPage({ searchParams }: { searchParams: Promise<{ session_id?: string; error?: string }> }) {
  const params = await searchParams;
  const sessionId = params.session_id && sessionPattern.test(params.session_id) ? params.session_id : null;
  const user = await getCurrentUser();
  if (!sessionId) return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-bold">Secure claim link required</h1><p className="mt-3 text-slate-600">Return to the payment confirmation page to claim a verified membership.</p></main>;
  const next = safeInternalPath(`/membership/claim?session_id=${sessionId}`);
  return <main className="mx-auto flex min-h-dvh max-w-xl items-center p-5"><section className="w-full rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"><p className="text-sm font-bold text-emerald-700">Founding Vendor membership</p><h1 className="mt-2 text-3xl font-semibold">Claim your account</h1><p className="mt-3 text-slate-600">Use the same email address entered at checkout. Your account is connected only after payment is securely verified.</p><div className="mt-5"><MembershipClaimStatus sessionId={sessionId} /></div>{user ? <form action={claimGuestFoundingMembership} className="mt-6"><input type="hidden" name="session_id" value={sessionId}/><button className="min-h-11 rounded-full bg-emerald-700 px-5 text-sm font-bold text-white">Claim membership</button>{params.error ? <p className="mt-3 text-sm text-rose-700">Use the checkout email, or wait for payment verification to finish.</p> : null}</form> : <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="mt-6 inline-flex min-h-11 items-center rounded-full bg-emerald-700 px-5 text-sm font-bold text-white">Create or sign in to your account</Link>}</section></main>;
}
