// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEMO_VALUES,
  ESTATE_FRAMEWORKS,
  ESTATE_LANGUAGES,
  HUB_ORIGIN,
  IDENTITY_VALUES,
  REGISTRY_STATUSES,
  RENDERED_STATUSES,
  REQUIRED_FIELDS,
  applications,
  groupByFamily,
  hubEntries,
  hubEntry,
  isCurrentOrigin,
  orderByStatus,
  renderedApplications,
  selectRendered,
  type RegistryEntry,
} from '../registry';
import { capitalise, pluralise, spellOut } from '../words';

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

describe('which entry the Hub is, is the same origin comparison read once (Story 2-11)', () => {
  it('answers the entry the directory marks, over the committed Registry', () => {
    // The Plate mark on the premise block and the `You are here` mark on the row below it state the
    // same fact, so they are the same rule read twice rather than two rules that agree today.
    const marked = applications.filter((application) => isCurrentOrigin(application));
    expect(marked.length, 'no committed entry serves the declared origin, so this case is vacuous').toBe(1);
    expect(hubEntry()?.id).toBe(marked[0].id);
  });

  it('moves with the origin instead of staying on one entry', () => {
    const elsewhere = applications.find(
      (application) => application.live !== undefined && !isCurrentOrigin(application)
    );
    expect(elsewhere, 'every committed entry with a hostname is the Hub, so this case is vacuous').toBeDefined();
    expect(hubEntry(elsewhere?.live)?.id).toBe(elsewhere?.id);
  });

  it('answers nothing for an origin the Registry does not serve, rather than the first entry', () => {
    // The failure worth naming: a lookup that fell back to `applications[0]` would put a plausible
    // name and a plausible domain on the mark on the day the Hub moved, and nothing would look
    // wrong. Absent is the honest answer, and the block draws no mark for it.
    expect(hubEntry('https://nothing-here.example')).toBeUndefined();
  });

  it('answers nothing for a value URL refuses, rather than throwing', () => {
    expect(hubEntry('not-a-url')).toBeUndefined();
  });

  it('reads the whole Registry and not the rendered subset', () => {
    // The application serving the page a reader is on is not a question about what the filter
    // shows. An entry flipped to a held-back status is still the thing they are looking at, and a
    // lookup over `renderedApplications` would silently stop finding it.
    const held = entry({ id: 'the-hub', status: 'In progress', live: HUB_ORIGIN });
    expect(selectRendered([held]), 'the fixture renders, so this case is not about a held-back entry').toEqual([]);
    expect(hubEntry(HUB_ORIGIN, [held])?.id).toBe('the-hub');
  });

  it('takes its list, so it can be exercised against a Registry the committed file is not', () => {
    const moved = entry({ id: 'moved', status: 'Live', live: 'https://elsewhere.example' });
    expect(hubEntry('https://elsewhere.example', [moved])?.id).toBe('moved');
    expect(hubEntry(HUB_ORIGIN, [moved])).toBeUndefined();
  });

  it('returns nothing for an empty Registry rather than throwing', () => {
    expect(hubEntry(HUB_ORIGIN, [])).toBeUndefined();
  });

  it('collects every match, because the Directory marks every one of them', () => {
    // `SuiteDirectoryRow` calls `isCurrentOrigin` per row, so two entries under one origin already
    // render two `You are here` marks. The plural form is what makes that state inspectable rather
    // than something only the rendered page knows about.
    const twice = [
      entry({ id: 'first', status: 'Live', live: HUB_ORIGIN }),
      entry({ id: 'second', status: 'Live', live: `${HUB_ORIGIN}/elsewhere` }),
      entry({ id: 'other', status: 'Live', live: 'https://other.example' }),
    ];
    expect(hubEntries(HUB_ORIGIN, twice).map((application) => application.id)).toEqual(['first', 'second']);
  });

  it('answers nothing when two entries claim one origin, rather than picking the first', () => {
    // **The failure this refuses.** A `find` would put one application's name and domain on the
    // plate mark while the Directory below marked two rows `You are here`: a page contradicting
    // itself, with every gate green because each half still agreed with itself. Answering nothing
    // is visible, because `Premise` then draws no mark at all.
    const twice = [
      entry({ id: 'first', status: 'Live', live: HUB_ORIGIN }),
      entry({ id: 'second', status: 'Live', live: `${HUB_ORIGIN}/elsewhere` }),
    ];
    expect(hubEntries(HUB_ORIGIN, twice)).toHaveLength(2);
    expect(hubEntry(HUB_ORIGIN, twice)).toBeUndefined();

    // And the same list with the ambiguity removed resolves, so the case above is about the
    // duplication and not about the fixture.
    expect(hubEntry(HUB_ORIGIN, twice.slice(0, 1))?.id).toBe('first');
  });

  it('finds exactly one entry serving the declared origin in the committed Registry', () => {
    // The premise of the mark on the page. Nothing in `contracts/registry.schema.json` makes `live`
    // unique, so this is the check that the shipped file is in the state the mark needs.
    expect(hubEntries().map((application) => application.id)).toEqual(['cuatro-portfolio']);
  });

  it('agrees with the set the Directory marks, over the committed Registry', () => {
    expect(hubEntries().map((application) => application.id)).toEqual(
      applications.filter((application) => isCurrentOrigin(application)).map((application) => application.id)
    );
  });
});

