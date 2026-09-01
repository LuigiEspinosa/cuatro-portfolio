// The `cs-tracker` accessibility pass (Story 1-20, AD-19).
//
// AD-19 asks for every restyled application to be measured once by hand against
// the accessibility floor after token adoption, with the result recorded and a
// failure recorded as a finding rather than corrected out of scope. Story 1-19's
// probe read a compiled stylesheet in a fixture page, because its question was
// what a theme variable computes to. This one's question is the size of a
// control in its real layout and the visibility of a ring on the ground a page
// actually paints under it, which only the application's own markup at its own
// width can answer. So it runs against a RUNNING `mix phx.server` on a seeded
// development database, never against a fixture and never off the text of a
// stylesheet.
//
// Every owner route sits behind a Steam OpenID round trip that no automation
// can complete. The development endpoint's session store is a signed cookie
// whose secret and salt are committed in `config/dev.exs` and `endpoint.ex`, so
// this file mints a token Plug's own verifier accepts from those two values and
// a 17-digit id, and the server is started with the same id in `STEAM_ID`. The
// application is the verifier of that token: the first case is that `/` answers
// 200 with it and a redirect without it. The salt is read at run time and never
// printed: publishing a private repository's configuration is a decision, and
// this file does not make it.
//
// What it reads, per route, in Playwright's Chromium at a 360px-wide viewport:
//   * every visible interactive element's `boundingBox()`, against the `--tap`
//     floor read off `:root` (never defaulted to 44), with the mobile menu
//     revealed first so its links are measured too;
//   * the focus ring under a real Tab press on one element sitting on each of
//     the three grounds, comparing the computed `outline-*` values with the four
//     contract values read off `:root`, computing the ring's WCAG 2.1 contrast
//     against that ground, confirming `:focus-visible` matched, and reading
//     `transition-property` and `transition-duration` for a transitioned ring.
//
// **Nothing here fixes anything.** A control under 44 on either axis is a
// numbered finding with route, selector, text and size. daisyUI's control
// geometry is Story 8.1's restyle, and a migration step carries nothing else.
//
// **This is a reproduction tool, not a gate.** It needs a browser and a running
// Phoenix application with a database, and neither is on a runner, so it is
// never a CI job (AD-21 is about gates that exist). Its pure parts are exported
// and covered by `ops/__tests__/cs-tracker-accessibility-probe.test.ts` under
// the blocking `test` job, so a later edit cannot quietly make it unable to
// fail.
//
// It writes nothing into `cs-tracker`. It reads two files out of it.
//
// Usage: node ops/cs-tracker-accessibility-probe.mjs
//   CS_TRACKER_URL       base URL of the running server (default http://127.0.0.1:4000)
//   CS_TRACKER_STEAM_ID  the 17-digit id the server was started with
//                        (default the id test/support/conn_case.ex uses)
//
// Exit codes, because "a control is under the floor" and "no server is running"
// are different answers:
//
//   0  every named case passed
//   1  a named case failed. This is the finding signal
//   2  a defect in this file
//   3  a Block If condition: nothing could be observed at all

import { spawnSync } from 'node:child_process';
import { createHmac, pbkdf2Sync } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contrastRatio } from './cs-tracker-adoption-probe.mjs';

const require_ = createRequire(import.meta.url);

/**
 * This module's own directory. Guarded, because under Vitest `import.meta.url`
 * is a vite URL rather than a `file:` one and `fileURLToPath` throws on it.
 */
function moduleDir() {
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    return resolve(process.cwd(), 'ops');
  }
}

export const REPO_ROOT = resolve(moduleDir(), '..');

/** `cs-tracker`, resolved beside this repository rather than hardcoded. Read only. */
export const CS_TRACKER = resolve(REPO_ROOT, '..', 'cs-tracker-workspace', 'cs-tracker');

/** The two files the cookie is minted from. Both committed, both development-only. */
export const DEV_CONFIG_REL = 'config/dev.exs';
export const ENDPOINT_REL = 'lib/cs_tracker_web/endpoint.ex';

export const DEFAULT_BASE_URL = 'http://127.0.0.1:4000';

/** The id `test/support/conn_case.ex` uses as the allowlisted Owner. */
export const DEFAULT_STEAM_ID = '76561198000000000';

/** AD-19's viewport: 360 wide. The height only has to hold a page. */
export const VIEWPORT = { width: 360, height: 800 };

/** The five owner routes, `/items/:id` resolved against the seeded catalog at run time. */
export const OWNER_ROUTES = ['/', '/browse', '/inventory', '/wishlist', '/items/:id'];

/** The one page an anonymous visitor sees: a callback whose mode is not `id_res` renders the failure page at 401. */
export const FAILURE_ROUTE = '/auth/steam/callback?openid.mode=bad';
export const FAILURE_STATUS = 401;

/** Where the owner gate sends an anonymous visitor. */
export const SIGN_IN_PATH = '/auth/steam';

/** What "interactive" means here. Pinned as a list so a dropped entry is a diff, not a shorter sweep. */
export const INTERACTIVE_SELECTORS = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  '[role=button]',
  '[role=link]',
  '[tabindex]:not([tabindex="-1"])',
];
export const INTERACTIVE_SELECTOR = INTERACTIVE_SELECTORS.join(', ');

/** The three grounds the ring is read on, and the four contract values it is read against. */
export const GROUNDS = ['--token-bg', '--token-bg-raised', '--token-bg-raised-2'];
export const FLOOR_TOKEN = '--tap';
export const RING_TOKENS = { width: '--stroke-focus', colour: '--token-focus', offset: '--focus-offset' };

/** WCAG 2.1 non-text contrast, the floor a focus indicator has to clear against its ground. */
export const RING_CONTRAST_FLOOR = 3;

/**
 * Plug's cookie store key derivation: PBKDF2-SHA256 over `secret_key_base`,
 * salt = the signing salt, 1000 iterations, 32 bytes. These are
 * `Plug.Session.COOKIE`'s defaults for `key_iterations`, `key_length` and
 * `key_digest`, and `endpoint.ex` overrides none of them.
 */
export const KEY_ITERATIONS = 1000;
export const KEY_LENGTH = 32;
export const KEY_DIGEST = 'sha256';

/** External Term Format tags the payload is built from. */
export const ETF_VERSION = 131;
export const ETF_MAP = 116;
export const ETF_BINARY = 109;

/** The unset background every "nothing painted" reading looks like, in the canonical shape. */
export const UNPAINTED = 'rgba(0, 0, 0, 0.000)';

/** The verdict words, so the transcript and the tests spell them one way. */
export const VERDICT = Object.freeze({ pass: 'PASS', fail: 'FAIL', skipped: 'SKIPPED' });

/** How long a click on the hamburger, or a wait for its menu, is given. */
export const CLICK_TIMEOUT_MS = 5_000;

/** How long running animations are given to finish before boxes are read. */
export const ANIMATION_SETTLE_MS = 3_000;

/** Thrown for a condition the story's Block If names, never for a defect in this file. */
export class BlockedError extends Error {}

function say(message) {
  process.stdout.write(`${message}\n`);
}

// ---------------------------------------------------------------------------
// Inputs and failure classes
// ---------------------------------------------------------------------------

/**
 * Every reason the two inputs cannot be used, or an empty list. The base URL
 * must be a bare origin: every route is appended to it, so a path, a query, a
 * fragment or a trailing slash would sweep `//browse` or `?x=1/browse`.
 */
