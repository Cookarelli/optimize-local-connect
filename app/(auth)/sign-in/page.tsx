import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { SignInForm } from "@/src/components/auth/sign-in-form";
import { Logo } from "@/src/components/brand/logo";
import { MissionSignature } from "@/src/components/brand/mission-signature";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  return (
    <main className="grid min-h-dvh bg-stone-50 lg:grid-cols-[1.05fr_.95fr]">
      <section className="hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo inverse />
        <div className="max-w-lg">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">One operational source of truth</p>
          <h1 className="text-5xl font-semibold leading-[1.04] tracking-[-0.04em]">Every property. Every local provider. One calm workspace.</h1>
          <ul className="mt-8 space-y-4 text-slate-300">
            {["Verified local provider network", "Permissioned team workflows", "Multi-market visibility without the chaos"].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <CheckCircle2 aria-hidden="true" className="size-5 text-emerald-400" /> {item}
              </li>
            ))}
          </ul>
        </div>
        <MissionSignature inverse />
      </section>
      <section className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden"><Logo /></div>
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,.08)] sm:p-9">
            <p className="text-sm font-semibold text-emerald-700">Welcome back</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Sign in to Connect™</h2>
            <p className="mb-7 mt-2 text-sm leading-6 text-slate-500">Access is invite-only for verified property teams and service partners.</p>
            <SignInForm next={params.next} />
            {params.error ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">That sign-in link could not be completed. Please try again.</p> : null}
          </div>
          <p className="mt-6 text-center text-sm text-slate-500">Need access? <Link href="/#contact" className="font-semibold text-slate-900 underline-offset-4 hover:underline">Request early access</Link></p>
          <MissionSignature className="mt-5 text-center lg:hidden" />
        </div>
      </section>
    </main>
  );
}
