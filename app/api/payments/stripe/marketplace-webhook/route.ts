import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/src/lib/stripe/client";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

export const dynamic = "force-dynamic";

function webhookSecret() {
  const value = process.env.STRIPE_MARKETPLACE_WEBHOOK_SECRET;
  if (!value?.startsWith("whsec_")) throw new Error("STRIPE_MARKETPLACE_WEBHOOK_SECRET is not configured.");
  return value;
}

export async function POST(request: Request) {
  const payload = await request.text();
  if (!process.env.STRIPE_MARKETPLACE_WEBHOOK_SECRET?.startsWith("whsec_")) {
    return NextResponse.json({ error: "Marketplace webhook is not configured" }, { status: 500 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  const stripeClient = getStripeClient();
  let event: Stripe.Event;
  try {
    // Snapshot webhooks use constructEventAsync. The raw body must not be parsed
    // or transformed before signature verification.
    event = await stripeClient.webhooks.constructEventAsync(payload, signature, webhookSecret());
  } catch {
    return NextResponse.json({ error: "Webhook verification failed" }, { status: 401 });
  }
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.expired"].includes(event.type)) {
    return NextResponse.json({ received: true, processed: false });
  }

  const sessionObject = event.data.object as Stripe.Checkout.Session;
  if (sessionObject.metadata?.purchase_type !== "marketplace_product") {
    return NextResponse.json({ received: true, processed: false });
  }
  const admin = createSupabaseAdminClient();
  const { data: prior } = await admin.from("stripe_connect_events").select("processed_at")
    .eq("stripe_event_id", event.id).maybeSingle();
  if (prior?.processed_at) return NextResponse.json({ received: true, duplicate: true });
  const { error: ledgerError } = await admin.from("stripe_connect_events").upsert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload_style: "snapshot",
    related_object_id: sessionObject.id,
  }, { onConflict: "stripe_event_id" });
  if (ledgerError) return NextResponse.json({ error: "Unable to record verified event" }, { status: 500 });

  try {
    const session = await stripeClient.checkout.sessions.retrieve(sessionObject.id, { expand: ["payment_intent"] });
    const orderId = session.metadata?.marketplace_order_id;
    if (!orderId) throw new Error("Missing marketplace order metadata.");
    const { data: order } = await admin.from("marketplace_orders")
      .select("id,amount_cents,application_fee_cents,currency,seller_organization_id,marketplace_products(stripe_connected_account_id)")
      .eq("id", orderId)
      .eq("stripe_checkout_session_id", session.id)
      .maybeSingle();
    if (!order) throw new Error("No matching marketplace order.");

    if (event.type === "checkout.session.expired") {
      const { error } = await admin.from("marketplace_orders").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", order.id).eq("status", "checkout_created");
      if (error) throw error;
    } else {
      const intent = typeof session.payment_intent === "string" ? null : session.payment_intent;
      if (session.mode !== "payment" || session.status !== "complete" || session.payment_status !== "paid") throw new Error("Checkout is not paid.");
      if (session.amount_total !== order.amount_cents || session.currency?.toUpperCase() !== order.currency) throw new Error("Checkout economics do not match the order.");
      if (!intent || intent.status !== "succeeded" || intent.amount_received !== order.amount_cents) throw new Error("PaymentIntent is not a matching successful payment.");
      if (intent.application_fee_amount !== order.application_fee_cents) throw new Error("Application fee does not match the order.");
      const destination = typeof intent.transfer_data?.destination === "string" ? intent.transfer_data.destination : intent.transfer_data?.destination.id;
      const product = order.marketplace_products as unknown as { stripe_connected_account_id: string } | null;
      const { data: productMapping } = product ? await admin.from("stripe_connected_accounts")
        .select("stripe_account_id")
        .eq("id", product.stripe_connected_account_id)
        .maybeSingle() : { data: null };
      if (!productMapping || destination !== productMapping.stripe_account_id) throw new Error("Transfer destination does not match the seller.");
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      const { error } = await admin.from("marketplace_orders").update({
        status: "paid",
        stripe_payment_intent_id: intent.id,
        stripe_customer_id: customerId ?? null,
        customer_email: session.customer_details?.email ?? session.customer_email,
        paid_at: new Date((intent.created ?? Math.floor(Date.now()/1000))*1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", order.id).in("status", ["checkout_created", "processing", "paid"]);
      if (error) throw error;
    }
    await admin.from("stripe_connect_events").update({ processed_at: new Date().toISOString(), processing_error: null }).eq("stripe_event_id", event.id);
    return NextResponse.json({ received: true, processed: true });
  } catch (error) {
    console.error("stripe_marketplace_webhook_failed", { eventId: event.id, errorType: error instanceof Error ? error.name : "UnknownError" });
    await admin.from("stripe_connect_events").update({ processing_error: error instanceof Error ? error.message.slice(0, 500) : "Unknown processing error" }).eq("stripe_event_id", event.id);
    return NextResponse.json({ error: "Verified event could not be processed" }, { status: 500 });
  }
}
