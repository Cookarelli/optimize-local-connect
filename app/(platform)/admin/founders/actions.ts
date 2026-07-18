"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const actionSchema = z.object({
  onboardingId: z.string().uuid(),
  action: z.enum(["save_notes", "start_review", "approve", "request_changes", "reject", "activate", "suspend"]),
  notes: z.string().trim().max(4000).optional(),
  returnTo: z.string().regex(/^\/admin\/founders(?:\/[0-9a-f-]{36})?$/i),
});

export async function manageFounder(formData: FormData) {
  const user = await requireUser();
  if (!user.isSuperAdmin) throw new Error("Super Admin access required.");
  const input = actionSchema.parse({
    onboardingId: formData.get("onboardingId"),
    action: formData.get("action"),
    notes: formData.get("notes")?.toString() || undefined,
    returnTo: formData.get("returnTo"),
  });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_manage_founding_partner", {
    target_onboarding_id: input.onboardingId,
    target_action: input.action,
    target_notes: input.notes ?? null,
  });
  revalidatePath("/admin/founders");
  revalidatePath(`/admin/founders/${input.onboardingId}`);
  revalidatePath("/marketplace");
  if (error) redirect(`${input.returnTo}?result=error`);
  redirect(`${input.returnTo}?result=updated`);
}
