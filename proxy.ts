import type { NextRequest } from "next/server";
import { refreshAuthSession } from "@/src/lib/supabase/proxy";
import { routeFirebaseSession } from "@/src/lib/firebase/proxy";

export async function proxy(request: NextRequest) {
  if (process.env.OPERATIONAL_BACKEND === "firebase" || process.env.NEXT_PUBLIC_OPERATIONAL_BACKEND === "firebase") return routeFirebaseSession(request);
  return refreshAuthSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
