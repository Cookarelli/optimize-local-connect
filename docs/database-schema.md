# PostgreSQL database schema

The Supabase PostgreSQL schema is defined by ordered, forward-only migrations in `supabase/migrations`. Migration `202607140001_initial_property_os.sql` establishes identity, tenancy, marketplace requests, quotes (originally named bids), work orders, audit events, and the transactional outbox. Migration `202607140002_complete_platform_schema.sql` normalizes cities, markets, categories, and quotes and adds the complete operating domains. Migration `202607140003_storage_policies.sql` creates the private file bucket and organization/uploader path policies.

## Conventions

- All application tables live in the `public` schema; Supabase owns `auth.users` and Storage owns file bytes.
- Primary business identifiers are UUIDs. Human-facing request, quote, work-order, and invoice numbers use identity sequences.
- Money is stored as integer cents plus a three-character currency code.
- Business timestamps use `timestamptz`; dates without time use `date`.
- Tenant-owned rows reference `organizations.id`. Cross-tenant workflows carry both party organization IDs.
- Deletion is restrictive for financial and completed-work records and cascading for true owned children.
- Row-level security is enabled on every user-accessible table.
- `audit_events` provides traceability; `outbox_events` provides reliable post-commit delivery.
- `files` stores metadata only. Supabase Storage stores bytes, and attachment tables provide real foreign keys.
- Private objects use `<organization_uuid>/<uploader_uuid>/<object_name>` paths. Organization members can read; only the uploader's folder may be mutated by that user.

## Identity, geography, and tenancy

| Table | Purpose and relationships | Access/index notes |
|---|---|---|
| `profiles` | One application profile per `auth.users` row. Holds display data and the tightly protected global super-admin flag. | Self-readable/updateable; shared organization members may read; privilege changes require trusted server context. |
| `user_preferences` | Locale, timezone, channel defaults, and quiet hours for one profile. | Primary key is `user_id`; self-only RLS. |
| `cities` | Unlimited canonical city registry with subdivision, country, timezone, and optional coordinates. | Unique by country, state, and slug; authenticated read; super-admin write. |
| `markets` | Named marketplace operating regions. A market is not limited to one city. | Globally unique slug; authenticated read; super-admin write. |
| `market_cities` | Many-to-many city membership in a market. | Composite primary key; one partial unique primary-city index per market. |
| `organizations` | Tenant root for property-management and vendor companies. | Unique slug; members read; owners/admins update; only platform administration creates. |
| `organization_markets` | Markets in which an organization operates. | Composite primary key; indexed by market; admins manage. |
| `organization_members` | User role and lifecycle status inside an organization. A user may hold different roles in different tenants. | Unique organization/user pair; owner/admin escalation is prevented by RLS. |
| `property_manager_profiles` | Manager-specific licensing and employment fields attached to a membership. | One-to-one with organization membership. |
| `property_manager_assignments` | Effective-dated manager-to-property assignment. | Composite primary key; one active primary manager per property. |

## Properties and vendor marketplace

| Table | Purpose and relationships | Access/index notes |
|---|---|---|
| `properties` | Physical managed property tied to an organization, operating market, and canonical city. | Composite FKs require both organization-market and market-city validity; indexed by organization, city, market, and status. |
| `vendor_categories` | Platform taxonomy for top-level service categories such as HVAC and plumbing. | Former `trades` table; authenticated read and platform write. |
| `vendor_services` | Specific services within a category, such as no-cooling service or leak repair. | Unique category/slug and indexed category/name lookup. |
| `vendor_profiles` | Vendor marketplace profile, aggregate rating, verification summary, and performance summary. | One-to-one with a vendor organization; verification index. |
| `vendor_category_assignments` | Categories a vendor is qualified to serve. | Composite primary key by vendor/category. |
| `vendor_service_offerings` | Vendor-specific service, pricing hints, and emergency availability. | Composite primary key and reverse service lookup index. |
| `vendor_service_cities` | Vendor coverage and travel fee for a city. | Composite primary key and city-first discovery index. |
| `organization_vendor_relationships` | Private property-company relationship with a vendor, including preferred, paused, and blocked states. | Unique property organization/vendor pair. |
| `vendor_membership_levels` | Platform subscription tiers, pricing, limits, and JSON entitlements. | Unique code and rank; public-to-authenticated catalog. |
| `vendor_memberships` | Effective subscription history for a vendor. | Partial unique index permits only one current subscription. |
| `vendor_badges` | Badge definitions and presentation metadata. | Unique code; platform managed. |
| `vendor_badge_awards` | Effective-dated badge awards, expiry, and revocation. | Active-vendor partial index. |
| `vendor_verifications` | Individual identity, business, license, insurance, background, tax, and bank checks. | Vendor/status/type and expiry indexes; vendor submits, platform reviews. |
| `vendor_verification_files` | Evidence files for one verification check. | Composite primary key with restrictive file deletion. |
| `vendor_reviews` | Verified review for exactly one completed work order, including category ratings and vendor response. | Unique work order; vendor/published and property-organization indexes. |

## Requests, quotes, and work execution

| Table | Purpose and relationships | Access/index notes |
|---|---|---|
| `service_requests` | Canonical issue/request record connecting property, category, optional service, requester, publication, budget, and assigned vendor. | Human request number; organization/status, property, category, service, and assigned-vendor indexes. |
| `cleaning_requests` | Cleaning-specific one-to-one request details, including cleaning type and recurrence. | Primary/FK is `service_request_id`; parent request controls access. |
| `carpet_cleaning_requests` | Carpet-specific area, room, material, stain, pet, and furniture details. | Primary/FK is `service_request_id`; parent request controls access. |
| `emergency_requests` | Emergency classification, safety state, acknowledgement, and escalation. | Primary/FK is `service_request_id`; parent request controls access. |
| `quotes` | Vendor commercial response to one service request. | Former `bids`; one quote per vendor/request; vendor and request/status indexes. |
| `quote_line_items` | Quantity and unit-price lines for a quote. | Stored generated line totals; ordered quote index. |
| `work_orders` | Awarded execution record tying request, quote, both organizations, technician, schedule, status, and completion. | Human work-order number; party, technician, and status indexes. |

