// The scheduled Registry verification, Story 2.23 (AD-16, AD-18, FR-32).
//
// One job, off the box, reads the committed `contracts/registry.json` and holds
// its claims to reality: every `source` exists (authenticated, through
// api.github.com) and resolves anonymously, except where `ops/known-violations.md`
// KV-2 tolerates a private one; every `live` answers 2xx or 3xx at the first
// hop; every `token_contract` equals the `Contract vX.Y.Z` header of the
// vendored `cuatro-contracts/tokens.css` at the path `ops/contract-adoption.md`
// records for that adopter; and, from Story 5.11 (AD-12, AD-13, FR-24, FR-27),
// every `demo` and `identity` declaration matches what an anonymous Visitor meets
// at the entry's `live` host, backed for `demo-account` and `oidc` by the dated
// observation in its ops record. A failure fails the run, which mails the Operator.
//
// Pure exports plus a thin `main`. `verify` takes the fetcher as an argument and
// `main` takes the fetcher and the environment with defaults, so the suite
// plants both; nothing here reads the network on import. `node:` builtins and
// the two sibling modules only, because the job installs nothing. Exit 0 every
// check passed, 1 a check failed, 2 a defect: the secret absent, the Registry
// or a record unreadable or malformed, or the job summary unwritable. See
// `ops/registry-verification.md`.

import { appendFileSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HEADER_PATTERN,
  RECORD_REL as ADOPTION_REL,
  SEMVER,
  adopterRows,
  section,
  table,
  unticked,
} from './contract-adoption.mjs';
import { printable } from './registry-schema.mjs';

/** Where this job's record lives, relative to the repository root. The script parses its KV-2 table. */
export const RECORD_REL = 'ops/registry-verification.md';
export const REGISTRY_REL = 'contracts/registry.json';

/** The repository secret carrying the fine-grained PAT. Read from the environment, never printed. */
export const SECRET = 'REGISTRY_VERIFICATION_TOKEN';

/** Named so `ops/bot-mitigation.md` can record it and a rule edit cannot silently redden the live check. */
export const USER_AGENT = 'cuatro-registry-verification/1 (+https://cuatro.dev/contracts/registry.json)';

export const TIMEOUT_MS = 15_000;
export const API = 'https://api.github.com';

/** The heading of the record's table of sources tolerated to answer 404 anonymously (KV-2). */
export const TOLERATED_HEADING = 'Sources tolerated to answer 404 anonymously';

/** The two records whose dated rows stand behind an `oidc` or a `demo-account` declaration. */
export const IDENTITY_REL = 'ops/identity-issuer.md';
export const DEMO_REL = 'ops/demo-principal.md';

/** The estate's one demo principal (AD-13), which an application's own sign-in page names (FR-25). */
export const DEMO_PRINCIPAL = 'demo@cuatro.dev';

/** Same-origin redirects followed from `live` to the sign-in page a `demo-account` entry must carry. */
export const MAX_HOPS = 5;

/**
 * The person's observation each declaration stands on (NFR-9, AD-12): a row of a Pending Operator
 * actions table whose last cell, Completed (UTC), carries a date once the step is done. `oidc` rests on
 * the live sign-in observed (H3 for the Hub, CT5 for one identity across the boundary); `demo-account`
 * on the reset run live and the demo account signed in (DR1 to DR3). An entry declaring either value
 * and named here by nothing fails: adding a participant is an edit here, in one change with its record row.
 */
export const OBSERVED_BY = {
  oidc: { 'cuatro-portfolio': [IDENTITY_REL, 'H3'], 'cs-tracker': [IDENTITY_REL, 'CT5'] },
  'demo-account': { 'cuatro-tracker': [DEMO_REL, 'DR1'], 'cs-tracker': [DEMO_REL, 'DR2'], 'digital-library': [DEMO_REL, 'DR3'] },
};

/**
 * `identity: wallet` is a structural exemption, not an unimplemented sign-in (AD-12, FR-24), recorded for
 * the one entry AD-12 names. Any other entry declaring it fails, and so does this one declaring otherwise.
 */
export const WALLET_EXEMPT = {
  maicoin:
    'its identity is a wallet signature on a test network, so there is no user record for an issuer to own (AD-12, FR-24)',
};

