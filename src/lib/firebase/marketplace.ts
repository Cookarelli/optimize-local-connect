import "server-only";

import type { PublicFoundingPartnerCard, PublicFoundingPartnerProfile } from "@/src/domain/vendor-memberships/marketplace";
import { getPlatformFirestore } from "@/src/lib/firebase/admin";
import { normalizeServiceArea, normalizedText, slugify } from "@/src/lib/firebase/platform";

const MAX_CANDIDATES = 500;

type PublicVendorData = Record<string, unknown> & {
  businessName: string;
  slug: string;
  description: string;
  logoUrl: string | null;
  featuredImageUrl: string | null;
  primaryCategorySlug: string;
  primaryCategoryName: string;
  categorySlugs: string[];
  categoryNames: string[];
  services: string[];
  serviceAreaKeys: string[];
  serviceAreas: string[];
  publicPhone: string | null;
  publicEmail: string;
  websiteUrl: string | null;
  googleBusinessProfileUrl: string | null;
  operatingHours: string | null;
  languages: string[];
  yearsInBusiness: number | null;
  customerTypes: string[];
  offersFreeEstimates: boolean;
  offersFinancing: boolean;
  emergencyService: boolean;
  licenseListed: boolean;
  insuranceStatus: string | null;
  connectMemberBenefit: { enabled: boolean; title: string | null; description: string | null; type: string | null; terms: string | null; expiresAt: { toDate?(): Date } | null };
  membershipTier: "founding_partner" | "preferred" | "network";
  membershipName: string;
  membershipPriority: number;
  badgeLabel: string | null;
  isFoundingMember: boolean;
  searchTokens: string[];
};

function asCard(vendor: PublicVendorData, total: number): PublicFoundingPartnerCard {
  return {
    slug: vendor.slug,
    name: vendor.businessName,
    logo_url: vendor.logoUrl,
    description: vendor.description,
    primary_category: vendor.primaryCategoryName,
    additional_categories: vendor.categoryNames.filter((item) => item !== vendor.primaryCategoryName),
    service_areas: vendor.serviceAreas,
    phone: vendor.publicPhone,
    public_email: vendor.publicEmail,
    website_url: vendor.websiteUrl,
    google_business_profile_url: vendor.googleBusinessProfileUrl,
    operating_hours: vendor.operatingHours,
    languages_spoken: vendor.languages,
    offers_free_estimates: vendor.offersFreeEstimates,
    emergency_available: vendor.emergencyService,
    license_listed: vendor.licenseListed,
    insurance_status: vendor.insuranceStatus,
    membership_code: vendor.membershipTier,
    membership_name: vendor.membershipName,
    badge_label: vendor.badgeLabel,
    is_founding_partner: vendor.isFoundingMember,
    property_manager_perk_enabled: vendor.connectMemberBenefit.enabled,
    property_manager_perk_title: vendor.connectMemberBenefit.title,
    property_manager_perk_description: vendor.connectMemberBenefit.description,
    property_manager_perk_type: vendor.connectMemberBenefit.type,
    property_manager_perk_terms: vendor.connectMemberBenefit.terms,
    property_manager_perk_expiration_date: vendor.connectMemberBenefit.expiresAt?.toDate?.().toISOString().slice(0, 10) ?? null,
    total_count: total,
  };
}

