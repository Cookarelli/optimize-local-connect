import { z } from "zod";
import { FOUNDING_VERTICAL_CATALOG } from "@/src/domain/founding-fifty/catalog";
import { propertyManagerPerkSchema, type PropertyManagerPerkType } from "@/src/domain/vendor-memberships/property-manager-perk";

const urlOrEmpty = z.union([z.literal(""), z.string().trim().url("Enter a complete URL, including https://.")]);
const integerOrEmpty = (maximum: number) => z.union([z.literal(""), z.coerce.number().int().min(0).max(maximum)]);
const categoryOrEmpty = z.union([z.literal(""), z.enum(FOUNDING_VERTICAL_CATALOG)]);
const customerTypeOrEmpty = z.enum(["", "residential", "commercial", "both"]);
const insuranceOrEmpty = z.enum(["", "insured", "pending", "not_insured", "not_applicable"]);
const contactMethodOrEmpty = z.enum(["", "email", "phone", "text"]);

export const foundingPartnerDraftSchema = z.object({
  businessName: z.string().trim().max(160),
  contactName: z.string().trim().max(160),
  phone: z.string().trim().max(40),
  website: urlOrEmpty,
  businessDescription: z.string().trim().max(1200),
  yearsInBusiness: integerOrEmpty(250),
  primaryServiceCategory: categoryOrEmpty,
  additionalServiceCategories: z.array(z.enum(FOUNDING_VERTICAL_CATALOG)).max(15),
  servicesOffered: z.array(z.string().trim().min(1).max(120)).max(50),
  serviceAreaCities: z.array(z.string().trim().min(1).max(160)).max(50),
  serviceRadiusMiles: integerOrEmpty(500),
  customerType: customerTypeOrEmpty,
  emergencyServiceAvailable: z.boolean(),
  operatingHours: z.string().trim().max(600),
  licenseApplicable: z.boolean(),
  licenseNumber: z.string().trim().max(120),
  insuranceStatus: insuranceOrEmpty,
  preferredContactMethod: contactMethodOrEmpty,
  googleBusinessProfileUrl: urlOrEmpty,
  facebookPageUrl: urlOrEmpty,
  otherSocialLinks: z.array(z.string().trim().url("Every social link must be a complete URL.")).max(20),
  profileHeadline: z.string().trim().max(120),
  companyBio: z.string().trim().max(4000),
  logoUrl: urlOrEmpty,
  featuredImageUrl: urlOrEmpty,
  offersFreeEstimates: z.boolean(),
  offersFinancing: z.boolean(),
  languagesSpoken: z.array(z.string().trim().min(1).max(80)).max(30),
  propertyManagerPerk: propertyManagerPerkSchema.default({ enabled: false, title: "", description: "", type: "custom", terms: "", expirationDate: "" }),
  accuracyConfirmed: z.boolean(),
  publicDisplayConsent: z.boolean(),
  termsPrivacyAccepted: z.boolean(),
});

export const foundingPartnerSubmissionSchema = foundingPartnerDraftSchema.superRefine((value, context) => {
  const required = (field: keyof typeof value, valid: boolean, message: string) => {
    if (!valid) context.addIssue({ code: "custom", path: [field], message });
  };
  required("businessName", value.businessName.length >= 2, "Enter your business name.");
  required("contactName", value.contactName.length >= 2, "Enter a contact name.");
  required("phone", value.phone.length >= 7, "Enter a valid phone number.");
  required("businessDescription", value.businessDescription.length >= 20, "Add at least 20 characters about your business.");
  required("yearsInBusiness", value.yearsInBusiness !== "", "Enter years in business.");
  required("primaryServiceCategory", value.primaryServiceCategory !== "", "Choose a primary service category.");
  required("servicesOffered", value.servicesOffered.length > 0, "List at least one service.");
  required("serviceAreaCities", value.serviceAreaCities.length > 0, "List at least one service-area city.");
  required("serviceRadiusMiles", value.serviceRadiusMiles !== "", "Enter your service radius.");
  required("customerType", value.customerType !== "", "Choose residential, commercial, or both.");
  required("operatingHours", value.operatingHours.length >= 3, "Enter your typical operating hours.");
  required("insuranceStatus", value.insuranceStatus !== "", "Choose an insurance status.");
  required("preferredContactMethod", value.preferredContactMethod !== "", "Choose a preferred contact method.");
  required("profileHeadline", value.profileHeadline.length >= 5, "Add a short marketplace headline.");
  required("companyBio", value.companyBio.length >= 40, "Add at least 40 characters for the company bio.");
  required("languagesSpoken", value.languagesSpoken.length > 0, "List at least one language.");
  if (value.licenseApplicable && value.licenseNumber.length < 2) context.addIssue({ code: "custom", path: ["licenseNumber"], message: "Enter the license number, or mark licensing as not applicable." });
  if (!value.accuracyConfirmed) context.addIssue({ code: "custom", path: ["accuracyConfirmed"], message: "Confirm that the information is accurate." });
  if (!value.publicDisplayConsent) context.addIssue({ code: "custom", path: ["publicDisplayConsent"], message: "Permission is required to publish an approved profile." });
  if (!value.termsPrivacyAccepted) context.addIssue({ code: "custom", path: ["termsPrivacyAccepted"], message: "Accept the terms and privacy policy to submit." });
});

