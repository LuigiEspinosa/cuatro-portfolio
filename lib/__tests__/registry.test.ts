// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEMO_VALUES,
  IDENTITY_VALUES,
  REGISTRY_STATUSES,
  RENDERED_STATUSES,
  REQUIRED_FIELDS,
  applications,
  renderedApplications,
  selectRendered,
  type RegistryEntry,
} from '../registry';

/**
 * The Hub's read of the published Registry (Story 2.7).
 *
 * This file asserts the **rule**, not the data. What the fourteen entries say is
 * `ops/registry-inputs.md`'s subject and `ops/__tests__/registry-schema.test.ts`'s gate; a case
 * here that pinned six rendered entries by name would fail on the day an application ships, which
 * is the day AD-4 says nothing should have to change.
 *
 * It does read two committed files for two things a rule test cannot see on its own: that the
 * module lost no entry on the way in, and that the types still describe the schema they mirror.
 * The blocking `registry-schema` CI job validates the JSON against the schema and never opens this
 * module, so the second is exactly the gap that gate leaves.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

const committed = JSON.parse(readFileSync(join(REPO_ROOT, 'contracts', 'registry.json'), 'utf8')) as {
  contract_version: string;
  applications: { id: string; status: string; live?: string }[];
};

// `definitions`, not `$defs`: the schema declares draft-07, and `contracts/registry.schema.json`
// says why that dialect was chosen. `applications.items` is a `$ref` to this node.
const schema = JSON.parse(readFileSync(join(REPO_ROOT, 'contracts', 'registry.schema.json'), 'utf8')) as {
  definitions: { application: { required: string[]; properties: Record<string, { enum?: string[] }> } };
};

/** A minimal valid entry. Overridden per case, so a case says only what it is about. */
function entry(overrides: Partial<RegistryEntry> = {}): RegistryEntry {
  return {
    id: 'an-application',
    name: 'An Application',
    description: 'One sentence about the thing itself.',
    status: 'In progress',
    tech: ['TypeScript'],
    source: 'https://github.com/LuigiEspinosa/an-application',
    demo: 'none',
    identity: 'none',
    ...overrides,
  };
}

describe('the types still describe the schema they mirror', () => {
  // The premise of the module's one type assertion. The CI gate proves the JSON matches the schema
  // and cannot prove that these lists do, so a value added to the schema and not to the type would
  // otherwise reach a `switch` that silently has no arm for it.
  const application = schema.definitions.application;

  it('reads a schema with the node these cases compare against', () => {
    expect(application?.required, 'the schema has no application.required, so the cases below are vacuous').toBeDefined();
  });

  it.each([
    ['status', REGISTRY_STATUSES],
    ['demo', DEMO_VALUES],
    ['identity', IDENTITY_VALUES],
  ])('pins every %s the schema allows', (field, values) => {
    expect(application.properties[field].enum).toEqual([...values]);
  });

  it('pins the eight required fields', () => {
    expect(application.required).toEqual([...REQUIRED_FIELDS]);
  });

  it('renders a subset of the statuses that exist', () => {
    for (const status of RENDERED_STATUSES) expect(REGISTRY_STATUSES).toContain(status);
  });

  it('is read against a Registry on the contract major it was written for', () => {
    // A MINOR bump adds a value or an optional field and this module survives it. A MAJOR bump can
    // rename or remove one, which is what would make the assertion above a lie.
    expect(committed.contract_version.split('.')[0]).toBe('1');
  });
});

describe('the module reads the published Registry whole', () => {
  it('exposes every committed entry, in file order', () => {
    expect(committed.applications.length, 'the committed Registry is empty, so every case below is vacuous').toBeGreaterThan(
      0
    );
    expect(applications.map((application) => application.id)).toEqual(
      committed.applications.map((application) => application.id)
    );
  });

  it('reads the authored file rather than a copy of it', () => {
    // `import` and `readFileSync` reach the same path by different routes. If a build step ever
    // interposed a generated copy, the two would drift and this is where that shows up.
    expect(applications).toEqual(committed.applications);
  });
});

