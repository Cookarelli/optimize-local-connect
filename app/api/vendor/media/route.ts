import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/src/lib/auth/session";
import { FIREBASE_CSRF_COOKIE, isFirebaseOperationalBackend } from "@/src/lib/firebase/platform";
import { registerFirebaseVendorDraftMedia } from "@/src/lib/firebase/storage";

const schema = z.object({ organizationId: z.string().min(3).max(200), assetKind: z.enum(["logo", "featured"]), draftPath: z.string().min(10).max(1000) });
function matches(left?: string, right?: string) { if (!left || !right) return false; const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }

export async function POST(request: Request) {
  if (!isFirebaseOperationalBackend()) return NextResponse.json({ error: "Firebase media is not active." }, { status: 404 });
  const cookieStore = await cookies();
  if (!matches(cookieStore.get(FIREBASE_CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid media registration." }, { status: 400 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try { await registerFirebaseVendorDraftMedia({ user, ...parsed.data }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Media could not be registered." }, { status: 400 }); }
  return NextResponse.json({ registered: true });
}
