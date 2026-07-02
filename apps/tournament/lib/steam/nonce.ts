import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * CSRF nonce for the Steam OpenID flow (AC4).
 *
 * OpenID 2.0 has no native `state`/nonce, so we mint our own: a random value plus an
 * HMAC-SHA256 signature over it (keyed by a server-only secret). The token is set as a
 * signed, httpOnly, SameSite=Lax cookie AND round-tripped through `openid.return_to`.
 * The callback requires the returned nonce to equal the cookie AND the signature to
 * verify — an attacker who cannot read the cookie cannot forge a matching return.
 */

function sign(raw: string, secret: string): string {
  return createHmac('sha256', secret).update(raw).digest('hex');
}

/** Mint a fresh signed nonce token of the form `<raw>.<hmac>`. */
export function mintNonce(secret: string): string {
  const raw = randomBytes(16).toString('hex');
  return `${raw}.${sign(raw, secret)}`;
}

/** Constant-time verification that a token was signed by `secret` and is well-formed. */
export function verifyNonce(token: string | undefined, secret: string): boolean {
  if (!token) return false;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return false;
  const raw = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(raw, secret);
  // Compare as hex buffers of equal length; timingSafeEqual throws on length mismatch.
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
