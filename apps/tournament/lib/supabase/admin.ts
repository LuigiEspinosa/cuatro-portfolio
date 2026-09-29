import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

/**
 * Service-role Supabase client — the single server-side writer (AD-2). It holds the
 * `SUPABASE_SERVICE_ROLE_KEY` and BYPASSRLS, so it can upsert `player` and drive the
 * Auth Admin API. `import 'server-only'` guarantees this never reaches a client bundle
 * (AC6). Sessions/tokens are disabled — this client is stateless and never a "user".
 */

let cached: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cached;
}
