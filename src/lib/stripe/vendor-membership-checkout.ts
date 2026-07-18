import "server-only";

import { z } from "zod";
import { getVendorPlanByCode, getVendorPlanPriceId } from "@/src/domain/vendor-memberships/catalog";
import { getAppOrigin } from "@/src/lib/auth/origin";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { getStripeClient } from "@/src/lib/stripe/client";
import { createVendorMembershipCheckout } from "@/src/lib/stripe/memberships";

const preparedSchema = z.object({
  organization_id: z.string().uuid(),
  membership_id: z.string().uuid(),
  status: z.literal("pending"),
  checkout_session_id: z.string().startsWith("cs_").nullable(),
  stripe_customer_id: z.string().startsWith("cus_").nullable(),
  stripe_price_id: z.string().startsWith("price_"),
  checkout_attempt_number: z.number().int().positive(),
  onboarding_version: z.number().int().positive(),
  level_code: z.string(),
});

export class VendorCheckoutError extends Error {
  constructor(public readonly code: "unauthorized" | "already_active" | "checkout_unavailable") {
    super(code);
  }
}

export async function continueVendorMembershipCheckout(input: {
  userId: string;
  userEmail: string;
  organizationName: string;
  membershipId: string;
}) {
  const admin = createSupabaseAdminClient();
  const prepare = async () => {
    const { data, error } = await admin.rpc("authorize_and_prepare_vendor_membership_checkout", {
      target_membership_id: input.membershipId,
      target_user_id: input.userId,
    });
    if (error) {
      if (error.message.includes("not authorized")) throw new VendorCheckoutError("unauthorized");
      if (error.message.includes("active membership")) throw new VendorCheckoutError("already_active");
      throw new VendorCheckoutError("checkout_unavailable");
    }
    return preparedSchema.parse(data);
  };

  let prepared = await prepare();
  const plan = getVendorPlanByCode(prepared.level_code);
  if (!plan || getVendorPlanPriceId(plan) !== prepared.stripe_price_id) throw new VendorCheckoutError("checkout_unavailable");
  const stripeClient = getStripeClient();
  const recordFailure = async (code: string) => {
    await admin.rpc("record_vendor_membership_checkout_failure", { target_membership_id: prepared.membership_id, target_error_code: code });
  };

  if (prepared.checkout_session_id) {
    try {
      const existing = await stripeClient.checkout.sessions.retrieve(prepared.checkout_session_id);
      const metadataMembershipId = existing.metadata?.membership_record_id ?? existing.metadata?.vendor_membership_id;
      if (metadataMembershipId !== prepared.membership_id || existing.mode !== "subscription") throw new VendorCheckoutError("checkout_unavailable");
      if (existing.status === "open" && existing.url) return existing.url;
      if (existing.status !== "expired") throw new VendorCheckoutError("checkout_unavailable");
      await admin.rpc("fail_vendor_membership_checkout", { target_membership_id: prepared.membership_id });
      prepared = await prepare();
    } catch (error) {
      await recordFailure("checkout_resume_failed");
      throw error instanceof VendorCheckoutError ? error : new VendorCheckoutError("checkout_unavailable");
    }
  }

  let customerId = prepared.stripe_customer_id;
  if (!customerId) {
    const { data: mapped, error: lookupError } = await admin.from("vendor_billing_customers")
      .select("stripe_customer_id").eq("vendor_organization_id", prepared.organization_id).maybeSingle();
    if (lookupError) throw new VendorCheckoutError("checkout_unavailable");
    customerId = mapped?.stripe_customer_id ?? null;
  }
  if (!customerId) {
    try {
      const customer = await stripeClient.customers.create({
        email: input.userEmail,
        name: input.organizationName,
        metadata: { organization_id: prepared.organization_id, owner_user_id: input.userId },
      }, { idempotencyKey: `vendor-customer-${prepared.organization_id}` });
      customerId = customer.id;
      const { error: saveError } = await admin.from("vendor_billing_customers").upsert({
        vendor_organization_id: prepared.organization_id,
        stripe_customer_id: customerId,
      }, { onConflict: "vendor_organization_id" });
      if (saveError) throw saveError;
    } catch {
      await recordFailure("stripe_customer_failed");
      throw new VendorCheckoutError("checkout_unavailable");
    }
  }
  const { error: customerAttachError } = await admin.rpc("attach_vendor_membership_customer", {
    target_membership_id: prepared.membership_id,
    target_customer_id: customerId,
  });
  if (customerAttachError) {
    await recordFailure("customer_mapping_failed");
    throw new VendorCheckoutError("checkout_unavailable");
  }

  try {
    const origin = await getAppOrigin();
    const session = await createVendorMembershipCheckout({
      planKey: plan.key,
      organizationId: prepared.organization_id,
      membershipId: prepared.membership_id,
      userId: input.userId,
      customerId,
      onboardingVersion: prepared.onboarding_version,
      checkoutAttemptNumber: prepared.checkout_attempt_number,
      successUrl: `${origin}/vendor/membership/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/vendor/membership?checkout=cancelled`,
    });
    const { error: attachError } = await admin.rpc("attach_vendor_membership_checkout", {
      target_membership_id: prepared.membership_id,
      target_checkout_session_id: session.id,
    });
    if (attachError) throw attachError;
    return session.url;
  } catch (error) {
    console.error("vendor_membership_checkout_failed", { membershipId: prepared.membership_id, errorType: error instanceof Error ? error.name : "UnknownError" });
    await admin.rpc("record_vendor_membership_checkout_failure", { target_membership_id: prepared.membership_id, target_error_code: "stripe_checkout_failed" });
    throw new VendorCheckoutError("checkout_unavailable");
  }
}
