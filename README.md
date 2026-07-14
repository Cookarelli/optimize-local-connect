# Optimize Local Property OS

The operating system connecting property management teams with verified local service vendors.

## What is implemented

- Multi-tenant PostgreSQL schema covering cities, markets, organizations, properties, vendors, requests, quotes, work orders, billing, communications, warranties, appliances, analytics, and AI interactions
- Supabase Auth with password and magic-link sign-in
- Server-side session loading and authorization
- PostgreSQL row-level security for tenant isolation and role enforcement
- Seven application roles with an explicit permission registry
- Mobile-first public experience and authenticated operations shell
- React Query provider for interactive feature modules
- Transactional outbox and immutable audit-event foundations for automation and AI workflows

## Stack

- Next.js App Router, React Server Components, TypeScript, Tailwind CSS
- Supabase Auth and PostgreSQL
- TanStack React Query
- Zod input and environment validation
- Vinext/Cloudflare build target for the Sites deployment surface

Prisma is intentionally not included. Supabase/PostgREST plus PostgreSQL RLS is the primary data-access and authorization boundary. Adding a second ORM abstraction at this stage would duplicate the schema model and make policy behavior less obvious.

## Local setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and add the project URL and anon key.
3. Apply every file in `supabase/migrations` in filename order with the Supabase CLI (`supabase db push`) or SQL editor.
4. Configure the Supabase Auth site URL as `http://localhost:3000` and allow `http://localhost:3000/auth/callback` as a redirect URL.
5. Run `npm run dev`.

The product is invite-only by default. Create the first authenticated user, then set `profiles.is_super_admin = true` for that user from the Supabase dashboard. Platform administrators can then create organizations and memberships through trusted server-side administration workflows.

## Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
```

## Security model

Application permission checks shape the UI and protect server operations. PostgreSQL RLS independently controls every tenant-owned table. Never use the service-role key in browser code. Administrative invitations and platform mutations must run in a trusted server context, validate the acting user first, and write an `audit_events` row in the same business transaction.

See `docs/architecture.md`, `docs/permissions.md`, and `docs/database-schema.md` before adding a feature.
