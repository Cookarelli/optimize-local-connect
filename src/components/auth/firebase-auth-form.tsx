"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, LoaderCircle, Mail } from "lucide-react";
import { createUserWithEmailAndPassword, GoogleAuthProvider, sendEmailVerification, signInWithEmailAndPassword, signInWithPopup, type User } from "firebase/auth";
import { Button } from "@/src/components/ui/button";
import { getFirebaseClientAuth } from "@/src/lib/firebase/client";

async function createServerSession(idToken: string) {
  const csrfResponse = await fetch("/api/auth/firebase/csrf", { cache: "no-store", credentials: "same-origin" });
  if (!csrfResponse.ok) throw new Error("Unable to start a secure session.");
  const { token } = await csrfResponse.json() as { token: string };
  const response = await fetch("/api/auth/firebase/session", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "x-csrf-token": token },
    body: JSON.stringify({ idToken }),
  });
  const result = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Unable to establish a secure session.");
}

export function FirebaseAuthForm({ next, allowSignup }: { next: string; allowSignup: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">(allowSignup ? "signup" : "signin");

  async function finish(user: User) {
    if (!user.emailVerified) {
      await sendEmailVerification(user);
      setMessage("Verify your email using the link we sent, then sign in.");
      return;
    }
    await createServerSession(await user.getIdToken(true));
    router.push(next);
    router.refresh();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    const password = String(data.get("password") ?? "");
    try {
      const auth = getFirebaseClientAuth();
      const credential = mode === "signup"
        ? await createUserWithEmailAndPassword(auth, email, password)
        : await signInWithEmailAndPassword(auth, email, password);
      await finish(credential.user);
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      setMessage(code.includes("email-already-in-use") ? "An account already exists. Sign in instead." : "Authentication failed. Check your details and try again.");
    } finally {
      setPending(false);
    }
  }

  async function google() {
    setPending(true);
    setMessage(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await finish((await signInWithPopup(getFirebaseClientAuth(), provider)).user);
    } catch {
      setMessage("Google sign-in could not be completed.");
    } finally {
      setPending(false);
    }
  }

  return <div className="space-y-5">
    <form onSubmit={submit} className="space-y-4">
      <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-800">Work email</span><span className="relative block"><Mail aria-hidden="true" className="absolute left-3.5 top-3.5 size-4 text-slate-400"/><input name="email" type="email" autoComplete="email" required className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"/></span></label>
      <label className="block"><span className="mb-1.5 flex items-center justify-between text-sm font-medium text-slate-800"><span>Password</span>{mode === "signin" ? <a href="/forgot-password" className="text-xs font-semibold text-emerald-700 hover:underline">Forgot password?</a> : null}</span><span className="relative block"><KeyRound aria-hidden="true" className="absolute left-3.5 top-3.5 size-4 text-slate-400"/><input name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={12} required className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"/></span></label>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? <LoaderCircle className="mr-2 size-4 animate-spin"/> : null}{mode === "signup" ? "Create account" : "Sign in"}<ArrowRight className="ml-2 size-4"/></Button>
    </form>
    {allowSignup ? <button type="button" className="w-full text-sm font-semibold text-emerald-700" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setMessage(null); }}>{mode === "signup" ? "Already have an account? Sign in" : "Need an account? Create one"}</button> : null}
    <div className="flex items-center gap-3 text-xs uppercase tracking-[.16em] text-slate-400"><span className="h-px flex-1 bg-slate-200"/>or<span className="h-px flex-1 bg-slate-200"/></div>
    <Button type="button" variant="secondary" className="w-full" disabled={pending} onClick={google}><span aria-hidden="true" className="mr-2 grid size-5 place-items-center rounded-full border border-slate-300 text-xs font-bold">G</span>Continue with Google</Button>
    {message ? <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{message}</p> : null}
  </div>;
}
