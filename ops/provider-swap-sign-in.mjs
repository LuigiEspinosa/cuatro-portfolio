// Drives one sign-in through a participant of the estate's OIDC, the way a browser behind Traefik would
// (Story 5.7, `ops/identity-issuer.md` § Provider replaceability). Run by `ops/provider-swap.sh` in a
// container on the scratch network, never on the box.
//
//   node provider-swap-sign-in.mjs wait <url>          poll until the URL answers below 500
//   node provider-swap-sign-in.mjs <participant>       hub, cs-tracker or forward-auth
//
// A participant is reached at its public URL's upstream (Traefik's alias), with the public Host and
// X-Forwarded-Proto, as Traefik sends them. The issuer is reached directly, over TLS trusted through
// CA_FILE. At the issuer's login form it posts LOGIN and PASSWORD. It prints one line per step and the
// subject it ends with, and exits 1 at the first step that does not hold. Node's standard library only.
import { readFileSync } from 'node:fs';
import { request as http } from 'node:http';
import { request as https } from 'node:https';

const PARTICIPANTS = {
  hub: {
    client: 'cuatro-portfolio',
    start: 'https://cuatro.dev/auth/sign-in',
    session: 'https://cuatro.dev/auth/session',
    cookie: '__Host-hub-session',
    signedIn: 200,
  },
  'cs-tracker': {
    client: 'cs-tracker',
    start: 'https://cs-tracker.cuatro.dev/auth/sign-in',
    session: 'https://cs-tracker.cuatro.dev/auth/session',
    cookie: '__Host-cs-tracker',
    signedIn: 200,
    // FR-23, DW-326: once OIDC is configured no provider-specific sign-in answers.
    unrouted: ['https://cs-tracker.cuatro.dev/auth/steam'],
  },
  // Traefik's ForwardAuth asks `/` with X-Forwarded-Host and X-Forwarded-Uri; 202 admits the request.
  'forward-auth': {
    client: 'traefik',
    start: 'http://localhost:8080/oauth2/start?rd=%2Fdashboard%2F',
    session: 'http://localhost:8080/oauth2/userinfo',
    gate: 'http://localhost:8080/',
    cookie: '__Host-traefik-dashboard',
    signedIn: 200,
  },
};

const UPSTREAMS = {
  'cuatro.dev': 'http://hub:3000',
  'cs-tracker.cuatro.dev': 'http://cs-tracker:4000',
  'localhost:8080': 'http://forward-auth:4180',
};

const { CA_FILE, LOGIN = 'owner@example.test', PASSWORD = 'password' } = process.env;
const ca = CA_FILE ? readFileSync(CA_FILE) : undefined;
const jar = new Map(); // `host name` -> value; one jar per run, as a fresh browser profile.
const minted = []; // every Set-Cookie line a participant answered, for the attribute checks.

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

/** One request, no redirect followed. Answers status, headers and body. */
function send(method, url, body) {
  const target = new URL(url);
  const upstream = UPSTREAMS[target.host];
  const via = upstream ? new URL(target.pathname + target.search, upstream) : target;
  const cookie = [...jar].filter(([key]) => key.startsWith(`${target.host} `)).map(([key, v]) => `${key.split(' ')[1]}=${v}`);
  const headers = { accept: 'text/html,application/json', ...(cookie.length ? { cookie: cookie.join('; ') } : {}) };
  if (upstream) Object.assign(headers, { host: target.host, 'x-forwarded-host': target.host, 'x-forwarded-proto': target.protocol.slice(0, -1), 'x-forwarded-uri': target.pathname + target.search });
  if (body) Object.assign(headers, { 'content-type': 'application/x-www-form-urlencoded', 'content-length': Buffer.byteLength(body) });
  return new Promise((resolve, reject) => {
    const req = (via.protocol === 'https:' ? https : http)(via, { method, headers, ca, timeout: 15_000 }, (res) => {
      let text = '';
      res.setEncoding('utf8').on('data', (chunk) => (text += chunk)).on('end', () => {
        for (const line of res.headers['set-cookie'] ?? []) {
          const [pair] = line.split(';');
          const at = pair.indexOf('=');
          const name = pair.slice(0, at).trim();
          const value = pair.slice(at + 1);
          if (/;\s*max-age=0\b/i.test(line) || value === '') jar.delete(`${target.host} ${name}`);
          else jar.set(`${target.host} ${name}`, value);
          if (upstream) minted.push({ host: target.host, name, line });
        }
        resolve({ status: res.statusCode, headers: res.headers, body: text });
      });
    });
    req.on('timeout', () => req.destroy(new Error(`${method} ${url} timed out`))).on('error', reject);
    req.end(body);
  });
}

