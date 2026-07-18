"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyContactButton({ label, value }: { label: string; value: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="text-xs text-slate-400">No {label.toLowerCase()}</span>;
  async function copy() {
    await navigator.clipboard.writeText(value!);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }
  return <button type="button" onClick={copy} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50" aria-label={`Copy ${label.toLowerCase()}`}>{copied ? <Check aria-hidden="true" className="size-3.5 text-emerald-600" /> : <Copy aria-hidden="true" className="size-3.5" />}{copied ? "Copied" : label}</button>;
}
