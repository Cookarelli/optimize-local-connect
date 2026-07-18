import type {VendorMembershipStatus} from "@/src/domain/vendor-memberships/catalog";
export function membershipStatusFromStripe(eventType:string,stripeStatus:string):VendorMembershipStatus{
  if(eventType==="invoice.payment_failed")return "past_due";
  if(eventType==="customer.subscription.deleted")return "canceled";
  if(eventType==="invoice.paid")return "active";
  if(stripeStatus==="active")return "active";
  if(stripeStatus==="trialing")return "trialing";
  if(stripeStatus==="incomplete_expired")return "expired";
  if(["past_due","unpaid","incomplete"].includes(stripeStatus))return "past_due";
  if(["canceled","paused"].includes(stripeStatus))return "canceled";
  return "pending";
}
