"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getAppOrigin } from "@/src/lib/auth/origin";
import { safeInternalPath } from "@/src/lib/auth/routing";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export type AuthState = {
  status: "idle" | "error" | "success";
  message?: string;
};

const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid work email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const emailSchema = z.string().trim().email("Enter a valid work email.");

export async function signInWithPassword(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const input = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const next = safeInternalPath(formData.get("next")?.toString());

  if (!input.success) {
    return { status: "error", message: input.error.issues[0]?.message };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword(input.data);
    if (error) return { status: "error", message: "Email or password is incorrect." };
  } catch {
    return { status: "error", message: "Sign-in is not configured yet. Add the Supabase environment values." };
  }

  redirect(next);
}

export async function sendMagicLink(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { status: "error", message: email.error.issues[0]?.message };

  try {
    const origin = await getAppOrigin();
    const next = safeInternalPath(formData.get("next")?.toString());
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.data,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) return { status: "error", message: "We could not send the sign-in link." };
  } catch {
    return { status: "error", message: "Sign-in is not configured yet. Add the Supabase environment values." };
  }

  return { status: "success", message: "Check your inbox for a secure sign-in link." };
}

export async function signInWithGoogle(formData: FormData) {
  const origin = await getAppOrigin();
  const next = safeInternalPath(formData.get("next")?.toString());
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data.url) redirect("/sign-in?error=oauth_start_failed");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
