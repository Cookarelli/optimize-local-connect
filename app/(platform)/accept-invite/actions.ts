"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export type AcceptInviteState = { status: "idle" | "error"; message?: string };

export async function acceptInvitation(_state: AcceptInviteState, formData: FormData): Promise<AcceptInviteState> {
  const token = z.string().min(60).max(100).safeParse(formData.get("token"));
  if (!token.success) return { status: "error", message: "This invitation link is invalid." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("accept_organization_invitation", { raw_token: token.data });
  if (error) return { status: "error", message: "This invitation is expired, already used, or belongs to another email." };
  redirect("/dashboard?invitation=accepted");
}
