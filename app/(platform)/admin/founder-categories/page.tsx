import Link from "next/link";
import { redirect } from "next/navigation";
import {
  manageFounderCategoryReservation,
  manuallyGrantFounderCategory,
  reconcileCurrentFounderSubscription,
  reconcilePaypalFounderSale,
} from "@/app/(platform)/admin/founders/actions";
import { requireUser } from "@/src/lib/auth/session";
import { listFounderCategoriesForAdmin } from "@/src/lib/founder-categories/firestore";

export const dynamic = "force-dynamic";
const field = "mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm";
type Category = {
  id: string;
  displayName: string;
  slug: string;
  status: "available" | "reserved" | "claimed";
  publicBusinessName: string | null;
  paymentSource: string | null;
  membershipId: string | null;
};

const resultMessages: Record<string, string> = {
  current_reconciled: "The verified Stripe Founder sale was reconciled without creating a charge.",
  manual_founder_granted: "The owner-approved Founder grant was recorded without payment metadata.",
  paypal_reconciled: "The verified PayPal sale was reconciled.",
  reservation_updated: "The category reservation was updated.",
};

export default async function FounderCategoriesAdminPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const user = await requireUser();
  if (!user.isSuperAdmin) redirect("/dashboard");
  const { result } = await searchParams;
  let categories: Category[] = [];
  let unavailable = false;
  try {
    categories = await listFounderCategoriesForAdmin() as Category[];
  } catch {
    unavailable = true;
  }
  const placeholderOrAvailable = categories.filter((category) => category.status === "available" || (category.status === "claimed" && category.paymentSource === "reserved_without_membership"));
  const available = categories.filter((category) => category.status === "available");

  return <div>
    <Link href="/admin/founders" className="text-sm font-bold text-slate-500">← Founding Members</Link>
    <div className="mt-5"><p className="text-sm font-semibold text-emerald-700">Firestore Founder governance</p><h1 className="mt-1 text-4xl font-semibold tracking-[-.04em]">Founder categories</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">All category and membership changes below run through trusted Firebase Admin transactions. Stripe reconciliation verifies an existing sale; manual grants never create payment records.</p></div>
    {result && resultMessages[result] ? <p role="status" className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{resultMessages[result]}</p> : null}
    {unavailable ? <p role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Founder category governance is unavailable because Firestore could not be loaded.</p> : <>
      <section className="mt-7 grid gap-5 xl:grid-cols-3">
        <form action={reconcileCurrentFounderSubscription} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold">Reconcile a verified Stripe Founder</h2><p className="mt-2 text-xs leading-5 text-slate-500">Retrieves the real existing Checkout Session from Stripe. It is idempotent and never creates a charge.</p><label className="mt-5 block text-sm font-semibold">Checkout Session ID<input required name="checkoutSessionId" className={field} placeholder="cs_…" /></label><label className="mt-4 block text-sm font-semibold">Business name<input required name="businessName" className={field} /></label><label className="mt-4 block text-sm font-semibold">Founder category<select required name="categorySlug" className={field} defaultValue=""><option value="" disabled>Select category</option>{placeholderOrAvailable.map((category) => <option key={category.id} value={category.slug}>{category.displayName} · {category.status}</option>)}</select></label><label className="mt-4 block text-sm font-semibold">Firestore organization ID (optional)<input name="organizationId" className={field} /></label><button className="mt-5 min-h-11 rounded-full bg-slate-950 px-5 text-sm font-bold text-white">Verify Stripe and reconcile</button></form>
        <form action={manuallyGrantFounderCategory} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold">Owner-approved manual Founder</h2><p className="mt-2 text-xs leading-5 text-slate-500">Creates a manually granted membership with null Stripe and PayPal references and no payment record.</p><label className="mt-5 block text-sm font-semibold">Business name<input required name="businessName" className={field} /></label><label className="mt-4 block text-sm font-semibold">Founder category<select required name="categorySlug" className={field} defaultValue=""><option value="" disabled>Select category</option>{placeholderOrAvailable.map((category) => <option key={category.id} value={category.slug}>{category.displayName} · {category.status}</option>)}</select></label><label className="mt-4 block text-sm font-semibold">Firestore organization ID (optional)<input name="organizationId" className={field} /></label><button className="mt-5 min-h-11 rounded-full bg-emerald-700 px-5 text-sm font-bold text-white">Record manual Founder grant</button></form>
        <form action={reconcilePaypalFounderSale} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold">Reconcile a verified PayPal sale</h2><p className="mt-2 text-xs leading-5 text-slate-500">Enter the real Payment Link transaction details after independently verifying the payment in PayPal.</p><label className="mt-5 block text-sm font-semibold">PayPal transaction/reference ID<input required name="paypalReferenceId" className={field} /></label><label className="mt-4 block text-sm font-semibold">Business name<input required name="businessName" className={field} /></label><label className="mt-4 block text-sm font-semibold">Contact email (optional)<input type="email" name="contactEmail" className={field} /></label><label className="mt-4 block text-sm font-semibold">Founder category<select required name="categorySlug" className={field} defaultValue=""><option value="" disabled>Select available category</option>{available.map((category) => <option key={category.id} value={category.slug}>{category.displayName}</option>)}</select></label><label className="mt-4 block text-sm font-semibold">Firestore organization ID (optional)<input name="organizationId" className={field} /></label><div className="mt-4 grid grid-cols-2 gap-3"><label className="block text-sm font-semibold">Amount paid<input required type="number" name="amountPaid" className={field} min="0.01" step="0.01" placeholder="399.00" /></label><label className="block text-sm font-semibold">Currency<input required name="currency" className={field} defaultValue="USD" maxLength={3} /></label></div><label className="mt-4 block text-sm font-semibold">Payment timestamp<input required type="datetime-local" name="paidAt" className={field} /></label><button className="mt-5 min-h-11 rounded-full bg-sky-700 px-5 text-sm font-bold text-white">Reconcile PayPal sale</button></form>
      </section>
      <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h2 className="font-bold">Canonical capacity</h2><p className="mt-1 text-xs text-slate-500">{categories.length} categories · {available.length} available</p></div><div className="divide-y divide-slate-100">{categories.map((category) => <div key={category.id} className="grid gap-3 p-4 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><p className="font-bold">{category.displayName}</p><p className="mt-1 text-xs text-slate-500">{category.publicBusinessName ?? "No public business name"} · {category.paymentSource?.replaceAll("_", " ") ?? "unassigned"}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize">{category.status}</span>{category.status === "available" ? <form action={manageFounderCategoryReservation}><input type="hidden" name="categorySlug" value={category.slug} /><input type="hidden" name="action" value="reserve" /><button className="min-h-9 rounded-full border border-slate-300 px-3 text-xs font-bold">Reserve</button></form> : category.status === "reserved" && category.paymentSource === "reserved_without_membership" && !category.membershipId ? <form action={manageFounderCategoryReservation}><input type="hidden" name="categorySlug" value={category.slug} /><input type="hidden" name="action" value="unreserve" /><button className="min-h-9 rounded-full border border-slate-300 px-3 text-xs font-bold">Unreserve</button></form> : <span />}</div>)}</div></section>
    </>}
  </div>;
}
