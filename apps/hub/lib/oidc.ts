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
 *
 * Sign-out (Story 5.5, FR-22): the Hub's own sign-out ends every Hub session of the subject and follows the
 * issuer's `end_session_endpoint` when discovery advertises one (RP-Initiated Logout 1.0); a Back-Channel
 * Logout 1.0 token from the issuer ends the sessions it names. A signed cookie cannot be recalled, so a
 * revoked session is refused when it is read (`isRevoked`).
 */
import { createHash, hkdfSync, randomBytes } from 'node:crypto';
import { SignJWT, createRemoteJWKSet, jwtVerify } from 'jose';
import { HUB_ORIGIN } from './registry';

export const SESSION_COOKIE = '__Host-hub-session';
export const TRANSACTION_COOKIE = '__Host-hub-oidc';
export const SESSION_SECONDS = 8 * 60 * 60;
export const TRANSACTION_SECONDS = 10 * 60;
export const REDIRECT_URI = new URL('/auth/callback', HUB_ORIGIN).href;
export const POST_LOGOUT_REDIRECT_URI = new URL('/', HUB_ORIGIN).href;
export const BACKCHANNEL_LOGOUT_EVENT = 'http://schemas.openid.net/event/backchannel-logout';
/** A logout token older than this is refused, so its `jti` need be remembered no longer. */
export const LOGOUT_TOKEN_MAX_AGE_SECONDS = 5 * 60;
const CLOCK_TOLERANCE_SECONDS = 30;
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
  end_session_endpoint?: unknown;
}

/**
 * What this process has revoked. `revoked` maps `sub:<sub>` or `sid:<sid>` to the second it was revoked,
 * and a session issued at or before that second is refused. `epoch` is when this process first read its
 * configuration: a session issued before it is refused, because a revocation made before a restart is not
 * remembered. `jti` holds each accepted logout token's id until the token is too old to be accepted again.
 */
interface Revocations {
  epoch: number;
  revoked: Map<string, number>;
  jti: Map<string, number>;
}

const REVOCATIONS = Symbol.for('cuatro-portfolio.hub.oidc.revocations');
const now = () => Math.floor(Date.now() / 1000);

// ponytail: process memory, shared by every route bundle through globalThis. A restart forgets it and so
// refuses every older session (one sign-in after each rollout); a shared store if the Hub runs >1 process.
function revocations(): Revocations {
  const store = globalThis as { [REVOCATIONS]?: Revocations };
  return (store[REVOCATIONS] ??= { epoch: now(), revoked: new Map(), jti: new Map() });
}

/** Revoke every session issued up to now under each key, and forget revocations older than any session. */
function revoke(keys: string[]) {
  const { revoked } = revocations();
  const at = now();
  for (const [key, when] of revoked) if (when < at - SESSION_SECONDS) revoked.delete(key);
  for (const key of keys) revoked.set(key, at);
}

function isRevoked(sub: string, sid: unknown, iat: number) {
  const { epoch, revoked } = revocations();
  if (iat < epoch) return true;
  const keys = typeof sid === 'string' ? [`sub:${sub}`, `sid:${sid}`] : [`sub:${sub}`];
  return keys.some((key) => {
    const at = revoked.get(key);
    return at !== undefined && iat <= at;
  });
}

export function oidcConfig(): OidcConfig | null {
  const issuer = process.env.OIDC_ISSUER;
  const clientId = process.env.CUATRO_PORTFOLIO_OIDC_CLIENT_ID;
  const clientSecret = process.env.CUATRO_PORTFOLIO_OIDC_CLIENT_SECRET;
  if (!issuer || !clientId || !clientSecret) return null;
  // Fixes the epoch no later than the first session this process mints.
  revocations();
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
    clockTolerance: CLOCK_TOLERANCE_SECONDS,
  });
  if (payload.nonce !== tx.nonce) throw new Error('nonce does not match');
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if ((audiences.length > 1 || payload.azp !== undefined) && payload.azp !== config.clientId)
    throw new Error('azp does not name this client');
  if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('no sub');

  const session: Session & { sid?: string } = { sub: payload.sub };
  if (typeof payload.email === 'string') session.email = payload.email;
  // The issuer's session id, which a Back-Channel logout token may name instead of the subject.
  if (typeof payload.sid === 'string') session.sid = payload.sid;
  return seal({ ...session }, config.key, SESSION_SECONDS, 'session');
}

