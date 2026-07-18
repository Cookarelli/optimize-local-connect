export const FOUNDER_APPLICATION_STATUSES = ["payment_pending", "paid_onboarding_incomplete", "submitted", "under_review", "approved", "changes_requested", "rejected", "active", "suspended"] as const;
export const FOUNDER_PAYMENT_STATUSES = ["paid", "refunded", "partially_refunded", "disputed"] as const;

export function founderStatusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

export function founderApplicationBadge(status: string) {
  if (status === "active" || status === "approved") return "bg-emerald-100 text-emerald-800";
  if (status === "submitted" || status === "under_review") return "bg-blue-100 text-blue-800";
  if (status === "changes_requested") return "bg-amber-100 text-amber-900";
  if (status === "rejected" || status === "suspended") return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-700";
}

export function founderPaymentBadge(status: string) {
  return status === "paid" ? "bg-emerald-100 text-emerald-800" : status === "disputed" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-900";
}
