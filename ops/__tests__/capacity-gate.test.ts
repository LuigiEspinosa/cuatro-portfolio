import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseGate, evaluate, main, GateError, GATE_PATH } from '../capacity-gate.mjs';

// Resolved from the repository root, which is where Vitest runs. Not from
// `import.meta.url`: under Vitest that is a vite URL rather than a `file:` one,
// so neither `new URL(...)` nor `fileURLToPath` works here. The module's own
// read has the same constraint, which is why the `main` cases below inject a
// reader and the real read is covered by the subprocess block instead.
const committed = readFileSync(resolve(process.cwd(), GATE_PATH), 'utf8');
const CHECKER = resolve(process.cwd(), 'ops/capacity-gate.mjs');
const WORKFLOW = resolve(process.cwd(), '.github/workflows/deploy.yml');

// A minimal gate of the same shape. Every malformed case below is a mutation of
// this string, so a test can prove a refusal without touching the committed file.
const VALID = [
  'measured_at:',
  'baseline:',
  'threshold:',
  'reading:',
  'status: blocked',
  'overflow:',
  '  path: managed hosting',
  '  provider: Railway',
  'placements:',
  '  - id: cuatro-portfolio',
  '    observed: 2026-08-17',
  '',
].join('\n');

const neverRead = () => {
  throw new Error('the gate file should not have been read');
};

const runChecker = (...args: string[]) => spawnSync(process.execPath, [CHECKER, ...args], { encoding: 'utf8' });

describe('the committed gate file', () => {
  it('parses, and carries exactly the seven keys AD-9 names', () => {
    const gate = parseGate(committed);
    expect(Object.keys(gate).sort()).toEqual(
      ['baseline', 'measured_at', 'overflow', 'placements', 'reading', 'status', 'threshold'].sort()
    );
  });

  // Narrowed by Story 1-5. The invariant AD-9 actually names is that the gate
  // stays blocked until a threshold is written, and only Story 1-6 may write
  // one. The three measurement keys are a different thing: Story 1-5's close-out
  // fills them from the week, and asserting them empty made a correct close-out
  // turn CI red while the record told the operator to read that red as proof the
  // edit was wrong. The obvious response would have been to revert the very
  // measurement the week was run to produce.
  it('is blocked with no threshold, because only Story 1-6 may write one', () => {
    const gate = parseGate(committed);
    expect(gate.status).toBe('blocked');
    expect(gate.threshold).toBe('');
  });

  it('stays shut once the measurement keys are filled, because measuring is not opening', () => {
    // The exact shape Story 1-5's close-out writes, built from the scalars
    // `ops/capacity-summary.mjs` emits.
    //
    // Whole lines are replaced rather than the bare `key:` prefix, so this
    // fixture is the same whether the committed gate's measurement keys are
    // still empty or already filled by a close-out. Matching on the prefix
    // appended to a filled value instead of overwriting it, which turned this
    // test red the moment Story 1-5 closed out and pointed the blame at the
    // measurement rather than at the fixture.
    const measured = committed
      .replace(/^measured_at:.*$/m, 'measured_at: 2026-08-24')
      .replace(/^baseline:.*$/m, 'baseline: idle band load15 0.08, containers 3.0% of 2 vCPU')
      .replace(/^reading:.*$/m, 'reading: loaded band load15 0.16 max 0.18, peak 3.4%');
    const gate = parseGate(measured);
    expect(gate.measured_at).toBe('2026-08-24');
    expect(gate.status).toBe('blocked');
    expect(gate.threshold).toBe('');
    expect(evaluate(gate, 'list-wheel').allowed).toBe(false);
    expect(evaluate(gate, 'cuatro-portfolio').allowed).toBe(true);
  });

  it('lists the four applications running on the box', () => {
    const gate = parseGate(committed);
    expect(gate.placements.map((entry) => entry.id)).toEqual([
      'cuatro-portfolio',
      'cs-tracker',
      'cuatro-tracker',
      'digital-library',
    ]);
  });

  it('names the overflow path AD-9 decided', () => {
    const gate = parseGate(committed);
    expect(gate.overflow.path).toBe('managed hosting');
    expect(gate.overflow.provider).toBe('Railway');
  });
});

