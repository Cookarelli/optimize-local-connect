import Link from "next/link";
import {
  Award,
  Building2,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  MapPin,
  Menu,
  Settings,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";
import { signOut } from "@/app/(auth)/sign-in/actions";
import { switchOrganization } from "@/app/(platform)/actions";
import type { Permission } from "@/src/domain/auth/roles";
import type { AppUser } from "@/src/domain/auth/types";
import { can } from "@/src/lib/auth/authorization";
import { getRoleHome } from "@/src/lib/auth/routing";
import { Logo } from "@/src/components/brand/logo";
import { MissionSignature } from "@/src/components/brand/mission-signature";
import { getRoleLabel } from "@/src/domain/platform/terminology";
import { PROPERTY_MANAGEMENT_VERTICAL } from "@/src/domain/verticals/registry";

const nav: { label: string; href: string; icon: typeof LayoutDashboard; permission?: Permission }[] = [
  { label: "Properties", href: "/properties", icon: Building2, permission: "properties:view" },
  { label: "Requests", href: "/requests", icon: ClipboardList, permission: "service_requests:view" },
  { label: "Local Marketplace", href: "/marketplace", icon: Store, permission: "marketplace:view" },
  { label: "Impact", href: "/impact", icon: TrendingUp, permission: "reports:view" },
  { label: "Team", href: "/team", icon: Users, permission: "members:view" },
];

export function AppShell({ children, user }: { children: React.ReactNode; user: AppUser }) {
  const activeMembership = user.memberships[0];
  const displayName = user.fullName || user.email.split("@")[0];
  const organizationId = activeMembership?.organizationId;
  const visibleNav = [
    { label: "Overview", href: getRoleHome(user), icon: LayoutDashboard },
    ...(user.isSuperAdmin ? [{ label: "Platform Control Center", href: "/admin", icon: Award }, { label: "Founding Partners", href: "/admin/founders", icon: Award }] : []),
    ...(activeMembership && ["owner", "admin"].includes(activeMembership.role) ? [{ label: "Connected Payments", href: "/payments/connect", icon: CreditCard }] : []),
    ...nav.filter((item) => !item.permission || can(user, item.permission, organizationId)),
  ];

  return (
    <div className="min-h-dvh bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white px-4 py-5 lg:flex">
        <div className="px-2"><Logo compact /></div>
        <div className="mt-8 rounded-2xl bg-slate-950 p-3.5 text-white">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-emerald-400">{PROPERTY_MANAGEMENT_VERTICAL.name}</p>
          <p className="mt-1 truncate text-sm font-semibold">{activeMembership?.organizationName ?? "Platform operations"}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400"><MapPin className="size-3.5" /> All assigned markets</p>
        </div>
        <MissionSignature className="mt-4 px-2 leading-5" />
        {user.memberships.length > 1 ? <form action={switchOrganization} className="mt-3 flex gap-2"><label htmlFor="organization-switcher" className="sr-only">Active organization</label><select id="organization-switcher" name="organizationId" defaultValue={activeMembership?.organizationId} className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800">{user.memberships.map((membership) => <option key={membership.id} value={membership.organizationId}>{membership.organizationName}</option>)}</select><button type="submit" className="rounded-lg bg-emerald-700 px-2.5 text-xs font-bold text-white">Go</button></form> : null}
        <nav aria-label="Application navigation" className="mt-5 space-y-1">
          {visibleNav.map(({ label, href, icon: Icon }, index) => (
            <Link key={href} href={href} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${index === 0 ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}>
              <Icon aria-hidden="true" className="size-4.5" /> {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-slate-100 pt-4">
          <Link href="/settings" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"><Settings className="size-4.5" /> Settings</Link>
          <div className="mt-3 flex items-center gap-3 px-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">{displayName.slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{displayName}</p><p className="truncate text-xs text-slate-500">{activeMembership ? getRoleLabel(activeMembership.role) : "Super Admin"}</p></div>
            <form action={signOut}><button type="submit" className="rounded-lg p-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Sign out">Out</button></form>
          </div>
        </div>
      </aside>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
        <Logo compact />
        <details className="relative">
          <summary className="grid size-11 cursor-pointer list-none place-items-center rounded-xl border border-slate-200" aria-label="Open navigation"><Menu className="size-5" /></summary>
          <nav aria-label="Mobile application navigation" className="absolute right-0 top-13 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
            {visibleNav.map(({ label, href, icon: Icon }) => <Link key={href} href={href} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"><Icon className="size-4.5" />{label}</Link>)}
            <Link href="/settings" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"><Settings className="size-4.5" />Settings</Link>
            <div className="px-3 py-3"><MissionSignature /></div>
            <form action={signOut}><button type="submit" className="min-h-11 w-full rounded-xl px-3 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50">Sign out</button></form>
          </nav>
        </details>
      </header>
      <div className="lg:pl-64"><main className="mx-auto max-w-[92rem] p-4 sm:p-6 lg:p-9">{children}</main></div>
    </div>
  );
}
