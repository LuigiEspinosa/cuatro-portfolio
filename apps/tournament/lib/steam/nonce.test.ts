import { describe, it, expect } from 'vitest';
import { mintNonce, verifyNonce } from '@/lib/steam/nonce';

const SECRET = 'test-nonce-secret';

describe('nonce mint/verify (AC4)', () => {
  it('mints a token that verifies with the same secret', () => {
    const token = mintNonce(SECRET);
    expect(verifyNonce(token, SECRET)).toBe(true);
  });

  it('produces a fresh (random) token each time', () => {
    expect(mintNonce(SECRET)).not.toBe(mintNonce(SECRET));
  });

  it('rejects a token signed with a different secret', () => {
    const token = mintNonce(SECRET);
    expect(verifyNonce(token, 'other-secret')).toBe(false);
  });

  it('rejects a tampered signature', () => {
    const token = mintNonce(SECRET);
    const flipped = token.slice(0, -1) + (token.at(-1) === '0' ? '1' : '0');
    expect(verifyNonce(flipped, SECRET)).toBe(false);
  });

  it('rejects a tampered payload', () => {
    const token = mintNonce(SECRET);
    const [, sig] = token.split('.');
    expect(verifyNonce(`deadbeef.${sig}`, SECRET)).toBe(false);
  });

  it('rejects undefined / malformed tokens', () => {
    expect(verifyNonce(undefined, SECRET)).toBe(false);
    expect(verifyNonce('', SECRET)).toBe(false);
    expect(verifyNonce('no-dot-here', SECRET)).toBe(false);
    expect(verifyNonce('.onlysig', SECRET)).toBe(false);
  });
});
