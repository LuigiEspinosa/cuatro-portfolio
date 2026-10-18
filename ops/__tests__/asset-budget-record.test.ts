// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cells, section } from '../contract-adoption.mjs';
import { NARRATIVE_ESTIMATE_BYTES, NON_3D_BUDGET_BYTES } from '../asset-budget.mjs';

/**
 * `ops/asset-budget.md` read back against itself (DW-108).
 *
 * `asset-budget.test.ts` runs the tool on scratch trees, which tests the arithmetic of the tool and
 * not of the record: a figure copied wrong, a delta subtracted the wrong way, or a findings line
 * that disagrees with the reading filed from the same build all stayed green. This suite needs no
 * build, so it runs under the blocking `test` job. It holds what the record can hold alone:
 *
 * - in every § Every route reading, each before and after pair closes on its stated delta, each
 *   after figure equals that reading's route table, and the non-3D line and the decomposition
 *   close against the 140,000 budget;
 * - in every § Findings run, the deferred and first-paint halves sum to the narrative total, the
 *   distance to the estimate's top closes, the two budget lines close, and each figure equals the
 *   reading taken from the same `BUILD_ID`.
 *
 * Whether the figures match a build today is a question only a re-run of the tool answers.
 */

const HERE = 'ops/__tests__/asset-budget-record.test.ts';
const RECORD_REL = 'ops/asset-budget.md';
const BUDGET = NON_3D_BUDGET_BYTES;
const TOP = NARRATIVE_ESTIMATE_BYTES[1];

const record = readFileSync(resolve(process.cwd(), RECORD_REL), 'utf8').replace(/\r\n/g, '\n');

interface Part {
  title: string;
  body: string;
}

