// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { section, table, unticked } from '../contract-adoption.mjs';

/**
 * The Story 2-10 record, `ops/status-mark-axes.md`, held equal to the spec file it describes.
 *
 * **Both directions, because either file alone would rot.** A case in the record with no case in
 * the spec is coverage someone believes exists and does not; a case in the spec with no row in the
 * record is evidence nobody can find. Neither is visible from inside the file that has it, and the
 * Playwright suite cannot check the record because it never reads it. So the agreement is asserted
 * here, under the blocking `test` job, in the shape `ops/__tests__/hit-target-floor.test.ts` uses
 * for the floor's ledger.
 *
 * The markdown parsers are `ops/contract-adoption.mjs`'s, reused rather than rewritten: they
 * already refuse a heading that appears twice, a table whose rows do not match its header, and a
 * separator row a formatter has restyled. Every parser and every comparison below is shown firing
 * on a planted control before any agreement is read as good news, and the parser that reads the
 * TypeScript source cross-checks its own count against an independently derived one, so a reflow
 * cannot present itself as a missing case.
 *
 * This suite never opens a browser. What the marks measure is the Playwright suite's question;
 * this one is about whether the two written descriptions of that measurement say the same thing.
 */

const REPO_ROOT = process.cwd();
const HERE = 'ops/__tests__/status-mark-axes.test.ts';

const RECORD_REL = 'ops/status-mark-axes.md';
const SPEC_REL = 'tests/e2e/status-mark.pw.ts';
const SCHEMA_REL = 'contracts/registry.schema.json';
const HARNESS_RECORD_REL = 'ops/rendered-output-harness.md';
const COMPONENT_SPEC_REL = 'components/organisms/SuiteDirectory/__tests__/SuiteDirectory.test.tsx';

/**
 * Read a tracked file, with line endings normalised to `\n`.
 *
 * `core.autocrlf` is true on the authoring machine and `.gitattributes` deliberately covers only
 * the formats that leave the repository, so a Windows checkout holds `.ts` and `.md` with CRLF.
 * Every anchor below is a `\n`, and without this the suite fails at collection in a way that reads
 * as a deleted section rather than as a checkout property. Same fix and same reason as
 * `ops/__tests__/hit-target-floor.test.ts:54-60`.
 */
