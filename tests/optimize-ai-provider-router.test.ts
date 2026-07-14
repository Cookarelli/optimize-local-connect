import test from "node:test";
import assert from "node:assert/strict";
import type { OptimizeAIProviderAdapter } from "../src/domain/optimize-ai/contracts";
import { NoCompatibleProviderError, OptimizeAIProviderRouter } from "../src/lib/optimize-ai/provider-router";

function adapter(adapterKey: string, priority: number, available: boolean): OptimizeAIProviderAdapter {
  return {
    adapterKey,
    priority,
    capabilities: new Set(["document_understanding"]),
    inputModalities: new Set(["document"]),
    outputModalities: new Set(["structured_data"]),
    isAvailable: async () => available,
    execute: async () => ({ output: { adapterKey }, modelReference: `${adapterKey}.model` }),
  };
}

const request = {
  capability: "document_understanding" as const,
  inputModality: "document" as const,
  outputModality: "structured_data" as const,
  payload: { fileId: "test" },
};

test("provider routing uses capability, health, and priority instead of provider names", async () => {
  const router = new OptimizeAIProviderRouter([
    adapter("configured_secondary", 20, true),
    adapter("configured_primary", 10, false),
  ]);
  const response = await router.execute(request);
  assert.deepEqual(response.output, { adapterKey: "configured_secondary" });
});

test("provider routing fails clearly when no compatible adapter is available", async () => {
  const router = new OptimizeAIProviderRouter([adapter("configured_adapter", 10, false)]);
  await assert.rejects(() => router.execute(request), NoCompatibleProviderError);
});
