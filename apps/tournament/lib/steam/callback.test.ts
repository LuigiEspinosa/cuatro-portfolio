import { describe, it, expect } from 'vitest';
import { resolveSteamCallback, type CallbackConfig } from '@/lib/steam/callback';
import { mintNonce } from '@/lib/steam/nonce';
import type { SteamVerifier } from '@/lib/steam/openid';

const STEAMID = '76561198000000000';
const CLAIMED = `https://steamcommunity.com/openid/id/${STEAMID}`;

const CONFIG: CallbackConfig = {
  realm: 'http://localhost:3000',
  returnUrl: 'http://localhost:3000/auth/steam/callback',
  nonceSecret: 'test-secret',
};

/** A verifier that always confirms (Steam-side check is exercised in openid.test.ts). */
const okVerifier: SteamVerifier = { verify: async () => STEAMID };
/** A verifier that fails closed (models is_valid:false / non-17-digit id). */
const failVerifier: SteamVerifier = { verify: async () => null };

function callbackParams(opts: {
  nonce?: string;
  returnTo?: string;
  claimed?: string;
}): URLSearchParams {
  const p = new URLSearchParams();
  if (opts.nonce !== undefined) p.set('nonce', opts.nonce);
  p.set('openid.mode', 'id_res');
  p.set('openid.claimed_id', opts.claimed ?? CLAIMED);
  if (opts.returnTo !== undefined) p.set('openid.return_to', opts.returnTo);
  return p;
}

describe('resolveSteamCallback (AC1, AC3, AC4 / AC7b,c)', () => {
  it('accepts a fully valid callback and returns the SteamID64', async () => {
    const nonce = mintNonce(CONFIG.nonceSecret);
    const result = await resolveSteamCallback({
      params: callbackParams({ nonce, returnTo: `${CONFIG.returnUrl}?nonce=${nonce}` }),
      nonceCookie: nonce,
      verifier: okVerifier,
      config: CONFIG,
    });
    expect(result).toEqual({ ok: true, steamid64: STEAMID });
  });

  it('rejects when the nonce cookie is missing', async () => {
    const nonce = mintNonce(CONFIG.nonceSecret);
    const result = await resolveSteamCallback({
      params: callbackParams({ nonce, returnTo: `${CONFIG.returnUrl}?nonce=${nonce}` }),
      nonceCookie: undefined,
      verifier: okVerifier,
      config: CONFIG,
    });
    expect(result).toEqual({ ok: false, reason: 'missing_nonce' });
  });

  it('rejects on nonce mismatch (cookie != returned)', async () => {
    const cookie = mintNonce(CONFIG.nonceSecret);
    const returned = mintNonce(CONFIG.nonceSecret); // different value, also validly signed
    const result = await resolveSteamCallback({
      params: callbackParams({ nonce: returned, returnTo: `${CONFIG.returnUrl}?nonce=${returned}` }),
      nonceCookie: cookie,
      verifier: okVerifier,
      config: CONFIG,
    });
    expect(result).toEqual({ ok: false, reason: 'nonce_mismatch' });
  });

  it('rejects when the nonce signature does not verify (forged)', async () => {
    const forged = 'deadbeef.0000';
    const result = await resolveSteamCallback({
      params: callbackParams({ nonce: forged, returnTo: `${CONFIG.returnUrl}?nonce=${forged}` }),
      nonceCookie: forged,
      verifier: okVerifier,
      config: CONFIG,
    });
    expect(result).toEqual({ ok: false, reason: 'nonce_bad_signature' });
  });

  it('rejects when openid.return_to origin does not match the configured callback', async () => {
    const nonce = mintNonce(CONFIG.nonceSecret);
    const result = await resolveSteamCallback({
      params: callbackParams({
        nonce,
        returnTo: `https://evil.example/auth/steam/callback?nonce=${nonce}`,
      }),
      nonceCookie: nonce,
      verifier: okVerifier,
      config: CONFIG,
    });
    expect(result).toEqual({ ok: false, reason: 'return_to_mismatch' });
  });

  it('rejects when return_to is outside the configured realm', async () => {
    const nonce = mintNonce(CONFIG.nonceSecret);
    // return_to matches returnUrl, but the configured realm is a different origin.
    const result = await resolveSteamCallback({
      params: callbackParams({ nonce, returnTo: `${CONFIG.returnUrl}?nonce=${nonce}` }),
      nonceCookie: nonce,
      verifier: okVerifier,
      config: { ...CONFIG, realm: 'http://other-host:9999' },
    });
    expect(result).toEqual({ ok: false, reason: 'realm_mismatch' });
  });

  it('rejects HTTP parameter pollution — a duplicated openid.claimed_id (id spoofing)', async () => {
    const nonce = mintNonce(CONFIG.nonceSecret);
    // Attacker prepends a spoofed claimed_id before their genuine one: .get() would return
    // the first (spoof) while the verifier validates the last (genuine) with Steam. The
    // guard must reject before either value is ever read.
    const spoof = 'https://steamcommunity.com/openid/id/76561190000000000';
    const params = new URLSearchParams();
    params.set('nonce', nonce);
    params.set('openid.mode', 'id_res');
    params.append('openid.claimed_id', spoof); // first — what .get() picks
    params.append('openid.claimed_id', CLAIMED); // last — what Steam would validate
    params.set('openid.return_to', `${CONFIG.returnUrl}?nonce=${nonce}`);
    const result = await resolveSteamCallback({
      params,
      nonceCookie: nonce,
      verifier: okVerifier,
      config: CONFIG,
    });
    expect(result).toEqual({ ok: false, reason: 'duplicate_openid_params' });
  });

  it('fails closed when Steam does not confirm the assertion', async () => {
    const nonce = mintNonce(CONFIG.nonceSecret);
    const result = await resolveSteamCallback({
      params: callbackParams({ nonce, returnTo: `${CONFIG.returnUrl}?nonce=${nonce}` }),
      nonceCookie: nonce,
      verifier: failVerifier,
      config: CONFIG,
    });
    expect(result).toEqual({ ok: false, reason: 'invalid_assertion' });
  });
});
