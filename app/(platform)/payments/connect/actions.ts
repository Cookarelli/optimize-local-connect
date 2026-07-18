"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import {
  createConnectedAccount,
  createConnectedAccountLink,
  createPlatformProduct,
  getConnectedAccountStatus,
} from "@/src/lib/stripe/connect";

function requireConnectManager(user: Awaited<ReturnType<typeof requireUser>>) {
  const membership = user.memberships[0];
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    throw new Error("Only an organization owner or admin can manage payment onboarding.");
  }
  return membership;
}

export async function startConnectOnboarding() {
  const user = await requireUser();
  const membership = requireConnectManager(user);
  const admin = createSupabaseAdminClient();
  const { data: existing, error: lookupError } = await admin.from("stripe_connected_accounts")
    .select("stripe_account_id")
    .eq("organization_id", membership.organizationId)
    .maybeSingle();
  if (lookupError) throw new Error("Unable to check this organization's payment account.");

  let accountId = existing?.stripe_account_id;
  if (!accountId) {
    const account = await createConnectedAccount({
      organizationId: membership.organizationId,
      displayName: membership.organizationName,
      contactEmail: user.email,
    });
    accountId = account.id;
    const { error } = await admin.from("stripe_connected_accounts").upsert({
      organization_id: membership.organizationId,
      stripe_account_id: account.id,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id" });
    if (error) throw new Error("Stripe created the account, but its organization mapping could not be saved. Contact support before retrying.");
  }

  const link = await createConnectedAccountLink(accountId);
  redirect(link.url);
}

const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  price: z.string().regex(/^\d{1,7}(?:\.\d{1,2})?$/),
});

export async function createProduct(formData: FormData) {
  const user = await requireUser();
  const membership = requireConnectManager(user);
  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    price: formData.get("price"),
  });
  if (!parsed.success) throw new Error("Enter a product name, optional description, and a valid USD price with at most two decimals.");

  const priceInCents = Math.round(Number(parsed.data.price) * 100);
  if (priceInCents < 50) throw new Error("Stripe products must cost at least $0.50.");
  const admin = createSupabaseAdminClient();
  const { data: mapping, error: mappingError } = await admin.from("stripe_connected_accounts")
    .select("id,stripe_account_id")
    .eq("organization_id", membership.organizationId)
    .maybeSingle();
  if (mappingError || !mapping) throw new Error("Onboard this organization to Stripe before creating a product.");
  const status = await getConnectedAccountStatus(mapping.stripe_account_id);
  if (!status.readyToReceivePayments) throw new Error("Finish Stripe onboarding before publishing products.");

  const product = await createPlatformProduct({
    organizationId: membership.organizationId,
    connectedAccountId: mapping.stripe_account_id,
    name: parsed.data.name,
    description: parsed.data.description,
    priceInCents,
    currency: "usd",
  });
  const stripePriceId = typeof product.default_price === "string" ? product.default_price : product.default_price?.id;
  if (!stripePriceId) throw new Error("Stripe created the product without a default price. Contact support.");
  const { error } = await admin.from("marketplace_products").insert({
    seller_organization_id: membership.organizationId,
    stripe_connected_account_id: mapping.id,
    stripe_product_id: product.id,
    stripe_price_id: stripePriceId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    unit_amount_cents: priceInCents,
    currency: "USD",
    created_by: user.id,
  });
  if (error) throw new Error("Stripe created the product, but the storefront listing could not be saved. Contact support before retrying.");
  redirect("/payments/connect?product=created");
}

