import { z } from "zod";
import { DEFAULT_VENDOR_DECISION_POLICY } from "@/src/domain/optimize-ai/policy";
import { rankDecisionCandidates } from "@/src/features/optimize-ai/rank-candidates";
import { can } from "@/src/lib/auth/authorization";
import { getCurrentUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const score = z.number().finite().min(0).max(100);
const candidateSchema = z.object({
  entityId: z.string().uuid(),
  entityType: z.string().regex(/^[a-z][a-z0-9_]*$/).max(80),
  label: z.string().trim().min(1).max(160).optional(),
  metrics: z.object({
    valueScore: score,
    responseMinutes: z.number().finite().min(0).max(525_600),
    travelMinutes: z.number().finite().min(0).max(525_600),
    optimizeScore: score,
    skillMatchScore: score,
    estimatedCostCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  }).strict(),
}).strict();

const requestSchema = z.object({
  contextType: z.string().regex(/^[a-z][a-z0-9_]*$/).max(80).optional(),
  contextId: z.string().uuid().optional(),
  candidates: z.array(candidateSchema).min(1).max(100),
}).strict().refine((value) => Boolean(value.contextType) === Boolean(value.contextId), {
  message: "contextType and contextId must be supplied together",
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const membership = user.memberships[0];
  if (!membership || !can(user, "organization:view", membership.organizationId)) {
    return Response.json({ error: "Organization access required." }, { status: 403 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid optimization request.", details: parsed.error.flatten() }, { status: 400 });
  }

  const ranked = rankDecisionCandidates(parsed.data.candidates, DEFAULT_VENDOR_DECISION_POLICY.weights);
  const persistencePayload = ranked.map((candidate) => ({
    entity_id: candidate.entityId,
    entity_type: candidate.entityType,
    label: candidate.label ?? null,
    rank: candidate.rank,
    score: candidate.score,
    metrics: candidate.metrics,
    normalized_metrics: Object.fromEntries(candidate.contributions.map((item) => [item.criterion, item.normalizedScore])),
    contributions: candidate.contributions,
  }));

  const supabase = await createSupabaseServerClient();
  const { data: runId, error } = await supabase.rpc("record_optimize_ai_decision", {
    target_organization_id: membership.organizationId,
    target_policy_key: DEFAULT_VENDOR_DECISION_POLICY.key,
    target_policy_version: DEFAULT_VENDOR_DECISION_POLICY.version,
    target_context_type: parsed.data.contextType ?? null,
    target_context_id: parsed.data.contextId ?? null,
    target_input_snapshot: { candidates: parsed.data.candidates },
    ranked_candidates: persistencePayload,
  });

  if (error) {
    console.error("Optimize AI decision persistence failed", { code: error.code });
    return Response.json({ error: "The decision could not be completed." }, { status: 500 });
  }

  return Response.json({
    mission: "Optimize every decision.",
    objective: "best_vendor",
    optimizationRunId: runId,
    selected: ranked[0],
    ranked,
  }, { headers: { "Cache-Control": "no-store" } });
}
