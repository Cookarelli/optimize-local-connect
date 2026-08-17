import "server-only";

import type { AppUser } from "@/src/domain/auth/types";
import type { VendorPlanKey } from "@/src/domain/vendor-memberships/catalog";
import { getVendorPlanPriceId } from "@/src/domain/vendor-memberships/catalog";
import { getAppOrigin } from "@/src/lib/auth/origin";
import { attachFirebaseMembershipCheckout, reserveFirebaseCommercialMembership } from "@/src/lib/firebase/memberships";
import { getStripeClient } from "@/src/lib/stripe/client";
import { createVendorMembershipCheckout } from "@/src/lib/stripe/memberships";

function assertCheckoutSafety() {
  if (process.env.FIREBASE_PLATFORM_CHECKOUT_ENABLED !== "true") throw new Error("Firebase membership Checkout is disabled during migration.");
  const liveKey = process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_");
  if (liveKey && process.env.FIREBASE_PLATFORM_LIVE_CHECKOUT_ENABLED !== "true") throw new Error("Live Firebase membership Checkout requires the explicit cutover flag.");
}
export async function startFirebaseCommercialMembershipCheckout(input: { user: AppUser; organizationId: string; organizationName: string; tier: Exclude<VendorPlanKey, "founding_partner"> }) {
  assertCheckoutSafety();
  const reserved = await reserveFirebaseCommercialMembership({ user: input.user, organizationId: input.organizationId, tier: input.tier });
  const stripe = getStripeClient();
  const customerId = reserved.stripeCustomerId ?? (await stripe.customers.create({
    email: input.user.email,
    name: input.organizationName,
    metadata: { organization_id: input.organizationId, operational_backend: "firebase" },
  }, { idempotencyKey: `firebase-membership-customer-${input.organizationId}` })).id;
  const origin = await getAppOrigin();
  const session = await createVendorMembershipCheckout({
    planKey: reserved.plan.key,
    organizationId: input.organizationId,
    membershipId: reserved.membershipId,
    userId: input.user.id,
    customerId,
    onboardingVersion: 1,
    checkoutAttemptNumber: reserved.checkoutAttemptNumber,
    operationalBackend: "firebase",
    successUrl: `${origin}/vendor/membership/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/vendor/membership?checkout=cancelled`,
  });
  await attachFirebaseMembershipCheckout({ membershipId: reserved.membershipId, organizationId: input.organizationId, customerId, checkoutSessionId: session.id, priceId: getVendorPlanPriceId(reserved.plan) });
  return session.url;
}
