"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export type PasswordState = { status: "idle" | "error"; message?: string };

const passwordSchema = z.string().min(12, "Use at least 12 characters.").regex(/[a-z]/, "Add a lowercase letter.").regex(/[A-Z]/, "Add an uppercase letter.").regex(/[0-9]/, "Add a number.");

export async function updatePassword(_state: PasswordState, formData: FormData): Promise<PasswordState> {
  const password = passwordSchema.safeParse(formData.get("password"));
  if (!password.success) return { status: "error", message: password.error.issues[0]?.message };
  if (password.data !== formData.get("confirmation")) return { status: "error", message: "Passwords do not match." };

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "This recovery link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { status: "error", message: "Your password could not be updated. Request a new recovery link." };
  redirect("/dashboard?password=updated");
}
