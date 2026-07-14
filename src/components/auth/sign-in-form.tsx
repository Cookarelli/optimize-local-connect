"use client";

import { useActionState } from "react";
import { ArrowRight, KeyRound, LoaderCircle, Mail } from "lucide-react";
import { signInWithGoogle, signInWithPassword, sendMagicLink, type AuthState } from "@/app/(auth)/sign-in/actions";
import { AUTH_PROVIDERS } from "@/src/lib/auth/providers";
import { Button } from "@/src/components/ui/button";

const initialState: AuthState = { status: "idle" };

export function SignInForm({ next = "/dashboard" }: { next?: string }) {
  const [passwordState, passwordAction, passwordPending] = useActionState(
    signInWithPassword,
    initialState,
  );
  const [magicState, magicAction, magicPending] = useActionState(
    sendMagicLink,
    initialState,
  );
  const state = magicState.status !== "idle" ? magicState : passwordState;

  return (
    <div className="space-y-5">
      <form action={passwordAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-800">
            Work email
          </label>
          <div className="relative">
            <Mail aria-hidden="true" className="absolute left-3.5 top-3.5 size-4 text-slate-400" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-base outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              placeholder="you@company.com"
            />
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between"><label htmlFor="password" className="block text-sm font-medium text-slate-800">Password</label><a href="/forgot-password" className="text-xs font-semibold text-emerald-700 hover:underline">Forgot password?</a></div>
          <div className="relative">
            <KeyRound aria-hidden="true" className="absolute left-3.5 top-3.5 size-4 text-slate-400" />
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-base outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={passwordPending || magicPending}>
          {passwordPending ? <LoaderCircle aria-hidden="true" className="mr-2 size-4 animate-spin" /> : null}
          Sign in <ArrowRight aria-hidden="true" className="ml-2 size-4" />
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-slate-400">
        <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
      </div>

      <form action={magicAction}>
        <input type="hidden" name="email" value="" data-magic-email />
        <input type="hidden" name="next" value={next} />
        <Button
          type="submit"
          variant="secondary"
          className="w-full"
          disabled={passwordPending || magicPending}
          onClick={(event) => {
            const form = event.currentTarget.form;
            const source = document.querySelector<HTMLInputElement>("#email");
            const target = form?.querySelector<HTMLInputElement>("[data-magic-email]");
            if (source && target) target.value = source.value;
          }}
        >
          {magicPending ? <LoaderCircle aria-hidden="true" className="mr-2 size-4 animate-spin" /> : null}
          Email me a secure sign-in link
        </Button>
      </form>

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="secondary" className="w-full">
          <span aria-hidden="true" className="mr-2 grid size-5 place-items-center rounded-full border border-slate-300 text-xs font-bold text-slate-700">G</span>
          Continue with Google
        </Button>
      </form>

      <div className="grid grid-cols-2 gap-3">
        {AUTH_PROVIDERS.filter((provider) => !provider.enabled).map((provider) => (
          <button key={provider.id} type="button" disabled className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-400">
            {provider.label} <span className="sr-only">login</span><span className="ml-1 text-[10px] uppercase tracking-wider">Soon</span>
          </button>
        ))}
      </div>

      {state.message ? (
        <p
          role="status"
          className={cnStatus(state.status)}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

function cnStatus(status: AuthState["status"]) {
  return status === "success"
    ? "rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"
    : "rounded-xl bg-rose-50 p-3 text-sm text-rose-800";
}
