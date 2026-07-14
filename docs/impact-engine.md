# Optimize Local Impact Engine

The Optimize Local Impact Engine is a reusable core service for every Optimize Local Connect vertical. It turns operational events and approved estimates into reproducible organization, portfolio, market, and platform impact reporting.

## Metric philosophy

Every metric is classified as measured, estimated, or derived. Estimates retain their baseline, actual value, methodology version, confidence, source, recorder, observation time, and business context. Dashboard totals are derived from immutable observations rather than editable counters.

The initial catalog includes estimated money and hours saved, average savings per work order, vendor and emergency response time, community savings since launch, jobs completed, vendor growth, estimated local spending retained, and portfolio savings.

The Super Admin Community Impact dashboard also reports communities served, currently verified vendors, active Property Management users, and city comparisons. “Communities served” counts distinct cities with a completed-job observation. “Verified vendors” requires a verified profile plus current license and insurance evidence. “Property managers” counts active owner, admin, and property-manager users in active Property Management organizations. City comparisons aggregate immutable city-attributed observations for the selected period and never manufacture values for cities without observations.

## Data flow

1. Work-order completion automatically records one completed job plus measured vendor and emergency response when source timestamps exist.
2. A new active provider relationship automatically records vendor growth.
3. The authenticated work-order API records approved cost/time baselines and local-spending estimates after completion.
4. Every observation is validated against an active metric and methodology, deduplicated by idempotency key, and rolled into daily tenant/market aggregates in the same transaction.
5. Organization and platform summary functions compute ratios and cumulative values from those rollups.

## Security and governance

- Observations are append-only and cannot be updated or deleted.
- Work-order impact requires an authorized owner, admin, property manager, Super Admin, or trusted service context.
- Local spending retained cannot exceed documented actual cost.
- Organization summaries require membership. Platform summaries require Super Admin.
- RLS protects the source ledger, daily rollups, snapshots, and report requests.
- Audit and outbox events are written only when new work-order observations are inserted.

## APIs

- `GET /api/impact?range=30d|90d|365d` returns the active organization summary, metric catalog, and series.
- `POST /api/impact/work-orders/:workOrderId` records approved estimates and provenance for a completed work order.
- `POST /api/impact/snapshots` creates a governed reporting snapshot and can queue a provider-neutral future AI report request.
- `GET /api/admin/impact?range=30d|90d|365d` returns platform reporting for Super Admins.

## Future Optimize AI reporting

AI reports consume immutable `impact_snapshots`, never live mutable dashboard state. Requests can later be routed through any configured Optimize AI provider connection. Metric definitions and calculations remain provider-independent.