describe('the band and the footer name only things the estate actually runs (Story 2-11)', () => {
  /** Every `tech` value the Registry declares, across every entry. */
  const TECH = applications.flatMap((application) => application.tech);

  /**
   * The one framework a Registry entry spells longer than the band does, and the value it hides in.
   *
   * **A named pair rather than a loosened rule.** Plain containment would resolve a framework
   * against any stack value that merely spells its name inside a different product, so `React`
   * would resolve against an entry declaring `Preact` and the band could name a framework nothing
   * in the estate is built with. Equality everywhere plus this one pair is the narrow form: the
   * exception is visible, and the case below proves it is still earned.
   */
  const CONTAINED = [{ framework: 'Svelte', within: 'SvelteKit' }] as const;

  /** Whether `name` is one of `corpus`, or reaches it through its one declared container. */
  const resolves = (name: string, corpus: readonly string[]): boolean =>
    corpus.includes(name) ||
    CONTAINED.some((pair) => pair.framework === name && corpus.includes(pair.within));

  /** The strict form, for the languages, which declare themselves verbatim and take no exception. */
  const isSomeTech = (name: string, corpus: readonly string[] = TECH): boolean => corpus.includes(name);

  it('reads a Registry with a stack to compare against, so every case below measures something', () => {
    expect(TECH.length, 'no committed entry declares any tech, so both scans below are vacuous').toBeGreaterThan(0);
  });

  it('states the two counts the plan states, so neither list can quietly grow or shrink', () => {
    // `DESIGN.md:208` is the claim these lists exist to make. A seventh framework or a sixth
    // language is a change to what the estate is, not a line to add: it moves the footer figure and
    // the band's rhythm at once, and it fails here first.
    expect(ESTATE_FRAMEWORKS.length, 'the framework band no longer draws the declared six').toBe(6);
    expect(ESTATE_LANGUAGES.length, 'the footer line no longer counts the declared five').toBe(5);
  });

  it('holds no name twice in either list, which no resolution check could catch', () => {
    // **A duplicate resolves exactly as well as the original**, so every case below would pass over
    // one. It would draw the same name twice in the band and, in the language list, add one to a
    // figure the footer states: the estate credited with a language it does not have, from a line
    // nobody would look at twice.
    expect(new Set(ESTATE_FRAMEWORKS).size, 'the framework band names something twice').toBe(
      ESTATE_FRAMEWORKS.length
    );
    expect(new Set(ESTATE_LANGUAGES).size, 'the footer counts a language twice').toBe(ESTATE_LANGUAGES.length);
    // The uniqueness check, on a planted control, so an equal pair of sizes is a measurement.
    expect(new Set([...ESTATE_LANGUAGES, ESTATE_LANGUAGES[0]]).size).toBe(ESTATE_LANGUAGES.length);
  });

  it('resolves every framework the band draws to some entry in the Registry', () => {
    const invented = ESTATE_FRAMEWORKS.filter((framework) => !resolves(framework, TECH));
    expect(
      invented,
      `the band names a framework no application in the Registry is built with, which is an invented ` +
        `fact on the one ornament in the system:\n${invented.join('\n')}`
    ).toEqual([]);
  });

  it('resolves every language the footer counts to some entry in the Registry', () => {
    const invented = ESTATE_LANGUAGES.filter((language) => !isSomeTech(language));
    expect(
      invented,
      `the footer counts a language no application in the Registry declares:\n${invented.join('\n')}`
    ).toEqual([]);
  });

  it('resolves by equality, so a stack value that merely spells a name inside it is not a match', () => {
    // The reason the exception is a pair and not a looser rule. Under plain containment an entry
    // declaring `Preact` would resolve `React`, and the band would name a framework the estate does
    // not use while every check above stayed green.
    expect(resolves('React', ['Preact']), 'a longer stack value resolves a framework it merely contains').toBe(false);
    expect(resolves('React', ['React']), 'the resolver does not fire on an exact tech value').toBe(true);
  });

  it('resolves the one named exception, and only through the value it names', () => {
    expect(resolves('Svelte', ['SvelteKit']), 'the declared exception no longer resolves').toBe(true);
    expect(resolves('Vue', ['VueKit']), 'the exception applies to a framework it was not declared for').toBe(false);
  });

  it('and that exception is still earned by the Registry rather than left over', () => {
    // Stated rather than assumed. If the entry that spells it longer ever declared the framework
    // verbatim, the pair would be dead weight and a later reader should delete it; if the framework
    // stopped being reachable through it, the pair would be hiding a name that resolves to nothing.
    for (const pair of CONTAINED) {
      expect(
        isSomeTech(pair.framework),
        `${pair.framework} is now a verbatim tech value, so its containment exception is dead weight`
      ).toBe(false);
      expect(
        isSomeTech(pair.within),
        `no entry declares ${pair.within}, so the exception for ${pair.framework} resolves nothing`
      ).toBe(true);
    }
  });

  it('and both scans fire, so an empty result is a measurement rather than a broken matcher', () => {
    // The other direction. A predicate that had stopped matching would report every declared name
    // as resolving and every list as clean, which looks exactly like a correct one.
    expect(resolves('Fortran', TECH), 'the framework scan resolves a name no entry carries').toBe(false);
    expect(isSomeTech('Fortran'), 'the language scan resolves a name no entry carries').toBe(false);
    expect(resolves(TECH[0], TECH), 'the framework scan does not fire on a real tech value').toBe(true);
    expect(isSomeTech(TECH[0]), 'the language scan does not fire on a real tech value').toBe(true);
  });

  it('does not claim the band restates what the Directory renders, because it does not', () => {
    // **The claim an earlier pass made in `Premise.tsx` and had to withdraw.** The band was
    // described as a decorative restatement of names already visible on the rows below, which would
    // have been a second argument for hiding it. Measured here instead of asserted in prose: some
    // of the band resolves only against entries the FR-35 filter holds back, so the band is not a
    // restatement and the `aria-hidden` decision rests on FR-4 alone.
    const rendered = renderedApplications.flatMap((application) => application.tech);
    const notOnThePage = ESTATE_FRAMEWORKS.filter((framework) => !resolves(framework, rendered));
    expect(
      notOnThePage.length,
      'every framework the band names is now on a rendered row, so the band really is a restatement ' +
        'today. That is a fact about this Registry and not about the design: the comment in ' +
        'Premise.tsx must not start claiming it, because the next status flip takes it away'
    ).toBeGreaterThan(0);
    // And each of those still resolves against the estate as a whole, which is the rule that matters.
    for (const framework of notOnThePage) {
      expect(resolves(framework, TECH), `${framework} resolves against no entry at all`).toBe(true);
    }
  });
});

