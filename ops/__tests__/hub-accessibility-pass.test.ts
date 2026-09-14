// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { section, table, unticked } from '../contract-adoption.mjs';

/**
 * The Story 2-26 record, `ops/hub-accessibility-pass.md`, held equal to the ledger the sweep
 * enforces, `EXEMPTIONS` in `tests/e2e/accessibility-floor.pw.ts`, and to the board, the register,
 * the Lighthouse gate and the harness record around it.
 *
 * **Both directions, because either file alone would rot.** A row in the record with no entry in
 * the ledger is a breach someone believes is tracked and is not; an entry in the ledger with no
 * row in the record is a breach the register cannot see. Neither is visible from inside the file
 * that has it, and the Playwright suite never reads the record. Same shape as
 * `ops/__tests__/hit-target-floor.test.ts`, whose parsers this reuses through
 * `ops/contract-adoption.mjs`.
 *
 * Every parser and every comparison is shown firing on a planted control before any agreement is
 * read as good news, and the literal parser cross-checks its row count against an independently
 * derived one, so a reflow cannot present itself as a missing row.
 *
 * This suite never opens a browser. What a ring computes to is the Playwright suite's question;
 * this one is about whether the written descriptions of the ledger say the same thing, whether
 * every row is answerable and cites the line that carries its tell, and whether the story can
 * close while a human half is outstanding.
 */

const REPO_ROOT = process.cwd();
const HERE = 'ops/__tests__/hub-accessibility-pass.test.ts';

const RECORD_REL = 'ops/hub-accessibility-pass.md';
const SPEC_REL = 'tests/e2e/accessibility-floor.pw.ts';
const BOARD_REL = '_bmad-output/implementation-artifacts/sprint-status.yaml';
const HARNESS_RECORD_REL = 'ops/rendered-output-harness.md';
const VIOLATIONS_REL = 'ops/known-violations.md';
const TOKENS_REL = 'contracts/tokens.css';
const LIGHTHOUSE_REL = '.lighthouserc.js';

/** Read a tracked file, line endings normalised to `\n` (`ops/__tests__/hit-target-floor.test.ts:40-61`). */
const read = (relative: string): string => readFileSync(resolve(REPO_ROOT, relative), 'utf8').replace(/\r\n/g, '\n');

const record = read(RECORD_REL);
const spec = read(SPEC_REL);
const board = read(BOARD_REL);
const violations = read(VIOLATIONS_REL);

/** The one shape a `source` may take, read out of the spec file rather than declared here. */
const sourceShape = (source: string): RegExp => {
  const literal = /const SOURCE_SHAPE = \/(.+)\/;/.exec(source)?.[1];
  if (literal === undefined) throw new Error(`${SPEC_REL}: no "const SOURCE_SHAPE = /.../;" literal was found`);
  return new RegExp(literal);
};

const SOURCE_SHAPE = sourceShape(spec);

/** The five kinds of row, and the text the cited source lines have to carry for each. */
const CHECKS = ['z-index', 'depth', 'weight', 'clip', 'heading'] as const;
type Check = (typeof CHECKS)[number];

/** One ledger row, in whichever of the two files it was read from. */
interface Row {
  id: string;
  check: string;
  match: string;
  count: number;
  source: string;
  closedBy: string;
}

/** The exemption table in the record. */
const recordRows = (markdown: string): Row[] => {
  const { rows } = table(section(markdown, 'The exemption ledger'), 'Id');
  if (rows.length === 0) throw new Error(`${RECORD_REL}: the exemption table has zero rows, so there is nothing to compare`);
  return rows.map((cells: string[]) => ({
    id: unticked(cells[0]),
    check: unticked(cells[1]),
    match: unticked(cells[2]),
    count: Number(cells[3].trim()),
    source: unticked(cells[4]),
    closedBy: cells[5].trim(),
  }));
};

/**
 * The `EXEMPTIONS` const in the Playwright spec, read as text, with the object count cross-checked
 * against the count of `id:` fields so a reflow is reported as a parse failure rather than as a
 * missing row (`ops/__tests__/hit-target-floor.test.ts:154-222`).
 */
