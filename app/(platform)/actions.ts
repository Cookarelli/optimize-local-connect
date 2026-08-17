"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { isFirebaseOperationalBackend } from "@/src/lib/firebase/platform";
import { setFirebaseActiveOrganization } from "@/src/lib/firebase/organizations";

export async function switchOrganization(formData: FormData) {
  const organizationId = z.string().min(3).max(200).safeParse(formData.get("organizationId"));
  if (!organizationId.success) return;
  const user = await requireUser();
  if (!user.memberships.some((membership) => membership.organizationId === organizationId.data)) return;
  if (isFirebaseOperationalBackend()) {
    await setFirebaseActiveOrganization(user, organizationId.data);
    redirect("/dashboard");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("user_preferences").upsert({
    user_id: user.id,
    active_organization_id: organizationId.data,
  }, { onConflict: "user_id" });
  if (error) throw new Error("Unable to switch organizations.");
  redirect("/dashboard");
}
