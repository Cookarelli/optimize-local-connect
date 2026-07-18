import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/src/components/brand/logo";
import { PLATFORM_BRAND } from "@/src/domain/platform/brand";

export function PublicMarketplaceShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-[#f7f8f4] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-[#f7f8f4]/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-18 max-w-[90rem] items-center justify-between px-5 py-3 sm:px-8 lg:px-12">
          <Logo />
          <nav aria-label="Marketplace navigation" className="hidden items-center gap-6 md:flex">
            <Link href="/marketplace" className="text-sm font-bold text-slate-950">Marketplace</Link>
            <Link href="/founders" className="text-sm font-medium text-slate-600 hover:text-slate-950">For vendors</Link>
            <Link href="/company" className="text-sm font-medium text-slate-600 hover:text-slate-950">About</Link>
            <Link href="/sign-in" className="inline-flex min-h-10 items-center rounded-full bg-slate-950 px-5 text-sm font-bold text-white hover:bg-emerald-700">Sign in</Link>
          </nav>
          <details className="relative md:hidden">
            <summary className="grid size-11 cursor-pointer list-none place-items-center rounded-xl border border-slate-200 bg-white" aria-label="Open navigation"><Menu className="size-5" /></summary>
            <nav className="absolute right-0 top-13 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              <Link href="/marketplace" className="block rounded-xl px-3 py-3 text-sm font-bold">Marketplace</Link>
              <Link href="/founders" className="block rounded-xl px-3 py-3 text-sm font-semibold text-slate-600">For vendors</Link>
              <Link href="/company" className="block rounded-xl px-3 py-3 text-sm font-semibold text-slate-600">About</Link>
              <Link href="/sign-in" className="block rounded-xl px-3 py-3 text-sm font-semibold text-slate-600">Sign in</Link>
            </nav>
          </details>
        </div>
      </header>
      {children}
      <footer className="mt-20 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[90rem] flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-end md:justify-between lg:px-12">
          <div><Logo /><p className="mt-4 max-w-md text-sm leading-6 text-slate-500">{PLATFORM_BRAND.description}</p></div>
          <div className="flex flex-wrap gap-5 text-sm text-slate-500"><Link href="/marketplace">Marketplace</Link><Link href="/founders">Founding Partners</Link><Link href="/company">Company</Link><Link href="/sign-in">Sign in</Link></div>
        </div>
      </footer>
    </main>
  );
}
