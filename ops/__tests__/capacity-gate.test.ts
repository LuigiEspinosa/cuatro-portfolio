import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { parseGate, evaluate, main, load15, GateError, GATE_PATH, THRESHOLD_RECORD } from '../capacity-gate.mjs';

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

// Whole lines are replaced, never the bare `key:` prefix. Story 1-5 learned that
// one the hard way: a prefix match appends to a filled value instead of
// overwriting it, which would let a fixture carry two load15 figures and read as
// the first one silently. Every fixture below uses the anchored form.
const withLine = (text: string, key: string, line: string) =>
  text.replace(new RegExp(`^${key}:.*$`, 'm'), line);

// A gate whose status is still `blocked`, with the measurement keys filled and a
// threshold written beside them. Story 1-6 opened the committed gate, so the
// AD-21 refusal demonstration moved here. Left on the committed file it would
// have gone green-but-meaningless the moment the gate said yes to everything.
// It also covers the case that a threshold on its own does not open anything:
// `status` is a separate key and refusal survives a threshold being present.
const BLOCKED = [
  ['measured_at', 'measured_at: 2026-08-25'],
  ['baseline', 'baseline: idle band load15 0.08, containers 3.0% of 2 vCPU'],
  ['threshold', 'threshold: load15 0.60 on 2 vCPU'],
  ['reading', 'reading: loaded band load15 0.18 max 0.27, peak 7.1%'],
].reduce((text, [key, line]) => withLine(text, key, line), VALID);

// The same gate with the status moved. Used as the positive control for the
// subprocess helper: without it every case that helper runs expects exit 1, and
// a harness broken for an unrelated reason would look exactly like a working
// refusal.
const OPENED = withLine(BLOCKED, 'status', 'status: open');

// `load15` returns `null` for a value that names no figure, and a bare
// `expect(...).not.toBeNull()` does not narrow the type for the comparison that
// follows. This throws instead, so the null case fails with the value that
// caused it rather than with a comparison against null.
const figureIn = (value: string, where: string): number => {
  const figure = load15(value);
  if (figure === null) throw new Error(`${where} names no load15 figure: ${JSON.stringify(value)}`);
  return figure;
};

const neverRead = () => {
  throw new Error('the gate file should not have been read');
};

// `spawnSync` reports a failure to start in `error` and leaves `status` null, so
// an unguarded `run.status` turns a broken harness into what reads as a gate
// defect. Every spawn in this file goes through here.
const spawned = <T>(run: SpawnSyncReturns<T>): SpawnSyncReturns<T> => {
  if (run.error) throw run.error;
  return run;
};

const runChecker = (...args: string[]) =>
  spawned(spawnSync(process.execPath, [CHECKER, ...args], { encoding: 'utf8' }));

