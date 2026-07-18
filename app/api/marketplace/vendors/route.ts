import { z } from "zod";
import { parsePublicFoundingPartnerCards } from "@/src/domain/vendor-memberships/marketplace";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const querySchema = z.object({
  q: z.string().trim().max(120).optional(), location: z.string().trim().max(160).optional(), category: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  perk: z.enum(["any","priority_response","free_estimate","discount","free_service","multi_property_pricing"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50), offset: z.coerce.number().int().min(0).default(0),
}).strict();

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "Invalid marketplace query.", details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("search_public_vendors", {
    search_query: input.q || null, location_filter: input.location ?? null, category_filter: input.category ?? null, perk_filter: input.perk ?? null,
    result_limit: input.limit, result_offset: input.offset,
  });
  if (error) return Response.json({ error: "Marketplace search is unavailable." }, { status: 500 });
  const vendors = parsePublicFoundingPartnerCards(data);
  return Response.json({ vendors, total: vendors[0]?.total_count ?? 0, limit: input.limit, offset: input.offset }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
}