export type FoundingPartnerDraft = z.output<typeof foundingPartnerDraftSchema>;
type FoundingPartnerFormInput = z.input<typeof foundingPartnerDraftSchema>;

export function splitList(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return [];
  return [...new Set(value.split(/[\n,]/).map(item => item.trim()).filter(Boolean))];
}

export function onboardingDraftFromFormData(formData: FormData): FoundingPartnerFormInput {
  return {
    businessName: formData.get("businessName")?.toString() ?? "",
    contactName: formData.get("contactName")?.toString() ?? "",
    phone: formData.get("phone")?.toString() ?? "",
    website: formData.get("website")?.toString() ?? "",
    businessDescription: formData.get("businessDescription")?.toString() ?? "",
    yearsInBusiness: formData.get("yearsInBusiness")?.toString() ?? "",
    primaryServiceCategory: (formData.get("primaryServiceCategory")?.toString() ?? "") as FoundingPartnerFormInput["primaryServiceCategory"],
    additionalServiceCategories: formData.getAll("additionalServiceCategories").map(String) as FoundingPartnerFormInput["additionalServiceCategories"],
    servicesOffered: splitList(formData.get("servicesOffered")),
    serviceAreaCities: splitList(formData.get("serviceAreaCities")),
    serviceRadiusMiles: formData.get("serviceRadiusMiles")?.toString() ?? "",
    customerType: (formData.get("customerType")?.toString() ?? "") as FoundingPartnerFormInput["customerType"],
    emergencyServiceAvailable: formData.get("emergencyServiceAvailable") === "on",
    operatingHours: formData.get("operatingHours")?.toString() ?? "",
    licenseApplicable: formData.get("licenseApplicable") === "on",
    licenseNumber: formData.get("licenseNumber")?.toString() ?? "",
    insuranceStatus: (formData.get("insuranceStatus")?.toString() ?? "") as FoundingPartnerFormInput["insuranceStatus"],
    preferredContactMethod: (formData.get("preferredContactMethod")?.toString() ?? "") as FoundingPartnerFormInput["preferredContactMethod"],
    googleBusinessProfileUrl: formData.get("googleBusinessProfileUrl")?.toString() ?? "",
    facebookPageUrl: formData.get("facebookPageUrl")?.toString() ?? "",
    otherSocialLinks: splitList(formData.get("otherSocialLinks")),
    profileHeadline: formData.get("profileHeadline")?.toString() ?? "",
    companyBio: formData.get("companyBio")?.toString() ?? "",
    logoUrl: formData.get("logoUrl")?.toString() ?? "",
    featuredImageUrl: formData.get("featuredImageUrl")?.toString() ?? "",
    offersFreeEstimates: formData.get("offersFreeEstimates") === "on",
    offersFinancing: formData.get("offersFinancing") === "on",
    languagesSpoken: splitList(formData.get("languagesSpoken")),
    propertyManagerPerk: {
      enabled: formData.get("propertyManagerPerkEnabled") === "on",
      title: formData.get("propertyManagerPerkTitle")?.toString() ?? "",
      description: formData.get("propertyManagerPerkDescription")?.toString() ?? "",
      type: (formData.get("propertyManagerPerkType")?.toString() ?? "custom") as PropertyManagerPerkType,
      terms: formData.get("propertyManagerPerkTerms")?.toString() ?? "",
      expirationDate: formData.get("propertyManagerPerkExpirationDate")?.toString() ?? "",
    },
    accuracyConfirmed: formData.get("accuracyConfirmed") === "on",
    publicDisplayConsent: formData.get("publicDisplayConsent") === "on",
    termsPrivacyAccepted: formData.get("termsPrivacyAccepted") === "on",
  };
}