/**
 * A `source` on github.com in one of the two shapes the API can look up: owner
 * and repository, or those followed by `/tree/<branch>/<path>` (DW-285, Operator
 * ruling 2026-09-29), which names a directory of the Anchor an absorbed
 * application's code now lives in. A trailing slash is allowed; no `.git`, no
 * branch with a slash, no `.` or `..` segment (a fetch would normalise it into
 * another URL), no query and no fragment. A github.com URL of any other shape
 * fails `source exists` by name rather than being skipped. Groups: owner,
 * repository, then branch and path when the URL names a tree.
 */
export const GITHUB_SOURCE =
  /^https:\/\/github\.com\/([A-Za-z0-9-]+)\/(?![^/]*\.git(?:\/|$))([A-Za-z0-9_.-]+)(?:\/tree\/(?!\.\.?(?:\/|$))([A-Za-z0-9_.-]+)\/((?:(?!\.\.?(?:\/|$))[A-Za-z0-9_.-]+\/)*(?!\.\.?\/?$)[A-Za-z0-9_.-]+))?\/?$/;
const ON_GITHUB = /^https:\/\/github\.com(\/|$)/;

/**
 * @typedef {{ id: string, source: string, status: string, live?: string, token_contract?: string, [key: string]: unknown }} Entry
 * @typedef {{ applications: Entry[] }} Registry
 * @typedef {(url: string, init?: RequestInit) => Promise<Response>} Fetcher
 * @typedef {{ id: string, check: string, pass: boolean, detail: string }} Row
 */

// ---------------------------------------------------------------------------
// The records
// ---------------------------------------------------------------------------

/**
 * The KV-2 table of the record: one row per repository whose `source` may
 * answer 404 to an anonymous reader. A row whose Ruling begins `Struck`, in
 * any case and behind any bold, italic or strikethrough markup, stays in the
 * table as history and tolerates nothing. Throws on zero rows, so the
 * tolerance list is never an empty parse of a table that went missing.
 */
export function kv2Rows(record) {
  const parsed = table(section(record, TOLERATED_HEADING), 'Repository');
  const repository = parsed.headers.indexOf('Repository');
  const ruling = parsed.headers.indexOf('Ruling');
  const since = parsed.headers.indexOf('Since');
  if (repository === -1 || ruling === -1 || since === -1) {
    throw new Error(`the tolerated-sources table lacks one of Repository, Ruling, Since: ${parsed.headers.join(' | ')}`);
  }
  if (parsed.rows.length === 0) throw new Error('the tolerated-sources table has zero rows, so nothing was recorded');
  return parsed.rows.map((row) => ({
    repository: unticked(row[repository]),
    ruling: row[ruling],
    since: row[since],
    // Not `\b` after the word: `_Struck_` has a word character next, and an
    // unrecognised struck row tolerates a 404 it should not, which is fail-open.
    struck: /^[\s*_~]*struck(?![a-z])/i.test(row[ruling]),
  }));
}

/**
 * The last path segment of a `source` URL, which is the repository name `ops/contract-adoption.md` keys its
 * rows on. A tree source (DW-285) yields its directory, which no row names, so a `token_contract` declared on
 * one fails as "no recorded target" rather than reading the repository's own header.
 */
const repositoryName = (source) => String(source).replace(/\/+$/, '').split('/').pop() ?? '';

/**
 * The vendored `tokens.css` the record names for an entry: the `File read`
 * cell of the adopted-versions row whose Application equals the last segment
 * of `source`, a leading `./` or `/` stripped and every segment URL-encoded so
 * a `?`, `#` or space in the cell can neither truncate nor redirect the
 * contents URL. `path` is null, with the reason, when the record names no
 * target, so a `token_contract` declared by an adopter the record does not
 * know fails by name rather than reading a guessed path (AD-14, AD-16).
 *
 * @param {Entry} entry
 * @param {ReturnType<typeof adopterRows>} adopters
 * @returns {{ application: string, path: string | null, reason: string | null }}
 */
export function vendoredTarget(entry, adopters) {
  const application = repositoryName(entry.source);
  const row = adopters.find((r) => r.application === application);
  if (row === undefined) {
    return { application, path: null, reason: `${ADOPTION_REL} carries no adopted-versions row for ${application}` };
  }
  if (row.path === 'none' || !SEMVER.test(row.version)) {
    return {
      application,
      path: null,
      reason: `${ADOPTION_REL} records ${application} as "${row.version}" with File read "${row.path}"`,
    };
  }
  const path = row.path
    .replace(/^(\.\/|\/)+/, '')
    .split('/')
    .map(encodeURIComponent)
    .join('/');
  return { application, path, reason: null };
}