const specRows = (source: string): Row[] => {
  const block = /const EXEMPTIONS: readonly Exemption\[\] = \[\n([\s\S]*?)\n\];/.exec(source)?.[1];
  if (block === undefined) throw new Error(`${SPEC_REL}: no "const EXEMPTIONS: readonly Exemption[] = [" literal was found`);

  const objects = [...block.matchAll(/\{\n([\s\S]*?)\n {2}\},/g)].map((match) => match[1]);
  const declared = [...block.matchAll(/^\s*id: '/gm)].length;
  if (objects.length === 0) throw new Error(`${SPEC_REL}: the EXEMPTIONS literal parsed to zero rows, so there is nothing to compare`);
  if (objects.length !== declared) {
    throw new Error(
      `${SPEC_REL}: the EXEMPTIONS literal parsed to ${objects.length} rows and declares ${declared} ids. The object ` +
        `parser depends on two-space indentation and a trailing comma on every entry, so this is a reflow rather than a ` +
        `missing row. Restore the shape or widen the parser.`
    );
  }

  return objects.map((body) => {
    const field = (name: string): string => {
      const found = new RegExp(`\\b${name}: '([^']*)'`).exec(body)?.[1];
      if (found === undefined) throw new Error(`${SPEC_REL}: an EXEMPTIONS entry carries no "${name}" field:\n${body}`);
      return found;
    };
    const count = /\bcount: (\d+),/.exec(body)?.[1];
    if (count === undefined) throw new Error(`${SPEC_REL}: an EXEMPTIONS entry carries no "count" field:\n${body}`);
    return {
      id: field('id'),
      check: field('check'),
      match: field('match'),
      count: Number(count),
      source: field('source'),
      closedBy: field('closedBy'),
    };
  });
};

/** Every way the two ledgers differ, named in both directions and in id order. */
const disagreements = (fromRecord: readonly Row[], fromSpec: readonly Row[]): string[] => {
  const found: string[] = [];
  const recorded = new Map(fromRecord.map((row) => [row.id, row]));
  const listed = new Map(fromSpec.map((row) => [row.id, row]));
  if (recorded.size !== fromRecord.length) found.push(`${RECORD_REL} carries a repeated id`);
  if (listed.size !== fromSpec.length) found.push(`${SPEC_REL} carries a repeated id`);

  for (const id of [...new Set([...recorded.keys(), ...listed.keys()])].sort()) {
    const left = recorded.get(id);
    const right = listed.get(id);
    if (!left) {
      found.push(`"${id}" is in ${SPEC_REL} and has no row in ${RECORD_REL}`);
      continue;
    }
    if (!right) {
      found.push(`"${id}" is in ${RECORD_REL} and has no entry in ${SPEC_REL}`);
      continue;
    }
    for (const field of ['check', 'match', 'source', 'closedBy'] as const) {
      if (left[field] !== right[field]) found.push(`"${id}": ${RECORD_REL} says ${field} "${left[field]}", ${SPEC_REL} says "${right[field]}"`);
    }
    if (left.count !== right.count) found.push(`"${id}": ${RECORD_REL} says count ${left.count}, ${SPEC_REL} says ${right.count}`);
  }
  return found;
};

/**
 * The text a row's cited source lines have to carry, per kind: the literal `z-index: <match>`,
 * the depth property or function as named, a `font-weight`, the declaration that clips
 * (`clip-path`, `overflow`, or the `inset` that parks an element on the document's edge), and for
 * a heading row the element standing where the heading should be.
 */
const tellFor = (row: Row): RegExp => {
  const literal = row.match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  switch (row.check as Check) {
    case 'z-index':
      return new RegExp(`z-index:\\s*${literal}\\b`);
    case 'depth':
      return new RegExp(`(?<![\\w-])${literal}\\s*[:(]`);
    case 'weight':
      return /font-weight\s*:/;
    case 'clip':
      return /clip-path\s*:|overflow(?:-[xy])?\s*:|inset(?:-[a-z-]+)?\s*:/;
    case 'heading':
      return /<p\b|<h[1-6]\b/;
    default:
      throw new Error(`${HERE}: "${row.id}" carries a check kind (${row.check}) with no tell`);
  }
};

/** The cited lines of a `source`, `path:from-to` or `path:a,b`, joined, off the file on disk. */
const citedLines = (source: string): string => {
  const [path, spec] = source.split(':');
  const lines = read(path).split('\n');
  const wanted = new Set<number>();
  for (const part of spec.split(',')) {
    const [from, to] = part.split('-').map(Number);
    for (let line = from; line <= (to ?? from); line += 1) wanted.add(line);
  }
  return [...wanted].map((line) => lines[line - 1] ?? '').join('\n');
};

/** One planted table row per id, all six cells filled the way the record fills them. */
const plantedRows = (ids: readonly string[]): string[][] =>
  ids.map((id) => [`\`${id}\``, '`z-index`', '`20`', '1', '`components/x/X.scss:1`', 'Story 2-29']);

/** A record fragment carrying the ledger section, in the record's own shape, for planted controls. */
const fragment = (rows: string[][] = plantedRows(['z-one'])): string =>
  [
    '# A record',
    '',
    '## The exemption ledger',
    '',
    '| Id | Check | Match | Count | Source | Closed by |',
    '|---|---|---|---|---|---|',
    ...rows.map((row) => `| ${row.join(' | ')} |`),
    '',
    '## Something else',
    '',
  ].join('\n');

/** A spec fragment carrying the literal, in the spec's own shape, for planted controls. */
const literal = (entries: string[] = ['z-one']): string =>
  [
    'const EXEMPTIONS: readonly Exemption[] = [',
    ...entries.map((id) =>
      [
        '  {',
        `    id: '${id}',`,
        "    check: 'z-index',",
        "    match: '20',",
        '    count: 1,',
        "    source: 'components/x/X.scss:1',",
        "    closedBy: 'Story 2-29',",
        '  },',
      ].join('\n')
    ),
    '];',
  ].join('\n');

/** The story statuses on the board, by key. */
const statuses = new Map([...board.matchAll(/^ {2}(\d+-\d+[a-z0-9-]*): *([a-z-]+)\s*$/gm)].map((match) => [match[1], match[2]]));

/** The `Field | Value` table under one of the two Operator sections. */
const operatorTable = (markdown: string, heading: string) => {
  const found = table(section(markdown, heading), 'Field');
  const cell = (field: string): string => found.rows.find((row) => row[0] === field)?.[1] ?? '';
  return { rows: found.rows, cell };
};

const OPERATOR_SECTIONS = ["The Operator's greyscale confirmation", "The Operator's keyboard confirmation"] as const;
const FIELDS = ['Checked by', 'Checked on', 'Result'] as const;
const OUTSTANDING = '_not yet performed_';

/** A check is answered when its `Checked on` cell is an ISO 8601 date and nothing else; any other text is outstanding. */
const answered = (cell: string): boolean => /^\*{0,2}\d{4}-\d{2}-\d{2}\*{0,2}$/.test(cell.trim());

/** A count spelled out, the way the register's headings and index rows carry them. */
const spelled = (count: number): string => {
  const small = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  if (count < 20) return small[count];
  if (count < 100) return count % 10 === 0 ? tens[Math.floor(count / 10)] : `${tens[Math.floor(count / 10)]}-${small[count % 10]}`;
  throw new Error(`${HERE}: ${count} is more than this register's headings spell out`);
};

/** The register's KV-6 entry, from its heading to the `---` that closes it, which has to exist. */
const entryOf = (id: string): string => {
  const at = violations.indexOf(`## ${id}:`);
  expect(at, `${VIOLATIONS_REL} carries no ${id} entry`).toBeGreaterThan(-1);
  const end = violations.indexOf('\n---', at);
  expect(end, `${VIOLATIONS_REL}'s ${id} entry is not closed by a "---" rule, so its end cannot be found`).toBeGreaterThan(at);
  return violations.slice(at, end);
};

const indexRow = (id: string): string => {
  const row = violations.split('\n').find((line) => line.trim().startsWith(`| ${id} |`));
  expect(row, `${VIOLATIONS_REL} has no ${id} index row`).toBeDefined();
  return row ?? '';
};

describe('the record and the exemption ledger agree in both directions', () => {
  const fromRecord = recordRows(record);
  const fromSpec = specRows(spec);

  it('parses a real table and a real literal, so the comparison below is not over nothing', () => {
    expect(fromRecord.length, `${RECORD_REL} exempts nothing`).toBeGreaterThan(0);
    expect(fromSpec.length, `${SPEC_REL} exempts nothing`).toBeGreaterThan(0);
    // A row that is really in both files. `z-scanline` outlives most: Story 2-28 closes it, and it
    // is the row whose literal equals a token by value, the reason the sweep reads text.
    expect(fromRecord.map((row) => row.id)).toContain('z-scanline');
    expect(fromSpec.map((row) => row.id)).toContain('z-scanline');
    for (const row of fromSpec) {
      expect(Number.isInteger(row.count), `"${row.id}" parsed a non-integer count`).toBe(true);
      expect(row.count, `"${row.id}" counts nothing`).toBeGreaterThan(0);
      expect(CHECKS as readonly string[], `"${row.id}" carries a check kind the sweep has no tally for`).toContain(row.check);
    }
  });

  it('names no difference in either direction', () => {
    expect(
      disagreements(fromRecord, fromSpec),
      `${RECORD_REL} and ${SPEC_REL} describe different ledgers. A story that repairs a file deletes its row in both, ` +
        `in the same commit, or the record stops describing what the build enforces`
    ).toEqual([]);
  });

  it('fails in whichever direction is short, on a field edited in one place, and on a repeated id, on planted controls', () => {
    const two = ['z-one', 'z-two'];
    const one = ['z-one'];

    // Direction one: a row in the record with no entry in the ledger.
    expect(disagreements(recordRows(fragment(plantedRows(two))), specRows(literal(one)))).toEqual([
      `"z-two" is in ${RECORD_REL} and has no entry in ${SPEC_REL}`,
    ]);
    // Direction two: an entry in the ledger with no row in the record.
    expect(disagreements(recordRows(fragment(plantedRows(one))), specRows(literal(two)))).toEqual([
      `"z-two" is in ${SPEC_REL} and has no row in ${RECORD_REL}`,
    ]);
    // Direction three: a field edited in one place, each field named with both values.
    const edited = fragment([['`z-one`', '`depth`', '`box-shadow`', '3', '`components/y/Y.scss:9`', 'Story 2-99']]);
    expect(disagreements(recordRows(edited), specRows(literal()))).toEqual([
      `"z-one": ${RECORD_REL} says check "depth", ${SPEC_REL} says "z-index"`,
      `"z-one": ${RECORD_REL} says match "box-shadow", ${SPEC_REL} says "20"`,
      `"z-one": ${RECORD_REL} says source "components/y/Y.scss:9", ${SPEC_REL} says "components/x/X.scss:1"`,
      `"z-one": ${RECORD_REL} says closedBy "Story 2-99", ${SPEC_REL} says "Story 2-29"`,
      `"z-one": ${RECORD_REL} says count 3, ${SPEC_REL} says 1`,
    ]);
    // Direction four: a repeated id is reported rather than silently collapsing two rows into one.
    expect(disagreements(recordRows(fragment(plantedRows(['z-one', 'z-one']))), specRows(literal(one)))).toContain(
      `${RECORD_REL} carries a repeated id`
    );
    // Agreeing lists report nothing, so the four above are differences rather than noise.
    expect(disagreements(recordRows(fragment(plantedRows(two))), specRows(literal(two)))).toEqual([]);
  });

  it('refuses a record or a literal it could not read, rather than comparing a short list', () => {
    expect(() => recordRows('# nothing\n')).toThrow(/no "## The exemption ledger" section/);
    expect(() => recordRows(fragment([]))).toThrow(/zero rows/);
    expect(() => specRows('const OTHER = [];')).toThrow(/no "const EXEMPTIONS/);
    expect(() => specRows('const EXEMPTIONS: readonly Exemption[] = [\n\n];')).toThrow(/parsed to zero rows/);
    expect(() => specRows(literal().replace("    closedBy: 'Story 2-29',\n", ''))).toThrow(/carries no "closedBy" field/);
    expect(() => specRows(literal().replace('    count: 1,\n', ''))).toThrow(/carries no "count" field/);
    const reflowed = literal(['z-one', 'z-two']).replace('  },\n  {', '    },\n    {');
    expect(() => specRows(reflowed)).toThrow(/is a reflow rather than a missing row/);
    expect(() => sourceShape('const OTHER = /x/;')).toThrow(/no "const SOURCE_SHAPE/);
  });
});

describe('every ledger row is answerable', () => {
  const fromRecord = recordRows(record);

  it('names a story that exists on the board and is not done', () => {
    expect(statuses.size, `${BOARD_REL} parsed to no story statuses`).toBeGreaterThan(0);
    expect(statuses.get('2-7-retire-content-projects-ts-the-hub-imports-the-published-reg')).toBe('done');
    for (const row of fromRecord) {
      const id = /^Story (\d+-\d+)$/.exec(row.closedBy)?.[1];
      expect(id, `"${row.id}" names "${row.closedBy}", which is not a "Story n-n" reference`).toBeDefined();
      const entry = [...statuses].find(([key]) => key.startsWith(`${id}-`));
      expect(entry, `"${row.id}" is closed by ${row.closedBy}, which is not a story on the board in ${BOARD_REL}`).toBeDefined();
      expect(
        entry?.[1],
        `"${row.id}" is still exempted and ${row.closedBy} is marked ${entry?.[1]} on the board. Either the repair did not land ` +
          `or the row was not deleted with it.`
      ).not.toBe('done');
    }
    // The parser, on planted controls.
    expect([...statuses.keys()].some((key) => key.startsWith('2-29-'))).toBe(true);
    expect([...statuses.keys()].some((key) => key.startsWith('2-99-'))).toBe(false);
  });

  it('cites a source whose lines carry the tell, in the one shape the spec states', () => {
    for (const row of fromRecord) {
      expect(row.source, `"${row.id}" does not match the SOURCE_SHAPE the spec states`).toMatch(SOURCE_SHAPE);
      const lines = citedLines(row.source);
      expect(lines.trim(), `"${row.id}" cites ${row.source}, which is past the end of the file`).not.toBe('');
      expect(
        lines,
        `"${row.id}" cites ${row.source} and those lines carry no ${row.check} tell (${tellFor(row)}). A reflow left the citation ` +
          `pointing at something else:\n${lines}`
      ).toMatch(tellFor(row));
    }
    // The tells, on planted lines, so a citation cannot pass by pointing at nothing in particular.
    const planted = (check: string, match: string): Row => ({ id: 'x', check, match, count: 1, source: 'x.scss:1', closedBy: 'Story 9-99' });
    expect(tellFor(planted('z-index', '20')).test('  z-index: 20;')).toBe(true);
    expect(tellFor(planted('z-index', '2')).test('  z-index: 20;')).toBe(false);
    expect(tellFor(planted('depth', 'linear-gradient')).test('    linear-gradient(red, blue),')).toBe(true);
    expect(tellFor(planted('depth', 'linear-gradient')).test('    repeating-linear-gradient(red, blue),')).toBe(false);
    expect(tellFor(planted('depth', 'text-shadow')).test('    text-shadow: none;')).toBe(true);
    expect(tellFor(planted('weight', '.x')).test('    font-weight: 600;')).toBe(true);
    expect(tellFor(planted('clip', '.x')).test('    clip-path: polygon(0 0);')).toBe(true);
    expect(tellFor(planted('clip', '.x')).test('  inset-block-start: 0;')).toBe(true);
    expect(tellFor(planted('clip', '.x')).test('  color: red;')).toBe(false);
    expect(tellFor(planted('heading', '/x')).test("        <p className='error-page__code'>")).toBe(true);
    expect(() => tellFor(planted('smell', '.x'))).toThrow(/no tell/);
    expect(citedLines('contracts/tokens.css:129-130')).toContain('--z-base');
    expect(citedLines('contracts/tokens.css:129,135')).toContain('--z-tooltip');
  });
});

describe('the thresholds are read off the contract, never typed', () => {
  /**
   * The spec source with the places a bare `11` or `14` is legitimate removed first: a citation
   * such as `Foo.tsx:14`, a story id, a DW, KV, F or A-number id, a WCAG criterion number, an ISO
   * date, a ledger count. What is left is an `11` or `14` used as a number in code or prose, which
   * is `--t-3xs` or `--t-sm` written by hand (`ops/__tests__/hit-target-floor.test.ts:596-631` does
   * the same for `44`).
   */
  const scrub = (text: string): string =>
    text
      .replace(/[\w./-]+\.(?:tsx?|jsx?|mjs|cjs|scss|css|md|json|ya?ml):[\d,-]+/g, '<citation>')
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '<date>')
      .replace(/\bStory \d+-\d+\b/g, '<story>')
      .replace(/\b(?:DW|KV|F|A)-\d+\b/g, '<id>')
      .replace(/\b\d+\.\d+\.\d+\b/g, '<criterion>')
      .replace(/\bcount: \d+,/g, 'count: <n>,');
  const scan = (text: string): string[] => [...scrub(text).matchAll(/\b(?:11|14)(?:px)?\b/g)].map((match) => match[0]);

  it('writes no bare 11 or 14 for the type floor', () => {
    expect(scan(spec), `${SPEC_REL} writes a type threshold by hand instead of reading --t-3xs, --t-2xs or --t-sm`).toEqual([]);
    for (const token of ['--t-3xs', '--t-2xs', '--t-sm', '--stroke-focus', '--token-focus', '--focus-offset']) {
      expect(spec, `${SPEC_REL} no longer reads ${token} off the page`).toContain(`var(${token})`);
    }
    // The scan, on planted controls, so an empty result is a measurement.
    expect(scan('a floor of 11px here')).toEqual(['11px']);
    expect(scan('prose never under 14')).toEqual(['14']);
    expect(scan('see components/x/X.scss:14 and Story 2-14 on 2026-09-11, DW-11, A-11, 1.4.11, count: 14,')).toEqual([]);
    expect(scan('0.6875rem is 110 and 1.4 and 114')).toEqual([]);
  });

  it('derives the z-level names from the contract rather than a count', () => {
    expect(spec, `${SPEC_REL} no longer parses contracts/tokens.css for the --z-* names`).toContain('--z-[a-z0-9-]+');
    const source = read(TOKENS_REL).replace(/\/\*[\s\S]*?\*\//g, '');
    const layers = [...source.matchAll(/(?:^|[;{])\s*(--z-[a-z0-9-]+)\s*:/gm)].map((match) => match[1]);
    expect(layers.length, `${TOKENS_REL} declares no --z-* name`).toBeGreaterThan(0);
    expect(record, `${RECORD_REL} does not record the layer names the contract declares`).toContain(layers.join('`, `'));
  });

  it('takes no screenshot and derives its routes from app/', () => {
    expect(spec, `${SPEC_REL} takes a screenshot`).not.toContain('toHaveScreenshot');
    expect(spec).not.toContain('expectRouteScreenshot');
    expect(spec).toContain("routesOnDisk(join(REPO_ROOT, 'app'))");
  });
});

describe("the Operator's two confirmations are recorded honestly", () => {
  for (const heading of OPERATOR_SECTIONS) {
    const operator = operatorTable(record, heading);

    it(`${heading}: carries the three cells the check is answered in, none blank`, () => {
      const fields = operator.rows.map((row) => row[0]);
      for (const field of FIELDS) {
        expect(fields, `${RECORD_REL} has no "${field}" row under "${heading}"`).toContain(field);
        expect(operator.cell(field), `${RECORD_REL}'s "${field}" cell under "${heading}" is blank`).not.toBe('');
      }
      expect(operator.cell('Method'), `${RECORD_REL} states no method under "${heading}"`).not.toBe('');
    });

    it(`${heading}: is either answered on an ISO date with every cell filled, or outstanding in every cell`, () => {
      if (answered(operator.cell('Checked on'))) {
        for (const field of FIELDS) {
          expect(operator.cell(field), `${RECORD_REL}: "${heading}" is dated and its "${field}" cell still reads outstanding`).not.toContain(OUTSTANDING);
        }
      } else {
        for (const field of FIELDS) {
          expect(
            operator.cell(field),
            `${RECORD_REL}: "${heading}" carries no ISO date in "Checked on", so it is outstanding, and its "${field}" cell reads ` +
              `"${operator.cell(field)}" rather than "${OUTSTANDING}". A variant placeholder cannot count as done, and a ` +
              `half-filled table cannot be told later from a check that was performed`
          ).toBe(OUTSTANDING);
        }
      }
    });
  }

  it('is not marked done on the board while either confirmation is outstanding', () => {
    const key = [...statuses.keys()].find((candidate) => candidate.startsWith('2-26-'));
    expect(key, `${BOARD_REL} no longer carries a 2-26 story key`).toBeDefined();
    const pending = OPERATOR_SECTIONS.filter((heading) => !answered(operatorTable(record, heading).cell('Checked on')));
    if (pending.length > 0) {
      expect(
        statuses.get(key ?? ''),
        `${RECORD_REL} records ${pending.join(' and ')} as not yet performed and the board marks ${key} as done. ` +
          `Both confirmations are acceptance criteria of the story, so either they were done and never written up, or ` +
          `the story closed without them`
      ).not.toBe('done');
    }
  });

  it('reads a dated table as answered, a placeholder table as outstanding, and a variant placeholder as neither', () => {
    expect(answered('**2026-09-20**')).toBe(true);
    expect(answered('2026-09-20')).toBe(true);
    for (const cell of [OUTSTANDING, '_pending_', 'soon', '2026-09', '', 'on 2026-09-20']) {
      expect(answered(cell), `"${cell}" was read as answered`).toBe(false);
    }
    const planted = (cells: [string, string, string]): string =>
      [
        '# A record',
        '',
        "## The Operator's greyscale confirmation",
        '',
        '| Field | Value |',
        '|---|---|',
        '| Method | Look |',
        `| Checked by | ${cells[0]} |`,
        `| Checked on | ${cells[1]} |`,
        `| Result | ${cells[2]} |`,
        '',
      ].join('\n');
    const planted_ = (cells: [string, string, string]) => operatorTable(planted(cells), OPERATOR_SECTIONS[0]);
    expect(answered(planted_([OUTSTANDING, OUTSTANDING, OUTSTANDING]).cell('Checked on'))).toBe(false);
    expect(answered(planted_(['The Operator', '**2026-09-20**', 'Pass']).cell('Checked on'))).toBe(true);
    // A variant placeholder reads as outstanding, and then its cells are not the one placeholder,
    // which is the shape the case above refuses.
    const variant = planted_(['The Operator', '_pending_', OUTSTANDING]);
    expect(answered(variant.cell('Checked on'))).toBe(false);
    expect(FIELDS.every((field) => variant.cell(field) === OUTSTANDING)).toBe(false);
    expect(() => operatorTable('# nothing\n', OPERATOR_SECTIONS[0])).toThrow(/no "## The Operator's greyscale confirmation" section/);
    // And the board parser sees a done story, so the guard above is not vacuous.
    expect(statuses.get('2-25-relocate-list-wheel-onto-a-cuatro-dev-subdomain')).toBe('done');
  });
});

describe('the four manual checks and the readings are recorded', () => {
  it('records each of the four checks with a method, a result and a date', () => {
    const checks = table(section(record, 'The four manual checks'), '#');
    expect(checks.rows.length, `${RECORD_REL} records fewer than four manual checks`).toBe(4);
    for (const row of checks.rows) {
      expect(row[2], `check ${row[0]} states no method`).not.toBe('');
      expect(row[3], `check ${row[0]} states no result`).not.toBe('');
      expect(row[4], `check ${row[0]} carries no dated Observed`).toMatch(/Observed \d{4}-\d{2}-\d{2}/);
    }
  });

  it('states the accent share with its denominator at both viewports, and every finding with an owner', () => {
    const share = table(section(record, 'The accent share'), 'Viewport');
    expect(share.rows.map((row) => row[0])).toEqual(['360 x 800', '1280 x 800']);
    for (const row of share.rows) {
      expect(row[1], `${row[0]} states no accent pixel count`).toMatch(/^\d[\d,]*$/);
      expect(row[2], `${row[0]} states no denominator`).toMatch(/^\d[\d,]*$/);
      expect(row[3], `${row[0]} states no share`).toMatch(/\d+\.\d+%/);
    }
    const findings = table(section(record, 'The findings'), '#');
    expect(findings.rows.length, `${RECORD_REL} records no finding`).toBeGreaterThan(0);
    for (const row of findings.rows) {
      expect(row[0]).toMatch(/^F-\d+$/);
      expect(row[3], `${row[0]} names no owner`).not.toBe('');
    }
  });

  it('records a Lighthouse reading for exactly the URLs the gate collects, in both directions', () => {
    // The parse `ops/__tests__/hit-target-floor.test.ts:675-679` uses, with its own reflow guard,
    // mapped to pathnames.
    const gatedSurfaces = (config: string): string[] => {
      const collectBlock = /collect: \{[\s\S]*?\burl: \[([\s\S]*?)\]/.exec(config)?.[1];
      if (collectBlock === undefined) throw new Error(`${LIGHTHOUSE_REL} has no collect.url array, or it has been reflowed`);
      const urls = [...collectBlock.matchAll(/'(https?:\/\/[^']+)'/g)].map((match) => match[1]);
      const declared = (collectBlock.match(/https?:\/\//g) ?? []).length;
      if (urls.length === 0) throw new Error(`${LIGHTHOUSE_REL}: collect.url is empty, so nothing is audited`);
      if (urls.length !== declared) throw new Error(`${LIGHTHOUSE_REL}: collect.url parsed to ${urls.length} URLs and declares ${declared}`);
      return urls.map((url) => new URL(url).pathname.replace(/\/$/, '') || '/').sort();
    };
    const recordedSurfaces = (markdown: string): string[] =>
      table(section(markdown, 'Lighthouse readings'), 'URL')
        .rows.map((row) => unticked(row[0]))
        .sort();
    const differences = (recorded: readonly string[], gated: readonly string[]): string[] => [
      ...recorded.filter((route) => !gated.includes(route)).map((route) => `${route} has a reading in ${RECORD_REL} and is not in ${LIGHTHOUSE_REL} collect.url`),
      ...gated.filter((route) => !recorded.includes(route)).map((route) => `${route} is in ${LIGHTHOUSE_REL} collect.url and has no reading in ${RECORD_REL}`),
    ];

    const gated = gatedSurfaces(read(LIGHTHOUSE_REL));
    expect(gated, 'the gate no longer collects the home route').toContain('/');
    expect(
      differences(recordedSurfaces(record), gated),
      `${RECORD_REL} § Lighthouse readings and ${LIGHTHOUSE_REL} collect.url name different surfaces. A URL that joins or ` +
        `leaves the gate moves the table in the same commit`
    ).toEqual([]);
    for (const row of table(section(record, 'Lighthouse readings'), 'URL').rows) {
      for (const [index, category] of ['accessibility', 'best practices', 'SEO'].entries()) {
        expect(row[index + 1], `${unticked(row[0])} records no ${category} score`).toMatch(/\d\.\d\d/);
      }
    }

    // The comparison, on planted inputs, in both directions, and the parse refusing what it cannot read.
    const config = (urls: string[]): string => `module.exports = { ci: { collect: { url: [${urls.map((url) => `'${url}'`).join(', ')}], numberOfRuns: 3 } } };`;
    expect(gatedSurfaces(config(['http://localhost:3000', 'http://localhost:3000/work/']))).toEqual(['/', '/work']);
    expect(differences(['/', '/cv', '/work'], ['/', '/work'])).toEqual([`/cv has a reading in ${RECORD_REL} and is not in ${LIGHTHOUSE_REL} collect.url`]);
    expect(differences(['/', '/work'], ['/', '/cv', '/work'])).toEqual([`/cv is in ${LIGHTHOUSE_REL} collect.url and has no reading in ${RECORD_REL}`]);
    expect(differences(['/', '/work'], ['/', '/work'])).toEqual([]);
    expect(() => gatedSurfaces('module.exports = {};')).toThrow(/no collect.url array/);
    expect(() => gatedSurfaces(config([]))).toThrow(/collect.url is empty/);
    expect(() => gatedSurfaces("module.exports = { ci: { collect: { url: ['http://a', \"http://b\"] } } };")).toThrow(/parsed to 1 URLs and declares 2/);
  });
});

describe('the register, the harness record and the story ids', () => {
  const fromRecord = recordRows(record);

  it('registers KV-6 with the index row and the entry naming the same closers and carrying the ledger counts, spelled out', () => {
    const kv6 = indexRow('KV-6');
    expect(kv6, 'the KV-6 index row does not name the rules it breaches').toContain('UX-DR44');
    expect(kv6, 'the KV-6 index row is not Open').toContain('**Open**');
    expect(kv6, 'the KV-6 index row claims a retirement date').toContain('_not retired_');
    const entry = entryOf('KV-6');
    expect(entry.length, 'the KV-6 entry sliced to nothing').toBeGreaterThan(500);
    const heading = entry.split('\n')[0];

    // The closers are read off the ledger rather than restated: every story the rows name is in
    // both the index row and the entry, and no story the rows do not name is in the index row.
    const closers = [...new Set(fromRecord.map((row) => row.closedBy.replace('Story ', '')))].sort();
    expect(closers.length).toBeGreaterThan(0);
    for (const closer of closers) {
      expect(kv6, `the KV-6 index row does not name Story ${closer}, which a ledger row is closed by`).toContain(closer);
      expect(entry, `the KV-6 entry does not name Story ${closer}, which a ledger row is closed by`).toContain(closer);
    }
    const retiredBy = /\| KV-6 \|(?:[^|]*\|){4}([^|]*)\|/.exec(kv6)?.[1] ?? '';
    expect(retiredBy.trim(), 'the KV-6 index row has no "Retired by" cell').not.toBe('');
    const namedInIndex = [...new Set([...retiredBy.matchAll(/\b(\d+-\d+)\b/g)].map((match) => match[1]))].sort();
    expect(namedInIndex, 'the KV-6 index row names a closer no ledger row is closed by, or misses one').toEqual(closers);

    // The counts in the heading and the index row are the ledger's sums per check, spelled out, so
    // a row deleted without the heading moving fails here rather than reading as a stale count.
    const sums = new Map<Check, number>(CHECKS.map((check) => [check, fromRecord.filter((row) => row.check === check).reduce((total, row) => total + row.count, 0)]));
    const phrases: [Check, RegExp][] = [
      ['z-index', new RegExp(`\\b${spelled(sums.get('z-index') ?? 0)} z-index literals?\\b`, 'i')],
      ['depth', new RegExp(`\\b${spelled(sums.get('depth') ?? 0)} depth tells?\\b`, 'i')],
      ['clip', new RegExp(`\\b${spelled(sums.get('clip') ?? 0)} clipped rings?\\b`, 'i')],
      ['weight', new RegExp(`\\b${spelled(sums.get('weight') ?? 0)} synthesised weights?\\b`, 'i')],
      ['heading', new RegExp(`\\b${spelled(sums.get('heading') ?? 0)} routes? with no level-1 heading\\b`, 'i')],
    ];
    for (const [check, phrase] of phrases) {
      expect(heading, `the KV-6 heading does not carry the ledger's ${check} sum (${sums.get(check)}) spelled out: ${heading}`).toMatch(phrase);
      expect(kv6, `the KV-6 index row does not carry the ledger's ${check} sum (${sums.get(check)}) spelled out`).toMatch(phrase);
    }
    expect(spelled(7)).toBe('seven');
    expect(spelled(15)).toBe('fifteen');
    expect(spelled(21)).toBe('twenty-one');
    expect(spelled(30)).toBe('thirty');
    expect(new RegExp(`\\b${spelled(15)} depth tells?\\b`, 'i').test('Seventeen depth tells'), 'a wrong spelled count passed the phrase').toBe(false);

    expect(entry, 'the KV-6 entry does not say where the ledger is tracked mechanically').toContain(SPEC_REL);
    expect(entry).toContain(RECORD_REL);
    expect(entry).toContain(HERE);
  });

  it('is named by the harness record in exactly one row per assertion, all under what the harness asserts', () => {
    const harness = read(HARNESS_RECORD_REL);
    expect(harness, `${HARNESS_RECORD_REL} does not point at ${RECORD_REL}`).toContain(RECORD_REL);
    expect(harness, `${HARNESS_RECORD_REL} does not name the new spec file`).toContain(SPEC_REL);
    const asserts = harness.indexOf('## What the harness asserts');
    const notYet = harness.indexOf('## What it deliberately does not assert');
    expect(asserts).toBeGreaterThan(-1);
    expect(notYet).toBeGreaterThan(-1);
    const marker = `| \`${SPEC_REL}\` |`;
    const rows = harness.split('\n').filter((line) => line.includes(marker));
    expect(rows.length, `${HARNESS_RECORD_REL} carries ${rows.length} rows for ${SPEC_REL}, and six assertions want six`).toBe(6);
    for (const line of rows) {
      const at = harness.indexOf(line);
      expect(at > asserts && at < notYet, `${HARNESS_RECORD_REL} keeps a ${SPEC_REL} row under "what it deliberately does not assert"`).toBe(true);
    }
    // The superseded rows read as superseded, not as still open.
    expect(harness).not.toMatch(/\|\s*Colour contrast ratios\s*\|\s*No token roles to compute them against yet/);
    expect(harness).not.toMatch(/\|\s*Accessibility\s*\|\s*Unchanged and untouched/);
  });

  it('writes story ids hyphenated in the text this story authored', () => {
    const scoped: [string, string][] = [
      [RECORD_REL, record],
      [`${VIOLATIONS_REL} (KV-6)`, entryOf('KV-6')],
    ];
    for (const [where, text] of scoped) {
      expect(text.length, `${where} sliced to nothing`).toBeGreaterThan(500);
      const dotted = [...text.matchAll(/\bStory \d+\.\d+/g)].map((match) => match[0]);
      expect(dotted, `${where} writes a story id dotted, which a search for the hyphenated form misses`).toEqual([]);
    }
    expect([...'closed by Story 2.15 and Story 2-30'.matchAll(/\bStory \d+\.\d+/g)].map((m) => m[0])).toEqual(['Story 2.15']);
  });
});