export function validateInputs({ baseUrl, steamId }) {
  const problems = [];
  if (!/^https?:\/\/[^\s/?#]+$/i.test(String(baseUrl ?? ''))) {
    problems.push(
      `CS_TRACKER_URL ${JSON.stringify(baseUrl)} is not a bare http(s) origin (scheme, host and port, with no path, query, fragment or trailing slash)`
    );
  }
  if (!/^\d{17}$/.test(String(steamId ?? ''))) {
    problems.push(`CS_TRACKER_STEAM_ID ${JSON.stringify(steamId)} is not a 17-digit SteamID, and config/runtime.exs would refuse it too`);
  }
  return problems;
}

/**
 * Whether an error is the server going away or never answering rather than a
 * defect in this file: a navigation or connection failure after the first
 * request is a Block If (nothing could be observed), not a probe defect.
 */
export function isConnectionFailure(error) {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? '');
  // Playwright's own timeouts carry the name `TimeoutError` or the message
  // `Timeout <n>ms exceeded`; a bare "timeout" anywhere in a message is not
  // matched, so a defect in this file that mentions one stays a defect.
  return /net::ERR_|ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|EPIPE|TimeoutError|Timeout \d+ms exceeded/i.test(text);
}

/** Two paths name one file, compared after resolution and case-insensitively, as this host's filesystem does. */
export function samePath(a, b) {
  // The separators are converted BEFORE `resolve`, and again after. Order is the
  // whole point of this line. On Linux a backslash is an ordinary filename
  // character, so `resolve('C:\\Repo\\ops\\..\\ops\\probe.mjs')` treats the lot
  // as one relative name, collapses nothing, and a replace afterwards leaves the
  // `..` sitting in the string: two spellings of one file then compare unequal
  // on the runner while agreeing on the Windows authoring host, which is how the
  // `test` job came to be red from 2026-08-28 to 2026-08-31 (DW-30). Converted
  // first, `resolve` sees real separators on both platforms and collapses `..`
  // on both. The second replace is still needed, because `resolve` hands back
  // backslashes on Windows whatever it was given.
  const norm = (p) => resolve(String(p ?? '').replace(/\\/g, '/')).replace(/\\/g, '/').toLowerCase();
  return norm(a) === norm(b);
}

/** Every contract value the ring is read against that was not declared or not painted on `:root`. */
export function contractProblems(contract) {
  const problems = [];
  if (typeof contract?.strokeFocus !== 'string' || contract.strokeFocus === '') problems.push(`${RING_TOKENS.width} is not declared on :root`);
  if (typeof contract?.focusOffset !== 'string' || contract.focusOffset === '') problems.push(`${RING_TOKENS.offset} is not declared on :root`);
  if (typeof contract?.focusRaw !== 'string' || contract.focusRaw === '') problems.push(`${RING_TOKENS.colour} is not declared on :root`);
  else if (!isPainted(contract?.focus)) problems.push(`${RING_TOKENS.colour} declares ${contract.focusRaw} and paints nothing (${contract?.focus ?? 'unread'})`);
  return problems;
}

/** A message when the interactive count changed while a page was being read, else null. */
export function countDrift(before, after) {
  return before === after
    ? null
    : `the page's interactive count moved from ${before} to ${after} while it was being read, so the sweep is not of one document state`;
}

/** The label a ring reading carries when it was not read on a real element on that ground. */
export function groundReadingLabel({ planted, realCandidates }) {
  if (!planted) return '';
  return realCandidates > 0
    ? ` (UNREACHABLE: ${realCandidates} real element(s) sit on this ground and Tab reached none of them; read on a planted control)`
    : ' (PLANTED: no interactive element sits on this ground on any route)';
}

// ---------------------------------------------------------------------------
// Reading the two `cs-tracker` files the cookie is minted from
// ---------------------------------------------------------------------------

/**
 * Drop Elixir comments, whole-line and trailing, so a `key:` in a comment is
 * never read as configuration. A `#` inside a double-quoted string (an
 * interpolation, or a value that happens to carry one) is not a comment and
 * is kept; a backslash inside a string escapes the next character.
 */
export function withoutElixirComments(source) {
  if (typeof source !== 'string') return '';
  return source
    .split('\n')
    .map((line) => {
      let quoted = false;
      for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (quoted && char === '\\') {
          i += 1;
        } else if (char === '"') {
          quoted = !quoted;
        } else if (char === '#' && !quoted) {
          return line.slice(0, i);
        }
      }
      return line;
    })
    .join('\n');
}

/** The `secret_key_base` string out of `config/dev.exs`. Throws rather than minting with nothing. */
export function readSecretKeyBase(devExs) {
  const match = /secret_key_base:\s*"([^"]+)"/.exec(withoutElixirComments(devExs));
  if (match === null) {
    throw new Error(`${DEV_CONFIG_REL} carries no secret_key_base: "..." line, so no session cookie can be minted`);
  }
  return match[1];
}

/**
 * The session cookie name and signing salt out of `endpoint.ex`'s
 * `@session_options`. Refuses an encryption salt: this file signs and never
 * encrypts, and a store that encrypts would reject a signed-only token.
 */
export function readSessionOptions(endpointEx) {
  const text = withoutElixirComments(endpointEx);
  // Read inside the `@session_options [...]` list only, so a `key:` elsewhere
  // in the module is never taken for the cookie's name.
  const block = /@session_options\s*\[([\s\S]*?)\]/.exec(text)?.[1] ?? null;
  const key = block === null ? null : /\bkey:\s*"([^"]+)"/.exec(block);
  const salt = block === null ? null : /signing_salt:\s*"([^"]+)"/.exec(block);
  if (key === null || salt === null) {
    throw new Error(`${ENDPOINT_REL} carries no @session_options with key: and signing_salt:, so no cookie can be minted`);
  }
  if (/encryption_salt:\s*"/.test(text)) {
    throw new Error(`${ENDPOINT_REL} sets an encryption_salt, and this probe only signs; it would mint a token the store rejects`);
  }
  return { key: key[1], signingSalt: salt[1] };
}

// ---------------------------------------------------------------------------
// Minting the Owner session cookie, in Plug's shape
// ---------------------------------------------------------------------------

/** BINARY_EXT: tag, 4-byte big-endian length, bytes. */
export function etfBinary(value) {
  const bytes = Buffer.from(String(value), 'utf8');
  const header = Buffer.alloc(5);
  header[0] = ETF_BINARY;
  header.writeUInt32BE(bytes.length, 1);
  return Buffer.concat([header, bytes]);
}

/** MAP_EXT over string keys and string values: tag, 4-byte arity, then key, value pairs. */
export function etfMap(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('etfMap: an empty session map would mint a cookie carrying no steam_id at all');
  }
  const header = Buffer.alloc(5);
  header[0] = ETF_MAP;
  header.writeUInt32BE(entries.length, 1);
  return Buffer.concat([header, ...entries.flatMap(([key, value]) => [etfBinary(key), etfBinary(value)])]);
}

/** `:erlang.term_to_binary(%{"steam_id" => id})`, version byte first. */
export function sessionTerm(steamId) {
  return Buffer.concat([Buffer.from([ETF_VERSION]), etfMap([['steam_id', steamId]])]);
}

