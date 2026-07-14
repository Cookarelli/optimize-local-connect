import type { Metadata } from "next";
import { ResetPasswordForm } from "@/src/components/auth/reset-password-form";
import { Logo } from "@/src/components/brand/logo";
import { MissionSignature } from "@/src/components/brand/mission-signature";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return <main className="grid min-h-dvh place-items-center bg-stone-50 p-5"><div className="w-full max-w-md"><div className="mb-8"><Logo /></div><section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,.08)] sm:p-9"><p className="text-sm font-semibold text-emerald-700">Secure your account</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Choose a new password</h1><p className="mb-7 mt-2 text-sm leading-6 text-slate-500">Use a strong password you don’t use anywhere else.</p><ResetPasswordForm /></section><MissionSignature className="mt-6 text-center" /></div></main>;
}
