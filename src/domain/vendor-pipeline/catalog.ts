export const MEMBERSHIP_TARGETS = ["Founder", "Preferred", "Network", "Listed"] as const;
export const SALES_STAGES = ["Not Contacted", "Called", "Left Voicemail", "Interested", "Follow Up", "Demo Scheduled", "Checkout Sent", "Paid", "Active", "Not Interested"] as const;
export const CONTACT_STAGES = ["Called", "Left Voicemail", "Interested", "Follow Up", "Demo Scheduled", "Checkout Sent", "Paid", "Not Interested"] as const;

export type VendorProspect = {
  id: string; business_name: string; contact_name: string | null; phone: string | null; email: string | null; website: string | null; city: string | null; industry: string | null;
  google_rating: number | null; google_review_count: number | null; membership_target: typeof MEMBERSHIP_TARGETS[number]; sales_stage: typeof SALES_STAGES[number]; last_contact_at: string | null; next_follow_up_at: string | null; notes: string | null; created_at: string; updated_at: string;
};

export type PipelineFilters = { q?: string; industry?: string; stage?: string; target?: string; due?: string };

export function filterProspects(prospects: VendorProspect[], filters: PipelineFilters) {
  const query = (filters.q ?? "").trim().toLowerCase();
  const today = new Date().toISOString().slice(0, 10);
  return prospects.filter((prospect) => {
    if (filters.industry && prospect.industry !== filters.industry) return false;
    if (filters.stage && prospect.sales_stage !== filters.stage) return false;
    if (filters.target && prospect.membership_target !== filters.target) return false;
    const followUp = prospect.next_follow_up_at?.slice(0, 10);
    if (filters.due === "overdue" && (!followUp || followUp >= today)) return false;
    if (filters.due === "today" && followUp !== today) return false;
    if (filters.due === "future" && (!followUp || followUp <= today)) return false;
    return !query || [prospect.business_name, prospect.contact_name, prospect.phone, prospect.email, prospect.city, prospect.industry].some((value) => value?.toLowerCase().includes(query));
  });
}

export const CSV_COLUMNS = ["Business Name", "Contact Name", "Phone", "Email", "Website", "City", "Industry", "Google Rating", "Google Review Count", "Membership Target", "Sales Stage", "Last Contact", "Next Follow-up", "Notes"] as const;
const csvCell = (value: string | number | null) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export function prospectsToCsv(prospects: VendorProspect[]) {
  const rows = prospects.map((p) => [p.business_name, p.contact_name, p.phone, p.email, p.website, p.city, p.industry, p.google_rating, p.google_review_count, p.membership_target, p.sales_stage, p.last_contact_at, p.next_follow_up_at, p.notes].map(csvCell).join(","));
  return [CSV_COLUMNS.map(csvCell).join(","), ...rows].join("\n");
}
