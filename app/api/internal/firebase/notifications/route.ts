import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { deliverPendingFirebaseNotifications } from "@/src/lib/firebase/notification-delivery";
import { EmailProviderConfigurationError } from "@/src/lib/firebase/email-provider";
import { isFirebaseOperationalBackend } from "@/src/lib/firebase/platform";

export const dynamic = "force-dynamic";
const schema = z.object({ limit: z.coerce.number().int().min(1).max(100).optional() });

function authorized(value: string | null) {
  const secret = process.env.NOTIFICATION_WORKER_SECRET;
  const token = value?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || Buffer.byteLength(secret) !== Buffer.byteLength(token)) return false;
  return timingSafeEqual(Buffer.from(secret), Buffer.from(token));
}

export async function POST(request: Request) {
  if (!isFirebaseOperationalBackend()) return NextResponse.json({ error: "Firebase notification delivery is not active." }, { status: 404 });
  if (!authorized(request.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid notification worker input." }, { status: 400 });
  try {
    const result = await deliverPendingFirebaseNotifications({ limit: parsed.data.limit });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof EmailProviderConfigurationError ? 503 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Notification delivery failed." }, { status });
  }
}
