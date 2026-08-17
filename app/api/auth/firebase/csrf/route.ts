import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { FIREBASE_CSRF_COOKIE, isFirebaseOperationalBackend } from "@/src/lib/firebase/platform";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isFirebaseOperationalBackend()) return NextResponse.json({ error: "Firebase authentication is not active." }, { status: 404 });
  const token = randomBytes(32).toString("base64url");
  const response = NextResponse.json({ token });
  response.cookies.set(FIREBASE_CSRF_COOKIE, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 10 * 60,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
