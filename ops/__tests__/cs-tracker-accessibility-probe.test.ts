// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createHmac, pbkdf2Sync } from 'node:crypto';
import {
  ANIMATION_SETTLE_MS,
  CLICK_TIMEOUT_MS,
  DEFAULT_BASE_URL,
  DEFAULT_STEAM_ID,
  ETF_BINARY,
  ETF_MAP,
  ETF_VERSION,
  FAILURE_ROUTE,
  FAILURE_STATUS,
  FLOOR_TOKEN,
  GROUNDS,
  INTERACTIVE_SELECTOR,
  INTERACTIVE_SELECTORS,
  KEY_DIGEST,
  KEY_ITERATIONS,
  KEY_LENGTH,
  OWNER_ROUTES,
  RING_CONTRAST_FLOOR,
  RING_TOKENS,
  UNPAINTED,
  VERDICT,
  VIEWPORT,
  classifyGround,
  contractProblems,
  countDrift,
  decodeSessionCookie,
  deriveKey,
  describeElement,
  etfBinary,
  etfMap,
  groundReadingLabel,
  hitTargetVerdict,
  isConnectionFailure,
  isPainted,
  maxTransitionDurationMs,
  mintSessionCookie,
  parsePx,
  readSecretKeyBase,
  readSessionOptions,
  ringCaseVerdict,
  ringVerdict,
  routeCaseVerdict,
  samePath,
  sessionTerm,
  summary,
  tally,
  transitionDurationsMs,
  transitionExclusions,
  transitionFindings,
  transitionNamesOutline,
  validateInputs,
  withoutElixirComments,
} from '../cs-tracker-accessibility-probe.mjs';

// `ops/cs-tracker-accessibility-probe.mjs` is the AD-19 pass for Story 1-20,
// and nothing in CI runs it: it needs a browser and a running Phoenix
// application with a database, and neither is on a runner. A probe
// demonstrates only that it could fail on the day it was run. These cases run
// under the blocking `test` job with no browser, no `cs-tracker` and no
// server, and they are what keep the probe able to fail after a later edit.
//
// The module's Playwright, `cs-tracker` and network reads all sit inside the
// run function, so importing it pulls in none of them.

const HERE = 'ops/__tests__/cs-tracker-accessibility-probe.test.ts';

/** A 64-byte secret, the store's own minimum. Not the real one. */
const SECRET = 'a'.repeat(32) + 'b'.repeat(32);
/** A planted salt. Not the one `endpoint.ex` declares, which this repository does not record. */
const SALT = 'planted-salt';
const ID = '76561198000000000';

/** The two `cs-tracker` files, as the parsers see them. Planted, not read off disk. */
const DEV_EXS = [
  'import Config',
  '',
  '# secret_key_base: "commented-out-and-never-read"',
  'config :cs_tracker, CsTrackerWeb.Endpoint,',
  '  http: [ip: {127, 0, 0, 1}, port: 4000],',
  `  secret_key_base: "${SECRET}",`,
  '  watchers: []',
].join('\n');

const ENDPOINT_EX = [
  'defmodule CsTrackerWeb.Endpoint do',
  '  @session_options [',
  '    store: :cookie,',
  '    key: "_cs_tracker_key",',
  `    signing_salt: "${SALT}",`,
  '    # "Lax" is load-bearing, and this comment carries a key: "decoy" that must not be read',
  '    same_site: "Lax",',
  '    http_only: true',
  '  ]',
  'end',
].join('\n');

const RING_CONTRACT = { strokeFocus: '2px', focus: 'rgba(198, 189, 255, 1.000)', focusOffset: '3px' };
const RING_OK = {
  outlineWidth: '2px',
  outlineStyle: 'solid',
  outlineColor: 'rgba(198, 189, 255, 1.000)',
  outlineOffset: '3px',
  transitionProperty: 'color, background-color, border-color, box-shadow',
  transitionDuration: '0.2s, 0.2s, 0.2s, 0.2s',
};
const GROUND_VALUES = {
  '--token-bg': 'rgba(6, 5, 9, 1.000)',
  '--token-bg-raised': 'rgba(13, 12, 19, 1.000)',
  '--token-bg-raised-2': 'rgba(22, 21, 28, 1.000)',
};
const ON_BG = { ground: '--token-bg', value: GROUND_VALUES['--token-bg'] };

