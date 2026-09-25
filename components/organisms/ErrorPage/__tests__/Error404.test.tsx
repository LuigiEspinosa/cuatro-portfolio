import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { compile } from 'sass';
import Error404 from '../Error404';
import { DESTINATIONS } from '@/components/atoms/Navbar/Navbar';

/**
 * The 404 surface as it renders on the server and as its stylesheet compiles (Stories 2-17 and 2-30).
 *
 * **The exits are the header's list (Story 2-17).** `RESTYLE-SPEC.md:472` fixes an error surface's
 * exits at exactly the ones the application's header already carries, never more and never fewer.
 * `Error404` maps over the same `DESTINATIONS` the header renders, so the first block asserts the
 * consequence rather than a copy of the list: what is compared against is the export, not two
 * literals typed here.
 *
 * **The rebuild (Story 2-30).** The surface is exactly a section Plate mark, the display line as the
 * one `<h1>`, one secondary line and the exits, with the numeral kept as an ornament hidden from
 * assistive technology (O-12 item 3, branch A) and no accessible name carried on any element (O-13).
 * The stylesheet is read as it compiles, which is what ships and carries no comments.
 *
 * **Server output, deliberately.** `renderToStaticMarkup` runs no effect, and since Story 2-30 the
 * component has none to run: what is read is the markup every visitor gets, with or without
 * scripting. `next/link` is mocked the way `Navbar.test.tsx` mocks it, so the anchor is real markup
 * rendered outside the App Router.
 *
 * The browser half (the accessible output read with the numeral removed, the boxes at the floor, the
 * ground as pixels, hover, touch, the ring and the entrance on a running page) is
 * `tests/e2e/error-surface.pw.ts` and `tests/e2e/secondary-surfaces.pw.ts`.
 */

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

/** The component's directory, and the repository root the contract is read from. */
const HERE = resolve(__dirname, '..');
const REPO_ROOT = resolve(HERE, '..', '..', '..');

/** The published token contract, which every role the stylesheet reads has to be declared in. */
const TOKENS = readFileSync(resolve(REPO_ROOT, 'contracts', 'tokens.css'), 'utf8');

/** The component's own source, read for what it imports rather than for what it renders. */
const SOURCE = readFileSync(resolve(HERE, 'Error404.tsx'), 'utf8');

/** One rendered exit: its label and its `href`, in the shape `Navbar.test.tsx` pins the header in. */
type Exit = readonly [label: string, href: string];

/** A markup string as a document, so every read below goes through the browser's own parser. */
const parse = (markup: string): Document => new DOMParser().parseFromString(markup, 'text/html');

/**
 * Every anchor inside `.error-page`, in document order, read off a markup string.
 *
 * A function over the string rather than an inline query, so the planted control below can drive
 * the same predicate with a third link and be seen to report it.
 */
const exitsIn = (markup: string): { exits: Exit[]; marked: number } => {
  const anchors = [...parse(markup).querySelectorAll('.error-page a[href]')];
  return {
    exits: anchors.map((anchor) => [anchor.textContent ?? '', anchor.getAttribute('href') ?? ''] as const),
    marked: anchors.filter((anchor) => anchor.hasAttribute('aria-current')).length,
  };
};

/** Every element carrying an accessible name by attribute, as its tag and classes. */
const namedIn = (document_: Document): string[] =>
  [...document_.querySelectorAll('[aria-label], [aria-labelledby]')].map(
    (node) => `${node.tagName.toLowerCase()}.${[...node.classList].join('.')}`
  );

/**
 * Whether a label cell is plain words: capitals separated by single spaces and nothing else.
 *
 * `EXPERIENCE.md` § Plate mark: the label is read aloud, so a `//` inside it is decoration a screen
 * reader speaks and an underscore joins a code rather than words.
 */
const isWords = (cell: string): boolean => /^[A-Z]+(?: [A-Z]+)*$/.test(cell);

/** What the header renders, as label and `href` pairs, read off the export rather than typed. */
const HEADER: Exit[] = DESTINATIONS.map((destination) => [destination.label, destination.href] as const);

/** The server markup, rendered once for the reads that do not plant anything into it. */
const MARKUP = renderToStaticMarkup(<Error404 />);