describe('which entries a Visitor sees is a rule over status', () => {
  it('returns rendered entries and nothing else', () => {
    expect(renderedApplications.length).toBeGreaterThan(0);
    for (const application of renderedApplications) expect(RENDERED_STATUSES).toContain(application.status);
  });

  it('leaves no rendered entry behind', () => {
    const expected = committed.applications.filter((application) =>
      (RENDERED_STATUSES as readonly string[]).includes(application.status)
    );
    expect(renderedApplications.map((application) => application.id)).toEqual(
      expected.map((application) => application.id)
    );
  });

  it('gives every Live entry a hostname to link to', () => {
    // The schema requires `live` when `status` is `Live`. This is the consumer side of that rule:
    // the route can never render a Live card whose link has nowhere to go. `Complete` is not
    // constrained either way by AD-5, so it is not asserted here.
    for (const application of renderedApplications) {
      if (application.status === 'Live') expect(application.live).toMatch(/^https:\/\//);
    }
  });

  it('surfaces an entry that becomes Live, with no second edit', () => {
    const pending = entry({ id: 'not-yet' });
    expect(selectRendered([pending])).toEqual([]);
    expect(selectRendered([{ ...pending, status: 'Live', live: 'https://not-yet.cuatro.dev' }])).toHaveLength(1);
  });

  it('surfaces a Complete entry, which FR-35 renders beside the Live ones', () => {
    expect(selectRendered([entry({ id: 'finished', status: 'Complete' })])).toHaveLength(1);
  });

  it('drops an entry that leaves a rendered status, in the same change', () => {
    const live = entry({ id: 'was-live', status: 'Live', live: 'https://was-live.cuatro.dev' });
    expect(selectRendered([live])).toHaveLength(1);
    const { live: _live, ...archived } = live;
    expect(selectRendered([{ ...archived, status: 'Archived' }])).toEqual([]);
  });

  it('holds back the two statuses the Registry keeps but does not render', () => {
    const held = REGISTRY_STATUSES.filter((status) => !RENDERED_STATUSES.includes(status));
    expect(held).toEqual(['In progress', 'Archived']);
    for (const status of held) expect(selectRendered([entry({ status })])).toEqual([]);
  });

  it('reads status and nothing else', () => {
    // Three shapes that differ in every other field. A rule that had grown a second condition,
    // "has a live hostname" or "is not absorbed" among them, fails here rather than quietly
    // hiding an application the Registry says is running.
    const entries: RegistryEntry[] = [
      entry({ id: 'one', status: 'Live', live: 'https://one.cuatro.dev' }),
      entry({ id: 'two', status: 'Live', live: 'https://two.example', family: 'a-family', token_contract: '1.1.0' }),
      entry({ id: 'three', status: 'In progress', absorbed_into: 'one' }),
    ];
    expect(selectRendered(entries).map((application) => application.id)).toEqual(['one', 'two']);
  });

  it('preserves the Registry order, read off the committed file', () => {
    const expected = committed.applications
      .filter((application) => (RENDERED_STATUSES as readonly string[]).includes(application.status))
      .map((application) => application.id);
    expect(expected.length).toBeGreaterThan(1);
    expect(renderedApplications.map((application) => application.id)).toEqual(expected);
  });

  it('returns nothing for an empty Registry rather than throwing', () => {
    expect(selectRendered([])).toEqual([]);
  });

  it('does not mutate the list it is given', () => {
    const entries = [entry({ id: 'kept', status: 'Live', live: 'https://kept.cuatro.dev' }), entry({ id: 'dropped' })];
    selectRendered(entries);
    expect(entries.map((application) => application.id)).toEqual(['kept', 'dropped']);
  });
});

describe('the Registry stays out of the browser bundle', () => {
  /**
   * Why this is a test and not a comment.
   *
   * `ProjectsHero` takes its count as a prop precisely so a client component never imports this
   * module: doing so would ship all fourteen entries to the browser to render one number, against
   * the non-3D budget Story 2.2 measures. Nothing enforced that, so the invariant lived on the
   * memory of whoever read the comment. This is the enforcement.
   *
   * A statement written as `import type` is exempt and must be: TypeScript erases it, so
   * `ProjectCard` can take a `RegistryEntry` prop while shipping no Registry. The distinction is
   * the whole point, which is why the pattern is anchored on the keyword rather than on the path,
   * and why a value import written as `import { type X, y }` is still reported: `y` is real.
   */
  const VALUE_IMPORT = /import\s+(?!type\s)[^;]*?from\s+['"]@\/lib\/registry['"]/;
  const clientFiles: string[] = [];
  const walk = (directory: string) => {
    for (const found of readdirSync(join(REPO_ROOT, directory), { withFileTypes: true })) {
      if (found.isDirectory()) {
        if (found.name !== '__tests__') walk(`${directory}/${found.name}`);
        continue;
      }
      if (!/\.tsx?$/.test(found.name)) continue;
      const path = `${directory}/${found.name}`;
      if (/^\s*['"]use client['"]/m.test(readFileSync(join(REPO_ROOT, path), 'utf8'))) clientFiles.push(path);
    }
  };
  for (const root of ['app', 'components', 'hooks', 'lib']) walk(root);

  it('found the client components, so the case below is not vacuous', () => {
    expect(clientFiles.length).toBeGreaterThan(5);
  });

  it('fires on a value import and not on a type-only one', () => {
    expect(VALUE_IMPORT.test(`import { applications } from '@/lib/registry';`)).toBe(true);
    expect(VALUE_IMPORT.test(`import registry, { selectRendered } from "@/lib/registry";`)).toBe(true);
    expect(VALUE_IMPORT.test(`import type { RegistryEntry } from '@/lib/registry';`)).toBe(false);
    expect(VALUE_IMPORT.test(`import { applications } from '@/lib/other';`)).toBe(false);
  });

  it('is imported for its values by no client component', () => {
    const importers = clientFiles.filter((path) => VALUE_IMPORT.test(readFileSync(join(REPO_ROOT, path), 'utf8')));
    expect(
      importers,
      `a client component imports the Registry, which ships every entry to the browser:\n${importers.join('\n')}`
    ).toEqual([]);
  });
});
