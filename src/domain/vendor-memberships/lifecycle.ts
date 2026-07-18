import { getVendorPlanByCode } from "@/src/domain/vendor-memberships/catalog";

export type VendorApprovalStatus = "pending"|"approved"|"changes_requested"|"rejected";
export type VendorPublicationStatus = "unpublished"|"published"|"suspended";
export type VendorLifecycleState = "payment_pending"|"onboarding_incomplete"|"pending_approval"|"eligible"|"suspended"|"inactive";
export type OrganizationActivationInput = {
  tierCode:string|null|undefined;membershipStatus:string|null|undefined;currentPeriodEndsAt?:string|null;
  organizationStatus:string;approvalStatus:VendorApprovalStatus;publicationStatus:VendorPublicationStatus;
  profile:{businessName?:string|null;description?:string|null;publicEmail?:string|null;categoryCount:number;serviceCount:number;serviceAreaCount:number;publicDisplayConsent:boolean};
  suspendedAt?:string|null;disabledAt?:string|null;deletedAt?:string|null;
};

export function hasSuccessfulMembershipStatus(input:Pick<OrganizationActivationInput,"membershipStatus"|"currentPeriodEndsAt">,now=new Date()){
  if(["active","trialing","complimentary","manually_granted"].includes(input.membershipStatus??"")) return !input.currentPeriodEndsAt||new Date(input.currentPeriodEndsAt)>now;
  return input.membershipStatus==="past_due"&&Boolean(input.currentPeriodEndsAt&&new Date(input.currentPeriodEndsAt)>now);
}
export function evaluateProfileCompletion(profile:OrganizationActivationInput["profile"]){
  const missing:string[]=[];
  if((profile.businessName?.trim().length??0)<2)missing.push("business_name");
  if((profile.description?.trim().length??0)<40)missing.push("description");
  if(!/^\S+@\S+\.\S+$/.test(profile.publicEmail?.trim()??""))missing.push("public_email");
  if(profile.categoryCount<1)missing.push("category");if(profile.serviceCount<1)missing.push("service");if(profile.serviceAreaCount<1)missing.push("service_area");
  if(!profile.publicDisplayConsent)missing.push("public_display_consent");
  return {complete:missing.length===0,missing};
}
export function evaluateOrganizationActivation(input:OrganizationActivationInput,now=new Date()){
  const tier=getVendorPlanByCode(input.tierCode??"");const profile=evaluateProfileCompletion(input.profile);
  const blocked=Boolean(input.suspendedAt||input.disabledAt||input.deletedAt||input.organizationStatus==="suspended"||input.publicationStatus==="suspended");
  const paid=Boolean(tier&&(!tier.paymentRequired||hasSuccessfulMembershipStatus(input,now)));
  let lifecycleState:VendorLifecycleState="inactive";
  if(blocked)lifecycleState="suspended";else if(!paid)lifecycleState="payment_pending";else if(!profile.complete)lifecycleState="onboarding_incomplete";else if(tier?.manualApprovalRequired&&input.approvalStatus!=="approved")lifecycleState="pending_approval";else if(tier?.publicationEligible)lifecycleState="eligible";
  return {tier,profile,paymentSatisfied:paid,lifecycleState,organizationActive:lifecycleState==="eligible",shouldPublish:lifecycleState==="eligible"};
}
export const evaluatePublicationEligibility=evaluateOrganizationActivation;
