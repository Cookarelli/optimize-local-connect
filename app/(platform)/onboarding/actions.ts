"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getVendorPlan, getVendorPlanPriceId, normalizeVendorPlanKey } from "@/src/domain/vendor-memberships/catalog";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { continueVendorMembershipCheckout, VendorCheckoutError } from "@/src/lib/stripe/vendor-membership-checkout";

const enrollmentSchema = z.object({
  businessName: z.string().trim().min(2, "Enter your public business name.").max(160),
  legalName: z.string().trim().max(160).optional().default(""),
  contactName: z.string().trim().min(2, "Enter the primary contact name.").max(120),
  phone: z.string().trim().min(7, "Enter a valid business phone number.").max(30),
  website: z.union([z.literal(""), z.string().trim().url("Enter a complete website URL, including https://.")]),
  plan: z.string().transform((value, context) => {
    const key = normalizeVendorPlanKey(value);
    if (!key) { context.addIssue({ code: "custom", message: "Choose a valid membership." }); return z.NEVER; }
    return key;
  }),
});

const enrollmentResultSchema = z.array(z.object({
  enrollment_id: z.string().uuid(),
  vendor_organization_id: z.string().uuid(),
  membership_id: z.string().uuid(),
  checkout_attempt_number: z.number().int().positive(),
  enrollment_status: z.string(),
})).length(1);

export type VendorEnrollmentState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export async function createVendorOrganizationAndCheckout(_state: VendorEnrollmentState, formData: FormData): Promise<VendorEnrollmentState> {
  const user = await requireUser();
  const parsed = enrollmentSchema.safeParse({
    businessName: formData.get("businessName"),
    legalName: formData.get("legalName"),
    contactName: formData.get("contactName"),
    phone: formData.get("phone"),
    website: formData.get("website"),
    plan: formData.get("plan"),
  });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { status: "error", message: "Review the highlighted information.", fieldErrors: Object.fromEntries(Object.entries(errors).map(([key, value]) => [key, value?.[0] ?? "Check this field."])) };
  }

  const plan = getVendorPlan(parsed.data.plan)!;
  let priceId: string;
  try { priceId = getVendorPlanPriceId(plan); }
  catch { return { status: "error", message: "This membership is not configured for Checkout yet." }; }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("create_or_resume_vendor_enrollment", {
    target_user_id: user.id,
    target_business_name: parsed.data.businessName,
    target_legal_name: parsed.data.legalName,
    target_contact_name: parsed.data.contactName,
    target_contact_email: user.email.toLowerCase(),
    target_contact_phone: parsed.data.phone,
    target_website_url: parsed.data.website,
    target_plan_key: plan.key,
    target_level_code: plan.code,
    target_price_id: priceId,
    target_interval: plan.interval,
    target_amount_cents: plan.amountCents,
    target_currency: plan.currency,
    target_onboarding_version: 1,
  });
  if (error) {
    const message = error.message.includes("active membership")
      ? "This business already has a current membership. Open its billing page instead of starting another subscription."
      : error.message.includes("different membership tier")
        ? "This business already has a pending enrollment for another membership tier. Resume that enrollment or contact support."
        : "We could not create the vendor workspace. No Stripe Checkout Session was created.";
    return { status: "error", message };
  }
  const enrollment = enrollmentResultSchema.safeParse(data);
  if (!enrollment.success) return { status: "error", message: "The vendor workspace was saved, but Checkout could not be prepared." };

  let checkoutUrl: string | null = null;
  try {
    checkoutUrl = await continueVendorMembershipCheckout({
      userId: user.id,
      userEmail: user.email,
      organizationName: parsed.data.businessName,
      membershipId: enrollment.data[0].membership_id,
    });
  } catch (checkoutError) {
    const message = checkoutError instanceof VendorCheckoutError && checkoutError.code === "already_active"
      ? "This organization already has a current subscription."
      : "Your vendor workspace and pending membership were saved, but Stripe Checkout could not be opened. Submit this form again to resume without creating a duplicate organization.";
    return { status: "error", message };
  }
  redirect(checkoutUrl);
}
