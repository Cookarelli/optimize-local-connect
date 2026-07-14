import type {
  ModelProviderRequest,
  ModelProviderResponse,
  OptimizeAIProviderAdapter,
} from "@/src/domain/optimize-ai/contracts";

export class NoCompatibleProviderError extends Error {
  constructor() {
    super("No available AI provider supports the requested capability and modalities.");
    this.name = "NoCompatibleProviderError";
  }
}

export class OptimizeAIProviderRouter {
  constructor(private readonly adapters: readonly OptimizeAIProviderAdapter[]) {}

  async execute(request: ModelProviderRequest): Promise<ModelProviderResponse> {
    const compatible = this.adapters
      .filter((adapter) => adapter.capabilities.has(request.capability)
        && adapter.inputModalities.has(request.inputModality)
        && adapter.outputModalities.has(request.outputModality))
      .sort((left, right) => left.priority - right.priority || left.adapterKey.localeCompare(right.adapterKey));

    for (const adapter of compatible) {
      if (await adapter.isAvailable()) return adapter.execute(request);
    }

    throw new NoCompatibleProviderError();
  }
}
