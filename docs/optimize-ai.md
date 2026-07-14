# Optimize AI™ architecture

**Mission:** Optimize every decision.

Optimize AI is the provider-agnostic intelligence layer shared by every Optimize Local Connect™ industry vertical. It ranks eligible options with versioned policy weights, preserves the evidence behind each score, and can optionally use configured model providers for explanation, extraction, or future modalities. No model provider is embedded in domain logic.

## Decision objectives

Property Management Version 1 supports vendor selection across six explainable criteria:

| Criterion | Direction | Default weight | Meaning |
|---|---:|---:|---|
| Best Value | Higher | 22% | Overall value independent of price alone. |
| Fastest Response | Lower | 16% | Estimated minutes before response. |
| Shortest Travel | Lower | 10% | Estimated travel minutes for the work. |
| Highest Optimize Score | Higher | 20% | Platform trust and performance signal. |
| Best Skill Match | Higher | 22% | Match between verified capability and requested work. |
| Lowest Estimated Cost | Lower | 10% | Comparable estimated cost in cents. |

The highest composite result is the **Best Vendor** for that policy and candidate set. Every result stores raw metrics, normalized metrics, criterion contributions, rank, policy version, and selected entity. Equal scores use a stable identifier tie-break so replays remain deterministic.

Weights live in versioned `ai_optimization_policies`. Changing a production policy creates a new version; it never rewrites past decisions. Organization-specific policies may override a global policy only inside their tenant boundary.

## Architecture boundaries

1. **Domain contracts** define capabilities, modalities, decision inputs, provider adapter behavior, and result provenance.
2. **Deterministic optimization** performs normalization and weighted ranking without requiring an external model.
3. **Provider routing** receives injected adapters and selects only an available adapter that supports the requested capability and input/output modalities.
4. **Persistence** records policies, runs, candidates, inputs, provider/model provenance, audit events, and a transactional outbox event.
5. **Delivery** exposes an authenticated decision API and future workers consume outbox events idempotently.

## Provider neutrality

- Application code references capability keys, never provider names.
- Provider connections are data, not source-code conditionals.
- Raw credentials are never stored in PostgreSQL; `secret_reference` points to the hosted secret manager.
- A connection maps to capabilities and model references through `ai_provider_capabilities`.
- Routing considers capability, modality, health, and priority.
- The deterministic ranking engine continues to operate with zero configured model providers.
- Adding, removing, or failing over a provider does not change optimization policies or business entities.

## Capability roadmap

| Capability | Status | Approval posture |
|---|---|---|
| Decision optimization | Active | Explainable and read-only. |
| Vendor ranking | Active | Produces a recommendation; does not award work. |
| Voice | Planned | Provider adapter supplies transcription and/or synthesis. |
| Image understanding | Planned | Files remain governed by platform file policies. |
| Document understanding | Planned | Extraction retains file and model provenance. |
| Scheduling | Planned | Human approval required before external calendar mutation. |
| Vendor routing | Planned | Human approval required before assignment or award. |

Voice, image, and document inputs use `ai_run_inputs`, which references the existing private `files` record instead of duplicating blob storage. Scheduling and routing execute through the existing governed tool-run pattern with idempotency keys and approval state.

## Security and governance

- Optimization requests require an authenticated active organization member.
- Runs are readable by their requester, organization owners/admins, and super admins.
- Provider connection configuration is restricted to super admins or organization owners/admins.
- Model output never bypasses PostgreSQL RLS or server authorization.
- High-impact actions remain separate from recommendations and require explicit human approval.
- Audit and outbox records are written in the same database transaction as a completed decision.
- API responses are non-cacheable and validation limits candidate count and numeric ranges.

## API

`POST /api/optimize-ai/decisions` accepts one to 100 eligible candidates with value, response, travel, Optimize Score, skill-match, and estimated-cost metrics. Organization context is resolved from the authenticated session, not accepted from the request. The response includes the run ID, selected candidate, complete ranking, scores, and per-criterion contributions.

The endpoint uses the active Version 1 Property Management vendor-selection policy. Future vertical services will resolve their policy key from the active vertical module rather than copying the ranking engine.