/**
 * Every row `OBSERVED_BY` names, read out of its record: the Completed (UTC) cell, and whether it
 * begins with an ISO date (behind any bold or italic markup). Throws when a record is missing or a
 * row is absent or carried twice, so a renamed action is a defect of the run on the day it happens,
 * not on the day an entry first declares the value.
 *
 * @param {Record<string, string | undefined>} observed record text by repository-relative path
 * @returns {Map<string, { cell: string, dated: boolean }>} keyed `<path> <action>`
 */
export function observations(observed) {
  const found = new Map();
  for (const byId of Object.values(OBSERVED_BY)) {
    for (const [rel, action] of Object.values(byId)) {
      const text = observed?.[rel];
      if (typeof text !== 'string') throw new Error(`${rel} was not read, so no declaration it backs can be verified`);
      const rows = text.split(/\r?\n/).filter((line) => new RegExp(`^\\|\\s*${action}\\s*\\|`).test(line));
      if (rows.length !== 1) throw new Error(`${rel} carries ${rows.length} rows for action ${action}, not one`);
      const cells = rows[0].split('|').slice(1, -1).map((cell) => cell.trim());
      const cell = cells.at(-1) ?? '';
      found.set(`${rel} ${action}`, { cell, dated: /^[\s*_]*\d{4}-\d{2}-\d{2}/.test(cell) });
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// The network
// ---------------------------------------------------------------------------

/**
 * What one answer means. 2xx or 3xx at the first hop resolves; 404 is absent;
 * anything else, a network error included, is unreachable. Both of the last
 * two fail. See `ops/registry-verification.md` § What resolves means.
 *
 * @param {{ status: number } | null} response
 * @returns {'resolves' | 'absent' | 'unreachable'}
 */
export function classify(response) {
  if (response === null) return 'unreachable';
  if (response.status >= 200 && response.status < 400) return 'resolves';
  if (response.status === 404) return 'absent';
  return 'unreachable';
}

/**
 * One GET, redirects not followed, 15 s, one immediate retry on a network
 * error or a 5xx and on nothing else (a 429 is not retried). The last answer
 * decides.
 */
async function get(fetch, url, headers) {
  let response = null;
  let error = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'User-Agent': USER_AGENT, ...headers },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      error = null;
      if (response.status < 500) break;
    } catch (caught) {
      response = null;
      error = caught;
    }
  }
  return { response, error };
}

const message = (error) => (error instanceof Error ? error.message : String(error));

/** How an answer is printed: the status, or the error a fetch threw. Escaped once, where the line is built. */
const answered = ({ response, error }) => (response !== null ? `answered ${response.status}` : `did not answer (${message(error)})`);

// ---------------------------------------------------------------------------
// What a Visitor meets: `demo` and `identity` (Story 5.11)
// ---------------------------------------------------------------------------

const isRedirect = (status) => status >= 300 && status < 400;
const isSuccess = (status) => status >= 200 && status < 300;

/** Where a 3xx points, resolved against the URL that answered it, for a line: origin and path only. */
function target(response, base) {
  const location = response.headers.get('location');
  if (location === null || location === '') return null;
  try {
    return new URL(location, base);
  } catch {
    return null;
  }
}
const shown = (url) => (url === null ? 'no usable Location' : `${url.origin}${url.pathname}`);

/** The dated row an `oidc` or `demo-account` declaration needs, or why it is missing. */
function recorded(value, id, observed) {
  const named = OBSERVED_BY[value][id];
  if (named === undefined) {
    return { ok: false, detail: `no recorded observation names ${id} (OBSERVED_BY in ops/registry-verification.mjs)` };
  }
  const [rel, action] = named;
  const { cell, dated } = observed.get(`${rel} ${action}`);
  return dated
    ? { ok: true, detail: `${rel} ${action} observed ${cell}` }
    : { ok: false, detail: `${rel} ${action} reads "${cell}", so no person has observed it yet (NFR-9)` };
}

/**
 * The sign-in page a Visitor reaches from `live`: same-origin redirects followed from the answer the
 * `live` row already holds, at most `MAX_HOPS`, to a 2xx whose body names the demo principal. A chain
 * that leaves the host is a sign-in page that is not the application's own (FR-25).
 */
