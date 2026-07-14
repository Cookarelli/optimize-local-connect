"use client";

import { useEffect } from "react";

export default function PlatformError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <div className="mx-auto grid min-h-[60vh] max-w-xl place-items-center text-center"><div><p className="text-sm font-semibold text-rose-700">Something went wrong</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">We couldn’t load this workspace.</h1><p className="mt-3 text-sm leading-6 text-slate-500">Try again. If the problem continues, an administrator should verify the Supabase connection and database migration.</p><button type="button" onClick={reset} className="mt-6 min-h-11 rounded-full bg-slate-950 px-6 text-sm font-semibold text-white">Try again</button></div></div>;
}
