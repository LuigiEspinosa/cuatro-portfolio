// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import {
  API,
  GITHUB_SOURCE,
  RECORD_REL,
  REGISTRY_REL,
  SECRET,
  TIMEOUT_MS,
  TOLERATED_HEADING,
  USER_AGENT,
  classify,
  kv2Rows,
  main,
  summaryTable,
  vendoredTarget,
  verify,
} from '../registry-verification.mjs';
import {
  ANCHOR_TOKENS,
  RECORD_REL as ADOPTION_REL,
  adopterRows,
  recordedAdoptedVersion,
  section,
  table,
} from '../contract-adoption.mjs';

/**
 * Story 2.23's job, held to its record and shown firing on a planted fetcher.
 *
 * One standing case per row of the story's I/O matrix, the two record parsers
 * on planted controls, `main` driven with a planted fetcher and environment
 * through its exit 0, exit 1 and exit 2 paths, the spawned script with the
 * secret unset, the workflow's text read as the data it is (nothing executes
 * it before it reaches `main`), and the one cross-file pin the story closes:
 * the Registry's `token_contract` for `cs-tracker` equals the version
 * `ops/contract-adoption.md` records.
 *
 * Every parser asserts it read something, every verdict is shown firing, and
 * the planted token is held out of every line the job would print.
 */

const REPO_ROOT = process.cwd();
const HERE = 'ops/__tests__/registry-verification.test.ts';
const SCRIPT = resolve(REPO_ROOT, 'ops/registry-verification.mjs');
const WORKFLOW = resolve(REPO_ROOT, '.github/workflows/registry-verification.yml');
const JOB = 'registry-verification';

const read = (path: string): string => {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error(`${HERE}: ${path} could not be read: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const spawned = <T>(run: SpawnSyncReturns<T>): SpawnSyncReturns<T> => {
  if (run.error) throw run.error;
  return run;
};

type Entry = { id: string; source: string; status: string; live?: string; token_contract?: string; [key: string]: unknown };
type Registry = { applications: Entry[] };

const registry = JSON.parse(read(resolve(REPO_ROOT, REGISTRY_REL))) as Registry;
const record = read(resolve(REPO_ROOT, RECORD_REL));
const adoption = read(resolve(REPO_ROOT, ADOPTION_REL));

const TOKEN = 'github_pat_planted_never_printed';
const TOKENS_CSS = '/* Cuatro Ecosystem, Design Tokens\n * Contract v1.0.0 · dark only · anchor hue 288\n */\n:root {}\n';

/**
 * `cs-tracker`'s vendored header at the version the committed Registry declares: 2.0.0 from
 * 2026-09-24, when Contract 2.0.0 was re-vendored as `cs-tracker` commit `991d0f6` and the Registry
 * moved with it (Operator ruling, DW-15). The remote `main` reads it once the Operator pushes
 * (`ops/contract-adoption.md` action 8); until then the scheduled job fails naming both versions,
 * which is the mismatch case under `token_contract` below.
 */
const TOKENS_CSS_AT_REGISTRY = TOKENS_CSS.replace('v1.0.0', 'v2.0.0');
const CS_TRACKER_TOKENS = 'assets/css/cuatro-contracts/tokens.css';
const SLUG = 'LuigiEspinosa/cs-tracker';

/**
 * The record's four KV-2 rows, pinned in table order. cs-tournament's row is struck (published
 * 2026-09-24 by Operator ruling), so it stays in the table as history and tolerates nothing.
 */
const KV2_TABLE = ['LuigiEspinosa/cs-tracker', 'LuigiEspinosa/cs-tournament', 'LuigiEspinosa/StreamVault', 'LuigiEspinosa/Mutuo'];
const STRUCK = ['LuigiEspinosa/cs-tournament'];
/** The repositories that still answer 404 anonymously: the table less its struck rows. */
const PRIVATE = KV2_TABLE.filter((slug) => !STRUCK.includes(slug));
const ARCHIVED = ['LuigiEspinosa/Lumen', 'LuigiEspinosa/tcg-tracker'];
/** The three `live` URLs that answer 3xx at the first hop, as observed 2026-09-12. */
const REDIRECTING: Record<string, number> = {
  'https://tracker.cuatro.dev': 307,
  'https://cs-tracker.cuatro.dev': 302,
  'https://library.cuatro.dev': 302,
};

// ---------------------------------------------------------------------------
// The planted fetcher and the two record fragments
// ---------------------------------------------------------------------------

type Answer = number | Error | { status: number; body?: string | ReadableStream };
type Call = { url: string; init: RequestInit | undefined };

/**
 * A fetcher answering each URL from a queue of answers, the last one repeating,
 * recording every call. An unplanted URL is a thrown error, which the module
 * treats as a network error, and is recorded so a case can assert none.
 */
const planted = (routes: Record<string, Answer | Answer[]>) => {
  const calls: Call[] = [];
  const unplanted: string[] = [];
  const queues = new Map(Object.entries(routes).map(([url, answer]) => [url, Array.isArray(answer) ? [...answer] : [answer]]));
  const fetch = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    const queue = queues.get(url);
    if (queue === undefined) {
      unplanted.push(url);
      throw new Error(`unplanted ${url}`);
    }
    const answer = queue.length > 1 ? (queue.shift() as Answer) : queue[0];
    if (answer instanceof Error) throw answer;
    if (typeof answer === 'number') return new Response(null, { status: answer });
    return new Response(answer.body ?? null, { status: answer.status });
  };
  return { fetch, calls, unplanted };
};

const repos = (slug: string, archived = false): { status: number; body: string } => ({
  status: 200,
  body: JSON.stringify({ full_name: slug, default_branch: 'main', archived }),
});
const contents = (slug: string, path: string, ref = 'main'): string =>
  `${API}/repos/${slug}/contents/${path}?ref=${encodeURIComponent(ref)}`;

/**
 * The routes the committed Registry needs, answered as the estate answered on 2026-09-12, but for
 * `cs-tracker`'s vendored header, which answers at the version the Registry declares.
 */
const routesForCommittedRegistry = (): Record<string, Answer | Answer[]> => {
  const routes: Record<string, Answer | Answer[]> = {};
  for (const entry of registry.applications) {
    const match = GITHUB_SOURCE.exec(entry.source);
    if (match === null) throw new Error(`${HERE}: ${entry.id} has a source off github.com, which this fixture does not plant`);
    const slug = `${match[1]}/${match[2]}`;
    routes[`${API}/repos/${slug}`] = repos(slug, ARCHIVED.includes(slug));
    routes[entry.source] = PRIVATE.includes(slug) ? 404 : 200;
    if (entry.live !== undefined) routes[entry.live] = REDIRECTING[entry.live] ?? 200;
  }
  routes[contents(SLUG, CS_TRACKER_TOKENS)] = { status: 200, body: TOKENS_CSS_AT_REGISTRY };
  return routes;
};

/** A verification-record fragment carrying the KV-2 table, in the record's own shape. */
const recordFragment = (rows: string[][] = PRIVATE.map((slug) => [`\`${slug}\``, 'Private', '2026-09-02'])): string =>
  [
    '# A record',
    '',
    `## ${TOLERATED_HEADING}`,
    '',
    '| Repository | Ruling | Since |',
    '|---|---|---|',
    ...rows.map((row) => `| ${row.join(' | ')} |`),
    '',
    '## Stated limits',
    '',
  ].join('\n');

