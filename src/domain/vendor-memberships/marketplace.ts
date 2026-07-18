import { z } from "zod";

const categorySchema = z.object({ id: z.string().uuid(), name: z.string() });
const citySchema = z.object({ id: z.string().uuid(), name: z.string(), stateCode: z.string() });

export const marketplaceVendorSchema = z.object({
  vendor_organization_id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  website_url: z.string().nullable(),
  phone: z.string().nullable(),
  years_in_business: z.number().nullable(),
  average_rating: z.coerce.number().nullable(),
  completed_job_count: z.number(),
  response_time_minutes: z.number().nullable(),
  verification_status: z.string(),
  membership_code: z.string(),
  membership_name: z.string(),
  is_featured: z.boolean(),
  is_verified: z.boolean(),
  is_licensed: z.boolean(),
  is_insured: z.boolean(),
  emergency_available: z.boolean(),
  categories: z.array(categorySchema),
  cities: z.array(citySchema),
  badges: z.array(z.string()),
  total_count: z.coerce.number(),
});

export type MarketplaceVendor = z.infer<typeof marketplaceVendorSchema>;

export function parseMarketplaceVendors(value: unknown): MarketplaceVendor[] {
  return z.array(marketplaceVendorSchema).parse(value ?? []);
}

export type MarketplaceSearch = {
  q?: string;
  city?: string;
  category?: string;
  verified?: boolean;
  premium?: boolean;
  emergency?: boolean;
  licensed?: boolean;
  insured?: boolean;
};

export const publicFoundingPartnerCardSchema = z.object({
  slug: z.string(),
  name: z.string(),
  logo_url: z.string().nullable(),
  description: z.string().nullable(),
  primary_category: z.string(),
  additional_categories: z.array(z.string()),
  service_areas: z.array(z.string()),
  phone: z.string().nullable(),
  public_email: z.string().email(),
  website_url: z.string().nullable(),
  google_business_profile_url: z.string().nullable(),
  operating_hours: z.string().nullable(),
  languages_spoken: z.array(z.string()),
  offers_free_estimates: z.boolean(),
  emergency_available: z.boolean(),
  license_listed: z.boolean(),
  insurance_status: z.string().nullable(),
  total_count: z.coerce.number(),
});

export const publicFoundingPartnerProfileSchema = z.object({
  slug: z.string(), name: z.string(),
  logoUrl: z.string().nullable(), foundingPartner: z.literal(true), primaryCategory: z.string(),
  additionalCategories: z.array(z.string()), description: z.string().nullable(), servicesOffered: z.array(z.string()),
  serviceAreas: z.array(z.string()), serviceRadiusMiles: z.number().nullable(), customerType: z.string().nullable(),
  phone: z.string().nullable(), email: z.string().email(), website: z.string().nullable(),
  googleBusinessProfileUrl: z.string().nullable(),
  operatingHours: z.string().nullable(), languagesSpoken: z.array(z.string()), offersFreeEstimates: z.boolean(),
  offersFinancing: z.boolean(), emergencyAvailable: z.boolean(), licenseApplicable: z.boolean(), licenseNumber: z.string().nullable(),
  insuranceStatus: z.string().nullable(), yearsInBusiness: z.number().nullable(), featuredImageUrl: z.string().nullable(),
  publicDisplayConsent: z.literal(true),
});

export const publicMarketplaceFiltersSchema = z.object({
  categories: z.array(z.object({ name: z.string(), slug: z.string(), count: z.coerce.number() })),
  locations: z.array(z.object({ name: z.string(), count: z.coerce.number() })),
});

export type PublicFoundingPartnerCard = z.infer<typeof publicFoundingPartnerCardSchema>;
export type PublicFoundingPartnerProfile = z.infer<typeof publicFoundingPartnerProfileSchema>;

export function parsePublicFoundingPartnerCards(value: unknown) { return z.array(publicFoundingPartnerCardSchema).parse(value ?? []); }
export function parsePublicFoundingPartnerProfile(value: unknown) { return publicFoundingPartnerProfileSchema.parse(value); }
export function parsePublicMarketplaceFilters(value: unknown) { return publicMarketplaceFiltersSchema.parse(value ?? { categories: [], locations: [] }); }
