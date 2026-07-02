import { describe, it, expect, vi } from 'vitest';
import {
  buildLoginUrl,
  createSteamVerifier,
  extractSteamId64,
  parseKeyValueBody,
  STEAM_OPENID_ENDPOINT,
  type HttpPost,
} from '@/lib/steam/openid';

const VALID_ID = '76561198000000000'; // 17 digits
const VALID_CLAIMED = `https://steamcommunity.com/openid/id/${VALID_ID}`;

describe('extractSteamId64 (AC1 / AC7a)', () => {
  it('extracts a 17-digit SteamID64 from a verified claimed_id', () => {
    expect(extractSteamId64(VALID_CLAIMED)).toBe(VALID_ID);
  });

  it('accepts http as well as https', () => {
    expect(extractSteamId64(`http://steamcommunity.com/openid/id/${VALID_ID}`)).toBe(VALID_ID);
  });

  it('rejects a too-short id', () => {
    expect(extractSteamId64('https://steamcommunity.com/openid/id/12345')).toBeNull();
  });

  it('rejects an 18-digit id', () => {
    expect(extractSteamId64(`https://steamcommunity.com/openid/id/${VALID_ID}9`)).toBeNull();
  });

  it('rejects a non-Steam host (spoofed claimed_id)', () => {
    expect(extractSteamId64(`https://evil.com/openid/id/${VALID_ID}`)).toBeNull();
  });

  it('rejects garbage', () => {
    expect(extractSteamId64('not-a-url')).toBeNull();
  });
});

describe('parseKeyValueBody', () => {
  it('parses Steam key:value lines', () => {
    const parsed = parseKeyValueBody('ns:http://specs.openid.net/auth/2.0\nis_valid:true\n');
    expect(parsed['is_valid']).toBe('true');
  });
});

describe('buildLoginUrl (AC4)', () => {
  it('builds a checkid_setup redirect with realm + return_to bound', () => {
    const url = new URL(
      buildLoginUrl({ realm: 'http://localhost:3000', returnTo: 'http://localhost:3000/auth/steam/callback?nonce=x' }),
    );
    expect(url.origin + url.pathname).toBe(STEAM_OPENID_ENDPOINT);
    expect(url.searchParams.get('openid.mode')).toBe('checkid_setup');
    expect(url.searchParams.get('openid.ns')).toBe('http://specs.openid.net/auth/2.0');
    expect(url.searchParams.get('openid.claimed_id')).toBe(
      'http://specs.openid.net/auth/2.0/identifier_select',
    );
    expect(url.searchParams.get('openid.realm')).toBe('http://localhost:3000');
    expect(url.searchParams.get('openid.return_to')).toBe(
      'http://localhost:3000/auth/steam/callback?nonce=x',
    );
  });
});

describe('createSteamVerifier (AC1 / AC7b)', () => {
  function paramsFor(claimed: string): URLSearchParams {
    return new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'id_res',
      'openid.claimed_id': claimed,
      'openid.identity': claimed,
      'openid.sig': 'AAAA',
      nonce: 'top-level-nonce.sig', // must NOT be forwarded to check_authentication
    });
  }

  it('returns the SteamID64 when Steam confirms is_valid:true', async () => {
    const post: HttpPost = async () => 'ns:http://specs.openid.net/auth/2.0\nis_valid:true\n';
    const verifier = createSteamVerifier(post);
    expect(await verifier.verify(paramsFor(VALID_CLAIMED))).toBe(VALID_ID);
  });

  it('fails closed (null) when is_valid:false (tampered/replayed)', async () => {
    const post: HttpPost = async () => 'ns:http://specs.openid.net/auth/2.0\nis_valid:false\n';
    const verifier = createSteamVerifier(post);
    expect(await verifier.verify(paramsFor(VALID_CLAIMED))).toBeNull();
  });

  it('fails closed even when is_valid:true but claimed_id is not a 17-digit Steam id', async () => {
    const post: HttpPost = async () => 'is_valid:true\n';
    const verifier = createSteamVerifier(post);
    expect(await verifier.verify(paramsFor('https://steamcommunity.com/openid/id/999'))).toBeNull();
  });

  it('re-POSTs all openid.* params with mode=check_authentication and drops non-openid params', async () => {
    const post = vi.fn<HttpPost>(async () => 'is_valid:true\n');
    const verifier = createSteamVerifier(post);
    await verifier.verify(paramsFor(VALID_CLAIMED));

    expect(post).toHaveBeenCalledOnce();
    const [url, body] = post.mock.calls[0];
    expect(url).toBe(STEAM_OPENID_ENDPOINT);
    expect(body.get('openid.mode')).toBe('check_authentication');
    expect(body.get('openid.sig')).toBe('AAAA');
    expect(body.get('openid.claimed_id')).toBe(VALID_CLAIMED);
    expect(body.get('nonce')).toBeNull(); // our CSRF nonce is never sent to Steam
  });
});