/** An adoption-record fragment carrying the adopted-versions table only, which is all `verify` reads of it. */
const adoptionFragment = (
  adopters: string[][] = [
    ['`cuatro-portfolio`', '`contracts/tokens.css`', '1.0.0'],
    ['`cs-tracker`', `\`${CS_TRACKER_TOKENS}\``, '1.0.0'],
  ]
): string =>
  [
    '# A record',
    '',
    '## The adopted versions',
    '',
    'Published contract version: **1.0.0**, read off the header.',
    '',
    '| Application | Consumption route | File read | Header read | Adopted version | Nature and method |',
    '|---|---|---|---|---|---|',
    ...adopters.map(([app, path, version]) => `| ${app} | route | ${path} | header | ${version} | method |`),
    '',
    '## Stated limits',
    '',
  ].join('\n');

const entry = (overrides: Partial<Entry> & { id: string }): Entry => ({
  status: 'Live',
  source: `https://github.com/LuigiEspinosa/${overrides.id}`,
  ...overrides,
});

type Input = Parameters<typeof verify>[0];

const one = (application: Entry, extra: Partial<Input> = {}) =>
  verify({
    registry: { applications: [application] },
    record: recordFragment(),
    adoption: adoptionFragment(),
    token: TOKEN,
    fetch: planted({}).fetch,
    ...extra,
  });

const rowsOf = (result: Awaited<ReturnType<typeof verify>>, check: string) => result.rows.filter((row) => row.check === check);

