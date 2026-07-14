import { NextResponse } from "next/server";
import { z } from "zod";
import { classifyPayPalEvent, extractClaimId } from "@/src/domain/founding-fifty/payment";
import { verifyPayPalWebhook } from "@/src/lib/founding-fifty/paypal";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

export const dynamic = "force-dynamic";

const eventSchema = z.object({ id: z.string().min(1), event_type: z.string().min(1), resource: z.unknown().optional() }).passthrough();

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid PayPal event" }, { status: 400 });
  let verified = false;
  try { verified = await verifyPayPalWebhook(request.headers, body); } catch { verified = false; }
  if (!verified) return NextResponse.json({ error: "Webhook verification failed" }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const claimId = extractClaimId(body);
  const outcome = classifyPayPalEvent(parsed.data.event_type);
  const { error: ledgerError } = await admin.from("founding_payment_events").insert({ provider: "paypal", provider_event_id: parsed.data.id, event_type: parsed.data.event_type, claim_id: claimId, verification_status: outcome === "ignored" ? "ignored" : "verified", payload: body });
  if (ledgerError?.code === "23505") return NextResponse.json({ received: true, duplicate: true });
  if (ledgerError) return NextResponse.json({ error: "Unable to record event" }, { status: 500 });
  if (!claimId || outcome === "ignored") return NextResponse.json({ received: true, processed: false });

  const reference = parsed.data.id;
  const rpc = outcome === "verified"
    ? admin.rpc("confirm_founding_claim", { target_claim_id: claimId, target_payment_reference: reference, confirmation_source: "paypal_webhook" })
    : admin.rpc("record_founding_payment_outcome", { target_claim_id: claimId, target_status: outcome === "failed" ? "payment_failed" : "payment_cancelled", target_payment_reference: reference });
  const { error } = await rpc;
  if (error) return NextResponse.json({ error: "Event recorded but claim processing failed" }, { status: 500 });
  return NextResponse.json({ received: true, processed: true });
}
