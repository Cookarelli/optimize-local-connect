import "server-only";

import { z } from "zod";
import {
  buildFoundingPartnerCheckoutParams,
  FOUNDING_PARTNER_AMOUNT_CENTS,
  FOUNDING_PARTNER_CURRENCY,
  FOUNDING_PARTNER_MEMBERSHIP_TYPE,
} from "@/src/domain/founding-partner/checkout";

const stripeEnvSchema = z.object({
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
  STRIPE_FOUNDING_PRODUCT_ID: z.string().startsWith("prod_"),
});

const createdSessionSchema = z.object({
  id: z.string().startsWith("cs_"),
  url: z.string().url(),
  expires_at: z.number().int().positive(),
});

const checkoutSessionSchema = z.object({
  id: z.string().startsWith("cs_"),
  client_reference_id: z.string().nullable(),
  mode: z.string(),
  payment_status: z.string(),
  status: z.string().nullable(),
  customer: z.union([z.string(), z.object({ id: z.string() })]).nullable(),
  customer_details: z.object({
    email: z.string().email().nullable(),
    name: z.string().nullable().optional(),
    business_name: z.string().nullable().optional(),
    individual_name: z.string().nullable().optional(),
  }).nullable(),
  amount_total: z.number().int().nullable(),
  currency: z.string().nullable(),
  metadata: z.record(z.string(), z.string()).default({}),
  payment_intent: z.union([z.string(), z.object({
    id: z.string(),
    created: z.number().int().positive().optional(),
    status: z.string().optional(),
    amount_received: z.number().int().optional(),
    currency: z.string().optional(),
  })]).nullable(),
  line_items: z.object({
    data: z.array(z.object({
      quantity: z.number().int().nullable(),
      price: z.object({
        product: z.union([z.string(), z.object({ id: z.string() })]),
        unit_amount: z.number().int().nullable(),
        currency: z.string(),
      }).nullable(),
    })),
  }),
});

export type VerifiedStripeCheckout = {
  claimId: string;
  sessionId: string;
  paymentIntentId: string;
};

export type VerifiedFoundingPartnerCheckout = {
  attemptId: string;
  sessionId: string;
  customerId: string;
  paymentIntentId: string;
  amountPaidCents: number;
  currency: string;
  paymentStatus: "paid";
  customerEmail: string;
  customerName: string | null;
  membershipType: typeof FOUNDING_PARTNER_MEMBERSHIP_TYPE;
  paidAt: string;
};

function getStripeEnv() {
  return stripeEnvSchema.parse(process.env);
}

async function stripeRequest(path: string, init?: RequestInit) {
  const env = getStripeEnv();
  const response = await fetch(`https://api.stripe.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Stripe-Version": "2025-09-30.clover",
      ...(init?.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const requestId = response.headers.get("request-id");
    throw new Error(`Stripe request failed (${response.status}${requestId ? `, ${requestId}` : ""}).`);
  }
  return response.json() as Promise<unknown>;
}

export async function createStripeCheckout(input: {
  claimId: string;
  amountCents: number;
  currency: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const env = getStripeEnv();
  const body = new URLSearchParams({
    mode: "payment",
    client_reference_id: input.claimId,
    customer_email: input.email,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    "metadata[claim_id]": input.claimId,
    "payment_intent_data[metadata][claim_id]": input.claimId,
    "line_items[0][price_data][currency]": input.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": input.amountCents.toString(),
    "line_items[0][price_data][product]": env.STRIPE_FOUNDING_PRODUCT_ID,
    "line_items[0][quantity]": "1",
    "payment_method_types[0]": "card",
    submit_type: "pay",
    expires_at: (Math.floor(Date.now() / 1000) + 31 * 60).toString(),
  });
  const session = createdSessionSchema.parse(await stripeRequest("/v1/checkout/sessions", { method: "POST", body }));
  return { id: session.id, url: session.url, expiresAt: new Date(session.expires_at * 1000).toISOString() };
}

export async function createFoundingPartnerStripeCheckout(input: {
  attemptId: string;
  successUrl: string;
  cancelUrl: string;
  expiresAt: Date;
}) {
  const env = getStripeEnv();
  const body = buildFoundingPartnerCheckoutParams({
    attemptId: input.attemptId,
    productId: env.STRIPE_FOUNDING_PRODUCT_ID,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    expiresAtEpochSeconds: Math.floor(input.expiresAt.getTime() / 1000),
  });
  const session = createdSessionSchema.parse(await stripeRequest("/v1/checkout/sessions", {
    method: "POST",
    body,
    headers: { "Idempotency-Key": `founding-partner-${input.attemptId}` },
  }));
  return { id: session.id, url: session.url, expiresAt: new Date(session.expires_at * 1000).toISOString() };
}

export async function retrieveAndVerifyStripeCheckout(sessionId: string): Promise<VerifiedStripeCheckout | null> {
  const env = getStripeEnv();
  const session = checkoutSessionSchema.parse(await stripeRequest(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand%5B%5D=line_items`));
  const claimId = session.client_reference_id;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  const item = session.line_items.data[0];
  const productId = typeof item?.price?.product === "string" ? item.price.product : item?.price?.product.id;
  if (!claimId || !uuid.test(claimId) || session.metadata.claim_id !== claimId) return null;
  if (session.mode !== "payment" || session.status !== "complete" || session.payment_status !== "paid") return null;
  if (session.amount_total !== 29900 || session.currency?.toLowerCase() !== "usd") return null;
  if (!paymentIntentId?.startsWith("pi_") || session.line_items.data.length !== 1) return null;
  if (item?.quantity !== 1 || item.price?.unit_amount !== 29900 || item.price.currency.toLowerCase() !== "usd") return null;
  if (productId !== env.STRIPE_FOUNDING_PRODUCT_ID) return null;
  return { claimId, sessionId: session.id, paymentIntentId };
}