describe('the 404 renders the header’s exits and nothing else', () => {
  it('renders exactly two links, pairwise equal to DESTINATIONS, in the header’s order', () => {
    // The premise, before the comparison means anything: the export is the two the design fixes.
    // `Navbar.test.tsx` pins the same pairs on the header side; here it is the shape of the
    // list that is asserted, so an export that shrank to one would fail this line rather than
    // pass the comparison below against itself.
    expect(HEADER, 'DESTINATIONS no longer carries two destinations').toHaveLength(2);

    const { exits, marked } = exitsIn(MARKUP);

    expect(exits, 'the 404 does not render exactly the header’s destinations, in its order').toEqual(HEADER);
    expect(marked, 'an exit on the 404 announces itself as the current page').toBe(0);
    // The layer is a scrim for text over moving imagery and this surface has none (Story 2-28,
    // `epics.md:3252`), so a call site returning here is a regression with every other gate green.
    // DW-102 names this read as one of the two things that catch a returning overlay.
    expect(MARKUP, 'the 404 renders a .scanline-overlay').not.toContain('scanline-overlay');
  });

  it('keeps both exits inside the wrapper the stylesheet lays out, each carrying the control’s class', () => {
    // `Error404.scss` puts the gap and the entrance on `.error-page__exits` and the control's box on
    // `.error-page__exit`. A link that lost either class would still count above and would measure
    // under the floor, or arrive without fading, in the browser.
    const wrapper = parse(MARKUP).querySelectorAll('.error-page__exits');
    expect(wrapper, 'the 404 renders no exits wrapper, or more than one').toHaveLength(1);

    const inside = [...wrapper[0].querySelectorAll('a[href]')];
    expect(inside.length, 'an exit sits outside the wrapper').toBe(HEADER.length);
    for (const anchor of inside) {
      expect(anchor.classList.contains('error-page__exit'), `${anchor.textContent} lost the class`).toBe(true);
    }
  });

  it('and the reader reports a third link and a mark, so the clean readings above are measurements', () => {
    // The control, through the same predicate rather than a second reading. A third exit planted
    // into the markup, carrying `aria-current`, has to show up in both numbers, or an empty result
    // above is a selector that stopped matching rather than a surface with two exits.
    //
    // **The plant is asserted to have landed before anything is read off it.** It splices in before
    // the markup's closing pair (the exits wrapper, then the surface): a splice whose needle no
    // longer matches would return the string unchanged, and the failures below would then blame
    // the reader for not seeing an exit that was never planted.
    const at = MARKUP.lastIndexOf('</div></div>');
    expect(at, 'the plant did not land: the markup no longer ends on the wrapper and the surface').toBe(
      MARKUP.length - '</div></div>'.length
    );
    const markup = `${MARKUP.slice(0, at)}<a href='/planted' class='error-page__exit' aria-current='page'>Planted</a>${MARKUP.slice(at)}`;
    const { exits, marked } = exitsIn(markup);

    expect(exits, 'the reader did not see the planted third exit').toEqual([...HEADER, ['Planted', '/planted']]);
    expect(marked, 'the reader did not see the planted aria-current').toBe(1);
    expect(exits, 'the planted markup still equals the header, so the equality above discriminates nothing').not.toEqual(
      HEADER
    );
  });
});

