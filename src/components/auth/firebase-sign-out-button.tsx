"use client";

import { useState } from "react";
import { signOut } from "firebase/auth";
import { getFirebaseClientAuth } from "@/src/lib/firebase/client";

export function FirebaseSignOutButton({ mobile = false }: { mobile?: boolean }) {
  const [pending, setPending] = useState(false);
  async function logout() {
    setPending(true);
    try {
      const { token } = await fetch("/api/auth/firebase/csrf", { cache: "no-store", credentials: "same-origin" }).then((response) => response.json()) as { token: string };
      const response = await fetch("/api/auth/firebase/logout", { method: "POST", credentials: "same-origin", headers: { "x-csrf-token": token } });
      if (!response.ok) throw new Error("Logout failed.");
      await signOut(getFirebaseClientAuth());
      window.location.assign("/");
    } catch { setPending(false); }
  }
  return <button type="button" disabled={pending} onClick={() => void logout()} className={mobile ? "min-h-11 w-full rounded-xl px-3 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50" : "rounded-lg p-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"}>{pending ? "Signing out…" : mobile ? "Sign out" : "Out"}</button>;
}
