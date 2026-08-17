import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, Store } from "lucide-react";
import { requireUser } from "@/src/lib/auth/session";
import { isFirebaseOperationalBackend } from "@/src/lib/firebase/platform";
import { getFirebaseServiceRequestForPm } from "@/src/lib/firebase/service-requests";

export default async function PropertyManagerServiceRequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const membership = user.memberships.find((item) => item.organizationType === "property_management");
  if (!membership || !isFirebaseOperationalBackend()) notFound();
  const { id } = await params;
  const result = await getFirebaseServiceRequestForPm(user, membership.organizationId, id);
  if (!result) notFound();
  return <div className="mx-auto max-w-5xl p-5 sm:p-8">
    <Link href="/property-manager/service-requests" className="inline-flex items-center text-sm font-bold text-slate-500"><ArrowLeft className="mr-2 size-4"/>All requests</Link>
    <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-emerald-700">{result.request.propertyName}</p><h1 className="mt-1 text-4xl font-semibold">{result.request.categoryName}</h1></div><span className="w-fit rounded-full bg-emerald-50 px-4 py-2 text-xs font-black capitalize text-emerald-800">{result.request.status.replaceAll("_", " ")}</span></div>
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_.7fr]"><main className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-bold">Request</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">{result.request.problemDescription}</p><dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-400">Property address</dt><dd className="mt-1 font-semibold">{result.private.exactAddress}</dd></div><div><dt className="text-slate-400">Priority</dt><dd className="mt-1 font-semibold capitalize">{result.request.priority.replaceAll("_", " ")}</dd></div></dl><h2 className="mt-8 font-bold">Timeline</h2><div className="mt-3 space-y-2">{result.events.map((event) => <div key={event.id} className="rounded-xl bg-slate-50 p-3"><p className="text-sm font-semibold capitalize">{event.status.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-slate-400">{event.createdAt.toDate().toLocaleString()}</p></div>)}</div></main>
      <aside className="rounded-2xl border border-slate-200 bg-white p-6 lg:self-start"><Store className="size-6 text-emerald-700"/><h2 className="mt-4 font-bold">{result.vendor ? "Accepted provider" : "Connect Match status"}</h2>{result.vendor ? <><p className="mt-3 text-xl font-bold">{result.vendor.businessName}</p><div className="mt-4 space-y-2 text-sm">{result.vendor.publicPhone ? <a href={`tel:${result.vendor.publicPhone}`} className="flex items-center gap-2 text-emerald-800"><Phone className="size-4"/>{result.vendor.publicPhone}</a> : null}{result.vendor.publicEmail ? <a href={`mailto:${result.vendor.publicEmail}`} className="flex items-center gap-2 text-emerald-800"><Mail className="size-4"/>{result.vendor.publicEmail}</a> : null}</div>{result.vendor.slug ? <Link href={`/marketplace/${result.vendor.slug}`} className="mt-5 inline-flex min-h-10 items-center rounded-full bg-slate-950 px-4 text-xs font-black text-white">View marketplace profile</Link> : null}</> : <p className="mt-3 text-sm leading-6 text-slate-500">Your request is being reviewed. Vendor candidates and internal assignment details remain private until a provider accepts.</p>}</aside>
    </div>
  </div>;
}
