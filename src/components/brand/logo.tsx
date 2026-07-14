import Link from "next/link";
import { PLATFORM_BRAND } from "@/src/domain/platform/brand";
import { cn } from "@/src/lib/utils";

export function Logo({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      aria-label={`${PLATFORM_BRAND.productName} home`}
    >
      <span
        aria-hidden="true"
        className="grid size-9 place-items-center rounded-xl bg-slate-950 text-sm font-black tracking-tighter text-white shadow-sm"
      >
        OL
      </span>
      <span
        className={cn(
          "text-sm font-bold tracking-tight",
          inverse ? "text-white" : "text-slate-950",
          compact && "sr-only sm:not-sr-only",
        )}
      >
        Optimize Local <span className={inverse ? "text-emerald-400" : "text-emerald-700"}>Connect™</span>
      </span>
    </Link>
  );
}