async function wait(url) {
  for (let i = 0; i < 90; i++) {
    try {
      if ((await send('GET', url)).status < 500) return console.log(`ready ${url}`);
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  fail(`${url} never answered`);
}

/** The cookie's attributes as AD-11 wants them on a `__Host-` session: Secure, Path=/, no Domain. */
function checkCookie(host, name) {
  const lines = minted.filter((c) => c.host === host && c.name === name);
  if (lines.length === 0) fail(`${host} set no ${name}`);
  for (const { line } of lines) {
    const attributes = line.split(';').slice(1).map((a) => a.trim().toLowerCase());
    if (attributes.some((a) => a.startsWith('domain'))) fail(`${name} carries a Domain`);
    if (!attributes.includes('secure') || !attributes.includes('path=/') || !attributes.includes('httponly')) fail(`${name} is not Secure, HttpOnly and Path=/: ${attributes.join('; ')}`);
  }
  for (const { name: other, line } of minted) if (/;\s*domain=/i.test(line)) fail(`${other} carries a Domain`);
  console.log(`cookie ${name}: host-only, Secure, HttpOnly, Path=/ on ${host}`);
}

async function signIn(name) {
  const p = PARTICIPANTS[name] ?? fail(`unknown participant ${name}`);
  const host = new URL(p.start).host;

  const before = await send('GET', p.session);
  if (before.status !== 401) fail(`session before sign-in answered ${before.status}, not 401`);
  console.log(`session before sign-in: ${before.status}`);

  const start = await send('GET', p.start);
  let location = start.headers.location;
  if (start.status !== 302 || !location) fail(`sign-in answered ${start.status} without a redirect`);
  const authorize = new URL(location, p.start);
  const q = authorize.searchParams;
  if (q.get('client_id') !== p.client) fail(`authorization request names client ${q.get('client_id')}, not ${p.client}`);
  if (q.get('code_challenge_method') !== 'S256' || !q.get('code_challenge')) fail('authorization request carries no PKCE S256 challenge');
  if (!q.get('state') || !q.get('nonce')) fail('authorization request carries no state or nonce');
  console.log(`sign-in: 302 to ${authorize.origin}${authorize.pathname} client_id=${p.client} code_challenge_method=S256 state nonce`);

  // At the issuer: follow its redirects, posting the login form when one is served, until it sends the
  // browser back to a participant.
  let url = authorize.href;
  for (let hops = 0; hops < 12; hops++) {
    const page = await send('GET', url);
    if (page.status === 200) {
      // A login form (its `login` and `password` fields) or a consent form, whose approving button is
      // pressed, as a person would; hidden fields are sent back as served.
      const form = page.body.match(/<form([^>]*)>([\s\S]*?)<\/form>/i) ?? fail(`the issuer served ${url} with no form`);
      const action = new URL((form[1].match(/action="([^"]*)"/i)?.[1] ?? url).replaceAll('&amp;', '&'), url).href;
      const fields = new URLSearchParams();
      for (const [input] of form[2].matchAll(/<(?:input|button)\b[^>]*>/gi)) {
        const name = input.match(/name="([^"]*)"/i)?.[1];
        const value = input.match(/value="([^"]*)"/i)?.[1] ?? '';
        if (name === 'login') fields.set(name, LOGIN);
        else if (name === 'password') fields.set(name, PASSWORD);
        else if (name && (/type="hidden"/i.test(input) || /approve/i.test(value))) fields.set(name, value);
      }
      const posted = await send('POST', action, fields.toString());
      if (posted.status < 300 || posted.status > 399) fail(`the issuer's login answered ${posted.status}`);
      location = new URL(posted.headers.location, action).href;
    } else if (page.status >= 300 && page.status <= 399) location = new URL(page.headers.location, url).href;
    else fail(`the issuer answered ${page.status} at ${url}`);
    if (UPSTREAMS[new URL(location).host]) break;
    url = location;
  }
  const back = new URL(location);
  if (!UPSTREAMS[back.host] || !back.searchParams.get('code')) fail(`the issuer never sent the browser back with a code (${back.origin}${back.pathname})`);
  console.log(`issuer: signed in as ${LOGIN}, back to ${back.origin}${back.pathname} with a code`);

  const callback = await send('GET', back.href);
  if (callback.status !== 302) fail(`callback answered ${callback.status}: ${callback.body.slice(0, 200)}`);
  console.log(`callback: ${callback.status} to ${callback.headers.location}`);
  checkCookie(host, p.cookie);

  const after = await send('GET', p.session);
  if (after.status !== p.signedIn) fail(`session after sign-in answered ${after.status}`);
  const who = JSON.parse(after.body);
  console.log(`session after sign-in: ${after.status} ${JSON.stringify(who)}`);
  if (p.gate) {
    const gate = await send('GET', p.gate);
    if (gate.status !== 202) fail(`the ForwardAuth check answered ${gate.status}, not 202`);
    console.log(`forwardAuth check with the session: ${gate.status}`);
  }
  for (const path of p.unrouted ?? []) {
    const answer = await send('GET', path);
    if (answer.status !== 404) fail(`${path} answered ${answer.status}, not 404`);
    console.log(`${new URL(path).pathname}: 404`);
  }
  if (who.sub) console.log(`sub=${who.sub}`);
  if (who.email) console.log(`email=${who.email}`);
}

const [mode, arg] = process.argv.slice(2);
await (mode === 'wait' ? wait(arg) : signIn(mode));
