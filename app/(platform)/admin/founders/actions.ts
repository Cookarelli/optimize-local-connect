"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/session";
import { retrieveAndVerifyExternalFoundingPartnerCheckout } from "@/src/lib/founding-fifty/stripe";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { getStripeClient } from "@/src/lib/stripe/client";

const actionSchema = z.object({
  onboardingId: z.string().uuid(),
  action: z.enum(["save_notes", "start_review", "approve", "request_changes", "reject", "activate", "suspend"]),
  notes: z.string().trim().max(4000).optional(),
  returnTo: z.string().regex(/^\/admin\/founders(?:\/[0-9a-f-]{36})?$/i),
});

export async function manageFounder(formData: FormData) {
  const user = await requireUser();
  if (!user.isSuperAdmin) throw new Error("Super Admin access required.");
  const input = actionSchema.parse({
    onboardingId: formData.get("onboardingId"),
    action: formData.get("action"),
    notes: formData.get("notes")?.toString() || undefined,
    returnTo: formData.get("returnTo"),
  });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_manage_founding_partner", {
    target_onboarding_id: input.onboardingId,
    target_action: input.action,
    target_notes: input.notes ?? null,
  });
  revalidatePath("/admin/founders");
  revalidatePath(`/admin/founders/${input.onboardingId}`);
  revalidatePath("/marketplace");
  if (error) redirect(`${input.returnTo}?result=error`);
  redirect(`${input.returnTo}?result=updated`);
}

export async function reconcileFounderCheckout(formData: FormData) {
  const user = await requireUser();
  if (!user.isSuperAdmin) throw new Error("Super Admin access required.");
  const sessionId = z.string().regex(/^cs_(test_|live_)?[A-Za-z0-9]+$/).parse(formData.get("checkoutSessionId"));
  const verified = await retrieveAndVerifyExternalFoundingPartnerCheckout(sessionId);
  if (!verified) throw new Error("Stripe did not verify an exact paid $299 USD Founder Checkout Session for the configured Founder product.");
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("reconcile_verified_founding_partner_checkout", {
    target_attempt_id: crypto.randomUUID(),
    target_actor_user_id: user.id,
    target_checkout_session_id: verified.sessionId,
    target_customer_id: verified.customerId,
    target_payment_intent_id: verified.paymentIntentId,
    target_customer_email: verified.customerEmail,
    target_customer_name: verified.customerName,
    target_paid_at: verified.paidAt,
    target_provider_metadata: { verified_via: "stripe_api" },
  });
  if (error) throw new Error("The verified Founder payment could not be reconciled.");
  revalidatePath("/admin/founders");
  redirect("/admin/founders?result=reconciled");
}

export async function resetPendingVendorEnrollment(formData: FormData) {
  const user = await requireUser();
  if (!user.isSuperAdmin) throw new Error("Super Admin access required.");
  const enrollmentId = z.string().uuid().parse(formData.get("enrollmentId"));
  const admin = createSupabaseAdminClient();
  const { data: enrollment, error: enrollmentError } = await admin.from("vendor_enrollments")
    .select("id,owner_user_id,membership_id,status")
    .eq("id", enrollmentId)
    .maybeSingle();
  if (enrollmentError || !enrollment || !["payment_pending", "checkout_created"].includes(enrollment.status)) {
    redirect("/admin/founders?result=enrollment_error");
  }
  const { data: membership, error: membershipError } = await admin.from("vendor_memberships")
    .select("id,status,stripe_checkout_session_id,external_subscription_id")
    .eq("id", enrollment.membership_id)
    .maybeSingle();
  if (membershipError || !membership || membership.external_subscription_id || membership.status !== "pending") {
    redirect("/admin/founders?result=enrollment_error");
  }

  if (membership.stripe_checkout_session_id) {
    const stripeClient = getStripeClient();
    const session = await stripeClient.checkout.sessions.retrieve(membership.stripe_checkout_session_id);
    // Never reset a completed Checkout. Its signed webhook must remain the only
    // path that activates the membership, even if webhook delivery is delayed.
    if (session.status === "complete") redirect("/admin/founders?result=enrollment_error");
    if (session.status === "open") await stripeClient.checkout.sessions.expire(session.id);
    const { error: expireError } = await admin.rpc("fail_vendor_membership_checkout", { target_membership_id: membership.id });
    if (expireError) redirect("/admin/founders?result=enrollment_error");
    const { error: prepareError } = await admin.rpc("authorize_and_prepare_vendor_membership_checkout", {
      target_membership_id: membership.id,
      target_user_id: enrollment.owner_user_id,
    });
    if (prepareError) redirect("/admin/founders?result=enrollment_error");
  }
  const { error: recordError } = await admin.rpc("record_vendor_membership_checkout_failure", {
    target_membership_id: membership.id,
    target_error_code: "admin_reset_for_owner_retry",
  });
  if (recordError) redirect("/admin/founders?result=enrollment_error");
  revalidatePath("/admin/founders");
  redirect("/admin/founders?result=enrollment_reset");
}

export async function manageVendorLifecycle(formData:FormData){
  const user=await requireUser();if(!user.isSuperAdmin)throw new Error("Super Admin access required.");
  const input=z.object({organizationId:z.string().uuid(),action:z.enum(["approve","request_changes","reject","suspend","restore","recheck"]),notes:z.string().trim().max(4000).optional()}).parse({organizationId:formData.get("organizationId"),action:formData.get("action"),notes:formData.get("notes")?.toString()||undefined});
  const admin=createSupabaseAdminClient();const {error}=await admin.rpc("admin_manage_vendor_lifecycle",{target_vendor_organization_id:input.organizationId,target_action:input.action,target_notes:input.notes??null});
  revalidatePath("/admin/founders");revalidatePath("/marketplace");redirect(`/admin/founders?result=${error?"lifecycle_error":"lifecycle_updated"}`);
}
