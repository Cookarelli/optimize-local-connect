import { Clock3 } from "lucide-react";
import { redirect } from "next/navigation";
import { getRoleHome } from "@/src/lib/auth/routing";
import { requireUser } from "@/src/lib/auth/session";

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.isSuperAdmin || user.memberships.length) redirect(getRoleHome(user));
  return <section className="mx-auto max-w-2xl py-20 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-100"><Clock3 className="size-6 text-amber-800" /></span><h1 className="mt-6 text-3xl font-semibold tracking-tight">Your workspace is being assigned</h1><p className="mt-3 text-slate-600">Your account is active but is not attached to an organization. Ask your organization owner or a platform administrator to send an invitation.</p></section>;
}
