// The committed AD-22 refresh checks, Story 9-10 (DW-243). Every call goes
// through a planted `gh` and a planted downloader, so nothing here reads the
// network.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isTestShaped, main, parseResponse, sweepRepository } from '../ad22-refresh.mjs';

const ROOT = process.cwd();
const record = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const b64 = (text: string) => Buffer.from(text).toString('base64');
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

type Answer = { status: number; body?: unknown };

/** A `gh` that answers from a table and 404s everything else, as a missing file does. */
const planted = (answers: Record<string, Answer>) => (endpoint: string) => {
  const answer = answers[endpoint] ?? { status: 404 };
  return { status: answer.status, body: answer.body ?? null };
};

const R = 'repos/LuigiEspinosa/demo';
const cleanRepo = (): Record<string, Answer> => ({
  [R]: { status: 200, body: { default_branch: 'main', private: false, allow_auto_merge: false } },
  [`${R}/branches/main`]: { status: 200, body: { commit: { sha: 'abc1234' } } },
  [`${R}/automated-security-fixes`]: { status: 200, body: { enabled: false, paused: false } },
  [`${R}/pulls?state=all&per_page=100&page=1`]: { status: 200, body: [{ user: { login: 'LuigiEspinosa' } }] },
  [`${R}/rules/branches/main`]: { status: 200, body: [] },
  [`${R}/rulesets`]: { status: 200, body: [] },
  [`${R}/git/trees/main?recursive=1`]: {
    status: 200,
    body: {
      truncated: false,
      tree: [
        { type: 'tree', path: 'src' },
        { type: 'blob', path: 'src/app.spec.ts' },
        { type: 'blob', path: 'src/app.ts' },
        { type: 'blob', path: 'tsconfig.spec.json' },
        { type: 'blob', path: 'test/helper.exs' },
        { type: 'blob', path: '.github/workflows/ci.yml' },
      ],
    },
  },
  [`${R}/contents/.github/workflows/ci.yml?ref=main`]: {
    status: 200,
    body: { content: b64('on: push\njobs:\n  t:\n    continue-on-error: true\n') },
  },
});

describe('parseResponse', () => {
  it('reads the status line and the JSON body of `gh api -i`', () => {
    expect(parseResponse('HTTP/2.0 404 Not Found\r\nA: b\r\n\r\n{"message":"Not Found"}', 'x')).toEqual({
      status: 404,
      body: { message: 'Not Found' },
    });
    expect(parseResponse('HTTP/2.0 204 No Content\r\nA: b\r\n\r\n', 'x')).toEqual({ status: 204, body: null });
  });
});

describe('the counting rule', () => {
  it('counts condition 1 patterns and excludes a tsconfig', () => {
    expect(['__tests__/a.ts', 'test/x.exs', 'tests/e2e/b.png', 'a.test.ts', 'b.spec.js', 'c_test.go'].every(isTestShaped)).toBe(true);
    expect(['tsconfig.spec.json', 'src/app.ts', 'contest/a.ts'].some(isTestShaped)).toBe(false);
  });
});

