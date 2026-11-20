// The two AD-22 refresh checks that ran from scratchpad scripts until Story
// 9-10 (DW-243): the estate automation-policy sweep of `ops/contract-adoption.md`
// § The estate, observed, and the upstream font-pin check of
// `ops/font-contract.md` § The upstream pins.
//
//   node ops/ad22-refresh.mjs sweep       one row per estate repository
//   node ops/ad22-refresh.mjs font-pins   one row per pinned upstream file
//
// Both read only: GET through `gh api` as whoever `gh` is logged in as, and
// anonymous downloads from raw.githubusercontent.com. Each prints a dated JSON
// report for a person to read into the record; neither writes a record, and the
// sweep derives no verdict, because the "CI runs it on push" and "Real test
// suite" cells are held by reading (§ The estate, observed).
//
// Exit 0 the report was taken (for `font-pins`, nothing moved upstream), 1 an
// upstream pinned file no longer matches its pin, 2 a defect: an unexpected
// status, a truncated tree, a pinned download that no longer reproduces its
// recorded sha256, or a usage error. A defect never reads as "absent".
//
// Pure exports plus a thin `main` that takes the `gh` seam and the downloader as
// parameters, so `ops/__tests__/ad22-refresh.test.ts` plants both.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUTOMATION_CONFIGS, estateNames } from './contract-adoption.mjs';

/** The account every estate repository lives under. */
export const OWNER = 'LuigiEspinosa';

/** The pull request authors that mean dependency automation. */
export const BOTS = ['dependabot[bot]', 'renovate[bot]'];

/**
 * @typedef {{ status: number, body: any }} Answer
 * @typedef {(endpoint: string) => Answer} Gh
 * @typedef {(url: string) => Promise<Uint8Array>} FetchBytes
 */

/** Splits `gh api -i` output into its status and its body, parsed as JSON when it is JSON. */
export function parseResponse(text, endpoint) {
  const status = /^HTTP\/[\d.]+ (\d{3})/.exec(String(text));
  if (status === null) throw new Error(`gh api ${endpoint} answered no status line`);
  const gap = text.search(/\r?\n\r?\n/);
  const raw = gap < 0 ? '' : text.slice(gap).trim();
  let body = null;
  if (raw !== '') {
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
  }
  return { status: Number(status[1]), body };
}

