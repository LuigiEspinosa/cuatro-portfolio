import { NextResponse, type NextRequest } from 'next/server';
import { backchannelLogout, oidcConfig } from '@/lib/oidc';

/**
 * Story 5.5: the Back-Channel Logout URI. The issuer POSTs a `logout_token`; 200 once the sessions it names
 * are revoked, 400 and nothing revoked when it fails validation. 404 while unconfigured.
 */
export async function POST(request: NextRequest) {
  const config = oidcConfig();
  if (!config) return new NextResponse(null, { status: 404 });
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const form = await request.formData();
    await backchannelLogout(config, form.get('logout_token'));
    return new NextResponse(null, { status: 200, headers });
  } catch (error) {
    console.error('auth back-channel logout:', (error as Error).message);
    return NextResponse.json({ error: 'invalid_request' }, { status: 400, headers });
  }
}

/** The specification defines POST only. A GET answers 404 with no body, configured or not. */
export function GET() {
  return new NextResponse(null, { status: 404 });
}
