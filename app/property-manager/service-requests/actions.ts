"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/src/lib/auth/authorization";
import { requireUser } from "@/src/lib/auth/session";
import { isFirebaseOperationalBackend } from "@/src/lib/firebase/platform";
import { submitFirebaseServiceRequest } from "@/src/lib/firebase/service-requests";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const formSchema=z.object({organizationId:z.string().min(3).max(200),propertyId:z.string().min(3).max(200),vendorCategoryId:z.string().min(2).max(200),categoryName:z.string().trim().min(2).max(160).optional(),unit:z.string().trim().max(80).optional(),address:z.string().trim().min(4).max(300).optional(),problemDescription:z.string().trim().min(10).max(5000),priority:z.enum(["emergency","today","this_week","flexible"]),preferredContact:z.enum(["phone","email"]),contactName:z.string().trim().min(2).max(160).optional(),phone:z.string().trim().max(50).optional(),email:z.string().trim().email().optional(),accessInstructions:z.string().trim().max(1000).optional(),photoPlaceholder:z.string().optional()});

export async function createPropertyManagerServiceRequest(formData:FormData){
  const user=await requireUser();
  const input=formSchema.parse({organizationId:formData.get("organizationId"),propertyId:formData.get("propertyId"),vendorCategoryId:formData.get("vendorCategoryId"),categoryName:formData.get("categoryName")||undefined,unit:formData.get("unit")||undefined,address:formData.get("address")||undefined,problemDescription:formData.get("problemDescription"),priority:formData.get("priority"),preferredContact:formData.get("preferredContact"),contactName:formData.get("contactName")||undefined,phone:formData.get("phone")||undefined,email:formData.get("email")||undefined,accessInstructions:formData.get("accessInstructions")||undefined,photoPlaceholder:formData.get("photoPlaceholder")||undefined});
  authorize(user,"service_requests:create",input.organizationId);
  if(input.preferredContact==="phone"&&!input.phone)throw new Error("Phone is required when phone is preferred.");
  if(input.preferredContact==="email"&&!input.email)throw new Error("Email is required when email is preferred.");
  if(isFirebaseOperationalBackend()){
    await submitFirebaseServiceRequest({user,organizationId:input.organizationId,propertyId:input.propertyId,categorySlug:input.vendorCategoryId,categoryName:input.categoryName??input.vendorCategoryId,problemDescription:input.problemDescription,priority:input.priority,contactPreference:input.preferredContact,unit:input.unit,contactName:input.contactName??user.fullName??"Property contact",contactPhone:input.phone,contactEmail:input.email,accessInstructions:input.accessInstructions});
    redirect("/property-manager/service-requests?created=1");
  }
  const supabase=await createSupabaseServerClient();
  const {data:property}=await supabase.from("properties").select("id").eq("id",input.propertyId).eq("organization_id",input.organizationId).single();
  if(!property)throw new Error("Property is unavailable.");
  const {data,error}=await supabase.from("property_manager_service_requests").insert({organization_id:input.organizationId,property_id:input.propertyId,vendor_category_id:input.vendorCategoryId,requested_by:user.id,unit:input.unit??null,address:input.address??"See property record",problem_description:input.problemDescription,priority:input.priority,preferred_contact:input.preferredContact,contact_phone:input.phone??null,contact_email:input.email??null,photo_upload_requested:Boolean(input.photoPlaceholder),status:"submitted",submitted_at:new Date().toISOString()}).select("id").single();
  if(error)throw new Error("Unable to create service request.");
  await supabase.from("property_manager_service_request_history").insert({request_id:data.id,actor_user_id:user.id,status:"submitted",note:"Request submitted"});
  redirect("/property-manager/service-requests?created=1");
}
