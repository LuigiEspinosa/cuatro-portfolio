// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { section, table, unticked } from '../contract-adoption.mjs';

/**
 * The Story 2-8 record, `ops/hit-target-floor.md`, held equal to the two tables the assertion
 * actually applies: `EXEMPTIONS` and `SURFACES` in `tests/e2e/hit-target-floor.pw.ts`.
 *
 * **Both directions, because either file alone would rot.** A row in the record with no entry in
 * the ledger is a surface someone believes is tracked and is not; an entry in the ledger with no
 * row in the record is a breach the register cannot see. Neither is visible from inside the file
 * that has it, and the Playwright suite cannot check the record because it never reads it. So the
 * agreement is asserted here, under the blocking `test` job, in the shape
 * `ops/__tests__/contract-adoption.test.ts` uses for the Anchor's automation cell.
 *
 * The markdown parsers are `ops/contract-adoption.mjs`'s, reused rather than rewritten: they
 * already refuse a heading that appears twice, a table whose rows do not match its header, and a
 * separator row a formatter has restyled. Every parser and every comparison below is shown firing
 * on a planted control before any agreement is read as good news, and every parser that reads the
 * TypeScript source cross-checks its own row count against an independently derived one, so a
 * reflow cannot present itself as a missing row.
 *
 * This suite never opens a browser. What a box measures is the Playwright suite's question; this
 * one is about whether the two written descriptions of the ledger say the same thing.
 */

const REPO_ROOT = process.cwd();
const HERE = 'ops/__tests__/hit-target-floor.test.ts';

const RECORD_REL = 'ops/hit-target-floor.md';
const SPEC_REL = 'tests/e2e/hit-target-floor.pw.ts';
const BOARD_REL = '_bmad-output/implementation-artifacts/sprint-status.yaml';
const LIGHTHOUSE_REL = '.lighthouserc.js';
const HARNESS_RECORD_REL = 'ops/rendered-output-harness.md';
const VIOLATIONS_REL = 'ops/known-violations.md';

