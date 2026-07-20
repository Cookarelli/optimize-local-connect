/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

import { PLATFORM_BRAND } from "@/src/domain/platform/brand";

type LogoProps = {
  inverse?: boolean;
  className?: string;
  priority?: boolean;
};

export function Logo({
  inverse = false,
  className = "",
  priority = false,
}: LogoProps) {
  if (inverse) {
    return (
      <Link
        href="/"
        aria-label={`${PLATFORM_BRAND.productName} home`}
        className={`inline-flex flex-col ${className}`}
      >
        <span className="text-lg font-black tracking-[-0.03em] text-white sm:text-xl">
          OPTIMIZE
        </span>

        <span className="text-xs font-black uppercase tracking-[0.12em]">
          <span className="text-blue-400">Local</span>{" "}
          <span className="text-emerald-400">Connect</span>
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/"
      aria-label={`${PLATFORM_BRAND.productName} home`}
      className={`inline-flex items-center ${className}`}
    >
      <img
        src="/brand/optimize-local-connect/logo.png"
        alt="Optimize Local Connect — Smarter Connections. Better Communities."
        width="1030"
        height="250"
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="h-auto w-[220px] object-contain sm:w-[270px] lg:w-[300px]"
      />
    </Link>
  );
}