/** @type {Gh} */
export function ghApi(endpoint) {
  const run = spawnSync('gh', ['api', '-i', endpoint], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (run.error) throw new Error(`gh could not run: ${run.error.message}`);
  return parseResponse(run.stdout, endpoint);
}

/**
 * One call whose status must be one of `allowed`; anything else is a defect
 * naming the endpoint. A 403 counts only as the plan refusal the records name,
 * so a rate limit or a missing scope never reads as "not available".
 */
function call(gh, endpoint, allowed) {
  const answer = gh(endpoint);
  const planRefusal = answer.status !== 403 || /Upgrade to GitHub Pro/.test(answer.body?.message ?? '');
  if (!allowed.includes(answer.status) || !planRefusal) {
    const said = typeof answer.body?.message === 'string' ? ` (${answer.body.message})` : '';
    throw new Error(`${endpoint} answered ${answer.status}${said}, expected ${allowed.join(' or ')}`);
  }
  return answer;
}

const decoded = (content) => Buffer.from(String(content ?? ''), 'base64').toString('utf8');

/**
 * Condition 1's patterns (`ops/contract-adoption.md` § What a real test suite
 * is): under `__tests__/`, `test/` or `tests/`, or named `*.test.*`, `*.spec.*`,
 * `*_test.exs`, `*_test.go`. A `tsconfig.*` file is a compiler configuration and
 * is excluded, as the 2026-09-30 sweep excluded `list-wheel`'s
 * `tsconfig.spec.json` by reading.
 */
export function isTestShaped(path) {
  const name = path.split('/').pop() ?? '';
  if (name.startsWith('tsconfig.')) return false;
  return (
    /(^|\/)(__tests__|test|tests)\//.test(path) || /\.(test|spec)\./.test(name) || /_test\.(exs|go)$/.test(name)
  );
}

/** Every call § The estate, observed lists, for one repository, as one row. */
export function sweepRepository(name, gh, owner = OWNER) {
  const base = `repos/${owner}/${name}`;
  const repo = call(gh, base, [200]).body;
  const branch = repo.default_branch;
  const head = call(gh, `${base}/branches/${branch}`, [200]).body.commit.sha;

  const fixes = call(gh, `${base}/automated-security-fixes`, [200, 404]);
  const alerts = call(gh, `${base}/vulnerability-alerts`, [204, 404]).status === 204;
  const configs = AUTOMATION_CONFIGS.filter(
    (path) => call(gh, `${base}/contents/${path}?ref=${branch}`, [200, 404]).status === 200
  );
  const pkg = call(gh, `${base}/contents/package.json?ref=${branch}`, [200, 404]);
  const renovateKey = pkg.status === 200 && Object.hasOwn(JSON.parse(decoded(pkg.body.content)), 'renovate');

  const pulls = [];
  for (let page = 1; ; page += 1) {
    const batch = call(gh, `${base}/pulls?state=all&per_page=100&page=${page}`, [200]).body;
    pulls.push(...batch);
    if (batch.length < 100) break;
  }

  const protection = call(gh, `${base}/branches/${branch}/protection`, [200, 403, 404]);
  const checks = protection.body?.required_status_checks;
  const rules = call(gh, `${base}/rules/branches/${branch}`, [200, 403, 404]);
  const rulesets = call(gh, `${base}/rulesets`, [200, 403, 404]);

  const tree = call(gh, `${base}/git/trees/${branch}?recursive=1`, [200]).body;
  if (tree.truncated) throw new Error(`${base} tree is truncated, so its counts would be short`);
  const blobs = tree.tree.filter((entry) => entry.type === 'blob').map((entry) => entry.path);
  const workflows = blobs
    .filter((path) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(path))
    .map((path) => {
      const text = decoded(call(gh, `${base}/contents/${path}?ref=${branch}`, [200]).body.content);
      const softFail = text
        .split('\n')
        .flatMap((line, i) => (/continue-on-error|\|\|\s*true/.test(line) ? [i + 1] : []));
      return { path, softFail };
    });

  return {
    repository: name,
    private: repo.private,
    defaultBranch: branch,
    head,
    allowAutoMerge: repo.allow_auto_merge ?? null,
    securityFixes: fixes.status === 200 ? fixes.body : { status: fixes.status },
    alerts,
    configs: renovateKey ? [...configs, 'package.json#renovate'] : configs,
    pulls: pulls.length,
    botPulls: pulls.filter((pr) => BOTS.includes(pr.user?.login)).length,
    protection: {
      status: protection.status,
      requiredChecks: checks ? [...(checks.contexts ?? [])].sort() : [],
      strict: checks?.strict ?? null,
    },
    rules: rules.status === 200 ? rules.body.length : { status: rules.status },
    rulesets: rulesets.status === 200 ? rulesets.body.map((r) => r.name) : { status: rulesets.status },
    blobs: blobs.length,
    testShaped: blobs.filter(isTestShaped).length,
    workflows,
  };
}

/** The distinct pinned files in `packages/fonts/sources.json`: three faces and two licences. */
export function fontPins(sources) {
  const byUrl = new Map();
  for (const family of sources.families) {
    for (const entry of [family.source, family.licenceSource]) {
      const parts = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([0-9a-f]{40})\/(.+)$/.exec(entry.url);
      if (parts === null || parts[3] !== entry.commit) {
        throw new Error(`${entry.file}: ${entry.url} is not a raw url at its pinned commit ${entry.commit}`);
      }
      const pin = byUrl.get(entry.url) ?? {
        owner: parts[1],
        repo: parts[2],
        commit: entry.commit,
        path: decodeURIComponent(parts[4]),
        url: entry.url,
        bytes: entry.bytes,
        sha256: entry.sha256,
        files: [],
      };
      if (!pin.files.includes(entry.file)) pin.files.push(entry.file);
      byUrl.set(entry.url, pin);
    }
  }
  return [...byUrl.values()];
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/**
 * The 2026-09-30 method for one pin: the last upstream commit touching the path,
 * the default branch's distance past the pin, the latest release, and the file
 * at the head weighed against the pin. The control comes first: the pinned url
 * must still give the recorded bytes, or nothing after it is trusted.
 */
export async function checkPin(pin, gh, fetchBytes) {
  const pinned = await fetchBytes(pin.url);
  if (pinned.length !== pin.bytes || sha256(pinned) !== pin.sha256) {
    throw new Error(`control failed: ${pin.url} no longer gives ${pin.bytes} bytes with sha256 ${pin.sha256}`);
  }
  const base = `repos/${pin.owner}/${pin.repo}`;
  const branch = call(gh, base, [200]).body.default_branch;
  const head = call(gh, `${base}/branches/${branch}`, [200]).body.commit.sha;
  const last = call(gh, `${base}/commits?path=${encodeURIComponent(pin.path)}&sha=${branch}&per_page=1`, [200]).body;
  const compare = call(gh, `${base}/compare/${pin.commit}...${head}`, [200]).body;
  const release = call(gh, `${base}/releases/latest`, [200, 404]);
  const now = await fetchBytes(pin.url.replace(`/${pin.commit}/`, `/${head}/`));
  const nowSha = sha256(now);
  return {
    files: pin.files,
    repository: `${pin.owner}/${pin.repo}`,
    path: pin.path,
    pinnedCommit: pin.commit,
    head,
    aheadBy: compare.ahead_by,
    lastCommitTouchingPath: last[0]?.sha ?? null,
    latestRelease: release.status === 200 ? release.body.tag_name : null,
    headBytes: now.length,
    headSha256: nowSha,
    moved: now.length !== pin.bytes || nowSha !== pin.sha256,
  };
}

/** @type {FetchBytes} */
async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

const beside = (rel) => fileURLToPath(new URL(`../${rel}`, import.meta.url));
const message = (error) => (error instanceof Error ? error.message : String(error));

/**
 * @param {string[]} argv
 * @param {Gh} [gh]
 * @param {FetchBytes} [fetchBytes]
 * @param {{ estate?: string, sources?: any }} [inputs] the two committed inputs, read beside this module when absent
 * @returns {Promise<{ code: 0 | 1 | 2, message: string }>}
 */
export async function main(argv, gh = ghApi, fetchBytes = download, inputs = {}) {
  const command = argv[0];
  const started = new Date().toISOString();
  try {
    if (command === 'sweep') {
      const names = estateNames(inputs.estate ?? readFileSync(beside('ops/estate.md'), 'utf8'));
      const rows = names.map((name) => sweepRepository(name, gh));
      return { code: 0, message: JSON.stringify({ command, started, finished: new Date().toISOString(), rows }, null, 2) };
    }
    if (command === 'font-pins') {
      const sources = inputs.sources ?? JSON.parse(readFileSync(beside('packages/fonts/sources.json'), 'utf8'));
      const rows = [];
      for (const pin of fontPins(sources)) rows.push(await checkPin(pin, gh, fetchBytes));
      const report = JSON.stringify({ command, started, finished: new Date().toISOString(), rows }, null, 2);
      return { code: rows.some((row) => row.moved) ? 1 : 0, message: report };
    }
    return { code: 2, message: 'usage: node ops/ad22-refresh.mjs sweep|font-pins' };
  } catch (error) {
    return { code: 2, message: `${command}: ${message(error)}` };
  }
}

function sameFile(a, b) {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return resolve(a) === resolve(b);
  }
}

if (typeof process.argv[1] === 'string' && sameFile(process.argv[1], fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2)).then((result) => {
    process.exitCode = result.code;
    const stream = result.code === 2 ? process.stderr : process.stdout;
    stream.write(`${result.message}\n`, () => process.exit(result.code));
  });
}
