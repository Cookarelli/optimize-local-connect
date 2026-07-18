"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/src/lib/auth/session";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { calculateApplicationFee, createDestinationCheckout, getConnectedAccountStatus } from "@/src/lib/stripe/connect";

const checkoutSchema = z.object({ productId: z.string().uuid(), email: z.string().trim().email() });

export async function buyMarketplaceProduct(formData: FormData) {
  const parsed = checkoutSchema.safeParse({ productId: formData.get("productId"), email: formData.get("email") });
  if (!parsed.success) throw new Error("Choose a valid product and enter a valid receipt email.");
  const admin = createSupabaseAdminClient();
  const { data: product, error } = await admin.from("marketplace_products")
    .select("id,seller_organization_id,stripe_price_id,unit_amount_cents,currency,active,stripe_connected_accounts(stripe_account_id)")
    .eq("id", parsed.data.productId)
    .eq("active", true)
    .maybeSingle();
  if (error || !product) throw new Error("This product is not available.");
  const mapping = product.stripe_connected_accounts as unknown as { stripe_account_id: string } | null;
  if (!mapping) throw new Error("The seller payment account is unavailable.");

  // A product can remain visible while Stripe requests updated information, so
  // readiness is rechecked immediately before every checkout session.
  const connectedStatus = await getConnectedAccountStatus(mapping.stripe_account_id);
  if (!connectedStatus.readyToReceivePayments) throw new Error("The seller must update their Stripe account before accepting platform payments.");

  const user = await getCurrentUser();
  const orderId = crypto.randomUUID();
  const applicationFeeCents = calculateApplicationFee(product.unit_amount_cents);
  const checkout = await createDestinationCheckout({
    orderId,
    productId: product.id,
    priceId: product.stripe_price_id,
    sellerOrganizationId: product.seller_organization_id,
    destinationAccountId: mapping.stripe_account_id,
    amountCents: product.unit_amount_cents,
    applicationFeeCents,
    customerEmail: parsed.data.email,
  });
  if (!checkout.url) throw new Error("Stripe did not return a hosted Checkout URL.");
  const { error: saveError } = await admin.from("marketplace_orders").insert({
    id: orderId,
    product_id: product.id,
    seller_organization_id: product.seller_organization_id,
    payer_organization_id: user?.memberships[0]?.organizationId ?? null,
    stripe_checkout_session_id: checkout.id,
    amount_cents: product.unit_amount_cents,
    application_fee_cents: applicationFeeCents,
    currency: product.currency,
    status: "checkout_created",
    customer_email: parsed.data.email,
  });
  if (saveError) throw new Error("Checkout was created but the order could not be saved. Do not pay; contact support.");
  redirect(checkout.url);
}

