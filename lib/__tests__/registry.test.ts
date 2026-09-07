// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEMO_VALUES,
  HUB_ORIGIN,
  IDENTITY_VALUES,
  REGISTRY_STATUSES,
  RENDERED_STATUSES,
  REQUIRED_FIELDS,
  applications,
  groupByFamily,
  isCurrentOrigin,
  orderByStatus,
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

describe('the order a Visitor reads them in is a rule over status', () => {
  // Story 2-9. Nothing in the committed Registry is `Complete`, so every arm of this rule but the
  // last is provable only against fixtures. That is the same reason `selectRendered` takes its
  // list, and it is why these cases build entries rather than reading the file.

  it('puts every Live before every Complete, whatever order the file holds them in', () => {
    const entries = [
      entry({ id: 'finished', status: 'Complete' }),
      entry({ id: 'running', status: 'Live', live: 'https://running.cuatro.dev' }),
    ];
    expect(orderByStatus(entries).map((application) => application.id)).toEqual(['running', 'finished']);
  });

  it('preserves file order inside a status, so it is not sorting by name', () => {
    // Deliberately reverse-alphabetical inside the `Live` group. An alphabetical sort, or one over
    // any other field, returns `bravo` first and fails here rather than quietly reordering the
    // Registry, whose order is the Registry's to decide.
    const entries = [
      entry({ id: 'zulu', name: 'Zulu', status: 'Live', live: 'https://zulu.cuatro.dev' }),
      entry({ id: 'alpha', name: 'Alpha', status: 'Complete' }),
      entry({ id: 'bravo', name: 'Bravo', status: 'Live', live: 'https://bravo.cuatro.dev' }),
    ];
    expect(orderByStatus(entries).map((application) => application.id)).toEqual(['zulu', 'bravo', 'alpha']);
  });

  it('leaves a list of one status exactly where it found it', () => {
    // Which is the committed Registry today: all six rendered entries are `Live`, so the rule has
    // to be a no-op on it. A comparator that reordered equal ranks would show up here.
    expect(orderByStatus(renderedApplications).map((application) => application.id)).toEqual(
      renderedApplications.map((application) => application.id)
    );
  });

  it('sorts a status it does not rank last rather than throwing', () => {
    // `selectRendered` has already removed these. A comparator is the wrong place to discover it
    // has not, so the unranked value goes to the end and the caller still gets a list.
    const entries = [entry({ id: 'held', status: 'Archived' }), entry({ id: 'shown', status: 'Live', live: 'https://shown.cuatro.dev' })];
    expect(orderByStatus(entries).map((application) => application.id)).toEqual(['shown', 'held']);
  });

  it('does not mutate the list it is given', () => {
    const entries = [
      entry({ id: 'finished', status: 'Complete' }),
      entry({ id: 'running', status: 'Live', live: 'https://running.cuatro.dev' }),
    ];
    orderByStatus(entries);
    expect(entries.map((application) => application.id)).toEqual(['finished', 'running']);
  });

  it('returns nothing for an empty list', () => {
    expect(orderByStatus([])).toEqual([]);
  });
});

