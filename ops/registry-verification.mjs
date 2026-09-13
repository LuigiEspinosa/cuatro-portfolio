// The scheduled Registry verification, Story 2.23 (AD-16, AD-18, FR-32).
//
// One job, off the box, reads the committed `contracts/registry.json` and holds
// three of its claims to reality: every `source` exists (authenticated, through
// api.github.com) and resolves anonymously, except where `ops/known-violations.md`
// KV-2 tolerates a private one; every `live` answers 2xx or 3xx at the first
// hop; and every `token_contract` equals the `Contract vX.Y.Z` header of the
// vendored `cuatro-contracts/tokens.css` at the path `ops/contract-adoption.md`
// records for that adopter. A failure fails the run, which mails the Operator.
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

/**
 * A `source` on github.com in the one shape the API can look up: owner and
 * repository, a trailing slash allowed, no `.git`, no deeper path, no query and
 * no fragment. A github.com URL of any other shape fails `source exists` by
 * name rather than being skipped.
 */
export const GITHUB_SOURCE = /^https:\/\/github\.com\/([A-Za-z0-9-]+)\/(?!.*\.git\/?$)([A-Za-z0-9_.-]+)\/?$/;
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

/** The last path segment of a `source` URL, which is the repository name `ops/contract-adoption.md` keys its rows on. */
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

/**
 * Every check one entry gets, in order: the authenticated half of `source`
 * (github.com only), the anonymous half, `live` where the field is present,
 * and `token_contract` where it is declared.
 *
 * @param {Entry} entry
 * @param {{ fetch: Fetcher, token: string, tolerated: Set<string>, adopters: ReturnType<typeof adopterRows> }} context
 * @returns {Promise<Row[]>}
 */
async function checkEntry(entry, { fetch, token, tolerated, adopters }) {
  /** @type {Row[]} */
  const rows = [];
  const row = (check, pass, detail) => rows.push({ id: entry.id, check, pass, detail });
  const authenticated = { Authorization: `Bearer ${token}` };

  const github = GITHUB_SOURCE.exec(entry.source);
  const slug = github === null ? null : `${github[1]}/${github[2]}`;
  /** @type {{ defaultBranch: string } | null} */
  let repository = null;

  if (slug !== null) {
    const got = await get(fetch, `${API}/repos/${slug}`, { ...authenticated, Accept: 'application/vnd.github+json' });
    const body = got.response?.status === 200 ? await got.response.json().catch(() => null) : null;
    if (body !== null && typeof body.default_branch === 'string') {
      repository = { defaultBranch: body.default_branch };
      row(
        'source exists',
        true,
        `${slug} answered 200 authenticated, default branch ${body.default_branch}` + (body.archived === true ? ', archived' : '')
      );
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

  if (entry.live !== undefined) {
    const got = await get(fetch, entry.live, {});
    const verdict = classify(got.response);
    row(
      'live',
      verdict === 'resolves',
      verdict === 'resolves' ? `${entry.live} ${answered(got)}` : `${verdict}: ${entry.live} ${answered(got)}`
    );
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
    for (const field of ['live', 'token_contract']) {
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
 * @param {{ registry: Registry, record: string, adoption: string, fetch: Fetcher, token: string | undefined }} input
 * @returns {Promise<{ ok: boolean, lines: string[], rows: Row[] }>}
 */
export async function verify({ registry, record, adoption, fetch, token }) {
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
  const settled = await Promise.allSettled(entries.map((entry) => checkEntry(entry, { fetch, token, tolerated, adopters })));
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
