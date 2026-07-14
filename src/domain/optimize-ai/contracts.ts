export const OPTIMIZE_AI_CRITERIA = [
  "best_value",
  "fastest_response",
  "shortest_travel",
  "highest_optimize_score",
  "best_skill_match",
  "lowest_estimated_cost",
] as const;

export type OptimizeCriterion = (typeof OPTIMIZE_AI_CRITERIA)[number];

export const OPTIMIZE_AI_CAPABILITIES = [
  "decision_optimization",
  "vendor_ranking",
  "voice",
  "image_understanding",
  "document_understanding",
  "scheduling",
  "vendor_routing",
] as const;

export type OptimizeAICapability = (typeof OPTIMIZE_AI_CAPABILITIES)[number];

export type OptimizeAIModality = "text" | "voice" | "image" | "document" | "structured_data";

export type OptimizationWeights = Readonly<Record<OptimizeCriterion, number>>;

export type VendorDecisionMetrics = {
  valueScore: number;
  responseMinutes: number;
  travelMinutes: number;
  optimizeScore: number;
  skillMatchScore: number;
  estimatedCostCents: number;
};

export type DecisionCandidate = {
  entityId: string;
  entityType: string;
  label?: string;
  metrics: VendorDecisionMetrics;
};

export type CriterionContribution = {
  criterion: OptimizeCriterion;
  normalizedScore: number;
  weight: number;
  weightedScore: number;
};

export type RankedDecisionCandidate = DecisionCandidate & {
  rank: number;
  score: number;
  contributions: CriterionContribution[];
};

export type ModelProviderRequest = {
  capability: OptimizeAICapability;
  inputModality: OptimizeAIModality;
  outputModality: OptimizeAIModality;
  payload: unknown;
  metadata?: Readonly<Record<string, string>>;
};

export type ModelProviderResponse = {
  output: unknown;
  modelReference: string;
  usage?: Readonly<Record<string, number>>;
  providerRequestId?: string;
};

export interface OptimizeAIProviderAdapter {
  readonly adapterKey: string;
  readonly capabilities: ReadonlySet<OptimizeAICapability>;
  readonly inputModalities: ReadonlySet<OptimizeAIModality>;
  readonly outputModalities: ReadonlySet<OptimizeAIModality>;
  readonly priority: number;
  isAvailable(): Promise<boolean>;
  execute(request: ModelProviderRequest): Promise<ModelProviderResponse>;
}
