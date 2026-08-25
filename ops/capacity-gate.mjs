// The Capacity Gate check (AD-9). The deploy workflow runs this before it
// deploys, naming the application id it is about to place. A new id is refused
// while the gate is blocked; an id already in `placements` always passes.
// AD-21 makes that refusal blocking, never a warning.
//
// This file has no dependencies, deliberately. The deploy workflow installs
// nothing, and pulling in a YAML library would put a full `pnpm install` into
// the one path that has to stay simple. So what follows is not a YAML parser
// and must never grow into one: it accepts exactly the shape
// `ops/capacity-gate.yml` has, one level of nesting at most, and throws on
// everything else, nested keys included. Every parse failure becomes a refusal,
// which is the right direction for a gate whose purpose is to fail closed.

import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// One source of truth for the file's name. `GATE_PATH` is what every message
// says; `GATE_FILE` is what the process actually opens, resolved beside this
// module so the checker works from any working directory. Deriving one from the
// other means a rename cannot leave the message naming a file that was never
// read.
const GATE_FILE = 'capacity-gate.yml';
export const GATE_PATH = `ops/${GATE_FILE}`;

// Where the threshold in that file came from, and what a status move requires.
// Named in the refusals rather than left to the reader to find, and exported so
// the test can assert the pointer is still there: a message that quietly stops
// naming the record is how an operator ends up guessing at a number.
export const THRESHOLD_RECORD = 'ops/capacity-threshold.md';

const SCALAR_KEYS = ['measured_at', 'baseline', 'threshold', 'reading', 'status'];
// AD-9 gates on the box's 15-minute load average, so an open gate has to name
// one, and so does the baseline it is compared against. This reader enforces
// two things about those figures and it is worth being exact about which:
//
//   1. Shape. An open gate names a positive load15 figure. That is the hole the
//      Story 1-4 review found: `threshold` was validated only as a non-empty
//      string, so `threshold: banana` would have opened it.
//   2. A file-level comparison. An open gate's own recorded `baseline` sits
//      below its own recorded `threshold`, which is the condition AD-9 puts on
//      moving the status.
//
// Neither is a live reading. Nothing at the call site samples the box:
// `deploy.yml` runs this checker on a GitHub runner, which has no view of the
// origin, so a comparison against the box's actual load would be a claim this
// code cannot keep. The two numbers compared are both written in the file.
//
// The keyword is matched case insensitively and tolerates one colon after it,
// so `Load15 0.60` and `load15: 0.60` both read. The trailing lookahead, rather
// than `\b`, is what stops `load15 0.60min` from reading as 0.60: a figure has
// to end at a space, a comma or the end of the value.
const LOAD15 = /(?:^|\s)load15:?\s+(\d+(?:\.\d+)?)(?=$|[\s,])/i;
const MAP_KEYS = ['overflow'];
const LIST_KEYS = ['placements'];
const KEYS = [...SCALAR_KEYS, ...MAP_KEYS, ...LIST_KEYS];
const STATUSES = ['blocked', 'open'];

// AD-9 requires `overflow` to name the path a refused placement takes, so the
// two keys the refusal message reads are required and the rest are optional.
const OVERFLOW_REQUIRED = ['path', 'provider'];
const OVERFLOW_OPTIONAL = ['scope', 'cost', 'ceiling'];
const PLACEMENT_REQUIRED = ['id'];
const PLACEMENT_OPTIONAL = ['observed', 'note'];

/**
 * The file is not typechecked (tsconfig includes `.ts` and `.mts`, not `.mjs`),
 * so these annotations exist for the test, which is typechecked and is where
 * the contract is asserted.
 *
 * @typedef {{ id: string, observed?: string, note?: string }} Placement
 * @typedef {{ measured_at: string, baseline: string, threshold: string, reading: string,
 *             status: string, overflow: Record<string, string>, placements: Placement[] }} Gate
 * @typedef {{ allowed: boolean, message: string }} Result
 */

/** Thrown only for a gate this reader will not accept, never for a defect in the reader. */
export class GateError extends Error {}

