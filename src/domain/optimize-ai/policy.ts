import type { OptimizationWeights } from "./contracts";

export const DEFAULT_VENDOR_DECISION_POLICY = {
  key: "property_management_vendor_selection",
  version: 1,
  weights: {
    best_value: 0.22,
    fastest_response: 0.16,
    shortest_travel: 0.1,
    highest_optimize_score: 0.2,
    best_skill_match: 0.22,
    lowest_estimated_cost: 0.1,
  } satisfies OptimizationWeights,
} as const;
