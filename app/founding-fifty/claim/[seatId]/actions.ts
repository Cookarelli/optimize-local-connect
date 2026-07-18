"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getAppOrigin } from "@/src/lib/auth/origin";
import { requireUser } from "@/src/lib/auth/session";
import { createStripeCheckout } from "@/src/lib/founding-fifty/stripe";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export type ClaimState = { status: "idle" | "error"; message?: string };

const schema = z.object({
  seatId: z.string().uuid(),
  businessName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(160),
  email: z.string().trim().email(),
  phone: z.string().trim().min(7).max(40),
  website: z.union([z.literal(""), z.string().trim().url()]),
  industry: z.string().trim().min(2).max(160),
  city: z.string().trim().min(2).max(160),
  description: z.string().trim().min(20).max(1200),
  terms: z.literal("accepted"),
});

export async function createFoundingClaim(_state: ClaimState, formData: FormData): Promise<ClaimState> {
  const user = await requireUser();
  const parsed = schema.safeParse({ seatId: formData.get("seatId"), businessName: formData.get("businessName"), contactName: formData.get("contactName"), email: formData.get("email"), phone: formData.get("phone"), website: formData.get("website"), industry: formData.get("industry"), city: formData.get("city"), description: formData.get("description"), terms: formData.get("terms") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const supabase = await createSupabaseServerClient();
  const { data: claimId, error } = await supabase.rpc("claim_founding_seat", {
    target_seat_id: parsed.data.seatId,
    claim_business_name: parsed.data.businessName,
    claim_contact_name: parsed.data.contactName,
    claim_email: parsed.data.email,
    claim_phone: parsed.data.phone,
    claim_website: parsed.data.website,
    claim_industry: parsed.data.industry,
    claim_city: parsed.data.city,
    claim_description: parsed.data.description,
    claim_terms_version: "founding-fifty-2026-07-14",
    claim_payment_provider: "stripe",
  });
  if (error || !claimId) return { status: "error", message: error?.message.includes("not available") ? "That seat was just claimed or reserved. Choose another available seat." : "We could not hold this seat. Please try again." };

  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0 && logo.size <= 5_000_000 && ["image/jpeg", "image/png", "image/webp"].includes(logo.type)) {
    const extension = logo.type === "image/png" ? "png" : logo.type === "image/webp" ? "webp" : "jpg";
    const path = `${user.id}/${claimId}/logo.${extension}`;
    const { error: uploadError } = await supabase.storage.from("founding-fifty-logos").upload(path, logo, { contentType: logo.type, upsert: true });
    if (!uploadError) {
      const { data } = supabase.storage.from("founding-fifty-logos").getPublicUrl(path);
      await supabase.rpc("set_founding_claim_logo", { target_claim_id: claimId, target_logo_url: data.publicUrl });
    }
  }

  try {
    const origin = await getAppOrigin();
    const { data: claim, error: claimError } = await supabase.from("founding_claims").select("payment_amount_cents,email").eq("id", claimId).eq("user_id", user.id).single();
    if (claimError || !claim) return { status: "error", message: "Your seat is held, but checkout could not be prepared. Please try again." };
    const checkout = await createStripeCheckout({
      claimId,
      amountCents: claim.payment_amount_cents,
      currency: "USD",
      email: claim.email,
      successUrl: `${origin}/founding-fifty/confirmation/${claimId}?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/founding-fifty/confirmation/${claimId}?checkout=cancelled`,
    });
    const { error: checkoutError } = await supabase.rpc("set_founding_claim_checkout", {
      target_claim_id: claimId,
      target_checkout_reference: checkout.id,
      target_expires_at: checkout.expiresAt,
    });
    if (checkoutError) return { status: "error", message: "Your seat is held, but checkout could not be attached. Please try again." };
    redirect(checkout.url);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { status: "error", message: "Secure checkout is temporarily unavailable. Your seat remains held; please try again shortly." };
  }
}
