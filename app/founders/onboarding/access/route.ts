import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createOnboardingToken,
  FOUNDER_ONBOARDING_ACCESS_DAYS,
  FOUNDER_ONBOARDING_COOKIE,
  hashOnboardingToken,
} from "@/src/lib/founding-partner/onboarding-access";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

export const dynamic = "force-dynamic";
const sessionSchema = z.string().regex(/^cs_(test_|live_)?[A-Za-z0-9]+$/);

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const sessionId = sessionSchema.safeParse(requestUrl.searchParams.get("session_id"));
  if (!sessionId.success) return NextResponse.redirect(new URL("/founders?onboarding=access_required", request.url));

  const admin = createSupabaseAdminClient();
  const { data: payment } = await admin.from("founding_partner_payments")
    .select("id,customer_email")
    .eq("checkout_session_id", sessionId.data).eq("payment_status", "paid").eq("amount_paid_cents", 29900).eq("currency", "USD").maybeSingle();
  if (!payment) return NextResponse.redirect(new URL("/founders?onboarding=payment_not_verified", request.url));
  const { data: onboarding } = await admin.from("founding_partner_onboardings").select("id").eq("payment_id", payment.id).maybeSingle();
  if (!onboarding) return NextResponse.redirect(new URL("/founders?onboarding=payment_not_verified", request.url));

  const token = createOnboardingToken();
  const tokenHash = await hashOnboardingToken(token);
  const expiresAt = new Date(Date.now() + FOUNDER_ONBOARDING_ACCESS_DAYS * 24 * 60 * 60 * 1000);
  const { error } = await admin.from("founding_partner_onboardings").update({ access_token_hash: tokenHash, access_token_expires_at: expiresAt.toISOString() }).eq("id", onboarding.id).eq("payment_id", payment.id);
  if (error) {
    console.error("founding_partner_access_issue_failed", { onboardingId: onboarding.id, errorType: error.name ?? "DatabaseError" });
    return NextResponse.redirect(new URL("/founders?onboarding=access_unavailable", request.url));
  }

  const response = NextResponse.redirect(new URL("/founders/onboarding", request.url));
  response.cookies.set(FOUNDER_ONBOARDING_COOKIE, `${onboarding.id}.${token}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/founders/onboarding",
    maxAge: FOUNDER_ONBOARDING_ACCESS_DAYS * 24 * 60 * 60,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
