import { PLATFORM_BRAND } from "@/src/domain/platform/brand";
import { cn } from "@/src/lib/utils";

export function MissionSignature({ inverse = false, className }: { inverse?: boolean; className?: string }) {
  return <p className={cn("text-xs font-semibold uppercase tracking-[.14em]", inverse ? "text-slate-500" : "text-slate-400", className)}>{PLATFORM_BRAND.mission}</p>;
}
