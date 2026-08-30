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
// **One rule is enforced beyond the schema.** Uniqueness of `id` across entries
// cannot be expressed in draft-07. It is applied here as a named structural
// rule, said so in the refusal, and recorded as a stated limit in
// `ops/registry-schema.md`: the editor will not catch it.

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

/** The one rule this gate applies beyond the schema, worded once. */
export const BEYOND_THE_SCHEMA =
  'Uniqueness across entries cannot be expressed in draft-07, so this is the one rule this gate' +
  ' applies beyond the schema, and the editor will not catch it.';

/** @param {string} relative */
const beside = (relative) => fileURLToPath(new URL(`../${relative}`, import.meta.url));

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

/** @param {string} text */
export function printable(text) {
  return [...String(text)]
    .map((character) => {
      const point = character.codePointAt(0) ?? 0;
      if (character === '\\') return String.raw`\\`;
      if (
        point > 31 &&
        point !== 127 &&
        !IS_A_CONTROL(point) &&
        !DRAWS_AS_NOTHING.has(point) &&
        !FORGES_A_LINE.has(point) &&
        !REORDERS_TEXT(point)
      ) {
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

/** How long a quoted instance value may get before it is cut. */
const SHOWN = 120;

/**
 * The four classes `JSON.stringify` leaves through. It already escapes the C0
 * range, the quote and the backslash, and that alone is injective, so the
 * backslashes it wrote are left as they are here: doubling them would print
 * every authored newline as `\\n`, which is noise rather than safety. What it
 * does not escape is U+2028 and U+2029, the C1 controls, the bidirectional
 * overrides and the code points drawn as nothing, and each of those forges or
 * disguises a line exactly as a raw newline would.
 *
 * @param {string} text
 */
const escapeInvisible = (text) =>
  [...text]
    .map((character) => {
      const point = character.codePointAt(0) ?? 0;
      if (
        !IS_A_CONTROL(point) &&
        !DRAWS_AS_NOTHING.has(point) &&
        !FORGES_A_LINE.has(point) &&
        !REORDERS_TEXT(point)
      ) {
        return character;
      }
      return `\\u${point.toString(16).padStart(4, '0')}`;
    })
    .join('');

/**
 * A value as it is safe to quote in a message.
 *
 * @param {unknown} value
 */
const show = (value) => {
  if (value === undefined) return 'nothing';
  const text = JSON.stringify(value) ?? String(value);
  return escapeInvisible(text.length > SHOWN ? `${text.slice(0, SHOWN - 3)}...` : text);
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

/** The whole document has the empty pointer, which reads as nothing at all. */
const where = (/** @type {string} */ pointer) => (pointer === '' ? '(the document root)' : pointer);

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
        `${where(pointer)} is ${show(node)} where a subschema was expected. Only an object schema is` +
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
        `${where(pointer)} carries $ref beside ${keys.filter((key) => key !== '$ref').map(q).join(', ')}.` +
          ' Draft-07 ignores every sibling of $ref, so those rules would bind here and nowhere else'
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
 * The one rule beyond the schema: no two entries share an `id`.
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
    entries: null,
  };

  const unread = [schemaSource, registrySource]
    .filter((source) => source.text === null)
    .map((source) => ({ label: source.label, error: String(source.error) }));
  if (unread.length > 0) return { ...empty, stage: 'unread', unread };

  /** @param {Source} source */
  const parse = (source) => {
    try {
      return { value: JSON.parse(String(source.text)), error: null };
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
  const violations = [...validate(schemaParse.value, registry), ...duplicateIds(registry)].sort(order);
  const applications = isPlainObject(registry)
    ? /** @type {Record<string, unknown>} */ (registry).applications
    : null;

  return {
    ...empty,
    stage: 'validated',
    violations,
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
        '  unreadable file is a refusal and never a pass. An empty application list is not that: zero',
        '  entries is a fact about the data, and Story 2.5 is what changes it.',
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
          (finding) => `    ${printable(finding.pointer) || '(the schema root)'}: ${finding.detail}`
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
          `    ${printable(where(violation.instance))}: ${violation.detail}`,
          `      rule: ${violation.rule}${violation.schema === null ? '' : `, at ${violation.schema}`}`,
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
      `application${plural(entries)}, valid, no duplicate id (AD-4, AD-5).`,
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
