import "server-only";
import type Stripe from "stripe";
import { z } from "zod";
import { getVendorPlan, getVendorPlanPriceId, getVendorPlanProductId, VENDOR_MEMBERSHIP_PLANS } from "@/src/domain/vendor-memberships/catalog";
import { membershipStatusFromStripe } from "@/src/domain/vendor-memberships/status";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { getStripeClient } from "@/src/lib/stripe/client";
import { evaluateOrganizationActivation } from "@/src/lib/vendor-memberships/lifecycle";

const uuid=z.string().uuid();
export async function createVendorMembershipCheckout(input:{planKey:string;organizationId:string;membershipId:string;userId?:string;guestClaimId?:string;customerId:string;onboardingVersion:number;checkoutAttemptNumber:number;successUrl:string;cancelUrl:string}){
  const plan=getVendorPlan(input.planKey); if(!plan) throw new Error("Unknown vendor membership plan.");
  const priceId=getVendorPlanPriceId(plan); const productId=getVendorPlanProductId(plan); const stripeClient=getStripeClient();
  const price=await stripeClient.prices.retrieve(priceId);
  const attachedProductId=typeof price.product==="string"?price.product:price.product.id;
  if(!price.active||price.type!=="recurring"||attachedProductId!==productId||price.unit_amount!==plan.amountCents||price.currency.toUpperCase()!==plan.currency||price.recurring?.interval!==plan.interval) throw new Error(`${plan.stripePriceEnv} does not match the configured Product, plan price, and interval.`);
  const metadata={
    organization_id:input.organizationId,
    ...(input.userId ? { user_id:input.userId } : {}),
    ...(input.guestClaimId ? { guest_claim_id:input.guestClaimId } : {}),
    membership_record_id:input.membershipId,
    membership_tier:plan.key,
    onboarding_version:String(input.onboardingVersion),
    // Legacy aliases keep already-configured webhook deployments compatible.
    vendor_membership_id:input.membershipId,
    vendor_organization_id:input.organizationId,
    vendor_plan_key:plan.key,
  };
  const session=await stripeClient.checkout.sessions.create({mode:plan.checkoutMode,customer:input.customerId,line_items:[{price:priceId,quantity:1}],success_url:input.successUrl,cancel_url:input.cancelUrl,client_reference_id:input.membershipId,metadata,subscription_data:{metadata},billing_address_collection:"auto",allow_promotion_codes:false},{idempotencyKey:`vendor-membership-${input.membershipId}-attempt-${input.checkoutAttemptNumber}`});
  if(!session.url) throw new Error("Stripe Checkout did not return a hosted URL.");
  return {id:session.id,url:session.url};
}

function subscriptionIdFromInvoice(invoice:Stripe.Invoice){
  const modern=invoice.parent?.subscription_details?.subscription;
  if(typeof modern==="string") return modern;
  if(modern&&typeof modern==="object") return modern.id;
  const legacy=(invoice as unknown as {subscription?:string|{id:string}|null}).subscription;
  return typeof legacy==="string"?legacy:legacy?.id??null;
}
function subscriptionPeriodEnd(subscription:Stripe.Subscription){return subscription.items.data.map(item=>item.current_period_end).filter(Boolean).sort((a,b)=>b-a)[0]??null;}

export const MEMBERSHIP_STRIPE_EVENTS=new Set(["checkout.session.completed","checkout.session.expired","customer.subscription.created","customer.subscription.updated","customer.subscription.deleted","invoice.paid","invoice.payment_failed"]);
export function isVendorMembershipCheckout(event:Stripe.Event){return Boolean(event.type.startsWith("checkout.session.")&&"metadata" in event.data.object&&(event.data.object.metadata?.membership_record_id||event.data.object.metadata?.vendor_membership_id));}

