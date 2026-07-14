"use server";

import { z } from "zod";
import { getAppOrigin } from "@/src/lib/auth/origin";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export type RecoveryState = { status: "idle" | "error" | "success"; message?: string };

export async function requestPasswordReset(_state: RecoveryState, formData: FormData): Promise<RecoveryState> {
  const email = z.string().trim().email("Enter a valid email address.").safeParse(formData.get("email"));
  if (!email.success) return { status: "error", message: email.error.issues[0]?.message };

  try {
    const origin = await getAppOrigin();
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resetPasswordForEmail(email.data, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });
  } catch {
    // Return the same response to avoid disclosing whether an account exists.
  }

  return { status: "success", message: "If an account exists for that email, a reset link is on its way." };
}
