# The Founding Fifty

The Founding Fifty is a governed Optimize Local Connect program for 50 local businesses across 25 industries. Each industry has two seats. Every seat has a permanent number from #001 through #050.

## Integrity rules

- A seat is held atomically for 30 minutes; concurrent attempts cannot both succeed.
- Payment-link submissions remain awaiting verification. Browser query parameters never confirm payment.
- PayPal webhooks are verified with PayPal before an event is processed.
- Provider event IDs are unique, making duplicate webhook delivery idempotent.
- Confirmation atomically claims the seat, provisions a vendor organization when needed, activates Premium for 12 months, awards the permanent badge, assigns benefits, writes an audit event, and queues confirmation delivery.
- Failed, cancelled, expired, and rejected claims remain available for reporting.
- Permanent-number reassignment requires Super Admin access, a dedicated audited procedure, and the exact warning phrase `REASSIGN PERMANENT FOUNDING NUMBER`.

## Payment modes

The payment contract is provider-agnostic. The first adapter supports a configured PayPal payment link with manual verification and a verified PayPal webhook path. Provider credentials and URLs are environment configuration, never source data.

Required PayPal variables are documented in `.env.example`. When only `NEXT_PUBLIC_PAYPAL_PAYMENT_URL` is set, claims remain `awaiting_verification` until a Super Admin verifies the payment.
