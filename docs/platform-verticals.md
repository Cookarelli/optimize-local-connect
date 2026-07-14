# Industry vertical contract

Optimize Local Connect™ separates a reusable community platform from the industry workflows that run on it. Property Management is the launch vertical.

## Shared platform core

Every vertical reuses:

- Supabase identity, organization membership, invitations, sessions, and roles
- cities, markets, coverage, and local discovery primitives
- verified local provider profiles and relationship history
- notifications, messaging, files, favorites, analytics, audit events, and outbox delivery
- AI conversations, governed tool runs, feedback, provenance, and approvals

## Definition sources

The code registry at `src/domain/verticals/registry.ts` declares the key, display name, lifecycle status, compatible organization types, capabilities, and navigation. PostgreSQL tables `industry_verticals` and `organization_verticals` provide the durable catalog and per-organization activation state.

Keys are immutable snake_case identifiers. Display names may evolve. A vertical is usable only when its database catalog row is enabled and the organization has an active assignment.

## Vertical module requirements

A new vertical must define:

1. A stable registry key and explicit lifecycle status.
2. Organization types and capability identifiers.
3. Route and navigation contributions with permission requirements.
4. Additive, forward-only migrations for domain-specific data.
5. RLS policies that preserve organization and market isolation.
6. Business events and idempotent outbox consumers.
7. AI tool inputs, approval thresholds, provenance, and audit behavior.
8. Tests for activation, authorization, cross-tenant isolation, and routing.

Shared tables should gain nullable context or join tables only when the relationship is truly cross-industry. A vertical must not overload Property Management tables with unrelated meanings.

## Property Management launch vertical

The `property_management` vertical currently contributes properties, service requests, provider matching, quotes, work orders, invoices, reviews, warranties, and appliance inventory. Existing `vendor_*`, `property_*`, and related role names remain technical compatibility contracts. The product UI presents vendor organizations as “Local Providers.”

## Adding a future vertical

Add the registry definition and tests, create an additive migration, build the module under `src/features/<vertical>`, connect navigation through the declared capability set, and validate policies with unrelated organizations. Do not copy authentication, organization, geography, marketplace, messaging, analytics, or AI infrastructure into a vertical module.
