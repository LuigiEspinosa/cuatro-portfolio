import { NextResponse } from 'next/server';
import { TRANSACTION_COOKIE, TRANSACTION_SECONDS, beginSignIn, cookieOptions, oidcConfig } from '@/lib/oidc';

/** Story 5.3: send the browser to the issuer. 404 while the Hub is unconfigured. */
export async function GET() {
  const config = oidcConfig();
  if (!config) return new NextResponse(null, { status: 404 });
  try {
    const { location, transaction } = await beginSignIn(config);
    const response = NextResponse.redirect(location, 302);
    response.cookies.set(TRANSACTION_COOKIE, transaction, cookieOptions(TRANSACTION_SECONDS));
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    console.error('auth sign-in:', (error as Error).message);
    return new NextResponse('The identity issuer is unavailable.', { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