## Financial operations

| Table | Purpose and relationships | Access/index notes |
|---|---|---|
| `invoices` | Vendor invoice to a property organization, normally connected to a work order. | Generated total; human invoice number; party/status and overdue indexes. |
| `invoice_line_items` | Quantity, unit price, total, taxability, and ordering for invoice lines. | Stored generated line totals; invoice/order index. |
| `payments` | Payment-provider-neutral transaction between payer and payee organizations for one invoice. | External payment ID is unique; invoice and party/time indexes. Client sessions cannot create payment success records. |

## Communication, notifications, and files

| Table | Purpose and relationships | Access/index notes |
|---|---|---|
| `notification_preferences` | Per-event delivery-channel choices for one user. | Composite user/event key; self-only RLS. |
| `notifications` | Durable in-app, email, SMS, and push delivery/read state. | Deduplication, unread-user, and queued-delivery indexes. |
| `user_vendor_favorites` | User favorite of a vendor in a tenant context. | Composite user/vendor/organization key. |
| `conversations` | Direct, request, work-order, or support thread. | Optional request/work-order FKs; organization and context indexes. |
| `conversation_participants` | Read, mute, join, and leave state for a conversation participant. | Composite conversation/user key and active user index. |
| `messages` | Message body, reply relationship, edit time, and soft deletion. | Cursor-friendly conversation/time/ID index. |
| `files` | Immutable Supabase Storage metadata, checksum, ownership, visibility, and malware-scan state. | Unique bucket/path; organization and uploader indexes; bytes are not stored in PostgreSQL. |
| `property_files` | Properly constrained property attachments. | Composite property/file key. |
| `service_request_files` | Properly constrained request attachments. | Composite request/file key; parent access policy. |
| `work_order_files` | Properly constrained work-order attachments. | Composite work-order/file key; party access policy. |
| `invoice_files` | Properly constrained invoice documents. | Composite invoice/file key; party access policy. |
| `message_files` | Properly constrained message attachments. | Composite message/file key; participant access policy. |
| `warranty_claim_files` | Properly constrained claim evidence and decision documents. | Composite claim/file key; property-team access policy. |

## Warranties and appliances

| Table | Purpose and relationships | Access/index notes |
|---|---|---|
| `warranty_programs` | Organization warranty/service-contract definition, coverage, deductible, and provider. | Unique organization/name/start date; active organization index. |
| `property_warranty_enrollments` | Effective property enrollment in a warranty program. | Unique program/property/start date; property/status/expiry index. |
| `warranty_claims` | Claim tied to enrollment and optionally to a service request and appliance. | Enrollment/status and optional request indexes. |
| `appliances` | Property appliance/equipment inventory with model, serial, asset tag, lifecycle, warranty, and cost. | Organization asset tag uniqueness; partial serial uniqueness; property and warranty-expiry indexes. |
| `appliance_service_history` | Inspection, maintenance, repair, replacement, installation, and recall history. | Appliance/time index; optional request/work-order/vendor relationships. |

## Analytics, AI, and platform infrastructure

| Table | Purpose and relationships | Access/index notes |
|---|---|---|
| `analytics_events` | Partitioned append-only product and operational event stream with organization, market, city, user, and entity context. | Range partitioned by `occurred_at`; administrators read tenant events. |
| `analytics_events_default` | Safe default analytics partition until scheduled time partitions are provisioned. | Organization/time and event/time indexes. |
| `daily_organization_metrics` | Dashboard-ready daily aggregates at organization or optional market scope. | Expression-based unique scope index and market/date index. |
| `ai_conversations` | User-owned AI thread with organization context, context entity, model, and prompt provenance. | Active user and organization/time indexes. |
| `ai_messages` | Structured user, assistant, system, and tool content plus token accounting. | Conversation/time/ID index. |
| `ai_tool_runs` | Idempotent tool execution with input/output, failure, approval, and lifecycle state. | Unique idempotency key and active-status queue index. High-impact runs support mandatory approval. |
| `ai_feedback` | One positive or negative user rating per AI message. | Unique message/user pair. |
| `audit_events` | Append-only security and business event history. | Organization/time index; administrators read and members append attributed actions. |
| `outbox_events` | Transactional queue for integrations, delivery, analytics projection, and AI processing. | Partial pending/failed availability index; workers process idempotently. |

## Row-level security model

- Global reference data is readable by authenticated users and writable only by super admins.
- Tenant tables call security-definer membership helpers that set an empty search path.
- Property-company data is available only to active organization members with role-sensitive mutation policies.
- Marketplace requests become visible to vendors only through assignment, an existing quote, or matching city/category publication rules.
- Cross-party records—work orders, invoices, payments, messages, and shared files—authorize either party explicitly.
- Notifications, preferences, favorites, and ordinary AI conversations are user-owned.
- Payment settlement, subscription state, badge awards, aggregate metrics, assistant messages, and most tool execution are intentionally service-role workflows.
- Tenant-defining foreign keys are protected from reassignment after insert.

## Migration operations

Apply migrations in filename order. Never edit an applied migration; add a new timestamped migration. Before production rollout, run migrations in a Supabase branch or staging project, regenerate TypeScript database types from that schema, run policy tests with at least two unrelated tenants, and only then promote the migration.