describe('the session cookie is Plug\'s shape', () => {
  const token = mintSessionCookie({ secretKeyBase: SECRET, signingSalt: SALT, steamId: ID });
  const decoded = decodeSessionCookie(token);

  it('is three base64url segments whose first decodes to HS256', () => {
    expect(token.split('.')).toHaveLength(3);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(decoded.protected).toBe('HS256');
  });

  it('carries an ETF map (131, 116) with the "steam_id" key and the id as binaries', () => {
    const payload = decoded.payload;
    expect(payload[0]).toBe(ETF_VERSION);
    expect(payload[1]).toBe(ETF_MAP);
    expect(payload.readUInt32BE(2)).toBe(1);
    // key: BINARY_EXT, length 8, "steam_id"
    expect(payload[6]).toBe(ETF_BINARY);
    expect(payload.readUInt32BE(7)).toBe(8);
    expect(payload.subarray(11, 19).toString('utf8')).toBe('steam_id');
    // value: BINARY_EXT, length 17, the id
    expect(payload[19]).toBe(ETF_BINARY);
    expect(payload.readUInt32BE(20)).toBe(17);
    expect(payload.subarray(24, 41).toString('utf8')).toBe(ID);
    expect(payload).toHaveLength(41);
    expect(payload.equals(sessionTerm(ID))).toBe(true);
  });

  it('signs the first two segments with HMAC-SHA256 under the PBKDF2-derived key', () => {
    const key = pbkdf2Sync(SECRET, SALT, KEY_ITERATIONS, KEY_LENGTH, KEY_DIGEST);
    expect(deriveKey(SECRET, SALT).equals(key)).toBe(true);
    const expected = createHmac('sha256', key).update(decoded.signingInput).digest();
    expect(decoded.signature.equals(expected)).toBe(true);
    expect(KEY_ITERATIONS).toBe(1000);
    expect(KEY_LENGTH).toBe(32);
    expect(KEY_DIGEST).toBe('sha256');
  });

  it('changes the signature, and only the signature, when the secret or the salt changes', () => {
    const otherSecret = mintSessionCookie({ secretKeyBase: 'c'.repeat(64), signingSalt: SALT, steamId: ID });
    const otherSalt = mintSessionCookie({ secretKeyBase: SECRET, signingSalt: 'other-salt', steamId: ID });
    const [p, q, s] = token.split('.');
    expect(otherSecret.split('.').slice(0, 2)).toEqual([p, q]);
    expect(otherSecret.split('.')[2]).not.toBe(s);
    expect(otherSalt.split('.').slice(0, 2)).toEqual([p, q]);
    expect(otherSalt.split('.')[2]).not.toBe(s);
    expect(otherSalt.split('.')[2]).not.toBe(otherSecret.split('.')[2]);
  });

  it('is deterministic, so the transcript names one token', () => {
    expect(mintSessionCookie({ secretKeyBase: SECRET, signingSalt: SALT, steamId: ID })).toBe(token);
  });

  it('refuses to mint from nothing', () => {
    expect(() => mintSessionCookie({ secretKeyBase: 'short', signingSalt: SALT, steamId: ID })).toThrow(/64 bytes/);
    expect(() => mintSessionCookie({ secretKeyBase: SECRET, signingSalt: '', steamId: ID })).toThrow(/salt is empty/);
    expect(() => mintSessionCookie({ secretKeyBase: SECRET, signingSalt: SALT, steamId: '1234' })).toThrow(/17-digit/);
    expect(() => mintSessionCookie({ secretKeyBase: SECRET, signingSalt: SALT, steamId: '' })).toThrow(/17-digit/);
    expect(() => etfMap([])).toThrow(/empty session map/);
    expect(() => decodeSessionCookie('a.b')).toThrow(/three segments/);
  });

  it('encodes a binary as tag, big-endian length, bytes', () => {
    const encoded = etfBinary('steam_id');
    expect([...encoded.subarray(0, 5)]).toEqual([ETF_BINARY, 0, 0, 0, 8]);
    expect(encoded.subarray(5).toString('utf8')).toBe('steam_id');
  });
});

