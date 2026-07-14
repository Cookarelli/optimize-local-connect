# Architecture

## Product boundary

Optimize Local Connect™ is a multi-tenant, AI-powered operating platform for community marketplaces. Its shared core connects local organizations, providers, people, markets, transactions, communications, and trustworthy decision support. Property Management is Version 1, not the boundary of the platform.

The launch vertical remains a transactional marketplace—not a directory. Property-management organizations own properties and service requests. Provider organizations own verification profiles, service categories, quotes, and technician teams. Markets connect both sides by geography without weakening organization isolation.

## Module layout

```text
app/                         Next.js routes, layouts, route handlers, server actions
  (auth)/                    public identity flows
  (platform)/                authenticated platform routes
src/
  components/                reusable presentation and composed UI
  domain/
    auth/                    framework-free roles and permissions
    platform/                canonical brand and shared terminology
    verticals/               versioned industry registry and reusable module contracts
    optimize-ai/             provider-neutral decision and capability contracts
    impact/                  governed metric definitions and calculation contracts
    exchange/                Version 3 capacity-exchange contracts (planned; no UI)
  features/                  shared and vertical-specific UI, queries, and commands
  lib/
    auth/                    session and authorization adapters
    supabase/                browser/server infrastructure clients
    optimize-ai/             capability-based model-provider routing
    impact/                  organization reporting queries and range handling
supabase/migrations/         forward-only schema, indexes, functions, and RLS
docs/                        durable engineering and product contracts
```

New shared capabilities belong under `src/features/<capability>`. Vertical-specific capabilities belong under `src/features/<vertical>/<capability>` when the distinction is material. Route files remain composition layers: load the session, resolve organization and vertical context, authorize, call a feature query or command, and render.

## Shared core and vertical modules

The shared core owns identity, organizations, memberships, cities, markets, provider discovery, communication, files, notifications, analytics, the Optimize Local Impact Engine, audit history, outbox delivery, and Optimize AI™. Vertical modules contribute only domain entities, workflows, navigation, permission requirements, events, and optimization policies.

`industry_verticals` is the industry catalog. `platform_modules` catalogs reusable core and extension modules. `vertical_modules` composes them into each industry, while `organization_verticals` activates one or more verticals for an organization. `src/domain/verticals/registry.ts` is the application contract used for version, capabilities, and navigation. Database and application definitions must change together.

Existing `property_*` and `vendor_*` names intentionally remain. They are stable launch-vertical contracts used by migrations, PostgREST, RLS, and deployed clients. User-facing language may call vendors “Local Providers” without renaming technical roles or tables.

## Property Management lifecycle

1. A property-team member creates a service request for a property and category.
2. Publishing exposes it only to provider organizations serving the same market and category.
3. A provider submits one quote per request.
4. An authorized property-team member awards a quote and creates a work order.
5. Provider administrators assign a technician; the technician updates assigned work.
6. Completion updates records and emits an outbox event for downstream workflows.

Important state transitions use PostgreSQL functions or trusted server commands so business writes, audit records, and outbox records commit atomically.

## Authorization

Supabase Auth identifies a user. Authorization derives from active `organization_members`, active organization/vertical context, and the global `profiles.is_super_admin` flag.

Two enforcement points are mandatory:

- `src/domain/auth/roles.ts` and `src/lib/auth/authorization.ts` control server behavior and UI capabilities.
- PostgreSQL RLS controls which rows a session may read or mutate.

Client checks are presentational. Every write is authorized on the server and permitted by RLS. Cross-tenant identifiers are resolved and verified by the server. `proxy.ts` refreshes sessions; protected layouts and server actions revalidate them. `/dashboard` routes users to role-specific administration, manager, provider, technician, or resident surfaces.

## Data access

Server Components are the default for authenticated reads. Route handlers and Server Actions handle commands. React Query is reserved for client-owned interactions that benefit from invalidation, optimistic state, polling, or background refetching.

Supabase is the system of record. The anon key is safe to expose only because RLS is mandatory. The service-role key is server-only and limited to explicit platform administration.

## Multi-city and multi-industry expansion

`cities` is the canonical unlimited place registry. `markets` are operating regions containing any number of cities through `market_cities`. Organizations operate in many markets through `organization_markets`. Vertical activation is independent from geography, allowing one organization to add an industry without duplicating its identity, teams, market coverage, or platform history.

Property discovery combines city coverage, category, and provider service offerings. Future verticals reuse the same geographic primitives and add only their domain-specific eligibility rules.

## Optimize AI™

Optimize AI’s mission is **Optimize every decision.** Its deterministic core ranks options against versioned, explainable policies. External model providers are optional adapters resolved by capability, modality, health, and priority; domain code never branches on provider names. `outbox_events` records durable post-commit work, `audit_events` provides traceability, and Optimize AI tables retain conversations, tool runs, inputs, candidate contributions, provider/model provenance, feedback, and approval state. High-impact actions require human approval. See `docs/optimize-ai.md`.

## Optimize Local Impact Engine

The Impact Engine stores immutable, source-attributed observations against versioned methodologies and maintains transactional daily rollups for dashboards. Automatic lifecycle capture supplies completed jobs, provider response, emergency response, and vendor growth; governed work-order inputs supply estimated savings, hours, and local spending retained. Reproducible snapshots isolate future AI reporting from live mutable operational state. See `docs/impact-engine.md`.

## Optimize Local Exchange™

Exchange is a planned Version 3 shared-core module for matching business needs with unused local capacity. Its schema separates opt-in profiles, needs, offers, requests, proposals, accepted trades, deliverables, reciprocal ratings, provider-neutral AI matching, and a disabled double-entry trade-credit foundation. It has no Version 1 routes or navigation. See `docs/optimize-local-exchange.md`.

## Operational standards

- Validate external input with Zod.
- Prefer database constraints for invariants.
- Add an index for every frequent tenant/status/time query.
- Use cursor pagination for growing lists.
- Never log access tokens, service keys, request descriptions, or resident data.
- Add accessible names, keyboard behavior, focus states, and 44px touch targets.
- Store business time as `timestamptz`; render in the market timezone.
- Use the transactional outbox for email, SMS, webhooks, analytics projection, and AI processing.
