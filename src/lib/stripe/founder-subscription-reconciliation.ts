import "server-only";
import { FOUNDING_PARTNER_PLAN, getVendorPlanPriceId, getVendorPlanProductId } from "@/src/domain/vendor-memberships/catalog";
import { getStripeClient } from "@/src/lib/stripe/client";

function id(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

export async function retrieveAndVerifyFounderSubscriptionCheckout(checkoutSessionId: string) {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, { expand: ["line_items.data.price", "customer"] });
  const lines = session.line_items?.data ?? [];
  const price = lines.length === 1 && typeof lines[0]?.price !== "string" ? lines[0]?.price : null;
  const actualProductId = price ? id(price.product) : null;
  const subscriptionId = id(session.subscription);
  const customerId = id(session.customer);
  const customer = session.customer && typeof session.customer !== "string" ? session.customer : customerId ? await stripe.customers.retrieve(customerId) : null;
  const customerEmail = customer && !("deleted" in customer && customer.deleted) ? customer.email : session.customer_details?.email;
  const subscription = subscriptionId ? await stripe.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price"] }) : null;
  const subscriptionPrice = subscription?.items.data[0]?.price;
  const subscriptionPriceId = typeof subscriptionPrice === "string" ? subscriptionPrice : subscriptionPrice?.id;
  const periodEnd = subscription ? Math.max(...subscription.items.data.map((item) => item.current_period_end)) : 0;
  const expectedPriceId = getVendorPlanPriceId(FOUNDING_PARTNER_PLAN);
  const expectedProductId = getVendorPlanProductId(FOUNDING_PARTNER_PLAN);
  const eligibleStatus = subscription?.status === "active" || subscription?.status === "trialing" || subscription?.status === "past_due";

  if (
    session.mode !== "subscription" || session.status !== "complete" || session.payment_status !== "paid"
    || session.amount_total !== FOUNDING_PARTNER_PLAN.amountCents || session.currency?.toUpperCase() !== FOUNDING_PARTNER_PLAN.currency
    || !session.id.startsWith("cs_") || !subscriptionId?.startsWith("sub_") || !customerId?.startsWith("cus_")
    || !customerEmail || lines[0]?.quantity !== 1 || !price || price.id !== expectedPriceId || subscriptionPriceId !== expectedPriceId
    || actualProductId !== expectedProductId || price.type !== "recurring" || price.recurring?.interval !== "year"
    || price.recurring.interval_count !== 1 || price.unit_amount !== FOUNDING_PARTNER_PLAN.amountCents
    || price.currency.toUpperCase() !== FOUNDING_PARTNER_PLAN.currency || price.active !== true
    || price.livemode !== (process.env.NODE_ENV === "production") || !subscription || !eligibleStatus || periodEnd <= subscription.start_date
  ) return null;

  return {
    checkoutSessionId: session.id,
    subscriptionId,
    customerId,
    customerEmail: customerEmail.toLowerCase(),
    priceId: expectedPriceId,
    membershipStatus: subscription.status as "active" | "trialing" | "past_due",
    periodEnd: new Date(periodEnd * 1000).toISOString(),
    amountCents: session.amount_total,
    currency: FOUNDING_PARTNER_PLAN.currency,
    paidAt: new Date(subscription.start_date * 1000).toISOString(),
  };
}
