"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

async function requireSuperAdmin() {
  const user = await requireUser();
  if (!user.isSuperAdmin) throw new Error("Super Admin access required.");
  return { user, supabase: await createSupabaseServerClient() };
}

const seatActionSchema = z.object({ seatId: z.string().uuid(), action: z.enum(["reserve","release","disable","enable","reject_claim"]), businessName: z.string().trim().max(160).optional(), claimId: z.string().uuid().optional() });

export async function updateFoundingSeat(formData: FormData) {
  const { supabase } = await requireSuperAdmin();
  const input = seatActionSchema.parse({ seatId: formData.get("seatId"), action: formData.get("action"), businessName: formData.get("businessName") || undefined, claimId: formData.get("claimId") || undefined });
  if (input.action === "reserve" && !input.businessName) throw new Error("A business name is required to reserve a seat.");
  const { error } = await supabase.rpc("admin_update_founding_seat", { target_seat_id: input.seatId, target_action: input.action, target_business_name: input.businessName ?? null, target_claim_id: input.claimId ?? null });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/founding-fifty"); revalidatePath("/founding-fifty");
}

export async function approveFoundingPayment(formData: FormData) {
  const { supabase } = await requireSuperAdmin();
  const input = z.object({ claimId: z.string().uuid(), paymentReference: z.string().trim().min(3).max(200) }).parse({ claimId: formData.get("claimId"), paymentReference: formData.get("paymentReference") });
  const { error } = await supabase.rpc("confirm_founding_claim", { target_claim_id: input.claimId, target_payment_reference: input.paymentReference, confirmation_source: "manual_admin" });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/founding-fifty"); revalidatePath("/founding-fifty");
}

export async function editFoundingDisplay(formData: FormData) {
  const { user, supabase } = await requireSuperAdmin();
  const input = z.object({ seatId: z.string().uuid(), businessName: z.string().trim().min(2).max(160), city: z.string().trim().max(160), logoUrl: z.union([z.literal(""),z.string().url()]) }).parse({ seatId: formData.get("seatId"), businessName: formData.get("businessName"), city: formData.get("city"), logoUrl: formData.get("logoUrl") });
  let logoUrl = input.logoUrl || null;
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > 5_000_000 || !["image/jpeg","image/png","image/webp"].includes(logo.type)) throw new Error("Logo must be a JPG, PNG, or WebP under 5 MB.");
    const extension = logo.type === "image/png" ? "png" : logo.type === "image/webp" ? "webp" : "jpg";
    const path = `${user.id}/admin/${input.seatId}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("founding-fifty-logos").upload(path,logo,{contentType:logo.type,upsert:true});
    if (uploadError) throw new Error("Unable to upload the logo.");
    logoUrl = supabase.storage.from("founding-fifty-logos").getPublicUrl(path).data.publicUrl;
  }
  const { error } = await supabase.from("founding_seats").update({ display_business_name: input.businessName, display_city: input.city || null, logo_url: logoUrl }).eq("id", input.seatId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/founding-fifty"); revalidatePath("/founding-fifty");
}

export async function editReservedBusiness(formData: FormData) {
  const { supabase } = await requireSuperAdmin();
  const input = z.object({ seatId: z.string().uuid(), businessName: z.string().trim().min(2).max(160) }).parse({ seatId: formData.get("seatId"), businessName: formData.get("businessName") });
  const { error } = await supabase.from("founding_seats").update({ reserved_business_name: input.businessName }).eq("id",input.seatId).eq("status","reserved");
  if (error) throw new Error(error.message);
  revalidatePath("/admin/founding-fifty"); revalidatePath("/founding-fifty");
}

export async function reassignFoundingSeat(formData: FormData) {
  const { supabase } = await requireSuperAdmin();
  const input = z.object({ seatId: z.string().uuid(), vendorId: z.string().uuid(), confirmationPhrase: z.literal("REASSIGN PERMANENT FOUNDING NUMBER") }).parse({ seatId: formData.get("seatId"), vendorId: formData.get("vendorId"), confirmationPhrase: formData.get("confirmationPhrase") });
  const { error } = await supabase.rpc("admin_reassign_founding_seat", { target_seat_id: input.seatId, target_vendor_id: input.vendorId, confirmation_phrase: input.confirmationPhrase });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/founding-fifty"); revalidatePath("/founding-fifty");
}

export async function resendFoundingConfirmation(formData: FormData) {
  const { user, supabase } = await requireSuperAdmin();
  const claimId = z.string().uuid().parse(formData.get("claimId"));
  const { data: claim } = await supabase.from("founding_claims").select("id,email,vendor_id,status").eq("id",claimId).single();
  if (!claim || claim.status !== "confirmed") throw new Error("Only confirmed claims can receive a confirmation email.");
  const { error } = await supabase.from("outbox_events").insert({ organization_id: claim.vendor_id, topic: "founding_fifty.confirmation_resend", payload: { claim_id: claim.id, email: claim.email, requested_by: user.id } });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/founding-fifty");
}
