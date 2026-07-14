import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/src/components/auth/forgot-password-form";
import { Logo } from "@/src/components/brand/logo";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return <main className="grid min-h-dvh place-items-center bg-stone-50 p-5"><div className="w-full max-w-md"><div className="mb-8"><Logo /></div><section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,.08)] sm:p-9"><p className="text-sm font-semibold text-emerald-700">Account recovery</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Reset your password</h1><p className="mb-7 mt-2 text-sm leading-6 text-slate-500">We’ll email a secure, single-use recovery link to your account.</p><ForgotPasswordForm /></section><p className="mt-6 text-center text-sm"><Link href="/sign-in" className="font-semibold text-slate-700 hover:underline">Back to sign in</Link></p></div></main>;
}
