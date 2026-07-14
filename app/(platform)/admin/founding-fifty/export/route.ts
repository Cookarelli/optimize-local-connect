import { getCurrentUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

function csv(value: unknown) { return `"${String(value ?? "").replaceAll('"','""')}"`; }

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) return new Response("Not found",{status:404});
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("founding_seats").select("seat_number,status,display_business_name,reserved_business_name,display_city,vendor_id,founding_verticals(name)").order("seat_number");
  if (error) return new Response("Unable to export",{status:500});
  const rows = ["founding_number,industry,status,business_name,city,vendor_id",...(data??[]).map(row=>{const vertical=row.founding_verticals as unknown as {name:string}|null;return [row.seat_number,vertical?.name,row.status,row.display_business_name??row.reserved_business_name,row.display_city,row.vendor_id].map(csv).join(",")})];
  return new Response(rows.join("\n"),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=founding-fifty.csv","Cache-Control":"no-store"}});
}