/**
 * The 15-minute load average a gate value names, or `null` where it names none.
 * Exported because `baseline`, `reading` and `threshold` all carry one, and both
 * this reader and the test compare them.
 *
 * **First match wins.** A value naming two figures reads the first one and
 * ignores the rest, which is what makes `reading: loaded band load15 0.18 max
 * 0.27, ...` read as 0.18 rather than as 0.27. That is deliberate: the leading
 * figure in every value the summariser writes is the one that value is about.
 * A value that needs both figures compared needs two keys, not a cleverer
 * regular expression.
 *
 * @param {string} value
 * @returns {number | null}
 */
export function load15(value) {
  const match = LOAD15.exec(String(value).trim());
  return match === null ? null : Number(match[1]);
}

function fail(lineNumber, message) {
  throw new GateError(lineNumber === null ? message : `line ${lineNumber}: ${message}`);
}

function unquote(value) {
  const quoted =
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")));
  return quoted ? value.slice(1, -1) : value;
}

function splitPair(body, lineNumber) {
  const at = body.indexOf(':');
  if (at === -1) fail(lineNumber, `expected "key: value", found ${JSON.stringify(body)}`);
  const key = body.slice(0, at).trim();
  const value = body.slice(at + 1).trim();
  if (!/^[a-z][a-z0-9_]*$/.test(key)) fail(lineNumber, `not a key this reader accepts: ${JSON.stringify(key)}`);
  if (value.includes('#')) fail(lineNumber, 'a value may not contain "#": this reader strips no inline comments');
  return [key, unquote(value)];
}

function checkNestedKeys(where, object, required, optional) {
  for (const key of Object.keys(object)) {
    if (!required.includes(key) && !optional.includes(key)) {
      fail(null, `unknown key ${JSON.stringify(key)} under ${where}. Accepted: ${[...required, ...optional].join(', ')}`);
    }
  }
  for (const key of required) {
    if (!Object.hasOwn(object, key) || object[key] === '') {
      fail(null, `${where} is missing a non-empty ${JSON.stringify(key)}`);
    }
  }
}

/**
 * Read the gate's text into an object, or throw. Throwing is a refusal.
 *
 * @param {string} text
 * @returns {Gate}
 */