describe('You are here is a property of the origin, never of an id', () => {
  it('marks the entry whose live hostname is the declared origin', () => {
    expect(isCurrentOrigin(entry({ status: 'Live', live: HUB_ORIGIN }))).toBe(true);
  });

  it('moves with the origin instead of staying on one entry', () => {
    // The whole argument for comparing origins rather than matching an id: move the Hub and the
    // mark moves with it. An id match would go on claiming the visitor was here after the move.
    const hub = entry({ id: 'the-hub', status: 'Live', live: 'https://elsewhere.example' });
    expect(isCurrentOrigin(hub)).toBe(false);
    expect(isCurrentOrigin(hub, 'https://elsewhere.example')).toBe(true);
  });

  it('compares origins, so a path or a trailing slash still matches', () => {
    expect(isCurrentOrigin(entry({ status: 'Live', live: `${HUB_ORIGIN}/` }))).toBe(true);
    expect(isCurrentOrigin(entry({ status: 'Live', live: `${HUB_ORIGIN}/projects` }))).toBe(true);
  });

  it('does not match a different scheme, a different port or a subdomain of the same site', () => {
    for (const live of ['http://cuatro.dev', 'https://cuatro.dev:8443', 'https://tracker.cuatro.dev']) {
      expect(isCurrentOrigin(entry({ status: 'Live', live })), `${live} is not the Hub's origin`).toBe(false);
    }
  });

  it('does not match an entry carrying no live hostname', () => {
    expect(isCurrentOrigin(entry({ status: 'Complete' }))).toBe(false);
  });

  it('answers false for a value URL refuses, on either side, rather than throwing', () => {
    expect(isCurrentOrigin(entry({ status: 'Live', live: 'not-a-url' }))).toBe(false);
    expect(isCurrentOrigin(entry({ status: 'Live', live: HUB_ORIGIN }), 'not-a-url')).toBe(false);
  });

  it('marks exactly one committed entry, and it is the Hub itself', () => {
    const here = renderedApplications.filter((application) => isCurrentOrigin(application));
    expect(here.map((application) => application.id)).toEqual(['cuatro-portfolio']);
  });

  it('is the one origin the site declares, so metadataBase cannot drift from the mark', () => {
    // The repository holds one origin, not two. `app/layout.tsx` builds `metadataBase` from this
    // declaration, and a second literal anywhere under `app/` is exactly the drift this refuses:
    // both halves would go on agreeing with themselves while the site declared one origin and the
    // directory compared against another.
    //
    // **Scoped to `app/`, not to `app/layout.tsx`.** The first version of this case read the layout
    // alone and passed while three route files each hard-coded the same hostname in
    // `openGraph.url`, which is three more places to forget on the day the Hub moves. Next resolves
    // a relative `url` against `metadataBase`, so those are authored relative and this is what
    // holds them that way.
    const routeFiles: string[] = [];
    const walkApp = (directory: string) => {
      for (const found of readdirSync(join(REPO_ROOT, directory), { withFileTypes: true })) {
        if (found.isDirectory()) {
          if (found.name !== '__tests__') walkApp(`${directory}/${found.name}`);
          continue;
        }
        if (/\.tsx?$/.test(found.name)) routeFiles.push(`${directory}/${found.name}`);
      }
    };
    walkApp('app');

    expect(routeFiles.length, 'no source was found under app/, so the scan below is vacuous').toBeGreaterThan(5);
    expect(routeFiles, 'app/layout.tsx was not scanned').toContain('app/layout.tsx');
    expect(routeFiles, 'app/page.tsx was not scanned').toContain('app/page.tsx');

    const layout = readFileSync(join(REPO_ROOT, 'app', 'layout.tsx'), 'utf8');
    expect(layout, 'app/layout.tsx no longer builds metadataBase from the declared origin').toContain(
      'new URL(HUB_ORIGIN)'
    );

    // No `g` flag: `RegExp.test` with one is stateful through `lastIndex`, so a shared instance
    // would answer differently on the same input depending on which file was scanned before it.
    const literal = new RegExp(HUB_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const writtenTwice = routeFiles.filter((path) => literal.test(readFileSync(join(REPO_ROOT, path), 'utf8')));
    expect(
      writtenTwice,
      `a source under app/ writes the Hub origin as a literal rather than consuming HUB_ORIGIN. ` +
        `An openGraph url is authored relative and resolved against metadataBase:\n${writtenTwice.join('\n')}`
    ).toEqual([]);

    // The matcher, on planted controls, so an empty result is a measurement rather than a regex
    // that stopped matching the origin it was built from.
    expect(literal.test(`url: '${HUB_ORIGIN}/work'`), 'the scan no longer fires on a hard-coded origin').toBe(true);
    expect(literal.test("url: '/work'"), 'the scan fires on a relative url').toBe(false);
  });
});

describe('a family renders as one group, which is a rule over the family field', () => {
  it('collapses a family into one group, positioned at its first member', () => {
    const entries = [
      entry({ id: 'alone', status: 'Live', live: 'https://alone.cuatro.dev' }),
      entry({ id: 'first', status: 'Live', live: 'https://first.cuatro.dev', family: 'a-family' }),
      entry({ id: 'between', status: 'Live', live: 'https://between.cuatro.dev' }),
      entry({ id: 'second', status: 'Live', live: 'https://second.cuatro.dev', family: 'a-family' }),
    ];
    expect(
      groupByFamily(entries).map((item) => (item.kind === 'entry' ? item.entry.id : `${item.family}: ${item.members.map((m) => m.id).join(', ')}`))
    ).toEqual(['alone', 'a-family: first, second', 'between']);
  });

  it('renders a family of one as a group, so the box does not come and go', () => {
    // The framing line names no count (`EXPERIENCE.md:292`), so a family that loses a member to a
    // status change needs no other edit. A rule that unwrapped a lone member would make the one
    // container in the directory appear and disappear as the estate moved.
    const grouped = groupByFamily([entry({ id: 'only', status: 'Live', live: 'https://only.cuatro.dev', family: 'a-family' })]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].kind).toBe('family');
  });

  it('leaves an entry carrying no family ungrouped', () => {
    const grouped = groupByFamily([entry({ id: 'alone', status: 'Live', live: 'https://alone.cuatro.dev' })]);
    expect(grouped).toEqual([{ kind: 'entry', entry: expect.objectContaining({ id: 'alone' }) }]);
  });

  it('keeps two families apart rather than merging them into one box', () => {
    const entries = [
      entry({ id: 'one', status: 'Live', live: 'https://one.cuatro.dev', family: 'first-family' }),
      entry({ id: 'two', status: 'Live', live: 'https://two.cuatro.dev', family: 'second-family' }),
    ];
    expect(groupByFamily(entries).map((item) => (item.kind === 'family' ? item.family : item.entry.id))).toEqual([
      'first-family',
      'second-family',
    ]);
  });

  it('draws every entry exactly once', () => {
    const entries = [
      entry({ id: 'a', status: 'Live', live: 'https://a.cuatro.dev', family: 'a-family' }),
      entry({ id: 'b', status: 'Live', live: 'https://b.cuatro.dev', family: 'a-family' }),
      entry({ id: 'c', status: 'Live', live: 'https://c.cuatro.dev' }),
    ];
    const drawn = groupByFamily(entries).flatMap((item) =>
      item.kind === 'entry' ? [item.entry.id] : item.members.map((member) => member.id)
    );
    expect(drawn.sort()).toEqual(['a', 'b', 'c']);
  });

  it('groups the committed family over what the filter left, not over the whole Registry', () => {
    // Three `tracker-family` members are committed and one is `In progress`, so the group the
    // directory draws holds two. Read off the file rather than pinned, so the day the third ships
    // this case follows it.
    const families = new Set(renderedApplications.map((application) => application.family).filter((family) => family !== undefined));
    expect(families.size, 'no committed rendered entry carries a family, so this case is vacuous').toBeGreaterThan(0);

    for (const family of families) {
      const group = groupByFamily(renderedApplications).find((item) => item.kind === 'family' && item.family === family);
      expect(group, `${family} is carried by a rendered entry and is not drawn as a group`).toBeDefined();
      expect(group?.kind === 'family' ? group.members.map((member) => member.id) : []).toEqual(
        renderedApplications.filter((application) => application.family === family).map((application) => application.id)
      );
    }
  });

  it('holds a Complete member inside the group, above Live entries that follow it', () => {
    // **Where the two rules disagree, and which one wins.** `orderByStatus` would put every `Live`
    // before every `Complete`; grouping pulls a `Complete` family member up into its group, which
    // sits at its first member's position. `EXPERIENCE.md:356-358` settles it in favour of the
    // group: it holds whichever members pass the filter, and its framing line names no count.
    //
    // Not reachable from the committed Registry, every rendered entry being `Live`. It arrives the
    // day the third `tracker-family` member changes status, which is why it is pinned here.
    const ordered = orderByStatus([
      entry({ id: 'family-live', status: 'Live', live: 'https://one.cuatro.dev', family: 'a-family' }),
      entry({ id: 'family-complete', status: 'Complete', family: 'a-family' }),
      entry({ id: 'loner', status: 'Live', live: 'https://two.cuatro.dev' }),
    ]);

    // The premise: ordering alone separates the two family members and puts the loner between them.
    expect(ordered.map((application) => application.id)).toEqual(['family-live', 'loner', 'family-complete']);

    const drawn = groupByFamily(ordered);
    expect(
      drawn.map((item) => (item.kind === 'entry' ? item.entry.id : `${item.family}: ${item.members.map((m) => m.id).join(', ')}`))
    ).toEqual(['a-family: family-live, family-complete', 'loner']);
  });

  it('leaves a group holding one status alone, so the case above is about the disagreement', () => {
    const ordered = orderByStatus([
      entry({ id: 'family-one', status: 'Live', live: 'https://one.cuatro.dev', family: 'a-family' }),
      entry({ id: 'family-two', status: 'Live', live: 'https://two.cuatro.dev', family: 'a-family' }),
      entry({ id: 'loner', status: 'Complete' }),
    ]);
    expect(
      groupByFamily(ordered).map((item) => (item.kind === 'entry' ? item.entry.id : item.family))
    ).toEqual(['a-family', 'loner']);
  });

  it('returns nothing for an empty list', () => {
    expect(groupByFamily([])).toEqual([]);
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
