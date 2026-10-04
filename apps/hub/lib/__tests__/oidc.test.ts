// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createHash, hkdfSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AddressInfo } from 'node:net';
import { NextRequest } from 'next/server';
import { SignJWT, decodeJwt, exportJWK, generateKeyPair, type CryptoKey, type JWTPayload } from 'jose';
import { GET as signIn } from '@/app/auth/sign-in/route';
import { GET as callback } from '@/app/auth/callback/route';
import { GET as sessionRoute } from '@/app/auth/session/route';
import { GET as signOutRoute } from '@/app/auth/sign-out/route';
import { GET as backchannelGet, POST as backchannelRoute } from '@/app/auth/backchannel-logout/route';
import { BACKCHANNEL_LOGOUT_EVENT, REDIRECT_URI, SESSION_COOKIE, TRANSACTION_COOKIE, oidcConfig } from '@/lib/oidc';

// Story 5.3 (AD-11, FR-23). The Hub's sign-in is driven end to end against a stand-in OIDC issuer on
// loopback: discovery, a JWKS, and a token endpoint that checks client authentication and PKCE the way a
// real issuer does. Nothing here is specific to any provider, and neither is the code under test.

const CLIENT_ID = 'cuatro-portfolio-stand-in';
const CLIENT_SECRET = 'stand-in-secret';

let server: Server;
let issuer: string;
let signingKey: CryptoKey;
let foreignKey: CryptoKey;

/** What a test changes about the stand-in, reset after each test. */
const issuerState = {
  discoveryIssuer: undefined as string | undefined,
  claims: {} as JWTPayload,
  signWithForeignKey: false,
  /** Sign the ID token HS256 with the client secret, the forgery an asymmetric-only allow-list refuses. */
  signWithClientSecret: false,
  /** Story 5.5: whether discovery advertises an end_session_endpoint. */
  endSession: true,
  tokenRequests: [] as { authorization?: string; body: URLSearchParams }[],
  /** code -> what the authorization request bound it to. */
  codes: new Map<string, { challenge: string; method: string; redirectUri: string; clientId: string; nonce: string }>(),
};

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  signingKey = pair.privateKey;
  foreignKey = (await generateKeyPair('RS256')).privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'stand-in', alg: 'RS256', use: 'sig' };

  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', issuer);
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (url.pathname === '/.well-known/openid-configuration')
      return json(200, {
        issuer: issuerState.discoveryIssuer ?? issuer,
        authorization_endpoint: `${issuer}/authorize?prompt=login`,
        token_endpoint: `${issuer}/token`,
        jwks_uri: `${issuer}/jwks`,
        code_challenge_methods_supported: ['S256'],
        ...(issuerState.endSession ? { end_session_endpoint: `${issuer}/end-session?ui=1` } : {}),
        backchannel_logout_supported: true,
        backchannel_logout_session_supported: true,
      });
    if (url.pathname === '/jwks') return json(200, { keys: [jwk] });
    if (url.pathname === '/token' && req.method === 'POST') {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = new URLSearchParams(raw);
      issuerState.tokenRequests.push({ authorization: req.headers.authorization, body });
      const expected = `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`;
      if (req.headers.authorization !== expected) return json(401, { error: 'invalid_client' });
      const bound = issuerState.codes.get(body.get('code') ?? '');
      const verifier = body.get('code_verifier') ?? '';
      if (
        body.get('grant_type') !== 'authorization_code' ||
        !bound ||
        bound.method !== 'S256' ||
        bound.redirectUri !== body.get('redirect_uri') ||
        bound.challenge !== createHash('sha256').update(verifier).digest('base64url')
      )
        return json(400, { error: 'invalid_grant' });
      issuerState.codes.delete(body.get('code') ?? '');
      const now = Math.floor(Date.now() / 1000);
      const claims = { iss: issuer, aud: bound.clientId, sub: 'user_stand_in', iat: now, exp: now + 300, email: 'operator@example.test', nonce: bound.nonce };
      const idToken = issuerState.signWithClientSecret
        ? await new SignJWT({ ...claims, ...issuerState.claims })
            .setProtectedHeader({ alg: 'HS256' })
            .sign(new TextEncoder().encode(CLIENT_SECRET))
        : await new SignJWT({ ...claims, ...issuerState.claims })
            .setProtectedHeader({ alg: 'RS256', kid: 'stand-in' })
            .sign(issuerState.signWithForeignKey ? foreignKey : signingKey);
      return json(200, { access_token: 'opaque', token_type: 'Bearer', id_token: idToken });
    }
    json(404, {});
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((done) => server.close(() => done())));

