import {
  OPTIMIZE_AI_CRITERIA,
  type DecisionCandidate,
  type OptimizationWeights,
  type OptimizeCriterion,
  type RankedDecisionCandidate,
} from "@/src/domain/optimize-ai/contracts";

const METRIC_DIRECTIONS: Readonly<Record<OptimizeCriterion, "higher" | "lower">> = {
  best_value: "higher",
  fastest_response: "lower",
  shortest_travel: "lower",
  highest_optimize_score: "higher",
  best_skill_match: "higher",
  lowest_estimated_cost: "lower",
};

function metricValue(candidate: DecisionCandidate, criterion: OptimizeCriterion): number {
  switch (criterion) {
    case "best_value": return candidate.metrics.valueScore;
    case "fastest_response": return candidate.metrics.responseMinutes;
    case "shortest_travel": return candidate.metrics.travelMinutes;
    case "highest_optimize_score": return candidate.metrics.optimizeScore;
    case "best_skill_match": return candidate.metrics.skillMatchScore;
    case "lowest_estimated_cost": return candidate.metrics.estimatedCostCents;
  }
}

function normalizedScore(value: number, minimum: number, maximum: number, direction: "higher" | "lower"): number {
  if (maximum === minimum) return 1;
  const position = (value - minimum) / (maximum - minimum);
  return direction === "higher" ? position : 1 - position;
}

export function validateWeights(weights: OptimizationWeights): void {
  const total = OPTIMIZE_AI_CRITERIA.reduce((sum, criterion) => sum + weights[criterion], 0);
  if (OPTIMIZE_AI_CRITERIA.some((criterion) => !Number.isFinite(weights[criterion]) || weights[criterion] < 0)) {
    throw new Error("Optimization weights must be finite and non-negative.");
  }
  if (Math.abs(total - 1) > 0.000001) throw new Error("Optimization weights must total 1.");
}

export function rankDecisionCandidates(candidates: readonly DecisionCandidate[], weights: OptimizationWeights): RankedDecisionCandidate[] {
  if (!candidates.length) throw new Error("At least one candidate is required.");
  validateWeights(weights);

  const ranges = Object.fromEntries(OPTIMIZE_AI_CRITERIA.map((criterion) => {
    const values = candidates.map((candidate) => metricValue(candidate, criterion));
    return [criterion, { minimum: Math.min(...values), maximum: Math.max(...values) }];
  })) as Record<OptimizeCriterion, { minimum: number; maximum: number }>;

  return candidates
    .map((candidate) => {
      const contributions = OPTIMIZE_AI_CRITERIA.map((criterion) => {
        const range = ranges[criterion];
        const normalized = normalizedScore(metricValue(candidate, criterion), range.minimum, range.maximum, METRIC_DIRECTIONS[criterion]);
        return {
          criterion,
          normalizedScore: Number(normalized.toFixed(6)),
          weight: weights[criterion],
          weightedScore: Number((normalized * weights[criterion]).toFixed(6)),
        };
      });
      return { ...candidate, rank: 0, score: Number((contributions.reduce((sum, item) => sum + item.weightedScore, 0) * 100).toFixed(2)), contributions };
    })
    .sort((left, right) => right.score - left.score || left.entityId.localeCompare(right.entityId))
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}