/** A scratch directory for a planted `GITHUB_STEP_SUMMARY`, removed after use, so a killed run leaves nothing. */
const withScratch = async <T>(use: (dir: string) => Promise<T>): Promise<T> => {
  const dir = mkdtempSync(join(tmpdir(), 'registry-verification-'));
  try {
    return await use(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

// ---------------------------------------------------------------------------
// Matrix row 1: all fourteen, PAT present
// ---------------------------------------------------------------------------

describe('the committed Registry against the estate as observed', () => {
  const fetcher = planted(routesForCommittedRegistry());
  const run = verify({ registry, record, adoption, fetch: fetcher.fetch, token: TOKEN });

  it('passes 35 checks: 14 exists, 11 resolves and 3 tolerated with no KV-2 row left to strike, 6 live of which 3 by 3xx, 1 token', async () => {
    const result = await run;
    expect(fetcher.unplanted, 'the fixture did not plant a URL the Registry carries').toEqual([]);
    expect(result.rows).toHaveLength(35);
    expect(result.lines).toHaveLength(35);
    expect(result.ok, result.lines.filter((line) => line.startsWith('FAIL')).join('\n')).toBe(true);

    const exists = rowsOf(result, 'source exists');
    expect(exists).toHaveLength(14);
    expect(exists.filter((row) => row.detail.endsWith(', archived')).map((row) => row.id).sort()).toEqual(['lumen', 'tcg-tracker']);

    const resolves = rowsOf(result, 'source resolves');
    expect(resolves).toHaveLength(14);
    const tolerated = resolves.filter((row) => row.detail.includes('tolerated by KV-2'));
    expect(tolerated.map((row) => row.id).sort()).toEqual(['cs-tracker', 'mutuo', 'streamvault']);
    expect(resolves.filter((row) => row.detail.includes('can be struck')).map((row) => row.id)).toEqual([]);
    expect(resolves.filter((row) => row.detail.includes('answered 200 anonymously'))).toHaveLength(11);

    const live = rowsOf(result, 'live');
    expect(live).toHaveLength(6);
    expect(live.filter((row) => /answered 30[27]$/.test(row.detail))).toHaveLength(3);
    expect(live.filter((row) => row.detail.endsWith('answered 200'))).toHaveLength(3);

    const token = rowsOf(result, 'token_contract');
    expect(token).toHaveLength(1);
    expect(token[0].id).toBe('cs-tracker');
    expect(token[0].detail).toBe(`the Registry declares 2.0.0 and ${SLUG}:${CS_TRACKER_TOKENS}@main reads Contract v2.0.0`);
  });

  it('prints one PASS or FAIL line per check in the probe shape, and the same rows as a table', async () => {
    const result = await run;
    for (const line of result.lines) expect(line).toMatch(/^(PASS|FAIL) {2}[a-z0-9-]+ (source exists|source resolves|live|token_contract): \S/);
    const summary = summaryTable(result.rows);
    expect(summary).toContain('## Registry verification: 35 of 35 checks passed');
    expect(summary.split('\n').filter((line) => /^\| [a-z0-9-]+ \| /.test(line))).toHaveLength(35);
    expect(summaryTable([{ id: 'x', check: 'live', pass: false, detail: 'a | b' }])).toContain('| a \\| b |');
    expect(summaryTable([])).toContain('0 of 0 checks passed');
  });

  it('makes exactly one request per check with the named user agent, no redirect, a 15 s signal, and the token only to api.github.com', async () => {
    await run;
    expect(TIMEOUT_MS).toBe(15_000);
    expect(fetcher.calls, 'the happy path has no retries, so a doubled request is a defect').toHaveLength(35);
    for (const { url, init } of fetcher.calls) {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers['User-Agent'], url).toBe(USER_AGENT);
      expect(init?.redirect, url).toBe('manual');
      expect(init?.method, url).toBe('GET');
      expect(init?.signal, url).toBeInstanceOf(AbortSignal);
      if (url.startsWith(`${API}/`)) {
        expect(headers.Authorization, url).toBe(`Bearer ${TOKEN}`);
      } else {
        expect(headers.Authorization, `${url} must be fetched anonymously`).toBeUndefined();
      }
    }
    const contentsCalls = fetcher.calls.filter(({ url }) => url.includes('/contents/'));
    expect(contentsCalls).toHaveLength(1);
    expect((contentsCalls[0].init?.headers as Record<string, string>).Accept).toBe('application/vnd.github.raw');
  });

  it('never prints the token', async () => {
    const result = await run;
    expect(result.lines.join('\n')).not.toContain(TOKEN);
    expect(summaryTable(result.rows)).not.toContain(TOKEN);
  });
});

// ---------------------------------------------------------------------------
// main: the exit 0, exit 1 and exit 2 paths, on a planted fetcher and environment
// ---------------------------------------------------------------------------

describe('main', () => {
  it('exits 0 on the committed Registry and appends exactly summaryTable(rows) to GITHUB_STEP_SUMMARY', async () => {
    await withScratch(async (dir) => {
      const file = join(dir, 'summary.md');
      const result = await main(planted(routesForCommittedRegistry()).fetch, { [SECRET]: TOKEN, GITHUB_STEP_SUMMARY: file });
      expect(result.code, result.message).toBe(0);
      expect(result.message.split('\n')).toHaveLength(36);
      expect(result.message.split('\n').at(-1)).toBe('# 35 of 35 checks passed');
      const { rows } = await verify({ registry, record, adoption, fetch: planted(routesForCommittedRegistry()).fetch, token: TOKEN });
      expect(readFileSync(file, 'utf8')).toBe(`${summaryTable(rows)}\n`);
    });
  });

  it('exits 1 with the cause when one check fails, which is the notify contract', async () => {
    const routes = { ...routesForCommittedRegistry(), 'https://github.com/LuigiEspinosa/list-wheel': 404 };
    const result = await main(planted(routes).fetch, { [SECRET]: TOKEN });
    expect(result.code).toBe(1);
    expect(result.message.endsWith('# 34 of 35 checks passed')).toBe(true);
    expect(result.message).toContain('FAIL  list-wheel source resolves: absent:');
  });

  it('exits 2 naming the summary path when GITHUB_STEP_SUMMARY cannot be written, the lines still printed', async () => {
    await withScratch(async (dir) => {
      const file = join(dir, 'missing', 'summary.md');
      const result = await main(planted(routesForCommittedRegistry()).fetch, { [SECRET]: TOKEN, GITHUB_STEP_SUMMARY: file });
      expect(result.code).toBe(2);
      expect(result.message).toContain('# 35 of 35 checks passed');
      expect(result.message).toContain(`the job summary at ${file.replace(/\\/g, '\\\\')} could not be written`);
      expect(existsSync(file)).toBe(false);
    });
  });

  it('exits 2 naming the secret when the environment lacks it, and fetches nothing', async () => {
    const fetcher = planted(routesForCommittedRegistry());
    const result = await main(fetcher.fetch, {});
    expect(result.code).toBe(2);
    expect(result.message).toMatch(new RegExp(`^${SECRET} is not set, so nothing was fetched`));
    expect(fetcher.calls).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Matrix row 2: secret absent
// ---------------------------------------------------------------------------

describe('the secret absent', () => {
  it('throws naming the secret and fetches nothing', async () => {
    const fetcher = planted(routesForCommittedRegistry());
    await expect(verify({ registry, record, adoption, fetch: fetcher.fetch, token: undefined })).rejects.toThrow(
      new RegExp(`^${SECRET} is not set, so nothing was fetched`)
    );
    await expect(verify({ registry, record, adoption, fetch: fetcher.fetch, token: '' })).rejects.toThrow(SECRET);
    expect(fetcher.calls).toEqual([]);
  });

  it('the spawned script exits 2 with one line naming it, on stderr, and fetches nothing', () => {
    const env = { ...process.env };
    delete env[SECRET];
    const run = spawned(spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', env }));
    expect(run.status, `${run.stdout}${run.stderr}`).toBe(2);
    expect(run.stdout).toBe('');
    expect(run.stderr.trim().split('\n')).toHaveLength(1);
    expect(run.stderr).toContain(SECRET);
  });

  it('exit 2 is also what an empty Registry earns: a defect, not a finding', async () => {
    await expect(one(entry({ id: 'x' }), { registry: { applications: [] } })).rejects.toThrow(/carries no applications/);
  });
});

// ---------------------------------------------------------------------------
// A malformed entry is a defect, thrown naming it, never a row keyed undefined
// ---------------------------------------------------------------------------

describe('a malformed entry', () => {
  it('throws naming the Registry and the entry before anything is fetched', async () => {
    const fetcher = planted({});
    const numeric = { id: 7, source: 'https://github.com/LuigiEspinosa/x', status: 'Live' } as unknown as Entry;
    await expect(one(numeric, { fetch: fetcher.fetch })).rejects.toThrow(`${REGISTRY_REL} entry 0 carries no string id, so it cannot be verified`);
    const noSource = { id: 'x', status: 'Live' } as unknown as Entry;
    await expect(one(noSource, { fetch: fetcher.fetch })).rejects.toThrow(`${REGISTRY_REL} entry 0 (x) carries no string source, so it cannot be verified`);
    const live = entry({ id: 'x', live: 5 as unknown as string });
    await expect(one(live, { fetch: fetcher.fetch })).rejects.toThrow(`${REGISTRY_REL} entry 0 (x) carries a live that is not a string`);
    const token = entry({ id: 'x', token_contract: null as unknown as string });
    await expect(one(token, { fetch: fetcher.fetch })).rejects.toThrow(/carries a token_contract that is not a string/);
    await expect(
      verify({ registry: { applications: [entry({ id: 'ok' }), null as unknown as Entry] }, record: recordFragment(), adoption: adoptionFragment(), fetch: fetcher.fetch, token: TOKEN })
    ).rejects.toThrow(`${REGISTRY_REL} entry 1 is not an object`);
    expect(fetcher.calls).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Matrix rows 3 and 4: the anonymous half of source, against the KV-2 table
// ---------------------------------------------------------------------------

describe('the anonymous half of source', () => {
  it('fails naming the entry and KV-2 when a repository not in the table answers 404: a public one went private', async () => {
    const fetcher = planted({ [`${API}/repos/LuigiEspinosa/list-wheel`]: repos('LuigiEspinosa/list-wheel'), 'https://github.com/LuigiEspinosa/list-wheel': 404 });
    const result = await one(entry({ id: 'list-wheel' }), { fetch: fetcher.fetch });
    expect(rowsOf(result, 'source exists')[0].pass).toBe(true);
    const [resolves] = rowsOf(result, 'source resolves');
    expect(resolves.pass).toBe(false);
    expect(resolves.detail).toMatch(/^absent: https:\/\/github\.com\/LuigiEspinosa\/list-wheel answered 404 anonymously and no KV-2 row tolerates it/);
    expect(result.ok).toBe(false);
    expect(result.lines[1]).toMatch(/^FAIL {2}list-wheel source resolves: absent/);
  });

  it('passes and says the row can be struck when a KV-2 repository answers 2xx anonymously', async () => {
    const fetcher = planted({ [`${API}/repos/LuigiEspinosa/Mutuo`]: repos('LuigiEspinosa/Mutuo'), 'https://github.com/LuigiEspinosa/Mutuo': 200 });
    const result = await one(entry({ id: 'mutuo', status: 'In progress', source: 'https://github.com/LuigiEspinosa/Mutuo' }), { fetch: fetcher.fetch });
    const [resolves] = rowsOf(result, 'source resolves');
    expect(resolves.pass).toBe(true);
    expect(resolves.detail).toContain('its KV-2 row can be struck');
    expect(result.ok).toBe(true);
  });

  it('a struck row tolerates nothing, so the same 404 is a failure again', async () => {
    for (const ruling of ['~~Struck 2026-09-12~~: made public', '_Struck_ 2026-09-12', 'struck', '**Struck 2026-10-01**: made public']) {
      const fetcher = planted({ [`${API}/repos/LuigiEspinosa/Mutuo`]: repos('LuigiEspinosa/Mutuo'), 'https://github.com/LuigiEspinosa/Mutuo': 404 });
      const struck = recordFragment([['`LuigiEspinosa/Mutuo`', ruling, '2026-09-02']]);
      const result = await one(entry({ id: 'mutuo', source: 'https://github.com/LuigiEspinosa/Mutuo' }), { fetch: fetcher.fetch, record: struck });
      expect(rowsOf(result, 'source resolves')[0].pass, ruling).toBe(false);
    }
  });

  it('an unreachable source fails as unreachable, not absent, and a non-GitHub source gets the anonymous half only', async () => {
    const fetcher = planted({ 'https://example.org/repo': [503, 500] });
    const result = await one(entry({ id: 'elsewhere', source: 'https://example.org/repo' }), { fetch: fetcher.fetch });
    expect(rowsOf(result, 'source exists')).toHaveLength(0);
    const [resolves] = rowsOf(result, 'source resolves');
    expect(resolves.pass).toBe(false);
    expect(resolves.detail).toBe('unreachable: https://example.org/repo answered 500 anonymously');
    expect(fetcher.calls.map((call) => call.url)).toEqual(['https://example.org/repo', 'https://example.org/repo']);
  });

  it('a 429 is not retried and reads as unreachable', async () => {
    const fetcher = planted({ 'https://example.org/repo': [429, 200] });
    const result = await one(entry({ id: 'elsewhere', source: 'https://example.org/repo' }), { fetch: fetcher.fetch });
    expect(rowsOf(result, 'source resolves')[0].detail).toBe('unreachable: https://example.org/repo answered 429 anonymously');
    expect(fetcher.calls).toHaveLength(1);
  });

  it('a source with an embedded newline yields one line and one row, the newline escaped', async () => {
    const source = 'https://example.org/a\nb';
    const fetcher = planted({ [source]: 200 });
    const result = await one(entry({ id: 'nl', source }), { fetch: fetcher.fetch });
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).not.toContain('\n');
    expect(result.lines[0]).toBe('PASS  nl source resolves: https://example.org/a\\nb answered 200 anonymously');
    expect(summaryTable(result.rows).split('\n').filter((line) => line.startsWith('| nl |'))).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// The authenticated half of source
// ---------------------------------------------------------------------------

describe('the authenticated half of source', () => {
  it('passes on 200 naming the default branch, and archived is not a failure', async () => {
    const fetcher = planted({ [`${API}/repos/LuigiEspinosa/Lumen`]: repos('LuigiEspinosa/Lumen', true), 'https://github.com/LuigiEspinosa/Lumen': 200 });
    const result = await one(entry({ id: 'lumen', status: 'Archived', source: 'https://github.com/LuigiEspinosa/Lumen' }), { fetch: fetcher.fetch });
    const [exists] = rowsOf(result, 'source exists');
    expect(exists.pass).toBe(true);
    expect(exists.detail).toBe('LuigiEspinosa/Lumen answered 200 authenticated, default branch main, archived');
    expect(result.ok).toBe(true);
  });

  it('fails on anything but 200, naming the repository and the secret, a 301 rename included', async () => {
    for (const status of [301, 401, 404]) {
      const fetcher = planted({ [`${API}/repos/LuigiEspinosa/gone`]: status, 'https://github.com/LuigiEspinosa/gone': 200 });
      const result = await one(entry({ id: 'gone', source: 'https://github.com/LuigiEspinosa/gone' }), { fetch: fetcher.fetch });
      const [exists] = rowsOf(result, 'source exists');
      expect(exists.pass, String(status)).toBe(false);
      expect(exists.detail).toBe(`LuigiEspinosa/gone answered ${status} authenticated, so the repository does not exist or ${SECRET} cannot read it`);
    }
  });

  it('says so when the 200 carries no default_branch, rather than blaming the token or reading a guessed branch later', async () => {
    for (const body of ['not json', '{}', '{"default_branch": 3}']) {
      const fetcher = planted({ [`${API}/repos/LuigiEspinosa/odd`]: { status: 200, body }, 'https://github.com/LuigiEspinosa/odd': 200 });
      const result = await one(entry({ id: 'odd', source: 'https://github.com/LuigiEspinosa/odd', token_contract: '1.0.0' }), { fetch: fetcher.fetch, adoption: adoptionFragment([['`odd`', '`a/cuatro-contracts/tokens.css`', '1.0.0']]) });
      const [exists] = rowsOf(result, 'source exists');
      expect(exists.pass, body).toBe(false);
      expect(exists.detail).toBe('LuigiEspinosa/odd answered 200 authenticated but no default_branch was read');
      expect(rowsOf(result, 'token_contract')[0].detail).toContain('is unreadable (token or visibility)');
      expect(fetcher.calls.some((call) => call.url.includes('/contents/'))).toBe(false);
    }
  });

  it('fails a github.com source of any other shape by name rather than skipping it, the anonymous half still run', async () => {
    const shapes = [
      'https://github.com/LuigiEspinosa/cs-tracker/tree/main',
      'https://github.com/LuigiEspinosa/cs-tracker.git',
      'https://github.com/LuigiEspinosa/cs-tracker?tab=readme',
      'https://github.com/LuigiEspinosa/cs-tracker#readme',
      'https://github.com/LuigiEspinosa',
      'https://github.com/',
    ];
    for (const source of shapes) {
      expect(GITHUB_SOURCE.test(source), source).toBe(false);
      const fetcher = planted({ [source]: 200 });
      const result = await one(entry({ id: 'odd', source }), { fetch: fetcher.fetch });
      const [exists] = rowsOf(result, 'source exists');
      expect(exists.pass, source).toBe(false);
      expect(exists.detail).toBe(`${source} is on github.com and is not of the shape https://github.com/<owner>/<repo>, so it cannot be looked up`);
      expect(rowsOf(result, 'source resolves')[0].pass, source).toBe(true);
      expect(fetcher.calls.map((call) => call.url)).toEqual([source]);
    }
    expect(GITHUB_SOURCE.exec('https://github.com/LuigiEspinosa/cs-tracker/')?.slice(1)).toEqual(['LuigiEspinosa', 'cs-tracker']);
    expect(GITHUB_SOURCE.exec('https://github.com/LuigiEspinosa/tcg.tracker')?.slice(1)).toEqual(['LuigiEspinosa', 'tcg.tracker']);
  });

  it('retries once on a 5xx and on a network error, and the last answer decides', async () => {
    const recovered = planted({ [`${API}/repos/LuigiEspinosa/flap`]: [503, repos('LuigiEspinosa/flap')], 'https://github.com/LuigiEspinosa/flap': [new Error('ECONNRESET'), 200] });
    const result = await one(entry({ id: 'flap', source: 'https://github.com/LuigiEspinosa/flap' }), { fetch: recovered.fetch });
    expect(result.ok, result.lines.join('\n')).toBe(true);
    expect(recovered.calls).toHaveLength(4);

    const dead = planted({ [`${API}/repos/LuigiEspinosa/flap`]: [503, new Error('ECONNRESET')], 'https://github.com/LuigiEspinosa/flap': [new Error('ETIMEDOUT'), new Error('ETIMEDOUT')] });
    const failed = await one(entry({ id: 'flap', source: 'https://github.com/LuigiEspinosa/flap' }), { fetch: dead.fetch });
    expect(rowsOf(failed, 'source exists')[0].detail).toContain('did not answer (ECONNRESET)');
    expect(rowsOf(failed, 'source resolves')[0].detail).toBe('unreachable: https://github.com/LuigiEspinosa/flap did not answer (ETIMEDOUT) anonymously');
    expect(dead.calls).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// Matrix rows 5 and 6: live
// ---------------------------------------------------------------------------

describe('live', () => {
  const routes = { [`${API}/repos/LuigiEspinosa/app`]: repos('LuigiEspinosa/app'), 'https://github.com/LuigiEspinosa/app': 200 };

  it('resolves on 2xx and on 3xx at the first hop', async () => {
    for (const status of [200, 204, 301, 302, 307]) {
      const fetcher = planted({ ...routes, 'https://app.example': status });
      const result = await one(entry({ id: 'app', source: 'https://github.com/LuigiEspinosa/app', live: 'https://app.example' }), { fetch: fetcher.fetch });
      const [live] = rowsOf(result, 'live');
      expect(live.pass, String(status)).toBe(true);
      expect(live.detail).toBe(`https://app.example answered ${status}`);
    }
  });

  it('fails unreachable on two 5xx or a timeout, and absent on a 404', async () => {
    const twice = planted({ ...routes, 'https://app.example': [502, 503] });
    const down = await one(entry({ id: 'app', source: 'https://github.com/LuigiEspinosa/app', live: 'https://app.example' }), { fetch: twice.fetch });
    expect(rowsOf(down, 'live')[0].pass).toBe(false);
    expect(rowsOf(down, 'live')[0].detail).toBe('unreachable: https://app.example answered 503');
    expect(twice.calls.filter((call) => call.url === 'https://app.example')).toHaveLength(2);

    const timeout = planted({ ...routes, 'https://app.example': new Error('The operation was aborted due to timeout') });
    const out = await one(entry({ id: 'app', source: 'https://github.com/LuigiEspinosa/app', live: 'https://app.example' }), { fetch: timeout.fetch });
    expect(rowsOf(out, 'live')[0].detail).toMatch(/^unreachable: https:\/\/app\.example did not answer \(The operation was aborted due to timeout\)$/);

    const gone = planted({ ...routes, 'https://app.example': 404 });
    const absent = await one(entry({ id: 'app', source: 'https://github.com/LuigiEspinosa/app', live: 'https://app.example' }), { fetch: gone.fetch });
    expect(rowsOf(absent, 'live')[0].pass).toBe(false);
    expect(rowsOf(absent, 'live')[0].detail).toBe('absent: https://app.example answered 404');
    expect(absent.ok).toBe(false);
  });

  it('is checked wherever the field is present, so an In progress entry that kept its URL fails when it stops resolving (AC4)', async () => {
    const fetcher = planted({ ...routes, 'https://app.example': 404 });
    const result = await one(entry({ id: 'app', status: 'In progress', source: 'https://github.com/LuigiEspinosa/app', live: 'https://app.example' }), { fetch: fetcher.fetch });
    expect(rowsOf(result, 'live')).toHaveLength(1);
    expect(rowsOf(result, 'live')[0].pass).toBe(false);

    const without = await one(entry({ id: 'app', status: 'In progress', source: 'https://github.com/LuigiEspinosa/app' }), { fetch: planted(routes).fetch });
    expect(rowsOf(without, 'live')).toHaveLength(0);
  });

  it('classify names the three verdicts', () => {
    expect(classify({ status: 200 })).toBe('resolves');
    expect(classify({ status: 399 })).toBe('resolves');
    expect(classify({ status: 404 })).toBe('absent');
    expect(classify({ status: 400 })).toBe('unreachable');
    expect(classify({ status: 429 })).toBe('unreachable');
    expect(classify({ status: 500 })).toBe('unreachable');
    expect(classify(null)).toBe('unreachable');
  });
});

// ---------------------------------------------------------------------------
// Matrix rows 7 to 10: token_contract
// ---------------------------------------------------------------------------

describe('token_contract', () => {
  const tracker = entry({ id: 'cs-tracker', source: `https://github.com/${SLUG}`, token_contract: '1.0.0' });
  const base = { [`${API}/repos/${SLUG}`]: repos(SLUG), [`https://github.com/${SLUG}`]: 404 };
  const where = `${SLUG}:${CS_TRACKER_TOKENS}@main`;

  it('passes when the vendored header equals the declaration, reading the path the record names on the default branch', async () => {
    const fetcher = planted({ ...base, [`${API}/repos/${SLUG}`]: { status: 200, body: JSON.stringify({ default_branch: 'trunk' }) }, [contents(SLUG, CS_TRACKER_TOKENS, 'trunk')]: { status: 200, body: TOKENS_CSS } });
    const result = await one(tracker, { fetch: fetcher.fetch });
    const [token] = rowsOf(result, 'token_contract');
    expect(token.pass, token.detail).toBe(true);
    expect(token.detail).toBe(`the Registry declares 1.0.0 and ${SLUG}:${CS_TRACKER_TOKENS}@trunk reads Contract v1.0.0`);
    expect(result.ok).toBe(true);
  });

  it('fails "moved or renamed" when the repository answered 200 and the path 404 (AC2)', async () => {
    const fetcher = planted({ ...base, [contents(SLUG, CS_TRACKER_TOKENS)]: 404 });
    const result = await one(tracker, { fetch: fetcher.fetch });
    const [token] = rowsOf(result, 'token_contract');
    expect(token.pass).toBe(false);
    expect(token.detail).toBe(`cuatro-contracts folder moved or renamed: ${SLUG} answered 200 and ${where} answered 404 (AD-14, AD-16)`);
  });

  it('fails "unreadable" naming the repository and the secret when the repository call is not 200, never "moved"', async () => {
    for (const status of [401, 404]) {
      const fetcher = planted({ ...base, [`${API}/repos/${SLUG}`]: status });
      const result = await one(tracker, { fetch: fetcher.fetch });
      const [token] = rowsOf(result, 'token_contract');
      expect(token.pass).toBe(false);
      expect(token.detail).toBe(`${SLUG} is unreadable (token or visibility), so ${CS_TRACKER_TOKENS} was not read; check ${SECRET}`);
      expect(token.detail).not.toContain('moved');
      expect(fetcher.calls.some((call) => call.url.includes('/contents/')), 'no contents call is made without a default branch').toBe(false);
    }
  });

  it('names the permission gap when the contents call answers 401 or 403 after the repository answered 200', async () => {
    for (const status of [401, 403]) {
      const fetcher = planted({ ...base, [contents(SLUG, CS_TRACKER_TOKENS)]: status });
      const result = await one(tracker, { fetch: fetcher.fetch });
      const [token] = rowsOf(result, 'token_contract');
      expect(token.pass).toBe(false);
      expect(token.detail).toBe(`${where} answered ${status}; check ${SECRET} has Contents read on ${SLUG}`);
    }
  });

  it('fails naming both values when the header moved and the field did not', async () => {
    const fetcher = planted({ ...base, [contents(SLUG, CS_TRACKER_TOKENS)]: { status: 200, body: TOKENS_CSS.replace('v1.0.0', 'v1.0.1') } });
    const result = await one(tracker, { fetch: fetcher.fetch });
    const [token] = rowsOf(result, 'token_contract');
    expect(token.pass).toBe(false);
    expect(token.detail).toBe(`mismatch: the Registry declares 1.0.0 and ${where} reads Contract v1.0.1; the two must be one version`);
  });

  it('fails "header absent" when the file carries no Contract line, "unreachable" on any other answer, and "body" when the body is cut', async () => {
    const blank = planted({ ...base, [contents(SLUG, CS_TRACKER_TOKENS)]: { status: 200, body: ':root { --c-paper: oklch(12% 0.011 288); }' } });
    const absent = await one(tracker, { fetch: blank.fetch });
    expect(rowsOf(absent, 'token_contract')[0].detail).toBe(`header absent: ${where} carries no "Contract vX.Y.Z" header`);

    const flaky = planted({ ...base, [contents(SLUG, CS_TRACKER_TOKENS)]: [500, 502] });
    const unreachable = await one(tracker, { fetch: flaky.fetch });
    expect(rowsOf(unreachable, 'token_contract')[0].detail).toBe(`unreachable: ${where} answered 502`);

    const errored = new ReadableStream({
      start(controller) {
        controller.error(new Error('stream reset'));
      },
    });
    const cut = planted({ ...base, [contents(SLUG, CS_TRACKER_TOKENS)]: { status: 200, body: errored } });
    const body = await one(tracker, { fetch: cut.fetch });
    expect(rowsOf(body, 'token_contract')[0].pass).toBe(false);
    expect(rowsOf(body, 'token_contract')[0].detail).toMatch(new RegExp(`^unreachable: ${SLUG}:${CS_TRACKER_TOKENS}@main body .*stream reset`));
  });

  it('fails "no recorded target" when the record row reads not adopted, or names no row, without a contents call', async () => {
    const planted1 = planted({ [`${API}/repos/LuigiEspinosa/digital-library`]: repos('LuigiEspinosa/digital-library'), 'https://github.com/LuigiEspinosa/digital-library': 200 });
    const declared = entry({ id: 'digital-library', token_contract: '1.0.0' });
    const notAdopted = adoptionFragment([['`digital-library`', 'none', 'not adopted']]);
    const result = await one(declared, { fetch: planted1.fetch, adoption: notAdopted });
    const [token] = rowsOf(result, 'token_contract');
    expect(token.pass).toBe(false);
    expect(token.detail).toBe(`1.0.0 is declared but no recorded target: ${ADOPTION_REL} records digital-library as "not adopted" with File read "none"`);
    expect(planted1.calls.some((call) => call.url.includes('/contents/'))).toBe(false);

    const planted2 = planted({ [`${API}/repos/LuigiEspinosa/digital-library`]: repos('LuigiEspinosa/digital-library'), 'https://github.com/LuigiEspinosa/digital-library': 200 });
    const noRow = await one(declared, { fetch: planted2.fetch, adoption: adoptionFragment([['`cs-tracker`', `\`${CS_TRACKER_TOKENS}\``, '1.0.0']]) });
    expect(rowsOf(noRow, 'token_contract')[0].detail).toBe(`1.0.0 is declared but no recorded target: ${ADOPTION_REL} carries no adopted-versions row for digital-library`);
  });

  it('reads the File read cell encoded per segment, so a space or a ? cannot truncate or redirect the contents URL', async () => {
    const encoded = 'assets/css/cuatro%20contracts/x%3Fy/tokens.css';
    const fetcher = planted({ ...base, [contents(SLUG, encoded)]: { status: 200, body: TOKENS_CSS } });
    const odd = adoptionFragment([['`cs-tracker`', '`./assets/css/cuatro contracts/x?y/tokens.css`', '1.0.0']]);
    const result = await one(tracker, { fetch: fetcher.fetch, adoption: odd });
    expect(rowsOf(result, 'token_contract')[0].pass, rowsOf(result, 'token_contract')[0].detail).toBe(true);
    expect(fetcher.calls.map((call) => call.url)).toContain(contents(SLUG, encoded));
  });

  it('fails on a github.com source of another shape or off github.com, which has no read path', async () => {
    for (const source of ['https://example.org/cs-tracker', 'https://github.com/LuigiEspinosa/cs-tracker/tree/main']) {
      const fetcher = planted({ [source]: 200 });
      const result = await one(entry({ id: 'cs-tracker', source, token_contract: '1.0.0' }), { fetch: fetcher.fetch });
      expect(rowsOf(result, 'token_contract')[0].detail).toBe(`1.0.0 cannot be verified: ${source} is not of the shape https://github.com/<owner>/<repo>, so no vendored file can be read`);
    }
  });
});

// ---------------------------------------------------------------------------
// One entry throwing never discards another entry's verdict
// ---------------------------------------------------------------------------

describe('an entry whose check throws', () => {
  it('becomes one FAIL row naming the cause, and the other entries keep their rows', async () => {
    const good = planted({
      [`${API}/repos/LuigiEspinosa/two`]: repos('LuigiEspinosa/two'),
      'https://github.com/LuigiEspinosa/two': 200,
      'https://github.com/LuigiEspinosa/one': 200,
    });
    // A fetcher answering the repository call with something that is not a
    // Response: `.json` is not a function, which throws past every catch.
    const fetch = async (url: string, init?: RequestInit): Promise<Response> =>
      url === `${API}/repos/LuigiEspinosa/one` ? ({ status: 200 } as unknown as Response) : good.fetch(url, init);
    const result = await verify({
      registry: { applications: [entry({ id: 'one' }), entry({ id: 'two' })] },
      record: recordFragment(),
      adoption: adoptionFragment(),
      fetch,
      token: TOKEN,
    });
    expect(result.ok).toBe(false);
    expect(result.rows.filter((row) => row.id === 'one')).toHaveLength(1);
    const [thrown] = result.rows.filter((row) => row.id === 'one');
    expect(thrown.check).toBe('entry');
    expect(thrown.pass).toBe(false);
    expect(thrown.detail).toMatch(/^threw: .+/);
    expect(result.rows.filter((row) => row.id === 'two').map((row) => row.check)).toEqual(['source exists', 'source resolves']);
    expect(result.lines).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// The two record parsers on planted controls, and on the real records
// ---------------------------------------------------------------------------

describe('kv2Rows', () => {
  it('reads the four KV-2 rows out of the real record, cs-tournament alone struck', () => {
    const rows = kv2Rows(record);
    expect(rows.map((row) => row.repository)).toEqual(KV2_TABLE);
    expect(rows.filter((row) => row.struck).map((row) => row.repository)).toEqual(STRUCK);
    expect(rows.every((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.since))).toBe(true);
    expect(rows.every((row) => row.ruling !== '')).toBe(true);
  });

  it('marks a row struck when its Ruling begins Struck in any case behind bold, italic or strikethrough, and nothing else', () => {
    const rows = kv2Rows(
      recordFragment([
        ['`a/b`', 'Private', '2026-09-02'],
        ['`c/d`', '**Struck 2026-10-01**: public', '2026-09-02'],
        ['`e/f`', 'Struck 2026-10-02: public', '2026-09-02'],
        ['`g/h`', 'Not struck, still private', '2026-09-02'],
        ['`i/j`', '~~Struck 2026-09-12~~', '2026-09-02'],
        ['`k/l`', '_Struck_', '2026-09-02'],
        ['`m/n`', 'struck', '2026-09-02'],
        ['`o/p`', 'Strucken', '2026-09-02'],
        ['`q/r`', ' *_~struck~_* ', '2026-09-02'],
      ])
    );
    expect(rows.map((row) => row.struck)).toEqual([false, true, true, false, true, true, true, false, true]);
    expect(rows[1].repository).toBe('c/d');
  });

  it('fails on zero rows, a missing section, or a table without the three columns', () => {
    expect(() => kv2Rows(recordFragment([]))).toThrow(/zero rows/);
    expect(() => kv2Rows('# nothing\n\n## Stated limits\n')).toThrow(new RegExp(`no "## ${TOLERATED_HEADING}" section`));
    const twoColumns = `# A record\n\n## ${TOLERATED_HEADING}\n\n| Repository | Since |\n|---|---|\n| \`a/b\` | 2026-09-02 |\n`;
    expect(() => kv2Rows(twoColumns)).toThrow(/lacks one of Repository, Ruling, Since/);
  });
});

describe('vendoredTarget', () => {
  const adopters = adopterRows(adoptionFragment());

  it('joins the source URL last segment onto the adopted-versions row and returns its File read cell', () => {
    const target = vendoredTarget(entry({ id: 'cs-tracker', source: `https://github.com/${SLUG}/`, token_contract: '1.0.0' }), adopters);
    expect(target).toEqual({ application: 'cs-tracker', path: CS_TRACKER_TOKENS, reason: null });
  });

  it('strips a leading ./ or / and encodes every segment, leaving the exact cs-tracker path as it is', () => {
    const row = (cell: string) => adopterRows(adoptionFragment([['`cs-tracker`', `\`${cell}\``, '1.0.0']]));
    const tracker = entry({ id: 'cs-tracker', source: `https://github.com/${SLUG}` });
    expect(vendoredTarget(tracker, row(`/${CS_TRACKER_TOKENS}`)).path).toBe(CS_TRACKER_TOKENS);
    expect(vendoredTarget(tracker, row(`./${CS_TRACKER_TOKENS}`)).path).toBe(CS_TRACKER_TOKENS);
    expect(vendoredTarget(tracker, row('assets/css/cuatro contracts/tokens.css')).path).toBe('assets/css/cuatro%20contracts/tokens.css');
    expect(vendoredTarget(tracker, row('assets/x?y/tokens.css#z')).path).toBe('assets/x%3Fy/tokens.css%23z');
    expect(vendoredTarget(tracker, row(CS_TRACKER_TOKENS)).path).toBe(CS_TRACKER_TOKENS);
  });

  it('names no path for a row reading not adopted, a row with a non-semver, or no row at all', () => {
    const notAdopted = vendoredTarget(entry({ id: 'x', source: 'https://github.com/LuigiEspinosa/StreamVault' }), adopterRows(adoptionFragment([['`StreamVault`', 'none', 'not adopted']])));
    expect(notAdopted.path).toBeNull();
    expect(notAdopted.reason).toContain('records StreamVault as "not adopted"');
    const odd = vendoredTarget(entry({ id: 'x', source: `https://github.com/${SLUG}` }), adopterRows(adoptionFragment([['`cs-tracker`', '`a/tokens.css`', 'v1']])));
    expect(odd.path).toBeNull();
    const missing = vendoredTarget(entry({ id: 'x', source: 'https://github.com/LuigiEspinosa/Mutuo' }), adopters);
    expect(missing).toEqual({ application: 'Mutuo', path: null, reason: `${ADOPTION_REL} carries no adopted-versions row for Mutuo` });
  });

  it('on the real records, resolves cs-tracker and the Anchor to their recorded paths and every other entry to no target', () => {
    const real = adopterRows(adoption);
    for (const application of registry.applications) {
      const target = vendoredTarget(application, real);
      if (application.id === 'cs-tracker') expect(target.path).toBe(CS_TRACKER_TOKENS);
      else if (application.id === 'cuatro-portfolio') expect(target.path).toBe(ANCHOR_TOKENS);
      else expect(target.path, application.id).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// The one cross-file pin the story closes (deferred-work DW-83)
// ---------------------------------------------------------------------------

describe('the Registry and the adoption record agree', () => {
  it('cs-tracker declares the token_contract ops/contract-adoption.md records, failing naming both values when either moves alone', () => {
    const tracker = registry.applications.find((application) => application.id === 'cs-tracker');
    expect(tracker, 'no cs-tracker entry in the Registry').toBeDefined();
    const recorded = recordedAdoptedVersion(adoption, 'cs-tracker');
    expect(
      tracker?.token_contract,
      `${REGISTRY_REL} declares token_contract ${tracker?.token_contract} on cs-tracker and ${ADOPTION_REL} records ${recorded}; the two must be one version`
    ).toBe(recorded);
  });

  it('every entry carrying token_contract has a recorded adopter row at that version', () => {
    const real = adopterRows(adoption);
    const declared = registry.applications.filter((application) => application.token_contract !== undefined);
    expect(declared.length).toBeGreaterThan(0);
    for (const application of declared) {
      const target = vendoredTarget(application, real);
      expect(target.path, `${application.id} declares ${application.token_contract} and ${target.reason}`).not.toBeNull();
      expect(real.find((row) => row.application === target.application)?.version).toBe(application.token_contract);
    }
  });
});

// ---------------------------------------------------------------------------
// The record's own figures
// ---------------------------------------------------------------------------

describe('the record', () => {
  it('carries the readings table in the SM-4 shape, placeholder or ISO months and never both', () => {
    const readings = table(section(record, 'Readings'), 'Month (ISO 8601)');
    expect(readings.headers).toEqual(['Month (ISO 8601)', 'Links checked', 'Resolved', 'Share', 'Run URL', 'Taken by']);
    const months = readings.rows.map((row) => row[0]);
    expect(months.length).toBeGreaterThan(0);
    for (const month of months) expect(month).toMatch(/^(_none recorded_|\d{4}-\d{2})$/);
    if (months.some((month) => /^\d{4}-\d{2}$/.test(month))) {
      expect(months, 'the placeholder row is replaced by the first reading, not kept beside it').not.toContain('_none recorded_');
    }
  });

  it('states the figures the workflow pins', () => {
    expect(record).toContain('`17 6 * * *`');
    expect(record).toContain('`timeout-minutes: 10`');
    expect(record).toContain(`\`${SECRET}\``);
    expect(record).toContain(`\`${USER_AGENT}\``);
    expect(record).toContain('`RUNNER_ENVIRONMENT`');
    expect(record).toContain('`github-hosted`');
    expect(record).toContain('15 s');
  });
});

// ---------------------------------------------------------------------------
// Matrix row 11 and the workflow wiring, read as the data it is
// ---------------------------------------------------------------------------

describe('the workflow', () => {
  // CRLF normalised: `.gitattributes` pins LF for `.mjs` and not for `.yml`.
  const workflow = read(WORKFLOW).replace(/\r\n/g, '\n');
  const marker = '\njobs:\n';
  const at = workflow.indexOf(marker);
  if (at === -1) throw new Error(`${HERE}: ${WORKFLOW} has no top-level "jobs:" key`);
  const jobsSection = workflow.slice(at + marker.length);
  const jobNames = [...jobsSection.matchAll(/^ {2}([A-Za-z_][A-Za-z0-9_-]*):$/gm)].map((match) => match[1]);
  const instructions = jobsSection
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
  const fileInstructions = workflow
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');

  it('carries the one job and no other', () => {
    expect(jobNames).toEqual([JOB]);
  });

  it('triggers on the daily schedule, dispatch, and push on exactly the four paths', () => {
    expect(fileInstructions).toMatch(
      /^on:\n {2}schedule:\n {4}- cron: '17 6 \* \* \*'\n {2}workflow_dispatch:\n {2}push:\n {4}paths:\n {6}- '\.github\/workflows\/registry-verification\.yml'\n {6}- 'ops\/registry-verification\.mjs'\n {6}- 'ops\/registry-verification\.md'\n {6}- 'contracts\/registry\.json'\n\npermissions:\n {2}contents: read\n\njobs:$/m
    );
    expect(existsSync(SCRIPT)).toBe(true);
    expect(existsSync(resolve(REPO_ROOT, RECORD_REL))).toBe(true);
  });

  it('runs on a GitHub-hosted ubuntu runner on Node 22, installing nothing, under the ceiling the record states', () => {
    expect(instructions).toMatch(/^\s+runs-on: ubuntu-latest$/m);
    expect(instructions).toMatch(/^\s+timeout-minutes: 10$/m);
    expect(instructions).toMatch(/^\s+node-version: 22$/m);
    expect(instructions).toMatch(/^\s+package-manager-cache: false$/m);
    expect(instructions).not.toMatch(/^\s+container\s*:/m);
    const actions = [...instructions.matchAll(/^\s*- uses: (.+)$/gm)].map((match) => match[1].trim());
    expect(actions).toEqual(['actions/checkout@v7', 'actions/setup-node@v7']);
  });

  it('asserts the runner environment in a step before the script runs, then runs the whole command with the secret on that step only', () => {
    const commands = [...instructions.matchAll(/^\s*run: (.+)$/gm)].map((match) => match[1].trim());
    expect(commands).toEqual(['test "$RUNNER_ENVIRONMENT" = github-hosted', 'node ops/registry-verification.mjs']);
    expect(instructions.indexOf('- name: Runner is GitHub-hosted')).toBeGreaterThan(-1);
    expect(instructions.indexOf('- name: Runner is GitHub-hosted')).toBeLessThan(instructions.indexOf('- name: Registry verification'));
    expect(instructions).toMatch(
      /- name: Registry verification\n\s+run: node ops\/registry-verification\.mjs\n\s+env:\n\s+REGISTRY_VERIFICATION_TOKEN: \$\{\{ secrets\.REGISTRY_VERIFICATION_TOKEN \}\}\n?$/
    );
    expect(fileInstructions.match(/^[ \t]*env[ \t]*:/gm)).toHaveLength(1);
    expect(fileInstructions).not.toMatch(/^env\s*:/m);
    expect(fileInstructions).not.toContain('HEARTBEAT');
  });

  // The token was the repository's default, `write`, until DW-87 narrowed every workflow to
  // `contents: read` at the top (Operator ruling 2026-09-24). This job reads its checkout and nothing
  // else, so no job-level block widens it.
  it('never downgrades to a warning, never skips, reads with a read-only token, never writes (AD-21, AD-16, DW-87)', () => {
    expect(fileInstructions).not.toMatch(/continue-on-error\s*:/);
    expect(fileInstructions).not.toContain('|| true');
    expect(fileInstructions).not.toMatch(/^\s+if\s*:/m);
    expect(fileInstructions.match(/^[ \t]*permissions[ \t]*:.*$/gm)).toEqual(['permissions:']);
    expect(fileInstructions).toMatch(/^permissions:\n {2}contents: read\n\njobs:$/m);
    expect(fileInstructions).not.toMatch(/^\s+needs\s*:/m);
    expect(fileInstructions).not.toMatch(/git (commit|push)|gh (issue|pr) create|upload-artifact/);
  });
});

// ---------------------------------------------------------------------------
// The module's own source
// ---------------------------------------------------------------------------

describe('the module', () => {
  const source = read(SCRIPT);

  it('imports node: builtins and its two siblings only, so the job can install nothing', () => {
    const specifiers = [...source.matchAll(/^import\b[^'"]*['"]([^'"]+)['"]/gm)].map((match) => match[1]);
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) expect(specifier).toMatch(/^(node:|\.\/(contract-adoption|registry-schema)\.mjs$)/);
    expect(source).not.toContain('createRequire');
    expect(source).not.toMatch(/\brequire\s*\(/);
    expect(source).not.toMatch(/\bimport\s*\(/);
  });

  it('reads two names off the injected environment, touches process.env only as its default, and no argv position beyond [1]', () => {
    const envReads = [...source.matchAll(/\benv(?:\.(\w+)|\[(\w+)\])/g)].map((match) => match[1] ?? match[2]).sort();
    expect(envReads).toEqual(['GITHUB_STEP_SUMMARY', 'SECRET']);
    expect(source.match(/process\.env\b/g)).toEqual(['process.env']);
    expect(source).toMatch(/env = process\.env\)/);
    expect(source).not.toMatch(/from 'node:process'/);
    const argv = [...new Set([...source.matchAll(/process\.argv\[(\d+)\]/g)].map((match) => match[1]))];
    expect(argv).toEqual(['1']);
    expect(source).not.toMatch(/process\.argv\.(slice|length)/);
  });
});
