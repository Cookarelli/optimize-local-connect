export const FOUNDER_LIST_PRICE_CENTS = 49_900;
export const FOUNDER_CURRENCY = "USD";
export const FOUNDER_RESERVATION_TTL_MS = 24 * 60 * 60 * 1_000;

export const FOUNDER_CATEGORY_CATALOG = [
  { displayOrder: 1, displayName: "Roofing", slug: "roofing" },
  { displayOrder: 2, displayName: "Flooring", slug: "flooring" },
  { displayOrder: 3, displayName: "Plumbing / Sewer", slug: "plumbing-sewer" },
  { displayOrder: 4, displayName: "Electrical", slug: "electrical" },
  { displayOrder: 5, displayName: "HVAC", slug: "hvac" },
  { displayOrder: 6, displayName: "Landscaping / Snow", slug: "landscaping-snow" },
  { displayOrder: 7, displayName: "General Contractor / Remodeling", slug: "general-contractor-remodeling" },
  { displayOrder: 8, displayName: "Drywall / Plaster", slug: "drywall-plaster" },
  { displayOrder: 9, displayName: "Painting", slug: "painting" },
  { displayOrder: 10, displayName: "Cleaning / Janitorial", slug: "cleaning-janitorial" },
  { displayOrder: 11, displayName: "Pest Control", slug: "pest-control" },
  { displayOrder: 12, displayName: "Tree Service", slug: "tree-service" },
  { displayOrder: 13, displayName: "Water / Fire / Mold Restoration", slug: "water-fire-mold-restoration" },
  { displayOrder: 14, displayName: "Garage Doors", slug: "garage-doors" },
  { displayOrder: 15, displayName: "Appliance Repair", slug: "appliance-repair" },
  { displayOrder: 16, displayName: "Locksmith / Security", slug: "locksmith-security" },
  { displayOrder: 17, displayName: "Windows / Glass", slug: "windows-glass" },
  { displayOrder: 18, displayName: "Siding", slug: "siding" },
  { displayOrder: 19, displayName: "Gutters", slug: "gutters" },
  { displayOrder: 20, displayName: "Concrete / Masonry", slug: "concrete-masonry" },
  { displayOrder: 21, displayName: "Fencing", slug: "fencing" },
  { displayOrder: 22, displayName: "Junk Removal / Hauling", slug: "junk-removal-hauling" },
  { displayOrder: 23, displayName: "Moving", slug: "moving" },
  { displayOrder: 24, displayName: "Catering / Party Catering", slug: "catering-party-catering" },
  { displayOrder: 25, displayName: "Handyman / Property Maintenance", slug: "handyman-property-maintenance" },
] as const;

export type FounderCategorySlug = typeof FOUNDER_CATEGORY_CATALOG[number]["slug"];
export type FounderCategoryDisplayName = typeof FOUNDER_CATEGORY_CATALOG[number]["displayName"];
export type FounderCategoryStatus = "available" | "reserved" | "claimed";
export type FounderPaymentSource = "stripe_paid" | "paypal_paid" | "manually_granted" | "reserved_without_membership";
export type FounderMembershipStatus = "pending" | "active" | "manually_granted" | "expired";

export const FOUNDER_CATEGORY_SLUGS = new Set<string>(FOUNDER_CATEGORY_CATALOG.map((category) => category.slug));
export const FOUNDER_CATEGORY_DISPLAY_NAMES = FOUNDER_CATEGORY_CATALOG.map((category) => category.displayName) as [FounderCategoryDisplayName, ...FounderCategoryDisplayName[]];

const LEGACY_FOUNDER_CATEGORY_ALIASES: Readonly<Record<string, FounderCategorySlug>> = {
  plumbing: "plumbing-sewer",
  landscaping: "landscaping-snow",
};

export function isFounderCategorySlug(value: string): value is FounderCategorySlug {
  return FOUNDER_CATEGORY_SLUGS.has(value);
}

export function normalizeFounderCategorySlug(value: string): FounderCategorySlug {
  const normalized = value.trim().toLowerCase();
  const canonical = LEGACY_FOUNDER_CATEGORY_ALIASES[normalized] ?? normalized;
  if (!isFounderCategorySlug(canonical)) throw new Error(`Unknown Founder category: ${value}`);
  return canonical;
}

export function initialFounderCategoryState(slug: FounderCategorySlug) {
  if (slug === "flooring") return { status: "claimed" as const, publicBusinessName: "Flooring Trends", paymentSource: "reserved_without_membership" as const };
  if (slug === "roofing") return { status: "claimed" as const, publicBusinessName: "CLA Exteriors", paymentSource: "reserved_without_membership" as const };
  if (slug === "appliance-repair") return { status: "reserved" as const, publicBusinessName: null, paymentSource: "reserved_without_membership" as const };
  return { status: "available" as const, publicBusinessName: null, paymentSource: null };
}
