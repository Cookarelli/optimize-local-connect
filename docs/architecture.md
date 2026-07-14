# Architecture

## Product boundaries

Property OS is a multi-tenant marketplace, not a directory. Property-management organizations own properties and service requests. Vendor organizations own verification profiles, service categories, quotes, and technician teams. Markets connect both sides by geography without weakening organization-level data isolation.

## Module layout

```text
app/                         Next.js routes, layouts, route handlers, server actions
  (auth)/                    public identity flows
  (platform)/                authenticated product routes
src/
  components/                reusable presentation and composed UI
  domain/                    framework-free roles, permissions, and domain types
  features/                  feature-specific UI, validation, queries, and commands
  lib/
    auth/                    session and authorization adapters
    supabase/                browser/server infrastructure clients
supabase/migrations/         versioned database schema, indexes, functions, and RLS
docs/                        durable engineering decisions and permission contracts
```

New business capabilities belong under `src/features/<feature>`. Route files should remain composition layers: load the session, authorize, call a feature query or command, and render the feature view.

## Request lifecycle

1. A property-team member creates a service request for a property and trade.
2. Publishing exposes the request only to vendor organizations serving the same market and trade.
3. A vendor submits one quote per request.
4. An authorized property-team member awards a quote and creates a work order.
5. Vendor administrators assign a technician; the technician updates only assigned work.
6. Completion updates operational records and emits an outbox event for downstream workflows.

Important state transitions should be implemented as PostgreSQL functions or trusted server commands so related writes, audit records, and outbox records commit atomically.

## Authorization

Authentication identifies a Supabase user. Authorization derives from active `organization_members` records and the global `profiles.is_super_admin` flag.

There are two required enforcement points:

- `src/domain/auth/roles.ts` and `src/lib/auth/authorization.ts` control server behavior and UI capabilities.
- PostgreSQL RLS policies control the rows a session can read or mutate.

Client-side checks are presentational only. Any new write must be authorized on the server and permitted by RLS. Cross-tenant IDs are never trusted from a form; the server resolves and verifies their relationships.

## Data access

Server Components are the default for authenticated reads. Route handlers and Server Actions handle commands. React Query is reserved for client-owned experiences that benefit from cache invalidation, optimistic UI, polling, or background refetching.

Supabase is the system of record. The anon key is safe to expose only because RLS is mandatory. The service-role key is server-only and limited to explicit platform administration jobs.

## Multi-city expansion

`cities` is the canonical unlimited place registry. `markets` are named operating regions that may contain any number of cities through `market_cities`. Organizations may operate in many markets through `organization_markets`; each property belongs to a valid organization/market and market/city pair. Vendor discovery combines city coverage, service category, and service offering. This keeps expansion deterministic and indexable without assuming one market equals one city.

## AI readiness

AI features consume structured events rather than coupling model calls to user-facing transactions. `outbox_events` records durable work to process after commit. `audit_events` provides traceability. Future automation workers must be idempotent, version prompts and schemas, record provenance, and require human approval for high-impact actions such as awarding work or changing payment terms.

## Operational standards

- Validate external input with Zod.
- Prefer database constraints for invariants.
- Add an index for every frequent tenant/status/time query.
- Use cursor pagination for growing lists.
- Never log access tokens, service keys, request descriptions, or resident data.
- Add accessibility names, keyboard behavior, focus states, and 44px touch targets.
- Keep business times as `timestamptz`; render in the market timezone.
- Use the transactional outbox for email, SMS, webhooks, and AI processing.
