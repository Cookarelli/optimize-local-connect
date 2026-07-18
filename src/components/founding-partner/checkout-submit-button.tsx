"use client";

import { useFormStatus } from "react-dom";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { FOUNDING_PARTNER_PLAN, formatVendorPlanPrice } from "@/src/domain/vendor-memberships/catalog";

const founderPrice = formatVendorPlanPrice(FOUNDING_PARTNER_PLAN);

export function CheckoutSubmitButton({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-black transition focus-visible:outline-offset-4 disabled:cursor-wait disabled:opacity-70 ${
        light ? "bg-white text-emerald-900 hover:bg-emerald-50" : "bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
      } ${compact ? "min-h-10 px-4 text-xs sm:min-h-11 sm:px-5 sm:text-sm" : ""}`}
    >
      {pending ? <LoaderCircle aria-hidden="true" className="mr-2 size-4 animate-spin" /> : null}
      {compact ? <span className="sm:hidden">{pending ? "Opening…" : `Join · ${founderPrice}`}</span> : null}
      <span className={compact ? "hidden sm:inline" : ""}>{pending ? "Opening secure checkout…" : "Become a Founding Partner"}</span>
      {!pending ? <ArrowRight aria-hidden="true" className="ml-2 size-4" /> : null}
    </button>
  );
}
