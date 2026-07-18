"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

const schema=z.object({businessName:z.string().trim().min(2).max(160),description:z.string().trim().min(40).max(2000),publicEmail:z.string().trim().email(),phone:z.string().trim().min(7).max(30),website:z.union([z.literal(""),z.string().url()]),primaryCategory:z.string().trim().min(2).max(120),services:z.string().transform(v=>v.split("\n").map(x=>x.trim()).filter(Boolean)).pipe(z.array(z.string().min(2).max(160)).min(1).max(30)),serviceAreas:z.string().transform(v=>v.split("\n").map(x=>x.trim()).filter(Boolean)).pipe(z.array(z.string().regex(/^.+,\s*[A-Za-z]{2}$/)).min(1).max(50)),publicDisplayConsent:z.literal("on")});
export async function saveVendorProfile(formData:FormData){
  const user=await requireUser();const org=user.memberships.find(x=>x.organizationType==="vendor"&&["owner","admin"].includes(x.role));if(!org)redirect("/vendor/profile?result=unauthorized");
  const parsed=schema.safeParse(Object.fromEntries(formData));if(!parsed.success)redirect("/vendor/profile?result=invalid");
  const admin=createSupabaseAdminClient();const {error}=await admin.rpc("save_vendor_profile_onboarding",{target_vendor_organization_id:org.organizationId,target_user_id:user.id,target_payload:{business_name:parsed.data.businessName,description:parsed.data.description,public_email:parsed.data.publicEmail,phone:parsed.data.phone,website_url:parsed.data.website,primary_category:parsed.data.primaryCategory,services:parsed.data.services,service_areas:parsed.data.serviceAreas,public_display_consent:true}});
  if(error)redirect("/vendor/profile?result=error");revalidatePath("/vendor");revalidatePath("/vendor/profile");revalidatePath("/marketplace");redirect("/vendor/profile?result=saved");
}
