export type FounderEnrollment = {
  id: string; businessName: string; contactName: string | null; email: string | null; phone: string | null; industry: string | null; source: string; paymentStatus: "pending" | "paid" | "failed" | "incomplete"; membershipStatus: string | null; amountPaidCents: number; accountClaimed: boolean | null; createdAt: string; updatedAt: string; activatedAt: string | null; stripeCustomerId: string | null; checkoutSessionId: string | null; paymentIntentId: string | null;
};

export type FounderDashboardFilters = { q?: string; status?: string; industry?: string };

export function isActiveFounder(enrollment: FounderEnrollment) { return enrollment.membershipStatus === "active"; }
export function isPaidFounder(enrollment: FounderEnrollment) { return enrollment.paymentStatus === "paid" && enrollment.amountPaidCents === 29900; }
export function isUnclaimedFounder(enrollment: FounderEnrollment) { return enrollment.accountClaimed === false; }

export function filterFounderEnrollments(rows: FounderEnrollment[], filters: FounderDashboardFilters) {
  const query = (filters.q ?? "").trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.industry && row.industry !== filters.industry) return false;
    if (filters.status === "pending" && row.paymentStatus !== "pending") return false;
    if (filters.status === "paid" && !isPaidFounder(row)) return false;
    if (filters.status === "active" && !isActiveFounder(row)) return false;
    if (filters.status === "unclaimed" && !isUnclaimedFounder(row)) return false;
    return !query || [row.businessName, row.contactName, row.email, row.phone, row.industry].some((value) => value?.toLowerCase().includes(query));
  });
}

export function founderSummary(rows: FounderEnrollment[], capacity: number, occupiedSlots: number) {
  return {
    active: rows.filter(isActiveFounder).length,
    pending: rows.filter(row => row.paymentStatus === "pending").length,
    paid: rows.filter(isPaidFounder).length,
    unclaimed: rows.filter(isUnclaimedFounder).length,
    remaining: Math.max(0, capacity - occupiedSlots),
    revenueCents: rows.filter(isPaidFounder).reduce((sum, row) => sum + row.amountPaidCents, 0),
  };
}
