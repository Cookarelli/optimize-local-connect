import { VENDOR_MEMBERSHIP_PLANS } from "@/src/domain/vendor-memberships/catalog";
import { getCurrentUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const membership = user.memberships[0];
  const supabase = await createSupabaseServerClient();
  const current = membership?.organizationType === "vendor"
    ? await supabase.from("vendor_memberships").select("id,status,starts_at,current_period_ends_at,locked_renewal_price_cents,entitlements_snapshot,vendor_membership_levels(code,name)").eq("vendor_organization_id",membership.organizationId).in("status",["trialing","active","past_due","paused"]).order("starts_at",{ascending:false}).limit(1).maybeSingle()
    : { data: null, error: null };
  if (current.error) return Response.json({ error: "Membership could not be loaded." }, { status: 500 });
  return Response.json({ plans: VENDOR_MEMBERSHIP_PLANS, current: current.data }, { headers: { "Cache-Control": "private, no-store" } });
}