const configure = () => {
  vi.stubEnv('OIDC_ISSUER', issuer);
  vi.stubEnv('CUATRO_PORTFOLIO_OIDC_CLIENT_ID', CLIENT_ID);
  vi.stubEnv('CUATRO_PORTFOLIO_OIDC_CLIENT_SECRET', CLIENT_SECRET);
  // The first configuration read fixes the process's revocation epoch, as the first request does in the Hub.
  oidcConfig();
};

/** Story 5.5: revocations live in process memory; each test starts with a fresh process's worth. */
const REVOCATIONS = Symbol.for('cuatro-portfolio.hub.oidc.revocations');
const restartProcess = () => delete (globalThis as Record<symbol, unknown>)[REVOCATIONS];

afterEach(() => {
  vi.unstubAllEnvs();
  issuerState.discoveryIssuer = undefined;
  issuerState.claims = {};
  issuerState.signWithForeignKey = false;
  issuerState.signWithClientSecret = false;
  issuerState.endSession = true;
  issuerState.tokenRequests = [];
  restartProcess();
  vi.restoreAllMocks();
  issuerState.codes.clear();
});

/** `name=value` of the Set-Cookie header naming `name`, with the full header beside it. */
function setCookie(response: Response, name: string) {
  const header = response.headers.getSetCookie().find((h) => h.startsWith(`${name}=`));
  return header ? { header, value: header.slice(name.length + 1).split(';')[0] } : undefined;
}

