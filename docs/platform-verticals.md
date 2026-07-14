# Industry vertical contract

Optimize Local Connect™ is the operating platform for community marketplaces. It separates reusable platform services from industry workflows. Property Management is Version 1.

## Shared platform core

Every vertical reuses:

- Supabase identity, organization membership, invitations, sessions, and roles
- cities, markets, coverage, and local discovery primitives
- verified local provider profiles and relationship history
- notifications, messaging, files, favorites, analytics, audit events, and outbox delivery
- Optimize AI™ decision optimization, provider routing, conversations, governed tool runs, feedback, provenance, and approvals

## Definition sources

The code registry at `src/domain/verticals/registry.ts` declares the key, display name, version, lifecycle status, compatible organization types, capabilities, extension module, and navigation. PostgreSQL tables `industry_verticals`, `platform_modules`, `vertical_modules`, and `organization_verticals` provide the durable catalog, module composition, and per-organization activation state.

Keys are immutable snake_case identifiers. Display names may evolve. A vertical is usable only when its database catalog row is enabled and the organization has an active assignment.

## Registered roadmap

| Vertical | Version | Status | Extension module |
|---|---:|---|---|
| Property Management | 1 | Launch | Property Operations |
| HOAs | — | Planned | Community Governance |
| Homeowners | — | Planned | Household Services |
| Realtors | — | Planned | Transaction Coordination |
| Local Governments | — | Planned | Civic Procurement |
| Schools | — | Planned | Education Facilities |
| Healthcare | — | Planned | Healthcare Facilities |
| Nonprofits | — | Planned | Nonprofit Operations |
| Service Marketplaces | — | Planned | Marketplace Operations |

Planned verticals have no application navigation and cannot be activated through ordinary product flows. A version is assigned only when its domain contract, policies, routes, and operational readiness are approved.

## Vertical module requirements

A new vertical must define:

1. A stable registry key and explicit lifecycle status.
2. Organization types and capability identifiers.
3. Reusable core-module composition plus one bounded vertical extension module.
4. Route and navigation contributions with permission requirements.
5. Additive, forward-only migrations for domain-specific data.
6. RLS policies that preserve organization and market isolation.
7. Business events and idempotent outbox consumers.
8. Optimize AI policy, tool inputs, approval thresholds, provenance, and audit behavior.
9. Tests for activation, authorization, cross-tenant isolation, and routing.

Shared tables should gain nullable context or join tables only when the relationship is truly cross-industry. A vertical must not overload Property Management tables with unrelated meanings.

## Property Management launch vertical

The `property_management` vertical currently contributes properties, service requests, provider matching, quotes, work orders, invoices, reviews, warranties, and appliance inventory. It is explicitly Version 1. Existing `vendor_*`, `property_*`, and related role names remain technical compatibility contracts. The product UI presents vendor organizations as “Local Providers.”

## Adding a future vertical

Promote the planned registry definition, assign a version, create additive migrations, build the extension under `src/features/<vertical>`, connect navigation through declared capabilities, and validate policies with unrelated organizations. Do not copy identity, organizations, geography, marketplace, requests, quotes, execution, communication, files, notifications, analytics, or Optimize AI into a vertical module.
