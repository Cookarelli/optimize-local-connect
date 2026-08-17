import type { PublicFounderCategory } from "@/src/domain/founder-categories/public";

export function FounderCategoryStatus({ categories }: { categories: PublicFounderCategory[] }) {
  if (!categories.length) return null;
  return <section aria-labelledby="founder-category-status-title" className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="section-kicker">Founder categories</p><h2 id="founder-category-status-title" className="mt-2 text-2xl font-bold tracking-[-.03em]">One original Founding Member per category.</h2></div>
      <p className="text-sm font-semibold text-slate-500">{categories.filter((category) => category.state === "available").length} of {categories.length} available</p>
    </div>
    <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((category) => <li key={category.slug} className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-[#f7f8f4] px-4 py-3">
        <div><p className="text-sm font-bold text-slate-900">{category.name}</p>{category.state === "claimed" && category.businessName ? <p className="mt-1 text-xs font-semibold text-emerald-700">{category.businessName}</p> : null}</div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${category.state === "available" ? "bg-emerald-100 text-emerald-800" : category.state === "claimed" ? "bg-slate-900 text-white" : "bg-amber-100 text-amber-900"}`}>{category.state}</span>
      </li>)}
    </ul>
  </section>;
}