describe('sweep', () => {
  it('reports a clean repository without a verdict', () => {
    const row = sweepRepository('demo', planted(cleanRepo()));
    expect(row).toMatchObject({
      defaultBranch: 'main',
      head: 'abc1234',
      configs: [],
      pulls: 1,
      botPulls: 0,
      alerts: false,
      protection: { status: 404, requiredChecks: [] },
      blobs: 5,
      testShaped: 2,
      workflows: [{ path: '.github/workflows/ci.yml', softFail: [4] }],
    });
    expect(row).not.toHaveProperty('realTestSuite');
  });

  it('names every configuration present and counts bot-authored pull requests', () => {
    const answers = cleanRepo();
    answers[`${R}/contents/renovate.json?ref=main`] = { status: 200, body: { content: b64('{}') } };
    answers[`${R}/contents/package.json?ref=main`] = { status: 200, body: { content: b64('{"renovate":{}}') } };
    answers[`${R}/pulls?state=all&per_page=100&page=1`] = {
      status: 200,
      body: [{ user: { login: 'dependabot[bot]' } }, { user: { login: 'LuigiEspinosa' } }],
    };
    const row = sweepRepository('demo', planted(answers));
    expect(row.configs).toEqual(['renovate.json', 'package.json#renovate']);
    expect(row.botPulls).toBe(1);
  });

  it('exits 2 naming the endpoint when a call answers an unexpected status', async () => {
    const answers = cleanRepo();
    answers[`${R}/vulnerability-alerts`] = { status: 401 };
    const estate = 'The 10 repositories at the end state are `demo`, `b`, `c`, `d`, `e`, `f`, `g`, `h`, `i`, `j`.';
    const result = await main(['sweep'], planted(answers), undefined, { estate });
    expect(result.code).toBe(2);
    expect(result.message).toContain(`${R}/vulnerability-alerts answered 401`);
  });

  it('reads a plan 403 as not available, and any other 403 as a defect', () => {
    const answers = cleanRepo();
    const plan = { status: 403, body: { message: 'Upgrade to GitHub Pro or make this repository public to enable this feature.' } };
    answers[`${R}/branches/main/protection`] = plan;
    answers[`${R}/rulesets`] = plan;
    const row = sweepRepository('demo', planted(answers));
    expect(row.protection.status).toBe(403);
    expect(row.rulesets).toEqual({ status: 403 });
    answers[`${R}/rulesets`] = { status: 403, body: { message: 'API rate limit exceeded' } };
    expect(() => sweepRepository('demo', planted(answers))).toThrow(`${R}/rulesets answered 403`);
  });

  it('refuses a truncated tree', () => {
    const answers = cleanRepo();
    answers[`${R}/git/trees/main?recursive=1`] = { status: 200, body: { truncated: true, tree: [] } };
    expect(() => sweepRepository('demo', planted(answers))).toThrow(/truncated/);
  });
});

describe('font-pins', () => {
  const PIN = 'a'.repeat(40);
  const HEAD = 'b'.repeat(40);
  const pinned = new TextEncoder().encode('pinned face');
  const url = `https://raw.githubusercontent.com/o/r/${PIN}/fonts/F%5Bwght%5D.ttf`;
  const entry = (file: string, bytes: Uint8Array) => ({ file, commit: PIN, url, bytes: bytes.length, sha256: sha(bytes) });
  const sources = { families: [{ source: entry('f.ttf', pinned), licenceSource: entry('f.ttf', pinned) }] };
  const gh = planted({
    'repos/o/r': { status: 200, body: { default_branch: 'main' } },
    'repos/o/r/branches/main': { status: 200, body: { commit: { sha: HEAD } } },
    [`repos/o/r/commits?path=${encodeURIComponent('fonts/F[wght].ttf')}&sha=main&per_page=1`]: {
      status: 200,
      body: [{ sha: PIN }],
    },
    [`repos/o/r/compare/${PIN}...${HEAD}`]: { status: 200, body: { ahead_by: 3 } },
  });
  const files = (head: Uint8Array, atPin = pinned) => async (u: string) => (u.includes(`/${HEAD}/`) ? head : atPin);

  it('exits 0 when the file at the head is the pinned file', async () => {
    const result = await main(['font-pins'], gh, files(pinned), { sources });
    expect(result.code, result.message).toBe(0);
    const [row] = JSON.parse(result.message).rows;
    expect(row).toMatchObject({ moved: false, aheadBy: 3, lastCommitTouchingPath: PIN, latestRelease: null });
  });

  it('exits 1 and names the new hash when upstream moved the file', async () => {
    const moved = new TextEncoder().encode('newer face');
    const result = await main(['font-pins'], gh, files(moved), { sources });
    expect(result.code).toBe(1);
    expect(JSON.parse(result.message).rows[0]).toMatchObject({ moved: true, headSha256: sha(moved) });
  });

  it('exits 2 when the pinned url no longer reproduces its recorded bytes', async () => {
    const result = await main(['font-pins'], gh, files(pinned, new TextEncoder().encode('tampered')), { sources });
    expect(result.code).toBe(2);
    expect(result.message).toContain('control failed');
  });
});

describe('the records run the committed checks', () => {
  it('contract-adoption.md names the sweep command', () => {
    expect(record('ops/contract-adoption.md')).toContain('`node ops/ad22-refresh.mjs sweep`');
  });
  it('font-contract.md names the font-pins command', () => {
    expect(record('ops/font-contract.md')).toContain('`node ops/ad22-refresh.mjs font-pins`');
  });
});
