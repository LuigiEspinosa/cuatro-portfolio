import { verifyNonce } from '@/lib/steam/nonce';
import { hasDuplicateOpenidParams, type SteamVerifier } from '@/lib/steam/openid';

/**
 * Pure resolver for the Steam OpenID callback (AC1, AC3, AC4). No side effects: given
 * the request query, the nonce cookie, a (possibly mocked) verifier, and config, it
 * returns either the verified SteamID64 or a fail-closed reason. The route handler and
 * the login-flow orchestrator build on this; tests drive it directly.
 *
 * Order of checks is deliberate so each guard is independently testable:
 *   0. no duplicated openid.* params (HTTP parameter-pollution → id spoofing)
 *   1. nonce present (cookie + returned query param)
 *   2. nonce cookie === returned nonce
 *   3. nonce signature verifies (HMAC, server secret)
 *   4. openid.return_to origin+path === configured return URL
 *   5. return_to is within the configured realm (origin match)
 *   6. Steam check_authentication round-trip → is_valid:true → 17-digit id
 */

export const NONCE_COOKIE = 'steam_openid_nonce';
export const NONCE_QUERY_PARAM = 'nonce';

export interface CallbackConfig {
  realm: string;
  returnUrl: string; // configured STEAM_RETURN_URL (no nonce query)
  nonceSecret: string;
}

export type CallbackResult =
  | { ok: true; steamid64: string }
  | { ok: false; reason: CallbackFailure };

export type CallbackFailure =
  | 'duplicate_openid_params'
  | 'missing_nonce'
  | 'nonce_mismatch'
  | 'nonce_bad_signature'
  | 'return_to_mismatch'
  | 'realm_mismatch'
  | 'invalid_assertion';

function originAndPath(u: string): string | null {
  try {
    const url = new URL(u);
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

function originOf(u: string): string | null {
  try {
    return new URL(u).origin;
  } catch {
    return null;
  }
}

export async function resolveSteamCallback(args: {
  params: URLSearchParams;
  nonceCookie: string | undefined;
  verifier: SteamVerifier;
  config: CallbackConfig;
}): Promise<CallbackResult> {
  const { params, nonceCookie, verifier, config } = args;

  // 0. Reject HTTP parameter pollution up front: a duplicated openid.* key can diverge
  //    between the set validated by Steam and the value we read the identity from. Any
  //    downstream `.get()` (return_to here, claimed_id in the verifier) would be unsafe.
  if (hasDuplicateOpenidParams(params)) {
    return { ok: false, reason: 'duplicate_openid_params' };
  }

  // 1. Both the cookie and the round-tripped query nonce must be present.
  const returnedNonce = params.get(NONCE_QUERY_PARAM) ?? undefined;
  if (!nonceCookie || !returnedNonce) {
    return { ok: false, reason: 'missing_nonce' };
  }

  // 2. They must match exactly.
  if (nonceCookie !== returnedNonce) {
    return { ok: false, reason: 'nonce_mismatch' };
  }

  // 3. The cookie value must carry our valid HMAC signature.
  if (!verifyNonce(nonceCookie, config.nonceSecret)) {
    return { ok: false, reason: 'nonce_bad_signature' };
  }

  // 4. The echoed return_to must match our configured callback (origin + path).
  const returnedReturnTo = params.get('openid.return_to');
  const expected = originAndPath(config.returnUrl);
  const actual = returnedReturnTo ? originAndPath(returnedReturnTo) : null;
  if (!actual || !expected || actual !== expected) {
    return { ok: false, reason: 'return_to_mismatch' };
  }

  // 5. The assertion's return_to must live inside our configured realm.
  const realmOrigin = originOf(config.realm);
  const returnToOrigin = originOf(returnedReturnTo!);
  if (!realmOrigin || !returnToOrigin || realmOrigin !== returnToOrigin) {
    return { ok: false, reason: 'realm_mismatch' };
  }

  // 6. The load-bearing control: Steam-side verification of the assertion.
  const steamid64 = await verifier.verify(params);
  if (!steamid64) {
    return { ok: false, reason: 'invalid_assertion' };
  }

  return { ok: true, steamid64 };
}