describe('the two cs-tracker files the cookie is minted from', () => {
  it('reads secret_key_base out of dev.exs and never out of a comment', () => {
    expect(readSecretKeyBase(DEV_EXS)).toBe(SECRET);
    expect(withoutElixirComments(DEV_EXS)).not.toContain('commented-out');
  });

  it('refuses a dev.exs with no secret_key_base rather than minting with nothing', () => {
    expect(() => readSecretKeyBase('import Config\n')).toThrow(/no secret_key_base/);
    expect(() => readSecretKeyBase('# secret_key_base: "only-in-a-comment"')).toThrow(/no secret_key_base/);
  });

  it('reads the cookie name and the signing salt out of @session_options, skipping the commented decoy', () => {
    expect(readSessionOptions(ENDPOINT_EX)).toEqual({ key: '_cs_tracker_key', signingSalt: SALT });
  });

  it('reads inside the @session_options list only, never a key: or salt elsewhere in the module', () => {
    const decoyFirst = ENDPOINT_EX.replace(
      '  @session_options [',
      '  @other_options [key: "not-the-session", signing_salt: "not-the-salt"]\n  @session_options ['
    );
    expect(readSessionOptions(decoyFirst)).toEqual({ key: '_cs_tracker_key', signingSalt: SALT });
    const onlyOutside = ENDPOINT_EX.replace('    key: "_cs_tracker_key",\n', '').replace('  ]', '  ]\n  @other [key: "outside"]');
    expect(() => readSessionOptions(onlyOutside)).toThrow(/no @session_options with key: and signing_salt:/);
  });

  it('drops a trailing comment on a code line, outside a string, so a decoy after the code is never read', () => {
    // A decoy in a trailing comment that sits before the real line is what a
    // whole-line strip misses: the first `key:` match would then be the decoy.
    const trailing = ENDPOINT_EX.replace('    store: :cookie,', '    store: :cookie, # key: "decoy-before-the-real-line"');
    expect(readSessionOptions(trailing)).toEqual({ key: '_cs_tracker_key', signingSalt: SALT });
    const devTrailing = DEV_EXS.replace('  http: [ip: {127, 0, 0, 1}, port: 4000],', '  http: [ip: {127, 0, 0, 1}, port: 4000], # secret_key_base: "decoy"');
    expect(readSecretKeyBase(devTrailing)).toBe(SECRET);
    expect(withoutElixirComments('a = "x # not a comment" # a comment')).toBe('a = "x # not a comment" ');
    expect(withoutElixirComments('b = "#{interpolated}" # gone')).toBe('b = "#{interpolated}" ');
    expect(withoutElixirComments('c = "escaped \\" quote # kept" # gone')).toBe('c = "escaped \\" quote # kept" ');
    expect(withoutElixirComments(undefined as unknown as string)).toBe('');
  });

  it('refuses an endpoint that encrypts, or that carries no session options', () => {
    expect(() => readSessionOptions(`${ENDPOINT_EX}\n    encryption_salt: "abc",`)).toThrow(/encryption_salt/);
    expect(() => readSessionOptions('defmodule X do\nend')).toThrow(/no @session_options/);
    expect(() => readSessionOptions('')).toThrow(/no @session_options/);
  });
});

describe('the inputs and the failure classes', () => {
  it('accepts the defaults and refuses a bad URL or id up front, naming each', () => {
    expect(validateInputs({ baseUrl: DEFAULT_BASE_URL, steamId: DEFAULT_STEAM_ID })).toEqual([]);
    expect(validateInputs({ baseUrl: 'https://cs-tracker.cuatro.dev', steamId: DEFAULT_STEAM_ID })).toEqual([]);
    const bad = validateInputs({ baseUrl: 'localhost:4000', steamId: '1234' });
    expect(bad).toHaveLength(2);
    expect(bad[0]).toMatch(/CS_TRACKER_URL "localhost:4000" is not a bare http\(s\) origin/);
    expect(bad[1]).toMatch(/CS_TRACKER_STEAM_ID "1234" is not a 17-digit SteamID/);
    expect(validateInputs({ baseUrl: 'ftp://x', steamId: undefined })).toHaveLength(2);
  });

  it('refuses a base URL that is not a bare origin, since every route is appended to it', () => {
    for (const url of ['http://127.0.0.1:4000/', 'http://127.0.0.1:4000/browse', 'http://127.0.0.1:4000?x=1', 'http://127.0.0.1:4000#top']) {
      const problems = validateInputs({ baseUrl: url, steamId: DEFAULT_STEAM_ID });
      expect(problems, url).toHaveLength(1);
      expect(problems[0]).toMatch(/no path, query, fragment or trailing slash/);
    }
    expect(validateInputs({ baseUrl: 'http://[::1]:4000', steamId: DEFAULT_STEAM_ID })).toEqual([]);
  });

  it('classifies a navigation or connection failure as blocked, and a defect as a defect', () => {
    expect(isConnectionFailure(new Error('page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4000/'))).toBe(true);
    expect(isConnectionFailure(new Error('connect ECONNREFUSED 127.0.0.1:4000'))).toBe(true);
    expect(isConnectionFailure(new Error('page.goto: Timeout 30000ms exceeded.'))).toBe(true);
    expect(isConnectionFailure(Object.assign(new Error('x'), { name: 'TimeoutError' }))).toBe(true);
    expect(isConnectionFailure(new TypeError('Cannot read properties of undefined'))).toBe(false);
    // A defect in the probe whose message happens to mention a timeout is still a defect.
    expect(isConnectionFailure(new Error('focusAndRead: the wait for the ring was given no timeout'))).toBe(false);
    expect(isConnectionFailure(undefined)).toBe(false);
  });

  it('compares the invoking path with its own case-insensitively and after resolution', () => {
    expect(samePath('C:\\Repo\\ops\\probe.mjs', 'c:/repo/ops/probe.mjs')).toBe(true);
    expect(samePath('C:\\Repo\\ops\\..\\ops\\probe.mjs', 'C:\\Repo\\ops\\probe.mjs')).toBe(true);
    expect(samePath('C:\\Repo\\ops\\probe.mjs', 'C:\\Repo\\ops\\other.mjs')).toBe(false);
  });

  it('names every contract value the ring cannot be read against, and passes a full read', () => {
    const full = { strokeFocus: '2px', focusOffset: '3px', focusRaw: 'oklch(84% 0.130 288)', focus: 'rgba(198, 189, 255, 1.000)' };
    expect(contractProblems(full)).toEqual([]);
    expect(contractProblems({ ...full, strokeFocus: '' })).toEqual(['--stroke-focus is not declared on :root']);
    expect(contractProblems({ ...full, focusOffset: undefined })).toEqual(['--focus-offset is not declared on :root']);
    expect(contractProblems({ ...full, focusRaw: '' })).toEqual(['--token-focus is not declared on :root']);
    expect(contractProblems({ ...full, focus: UNPAINTED })).toEqual([
      '--token-focus declares oklch(84% 0.130 288) and paints nothing (rgba(0, 0, 0, 0.000))',
    ]);
    expect(contractProblems({})).toHaveLength(3);
  });

  it('reports an interactive count that moved during a sweep', () => {
    expect(countDrift(17, 17)).toBeNull();
    expect(countDrift(17, 18)).toMatch(/moved from 17 to 18/);
  });

  it('labels a planted reading by whether real elements exist on the ground', () => {
    expect(groundReadingLabel({ planted: false, realCandidates: 3 })).toBe('');
    expect(groundReadingLabel({ planted: true, realCandidates: 0 })).toBe(' (PLANTED: no interactive element sits on this ground on any route)');
    expect(groundReadingLabel({ planted: true, realCandidates: 2 })).toBe(
      ' (UNREACHABLE: 2 real element(s) sit on this ground and Tab reached none of them; read on a planted control)'
    );
  });
});