export async function readSession(config: OidcConfig, cookie: string | undefined): Promise<Session | null> {
  const payload = await unseal(cookie, config.key, 'session');
  if (typeof payload?.sub !== 'string' || typeof payload.iat !== 'number') return null;
  if (isRevoked(payload.sub, payload.sid, payload.iat)) return null;
  return typeof payload.email === 'string' ? { sub: payload.sub, email: payload.email } : { sub: payload.sub };
}

/**
 * The Hub's own sign-out. Every Hub session of the cookie's subject is revoked (FR-22: every session, every
 * device), and the answer is where to send the browser: the issuer's `end_session_endpoint` when discovery
 * advertises one, so the issuer's session ends too, and the Hub's home page when it does not.
 */
export async function signOut(config: OidcConfig, cookie: string | undefined): Promise<URL> {
  const payload = await unseal(cookie, config.key, 'session');
  if (typeof payload?.sub === 'string') revoke([`sub:${payload.sub}`]);
  try {
    const { end_session_endpoint } = await discover(config.issuer);
    if (typeof end_session_endpoint === 'string') {
      const location = new URL(end_session_endpoint);
      location.searchParams.set('client_id', config.clientId);
      location.searchParams.set('post_logout_redirect_uri', POST_LOGOUT_REDIRECT_URI);
      return location;
    }
  } catch (error) {
    console.error('auth sign-out: signed out of the Hub only:', (error as Error).message);
  }
  return new URL(POST_LOGOUT_REDIRECT_URI);
}

/**
 * Back-Channel Logout 1.0 § 2.6: validate a logout token from the issuer, then revoke what it names. A
 * token naming both `sid` and `sub` revokes both, erring toward signed out. Throws on anything that does
 * not hold; the route turns that into a 400, and nothing is revoked.
 */
export async function backchannelLogout(config: OidcConfig, token: unknown): Promise<void> {
  if (typeof token !== 'string') throw new Error('no logout_token');
  const { jwks_uri } = await discover(config.issuer);
  // A compact JWS only: jose refuses a JWE here, and the algorithm list refuses `none` and HS*.
  const { payload } = await jwtVerify(token, createRemoteJWKSet(new URL(jwks_uri)), {
    issuer: config.issuer,
    audience: config.clientId,
    algorithms: ID_TOKEN_ALGORITHMS,
    clockTolerance: CLOCK_TOLERANCE_SECONDS,
    maxTokenAge: LOGOUT_TOKEN_MAX_AGE_SECONDS,
    requiredClaims: ['iat', 'exp', 'jti'],
  });
  const event = (payload.events as Record<string, unknown> | undefined)?.[BACKCHANNEL_LOGOUT_EVENT];
  if (typeof event !== 'object' || event === null || Array.isArray(event)) throw new Error('no back-channel logout event');
  if ('nonce' in payload) throw new Error('a logout token carries no nonce');
  const keys = [
    ...(typeof payload.sub === 'string' && payload.sub ? [`sub:${payload.sub}`] : []),
    ...(typeof payload.sid === 'string' && payload.sid ? [`sid:${payload.sid}`] : []),
  ];
  if (keys.length === 0) throw new Error('neither sub nor sid');
  if (typeof payload.jti !== 'string' || !payload.jti) throw new Error('no jti');

  const { jti } = revocations();
  const at = now();
  for (const [id, until] of jti) if (until < at) jti.delete(id);
  if (jti.has(payload.jti)) throw new Error('a replayed logout token');
  jti.set(payload.jti, at + LOGOUT_TOKEN_MAX_AGE_SECONDS + 2 * CLOCK_TOLERANCE_SECONDS);
  revoke(keys);
}
