export const VENDOR_MEMBERSHIP_CODES = ["free", "verified", "premium", "founding_partner"] as const;
export type VendorMembershipCode = (typeof VENDOR_MEMBERSHIP_CODES)[number];

export type VendorMembershipPlan = {
  code: VendorMembershipCode;
  name: string;
  price: string;
  cadence: string;
  description: string;
  features: readonly string[];
  featured?: boolean;
  capacity?: number;
};

export const VENDOR_MEMBERSHIP_PLANS: readonly VendorMembershipPlan[] = [
  {
    code: "free",
    name: "Free",
    price: "$0",
    cadence: "No monthly fee",
    description: "A professional starting point for local providers building their Connect presence.",
    features: ["Marketplace profile", "Standard search placement", "Up to 5 quotes per month"],
  },
  {
    code: "verified",
    name: "Verified",
    price: "$0",
    cadence: "Credential review required",
    description: "Current business credentials and stronger visibility for trusted local work.",
    features: ["License verification", "Insurance verification", "Priority search", "Verified badge"],
  },
  {
    code: "premium",
    name: "Premium",
    price: "$49",
    cadence: "per month",
    description: "Placement, promotion, and intelligence tools for providers ready to grow.",
    features: ["AI placement", "Homepage placement", "Videos", "Coupons", "Analytics", "Push notifications"],
    featured: true,
  },
  {
    code: "founding_partner",
    name: "Founding Partner",
    price: "$299",
    cadence: "One-time · 50 vendors only",
    description: "Permanent recognition for the first fifty businesses helping shape Optimize Local Connect.",
    features: ["One year of Premium", "Permanent Founding Partner badge", "Locked renewal pricing", "All Premium benefits"],
    capacity: 50,
  },
] as const;

export function isPremiumMembership(code: string): boolean {
  return code === "premium" || code === "founding_partner";
}

export function membershipLabel(code: string): string {
  return VENDOR_MEMBERSHIP_PLANS.find((plan) => plan.code === code)?.name ?? "Free";
}
