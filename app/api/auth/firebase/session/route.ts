import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminAuth, getPlatformFirestore } from "@/src/lib/firebase/admin";
import { FIREBASE_CSRF_COOKIE, FIREBASE_SESSION_COOKIE, FIREBASE_SESSION_DURATION_MS, isFirebaseOperationalBackend } from "@/src/lib/firebase/platform";

const schema = z.object({ idToken: z.string().min(100).max(10_000) });

function matches(left: string | undefined, right: string | undefined) {
  if (!left || !right) return false;
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export async function POST(request: Request) {
  if (!isFirebaseOperationalBackend()) return NextResponse.json({ error: "Firebase authentication is not active." }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid authentication token." }, { status: 400 });
  const cookieStore = await cookies();
  if (!matches(cookieStore.get(FIREBASE_CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) {
    return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(parsed.data.idToken, true);
    if (Math.floor(Date.now() / 1000) - decoded.auth_time > 5 * 60) {
      return NextResponse.json({ error: "Recent authentication is required." }, { status: 401 });
    }
    if (!decoded.email || decoded.email_verified !== true) {
      return NextResponse.json({ error: "Verify your email before continuing." }, { status: 403 });
    }
    const sessionCookie = await getFirebaseAdminAuth().createSessionCookie(parsed.data.idToken, { expiresIn: FIREBASE_SESSION_DURATION_MS });
    const now = Timestamp.now();
    const db = getPlatformFirestore();
    const userRef = db.doc(`users/${decoded.uid}`);
    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(userRef);
      transaction.set(userRef, {
        email: decoded.email!.toLowerCase(),
        displayName: decoded.name ?? null,
        avatarUrl: decoded.picture ?? null,
        status: "active",
        lastAuthenticatedAt: now,
        updatedAt: now,
        ...(current.exists ? {} : { createdAt: now, activeOrganizationId: null }),
      }, { merge: true });
    });
    const response = NextResponse.json({ authenticated: true });
    response.cookies.set(FIREBASE_SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: FIREBASE_SESSION_DURATION_MS / 1000,
    });
    response.cookies.delete(FIREBASE_CSRF_COOKIE);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return NextResponse.json({ error: "Authentication could not be verified." }, { status: 401 });
  }
}