describe('the surface is a Plate mark, the display line, one line and the exits', () => {
  const document_ = parse(MARKUP);
  const surface = document_.querySelector('.error-page');

  it('renders them in that order, with the numeral as the one ornament between the mark and the heading', () => {
    expect(surface, 'the 404 renders no .error-page').not.toBeNull();
    const children = [...(surface?.children ?? [])].map((child) => `${child.tagName.toLowerCase()}.${[...child.classList].join('.')}`);
    expect(children, 'the surface is not exactly mark, numeral, heading, line and exits').toEqual([
      'div.plate-mark',
      'p.error-page__code',
      'h1.glitch-text',
      'p.error-page__sub',
      'div.error-page__exits',
    ]);
  });

  it('carries one <h1>, the display line, named by its own words', () => {
    // `GlitchText` splits the words into inline spans, and the heading's accessible name is its own
    // text content, so the name is read here the way a screen reader assembles it.
    const headings = document_.querySelectorAll('h1');
    expect(headings, 'the 404 does not carry exactly one <h1>').toHaveLength(1);
    expect(headings[0].textContent, 'the display line does not say the page was not found').toBe('Page not found.');
    expect(document_.querySelectorAll('h2, h3, h4, h5, h6'), 'a second heading level arrived on the surface').toHaveLength(0);
  });

  it('sets one supporting line, the next step the Operator ruled, not a second "not found"', () => {
    const lines = document_.querySelectorAll('.error-page__sub');
    expect(lines, 'the surface carries a number of supporting lines other than one').toHaveLength(1);
    // Operator ruling 2026-09-24 (DW-114): the heading already says the page was not found, so the
    // line says what to do next and the page says one thing once. The words are the ruling's, verbatim.
    expect(lines[0].textContent).toBe('Check the address, or use one of the links below.');
  });

  it('hides the numeral from assistive technology and names nothing on any element (O-13)', () => {
    const numeral = document_.querySelectorAll('.error-page__code');
    expect(numeral, 'the surface carries a number of numerals other than one').toHaveLength(1);
    expect(numeral[0].textContent).toBe('404');
    // Branch A of O-12 item 3: the page says it was not found in its title and its heading (and in
    // its message too until the Operator ruling of 2026-09-24, DW-114), so the numeral is ornament and
    // a hidden element needs no name.
    expect(numeral[0].getAttribute('aria-hidden'), 'the numeral is exposed to assistive technology').toBe('true');
    expect(namedIn(document_), 'an element on the 404 carries a name by attribute').toEqual([]);

    // The control: the 2023 numeral, a paragraph named by `aria-label`, is what the same read has to
    // report, or the empty list above is a selector that never matches.
    const shipped = parse("<div class='error-page'><p class='error-page__code' aria-label='Error 404'>404</p></div>");
    expect(namedIn(shipped), 'the read does not see a name on a paragraph').toEqual(['p.error-page__code']);
  });

  it('labels the surface in plain words, on the section variant with no subordinate line', () => {
    const mark = document_.querySelector('.plate-mark');
    expect(mark?.className, 'the mark is not the section variant').toBe('plate-mark');
    const cells = [...(mark?.children ?? [])].map((cell) => cell.textContent ?? '');
    expect(cells, 'the mark does not read ERROR alone').toEqual(['ERROR']);
    for (const cell of cells) expect(isWords(cell), `"${cell}" is not plain words`).toBe(true);
    expect(document_.querySelectorAll('.plate-mark__sub'), 'a subordinate line is back').toHaveLength(0);

    // The predicate, on the shipped label and on its decoration alone.
    expect(isWords('// ERR_NOT_FOUND'), 'the shipped label reads as plain words').toBe(false);
    expect(isWords('ERR_NOT_FOUND'), 'an underscore-joined code reads as plain words').toBe(false);
    expect(isWords('NOT FOUND')).toBe(true);
  });

  it('runs no script of its own: no GSAP, no hook and no client directive', () => {
    // The three `gsap.from` tweens became one CSS keyframe (the criterion's preferred form), so
    // reduced motion reaches the entrance through the stylesheet and nothing is left to hydrate.
    expect(SOURCE, 'the component imports GSAP again').not.toMatch(/^import[^;]*from\s+['"]gsap['"]/m);
    expect(SOURCE, 'the component imports the GSAP hook again').not.toMatch(/^import[^;]*useGsapContext/m);
    expect(SOURCE, 'the component is a client component again').not.toMatch(/^\s*['"]use client['"]/m);
    // The patterns, on the lines the 2023 file carried.
    expect("'use client';\n\nimport Link from 'next/link';").toMatch(/^\s*['"]use client['"]/m);
    expect("import { gsap } from 'gsap';").toMatch(/^import[^;]*from\s+['"]gsap['"]/m);
    expect("import { useGsapContext } from '@/hooks/useGsapContext';").toMatch(/^import[^;]*useGsapContext/m);
  });
});

describe('the stylesheet names contract roles and nothing else', () => {
  /** Every role `Error404.scss` reads, pinned against the contract before it is read in the source. */
  const ROLES = [
    '--dur-micro',
    '--dur-minor',
    '--ease-entrance',
    '--ease-toggle',
    '--f-display',
    '--f-mono',
    '--lh-body',
    '--lh-display',
    '--lh-label',
    '--measure',
    '--page-pad',
    '--s-2xl',
    '--s-3xl',
    '--s-lg',
    '--s-md',
    '--s-xs',
    '--stroke-boundary',
    '--t-2xs',
    '--t-sm',
    '--t-xl',
    '--tap',
    '--token-accent-hover',
    '--token-accent-muted',
    '--token-border-interactive',
    '--token-text',
    '--token-text-secondary',
    '--tr-body',
    '--tr-display',
    '--tr-label',
    '--w-black',
  ] as const;

  /** The compiled stylesheet, which is what ships and carries no comments. */
  const css = compile(resolve(HERE, 'Error404.scss'), { style: 'compressed' }).css;

  /** Every declaration in a compiled sheet, as `[property, value]`. */
  const declarations = (source: string): [string, string][] =>
    [...source.matchAll(/(?<=[{;])([a-z-]+):([^;}]+)/g)].map((match) => [match[1], match[2].trim()]);

  /** The declarations of the one rule whose whole selector is `selector`, outside any at-rule. */
  const ruleOf = (source: string, selector: string): string => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|})${escaped}\\{([^{}]*)\\}`).exec(source)?.[1] ?? '';
  };

  /** A compiled sheet with every `@media (hover: hover)` block cut out. */
  const ungated = (source: string): string => source.replace(/@media\(hover: hover\)\{(?:[^{}]*\{[^{}]*\})*\}/g, '');

  /** What a colour, background or border value leaves once its roles and rule keywords are gone. */
  const colourLeftovers = (source: string): string[] =>
    declarations(source)
      .filter(([property]) => /^(color|background|border|outline)/.test(property))
      .map(([property, value]) => [
        property,
        value
          .replace(/var\(--[\w-]+\)/g, '')
          .replace(/\b(solid|none|transparent|inherit)\b|\b0\b/g, '')
          .trim(),
      ])
      .filter(([, remainder]) => remainder !== '')
      .map(([property, remainder]) => `${property}: ${remainder}`);

  /** A length written as a number and a unit, the units a page can be laid out in included. */
  const LENGTH = /(?<![\w-])\d*\.?\d+(px|rem|em|ch|[dsl]?vh|[dsl]?vw|vmin|vmax)\b/;

  it('names only roles the contract declares, and every one it pins', () => {
    for (const role of ROLES) {
      expect(TOKENS, `${role} is pinned here but the published contract no longer declares it`).toMatch(
        new RegExp(`^\\s*${role}\\s*:`, 'm')
      );
      expect(css, `${role} is pinned here and the compiled stylesheet no longer reads it`).toContain(`var(${role})`);
    }
    const read = [...new Set([...css.matchAll(/var\((--[\w-]+)\)/g)].map((match) => match[1]))].sort();
    expect(read, 'the stylesheet reads a name this file does not pin, an alias or an undeclared name').toEqual(
      [...ROLES].sort()
    );
  });

  it('writes no colour, no length, no shadow, no gradient, no layer, no ring and no custom property of its own', () => {
    expect(css, 'a hex colour survived the rebuild').not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css, 'a colour function survived the rebuild, the grid and the 15% numeral among them').not.toMatch(
      /\b(rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\(/
    );
    expect(css, 'a gradient, which the grid was').not.toContain('gradient(');
    expect(css, 'a shadow').not.toMatch(/shadow:/);
    expect(css, 'a z-index, which the ledger carried as z-error-content').not.toMatch(/z-index:/);
    expect(css, 'an outline: the ring is the global rule in app/app.scss').not.toMatch(/outline/);
    expect(css, 'a length literal survived the rebuild').not.toMatch(LENGTH);
    expect(css, 'a percentage, which no value on this surface needs').not.toContain('%');
    expect([...css.matchAll(/(?<=[{;])(--[\w-]+):/g)].map((match) => match[1]), 'a declared custom property').toEqual([]);
    expect(colourLeftovers(css), 'a colour, background or border value carries something other than a role').toEqual([]);
  });

  it('and those guards fire on the literals the 2023 sheet carried', () => {
    // The shapes the old file shipped, planted into the compiled sheet, so each guard above is seen
    // refusing the thing it exists to refuse rather than passing over a sheet that has none.
    const planted = css.replace(
      '.error-page{',
      '.error-page{background-color:#0a000f;background-image:linear-gradient(rgba(140,90,210,.06) 1px,transparent 1px);z-index:2;min-height:100dvh;letter-spacing:-.02em;'
    );
    expect(planted, 'the planted rule did not land').not.toBe(css);
    expect(planted).toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(planted).toMatch(/\b(rgba?)\(/);
    expect(planted).toContain('gradient(');
    expect(planted).toMatch(/z-index:/);
    expect(planted, 'the length guard lets a dynamic viewport height through').toMatch(LENGTH);
    expect('.a{letter-spacing:-.02em}', 'the length guard lets a negative em tracking through').toMatch(LENGTH);
    expect(colourLeftovers(planted).join('\n'), 'the colour strip lets a literal ground through').toMatch(/#0a000f/);
  });

  it('gates every hover rule on a hover-capable pointer, and has one to gate', () => {
    // A tap paints `:hover` on a coarse pointer and leaves it painted until the next tap lands
    // elsewhere (review A-5), so an ungated rule is a border that sticks on the primary device.
    expect(ungated(css), 'a :hover rule sits outside @media (hover: hover)').not.toContain(':hover');
    expect(css, 'no hover rule is gated at all, so the read above passed vacuously').toContain('@media(hover: hover)');
    expect(ungated('.a:hover{color:red}@media(hover: hover){.b:hover{color:red}}'), 'the gate strip keeps an ungated rule').toContain(
      '.a:hover'
    );
  });

  it('recolours the exit’s border on hover and nothing else, and carries no pressed state', () => {
    // `RESTYLE-SPEC.md` § 1, Hover: the border becomes the hover role, and nothing else changes.
    expect(css, 'the hover block recolours something other than the border').toContain(
      '@media(hover: hover){.error-page__exit:hover{border-color:var(--token-accent-hover)}}'
    );
    expect(css, 'a pressed state, which the system does not have (RESTYLE-SPEC § 1)').not.toMatch(/:active\b/);
    expect(css, 'a focus rule of its own, which the global ring replaces').not.toMatch(/:focus/);
  });

  it('transitions border colour alone, never all', () => {
    const transitions = declarations(css).filter(([property]) => property.startsWith('transition'));
    expect(transitions.map(([, value]) => value)).toEqual(['border-color var(--dur-micro) var(--ease-toggle)']);
  });

  it('builds each exit as a control: a transparent square box at the floor, bordered in the interactive role', () => {
    const exit = ruleOf(css, '.error-page__exit');
    expect(exit, 'no rule sets .error-page__exit on its own').not.toBe('');
    for (const declaration of [
      'display:inline-flex',
      'align-items:center',
      'min-block-size:var(--tap)',
      'min-inline-size:var(--tap)',
      'padding-block:var(--s-xs)',
      'padding-inline:var(--s-md)',
      'border:var(--stroke-boundary) solid var(--token-border-interactive)',
      'font-family:var(--f-mono)',
      'font-size:var(--t-2xs)',
      'line-height:var(--lh-label)',
      'letter-spacing:var(--tr-label)',
      'text-transform:uppercase',
      'text-decoration:none',
      'color:var(--token-text)',
    ]) {
      expect(exit, `the exit does not declare ${declaration}`).toContain(declaration);
    }
    // No ground, and no radius of its own: the initial `0` is square, and the global ring rule's
    // radius is the one the ring takes (`RESTYLE-SPEC.md` § 4).
    expect(exit, 'the exit paints a ground').not.toMatch(/background/);
    expect(exit, 'the exit sets a radius').not.toMatch(/border-radius/);
    const exits = ruleOf(css, '.error-page__exits');
    for (const declaration of ['display:flex', 'flex-wrap:wrap', 'gap:var(--s-lg)']) {
      expect(exits, `the exits wrapper does not declare ${declaration}`).toContain(declaration);
    }
  });

  it('sets the numeral on the scale in the display face and the ornament role, and the line in the secondary role', () => {
    const numeral = ruleOf(css, '.error-page__code');
    for (const declaration of [
      'font-family:var(--f-display)',
      'font-size:var(--t-xl)',
      'font-weight:var(--w-black)',
      'line-height:var(--lh-display)',
      'letter-spacing:var(--tr-display)',
      'color:var(--token-accent-muted)',
    ]) {
      expect(numeral, `the numeral does not declare ${declaration}`).toContain(declaration);
    }
    const line = ruleOf(css, '.error-page__sub');
    for (const declaration of [
      'max-inline-size:var(--measure)',
      'font-size:var(--t-sm)',
      'line-height:var(--lh-body)',
      'letter-spacing:var(--tr-body)',
      'color:var(--token-text-secondary)',
    ]) {
      expect(line, `the supporting line does not declare ${declaration}`).toContain(declaration);
    }
  });

  it('lays the surface out as content-high and start-aligned, never a full-viewport centred hero', () => {
    // `EXPERIENCE.md:1021` and `epics.md:3056`: hero height follows content and display type is
    // left-biased. The 2023 rule was `min-height: 100dvh` centred on both axes.
    const surface = ruleOf(css, '.error-page');
    for (const declaration of ['display:grid', 'gap:var(--s-md)', 'padding-block:var(--s-2xl) var(--s-3xl)', 'padding-inline:var(--page-pad)']) {
      expect(surface, `the surface does not declare ${declaration}`).toContain(declaration);
    }
    expect(surface, 'the surface holds a height of its own').not.toMatch(/(?:^|;)(?:min-|max-)?(?:height|block-size):/);
    expect(surface, 'the surface centres its content').not.toMatch(/(?:align|justify|place)-(?:items|content):center/);
    expect(css, 'something on the surface is centred as text').not.toContain('text-align:center');
    expect(surface, 'the surface paints a ground of its own: the body already paints the one role it may').not.toMatch(/background/);
    // The predicate, on the 2023 rule.
    expect('display:flex;min-height:100dvh;align-items:center').toMatch(/(?:^|;)(?:min-|max-)?(?:height|block-size):/);
  });

  it('animates opacity once, from the base state, in the shipped order, and not at all under reduced motion', () => {
    // One keyframe whose only declaration is the `from`, so the base state is the final state and a
    // document with no script is already at it; the delays keep the order the three tweens had
    // (numeral, message, exits), and the heading's own entrance is `GlitchText`'s.
    expect([...css.matchAll(/@keyframes/g)], 'the stylesheet declares a number of keyframes other than one').toHaveLength(1);
    expect(css, 'the entrance keyframe was renamed or gained a property').toContain('@keyframes error-page-enter{from{opacity:0}}');
    expect(css, 'an animation repeats').not.toMatch(/infinite/);
    expect(
      [...css.matchAll(/opacity:([^;}]+)/g)].map((match) => match[1].trim()),
      'the stylesheet declares an opacity other than the keyframe’s from, so opacity expresses state'
    ).toEqual(['0']);
    const animated = ['.error-page__code', '.error-page__sub', '.error-page__exits'].map((selector) => [
      selector,
      /animation:([^;}]+)/.exec(ruleOf(css, selector))?.[1] ?? '',
    ]);
    expect(animated, 'the entrance is not one keyframe at the minor duration on the entrance curve, 100, 300 and 500ms').toEqual([
      ['.error-page__code', 'error-page-enter var(--dur-minor) var(--ease-entrance) 100ms both'],
      ['.error-page__sub', 'error-page-enter var(--dur-minor) var(--ease-entrance) 300ms both'],
      ['.error-page__exits', 'error-page-enter var(--dur-minor) var(--ease-entrance) 500ms both'],
    ]);
    expect([...css.matchAll(/animation:error-page-enter/g)], 'a rule outside the three animates').toHaveLength(3);
    expect(css, 'reduced motion does not take the entrance off all three at once').toContain(
      '@media(prefers-reduced-motion: reduce){.error-page__code,.error-page__sub,.error-page__exits{animation:none}}'
    );
  });
});
