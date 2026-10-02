// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AddressInfo } from 'node:net';
import { NextRequest } from 'next/server';
import { SignJWT, exportJWK, generateKeyPair, type CryptoKey, type JWTPayload } from 'jose';
import { GET as signIn } from '@/app/auth/sign-in/route';
import { GET as callback } from '@/app/auth/callback/route';
import { GET as sessionRoute } from '@/app/auth/session/route';
import { REDIRECT_URI, SESSION_COOKIE, TRANSACTION_COOKIE } from '@/lib/oidc';

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
      const idToken = await new SignJWT({ ...claims, ...issuerState.claims })
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
};

afterEach(() => {
  vi.unstubAllEnvs();
  issuerState.discoveryIssuer = undefined;
  issuerState.claims = {};
  issuerState.signWithForeignKey = false;
  issuerState.tokenRequests = [];
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
    for (const file of ['apps/hub/lib/oidc.ts', 'apps/hub/app/auth/sign-in/route.ts', 'apps/hub/app/auth/callback/route.ts', 'apps/hub/app/auth/session/route.ts']) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source, file).not.toMatch(/clerk|auth0|okta|cognito|keycloak|zitadel|authentik|google|github|azure|entra/i);
    }
  });
});
