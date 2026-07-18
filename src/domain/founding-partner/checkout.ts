export const FOUNDING_PARTNER_MEMBERSHIP_TYPE = "founding_partner";
export const FOUNDING_PARTNER_PRODUCT_NAME = "Optimize Local Connect Founding Partner";
export const FOUNDING_PARTNER_AMOUNT_CENTS = 29_900;
export const FOUNDING_PARTNER_CURRENCY = "USD";

export function buildFoundingPartnerCheckoutParams(input: {
  attemptId: string;
  productId: string;
  successUrl: string;
  cancelUrl: string;
  expiresAtEpochSeconds: number;
}) {
  return new URLSearchParams({
    mode: "payment",
    client_reference_id: input.attemptId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    customer_creation: "always",
    billing_address_collection: "auto",
    "name_collection[business][enabled]": "true",
    "name_collection[business][optional]": "false",
    "name_collection[individual][enabled]": "true",
    "name_collection[individual][optional]": "true",
    "metadata[founder_checkout_id]": input.attemptId,
    "metadata[membership_type]": FOUNDING_PARTNER_MEMBERSHIP_TYPE,
    "payment_intent_data[metadata][founder_checkout_id]": input.attemptId,
    "payment_intent_data[metadata][membership_type]": FOUNDING_PARTNER_MEMBERSHIP_TYPE,
    "payment_intent_data[description]": FOUNDING_PARTNER_PRODUCT_NAME,
    "line_items[0][price_data][currency]": FOUNDING_PARTNER_CURRENCY.toLowerCase(),
    "line_items[0][price_data][unit_amount]": FOUNDING_PARTNER_AMOUNT_CENTS.toString(),
    "line_items[0][price_data][product]": input.productId,
    "line_items[0][quantity]": "1",
    "payment_method_types[0]": "card",
    submit_type: "pay",
    expires_at: input.expiresAtEpochSeconds.toString(),
  });
}

export function isFoundingPartnerStripeEvent(type: string) {
  return type === "checkout.session.completed" || type === "checkout.session.expired";
}