async function signInPage(fetch, live, first) {
  const origin = new URL(live).origin;
  let url = live;
  let got = first;
  for (let hop = 0; ; hop += 1) {
    const status = got.response?.status ?? null;
    if (status === null) return { ok: false, detail: `${url} ${answered(got)}` };
    if (isSuccess(status)) {
      let body = null;
      try {
        body = await got.response.text();
      } catch (error) {
        return { ok: false, detail: `${url} answered ${status} and its body was cut: ${message(error)}` };
      }
      return body.includes(DEMO_PRINCIPAL)
        ? { ok: true, detail: `${url} answered ${status} and names ${DEMO_PRINCIPAL}` }
        : { ok: false, detail: `${url} answered ${status} and does not name ${DEMO_PRINCIPAL}, so a Visitor cannot find the demo account (FR-25)` };
    }
    if (!isRedirect(status)) return { ok: false, detail: `${url} answered ${status}` };
    const next = target(got.response, url);
    if (next === null) return { ok: false, detail: `${url} answered ${status} with no usable Location` };
    if (next.origin !== origin) {
      return { ok: false, detail: `${url} answered ${status} to ${next.origin}, off ${origin}, so the sign-in page is not the application's own (FR-25)` };
    }
    if (hop === MAX_HOPS) return { ok: false, detail: `more than ${MAX_HOPS} redirects from ${live}` };
    url = next.href;
    got = await get(fetch, url, {});
  }
}

/**
 * The `demo` row (FR-27, AD-13). `not-deployed` carries no `live`; every other value needs one, so an
 * application the release valve takes offline (FR-28) reads `not-deployed` in the same change. `open`
 * answers 2xx at the first hop, with no sign-in; `none` answers 3xx, a sign-in standing before the
 * application; `demo-account` has its dated observation and an own sign-in page naming the principal.
 *
 * @returns {Promise<[boolean, string]>}
 */
async function demoVerdict(entry, atLive, { fetch, observed }) {
  const { demo, live } = entry;
  if (demo === 'not-deployed') {
    return live === undefined
      ? [true, 'not-deployed and carries no live URL: nothing to reach']
      : [false, `declares not-deployed but carries live ${live}: remove the URL or correct the declaration`];
  }
  if (!['open', 'none', 'demo-account'].includes(demo)) return [false, `declares "${demo}", which is not a demo value the schema allows`];
  if (live === undefined) {
    return [false, `declares ${demo} but carries no live URL, so a Visitor reaches nothing; an application taken offline reads not-deployed (FR-28)`];
  }
  const status = atLive.response?.status ?? null;
  if (demo === 'demo-account') {
    const record = recorded('demo-account', entry.id, observed);
    const page = await signInPage(fetch, live, atLive);
    return [record.ok && page.ok, `${record.ok ? '' : 'overstated: '}${record.detail}; ${page.ok ? '' : 'overstated: '}${page.detail}`];
  }
  // Only a 2xx or a 3xx says what a Visitor meets; anything else is the `live` row's failure, named here too.
  if (status === null || !(isSuccess(status) || isRedirect(status))) return [false, `cannot be verified: ${live} ${answered(atLive)}`];
  const to = isRedirect(status) ? ` to ${shown(target(atLive.response, live))}` : '';
  if (demo === 'open') {
    return isSuccess(status)
      ? [true, `${live} answered ${status} with no sign-in: usable without authentication`]
      : [false, `overstated: declares open but ${live} answered ${status}${to}, so a Visitor meets something other than the application`];
  }
  // demo === 'none'
  return isRedirect(status)
    ? [true, `${live} answered ${status}${to}: a sign-in stands before the application, and no demo access is declared`]
    : [false, `understated: declares none but ${live} answered ${status} with no sign-in, so a Visitor uses it without authentication, which is open`];
}