const read = (relative: string): string => {
  try {
    return readFileSync(resolve(REPO_ROOT, relative), 'utf8');
  } catch (error) {
    throw new Error(`${HERE}: ${relative} could not be read: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const record = read(RECORD_REL);
const spec = read(SPEC_REL);
const board = read(BOARD_REL);
const violations = read(VIOLATIONS_REL);

/**
 * The one shape an exemption's `source` may take, **read out of the spec file rather than
 * declared here**.
 *
 * Two shapes that disagree turn an exemption authored under `app/` into an agreement failure that
 * has nothing to do with agreement, which is what a `^components/` check here and a
 * `^[\w/.-]+\.tsx:` check there produced. The spec states it once; this reads it back.
 */
const sourceShape = (source: string): RegExp => {
  const literal = /const SOURCE_SHAPE = \/(.+)\/;/.exec(source)?.[1];
  if (literal === undefined) {
    throw new Error(`${SPEC_REL}: no "const SOURCE_SHAPE = /.../;" literal was found to read the source shape from`);
  }
  return new RegExp(literal);
};

const SOURCE_SHAPE = sourceShape(spec);

/** The 404 stand-in path, read from the spec so the two files cannot disagree about it. */
const notFoundPath = (source: string): string => {
  const literal = /const NOT_FOUND = '([^']*)'/.exec(source)?.[1];
  if (literal === undefined) throw new Error(`${SPEC_REL}: no "const NOT_FOUND" literal was found`);
  return literal;
};

const NOT_FOUND = notFoundPath(spec);

/** One ledger row, in whichever of the two files it was read from. */
interface Row {
  id: string;
  selector: string;
  source: string;
  routes: string[];
  covers: number;
  measured: string;
  closedBy: string;
}

/** One swept surface, in whichever of the two files it was read from. */
interface Surface {
  route: string;
  status: number;
  found: number;
  skipped: number;
  measured: number;
}

/** The exemption table in the record. */
const recordRows = (markdown: string): Row[] => {
  const { rows } = table(section(markdown, 'The exemption ledger'), 'Id');

  if (rows.length === 0) {
    throw new Error(`${RECORD_REL}: the exemption table has zero rows, so there is nothing to compare`);
  }

  return rows.map((cells: string[]) => ({
    id: unticked(cells[0]),
    selector: unticked(cells[1]),
    source: unticked(cells[2]),
    routes: cells[3]
      .split(',')
      .map((route: string) => unticked(route))
      .filter((route: string) => route !== ''),
    covers: Number(cells[4].trim()),
    measured: cells[5].trim(),
    closedBy: cells[6].trim(),
  }));
};

/** The surfaces table in the record. */
const recordSurfaces = (markdown: string): Surface[] => {
  const { rows } = table(section(markdown, 'The surfaces swept'), 'Surface');

  if (rows.length === 0) {
    throw new Error(`${RECORD_REL}: the surfaces table has zero rows, so there is nothing to compare`);
  }

  return rows.map((cells: string[]) => ({
    route: unticked(cells[0]),
    status: Number(cells[1].trim()),
    found: Number(cells[2].trim()),
    skipped: Number(cells[3].trim()),
    measured: Number(cells[4].trim()),
  }));
};

/**
 * The `EXEMPTIONS` const in the Playwright spec, read as text.
 *
 * Text rather than an import: the spec file imports `@playwright/test`, which `vitest.config.ts`
 * deliberately keeps out of the unit run, and `tests/e2e/**` is excluded from collection by two
 * independent guards. Reading the literal is the same method `ops/contract-adoption.mjs` uses on a
 * Markdown record.
 *
 * **The object count is cross-checked against an independently derived one.** The object regex
 * depends on the file's indentation and its trailing commas, so a reflow would return one row
 * fewer and surface as "a row is missing from the ledger", the exact opposite of the truth. The
 * count of `id:` fields is derived without either dependency, and a mismatch is reported as a
 * parse failure rather than as a disagreement.
 */
const specRows = (source: string): Row[] => {
  const block = /const EXEMPTIONS: readonly Exemption\[\] = \[\n([\s\S]*?)\n\];/.exec(source)?.[1];

  if (block === undefined) {
    throw new Error(`${SPEC_REL}: no "const EXEMPTIONS: readonly Exemption[] = [" literal was found`);
  }

  const objects = [...block.matchAll(/\{\n([\s\S]*?)\n {2}\},/g)].map((match) => match[1]);
  const declared = [...block.matchAll(/^\s*id: '/gm)].length;

  if (objects.length === 0) {
    throw new Error(`${SPEC_REL}: the EXEMPTIONS literal parsed to zero rows, so there is nothing to compare`);
  }

  if (objects.length !== declared) {
    throw new Error(
      `${SPEC_REL}: the EXEMPTIONS literal parsed to ${objects.length} rows and declares ${declared} ` +
        `ids. The object parser depends on two-space indentation and a trailing comma on every ` +
        `entry, so this is a reflow rather than a missing row. Restore the shape or widen the parser.`
    );
  }

  return objects.map((body) => {
    const field = (name: string): string => {
      const found = new RegExp(`\\b${name}: '([^']*)'`).exec(body)?.[1];
      if (found === undefined) {
        throw new Error(`${SPEC_REL}: an EXEMPTIONS entry carries no "${name}" field:\n${body}`);
      }
      return found;
    };

    const routes = /\broutes: \[([^\]]*)\]/.exec(body)?.[1];
    if (routes === undefined) {
      throw new Error(`${SPEC_REL}: an EXEMPTIONS entry carries no "routes" field:\n${body}`);
    }

    const covers = /\bcovers: (\d+),/.exec(body)?.[1];
    if (covers === undefined) {
      throw new Error(`${SPEC_REL}: an EXEMPTIONS entry carries no "covers" field:\n${body}`);
    }

    return {
      id: field('id'),
      selector: field('selector'),
      source: field('source'),
      routes: routes
        .split(',')
        .map((route) => route.trim().replace(/^'|'$/g, ''))
        .filter((route) => route !== ''),
      covers: Number(covers),
      measured: field('measured'),
      closedBy: field('closedBy'),
    };
  });
};

/** The `SURFACES` const in the Playwright spec, with the same cross-check. */
const specSurfaces = (source: string): Surface[] => {
  const block = /const SURFACES = \[\n([\s\S]*?)\n\] as const;/.exec(source)?.[1];

  if (block === undefined) {
    throw new Error(`${SPEC_REL}: no "const SURFACES = [" literal was found`);
  }

  const entries = [
    ...block.matchAll(
      /\{ route: (?:'([^']*)'|(NOT_FOUND)), status: (\d+), entrance: (?:true|false), found: (\d+), skipped: (\d+), measured: (\d+) \},/g
    ),
  ];
  const declared = [...block.matchAll(/^\s*\{ route: /gm)].length;

  if (entries.length === 0) {
    throw new Error(`${SPEC_REL}: the SURFACES literal parsed to zero rows, so there is nothing to compare`);
  }

  if (entries.length !== declared) {
    throw new Error(
      `${SPEC_REL}: the SURFACES literal parsed to ${entries.length} rows and declares ${declared}. ` +
        `The parser expects one surface per line in a fixed field order, so this is a reflow rather ` +
        `than a missing surface.`
    );
  }

  return entries.map((match) => ({
    route: match[1] ?? NOT_FOUND,
    status: Number(match[3]),
    found: Number(match[4]),
    skipped: Number(match[5]),
    measured: Number(match[6]),
  }));
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

    for (const field of ['selector', 'source', 'measured', 'closedBy'] as const) {
      if (left[field] !== right[field]) {
        found.push(`"${id}": ${RECORD_REL} says ${field} "${left[field]}", ${SPEC_REL} says "${right[field]}"`);
      }
    }

    if (left.covers !== right.covers) {
      found.push(`"${id}": ${RECORD_REL} says covers ${left.covers}, ${SPEC_REL} says ${right.covers}`);
    }

    if (left.routes.join(', ') !== right.routes.join(', ')) {
      found.push(
        `"${id}": ${RECORD_REL} lists routes ${left.routes.join(', ')}, ${SPEC_REL} lists ${right.routes.join(', ')}`
      );
    }
  }

  return found;
};

/** Every way the two surface tables differ, named in both directions and in route order. */
const surfaceDisagreements = (fromRecord: readonly Surface[], fromSpec: readonly Surface[]): string[] => {
  const found: string[] = [];
  const recorded = new Map(fromRecord.map((row) => [row.route, row]));
  const listed = new Map(fromSpec.map((row) => [row.route, row]));

  for (const route of [...new Set([...recorded.keys(), ...listed.keys()])].sort()) {
    const left = recorded.get(route);
    const right = listed.get(route);

    if (!left) {
      found.push(`${route} is swept by ${SPEC_REL} and has no row in ${RECORD_REL}`);
      continue;
    }
    if (!right) {
      found.push(`${route} is in ${RECORD_REL} and is not swept by ${SPEC_REL}`);
      continue;
    }

    for (const field of ['status', 'found', 'skipped', 'measured'] as const) {
      if (left[field] !== right[field]) {
        found.push(`${route}: ${RECORD_REL} says ${field} ${left[field]}, ${SPEC_REL} says ${right[field]}`);
      }
    }
  }

  return found;
};

/** One planted table row per id, all seven cells filled the way the record fills them. */
const plantedRows = (ids: readonly string[]): string[][] =>
  ids.map((id) => [
    `\`${id}\``,
    '`nav.navbar a`',
    '`components/atoms/Navbar/Navbar.tsx:6`',
    '`/work`',
    '6',
    '22.00 x 22.00',
    'Story 2-15',
  ]);

/** A record fragment carrying the ledger section, in the record's own shape, for planted controls. */
const fragment = (rows: string[][] = plantedRows(['chrome-nav'])): string =>
  [
    '# A record',
    '',
    '## The exemption ledger',
    '',
    '| Id | Selector | Source | Routes | Covers | Measured (2026-09-06) | Closed by |',
    '|---|---|---|---|---|---|---|',
    ...rows.map((row) => `| ${row.join(' | ')} |`),
    '',
    '## Something else',
    '',
  ].join('\n');

/** A spec fragment carrying the literal, in the spec's own shape, for planted controls. */
const literal = (entries: string[] = ['chrome-nav']): string =>
  [
    'const EXEMPTIONS: readonly Exemption[] = [',
    ...entries.map((id) =>
      [
        '  {',
        `    id: '${id}',`,
        "    selector: 'nav.navbar a',",
        "    source: 'components/atoms/Navbar/Navbar.tsx:6',",
        "    routes: ['/work'],",
        '    covers: 6,',
        "    measured: '22.00 x 22.00',",
        "    closedBy: 'Story 2-15',",
        '  },',
      ].join('\n')
    ),
    '];',
  ].join('\n');

describe('the record and the exemption ledger agree in both directions', () => {
  const fromRecord = recordRows(record);
  const fromSpec = specRows(spec);

  it('parses a real table and a real literal, so the comparison below is not over nothing', () => {
    expect(fromRecord.length, `${RECORD_REL} exempts nothing`).toBeGreaterThan(0);
    expect(fromSpec.length, `${SPEC_REL} exempts nothing`).toBeGreaterThan(0);
    expect(fromRecord.map((row) => row.id)).toContain('chrome-nav');
    expect(fromSpec.map((row) => row.id)).toContain('chrome-nav');
    for (const row of fromSpec) {
      expect(Number.isInteger(row.covers), `"${row.id}" parsed a non-integer covers`).toBe(true);
      expect(row.covers, `"${row.id}" covers nothing`).toBeGreaterThan(0);
    }
  });

  it('names no difference in either direction', () => {
    expect(
      disagreements(fromRecord, fromSpec),
      `${RECORD_REL} and ${SPEC_REL} describe different ledgers. A story that repairs a surface ` +
        `deletes its row in both, in the same commit, or the record stops describing what the ` +
        `build enforces`
    ).toEqual([]);
  });

  it('fails in whichever direction is short, on planted controls', () => {
    const two = ['chrome-nav', 'error-back'];
    const one = ['chrome-nav'];

    // A row in the record with no entry in the ledger.
    expect(disagreements(recordRows(fragment(plantedRows(two))), specRows(literal(one)))).toEqual([
      '"error-back" is in ops/hit-target-floor.md and has no entry in tests/e2e/hit-target-floor.pw.ts',
    ]);

    // An entry in the ledger with no row in the record.
    expect(disagreements(recordRows(fragment(plantedRows(one))), specRows(literal(two)))).toEqual([
      '"error-back" is in tests/e2e/hit-target-floor.pw.ts and has no row in ops/hit-target-floor.md',
    ]);

    // Agreeing lists report nothing, so the two above are differences rather than noise.
    expect(disagreements(recordRows(fragment(plantedRows(two))), specRows(literal(two)))).toEqual([]);

    // A repeated id is reported rather than silently collapsing two rows into one.
    expect(disagreements(recordRows(fragment(plantedRows(['chrome-nav', 'chrome-nav']))), specRows(literal(one)))).toContain(
      'ops/hit-target-floor.md carries a repeated id'
    );
  });

  it('fails on a field edited in only one place, naming the field and both values', () => {
    const edited = fragment([
      ['`chrome-nav`', '`nav.navbar a`', '`components/atoms/Navbar/Navbar.tsx:6`', '`/work`', '6', '99.00 x 99.00', 'Story 2-99'],
    ]);
    expect(disagreements(recordRows(edited), specRows(literal()))).toEqual([
      '"chrome-nav": ops/hit-target-floor.md says measured "99.00 x 99.00", tests/e2e/hit-target-floor.pw.ts says "22.00 x 22.00"',
      '"chrome-nav": ops/hit-target-floor.md says closedBy "Story 2-99", tests/e2e/hit-target-floor.pw.ts says "Story 2-15"',
    ]);

    const recovered = fragment([
      ['`chrome-nav`', '`nav.navbar a`', '`components/atoms/Navbar/Navbar.tsx:6`', '`/work`', '7', '22.00 x 22.00', 'Story 2-15'],
    ]);
    expect(disagreements(recordRows(recovered), specRows(literal()))).toEqual([
      '"chrome-nav": ops/hit-target-floor.md says covers 7, tests/e2e/hit-target-floor.pw.ts says 6',
    ]);

    const rerouted = fragment([
      ['`chrome-nav`', '`nav.navbar a`', '`components/atoms/Navbar/Navbar.tsx:6`', '`/work`, `/projects`', '6', '22.00 x 22.00', 'Story 2-15'],
    ]);
    expect(disagreements(recordRows(rerouted), specRows(literal()))).toEqual([
      '"chrome-nav": ops/hit-target-floor.md lists routes /work, /projects, tests/e2e/hit-target-floor.pw.ts lists /work',
    ]);
  });

  it('refuses a record or a literal it could not read, rather than comparing a short list', () => {
    expect(() => recordRows('# nothing\n')).toThrow(/no "## The exemption ledger" section/);
    expect(() => recordRows(fragment([]))).toThrow(/zero rows/);
    expect(() => recordRows(`${fragment()}\n## The exemption ledger\n`)).toThrow(/2 "## The exemption ledger" sections/);

    expect(() => specRows('const OTHER = [];')).toThrow(/no "const EXEMPTIONS/);
    expect(() => specRows('const EXEMPTIONS: readonly Exemption[] = [\n\n];')).toThrow(/parsed to zero rows/);
    expect(() => specRows(literal().replace("    closedBy: 'Story 2-15',\n", ''))).toThrow(/carries no "closedBy" field/);
    expect(() => specRows(literal().replace("    routes: ['/work'],\n", ''))).toThrow(/carries no "routes" field/);
    expect(() => specRows(literal().replace('    covers: 6,\n', ''))).toThrow(/carries no "covers" field/);

    // The reflow guard. A four-space indent on the closing brace makes the object regex miss the
    // entry, and without this cross-check that presents itself as a missing row.
    const reflowed = literal(['chrome-nav', 'error-back']).replace('  },\n  {', '    },\n    {');
    expect(() => specRows(reflowed)).toThrow(/is a reflow rather than a missing row/);
  });
});

describe('the record and the swept surfaces agree in both directions', () => {
  const fromRecord = recordSurfaces(record);
  const fromSpec = specSurfaces(spec);

  it('parses both tables, and they carry the same pinned counts', () => {
    expect(fromRecord.length, `${RECORD_REL} sweeps nothing`).toBeGreaterThan(0);
    expect(fromSpec.length, `${SPEC_REL} sweeps nothing`).toBeGreaterThan(0);
    expect(fromSpec.map((row) => row.route)).toContain(NOT_FOUND);
    expect(
      surfaceDisagreements(fromRecord, fromSpec),
      `${RECORD_REL} and ${SPEC_REL} pin different per-surface counts. A control added, removed or ` +
        `hidden moves the number in both, in one commit`
    ).toEqual([]);
  });

  it('keeps the arithmetic of the two tables consistent', () => {
    // Every measured element is either covered by a ledger row or clears the floor, so the ledger
    // can never cover more than the sweep measures. A `covers` total that drifted above the
    // measured total would be describing a run that cannot happen.
    const measured = fromSpec.reduce((total, row) => total + row.measured, 0);
    const covered = recordRows(record).reduce((total, row) => total + row.covers, 0);
    expect(covered, `the ledger covers ${covered} elements and the sweep measures ${measured}`).toBeLessThanOrEqual(
      measured
    );
    for (const row of fromSpec) {
      expect(row.skipped + row.measured, `${row.route} does not account for all ${row.found} candidates`).toBe(
        row.found
      );
    }
  });

  it('fails in whichever direction is short, and on a count edited in one place', () => {
    const base: Surface[] = [{ route: '/work', status: 200, found: 11, skipped: 0, measured: 11 }];
    expect(surfaceDisagreements(base, base)).toEqual([]);
    expect(surfaceDisagreements(base, [])).toEqual([
      '/work is in ops/hit-target-floor.md and is not swept by tests/e2e/hit-target-floor.pw.ts',
    ]);
    expect(surfaceDisagreements([], base)).toEqual([
      '/work is swept by tests/e2e/hit-target-floor.pw.ts and has no row in ops/hit-target-floor.md',
    ]);
    expect(surfaceDisagreements(base, [{ ...base[0], measured: 12 }])).toEqual([
      '/work: ops/hit-target-floor.md says measured 11, tests/e2e/hit-target-floor.pw.ts says 12',
    ]);
  });

  it('refuses a surfaces table or literal it could not read', () => {
    expect(() => recordSurfaces('# nothing\n')).toThrow(/no "## The surfaces swept" section/);
    expect(() => specSurfaces('const OTHER = [];')).toThrow(/no "const SURFACES = \[" literal/);
    expect(() => specSurfaces('const SURFACES = [\n\n] as const;')).toThrow(/parsed to zero rows/);

    // A reflow rather than an empty literal: two surfaces parse and a third does not, because its
    // fields were reordered. Without the cross-check that presents itself as a missing surface.
    const ordered = "  { route: '/', status: 200, entrance: true, found: 5, skipped: 0, measured: 5 },";
    const shuffled = "  { route: '/work', status: 200, found: 11, entrance: false, skipped: 0, measured: 11 },";
    expect(() => specSurfaces(`const SURFACES = [\n${ordered}\n${ordered}\n${shuffled}\n] as const;`)).toThrow(
      /parsed to 2 rows and declares 3/
    );
  });
});

describe('every ledger row is answerable', () => {
  const fromRecord = recordRows(record);

  it('names a story that exists on the board, so no breach is booked to a story nobody planned', () => {
    // The manual check the story's verification section asks for, made mechanical. A row whose
    // closing story is not on the board is a breach with nothing scheduled to retire it, which
    // `ops/known-violations.md` admits only as an explicit `unassigned`.
    const keys = [...board.matchAll(/^ {2}(\d+-\d+[a-z0-9-]*):/gm)].map((match) => match[1]);
    expect(keys.length, `${BOARD_REL} parsed to no story keys`).toBeGreaterThan(0);
    expect(keys, `${BOARD_REL} no longer carries this story`).toContain('2-8-assert-the-44-44-hit-target-floor');

    for (const row of fromRecord) {
      const id = /^Story (\d+-\d+)$/.exec(row.closedBy)?.[1];
      expect(id, `"${row.id}" names "${row.closedBy}", which is not a "Story n-n" reference`).toBeDefined();
      expect(
        keys.some((key) => key.startsWith(`${id}-`)),
        `"${row.id}" is closed by ${row.closedBy}, which is not a story on the board in ${BOARD_REL}`
      ).toBe(true);
    }

    // The parser, on planted controls, so a board that stopped parsing would not read as an
    // empty set of keys that every row vacuously matches.
    expect(keys.some((key) => key.startsWith('2-15-'))).toBe(true);
    expect(keys.some((key) => key.startsWith('2-99-'))).toBe(false);
  });

  it('names a story that has not already finished while its row survives', () => {
    // The one drift neither the sweep nor the agreement above can see. A story reaching `done`
    // with its row still here means either the repair did not happen or the row was forgotten,
    // and both look identical from inside either file.
    const statuses = new Map(
      [...board.matchAll(/^ {2}(\d+-\d+[a-z0-9-]*): *([a-z-]+)\s*$/gm)].map((match) => [match[1], match[2]])
    );
    expect(statuses.size, `${BOARD_REL} parsed to no story statuses`).toBeGreaterThan(0);
    expect(statuses.get('2-7-retire-content-projects-ts-the-hub-imports-the-published-reg')).toBe('done');

    for (const row of fromRecord) {
      const id = /^Story (\d+-\d+)$/.exec(row.closedBy)?.[1] ?? '';
      const entry = [...statuses].find(([key]) => key.startsWith(`${id}-`));
      expect(entry, `"${row.id}" is closed by ${row.closedBy}, which has no status on the board`).toBeDefined();
      expect(
        entry?.[1],
        `"${row.id}" is still exempted and ${row.closedBy} is marked ${entry?.[1]} on the board. ` +
          `That story's own acceptance criteria name this floor, so either the repair did not land ` +
          `or the row was not deleted with it.`
      ).not.toBe('done');
    }
  });

  it('names a source file that exists, in the one shape the spec states', () => {
    for (const row of fromRecord) {
      expect(row.source, `"${row.id}" does not match the SOURCE_SHAPE the spec states`).toMatch(SOURCE_SHAPE);
      const path = row.source.split(':')[0];
      expect(() => read(path), `"${row.id}" points at ${path}, which is not in the tree`).not.toThrow();
    }

    // The shape, on planted controls, read out of the spec rather than restated here.
    expect(SOURCE_SHAPE.test('components/atoms/Logo/Logo.tsx:7')).toBe(true);
    expect(SOURCE_SHAPE.test('app/not-found.tsx:12,14')).toBe(true);
    expect(SOURCE_SHAPE.test('components/atoms/Logo/Logo.tsx')).toBe(false);
    expect(() => sourceShape('const OTHER = /x/;')).toThrow(/no "const SOURCE_SHAPE/);
  });
});

describe('the assertion is sourced and scoped the way the record says', () => {
  /**
   * The spec source with the two places a bare `44` is legitimate removed first.
   *
   * A measured size such as `44.42 x 22.00`, and a citation such as `Foo.tsx:44`, both carry the
   * digits without being a hand-written floor, and failing on either would make the ledger
   * unwritable for the exact values this story exists to record. What is left is a `44` used as a
   * number in code or in prose, which is what Story 2-34's conformance gate rejects.
   */
  const scannable = spec
    .replace(/measured: '[^']*'/g, "measured: ''")
    .replace(/[\w./-]+\.(?:tsx?|jsx?|mjs|cjs|scss|css|md|json|ya?ml):[\d,-]+/g, '<citation>');

  it('writes no pixel literal for the floor, so it is read from the contract', () => {
    const written = [...scannable.matchAll(/\b44(px)?\b/g)].map((match) => match[0]);
    expect(written, `${SPEC_REL} writes the floor by hand instead of reading --tap`).toEqual([]);

    // The load-bearing half: the floor really is read off the contract in the running page.
    expect(spec, `${SPEC_REL} no longer reads --tap at all`).toContain("rootCustomPropertyValue(page, '--tap')");

    // The scan, on planted controls, so an empty result is a measurement rather than a regex that
    // stopped matching, and so the two exemptions are shown to be exemptions rather than holes.
    const scan = (text: string): string[] =>
      [
        ...text
          .replace(/measured: '[^']*'/g, "measured: ''")
          .replace(/[\w./-]+\.(?:tsx?|jsx?|mjs|cjs|scss|css|md|json|ya?ml):[\d,-]+/g, '<citation>')
          .matchAll(/\b44(px)?\b/g),
      ].map((match) => match[0]);

    expect(scan('a min-height of 44px here'), 'the scan no longer fires on a hand-written floor').toEqual(['44px']);
    expect(scan('the floor is 44 on both axes'), 'the scan no longer fires on a bare floor in prose').toEqual(['44']);
    expect(scan("measured: '44.42 x 22.00',"), 'the scan fires on a real measurement').toEqual([]);
    expect(scan('see components/atoms/Navbar/Navbar.tsx:44 for it'), 'the scan fires on a line citation').toEqual([]);
    expect(scan('the number 4400 and 144'), 'the scan fires inside a longer number').toEqual([]);
  });

  it('takes no screenshot, so it writes no snapshot directory', () => {
    // `tests/e2e/rendered-output.pw.ts:216-223` asserts its own snapshot directory holds exactly
    // one committed PNG. A screenshot taken here would create a second directory rather than
    // break that case, which is why this is asserted where the temptation is.
    expect(spec, `${SPEC_REL} takes a screenshot`).not.toContain('toHaveScreenshot');
    expect(spec).not.toContain('expectRouteScreenshot');
  });

  it('derives its route set from app/ rather than only from a hand-written list', () => {
    // KV-4 states in writing that the floor is enforced on every route. That is only true while
    // something checks the route set against the filesystem, and Story 2-9 adds a surface.
    expect(spec, `${SPEC_REL} no longer derives its routes from the filesystem`).toContain('routesOnDisk');
    expect(spec).toContain("routesOnDisk(join(REPO_ROOT, 'app'))");
    expect(record, `${RECORD_REL} does not record that the route set is derived`).toContain(
      'The route set itself is derived from `app/`'
    );
  });

  it('leaves the Lighthouse accessibility gate at the score AD-19 fixes', () => {
    const lighthouse = read(LIGHTHOUSE_REL);
    expect(
      lighthouse,
      `${LIGHTHOUSE_REL} no longer asserts accessibility at 0.95 with severity error. AD-19 keeps ` +
        `that gate alongside this one, and AD-21 forbids weakening either`
    ).toContain("'categories:accessibility': ['error', { minScore: 0.95 }]");
  });

  it('is named by the harness record, under what the harness asserts', () => {
    const harness = read(HARNESS_RECORD_REL);
    expect(
      harness,
      `${HARNESS_RECORD_REL} still lists the floor under what the harness does not assert. Story ` +
        `2-8 asserts it, and that file is where a reader goes to find out what is covered`
    ).not.toMatch(/\|\s*The 44x44 hit-target floor\s*\|\s*Needs a Suite Directory/);
    expect(harness, `${HARNESS_RECORD_REL} does not point at ${RECORD_REL}`).toContain(RECORD_REL);
    expect(harness, `${HARNESS_RECORD_REL} does not name the new spec file`).toContain(SPEC_REL);

    // The row has to sit under the heading that says what is asserted, not under the one that says
    // what is not. A reader scanning for coverage reads the heading before the cell.
    const asserts = harness.indexOf('## What the harness asserts');
    const notYet = harness.indexOf('## What it deliberately does not assert');
    const floorRow = harness.indexOf('| The 44x44 hit-target floor');
    expect(asserts, `${HARNESS_RECORD_REL} has no "What the harness asserts" heading`).toBeGreaterThan(-1);
    expect(notYet, `${HARNESS_RECORD_REL} has no "What it deliberately does not assert" heading`).toBeGreaterThan(-1);
    expect(floorRow, `${HARNESS_RECORD_REL} no longer carries a hit-target row`).toBeGreaterThan(-1);
    expect(
      floorRow > asserts && floorRow < notYet,
      `${HARNESS_RECORD_REL} keeps the hit-target row under "what it deliberately does not assert", ` +
        `where a reader scanning for coverage finds the floor under the heading saying it is not covered`
    ).toBe(true);
  });

  it('is registered in the violations register, with both index rows matching their entries', () => {
    for (const entry of ['## KV-4:', '## KV-5:']) {
      expect(violations, `${VIOLATIONS_REL} carries no ${entry.replace('## ', '').replace(':', '')} entry`).toContain(
        entry
      );
    }

    // The register's own rule: the index is derived and the entry is authoritative, so the two
    // are held equal here rather than left to a reader to notice.
    const indexRow = (id: string): string => {
      const row = violations.split('\n').find((line) => line.trim().startsWith(`| ${id} |`));
      expect(row, `${VIOLATIONS_REL} has no ${id} index row`).toBeDefined();
      return row ?? '';
    };

    const kv4 = indexRow('KV-4');
    expect(kv4, 'the KV-4 index row does not name AD-19').toContain('AD-19');
    expect(kv4, 'the KV-4 index row is not Open').toContain('**Open**');
    expect(kv4, 'the KV-4 index row names no closing stories').toContain('Stories 2-9, 2-15, 2-30 and 2-32');
    expect(kv4, 'the KV-4 index row claims a retirement date').toContain('_not retired_');

    const kv5 = indexRow('KV-5');
    expect(kv5, 'the KV-5 index row does not name the rule it breaches').toContain('AD-19');
    expect(kv5, 'the KV-5 index row is not Open').toContain('**Open**');
    expect(kv5, 'the KV-5 index row names no closing story').toContain('Story 2-9');
    expect(kv5, 'the KV-5 index row claims a retirement date').toContain('_not retired_');
  });

  it('writes story ids hyphenated in the text this story authored', () => {
    // `ops/known-violations.md:17-20` fixes the spelling so that one form finds every mention.
    // A dotted id in prose is invisible to a search for the hyphenated one.
    //
    // Scoped to what Story 2-8 wrote. Older text in the register uses the dotted form in places,
    // and rewriting a paragraph a story is not otherwise editing is how a citation drifts; the
    // rule binds new text, and this asserts it where it binds rather than everywhere.
    const scoped: [string, string][] = [
      [RECORD_REL, record],
      [`${VIOLATIONS_REL} (KV-4 and KV-5)`, violations.slice(violations.indexOf('## KV-4:'))],
    ];

    for (const [where, text] of scoped) {
      expect(text.length, `${where} sliced to nothing, so this scan is over an empty string`).toBeGreaterThan(500);
      const dotted = [...text.matchAll(/\bStory \d+\.\d+/g)].map((match) => match[0]);
      expect(dotted, `${where} writes a story id dotted, which a search for the hyphenated form misses`).toEqual([]);
    }

    // The scan, on a planted control, so an empty result is a measurement rather than a regex that
    // stopped matching.
    expect([...'closed by Story 2.15 and Story 2-30'.matchAll(/\bStory \d+\.\d+/g)].map((m) => m[0])).toEqual([
      'Story 2.15',
    ]);
  });
});

describe(`${HERE} reads the real files`, () => {
  it('found the record, the spec and the board', () => {
    expect(record.length).toBeGreaterThan(1000);
    expect(spec).toContain('const EXEMPTIONS');
    expect(spec).toContain('const SURFACES');
    expect(board).toContain('development_status:');
  });
});