export function parseGate(text) {
  // A leading byte order mark would otherwise read as indentation on line 1 and
  // refuse a gate that is perfectly good, blocking every deploy.
  const lines = text.replace(/^\uFEFF/, '').split('\n');
  const gate = {};
  const seen = new Set();
  let context = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].replace(/\r$/, '');
    const lineNumber = index + 1;

    if (line.includes('\t')) fail(lineNumber, 'tab indentation is not accepted');
    const body = line.trim();
    if (body === '' || body.startsWith('#')) continue;

    const indent = line.length - line.trimStart().length;

    if (indent === 0) {
      const [key, value] = splitPair(body, lineNumber);
      if (!KEYS.includes(key)) {
        fail(lineNumber, `unknown key ${JSON.stringify(key)}. The gate has exactly: ${KEYS.join(', ')}`);
      }
      if (seen.has(key)) fail(lineNumber, `duplicate key ${JSON.stringify(key)}`);
      seen.add(key);

      if (LIST_KEYS.includes(key)) {
        if (value !== '') fail(lineNumber, `${key} is a list on the lines below, not an inline value`);
        gate[key] = [];
        context = key;
      } else if (MAP_KEYS.includes(key)) {
        if (value !== '') fail(lineNumber, `${key} is a block on the lines below, not an inline value`);
        // A null prototype, so a key named `constructor` is data rather than an
        // inherited property that reads as a duplicate.
        gate[key] = Object.create(null);
        context = key;
      } else {
        gate[key] = value;
        context = null;
      }
      continue;
    }

    if (context === 'overflow' && indent === 2) {
      const [key, value] = splitPair(body, lineNumber);
      if (Object.hasOwn(gate.overflow, key)) fail(lineNumber, `duplicate key ${JSON.stringify(key)} under overflow`);
      gate.overflow[key] = value;
      continue;
    }

    if (context === 'placements' && indent === 2 && body.startsWith('- ')) {
      const [key, value] = splitPair(body.slice(2), lineNumber);
      const entry = Object.create(null);
      entry[key] = value;
      gate.placements.push(entry);
      continue;
    }

    if (context === 'placements' && indent === 4) {
      const entry = gate.placements[gate.placements.length - 1];
      if (entry === undefined) fail(lineNumber, 'a placements field appeared before any list item');
      const [key, value] = splitPair(body, lineNumber);
      if (Object.hasOwn(entry, key)) fail(lineNumber, `duplicate key ${JSON.stringify(key)} in a placements entry`);
      entry[key] = value;
      continue;
    }

    fail(lineNumber, `unexpected indentation or shape: ${JSON.stringify(line)}`);
  }

  for (const key of KEYS) {
    if (!seen.has(key)) fail(null, `missing key ${JSON.stringify(key)}`);
  }
  if (!STATUSES.includes(gate.status)) {
    fail(null, `status is ${JSON.stringify(gate.status)}. Accepted values: ${STATUSES.join(', ')}`);
  }

  checkNestedKeys('overflow', gate.overflow, OVERFLOW_REQUIRED, OVERFLOW_OPTIONAL);

  if (gate.placements.length === 0) fail(null, 'placements is empty');
  const ids = [];
  for (const entry of gate.placements) {
    checkNestedKeys('a placements entry', entry, PLACEMENT_REQUIRED, PLACEMENT_OPTIONAL);
    if (ids.includes(entry.id)) fail(null, `duplicate placement id ${JSON.stringify(entry.id)}`);
    ids.push(entry.id);
  }

  if (gate.status === 'open') {
    const written = gate.threshold.trim();
    if (written === '') {
      fail(null, 'status is open while threshold is empty. A gate cannot be open on an unmeasured box (AD-9)');
    }
    const figure = load15(written);
    if (figure === null) {
      fail(
        null,
        `status is open while threshold ${JSON.stringify(written)} names no load15 figure. AD-9 gates on the ` +
          'box 15-minute load average, so an open gate has to carry one, written as "load15 0.60". A threshold ' +
          'nobody can act on is not a threshold'
      );
    }
    if (figure <= 0) {
      fail(
        null,
        `status is open while threshold names load15 ${figure}. Zero is not a capacity line, so this gate would ` +
          'be open against nothing (AD-9)'
      );
    }
  }

  // The comparison AD-9 puts on the status is NOT made here, deliberately.
  // Every refusal in this function is syntactic: the file cannot be read, so
  // nothing can be decided from it and it says no to everything, incumbents
  // included. A gate recording a baseline that has reached its threshold is a
  // different thing. It is perfectly readable and it is saying something
  // specific, so it is answered where placement is decided, in `evaluate`, and
  // an id already in `placements` still passes. See the note there.

  return gate;
}

function refusal(detail) {
  return ['capacity gate: REFUSED', ...detail].join('\n');
}

/**
 * Decide whether `id` may be placed. Returns a result rather than exiting, so
 * the tests can assert on the same code path the deploy workflow runs.
 *
 * Three states, not two. `open` and `blocked` are what the file says; the third
 * is a gate that says `open` while its own recorded `baseline` has reached its
 * own recorded `threshold`, which is AD-9's condition on the status contradicted
 * by the file's own numbers. That is refused for a new id and treated as blocked
 * until the status is corrected.
 *
 * @param {Gate} gate
 * @param {string} id
 * @returns {Result}
 */
