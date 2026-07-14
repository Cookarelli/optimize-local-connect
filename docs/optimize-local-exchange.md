# Optimize Local Exchange™ — Version 3 Architecture

Optimize Local Exchange lets organizations exchange services because unused capacity has value. It is not positioned as emergency barter or a substitute for money. It is a structured way for trusted local businesses to put available skills, time, and capacity to productive use.

The module is registered as a planned shared-core capability with `target_version: 3` and `ui_exposed: false`. Every industry vertical receives a disabled, optional module mapping. Version 1 has no Exchange routes, navigation, public APIs, or ordinary-user credit access.

## Domain model

| Capability | Tables | Responsibility |
| --- | --- | --- |
| Open To Trade | `exchange_business_profiles` | Organization opt-in, travel preference, capacity summary, matching preference, and activation state |
| Business Needs | `exchange_business_needs` | Published demand by vertical, service, city, timing, recurrence, and estimated value |
| Business Offers | `exchange_business_offers` | Published unused capacity by service, city, availability window, and estimated value |
| Trade Requests | `exchange_trade_requests` | Broadcast or targeted request with lifecycle, expiry, and human creator |
| Trade Offers | `exchange_trade_proposals`, `exchange_proposal_items` | Versioned proposals describing what each party offers and requests |
| Trade History | `exchange_trades`, `exchange_trade_deliverables` | Immutable agreement snapshot, parties, execution status, evidence, and completion |
| Trade Ratings | `exchange_trade_ratings` | One reciprocal review per organization and completed trade, including reliability and capacity accuracy |
| AI Matching | `exchange_match_runs`, `exchange_match_candidates` | Provider-neutral, explainable candidates linked optionally to a governed Optimize AI optimization run |
| Future Trade Credits | `exchange_credit_*` | Disabled program catalog, accounts, balanced double-entry ledger, and service-only posting |

## Invariants and security

- All records use organization foreign keys and existing city, vertical, vendor-category, service, user, file, audit, and outbox foundations.
- Needs and offers become discoverable only when published and the organization is open to trade.
- Requests, proposals, agreements, and deliverables are visible only to participating organizations and Super Admins.
- Organization roles authorize drafts; accepted agreements and AI outputs require trusted server workflows before Version 3 activation.
- Key party and creator identifiers cannot be reassigned after creation.
- Trade ratings require a completed trade and one rater record per participating organization.
- Estimated values support matching, accounting, and fair comparison; they do not turn the exchange into a cash-equivalent instrument.

## AI matching

`exchange_match_runs` stores the policy key/version and immutable input snapshot. Candidates retain score, confidence, contributions, eligibility, and exclusion reasons. A run may link to `ai_optimization_runs`, preserving provider/model provenance without hardcoding a model provider. Recommended future criteria include skill fit, reciprocal-need fit, available capacity, distance, availability, Optimize Score, trade reliability, and estimated value balance.

AI proposes matches. It does not accept terms, create a trade, transfer credits, or schedule work without explicit authorization and the required human approval.

## Future trade credits

The seeded credit program is `planned`, non-transferable, not cash-equivalent, and hidden from users. Credits cannot post unless the program is explicitly activated after separate legal, tax, and accounting review. Posting is service-role only, idempotent at the transaction boundary, requires balanced debit and credit entries, locks affected balances, rejects insufficient balances, and emits an outbox event.

Before Version 3, add atomic proposal acceptance, dispute resolution, content moderation, notification consumers, accounting exports, market-specific legal terms, cross-tenant policy tests, and full workflow APIs. Do not expose the UI merely because the tables exist.
