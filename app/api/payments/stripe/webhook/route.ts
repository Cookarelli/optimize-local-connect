import { NextResponse } from "next/server";
import { z } from "zod";
import { FOUNDING_PARTNER_MEMBERSHIP_TYPE } from "@/src/domain/founding-partner/checkout";
import { retrieveAndVerifyFoundingPartnerCheckout, retrieveAndVerifyStripeCheckout, verifyStripeWebhook } from "@/src/lib/founding-fifty/stripe";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

export const dynamic = "force-dynamic";

const eventSchema = z.object({
  id: z.string().startsWith("evt_"),
  type: z.string(),
  data: z.object({ object: z.object({
    id: z.string().startsWith("cs_"),
    client_reference_id: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.string()).default({}),
  }).passthrough() }),
}).passthrough();

function logWebhookError(label: string, eventId: string, error: unknown) {
  console.error(label, { eventId, errorType: error instanceof Error ? error.name : "UnknownError" });
}

export async function POST(request: Request) {
  const payload = await request.text();
  if (!await verifyStripeWebhook(payload, request.headers.get("stripe-signature"))) {
    return NextResponse.json({ error: "Webhook verification failed" }, { status: 401 });
  }
  let parsedBody: unknown;
  try { parsedBody = JSON.parse(payload); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = eventSchema.safeParse(parsedBody);
  if (!parsed.success) return NextResponse.json({ error: "Invalid Stripe event" }, { status: 400 });

  const event = parsed.data;
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.expired") {
    return NextResponse.json({ received: true, processed: false });
  }

  const admin = createSupabaseAdminClient();
  const object = event.data.object;
  const directFounderCheckout = object.metadata.membership_type === FOUNDING_PARTNER_MEMBERSHIP_TYPE;

  if (directFounderCheckout && event.type === "checkout.session.completed") {
    let checkout: Awaited<ReturnType<typeof retrieveAndVerifyFoundingPartnerCheckout>> = null;
    try {
      checkout = await retrieveAndVerifyFoundingPartnerCheckout(object.id);
    } catch (error) {
      logWebhookError("founding_partner_checkout_retrieval_failed", event.id, error);
      return NextResponse.json({ error: "Unable to verify Checkout Session" }, { status: 500 });
    }
    if (!checkout) {
      await admin.from("founding_payment_events").upsert({
        provider: "stripe",
        provider_event_id: event.id,
        event_type: event.type,
        verification_status: "rejected",
        payload: parsedBody,
      }, { onConflict: "provider,provider_event_id", ignoreDuplicates: true });
      return NextResponse.json({ error: "Checkout Session did not match the Founding Partner offer" }, { status: 400 });
    }
    const { error } = await admin.rpc("process_founding_partner_payment", {
      target_event_id: event.id,
      target_event_type: event.type,
      target_attempt_id: checkout.attemptId,
      target_checkout_session_id: checkout.sessionId,
      target_customer_id: checkout.customerId,
      target_payment_intent_id: checkout.paymentIntentId,
      target_amount_paid_cents: checkout.amountPaidCents,
      target_currency: checkout.currency,
      target_payment_status: checkout.paymentStatus,
      target_customer_email: checkout.customerEmail,
      target_customer_name: checkout.customerName,
      target_membership_type: checkout.membershipType,
      target_paid_at: checkout.paidAt,
      target_payload: parsedBody,
    });
    if (error) {
      logWebhookError("founding_partner_payment_processing_failed", event.id, error);
      return NextResponse.json({ error: "Payment verification could not be recorded" }, { status: 500 });
    }
    return NextResponse.json({ received: true, processed: true });
  }

  if (directFounderCheckout && event.type === "checkout.session.expired") {
    const attemptId = object.client_reference_id;
    const parsedAttempt = z.string().uuid().safeParse(attemptId);
    if (!parsedAttempt.success || object.metadata.founder_checkout_id !== parsedAttempt.data) {
      return NextResponse.json({ error: "Invalid checkout reference" }, { status: 400 });
    }
    const { error } = await admin.rpc("expire_founding_partner_checkout", {
      target_event_id: event.id,
      target_event_type: event.type,
      target_attempt_id: parsedAttempt.data,
      target_checkout_session_id: object.id,
      target_payload: parsedBody,
    });
    if (error) {
      logWebhookError("founding_partner_checkout_expiration_failed", event.id, error);
      return NextResponse.json({ error: "Checkout expiration could not be recorded" }, { status: 500 });
    }
    return NextResponse.json({ received: true, processed: true });
  }

  let legacyCheckout: Awaited<ReturnType<typeof retrieveAndVerifyStripeCheckout>> = null;
  if (event.type === "checkout.session.completed") {
    try { legacyCheckout = await retrieveAndVerifyStripeCheckout(object.id); }
    catch (error) {
      logWebhookError("legacy_founding_checkout_retrieval_failed", event.id, error);
      return NextResponse.json({ error: "Unable to verify Checkout Session" }, { status: 500 });
    }
  }
  const claimId = legacyCheckout?.claimId ?? object.client_reference_id ?? null;
  const verificationStatus = event.type === "checkout.session.completed" && !legacyCheckout ? "rejected" : "verified";
  const { error: ledgerError } = await admin.from("founding_payment_events").insert({
    provider: "stripe",
    provider_event_id: event.id,
    event_type: event.type,
    claim_id: claimId,
    verification_status: verificationStatus,
    payload: parsedBody,
  });
  if (ledgerError?.code === "23505") {
    // Continue into the idempotent claim RPC so a retry can recover if a prior
    // delivery stored its event but failed before provisioning the claim.
  } else if (ledgerError) {
    logWebhookError("legacy_founding_event_record_failed", event.id, ledgerError);
    return NextResponse.json({ error: "Unable to record event" }, { status: 500 });
  }
  if (verificationStatus !== "verified" || !claimId) return NextResponse.json({ received: true, processed: false });

  const rpc = legacyCheckout
    ? admin.rpc("confirm_founding_claim", { target_claim_id: legacyCheckout.claimId, target_payment_reference: legacyCheckout.paymentIntentId, confirmation_source: "stripe_webhook" })
    : admin.rpc("record_founding_payment_outcome", { target_claim_id: claimId, target_status: "payment_cancelled", target_payment_reference: object.id });
  const { error } = await rpc;
  if (error) {
    logWebhookError("legacy_founding_claim_processing_failed", event.id, error);
    return NextResponse.json({ error: "Event recorded but claim processing failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true, processed: true });
}
