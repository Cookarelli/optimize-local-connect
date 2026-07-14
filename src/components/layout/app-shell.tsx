import Link from "next/link";
import {
  Building2,
  ClipboardList,
  LayoutDashboard,
  MapPin,
  Menu,
  Settings,
  Store,
  Users,
} from "lucide-react";
import { signOut } from "@/app/(auth)/sign-in/actions";
import type { AppUser } from "@/src/domain/auth/types";
import { Logo } from "@/src/components/brand/logo";

const nav = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Properties", href: "/properties", icon: Building2 },
  { label: "Requests", href: "/requests", icon: ClipboardList },
  { label: "Marketplace", href: "/marketplace", icon: Store },
  { label: "Team", href: "/team", icon: Users },
];

export function AppShell({ children, user }: { children: React.ReactNode; user: AppUser }) {
  const activeMembership = user.memberships[0];
  const displayName = user.fullName || user.email.split("@")[0];

  return (
    <div className="min-h-dvh bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white px-4 py-5 lg:flex">
        <div className="px-2"><Logo compact /></div>
        <div className="mt-8 rounded-2xl bg-slate-950 p-3.5 text-white">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Workspace</p>
          <p className="mt-1 truncate text-sm font-semibold">{activeMembership?.organizationName ?? "Platform operations"}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400"><MapPin className="size-3.5" /> All assigned markets</p>
        </div>
        <nav aria-label="Application navigation" className="mt-5 space-y-1">
          {nav.map(({ label, href, icon: Icon }, index) => (
            <Link key={href} href={href} aria-current={index === 0 ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${index === 0 ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}>
              <Icon aria-hidden="true" className="size-4.5" /> {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-slate-100 pt-4">
          <Link href="/settings" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"><Settings className="size-4.5" /> Settings</Link>
          <div className="mt-3 flex items-center gap-3 px-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">{displayName.slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{displayName}</p><p className="truncate text-xs text-slate-500">{activeMembership?.role.replaceAll("_", " ") ?? "Super admin"}</p></div>
            <form action={signOut}><button type="submit" className="rounded-lg p-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Sign out">Out</button></form>
          </div>
        </div>
      </aside>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
        <Logo compact />
        <details className="relative">
          <summary className="grid size-11 cursor-pointer list-none place-items-center rounded-xl border border-slate-200" aria-label="Open navigation"><Menu className="size-5" /></summary>
          <nav aria-label="Mobile application navigation" className="absolute right-0 top-13 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
            {nav.map(({ label, href, icon: Icon }) => <Link key={href} href={href} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"><Icon className="size-4.5" />{label}</Link>)}
            <Link href="/settings" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"><Settings className="size-4.5" />Settings</Link>
            <form action={signOut}><button type="submit" className="min-h-11 w-full rounded-xl px-3 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50">Sign out</button></form>
          </nav>
        </details>
      </header>
      <div className="lg:pl-64"><main className="mx-auto max-w-[92rem] p-4 sm:p-6 lg:p-9">{children}</main></div>
    </div>
  );
}
