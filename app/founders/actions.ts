"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { foundingPartnerDraftSchema, foundingPartnerSubmissionSchema, onboardingDraftFromFormData } from "@/src/domain/founding-partner/onboarding";
import { FOUNDING_PARTNER_PLAN } from "@/src/domain/vendor-memberships/catalog";
import { getCurrentUser } from "@/src/lib/auth/session";
import { resolveFoundingPartnerOnboardingAccess } from "@/src/lib/founding-partner/onboarding-access";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

function safeLog(label: string, error: unknown, context: Record<string, string> = {}) {
  const errorType = error instanceof Error ? error.name : "UnknownError";
  console.error(label, { ...context, errorType });
}

export async function startFoundingPartnerCheckout() {
  const next = `/onboarding?plan=${FOUNDING_PARTNER_PLAN.key}`;
  if (await getCurrentUser()) redirect(next);
  redirect(`/sign-in?next=${encodeURIComponent(next)}`);
}

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
    return { status: "error", message: "We could not save the Property Manager Perk. Review it and try again." };
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