/** What is wrong with an authorization request, against what Stories 5.3 and 5.4 send. Empty when nothing is. */
function authorizationProblems(url, live) {
  if (url === null) return ['it carries no usable Location'];
  const problems = [];
  const query = url.searchParams;
  const callback = new URL('/auth/callback', live).href;
  if (url.protocol !== 'https:') problems.push(`${url.origin} is not https`);
  if (query.get('response_type') !== 'code') problems.push('response_type is not code');
  if (query.get('code_challenge_method') !== 'S256') problems.push('code_challenge_method is not S256');
  for (const name of ['code_challenge', 'state', 'client_id']) if (!query.get(name)) problems.push(`${name} is absent`);
  if (query.get('redirect_uri') !== callback) problems.push(`redirect_uri is not ${callback}`);
  return problems;
}

/**
 * The `identity` row (AD-11, AD-12, FR-24). `wallet` is the recorded structural exemption and nothing
 * else; `none` is contradicted by an OIDC session route answering 401 on the entry's host; `oidc` has its
 * dated observation and, wherever `live` is present, answers `/auth/session` 401 without a session and
 * `/auth/sign-in` with a redirect into an Authorization Code + PKCE request back to its own callback.
 * Provider-neutral: nothing here names an issuer.
 *
 * @returns {Promise<[boolean, string]>}
 */
async function identityVerdict(entry, { fetch, observed }) {
  const { id, identity, live } = entry;
  const exempt = Object.hasOwn(WALLET_EXEMPT, id) ? WALLET_EXEMPT[id] : null;
  if (identity === 'wallet') {
    return exempt === null
      ? [false, `declares wallet, a structural exemption recorded for ${Object.keys(WALLET_EXEMPT).join(', ')} alone (AD-12)`]
      : [true, `wallet: structurally exempt, not unimplemented: ${exempt}`];
  }
  if (exempt !== null) return [false, `declares ${identity}, but ${id} is structurally exempt and declares wallet (AD-12, FR-24)`];
  if (!['oidc', 'none'].includes(identity)) return [false, `declares "${identity}", which is not an identity value the schema allows`];

  const session = live === undefined ? null : new URL('/auth/session', live).href;
  if (identity === 'none') {
    if (session === null) return [true, 'none and carries no live URL: nothing deployed to sign in to'];
    const got = await get(fetch, session, {});
    const status = got.response?.status ?? null;
    if (status === null) return [false, `cannot be verified: ${session} ${answered(got)}`];
    return status === 401
      ? [false, `understated: declares none but ${session} answered 401, an OIDC session route serving here; release oidc once its observation is dated (DW-322, DW-323)`]
      : [true, `${session} answered ${status}, not an OIDC session route`];
  }

  // identity === 'oidc'
  const record = recorded('oidc', id, observed);
  const flag = (ok) => (ok ? '' : 'overstated: ');
  if (session === null) {
    return [record.ok, `${flag(record.ok)}${record.detail}; no live URL, so the session route is not probed (FR-28)`];
  }
  const atSession = await get(fetch, session, {});
  const sessionOk = atSession.response?.status === 401;
  const signIn = new URL('/auth/sign-in', live).href;
  const atSignIn = await get(fetch, signIn, {});
  const signInStatus = atSignIn.response?.status ?? null;
  const request = signInStatus !== null && isRedirect(signInStatus) ? target(atSignIn.response, signIn) : null;
  const problems = signInStatus !== null && isRedirect(signInStatus) ? authorizationProblems(request, live) : [`it ${answered(atSignIn)}, not a redirect`];
  const signInOk = problems.length === 0;
  return [
    record.ok && sessionOk && signInOk,
    [
      `${flag(record.ok)}${record.detail}`,
      `${flag(sessionOk)}${session} ${answered(atSession)}${sessionOk ? '' : ', not 401'}`,
      signInOk
        ? `${signIn} answered ${signInStatus} to an Authorization Code + PKCE request at ${shown(request)}`
        : `overstated: ${signIn} is not an Authorization Code + PKCE redirect: ${problems.join(', ')}`,
    ].join('; '),
  ];
}

/**
 * Every check one entry gets, in order: the authenticated half of `source`
 * (github.com only), the anonymous half, `live` where the field is present,
 * `demo` and `identity` wherever declared (the schema requires both), and
 * `token_contract` where it is declared.
 *
 * @param {Entry} entry
 * @param {{ fetch: Fetcher, token: string, tolerated: Set<string>, adopters: ReturnType<typeof adopterRows>, observed: ReturnType<typeof observations> }} context
 * @returns {Promise<Row[]>}
 */
