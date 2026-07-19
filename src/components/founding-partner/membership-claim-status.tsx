"use client";

import { useEffect, useState } from "react";

export function MembershipClaimStatus({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState("checking");
  useEffect(() => {
    fetch(`/api/membership/claim-status?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" })
      .then(response => response.json()).then(result => setStatus(result.status ?? "unavailable")).catch(() => setStatus("unavailable"));
  }, [sessionId]);
  if (status === "paid") return <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Payment verified. Claim your vendor account below.</p>;
  if (status === "claimed") return <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">This membership has already been claimed.</p>;
  if (status === "pending") return <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Payment is still being verified. Refresh in a moment; access activates only after our secure Stripe webhook confirms it.</p>;
  if (status === "checking") return <p className="text-sm text-slate-500">Checking secure payment status…</p>;
  return <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">We could not find a verified payment for this link.</p>;
}