export async function processVendorMembershipStripeEvent(event:Stripe.Event,payload:unknown){
  if(!MEMBERSHIP_STRIPE_EVENTS.has(event.type)) return false;
  const admin=createSupabaseAdminClient();
  const {data:prior,error:priorError}=await admin.from("vendor_membership_provider_events").select("processed_at").eq("provider","stripe").eq("provider_event_id",event.id).maybeSingle();
  if(priorError) throw priorError;
  if(prior?.processed_at) return true;
  if(event.type==="checkout.session.expired"){
    const session=event.data.object as Stripe.Checkout.Session;const membershipId=uuid.safeParse(session.metadata?.membership_record_id??session.metadata?.vendor_membership_id);if(!membershipId.success)return false;
    const {error:expireError}=await admin.rpc("fail_vendor_membership_checkout",{target_membership_id:membershipId.data});
    if(expireError) throw expireError;
    const {error:ledgerError}=await admin.from("vendor_membership_provider_events").upsert({provider_event_id:event.id,event_type:event.type,provider_object_id:session.id,membership_id:membershipId.data,payload,processed_at:new Date().toISOString(),processing_error:null},{onConflict:"provider,provider_event_id"});
    if(ledgerError) throw ledgerError;
    return true;
  }
  const stripeClient=getStripeClient(); let subscriptionId:string|null=null;
  if(event.type==="checkout.session.completed"){
    const session=event.data.object as Stripe.Checkout.Session;
    if(!session.metadata?.membership_record_id&&!session.metadata?.vendor_membership_id) return false;
    subscriptionId=typeof session.subscription==="string"?session.subscription:session.subscription?.id??null;
  }else if(event.type.startsWith("customer.subscription.")) subscriptionId=(event.data.object as Stripe.Subscription).id;
  else subscriptionId=subscriptionIdFromInvoice(event.data.object as Stripe.Invoice);
  if(!subscriptionId?.startsWith("sub_")) return false;
  const subscription=await stripeClient.subscriptions.retrieve(subscriptionId,{expand:["items.data.price"]});
  const metadata=subscription.metadata; const membershipId=uuid.safeParse(metadata.membership_record_id??metadata.vendor_membership_id); const organizationId=uuid.safeParse(metadata.organization_id??metadata.vendor_organization_id);
  if(!membershipId.success||!organizationId.success) return false;
  const item=subscription.items.data[0]; const priceId=typeof item?.price==="string"?item.price:item?.price.id; const amount=typeof item?.price==="string"?null:item?.price.unit_amount; const interval=typeof item?.price==="string"?null:item?.price.recurring?.interval;
  const plan=VENDOR_MEMBERSHIP_PLANS.find(candidate=>getVendorPlanPriceId(candidate)===priceId);if(!plan)return false;
  const expectedPrice=getVendorPlanPriceId(plan); const customerId=typeof subscription.customer==="string"?subscription.customer:subscription.customer.id;
  if(subscription.items.data.length!==1||item?.quantity!==1||priceId!==expectedPrice||amount!==plan.amountCents||interval!==plan.interval||subscription.currency.toUpperCase()!==plan.currency) throw new Error("Stripe subscription does not match the configured vendor plan.");
  const {error}=await admin.rpc("process_vendor_membership_stripe_event",{target_event_id:event.id,target_event_type:event.type,target_membership_id:membershipId.data,target_vendor_organization_id:organizationId.data,target_level_code:plan.code,target_subscription_id:subscription.id,target_customer_id:customerId,target_price_id:priceId,target_status:membershipStatusFromStripe(event.type,subscription.status),target_period_end:subscriptionPeriodEnd(subscription)?new Date(subscriptionPeriodEnd(subscription)!*1000).toISOString():null,target_cancel_at_period_end:subscription.cancel_at_period_end,target_amount_cents:amount,target_currency:subscription.currency.toUpperCase(),target_payload:payload});
  if(error) throw error;
  const stripeCustomer=await stripeClient.customers.retrieve(customerId);
  if(!("deleted" in stripeCustomer && stripeCustomer.deleted) && stripeCustomer.email) {
    const { error: claimError } = await admin.rpc("record_guest_founding_vendor_payment", { target_membership_id: membershipId.data, target_customer_id: customerId, target_customer_email: stripeCustomer.email });
    if (claimError) throw claimError;
  }
  await evaluateOrganizationActivation(organizationId.data);
  return true;
}
