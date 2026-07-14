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
