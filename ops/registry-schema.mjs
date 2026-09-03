// The Registry schema gate (AD-4, AD-5, AD-21). The `registry-schema` job in
// `.github/workflows/ci.yml` runs this on every push and on every pull request
// to `main`.
//
// AD-4 makes `contracts/registry.json` the estate's only App Registry and
// `contracts/registry.schema.json` the thing that fixes its shape: the file
// carries `$schema` so an editor validates while the entries are written, and
// CI validates and fails the build so a malformed entry cannot ship. AD-21 lists
// "Registry schema validation" among the gates that may never become a warning,
// because there is one environment and no staging and a Registry is read by
// every consumer in every estate language.
//
// This file has no dependencies, deliberately, and imports only `node:`
// builtins, which is why the job installs nothing. The Registry is therefore
// still validated on the run where `pnpm install --frozen-lockfile` fails.
//
// **Nothing redirects this check at runtime.** No environment variable and no
// argument selects which files are read: both paths are fixed in the source
// below and resolved beside this module, so the gate works from any working
// directory and no caller can point it at a file that happens to be valid. Same
// argument as `ops/contract-purity.mjs`, whose CLI half this file copies.
//
// **The validator implements a fixed keyword set, and a keyword outside it is a
// refusal.** A validator that silently ignores a keyword is green over the rule
// it never applied, which is the worst possible failure for a gate whose whole
// job is that the schema and the check agree. The audit runs before the Registry
// is even parsed, so an unsupported keyword can never be reported as a valid
// instance.
//
// **Four rules are enforced beyond the schema.** Uniqueness of `id` across
// entries, `absorbed_into` naming an entry that exists and is not itself, a
// `family` value being shared rather than carried alone, and the mechanizable
// half of FR-8's editorial contract. Draft-07 can express none of the four. The
// first three are each a statement about the entries as a set rather than about
// one value; the fourth is a rule that has to name the word it found, which a
// schema refusal cannot do. They are applied here as named rules, said so in the
// refusal, and recorded in `ops/registry-schema.md`: the editor will not catch
// any of them.

import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// One source of truth for the two files. These are what every message says AND
// what the process opens: `beside()` resolves them against this module, so a
// move cannot leave a message naming a file that was never read.
export const SCHEMA = 'contracts/registry.schema.json';
export const REGISTRY = 'contracts/registry.json';

/** What each file must carry, named in the refusal when it cannot be read. */
const MUST_CARRY = {
  [SCHEMA]: 'the draft-07 schema that fixes AD-5\'s entry shape',
  [REGISTRY]: 'the envelope carrying $schema, contract_version and the application list (AD-4)',
};

/** The rules this gate applies beyond the schema, worded once for all four. */
export const BEYOND_THE_SCHEMA =
  'This is one of the four rules this gate applies beyond the schema, none of which draft-07 can' +
  ' express, and the editor will not catch it.';

/** @param {string} relative */
const beside = (relative) => fileURLToPath(new URL(`../${relative}`, import.meta.url));

// The byte order mark, written as an escape and never as the character itself:
// an invisible U+FEFF sitting in a source file is precisely the defect this
// constant exists to handle one level up.
const BOM = '\uFEFF';

// ---------------------------------------------------------------------------
// Printing
// ---------------------------------------------------------------------------

// The same five classes `ops/contract-purity.mjs` escapes, for the same reason
// and with the same injectivity property: a value carrying a newline would
// otherwise forge a line inside a refusal that reads like this file's own prose,
// and a bidirectional override or a zero-width character lets two different
// values be drawn identically in an operator's log. A backslash is escaped too,
// so no two distinct strings print as one. Any text with no backslash and no
// escaped code point, which is every value the Registry will ever carry, is
// returned unchanged byte for byte. The reasoning is written out once, in
// `ops/contract-purity.md` under "Characters that forge or disguise a line".
const FORGES_A_LINE = new Set([0x2028, 0x2029]);
const DRAWS_AS_NOTHING = new Set([0x00ad, 0x061c, 0x200b, 0x200c, 0x200d, 0xfeff]);
const REORDERS_TEXT = (/** @type {number} */ point) =>
  (point >= 0x200e && point <= 0x200f) ||
  (point >= 0x202a && point <= 0x202e) ||
  (point >= 0x2066 && point <= 0x2069);
const IS_A_CONTROL = (/** @type {number} */ point) => point >= 0x80 && point <= 0x9f;

// The C0 range and DEL. Named, so the two escapers below can be held to the same
// answer about them: they were not, and DEL reached an operator's log as itself
// through `show()` while `printable()` escaped it.
const IS_C0_OR_DEL = (/** @type {number} */ point) => point < 0x20 || point === 0x7f;

/**
 * True for every code point that forges a line, rewrites one, or is drawn as
 * something other than what it is. One predicate, so `printable` and
 * `escapeInvisible` cannot disagree about which characters are dangerous. They
 * differ only in what they do to a backslash, and that difference is argued
 * where `escapeInvisible` is defined.
 *
 * @param {number} point
 */
const HIDES = (point) =>
  IS_C0_OR_DEL(point) ||
  IS_A_CONTROL(point) ||
  DRAWS_AS_NOTHING.has(point) ||
  FORGES_A_LINE.has(point) ||
  REORDERS_TEXT(point);

/** @param {string} text */
export function printable(text) {
  return [...String(text)]
    .map((character) => {
      const point = character.codePointAt(0) ?? 0;
      if (character === '\\') return String.raw`\\`;
      if (!HIDES(point)) {
        return character;
      }
      if (character === '\n') return String.raw`\n`;
      if (character === '\r') return String.raw`\r`;
      if (character === '\t') return String.raw`\t`;
      const width = point > 0xff ? 4 : 2;
      return `\\${width === 4 ? 'u' : 'x'}${point.toString(16).padStart(width, '0')}`;
    })
    .join('');
}

/** How many code points of a quoted instance value are printed before it is cut. */
const SHOWN = 120;

/**
 * The escaping applied on top of `JSON.stringify`.
 *
 * `JSON.stringify` escapes the quote and the backslash, and the C0 range as
 * `\n`, `\t` and `\u00XX`, so the backslashes it wrote are left as they are
 * here: doubling them would print every authored newline as `\\n`, which is
 * noise rather than safety. What it does **not** escape is DEL, the C1 controls,
 * U+2028 and U+2029, the bidirectional overrides and the code points drawn as
 * nothing, and each of those forges or disguises a line exactly as a raw newline
 * would. `HIDES` is the shared predicate, so this and `printable` cannot come to
 * different answers about a character; the C0 range appears in it too and is
 * simply never reached here, because `JSON.stringify` got there first.
 *
 * @param {string} text
 */
