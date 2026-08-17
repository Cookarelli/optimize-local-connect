"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { foundingPartnerDraftSchema, foundingPartnerSubmissionSchema, onboardingDraftFromFormData } from "@/src/domain/founding-partner/onboarding";
import { getVendorPlan, getVendorPlanPriceId, getVendorPlanProductId, normalizeVendorPlanKey } from "@/src/domain/vendor-memberships/catalog";
import { getAppOrigin } from "@/src/lib/auth/origin";
import { attachFounderStripeCheckout, releaseFounderReservation, reserveFounderCategory } from "@/src/lib/founder-categories/firestore";
import { resolveFoundingPartnerOnboardingAccess } from "@/src/lib/founding-partner/onboarding-access";
import { createVendorMembershipCheckout } from "@/src/lib/stripe/memberships";
import { getStripeClient } from "@/src/lib/stripe/client";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

const guestFoundingCheckoutEnvironment = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_FOUNDING_MEMBER_PRODUCT_ID",
  "STRIPE_FOUNDING_MEMBER_PRICE_ID",
  "STRIPE_FOUNDING_PRODUCT_ID",
  "STRIPE_FOUNDING_VENDOR_PRICE_ID",
  "NEXT_PUBLIC_APP_URL",
] as const;

function redactErrorText(value: string) {
  const configuredSecrets = [process.env.STRIPE_SECRET_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.FIREBASE_PRIVATE_KEY].filter(
    (secret): secret is string => Boolean(secret),
  );
  return configuredSecrets.reduce((text, secret) => text.replaceAll(secret, "[REDACTED]"), value)
    .replace(/(?:sk|rk)_(?:test|live)_[A-Za-z0-9_]+/g, "[REDACTED_STRIPE_KEY]");
}

type GuestMembershipCheckoutStage =
  | "validating_form"
  | "loading_configuration"
  | "validating_price_product"
  | "database_lookup"
  | "pending_membership_creation"
  | "constructing_checkout_session_payload"
  | "creating_stripe_customer"
  | "creating_stripe_checkout_session"
  | "attaching_checkout_session";

function unknownErrorDetails(error: unknown) {
  const wrapper = error instanceof Error ? error : null;
  const source = wrapper && "cause" in wrapper && wrapper.cause !== undefined ? wrapper.cause : error;
  const record = source && typeof source === "object" ? source as Record<string, unknown> : null;
  const message = typeof record?.message === "string" ? record.message : typeof source === "string" ? source : null;
  const name = typeof record?.name === "string" ? record.name : source instanceof Error ? source.name : wrapper?.name ?? "NonErrorThrown";
  return {
    errorName: name,
    errorMessage: redactErrorText(message ?? (record ? JSON.stringify(Object.fromEntries(
      ["code", "details", "hint", "status"].flatMap((key) => key in record ? [[key, record[key]]] : []),
    )) : String(source))),
    errorCode: typeof record?.code === "string" ? record.code : null,
    errorDetails: typeof record?.details === "string" ? redactErrorText(record.details) : null,
    errorHint: typeof record?.hint === "string" ? redactErrorText(record.hint) : null,
    errorStack: redactErrorText(wrapper?.stack ?? (source instanceof Error ? source.stack ?? "No stack trace available." : "No stack trace available.")),
  };
}

function logGuestMembershipCheckoutStage(stage: GuestMembershipCheckoutStage) {
  console.info("guest_membership_checkout_stage", { stage });
}

function logGuestMembershipCheckoutFailure(
  error: unknown,
  stage: GuestMembershipCheckoutStage,
  stripeApiCallAttempted: boolean,
  stripeCheckoutSessionCreationAttempted: boolean,
) {
  console.error("guest_membership_checkout_failed", {
    ...unknownErrorDetails(error),
    failedStage: stage,
    environmentPresent: Object.fromEntries(
      guestFoundingCheckoutEnvironment.map((name) => [name, Boolean(process.env[name])]),
    ),
    stripeApiCallAttempted,
    stripeCheckoutSessionCreationAttempted,
    failureTiming: stripeApiCallAttempted ? "after_stripe_api_call" : "before_stripe_api_call",
  });
}

