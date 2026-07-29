'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The browser (anon) Supabase client — the THIRD and last client factory (Story 5.8, AC1/AC7), and the
 * ONLY place Supabase Realtime runs in the browser. The two server factories are untouched:
 * `createSupabaseServerClient()` (anon-SSR read, `lib/supabase/server.ts`) and `getAdminClient()`
 * (service-role, `lib/supabase/admin.ts`, never client-side).
 *
 * ⚠ Reads `NEXT_PUBLIC_*` DIRECTLY from `process.env` — NOT via `@/lib/env`, which is `import 'server-only'`
 * and would break the client build. It carries ONLY the anon key: never the service-role key and never a
 * `NEXT_PUBLIC_`-mirrored secret (AD-25 — `lib/env.ts` asserts no secret is mirrored). Realtime auth rides
 * the Supabase Auth cookie/session for free (AD-12), though `tournament:<id>` is a PUBLIC channel that
 * needs no privilege to receive a nudge.
 *
 * Per-tab SINGLETON: one client (⇒ one WebSocket, one channel) reused across island mounts, so we never
 * open N subscriptions from N components.
 */
let cached: SupabaseClient | null = null;

export function createSupabaseBrowserClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Fail loudly at first use rather than opening a broken socket. These are build-time-inlined
    // public vars; a missing one is a misconfiguration, not a runtime user path.
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  cached = createBrowserClient(url, anonKey);
  return cached;
}
