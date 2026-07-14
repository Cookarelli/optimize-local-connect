import type { Metadata } from "next";
import { AcceptInviteForm } from "@/src/components/auth/accept-invite-form";
import { Logo } from "@/src/components/brand/logo";

export const metadata: Metadata = { title: "Accept invitation" };

export default async function AcceptInvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return <div className="mx-auto max-w-lg py-16"><div className="mb-8"><Logo /></div><section className="rounded-[1.75rem] border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10"><p className="text-sm font-semibold text-emerald-700">Organization invitation</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Join your team in Connect™</h1><p className="mt-3 text-sm leading-6 text-slate-500">Your account email will be verified against this invitation before access is granted.</p>{token ? <AcceptInviteForm token={token} /> : <p className="mt-6 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">This invitation link is incomplete.</p>}</section></div>;
}