describe('the hit-target verdict', () => {
  it('passes 44 x 44 and larger on both axes', () => {
    expect(hitTargetVerdict({ box: { x: 0, y: 0, width: 44, height: 44 }, visible: true }, 44).verdict).toBe(VERDICT.pass);
    expect(hitTargetVerdict({ box: { x: 0, y: 0, width: 120, height: 48 }, visible: true }, 44).verdict).toBe(VERDICT.pass);
  });

  it('fails 43.5 on either axis, naming the axis and the value', () => {
    const narrow = hitTargetVerdict({ box: { x: 0, y: 0, width: 43.5, height: 44 }, visible: true }, 44);
    expect(narrow.verdict).toBe(VERDICT.fail);
    expect(narrow.reason).toBe('width 43.5 is under 44');

    const short = hitTargetVerdict({ box: { x: 0, y: 0, width: 44, height: 43.5 }, visible: true }, 44);
    expect(short.verdict).toBe(VERDICT.fail);
    expect(short.reason).toBe('height 43.5 is under 44');

    const both = hitTargetVerdict({ box: { x: 0, y: 0, width: 32, height: 32 }, visible: true }, 44);
    expect(both.reason).toBe('width 32 is under 44, height 32 is under 44');
  });

  it('skips a hidden or zero-area element, and never counts it as passed', () => {
    expect(hitTargetVerdict({ box: { x: 0, y: 0, width: 0, height: 0 }, visible: true }, 44).verdict).toBe(VERDICT.skipped);
    expect(hitTargetVerdict({ box: { x: 0, y: 0, width: 50, height: 0 }, visible: true }, 44).verdict).toBe(VERDICT.skipped);
    expect(hitTargetVerdict({ box: null, visible: true }, 44).verdict).toBe(VERDICT.skipped);
    expect(hitTargetVerdict({ box: { x: 0, y: 0, width: 50, height: 50 }, visible: false }, 44).verdict).toBe(VERDICT.skipped);
    expect(hitTargetVerdict({ box: { x: 0, y: 0, width: 50, height: 50 }, visible: false }, 44).reason).toBe('hidden');
  });

  it('throws on a floor that could not be read, rather than defaulting to 44', () => {
    const box = { x: 0, y: 0, width: 10, height: 10 };
    expect(() => hitTargetVerdict({ box, visible: true }, Number.NaN)).toThrow(/not a positive number read off :root/);
    expect(() => hitTargetVerdict({ box, visible: true }, 0)).toThrow(/not a positive number/);
    expect(() => hitTargetVerdict({ box, visible: true }, undefined as unknown as number)).toThrow(/not a positive number/);
    expect(() => hitTargetVerdict({ box, visible: true }, '44px' as unknown as number)).toThrow(/not a positive number/);
  });

  it('reads a px length and refuses anything else', () => {
    expect(parsePx('44px', FLOOR_TOKEN)).toBe(44);
    expect(parsePx(' 2px ', '--stroke-focus')).toBe(2);
    expect(parsePx('-1.5px', 'x')).toBe(-1.5);
    expect(() => parsePx('', FLOOR_TOKEN)).toThrow(/not a px length/);
    expect(() => parsePx('44', FLOOR_TOKEN)).toThrow(/not a px length/);
    expect(() => parsePx('2.75rem', FLOOR_TOKEN)).toThrow(/not a px length/);
  });

  it('fails a route where nothing was read, or nothing measured, and passes one with no failure', () => {
    expect(routeCaseVerdict({ read: 17, pass: 4, fail: 0, skipped: 13 })).toEqual({ pass: true, reasons: [] });
    expect(routeCaseVerdict({ read: 0, pass: 0, fail: 0, skipped: 0 }).reasons).toEqual(['no interactive element was read, so nothing was measured']);
    // Read greater than zero and nothing measured must fail, not pass.
    const allSkipped = routeCaseVerdict({ read: 6, pass: 0, fail: 0, skipped: 6 });
    expect(allSkipped.pass).toBe(false);
    expect(allSkipped.reasons).toEqual(['every one of the 6 elements read was skipped, so nothing was measured']);
    const failing = routeCaseVerdict({ read: 17, pass: 4, fail: 7, skipped: 6 });
    expect(failing.pass).toBe(false);
    expect(failing.reasons).toEqual(['7 under the floor']);
    expect(routeCaseVerdict(undefined as unknown as { read: number }).pass).toBe(false);
  });
});

