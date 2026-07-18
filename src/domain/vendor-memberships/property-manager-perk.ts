import { z } from "zod";
import { canUsePropertyManagerPerk as membershipCanUsePerk } from "@/src/domain/vendor-memberships/entitlements";

export const PROPERTY_MANAGER_PERK_TYPES = [
  "priority_response",
  "free_estimate",
  "discount",
  "free_service",
  "multi_property_pricing",
  "custom",
] as const;

export type PropertyManagerPerkType = (typeof PROPERTY_MANAGER_PERK_TYPES)[number];

const plainText = (maximum: number) => z.string().trim().max(maximum).refine(
  value => !/[<>]/.test(value) && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value),
  "Use plain text without HTML or control characters.",
);

const prohibitedClaim = /\b(guaranteed (?:leads?|revenue|results?|savings)|officially endorsed by optimize local|best (?:vendor|contractor|company) in)\b/i;

export const propertyManagerPerkSchema = z.object({
  enabled: z.boolean(),
  title: plainText(80),
  description: plainText(280),
  type: z.enum(PROPERTY_MANAGER_PERK_TYPES),
  terms: plainText(500),
  expirationDate: z.union([z.literal(""), z.iso.date()]),
}).superRefine((value, context) => {
  if (value.enabled && value.title.length < 3) context.addIssue({ code: "custom", path: ["title"], message: "Add a short perk title before enabling it." });
  if (value.enabled && value.description.length < 10) context.addIssue({ code: "custom", path: ["description"], message: "Describe what property managers receive." });
  for (const field of ["title", "description", "terms"] as const) {
    if (prohibitedClaim.test(value[field])) context.addIssue({ code: "custom", path: [field], message: "Remove guaranteed or misleading claims." });
  }
});

export type PropertyManagerPerk = z.output<typeof propertyManagerPerkSchema>;

export function canUsePropertyManagerPerk(code: string | null | undefined, status = "active") {
  return membershipCanUsePerk({ code, status });
}

export function canDisplayPropertyManagerPerk(input: PropertyManagerPerk, membershipCode: string, membershipStatus = "active", today = new Date()) {
  if (!canUsePropertyManagerPerk(membershipCode, membershipStatus) || !input.enabled || !input.title || !input.description) return false;
  return !input.expirationDate || input.expirationDate >= today.toISOString().slice(0, 10);
}

const GENERIC = [
  ["Free estimates", "free_estimate"],
  ["Priority scheduling", "priority_response"],
  ["Multi-property pricing", "multi_property_pricing"],
] as const;

const SUGGESTIONS: Record<string, readonly (readonly [string, PropertyManagerPerkType])[]> = {
  appliance: [["Free diagnostic with completed repair", "free_service"], ["Discounted multi-unit service", "multi_property_pricing"], ["Priority appliance replacement", "priority_response"], ["Parts at cost", "discount"]],
  landscaping: [["Free first property assessment", "free_service"], ["Priority storm cleanup", "priority_response"], ["Multi-property lawn discount", "multi_property_pricing"], ["48-hour quote turnaround", "priority_response"]],
  plumbing: [["No dispatch fee with approved repair", "free_service"], ["Priority emergency response", "priority_response"], ["Free multi-property inspection", "free_service"], ["Discounted preventative maintenance", "discount"]],
  hvac: [["Priority no-heat/no-cooling response", "priority_response"], ["Free filter replacement with service", "free_service"], ["Multi-unit maintenance pricing", "multi_property_pricing"], ["Free system assessment", "free_estimate"]],
  electrical: [["Free initial safety assessment", "free_estimate"], ["Priority emergency scheduling", "priority_response"], ["Multi-property pricing", "multi_property_pricing"], ["No trip charge with completed work", "free_service"]],
  cleaning: [["Discounted turnover packages", "discount"], ["Free inspection", "free_estimate"], ["Priority move-out scheduling", "priority_response"], ["Multi-unit pricing", "multi_property_pricing"]],
  flooring: [["Free measurements", "free_estimate"], ["Property-manager material pricing", "discount"], ["Priority turnover installation", "priority_response"], ["Discounted multi-unit projects", "multi_property_pricing"]],
};

export function propertyManagerPerkSuggestions(category: string | null | undefined) {
  const normalized = (category ?? "").toLowerCase();
  const key = Object.keys(SUGGESTIONS).find(item => normalized.includes(item));
  return (key ? SUGGESTIONS[key] : GENERIC).map(([title, type]) => ({ title, type }));
}

export function propertyManagerPerkFromFormData(formData: FormData) {
  return propertyManagerPerkSchema.safeParse({
    enabled: formData.get("propertyManagerPerkEnabled") === "on",
    title: formData.get("propertyManagerPerkTitle")?.toString() ?? "",
    description: formData.get("propertyManagerPerkDescription")?.toString() ?? "",
    type: formData.get("propertyManagerPerkType")?.toString() ?? "custom",
    terms: formData.get("propertyManagerPerkTerms")?.toString() ?? "",
    expirationDate: formData.get("propertyManagerPerkExpirationDate")?.toString() ?? "",
  });
}
