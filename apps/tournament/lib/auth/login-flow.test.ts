import { describe, it, expect, vi } from 'vitest';
import { runSteamLogin, type LoginSideEffects } from '@/lib/auth/login-flow';
import type { CallbackConfig } from '@/lib/steam/callback';
import { mintNonce } from '@/lib/steam/nonce';
import type { SteamVerifier } from '@/lib/steam/openid';

const STEAMID = '76561198000000000';

const CONFIG: CallbackConfig = {
  realm: 'http://localhost:3000',
  returnUrl: 'http://localhost:3000/auth/steam/callback',
  nonceSecret: 'test-secret',
};

const okVerifier: SteamVerifier = { verify: async () => STEAMID };
const failVerifier: SteamVerifier = { verify: async () => null };

function validArgs(verifier: SteamVerifier) {
  const nonce = mintNonce(CONFIG.nonceSecret);
  const params = new URLSearchParams({
    nonce,
    'openid.mode': 'id_res',
    'openid.claimed_id': `https://steamcommunity.com/openid/id/${STEAMID}`,
    'openid.return_to': `${CONFIG.returnUrl}?nonce=${nonce}`,
  });
  return { params, nonceCookie: nonce, verifier, config: CONFIG };
}

function spyEffects(): LoginSideEffects & {
  upsertPlayer: ReturnType<typeof vi.fn>;
  establishSession: ReturnType<typeof vi.fn>;
} {
  return {
    upsertPlayer: vi.fn(async () => {}),
    establishSession: vi.fn(async () => {}),
  };
}

describe('runSteamLogin (AC2, AC3, AC5 / AC7b)', () => {
  it('on success: upserts the player then mints the session, each once', async () => {
    const effects = spyEffects();
    const result = await runSteamLogin(validArgs(okVerifier), effects);

    expect(result).toEqual({ ok: true, steamid64: STEAMID });
    expect(effects.upsertPlayer).toHaveBeenCalledExactlyOnceWith(STEAMID);
    expect(effects.establishSession).toHaveBeenCalledExactlyOnceWith(STEAMID);
  });

  it('fails closed on is_valid:false — NO player write, NO session (AC3)', async () => {
    const effects = spyEffects();
    const result = await runSteamLogin(validArgs(failVerifier), effects);

    expect(result).toEqual({ ok: false, reason: 'invalid_assertion' });
    expect(effects.upsertPlayer).not.toHaveBeenCalled();
    expect(effects.establishSession).not.toHaveBeenCalled();
  });

  it('fails closed on a tampered nonce — NO player write, NO session (AC3)', async () => {
    const effects = spyEffects();
    const args = validArgs(okVerifier);
    // Tamper: swap the returned nonce so it no longer matches the cookie.
    args.params.set('nonce', mintNonce(CONFIG.nonceSecret));

    const result = await runSteamLogin(args, effects);

    expect(result.ok).toBe(false);
    expect(effects.upsertPlayer).not.toHaveBeenCalled();
    expect(effects.establishSession).not.toHaveBeenCalled();
  });
});
