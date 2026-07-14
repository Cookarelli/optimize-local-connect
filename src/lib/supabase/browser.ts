"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/src/lib/env";

let client: ReturnType<typeof createBrowserClient> | undefined;

export function createSupabaseBrowserClient() {
  if (!client) {
    const env = getPublicEnv();
    client = createBrowserClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  }

  return client;
}
