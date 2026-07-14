"use client";

import { useActionState } from "react";
import { LoaderCircle, Mail } from "lucide-react";
import { requestPasswordReset, type RecoveryState } from "@/app/(auth)/forgot-password/actions";
import { Button } from "@/src/components/ui/button";

const initialState: RecoveryState = { status: "idle" };

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);
  return <form action={action} className="space-y-4">
    <div><label htmlFor="recovery-email" className="mb-1.5 block text-sm font-medium text-slate-800">Work email</label><div className="relative"><Mail className="absolute left-3.5 top-3.5 size-4 text-slate-400" aria-hidden="true" /><input id="recovery-email" name="email" type="email" autoComplete="email" required className="min-h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /></div></div>
    <Button type="submit" className="w-full" disabled={pending}>{pending ? <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}Send reset link</Button>
    {state.message ? <p role="status" className={state.status === "success" ? "rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" : "rounded-xl bg-rose-50 p-3 text-sm text-rose-800"}>{state.message}</p> : null}
  </form>;
}
