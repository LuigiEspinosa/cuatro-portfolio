import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen } from '@testing-library/react';
import { Premise } from '../Premise';
import {
  ESTATE_FRAMEWORKS,
  ESTATE_LANGUAGES,
  HUB_ORIGIN,
  applications,
  hubEntry,
  renderedApplications,
} from '@/lib/registry';
import { capitalise, pluralise, spellOut } from '@/lib/words';

/**
 * The premise block against the published Registry (Story 2-11, FR-4).
 *
 * **Nothing is mocked.** The block is a server component with no hooks and no GSAP, so it renders in
 * jsdom as it renders in production, and `@/lib/registry` is deliberately left alone: a mock would
 * make the copy render from a fixture and prove nothing about the wiring that ships.
 *
 * **jsdom applies no stylesheets**, so the band's alternation, its width axis, the mark's tracking
 * and `tabular-nums` all belong to `tests/e2e/premise.pw.ts`. What this file can see is the markup:
 * which strings are drawn, where they come from, how many sentences the premise is, and that the
 * band is ornament rather than something a reader is asked to use.
 *
 * The last block reads the six files this story adds as text, because the story's strongest claim is
 * about what is **not** written in them. It covers all three components at once because it is one
 * rule, not three.
 */

// `fileURLToPath(import.meta.url)` rather than `__dirname`, which is the idiom
// `lib/__tests__/registry.test.ts:36-37` sets: Vitest transforms this file as an ES module and
// `__dirname` survives only through a shim.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

/**
 * The opening of the premise, composed the way the block composes it: the count and its noun.
 *
 * The noun is part of it because both halves follow the same length, so a Registry of one produced
 * `One personal projects` with nothing in the copy drawing attention to it. The singular arm is
 * proved over fixtures in `lib/__tests__/registry.test.ts`, the committed Registry not reaching it.
 */
const opening = (): string =>
  `${capitalise(spellOut(applications.length))} ${pluralise(applications.length, 'personal project')}`;

const lede = (container: HTMLElement): string => container.querySelector('.premise__lede')?.textContent ?? '';

/**
 * `name` as a whole word, so `Vue` does not match inside a longer identifier.
 *
 * **Case-sensitive on purpose.** These are proper nouns, and one of them is two letters long and is
 * also an ordinary English verb. A case-insensitive scan would report a comment saying something can
 * "go stale" as a language name typed into a component.
 */
const wholeWord = (name: string): RegExp =>
  new RegExp(`(?<![\\w-])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`);

