"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

const sessionSchema = z.string().regex(/^cs_[A-Za-z0-9_]+$/);

export async function claimGuestFoundingMembership(formData: FormData) {
  const sessionId = sessionSchema.safeParse(formData.get("session_id"));
  if (!sessionId.success) redirect("/membership/claim?error=invalid_session");
  const user = await requireUser();
  const { error } = await createSupabaseAdminClient().rpc("claim_guest_founding_vendor_membership", {
    target_checkout_session_id: sessionId.data, target_user_id: user.id, target_user_email: user.email,
  });
  if (error) redirect(`/membership/claim?session_id=${encodeURIComponent(sessionId.data)}&error=claim_unavailable`);
  redirect("/vendor");
}