const escapeInvisible = (text) =>
  [...text]
    .map((character) => {
      const point = character.codePointAt(0) ?? 0;
      if (!HIDES(point)) return character;
      return `\\u${point.toString(16).padStart(4, '0')}`;
    })
    .join('');

/**
 * A value as it is safe to quote in a message.
 *
 * **Injective up to truncation, and not past it.** The escaping itself maps two
 * distinct values to two distinct strings, but a value longer than `SHOWN` is
 * cut, and two values agreeing on their first `SHOWN` code points then print
 * identically. That is a deliberate trade: a Registry entry is hand-authored and
 * an `id` or a URL that long is already the defect. The cut is by **code point**
 * rather than by UTF-16 code unit, so it can never split a surrogate pair and
 * emit a lone surrogate, which is the one way this could produce a string
 * neither escaper is able to describe.
 *
 * @param {unknown} value
 */
const show = (value) => {
  if (value === undefined) return 'nothing';
  const text = JSON.stringify(value) ?? String(value);
  const points = [...text];
  return escapeInvisible(points.length > SHOWN ? `${points.slice(0, SHOWN - 3).join('')}...` : text);
};

/** A quoted key or keyword name. */
const q = (/** @type {string} */ name) => `"${printable(name)}"`;

const code = (/** @type {unknown} */ error) => {
  // The `code` rather than the `message`: an ENOENT message carries the absolute
  // path it tried, which differs between a Windows checkout and a runner, and
  // the gate must print one string on both.
  if (error instanceof Error && typeof (/** @type {{ code?: unknown }} */ (error).code) === 'string') {
    return String(/** @type {{ code?: unknown }} */ (error).code);
  }
  return error instanceof Error ? error.message : String(error);
};

// ---------------------------------------------------------------------------
// JSON Pointers (RFC 6901)
// ---------------------------------------------------------------------------

