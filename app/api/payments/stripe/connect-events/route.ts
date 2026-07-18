import { NextResponse } from "next/server";
import { getStripeClient } from "@/src/lib/stripe/client";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

export const dynamic = "force-dynamic";

function thinWebhookSecret() {
  const value = process.env.STRIPE_CONNECT_THIN_WEBHOOK_SECRET;
  if (!value?.startsWith("whsec_")) throw new Error("STRIPE_CONNECT_THIN_WEBHOOK_SECRET is not configured.");
  return value;
}

export async function POST(request: Request) {
  const payload = await request.text();
  if (!process.env.STRIPE_CONNECT_THIN_WEBHOOK_SECRET?.startsWith("whsec_")) {
    return NextResponse.json({ error: "Connect events webhook is not configured" }, { status: 500 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  const stripeClient = getStripeClient();
  let notification;
  try {
    // stripe-node 22 renamed parseThinEvent to parseEventNotification. It parses
    // and verifies the same required V2 thin-event payload described by Stripe.
    notification = await stripeClient.parseEventNotificationAsync(payload, signature, thinWebhookSecret());
  } catch {
    return NextResponse.json({ error: "Thin event verification failed" }, { status: 401 });
  }

  if (notification.type !== "v2.core.account[requirements].updated"
    && notification.type !== "v2.core.account[configuration.recipient].capability_status_updated") {
    return NextResponse.json({ received: true, processed: false });
  }
  const admin = createSupabaseAdminClient();
  const { data: prior } = await admin.from("stripe_connect_events").select("processed_at")
    .eq("stripe_event_id", notification.id).maybeSingle();
  if (prior?.processed_at) return NextResponse.json({ received: true, duplicate: true });
  const { error: ledgerError } = await admin.from("stripe_connect_events").upsert({
    stripe_event_id: notification.id,
    event_type: notification.type,
    payload_style: "thin",
    related_object_id: notification.related_object.id,
  }, { onConflict: "stripe_event_id" });
  if (ledgerError) return NextResponse.json({ error: "Unable to record verified thin event" }, { status: 500 });

  try {
    // Thin payloads intentionally omit the object. Fetch both the full event and
    // current account so handlers never act on an unverified client-side status.
    if (notification.type === "v2.core.account[requirements].updated") {
      await notification.fetchEvent();
      const account = await notification.fetchRelatedObject();
      console.info("stripe_connect_requirements_updated", {
        accountId: account.id,
        requirementCount: account.requirements?.entries?.length ?? 0,
        minimumDeadlineStatus: account.requirements?.summary?.minimum_deadline?.status ?? "none",
      });
    } else if (notification.type === "v2.core.account[configuration.recipient].capability_status_updated") {
      await notification.fetchEvent();
      const account = await notification.fetchRelatedObject();
      console.info("stripe_connect_recipient_capability_updated", {
        accountId: account.id,
        transferStatus: account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status ?? "unrequested",
      });
    }
    await admin.from("stripe_connect_events").update({ processed_at: new Date().toISOString(), processing_error: null }).eq("stripe_event_id", notification.id);
    return NextResponse.json({ received: true, processed: true });
  } catch (error) {
    console.error("stripe_connect_thin_event_failed", { eventId: notification.id, errorType: error instanceof Error ? error.name : "UnknownError" });
    await admin.from("stripe_connect_events").update({ processing_error: error instanceof Error ? error.message.slice(0, 500) : "Unknown processing error" }).eq("stripe_event_id", notification.id);
    return NextResponse.json({ error: "Verified thin event could not be processed" }, { status: 500 });
  }
}
