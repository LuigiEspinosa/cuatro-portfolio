import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { buildLoginUrl } from '@/lib/steam/openid';
import { mintNonce } from '@/lib/steam/nonce';
import { NONCE_COOKIE, NONCE_QUERY_PARAM } from '@/lib/steam/callback';

// Steam verification + crypto require Node APIs — never the Edge runtime (AC6).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /auth/steam/login (AC1, AC4)
 * Mints a signed CSRF nonce (cookie + carried in return_to) and redirects to Steam's
 * OpenID 2.0 `checkid_setup` endpoint with realm/return_to bound to the configured domain.
 */
export async function GET() {
  const realm = env.steamRealm();
  const returnUrlBase = env.steamReturnUrl();
  const nonce = mintNonce(env.authNonceSecret());

  // Carry the nonce through return_to so Steam echoes it back to the callback.
  const returnTo = new URL(returnUrlBase);
  returnTo.searchParams.set(NONCE_QUERY_PARAM, nonce);

  const redirectUrl = buildLoginUrl({ realm, returnTo: returnTo.toString() });
  const response = NextResponse.redirect(redirectUrl);

  response.cookies.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: 'lax',
    secure: returnUrlBase.startsWith('https://'),
    path: '/',
    maxAge: 60 * 10, // 10 minutes to complete the round-trip
  });

  return response;
}
