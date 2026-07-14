import { Clock3, UserRound } from "lucide-react";
import { can } from "@/src/lib/auth/authorization";
import { getInvitableRoles } from "@/src/lib/auth/invitations";
import { requireUser } from "@/src/lib/auth/session";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { InviteMemberForm } from "@/src/components/team/invite-member-form";
import { EmptyState, PageHeader } from "@/src/components/ui/page-header";

type TeamMember = { id: string; role: string; status: string; profiles: { full_name: string | null } | null };
type PendingInvitation = { id: string; email: string; role: string; expires_at: string };

export default async function TeamPage() {
  const user = await requireUser();
  const membership = user.memberships[0];
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, { data: invitationData }] = membership ? await Promise.all([
    supabase.from("organization_members").select("id, role, status, profiles(full_name)").eq("organization_id", membership.organizationId).order("created_at"),
    supabase.from("organization_invitations").select("id, email, role, expires_at").eq("organization_id", membership.organizationId).eq("status", "pending").order("created_at", { ascending: false }),
  ]) : [{ data: [], error: null }, { data: [] }];
  if (error) throw new Error(error.message);
  const members = (data ?? []) as unknown as TeamMember[];
  const invitations = (invitationData ?? []) as PendingInvitation[];
  const canInvite = membership && can(user, "members:invite", membership.organizationId);

  return <div><PageHeader eyebrow="Access" title="Team" description="Organization membership, role assignments, and secure invitations." />
    {canInvite ? <div className="mt-8"><InviteMemberForm roles={getInvitableRoles(membership.role, membership.organizationType)} /></div> : null}
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_.8fr]"><section><h2 className="mb-3 text-sm font-bold text-slate-900">Active members</h2>{members.length ? <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{members.map((member) => <div key={member.id} className="flex items-center gap-4 border-b border-slate-100 p-5 last:border-0"><span className="grid size-10 place-items-center rounded-full bg-slate-100"><UserRound className="size-4.5 text-slate-500" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{member.profiles?.full_name ?? "Team member"}</p><p className="mt-0.5 text-xs capitalize text-slate-500">{member.role.replaceAll("_", " ")}</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold capitalize text-emerald-700">{member.status}</span></div>)}</div> : <EmptyState title="No team members" description="Members appear here after accepting a secure invitation." />}</section>
    <section><h2 className="mb-3 text-sm font-bold text-slate-900">Pending invitations</h2>{invitations.length ? <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{invitations.map((invitation) => <div key={invitation.id} className="border-b border-slate-100 p-4 last:border-0"><div className="flex items-start gap-3"><Clock3 className="mt-0.5 size-4 text-amber-600" /><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{invitation.email}</p><p className="mt-1 text-xs capitalize text-slate-500">{invitation.role.replaceAll("_", " ")} · expires {new Date(invitation.expires_at).toLocaleDateString()}</p></div></div></div>)}</div> : <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">No pending invitations.</div>}</section></div>
  </div>;
}
