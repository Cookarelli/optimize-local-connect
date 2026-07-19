import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

const sessionSchema = z.string().regex(/^cs_[A-Za-z0-9_]+$/);

export async function GET(request: Request) {
  const sessionId = sessionSchema.safeParse(new URL(request.url).searchParams.get("session_id"));
  if (!sessionId.success) return NextResponse.json({ status: "invalid" }, { status: 400 });
  const { data, error } = await createSupabaseAdminClient().rpc("get_guest_founding_vendor_claim_status", { target_checkout_session_id: sessionId.data });
  if (error) return NextResponse.json({ status: "unavailable" }, { status: 500 });
  return NextResponse.json({ status: data ?? "not_found" }, { headers: { "Cache-Control": "no-store" } });
}
