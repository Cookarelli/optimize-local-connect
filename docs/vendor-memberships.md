# Vendor Marketplace Memberships

Vendor memberships are commercial marketplace products. They never grant organization roles or bypass tenant authorization. Search placement is disclosed in the interface as Premium placement, while reviews, credential status, response history, and Optimize Score remain performance or verification signals.

## Plans

| Plan | Price | Governed benefits |
| --- | --- | --- |
| Network Member | $19/month | Paid directory visibility, standard profile, and property-manager opportunities |
| Preferred Vendor | $49/month | Enhanced placement, Preferred badge, Property Manager Perk, and expanded profile visibility |
| Founding Partner | $299/year; maximum 50 | Founder badge, premium placement, Property Manager Perk, and core vendor-network access while eligible |

The Founding Partner capacity is enforced transactionally against a locked membership-level row. New purchases use hosted Stripe Checkout in subscription mode with the recurring annual Price from `STRIPE_FOUNDING_VENDOR_PRICE_ID`. The first charge is immediate and renewal is automatic every 12 months until canceled. Historical Founding Fifty payments remain available only for explicit reconciliation.

## Entitlements and lifecycle

`vendor_membership_levels.features` is the public product catalog. Every activated membership receives an `entitlements_snapshot`, preserving the exact rules that applied at activation. The trusted `activate_vendor_membership` procedure expires the prior current membership, enforces capacity, writes an immutable idempotent lifecycle event, and records an audit event.

Videos and coupons have durable relational records and database-level entitlement checks. Analytics use the existing append-only `analytics_events` stream. Push notifications use the existing notification preferences, delivery queue, and outbox. Future billing adapters should call trusted membership activation only after verified provider events; browser redirects must never activate access.

## Verification and marketplace ranking

Verified status requires the vendor profile plus verified, unexpired trade-license and insurance records. Marketplace ordering uses membership placement, then current verification, rating, completed jobs, and name. Premium and Founding Partner cards visibly disclose placement. Optimize AI decision runs remain separate, explainable, and governed by their versioned decision policy.

## APIs

- `GET /api/marketplace/vendors` accepts search, city, category, credential filters, and pagination.
- `GET /api/vendor-memberships` returns the plan catalog and the authenticated vendor organization's current membership.

Both endpoints require authentication. Write activation remains a trusted server-side operation rather than a public API.
