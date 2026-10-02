/**
 * The Hub's OIDC relying party (Story 5.3, AD-11, FR-23).
 *
 * Authorization Code + PKCE against the one issuer `OIDC_ISSUER` names, as the confidential client
 * `cuatro-portfolio` (`ops/identity-issuer.md` § The clients). Everything about the issuer is read from
 * its discovery document, so pointing the Hub at another issuer is a change of the three variables
 * below and nothing else (Story 5.7).
 *
 * The Hub mints its own session: a signed cookie with the `__Host-` prefix, so the browser refuses it a
 * `Domain` and no sibling subdomain can set or read it. No cookie the Hub writes ever carries `Domain`.
 *
 * With any of the three variables unset the Hub is unconfigured: `oidcConfig()` answers `null` and every
 * `/auth` route answers 404, which is how `main` deploys before the issuer exists.
 */
import { createHash, hkdfSync, randomBytes } from 'node:crypto';
import { SignJWT, createRemoteJWKSet, jwtVerify } from 'jose';
import { HUB_ORIGIN } from './registry';

export const SESSION_COOKIE = '__Host-hub-session';
export const TRANSACTION_COOKIE = '__Host-hub-oidc';
export const SESSION_SECONDS = 8 * 60 * 60;
export const TRANSACTION_SECONDS = 10 * 60;
export const REDIRECT_URI = new URL('/auth/callback', HUB_ORIGIN).href;
export const SCOPE = 'openid email profile';

/** Asymmetric only: a symmetric algorithm would let anyone holding the client secret forge an ID token. */
const ID_TOKEN_ALGORITHMS = ['RS256', 'PS256', 'ES256', 'EdDSA'];
/** A hung issuer fails the request rather than holding it open. */
const ISSUER_TIMEOUT_MS = 10_000;

export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  /** Signs the Hub's own cookies. Derived from the client secret, so the Hub holds no second secret. */
  key: Uint8Array;
}

export interface Session {
  sub: string;
  email?: string;
}

interface Transaction {
  state: string;
  nonce: string;
  verifier: string;
}

interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

export function oidcConfig(): OidcConfig | null {
  const issuer = process.env.OIDC_ISSUER;
  const clientId = process.env.CUATRO_PORTFOLIO_OIDC_CLIENT_ID;
  const clientSecret = process.env.CUATRO_PORTFOLIO_OIDC_CLIENT_SECRET;
  if (!issuer || !clientId || !clientSecret) return null;
  const key = new Uint8Array(hkdfSync('sha256', clientSecret, '', 'cuatro-portfolio hub cookies v1', 32));
  return { issuer, clientId, clientSecret, key };
}

/** The attributes every Hub cookie carries. `__Host-` requires `Secure`, `Path=/` and no `Domain`. */
export const cookieOptions = (maxAge: number) =>
  ({ httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge }) as const;

/** OIDC Discovery 1.0 § 4: the document must name the issuer it was fetched for, exactly. */
export async function discover(issuer: string): Promise<Discovery> {
  const response = await fetch(`${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`, {
    signal: AbortSignal.timeout(ISSUER_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`discovery answered ${response.status}`);
  const document = (await response.json()) as Partial<Discovery>;
  if (document.issuer !== issuer) throw new Error('discovery names a different issuer');
  for (const field of ['authorization_endpoint', 'token_endpoint', 'jwks_uri'] as const)
    if (typeof document[field] !== 'string') throw new Error(`discovery has no ${field}`);
  return document as Discovery;
}

const random = () => randomBytes(32).toString('base64url');
const challenge = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

/** A short-lived HS256 token whose audience names its purpose, so a session never passes as a transaction. */
async function seal(payload: Record<string, unknown>, key: Uint8Array, seconds: number, purpose: string) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(purpose)
    .setIssuedAt()
    .setExpirationTime(`${seconds}s`)
    .sign(key);
}

async function unseal(token: string | undefined, key: Uint8Array, purpose: string) {
  if (!token) return null;
  try {
    return (await jwtVerify(token, key, { algorithms: ['HS256'], audience: purpose })).payload;
  } catch {
    return null;
  }
}

/** The authorization request, and the sealed transaction cookie the callback checks it against. */
export async function beginSignIn(config: OidcConfig): Promise<{ location: URL; transaction: string }> {
  const { authorization_endpoint } = await discover(config.issuer);
  const tx: Transaction = { state: random(), nonce: random(), verifier: random() };
  const location = new URL(authorization_endpoint);
  const params = {
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    state: tx.state,
    nonce: tx.nonce,
    code_challenge: challenge(tx.verifier),
    code_challenge_method: 'S256',
  };
  for (const [name, value] of Object.entries(params)) location.searchParams.set(name, value);
  return { location, transaction: await seal({ ...tx }, config.key, TRANSACTION_SECONDS, 'transaction') };
}

/** RFC 6749 § 2.3.1: each half is form-urlencoded before the pair is base64-encoded. */
const formEncode = (value: string) => new URLSearchParams({ v: value }).toString().slice(2);

/**
 * The callback: check the response against the transaction, exchange the code, verify the ID token, and
 * return the sealed session. Throws on anything that does not hold; the route turns that into a 400.
 */
export async function completeSignIn(
  config: OidcConfig,
  params: URLSearchParams,
  transactionCookie: string | undefined,
): Promise<string> {
  const tx = (await unseal(transactionCookie, config.key, 'transaction')) as Partial<Transaction> | null;
  if (!tx?.state || !tx.nonce || !tx.verifier) throw new Error('no valid transaction cookie');
  if (params.has('error')) throw new Error(`the issuer answered ${JSON.stringify(params.get('error'))}`);
  if (params.get('state') !== tx.state) throw new Error('state does not match');
  // RFC 9207: an issuer that names itself in the response must name the configured one.
  if (params.has('iss') && params.get('iss') !== config.issuer) throw new Error('iss does not match');
  const code = params.get('code');
  if (!code) throw new Error('no code');

  const { token_endpoint, jwks_uri } = await discover(config.issuer);
  const response = await fetch(token_endpoint, {
    method: 'POST',
    signal: AbortSignal.timeout(ISSUER_TIMEOUT_MS),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from(`${formEncode(config.clientId)}:${formEncode(config.clientSecret)}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: tx.verifier,
    }),
  });
  if (!response.ok) throw new Error(`the token endpoint answered ${response.status}`);
  const { id_token } = (await response.json()) as { id_token?: unknown };
  if (typeof id_token !== 'string') throw new Error('no id_token');

  // ponytail: the JWKS is fetched on every callback; one sign-in at a time needs no cache.
  const { payload } = await jwtVerify(id_token, createRemoteJWKSet(new URL(jwks_uri)), {
    issuer: config.issuer,
    audience: config.clientId,
    algorithms: ID_TOKEN_ALGORITHMS,
    clockTolerance: 30,
  });
  if (payload.nonce !== tx.nonce) throw new Error('nonce does not match');
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if ((audiences.length > 1 || payload.azp !== undefined) && payload.azp !== config.clientId)
    throw new Error('azp does not name this client');
  if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('no sub');

  const session: Session = { sub: payload.sub };
  if (typeof payload.email === 'string') session.email = payload.email;
  return seal({ ...session }, config.key, SESSION_SECONDS, 'session');
}

export async function readSession(config: OidcConfig, cookie: string | undefined): Promise<Session | null> {
  const payload = await unseal(cookie, config.key, 'session');
  if (typeof payload?.sub !== 'string') return null;
  return typeof payload.email === 'string' ? { sub: payload.sub, email: payload.email } : { sub: payload.sub };
}
