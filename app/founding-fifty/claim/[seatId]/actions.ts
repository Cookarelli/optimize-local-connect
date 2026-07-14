"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getAppOrigin } from "@/src/lib/auth/origin";
import { requireUser } from "@/src/lib/auth/session";
import { PayPalPaymentLinkAdapter } from "@/src/domain/founding-fifty/payment";
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
    claim_payment_provider: "paypal",
  });
  if (error || !claimId) return { status: "error", message: error?.message.includes("not available") ? "That seat was just claimed or reserved. Choose another available seat." : "We could not hold this seat. Please try again." };

  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0 && logo.size <= 5_000_000 && ["image/jpeg", "image/png", "image/webp"].includes(logo.type)) {
    const extension = logo.type === "image/png" ? "png" : logo.type === "image/webp" ? "webp" : "jpg";
    const path = `${user.id}/${claimId}/logo.${extension}`;
    const { error: uploadError } = await supabase.storage.from("founding-fifty-logos").upload(path, logo, { contentType: logo.type, upsert: true });
    if (!uploadError) {
      const { data } = supabase.storage.from("founding-fifty-logos").getPublicUrl(path);
      await supabase.from("founding_claims").update({ logo_url: data.publicUrl }).eq("id", claimId).eq("user_id", user.id);
    }
  }

  const paymentUrl = process.env.NEXT_PUBLIC_PAYPAL_PAYMENT_URL;
  if (paymentUrl) {
    const origin = await getAppOrigin();
    const checkout = await new PayPalPaymentLinkAdapter(paymentUrl).createCheckout({ claimId, amountCents: 29900, currency: "USD", returnUrl: `${origin}/founding-fifty/confirmation/${claimId}`, cancelUrl: `${origin}/founding-fifty/confirmation/${claimId}?payment=cancelled` });
    await supabase.from("founding_claims").update({ status: checkout.claimStatus, metadata: { checkout_mode: checkout.mode } }).eq("id", claimId).eq("user_id", user.id);
    redirect(checkout.redirectUrl);
  }
  redirect(`/founding-fifty/confirmation/${claimId}`);
}
