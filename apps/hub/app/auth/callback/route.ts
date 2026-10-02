import { NextResponse, type NextRequest } from 'next/server';
import { HUB_ORIGIN } from '@/lib/registry';
import {
  SESSION_COOKIE,
  SESSION_SECONDS,
  TRANSACTION_COOKIE,
  completeSignIn,
  cookieOptions,
  oidcConfig,
} from '@/lib/oidc';

/** Story 5.3: the redirect URI. Mints the Hub's session, or answers 400 and mints nothing. */
export async function GET(request: NextRequest) {
  const config = oidcConfig();
  if (!config) return new NextResponse(null, { status: 404 });
  let response: NextResponse;
  try {
    const session = await completeSignIn(config, request.nextUrl.searchParams, request.cookies.get(TRANSACTION_COOKIE)?.value);
    response = NextResponse.redirect(new URL('/', HUB_ORIGIN), 302);
    response.cookies.set(SESSION_COOKIE, session, cookieOptions(SESSION_SECONDS));
  } catch (error) {
    console.error('auth callback:', (error as Error).message);
    response = new NextResponse('Sign-in failed.', { status: 400 });
  }
  // The transaction is single use, whichever way it ended.
  response.cookies.set(TRANSACTION_COOKIE, '', cookieOptions(0));
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
