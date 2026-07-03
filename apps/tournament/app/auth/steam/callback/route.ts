import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import { createSteamVerifier } from '@/lib/steam/openid';
import { NONCE_COOKIE } from '@/lib/steam/callback';
import { runSteamLogin } from '@/lib/auth/login-flow';
import { getAdminClient } from '@/lib/supabase/admin';
import { createSupabaseRouteClient } from '@/lib/supabase/server';
import { fetchSteamProfile, upsertPlayer } from '@/lib/players';
import { establishSession } from '@/lib/auth/session';
import { parseAdminAllowlist, resolveRole } from '@/lib/auth/roles';

// Steam verify (fetch), crypto, and the Auth Admin API require Node APIs (AC6).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /auth/steam/callback (AC1, AC2, AC3, AC5)
 * Verifies the OpenID assertion server-side (check_authentication), and ONLY on success
 * upserts `player` (service role) and mints a Supabase session. Any failure fails closed:
 * no session, no write — just a redirect back to Home with an error flag.
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const nonceCookie = cookieStore.get(NONCE_COOKIE)?.value;

  // Bind the SSR client to this response so session Set-Cookie headers attach to it.
  const successResponse = NextResponse.redirect(new URL('/', env.steamRealm()));
  const ssr = createSupabaseRouteClient(request, successResponse);
  const admin = getAdminClient();

  // Any failure — a fail-closed verification result OR a thrown side effect (Steam
  // endpoint down/timeout, Supabase Auth/DB error, version mismatch) — must land on the
  // same graceful redirect. A fresh response guarantees no partial session cookies that
  // may have been written onto successResponse leak out.
  const failClosed = () => {
    const failResponse = NextResponse.redirect(new URL('/?login=error', env.steamRealm()));
    failResponse.cookies.delete(NONCE_COOKIE);
    return failResponse;
  };

  try {
    const result = await runSteamLogin(
      {
        params: request.nextUrl.searchParams,
        nonceCookie,
        verifier: createSteamVerifier(),
        config: {
          realm: env.steamRealm(),
          returnUrl: env.steamReturnUrl(),
          nonceSecret: env.authNonceSecret(),
        },
      },
      {
        async upsertPlayer(steamid64) {
          const profile = await fetchSteamProfile(steamid64, env.steamApiKey());
          await upsertPlayer(admin, steamid64, profile);
        },
        async establishSession(steamid64) {
          // Resolve role (app_role-first, else allowlist bootstrap) then bind + mint (2.2).
          const role = await resolveRole(admin, steamid64, parseAdminAllowlist(env.adminSteamIds()));
          await establishSession(admin, ssr, steamid64, role);
        },
      },
    );

    if (!result.ok) {
      // establishSession never ran, so no session cookies were written.
      return failClosed();
    }

    // Success: session cookies are already on successResponse; consume the nonce.
    successResponse.cookies.delete(NONCE_COOKIE);
    return successResponse;
  } catch (err) {
    // A verified-but-post-verification effect threw. Never surface a 500 (or a partial
    // session) — fail closed to the login-error page. Server-log for diagnosis.
    console.error('[steam/callback] login failed after verification:', err);
    return failClosed();
  }
}
