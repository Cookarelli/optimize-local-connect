export const VENDOR_PLAN_KEYS = ["founding_partner", "network", "preferred"] as const;
export type VendorPlanKey = (typeof VENDOR_PLAN_KEYS)[number];
export type VendorMembershipCode = VendorPlanKey;
export type VendorMembershipStatus = "pending" | "active" | "trialing" | "past_due" | "canceled" | "expired" | "complimentary" | "manually_granted";

export type VendorMembershipPlan = {
  key: VendorPlanKey;
  code: VendorMembershipCode;
  name: string;
  amountCents: number;
  currency: "USD";
  interval: "month" | "year" | null;
  checkoutMode: "subscription" | "payment";
  stripeProductEnv: "STRIPE_FOUNDING_PRODUCT_ID" | "STRIPE_NETWORK_PRODUCT_ID" | "STRIPE_PREFERRED_PRODUCT_ID";
  stripePriceEnv: "STRIPE_FOUNDING_VENDOR_PRICE_ID" | "STRIPE_NETWORK_MEMBER_PRICE_ID" | "STRIPE_PREFERRED_VENDOR_PRICE_ID";
  description: string;
  features: readonly string[];
  entitlements: { directory: boolean; propertyManagerPerk: boolean; opportunities: boolean; dashboard: boolean; preferredPlacement: boolean; founderBadge: boolean };
  badge: "founder" | "preferred" | null;
  placementPriority: number;
  capacity?: number;
  renewal: { behavior: "same_stripe_price"; configurable: true } | { behavior: "none"; configurable: false };
  paymentRequired: boolean;
  manualApprovalRequired: boolean;
  publicationEligible: boolean;
  publiclyPurchasable: boolean;
};

export const VENDOR_MEMBERSHIP_PLANS: readonly VendorMembershipPlan[] = [
  { key:"founding_partner",code:"founding_partner",name:"Founding Partner",amountCents:29900,currency:"USD",interval:null,checkoutMode:"payment",stripeProductEnv:"STRIPE_FOUNDING_PRODUCT_ID",stripePriceEnv:"STRIPE_FOUNDING_VENDOR_PRICE_ID",description:"One-time Founding recognition and premium visibility for early Rockford-area vendors.",features:["Founder badge","Premium placement","Property Manager Perk","Core vendor-network access"],entitlements:{directory:true,propertyManagerPerk:true,opportunities:true,dashboard:true,preferredPlacement:true,founderBadge:true},badge:"founder",placementPriority:30,capacity:50,renewal:{behavior:"none",configurable:false},paymentRequired:true,manualApprovalRequired:true,publicationEligible:true,publiclyPurchasable:true},
  { key:"network",code:"network",name:"Network Member",amountCents:1900,currency:"USD",interval:"month",checkoutMode:"subscription",stripeProductEnv:"STRIPE_NETWORK_PRODUCT_ID",stripePriceEnv:"STRIPE_NETWORK_MEMBER_PRICE_ID",description:"A paid business profile and access to the local property-management network.",features:["Paid directory visibility","Standard business profile","Property-manager opportunities"],entitlements:{directory:true,propertyManagerPerk:false,opportunities:true,dashboard:true,preferredPlacement:false,founderBadge:false},badge:null,placementPriority:10,renewal:{behavior:"same_stripe_price",configurable:true},paymentRequired:true,manualApprovalRequired:true,publicationEligible:true,publiclyPurchasable:true},
  { key:"preferred",code:"preferred",name:"Preferred Vendor",amountCents:4900,currency:"USD",interval:"month",checkoutMode:"subscription",stripeProductEnv:"STRIPE_PREFERRED_PRODUCT_ID",stripePriceEnv:"STRIPE_PREFERRED_VENDOR_PRICE_ID",description:"Enhanced marketplace visibility for vendors ready to build repeat property-manager relationships.",features:["Enhanced placement","Preferred badge","Property Manager Perk","Expanded profile and visibility"],entitlements:{directory:true,propertyManagerPerk:true,opportunities:true,dashboard:true,preferredPlacement:true,founderBadge:false},badge:"preferred",placementPriority:20,renewal:{behavior:"same_stripe_price",configurable:true},paymentRequired:true,manualApprovalRequired:true,publicationEligible:true,publiclyPurchasable:true},
] as const;

export const FOUNDING_PARTNER_PLAN = VENDOR_MEMBERSHIP_PLANS[0];
export const FOUNDING_PARTNER_RENEWAL_DISCLOSURE = "You are charged $299 once at Checkout for a Founding Partner membership. This is not a subscription and does not renew automatically.";

export function formatVendorPlanPrice(plan: VendorMembershipPlan) {
  return `$${plan.amountCents / 100}${plan.interval ? `/${plan.interval}` : ""}`;
}

const LEGACY_PLAN_ALIASES: Record<string, VendorPlanKey> = { founding_vendor:"founding_partner",network_member:"network",preferred_vendor:"preferred",premium:"preferred" };
export function normalizeVendorPlanKey(key:string):VendorPlanKey|undefined { const normalized=LEGACY_PLAN_ALIASES[key]??key;return VENDOR_PLAN_KEYS.includes(normalized as VendorPlanKey)?normalized as VendorPlanKey:undefined; }
export function getVendorPlan(key: string) { const normalized=normalizeVendorPlanKey(key);return VENDOR_MEMBERSHIP_PLANS.find(plan=>plan.key===normalized); }
export function getVendorPlanByCode(code: string) { return getVendorPlan(code); }
type VendorPlanEnvironment = Record<string, string | undefined>;
export function getVendorPlanProductId(plan: VendorMembershipPlan, env: VendorPlanEnvironment = process.env) {
  const value=env[plan.stripeProductEnv];
  if (!value?.startsWith("prod_")) throw new Error(`${plan.stripeProductEnv} must be configured with a Stripe Product ID.`);
  return value;
}
export function getVendorPlanPriceId(plan: VendorMembershipPlan, env: VendorPlanEnvironment = process.env) {
  const value=env[plan.stripePriceEnv];
  if (!value?.startsWith("price_")) throw new Error(`${plan.stripePriceEnv} must be configured with a Stripe Price ID.`);
  return value;
}
export function validatePurchasableVendorPlanStripeConfig(env: VendorPlanEnvironment = process.env) {
  return VENDOR_MEMBERSHIP_PLANS.filter(plan=>plan.paymentRequired&&plan.publiclyPurchasable).map(plan=>({
    key:plan.key,
    productId:getVendorPlanProductId(plan,env),
    priceId:getVendorPlanPriceId(plan,env),
  }));
}
export function isPremiumMembership(code:string){return Boolean(getVendorPlanByCode(code)?.entitlements.preferredPlacement);}
export function membershipLabel(code:string){return getVendorPlanByCode(code)?.name??"Inactive";}
