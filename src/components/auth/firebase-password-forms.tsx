"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmPasswordReset, sendPasswordResetEmail, verifyPasswordResetCode } from "firebase/auth";
import { LoaderCircle, Mail } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { getFirebaseClientAuth } from "@/src/lib/firebase/client";

export function FirebaseForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim().toLowerCase();
    try {
      await sendPasswordResetEmail(getFirebaseClientAuth(), email, { url: `${window.location.origin}/sign-in` });
    } catch {
      // Deliberately return the same response so account existence is private.
    } finally {
      setMessage("If an account exists for that email, a reset link is on its way.");
      setPending(false);
    }
  }
  return <form onSubmit={submit} className="space-y-4"><label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-800">Work email</span><span className="relative block"><Mail className="absolute left-3.5 top-3.5 size-4 text-slate-400"/><input name="email" type="email" autoComplete="email" required className="min-h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"/></span></label><Button type="submit" className="w-full" disabled={pending}>{pending ? <LoaderCircle className="mr-2 size-4 animate-spin"/> : null}Send reset link</Button>{message ? <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}</form>;
}
export function FirebaseResetPasswordForm({ oobCode }: { oobCode: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) return setMessage("Use at least 12 characters with uppercase, lowercase, and a number.");
    if (password !== confirmation) return setMessage("Passwords do not match.");
    if (!oobCode) return setMessage("This recovery link is invalid or incomplete.");
    setPending(true);
    try {
      await verifyPasswordResetCode(getFirebaseClientAuth(), oobCode);
      await confirmPasswordReset(getFirebaseClientAuth(), oobCode, password);
      router.push("/sign-in?password=updated");
    } catch {
      setMessage("This recovery link has expired or was already used. Request a new one.");
      setPending(false);
    }
  }
  return <form onSubmit={submit} className="space-y-4"><label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-800">New password</span><input name="password" type="password" autoComplete="new-password" minLength={12} required className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"/><span className="mt-1.5 block text-xs text-slate-500">12+ characters with uppercase, lowercase, and a number.</span></label><label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-800">Confirm password</span><input name="confirmation" type="password" autoComplete="new-password" minLength={12} required className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"/></label><Button type="submit" className="w-full" disabled={pending}>{pending ? <LoaderCircle className="mr-2 size-4 animate-spin"/> : null}Update password</Button>{message ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{message}</p> : null}</form>;
}