export async function retrieveAndVerifyFoundingPartnerCheckout(sessionId: string): Promise<VerifiedFoundingPartnerCheckout | null> {
  const env = getStripeEnv();
  const query = "expand%5B%5D=line_items&expand%5B%5D=payment_intent";
  const session = checkoutSessionSchema.parse(await stripeRequest(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}?${query}`));
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const attemptId = session.client_reference_id;
  const paymentIntent = typeof session.payment_intent === "string" ? null : session.payment_intent;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const item = session.line_items.data[0];
  const productId = typeof item?.price?.product === "string" ? item.price.product : item?.price?.product.id;
  const customerEmail = session.customer_details?.email;
  const customerName = session.customer_details?.business_name
    ?? session.customer_details?.individual_name
    ?? session.customer_details?.name
    ?? null;

  if (!attemptId || !uuid.test(attemptId) || session.metadata.founder_checkout_id !== attemptId) return null;
  if (session.metadata.membership_type !== FOUNDING_PARTNER_MEMBERSHIP_TYPE) return null;
  if (session.mode !== "payment" || session.status !== "complete" || session.payment_status !== "paid") return null;
  if (session.amount_total !== FOUNDING_PARTNER_AMOUNT_CENTS || session.currency?.toUpperCase() !== FOUNDING_PARTNER_CURRENCY) return null;
  if (!customerId?.startsWith("cus_") || !customerEmail) return null;
  if (!paymentIntent?.id.startsWith("pi_") || paymentIntent.status !== "succeeded" || !paymentIntent.created) return null;
  if (paymentIntent.amount_received !== FOUNDING_PARTNER_AMOUNT_CENTS || paymentIntent.currency?.toUpperCase() !== FOUNDING_PARTNER_CURRENCY) return null;
  if (session.line_items.data.length !== 1 || item?.quantity !== 1) return null;
  if (item.price?.unit_amount !== FOUNDING_PARTNER_AMOUNT_CENTS || item.price.currency.toUpperCase() !== FOUNDING_PARTNER_CURRENCY) return null;
  if (productId !== env.STRIPE_FOUNDING_PRODUCT_ID) return null;

  return {
    attemptId,
    sessionId: session.id,
    customerId,
    paymentIntentId: paymentIntent.id,
    amountPaidCents: FOUNDING_PARTNER_AMOUNT_CENTS,
    currency: FOUNDING_PARTNER_CURRENCY,
    paymentStatus: "paid",
    customerEmail,
    customerName,
    membershipType: FOUNDING_PARTNER_MEMBERSHIP_TYPE,
    paidAt: new Date(paymentIntent.created * 1000).toISOString(),
  };
}

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function verifyStripeWebhook(payload: string, signatureHeader: string | null) {
  const secret = getStripeEnv().STRIPE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const values = signatureHeader.split(",").map((part) => part.trim().split("=", 2));
  const timestamp = values.find(([key]) => key === "t")?.[1];
  const signatures = values.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || !signatures.length || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  return signatures.some((signature) => timingSafeEqual(digest, signature));
}
