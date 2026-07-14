# Vendor Marketplace Memberships

Vendor memberships are commercial marketplace products. They never grant organization roles or bypass tenant authorization. Search placement is disclosed in the interface as Premium placement, while reviews, credential status, response history, and Optimize Score remain performance or verification signals.

## Plans

| Plan | Price | Governed benefits |
| --- | --- | --- |
| Free | $0 | Marketplace profile, standard search, five quotes per month |
| Verified | Credential review | Current license and insurance verification, verified badge, priority search |
| Premium | $49/month | AI placement, homepage placement, videos, coupons, analytics, push notifications, and Verified benefits |
| Founding Partner | $299 one-time; maximum 50 | One year of Premium, permanent Founding Partner badge, locked renewal pricing, all Premium benefits |

The Founding Partner capacity is enforced transactionally against a locked membership-level row. The existing Founding Fifty claim workflow remains the authoritative checkout and seat-allocation flow. Confirmed claims are normalized to the Founding Partner tier and receive a permanent badge.

## Entitlements and lifecycle

`vendor_membership_levels.features` is the public product catalog. Every activated membership receives an `entitlements_snapshot`, preserving the exact rules that applied at activation. The trusted `activate_vendor_membership` procedure expires the prior current membership, enforces capacity, writes an immutable idempotent lifecycle event, and records an audit event.

Videos and coupons have durable relational records and database-level entitlement checks. Analytics use the existing append-only `analytics_events` stream. Push notifications use the existing notification preferences, delivery queue, and outbox. Future billing adapters should call trusted membership activation only after verified provider events; browser redirects must never activate access.

## Verification and marketplace ranking

Verified status requires the vendor profile plus verified, unexpired trade-license and insurance records. Marketplace ordering uses membership placement, then current verification, rating, completed jobs, and name. Premium and Founding Partner cards visibly disclose placement. Optimize AI decision runs remain separate, explainable, and governed by their versioned decision policy.

## APIs

- `GET /api/marketplace/vendors` accepts search, city, category, credential filters, and pagination.
- `GET /api/vendor-memberships` returns the plan catalog and the authenticated vendor organization's current membership.

Both endpoints require authentication. Write activation remains a trusted server-side operation rather than a public API.
