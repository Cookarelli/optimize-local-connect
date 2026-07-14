"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize } from "@/src/lib/auth/authorization";
import { getInvitableRoles } from "@/src/lib/auth/invitations";
import { getAppOrigin } from "@/src/lib/auth/origin";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export type InviteState = { status: "idle" | "error" | "success"; message?: string };

const invitationSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  role: z.enum(["owner", "admin", "property_manager", "vendor", "technician", "future_resident"]),
});

export async function inviteOrganizationMember(_state: InviteState, formData: FormData): Promise<InviteState> {
  const input = invitationSchema.safeParse({ email: formData.get("email"), role: formData.get("role") });
  if (!input.success) return { status: "error", message: input.error.issues[0]?.message };

  const user = await requireUser();
  const membership = user.memberships[0];
  if (!membership) return { status: "error", message: "Choose an organization before inviting a teammate." };
  authorize(user, "members:invite", membership.organizationId);
  if (!getInvitableRoles(membership.role, membership.organizationType).includes(input.data.role)) {
    return { status: "error", message: "You cannot assign that role." };
  }

  const rawToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const supabase = await createSupabaseServerClient();
  const { data: invitationId, error: invitationError } = await supabase.rpc("create_organization_invitation", {
    target_organization_id: membership.organizationId,
    target_email: input.data.email,
    target_role: input.data.role,
    raw_token: rawToken,
    expiration: expiresAt,
  });
  if (invitationError || !invitationId) return { status: "error", message: "The invitation could not be created." };

  const origin = await getAppOrigin();
  const next = `/accept-invite?token=${encodeURIComponent(rawToken)}`;
  let sent = false;

  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.auth.admin.inviteUserByEmail(input.data.email, {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      data: { invited_organization_id: membership.organizationId },
    });
    sent = !error;

    if (!sent) {
      const anonymous = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      });
      const { error: magicError } = await anonymous.auth.signInWithOtp({
        email: input.data.email,
        options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      sent = !magicError;
    }
  } catch {
    sent = false;
  }

  if (!sent) {
    await supabase.from("organization_invitations").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("id", invitationId);
    return { status: "error", message: "The invitation email could not be sent. Try again shortly." };
  }

  revalidatePath("/team");
  return { status: "success", message: `Invitation sent to ${input.data.email}.` };
}
