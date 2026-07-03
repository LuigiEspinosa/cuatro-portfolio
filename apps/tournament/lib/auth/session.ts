import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Role } from '@/lib/auth/roles';

/**
 * Mint an authenticated Supabase session for a verified SteamID64 (AC5).
 *
 * Identity → principal rides Supabase Auth ("Option A", SOLUTION-DESIGN §5): we do NOT
 * hand-roll a JWT. We ensure a Supabase auth user exists whose `app_metadata` carries the
 * `{ steamid64, role }` claim (so `jwt_steamid64()` and `is_admin()` from migration 0002
 * resolve), then mint a session cookie by exchanging a server-generated magic-link token.
 *
 * SCOPE: Story 2.1 set `steamid64`; Story 2.2 extends this so `app_metadata` carries BOTH
 * `{ steamid64, role }` (role resolved via `lib/auth/roles`, mirrored from `app_role`).
 * Role ENFORCEMENT / revoke-invalidates-session stays Story 2.4 — this only BINDS the claim.
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
 * Idempotently ensure a Supabase auth user exists with the `{ steamid64, role }` claim.
 * On first login the user is created with the claim. On repeat logins the user already
 * exists, so `createUser` no-ops here — the claim is (re)asserted by the `updateUserById`
 * step in `establishSession` (which also backfills 2.1-era users that predate `role`).
 */
export async function ensureAuthUser(
  admin: SupabaseClient,
  steamid64: string,
  role: Role,
): Promise<void> {
  const email = steamEmail(steamid64);
  const { error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { steamid64, role }, // identity + role claim (Story 2.2)
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
  role: Role,
): Promise<void> {
  await ensureAuthUser(admin, steamid64, role);
  const email = steamEmail(steamid64);

  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) {
    throw new Error(`generateLink failed: ${error.message}`);
  }
  const tokenHash = data.properties?.hashed_token;
  if (!tokenHash) {
    throw new Error('generateLink returned no hashed_token');
  }

  // Backfill/refresh the claim for EXISTING users (2.1-era users had `steamid64` but no
  // `role`) and keep role current for everyone. `generateLink` returns the full user, so we
  // have the id here without a lookup. The Admin API REPLACES `app_metadata` (no deep-merge),
  // so pass BOTH keys or the `steamid64` claim is clobbered. Done BEFORE `verifyOtp` so the
  // minted JWT already carries `role` — `is_admin()` resolves on the first admin login.
  const userId = data.user?.id;
  if (userId) {
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: { steamid64, role },
    });
    if (updateError) {
      throw new Error(`updateUserById failed: ${updateError.message}`);
    }
  }

  const { error: verifyError } = await ssr.auth.verifyOtp({
    type: 'email',
    token_hash: tokenHash,
  });
  if (verifyError) {
    throw new Error(`verifyOtp failed: ${verifyError.message}`);
  }
}