describe('the focus-ring verdict', () => {
  it('passes the contract\'s own rule as Story 1-19 measured it', () => {
    expect(ringVerdict(RING_OK, RING_CONTRACT)).toEqual({ pass: true, departures: [] });
  });

  it('fails a transitioned outline over a duration above zero, naming the property and the duration', () => {
    const transitioned = ringVerdict({ ...RING_OK, transitionProperty: 'color, outline', transitionDuration: '0.15s, 0.15s' }, RING_CONTRACT);
    expect(transitioned.pass).toBe(false);
    expect(transitioned.departures).toHaveLength(1);
    expect(transitioned.departures[0]).toBe(
      'transition-property "color, outline" names outline or all over "0.15s, 0.15s", and the ring is never transitioned'
    );

    const everything = ringVerdict({ ...RING_OK, transitionProperty: 'all', transitionDuration: '0.2s' }, RING_CONTRACT);
    expect(everything.pass).toBe(false);
    expect(everything.departures[0]).toMatch(/"all" names outline or all over "0\.2s"/);

    const offsetOnly = ringVerdict({ ...RING_OK, transitionProperty: 'outline-offset', transitionDuration: '1ms' }, RING_CONTRACT);
    expect(offsetOnly.pass).toBe(false);
  });

  it('does not fail an outline named over a zero duration, which never animates, but does when no duration was read', () => {
    expect(ringVerdict({ ...RING_OK, transitionProperty: 'all', transitionDuration: '0s' }, RING_CONTRACT).pass).toBe(true);
    const unread = ringVerdict({ ...RING_OK, transitionProperty: 'all', transitionDuration: undefined }, RING_CONTRACT);
    expect(unread.pass).toBe(false);
    expect(unread.departures[0]).toBe('transition-property "all" names outline or all, and the ring is never transitioned');
  });

  it('names each departure separately', () => {
    const wrong = ringVerdict(
      {
        outlineWidth: '1px',
        outlineStyle: 'dashed',
        outlineColor: 'rgba(255, 255, 255, 1.000)',
        outlineOffset: '0px',
        transitionProperty: 'all',
        transitionDuration: '0.3s',
      },
      RING_CONTRACT
    );
    expect(wrong.pass).toBe(false);
    expect(wrong.departures).toHaveLength(5);
    expect(wrong.departures[0]).toBe('outline-width 1px against --stroke-focus 2px');
    expect(wrong.departures[1]).toBe('outline-style dashed rather than solid');
    expect(wrong.departures[2]).toBe('outline-color rgba(255, 255, 255, 1.000) against --token-focus rgba(198, 189, 255, 1.000)');
    expect(wrong.departures[3]).toBe('outline-offset 0px against --focus-offset 3px');
    expect(wrong.departures[4]).toBe('transition-property "all" names outline or all over "0.3s", and the ring is never transitioned');
  });

  it('throws on an empty read or an empty contract value rather than comparing nothing', () => {
    expect(() => ringVerdict({ ...RING_OK, outlineColor: '' }, RING_CONTRACT)).toThrow(/outlineColor read as ""/);
    expect(() => ringVerdict({ ...RING_OK, transitionProperty: '' }, RING_CONTRACT)).toThrow(/transitionProperty read as ""/);
    expect(() => ringVerdict(RING_OK, { ...RING_CONTRACT, focus: '' })).toThrow(/focus read as ""/);
    expect(() => ringVerdict(RING_OK, { ...RING_CONTRACT, strokeFocus: undefined as unknown as string })).toThrow(
      /strokeFocus read as undefined/
    );
  });

  it('reads transition-property for outline or all and nothing else', () => {
    expect(transitionNamesOutline('color, background-color, border-color, box-shadow')).toBe(false);
    expect(transitionNamesOutline('none')).toBe(false);
    expect(transitionNamesOutline('outline')).toBe(true);
    expect(transitionNamesOutline('outline-color')).toBe(true);
    expect(transitionNamesOutline('color,  ALL')).toBe(true);
    expect(transitionNamesOutline('')).toBe(false);
  });

  it('reads transition-duration lists in seconds and milliseconds, and the longest of them', () => {
    expect(transitionDurationsMs('0.15s, 0s, 200ms')).toEqual([150, 0, 200]);
    expect(transitionDurationsMs('0s')).toEqual([0]);
    expect(transitionDurationsMs('')).toEqual([]);
    expect(transitionDurationsMs(undefined)).toEqual([]);
    // An entry that is not a time throws rather than reading as 0, which would
    // file the element among the "never animates" exclusions in silence.
    expect(() => transitionDurationsMs('nonsense')).toThrow(/transition-duration read "nonsense", and "nonsense" is not a time/);
    expect(() => transitionDurationsMs('0.15s, fast')).toThrow(/"fast" is not a time/);
    expect(() => maxTransitionDurationMs('fast')).toThrow(/is not a time/);
    expect(maxTransitionDurationMs('0.15s, 0s')).toBe(150);
    expect(maxTransitionDurationMs('0s, 0s')).toBe(0);
    expect(maxTransitionDurationMs('')).toBe(0);
  });

  it('numbers every measured element whose transition reaches the outline over a real duration, and excludes the zero ones', () => {
    const base = { tag: 'a', id: '', classes: 'link', href: '/x', text: 'x', index: 0, visible: true, verdict: VERDICT.pass };
    const readings = [
      { ...base, route: '/', index: 0, transitionProperty: 'all', transitionDuration: '0.15s' },
      { ...base, route: '/', index: 1, transitionProperty: 'color, background-color', transitionDuration: '0.15s, 0.15s' },
      { ...base, route: '/browse', index: 2, transitionProperty: 'outline-color', transitionDuration: '200ms', verdict: VERDICT.fail },
      // Names all over 0s: never animates, excluded and counted as such.
      { ...base, route: '/browse', index: 3, transitionProperty: 'all', transitionDuration: '0s' },
      // Hidden and skipped elements were never measured, so they are neither.
      { ...base, route: '/browse', index: 4, transitionProperty: 'all', transitionDuration: '0.15s', visible: false, verdict: VERDICT.skipped },
    ];
    const found = transitionFindings(readings);
    expect(found).toHaveLength(2);
    expect(found.map((f: { id: string }) => f.id)).toEqual(['T-1', 'T-2']);
    expect(found[0]).toMatchObject({ route: '/', transitionProperty: 'all', transitionDuration: '0.15s', selector: 'a.link[href="/x"] [0] "x"' });
    expect(found[1]).toMatchObject({ route: '/browse', transitionProperty: 'outline-color', transitionDuration: '200ms' });
    const excluded = transitionExclusions(readings);
    expect(excluded).toHaveLength(1);
    expect(excluded[0]).toMatchObject({ route: '/browse', transitionProperty: 'all', transitionDuration: '0s' });
    expect(transitionFindings([])).toEqual([]);
    expect(transitionFindings(undefined as unknown as [])).toEqual([]);
    expect(transitionExclusions(undefined as unknown as [])).toEqual([]);
  });

  it('throws on a measured element whose transition-duration was not read, rather than filing it as never animating', () => {
    const base = { tag: 'a', id: '', classes: 'link', href: '/x', text: 'x', index: 0, visible: true, verdict: VERDICT.pass, route: '/' };
    expect(() => transitionFindings([{ ...base, transitionProperty: 'all', transitionDuration: '' }])).toThrow(
      /a\.link\[href="\/x"\] \[0\] "x" on \/: transition-duration read as "", so whether its outline animates was not observed/
    );
    expect(() => transitionExclusions([{ ...base, transitionProperty: 'all', transitionDuration: undefined }])).toThrow(/read as undefined/);
    // A skipped element was never measured, so its unread duration is not a throw.
    expect(transitionExclusions([{ ...base, transitionProperty: 'all', transitionDuration: undefined, visible: false, verdict: VERDICT.skipped }])).toEqual([]);
  });

  it('passes the ring case only with a passing verdict, contrast at or over 3, the requested ground and :focus-visible', () => {
    const ok = { verdict: { pass: true, departures: [] }, groundUnderRing: ON_BG, groundName: '--token-bg', focusVisible: true };
    expect(ringCaseVerdict({ ...ok, contrast: 11.73 })).toEqual({ pass: true, reasons: [] });
    expect(ringCaseVerdict({ ...ok, contrast: 3 })).toEqual({ pass: true, reasons: [] });

    const low = ringCaseVerdict({ ...ok, contrast: 2.99 });
    expect(low.pass).toBe(false);
    expect(low.reasons).toEqual([`contrast 2.99:1 is under the ${RING_CONTRAST_FLOOR}:1 floor`]);

    const unread = ringCaseVerdict({ ...ok, contrast: null });
    expect(unread.pass).toBe(false);
    expect(unread.reasons).toEqual(['the contrast against the ground could not be computed']);

    const elsewhere = ringCaseVerdict({ ...ok, contrast: 11, groundUnderRing: { ground: '--token-bg-raised', value: GROUND_VALUES['--token-bg-raised'] } });
    expect(elsewhere.pass).toBe(false);
    expect(elsewhere.reasons[0]).toBe('the element was chosen on --token-bg and the ring sits on --token-bg-raised (rgba(13, 12, 19, 1.000))');

    const mouse = ringCaseVerdict({ ...ok, contrast: 11, focusVisible: false });
    expect(mouse.pass).toBe(false);
    expect(mouse.reasons).toEqual([':focus-visible did not match on the focused element, so the ring read is not the keyboard ring']);

    const departed = ringCaseVerdict({ ...ok, contrast: 11, verdict: { pass: false, departures: ['outline-style dashed rather than solid'] } });
    expect(departed.pass).toBe(false);
    expect(departed.reasons).toEqual(['outline-style dashed rather than solid']);
  });
});

