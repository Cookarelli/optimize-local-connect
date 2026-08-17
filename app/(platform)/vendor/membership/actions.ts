"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getVendorPlan, getVendorPlanPriceId, normalizeVendorPlanKey } from "@/src/domain/vendor-memberships/catalog";
import { getAppOrigin } from "@/src/lib/auth/origin";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { getStripeClient } from "@/src/lib/stripe/client";
import { continueVendorMembershipCheckout, VendorCheckoutError } from "@/src/lib/stripe/vendor-membership-checkout";
import { isFirebaseOperationalBackend } from "@/src/lib/firebase/platform";
import { startFirebaseCommercialMembershipCheckout } from "@/src/lib/firebase/membership-checkout";
import { getPlatformFirestore } from "@/src/lib/firebase/admin";

function billingOrganization(user: Awaited<ReturnType<typeof requireUser>>) {
  return user.memberships.find(item => item.organizationType === "vendor" && ["owner", "admin"].includes(item.role));
}

export async function startVendorMembershipCheckout(formData: FormData) {
  const user = await requireUser();
  const organization = billingOrganization(user);
  if (!organization) redirect("/vendor/membership?error=unauthorized");
  const key = normalizeVendorPlanKey(z.string().safeParse(formData.get("plan")).data ?? "");
  if (!key) redirect("/vendor/membership?error=invalid_plan");
  const plan = getVendorPlan(key)!;
  if (plan.key === "founding_partner") redirect("/founders");
  if (isFirebaseOperationalBackend()) {
    let checkoutUrl: string;
    try {
      checkoutUrl = await startFirebaseCommercialMembershipCheckout({ user, organizationId: organization.organizationId, organizationName: organization.organizationName, tier: plan.key });
    } catch (error) {
      redirect(`/vendor/membership?error=${error instanceof Error && error.message.includes("active membership") ? "already_active" : "checkout_unavailable"}`);
    }
    redirect(checkoutUrl);
  }
  const priceId = getVendorPlanPriceId(plan);
  const admin = createSupabaseAdminClient();
  const { data: existing, error: lookupError } = await admin.from("vendor_memberships")
    .select("id,status,external_subscription_id,vendor_membership_levels(code)")
    .eq("vendor_organization_id", organization.organizationId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (lookupError) redirect("/vendor/membership?error=checkout_unavailable");
  const existingCode = existing?.vendor_membership_levels as unknown as { code: string } | null;
  if (existing && ["active", "trialing", "past_due", "complimentary", "manually_granted"].includes(existing.status)) redirect("/vendor/membership?error=already_active");

  let membershipId = existing && ["pending", "expired"].includes(existing.status) && !existing.external_subscription_id && existingCode?.code === plan.code
    ? existing.id
    : null;
  if (!membershipId) {
    const { data, error } = await admin.rpc("reserve_existing_vendor_membership_checkout", {
      target_vendor_organization_id: organization.organizationId,
      target_user_id: user.id,
      target_level_code: plan.code,
      target_price_id: priceId,
      target_interval: plan.interval,
      target_amount_cents: plan.amountCents,
      target_currency: plan.currency,
    });
    if (error || !data) redirect(`/vendor/membership?error=${error?.message.includes("active membership") ? "already_active" : "checkout_unavailable"}`);
    membershipId = data;
  }

  let checkoutUrl: string | null = null;
  let failure: VendorCheckoutError["code"] = "checkout_unavailable";
  try {
    checkoutUrl = await continueVendorMembershipCheckout({
      userId: user.id,
      userEmail: user.email,
      organizationName: organization.organizationName,
      membershipId,
    });
  } catch (error) {
    failure = error instanceof VendorCheckoutError ? error.code : "checkout_unavailable";
  }
  if (!checkoutUrl) redirect(`/vendor/membership?error=${failure}`);
  redirect(checkoutUrl);
}

export async function openVendorBillingPortal() {
  const user = await requireUser();
  const organization = billingOrganization(user);
  if (!organization) redirect("/vendor/membership?error=unauthorized");
  if (isFirebaseOperationalBackend()) {
    const organizationSnapshot = await getPlatformFirestore().doc(`organizations/${organization.organizationId}`).get();
    const membershipId = organizationSnapshot.data()?.activeMembershipId;
    const membership = membershipId ? await getPlatformFirestore().doc(`memberships/${membershipId}`).get() : null;
    const customerId = membership?.data()?.stripe?.customerId;
    if (!customerId) redirect("/vendor/membership?error=no_billing_account");
    const origin = await getAppOrigin();
    const portal = await getStripeClient().billingPortal.sessions.create({ customer: customerId, return_url: `${origin}/vendor/membership` });
    redirect(portal.url);
  }
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("vendor_billing_customers").select("stripe_customer_id")
    .eq("vendor_organization_id", organization.organizationId).maybeSingle();
  if (!data) redirect("/vendor/membership?error=no_billing_account");
  const origin = await getAppOrigin();
  const portal = await getStripeClient().billingPortal.sessions.create({ customer: data.stripe_customer_id, return_url: `${origin}/vendor/membership` });
  redirect(portal.url);
}
