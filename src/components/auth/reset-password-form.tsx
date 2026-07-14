"use client";

import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";
import { updatePassword, type PasswordState } from "@/app/(auth)/reset-password/actions";
import { Button } from "@/src/components/ui/button";

const initialState: PasswordState = { status: "idle" };

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, initialState);
  return <form action={action} className="space-y-4">
    <div><label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-slate-800">New password</label><input id="new-password" name="password" type="password" autoComplete="new-password" minLength={12} required className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /><p className="mt-1.5 text-xs text-slate-500">12+ characters with uppercase, lowercase, and a number.</p></div>
    <div><label htmlFor="password-confirmation" className="mb-1.5 block text-sm font-medium text-slate-800">Confirm password</label><input id="password-confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={12} required className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /></div>
    <Button type="submit" className="w-full" disabled={pending}>{pending ? <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}Update password</Button>
    {state.message ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{state.message}</p> : null}
  </form>;
}