const read = (relative: string): string => {
  try {
    return readFileSync(resolve(REPO_ROOT, relative), 'utf8').replace(/\r\n/g, '\n');
  } catch (error) {
    throw new Error(`${HERE}: ${relative} could not be read: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const record = read(RECORD_REL);
const spec = read(SPEC_REL);

/**
 * Every `test('...')` title in a Playwright spec, in file order.
 *
 * `test.describe(` cannot match, the pattern requiring the open paren immediately after `test`.
 * The count is cross-checked by the caller against an independently derived one.
 */
const specCases = (source: string): string[] => [...source.matchAll(/^\s*test\('([^']+)'/gm)].map((match) => match[1]);

/** How many `test(` calls the file makes, counted without reading a single title. */
const specCaseCount = (source: string): number => [...source.matchAll(/^\s*test\(/gm)].length;

/**
 * Source with comments removed, so a scan reads what the file does rather than what it says about
 * what it does. A spec that argues at length against an approach names that approach in prose.
 */
const executable = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** The `Case` column of the record's failure table. */
const recordCases = (markdown: string): string[] =>
  table(section(markdown, 'Failing loudly rather than vacuously'), 'Case').rows.map((row) => unticked(row[0]));

/** The `Status`, `Border style` and `Border width` columns of the record's per-value table. */
const recordBorders = (markdown: string): { status: string; borderStyle: string; borderWidth: string }[] => {
  const { headers, rows } = table(section(markdown, 'The four values, measured'), 'Status');
  const at = (name: string): number => {
    const index = headers.indexOf(name);
    if (index === -1) throw new Error(`the per-value table has no "${name}" column`);
    return index;
  };
  const style = at('Border style');
  const width = at('Border width');
  return rows.map((row) => ({
    status: unticked(row[0]),
    // The record bolds the cells carrying an axis, and `**dashed**` and `dashed` are the same fact.
    borderStyle: unticked(row[style]).replace(/\*/g, '').trim(),
    borderWidth: unticked(row[width]).replace(/\*/g, '').trim(),
  }));
};

/** The `Status` column alone. */
const recordStatuses = (markdown: string): string[] => recordBorders(markdown).map((row) => row.status);

/**
 * The `EXPECTED` literal in the spec, parsed as text.
 *
 * The same technique `ops/__tests__/hit-target-floor.test.ts` uses on `EXEMPTIONS` and `SURFACES`,
 * and for the same reason: the record and the spec each describe the border treatment, and neither
 * can see the other. The row count is cross-checked against an independently derived one, so a
 * reflow cannot present itself as a missing value.
 */
const specBorders = (source: string): { status: string; borderStyle: string; borderWidth: string }[] => {
  const literal = /const EXPECTED = \[\n([\s\S]*?)\n\] as const;/.exec(source)?.[1];
  if (literal === undefined) {
    throw new Error(`${SPEC_REL}: no "const EXPECTED = [" literal was found to read the border treatment from`);
  }

  const rows = [...literal.matchAll(/\{ status: '([^']+)', borderStyle: '([^']+)', borderWidth: '([^']+)' \}/g)].map(
    (match) => ({ status: match[1], borderStyle: match[2], borderWidth: match[3] })
  );
  const declared = literal.split('\n').filter((line) => line.trim().startsWith('{')).length;

  if (rows.length === 0) throw new Error(`${SPEC_REL}: the EXPECTED literal parsed to zero rows`);
  if (rows.length !== declared) {
    throw new Error(`${SPEC_REL}: the EXPECTED literal parsed to ${rows.length} rows and declares ${declared}`);
  }

  return rows;
};

describe('the record and the spec file describe the same cases', () => {
  const fromRecord = recordCases(record);
  const fromSpec = specCases(spec);

  it('parses both sides to a non-empty list, so no agreement below is vacuous', () => {
    expect(fromRecord.length, `${RECORD_REL} parsed to no cases`).toBeGreaterThan(0);
    expect(fromSpec.length, `${SPEC_REL} parsed to no cases`).toBeGreaterThan(0);

    // The cross-check. A title written across two lines, or quoted with backticks, would parse to
    // fewer cases than the file declares, and without this that presents itself as a case the
    // record invented rather than as a parser that stopped reading.
    expect(
      fromSpec.length,
      `${SPEC_REL} makes ${specCaseCount(spec)} test() calls and ${fromSpec.length} titles parsed, so a ` +
        `title is written in a shape this parser does not read`
    ).toBe(specCaseCount(spec));
  });

  it('names no case the spec does not run', () => {
    for (const name of fromRecord) {
      expect(
        fromSpec,
        `${RECORD_REL} records "${name}" and ${SPEC_REL} runs no case by that name, so the record ` +
          `claims evidence nobody can find`
      ).toContain(name);
    }
  });

  it('records every case the spec runs', () => {
    for (const name of fromSpec) {
      expect(
        fromRecord,
        `${SPEC_REL} runs "${name}" and ${RECORD_REL} has no row for it, so an assertion exists that ` +
          `the record cannot account for`
      ).toContain(name);
    }
  });

  it('lists them once each, in the order the spec runs them', () => {
    // Order, because the record reads as a walk through the suite and a reordered table is a
    // reader following a sequence that is not the one the runner takes.
    expect(new Set(fromRecord).size, `${RECORD_REL} repeats a case`).toBe(fromRecord.length);
    expect(fromRecord).toEqual(fromSpec);
  });

  it('refuses a record or a spec it could not read', () => {
    // The parsers, on planted controls, so an agreement is never the result of two empty lists.
    expect(() => recordCases('# nothing\n')).toThrow(/no "## Failing loudly rather than vacuously" section/);
    expect(() => recordCases('## Failing loudly rather than vacuously\n\n| Other |\n|---|\n| x |\n')).toThrow(
      /no table whose header begins with "Case"/
    );
    expect(specCases("const x = 1;\ntest.describe('not a case', () => {});")).toEqual([]);
    expect(specCases("  test('a case', async ({ page }) => {")).toEqual(['a case']);
  });
});

describe('the record describes the taxonomy the contract declares', () => {
  it('lists exactly the four values the schema enumerates, in schema order', () => {
    // The record's per-value table is the only place the four values are written down in prose.
    // The spec file reads them out of the schema at run time, so this is what stops the two
    // drifting: a fifth status added to `contracts/registry.schema.json` fails here.
    const schema = JSON.parse(read(SCHEMA_REL)) as Record<string, unknown>;
    const at = (node: unknown, key: string): unknown =>
      typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[key] : undefined;

    let entry = at(at(at(schema, 'properties'), 'applications'), 'items');
    const ref = at(entry, '$ref');
    if (typeof ref === 'string') {
      entry = ref
        .slice(2)
        .split('/')
        .reduce<unknown>((node, segment) => at(node, segment), schema);
    }
    const values = at(at(at(entry, 'properties'), 'status'), 'enum');

    expect(Array.isArray(values), `${SCHEMA_REL}: the applications[].status enum could not be read`).toBe(true);
    expect((values as string[]).length, `${SCHEMA_REL} enumerates no Status values`).toBeGreaterThan(0);
    expect(recordStatuses(record), `${RECORD_REL} does not describe the values the schema declares`).toEqual(values);
  });

  it('states the same border treatment the spec asserts, value by value', () => {
    // **The half a title comparison cannot reach.** Without this, changing `In progress` from
    // `dashed` to `dotted` in the stylesheet and in the spec's EXPECTED literal leaves every suite
    // green while the record goes on saying `dashed`, and `ops/rendered-output-harness.md` sends
    // readers to the record for exactly these values.
    expect(recordBorders(record), `${RECORD_REL} and ${SPEC_REL} disagree about the border treatment`).toEqual(
      specBorders(spec)
    );
  });

  it('refuses a record or a literal it could not read', () => {
    // Both parsers on planted controls, so an agreement is never two empty lists, and a reflow
    // never presents itself as a missing value.
    expect(() => specBorders('const OTHER = [];')).toThrow(/no "const EXPECTED = \[" literal/);
    expect(() => specBorders('const EXPECTED = [\n\n] as const;')).toThrow(/parsed to zero rows/);

    const good = "  { status: 'Live', borderStyle: 'solid', borderWidth: '1px' },";
    const shuffled = "  { borderStyle: 'solid', status: 'Complete', borderWidth: '1px' },";
    expect(() => specBorders(`const EXPECTED = [\n${good}\n${good}\n${shuffled}\n] as const;`)).toThrow(
      /parsed to 2 rows and declares 3/
    );
    expect(() => recordBorders('## The four values, measured\n\n| Status |\n|---|\n| `Live` |\n')).toThrow(
      /no "Border style" column/
    );
  });

  it('reads those values from the schema in the spec rather than writing them down', () => {
    // `executable` throughout: the spec argues in prose for reading the schema, so a scan over the
    // raw text is satisfied by the argument surviving after the code implementing it was deleted.
    expect(executable(spec), `${SPEC_REL} no longer reads the taxonomy from ${SCHEMA_REL}`).toContain(SCHEMA_REL);
    expect(executable(spec), `${SPEC_REL} no longer derives its Status values`).toContain(
      'const STATUSES = schemaStatuses()'
    );
  });
});

describe('the assertion is scoped the way the record says', () => {
  it('takes no screenshot, so it writes no snapshot directory', () => {
    // `tests/e2e/rendered-output.pw.ts` asserts its own snapshot directory holds exactly one
    // committed PNG. A screenshot taken here would create a second directory rather than break
    // that case, which is why this is asserted where the temptation is.
    expect(spec, `${SPEC_REL} takes a screenshot`).not.toContain('toHaveScreenshot');
    expect(spec, `${SPEC_REL} takes a screenshot`).not.toContain('expectRouteScreenshot');
  });

  it('reads the greyscale distance rather than pinning the figure', () => {
    // The record states this as a decision: a pinned ratio fails on every token movement, and the
    // claim is that the distance is under 3:1, not that it is any particular number.
    expect(executable(spec), `${SPEC_REL} no longer measures the greyscale distance at all`).toContain(
      'toBeLessThan(3)'
    );
    expect(
      record,
      `${RECORD_REL} no longer records that the bound is asserted rather than the figure`
    ).toContain('asserts the bound, not the figure');
  });

  it('measures greyscale in print rather than through a filter, which would read nothing', () => {
    expect(executable(spec), `${SPEC_REL} no longer emulates the print medium`).toContain(
      "emulateMedia({ media: 'print' })"
    );

    // **Comments first.** The spec file explains at length why a grayscale filter is the wrong
    // instrument, so a scan over the raw text finds the phrase inside the prose that rejects it and
    // reads the rejection as the defect. What is left after stripping is the code.
    expect(
      executable(spec),
      `${SPEC_REL} applies a grayscale filter, which getComputedStyle cannot see: a filter is a ` +
        `paint-time operation and every colour reads back exactly as it did before`
    ).not.toContain('grayscale');

    // The stripper, on planted controls, so an empty result is a measurement rather than a regex
    // that eats the whole file.
    expect(executable('/* grayscale(1) */\nconst a = 1;'), 'a block comment survives the strip').toContain('const a');
    expect(executable('/* grayscale(1) */\nconst a = 1;')).not.toContain('grayscale');
    expect(executable('// grayscale(1)\nconst a = 1;')).not.toContain('grayscale');
    expect(executable("plantStyle(page, '.x { filter: grayscale(1); }');"), 'the scan no longer fires on real code').toContain(
      'grayscale'
    );
  });

  it('leaves the dot rule where a browser cannot fabricate it', () => {
    // Which values emit a dot is markup, and asserting it in the browser would mean the spec
    // inventing a dot for the values that never render. This is the other half of the axis, and
    // the record's axis-one row points here for it, so its absence has to fail somewhere.
    const component = executable(read(COMPONENT_SPEC_REL));
    expect(component, `${COMPONENT_SPEC_REL} no longer asserts which values draw a dot`).toContain(
      'draws no dot for %s'
    );
    expect(component, `${COMPONENT_SPEC_REL} no longer asserts the dot on Live`).toContain('draws the dot for Live');
    expect(
      record,
      `${RECORD_REL} no longer points at ${COMPONENT_SPEC_REL} for the half of axis one a browser cannot see`
    ).toContain(COMPONENT_SPEC_REL);
  });

  it('is named by the harness record, under what the harness asserts', () => {
    const harness = read(HARNESS_RECORD_REL);

    expect(harness, `${HARNESS_RECORD_REL} does not point at ${RECORD_REL}`).toContain(RECORD_REL);
    expect(harness, `${HARNESS_RECORD_REL} does not name the new spec file`).toContain(SPEC_REL);

    // The row has to sit under the heading that says what is asserted, not under the one that says
    // what is not. A reader scanning for coverage reads the heading before the cell. Same rule and
    // same shape as `ops/__tests__/hit-target-floor.test.ts:664-677`.
    const asserts = harness.indexOf('## What the harness asserts');
    const notYet = harness.indexOf('## What it deliberately does not assert');
    const marker = "| The Status mark's three structural axes";
    const row = harness.indexOf(marker);
    expect(asserts, `${HARNESS_RECORD_REL} has no "What the harness asserts" heading`).toBeGreaterThan(-1);
    expect(notYet, `${HARNESS_RECORD_REL} has no "What it deliberately does not assert" heading`).toBeGreaterThan(-1);
    expect(notYet, `${HARNESS_RECORD_REL} puts "does not assert" before "asserts"`).toBeGreaterThan(asserts);
    expect(row, `${HARNESS_RECORD_REL} no longer carries a Status mark row`).toBeGreaterThan(-1);

    // **Exactly one row, because `indexOf` finds the first.** Without this a stale row could be
    // re-added under "does not assert" and coexist with the live one, and the position check would
    // go on reading the live one and passing. This is the negative guard
    // `ops/__tests__/hit-target-floor.test.ts:656-660` pairs with its own placement check.
    expect(
      harness.split(marker).length - 1,
      `${HARNESS_RECORD_REL} carries more than one Status mark row, so one of them is stale and a ` +
        `reader can find the axes under either heading`
    ).toBe(1);
    expect(
      row > asserts && row < notYet,
      `${HARNESS_RECORD_REL} keeps the Status mark row under "what it deliberately does not assert", ` +
        `where a reader scanning for coverage finds the axes under the heading saying they are not covered`
    ).toBe(true);
  });
});

describe("the operator's greyscale check is recorded honestly", () => {
  const operator = table(section(record, 'The greyscale check O-9 asks a person for'), 'Field');

  it('carries the three cells the check is answered in', () => {
    const fields = operator.rows.map((row) => row[0]);
    for (const field of ['Checked by', 'Checked on', 'Result']) {
      expect(fields, `${RECORD_REL} has no "${field}" row, so the check has nowhere to land`).toContain(field);
    }
  });

  const cell = (field: string): string => operator.rows.find((row) => row[0] === field)?.[1] ?? '';
  const FIELDS = ['Checked by', 'Checked on', 'Result'] as const;

  it('leaves no cell blank, a blank being indistinguishable from an answer', () => {
    // Emptying all three would otherwise satisfy the consistency check below, every cell being
    // equally not-outstanding, and the record would read as a check that was performed and had
    // nothing to say.
    for (const field of FIELDS) {
      expect(cell(field), `${RECORD_REL}'s "${field}" cell is blank`).not.toBe('');
    }
  });

  it('is either wholly answered or wholly outstanding, never half of each', () => {
    // A record with a date and no result, or a result and no name, is the shape a half-performed
    // check leaves behind and is indistinguishable later from one that was done properly. O-9 is
    // the human half of AD-19 and it is worth exactly as much as its record.
    const outstanding = FIELDS.map((field) => cell(field).includes('_not yet performed_'));

    expect(
      new Set(outstanding).size,
      `${RECORD_REL} answers some of the O-9 check's cells and leaves others at "not yet performed". ` +
        `A partly filled record cannot be told later from a check that was done properly`
    ).toBe(1);
  });

  it('is not marked done on the board while the check is outstanding', () => {
    // The one drift neither file can see from the inside. O-9 is an acceptance criterion of this
    // story, and a story reaching `done` with its human half unperformed looks identical, from
    // inside either file, to one where the check was done and simply not written up. Same shape as
    // `ops/__tests__/hit-target-floor.test.ts:552-573`, which holds an exemption row against its
    // closing story's status.
    const board = read('_bmad-output/implementation-artifacts/sprint-status.yaml');
    const status = /^ {2}(2-10-[a-z0-9-]*): *([a-z-]+)\s*$/m.exec(board);

    expect(status, 'sprint-status.yaml no longer carries a 2-10 story key').not.toBeNull();

    if (FIELDS.some((field) => cell(field).includes('_not yet performed_'))) {
      expect(
        status?.[2],
        `${RECORD_REL} records the O-9 greyscale check as not yet performed and the board marks ` +
          `${status?.[1]} as done. That check is an acceptance criterion of the story, so either it ` +
          `was done and never written up, or the story closed without it`
      ).not.toBe('done');
    }
  });
});
