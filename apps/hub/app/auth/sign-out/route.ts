import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, cookieOptions, oidcConfig, signOut } from '@/lib/oidc';

/**
 * Story 5.5: the Hub's own sign-out, reached by URL as sign-in is. Fetch Metadata refuses one another site
 * started or a browser prefetched, so nothing signs the Owner out behind his back. 404 while unconfigured.
 */
export async function GET(request: NextRequest) {
  const config = oidcConfig();
  if (!config) return new NextResponse(null, { status: 404 });
  const headers = { 'Cache-Control': 'no-store' };
  const site = request.headers.get('sec-fetch-site');
  const purpose = `${request.headers.get('sec-purpose') ?? ''} ${request.headers.get('purpose') ?? ''}`;
  if ((site !== null && site !== 'same-origin' && site !== 'none') || /prefetch/i.test(purpose))
    return new NextResponse('Sign-out must be requested from this site.', { status: 403, headers });
  const response = NextResponse.redirect(await signOut(config, request.cookies.get(SESSION_COOKIE)?.value), 302);
  response.cookies.set(SESSION_COOKIE, '', cookieOptions(0));
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
