import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Mint an authenticated Supabase session for a verified SteamID64 (AC5).
 *
 * Identity → principal rides Supabase Auth ("Option A", SOLUTION-DESIGN §5): we do NOT
 * hand-roll a JWT. We ensure a Supabase auth user exists whose `app_metadata.steamid64`
 * carries the identity claim (so `jwt_steamid64()` from migration 0002 resolves), then
 * mint a session cookie by exchanging a server-generated magic-link token.
 *
 * SCOPE (2.1): set `app_metadata.steamid64` ONLY. Do NOT set `app_metadata.role`, and do
 * NOT run the admin allowlist bootstrap — that is Story 2.2.
 *
 * NOTE (version-sensitivity, per Task 5): Supabase's server-side session-minting surface
 * has shifted across releases. This uses `generateLink({ type: 'magiclink' })` →
 * `verifyOtp({ type: 'email', token_hash })`, the pattern documented for
 * @supabase/supabase-js v2 + @supabase/ssr v0.x. Confirm against the running instance
 * during manual QA before relying on it in production.
 */

// Deterministic synthetic email derived from the (immutable) SteamID64. Never shown to
// users; it only gives Supabase Auth a stable unique handle for this identity.
const STEAM_EMAIL_DOMAIN = 'steam.inclusivcup.local';

export function steamEmail(steamid64: string): string {
  return `${steamid64}@${STEAM_EMAIL_DOMAIN}`;
}

function isAlreadyExists(error: { message?: string; code?: string; status?: number }): boolean {
  const msg = (error.message ?? '').toLowerCase();
  return (
    error.code === 'email_exists' ||
    error.status === 422 ||
    msg.includes('already been registered') ||
    msg.includes('already registered') ||
    msg.includes('already exists')
  );
}

/**
 * Idempotently ensure a Supabase auth user exists with `app_metadata.steamid64` set.
 * On first login the user is created with the claim; on repeat logins the user already
 * exists (the claim was set at creation and steamid64 never changes), so we no-op.
 */
export async function ensureAuthUser(admin: SupabaseClient, steamid64: string): Promise<void> {
  const email = steamEmail(steamid64);
  const { error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { steamid64 }, // identity claim ONLY — role is Story 2.2
  });
  if (error && !isAlreadyExists(error)) {
    throw new Error(`ensureAuthUser failed: ${error.message}`);
  }
}

/**
 * Establish the cookie session. `admin` generates a one-time magic-link token; the
 * request-scoped `ssr` client verifies it, which writes the @supabase/ssr session cookies
 * onto the outgoing response.
 */
export async function establishSession(
  admin: SupabaseClient,
  ssr: SupabaseClient,
  steamid64: string,
): Promise<void> {
  await ensureAuthUser(admin, steamid64);
  const email = steamEmail(steamid64);

  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) {
    throw new Error(`generateLink failed: ${error.message}`);
  }
  const tokenHash = data.properties?.hashed_token;
  if (!tokenHash) {
    throw new Error('generateLink returned no hashed_token');
  }

  const { error: verifyError } = await ssr.auth.verifyOtp({
    type: 'email',
    token_hash: tokenHash,
  });
  if (verifyError) {
    throw new Error(`verifyOtp failed: ${verifyError.message}`);
  }
}
