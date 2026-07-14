"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export async function switchOrganization(formData: FormData) {
  const organizationId = z.string().uuid().safeParse(formData.get("organizationId"));
  if (!organizationId.success) return;
  const user = await requireUser();
  if (!user.memberships.some((membership) => membership.organizationId === organizationId.data)) return;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("user_preferences").upsert({
    user_id: user.id,
    active_organization_id: organizationId.data,
  }, { onConflict: "user_id" });
  if (error) throw new Error("Unable to switch organizations.");
  redirect("/dashboard");
}
