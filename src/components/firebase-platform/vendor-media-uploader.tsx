"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ref, uploadBytes } from "firebase/storage";
import { getFirebaseClientStorage } from "@/src/lib/firebase/client";

const limits = { logo: 2 * 1024 * 1024, featured: 8 * 1024 * 1024 } as const;
const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);

export function VendorMediaUploader({ organizationId, assetKind, currentUrl }: { organizationId: string; assetKind: "logo" | "featured"; currentUrl: string | null }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function upload(file: File) {
    if (!allowed.has(file.type) || file.size > limits[assetKind]) { setMessage(`Use a JPG, PNG, or WebP under ${limits[assetKind] / 1024 / 1024} MiB.`); return; }
    setPending(true); setMessage(null);
    try {
      const user = (await import("firebase/auth")).getAuth().currentUser;
      if (!user) throw new Error("Sign in again before uploading media.");
      const assetId = crypto.randomUUID();
      const draftPath = `vendor-media/${organizationId}/draft/${user.uid}/${assetId}`;
      await uploadBytes(ref(getFirebaseClientStorage(), draftPath), file, { contentType: file.type, customMetadata: { assetKind } });
      const csrf = await fetch("/api/auth/firebase/csrf", { cache: "no-store", credentials: "same-origin" }).then((response) => response.json()) as { token?: string };
      const response = await fetch("/api/vendor/media", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "x-csrf-token": csrf.token ?? "" }, body: JSON.stringify({ organizationId, assetKind, draftPath }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Upload could not be registered.");
      setMessage("Draft uploaded. It will become public only after approval and publication.");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed."); }
    finally { setPending(false); }
  }
  return <div className="rounded-xl border border-slate-200 p-4"><p className="text-sm font-bold capitalize">{assetKind === "logo" ? "Logo" : "Featured image"}</p>{currentUrl ? <a href={currentUrl} target="_blank" rel="noreferrer" className="mt-2 block text-xs font-semibold text-emerald-700">View current approved image</a> : null}<label className="mt-3 inline-flex min-h-10 cursor-pointer items-center rounded-full bg-slate-950 px-4 text-xs font-black text-white">{pending ? "Uploading…" : "Choose image"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={pending} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }}/></label>{message ? <p role="status" className="mt-3 text-xs leading-5 text-slate-600">{message}</p> : null}</div>;
}