function safeLog(label: string, error: unknown, context: Record<string, string> = {}) {
  const errorType = error instanceof Error ? error.name : "UnknownError";
  console.error(label, { ...context, errorType });
}

const guestFoundingCheckoutSchema = z.object({
  businessName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().min(7).max(40),
  primaryServiceCategory: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export type GuestCheckoutState = { status: "idle" | "error"; message?: string };

export async function startGuestMembershipCheckout(_state: GuestCheckoutState, formData: FormData): Promise<GuestCheckoutState> {
  logGuestMembershipCheckoutStage("validating_form");
  const parsed = guestFoundingCheckoutSchema.safeParse({
    businessName: formData.get("businessName"), contactName: formData.get("contactName"), email: formData.get("email"),
    phone: formData.get("phone"), primaryServiceCategory: formData.get("primaryServiceCategory"),
  });
  if (!parsed.success) {
    console.info("guest_membership_checkout_validation_failed", {
      stage: "validating_form",
      issueCodes: parsed.error.issues.map((issue) => issue.code),
      issuePaths: parsed.error.issues.map((issue) => issue.path.join(".")),
    });
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the required business details." };
  }
  const planKey = normalizeVendorPlanKey(z.string().safeParse(formData.get("plan")).data ?? "");
  const plan = planKey ? getVendorPlan(planKey) : undefined;
  if (!plan || plan.key !== "founding_partner") return { status: "error", message: "Founding Member checkout is unavailable for that selection." };
  const email = parsed.data.email.toLowerCase();
  let checkoutUrl: string;
  let reservation: Awaited<ReturnType<typeof reserveFounderCategory>> | null = null;
  let createdCheckoutSessionId: string | null = null;
  let checkoutAttached = false;
  let stage: GuestMembershipCheckoutStage = "loading_configuration";
  let stripeApiCallAttempted = false;
  let stripeCheckoutSessionCreationAttempted = false;
  try {
    logGuestMembershipCheckoutStage(stage);
    const origin = await getAppOrigin();
    const stripe = getStripeClient();

    stage = "validating_price_product";
    logGuestMembershipCheckoutStage(stage);
    getVendorPlanProductId(plan);
    getVendorPlanPriceId(plan);

    stage = "database_lookup";
    logGuestMembershipCheckoutStage(stage);
    stage = "pending_membership_creation";
    logGuestMembershipCheckoutStage(stage);
    reservation = await reserveFounderCategory({
      businessName: parsed.data.businessName, contactName: parsed.data.contactName, email,
      phone: parsed.data.phone, categorySlug: parsed.data.primaryServiceCategory,
    });

    stage = "constructing_checkout_session_payload";
    logGuestMembershipCheckoutStage(stage);
    const customerPayload = { email, name: parsed.data.businessName, metadata: { organization_id: reservation.organizationId, membership_id: reservation.membershipId, founder_category_slug: reservation.categorySlug } };

    stage = "creating_stripe_customer";
    logGuestMembershipCheckoutStage(stage);
    stripeApiCallAttempted = true;
    const customer = await stripe.customers.create(customerPayload, { idempotencyKey: `founder-membership-${reservation.membershipId}` });

    stage = "constructing_checkout_session_payload";
    logGuestMembershipCheckoutStage(stage);
    const checkoutPayload = {
      planKey: plan.key, organizationId: reservation.organizationId, membershipId: reservation.membershipId,
      customerId: customer.id, onboardingVersion: 1, checkoutAttemptNumber: reservation.checkoutAttemptNumber,
      founderCategoryId: reservation.categorySlug, founderCategorySlug: reservation.categorySlug, founderReservationId: reservation.reservationId,
      successUrl: `${origin}/memberships?checkout=processing`, cancelUrl: `${origin}/memberships?checkout=cancelled`,
    };

    stage = "creating_stripe_checkout_session";
    logGuestMembershipCheckoutStage(stage);
    stripeCheckoutSessionCreationAttempted = true;
    const session = await createVendorMembershipCheckout(checkoutPayload);
    createdCheckoutSessionId = session.id;

    stage = "attaching_checkout_session";
    logGuestMembershipCheckoutStage(stage);
    await attachFounderStripeCheckout({ categorySlug: reservation.categorySlug, organizationId: reservation.organizationId, membershipId: reservation.membershipId, reservationId: reservation.reservationId, customerId: customer.id, checkoutSessionId: session.id });
    checkoutAttached = true;
    checkoutUrl = session.url;
  } catch (error) {
    try {
      if (createdCheckoutSessionId && !checkoutAttached) await getStripeClient().checkout.sessions.expire(createdCheckoutSessionId);
      if (reservation && !checkoutAttached) {
        await releaseFounderReservation({ categorySlug: reservation.categorySlug, membershipId: reservation.membershipId, reservationId: reservation.reservationId });
      }
    } catch (cleanupError) {
      safeLog("guest_membership_checkout_cleanup_failed", cleanupError, { membershipId: reservation?.membershipId ?? "unavailable" });
    }
    logGuestMembershipCheckoutFailure(error, stage, stripeApiCallAttempted, stripeCheckoutSessionCreationAttempted);
    const message = unknownErrorDetails(error).errorMessage;
    if (/Founder category is unavailable|unknown Founder category/i.test(message)) {
      return { status: "error", message: "That Founder category is no longer available. Choose another category." };
    }
    return { status: "error", message: "Secure checkout is temporarily unavailable. Please try again shortly." };
  }
  redirect(checkoutUrl);
}

export const startGuestFoundingPartnerCheckout = startGuestMembershipCheckout;

export type OnboardingState = { status: "idle" | "error" | "success"; message?: string; fieldErrors?: Record<string, string> };

function fieldErrors(error: z.ZodError) {
  const flattened = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  return Object.fromEntries(Object.entries(flattened).map(([field, messages]) => [field, messages?.[0] ?? "Check this field."]));
}

async function validateImage(file: FormDataEntryValue | null, label: string) {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > 5_000_000 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error(`${label} must be a JPG, PNG, or WebP under 5 MB.`);
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const valid = file.type === "image/jpeg"
    ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : file.type === "image/png"
      ? bytes.slice(0, 8).every((byte, index) => byte === [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a][index])
      : new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (!valid) throw new Error(`${label} file contents do not match its image type.`);
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  return { file, extension };
}

export async function saveFoundingPartnerOnboarding(_state: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const access = await resolveFoundingPartnerOnboardingAccess();
  if (!access) return { status: "error", message: "Your secure profile access has expired. Reopen the profile link from your payment confirmation or sign in with the checkout email." };
  const intent = formData.get("intent") === "submit" ? "submit" : "save";
  const draft = onboardingDraftFromFormData(formData);
  const parsed = (intent === "submit" ? foundingPartnerSubmissionSchema : foundingPartnerDraftSchema).safeParse(draft);
  if (!parsed.success) return { status: "error", message: intent === "submit" ? "Complete the highlighted fields before submitting." : "Check the highlighted fields before saving.", fieldErrors: fieldErrors(parsed.error) };

  const admin = createSupabaseAdminClient();
  const { data: current } = await admin.from("founding_partner_onboardings").select("logo_url,featured_image_url,status").eq("id", access.onboardingId).eq("payment_id", access.paymentId).maybeSingle();
  if (!current || !["paid_onboarding_incomplete", "changes_requested"].includes(current.status)) return { status: "error", message: "This application is no longer editable." };

  let logoUrl = parsed.data.logoUrl || null;
  let featuredImageUrl = parsed.data.featuredImageUrl || null;
  try {
    const logo = await validateImage(formData.get("logoUpload"), "Logo");
    const featured = await validateImage(formData.get("featuredImageUpload"), "Featured image");
    for (const [kind, image] of [["logo", logo], ["featured", featured]] as const) {
      if (!image) continue;
      const path = `onboarding/${access.onboardingId}/${kind}.${image.extension}`;
      const { error: uploadError } = await admin.storage.from("founding-fifty-logos").upload(path, image.file, { contentType: image.file.type, upsert: true });
      if (uploadError) throw new Error(`Unable to upload the ${kind === "logo" ? "logo" : "featured image"}.`);
      const publicUrl = admin.storage.from("founding-fifty-logos").getPublicUrl(path).data.publicUrl;
      if (kind === "logo") logoUrl = publicUrl; else featuredImageUrl = publicUrl;
    }
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Unable to upload the selected image." };
  }

  const payload = {
    business_name: parsed.data.businessName,
    contact_name: parsed.data.contactName,
    phone: parsed.data.phone,
    website: parsed.data.website,
    business_description: parsed.data.businessDescription,
    years_in_business: parsed.data.yearsInBusiness,
    primary_service_category: parsed.data.primaryServiceCategory,
    additional_service_categories: parsed.data.additionalServiceCategories,
    services_offered: parsed.data.servicesOffered,
    service_area_cities: parsed.data.serviceAreaCities,
    service_radius_miles: parsed.data.serviceRadiusMiles,
    customer_type: parsed.data.customerType,
    emergency_service_available: parsed.data.emergencyServiceAvailable,
    operating_hours: parsed.data.operatingHours,
    license_applicable: parsed.data.licenseApplicable,
    license_number: parsed.data.licenseNumber,
    insurance_status: parsed.data.insuranceStatus,
    preferred_contact_method: parsed.data.preferredContactMethod,
    google_business_profile_url: parsed.data.googleBusinessProfileUrl,
    facebook_page_url: parsed.data.facebookPageUrl,
    other_social_links: parsed.data.otherSocialLinks,
    profile_headline: parsed.data.profileHeadline,
    company_bio: parsed.data.companyBio,
    logo_url: logoUrl ?? "",
    featured_image_url: featuredImageUrl ?? "",
    offers_free_estimates: parsed.data.offersFreeEstimates,
    offers_financing: parsed.data.offersFinancing,
    languages_spoken: parsed.data.languagesSpoken,
    accuracy_confirmed: parsed.data.accuracyConfirmed,
    public_display_consent: parsed.data.publicDisplayConsent,
    terms_privacy_accepted: parsed.data.termsPrivacyAccepted,
  };
  const { error: perkError } = await admin.rpc("save_founding_partner_perk", {
    target_onboarding_id: access.onboardingId,
    target_payload: {
      enabled: parsed.data.propertyManagerPerk.enabled,
      title: parsed.data.propertyManagerPerk.title,
      description: parsed.data.propertyManagerPerk.description,
      type: parsed.data.propertyManagerPerk.type,
      terms: parsed.data.propertyManagerPerk.terms,
      expiration_date: parsed.data.propertyManagerPerk.expirationDate || null,
    },
  });
  if (perkError) {
    safeLog("founding_partner_perk_save_failed", perkError, { onboardingId: access.onboardingId });
    return { status: "error", message: "We could not save the Connect Member Benefit. Review it and try again." };
  }
  const { error } = await admin.rpc("save_founding_partner_onboarding", {
    target_onboarding_id: access.onboardingId,
    target_payload: payload,
    target_submit: intent === "submit",
  });
  if (error) {
    safeLog("founding_partner_onboarding_save_failed", error, { onboardingId: access.onboardingId });
    return { status: "error", message: "We could not save your application. Please review the form and try again." };
  }
  revalidatePath("/founders/onboarding");
  revalidatePath("/admin/founding-fifty");
  if (intent === "submit") redirect("/founders/onboarding/confirmation");
  return { status: "success", message: "Draft saved. You can return using this browser or sign in with the email used at checkout." };
}
