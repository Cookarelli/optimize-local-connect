import { UserRound } from "lucide-react";
import { EmptyState, PageHeader } from "@/src/components/ui/page-header";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

type TeamMember = { id: string; role: string; status: string; profiles: { full_name: string | null } | null };

export default async function TeamPage() {
  const user = await requireUser();
  const membership = user.memberships[0];
  const supabase = await createSupabaseServerClient();
  const { data, error } = membership ? await supabase.from("organization_members").select("id, role, status, profiles(full_name)").eq("organization_id", membership.organizationId).order("created_at") : { data: [], error: null };
  if (error) throw new Error(error.message);
  const members = (data ?? []) as unknown as TeamMember[];
  return <div><PageHeader eyebrow="Access" title="Team" description="Organization membership and role assignments. Invites are fulfilled through trusted server administration." /><div className="mt-8">{members.length ? <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{members.map((member) => <div key={member.id} className="flex items-center gap-4 border-b border-slate-100 p-5 last:border-0"><span className="grid size-10 place-items-center rounded-full bg-slate-100"><UserRound className="size-4.5 text-slate-500" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{member.profiles?.full_name ?? "Invited team member"}</p><p className="mt-0.5 text-xs capitalize text-slate-500">{member.role.replaceAll("_", " ")}</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold capitalize text-emerald-700">{member.status}</span></div>)}</div> : <EmptyState title="No team members" description="Organization members will appear here after they accept a secure invitation." />}</div></div>;
}
