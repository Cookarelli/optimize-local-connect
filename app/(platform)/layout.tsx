import { AppShell } from "@/src/components/layout/app-shell";
import { requireUser } from "@/src/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}