describe('the ground classifier', () => {
  it('takes the first painted background from the parent upward and names the ground', () => {
    const chain = [UNPAINTED, UNPAINTED, GROUND_VALUES['--token-bg-raised'], GROUND_VALUES['--token-bg']];
    expect(classifyGround(chain, GROUND_VALUES)).toEqual({ ground: '--token-bg-raised', value: GROUND_VALUES['--token-bg-raised'] });
    expect(classifyGround([GROUND_VALUES['--token-bg-raised-2']], GROUND_VALUES).ground).toBe('--token-bg-raised-2');
    // The shape the probe reads: colour and image per ancestor.
    const objects = [
      { colour: UNPAINTED, image: 'none' },
      { colour: GROUND_VALUES['--token-bg'], image: 'none' },
    ];
    expect(classifyGround(objects, GROUND_VALUES)).toEqual(ON_BG);
  });

  it('reports a ground that is none of the three by value, never silently binned', () => {
    const odd = classifyGround([UNPAINTED, 'rgba(220, 38, 38, 1.000)'], GROUND_VALUES);
    expect(odd.ground).toBeNull();
    expect(odd.value).toBe('rgba(220, 38, 38, 1.000)');
    expect(odd.reason).toContain('rgba(220, 38, 38, 1.000) is none of --token-bg, --token-bg-raised, --token-bg-raised-2');

    // A translucent fill is painted and is not a ground, so it is reported too.
    const translucent = classifyGround(['rgba(238, 238, 242, 0.102)', GROUND_VALUES['--token-bg']], GROUND_VALUES);
    expect(translucent.ground).toBeNull();
    expect(translucent.value).toBe('rgba(238, 238, 242, 0.102)');
  });

  it('treats an ancestor painting a background-image as painted and unclassifiable', () => {
    const imaged = classifyGround(
      [
        { colour: UNPAINTED, image: 'none' },
        { colour: UNPAINTED, image: 'url("https://example.invalid/texture.png")' },
        { colour: GROUND_VALUES['--token-bg'], image: 'none' },
      ],
      GROUND_VALUES
    );
    expect(imaged.ground).toBeNull();
    expect(imaged.value).toBe('url("https://example.invalid/texture.png")');
    expect(imaged.reason).toMatch(/paints a background-image .* before any ground colour, and an image is no ground/);
    // A gradient is an image too, and a painted colour beneath it does not rescue it.
    expect(classifyGround([{ colour: GROUND_VALUES['--token-bg'], image: 'linear-gradient(rgb(0, 0, 0), rgb(1, 1, 1))' }], GROUND_VALUES).ground).toBeNull();
  });

  it('reports a chain that paints nothing, and a chain that is not a chain', () => {
    expect(classifyGround([UNPAINTED, UNPAINTED], GROUND_VALUES)).toEqual({
      ground: null,
      value: null,
      reason: 'nothing is painted from the element to the root',
    });
    expect(classifyGround([], GROUND_VALUES).ground).toBeNull();
    expect(classifyGround(undefined as unknown as string[], GROUND_VALUES).reason).toMatch(/no ancestor chain/);
  });

  it('calls a colour painted only when its alpha is above zero', () => {
    expect(isPainted(UNPAINTED)).toBe(false);
    expect(isPainted('rgba(6, 5, 9, 1.000)')).toBe(true);
    expect(isPainted('rgba(6, 5, 9, 0.004)')).toBe(true);
    expect(isPainted('')).toBe(false);
    expect(isPainted(undefined)).toBe(false);
  });
});

