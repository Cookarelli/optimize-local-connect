import { createHash } from "node:crypto";

export const FIREBASE_SESSION_COOKIE = "olc_session";
export const FIREBASE_CSRF_COOKIE = "olc_csrf";
export const FIREBASE_SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

export function isFirebaseOperationalBackend(env: NodeJS.ProcessEnv = process.env) {
  return env.OPERATIONAL_BACKEND === "firebase" || env.NEXT_PUBLIC_OPERATIONAL_BACKEND === "firebase";
}
export function normalizedText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function slugify(value: string) {
  return normalizedText(value).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
}

export function stableDigest(value: string, length = 32) {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

export function organizationMembershipId(organizationId: string, userId: string) {
  return `${organizationId}:${userId}`;
}

export function pendingCommercialMembershipId(organizationId: string, tier: string) {
  return `membership_${stableDigest(`${organizationId}|${tier}`)}`;
}

export function vendorOrganizationId(userId: string, businessName: string) {
  return `org_${stableDigest(`${userId}|${normalizedText(businessName).toLowerCase()}`)}`;
}

export function normalizeServiceArea(value: string) {
  return normalizedText(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function normalizeSearchTokens(values: readonly string[]) {
  const tokens = new Set<string>();
  for (const value of values) {
    const words = normalizedText(value).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
    for (const word of words) {
      for (let length = 2; length <= Math.min(word.length, 20); length += 1) tokens.add(word.slice(0, length));
    }
  }
  return [...tokens].sort().slice(0, 300);
}

export function matchingKeys(categorySlugs: readonly string[], serviceAreaKeys: readonly string[]) {
  return categorySlugs.flatMap((category) => serviceAreaKeys.map((area) => `${category}|${area}`)).sort();
}