describe('a count on the page is a length, never a word somebody typed (Story 2-11)', () => {
  /**
   * The footer's first figure, composed exactly as `SiteFooter` composes it, noun included.
   *
   * **The noun is part of the composition and not decoration on it.** Both halves are decided by a
   * length nobody types, so a figure tested without its noun leaves `One applications` reachable
   * with every case green, which is what it was before this took the noun in.
   */
  const applicationFigure = (entries: readonly RegistryEntry[]): string => {
    const count = selectRendered(entries).length;
    return `${capitalise(spellOut(count))} ${pluralise(count, 'application')}`;
  };

  /** The premise's opening, composed exactly as `Premise` composes it. */
  const projectFigure = (entries: readonly RegistryEntry[]): string => {
    const count = entries.length;
    return `${capitalise(spellOut(count))} ${pluralise(count, 'personal project')}`;
  };

  /** Just the words, for the cases that are about the number rather than about the noun. */
  const applicationWord = (entries: readonly RegistryEntry[]): string => applicationFigure(entries).split(' ')[0];
  const projectWord = (entries: readonly RegistryEntry[]): string => projectFigure(entries).split(' ')[0];

  /** `howMany` rendered entries and nothing else, so a word can be pinned without pinning the file. */
  const running = (howMany: number): RegistryEntry[] =>
    Array.from({ length: howMany }, (_, at) =>
      entry({ id: `running-${at}`, status: 'Live', live: `https://running-${at}.cuatro.dev` })
    );

  it('spells the footer figure from the rendered length, and a seventh entry moves the word', () => {
    // The story's own acceptance criterion, over a fixture rather than over the committed file: the
    // day a seventh application ships, the line follows it with no edit anywhere.
    expect(applicationWord(running(6))).toBe('Six');
    expect(applicationWord(running(7))).toBe('Seven');
  });

  it('reverts the word when the fixture reverts', () => {
    const six = running(6);
    const seventh = entry({ id: 'seventh', status: 'Live', live: 'https://seventh.cuatro.dev' });
    expect(applicationWord([...six, seventh])).toBe('Seven');
    expect(applicationWord(six)).toBe('Six');
  });

  it('moves on a status flip alone, with no second edit', () => {
    // The rule is `selectRendered` and nothing else, so an entry that becomes `Live` changes the
    // first word of the footer line without anybody touching the copy.
    const six = running(6);
    const pending = entry({ id: 'pending' });
    expect(applicationWord([...six, pending])).toBe('Six');
    expect(applicationWord([...six, { ...pending, status: 'Live', live: 'https://pending.cuatro.dev' }])).toBe('Seven');
  });

  it('spells the premise opening from the whole Registry, at fourteen entries and at fifteen', () => {
    expect(projectWord(running(14))).toBe('Fourteen');
    expect(projectWord(running(15))).toBe('Fifteen');
  });

  it('reads two different lengths for the two lines, which are two different rules', () => {
    // The premise counts everything the Registry holds and the footer counts what a Visitor is
    // shown. A single count wired into both would agree with itself and be wrong on one of them.
    const mixed = [...running(2), entry({ id: 'held' })];
    expect(projectWord(mixed)).toBe('Three');
    expect(applicationWord(mixed)).toBe('Two');
  });

  it('states the committed counts as words, with no digit reaching either line', () => {
    for (const word of [projectWord(applications), applicationWord(applications), spellOut(ESTATE_LANGUAGES.length)]) {
      expect(word, `${word} reaches a line of copy as digits`).not.toMatch(/\d/);
    }
  });

  it('agrees with its own noun at a count of one, on both lines', () => {
    // **The state the derivation made reachable and nobody could see.** A Registry rendering one
    // entry produced `One applications` and `One personal projects became one suite`, because the
    // count and the noun are decided by the same length and nothing in the copy draws attention to
    // either. Exercised through the composition rather than through `pluralise` alone: a helper that
    // is correct and unwired passes every case in `lib/__tests__/words.test.ts`.
    const alone = [entry({ id: 'only', status: 'Live', live: 'https://only.cuatro.dev' })];
    expect(applicationFigure(alone)).toBe('One application');
    expect(projectFigure(alone)).toBe('One personal project');
  });

  it('goes back to the plural on the entry after it, so the singular is a rule and not a constant', () => {
    expect(applicationFigure(running(2))).toBe('Two applications');
    expect(projectFigure(running(2))).toBe('Two personal projects');
  });

  it('keeps the plural at zero, which is where a threshold instead of an equality would go wrong', () => {
    // Not reachable from a healthy Registry, and it is the arm an off-by-one in the rule lands on.
    expect(applicationFigure([entry({ id: 'held' })])).toBe('Zero applications');
    expect(projectFigure([])).toBe('Zero personal projects');
  });

  it('counts the two lines separately at one, because they are still two rules', () => {
    // One rendered entry beside one held back: the premise counts both and the footer counts one,
    // so the same page carries a plural and a singular at the same time. A single count wired into
    // both would read the same on each and be wrong on one.
    const mixed = [...running(1), entry({ id: 'held' })];
    expect(projectFigure(mixed)).toBe('Two personal projects');
    expect(applicationFigure(mixed)).toBe('One application');
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
   * `ProjectsHero` took its count as a prop precisely so a client component never imported this
   * module: doing so would ship all fourteen entries to the browser to render one number, against
   * the non-3D budget Story 2.2 measures. Nothing enforced that, so the invariant lived on the
   * memory of whoever read the comment. This is the enforcement, and it outlives its example:
   * Story 2-14 deleted that component on 2026-09-07 with the `/projects` route, and the rule binds
   * every client component under `components/` either way.
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