describe('the summary and the tallies', () => {
  it('refuses to call zero cases a pass', () => {
    expect(summary([]).ok).toBe(false);
    expect(summary(undefined as unknown as []).ok).toBe(false);
  });

  it('counts passes and failures', () => {
    expect(summary([{ pass: true }, { pass: true }])).toEqual({ total: 2, pass: 2, fail: 0, ok: true, text: '2 cases, 2 PASS, 0 FAIL' });
    expect(summary([{ pass: true }, { pass: false }]).ok).toBe(false);
    expect(summary([{ pass: true }, { pass: false }]).text).toBe('2 cases, 1 PASS, 1 FAIL');
  });

  it('tallies read, pass, fail and skipped separately', () => {
    expect(tally([{ verdict: VERDICT.pass }, { verdict: VERDICT.fail }, { verdict: VERDICT.skipped }, { verdict: VERDICT.fail }])).toEqual({
      read: 4,
      pass: 1,
      fail: 2,
      skipped: 1,
    });
    expect(tally([])).toEqual({ read: 0, pass: 0, fail: 0, skipped: 0 });
  });

  it('describes an element by tag, id, first classes, href, index and text', () => {
    expect(
      describeElement({ tag: 'button', id: '', classes: 'btn btn-ghost btn-sm btn-square md:hidden', href: null, text: 'Toggle navigation', index: 0 })
    ).toBe('button.btn.btn-ghost.btn-sm.btn-square [0] "Toggle navigation"');
    expect(describeElement({ tag: 'a', id: 'x', classes: '', href: '/browse', text: '', index: 3 })).toBe('a#x[href="/browse"] [3]');
  });
});

