import "server-only";

import Stripe from "stripe";

let stripeClient: Stripe | undefined;

/**
 * Returns the one server-only Stripe client used by every new Connect request.
 *
 * PLACEHOLDER CONFIGURATION: set STRIPE_SECRET_KEY to an sk_test_... key while
 * developing and an sk_live_... key only in the production hosting dashboard.
 * Never prefix this variable with NEXT_PUBLIC_ or pass it into a Client Component.
 */
export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey?.startsWith("sk_")) {
    throw new Error("Stripe is not configured. Add a server-only STRIPE_SECRET_KEY beginning with sk_test_ or sk_live_.");
  }

  // The SDK selects its bundled API version automatically, as requested by Stripe.
  // Fetch transport keeps the client compatible with the Cloudflare/Vinext runtime.
  stripeClient ??= new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() });
  return stripeClient;
}

