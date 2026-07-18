import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, LockKeyhole, Store } from "lucide-react";
import { buyMarketplaceProduct } from "./actions";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

export const metadata: Metadata = { title: "Service storefront", description: "Purchase services from connected local organizations through secure Stripe Checkout." };

export default async function StorefrontPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const query = await searchParams;
  const admin = createSupabaseAdminClient();
  const { data: products, error } = await admin.from("marketplace_products")
    .select("id,name,description,unit_amount_cents,currency,seller_organization_id,organizations!marketplace_products_seller_organization_id_fkey(name)")
    .eq("active", true)
    .order("created_at", { ascending: false });
  // Publicly show business names, never connected-account IDs or requirements.
  const { data: connectedBusinesses } = await admin.from("stripe_connected_accounts")
    .select("organization_id,organizations(name)")
    .order("created_at", { ascending: true });
  return <main className="min-h-dvh bg-slate-50 px-5 py-8 sm:px-8 sm:py-12"><div className="mx-auto max-w-6xl"><Link href="/marketplace" className="inline-flex items-center text-sm font-bold text-slate-600 hover:text-emerald-700"><ArrowLeft className="mr-2 size-4"/>Vendor marketplace</Link><div className="mt-8 max-w-3xl"><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">Connected service payments</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.045em] sm:text-6xl">Purchase through the platform.</h1><p className="mt-4 text-base leading-7 text-slate-600">Choose an offered service and pay on Stripe’s hosted checkout. Sellers may also arrange payment directly outside the platform.</p></div>
  {query.checkout==="cancelled"?<p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">Checkout was canceled. Nothing was recorded as paid.</p>:null}
  {connectedBusinesses?.length?<section className="mt-8"><h2 className="text-sm font-black uppercase tracking-wider text-slate-500">Connected businesses</h2><div className="mt-3 flex flex-wrap gap-2">{connectedBusinesses.map(row=><span key={row.organization_id} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">{(row.organizations as unknown as {name:string}|null)?.name??"Connected organization"}</span>)}</div></section>:null}
  {error?<p className="mt-8 rounded-xl bg-rose-50 p-5 text-sm text-rose-800">Products could not be loaded. Please try again later.</p>:products?.length?<section className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{products.map(product=>{const seller=product.organizations as unknown as {name:string}|null;return <article key={product.id} className="flex flex-col rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-sm"><span className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Store className="size-5"/></span><p className="mt-6 text-xs font-black uppercase tracking-wider text-emerald-700">{seller?.name??"Connected seller"}</p><h2 className="mt-2 text-2xl font-bold">{product.name}</h2><p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{product.description||"Contact the seller for service details."}</p><p className="mt-6 text-3xl font-semibold">${(product.unit_amount_cents/100).toFixed(2)} <span className="text-xs font-bold text-slate-400">{product.currency}</span></p><form action={buyMarketplaceProduct} className="mt-5"><input type="hidden" name="productId" value={product.id}/><label className="text-xs font-bold text-slate-700">Receipt email<input name="email" type="email" required autoComplete="email" className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal"/></label><button className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-bold text-white hover:bg-emerald-700"><LockKeyhole className="mr-2 size-4"/>Secure checkout</button></form></article>})}</section>:<div className="mt-10 rounded-[1.6rem] border border-dashed border-slate-300 bg-white p-10 text-center"><Store className="mx-auto size-8 text-slate-300"/><h2 className="mt-4 text-xl font-bold">No platform products yet</h2><p className="mt-2 text-sm text-slate-500">Vendors can still be contacted directly through the marketplace.</p></div>}</div></main>;
}
