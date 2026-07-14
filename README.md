# Optimize Local Connect™

An AI-powered community operating platform from **Optimize Local™** that connects local organizations with trusted providers, shared workflows, and better decisions.

**Company tagline:** Optimize Local. Maximize Savings.

**Mission:** Save Time. Save Money. Strengthen Communities.

> “We're not building software. We're building stronger local economies—one optimized decision at a time.”

## Platform evolution

Optimize Local Connect is not a rebuild of the original property platform. It preserves the production authentication, permissions, marketplace, work-order, review, role, and Supabase foundations while making industry context explicit and modular.

Property Management is Version 1. HOAs, Homeowners, Realtors, Local Governments, Schools, Healthcare, Nonprofits, and Service Marketplaces are registered as planned community-marketplace verticals. Every vertical composes the same reusable identity, organization, geography, provider marketplace, communication, analytics, audit, event, and Optimize AI™ foundations. Existing property- and vendor-named database tables remain stable to protect migrations, APIs, policies, and deployed data.

## What is implemented

- Multi-tenant PostgreSQL schema for shared platform foundations and the Property Management launch vertical
- Unlimited cities and markets with organization-scoped access
- Additive industry-vertical registry, reusable module catalog, and organization activation model
- Local provider marketplace, service requests, quotes, work orders, invoices, reviews, warranties, and appliance inventory
- Supabase Auth with password, magic-link, Google OAuth, recovery, and expiring organization invitations
- Provider-ready Microsoft and Apple sign-in configuration
- Seven application roles with explicit permissions and PostgreSQL row-level security
- Mobile-first public experience and authenticated, role-routed workspaces
- Optimize AI™ provider-neutral decision engine, auditable ranking API, governed tool execution, transactional outbox, and immutable audit events

## Stack

- Next.js App Router, React Server Components, TypeScript, Tailwind CSS
- Supabase Auth and PostgreSQL
- TanStack React Query
- Zod input and environment validation
- Vinext/Cloudflare build target for the Sites deployment surface

Prisma is intentionally not included. Supabase/PostgREST plus PostgreSQL RLS is the primary data-access and authorization boundary. A second ORM abstraction would duplicate the schema model and obscure policy behavior.

## Local setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and add the project URL and anon key.
3. Apply every file in `supabase/migrations` in filename order with `supabase db push` or the SQL editor.
4. Configure the Supabase Auth site URL as `http://localhost:3000` and allow `http://localhost:3000/auth/callback` as a redirect URL.
5. Run `npm run dev`.

The product is invite-only by default. Create the first authenticated user, then set `profiles.is_super_admin = true` from the Supabase dashboard. Platform administrators can then create organizations and memberships through trusted server-side workflows.

## Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
```

## Security model

Application permission checks shape the UI and protect server operations. PostgreSQL RLS independently controls every tenant-owned table. Never use the service-role key in browser code. Administrative invitations and platform mutations must run in a trusted server context, validate the actor, and write an `audit_events` row in the same business transaction.

Read [architecture](docs/architecture.md), [Optimize AI](docs/optimize-ai.md), [vertical modules](docs/platform-verticals.md), [permissions](docs/permissions.md), [database schema](docs/database-schema.md), and [authentication](docs/authentication.md) before adding a capability.
