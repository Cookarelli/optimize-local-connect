import { redirect } from "next/navigation";
import { getRoleHome } from "@/src/lib/auth/routing";
import { requireUser } from "@/src/lib/auth/session";

export default async function ResidentDashboardPage() {
  const user = await requireUser();
  const membership = user.memberships[0];
  if (!membership || membership.role !== "future_resident") redirect(getRoleHome(user));
  return <section className="mx-auto max-w-2xl py-16"><p className="text-sm font-semibold text-emerald-700">Resident access</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Your resident workspace is reserved.</h1><p className="mt-3 leading-7 text-slate-600">Resident service requests and communications will activate here when the resident portal launches.</p></section>;
}