/** `Base.url_encode64(padding: false)`, which Node's `base64url` is. */
export const base64url = (bytes) => Buffer.from(bytes).toString('base64url');

export function deriveKey(secretKeyBase, signingSalt) {
  return pbkdf2Sync(secretKeyBase, signingSalt, KEY_ITERATIONS, KEY_LENGTH, KEY_DIGEST);
}

/**
 * `Plug.Crypto.MessageVerifier.sign/2` over the ETF session map under the
 * PBKDF2-derived key: `base64url("HS256") <> "." <> base64url(term) <> "." <>
 * base64url(hmac_sha256(key, first two segments))`.
 */
export function mintSessionCookie({ secretKeyBase, signingSalt, steamId }) {
  if (typeof secretKeyBase !== 'string' || secretKeyBase.length < 64) {
    throw new Error('mintSessionCookie: secret_key_base must be at least 64 bytes, which is the store\'s own requirement');
  }
  if (typeof signingSalt !== 'string' || signingSalt === '') {
    throw new Error('mintSessionCookie: the signing salt is empty');
  }
  if (!/^\d{17}$/.test(String(steamId))) {
    throw new Error(`mintSessionCookie: "${steamId}" is not a 17-digit SteamID, and config/runtime.exs would refuse it too`);
  }
  const key = deriveKey(secretKeyBase, signingSalt);
  const protectedPart = base64url('HS256');
  const payload = base64url(sessionTerm(String(steamId)));
  const plainText = `${protectedPart}.${payload}`;
  const signature = base64url(createHmac('sha256', key).update(plainText).digest());
  return `${plainText}.${signature}`;
}

/** The three segments of a minted token, decoded, so a test can read them. */
export function decodeSessionCookie(token) {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error(`a Plug signed token has three segments, this has ${parts.length}`);
  return {
    protected: Buffer.from(parts[0], 'base64url').toString('utf8'),
    payload: Buffer.from(parts[1], 'base64url'),
    signature: Buffer.from(parts[2], 'base64url'),
    signingInput: `${parts[0]}.${parts[1]}`,
  };
}

// ---------------------------------------------------------------------------
// The verdicts
// ---------------------------------------------------------------------------

/** A `px` length as a number. Throws on anything else, so an empty read is never compared as zero. */
export function parsePx(value, what) {
  const match = /^(-?\d+(?:\.\d+)?)px$/.exec(String(value ?? '').trim());
  if (match === null) throw new Error(`${what} read "${value}", which is not a px length`);
  return Number(match[1]);
}

/**
 * The hit-target verdict for one element.
 *
 * `44 x 44` or larger on both axes passes. Under the floor on either axis fails
 * naming the axis and the value. A hidden or zero-area element is SKIPPED and
 * counted as skipped, never as passed. A floor that is not a positive number
 * throws: it is read off `:root`, and defaulting to 44 would pass a page whose
 * contract never loaded.
 */
export function hitTargetVerdict({ box, visible }, floor) {
  if (typeof floor !== 'number' || !Number.isFinite(floor) || floor <= 0) {
    throw new Error(`hitTargetVerdict: the floor is ${JSON.stringify(floor)}, not a positive number read off :root`);
  }
  if (visible === false) return { verdict: VERDICT.skipped, reason: 'hidden' };
  if (box === null || box === undefined) return { verdict: VERDICT.skipped, reason: 'not rendered (no bounding box)' };
  const width = Number(box.width);
  const height = Number(box.height);
  if (!(width > 0) || !(height > 0)) return { verdict: VERDICT.skipped, reason: `zero-area (${width} x ${height})` };
  const reasons = [];
  if (width < floor) reasons.push(`width ${width} is under ${floor}`);
  if (height < floor) reasons.push(`height ${height} is under ${floor}`);
  return reasons.length === 0
    ? { verdict: VERDICT.pass, reason: `${width} x ${height}` }
    : { verdict: VERDICT.fail, reason: reasons.join(', ') };
}

/** Whether a `transition-property` value names `outline` (or any `outline-*`) or `all`. */
export function transitionNamesOutline(transitionProperty) {
  return String(transitionProperty)
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .some((part) => part === 'all' || part === 'outline' || part.startsWith('outline-'));
}

/**
 * Every duration in a computed `transition-duration` list, in milliseconds.
 * Throws on an entry that is not a time, so an unread duration is never filed
 * as zero and excluded from the transition findings in silence.
 */
