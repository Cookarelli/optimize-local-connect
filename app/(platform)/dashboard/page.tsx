import { redirect } from "next/navigation";
import { getRoleHome } from "@/src/lib/auth/routing";
import { requireUser } from "@/src/lib/auth/session";

export default async function DashboardPage() {
  redirect(getRoleHome(await requireUser()));
}