async function checkEntry(entry, { fetch, token, tolerated, adopters, observed }) {
  /** @type {Row[]} */
  const rows = [];
  const row = (check, pass, detail) => rows.push({ id: entry.id, check, pass, detail });
  const authenticated = { Authorization: `Bearer ${token}` };

  const github = GITHUB_SOURCE.exec(entry.source);
  const slug = github === null ? null : `${github[1]}/${github[2]}`;
  const tree = github === null || github[3] === undefined ? null : { branch: github[3], path: github[4] };
  /** @type {{ defaultBranch: string } | null} */
  let repository = null;

  if (slug !== null) {
    const got = await get(fetch, `${API}/repos/${slug}`, { ...authenticated, Accept: 'application/vnd.github+json' });
    const body = got.response?.status === 200 ? await got.response.json().catch(() => null) : null;
    if (body !== null && typeof body.default_branch === 'string') {
      repository = { defaultBranch: body.default_branch };
      const found = `${slug} answered 200 authenticated, default branch ${body.default_branch}` + (body.archived === true ? ', archived' : '');
      if (tree === null) {
        row('source exists', true, found);
      } else {
        // The repository existing proves nothing about the directory: the path is read on the branch
        // the URL names, so a renamed directory or a branch that lost it fails here by name.
        // `GITHUB_SOURCE` admits only URL-safe segments, so neither part needs encoding.
        const where = `${slug}:${tree.path}@${tree.branch}`;
        const at = await get(fetch, `${API}/repos/${slug}/contents/${tree.path}?ref=${tree.branch}`, {
          ...authenticated,
          Accept: 'application/vnd.github+json',
        });
        const status = at.response?.status ?? null;
        if (status === 200) {
          row('source exists', true, `${found}, and ${where} answered 200`);
        } else if (status === 404) {
          row('source exists', false, `absent: ${slug} answered 200 and ${where} answered 404, so the path is not on that branch`);
        } else if (status === 401 || status === 403) {
          row('source exists', false, `${where} answered ${status}; check ${SECRET} has Contents read on ${slug}`);
        } else {
          row('source exists', false, `unreachable: ${slug} answered 200 and ${where} ${answered(at)}`);
        }
      }
    } else if (got.response?.status === 200) {
      row('source exists', false, `${slug} answered 200 authenticated but no default_branch was read`);
    } else {
      row(
        'source exists',
        false,
        `${slug} ${answered(got)} authenticated, so the repository does not exist or ${SECRET} cannot read it`
      );
    }
  } else if (ON_GITHUB.test(entry.source)) {
    row(
      'source exists',
      false,
      `${entry.source} is on github.com and is not of the shape https://github.com/<owner>/<repo>, so it cannot be looked up`
    );
  }

  {
    const got = await get(fetch, entry.source, {});
    const verdict = classify(got.response);
    const isTolerated = slug !== null && tolerated.has(slug);
    if (verdict === 'resolves') {
      row(
        'source resolves',
        true,
        `${entry.source} ${answered(got)} anonymously` + (isTolerated ? '; its KV-2 row can be struck' : '')
      );
    } else if (verdict === 'absent' && isTolerated) {
      row('source resolves', true, `${entry.source} answered 404 anonymously, tolerated by KV-2 (${RECORD_REL})`);
    } else if (verdict === 'absent') {
      row(
        'source resolves',
        false,
        `absent: ${entry.source} answered 404 anonymously and no KV-2 row tolerates it, so a public repository went private or moved (FR-10)`
      );
    } else {
      row('source resolves', false, `unreachable: ${entry.source} ${answered(got)} anonymously`);
    }
  }

  /** The `live` answer, reused by the `demo` row so the Visitor's first request is made once. */
  let atLive = null;
  if (entry.live !== undefined) {
    const got = await get(fetch, entry.live, {});
    atLive = got;
    const verdict = classify(got.response);
    row(
      'live',
      verdict === 'resolves',
      verdict === 'resolves' ? `${entry.live} ${answered(got)}` : `${verdict}: ${entry.live} ${answered(got)}`
    );
  }

  if (entry.demo !== undefined) {
    const [pass, detail] = await demoVerdict(entry, atLive, { fetch, observed });
    row('demo', pass, detail);
  }

  if (entry.identity !== undefined) {
    const [pass, detail] = await identityVerdict(entry, { fetch, observed });
    row('identity', pass, detail);
  }

  if (entry.token_contract !== undefined) {
    const declared = entry.token_contract;
    const target = slug === null ? null : vendoredTarget(entry, adopters);
    if (target === null) {
      row(
        'token_contract',
        false,
        `${declared} cannot be verified: ${entry.source} is not of the shape https://github.com/<owner>/<repo>, so no vendored file can be read`
      );
    } else if (target.path === null) {
      row('token_contract', false, `${declared} is declared but no recorded target: ${target.reason}`);
    } else if (repository === null) {
      row(
        'token_contract',
        false,
        `${slug} is unreadable (token or visibility), so ${target.path} was not read; check ${SECRET}`
      );
    } else {
      const branch = repository.defaultBranch;
      const got = await get(fetch, `${API}/repos/${slug}/contents/${target.path}?ref=${encodeURIComponent(branch)}`, {
        ...authenticated,
        Accept: 'application/vnd.github.raw',
      });
      const where = `${slug}:${target.path}@${branch}`;
      const status = got.response?.status ?? null;
      if (status === 404) {
        row(
          'token_contract',
          false,
          `cuatro-contracts folder moved or renamed: ${slug} answered 200 and ${where} answered 404 (AD-14, AD-16)`
        );
      } else if (status === 401 || status === 403) {
        row('token_contract', false, `${where} answered ${status}; check ${SECRET} has Contents read on ${slug}`);
      } else if (got.response === null || status !== 200) {
        row('token_contract', false, `unreachable: ${where} ${answered(got)}`);
      } else {
        let css = null;
        let cut = null;
        try {
          css = await got.response.text();
        } catch (error) {
          cut = message(error);
        }
        const header = css === null ? null : (HEADER_PATTERN.exec(css)?.[1] ?? null);
        if (css === null) {
          row('token_contract', false, `unreachable: ${where} body ${cut}`);
        } else if (header === null) {
          row('token_contract', false, `header absent: ${where} carries no "Contract vX.Y.Z" header`);
        } else {
          const pass = SEMVER.test(declared) && declared === header;
          row(
            'token_contract',
            pass,
            `${pass ? '' : 'mismatch: '}the Registry declares ${declared} and ${where} reads Contract v${header}` +
              (pass ? '' : '; the two must be one version')
          );
        }
      }
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

/**
 * Every entry as the checks need it: `id` and `source` strings, `live` and
 * `token_contract` strings when present. Anything else is a defect of the
 * Registry, thrown naming the entry, never a row keyed on `undefined`.
 *
 * @param {unknown[]} entries
 */
function assertEntries(entries) {
  entries.forEach((entry, index) => {
    const id = entry !== null && typeof entry === 'object' && typeof entry.id === 'string' ? ` (${printable(entry.id)})` : '';
    const name = `${REGISTRY_REL} entry ${index}${id}`;
    if (entry === null || typeof entry !== 'object') throw new Error(`${name} is not an object, so it cannot be verified`);
    for (const field of ['id', 'source']) {
      if (typeof entry[field] !== 'string') throw new Error(`${name} carries no string ${field}, so it cannot be verified`);
    }
    for (const field of ['live', 'token_contract', 'demo', 'identity']) {
      if (entry[field] !== undefined && typeof entry[field] !== 'string') {
        throw new Error(`${name} carries a ${field} that is not a string, so it cannot be verified`);
      }
    }
  });
}

/**
 * Every check over every entry. Throws, rather than reporting, when the secret
 * is absent (nothing is fetched), when the Registry carries no entries or a
 * malformed one, or when either record does not parse: those are defects of
 * the run, not findings about the Registry. A check that throws mid-entry is
 * one FAIL row for that entry and never discards another entry's verdict.
 *
 * @param {{ registry: Registry, record: string, adoption: string, observed: Record<string, string | undefined>, fetch: Fetcher, token: string | undefined }} input
 * @returns {Promise<{ ok: boolean, lines: string[], rows: Row[] }>}
 */
export async function verify({ registry, record, adoption, observed, fetch, token }) {
  if (typeof token !== 'string' || token === '') {
    throw new Error(`${SECRET} is not set, so nothing was fetched. Add the repository secret (${RECORD_REL}).`);
  }
  const entries = registry?.applications;
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error(`${REGISTRY_REL} carries no applications, so nothing was verified`);
  }
  assertEntries(entries);
  const tolerated = new Set(kv2Rows(record).filter((r) => !r.struck).map((r) => r.repository));
  const adopters = adopterRows(adoption);
  const seen = observations(observed);
  const settled = await Promise.allSettled(
    entries.map((entry) => checkEntry(entry, { fetch, token, tolerated, adopters, observed: seen }))
  );
  const rows = settled.flatMap((outcome, index) =>
    outcome.status === 'fulfilled'
      ? outcome.value
      : [{ id: entries[index].id, check: 'entry', pass: false, detail: `threw: ${message(outcome.reason)}` }]
  );
  const lines = rows.map((r) => `${r.pass ? 'PASS' : 'FAIL'}  ${printable(r.id)} ${r.check}: ${printable(r.detail)}`);
  return { ok: rows.every((r) => r.pass), lines, rows };
}

/** The same rows as a markdown table, for `$GITHUB_STEP_SUMMARY`. A pipe in a detail is escaped, not a boundary. */
export function summaryTable(rows) {
  const cell = (text) => printable(text).replace(/\|/g, '\\|');
  const passed = rows.filter((r) => r.pass).length;
  return [
    `## Registry verification: ${passed} of ${rows.length} checks passed`,
    '',
    '| Entry | Check | Verdict | Detail |',
    '|---|---|---|---|',
    ...rows.map((r) => `| ${cell(r.id)} | ${cell(r.check)} | ${r.pass ? 'PASS' : 'FAIL'} | ${cell(r.detail)} |`),
  ].join('\n');
}

const beside = (rel) => fileURLToPath(new URL(`../${rel}`, import.meta.url));

/**
 * The whole CLI as a function. The Registry and both records are resolved
 * beside this module, so no argument can point it at another tree; the secret
 * and the summary path are the only two environment reads. The fetcher and the
 * environment are parameters with defaults so the suite can drive the exit 1,
 * the summary append and the unwritable-summary paths without a network.
 *
 * @param {Fetcher} [fetch]
 * @param {Record<string, string | undefined>} [env]
 * @returns {Promise<{ code: 0 | 1 | 2, message: string }>}
 */
export async function main(fetch = globalThis.fetch, env = process.env) {
  let inputs;
  try {
    inputs = {
      registry: JSON.parse(readFileSync(beside(REGISTRY_REL), 'utf8')),
      record: readFileSync(beside(RECORD_REL), 'utf8'),
      adoption: readFileSync(beside(ADOPTION_REL), 'utf8'),
      observed: {
        [IDENTITY_REL]: readFileSync(beside(IDENTITY_REL), 'utf8'),
        [DEMO_REL]: readFileSync(beside(DEMO_REL), 'utf8'),
      },
    };
  } catch (error) {
    return { code: 2, message: `the Registry or a record could not be read: ${message(error)}` };
  }
  let result;
  try {
    result = await verify({ ...inputs, fetch, token: env[SECRET] });
  } catch (error) {
    return { code: 2, message: message(error) };
  }
  const passed = result.rows.filter((r) => r.pass).length;
  const lines = [...result.lines, `# ${passed} of ${result.rows.length} checks passed`];
  const summary = env.GITHUB_STEP_SUMMARY;
  if (typeof summary === 'string' && summary !== '') {
    try {
      appendFileSync(summary, `${summaryTable(result.rows)}\n`);
    } catch (error) {
      return {
        code: 2,
        message: [...lines, `the job summary at ${printable(summary)} could not be written: ${message(error)}`].join('\n'),
      };
    }
  }
  return { code: result.ok ? 0 : 1, message: lines.join('\n') };
}

/**
 * @param {string} a
 * @param {string} b
 */
function sameFile(a, b) {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    // Never answer "no" here: a guard that decides it was not invoked directly
    // runs nothing and exits 0, which is the job failing open.
    return resolve(a) === resolve(b);
  }
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && sameFile(process.argv[1], fileURLToPath(import.meta.url));

if (invokedDirectly) {
  main()
    .catch((error) => ({ code: 2, message: message(error) }))
    .then((result) => {
      const stream = result.code === 0 ? process.stdout : process.stderr;
      // The verdict is recorded before anything is written, and the exit happens
      // in the write callback, so a pipe torn down mid flush neither truncates
      // the lines nor lets the process fall off the end at 0.
      process.exitCode = result.code;
      stream.write(`${result.message}\n`, () => process.exit(result.code));
    });
}