export function transitionDurationsMs(transitionDuration) {
  return String(transitionDuration ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map((part) => {
      const match = /^(-?\d+(?:\.\d+)?)(ms|s)$/.exec(part);
      if (match === null) throw new Error(`transition-duration read "${transitionDuration}", and "${part}" is not a time`);
      return match[2] === 's' ? Number(match[1]) * 1000 : Number(match[1]);
    });
}

/** The longest duration in the list, or 0 when there is none. */
export function maxTransitionDurationMs(transitionDuration) {
  return Math.max(0, ...transitionDurationsMs(transitionDuration));
}

/**
 * The focus-ring verdict for one focused element.
 *
 * `read` is the computed `outline-width`, `outline-style`, `outline-color`
 * (canonicalised), `outline-offset` and `transition-property`. `contract` is
 * `--stroke-focus`, `--token-focus` (canonicalised) and `--focus-offset` as
 * read off `:root`. Each departure fails naming which. A read that returns an
 * empty string throws rather than comparing nothing.
 */
export function ringVerdict(read, contract) {
  for (const field of ['outlineWidth', 'outlineStyle', 'outlineColor', 'outlineOffset', 'transitionProperty']) {
    if (typeof read?.[field] !== 'string' || read[field] === '') {
      throw new Error(`ringVerdict: ${field} read as ${JSON.stringify(read?.[field])}, so nothing about the ring was observed`);
    }
  }
  for (const field of ['strokeFocus', 'focus', 'focusOffset']) {
    if (typeof contract?.[field] !== 'string' || contract[field] === '') {
      throw new Error(`ringVerdict: the contract value ${field} read as ${JSON.stringify(contract?.[field])} off :root`);
    }
  }
  const departures = [];
  if (parsePx(read.outlineWidth, 'outline-width') !== parsePx(contract.strokeFocus, RING_TOKENS.width)) {
    departures.push(`outline-width ${read.outlineWidth} against ${RING_TOKENS.width} ${contract.strokeFocus}`);
  }
  if (read.outlineStyle !== 'solid') departures.push(`outline-style ${read.outlineStyle} rather than solid`);
  if (read.outlineColor !== contract.focus) {
    departures.push(`outline-color ${read.outlineColor} against ${RING_TOKENS.colour} ${contract.focus}`);
  }
  if (parsePx(read.outlineOffset, 'outline-offset') !== parsePx(contract.focusOffset, RING_TOKENS.offset)) {
    departures.push(`outline-offset ${read.outlineOffset} against ${RING_TOKENS.offset} ${contract.focusOffset}`);
  }
  if (transitionNamesOutline(read.transitionProperty)) {
    const longest = maxTransitionDurationMs(read.transitionDuration ?? '');
    if (typeof read.transitionDuration !== 'string' || longest > 0) {
      departures.push(
        `transition-property "${read.transitionProperty}" names outline or all` +
          (typeof read.transitionDuration === 'string' ? ` over "${read.transitionDuration}"` : '') +
          ', and the ring is never transitioned'
      );
    }
  }
  return { pass: departures.length === 0, departures };
}

/**
 * The pass condition of one "Focus ring on <ground>" case, over the ring
 * verdict, the contrast against the ground under the ring, the ground the
 * element was chosen on, and whether `:focus-visible` matched. Each departure
 * is a reason; the case passes only with none.
 */
export function ringCaseVerdict({ verdict, contrast, groundUnderRing, groundName, focusVisible, floor = RING_CONTRAST_FLOOR }) {
  const reasons = [];
  if (!verdict || verdict.pass !== true) reasons.push(...(verdict?.departures?.length ? verdict.departures : ['the ring verdict did not pass']));
  if (typeof contrast !== 'number' || !Number.isFinite(contrast)) reasons.push('the contrast against the ground could not be computed');
  else if (contrast < floor) reasons.push(`contrast ${contrast.toFixed(2)}:1 is under the ${floor}:1 floor`);
  if (!groundUnderRing || groundUnderRing.ground !== groundName) {
    reasons.push(`the element was chosen on ${groundName} and the ring sits on ${groundUnderRing?.ground ?? 'none of the three'} (${groundUnderRing?.value ?? 'unread'})`);
  }
  if (focusVisible !== true) reasons.push(':focus-visible did not match on the focused element, so the ring read is not the keyboard ring');
  return { pass: reasons.length === 0, reasons };
}

/**
 * The pass condition of one "Hit targets on <route>" case: something was read,
 * something was measured (not everything skipped), and nothing measured is
 * under the floor.
 */
export function routeCaseVerdict(counts) {
  const read = Number(counts?.read ?? 0);
  const skipped = Number(counts?.skipped ?? 0);
  const fail = Number(counts?.fail ?? 0);
  const reasons = [];
  if (read === 0) reasons.push('no interactive element was read, so nothing was measured');
  else if (read - skipped <= 0) reasons.push(`every one of the ${read} elements read was skipped, so nothing was measured`);
  if (fail > 0) reasons.push(`${fail} under the floor`);
  return { pass: reasons.length === 0, reasons };
}

/** Whether a canonical `rgba(r, g, b, a)` string paints anything. */
export function isPainted(colour) {
  const match = /rgba\(\s*\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/.exec(String(colour ?? ''));
  return match !== null && Number(match[1]) > 0;
}

/**
 * The effective ground under an element: the first painted `background-color`
 * or `background-image` walking from the element's parent upward, classified
 * as one of the three grounds by equality with the `:root` values. An ancestor
 * painting an image before any ground colour is painted and unclassifiable,
 * and is reported as such. A colour that matches none of the three is reported
 * by value, never silently binned.
 *
 * @param {(string|{colour: string, image?: string})[]} chain canonical backgrounds from the parent upward
 * @param {Record<string,string>} grounds `{ '--token-bg': 'rgba(...)', ... }`
 */
export function classifyGround(chain, grounds) {
  if (!Array.isArray(chain)) return { ground: null, value: null, reason: 'no ancestor chain was read' };
  const entries = chain.map((entry) =>
    typeof entry === 'string' ? { colour: entry, image: 'none' } : { colour: entry?.colour ?? '', image: entry?.image ?? 'none' }
  );
  const first = entries.find((entry) => isPainted(entry.colour) || (typeof entry.image === 'string' && entry.image !== 'none' && entry.image !== ''));
  if (first === undefined) return { ground: null, value: null, reason: 'nothing is painted from the element to the root' };
  if (typeof first.image === 'string' && first.image !== 'none' && first.image !== '') {
    const image = first.image.length > 80 ? `${first.image.slice(0, 77)}...` : first.image;
    return { ground: null, value: image, reason: `an ancestor paints a background-image (${image}) before any ground colour, and an image is no ground` };
  }
  const named = Object.entries(grounds ?? {}).find(([, value]) => value === first.colour);
  return named === undefined
    ? { ground: null, value: first.colour, reason: `${first.colour} is none of ${Object.keys(grounds ?? {}).join(', ')}` }
    : { ground: named[0], value: first.colour };
}

/** A stable, readable selector for one element, for the findings table. */
export function describeElement({ tag, id, classes, href, text, index }) {
  const classList = String(classes ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);
  const parts = [tag ?? '?'];
  if (id) parts.push(`#${id}`);
  if (classList.length > 0) parts.push(`.${classList.join('.')}`);
  if (href) parts.push(`[href="${href}"]`);
  return `${parts.join('')} [${index}]${text ? ` "${text}"` : ''}`;
}

/** Counts and a one-line summary over the named cases. */
export function summary(cases) {
  if (!Array.isArray(cases)) return { total: 0, pass: 0, fail: 0, ok: false, text: '0 cases, nothing was observed' };
  const pass = cases.filter((c) => c.pass === true).length;
  const fail = cases.length - pass;
  return {
    total: cases.length,
    pass,
    fail,
    ok: cases.length > 0 && fail === 0,
    text: `${cases.length} cases, ${pass} PASS, ${fail} FAIL`,
  };
}

/** The measured elements: visible and not skipped. */
const measured = (readings) => (readings ?? []).filter((r) => r.visible && r.verdict !== VERDICT.skipped);

/**
 * The measured elements, each with a `transition-duration` that was read. An
 * unread one throws rather than reading as zero, which would file the element
 * among the "never animates" exclusions in silence while `ringVerdict` fails
 * the same read.
 */
const measuredWithDuration = (readings) =>
  measured(readings).map((r) => {
    if (typeof r.transitionDuration !== 'string' || r.transitionDuration === '') {
      throw new Error(
        `${describeElement(r)} on ${r.route}: transition-duration read as ${JSON.stringify(r.transitionDuration)}, so whether its outline animates was not observed`
      );
    }
    return r;
  });

/**
 * Every visible, measured element whose `transition-property` names `outline`
 * or `all` AND whose `transition-duration` carries a value above zero,
 * numbered `T-1..`. A transition of `0s` never animates and is not a finding;
 * those are `transitionExclusions`. The ring case reads one element per
 * ground; this is the same rule read on every element, because "never
 * transitioned" is a rule about the ring on any control and not about the one
 * that was focused.
 */
export function transitionFindings(readings) {
  return measuredWithDuration(readings)
    .filter((r) => transitionNamesOutline(r.transitionProperty) && maxTransitionDurationMs(r.transitionDuration) > 0)
    .map((r, i) => ({
      id: `T-${i + 1}`,
      route: r.route,
      selector: describeElement(r),
      text: r.text,
      transitionProperty: r.transitionProperty,
      transitionDuration: r.transitionDuration,
    }));
}

/** The measured elements that name outline or all and never animate, every duration being zero. */
export function transitionExclusions(readings) {
  return measuredWithDuration(readings)
    .filter((r) => transitionNamesOutline(r.transitionProperty) && maxTransitionDurationMs(r.transitionDuration) === 0)
    .map((r) => ({ route: r.route, selector: describeElement(r), transitionProperty: r.transitionProperty, transitionDuration: r.transitionDuration }));
}

/** Per-route tallies out of the element readings. */
export function tally(readings) {
  const counts = { read: 0, pass: 0, fail: 0, skipped: 0 };
  for (const reading of readings ?? []) {
    counts.read += 1;
    if (reading.verdict === VERDICT.pass) counts.pass += 1;
    else if (reading.verdict === VERDICT.fail) counts.fail += 1;
    else counts.skipped += 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// In-page helpers, as source, because they run inside Chromium
// ---------------------------------------------------------------------------

/** The same canvas canonicaliser `ops/cs-tracker-adoption-probe.mjs` uses. */
const CANONICALISE = `
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.globalCompositeOperation = 'copy';
  const canonical = (colour) => {
    if (typeof colour !== 'string' || colour === '') return '';
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return 'rgba(' + d[0] + ', ' + d[1] + ', ' + d[2] + ', ' + (d[3] / 255).toFixed(3) + ')';
  };
`;

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

function readOrBlock(path, what) {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    throw new BlockedError(`${what} could not be read at ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function gitShort(cwd) {
  const result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '?';
}

/** Let finite animations finish before a box is read, within a bounded wait. Infinite ones never finish and are ignored. */
async function settleAnimations(view) {
  await view.evaluate(
    (limit) =>
      Promise.race([
        Promise.all(
          document
            .getAnimations()
            .filter((animation) => {
              try {
                return animation.effect?.getTiming?.().iterations !== Infinity;
              } catch {
                return true;
              }
            })
            .map((animation) => animation.finished.catch(() => null))
        ),
        new Promise((done) => setTimeout(done, limit)),
      ]),
    ANIMATION_SETTLE_MS
  );
}

async function probe({ baseUrl, steamId }) {
  const cases = [];
  const record = (name, pass, detail) => {
    cases.push({ name, pass, detail });
    say(`${pass ? 'PASS' : 'FAIL'}  ${name}: ${detail}`);
  };

  // A configuration the cookie cannot be minted from is nothing observed (3),
  // not a defect in this file (2): the two files are read, not assumed.
  let cookieName;
  let signingSalt;
  let cookie;
  try {
    const secretKeyBase = readSecretKeyBase(readOrBlock(join(CS_TRACKER, ...DEV_CONFIG_REL.split('/')), DEV_CONFIG_REL));
    ({ key: cookieName, signingSalt } = readSessionOptions(readOrBlock(join(CS_TRACKER, ...ENDPOINT_REL.split('/')), ENDPOINT_REL)));
    cookie = mintSessionCookie({ secretKeyBase, signingSalt, steamId });
  } catch (error) {
    if (error instanceof BlockedError) throw error;
    throw new BlockedError(
      `no Owner session cookie can be minted, so no owner route can be observed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  say(`# cs-tracker:   ${CS_TRACKER} at ${gitShort(CS_TRACKER)}`);
  say(`# base url:     ${baseUrl}`);
  say(`# steam id:     ${steamId} (in the cookie; the server must carry the same value in STEAM_ID)`);
  say(
    `# cookie:       ${cookieName}, HS256 over an ETF map, key = PBKDF2-SHA256(secret_key_base, the signing salt ` +
      `${ENDPOINT_REL} declares, ${KEY_ITERATIONS}, ${KEY_LENGTH}); the salt is read at run time and not printed`
  );
  say(`# viewport:     ${VIEWPORT.width}x${VIEWPORT.height}`);
  say(`# interactive:  ${INTERACTIVE_SELECTOR}`);
  say('');

  let chromium;
  try {
    ({ chromium } = require_('@playwright/test'));
  } catch (error) {
    throw new BlockedError(
      `@playwright/test could not be loaded from this repository's node_modules, so no bounding box can be read. ` +
        `Run corepack pnpm install. ${error instanceof Error ? error.message : String(error)}`
    );
  }

  let browser = null;
  try {
    try {
      browser = await chromium.launch();
    } catch (error) {
      throw new BlockedError(
        `no Chromium could be launched, so nothing can be observed. Run corepack pnpm exec playwright install chromium. ` +
          `${error instanceof Error ? error.message : String(error)}`
      );
    }
    say(`# chromium:     ${browser.version()}`);

    const anonymous = await browser.newContext({ viewport: VIEWPORT });
    const owner = await browser.newContext({ viewport: VIEWPORT });
    await owner.addCookies([{ name: cookieName, value: cookie, url: baseUrl }]);

    // ---- the server is there at all --------------------------------------
    let failureResponse;
    try {
      failureResponse = await anonymous.request.get(`${baseUrl}${FAILURE_ROUTE}`, { maxRedirects: 0 });
    } catch (error) {
      throw new BlockedError(
        `nothing answered at ${baseUrl}. Start cs-tracker with STEAM_ID=${steamId} KILL_SWITCH=true mix phx.server. ` +
          `${error instanceof Error ? error.message : String(error)}`
      );
    }

    // ---- case: the cookie passes the gate, and its absence does not ------
    const anonymousRoot = await anonymous.request.get(`${baseUrl}/`, { maxRedirects: 0 });
    const ownerRoot = await owner.request.get(`${baseUrl}/`, { maxRedirects: 0 });
    const anonymousLocation = anonymousRoot.headers()['location'] ?? '';
    const gatePass =
      ownerRoot.status() === 200 &&
      anonymousRoot.status() >= 300 &&
      anonymousRoot.status() < 400 &&
      anonymousLocation.endsWith(SIGN_IN_PATH);
    record(
      'The minted cookie is the one the gate accepts',
      gatePass,
      `GET / with the ${cookieName} cookie answered ${ownerRoot.status()}; without it answered ${anonymousRoot.status()} ` +
        `with location "${anonymousLocation}". The application is the verifier of the token, not this file`
    );
    if (ownerRoot.status() !== 200) {
      throw new BlockedError(
        `GET / with the minted cookie answered ${ownerRoot.status()}, so no owner route can be reached and nothing ` +
          `below could be measured. Either STEAM_ID on the server is not ${steamId}, or the store's shape has moved`
      );
    }

    // ---- resolve /items/:id against the seeded catalog --------------------
    const page = await owner.newPage();
    await page.goto(`${baseUrl}/browse`, { waitUntil: 'load' });
    await page.waitForSelector('.phx-connected', { timeout: 10_000 }).catch(() => null);
    const itemHref = await page.evaluate(() => document.querySelector('a[href^="/items/"]')?.getAttribute('href') ?? null);
    if (itemHref === null) {
      throw new BlockedError(
        `/browse renders no a[href^="/items/"], so the catalog is empty and /items/:id has no target. The pass runs ` +
          `against a seeded development database; run the seed first`
      );
    }
    const routes = OWNER_ROUTES.map((route) => (route === '/items/:id' ? itemHref : route));

    // The dashboard's recently-viewed strip fills only after an item page has
    // been visited on a connected mount (`item_live.ex:57`), and it is a real
    // surface with real links. Visit the item once first, so `/` is measured
    // with the strip rendered and the run reads the same on its first pass as
    // on its second.
    await page.goto(`${baseUrl}${itemHref}`, { waitUntil: 'load' });
    await page.waitForSelector('.phx-connected', { timeout: 10_000 }).catch(() => null);
    say(`# warm-up:      visited ${itemHref} on a connected mount so the dashboard's recently-viewed strip renders`);

    // ---- case: route sweep ---------------------------------------------
    const sweep = [];
    for (const route of routes) {
      const withCookie = await owner.request.get(`${baseUrl}${route}`, { maxRedirects: 0 });
      const without = await anonymous.request.get(`${baseUrl}${route}`, { maxRedirects: 0 });
      const location = without.headers()['location'] ?? '';
      const ok =
        withCookie.status() === 200 && without.status() >= 300 && without.status() < 400 && location.endsWith(SIGN_IN_PATH);
      sweep.push({ route, ok, text: `${route}: ${withCookie.status()} with, ${without.status()} -> "${location}" without` });
    }
    const failureOk = failureResponse.status() === FAILURE_STATUS;
    sweep.push({
      route: FAILURE_ROUTE,
      ok: failureOk,
      text: `${FAILURE_ROUTE}: ${failureResponse.status()} anonymous (expected ${FAILURE_STATUS})`,
    });
    record(
      'Route sweep',
      sweep.every((entry) => entry.ok) && sweep.length === OWNER_ROUTES.length + 1,
      `${sweep.length} routes (pinned at ${OWNER_ROUTES.length + 1}): ${sweep.map((entry) => entry.text).join('; ')}`
    );

    // ---- the contract values, read off :root of the running page --------
    const contract = await page.evaluate(
      ({ floorToken, ringTokens, grounds, canonicaliseSource }) => {
        // eslint-disable-next-line no-new-func
        const canonical = new Function(`${canonicaliseSource}; return canonical;`)();
        const root = window.getComputedStyle(document.documentElement);
        const raw = (name) => root.getPropertyValue(name).trim();
        const asBackground = (name) => {
          const span = document.createElement('span');
          span.style.backgroundColor = `var(${name})`;
          document.body.append(span);
          const value = canonical(window.getComputedStyle(span).backgroundColor);
          span.remove();
          return value;
        };
        return {
          floor: raw(floorToken),
          strokeFocus: raw(ringTokens.width),
          focusOffset: raw(ringTokens.offset),
          focusRaw: raw(ringTokens.colour),
          focus: asBackground(ringTokens.colour),
          grounds: Object.fromEntries(grounds.map((name) => [name, asBackground(name)])),
          groundsRaw: Object.fromEntries(grounds.map((name) => [name, raw(name)])),
        };
      },
      { floorToken: FLOOR_TOKEN, ringTokens: RING_TOKENS, grounds: GROUNDS, canonicaliseSource: CANONICALISE }
    );
    if (contract.floor === '') {
      throw new BlockedError(`${FLOOR_TOKEN} is not declared on :root of the running page, so there is no floor to measure against`);
    }
    let floor;
    try {
      floor = parsePx(contract.floor, FLOOR_TOKEN);
    } catch (error) {
      throw new BlockedError(
        `${FLOOR_TOKEN} on :root cannot be read as a floor, so there is nothing to measure against: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    const ringProblems = contractProblems(contract);
    if (ringProblems.length > 0) {
      throw new BlockedError(`the ring cannot be read against the contract: ${ringProblems.join('; ')}. Nothing below could be measured`);
    }
    const groundValues = Object.values(contract.grounds);
    if (groundValues.some((value) => !isPainted(value)) || new Set(groundValues).size !== GROUNDS.length) {
      throw new BlockedError(
        `the three grounds did not read as three distinct painted colours off :root: ` +
          GROUNDS.map((name) => `${name} = ${contract.grounds[name]}`).join(', ')
      );
    }
    say(`# floor:        ${FLOOR_TOKEN} = ${contract.floor} (read off :root)`);
    say(`# ring:         ${RING_TOKENS.width} = ${contract.strokeFocus}, ${RING_TOKENS.colour} = ${contract.focusRaw} -> ${contract.focus}, ${RING_TOKENS.offset} = ${contract.focusOffset}`);
    for (const name of GROUNDS) say(`# ground:       ${name} = ${contract.groundsRaw[name]} -> ${contract.grounds[name]}`);
    say('');

    // ---- per route: every interactive element, and the ring where a ground is unread
    const findings = [];
    const perRoute = [];
    const allReadings = [];
    const rings = Object.fromEntries(GROUNDS.map((name) => [name, null]));
    const realCandidates = Object.fromEntries(GROUNDS.map((name) => [name, 0]));
    const unclassified = [];
    const sweepPages = [...routes.map((route) => ({ route, context: owner })), { route: FAILURE_ROUTE, context: anonymous }];

    for (const { route, context } of sweepPages) {
      // A route the sweep did not read as this route's own page is not
      // measured: `goto` would follow the redirect and the reading would be
      // attributed to the wrong route. The case fails naming what was swept.
      const swept = sweep.find((entry) => entry.route === route);
      if (swept === undefined || !swept.ok) {
        perRoute.push({ route, connected: false, menu: 'not measured', read: 0, pass: 0, fail: 0, skipped: 0 });
        record(
          `Hit targets on ${route}`,
          false,
          `not measured: the route sweep read ${swept?.text ?? 'nothing for this route'}, so the page that would have been read is not this route's`
        );
        continue;
      }
      const view = await context.newPage();
      await view.goto(`${baseUrl}${route}`, { waitUntil: 'load' });
      const connected = await view
        .waitForSelector('.phx-connected', { timeout: 10_000 })
        .then(() => true)
        .catch(() => false);

      // Reveal the mobile menu first, through the application's own control,
      // so its links are measured rather than skipped as hidden. The click is
      // bounded: a control that cannot be clicked is recorded, not waited on.
      let menu = 'no hamburger on this page';
      const hamburger = view.locator('button[aria-controls="mobile-nav"]');
      if ((await hamburger.count()) > 0 && (await hamburger.first().isVisible())) {
        try {
          await hamburger.first().click({ timeout: CLICK_TIMEOUT_MS });
          menu = (await view
            .waitForFunction(() => {
              const nav = document.getElementById('mobile-nav');
              return nav !== null && !nav.classList.contains('hidden');
            }, null, { timeout: CLICK_TIMEOUT_MS })
            .then(() => true)
            .catch(() => false))
            ? 'revealed by clicking the hamburger'
            : 'the hamburger was clicked and #mobile-nav stayed hidden';
        } catch (error) {
          menu = `the hamburger was not clickable within ${CLICK_TIMEOUT_MS / 1000} s (${String(error instanceof Error ? error.message : error).split('\n')[0]})`;
        }
      }
      // A click leaves focus on the hamburger. Start the Tab sweeps from nothing.
      await view.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      await settleAnimations(view);

      const handles = await view.$$(INTERACTIVE_SELECTOR);
      const readings = [];
      for (let index = 0; index < handles.length; index += 1) {
        const handle = handles[index];
        let description;
        let visible;
        let box;
        try {
          description = await handle.evaluate(
            (element, { i, canonicaliseSource }) => {
              // eslint-disable-next-line no-new-func
              const canonical = new Function(`${canonicaliseSource}; return canonical;`)();
              element.setAttribute('data-cuatro-probe-index', String(i));
              const chain = [];
              for (let node = element.parentElement; node !== null; node = node.parentElement) {
                const style = window.getComputedStyle(node);
                chain.push({ colour: canonical(style.backgroundColor), image: style.backgroundImage });
              }
              const style = window.getComputedStyle(element);
              const classes = typeof element.className === 'string' ? element.className : (element.getAttribute('class') ?? '');
              return {
                index: i,
                tag: element.tagName.toLowerCase(),
                id: element.id,
                classes,
                href: element.getAttribute('href'),
                text: (element.getAttribute('aria-label') || element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
                own: canonical(style.backgroundColor),
                transitionProperty: style.transitionProperty,
                transitionDuration: style.transitionDuration,
                chain,
              };
            },
            { i: index, canonicaliseSource: CANONICALISE }
          );
          visible = await handle.isVisible();
          box = await handle.boundingBox();
        } catch (error) {
          // A LiveView re-render between `$$` and the reads detaches the
          // handle. The sweep is then not of one document state: nothing
          // observed, not a defect here.
          throw new BlockedError(
            `${route}: element ${index} of ${handles.length} could not be read (${String(error instanceof Error ? error.message : error).split('\n')[0]}); ` +
              'the page moved while it was being read, so the sweep is not of one document state'
          );
        }
        const verdict = hitTargetVerdict({ box, visible }, floor);
        const ground = classifyGround(description.chain, contract.grounds);
        const reading = { route, ...description, visible, box, ...verdict, ground };
        readings.push(reading);
        allReadings.push(reading);
        if (verdict.verdict === VERDICT.fail) {
          findings.push({
            id: `F-${findings.length + 1}`,
            route,
            selector: describeElement(description),
            text: description.text,
            width: box.width,
            height: box.height,
            reason: verdict.reason,
          });
        }
        if (visible && verdict.verdict !== VERDICT.skipped) {
          if (ground.ground === null) {
            unclassified.push({ route, selector: describeElement(description), value: ground.value, reason: ground.reason });
          } else {
            realCandidates[ground.ground] += 1;
          }
        }
      }
      const after = await view.evaluate((selector) => document.querySelectorAll(selector).length, INTERACTIVE_SELECTOR);
      const drift = countDrift(handles.length, after);
      if (drift !== null) throw new BlockedError(`${route}: ${drift}`);

      const counts = tally(readings);
      const routeCase = routeCaseVerdict(counts);
      perRoute.push({ route, connected, menu, ...counts });
      // The count sentence already states how many sit under the floor, so
      // that reason is not repeated after it; the others are.
      const otherReasons = routeCase.reasons.filter((reason) => reason !== `${counts.fail} under the floor`);
      record(
        `Hit targets on ${route}`,
        routeCase.pass,
        `${counts.read} read, ${counts.pass} at or over ${floor}x${floor}, ${counts.skipped} skipped, ${counts.fail} under the floor` +
          ` (LiveView ${connected ? 'connected' : 'not connected'}; mobile menu ${menu})` +
          (otherReasons.length > 0 ? `. ${otherReasons.join('; ')}` : '')
      );

      // The ring, on this page, for any ground still unread. A real Tab press is
      // the only way to put the document into the :focus-visible state the rule
      // is written for, so the sweep starts from nothing focused and presses
      // until the chosen element is the active one.
      for (const groundName of GROUNDS) {
        if (rings[groundName] !== null) continue;
        const candidates = readings
          .filter((r) => r.visible && r.verdict !== VERDICT.skipped && r.ground.ground === groundName)
          .sort((a, b) => Number(b.tag === 'button' || /\bbtn\b/.test(b.classes)) - Number(a.tag === 'button' || /\bbtn\b/.test(a.classes)));
        for (const candidate of candidates.slice(0, 3)) {
          const read = await focusAndRead(view, candidate.index, handles.length + 3);
          if (read === null) continue;
          rings[groundName] = { route, candidate, ...read, planted: false };
          break;
        }
      }
      await view.close();
    }

    // ---- a ground no route paints under a reachable interactive element ----
    // Read on a planted daisyUI `.btn`, the application's own class string, in
    // a container painting that ground, appended to the last owner page in the
    // browser only. It is labelled PLANTED when no real element sits on the
    // ground on any route, and UNREACHABLE when real elements do and Tab
    // reached none of them; the label says which, because the two are
    // different findings about the application.
    for (const groundName of GROUNDS) {
      if (rings[groundName] !== null) continue;
      const view = await owner.newPage();
      await view.goto(`${baseUrl}${routes[0]}`, { waitUntil: 'load' });
      await view.waitForSelector('.phx-connected', { timeout: 10_000 }).catch(() => null);
      const total = await view.evaluate(
        ({ ground, selector }) => {
          const wrap = document.createElement('div');
          wrap.setAttribute('data-cuatro-planted', ground);
          wrap.style.cssText = `background-color: var(${ground}); padding: 16px;`;
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'btn btn-primary';
          button.textContent = 'planted control';
          button.setAttribute('data-cuatro-probe-index', 'planted');
          wrap.append(button);
          (document.querySelector('main') ?? document.body).append(wrap);
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
          return document.querySelectorAll(selector).length;
        },
        { ground: groundName, selector: INTERACTIVE_SELECTOR }
      );
      const read = await focusAndRead(view, 'planted', total + 3);
      await view.close();
      rings[groundName] =
        read === null
          ? { route: routes[0], candidate: null, planted: true, unreachable: true }
          : {
              route: routes[0],
              candidate: { tag: 'button', classes: 'btn btn-primary', text: 'planted control', index: 'planted' },
              ...read,
              planted: true,
            };
    }

    // ---- case: the ring on each ground ----------------------------------
    say('');
    say('# focus ring, under a real Tab press, on one element per ground');
    for (const groundName of GROUNDS) {
      const ring = rings[groundName];
      if (ring === null || ring.unreachable) {
        record(
          `Focus ring on ${groundName}`,
          false,
          `no element on that ground could be reached by Tab on any route, and neither could a planted control` +
            (realCandidates[groundName] > 0 ? ` (${realCandidates[groundName]} real element(s) sit on this ground)` : '')
        );
        continue;
      }
      const verdict = ringVerdict(ring.read, contract);
      const groundUnderRing = classifyGround(ring.chain, contract.grounds);
      const contrast = contrastRatio(ring.read.outlineColor, groundUnderRing.value ?? '');
      const caseVerdict = ringCaseVerdict({ verdict, contrast, groundUnderRing, groundName, focusVisible: ring.focusVisible });
      const where = `${ring.route} ${ring.candidate ? describeElement(ring.candidate) : '?'}${groundReadingLabel({ planted: ring.planted, realCandidates: realCandidates[groundName] })}`;
      record(
        `Focus ring on ${groundName}`,
        caseVerdict.pass,
        `${where}: ground under the ring ${groundUnderRing.value} (${groundUnderRing.ground ?? 'none of the three'}), ` +
          `:focus-visible ${ring.focusVisible}, ` +
          `outline-width ${ring.read.outlineWidth}, outline-style ${ring.read.outlineStyle}, outline-color ${ring.read.outlineColor}, ` +
          `outline-offset ${ring.read.outlineOffset}, transition-property "${ring.read.transitionProperty}", ` +
          `transition-duration "${ring.read.transitionDuration}", ` +
          `contrast ${contrast === null ? 'unreadable' : `${contrast.toFixed(2)}:1`} against a ${RING_CONTRAST_FLOOR}:1 floor` +
          (caseVerdict.pass ? '' : `. Departures: ${caseVerdict.reasons.join('; ')}`)
      );
    }

    // ---- case: every ground read was one of the three -------------------
    const measuredTotal = measured(allReadings).length;
    record(
      'Every interactive element sits on one of the three grounds',
      measuredTotal > 0 && unclassified.length === 0,
      measuredTotal === 0
        ? 'nothing was measured, so no ground was classified'
        : unclassified.length === 0
          ? `all ${measuredTotal} measured elements' effective grounds were classified as one of ${GROUNDS.join(', ')}`
          : `${unclassified.length} element(s) sit on a ground that is none of the three: ` +
            unclassified.map((u) => `${u.route} ${u.selector} on ${u.value ?? 'nothing painted'} (${u.reason})`).join('; ')
    );

    // ---- case: no control transitions its outline -----------------------
    const transitioned = transitionFindings(allReadings);
    const excluded = transitionExclusions(allReadings);
    record(
      'No interactive element transitions its outline',
      measuredTotal > 0 && transitioned.length === 0,
      measuredTotal === 0
        ? 'nothing was measured, so no transition was read'
        : transitioned.length === 0
          ? `every measured element's transition-property names neither outline nor all, or names one over a zero duration` +
            ` (${excluded.length} such element(s) excluded)`
          : `${transitioned.length} element(s) carry a transition-property naming outline or all over a duration above zero, so the ring on them is ` +
            `transitioned (${excluded.length} element(s) naming outline or all over 0s are excluded): ` +
            transitioned.map((t) => `${t.route} ${t.selector} "${t.transitionProperty}" over "${t.transitionDuration}"`).join('; ')
    );

    // ---- the findings, numbered ----------------------------------------
    say('');
    say(`# findings, every visible interactive element under ${floor} on either axis, numbered`);
    if (findings.length === 0) say('  none');
    for (const finding of findings) {
      say(
        `  ${finding.id}  ${finding.route}  ${finding.selector}  ${finding.width} x ${finding.height}  (${finding.reason})`
      );
    }
    say('');
    say('# findings, every visible interactive element whose transition-property names outline or all over a duration above zero, numbered');
    if (transitioned.length === 0) say('  none');
    for (const finding of transitioned) {
      say(
        `  ${finding.id}  ${finding.route}  ${finding.selector}  transition-property "${finding.transitionProperty}"  transition-duration "${finding.transitionDuration}"`
      );
    }
    say('');
    say('# excluded from the transition findings: names outline or all, every duration 0s');
    if (excluded.length === 0) say('  none');
    for (const entry of excluded) {
      say(`  ${entry.route}  ${entry.selector}  transition-property "${entry.transitionProperty}"  transition-duration "${entry.transitionDuration}"`);
    }
    say('');
    say(`# passes, every visible interactive element at or over ${floor} on both axes`);
    const passes = allReadings.filter((r) => r.verdict === VERDICT.pass);
    if (passes.length === 0) say('  none');
    for (const r of passes) say(`  ${r.route}  ${describeElement(r)}  ${r.box.width} x ${r.box.height}`);
    say('');
    say('# skipped, hidden or zero-area, never counted as passed');
    const skipped = allReadings.filter((r) => r.verdict === VERDICT.skipped);
    if (skipped.length === 0) say('  none');
    for (const r of skipped) say(`  ${r.route}  ${describeElement(r)}  (${r.reason})`);
    say('');
    say('# per route');
    for (const row of perRoute) {
      say(
        `  ${row.route}: ${row.read} read, ${row.pass} pass, ${row.skipped} skipped, ${row.fail} findings; ` +
          `LiveView ${row.connected ? 'connected' : 'not connected'}; menu ${row.menu}`
      );
    }
    const banner = await (async () => {
      const view = await owner.newPage();
      await view.goto(`${baseUrl}/`, { waitUntil: 'load' });
      const present = await view.evaluate(() => document.getElementById('offline-mode-indicator') !== null);
      await view.close();
      return present;
    })();
    say('# diagnostics, which never carry a verdict');
    say(`  offline banner (KILL_SWITCH=true)  = ${banner ? 'rendered' : 'absent'}`);
    say(`  /items/:id resolved to             = ${itemHref}`);
    say(`  real elements per ground           = ${GROUNDS.map((name) => `${name} ${realCandidates[name]}`).join(', ')}`);

    await anonymous.close();
    await owner.close();
  } finally {
    if (browser !== null) await browser.close().catch(() => undefined);
  }

  const total = summary(cases);
  say('');
  say(`# ${total.text}`);
  return total.ok;
}

/**
 * Tab from nothing until the element carrying `data-cuatro-probe-index="<index>"`
 * is `document.activeElement`, then read its outline, whether `:focus-visible`
 * matched, and its ancestor grounds. Returns null when Tab never reaches it
 * within `presses`.
 */
async function focusAndRead(view, index, presses) {
  await view.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  const wanted = String(index);
  let reached = false;
  for (let pressed = 0; pressed < presses; pressed += 1) {
    await view.keyboard.press('Tab');
    const landed = await view.evaluate(() => document.activeElement?.getAttribute('data-cuatro-probe-index') ?? '');
    if (landed === wanted) {
      reached = true;
      break;
    }
  }
  if (!reached) return null;
  return view.evaluate(
    ({ canonicaliseSource }) => {
      // eslint-disable-next-line no-new-func
      const canonical = new Function(`${canonicaliseSource}; return canonical;`)();
      const focused = document.activeElement;
      const style = window.getComputedStyle(focused);
      const chain = [];
      for (let node = focused.parentElement; node !== null; node = node.parentElement) {
        const ancestor = window.getComputedStyle(node);
        chain.push({ colour: canonical(ancestor.backgroundColor), image: ancestor.backgroundImage });
      }
      return {
        read: {
          outlineWidth: style.outlineWidth,
          outlineStyle: style.outlineStyle,
          outlineColor: canonical(style.outlineColor),
          outlineOffset: style.outlineOffset,
          transitionProperty: style.transitionProperty,
          transitionDuration: style.transitionDuration,
        },
        focusVisible: focused.matches(':focus-visible'),
        chain,
      };
    },
    { canonicaliseSource: CANONICALISE }
  );
}

function thisFile() {
  try {
    return fileURLToPath(import.meta.url);
  } catch {
    return null;
  }
}

function realpathOrSelf(path) {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

const entry = thisFile();
const invokedDirectly =
  entry !== null && typeof process.argv[1] === 'string' && samePath(realpathOrSelf(process.argv[1]), realpathOrSelf(entry));

if (invokedDirectly) {
  const baseUrl = (process.env.CS_TRACKER_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  const steamId = process.env.CS_TRACKER_STEAM_ID ?? DEFAULT_STEAM_ID;
  say('# cs-tracker accessibility pass, Story 1-20, AD-19');
  say(`# started ${new Date().toISOString()}`);
  const inputProblems = validateInputs({ baseUrl, steamId });
  if (inputProblems.length > 0) {
    say(`# BLOCKED: ${inputProblems.join('; ')}`);
    process.stderr.write(`cs-tracker-accessibility-probe: ${inputProblems.join('; ')}\n`);
    process.exitCode = 3;
  } else {
    const startedAt = Date.now();
    probe({ baseUrl, steamId }).then(
      (ok) => {
        say(`# elapsed ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
        say(`# finished ${new Date().toISOString()}`);
        process.exitCode = ok ? 0 : 1;
      },
      (error) => {
        // A server that went away mid-run is nothing observed, not a defect here.
        const blocked = error instanceof BlockedError || isConnectionFailure(error);
        const text = blocked ? (error instanceof Error ? error.message : String(error)) : error instanceof Error ? error.stack : String(error);
        say(`# ${blocked ? 'BLOCKED' : 'PROBE DEFECT'}: ${text}`);
        process.stderr.write(`cs-tracker-accessibility-probe: ${text}\n`);
        process.exitCode = blocked ? 3 : 2;
      }
    );
  }
}