describe('evaluate', () => {
  it('passes an id already in placements, naming it, so NFR-2 is never traded against the gate', () => {
    const result = evaluate(parseGate(committed), 'cuatro-portfolio');
    expect(result.allowed).toBe(true);
    expect(result.message).toContain('cuatro-portfolio');
    expect(result.message).toContain('placements');
  });

  // This is the planted probe AD-21 asks for. It is kept as a test rather than
  // deleted, so a later reader can rerun the demonstration instead of trusting it.
  it('refuses a fabricated new id, naming the gate file, the blocked status and the overflow', () => {
    const result = evaluate(parseGate(committed), 'list-wheel');
    expect(result.allowed).toBe(false);
    expect(result.message).toContain(GATE_PATH);
    expect(result.message).toContain('status: blocked');
    expect(result.message).toContain('"list-wheel"');
    expect(result.message).toContain('cuatro-portfolio');
    expect(result.message).toContain('managed hosting');
  });

  it('passes any id once the gate is open against a written threshold', () => {
    const open = VALID.replace('status: blocked', 'status: open').replace('threshold:', 'threshold: load average 3.0');
    const result = evaluate(parseGate(open), 'list-wheel');
    expect(result.allowed).toBe(true);
    expect(result.message).toContain('load average 3.0');
  });

  it('trims the id it is given, so a stray space is not read as a new application', () => {
    expect(evaluate(parseGate(committed), ' cuatro-portfolio ').allowed).toBe(true);
  });
});

// The exit code is the only thing GitHub Actions can see. Everything above
// asserts a returned object, which would stay green even if the process mapped
// a refusal to exit 0, so these run the real binary against the real file.
describe('the command line, as the deploy workflow runs it', () => {
  it('exits 0 for an id in placements, on stdout', () => {
    const run = runChecker('cuatro-portfolio');
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('cuatro-portfolio');
    expect(run.stderr).toBe('');
  });

  it('exits 1 for a fabricated id, with the refusal on stderr', () => {
    const run = runChecker('list-wheel');
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('REFUSED');
    expect(run.stderr).toContain(GATE_PATH);
    expect(run.stderr).toContain('status: blocked');
  });

  it('exits 1 with usage when no id is given', () => {
    const run = runChecker();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('usage');
  });

  it('resolves the gate beside the module, so it works from any working directory', () => {
    const run = spawnSync(process.execPath, [CHECKER, 'cuatro-portfolio'], {
      encoding: 'utf8',
      cwd: resolve(process.cwd(), 'ops'),
    });
    expect(run.status).toBe(0);
  });
});

// AD-21 requires the gate to be blocking. Nothing executes the workflow before
// it reaches `main`, so the workflow is checked as the data it is.
describe('the deploy workflow wiring', () => {
  const workflow = readFileSync(WORKFLOW, 'utf8');
  // Comments discuss `continue-on-error` by name, so the assertions below read
  // the workflow's instructions rather than its prose.
  const instructions = workflow
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');

  it('names an id that is actually in placements', () => {
    const named = instructions.match(/node ops\/capacity-gate\.mjs (\S+)/)?.[1];
    const ids = parseGate(committed).placements.map((entry) => entry.id);
    expect(named).toBeDefined();
    expect(ids).toContain(named);
  });

  it('runs the gate before the deploy, not after', () => {
    expect(instructions.indexOf('capacity-gate.mjs')).toBeLessThan(instructions.indexOf('ssh-action'));
  });

  it('never downgrades a step to a warning, and never makes one conditional', () => {
    expect(instructions).not.toMatch(/continue-on-error\s*:/);
    expect(instructions).not.toMatch(/^\s+if\s*:/m);
  });
});