describe('the premise carries the claim the Directory is evidence for', () => {
  it('opens with the Registry length spelled, and states no other number', () => {
    // `EXPERIENCE.md:299-300` bans a number that was not supplied. This one is supplied by the file
    // the page publishes, so it is the length rather than a word: the day an application is added
    // the sentence follows it with no edit to the copy.
    const { container } = render(<Premise />);
    const text = lede(container);
    expect(text, 'the premise renders nothing at all').not.toBe('');
    expect(text.startsWith(`${opening()} became`), `the premise opens "${text.slice(0, 48)}"`).toBe(true);
    expect(text, 'the premise states a digit, which is a number nobody derived').not.toMatch(/\d/);
  });

  it('agrees between the count and the noun beside it', () => {
    // Read off the rendered line rather than composed, so a plural rule wired into the test and not
    // into the block fails here. `One personal projects became one suite` is the shape this refuses.
    const { container } = render(<Premise />);
    const noun = lede(container).split(' ')[2];
    expect(noun.endsWith('s'), `"${noun}" does not agree with a count of ${applications.length}`).toBe(
      applications.length !== 1
    );
  });

  it('is at most three sentences', () => {
    // FR-4's cap. Counted on terminators rather than on line breaks: the copy is one string and a
    // fourth sentence would arrive inside it.
    const { container } = render(<Premise />);
    const sentences = (lede(container).match(/[.!?](\s|$)/g) ?? []).length;
    expect(sentences, 'the premise runs to more than three sentences').toBeLessThanOrEqual(3);
    expect(sentences, 'the premise terminates no sentence at all, so the count above measures nothing').toBeGreaterThan(
      0
    );
  });

  it('names no framework, so it carries for a reader who cannot name one', () => {
    // The band is not a legend for the premise and the premise is not a caption for the band: FR-4
    // requires the claim to stand with the band deleted. A framework name inside the prose would
    // make the two depend on each other.
    const { container } = render(<Premise />);
    const named = ESTATE_FRAMEWORKS.filter((framework) => wholeWord(framework).test(lede(container)));
    expect(named, `the premise names ${named.join(', ')}, which FR-4 does not allow`).toEqual([]);
  });

  it('and that scan fires, so an empty result means something', () => {
    expect(ESTATE_FRAMEWORKS.some((framework) => wholeWord(framework).test(`built with ${ESTATE_FRAMEWORKS[0]}`))).toBe(
      true
    );
    expect(ESTATE_FRAMEWORKS.some((framework) => wholeWord(framework).test('built with nothing at all'))).toBe(false);
  });

  it('renders no heading, the page already carrying one', () => {
    // The reference mockup puts a display line here and `HomeLayout` already renders the page's
    // heading. A second is a heading-structure defect, not a design choice.
    render(<Premise />);
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('reads the mark, the premise and the band in that DOM order', () => {
    const { container } = render(<Premise />);
    const section = container.querySelector('.premise');
    expect([...(section?.children ?? [])].map((child) => child.className)).toEqual([
      'plate-mark',
      'premise__lede',
      'premise__band',
    ]);
  });
});

describe("the plate mark names the Hub from the Hub's own entry", () => {
  it('draws the identity and the domain the Registry carries, neither of them a literal', () => {
    const { container } = render(<Premise />);
    const hub = hubEntry();
    expect(hub, `no committed entry serves ${HUB_ORIGIN}, so this case is vacuous`).toBeDefined();

    expect(container.querySelector('.plate-mark__label')?.textContent).toBe(hub?.name);
    expect(container.querySelector('.plate-mark__domain')?.textContent).toBe(
      new URL(hub?.live ?? HUB_ORIGIN).hostname
    );
  });

  it('names the entry the Directory below it marks You are here', () => {
    // One fact, read once. The mark on this block and the mark on the row below state that the
    // reader is already on this application, and a second lookup could disagree with the first.
    const { container } = render(<Premise />);
    const hub = renderedApplications.find((application) => application.live === hubEntry()?.live);
    expect(container.querySelector('.plate-mark__label')?.textContent).toBe(hub?.name);
  });

  it('states no count in the mark', () => {
    const { container } = render(<Premise />);
    expect(container.querySelector('.plate-mark')?.textContent).not.toMatch(/\d/);
  });
});

describe('the framework band is ornament, and it is made of real facts', () => {
  it('draws every declared framework, in the declared order and once each', () => {
    const { container } = render(<Premise />);
    const names = [...container.querySelectorAll('.premise__framework')].map((span) => span.textContent);
    expect(names, 'the band draws something other than the declared list').toEqual([...ESTATE_FRAMEWORKS]);
  });

  it('is hidden from assistive technology, every name in it being on a row below', () => {
    // `DESIGN.md:702` makes `--token-accent-muted` ornament only, never text that means anything, so
    // half the band is sub-contrast by design. Everything it names is in some entry's `tech` in the
    // Directory, visible and in the accessibility tree, and FR-4 requires the premise to carry
    // without it. Hiding a decorative restatement is what keeps the contrast audit honest.
    const { container } = render(<Premise />);
    expect(container.querySelector('.premise__band')).toHaveAttribute('aria-hidden', 'true');
  });

  it('carries no state, no destination and no place in the tab order', () => {
    // `DESIGN.md:684`: decorative rhythm, not a legend. A focusable band is a control, and a control
    // here would move the per-surface count `tests/e2e/hit-target-floor.pw.ts` pins.
    const { container } = render(<Premise />);
    const band = container.querySelector('.premise__band');
    expect(band?.querySelectorAll('a, button, input, select, textarea, summary')).toHaveLength(0);
    expect(band?.querySelectorAll('[tabindex], [role], [href], [title], [data-state], [aria-current]')).toHaveLength(0);
  });

  it('adds nothing interactive to the page at all', () => {
    // The whole block, not just the band. `tests/e2e/hit-target-floor.pw.ts` reads an exact count of
    // interactive elements for `/`, and a control arriving here would move it with no other symptom.
    const { container } = render(<Premise />);
    expect(
      container.querySelectorAll('a, button, input, select, textarea, summary, [tabindex], [contenteditable="true"]')
    ).toHaveLength(0);
  });
});

describe('the three surfaces this story adds state no fact of their own', () => {
  /**
   * The story's acceptance criterion, encoded rather than read by eye.
   *
   * Every count, name and hostname on these surfaces resolves from the Registry, from `HUB_ORIGIN`
   * or from a token, so none of the six files is allowed to write one down. All three components are
   * checked here because it is one rule and splitting it across three files would give it three
   * places to be forgotten.
   */
  const SOURCES = [
    'components/organisms/Premise/Premise.tsx',
    'components/organisms/Premise/Premise.scss',
    'components/organisms/SiteFooter/SiteFooter.tsx',
    'components/organisms/SiteFooter/SiteFooter.scss',
    'components/molecules/PlateMark/PlateMark.tsx',
    'components/molecules/PlateMark/PlateMark.scss',
  ] as const;

  /** A count word is a proper noun nowhere, so it is looked for in either case. */
  const anyCase = (word: string): RegExp => new RegExp(`(?<![\\w-])${word}(?![\\w-])`, 'i');

  /**
   * Comments removed, so a discussion of a rule is never read as the rule.
   *
   * The same expression as `app/__tests__/anchor-contract.test.ts:305-306`, which Story 2-10 settled
   * for exactly this hazard. It matters here because these docblocks are full of small numbers
   * written as words: `Premise.tsx` says the premise is two sentences and that FR-4 caps it at
   * three, and `PlateMark.tsx` says Story 2-31 adds the other two variants. The day a real count
   * lands on two or three, an unstripped scan would fail naming a comment, and the finding it
   * reported would be about prose rather than about copy.
   *
   * The `//` strip is guarded against a preceding `:` and `(` so a `url(//host)` or an `https://`
   * does not take the rest of its line with it.
   */
  const withoutComments = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:(])\/\/.*$/gm, '$1');

  /** One of the six, with its comments gone. Missing is a failure by name, not a raw ENOENT. */
  const read = (path: string): string => {
    const absolute = join(REPO_ROOT, path);
    if (!existsSync(absolute)) {
      throw new Error(
        `${path} does not exist. This list is the story's surfaces by path, so a rename fails here ` +
          `naming the file rather than as an unattributed read error.`
      );
    }
    return withoutComments(readFileSync(absolute, 'utf8'));
  };

  it('reads all six files, so the scans below are not passing over an empty selection', () => {
    for (const path of SOURCES) {
      expect(read(path).trim().length, `${path} is empty once its comments are stripped`).toBeGreaterThan(0);
    }
  });

  it('strips comments before scanning, which is what keeps a docblock from failing a copy check', () => {
    // The stripper, on planted controls, before its results are trusted. Both comment shapes, and
    // the guard that keeps a protocol slash out of the line strip.
    expect(withoutComments('/** six of them */\nconst a = 1;').trim()).toBe('const a = 1;');
    expect(withoutComments('const a = 1; // six of them').trim()).toBe('const a = 1;');
    expect(withoutComments("const a = 'https://x.test';").trim()).toBe("const a = 'https://x.test';");
    // And it leaves real code alone, so the scans below still have something to find.
    expect(withoutComments("const a = 'six';")).toContain("'six'");
  });

  it('writes down no framework name and no language name', () => {
    const written: string[] = [];
    for (const path of SOURCES) {
      const source = read(path);
      for (const name of [...ESTATE_FRAMEWORKS, ...ESTATE_LANGUAGES]) {
        if (wholeWord(name).test(source)) written.push(`${path} writes ${name}`);
      }
    }
    expect(
      written,
      `a component writes an estate name as a literal. Every one of them resolves from the Registry, ` +
        `so a name written here is a second place for the estate to be wrong:\n${written.join('\n')}`
    ).toEqual([]);
  });

  it('writes down no count that the Registry supplies', () => {
    const supplied = [
      spellOut(applications.length),
      spellOut(renderedApplications.length),
      spellOut(ESTATE_LANGUAGES.length),
    ];
    const written: string[] = [];
    for (const path of SOURCES) {
      const source = read(path);
      for (const word of supplied) {
        if (anyCase(word).test(source)) written.push(`${path} writes ${word}`);
      }
    }
    expect(
      written,
      `a component writes a count the Registry supplies. EXPERIENCE.md:295 says the footer line is ` +
        `updated when the count changes or deleted, and a derived count needs neither:\n${written.join('\n')}`
    ).toEqual([]);
  });

  it('writes down no hostname and no tracking literal', () => {
    const hostname = new URL(HUB_ORIGIN).hostname;
    const written: string[] = [];
    for (const path of SOURCES) {
      const source = read(path);
      // The origin is declared once for the whole repository and the mark reads it through the
      // Registry. The tracking figure is `--tr-label`'s and lives in the contract: `epics.md` and
      // the reference mockup disagree with `DESIGN.md` about it, and DESIGN.md wins any value, so
      // the token is named and no figure is written at any of the three.
      if (source.includes(hostname)) written.push(`${path} writes the Hub hostname`);
      if (/\d+(\.\d+)?em/.test(source)) written.push(`${path} writes a tracking or sizing literal in em`);
    }
    expect(written, `${written.join('\n')}`).toEqual([]);
  });

  it('and all three scans fire on planted text, so their empty results are measurements', () => {
    const planted = `.probe { letter-spacing: 0.16em; } // ${ESTATE_LANGUAGES[0]} at ${new URL(HUB_ORIGIN).hostname}, ${capitalise(spellOut(renderedApplications.length))} of them`;
    expect(ESTATE_LANGUAGES.some((name) => wholeWord(name).test(planted)), 'the name scan is dead').toBe(true);
    expect(anyCase(spellOut(renderedApplications.length)).test(planted), 'the count scan is dead').toBe(true);
    expect(planted.includes(new URL(HUB_ORIGIN).hostname), 'the hostname scan is dead').toBe(true);
    expect(/\d+(\.\d+)?em/.test(planted), 'the em-literal scan is dead').toBe(true);
    // And each of them silent on text carrying none of it.
    const clean = '.probe { letter-spacing: var(--tr-label); }';
    expect(ESTATE_LANGUAGES.some((name) => wholeWord(name).test(clean))).toBe(false);
    expect(anyCase(spellOut(renderedApplications.length)).test(clean)).toBe(false);
    expect(/\d+(\.\d+)?em/.test(clean)).toBe(false);
  });
});
