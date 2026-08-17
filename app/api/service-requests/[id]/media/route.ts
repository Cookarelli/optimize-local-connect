import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/src/lib/auth/session";
import { FIREBASE_CSRF_COOKIE, isFirebaseOperationalBackend } from "@/src/lib/firebase/platform";
import { finalizeFirebaseRequestMediaUpload, reserveFirebaseRequestMediaUpload } from "@/src/lib/firebase/storage";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reserve"), assetId: z.string().min(16).max(100) }),
  z.object({ action: z.literal("finalize"), path: z.string().min(20).max(1000) }),
]);
function matches(left?: string, right?: string) { if (!left || !right) return false; const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isFirebaseOperationalBackend()) return NextResponse.json({ error: "Firebase request media is not active." }, { status: 404 });
  const cookieStore = await cookies();
  if (!matches(cookieStore.get(FIREBASE_CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid media request." }, { status: 400 });
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    const result = parsed.data.action === "reserve"
      ? { path: await reserveFirebaseRequestMediaUpload({ user, requestId: id, assetId: parsed.data.assetId }) }
      : await finalizeFirebaseRequestMediaUpload({ user, requestId: id, path: parsed.data.path });
    return NextResponse.json(result);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Request media could not be prepared." }, { status: 400 }); }
}
