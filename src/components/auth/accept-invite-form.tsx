"use client";

import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";
import { acceptInvitation, type AcceptInviteState } from "@/app/(platform)/accept-invite/actions";
import { Button } from "@/src/components/ui/button";

const initialState: AcceptInviteState = { status: "idle" };

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvitation, initialState);
  return <form action={action} className="mt-7"><input type="hidden" name="token" value={token} /><Button type="submit" className="w-full" disabled={pending}>{pending ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : null}Join organization</Button>{state.message ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{state.message}</p> : null}</form>;
}
