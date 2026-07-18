import { getVendorPlanByCode, type VendorMembershipStatus } from "@/src/domain/vendor-memberships/catalog";

// `past_due` is the centralized, time-bounded billing grace state. Access still
// ends when the recorded current period ends, or immediately on cancellation.
const ACCESS_STATUSES = new Set<VendorMembershipStatus>(["active","trialing","past_due","complimentary","manually_granted"]);
export type MembershipAccess = { code:string|null|undefined; status:string|null|undefined; currentPeriodEndsAt?:string|null };
function eligible(input:MembershipAccess){
  if(!ACCESS_STATUSES.has(input.status as VendorMembershipStatus)) return false;
  if(input.status==="past_due") return Boolean(input.currentPeriodEndsAt&&input.currentPeriodEndsAt>new Date().toISOString());
  return !input.currentPeriodEndsAt||input.currentPeriodEndsAt>new Date().toISOString();
}
function entitlement(input:MembershipAccess,key:keyof NonNullable<ReturnType<typeof getVendorPlanByCode>>["entitlements"]){return eligible(input)&&Boolean(getVendorPlanByCode(input.code??"")?.entitlements[key]);}
export const canAppearInDirectory=(input:MembershipAccess)=>entitlement(input,"directory");
export const canUsePropertyManagerPerk=(input:MembershipAccess)=>entitlement(input,"propertyManagerPerk");
export const hasFounderBadge=(input:MembershipAccess)=>entitlement(input,"founderBadge");
export const hasPreferredPlacement=(input:MembershipAccess)=>entitlement(input,"preferredPlacement");
export const canReceiveOpportunities=(input:MembershipAccess)=>entitlement(input,"opportunities");
export const canAccessVendorDashboard=(input:MembershipAccess)=>entitlement(input,"dashboard");
