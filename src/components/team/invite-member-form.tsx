"use client";

import { useActionState } from "react";
import { LoaderCircle, UserPlus } from "lucide-react";
import { inviteOrganizationMember, type InviteState } from "@/app/(platform)/team/actions";
import type { Role } from "@/src/domain/auth/roles";
import { Button } from "@/src/components/ui/button";

const initialState: InviteState = { status: "idle" };

export function InviteMemberForm({ roles }: { roles: Role[] }) {
  const [state, action, pending] = useActionState(inviteOrganizationMember, initialState);
  return <form action={action} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-emerald-50"><UserPlus className="size-5 text-emerald-700" /></span><div><h2 className="font-bold text-slate-950">Invite a teammate</h2><p className="text-sm text-slate-500">Links expire after seven days and are bound to the invited email.</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-[1fr_12rem_auto]"><div><label htmlFor="invite-email" className="mb-1.5 block text-sm font-medium text-slate-700">Email</label><input id="invite-email" name="email" type="email" required autoComplete="email" placeholder="teammate@company.com" className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /></div><div><label htmlFor="invite-role" className="mb-1.5 block text-sm font-medium text-slate-700">Role</label><select id="invite-role" name="role" className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-600">{roles.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}</select></div><Button type="submit" className="self-end" disabled={pending}>{pending ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : null}Send invite</Button></div>{state.message ? <p role="status" className={state.status === "success" ? "mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" : "mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800"}>{state.message}</p> : null}</form>;
}
