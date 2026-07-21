"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CONTACT_STAGES, MEMBERSHIP_TARGETS, SALES_STAGES } from "@/src/domain/vendor-pipeline/catalog";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

const blankToNull = (value: FormDataEntryValue | null) => { const clean = value?.toString().trim(); return clean || null; };
const dateToIso = (value: FormDataEntryValue | null) => {
  const clean = blankToNull(value);
  if (!clean) return null;
  const date = new Date(clean);
  return Number.isNaN(date.valueOf()) ? clean : date.toISOString();
};
const prospectSchema = z.object({
  businessName: z.string().trim().min(2).max(180), contactName: z.string().trim().max(160).nullable(), phone: z.string().trim().max(50).nullable(), email: z.string().trim().email().max(254).nullable(), website: z.string().trim().url().max(500).nullable(), city: z.string().trim().max(120).nullable(), industry: z.string().trim().max(120).nullable(),
  googleRating: z.coerce.number().min(0).max(5).nullable(), googleReviewCount: z.coerce.number().int().min(0).max(10_000_000).nullable(), membershipTarget: z.enum(MEMBERSHIP_TARGETS), salesStage: z.enum(SALES_STAGES), lastContactAt: z.string().datetime().nullable(), nextFollowUpAt: z.string().datetime().nullable(), notes: z.string().trim().max(5000).nullable(),
});
const returnPath = "/admin/vendor-pipeline";

function parseProspect(formData: FormData) {
  return prospectSchema.parse({ businessName: blankToNull(formData.get("businessName")), contactName: blankToNull(formData.get("contactName")), phone: blankToNull(formData.get("phone")), email: blankToNull(formData.get("email")), website: blankToNull(formData.get("website")), city: blankToNull(formData.get("city")), industry: blankToNull(formData.get("industry")), googleRating: blankToNull(formData.get("googleRating")), googleReviewCount: blankToNull(formData.get("googleReviewCount")), membershipTarget: formData.get("membershipTarget"), salesStage: formData.get("salesStage"), lastContactAt: dateToIso(formData.get("lastContactAt")), nextFollowUpAt: dateToIso(formData.get("nextFollowUpAt")), notes: blankToNull(formData.get("notes")) });
}
async function requirePipelineAdmin() { const user = await requireUser(); if (!user.isSuperAdmin) throw new Error("Super Admin access required."); return user; }
function values(input: z.infer<typeof prospectSchema>) { return { business_name: input.businessName, contact_name: input.contactName, phone: input.phone, email: input.email, website: input.website, city: input.city, industry: input.industry, google_rating: input.googleRating, google_review_count: input.googleReviewCount, membership_target: input.membershipTarget, sales_stage: input.salesStage, last_contact_at: input.lastContactAt, next_follow_up_at: input.nextFollowUpAt, notes: input.notes }; }

export async function createVendorProspect(formData: FormData) {
  await requirePipelineAdmin(); const input = parseProspect(formData); const { error } = await createSupabaseAdminClient().from("vendor_prospects").insert(values(input));
  if (error) throw new Error("Unable to create vendor prospect."); revalidatePath(returnPath); redirect(`${returnPath}?result=created`);
}
export async function updateVendorProspect(formData: FormData) {
  await requirePipelineAdmin(); const id = z.string().uuid().parse(formData.get("id")); const input = parseProspect(formData); const { error } = await createSupabaseAdminClient().from("vendor_prospects").update(values(input)).eq("id", id);
  if (error) throw new Error("Unable to update vendor prospect."); revalidatePath(returnPath); redirect(`${returnPath}?result=updated`);
}
export async function setVendorProspectStage(formData: FormData) {
  await requirePipelineAdmin(); const id = z.string().uuid().parse(formData.get("id")); const stage = z.enum(CONTACT_STAGES).parse(formData.get("stage")); const { error } = await createSupabaseAdminClient().from("vendor_prospects").update({ sales_stage: stage, last_contact_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error("Unable to update vendor prospect stage."); revalidatePath(returnPath); redirect(`${returnPath}?result=stage_updated`);
}
