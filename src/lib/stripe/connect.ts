import "server-only";

import { z } from "zod";
import { getStripeClient } from "@/src/lib/stripe/client";

const connectEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  // Business configuration: 300 basis points = a 3.00% platform fee.
  // Zero is accepted only when the platform intentionally absorbs Stripe fees.
  STRIPE_CONNECT_APPLICATION_FEE_BPS: z.coerce.number().int().min(0).max(10000),
});

export function getConnectEnv() {
  const parsed = connectEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error("Stripe Connect is not configured. Add NEXT_PUBLIC_APP_URL and STRIPE_CONNECT_APPLICATION_FEE_BPS (300 for the approved 3% fee).");
  }
  return parsed.data;
}

export async function createConnectedAccount(input: { organizationId: string; displayName: string; contactEmail: string }) {
  const stripeClient = getStripeClient();
  // Account V2 uses configurations instead of the legacy top-level `type`.
  // These are intentionally the exact recipient properties prescribed by Stripe:
  // the platform collects fees and covers losses, while the organization can
  // receive transfers into its connected Stripe balance.
  return stripeClient.v2.core.accounts.create({
    display_name: input.displayName,
    contact_email: input.contactEmail,
    identity: { country: "us" },
    dashboard: "express",
    defaults: { responsibilities: { fees_collector: "application", losses_collector: "application" } },
    configuration: {
      recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
    },
  }, { idempotencyKey: `connect-account-${input.organizationId}` });
}

export async function getConnectedAccountStatus(accountId: string) {
  const stripeClient = getStripeClient();
  // Status is always fetched live from Stripe; it is intentionally not cached in DB.
  const account = await stripeClient.v2.core.accounts.retrieve(accountId, {
    include: ["configuration.recipient", "requirements"],
  });
  const transferStatus = account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;
  const deadlineStatus = account.requirements?.summary?.minimum_deadline?.status;
  return {
    account,
    readyToReceivePayments: transferStatus === "active",
    onboardingComplete: deadlineStatus !== "currently_due" && deadlineStatus !== "past_due",
    transferStatus: transferStatus ?? "unrequested",
    requirementsStatus: deadlineStatus ?? "none",
  };
}

export async function createConnectedAccountLink(accountId: string) {
  const stripeClient = getStripeClient();
  const { NEXT_PUBLIC_APP_URL } = getConnectEnv();
  const root = NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  // Account Links are single use. Both URLs return to an authenticated route;
  // the refresh action creates a fresh link instead of trusting an account ID URL.
  return stripeClient.v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        configurations: ["recipient"],
        collection_options: { fields: "eventually_due", future_requirements: "include" },
        refresh_url: `${root}/payments/connect?refresh=1`,
        return_url: `${root}/payments/connect?returned=1`,
      },
    },
  });
}

export async function createPlatformProduct(input: {
  organizationId: string;
  connectedAccountId: string;
  name: string;
  description?: string;
  priceInCents: number;
  currency: string;
}) {
  const stripeClient = getStripeClient();
  // No stripeAccount request option is supplied: the Product and Price therefore
  // live on the platform, with the seller mapping stored in both metadata and DB.
  return stripeClient.products.create({
    name: input.name,
    description: input.description || undefined,
    metadata: {
      seller_organization_id: input.organizationId,
      connected_account_id: input.connectedAccountId,
    },
    default_price_data: { unit_amount: input.priceInCents, currency: input.currency.toLowerCase() },
  }, { idempotencyKey: `marketplace-product-${input.organizationId}-${crypto.randomUUID()}` });
}

export function calculateApplicationFee(amountCents: number) {
  const { STRIPE_CONNECT_APPLICATION_FEE_BPS } = getConnectEnv();
  return Math.min(amountCents, Math.round(amountCents * STRIPE_CONNECT_APPLICATION_FEE_BPS / 10000));
}

export async function createDestinationCheckout(input: {
  orderId: string;
  productId: string;
  priceId: string;
  sellerOrganizationId: string;
  destinationAccountId: string;
  amountCents: number;
  applicationFeeCents: number;
  customerEmail?: string;
}) {
  const stripeClient = getStripeClient();
  const { NEXT_PUBLIC_APP_URL } = getConnectEnv();
  const root = NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return stripeClient.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: input.priceId, quantity: 1 }],
    customer_email: input.customerEmail || undefined,
    billing_address_collection: "auto",
    success_url: `${root}/storefront/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${root}/storefront?checkout=cancelled`,
    metadata: {
      purchase_type: "marketplace_product",
      marketplace_order_id: input.orderId,
      marketplace_product_id: input.productId,
      seller_organization_id: input.sellerOrganizationId,
    },
    payment_intent_data: {
      // Stripe can reject an explicit zero application fee. Omitting it keeps the
      // transfer valid when the platform has deliberately chosen to absorb fees.
      ...(input.applicationFeeCents > 0 ? { application_fee_amount: input.applicationFeeCents } : {}),
      transfer_data: { destination: input.destinationAccountId },
      metadata: { marketplace_order_id: input.orderId },
    },
  }, { idempotencyKey: `marketplace-order-${input.orderId}` });
}
