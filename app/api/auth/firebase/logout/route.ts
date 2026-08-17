import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { FIREBASE_CSRF_COOKIE, FIREBASE_SESSION_COOKIE, isFirebaseOperationalBackend } from "@/src/lib/firebase/platform";

export async function POST(request: Request) {
  if (!isFirebaseOperationalBackend()) return NextResponse.json({ error: "Firebase authentication is not active." }, { status: 404 });
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(FIREBASE_CSRF_COOKIE)?.value;
  const headerToken = request.headers.get("x-csrf-token") ?? undefined;
  const valid = cookieToken && headerToken && Buffer.byteLength(cookieToken) === Buffer.byteLength(headerToken)
    && timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));
  if (!valid) return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  const response = NextResponse.json({ authenticated: false });
  response.cookies.delete(FIREBASE_SESSION_COOKIE);
  response.cookies.delete(FIREBASE_CSRF_COOKIE);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
