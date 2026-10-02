import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, oidcConfig, readSession } from '@/lib/oidc';

/** Story 5.3: who the Hub's session says is signed in. 401 without one, 404 while unconfigured. */
export async function GET(request: NextRequest) {
  const config = oidcConfig();
  if (!config) return new NextResponse(null, { status: 404 });
  const session = await readSession(config, request.cookies.get(SESSION_COOKIE)?.value);
  const headers = { 'Cache-Control': 'no-store' };
  return session
    ? NextResponse.json(session, { headers })
    : NextResponse.json({ error: 'not signed in' }, { status: 401, headers });
}