describe('the gate fails closed', () => {
  it('refuses when no id is given', () => {
    const result = main([], neverRead);
    expect(result.allowed).toBe(false);
    expect(result.message).toContain('usage');
  });

  it('refuses a non-string id rather than throwing', () => {
    const result = main([42 as unknown as string], neverRead);
    expect(result.allowed).toBe(false);
    expect(result.message).toContain('usage');
  });

  it('refuses when the gate file cannot be read', () => {
    const result = main(['cuatro-portfolio'], () => {
      throw new Error('ENOENT: no such file or directory');
    });
    expect(result.allowed).toBe(false);
    expect(result.message).toContain(GATE_PATH);
    expect(result.message).toContain('could not be read');
  });

  it('reports a parse failure as a refusal rather than a crash', () => {
    const result = main(['cuatro-portfolio'], () => 'status: blocked\n');
    expect(result.allowed).toBe(false);
    expect(result.message).toContain('is not a gate this reader accepts');
  });

  it('lets a defect in the checker escape as itself rather than blaming the file', () => {
    expect(() =>
      main(['cuatro-portfolio'], () => {
        // A reader that returns a non-string makes `parseGate` throw a TypeError,
        // which must not be dressed up as a malformed gate.
        return 42 as unknown as string;
      })
    ).toThrow(TypeError);
  });

  it('refuses a gate whose status is open while the threshold is empty', () => {
    expect(() => parseGate(VALID.replace('status: blocked', 'status: open'))).toThrow(
      /open while threshold is empty/
    );
  });

  it('refuses a gate opened against a threshold of only whitespace', () => {
    const open = VALID.replace('status: blocked', 'status: open').replace('threshold:', "threshold: '  '");
    expect(() => parseGate(open)).toThrow(/open while threshold is empty/);
  });

  it('refuses an unknown status value', () => {
    expect(() => parseGate(VALID.replace('status: blocked', 'status: unblocked'))).toThrow(/Accepted values/);
  });

  it('throws a GateError for a rejected gate, so a caller can tell it from a defect', () => {
    expect(() => parseGate(VALID.replace('status: blocked', 'status: unblocked'))).toThrow(GateError);
  });

  it.each([
    ['a tab', VALID.replace('  path: managed hosting', '\tpath: managed hosting'), /tab indentation/],
    ['an unknown top level key', `${VALID}capacity: plenty\n`, /unknown key "capacity"/],
    ['a duplicate top level key', `${VALID}status: open\n`, /duplicate key "status"/],
    ['a missing top level key', VALID.replace('reading:\n', ''), /missing key "reading"/],
    ['an unexpected indent', VALID.replace('status: blocked', '   status: blocked'), /unexpected indentation/],
    ['an inline comment', VALID.replace('status: blocked', 'status: blocked # for now'), /may not contain/],
    ['an uppercase key', VALID.replace('status:', 'Status:'), /not a key this reader accepts/],
    ['a line with no colon', `${VALID}nonsense\n`, /expected "key: value"/],
    ['an unknown key under overflow', VALID.replace('  provider: Railway', '  vendor: Railway'), /unknown key "vendor" under overflow/],
    ['overflow missing its provider', VALID.replace('  provider: Railway\n', ''), /overflow is missing a non-empty "provider"/],
    ['an inline value for overflow', VALID.replace('overflow:', 'overflow: railway'), /overflow is a block/],
    ['an inline value for placements', VALID.replace('placements:', 'placements: none'), /placements is a list/],
    ['an unknown key in a placements entry', VALID.replace('    observed: 2026-08-17', '    owner: someone'), /unknown key "owner"/],
    ['a placements entry with no id', VALID.replace('  - id: cuatro-portfolio', '  - note: nameless'), /missing a non-empty "id"/],
    ['a duplicate placement id', `${VALID}  - id: cuatro-portfolio\n`, /duplicate placement id/],
    ['an empty placements list', VALID.replace(/ {2}- id.*\n {4}observed.*\n/, ''), /placements is empty/],
    ['a field before any list item', VALID.replace('  - id: cuatro-portfolio', '    stray: value'), /before any list item/],
  ])('refuses %s', (_label, text, expected) => {
    expect(() => parseGate(text)).toThrow(expected);
  });

  it('points at the offending line by number', () => {
    expect(() => parseGate(`${VALID}capacity: plenty\n`)).toThrow(/^line 12: /);
  });
});

describe('what the reader tolerates', () => {
  it('accepts CRLF line endings, since the gate is edited from Windows', () => {
    expect(parseGate(VALID.replace(/\n/g, '\r\n')).status).toBe('blocked');
  });

  it('accepts a byte order mark, which an editor can add without anyone asking', () => {
    expect(parseGate(`\uFEFF${VALID}`).status).toBe('blocked');
  });

  it('accepts quoted values, and strips the quotes', () => {
    expect(parseGate(VALID.replace('status: blocked', "status: 'blocked'")).status).toBe('blocked');
  });

  it('rejects a key named constructor as unknown, never as an inherited duplicate', () => {
    // `key in obj` would have called this a duplicate of Object.prototype's own
    // member and refused a gate for a reason that was not true.
    expect(() => parseGate(VALID.replace('  provider: Railway', '  provider: Railway\n  constructor: x'))).toThrow(
      /unknown key "constructor" under overflow/
    );
  });
});
