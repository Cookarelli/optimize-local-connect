import { PageHeader } from "@/src/components/ui/page-header";
import { getRoleLabel } from "@/src/domain/platform/terminology";
import { requireUser } from "@/src/lib/auth/session";

export default async function SettingsPage() {
  const user = await requireUser();
  const membership = user.memberships[0];
  return <div><PageHeader eyebrow="Workspace" title="Settings" description="Account, organization, and active platform context for this signed-in session." /><dl className="mt-8 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2"><div><dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Signed in as</dt><dd className="mt-2 text-sm font-semibold text-slate-900">{user.email}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Organization</dt><dd className="mt-2 text-sm font-semibold text-slate-900">{membership?.organizationName ?? "Platform operations"}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Role</dt><dd className="mt-2 text-sm font-semibold text-slate-900">{membership ? getRoleLabel(membership.role) : "Super Admin"}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Account ID</dt><dd className="mt-2 break-all font-mono text-xs text-slate-600">{user.id}</dd></div></dl></div>;
}
