// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import {
  BEYOND_THE_SCHEMA,
  KEYWORDS,
  REGISTRY,
  SCHEMA,
  auditSchema,
  duplicateIds,
  inspect,
  report,
  validate,
} from '../registry-schema.mjs';

// One standing case per row of the story's I/O matrix, plus one per refusal the
// gate makes that no matrix row names, plus the wiring. A probe demonstrates
// that the gate could fail on the day it was run; these are what keep it able to
// fail after a later edit, and they sit inside the already-blocking `test` job
// rather than in the new one, so the two gates are independent readers of one
// contract.
//
// Resolved from the repository root, which is where Vitest runs. Not from
// `import.meta.url`: under Vitest that is a vite URL rather than a `file:` one.
// The module's own read has the same shape, which is why every refusal below
// runs against strings and the real read is covered by the subprocess block.
const GATE = resolve(process.cwd(), 'ops/registry-schema.mjs');
const SCHEMA_FILE = resolve(process.cwd(), SCHEMA);
const REGISTRY_FILE = resolve(process.cwd(), REGISTRY);
const WORKFLOW = resolve(process.cwd(), '.github/workflows/ci.yml');
const JOB = 'registry-schema';
const HERE = 'ops/__tests__/registry-schema.test.ts';

// Work done at collection time fails the whole file rather than one case, and a
// bare ENOENT there says nothing about what this suite wanted.
const atCollection = <T>(why: string, build: () => T): T => {
  try {
    return build();
  } catch (error) {
    throw new Error(`${HERE}: ${why} ${error instanceof Error ? error.message : String(error)}`);
  }
};

// `spawnSync` reports a failure to start in `error` and leaves `status` null, so
// an unguarded `run.status` turns a broken harness into what reads as a gate
// defect. Every spawn in this file goes through here.
const spawned = <T>(run: SpawnSyncReturns<T>): SpawnSyncReturns<T> => {
  if (run.error) throw run.error;
  return run;
};

const schemaText = atCollection(
  `the committed ${SCHEMA} could not be read, and it is the contract this whole suite is about.`,
  () => readFileSync(SCHEMA_FILE, 'utf8')
);
const registryText = atCollection(
  `the committed ${REGISTRY} could not be read, and a missing Registry is the state the gate refuses;` +
    ' it must not be the state this suite fails to collect in.',
  () => readFileSync(REGISTRY_FILE, 'utf8')
);
const shippedSchema = atCollection(`the committed ${SCHEMA} is not JSON.`, () => JSON.parse(schemaText));

/** The pattern `source` and `live` are held to. Written once, asserted both ways below. */
const HTTPS = String.raw`^https://[^\s/]+(/\S*)?$`;

type Source = { label: string; text: string | null; error: string | null };
const asSchema = (text: string | null, error: string | null = null): Source => ({ label: SCHEMA, text, error });
const asRegistry = (text: string | null, error: string | null = null): Source => ({ label: REGISTRY, text, error });

/** One valid entry, which every refusal fixture below breaks in exactly one way. */
const entry = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'demo-app',
  name: 'Demo App',
  description: 'A scratch entry that exists only inside this suite.',
  status: 'Complete',
  tech: ['Elixir'],
  source: 'https://github.com/luigiespinosa/demo-app',
  demo: 'none',
  identity: 'none',
  ...over,
});

/** An envelope carrying the given entries, as the committed one is shaped. */
const envelope = (...applications: unknown[]): string =>
  JSON.stringify({ $schema: './registry.schema.json', contract_version: '1.0.0', applications }, null, 2);

/** The gate's verdict over the committed schema and a scratch Registry. */
const against = (registry: string) => report(inspect(asSchema(schemaText), asRegistry(registry)));