/** The `###` parts of one `##` section, in the order the record keeps them (newest first). */
const parts = (markdown: string, heading: string): Part[] =>
  section(markdown, heading)
    .split(/\n(?=### )/)
    .filter((chunk: string) => chunk.startsWith('### '))
    .map((chunk: string) => ({ title: chunk.split('\n')[0].slice(4), body: chunk }));

/** Every pipe table in a part, header first, the separator row dropped. */
const tables = (body: string): string[][][] => {
  const found: string[][][] = [];
  let current: string[][] | null = null;
  for (const line of body.split('\n')) {
    if (!line.trim().startsWith('|')) {
      current = null;
      continue;
    }
    if (/^\|\s*:?-+/.test(line.trim())) continue;
    if (current === null) {
      current = [];
      found.push(current);
    }
    current.push(cells(line));
  }
  return found;
};

const num = (text: string): number => Number(text.replace(/,/g, ''));
const buildOf = (body: string): string | undefined => /against build `([^`]+)`/.exec(body)?.[1];

/** A signed delta read from a cell such as "39 heavier", "**49,520 lighter**" or "0". */
const signed = (cell: string): number | undefined => {
  const plain = cell.replace(/\*/g, '').trim();
  const moved = /^([\d,]+) (heavier|lighter)\b/.exec(plain);
  if (moved) return moved[2] === 'lighter' ? -num(moved[1]) : num(moved[1]);
  return /^(0|none)\b/.test(plain) ? 0 : undefined;
};

/** What one reading states, as far as the checks and the findings cross-check need it. */
interface Reading {
  title: string;
  build?: string;
  wire: Map<string, number>;
  narrative?: number;
  non3d?: { route: string; bytes: number };
  decomposition?: number;
}

const NON_3D = /`([^`]+)`, ([\d,]+), ([\d,]+) over, ([\d.]+) percent/;
const DECOMPOSITION = /([\d,]+), ([\d,]+) of margin/;
const ON_DISK = /([\d,]+) on disk, ([\d,]+) gzipped/;

/** One § Every route reading's own arithmetic, and the figures it states. */
const readReading = ({ title, body }: Part, found: string[]): Reading => {
  const reading: Reading = { title, build: buildOf(body), wire: new Map() };
  const all = tables(body);
  const at = (what: string): string => `${title}, ${what}`;

  for (const row of all.find((t) => t[0][1] === 'Document bytes')?.slice(1) ?? []) {
    reading.wire.set(row[0].replace(/`/g, ''), num(row[2]));
  }

  for (const row of all.find((t) => t[0][0] === 'Route' && t[0][1].startsWith('Before'))?.slice(1) ?? []) {
    const route = row[0].replace(/`/g, '');
    const [before, after, delta] = [num(row[1]), num(row[2]), signed(row[3])];
    if (delta === undefined) found.push(at(`${route}: the delta "${row[3]}" cannot be read`));
    else if (after - before !== delta) found.push(at(`${route}: ${row[1]} to ${row[2]} is ${after - before}, the row states ${delta}`));
    const wire = reading.wire.get(route);
    if (wire !== undefined && wire !== after) found.push(at(`${route}: the route table states ${wire}, the after column ${after}`));
  }

  for (const row of all.find((t) => t[0][0] === 'Figure')?.slice(1) ?? []) {
    const [figure, before, after, delta] = row;
    if (figure === 'The non-3D line') {
      for (const side of [before, after]) {
        const m = NON_3D.exec(side);
        if (!m) {
          found.push(at(`the non-3D line "${side}" cannot be read`));
          continue;
        }
        const [bytes, over, percent] = [num(m[2]), num(m[3]), Number(m[4])];
        if (bytes - BUDGET !== over) found.push(at(`the non-3D line: ${m[2]} is ${bytes - BUDGET} over, the row states ${m[3]}`));
        if (((over / BUDGET) * 100).toFixed(1) !== m[4]) found.push(at(`the non-3D line: ${m[3]} over is not ${percent} percent`));
      }
      const m = NON_3D.exec(after);
      if (m) {
        reading.non3d = { route: m[1], bytes: num(m[2]) };
        const wire = reading.wire.get(m[1]);
        if (wire !== undefined && wire !== num(m[2])) found.push(at(`the non-3D line states ${m[2]}, the route table ${wire}`));
      }
    }
    if (figure === "The budget's own decomposition") {
      for (const side of [before, after]) {
        const m = DECOMPOSITION.exec(side);
        if (!m) found.push(at(`the decomposition "${side}" cannot be read`));
        else if (num(m[1]) + num(m[2]) !== BUDGET) found.push(at(`the decomposition: ${m[1]} and ${m[2]} of margin do not make ${BUDGET}`));
      }
      const m = DECOMPOSITION.exec(after);
      if (m) reading.decomposition = num(m[1]);
    }
    if (figure === 'The narrative total') {
      const [b, a] = [before, after].map((side) => /([\d,]+) across \d+ chunks/.exec(side)?.[1]);
      const d = signed(delta);
      if (!b || !a || d === undefined) found.push(at(`the narrative total row cannot be read`));
      else {
        reading.narrative = num(a);
        if (num(a) - num(b) !== d) found.push(at(`the narrative total: ${b} to ${a} is ${num(a) - num(b)}, the row states ${d}`));
      }
    }
    if (figure === 'Bytes in `.next/static/chunks`') {
      const [b, a] = [ON_DISK.exec(before), ON_DISK.exec(after)];
      const amounts = [...delta.matchAll(/(\d[\d,]*\d|\d)/g)].map((m) => num(m[1]));
      const words = [...delta.matchAll(/\b(heavier|lighter)\b/g)].map((m) => m[1]);
      if (!b || !a || amounts.length !== 2 || words.length === 0) found.push(at(`the build's bytes row cannot be read`));
      else {
        const sign = (i: number): number => ((words[i] ?? words[0]) === 'lighter' ? -1 : 1);
        const moved = [num(a[1]) - num(b[1]), num(a[2]) - num(b[2])];
        moved.forEach((value, i) => {
          if (value !== sign(i) * amounts[i]) {
            found.push(at(`the build's ${i === 0 ? 'on-disk' : 'gzipped'} bytes moved ${value}, the row states "${delta}"`));
          }
        });
      }
    }
  }
  return reading;
};

/** One § Findings run's own arithmetic, and its agreement with the reading of the same build. */
const checkRun = ({ title, body }: Part, readings: readonly Reading[], found: string[]): void => {
  const at = (what: string): string => `${title}, ${what}`;
  const prose = body.replace(/\n\s*/g, ' ');
  const narrative = /The narrative bundle is ([\d,]+) bytes gzipped/.exec(prose)?.[1];
  if (narrative === undefined) {
    found.push(at('no "The narrative bundle is N bytes gzipped" line'));
    return;
  }
  const total = num(narrative);
  const over = /That is ([\d,]+) over the top of the range/.exec(prose)?.[1];
  const under = /That is inside the range, ([\d,]+) below the top/.exec(prose)?.[1];
  if (over !== undefined && total - TOP !== num(over)) found.push(at(`${narrative} is ${total - TOP} over the top, the line states ${over}`));
  if (under !== undefined && TOP - total !== num(under)) found.push(at(`${narrative} is ${TOP - total} below the top, the line states ${under}`));
  if (over === undefined && under === undefined) found.push(at('no distance to the top of the estimate'));

  const deferred = /([\d,]+) bytes of that is genuinely deferred/.exec(prose)?.[1];
  const other = /The other ([\d,]+) is on a document/.exec(prose)?.[1];
  if (!deferred || !other) found.push(at('no deferred and first-paint halves of the narrative total'));
  else if (num(deferred) + num(other) !== total) found.push(at(`${deferred} deferred and ${other} at first paint do not make ${narrative}`));

  const non3d = /over budget as measured: ([\d,]+) against ([\d,]+), ([\d,]+) over, on route `([^`]+)`/.exec(prose);
  if (!non3d) found.push(at('no "over budget as measured" line for the non-3D path'));
  else if (num(non3d[1]) - num(non3d[2]) !== num(non3d[3])) found.push(at(`the non-3D path: ${non3d[1]} against ${non3d[2]} is not ${non3d[3]} over`));
  const inside = /own decomposition it is inside: ([\d,]+) against ([\d,]+), ([\d,]+) of margin/.exec(prose);
  if (!inside) found.push(at('no "own decomposition it is inside" line'));
  else if (num(inside[1]) + num(inside[3]) !== num(inside[2])) found.push(at(`the decomposition: ${inside[1]} and ${inside[3]} of margin do not make ${inside[2]}`));

  const build = buildOf(body);
  const twin = readings.find((reading) => build !== undefined && reading.build === build);
  if (!twin) return;
  const pair = (what: string, run: number, reading: number | undefined): void => {
    if (reading !== undefined && run !== reading) found.push(at(`${what}: the run states ${run}, "${twin.title}" states ${reading}`));
  };
  pair('the narrative total', total, twin.narrative);
  if (non3d) pair(`${non3d[4]} on the wire`, num(non3d[1]), twin.wire.get(non3d[4]) ?? twin.non3d?.bytes);
  if (inside) pair('the decomposition', num(inside[1]), twin.decomposition);
};

/** Every disagreement the record holds with itself, each naming the part it is in. */
const disagreements = (markdown: string): string[] => {
  const found: string[] = [];
  const readings = parts(markdown, 'Every route').map((part) => readReading(part, found));
  for (const run of parts(markdown, 'Findings')) checkRun(run, readings, found);
  return found;
};

describe('ops/asset-budget.md agrees with itself', () => {
  it('reads every reading and every run, and pairs the newest run with its reading', () => {
    const readings = parts(record, 'Every route');
    const runs = parts(record, 'Findings');
    expect(readings.length, `${RECORD_REL} § Every route holds no reading`).toBeGreaterThan(0);
    expect(runs.length, `${RECORD_REL} § Findings holds no run`).toBeGreaterThan(0);
    expect(buildOf(runs[0].body), `${HERE}: the newest run names no build`).toBeDefined();
    expect(buildOf(readings[0].body)).toBe(buildOf(runs[0].body));
  });

  it('names no disagreement between a figure and what it is derived from', () => {
    expect(
      disagreements(record),
      `${RECORD_REL} states a figure its own tables or its twin reading do not give. A reading is ` +
        `never rewritten: if the figure was copied wrong, add a dated correction beside it`
    ).toEqual([]);
  });

  it('fails on each figure edited in one place, naming the part and both values', () => {
    const plant = (from: string, to: string): string[] => {
      expect(record, `${HERE}: the planted control's anchor "${from}" is not in the record`).toContain(from);
      return disagreements(record.replace(from, to));
    };
    const newest = 'The 2026-09-25 reading, after the home-hero-rulings package';
    const run = 'The 2026-09-25 run, after the home-hero-rulings package';

    expect(plant('| `/work` | 231,831 | 231,870 | 39 heavier |', '| `/work` | 231,831 | 231,870 | 38 heavier |')).toEqual([
      `${newest}, /work: 231,831 to 231,870 is 39, the row states 38`,
    ]);
    expect(plant('| `/cv` | 22,662 | 230,461 |', '| `/cv` | 22,662 | 230,462 |')).toEqual([
      `${newest}, /cv: the route table states 230462, the after column 230461`,
    ]);
    expect(plant('`/work`, 231,870, 91,870 over, 65.6 percent', '`/work`, 231,870, 91,871 over, 65.6 percent')).toEqual([
      `${newest}, the non-3D line: 231,870 is 91870 over, the row states 91,871`,
    ]);
    expect(plant('104,153, 35,847 of margin |', '104,153, 35,848 of margin |')).toEqual([
      `${newest}, the decomposition: 104,153 and 35,848 of margin do not make ${BUDGET}`,
    ]);
    expect(plant('**140 heavier on disk, 23 lighter gzipped**', '**140 heavier on disk, 23 heavier gzipped**')).toEqual([
      `${newest}, the build's gzipped bytes moved -23, the row states "**140 heavier on disk, 23 heavier gzipped**"`,
    ]);
    expect(plant('That is 169,048 over the top', 'That is 169,049 over the top')).toEqual([
      `${run}, 619,048 is 169048 over the top, the line states 169,049`,
    ]);
    expect(plant('- 592,077 bytes of that is genuinely deferred', '- 592,078 bytes of that is genuinely deferred')).toEqual([
      `${run}, 592,078 deferred and 26,971 at first paint do not make 619,048`,
    ]);
    expect(plant('inside: 104,153 against 140,000, 35,847 of margin', 'inside: 104,153 against 140,000, 35,846 of margin')).toEqual([
      `${run}, the decomposition: 104,153 and 35,846 of margin do not make 140,000`,
    ]);
    expect(plant('measured: 231,870 against 140,000, 91,870 over', 'measured: 231,871 against 140,000, 91,871 over')).toEqual([
      `${run}, /work on the wire: the run states 231871, "${newest}" states 231870`,
    ]);
  });

  it('refuses a run it cannot read, rather than passing over it', () => {
    expect(disagreements(record.replace('- The narrative bundle is 619,048 bytes gzipped', '- The bundle weighs 619,048'))).toEqual([
      'The 2026-09-25 run, after the home-hero-rulings package, no "The narrative bundle is N bytes gzipped" line',
    ]);
    expect(() => disagreements('# nothing\n')).toThrow(/no "## Every route" section/);
  });
});