export async function searchFirebaseMarketplace(input: { q?: string; category?: string; location?: string; perk?: string; tier?: string; page?: number; pageSize?: number; offset?: number }) {
  const db = getPlatformFirestore();
  const snapshot = await db.collection("publicMarketplaceVendors").limit(MAX_CANDIDATES).get();
  const queryTokens = normalizedText(input.q ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((word) => word.length >= 2).map((word) => word.slice(0, 20));
  const category = input.category ? slugify(input.category) : "";
  const location = input.location ? normalizeServiceArea(input.location) : "";
  const candidates = snapshot.docs.map((document) => document.data() as PublicVendorData).filter((vendor) => {
    if (queryTokens.length && !queryTokens.every((token) => vendor.searchTokens.includes(token))) return false;
    if (category && !vendor.categorySlugs.includes(category)) return false;
    if (location && !vendor.serviceAreaKeys.includes(location)) return false;
    if (input.tier && vendor.membershipTier !== input.tier) return false;
    if (input.perk === "any" && !vendor.connectMemberBenefit.enabled) return false;
    if (input.perk && input.perk !== "any" && (!vendor.connectMemberBenefit.enabled || vendor.connectMemberBenefit.type !== input.perk)) return false;
    return true;
  }).sort((left, right) => right.membershipPriority - left.membershipPriority || left.businessName.localeCompare(right.businessName));
  const pageSize = Math.max(1, Math.min(input.pageSize ?? 24, 100));
  const page = Math.max(1, input.page ?? 1);
  const start = Math.max(0, input.offset ?? (page - 1) * pageSize);
  return {
    vendors: candidates.slice(start, start + pageSize).map((vendor) => asCard(vendor, candidates.length)),
    total: candidates.length,
    bounded: snapshot.size === MAX_CANDIDATES,
    filters: {
      categories: [...new Set(snapshot.docs.flatMap((document) => (document.data().categoryNames as string[] | undefined) ?? []))].sort().map((name) => ({ name, slug: slugify(name), count: snapshot.docs.filter((document) => ((document.data().categoryNames as string[] | undefined) ?? []).includes(name)).length })),
      locations: [...new Set(snapshot.docs.flatMap((document) => (document.data().serviceAreas as string[] | undefined) ?? []))].sort().map((name) => ({ name, count: snapshot.docs.filter((document) => ((document.data().serviceAreas as string[] | undefined) ?? []).includes(name)).length })),
    },
  };
}

export async function getFirebaseMarketplaceVendor(slug: string): Promise<PublicFoundingPartnerProfile | null> {
  const result = await getPlatformFirestore().collection("publicMarketplaceVendors").where("slug", "==", slugify(slug)).limit(1).get();
  if (result.empty) return null;
  const vendor = result.docs[0]!.data() as PublicVendorData & { serviceRadiusMiles: number | null };
  return {
    slug: vendor.slug,
    name: vendor.businessName,
    logoUrl: vendor.logoUrl,
    foundingPartner: vendor.isFoundingMember,
    tierCode: vendor.membershipTier,
    membershipName: vendor.membershipName,
    badgeLabel: vendor.badgeLabel,
    primaryCategory: vendor.primaryCategoryName,
    additionalCategories: vendor.categoryNames.filter((name) => name !== vendor.primaryCategoryName),
    description: vendor.description,
    servicesOffered: vendor.services,
    serviceAreas: vendor.serviceAreas,
    serviceRadiusMiles: vendor.serviceRadiusMiles,
    customerType: vendor.customerTypes.join(", ") || null,
    phone: vendor.publicPhone,
    email: vendor.publicEmail,
    website: vendor.websiteUrl,
    googleBusinessProfileUrl: vendor.googleBusinessProfileUrl,
    operatingHours: vendor.operatingHours,
    languagesSpoken: vendor.languages,
    offersFreeEstimates: vendor.offersFreeEstimates,
    offersFinancing: vendor.offersFinancing,
    emergencyAvailable: vendor.emergencyService,
    licenseApplicable: vendor.licenseListed,
    licenseNumber: null,
    insuranceStatus: vendor.insuranceStatus,
    yearsInBusiness: vendor.yearsInBusiness,
    featuredImageUrl: vendor.featuredImageUrl,
    publicDisplayConsent: true,
    propertyManagerPerk: vendor.connectMemberBenefit.enabled && vendor.connectMemberBenefit.title && vendor.connectMemberBenefit.description && vendor.connectMemberBenefit.type ? {
      enabled: true,
      title: vendor.connectMemberBenefit.title,
      description: vendor.connectMemberBenefit.description,
      type: vendor.connectMemberBenefit.type,
      terms: vendor.connectMemberBenefit.terms,
      expirationDate: vendor.connectMemberBenefit.expiresAt?.toDate?.().toISOString().slice(0, 10) ?? null,
    } : null,
  };
}