/** Every scratch tree lives under `tmpdir()`, so a run never mutates `contracts/`. */
const withRoot = <T>(use: (root: string) => T): T => {
  const root = mkdtempSync(join(tmpdir(), 'registry-schema-'));
  try {
    return use(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

// ---------------------------------------------------------------------------
// Matrix row 1: the committed pair passes, and says what it read.
// ---------------------------------------------------------------------------

describe('the committed Registry', () => {
  it('validates, naming both files and the entry count', () => {
    const result = report(inspect(asSchema(schemaText), asRegistry(registryText)));

    expect(result.ok, result.message).toBe(true);
    expect(result.message).toContain(REGISTRY);
    expect(result.message).toContain(SCHEMA);
    expect(result.message).toMatch(/\d+ applications?/);
  });

  it('carries the envelope AD-4 and AD-5 fix, with zero entries and no minItems', () => {
    const committed = JSON.parse(registryText);

    expect(committed.$schema).toBe('./registry.schema.json');
    expect(committed.contract_version).toBe('1.0.0');
    expect(committed.applications).toEqual([]);
    // The one entry rule the schema deliberately leaves open. `minItems: 1` on
    // the list would fail the envelope this story ships against its own gate,
    // and Story 2.5 is what earns the tightening.
    expect(shippedSchema.properties.applications.minItems).toBeUndefined();
  });

  it('is an empty list treated as a fact rather than as a refusal', () => {
    // The distinction the whole "a green run has to mean something was read"
    // argument rests on: a missing file is a refusal, zero entries is data.
    const result = against(envelope());

    expect(result.ok, result.message).toBe(true);
    expect(result.message).toContain('0 applications');
  });

  it('is the file the schema hook points at, so AD-4 authoring half is wired', () => {
    expect(shippedSchema.properties.$schema.const).toBe('./registry.schema.json');
    expect(shippedSchema.required).toContain('$schema');
    expect(existsSync(SCHEMA_FILE)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The dialect, and the keyword set the validator implements.
// ---------------------------------------------------------------------------

describe('the shipped schema', () => {
  it('declares draft-07 and its published $id', () => {
    expect(shippedSchema.$schema).toBe('http://json-schema.org/draft-07/schema#');
    expect(shippedSchema.$id).toBe('https://cuatro.dev/contracts/registry.schema.json');
  });

  it('uses definitions rather than $defs, which follows from draft-07', () => {
    expect(shippedSchema.definitions).toBeDefined();
    expect(schemaText).not.toContain('"$defs"');
  });

  it('carries no format keyword anywhere, because the two readers would disagree', () => {
    // `format` is annotation-only in some validators and an assertion in others,
    // so the editor and the gate would not agree about what the schema asserts.
    // `source` and `live` are constrained by `pattern` instead.
    expect(schemaText).not.toContain('"format"');
    expect(shippedSchema.definitions.application.properties.source.pattern).toBe(HTTPS);
    expect(shippedSchema.definitions.application.properties.live.pattern).toBe(HTTPS);
  });

  it('constrains a URL to a host and no whitespace, not merely to a scheme', () => {
    // `^https://` on its own is an anchor and nothing else: it accepts the bare
    // scheme, a scheme followed by a space, and a value carrying an embedded
    // space or newline. `source` is FR-6's drill-through to the code and `live`
    // is what FR-28 says must resolve, so a hostless value passing the gate is
    // the Registry lying in the one field a reader clicks.
    const url = new RegExp(HTTPS);

    for (const accepted of [
      'https://cuatro.dev',
      'https://cuatro.dev/',
      'https://github.com/luigiespinosa/cs-tracker',
      'https://cs-tracker.cuatro.dev/scores?page=2',
    ]) {
      expect(url.test(accepted), `${accepted} is a URL the Registry has to accept`).toBe(true);
    }

    for (const refused of [
      'https://',
      'https:// ',
      'https://cuatro dev',
      'https://cuatro.dev/a b',
      'https://cuatro.dev\nhttps://elsewhere.example',
      'https:///no-host',
      'http://cuatro.dev',
    ]) {
      expect(url.test(refused), `${JSON.stringify(refused)} is not a URL and the pattern accepts it`).toBe(
        false
      );
    }
  });

  it('fixes the value sets AD-5, AD-12 and FR-27 name, and nothing beside them', () => {
    const fields = shippedSchema.definitions.application.properties;

    expect(fields.status.enum).toEqual(['Live', 'Complete', 'In progress', 'Archived']);
    expect(fields.identity.enum).toEqual(['oidc', 'wallet', 'none']);
    expect(fields.demo.enum).toEqual(['demo-account', 'open', 'not-deployed', 'none']);
    expect(shippedSchema.definitions.application.required).toEqual([
      'id',
      'name',
      'description',
      'status',
      'tech',
      'source',
      'demo',
      'identity',
    ]);
    expect(Object.keys(fields)).toEqual([
      'id',
      'name',
      'description',
      'status',
      'tech',
      'source',
      'demo',
      'identity',
      'live',
      'family',
      'absorbed_into',
      'token_contract',
    ]);
    expect(shippedSchema.definitions.application.additionalProperties).toBe(false);
    expect(shippedSchema.additionalProperties).toBe(false);
  });

  it('says what every enum value means, which draft-07 has no keyword of its own for', () => {
    // `oneOf` plus one `const` per value is the draft-07 idiom for this, and
    // `oneOf` is deliberately outside the implemented set. `enumDescriptions` is
    // VS Code's own annotation and asserts nothing, so the editor shows the
    // sentence and the gate applies no rule from it.
    for (const field of ['status', 'identity', 'demo']) {
      const property = shippedSchema.definitions.application.properties[field];
      expect(property.enumDescriptions, `${field} describes none of its values`).toHaveLength(
        property.enum.length
      );
      for (const text of property.enumDescriptions) expect(String(text).length).toBeGreaterThan(0);
    }
  });

  it('uses only keywords the validator implements, so a schema edit cannot outrun it', () => {
    // The audit is the gate's own answer. It runs here against the committed
    // schema, which is the standing half of the refusal below.
    expect(auditSchema(shippedSchema)).toEqual([]);
  });

  it('uses exactly the keywords this suite has been told to expect', () => {
    // Counted by a walk written here rather than by the module's own, so the
    // thing under test is not counting itself. A keyword appearing in the schema
    // that this list does not name is a deliberate widening, and it has to be
    // implemented and recorded in `ops/registry-schema.md` before it lands.
    const keywordsIn = (node: unknown, named = false): string[] => {
      if (Array.isArray(node)) return node.flatMap((member) => keywordsIn(member));
      if (typeof node !== 'object' || node === null) return [];
      const found: string[] = [];
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        // Under `properties` and `definitions` the keys are names, not keywords.
        if (named) {
          found.push(...keywordsIn(value));
          continue;
        }
        found.push(key);
        found.push(...keywordsIn(value, key === 'properties' || key === 'definitions'));
      }
      return found;
    };

    const used = [...new Set(keywordsIn(shippedSchema))].sort();
    expect(used).toEqual([
      '$id',
      '$ref',
      '$schema',
      'additionalProperties',
      'allOf',
      'const',
      'definitions',
      'description',
      'enum',
      'enumDescriptions',
      'if',
      'items',
      'minItems',
      'minLength',
      'not',
      'pattern',
      'properties',
      'required',
      'then',
      'title',
      'type',
      'uniqueItems',
    ]);
    for (const keyword of used) {
      expect(KEYWORDS, `the schema uses ${keyword} and the validator does not implement it`).toContain(keyword);
    }
  });

  it('is validated by a fixed keyword set, pinned so a widening is deliberate', () => {
    expect(KEYWORDS).toEqual([
      '$id',
      '$ref',
      '$schema',
      'additionalProperties',
      'allOf',
      'const',
      'definitions',
      'description',
      'else',
      'enum',
      'enumDescriptions',
      'if',
      'items',
      'minItems',
      'minLength',
      'not',
      'pattern',
      'properties',
      'required',
      'then',
      'title',
      'type',
      'uniqueItems',
    ]);
    // The keywords a reader most expects to be there, and which are not. Each is
    // a rule the editor would apply and the gate would not, or the reverse.
    for (const absent of ['oneOf', 'anyOf', 'format', 'patternProperties', 'dependencies', '$defs']) {
      expect(KEYWORDS, `${absent} is implemented, and no case covers it`).not.toContain(absent);
    }
  });
});

// ---------------------------------------------------------------------------
// Matrix rows 2 to 11: what the gate refuses.
// ---------------------------------------------------------------------------

describe('the gate refuses', () => {
  it('a missing schema, naming the path and what it must carry', () => {
    const result = report(inspect(asSchema(null, 'ENOENT'), asRegistry(registryText)));

    expect(result.ok).toBe(false);
    expect(result.message).toContain('AD-4');
    expect(result.message).toContain(SCHEMA);
    expect(result.message).toContain('ENOENT');
    expect(result.message).toContain("AD-5's entry shape");
  });

  it('a missing Registry, saying an empty list is a different thing', () => {
    const result = report(inspect(asSchema(schemaText), asRegistry(null, 'ENOENT')));

    expect(result.ok).toBe(false);
    expect(result.message).toContain(REGISTRY);
    expect(result.message).toContain('contract_version');
    expect(result.message, 'a missing file and an empty list are reported as the same thing').toContain(
      'zero'
    );
  });

  it('both files missing at once, naming both rather than only the first', () => {
    const result = report(inspect(asSchema(null, 'ENOENT'), asRegistry(null, 'EACCES')));

    expect(result.ok).toBe(false);
    expect(result.message).toContain(SCHEMA);
    expect(result.message).toContain(REGISTRY);
    expect(result.message).toContain('EACCES');
  });

  it('a trailing comma in the Registry, naming the file and the parser\'s own message', () => {
    const result = against('{ "$schema": "./registry.schema.json", "applications": [], }');

    expect(result.ok).toBe(false);
    expect(result.message).toContain(`${REGISTRY} is not JSON`);
    expect(result.message).toContain('JSON at position');
  });

  it('a trailing comma in the schema, which is the same refusal on the other file', () => {
    const result = report(inspect(asSchema('{ "type": "object", }'), asRegistry(registryText)));

    expect(result.ok).toBe(false);
    expect(result.message).toContain(`${SCHEMA} is not JSON`);
  });

  it('a keyword it does not implement, naming it and its location in the schema', () => {
    const widened = JSON.parse(schemaText);
    widened.oneOf = [{ type: 'object' }];
    const result = report(inspect(asSchema(JSON.stringify(widened)), asRegistry(registryText)));

    expect(result.ok).toBe(false);
    expect(result.message).toContain('"oneOf"');
    expect(result.message).toContain('/oneOf');
    expect(result.message).toContain('does not implement');
  });

  it('that keyword before it reads the instance, so no entry is reported valid under it', () => {
    // The property that makes the audit worth having. A schema carrying an
    // unimplemented keyword AND a Registry carrying a plain violation must
    // report the keyword, because the second answer would be a verdict reached
    // under a schema that was never fully applied.
    const widened = JSON.parse(schemaText);
    widened.definitions.application.properties.status.oneOf = [{ const: 'Live' }];
    const result = report(
      inspect(asSchema(JSON.stringify(widened)), asRegistry(envelope(entry({ status: 'Retired' }))))
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain('oneOf');
    expect(result.message).toContain('the Registry was not read at all');
    expect(result.message, 'the instance was validated under a schema half of which was ignored').not.toContain(
      '/applications/0/status'
    );
  });

  it('the format keyword by name, with the reason it is left out of the dialect', () => {
    const widened = JSON.parse(schemaText);
    widened.definitions.application.properties.source.format = 'uri';
    const result = report(inspect(asSchema(JSON.stringify(widened)), asRegistry(registryText)));

    expect(result.ok).toBe(false);
    expect(result.message).toContain('"format"');
    expect(result.message).toContain('annotation-only in some validators');
    expect(result.message).toContain('pattern');
  });

  it('a $ref carrying siblings, which draft-07 would silently discard', () => {
    const widened = JSON.parse(schemaText);
    widened.properties.applications.items = { $ref: '#/definitions/application', minLength: 3 };
    const result = report(inspect(asSchema(JSON.stringify(widened)), asRegistry(registryText)));

    expect(result.ok).toBe(false);
    expect(result.message).toContain('$ref');
    expect(result.message).toContain('ignores every sibling');
  });

  it('an enum whose values are not all described, so the claim stays mechanically true', () => {
    const widened = JSON.parse(schemaText);
    widened.definitions.application.properties.identity.enumDescriptions = ['only one'];
    const result = report(inspect(asSchema(JSON.stringify(widened)), asRegistry(registryText)));

    expect(result.ok).toBe(false);
    expect(result.message).toContain('enumDescriptions');
    expect(result.message).toContain('3 enum value(s) and 1 description(s)');
  });

  it('an if carrying neither then nor else, which asserts nothing at all', () => {
    // The same failure the keyword audit exists to prevent, one level down: the
    // condition is evaluated and its answer discarded, so the schema reads as
    // though it still carried the `live` rule while enforcing neither half.
    const gutted = JSON.parse(schemaText);
    delete gutted.definitions.application.allOf[0].then;
    const result = report(inspect(asSchema(JSON.stringify(gutted)), asRegistry(registryText)));

    expect(result.ok).toBe(false);
    expect(result.message).toContain('"if" with neither "then" nor "else"');
    expect(result.message).toContain('/definitions/application/allOf/0');
  });

  it('and refuses it before validating, so a gutted condition is never reported as valid', () => {
    // The entry below breaks the `live` half that the deleted `then` carried. A
    // gate that audited after validating would report the Registry as valid,
    // which is the exact hole a discarded condition opens.
    const gutted = JSON.parse(schemaText);
    delete gutted.definitions.application.allOf[0].then;
    const result = report(
      inspect(asSchema(JSON.stringify(gutted)), asRegistry(envelope(entry({ status: 'Live' }))))
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain('the Registry was not read at all');
  });

  it('without letting a schema property name forge a line either', () => {
    // A pointer is built from property names, and a name is not this module's
    // own prose. Unescaped, a name carrying a newline fakes a line inside the
    // refusal exactly as a Registry value does, and the schema half was the half
    // that was still raw.
    const widened = JSON.parse(schemaText);
    // The offending name carries the finding, so the pointer the refusal prints
    // is the one built from it.
    widened.definitions.application.properties['evil\n    /nothing-to-see-here: fine'] = { formatt: 'uri' };
    const result = report(inspect(asSchema(JSON.stringify(widened)), asRegistry(registryText)));

    expect(result.ok).toBe(false);
    // `~1` is RFC 6901's own escape for a `/` inside a pointer token, and `\n`
    // is this module's. Both have to be applied, or the pointer is either
    // ambiguous or a forged line.
    expect(result.message).toContain(String.raw`evil\n    ~1nothing-to-see-here: fine`);
    const forged = result.message.split('\n').filter((line) => line.includes('nothing-to-see-here'));
    expect(forged, 'a schema property name printed a line of its own').toHaveLength(1);
  });

  it('a byte order mark, which the authoring host writes and JSON.parse rejects', () => {
    // A U+FEFF at the head of the file makes `JSON.parse` throw at position 0,
    // so a perfectly valid Registry reads as malformed with a message about a
    // character its author cannot see. Both files are stripped of a leading one
    // before the parse, and only a leading one.
    const marked = report(inspect(asSchema(`\uFEFF${schemaText}`), asRegistry(`\uFEFF${registryText}`)));

    expect(marked.ok, marked.message).toBe(true);
    expect(marked.message).toContain('0 applications');
  });

  it('and still refuses a byte order mark that is inside the file rather than at its head', () => {
    const inside = against(`{\uFEFF "$schema": "./registry.schema.json", "applications": [] }`);

    expect(inside.ok).toBe(false);
    expect(inside.message).toContain('is not JSON');
  });

  it('a Live entry with no live URL, naming which half of FR-6 failed', () => {
    const result = against(envelope(entry({ status: 'Live' })));

    expect(result.ok).toBe(false);
    expect(result.message).toContain('/applications/0');
    expect(result.message).toContain('"live" is required');
    expect(result.message).toContain('first half');
    expect(result.message).toContain('FR-6');
  });

  it('an Archived entry carrying a live URL, naming the other half', () => {
    const result = against(envelope(entry({ status: 'Archived', live: 'https://gone.cuatro.dev' })));

    expect(result.ok).toBe(false);
    expect(result.message).toContain('/applications/0');
    expect(result.message).toContain('second half');
    expect(result.message).toContain('FR-28');
  });

  it('and passes both halves when the entry satisfies them', () => {
    const ok = against(
      envelope(
        entry({ status: 'Live', live: 'https://cuatro.dev' }),
        entry({ id: 'gone', status: 'Archived', absorbed_into: 'demo-app' })
      )
    );

    expect(ok.ok, ok.message).toBe(true);
    expect(ok.message).toContain('2 applications');
  });

  it('a fifth status, listing the four permitted values', () => {
    const result = against(envelope(entry({ status: 'Retired' })));

    expect(result.ok).toBe(false);
    expect(result.message).toContain('/applications/0/status');
    expect(result.message).toContain('"Live", "Complete", "In progress", "Archived"');
  });

  it('an entry with no demo, saying absence is not a way to say "not applicable"', () => {
    const without = entry();
    delete without.demo;
    const result = against(envelope(without));

    expect(result.ok).toBe(false);
    expect(result.message).toContain('"demo" is required here and is absent');
    expect(result.message).toContain('absence is never a permitted way to say "not applicable"');
    expect(result.message).toContain('AD-5');
  });

  it('an entry with no identity, on the same rule and with its own reason', () => {
    const without = entry();
    delete without.identity;
    const result = against(envelope(without));

    expect(result.ok).toBe(false);
    expect(result.message).toContain('"identity" is required here and is absent');
    expect(result.message).toContain('AD-12');
  });

  it('an unknown field, naming it and additionalProperties', () => {
    const result = against(envelope(entry({ licence: 'MIT' })));

    expect(result.ok).toBe(false);
    expect(result.message).toContain('/applications/0/licence');
    expect(result.message).toContain('additionalProperties is false');
  });

  it('two entries sharing an id, naming the id, both indexes and the rule beyond the schema', () => {
    const result = against(envelope(entry(), entry({ name: 'A second spelling of one application' })));

    expect(result.ok).toBe(false);
    expect(result.message).toContain('/applications/1/id');
    expect(result.message).toContain('/applications/0');
    expect(result.message).toContain('"demo-app"');
    expect(result.message).toContain(BEYOND_THE_SCHEMA);
    expect(result.message).toContain('AD-3');
  });

  it('an envelope with no $schema, because AD-4 authoring hook is required', () => {
    const result = against(
      JSON.stringify({ contract_version: '1.0.0', applications: [] })
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain('"$schema" is required here and is absent');
    expect(result.message).toContain("AD-4's authoring half");
  });

  it('an envelope whose $schema points somewhere else', () => {
    const result = against(
      JSON.stringify({ $schema: '../elsewhere.json', contract_version: '1.0.0', applications: [] })
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain('/$schema');
    expect(result.message).toContain('is not "./registry.schema.json"');
  });

  it('a contract_version that is not semver, and an unknown envelope field', () => {
    const result = against(
      JSON.stringify({ $schema: './registry.schema.json', contract_version: '1.0', applications: [], notes: 'x' })
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain('/contract_version');
    expect(result.message).toContain('/notes');
  });

  it('three entries each broken differently, reporting every one in a single run', () => {
    const result = against(
      envelope(
        entry({ id: 'first', status: 'Retired' }),
        entry({ id: 'second', tech: [] }),
        entry({ id: 'third', source: 'http://insecure.example' })
      )
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain('3 violations');
    expect(result.message).toContain('/applications/0/status');
    expect(result.message).toContain('/applications/1/tech');
    expect(result.message).toContain('/applications/2/source');
  });

  it('and prints them sorted by pointer, not in the order the walk found them', () => {
    // The walk reaches `properties` before `additionalProperties`, so `id` is
    // found first and `aaa` second. Sorted output prints `aaa` first, and two
    // runs over one tree therefore print one string.
    const result = against(envelope(entry({ id: 'Not Kebab', aaa: 1 })));
    const message = result.message;

    expect(result.ok).toBe(false);
    expect(message.indexOf('/applications/0/aaa')).toBeGreaterThan(-1);
    expect(
      message.indexOf('/applications/0/aaa'),
      'the violations are unsorted, so two runs over one Registry can print two different messages'
    ).toBeLessThan(message.indexOf('/applications/0/id'));
  });

  it('and prints the same string twice for the same input', () => {
    const registry = envelope(entry({ id: 'A', tech: ['x', 'x'], licence: 'MIT' }));

    expect(against(registry).message).toBe(against(registry).message);
  });

  it('a tech array that repeats a value or is not strings, so the field means something', () => {
    const repeated = against(envelope(entry({ tech: ['Elixir', 'Elixir'] })));
    const empty = against(envelope(entry({ tech: ['Elixir', ''] })));
    const wrong = against(envelope(entry({ tech: 'Elixir' })));

    expect(repeated.ok).toBe(false);
    expect(repeated.message).toContain('/applications/0/tech/1');
    expect(empty.ok).toBe(false);
    expect(empty.message).toContain('/applications/0/tech/1');
    expect(wrong.ok).toBe(false);
    expect(wrong.message).toContain('expected array, found string');
  });

  it('an id that is not kebab-case, and a live URL that is not https', () => {
    const result = against(envelope(entry({ id: 'Demo_App', status: 'Live', live: 'http://demo.example' })));

    expect(result.ok).toBe(false);
    expect(result.message).toContain('/applications/0/id');
    expect(result.message).toContain('/applications/0/live');
  });

  it('a source that is a bare scheme with no host, and a live carrying a space', () => {
    // The two shapes `^https://` alone let through. Run against the whole gate
    // rather than against the pattern, so what is asserted is the verdict a
    // runner reaches and not a regular expression read out of the same file.
    const hostless = against(envelope(entry({ source: 'https://' })));
    const spaced = against(envelope(entry({ status: 'Live', live: 'https://demo.example/a b' })));

    expect(hostless.ok).toBe(false);
    expect(hostless.message).toContain('/applications/0/source');
    expect(spaced.ok).toBe(false);
    expect(spaced.message).toContain('/applications/0/live');

    // And a real URL still passes, so the tightening did not simply refuse
    // everything.
    const real = against(
      envelope(entry({ status: 'Live', live: 'https://cs-tracker.cuatro.dev/scores?page=2' }))
    );
    expect(real.ok, real.message).toBe(true);
  });

  it('without letting a Registry value forge a line inside the refusal', () => {
    // The Registry is hand-authored and committed, and the refusal is still
    // built from its contents. A name carrying a newline would otherwise fake a
    // line that reads like this gate's own prose and push the real violation out
    // of an operator's view. Same escaping, and the same reasoning, as
    // `ops/contract-purity.md` records under "Characters that forge or disguise
    // a line".
    const result = against(envelope(entry({ id: 'evil\n    /applications/9: fine' })));

    expect(result.ok).toBe(false);
    expect(result.message).toContain(String.raw`evil\n    /applications/9: fine`);
    const forged = result.message.split('\n').filter((line) => line.includes('/applications/9'));
    expect(forged, 'the forged text was printed as a line of its own').toHaveLength(1);
  });

  it('without drawing two different values as one string', () => {
    // The escaping has to be injective or it is a second way to hide. A value
    // written with a literal backslash and an `n` must not print as the value
    // carrying a real newline.
    const real = against(envelope(entry({ id: 'a\nb' }))).message;
    const literal = against(envelope(entry({ id: String.raw`a\nb` }))).message;

    expect(real).not.toBe(literal);
  });

  it('without letting a value be drawn as something other than what it is', () => {
    // `JSON.stringify` escapes the C0 range and stops there. U+2028 terminates a
    // line for a JavaScript reader and for some log viewers, U+202E reorders how
    // the rest of a value is drawn, U+009B is a C1 control a terminal reads as an
    // escape sequence introducer, and U+200B is drawn as nothing at all, so two
    // different ids render as one string. None of the four is caught by a code
    // point test that only knows about the C0 range.
    //
    // Built from code points rather than written into this file, so this source
    // carries no character that draws as something other than what it is.
    //
    // 0x7f is DEL and 0x07 is a C0 control. `JSON.stringify` escapes the C0
    // range and stops at 0x1f, so DEL passed straight through `show()` while
    // `printable()` escaped it: the two escapers disagreed about one character
    // and the one that prints every Registry value was the looser of the two.
    for (const point of [0x2028, 0x2029, 0x202e, 0x200f, 0x009b, 0x200b, 0x00ad, 0xfeff, 0x7f, 0x07]) {
      const hidden = String.fromCodePoint(point);
      const result = against(envelope(entry({ id: `probe${hidden}` })));

      expect(result.ok).toBe(false);
      expect(result.message, `U+${point.toString(16)} reached the operator's log as itself`).not.toContain(hidden);
      expect(result.message).toContain(`\\u${point.toString(16).padStart(4, '0')}`);
    }

    // And the escaping stays injective across that class: two ids differing only
    // by which invisible character they carry are two ids, and an operator who
    // cannot tell them apart in the log cannot act on either. Both fixtures are
    // refusals, so the two messages compared are two refusals.
    const idWith = (point: number) => against(envelope(entry({ id: `probe${String.fromCodePoint(point)}` })));
    expect(idWith(0x200b).ok).toBe(false);
    expect(idWith(0x200c).ok).toBe(false);
    expect(idWith(0x200b).message).not.toBe(idWith(0x200c).message);
  });

  it('and cuts a long value by code point, so it never emits half a character', () => {
    // A value longer than the quoting limit is truncated, and a cut by UTF-16
    // code unit can land between the two halves of an astral character and emit
    // a lone surrogate: a code point neither escaper describes and no terminal
    // draws. Cut by code point, that is not reachable.
    const result = against(envelope(entry({ id: '\u{1F600}'.repeat(200) })));

    expect(result.ok).toBe(false);
    expect(result.message, 'the value was not truncated, so this case measured nothing').toContain('...');
    const lone = [...result.message].filter((character) => {
      const point = character.codePointAt(0) ?? 0;
      return point >= 0xd800 && point <= 0xdfff;
    });
    expect(lone, 'the truncation split a surrogate pair').toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// The pure parts, exercised where the whole message would say less.
// ---------------------------------------------------------------------------

describe('the validator itself', () => {
  it('names the rule and the schema pointer on every violation, so a defect is traceable', () => {
    const violations = validate(shippedSchema, JSON.parse(envelope(entry({ status: 'Retired' }))));

    expect(violations).toHaveLength(1);
    expect(violations[0].instance).toBe('/applications/0/status');
    expect(violations[0].rule).toBe('enum');
    expect(violations[0].schema).toBe('#/definitions/application/properties/status/enum');
  });

  it('reports one complaint for a wrong-typed value, not one per keyword it then skipped', () => {
    const violations = validate(shippedSchema, JSON.parse(envelope(entry({ status: 7 }))));

    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe('type');
  });

  it('refuses a Registry it validated but could not count, rather than passing over it', () => {
    // The refusal that makes "a green run means the Registry was read" true. It
    // fires only when the schema has stopped requiring `applications`, so the
    // fixture is a schema that no longer does: the envelope then validates, the
    // gate has nothing to count, and a pass there would be a green run over a
    // Registry with no application list at all.
    const loosened = JSON.parse(schemaText);
    loosened.required = loosened.required.filter((name: string) => name !== 'applications');
    const result = report(
      inspect(
        asSchema(JSON.stringify(loosened)),
        asRegistry(JSON.stringify({ $schema: './registry.schema.json', contract_version: '1.0.0' }))
      )
    );

    expect(result.ok, 'a Registry with no application list was reported as valid').toBe(false);
    expect(result.message).toContain('no application list this gate could count');
    expect(result.message).toContain('the schema stopped requiring one');
  });

  it('takes the else branch when the if does not match, not only the then branch', () => {
    // `else` is implemented and the shipped schema uses neither `else` nor a
    // schema-form `additionalProperties`, so both are refusals with no standing
    // case: implemented, exercised by nothing, and free to stop working. Same
    // argument this file makes everywhere else.
    const schema = {
      type: 'object',
      if: { required: ['kind'], properties: { kind: { const: 'a' } } },
      then: { required: ['onlyOnA'] },
      else: { required: ['onlyOffA'] },
    };

    expect(validate(schema, { kind: 'a', onlyOnA: 1 })).toEqual([]);
    expect(validate(schema, { kind: 'b', onlyOffA: 1 })).toEqual([]);
    expect(validate(schema, { kind: 'a' })[0].detail).toContain('"onlyOnA"');
    const off = validate(schema, { kind: 'b' });
    expect(off, 'the else branch was never applied, so half the condition asserts nothing').toHaveLength(1);
    expect(off[0].detail).toContain('"onlyOffA"');
    expect(off[0].schema).toContain('/else/');
  });

  it('applies the schema form of additionalProperties, not only the false form', () => {
    const schema = {
      type: 'object',
      properties: { named: { type: 'string' } },
      additionalProperties: { type: 'number' },
    };

    expect(validate(schema, { named: 'x', extra: 7 })).toEqual([]);
    const wrong = validate(schema, { named: 'x', extra: 'seven' });
    expect(wrong, 'an additional property was validated against nothing').toHaveLength(1);
    expect(wrong[0].instance).toBe('/extra');
    expect(wrong[0].detail).toContain('expected number, found string');
  });

  it('applies the duplicate-id rule to ids only, and reports every repeat', () => {
    const registry = { applications: [{ id: 'a' }, { id: 'b' }, { id: 'a' }, { id: 'a' }] };

    expect(duplicateIds(registry).map((violation) => violation.instance)).toEqual([
      '/applications/2/id',
      '/applications/3/id',
    ]);
    expect(duplicateIds({ applications: [] })).toEqual([]);
    expect(duplicateIds({}), 'a Registry with no list produced a duplicate-id finding').toEqual([]);
  });

  it('refuses a subschema that is not an object, rather than applying nothing', () => {
    // A boolean schema is legal draft-07 and is not implemented here. Left
    // unaudited it would apply no rule at all and the gate would be green over
    // whatever it guarded.
    const findings = auditSchema({ type: 'object', properties: { a: true } });

    expect(findings).toHaveLength(1);
    expect(findings[0].pointer).toBe('/properties/a');
  });

  it('refuses a pattern that will not compile, which is a rule nothing can enforce', () => {
    const findings = auditSchema({ type: 'string', pattern: '([' });

    expect(findings).toHaveLength(1);
    expect(findings[0].detail).toContain('will not compile');
  });

  it('refuses a $ref to a definition the schema does not carry', () => {
    const findings = auditSchema({ type: 'object', properties: { a: { $ref: '#/definitions/nowhere' } } });

    expect(findings).toHaveLength(1);
    expect(findings[0].detail).toContain('does not define');
  });

  it('reports every unsupported keyword in one pass, sorted by schema pointer', () => {
    const findings = auditSchema({
      type: 'object',
      properties: { b: { anyOf: [] }, a: { format: 'uri' } },
    });

    expect(findings.map((finding) => finding.pointer)).toEqual([
      '/properties/a/format',
      '/properties/b/anyOf',
    ]);
  });
});

// ---------------------------------------------------------------------------
// The real read path, through the binary the CI job actually runs.
// ---------------------------------------------------------------------------

describe('the gate as the job runs it', () => {
  // The module resolves both files at `../contracts/`, so a scratch copy of it
  // one directory below a scratch `contracts/` exercises the real read, the real
  // parse and the real exit code without ever touching the committed pair.
  const runBeside = (build: (contracts: string) => void) =>
    withRoot((root) => {
      const contracts = join(root, 'contracts');
      mkdirSync(contracts, { recursive: true });
      build(contracts);
      const ops = join(root, 'ops');
      mkdirSync(ops, { recursive: true });
      const copy = join(ops, 'registry-schema.mjs');
      copyFileSync(GATE, copy);
      return spawned(spawnSync(process.execPath, [copy], { encoding: 'utf8' }));
    });

  it('exits 0 against the committed pair and says what it read', () => {
    const run = spawned(spawnSync(process.execPath, [GATE], { encoding: 'utf8' }));

    expect(run.status, `${run.stdout}${run.stderr}`).toBe(0);
    expect(run.stdout).toContain(REGISTRY);
    expect(run.stdout).toContain(SCHEMA);
    expect(run.stderr).toBe('');
  });

  it('prints the same line from any working directory, so a runner and a checkout agree', () => {
    const here = spawned(spawnSync(process.execPath, [GATE], { encoding: 'utf8' }));
    const inOps = spawned(
      spawnSync(process.execPath, [GATE], { encoding: 'utf8', cwd: resolve(process.cwd(), 'ops') })
    );

    expect(inOps.status, `${inOps.stdout}${inOps.stderr}`).toBe(0);
    expect(inOps.stdout).toBe(here.stdout);
    // A backslash here would mean a Windows checkout and an Ubuntu runner print
    // two different strings for one run.
    expect(here.stdout).not.toContain('\\');
  });

  it('exits 1 and writes the refusal to stderr when the Registry is malformed', () => {
    const run = runBeside((contracts) => {
      copyFileSync(SCHEMA_FILE, join(contracts, 'registry.schema.json'));
      writeFileSync(
        join(contracts, 'registry.json'),
        JSON.stringify({ $schema: './registry.schema.json', contract_version: '1.0.0', applications: [{}] }),
        'utf8'
      );
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('AD-4');
    expect(run.stderr).toContain('/applications/0');
    expect(run.stdout).toBe('');
  });

  it('exits 1 when the Registry is absent, rather than passing over nothing', () => {
    const run = runBeside((contracts) => copyFileSync(SCHEMA_FILE, join(contracts, 'registry.schema.json')));

    expect(run.status, `${run.stdout}${run.stderr}`).toBe(1);
    expect(run.stderr).toContain(REGISTRY);
    expect(run.stderr).toContain('ENOENT');
  });

  it('exits 1 when the schema is absent, which is the same refusal on the other file', () => {
    const run = runBeside((contracts) => copyFileSync(REGISTRY_FILE, join(contracts, 'registry.json')));

    expect(run.status, `${run.stdout}${run.stderr}`).toBe(1);
    expect(run.stderr).toContain(SCHEMA);
  });

  it('reads no argument, so nothing at the call site can point it somewhere else', () => {
    const run = withRoot((root) => {
      const contracts = join(root, 'contracts');
      mkdirSync(contracts, { recursive: true });
      copyFileSync(SCHEMA_FILE, join(contracts, 'registry.schema.json'));
      writeFileSync(join(contracts, 'registry.json'), '{}', 'utf8');
      return spawned(spawnSync(process.execPath, [GATE, contracts], { encoding: 'utf8' }));
    });

    // The argument named a directory carrying an invalid Registry. A gate that
    // honoured it would exit 1 here, and would be a gate any caller could point
    // at a file that happens to be valid.
    expect(run.status, `${run.stdout}${run.stderr}`).toBe(0);
  });

  it('reads no environment variable either, which is the same hole with a different shape', () => {
    // Asserted on the source rather than by guessing at a variable name, so a
    // future variable cannot slip past a case that only knew the old one.
    const source = readFileSync(GATE, 'utf8');
    const instructions = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');

    expect(instructions).not.toContain('process.env');
    expect(instructions, 'node:process is a route to the environment that spells no "process.env"').not.toMatch(
      /from\s*['"]node:process['"]/
    );
    const argv = [...instructions.matchAll(/process\.argv[^\s,;)]*/g)].map((match) => match[0]);
    expect(argv.length).toBeGreaterThan(0);
    for (const use of argv) {
      expect(use, 'the gate reads an argv position other than the script path').toBe('process.argv[1]');
    }
  });

  it('imports only node builtins, which is what lets the job install nothing', () => {
    const source = readFileSync(GATE, 'utf8');
    const specifiers = [...source.matchAll(/^import\s[^'"]*['"]([^'"]+)['"]/gm)].map((match) => match[1]);

    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) expect(specifier).toMatch(/^node:/);
  });

  it('reaches for no dependency by any other route either, ajv included', () => {
    // The job installs nothing on purpose, so a package specifier reached at
    // runtime is a hard crash on the very run the "still validates when the
    // install fails" argument exists to cover.
    const source = readFileSync(GATE, 'utf8');
    const instructions = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    const dynamic = [...instructions.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);

    for (const specifier of dynamic) expect(specifier, 'a dynamic import reaches outside node:').toMatch(/^node:/);
    expect(instructions, 'createRequire is a route to a package the job never installs').not.toContain(
      'createRequire'
    );
    expect(instructions, 'a bare require() is the same route with a shorter name').not.toMatch(/\brequire\s*\(/);
    expect(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')).not.toContain('"ajv"');
  });

  it('never answers "not invoked directly" when it cannot tell', () => {
    // A guard that decides it was not invoked directly runs nothing and lets the
    // process exit 0: a gate failing open, which is the one outcome this whole
    // file exists to prevent. Asserted on the source, because reaching the
    // throwing branch needs a path the operating system will not resolve while
    // still being the script Node just executed.
    const source = readFileSync(GATE, 'utf8');
    const guard = source.slice(source.indexOf('function sameFile'));
    const fallback = guard
      .slice(guard.indexOf('catch'), guard.indexOf('\n}'))
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');

    expect(fallback.length, 'the invoked-directly guard has no catch to inspect').toBeGreaterThan(0);
    expect(fallback, 'the invoked-directly guard fails open when a path will not resolve').not.toMatch(
      /return\s+false/
    );
    expect(fallback, 'the fallback is not a comparison of the two paths').toMatch(/resolve\(.+===.+resolve\(/);
  });

  it('records the verdict before it writes, so a lost write callback cannot exit 0', () => {
    const source = readFileSync(GATE, 'utf8');
    const guarded = source.slice(source.indexOf('if (invokedDirectly)'));
    const instructions = guarded
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
    const verdict = instructions.indexOf('process.exitCode');
    const write = instructions.indexOf('stream.write');

    expect(guarded.length, 'the invoked-directly block has no body to inspect').toBeGreaterThan(0);
    expect(verdict, 'the verdict is recorded nowhere outside the write callback').toBeGreaterThan(-1);
    expect(write, 'the message is written nowhere, so there is no ordering to hold').toBeGreaterThan(-1);
    expect(verdict, 'the verdict is recorded after the write, so a lost callback exits 0').toBeLessThan(write);
  });
});

// ---------------------------------------------------------------------------
// The workflow's own wiring, read as the data it is. Nothing executes `ci.yml`
// before it reaches `main`.
// ---------------------------------------------------------------------------

describe('the CI wiring', () => {
  // Line endings normalised before anything is matched. `.gitattributes` pins LF
  // by format and names no `.yml`, so this file arrives CRLF on a Windows
  // checkout and every anchored pattern below would miss on the authoring host
  // while passing on the runner.
  const workflow = atCollection(`${WORKFLOW} could not be read, and it is the file this block asserts.`, () =>
    readFileSync(WORKFLOW, 'utf8').replace(/\r\n/g, '\n')
  );
  const marker = '\njobs:\n';
  const found = workflow.indexOf(marker);
  if (found === -1) {
    throw new Error(`${HERE}: ${WORKFLOW} has no top-level "jobs:" key, so no job can be read out of it`);
  }
  const jobsSection = workflow.slice(found + marker.length);
  const JOB_ID = /^ {2}([A-Za-z_][A-Za-z0-9_-]*):$/gm;
  const jobNames = [...jobsSection.matchAll(JOB_ID)].map((match) => match[1]);

  const blockFor = (name: string): string => {
    const lines = jobsSection.split('\n');
    const start = lines.indexOf(`  ${name}:`);
    if (start === -1) throw new Error(`${HERE}: no job named ${name} in ${WORKFLOW}`);
    let end = lines.length;
    for (let index = start + 1; index < lines.length; index += 1) {
      if (/^ {2}[A-Za-z_]/.test(lines[index])) {
        end = index;
        break;
      }
    }
    return lines.slice(start, end).join('\n');
  };

  // The job's comments discuss `continue-on-error` and `if:` by name, so the
  // assertions below read its instructions rather than its prose.
  const instructionsOf = (name: string): string =>
    blockFor(name)
      .split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n');

  it(`carries a ${JOB} job`, () => {
    expect(jobNames, `the ${JOB} job is gone from ${WORKFLOW}, so AD-4 has no gate holding it`).toContain(JOB);
  });

  it('runs the gate this file tests, with no argument beside it', () => {
    const commands = [...instructionsOf(JOB).matchAll(/^\s*run: (.+)$/gm)].map((match) => match[1].trim());

    expect(commands, `the ${JOB} job runs something other than the gate, or runs more than one thing`).toEqual([
      'node ops/registry-schema.mjs',
    ]);
    expect(existsSync(GATE), 'the job names a script that is not in the tree').toBe(true);
  });

  it('never downgrades the job to a warning and never makes it conditional (AD-21)', () => {
    const instructions = instructionsOf(JOB);

    expect(instructions, `AD-21: the ${JOB} job may never be soft-failed`).not.toMatch(/continue-on-error\s*:/);
    expect(instructions, `AD-21: the ${JOB} job may never swallow a non-zero exit`).not.toContain('|| true');
    expect(instructions, `AD-21: the ${JOB} job may never be skipped`).not.toMatch(/^\s+if\s*:/m);
    // `needs:` is a skip condition wearing another name: `needs: test` would
    // drop the Registry gate on every run where the suite is already red.
    expect(instructions, `AD-21: the ${JOB} job may never be skipped because another job failed first`).not.toMatch(
      /^\s+needs\s*:/m
    );
  });

  it('runs where the record says it runs, on the Node the record says', () => {
    const instructions = instructionsOf(JOB);

    expect(instructions, 'ops/registry-schema.md tables ubuntu-latest').toMatch(/^\s+runs-on: ubuntu-latest$/m);
    expect(instructions, 'ops/registry-schema.md tables Node 22 through setup-node').toMatch(
      /^\s+node-version: 22$/m
    );
    expect(instructions, 'a container: would change what the recorded run means').not.toMatch(/^\s+container\s*:/m);
    expect(instructions, 'ops/registry-schema.md tables timeout-minutes: 5').toMatch(/^\s+timeout-minutes: 5$/m);
  });

  it('installs nothing, which is what makes it run when the install fails', () => {
    const actions = [...instructionsOf(JOB).matchAll(/^\s*- uses: (.+)$/gm)].map((match) => match[1].trim());

    expect(actions, `the ${JOB} job gained or lost an action step`).toEqual([
      'actions/checkout@v7',
      'actions/setup-node@v7',
    ]);
    expect(instructionsOf(JOB), 'the job installs, so it no longer runs when the install fails').not.toContain(
      'pnpm install'
    );
    expect(instructionsOf(JOB)).not.toContain('cache: pnpm');
    // From v5, `setup-node` caches automatically whenever `package.json` carries
    // a `packageManager` field, and this repository's does. The absence of a
    // `cache:` line above therefore stopped meaning "no cache" on its own, and
    // this is the line that still means it. Without it the action looks for a
    // pnpm this job never installs.
    expect(instructionsOf(JOB), 'setup-node will cache off packageManager unless this is here').toMatch(
      /^\s+package-manager-cache: false$/m
    );
  });

  it("declares no on: of its own, so it runs on the file's triggers and the two cannot drift", () => {
    expect(instructionsOf(JOB)).not.toMatch(/^\s+on\s*:/m);
    expect(workflow).toMatch(/^on:\n {2}push:\n {4}branches: \['\*\*'\]\n {2}pull_request:\n {4}branches: \[main\]$/m);
  });

  it('declares no env:, so no runner environment reaches the gate', () => {
    expect(instructionsOf(JOB), `the ${JOB} job gained an env: block`).not.toMatch(/^\s+env\s*:/m);
    // And none at the top level of the file either. A workflow-wide `env:`
    // reaches every job including this one, and the job block alone cannot see
    // it.
    expect(workflow, 'ci.yml gained a top-level env: block, which reaches every job in the file').not.toMatch(
      /^env\s*:/m
    );
  });

  it('sits after contract-purity, and adds no other job', () => {
    expect(
      jobNames,
      'the order is a reader convenience, since jobs run in parallel. The set is not: a job added or removed' +
        ' here changes what holds AD-4 and AD-1 and what this suite has been told to expect'
    ).toEqual(['test', 'tokens-contract', 'fonts-contract', 'contract-purity', JOB, 'rendered-output']);
  });

  it('leaves the five pre-existing jobs carrying the steps they carried', () => {
    // Not a byte comparison against the baseline commit, which the story
    // verified once by hand. This is the standing half: the five jobs still do
    // the five things they exist to do.
    expect(instructionsOf('test')).toContain('pnpm test --run');
    expect(instructionsOf('test')).toContain('pnpm typecheck');
    expect(instructionsOf('tokens-contract')).toContain('pnpm tokens:build');
    expect(instructionsOf('fonts-contract')).toContain('pnpm fonts:build');
    expect(instructionsOf('contract-purity')).toContain('node ops/contract-purity.mjs');
    expect(instructionsOf('rendered-output')).toContain('pnpm test:e2e');
  });
});
