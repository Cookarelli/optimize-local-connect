import { headers } from "next/headers";

export async function getAppOrigin() {
  if (process.env.NEXT_PUBLIC_APP_URL) return new URL(process.env.NEXT_PUBLIC_APP_URL).origin;

  // Checkout and portal redirects must not be derived from a production Host
  // header. Local development keeps the request-derived fallback for previewing.
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_APP_URL is required in production.");
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) throw new Error("Application origin is not configured.");
  const protocol = requestHeaders.get("x-forwarded-proto") === "http" ? "http" : "https";
  return `${protocol}://${host}`;
}