/** @param {string|number} token */
const escapeToken = (token) => String(token).replace(/~/g, '~0').replace(/\//g, '~1');

/**
 * @param {string} base
 * @param {string|number} token
 */
const at = (base, token) => `${base}/${escapeToken(token)}`;

/**
 * A pointer as it is safe to print. Escaped, because a pointer is built from
 * property names and a schema or a Registry may carry a name holding a newline
 * or a bidirectional override; unescaped, such a name forges a line inside the
 * refusal exactly as a value does. The whole document has the empty pointer,
 * which reads as nothing at all, so it is given a word instead.
 *
 * @param {string} pointer
 * @param {string} empty
 */
const pointerText = (pointer, empty) => (pointer === '' ? empty : printable(pointer));

/** A pointer into the Registry. */
const where = (/** @type {string} */ pointer) => pointerText(pointer, '(the document root)');

/** A pointer into the schema. */
const inSchema = (/** @type {string} */ pointer) => pointerText(pointer, '(the schema root)');

// ---------------------------------------------------------------------------
// The fixed keyword set
// ---------------------------------------------------------------------------

/**
 * Every keyword this validator implements, and what its value is.
 *
 *   `annotation`         asserts nothing, and is implemented by knowing that
 *   `ref`                a local `#/definitions/<name>` reference
 *   `named-schemas`      an object of name to subschema
 *   `schema`             one subschema
 *   `schema-or-boolean`  one subschema, or `true`/`false`
 *   `schema-list`        a non-empty array of subschemas
 *   `assertion`          a leaf rule applied to the instance
 *
 * `enumDescriptions` is VS Code's own annotation for saying what each `enum`
 * value means. Draft-07 has no way to do that without `oneOf` plus `const` per
 * value, and `oneOf` is not implemented here on purpose (see
 * `ops/registry-schema.md`). It asserts nothing; the audit below holds it to one
 * description per enum member, so "every enum value carries a description"
 * stays mechanically true rather than being a claim about the author's care.
 */
const KEYWORD_KIND = {
  $schema: 'annotation',
  $id: 'annotation',
  title: 'annotation',
  description: 'annotation',
  enumDescriptions: 'annotation',
  $ref: 'ref',
  definitions: 'named-schemas',
  properties: 'named-schemas',
  items: 'schema',
  if: 'schema',
  then: 'schema',
  else: 'schema',
  not: 'schema',
  additionalProperties: 'schema-or-boolean',
  allOf: 'schema-list',
  type: 'assertion',
  enum: 'assertion',
  const: 'assertion',
  required: 'assertion',
  minLength: 'assertion',
  pattern: 'assertion',
  minItems: 'assertion',
  uniqueItems: 'assertion',
};

/** The implemented set, sorted, as a message and a test can both read it. */
export const KEYWORDS = Object.keys(KEYWORD_KIND).sort();

/** The JSON types `type` may name. */
const TYPES = ['array', 'boolean', 'integer', 'null', 'number', 'object', 'string'];

/** Only a local definition reference is implemented. */
const LOCAL_REF = /^#\/definitions\/[A-Za-z0-9_-]+$/;

// ---------------------------------------------------------------------------
// Reading the two files
// ---------------------------------------------------------------------------

const isPlainObject = (/** @type {unknown} */ value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * @typedef {{ label: string, text: string | null, error: string | null }} Source
 * @typedef {{ pointer: string, detail: string }} Unsupported
 * @typedef {{ instance: string, rule: string, schema: string | null, detail: string, note: string | null }} Violation
 * @typedef {{ stage: 'unread' | 'unparsed' | 'unsupported' | 'validated',
 *             unread: { label: string, error: string }[],
 *             unparsed: { label: string, error: string }[],
 *             unsupported: Unsupported[],
 *             violations: Violation[],
 *             applied: string[],
 *             entries: number | null }} Inspection
 * @typedef {{ ok: boolean, message: string }} Result
 */

/**
 * Read one of the two fixed files. The label is the path: there is no second
 * name for a file here, so no message can name one thing while the process opens
 * another.
 *
 * @param {string} label
 * @returns {Source}
 */
function readSource(label) {
  try {
    return { label, text: readFileSync(beside(label), 'utf8'), error: null };
  } catch (error) {
    return { label, text: null, error: code(error) };
  }
}

// ---------------------------------------------------------------------------
// The schema audit: every keyword, before any instance is validated
// ---------------------------------------------------------------------------

/**
 * Walk the schema and report every keyword outside the implemented set, plus
 * every implemented keyword whose value this validator could not apply.
 *
 * Returns findings rather than throwing, so the tests exercise the same code
 * path the CI job runs, and every finding in one schema is reported rather than
 * only the first.
 *
 * @param {unknown} schema
 * @returns {Unsupported[]}
 */
export function auditSchema(schema) {
  /** @type {Unsupported[]} */
  const findings = [];
  const say = (/** @type {string} */ pointer, /** @type {string} */ detail) =>
    findings.push({ pointer, detail });

  /**
   * @param {unknown} node
   * @param {string} pointer
   */
  const walk = (node, pointer) => {
    if (!isPlainObject(node)) {
      say(
        pointer,
        `${inSchema(pointer)} is ${show(node)} where a subschema was expected. Only an object schema is` +
          ' implemented, so nothing here could be applied'
      );
      return;
    }

    const keys = Object.keys(node);
    if (Object.hasOwn(node, '$ref') && keys.length > 1) {
      // Draft-07 discards every sibling of `$ref`. An editor would apply the
      // reference alone while the schema read as though the siblings bound, so
      // the gate refuses rather than enforcing a rule the editor never applies.
      say(
        pointer,
        `${inSchema(pointer)} carries $ref beside ${keys.filter((key) => key !== '$ref').map(q).join(', ')}.` +
          ' Draft-07 ignores every sibling of $ref, so those rules would bind here and nowhere else'
      );
    }

    if (Object.hasOwn(node, 'if') && !Object.hasOwn(node, 'then') && !Object.hasOwn(node, 'else')) {
      // The same failure the whole keyword audit exists to prevent, one level
      // down: an `if` with no branch is evaluated and its result discarded, so
      // the condition reads like a rule and asserts nothing at all. Both halves
      // of the `live` condition are written this way, and losing a `then` in an
      // edit would leave the schema looking as though it still carried them.
      say(
        pointer,
        `${inSchema(pointer)} carries "if" with neither "then" nor "else". The condition would be` +
          ' evaluated and its answer thrown away, so it asserts nothing'
      );
    }

    for (const key of keys) {
      const spot = at(pointer, key);
      const kind = /** @type {string | undefined} */ (
        /** @type {Record<string, string>} */ (KEYWORD_KIND)[key]
      );
      const value = /** @type {Record<string, unknown>} */ (node)[key];

      if (kind === undefined) {
        say(
          spot,
          key === 'format'
            ? 'the "format" keyword, which this gate does not implement on purpose: it is' +
                ' annotation-only in some validators and an assertion in others, so the editor and the' +
                ' gate would disagree about what the schema asserts. Constrain the value with' +
                ' "pattern" instead'
            : `the ${q(key)} keyword, which this validator does not implement. A keyword nothing` +
                ' applies is a rule the gate is green over, so it is refused rather than ignored.' +
                ` The implemented set is ${KEYWORDS.join(', ')}`
        );
        continue;
      }

      if (kind === 'ref') {
        if (typeof value !== 'string' || !LOCAL_REF.test(value)) {
          say(spot, `a $ref of ${show(value)}. Only a local #/definitions/<name> reference is implemented`);
        } else if (!isPlainObject(/** @type {Record<string, unknown>} */ (schema).definitions) ||
          !Object.hasOwn(
            /** @type {Record<string, unknown>} */ (
              /** @type {Record<string, unknown>} */ (schema).definitions
            ),
            value.slice('#/definitions/'.length)
          )
        ) {
          say(spot, `a $ref to ${show(value)}, which this schema does not define`);
        }
        continue;
      }

      if (kind === 'named-schemas') {
        if (!isPlainObject(value)) {
          say(spot, `${q(key)} is ${show(value)} rather than an object of subschemas`);
          continue;
        }
        for (const name of Object.keys(value)) {
          walk(/** @type {Record<string, unknown>} */ (value)[name], at(spot, name));
        }
        continue;
      }

      if (kind === 'schema') {
        walk(value, spot);
        continue;
      }

      if (kind === 'schema-or-boolean') {
        if (typeof value !== 'boolean') walk(value, spot);
        continue;
      }

      if (kind === 'schema-list') {
        if (!Array.isArray(value) || value.length === 0) {
          say(spot, `${q(key)} is ${show(value)} rather than a non-empty array of subschemas`);
          continue;
        }
        value.forEach((member, index) => walk(member, at(spot, index)));
        continue;
      }

      if (kind === 'annotation') {
        if (key === 'enumDescriptions') {
          const en = /** @type {Record<string, unknown>} */ (node).enum;
          if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
            say(spot, 'enumDescriptions is not an array of strings');
          } else if (!Array.isArray(en)) {
            say(spot, 'enumDescriptions sits beside no enum, so it describes nothing');
          } else if (en.length !== value.length) {
            say(
              spot,
              `${en.length} enum value(s) and ${value.length} description(s). Every enum value carries` +
                ' a description saying what it means, so the two lists are the same length'
            );
          }
        }
        continue;
      }

      // `assertion`: a leaf rule, checked here for a value this validator can
      // actually apply. A `pattern` that will not compile, or a `type` naming
      // something that is not a JSON type, is a rule nothing enforces.
      if (key === 'type' && (typeof value !== 'string' || !TYPES.includes(value))) {
        say(spot, `a type of ${show(value)}. Only one of ${TYPES.join(', ')}, as a string, is implemented`);
      }
      if (key === 'enum' && (!Array.isArray(value) || value.length === 0)) {
        say(spot, `an enum of ${show(value)} rather than a non-empty array`);
      }
      if (key === 'required' && (!Array.isArray(value) || value.some((name) => typeof name !== 'string'))) {
        say(spot, `a required of ${show(value)} rather than an array of property names`);
      }
      if ((key === 'minLength' || key === 'minItems') && !(Number.isInteger(value) && Number(value) >= 0)) {
        say(spot, `${q(key)} is ${show(value)} rather than a non-negative integer`);
      }
      if (key === 'uniqueItems' && typeof value !== 'boolean') {
        say(spot, `uniqueItems is ${show(value)} rather than a boolean`);
      }
      if (key === 'pattern') {
        if (typeof value !== 'string') {
          say(spot, `a pattern of ${show(value)} rather than a string`);
        } else {
          try {
            new RegExp(value);
          } catch (error) {
            say(spot, `a pattern that will not compile: ${printable(code(error))}`);
          }
        }
      }
    }
  };

  walk(schema, '');
  return findings.sort((a, b) => (a.pointer < b.pointer ? -1 : a.pointer > b.pointer ? 1 : 0));
}

// ---------------------------------------------------------------------------
// The validator
// ---------------------------------------------------------------------------

/** @param {unknown} value */
const typeOf = (value) => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
};

/**
 * @param {string} type
 * @param {unknown} value
 */
