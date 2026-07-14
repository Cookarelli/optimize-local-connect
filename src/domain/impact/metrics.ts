import { z } from "zod";

const nullableNumber = z.union([z.number(), z.string().transform(Number), z.null()]);
const numeric = z.union([z.number(), z.string().transform(Number)]).default(0);

export const impactSummarySchema = z.object({
  estimated_money_saved_cents: numeric,
  estimated_hours_saved: numeric,
  average_savings_per_work_order_cents: numeric,
  vendor_response_minutes: nullableNumber.default(null),
  emergency_response_minutes: nullableNumber.default(null),
  community_savings_since_launch_cents: numeric,
  jobs_completed: numeric,
  vendor_growth: numeric,
  local_spending_retained_cents: numeric,
  portfolio_savings_cents: numeric.optional(),
  observation_count: numeric.optional(),
  organization_count: numeric.optional(),
  communities_served: numeric.optional(),
  verified_vendor_count: numeric.optional(),
  property_manager_count: numeric.optional(),
  city_comparison_ready: z.boolean().optional(),
  generated_at: z.string().optional(),
}).passthrough();

export type ImpactSummary = z.infer<typeof impactSummarySchema>;

export const EMPTY_IMPACT_SUMMARY: ImpactSummary = {
  estimated_money_saved_cents: 0,
  estimated_hours_saved: 0,
  average_savings_per_work_order_cents: 0,
  vendor_response_minutes: null,
  emergency_response_minutes: null,
  community_savings_since_launch_cents: 0,
  jobs_completed: 0,
  vendor_growth: 0,
  local_spending_retained_cents: 0,
  portfolio_savings_cents: 0,
  observation_count: 0,
};

export const IMPACT_METRICS = [
  { key: "estimated_money_saved", label: "Estimated Money Saved", unit: "cents", kind: "estimated" },
  { key: "estimated_hours_saved", label: "Estimated Hours Saved", unit: "hours", kind: "estimated" },
  { key: "average_savings_per_work_order", label: "Average Savings Per Work Order", unit: "cents", kind: "derived" },
  { key: "vendor_response_time", label: "Vendor Response Time", unit: "minutes", kind: "measured" },
  { key: "emergency_response_time", label: "Emergency Response Time", unit: "minutes", kind: "measured" },
  { key: "community_savings_since_launch", label: "Community Savings Since Launch", unit: "cents", kind: "derived" },
  { key: "jobs_completed", label: "Jobs Completed", unit: "count", kind: "measured" },
  { key: "vendor_growth", label: "Vendor Growth", unit: "count", kind: "measured" },
  { key: "local_spending_retained", label: "Local Spending Retained", unit: "cents", kind: "estimated" },
  { key: "portfolio_savings", label: "Portfolio Savings", unit: "cents", kind: "derived" },
] as const;

export function parseImpactSummary(value: unknown): ImpactSummary {
  const result = impactSummarySchema.safeParse(value);
  return result.success ? result.data : EMPTY_IMPACT_SUMMARY;
}

export function calculateEstimatedSavings(baselineCostCents: number, actualCostCents: number) {
  if (![baselineCostCents,actualCostCents].every(Number.isFinite) || baselineCostCents < 0 || actualCostCents < 0) throw new Error("Costs must be finite and non-negative.");
  return Math.max(Math.round(baselineCostCents) - Math.round(actualCostCents), 0);
}

export function calculateEstimatedHoursSaved(baselineHours: number, actualHours: number) {
  if (![baselineHours,actualHours].every(Number.isFinite) || baselineHours < 0 || actualHours < 0) throw new Error("Hours must be finite and non-negative.");
  return Math.max(baselineHours-actualHours,0);
}

export function formatImpactCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents/100);
}

export function formatImpactDuration(minutes: number | null) {
  if (minutes === null) return "Not measured";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  return `${(minutes/60).toFixed(1)} hr`;
}