const request = (path: string, cookies: Record<string, string> = {}) =>
  new NextRequest(new URL(path, 'https://cuatro.dev'), {
    headers: { cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ') },
  });

/** Sign-in, then the stand-in's authorization step: answers the callback query and the transaction cookie. */
async function authorize() {
  const response = await signIn();
  expect(response.status).toBe(302);
  const location = new URL(response.headers.get('location') ?? '');
  const p = location.searchParams;
  const code = `code-${issuerState.codes.size + 1}`;
  issuerState.codes.set(code, {
    challenge: p.get('code_challenge') ?? '',
    method: p.get('code_challenge_method') ?? '',
    redirectUri: p.get('redirect_uri') ?? '',
    clientId: p.get('client_id') ?? '',
    nonce: p.get('nonce') ?? '',
  });
  return { location, code, state: p.get('state') ?? '', transaction: setCookie(response, TRANSACTION_COOKIE)?.value ?? '' };
}

const callbackWith = (query: Record<string, string>, transaction?: string) =>
  callback(request(`/auth/callback?${new URLSearchParams(query)}`, transaction === undefined ? {} : { [TRANSACTION_COOKIE]: transaction }));

describe('unconfigured (AC1)', () => {
  it('answers 404 on every /auth route while any variable is missing', async () => {
    for (const missing of ['OIDC_ISSUER', 'CUATRO_PORTFOLIO_OIDC_CLIENT_ID', 'CUATRO_PORTFOLIO_OIDC_CLIENT_SECRET', 'all']) {
      configure();
      if (missing === 'all') vi.unstubAllEnvs();
      else vi.stubEnv(missing, '');
      expect((await signIn()).status, missing).toBe(404);
      expect((await callback(request('/auth/callback?code=x&state=y'))).status, missing).toBe(404);
      expect((await sessionRoute(request('/auth/session'))).status, missing).toBe(404);
      expect((await signOutRoute(request('/auth/sign-out'))).status, missing).toBe(404);
      expect((await backchannelRoute(logoutRequest(new URLSearchParams({ logout_token: 'x' })))).status, missing).toBe(404);
      expect((await backchannelGet()).status, missing).toBe(404);
      vi.unstubAllEnvs();
    }
  });
});

describe('sign-in against a stand-in issuer (AC2)', () => {
  it('redirects to the discovered endpoint with PKCE S256, state and nonce', async () => {
    configure();
    const { location } = await authorize();
    expect(`${location.origin}${location.pathname}`).toBe(`${issuer}/authorize`);
    expect(location.searchParams.get('prompt')).toBe('login');
    expect(Object.fromEntries(location.searchParams)).toMatchObject({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: 'https://cuatro.dev/auth/callback',
      scope: 'openid email profile',
      code_challenge_method: 'S256',
    });
    for (const name of ['state', 'nonce', 'code_challenge']) expect(location.searchParams.get(name)?.length, name).toBeGreaterThanOrEqual(43);
    const again = await authorize();
    expect(again.state).not.toBe(location.searchParams.get('state'));
  });

  it('exchanges the code with the verifier and Basic auth, mints a session and reads it back', async () => {
    configure();
    const { code, state, transaction } = await authorize();
    const response = await callbackWith({ code, state }, transaction);
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://cuatro.dev/');
    const [token] = issuerState.tokenRequests;
    expect(token.body.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(token.body.get('code_verifier')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(token.body.has('client_secret')).toBe(false);

    const session = setCookie(response, SESSION_COOKIE);
    expect(session).toBeDefined();
    expect(setCookie(response, TRANSACTION_COOKIE)?.header).toMatch(/Max-Age=0/i);
    const read = await sessionRoute(request('/auth/session', { [SESSION_COOKIE]: session!.value }));
    expect(read.status).toBe(200);
    expect(read.headers.get('cache-control')).toBe('no-store');
    expect(await read.json()).toEqual({ sub: 'user_stand_in', email: 'operator@example.test' });
  });

  it('answers 502 and sets no cookie when discovery names another issuer', async () => {
    configure();
    issuerState.discoveryIssuer = 'https://elsewhere.example.test';
    const response = await signIn();
    expect(response.status).toBe(502);
    expect(response.headers.getSetCookie()).toEqual([]);
  });
});

describe('every failed callback answers 400 and mints no session (AC3)', () => {
  const cases: [string, (a: Awaited<ReturnType<typeof authorize>>) => Promise<Response> | Response, () => void][] = [
    ['no transaction cookie', (a) => callbackWith({ code: a.code, state: a.state }), () => {}],
    ['a forged transaction cookie', (a) => callbackWith({ code: a.code, state: a.state }, `${a.transaction.slice(0, -4)}AAAA`), () => {}],
    ['a state mismatch', (a) => callbackWith({ code: a.code, state: 'other' }, a.transaction), () => {}],
    ['an error from the issuer', (a) => callbackWith({ error: 'access_denied', state: a.state }, a.transaction), () => {}],
    ['an iss parameter naming another issuer', (a) => callbackWith({ code: a.code, state: a.state, iss: 'https://elsewhere.example.test' }, a.transaction), () => {}],
    ['a code the token endpoint refuses', (a) => callbackWith({ code: 'unknown', state: a.state }, a.transaction), () => {}],
    ['an ID token signed by a key outside the JWKS', (a) => callbackWith({ code: a.code, state: a.state }, a.transaction), () => (issuerState.signWithForeignKey = true)],
    ['an ID token for another audience', (a) => callbackWith({ code: a.code, state: a.state }, a.transaction), () => (issuerState.claims = { aud: 'someone-else' })],
    ['an ID token from another issuer', (a) => callbackWith({ code: a.code, state: a.state }, a.transaction), () => (issuerState.claims = { iss: 'https://elsewhere.example.test' })],
    ['an expired ID token', (a) => callbackWith({ code: a.code, state: a.state }, a.transaction), () => (issuerState.claims = { exp: Math.floor(Date.now() / 1000) - 600 })],
    ['an ID token with another nonce', (a) => callbackWith({ code: a.code, state: a.state }, a.transaction), () => (issuerState.claims = { nonce: 'replayed' })],
    ['an ID token whose azp names another client', (a) => callbackWith({ code: a.code, state: a.state }, a.transaction), () => (issuerState.claims = { azp: 'someone-else' })],
  ];

  it.each(cases)('%s', async (_name, run, arrange) => {
    configure();
    arrange();
    const response = await run(await authorize());
    expect(response.status).toBe(400);
    expect(setCookie(response, SESSION_COOKIE)).toBeUndefined();
  });
});

describe('the session route', () => {
  it('answers 401 without a session, with a forged one, and with a transaction cookie in its place', async () => {
    configure();
    const { transaction } = await authorize();
    for (const value of [undefined, 'not.a.token', transaction]) {
      const response = await sessionRoute(request('/auth/session', value === undefined ? {} : { [SESSION_COOKIE]: value }));
      expect(response.status, String(value)).toBe(401);
    }
  });

  it('answers 401 once the session has expired', async () => {
    configure();
    const a = await authorize();
    const session = setCookie(await callbackWith({ code: a.code, state: a.state }, a.transaction), SESSION_COOKIE)!.value;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 8 * 60 * 60 * 1000 + 1000);
    try {
      expect((await sessionRoute(request('/auth/session', { [SESSION_COOKIE]: session }))).status).toBe(401);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the ID token allow-list is asymmetric only', () => {
  // jose's remote JWKS refuses an HS* token on its own (no `oct` key type), so the status alone cannot
  // tell which gate refused. The message pins it to the allow-list: with HS256 added to
  // ID_TOKEN_ALGORITHMS the refusal becomes jose's 'Unsupported "alg" value for a JSON Web Key Set'.
  it('refuses an ID token signed HS256 with the client secret, at the allow-list', async () => {
    configure();
    issuerState.signWithClientSecret = true;
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = await authorize();
    const response = await callbackWith({ code: a.code, state: a.state }, a.transaction);
    expect(response.status).toBe(400);
    expect(setCookie(response, SESSION_COOKIE)).toBeUndefined();
    expect(logged).toHaveBeenCalledWith('auth callback:', '"alg" (Algorithm) Header Parameter value not allowed');
  });
});

describe('a sealed token passes only for the purpose it was sealed for', () => {
  // The Hub's own cookie key, derived the way oidc.ts derives it. Each token below carries the fields
  // of the purpose it is presented for, so only the audience check can refuse it.
  const hubKey = () => new Uint8Array(hkdfSync('sha256', CLIENT_SECRET, '', 'cuatro-portfolio hub cookies v1', 32));
  const sealAs = (payload: JWTPayload, purpose: string) =>
    new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setAudience(purpose).setIssuedAt().setExpirationTime('600s').sign(hubKey());

  it('refuses a transaction-sealed token carrying a sub as a session', async () => {
    configure();
    const token = await sealAs({ sub: 'user_stand_in', state: 's', nonce: 'n', verifier: 'v' }, 'transaction');
    expect((await sessionRoute(request('/auth/session', { [SESSION_COOKIE]: token }))).status).toBe(401);
    expect((await sessionRoute(request('/auth/session', { [SESSION_COOKIE]: await sealAs({ sub: 'user_stand_in' }, 'session') }))).status).toBe(200);
  });

  it('refuses a session-sealed token carrying a valid state, nonce and verifier as a transaction', async () => {
    configure();
    const a = await authorize();
    const { state, nonce, verifier } = decodeJwt(a.transaction);
    const token = await sealAs({ sub: 'user_stand_in', state, nonce, verifier }, 'session');
    const response = await callbackWith({ code: a.code, state: a.state }, token);
    expect(response.status).toBe(400);
    expect(setCookie(response, SESSION_COOKIE)).toBeUndefined();
  });
});

describe('host-only cookies (AC4)', () => {
  it('every cookie the Hub sets is __Host-, Secure, HttpOnly, Path=/ and has no Domain', async () => {
    configure();
    const signInResponse = await signIn();
    const a = await authorize();
    const ok = await callbackWith({ code: a.code, state: a.state }, a.transaction);
    const failed = await callbackWith({ code: 'unknown', state: 'x' }, a.transaction);
    const headers = [signInResponse, ok, failed].flatMap((r) => r.headers.getSetCookie());
    expect(headers.length).toBe(4);
    for (const header of headers) {
      expect(header, header).toMatch(/^__Host-/);
      expect(header, header).toMatch(/; Secure/i);
      expect(header, header).toMatch(/; HttpOnly/i);
      expect(header, header).toMatch(/; Path=\/(;|$)/i);
      expect(header, header).not.toMatch(/; Domain=/i);
    }
  });

  it('no tracked code in the estate this repository holds sets a cookie Domain of cuatro.dev', () => {
    const found = spawnSync(
      'git',
      ['grep', '-n', '-I', '-i', '-E', `(domain[[:space:]]*[:=][[:space:]]*['"\`]?|Domain=)\\.?cuatro\\.dev(['"\`;[:space:]]|$)`, '--', '*.ts', '*.tsx', '*.js', '*.mjs', '*.cjs', '*.go', '*.ex', '*.exs', '*.yml', '*.yaml', '*.json', '*.conf'],
      { cwd: process.cwd(), encoding: 'utf8' },
    );
    expect(found.error).toBeUndefined();
    expect(found.stdout).toBe('');
    expect(found.status).toBe(1);
  });
});

describe('no provider-specific logic (AC5, FR-23)', () => {
  it('names no identity provider in the module or the routes', () => {
    for (const file of ['apps/hub/lib/oidc.ts', 'apps/hub/app/auth/sign-in/route.ts', 'apps/hub/app/auth/callback/route.ts', 'apps/hub/app/auth/session/route.ts', 'apps/hub/app/auth/sign-out/route.ts', 'apps/hub/app/auth/backchannel-logout/route.ts']) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source, file).not.toMatch(/clerk|auth0|okta|cognito|keycloak|zitadel|authentik|google|github|azure|entra/i);
    }
  });
});

// Story 5.5 (AD-11, FR-22). Sign-out and Back-Channel Logout against the same stand-in issuer, which
// advertises an end_session_endpoint and signs logout tokens with the key it signs ID tokens with.

/** A full sign-in; answers the session cookie's value. `claims` are added to the ID token. */
async function signedIn(claims: JWTPayload = {}) {
  issuerState.claims = claims;
  const a = await authorize();
  const response = await callbackWith({ code: a.code, state: a.state }, a.transaction);
  expect(response.status).toBe(302);
  issuerState.claims = {};
  return setCookie(response, SESSION_COOKIE)!.value;
}

const sessionStatus = async (cookie: string) => (await sessionRoute(request('/auth/session', { [SESSION_COOKIE]: cookie }))).status;

const signOutWith = (cookie: string | undefined, headers: Record<string, string> = { 'sec-fetch-site': 'same-origin' }) =>
  signOutRoute(
    new NextRequest(new URL('/auth/sign-out', 'https://cuatro.dev'), {
      headers: { ...headers, ...(cookie === undefined ? {} : { cookie: `${SESSION_COOKIE}=${cookie}` }) },
    }),
  );

function logoutRequest(body: URLSearchParams | string, contentType = 'application/x-www-form-urlencoded') {
  return new NextRequest(new URL('/auth/backchannel-logout', 'https://cuatro.dev'), {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: body.toString(),
  });
}

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

/** A logout token as Back-Channel Logout 1.0 § 2.4 shapes it, with `claims` merged and `omit` removed. */
async function logoutToken(claims: JWTPayload = {}, omit: string[] = [], how: 'issuer' | 'foreign' | 'secret' | 'none' = 'issuer') {
  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload = {
    iss: issuer,
    aud: CLIENT_ID,
    iat: now,
    exp: now + 120,
    jti: `jti-${Math.random()}`,
    sub: 'user_stand_in',
    events: { [BACKCHANNEL_LOGOUT_EVENT]: {} },
    ...claims,
  };
  for (const name of omit) delete payload[name];
  if (how === 'none') return `${b64({ alg: 'none', typ: 'logout+jwt' })}.${b64(payload)}.`;
  if (how === 'secret')
    return new SignJWT(payload).setProtectedHeader({ alg: 'HS256', typ: 'logout+jwt' }).sign(new TextEncoder().encode(CLIENT_SECRET));
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: 'stand-in', typ: 'logout+jwt' })
    .sign(how === 'foreign' ? foreignKey : signingKey);
}

const postLogout = async (token: string) => backchannelRoute(logoutRequest(new URLSearchParams({ logout_token: token })));

describe("the Hub's own sign-out (Story 5.5, AC2)", () => {
  it('revokes every Hub session of the subject, clears the cookie, and follows the end_session_endpoint', async () => {
    configure();
    const first = await signedIn();
    const second = await signedIn();
    expect(await sessionStatus(first)).toBe(200);

    const response = await signOutWith(first);
    expect(response.status).toBe(302);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const location = new URL(response.headers.get('location') ?? '');
    expect(`${location.origin}${location.pathname}`).toBe(`${issuer}/end-session`);
    expect(Object.fromEntries(location.searchParams)).toEqual({ ui: '1', client_id: CLIENT_ID, post_logout_redirect_uri: 'https://cuatro.dev/' });
    const cleared = setCookie(response, SESSION_COOKIE)?.header ?? '';
    expect(cleared).toMatch(/^__Host-hub-session=;/);
    for (const attribute of [/; Max-Age=0/i, /; Secure/i, /; HttpOnly/i, /; Path=\/(;|$)/i]) expect(cleared).toMatch(attribute);
    expect(cleared).not.toMatch(/; Domain=/i);

    // The cookie it was given, and the subject's other session on another device.
    expect(await sessionStatus(first)).toBe(401);
    expect(await sessionStatus(second)).toBe(401);
  });

  it('signs out of the Hub alone when the issuer advertises no end_session_endpoint, or discovery fails', async () => {
    configure();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const arrange of [() => (issuerState.endSession = false), () => (issuerState.discoveryIssuer = 'https://elsewhere.example.test')]) {
      const session = await signedIn();
      arrange();
      const response = await signOutWith(session);
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('https://cuatro.dev/');
      expect(setCookie(response, SESSION_COOKIE)?.header).toMatch(/Max-Age=0/i);
      expect(await sessionStatus(session)).toBe(401);
      issuerState.endSession = true;
      issuerState.discoveryIssuer = undefined;
    }
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it('refuses a sign-out another site started or a browser prefetched, and revokes nothing', async () => {
    configure();
    const session = await signedIn();
    for (const headers of <Record<string, string>[]>[
      { 'sec-fetch-site': 'cross-site' },
      { 'sec-fetch-site': 'same-site' },
      { 'sec-fetch-site': 'same-origin', 'sec-purpose': 'prefetch' },
      { purpose: 'prefetch' },
    ]) {
      const response = await signOutWith(session, headers);
      expect(response.status, JSON.stringify(headers)).toBe(403);
      expect(response.headers.getSetCookie(), JSON.stringify(headers)).toEqual([]);
    }
    expect(await sessionStatus(session)).toBe(200);
    // A typed URL or a bookmark (`none`), and a client that sends no Fetch Metadata, sign out.
    expect((await signOutWith(session, { 'sec-fetch-site': 'none' })).status).toBe(302);
    expect((await signOutWith(undefined, {})).status).toBe(302);
  });

  it('lets the subject sign in again once the second of the sign-out has passed', async () => {
    configure();
    const old = await signedIn();
    await signOutWith(old);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 1000);
    try {
      const fresh = await signedIn();
      expect(await sessionStatus(fresh)).toBe(200);
      expect(await sessionStatus(old)).toBe(401);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Back-Channel Logout (Story 5.5, AC4)', () => {
  it('a valid logout token naming the subject revokes every session of it, and answers 200 no-store', async () => {
    configure();
    const first = await signedIn();
    const second = await signedIn();
    const response = await postLogout(await logoutToken());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await sessionStatus(first)).toBe(401);
    expect(await sessionStatus(second)).toBe(401);
  });

  it('a logout token naming only a sid revokes the session the issuer gave that sid, and no other', async () => {
    configure();
    const named = await signedIn({ sid: 'sid-a' });
    const other = await signedIn({ sid: 'sid-b' });
    expect((await postLogout(await logoutToken({ sid: 'sid-a' }, ['sub']))).status).toBe(200);
    expect(await sessionStatus(named)).toBe(401);
    expect(await sessionStatus(other)).toBe(200);
  });

  it('a replayed logout token is refused', async () => {
    configure();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const token = await logoutToken({ sid: 'sid-a' }, ['sub']);
    expect((await postLogout(token)).status).toBe(200);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 1000);
    try {
      const session = await signedIn({ sid: 'sid-a' });
      expect((await postLogout(token)).status).toBe(400);
      expect(await sessionStatus(session)).toBe(200);
    } finally {
      vi.useRealTimers();
    }
    expect(logged).toHaveBeenCalledWith('auth back-channel logout:', 'a replayed logout token');
  });

  const now = () => Math.floor(Date.now() / 1000);
  const form = async (claims: JWTPayload = {}, omit: string[] = [], how?: 'foreign' | 'secret' | 'none') =>
    logoutRequest(new URLSearchParams({ logout_token: await logoutToken(claims, omit, how) }));
  const refusals: [string, () => Promise<NextRequest>][] = [
    ['a token signed by a key outside the JWKS', () => form({}, [], 'foreign')],
    ['a token signed HS256 with the client secret', () => form({}, [], 'secret')],
    ['an unsigned token (alg none)', () => form({}, [], 'none')],
    ['an encrypted token (JWE)', async () => logoutRequest(new URLSearchParams({ logout_token: `${b64({ alg: 'dir', enc: 'A256GCM' })}..aXY.Y2lwaGVy.dGFn` }))],
    ['another issuer', () => form({ iss: 'https://elsewhere.example.test' })],
    ['another audience', () => form({ aud: 'someone-else' })],
    ['no iat', () => form({}, ['iat'])],
    ['an iat over five minutes old', () => form({ iat: now() - 400 })],
    ['no exp', () => form({}, ['exp'])],
    ['an exp in the past', () => form({ iat: now() - 120, exp: now() - 60 })],
    ['no jti', () => form({}, ['jti'])],
    ['an empty jti', () => form({ jti: '' })],
    ['no events claim', () => form({}, ['events'])],
    ['events without the back-channel member', () => form({ events: { 'http://schemas.openid.net/event/other': {} } })],
    ['a back-channel member that is not an object', () => form({ events: { [BACKCHANNEL_LOGOUT_EVENT]: true } })],
    ['a nonce', () => form({ nonce: 'n' })],
    ['neither sub nor sid', () => form({}, ['sub'])],
    ['no logout_token', async () => logoutRequest(new URLSearchParams({ other: 'x' }))],
    ['a body that is not a form', async () => logoutRequest(JSON.stringify({ logout_token: await logoutToken() }), 'application/json')],
  ];

  it.each(refusals)('refuses %s with 400, no-store, and revokes nothing', async (_name, build) => {
    configure();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const session = await signedIn({ sid: 'sid-a' });
    const response = await backchannelRoute(await build());
    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'invalid_request' });
    expect(await sessionStatus(session)).toBe(200);
  });

  it('answers a GET 404 while configured: the specification defines POST only', async () => {
    configure();
    expect((await backchannelGet()).status).toBe(404);
  });
});

describe('a restart forgets revocations, so it refuses every older session (Story 5.5, AC6)', () => {
  it('refuses a session minted before this process started', async () => {
    configure();
    const session = await signedIn();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 2000);
    try {
      restartProcess();
      oidcConfig();
      expect(await sessionStatus(session)).toBe(401);
      expect(await sessionStatus(await signedIn())).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });
});
