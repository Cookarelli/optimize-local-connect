import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_VENDOR_DECISION_POLICY } from "../src/domain/optimize-ai/policy";
import { rankDecisionCandidates, validateWeights } from "../src/features/optimize-ai/rank-candidates";

const candidates = [
  {
    entityId: "00000000-0000-4000-8000-000000000001",
    entityType: "vendor",
    label: "Balanced provider",
    metrics: { valueScore: 92, responseMinutes: 18, travelMinutes: 14, optimizeScore: 94, skillMatchScore: 97, estimatedCostCents: 42_000 },
  },
  {
    entityId: "00000000-0000-4000-8000-000000000002",
    entityType: "vendor",
    label: "Lowest price provider",
    metrics: { valueScore: 72, responseMinutes: 55, travelMinutes: 42, optimizeScore: 78, skillMatchScore: 70, estimatedCostCents: 36_000 },
  },
  {
    entityId: "00000000-0000-4000-8000-000000000003",
    entityType: "vendor",
    label: "Fastest provider",
    metrics: { valueScore: 80, responseMinutes: 8, travelMinutes: 9, optimizeScore: 84, skillMatchScore: 82, estimatedCostCents: 49_000 },
  },
];

test("Optimize AI selects the strongest weighted vendor and explains the result", () => {
  const ranked = rankDecisionCandidates(candidates, DEFAULT_VENDOR_DECISION_POLICY.weights);
  assert.equal(ranked[0].entityId, candidates[0].entityId);
  assert.deepEqual(ranked.map((candidate) => candidate.rank), [1, 2, 3]);
  assert.ok(ranked.every((candidate) => candidate.score >= 0 && candidate.score <= 100));
  assert.ok(ranked.every((candidate) => candidate.contributions.length === 6));
  assert.ok(Math.abs(ranked[0].contributions.reduce((sum, item) => sum + item.weight, 0) - 1) < 0.000001);
});

test("Optimize AI rejects non-normalized decision weights", () => {
  assert.throws(() => validateWeights({ ...DEFAULT_VENDOR_DECISION_POLICY.weights, best_value: 0.5 }), /must total 1/);
});

test("Optimize AI produces stable ranks for tied candidates", () => {
  const tied = [candidates[1], { ...candidates[1], entityId: "00000000-0000-4000-8000-000000000000" }];
  const ranked = rankDecisionCandidates(tied, DEFAULT_VENDOR_DECISION_POLICY.weights);
  assert.equal(ranked[0].entityId, "00000000-0000-4000-8000-000000000000");
});
