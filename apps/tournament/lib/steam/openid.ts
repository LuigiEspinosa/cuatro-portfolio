/**
 * Steam OpenID 2.0 primitives (AC1) — pure, dependency-free, unit-testable.
 *
 * Steam speaks OpenID 2.0 (NOT OIDC). The ONLY trustworthy way to confirm an
 * assertion is to re-POST the returned params with `openid.mode=check_authentication`
 * and require `is_valid:true` in the response — we NEVER trust `openid.sig` or any raw
 * redirect param locally (AD-12). The HTTP transport is injectable so tests never hit
 * the live Steam service.
 */

export const STEAM_OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login';
const OPENID_NS = 'http://specs.openid.net/auth/2.0';
const IDENTIFIER_SELECT = 'http://specs.openid.net/auth/2.0/identifier_select';

/** Hard timeout for outbound calls to Steam on the auth path — never a hung invocation. */
const STEAM_HTTP_TIMEOUT_MS = 10_000;

// Claimed id is exactly `https://steamcommunity.com/openid/id/<17 digits>`.
const CLAIMED_ID_RE = /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;

/** Build the `checkid_setup` redirect to Steam's OpenID endpoint (Task 2 / AC4). */
export function buildLoginUrl(params: { realm: string; returnTo: string }): string {
  const url = new URL(STEAM_OPENID_ENDPOINT);
  url.searchParams.set('openid.ns', OPENID_NS);
  url.searchParams.set('openid.mode', 'checkid_setup');
  // identifier_select: we don't know the user's id yet; Steam fills claimed_id/identity.
  url.searchParams.set('openid.claimed_id', IDENTIFIER_SELECT);
  url.searchParams.set('openid.identity', IDENTIFIER_SELECT);
  url.searchParams.set('openid.return_to', params.returnTo);
  url.searchParams.set('openid.realm', params.realm);
  return url.toString();
}

/**
 * Extract the 17-digit SteamID64 from a *verified* claimed_id (AC1). Kept as a `text`
 * string end-to-end — never parsed into a JS Number (>2^53 loses precision). Returns
 * null if the id is not exactly 17 digits in the expected Steam URL shape.
 */
export function extractSteamId64(claimedId: string): string | null {
  const match = CLAIMED_ID_RE.exec(claimedId.trim());
  return match ? match[1] : null;
}

/** Parse Steam's `key:value\n` key-value response body into a map. */
export function parseKeyValueBody(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return out;
}

/**
 * True if any `openid.*` key appears more than once — an HTTP parameter-pollution attempt.
 * A duplicated `openid.claimed_id` would otherwise diverge between the value we validate
 * with Steam (`URLSearchParams.set` → last wins) and the value we read the identity from
 * (`.get()` → first wins), letting a genuine assertion be trusted under a spoofed id.
 * The callback rejects such requests before doing anything else.
 */
export function hasDuplicateOpenidParams(params: URLSearchParams): boolean {
  const seen = new Set<string>();
  for (const key of params.keys()) {
    if (!key.startsWith('openid.')) continue;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

/** Injectable HTTP transport (POST form-encoded, return raw body text). */
export type HttpPost = (url: string, body: URLSearchParams) => Promise<string>;

const defaultPost: HttpPost = async (url, body) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(STEAM_HTTP_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`check_authentication HTTP ${res.status}`);
  }
  return res.text();
};

export interface SteamVerifier {
  /** Returns the verified SteamID64, or null if the assertion is not genuine. */
  verify(params: URLSearchParams): Promise<string | null>;
}

/**
 * The load-bearing control (AC1/AD-12): re-POST all received `openid.*` params with
 * `openid.mode=check_authentication`; require `is_valid:true`; only then trust the
 * claimed_id and convert it to a SteamID64.
 */
export function createSteamVerifier(post: HttpPost = defaultPost): SteamVerifier {
  return {
    async verify(params) {
      const body = new URLSearchParams();
      for (const [key, value] of params) {
        if (key.startsWith('openid.')) body.set(key, value);
      }
      // Override mode: we are validating, not initiating.
      body.set('openid.mode', 'check_authentication');

      const responseText = await post(STEAM_OPENID_ENDPOINT, body);
      const parsed = parseKeyValueBody(responseText);
      if (parsed['is_valid'] !== 'true') {
        return null; // tampered / replayed / is_valid:false → fail closed
      }

      // Steam confirmed the assertion. Read claimed_id from the EXACT set we validated
      // (`body`), never from the raw `params` — otherwise a duplicated openid.claimed_id
      // could diverge (get()=first, set()=last) and be trusted under a spoofed id. The
      // callback also rejects duplicated openid.* params outright (hasDuplicateOpenidParams).
      const claimedId = body.get('openid.claimed_id') ?? '';
      return extractSteamId64(claimedId);
    },
  };
}