// The checker resolves its gate beside its own module, so exercising the real
// binary against a synthetic gate needs a synthetic directory: copy the module
// next to the gate text and run the copy. The module imports node builtins only,
// so a copy of it runs unchanged, and a test below asserts that stays true.
// This is what keeps the exit-1 demonstration real now that the committed gate
// exits 0.
const runAgainst = (gateText: string, ...args: string[]) => {
  const directory = mkdtempSync(join(tmpdir(), 'capacity-gate-'));
  try {
    const module_ = join(directory, 'capacity-gate.mjs');
    copyFileSync(CHECKER, module_);
    writeFileSync(join(directory, 'capacity-gate.yml'), gateText, 'utf8');
    return spawned(spawnSync(process.execPath, [module_, ...args], { encoding: 'utf8' }));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

describe('the committed gate file', () => {
  it('parses, and carries exactly the seven keys AD-9 names', () => {
    const gate = parseGate(committed);
    expect(Object.keys(gate).sort()).toEqual(
      ['baseline', 'measured_at', 'overflow', 'placements', 'reading', 'status', 'threshold'].sort()
    );
  });

  // Deliberately not "the gate is open". `ops/capacity-threshold.md` tells the
  // Operator to set `status: blocked` when a later measurement crosses the line,
  // and a suite that pins the current state turns that correct act red and
  // points the blame at the gate rather than at the re-derivation that is owed.
  // That is exactly the failure Story 1-5 fixed for the measurement keys, and it
  // is not being reintroduced here. So: assert what has to hold in whichever
  // state the file is in. Both branches assert something real.
  it('holds the AD-9 invariant for whichever state it is in', () => {
    const gate = parseGate(committed);

    if (gate.status === 'open') {
      const threshold = figureIn(gate.threshold, 'threshold');
      expect(threshold).toBeGreaterThan(0);
      expect(figureIn(gate.baseline, 'baseline')).toBeLessThan(threshold);
      expect(evaluate(gate, 'list-wheel').allowed).toBe(true);
    } else {
      expect(gate.status).toBe('blocked');
      expect(evaluate(gate, 'list-wheel').allowed).toBe(false);
    }

    // True in both states, because NFR-2 is never traded against the gate.
    expect(evaluate(gate, 'cuatro-portfolio').allowed).toBe(true);
  });

  // `baseline` is the week's p10 idle floor, so on its own it is the least
  // sensitive number the week produced: the box's idle load would have to reach
  // the threshold before the comparison above fired, long after the loaded band
  // and the max had crossed it. `reading` is the loaded band, so watching it too
  // is what makes the tripwire trip in time to be useful.
  it('keeps the loaded reading below the threshold as well as the idle baseline', () => {
    const gate = parseGate(committed);
    if (gate.status !== 'open') return;
    expect(figureIn(gate.reading, 'reading')).toBeLessThan(figureIn(gate.threshold, 'threshold'));
  });

  // Shape and relationship, never the literal values. A legitimate
  // re-measurement rewrites all three of these, and it must not land as a red
  // test that reads "the measurement keys are wrong".
  it('carries measurement keys of the shape Story 1-5 writes, which Story 1-6 only reads', () => {
    const gate = parseGate(committed);
    expect(gate.measured_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(figureIn(gate.baseline, 'baseline')).toBeGreaterThan(0);
    expect(figureIn(gate.reading, 'reading')).toBeGreaterThan(0);
    expect(figureIn(gate.baseline, 'baseline')).toBeLessThanOrEqual(figureIn(gate.reading, 'reading'));
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

  // This is the planted probe AD-21 asks for, re-anchored by Story 1-6 onto a
  // synthetic blocked gate. It is kept as a test rather than deleted, so a later
  // reader can rerun the demonstration instead of trusting it.
  it('refuses a fabricated new id, naming the gate file, the blocked status and the overflow', () => {
    const result = evaluate(parseGate(BLOCKED), 'list-wheel');
    expect(result.allowed).toBe(false);
    expect(result.message).toContain(GATE_PATH);
    expect(result.message).toContain('status: blocked');
    expect(result.message).toContain('"list-wheel"');
    expect(result.message).toContain('cuatro-portfolio');
    expect(result.message).toContain('managed hosting');
    // The refusal points at the record that says how a threshold is derived and
    // what authorises a status move. Asserted so the wording cannot rot into a
    // refusal that tells an operator no and nothing else.
    expect(result.message).toContain(THRESHOLD_RECORD);
  });

  // Writing a threshold is not opening a gate. `BLOCKED` carries one, so this
  // proves the refusal reads `status` and not the presence of a number beside it.
  it('still refuses a new id when a threshold is written but the status is blocked', () => {
    expect(evaluate(parseGate(BLOCKED), 'list-wheel').allowed).toBe(false);
    expect(evaluate(parseGate(BLOCKED), 'cuatro-portfolio').allowed).toBe(true);
  });

  // Story 1-5's demonstration that measuring is not opening, moved off the
  // committed gate by Story 1-6 and kept intact: measurement keys filled,
  // threshold still empty, status still blocked.
  it('refuses a new id on a measured gate whose threshold is still empty', () => {
    const gate = parseGate(withLine(BLOCKED, 'threshold', 'threshold:'));
    expect(gate.threshold).toBe('');
    expect(gate.status).toBe('blocked');
    expect(evaluate(gate, 'list-wheel').allowed).toBe(false);
    expect(evaluate(gate, 'cuatro-portfolio').allowed).toBe(true);
  });

  it('passes any id once the gate is open against a written threshold', () => {
    const open = withLine(withLine(VALID, 'status', 'status: open'), 'threshold', 'threshold: load15 3.0');
    const result = evaluate(parseGate(open), 'list-wheel');
    expect(result.allowed).toBe(true);
    expect(result.message).toContain('load15 3.0');
  });

  // The AD-17c criterion this story exists for: a genuinely new id against the
  // committed gate, which was refused before Story 1-6 and passes after it.
  // Stated as an implication rather than as a fact about today, so a later
  // re-block reads as the Operator acting on `ops/capacity-threshold.md` rather
  // than as this test catching a defect.
  it('names the threshold it was opened against, whenever the committed gate is open', () => {
    const gate = parseGate(committed);
    if (gate.status !== 'open') return;
    const result = evaluate(gate, 'list-wheel');
    expect(result.allowed).toBe(true);
    expect(result.message).toContain('list-wheel');
    expect(result.message).toContain(gate.threshold);
    expect(load15(result.message)).toBe(figureIn(gate.threshold, 'threshold'));
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

  // The exit code the committed gate actually produces for a new id, asserted
  // as an implication of its own status rather than as a fact about today, so
  // the documented re-block procedure does not turn this red.
  it('agrees with the committed gate about whether a new id may be placed', () => {
    const gate = parseGate(committed);
    const run = runChecker('list-wheel');

    if (gate.status === 'open') {
      expect(run.status).toBe(0);
      expect(run.stdout).toContain('list-wheel');
      // The figure the process printed, parsed back out of its own stdout and
      // compared against the file. `toContain('load15')` would have stayed green
      // with the number dropped.
      expect(load15(run.stdout)).toBe(figureIn(gate.threshold, 'threshold'));
      expect(run.stderr).toBe('');
    } else {
      expect(run.status).toBe(1);
      expect(run.stderr).toContain('REFUSED');
      expect(run.stderr).toContain(GATE_PATH);
    }
  });

  // Re-anchored by Story 1-6 onto a synthetic blocked gate, because the
  // committed one now exits 0 for this id. The exit code is the only thing
  // GitHub Actions can see, so the refusal keeps a subprocess demonstration.
  it('exits 1 for a fabricated id against a blocked gate, with the refusal on stderr', () => {
    const run = runAgainst(BLOCKED, 'list-wheel');
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('REFUSED');
    expect(run.stderr).toContain(GATE_PATH);
    expect(run.stderr).toContain('status: blocked');
    expect(run.stderr).toContain(THRESHOLD_RECORD);
  });

  // The positive control for the helper above. Every other case it runs expects
  // exit 1, so without this a helper broken for an unrelated reason (a failed
  // copy, an unwritten gate) would report as a working refusal.
  it('exits 0 for the same synthetic gate with the status moved, so the helper discriminates', () => {
    const run = runAgainst(OPENED, 'list-wheel');
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('list-wheel');
    expect(run.stderr).toBe('');
  });

  it('exits 1 for an open gate whose threshold names no load15 figure', () => {
    const run = runAgainst(withLine(OPENED, 'threshold', 'threshold: banana'), 'list-wheel');
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('REFUSED');
    expect(run.stderr).toContain('load15');
  });

  it('exits 1 with usage when no id is given', () => {
    const run = runChecker();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('usage');
  });

  it('resolves the gate beside the module, so it works from any working directory', () => {
    const run = spawned(
      spawnSync(process.execPath, [CHECKER, 'cuatro-portfolio'], {
        encoding: 'utf8',
        cwd: resolve(process.cwd(), 'ops'),
      })
    );
    expect(run.status).toBe(0);
  });

  // `runAgainst` copies the module on its own into a temporary directory, which
  // only works while the module imports nothing relative to itself. Nothing else
  // enforces that, so a future `import './something.mjs'` would break every
  // subprocess refusal above in a way that reads as a gate defect.
  it('imports only node builtins, which is what lets the helper copy the module', () => {
    const source = readFileSync(CHECKER, 'utf8');
    const specifiers = [...source.matchAll(/^import\s[^'"]*['"]([^'"]+)['"]/gm)].map((match) => match[1]);
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) expect(specifier).toMatch(/^node:/);
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

  // `VALID` opens with an empty `baseline`, so these exercise the shape rule
  // alone. The comparison rule needs both figures and is exercised against
  // `OPENED` further down.
  const openedWith = (threshold: string) =>
    withLine(withLine(VALID, 'status', 'status: open'), 'threshold', threshold);

  it('refuses a gate whose status is open while the threshold is empty', () => {
    expect(() => parseGate(openedWith('threshold:'))).toThrow(/open while threshold is empty/);
  });

  it('refuses a gate opened against a threshold of only whitespace', () => {
    expect(() => parseGate(openedWith("threshold: '  '"))).toThrow(/open while threshold is empty/);
  });

  // The hole the Story 1-4 review named: `threshold` was validated only as a
  // non-empty string, so `threshold: banana` would have opened the gate. AD-9
  // gates on the box's 15-minute load average, so an open gate has to name one.
  it('refuses a gate opened against a threshold that names no load15 figure', () => {
    const open = openedWith('threshold: banana');
    expect(() => parseGate(open)).toThrow(/names no load15 figure/);
    expect(() => parseGate(open)).toThrow(/AD-9/);
    expect(() => parseGate(open)).toThrow(GateError);
  });

  it('refuses a gate opened against a load15 figure of zero, which is not a capacity line', () => {
    expect(() => parseGate(openedWith('threshold: load15 0'))).toThrow(/Zero is not a capacity line/);
  });

  it('refuses a load15 figure that does not end where a number ends', () => {
    expect(() => parseGate(openedWith('threshold: load15 0.60ish'))).toThrow(/names no load15 figure/);
  });

  it.each([
    ['a capitalised keyword', 'threshold: Load15 0.60'],
    ['a colon after the keyword', 'threshold: load15: 0.60'],
  ])('accepts %s, because a human writing one would', (_label, threshold) => {
    expect(parseGate(openedWith(threshold)).status).toBe('open');
  });

  it('parses an open gate whose baseline has crossed, because that gate is readable', () => {
    // The contradiction is semantic, not syntactic. Refusing it here would
    // refuse the file outright, and a refused file says no to everything.
    // `evaluate` answers it instead, and the cases live beside that function.
    const crossed = withLine(OPENED, 'baseline', 'baseline: idle band load15 0.91');
    expect(parseGate(crossed).status).toBe('open');
  });

  it('opens where the baseline sits below the threshold, which is the whole point', () => {
    expect(parseGate(OPENED).status).toBe('open');
  });

  // The shape rule and the comparison bind an open gate only. A blocked gate
  // refuses every new id whatever is written beside it, so refusing to parse it
  // would turn a typo into a deploy outage for the ids meant to keep passing.
  it('accepts an unreadable threshold on a blocked gate, which refuses new ids regardless', () => {
    const blocked = withLine(VALID, 'threshold', 'threshold: banana');
    expect(parseGate(blocked).threshold).toBe('banana');
    expect(evaluate(parseGate(blocked), 'list-wheel').allowed).toBe(false);
  });

  it('accepts a crossed baseline on a blocked gate, because blocked is already the safe state', () => {
    const crossed = withLine(BLOCKED, 'baseline', 'baseline: idle band load15 0.91');
    expect(parseGate(crossed).status).toBe('blocked');
    expect(evaluate(parseGate(crossed), 'list-wheel').allowed).toBe(false);
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

// The third state, beside `open` and `blocked`: a gate that reads `open` while
// its own two recorded numbers say it should not be. AD-9 permits `open` only
// while the measured baseline sits below the written threshold, and this is that
// condition enforced at the moment a placement is decided.
//
// It is decided in `evaluate` rather than refused in `parseGate`, on purpose. A
// parse refusal rejects the file, and a rejected file says no to every id
// including an incumbent. `.github/workflows/deploy.yml` is the only caller and
// it names `cuatro-portfolio`, an incumbent, so at the one live call site a
// parse-level version of this rule could never refuse a new id (none passes
// through it) and could only ever stop the Anchor deploying, which is exactly
// the trade AD-9 forbids. Decided here, NFR-2 is untouched and a contradictory
// gate still cannot place anything new.
describe('a gate that reads open while its own baseline has reached its own threshold', () => {
  const CROSSED = withLine(OPENED, 'baseline', 'baseline: idle band load15 0.60, containers 3.0% of 2 vCPU');
  const PASSED = withLine(OPENED, 'baseline', 'baseline: idle band load15 0.91');

  it('refuses a new id, naming both figures, AD-9 and the record', () => {
    const result = evaluate(parseGate(CROSSED), 'list-wheel');
    expect(result.allowed).toBe(false);
    expect(result.message).toContain('REFUSED');
    expect(result.message).toContain(GATE_PATH);
    expect(result.message).toContain('baseline names load15 0.6');
    expect(result.message).toContain('threshold names load15 0.6');
    expect(result.message).toContain('AD-9');
    expect(result.message).toContain(THRESHOLD_RECORD);
    expect(result.message).toContain('treated as blocked');
    expect(result.message).toContain('"list-wheel"');
  });

  it('refuses a new id when the baseline has passed the threshold outright', () => {
    const result = evaluate(parseGate(PASSED), 'list-wheel');
    expect(result.allowed).toBe(false);
    expect(result.message).toContain('baseline names load15 0.91');
  });

  // The reason the rule moved out of the parser. Continuity is never traded
  // against the gate, so the Anchor keeps deploying from a gate that is at the
  // same moment refusing new placement.
  it('still passes an incumbent, because AD-9 says existing ids always deploy', () => {
    const result = evaluate(parseGate(PASSED), 'cuatro-portfolio');
    expect(result.allowed).toBe(true);
    expect(result.message).toContain('placements');
  });

  it('exits 1 for a new id and 0 for an incumbent, through the real binary', () => {
    expect(runAgainst(PASSED, 'list-wheel').status).toBe(1);
    expect(runAgainst(PASSED, 'cuatro-portfolio').status).toBe(0);
  });

  it('is not a parse failure, so the message blames the numbers and not the file', () => {
    const result = main(['list-wheel'], () => PASSED);
    expect(result.allowed).toBe(false);
    expect(result.message).not.toContain('is not a gate this reader accepts');
    expect(result.message).toContain('treated as blocked');
  });

  // Both figures have to parse for the rule to apply. `VALID` opens against an
  // empty baseline, and failing closed on the absence of a number would refuse
  // gates that are fine.
  it('does not compare what it cannot read, so a baseline naming no figure passes a new id', () => {
    const open = withLine(withLine(VALID, 'status', 'status: open'), 'threshold', 'threshold: load15 3.0');
    expect(evaluate(parseGate(open), 'list-wheel').allowed).toBe(true);
  });

  it('leaves a baseline below its threshold alone, which is the committed case', () => {
    expect(evaluate(parseGate(OPENED), 'list-wheel').allowed).toBe(true);
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

// `load15` is exported and both the reader and this file depend on exactly what
// it does with an awkward value, so it is covered directly rather than only
// through the gates that call it.
describe('load15', () => {
  it('returns null for a value that names no figure', () => {
    expect(load15('banana')).toBeNull();
    expect(load15('')).toBeNull();
    expect(load15('load average 3.0')).toBeNull();
  });

  it('reads a comma terminated figure, which is the shape the summariser writes', () => {
    expect(load15('idle band load15 0.08, containers 3.0% of 2 vCPU, 1.23 GiB container RSS')).toBe(0.08);
  });

  it('reads a figure at the start of a value, with nothing before the keyword', () => {
    expect(load15('load15 0.60 on 2 vCPU')).toBe(0.6);
    expect(load15('load15 0.60')).toBe(0.6);
  });

  it('refuses a figure that does not end where a number ends', () => {
    expect(load15('load15 0.60min')).toBeNull();
    expect(load15('load15 0.60ish')).toBeNull();
  });

  it('accepts the case and colon spellings a human would write', () => {
    expect(load15('Load15 0.60')).toBe(0.6);
    expect(load15('LOAD15 0.60')).toBe(0.6);
    expect(load15('load15: 0.60')).toBe(0.6);
  });

  it('takes the first figure and ignores the rest, which is how reading reads as its band', () => {
    expect(load15('loaded band load15 0.18 max 0.27, peak 7.1%')).toBe(0.18);
    expect(load15('load15 1.0 then load15 9.0')).toBe(1);
  });

  it('reads zero as zero rather than as absent, so the caller can refuse it', () => {
    expect(load15('load15 0')).toBe(0);
  });

  it('coerces a non-string rather than throwing, since it reads whatever the file held', () => {
    expect(load15(42 as unknown as string)).toBeNull();
    expect(load15(undefined as unknown as string)).toBeNull();
  });

  it('does not read a figure glued to a longer word', () => {
    expect(load15('preload15 0.60')).toBeNull();
  });
});
