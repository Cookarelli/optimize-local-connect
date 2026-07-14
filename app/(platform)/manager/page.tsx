import { redirect } from "next/navigation";
import { PropertyOperationsDashboard } from "@/src/components/dashboard/property-operations-dashboard";
import { getRoleHome } from "@/src/lib/auth/routing";
import { requireUser } from "@/src/lib/auth/session";

export default async function ManagerDashboardPage() {
  const user = await requireUser();
  const membership = user.memberships[0];
  if (!membership || membership.role !== "property_manager" || membership.organizationType !== "property_management") redirect(getRoleHome(user));
  return <PropertyOperationsDashboard user={user} membership={membership} mode="manager" />;
}