const matchesType = (type, value) => {
  const found = typeOf(value);
  return type === 'number' ? found === 'number' || found === 'integer' : found === type;
};

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function deepEqual(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((entry, index) => deepEqual(entry, b[index]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const left = /** @type {Record<string, unknown>} */ (a);
    const right = /** @type {Record<string, unknown>} */ (b);
    const keys = Object.keys(left);
    return (
      keys.length === Object.keys(right).length &&
      keys.every((key) => Object.hasOwn(right, key) && deepEqual(left[key], right[key]))
    );
  }
  return false;
}

/**
 * Apply one subschema to one value, appending every violation to `out`.
 *
 * `instance` and `schema` are both JSON Pointers, so a refusal says where in the
 * data the defect is and which rule in the schema rejected it. The schema
 * pointer is what makes a violation traceable back to a line an author can edit.
 *
 * @param {Record<string, unknown>} root
 * @param {unknown} node
 * @param {unknown} value
 * @param {string} instance
 * @param {string} schema
 * @param {Violation[]} out
 */
function apply(root, node, value, instance, schema, out) {
  if (!isPlainObject(node)) return;
  const rules = /** @type {Record<string, unknown>} */ (node);

  // Draft-07 resolves `$ref` and discards its siblings. The audit refuses a
  // node that carries both, so this branch never silently drops a rule.
  if (typeof rules.$ref === 'string') {
    const name = rules.$ref.slice('#/definitions/'.length);
    const definitions = /** @type {Record<string, unknown>} */ (root.definitions ?? {});
    apply(root, definitions[name], value, instance, at(at('#', 'definitions'), name), out);
    return;
  }

  const note = typeof rules.description === 'string' ? rules.description : null;
  /**
   * @param {string} rule
   * @param {string} detail
   * @param {{ instance?: string, schema?: string, note?: string | null }} [override]
   */
  const push = (rule, detail, override = {}) =>
    out.push({
      instance: override.instance ?? instance,
      rule,
      schema: override.schema ?? at(schema, rule),
      detail,
      note: override.note === undefined ? note : override.note,
    });

  if (typeof rules.type === 'string' && !matchesType(rules.type, value)) {
    // Reported and then stopped. Every keyword below guards its own type, so a
    // wrong-typed value would otherwise produce a second and a third complaint
    // about one defect and inflate the count an operator reads.
    push('type', `expected ${rules.type}, found ${typeOf(value)}: ${show(value)}`);
    return;
  }

  if (Array.isArray(rules.enum) && !rules.enum.some((allowed) => deepEqual(allowed, value))) {
    push(
      'enum',
      `${show(value)} is not one of the ${rules.enum.length} permitted values: ` +
        rules.enum.map(show).join(', ')
    );
  }

  if (Object.hasOwn(rules, 'const') && !deepEqual(rules.const, value)) {
    push('const', `${show(value)} is not ${show(rules.const)}`);
  }

  if (typeof value === 'string') {
    if (typeof rules.minLength === 'number' && [...value].length < rules.minLength) {
      push('minLength', `${show(value)} is shorter than the ${rules.minLength} character(s) required here`);
    }
    if (typeof rules.pattern === 'string' && !new RegExp(rules.pattern).test(value)) {
      push('pattern', `${show(value)} does not match ${q(rules.pattern)}`);
    }
  }

  if (Array.isArray(value)) {
    if (typeof rules.minItems === 'number' && value.length < rules.minItems) {
      push('minItems', `${value.length} item(s), where at least ${rules.minItems} is required`);
    }
    if (rules.uniqueItems === true) {
      for (let index = 0; index < value.length; index += 1) {
        const first = value.findIndex((other) => deepEqual(other, value[index]));
        if (first < index) {
          push('uniqueItems', `${show(value[index])} already appears at index ${first}`, {
            instance: at(instance, index),
          });
        }
      }
    }
    if (Object.hasOwn(rules, 'items')) {
      value.forEach((entry, index) =>
        apply(root, rules.items, entry, at(instance, index), at(schema, 'items'), out)
      );
    }
  }

  if (isPlainObject(value)) {
    const held = /** @type {Record<string, unknown>} */ (value);
    const properties = isPlainObject(rules.properties)
      ? /** @type {Record<string, unknown>} */ (rules.properties)
      : {};

    if (Array.isArray(rules.required)) {
      for (const name of rules.required) {
        if (Object.hasOwn(held, String(name))) continue;
        // The missing field's OWN description, when the schema gives it one.
        // That is where AD-5's "absence is never a permitted way to say not
        // applicable" is written, so the refusal quotes the rule rather than
        // paraphrasing it, and the editor shows an author the same sentence.
        const own = properties[String(name)];
        const carried = isPlainObject(own) && typeof (/** @type {Record<string, unknown>} */ (own).description) === 'string'
          ? String(/** @type {Record<string, unknown>} */ (own).description)
          : note;
        push('required', `${q(String(name))} is required here and is absent`, { note: carried });
      }
    }

    for (const name of Object.keys(held)) {
      if (!Object.hasOwn(properties, name)) continue;
      apply(root, properties[name], held[name], at(instance, name), at(at(schema, 'properties'), name), out);
    }

    if (rules.additionalProperties === false) {
      const known = Object.keys(properties);
      for (const name of Object.keys(held)) {
        if (known.includes(name)) continue;
        push(
          'additionalProperties',
          `${q(name)} is not a field this schema defines, and additionalProperties is false here.` +
            ` The fields it defines are ${known.map(q).join(', ')}`,
          { instance: at(instance, name) }
        );
      }
    } else if (isPlainObject(rules.additionalProperties)) {
      const known = Object.keys(properties);
      for (const name of Object.keys(held)) {
        if (known.includes(name)) continue;
        apply(
          root,
          rules.additionalProperties,
          held[name],
          at(instance, name),
          at(schema, 'additionalProperties'),
          out
        );
      }
    }
  }

  if (Array.isArray(rules.allOf)) {
    rules.allOf.forEach((member, index) =>
      apply(root, member, value, instance, at(at(schema, 'allOf'), index), out)
    );
  }

  if (Object.hasOwn(rules, 'if')) {
    /** @type {Violation[]} */
    const scratch = [];
    apply(root, rules.if, value, instance, at(schema, 'if'), scratch);
    const matched = scratch.length === 0;
    if (matched && Object.hasOwn(rules, 'then')) {
      apply(root, rules.then, value, instance, at(schema, 'then'), out);
    }
    if (!matched && Object.hasOwn(rules, 'else')) {
      apply(root, rules.else, value, instance, at(schema, 'else'), out);
    }
  }

  if (Object.hasOwn(rules, 'not')) {
    /** @type {Violation[]} */
    const scratch = [];
    apply(root, rules.not, value, instance, at(schema, 'not'), scratch);
    if (scratch.length === 0) {
      push('not', 'this value matches a shape the schema forbids here', {
        schema: at(schema, 'not'),
      });
    }
  }
}

/** Two runs over one tree print one string, so every list is ordered here. */
const order = (/** @type {Violation} */ a, /** @type {Violation} */ b) => {
  const left = `${a.instance} ${a.schema ?? ''} ${a.rule} ${a.detail}`;
  const right = `${b.instance} ${b.schema ?? ''} ${b.rule} ${b.detail}`;
  return left < right ? -1 : left > right ? 1 : 0;
};

/**
 * Validate an instance against a schema. Every violation is collected rather
 * than stopping at the first: a run that names one of three defects costs three
 * CI runs to clear.
 *
 * @param {unknown} schema
 * @param {unknown} instance
 * @returns {Violation[]}
 */
export function validate(schema, instance) {
  if (!isPlainObject(schema)) return [];
  /** @type {Violation[]} */
  const violations = [];
  apply(/** @type {Record<string, unknown>} */ (schema), schema, instance, '', '#', violations);
  return violations.sort(order);
}

/**
 * The first of the three rules beyond the schema: no two entries share an `id`.
 *
 * Draft-07 has no way to say it, so it is applied here, named in the refusal,
 * and recorded as a stated limit. AD-3 makes the id the name every other
 * identifier is derived from, so two entries sharing one is two applications
 * claiming the same image, the same compose service and the same database.
 *
 * @param {unknown} instance
 * @returns {Violation[]}
 */
export function duplicateIds(instance) {
  /** @type {Violation[]} */
  const violations = [];
  if (!isPlainObject(instance)) return violations;
  const applications = /** @type {Record<string, unknown>} */ (instance).applications;
  if (!Array.isArray(applications)) return violations;

  /** @type {Map<string, number>} */
  const first = new Map();
  applications.forEach((entry, index) => {
    if (!isPlainObject(entry)) return;
    const id = /** @type {Record<string, unknown>} */ (entry).id;
    if (typeof id !== 'string') return;
    const seen = first.get(id);
    if (seen === undefined) {
      first.set(id, index);
      return;
    }
    violations.push({
      instance: `/applications/${index}/id`,
      rule: 'unique id',
      schema: null,
      detail: `the id ${show(id)} is already carried by /applications/${seen} (AD-3: one id per application)`,
      note: BEYOND_THE_SCHEMA,
    });
  });

  return violations.sort(order);
}

/**
 * The application list, or `null` when there is nothing here this gate can walk.
 * The schema has already refused a Registry with no list by the time these rules
 * run; returning `null` means they add no second complaint about it.
 *
 * @param {unknown} instance
 * @returns {unknown[] | null}
 */
const applicationsOf = (instance) => {
  if (!isPlainObject(instance)) return null;
  const applications = /** @type {Record<string, unknown>} */ (instance).applications;
  return Array.isArray(applications) ? applications : null;
};

/**
 * One string field off one entry, or `null` when the entry or the field is not
 * something a structural rule can read. A field of the wrong type is the
 * schema's to reject, and complaining about it here too would inflate the count
 * an operator reads for a single defect.
 *
 * @param {unknown} entry
 * @param {string} name
 * @returns {string | null}
 */
const fieldOf = (entry, name) => {
  if (!isPlainObject(entry)) return null;
  const value = /** @type {Record<string, unknown>} */ (entry)[name];
  return typeof value === 'string' ? value : null;
};

/**
 * The second rule beyond the schema: `absorbed_into` names an entry that exists,
 * and never the entry carrying it.
 *
 * Draft-07 cannot express a reference at all, so a value pointing at nothing
 * validates and the Registry ships a relationship to an application it does not
 * describe. AD-6 keeps an absorbed application's entry precisely so a reader can
 * follow the field to where the code went, and a dangling value breaks the one
 * guarantee the field exists to make. A self-reference is reported separately
 * because it resolves and is still wrong: it says the code moved to where it
 * already was.
 *
 * @param {unknown} instance
 * @returns {Violation[]}
 */
export function danglingAbsorbedInto(instance) {
  /** @type {Violation[]} */
  const violations = [];
  const applications = applicationsOf(instance);
  if (applications === null) return violations;

  const known = new Set(
    applications.map((entry) => fieldOf(entry, 'id')).filter((id) => id !== null)
  );

  applications.forEach((entry, index) => {
    const target = fieldOf(entry, 'absorbed_into');
    if (target === null) return;

    if (target === fieldOf(entry, 'id')) {
      violations.push({
        instance: `/applications/${index}/absorbed_into`,
        rule: 'absorbed_into resolves',
        schema: null,
        detail:
          `the id ${show(target)} is this entry's own (AD-6: absorbed_into names where the code` +
          ' now lives, which is never the entry itself)',
        note: BEYOND_THE_SCHEMA,
      });
      return;
    }

    if (!known.has(target)) {
      violations.push({
        instance: `/applications/${index}/absorbed_into`,
        rule: 'absorbed_into resolves',
        schema: null,
        detail:
          `no entry in this Registry carries the id ${show(target)} (AD-6: an absorbed application` +
          ' keeps its entry and names where its code now lives)',
        note: BEYOND_THE_SCHEMA,
      });
    }
  });

  return violations.sort(order);
}

/**
 * The third rule beyond the schema: a `family` value is shared, never carried
 * alone.
 *
 * `family` exists to group (FR-11), and draft-07 can neither count the entries
 * carrying a value nor compare them to each other. A value appearing exactly
 * once is the one thing the field cannot mean: either the second member was
 * dropped, or one of the two spellings is wrong, and both are invisible until a
 * reader finds a group of one in the directory. Same argument as the
 * duplicate-id rule, which is why it sits beside it.
 *
 * @param {unknown} instance
 * @returns {Violation[]}
 */
export function lonelyFamilies(instance) {
  /** @type {Violation[]} */
  const violations = [];
  const applications = applicationsOf(instance);
  if (applications === null) return violations;

  /** @type {Map<string, number[]>} */
  const members = new Map();
  applications.forEach((entry, index) => {
    const family = fieldOf(entry, 'family');
    if (family === null) return;
    const held = members.get(family);
    if (held === undefined) members.set(family, [index]);
    else held.push(index);
  });

  for (const [family, indexes] of members) {
    if (indexes.length > 1) continue;
    violations.push({
      instance: `/applications/${indexes[0]}/family`,
      rule: 'family groups',
      schema: null,
      detail:
        `${show(family)} is carried by this entry alone (FR-11: a family groups, so either a` +
        ' second entry shares the value or the field does not belong on this one)',
      note: BEYOND_THE_SCHEMA,
    });
  }

  return violations.sort(order);
}

/**
 * The six adjectives `EXPERIENCE.md:234-240` bans **by name**, matched as whole
 * words and case-insensitively.
 *
 * **Whole word rather than substring, by Operator ruling of 2026-09-03.** The
 * substring form shipped first and was wrong in both directions at once. It
 * refused `"modernization"` and `"trailblazing"`, which are honest prose, and it
 * reported the list entry it matched **against** rather than the text it matched,
 * so an author told their description carries "blazing" had to go looking for a
 * word that is not in it. That contradicts the reason this rule exists at all: a
 * gate that cannot name what it found teaches nothing.
 *
 * **`"blazingly"` passes, and that is the accepted cost.** FR-8 bans six words
 * by name and this list is those six words. A rule that refuses honest prose is
 * switched off by the next author rather than read, which costs more than one
 * adverb.
 */
const MARKETING_ADJECTIVES = ['powerful', 'seamless', 'cutting-edge', 'modern', 'beautiful', 'blazing'];

/** The six, as one whole-word alternation. */
const ADJECTIVE = String.raw`\b(?:${MARKETING_ADJECTIVES.join('|')})\b`;

/**
 * First person, at a word boundary rather than as a substring.
 *
 * **The set is ten words, not the four the story's first matrix row listed.**
 * That row named `I`, `we`, `our` and `my` as examples and they shipped as the
 * definition, so `"It shows us the file and gives me mine."` passed a rule
 * advertised as banning first person. Corrected 2026-09-03.
 *
 * **Longest alternative first**, so the reported text is the whole word: at
 * `"ours"` an `our`-first ordering matches `our`, fails its trailing boundary,
 * backtracks and reaches the right answer anyway, but only by accident of
 * backtracking. Ordering it explicitly is what makes the reported text
 * dependable rather than lucky.
 *
 * The boundaries are the whole of the rule's safety: "Wednesday" must not read
 * as "we", "four" must not read as "our", "because" must not read as "us" and
 * "some" must not read as "me". The rule is worthless if it refuses honest
 * prose, because the next author turns it off rather than reading it.
 */
const FIRST_PERSON = String.raw`\b(?:ourselves|myself|ours|mine|our|we|us|my|me|i)\b`;

/**
 * What ends a sentence, for FR-8's count.
 *
 * A terminator, then **any run of closing punctuation**, and the count is taken
 * where that run is followed by whitespace or the end of the string.
 *
 * **The closers are not a nicety: without them the two halves of this one rule
 * contradict each other.** The punctuation half requires a typeset ellipsis and
 * typeset curly quotes, and the counter's first form, a bare `[.!?]` before
 * whitespace or end, counted a description ending in one of exactly those as
 * **zero** sentences and refused it citing "never four". The rule was forcing
 * the author to write a shape it then refused. U+2026 is a terminator here for
 * the same reason it is the mandated replacement for three periods, and U+201D,
 * U+2019, `)`, `]` and `}` close a sentence without ending it.
 *
 * **Counting terminators is a naive way to count sentences in general**: an
 * abbreviation or a version number breaks it. It is honest **against this field
 * only**, and precisely because FR-8 bans the thing that would break it. "The
 * stack is the `tech` field's job", so `Next.js` and `v1.2` cannot appear in a
 * `description` without already being a defect that a person reading the entry
 * has to catch. That dependency is why this rule can be trusted here and why it
 * must never be lifted onto another field.
 *
 * Exported because `ops/__tests__/registry-schema.test.ts` splits the shipped
 * descriptions into sentences to check that none is carried by two entries, and
 * a second definition of "sentence" written there would disagree with this one
 * the first time either moved.
 */
export const SENTENCE_END = '[.!?\\u2026][\\u201d\\u2019")\\]}]*';

/** The count is taken where a sentence end meets whitespace or the string end. */
const TERMINATOR = `${SENTENCE_END}(?:\\s|$)`;

/**
 * The three untypeset forms `DESIGN.md:491-497` refuses in reader-facing copy,
 * and the typeset character each stands in for.
 *
 * **The replacements are named by code point, never written as the characters
 * themselves**, the same way `BOM` is above and for a related reason: two
 * punctuation rules apply to different things here and do not conflict. A string
 * a Visitor reads is a product string and takes typeset punctuation; prose
 * written **into** this repository, this file included, takes no dash at all
 * (`AGENTS.md:23-25`). `DESIGN.md:491-497` states the reconciliation, and citing
 * it is what stops the next reader taking UX-DR38 for a contradiction. The code
 * point is what lets one source file carry a rule about a character it may not
 * itself contain.
 *
 * The straight single quote is deliberately **not** here, though "curly quotes"
 * would ordinarily cover an apostrophe. The story's matrix names three forms and
 * only three, and the reason it is out is recorded in `ops/registry-schema.md`
 * rather than decided here.
 */
const UNTYPESET = [
  { found: '"', wrote: 'a straight double quote', takes: 'a curly quote', points: [0x201c, 0x201d] },
  { found: '--', wrote: 'a double hyphen', takes: 'an em dash', points: [0x2014] },
  { found: '...', wrote: 'three periods', takes: 'an ellipsis', points: [0x2026] },
];

/**
 * The two fields the punctuation half reads: the copy a Visitor actually reads.
 *
 * **It read every string in the Registry until 2026-09-03, and that was a trap
 * rather than a rule.** `source` and `live` are URLs and `id`, `family` and
 * `absorbed_into` are identifiers. A repository whose name carries a double
 * hyphen would have been refused and told to write an em dash, which is a repair
 * that 404s the entry, and which this story separately forbids. Nothing in the
 * shipped Registry trips it today, which is exactly what makes it a trap: the
 * first entry that did would have had no legal way out.
 *
 * `epics.md:2271` sets UX-DR38 over "every string in the Registry" and cannot
 * have meant an identifier, because the repair it demands breaks the one field a
 * reader clicks. **Operator ruling of 2026-09-03: `name` and `description`.**
 */
const READER_FACING = ['name', 'description'];

/**
 * The fourth rule beyond the schema: the mechanizable half of FR-8's editorial
 * contract, plus the typeset-punctuation rule over the copy a Visitor reads.
 *
 * **Why this cannot be a schema rule.** `not` with a `pattern` is implemented and
 * would bind, but the validator compiles patterns with no flags, so a
 * case-insensitive list needs character classes, and `not`'s refusal says only
 * "this value matches a shape the schema forbids here". An editorial gate that
 * cannot name the word it found teaches nothing, and teaching the author is the
 * whole of what this rule is for. The other three rules live outside the schema
 * for their own reasons; this one is here for that one.
 *
 * **What it asserts and what it deliberately does not.** It applies the four
 * halves that are mechanical: one to three sentences, the six banned adjectives,
 * first person, and the three untypeset forms. It says nothing about "leads with
 * the thing itself", about status synonyms, or about an invented number, all of
 * which need judgement and would refuse honest prose. **It does not hold that no
 * sentence is carried by two entries**, which was this story's headline defect;
 * that is a check in this repository's suite and nowhere else, and
 * `ops/registry-schema.md` states the limit. And it says nothing about whether a
 * `description` is **true**: no rule can know that `cs-tracker` tracks skins
 * rather than matches, and that took a checkout. Form, never truth.
 *
 * @param {unknown} instance
 * @returns {Violation[]}
 */
export function editorialVoice(instance) {
  /** @type {Violation[]} */
  const violations = [];
  const applications = applicationsOf(instance);
  if (applications === null) return violations;

  /**
   * @param {string} pointer
   * @param {string} detail
   */
  const say = (pointer, detail) =>
    violations.push({
      instance: pointer,
      rule: 'editorial voice',
      schema: null,
      detail,
      note: BEYOND_THE_SCHEMA,
    });

  applications.forEach((entry, index) => {
    // Every pattern is compiled here rather than held as a module-level `RegExp`:
    // a shared global regular expression carries `lastIndex` between calls, and a
    // rule whose answer depends on how many entries ran before it is worse than
    // no rule at all.
    for (const field of READER_FACING) {
      const text = fieldOf(entry, field);
      if (text === null) continue;
      const spot = `/applications/${index}/${field}`;
      for (const form of UNTYPESET) {
        if (!text.includes(form.found)) continue;
        say(
          spot,
          `${form.wrote}, ${show(form.found)}, where copy a Visitor reads takes ${form.takes},` +
            ` ${show(String.fromCodePoint(...form.points))} (UX-DR38 and DESIGN.md, over "name" and` +
            ' "description" only: an id, a family, an absorbed_into and a URL are machine-readable' +
            ' and are left alone, because typesetting one would break the value)'
        );
      }
    }

    const description = fieldOf(entry, 'description');
    if (description === null) return;
    const pointer = `/applications/${index}/description`;

    const sentences = (description.match(new RegExp(TERMINATOR, 'g')) ?? []).length;
    if (sentences === 0) {
      // Its own wording. The overrun cites "never four", which is the rule a
      // fourth sentence breaks; a value with no terminator at all broke the
      // other end of the range and being told about "never four" sends its
      // author looking for a sentence to delete.
      say(
        pointer,
        'no sentence end at all, where FR-8 fixes one to three sentences. A terminator, optionally' +
          ` followed by a closing quote or bracket, is what ends one: ${show(description)}`
      );
    } else if (sentences > 3) {
      say(
        pointer,
        `${sentences} sentences, where FR-8 fixes one to three and says "never four":` +
          ` ${show(description)}`
      );
    }

    /** @type {Set<string>} */
    const adjectives = new Set();
    for (const match of description.matchAll(new RegExp(ADJECTIVE, 'gi'))) adjectives.add(match[0]);
    for (const found of [...adjectives].sort()) {
      say(
        pointer,
        `the marketing adjective ${show(found)}, as a whole word (FR-8 bans six by name: ` +
          `${MARKETING_ADJECTIVES.join(', ')})`
      );
    }

    /** @type {Set<string>} */
    const person = new Set();
    for (const match of description.matchAll(new RegExp(FIRST_PERSON, 'gi'))) person.add(match[0]);
    for (const word of [...person].sort()) {
      say(
        pointer,
        `the first-person word ${show(word)} at a word boundary (FR-8: no first person, and a` +
          ' Registry entry describes the application rather than its author)'
      );
    }
  });

  return violations.sort(order);
}

/**
 * The rules this gate applies beyond the schema, as data: the function that
 * applies each and the clause the green line says it applied.
 *
 * **This list is why "the line enumerates rather than counts" is true rather
 * than merely intended.** The clauses were written into `report()` as a literal
 * until 2026-09-03, so the green line claimed four rules whether or not four ran:
 * unwiring a rule left its clause printing and the positive control asserting
 * that clause stayed green, which defeats the whole argument for enumerating.
 * The clause now travels with the function, `inspect()` reports the clauses of
 * the rules it actually ran, and a rule taken out of this array takes its clause
 * out of the line with it.
 *
 * @type {{ name: string, clause: string, apply: (instance: unknown) => Violation[] }[]}
 */
export const RULES_BEYOND_THE_SCHEMA = [
  { name: 'unique id', clause: 'no duplicate id', apply: duplicateIds },
  { name: 'absorbed_into resolves', clause: 'every reference resolves', apply: danglingAbsorbedInto },
  { name: 'family groups', clause: 'every family groups', apply: lonelyFamilies },
  {
    name: 'editorial voice',
    clause: 'every description in FR-8 voice, every name and description typeset',
    apply: editorialVoice,
  },
];

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

/**
 * Turn the two sources into a verdict. Pure: it reads no file, so every refusal
 * below has a standing case built from strings.
 *
 * The order is deliberate. Both files have to be readable, then the schema has
 * to parse, then **every keyword in it has to be one this validator implements,
 * before the Registry is so much as parsed**: a keyword nothing applies means
 * the gate is green over a rule the schema states, and reporting an instance as
 * valid under a schema that was never fully applied is the one outcome this file
 * exists to prevent.
 *
 * @param {Source} schemaSource
 * @param {Source} registrySource
 * @returns {Inspection}
 */
export function inspect(schemaSource, registrySource) {
  /** @type {Inspection} */
  const empty = {
    stage: 'validated',
    unread: [],
    unparsed: [],
    unsupported: [],
    violations: [],
    applied: [],
    entries: null,
  };

  const unread = [schemaSource, registrySource]
    .filter((source) => source.text === null)
    .map((source) => ({ label: source.label, error: String(source.error) }));
  if (unread.length > 0) return { ...empty, stage: 'unread', unread };

  /**
   * A leading U+FEFF is stripped before the parse. `JSON.parse` throws on a
   * byte order mark, and the editor on the Windows host these two files are
   * authored on can write one, so a perfectly valid Registry would otherwise
   * read as malformed with a message about position 0 that says nothing about
   * a character the author cannot see. Only a leading one: a U+FEFF anywhere
   * else is inside a string value, where `show()` escapes it.
   *
   * @param {Source} source
   */
  const parse = (source) => {
    try {
      // Written as an escape, never as the character itself: a source file
      // carrying an invisible byte order mark is the defect this line exists to
      // handle, one level up.
      const text = String(source.text);
      const body = text.startsWith(BOM) ? text.slice(BOM.length) : text;
      return { value: JSON.parse(body), error: null };
    } catch (error) {
      return { value: null, error: error instanceof Error ? error.message : String(error) };
    }
  };

  const schemaParse = parse(schemaSource);
  if (schemaParse.error !== null) {
    return { ...empty, stage: 'unparsed', unparsed: [{ label: schemaSource.label, error: schemaParse.error }] };
  }

  const unsupported = auditSchema(schemaParse.value);
  if (unsupported.length > 0) return { ...empty, stage: 'unsupported', unsupported };

  const registryParse = parse(registrySource);
  if (registryParse.error !== null) {
    return {
      ...empty,
      stage: 'unparsed',
      unparsed: [{ label: registrySource.label, error: registryParse.error }],
    };
  }

  const registry = registryParse.value;
  const violations = [
    ...validate(schemaParse.value, registry),
    ...RULES_BEYOND_THE_SCHEMA.flatMap((rule) => rule.apply(registry)),
  ].sort(order);
  const applications = isPlainObject(registry)
    ? /** @type {Record<string, unknown>} */ (registry).applications
    : null;

  return {
    ...empty,
    stage: 'validated',
    violations,
    // What ran, not what this file hopes ran. `report()` builds the green line
    // from exactly this, so the line cannot claim a rule the run did not apply.
    applied: RULES_BEYOND_THE_SCHEMA.map((rule) => rule.clause),
    entries: Array.isArray(applications) ? applications.length : null,
  };
}

const AD = [
  `  AD-4: ${REGISTRY} is the estate's only App Registry, and`,
  `  ${SCHEMA} fixes its shape, so CI validates it and a malformed`,
  '  entry cannot ship. AD-21 makes this gate blocking rather than a warning: there is one',
  '  environment and no staging, and the Registry is read by every consumer in every estate',
  '  language, so nothing downstream catches what it lets through.',
];

/** @param {string[]} detail */
const refusal = (detail) => ['registry schema: REFUSED', ...AD, ...detail].join('\n');

/** @param {number} count */
const plural = (count) => (count === 1 ? '' : 's');

/**
 * Turn an inspection into the operator's message and the process's verdict.
 *
 * The two file labels are this module's own constants rather than parameters, so
 * a fixture in a test produces the exact string a runner would print for the
 * committed pair, and no test can pass against a message shape the job never
 * emits.
 *
 * @param {Inspection} inspection
 * @returns {Result}
 */
export function report(inspection) {
  if (inspection.stage === 'unread') {
    return {
      ok: false,
      message: refusal([
        ...inspection.unread.map(
          (file) =>
            `  ${file.label} could not be read (${printable(file.error)}). It must carry ` +
            `${/** @type {Record<string, string>} */ (MUST_CARRY)[file.label] ?? 'the Registry contract'}.`
        ),
        '  A gate that passes over a file it never opened is worse than no gate, so a missing or',
        '  unreadable file is a refusal and never a pass. An empty application list is a refusal too',
        '  since Story 2.5 authored the entries and set minItems, but it is a different one: this',
        '  branch means zero bytes were read, not that zero entries were found in a file that parsed.',
      ]),
    };
  }

  if (inspection.stage === 'unparsed') {
    return {
      ok: false,
      message: refusal([
        ...inspection.unparsed.map((file) => `  ${file.label} is not JSON: ${printable(file.error)}`),
        '  Nothing downstream can read a file this one could not parse, so an unparseable Registry or',
        '  schema is a refusal rather than a run with nothing to check.',
      ]),
    };
  }

  if (inspection.stage === 'unsupported') {
    const count = inspection.unsupported.length;
    return {
      ok: false,
      message: refusal([
        `  ${SCHEMA} uses ${count} thing${plural(count)} this validator does`,
        '  not implement, so the Registry was not read at all. A keyword nothing applies is a rule the',
        '  gate is green over.',
        ...inspection.unsupported.map(
          (finding) => `    ${inSchema(finding.pointer)}: ${finding.detail}`
        ),
        '  Either implement the keyword in ops/registry-schema.mjs, with a case in its suite, or take',
        '  it out of the schema. The schema and the check agree by construction or not at all.',
      ]),
    };
  }

  if (inspection.violations.length > 0) {
    const count = inspection.violations.length;
    return {
      ok: false,
      message: refusal([
        `  ${count} violation${plural(count)} in ${REGISTRY}, by JSON Pointer:`,
        ...inspection.violations.flatMap((violation) => [
          // Both pointers are escaped, and the detail is not. A detail is
          // assembled from this module's own prose plus already-escaped parts:
          // `q()` for a property name and `show()` for a value. Escaping the
          // whole line a second time would print a quoted `pattern` with a
          // doubled backslash, which is the one string an operator is being
          // sent to the schema to compare. Same line, and the same reasoning,
          // as `ops/contract-purity.md` under "Only the untrusted half of a
          // reason is escaped".
          `    ${where(violation.instance)}: ${violation.detail}`,
          `      rule: ${violation.rule}${violation.schema === null ? '' : `, at ${inSchema(violation.schema)}`}`,
          ...(violation.note === null ? [] : [`      ${printable(violation.note)}`]),
        ]),
        `  Fix the entries, or renegotiate the shape in ${SCHEMA} and in`,
        '  AD-5. A malformed entry that ships is inherited by every consumer in every estate language.',
      ]),
    };
  }

  const entries = inspection.entries;
  if (entries === null) {
    return {
      ok: false,
      message: refusal([
        `  ${REGISTRY} carries no application list this gate could count, and the schema did not`,
        '  reject it, which means the schema stopped requiring one. A green run has to mean the',
        '  Registry was read.',
      ]),
    };
  }

  return {
    ok: true,
    message:
      `registry schema: read ${REGISTRY} against ${SCHEMA}, ${entries} ` +
      `application${plural(entries)}, valid, ` +
      // Enumerated from the rules that actually ran. A rule removed from
      // `RULES_BEYOND_THE_SCHEMA` loses its clause here in the same edit, so the
      // line can never claim more than the run checked, which is the same defect
      // in the other direction as a gate green over a rule it never applied.
      `${inspection.applied.join(', ')} (AD-4, AD-5).`,
  };
}

/**
 * The whole CLI as a function. It takes nothing: both paths are fixed in this
 * file and resolved beside this module, so the gate works from any working
 * directory and no caller can point it somewhere else.
 *
 * @returns {Result}
 */
export function main() {
  return report(inspect(readSource(SCHEMA), readSource(REGISTRY)));
}

/**
 * @param {string} a
 * @param {string} b
 */
function sameFile(a, b) {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    // Never answer "no" here. A guard that decides it was not invoked directly
    // runs nothing and lets the process exit 0, which is a gate failing open:
    // the one outcome this whole file exists to prevent. If a path cannot be
    // resolved, compare the paths as written instead.
    return resolve(a) === resolve(b);
  }
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && sameFile(process.argv[1], fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const result = main();
  const stream = result.ok ? process.stdout : process.stderr;
  // Record the verdict before writing anything. The exit below happens inside
  // the write callback, and a stream torn down before that callback runs never
  // calls it, at which point the process falls off the end of this module and
  // exits 0. On a refusal that is the gate failing open on the one path that
  // reports a violation, so the verdict is set here and the callback only
  // decides when to leave.
  process.exitCode = result.ok ? 0 : 1;
  // Exit from the write callback. On a pipe, which is what a CI runner gives
  // this process, `process.exit` can otherwise cut the message off mid flush
  // and leave a failing step with nothing explaining why.
  stream.write(`${result.message}\n`, () => process.exit(result.ok ? 0 : 1));
}
