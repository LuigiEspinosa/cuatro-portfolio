// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Line 1 of every `ops/*.md` record is one short `# ` heading (Epic 8 retrospective, M4, action 7).
 *
 * A node one-liner run through Git Bash twice glued table cells onto a record's title, joined by the
 * literal `undefined` (`063f4dd`, `e0f34a2`), and nothing noticed until a reader did. This runs under
 * the blocking `test` job with the rest of the root suite.
 */

const OPS = join(process.cwd(), 'ops');
const MAX_TITLE = 80;

const titleFault = (line: string): string | null => {
  if (!/^# \S/.test(line)) return 'is not a single `# ` heading';
  if (line.includes('|')) return 'carries a table cell';
  if (/undefined/.test(line)) return 'carries the literal undefined';
  if (line.length > MAX_TITLE) return `is longer than ${MAX_TITLE} characters`;
  return null;
};

describe('the ops records', () => {
  it('each open on one short heading', () => {
    const records = readdirSync(OPS).filter((name) => name.endsWith('.md'));
    expect(records.length, 'no ops/*.md was found, so the check below is vacuous').toBeGreaterThan(30);
    const faults = records.flatMap((name) => {
      const first = readFileSync(join(OPS, name), 'utf8').split(/\r?\n/, 1)[0];
      const fault = titleFault(first);
      return fault ? [`ops/${name} line 1 ${fault}: ${first.slice(0, 120)}`] : [];
    });
    expect(faults).toEqual([]);
  });

  it('refuses each defect on a planted line', () => {
    expect(titleFault('# The restyle floor, Epic 8')).toBeNull();
    expect(titleFault('# The restyle floor, Epic 8undefinedSigned off 2026-10-17')).toMatch(/undefined/);
    expect(titleFault('# The demo principal | 2026-10-13 |')).toMatch(/table cell/);
    expect(titleFault('## A second-level heading')).toMatch(/single/);
    expect(titleFault('The title without a marker')).toMatch(/single/);
    expect(titleFault('')).toMatch(/single/);
    expect(titleFault(`# ${'x'.repeat(MAX_TITLE)}`)).toMatch(/longer/);
  });
});