describe(`${HERE} pins what the run sweeps`, () => {
  it('pins the interactive selector list, the routes, the grounds, the viewport and the two waits', () => {
    expect(INTERACTIVE_SELECTORS).toEqual([
      'a[href]',
      'button',
      'input',
      'select',
      'textarea',
      'summary',
      '[role=button]',
      '[role=link]',
      '[tabindex]:not([tabindex="-1"])',
    ]);
    expect(INTERACTIVE_SELECTOR).toBe(INTERACTIVE_SELECTORS.join(', '));
    expect(OWNER_ROUTES).toEqual(['/', '/browse', '/inventory', '/wishlist', '/items/:id']);
    expect(FAILURE_ROUTE).toBe('/auth/steam/callback?openid.mode=bad');
    expect(FAILURE_STATUS).toBe(401);
    expect(GROUNDS).toEqual(['--token-bg', '--token-bg-raised', '--token-bg-raised-2']);
    expect(VIEWPORT).toEqual({ width: 360, height: 800 });
    expect(FLOOR_TOKEN).toBe('--tap');
    expect(RING_TOKENS).toEqual({ width: '--stroke-focus', colour: '--token-focus', offset: '--focus-offset' });
    expect(RING_CONTRAST_FLOOR).toBe(3);
    expect(DEFAULT_BASE_URL).toBe('http://127.0.0.1:4000');
    // test/support/conn_case.ex:39, the allowlisted Owner in cs-tracker's own suite.
    expect(DEFAULT_STEAM_ID).toBe('76561198000000000');
    expect(CLICK_TIMEOUT_MS).toBe(5000);
    expect(ANIMATION_SETTLE_MS).toBe(3000);
  });

  it('imports only pure parts, so no browser, server or cs-tracker checkout is needed', () => {
    expect(typeof mintSessionCookie).toBe('function');
    expect(typeof hitTargetVerdict).toBe('function');
    expect(typeof ringVerdict).toBe('function');
    expect(typeof classifyGround).toBe('function');
    expect(typeof ringCaseVerdict).toBe('function');
    expect(typeof routeCaseVerdict).toBe('function');
  });
});
