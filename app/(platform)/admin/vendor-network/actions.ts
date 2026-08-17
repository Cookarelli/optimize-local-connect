"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/session";
import { reviewFirebaseVendorProfile } from "@/src/lib/firebase/vendor-profiles";

const schema=z.object({organizationId:z.string().min(3).max(200),action:z.enum(["approve","request_changes","publish","unpublish","suspend","reactivate"]),note:z.string().trim().max(1000).optional()});
export async function manageFirebaseVendorNetwork(formData:FormData){
  const user=await requireUser();const input=schema.parse({organizationId:formData.get("organizationId"),action:formData.get("action"),note:formData.get("note")||undefined});
  await reviewFirebaseVendorProfile({user,...input});
  revalidatePath("/admin/vendor-network");revalidatePath("/marketplace");revalidatePath(`/vendor/profile`);
}
