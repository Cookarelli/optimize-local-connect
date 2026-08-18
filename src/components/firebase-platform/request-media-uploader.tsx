"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ref, uploadBytes } from "firebase/storage";
import { getFirebaseClientStorage } from "@/src/lib/firebase/client";

const maximumBytes = 10 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function RequestMediaUploader({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function upload(file: File) {
    if (!allowedTypes.has(file.type) || file.size > maximumBytes) {
      setMessage("Use a JPG, PNG, or WebP image under 10 MiB.");
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const user = (await import("firebase/auth")).getAuth().currentUser;
      if (!user) throw new Error("Sign in again before uploading a photo.");
      const csrf = await fetch("/api/auth/firebase/csrf", { cache: "no-store", credentials: "same-origin" }).then(async (response) => {
        if (!response.ok) throw new Error("Unable to prepare a secure upload.");
        return response.json() as Promise<{ token?: string }>;
      });
      const reserve = await fetch(`/api/service-requests/${requestId}/media`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf.token ?? "" },
        body: JSON.stringify({ action: "reserve", assetId: crypto.randomUUID() }),
      });
      const reserved = await reserve.json() as { path?: string; error?: string };
      if (!reserve.ok || !reserved.path) throw new Error(reserved.error ?? "Unable to reserve the photo upload.");
      await uploadBytes(ref(getFirebaseClientStorage(), reserved.path), file, { contentType: file.type, customMetadata: { assetKind: "request" } });
      const finalize = await fetch(`/api/service-requests/${requestId}/media`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf.token ?? "" },
        body: JSON.stringify({ action: "finalize", path: reserved.path }),
      });
      const finalized = await finalize.json() as { error?: string };
      if (!finalize.ok) throw new Error(finalized.error ?? "Photo upload could not be finalized.");
      setMessage("Photo added securely. It is shared only with an accepted vendor.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Photo upload failed.");
    } finally {
      setPending(false);
    }
  }

  return <section className="mt-6 rounded-xl border border-slate-200 p-4"><p className="text-sm font-bold">Optional photos</p><p className="mt-1 text-xs leading-5 text-slate-500">Add up to five private JPG, PNG, or WebP images. Photos remain private until a vendor accepts.</p><label className="mt-3 inline-flex min-h-10 cursor-pointer items-center rounded-full bg-slate-950 px-4 text-xs font-bold text-white">{pending ? "Uploading…" : "Add photo"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={pending} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }}/></label>{message?<p role="status" className="mt-3 text-xs leading-5 text-slate-600">{message}</p>:null}</section>;
}
