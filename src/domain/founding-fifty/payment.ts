export const FOUNDING_PAYMENT_PROVIDERS = ["stripe", "paypal"] as const;
export type FoundingPaymentProviderKey = (typeof FOUNDING_PAYMENT_PROVIDERS)[number];

export type CheckoutSession = {
  mode: "payment_link" | "api_checkout";
  redirectUrl: string;
  claimStatus: "payment_submitted" | "awaiting_verification";
  providerReference: string | null;
};

export interface FoundingPaymentAdapter {
  readonly key: FoundingPaymentProviderKey;
  createCheckout(input: {
    claimId: string;
    amountCents: number;
    currency: string;
    returnUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSession>;
}

export type PaymentOutcome = "verified" | "failed" | "cancelled" | "ignored";

const VERIFIED_EVENTS = new Set(["PAYMENT.CAPTURE.COMPLETED", "CHECKOUT.ORDER.APPROVED"]);
const FAILED_EVENTS = new Set(["PAYMENT.CAPTURE.DENIED", "PAYMENT.CAPTURE.DECLINED"]);
const CANCELLED_EVENTS = new Set(["CHECKOUT.ORDER.CANCELLED", "PAYMENT.CAPTURE.VOIDED"]);

export function classifyPayPalEvent(eventType: string): PaymentOutcome {
  if (VERIFIED_EVENTS.has(eventType)) return "verified";
  if (FAILED_EVENTS.has(eventType)) return "failed";
  if (CANCELLED_EVENTS.has(eventType)) return "cancelled";
  return "ignored";
}

export function extractClaimId(payload: unknown): string | null {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const visit = (value: unknown, key = ""): string | null => {
    if (typeof value === "string" && ["custom_id", "invoice_id", "claim_id"].includes(key) && uuid.test(value)) return value;
    if (Array.isArray(value)) {
      for (const item of value) { const match = visit(item); if (match) return match; }
    } else if (value && typeof value === "object") {
      for (const [childKey, child] of Object.entries(value)) { const match = visit(child, childKey); if (match) return match; }
    }
    return null;
  };
  return visit(payload);
}

export class PayPalPaymentLinkAdapter implements FoundingPaymentAdapter {
  readonly key = "paypal" as const;

  constructor(private readonly paymentUrl: string) {
    const parsed = new URL(paymentUrl);
    if (parsed.protocol !== "https:") throw new Error("PayPal payment links must use HTTPS.");
  }

  async createCheckout(_input: {
    claimId: string;
    amountCents: number;
    currency: string;
    returnUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSession> {
    void _input;
    return {
      mode: "payment_link",
      redirectUrl: this.paymentUrl,
      claimStatus: "awaiting_verification",
      providerReference: null,
    };
  }
}
