import { z } from "zod";
import { parseMarketplaceVendors } from "@/src/domain/vendor-memberships/marketplace";
import { getCurrentUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const querySchema = z.object({
  q: z.string().trim().max(120).optional(), city: z.string().uuid().optional(), category: z.string().uuid().optional(),
  verified: z.enum(["true","false"]).optional(), premium: z.enum(["true","false"]).optional(), emergency: z.enum(["true","false"]).optional(),
  licensed: z.enum(["true","false"]).optional(), insured: z.enum(["true","false"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50), offset: z.coerce.number().int().min(0).default(0),
}).strict();

export async function GET(request: Request) {
  if (!await getCurrentUser()) return Response.json({ error: "Authentication required." }, { status: 401 });
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "Invalid marketplace query.", details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("search_vendor_marketplace", {
    search_query: input.q || null, city_filter: input.city ?? null, category_filter: input.category ?? null,
    verified_only: input.verified === "true", premium_only: input.premium === "true", emergency_only: input.emergency === "true",
    licensed_only: input.licensed === "true", insured_only: input.insured === "true", result_limit: input.limit, result_offset: input.offset,
  });
  if (error) return Response.json({ error: "Marketplace search is unavailable." }, { status: 500 });
  const vendors = parseMarketplaceVendors(data);
  return Response.json({ vendors, total: vendors[0]?.total_count ?? 0, limit: input.limit, offset: input.offset }, { headers: { "Cache-Control": "private, max-age=30" } });
}
