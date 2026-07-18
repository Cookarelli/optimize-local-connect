import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";
import { getCurrentUser } from "@/src/lib/auth/session";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

export const FOUNDER_ONBOARDING_COOKIE = "founder_onboarding_access";
export const FOUNDER_ONBOARDING_ACCESS_DAYS = 30;

const cookieSchema = z.string().regex(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{40,200}$/i);

export async function hashOnboardingToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function createOnboardingToken() {
  return `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
}

export type FoundingPartnerAccess = {
  onboardingId: string;
  paymentId: string;
  customerEmail: string;
  customerName: string | null;
  status: string;
};

export async function resolveFoundingPartnerOnboardingAccess(): Promise<FoundingPartnerAccess | null> {
  const admin = createSupabaseAdminClient();
  const cookieValue = (await cookies()).get(FOUNDER_ONBOARDING_COOKIE)?.value;
  const parsedCookie = cookieSchema.safeParse(cookieValue);

  if (parsedCookie.success) {
    const [onboardingId, token] = parsedCookie.data.split(".", 2);
    const tokenHash = await hashOnboardingToken(token);
    const { data: onboarding } = await admin.from("founding_partner_onboardings")
      .select("id,payment_id,status,customer_email,customer_name")
      .eq("id", onboardingId).eq("access_token_hash", tokenHash).gt("access_token_expires_at", new Date().toISOString()).maybeSingle();
    if (onboarding) return { onboardingId: onboarding.id, paymentId: onboarding.payment_id, customerEmail: onboarding.customer_email, customerName: onboarding.customer_name, status: onboarding.status };
  }

  const user = await getCurrentUser();
  if (!user?.email) return null;
  const { data: payment } = await admin.from("founding_partner_payments")
    .select("id,customer_email,customer_name")
    .eq("payment_status", "paid").eq("customer_email", user.email.toLowerCase()).order("paid_at", { ascending: false }).limit(1).maybeSingle();
  if (!payment) return null;
  const { data: onboarding } = await admin.from("founding_partner_onboardings")
    .select("id,payment_id,status,customer_email,customer_name")
    .eq("payment_id", payment.id).maybeSingle();
  if (!onboarding) return null;
  await admin.from("founding_partner_onboardings").update({ owner_user_id: user.id }).eq("id", onboarding.id).is("owner_user_id", null);
  return { onboardingId: onboarding.id, paymentId: onboarding.payment_id, customerEmail: onboarding.customer_email, customerName: onboarding.customer_name, status: onboarding.status };
}