export function evaluate(gate, id) {
  const wanted = String(id).trim();
  const ids = gate.placements.map((entry) => entry.id);

  // Before the status is consulted, in every state, because AD-9 says existing
  // ids always deploy and NFR-2 is never traded against the gate. This is why
  // the contradiction below is answered here and not while parsing: the parser
  // refuses a gate outright, and `.github/workflows/deploy.yml` names an
  // incumbent, so a parse-level refusal could only ever have stopped the Anchor
  // deploying while never once refusing the new id the rule exists to refuse.
  if (ids.includes(wanted)) {
    return { allowed: true, message: `capacity gate: ${wanted} is in placements, the deploy may proceed` };
  }

  if (gate.status === 'open') {
    // Both figures have to parse for the rule to apply. Where `baseline` names
    // none, nothing is compared and the gate is read as it is written: failing
    // closed on the absence of a number would refuse gates that are fine.
    const threshold = load15(gate.threshold);
    const measured = load15(gate.baseline);
    if (threshold !== null && measured !== null && measured >= threshold) {
      return {
        allowed: false,
        message: refusal([
          `  ${GATE_PATH} reads status: open, but its own baseline names load15 ${measured} and its own`,
          `  threshold names load15 ${threshold}. A gate is open only while the measured baseline sits`,
          '  below the written threshold (AD-9), so this one is treated as blocked until the status is',
          `  corrected. ${JSON.stringify(wanted)} is not in placements and may not be placed.`,
          `  Re-derive the threshold or set status: blocked. Both acts are described in ${THRESHOLD_RECORD}`,
          `  Ids that pass regardless, because continuity is never traded against the gate: ${ids.join(', ')}`,
          `  If it has to ship anyway, the decided overflow is ${gate.overflow.path} (${gate.overflow.provider}).`,
        ]),
      };
    }
    return {
      allowed: true,
      message: `capacity gate: status is open against a threshold of ${gate.threshold}, ${wanted} may be placed`,
    };
  }
  return {
    allowed: false,
    message: refusal([
      `  ${GATE_PATH} has status: blocked, and placements does not list ${JSON.stringify(wanted)}.`,
      '  Unproven capacity fails closed (AD-9). A blocked gate refuses every new application id',
      '  whatever threshold is written beside it, so what has to change is the status, and only',
      '  against a measurement that supports it.',
      `  How a threshold is derived and what authorises a status move: ${THRESHOLD_RECORD}`,
      `  Ids that pass today: ${ids.join(', ')}`,
      `  If it has to ship anyway, the decided overflow is ${gate.overflow.path} (${gate.overflow.provider}).`,
    ]),
  };
}

/**
 * The whole CLI as a function. `readFile` is injectable so a test can exercise
 * an unreadable gate without deleting the committed one.
 *
 * @param {string[]} argv
 * @param {(path: URL, encoding: string) => string} [readFile]
 * @returns {Result}
 */
export function main(argv, readFile = readFileSync) {
  const id = typeof argv[0] === 'string' ? argv[0].trim() : '';
  if (id === '') {
    return {
      allowed: false,
      message: refusal([
        '  usage: node ops/capacity-gate.mjs <id>',
        `  No application id was given, so nothing could be checked against ${GATE_PATH}.`,
      ]),
    };
  }

  let text;
  try {
    text = readFile(new URL(GATE_FILE, import.meta.url), 'utf8');
  } catch (error) {
    return {
      allowed: false,
      message: refusal([
        `  ${GATE_PATH} could not be read: ${error instanceof Error ? error.message : String(error)}`,
        '  A gate that is not there refuses. Absence is never read as permission.',
      ]),
    };
  }

  try {
    return evaluate(parseGate(text), id);
  } catch (error) {
    // Only a rejected gate is reported as a rejected gate. A defect in this
    // checker escapes as itself rather than sending the reader to edit a file
    // that is fine, and an uncaught throw still exits non-zero.
    if (!(error instanceof GateError)) throw error;
    return {
      allowed: false,
      message: refusal([
        `  ${GATE_PATH} is not a gate this reader accepts. ${error.message}`,
        '  A gate that cannot read itself must not be the thing that says yes.',
      ]),
    };
  }
}

function sameFile(a, b) {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return false;
  }
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && sameFile(process.argv[1], fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const result = main(process.argv.slice(2));
  const stream = result.allowed ? process.stdout : process.stderr;
  // Exit from the write callback. On a pipe, which is what a CI runner gives
  // this process, `process.exit` can otherwise cut the message off mid flush
  // and leave a failing step with nothing explaining why.
  stream.write(`${result.message}\n`, () => process.exit(result.allowed ? 0 : 1));
}
