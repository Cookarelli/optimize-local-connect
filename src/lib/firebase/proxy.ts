import { NextResponse, type NextRequest } from "next/server";
import { safeInternalPath } from "@/src/lib/auth/routing";
import { FIREBASE_SESSION_COOKIE } from "@/src/lib/firebase/platform";

const PROTECTED_PREFIXES = ["/admin", "/accept-invite", "/dashboard", "/manager", "/onboarding", "/payments", "/properties", "/property-manager", "/requests", "/resident", "/settings", "/team", "/vendor"];
const ANONYMOUS_ONLY_PATHS = new Set(["/sign-in", "/forgot-password"]);

function secure(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

export function routeFirebaseSession(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(FIREBASE_SESSION_COOKIE)?.value);
  const path = request.nextUrl.pathname;
  const protectedRoute = PROTECTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  if (!hasSession && protectedRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/sign-in";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("next", safeInternalPath(`${path}${request.nextUrl.search}`));
    return secure(NextResponse.redirect(redirectUrl));
  }
  if (hasSession && ANONYMOUS_ONLY_PATHS.has(path)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    return secure(NextResponse.redirect(redirectUrl));
  }
  return secure(NextResponse.next({ request }));
}
