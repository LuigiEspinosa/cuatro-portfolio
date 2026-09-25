import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { compile } from 'sass';
import { render, screen } from '@testing-library/react';
import { PlateMark, type PlateMarkProps } from '../PlateMark';

/**
 * The Plate mark, the Hub's one label component (Stories 2-11 and 2-31).
 *
 * **Nothing is mocked and nothing is read off the Registry here.** The mark takes strings and draws
 * them; which strings each surface hands it is that surface's claim and is proved there. Keeping the
 * two apart is what lets this file exercise the arms no committed call site produces, a mark with no
 * trailing cell, a blank subordinate line, a side-ruled mark at the leading edge, without inventing a
 * Registry state or a page to reach them.
 *
 * **jsdom applies no stylesheets**, so the mono treatment, the tracking, the rules and `tabular-nums`
 * as rendered belong to `tests/e2e/plate-mark-and-work-item.pw.ts` and `tests/e2e/premise.pw.ts`.
 * What this file sees is the markup, and the stylesheet as it compiles, which is what ships.
 */

const HERE = resolve(__dirname, '..');
const REPO_ROOT = resolve(HERE, '..', '..', '..');

describe('the Plate mark draws section identity over a rule', () => {
  it('draws the identity on the leading edge and the domain on the trailing one, in that order', () => {
    const { container } = render(<PlateMark label='A Section' domain='example.test' />);
    const mark = container.querySelector('.plate-mark');
    expect(mark, 'no plate mark was drawn at all').not.toBeNull();
    expect([...(mark?.children ?? [])].map((cell) => cell.className)).toEqual([
      'plate-mark__label',
      'plate-mark__domain',
    ]);
    expect(mark?.querySelector('.plate-mark__label')?.textContent).toBe('A SECTION');
    expect(mark?.querySelector('.plate-mark__domain')?.textContent).toBe('EXAMPLE.TEST');
  });

  it('reads both cells as text, neither hidden from assistive technology', () => {
    // **The Section variant's trailing cell is not the Annotated variant's subordinate line.** That
    // line is `--token-accent-muted` at 2.74:1 and is `aria-hidden` in every implementation without
    // exception (`DESIGN.md:701-704`); this cell is ordinary secondary text carrying a domain a
    // reader is meant to read. Hiding it would delete a fact rather than a decoration.
    const { container } = render(<PlateMark label='A Section' domain='example.test' />);
    expect(screen.getByText('A SECTION')).toBeInTheDocument();
    expect(screen.getByText('EXAMPLE.TEST')).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
  });

  it('draws no trailing cell at all when there is no domain', () => {
    // Absent, never a placeholder. `DESIGN.md:706-707` says a mark appears where a genuine ordinal
    // or domain exists; a dash, an ellipsis or an empty box each state that something is missing,
    // which is a different claim from making none.
    const { container } = render(<PlateMark label='A Section' />);
    const mark = container.querySelector('.plate-mark');
    expect(mark?.querySelector('.plate-mark__domain')).toBeNull();
    expect(mark?.children, 'the mark draws something beside its label').toHaveLength(1);
    expect(mark?.textContent).toBe('A SECTION');
  });

  it('draws no trailing cell for a domain that is empty or only whitespace', () => {
    // An empty string is a shape a caller can hand it, and rendered it would be a cell with nothing
    // in it: a gap the layout keeps space for and a reader gets nothing from.
    for (const domain of ['', '   ']) {
      const { container } = render(<PlateMark label='A Section' domain={domain} />);
      expect(container.querySelector('.plate-mark__domain'), `"${domain}" drew a cell`).toBeNull();
    }
  });

  it('draws no mark at all for a label that is empty or only whitespace, on every variant', () => {
    // **The label takes the same treatment as the domain, and until it did the two disagreed.**
    // `contracts/registry.schema.json` constrains `name` to a string rather than to a non-blank
    // one, so whitespace is a shape the Registry itself admits. Rendered, it put a hairline across
    // the page with nothing above it, which reads as a separator this design does not have rather
    // than as a label that failed to arrive. The two variants Story 2-31 added take the same rule.
    for (const label of ['', '   ']) {
      for (const props of [
        { label, domain: 'example.test' },
        { variant: 'annotated', label, sub: 'ornament' },
        { variant: 'side-ruled', label, align: 'end' },
      ] as PlateMarkProps[]) {
        const { container } = render(<PlateMark {...props} />);
        expect(container.querySelector('.plate-mark'), `"${label}" drew a ${props.variant ?? 'section'} mark`).toBeNull();
        expect(container.textContent, `"${label}" drew a cell without an identity`).toBe('');
      }
    }
  });

  it('trims the identity it draws rather than rendering the padding around it', () => {
    const { container } = render(<PlateMark label='  A Section  ' domain='  example.test  ' />);
    expect(container.querySelector('.plate-mark__label')?.textContent).toBe('A SECTION');
    expect(container.querySelector('.plate-mark__domain')?.textContent).toBe('EXAMPLE.TEST');
  });

  it('draws the trailing cell for the same mark once it carries one, so the absences discriminate', () => {
    // Without this a mark that had stopped drawing the cell under every condition would pass every
    // case above, and the absence they assert would be a defect rather than a rule.
    const { container } = render(<PlateMark label='A Section' domain='example.test' />);
    expect(container.querySelector('.plate-mark__domain')?.textContent).toBe('EXAMPLE.TEST');
  });

  it('is not interactive, so no hit target arrives on a page with it', () => {
    // `tests/e2e/hit-target-floor.pw.ts` pins an exact count of interactive elements per surface. A
    // mark that grew a link or a tab stop would move that count, and the failure there names a
    // number rather than this component. Every variant, because Story 2-31 added two.
    for (const props of [
      { label: 'A Section', domain: 'example.test' },
      { variant: 'annotated', label: 'A Section', sub: 'ornament' },
      { variant: 'side-ruled', label: 'A Section', align: 'end' },
    ] as PlateMarkProps[]) {
      const { container } = render(<PlateMark {...props} />);
      expect(container.querySelectorAll('a, button, input, select, textarea, summary')).toHaveLength(0);
      expect(container.querySelectorAll('[tabindex], [role], [title], [aria-describedby]')).toHaveLength(0);
    }
  });

  it('carries no heading, the page already having one', () => {
    render(<PlateMark label='A Section' domain='example.test' />);
    expect(screen.queryByRole('heading')).toBeNull();
  });
});

describe('every cell is uppercase in the document, so a label reads the same with CSS turned off', () => {
  it('uppercases the label, the domain and the subordinate line it is handed', () => {
    // `RESTYLE-SPEC.md` § 7 checks a label with CSS turned off and expects a short uppercase string.
    // `text-transform` is a stylesheet, so a mixed-case string handed to the mark read in mixed case
    // with the sheet gone, which is exactly how the two section marks shipped until Story 2-31.
    const cases: [PlateMarkProps, string[]][] = [
      [{ label: 'Curriculum Vitae', domain: 'example.test/cv' }, ['CURRICULUM VITAE', 'EXAMPLE.TEST/CV']],
      [{ variant: 'annotated', label: 'Experience', sub: 'signal lost' }, ['EXPERIENCE', 'SIGNAL LOST']],
      [{ variant: 'side-ruled', label: 'Readout', align: 'end' }, ['READOUT']],
    ];
    for (const [props, expected] of cases) {
      const { container } = render(<PlateMark {...props} />);
      // The subordinate line's string is its `data-ornament` since DW-113; every other cell is text.
      const cells = [...(container.querySelector('.plate-mark')?.children ?? [])].map(
        (cell) => cell.getAttribute('data-ornament') ?? cell.textContent
      );
      expect(cells, `${props.variant ?? 'section'} drew its cells in some other case`).toEqual(expected);
    }
  });

  it('and the read discriminates, because the inputs above were mixed case', () => {
    // The control: an uppercasing that stopped happening would leave the cells equal to their inputs,
    // and those differ from the expectations above.
    const { container } = render(<PlateMark label='Mixed Case' />);
    expect(container.textContent).not.toBe('Mixed Case');
  });
});

describe('three variants, and no fourth', () => {
  /** Every combination the union admits, and the class list each one draws. */
  const COMBINATIONS: [PlateMarkProps, string][] = [
    [{ label: 'A Section' }, 'plate-mark'],
    [{ variant: 'section', label: 'A Section', domain: 'example.test' }, 'plate-mark'],
    [{ variant: 'annotated', label: 'A Section', sub: 'ornament' }, 'plate-mark plate-mark--annotated'],
    [{ variant: 'annotated', label: 'A Section', sub: '' }, 'plate-mark plate-mark--annotated'],
    [{ variant: 'side-ruled', label: 'A Section' }, 'plate-mark plate-mark--side-ruled'],
    [{ variant: 'side-ruled', label: 'A Section', align: 'start' }, 'plate-mark plate-mark--side-ruled'],
    [{ variant: 'side-ruled', label: 'A Section', align: 'end' }, 'plate-mark plate-mark--side-ruled plate-mark--end'],
  ];

  it('draws one of exactly four class lists across every combination the props admit', () => {
    // The fourth list is the side-ruled mirror, which is the side-ruled variant end-aligned
    // (`RESTYLE-SPEC.md` § 7) and not a variant of its own: it moves the same rule to the other edge.
    const drawn = COMBINATIONS.map(([props]) => render(<PlateMark {...props} />).container.querySelector('.plate-mark')?.className);
    expect(drawn).toEqual(COMBINATIONS.map(([, classes]) => classes));
    expect(new Set(drawn).size, 'the combinations draw some other number of class lists').toBe(4);
  });

  it('draws the subordinate line under the label and hides it from assistive technology', () => {
    const { container } = render(<PlateMark variant='annotated' label='Not Found' sub='Signal Lost' />);
    const mark = container.querySelector('.plate-mark');
    expect([...(mark?.children ?? [])].map((cell) => cell.className)).toEqual(['plate-mark__label', 'plate-mark__sub']);
    expect(mark?.querySelector('.plate-mark__sub'), 'the subordinate line is read aloud').toHaveAttribute('aria-hidden', 'true');
    expect(mark?.querySelector('.plate-mark__label'), 'the label is hidden, and the label is what is read').not.toHaveAttribute(
      'aria-hidden'
    );
  });

  it('carries the subordinate line in data-ornament rather than as text (DW-113)', () => {
    // Operator ruling 2026-09-24: axe scores contrast on a text node whatever `aria-hidden` says, and
    // the line is the muted accent at 2.74:1, so as text it failed Lighthouse's audit on `/work`.
    // As generated content it is not page text, and the label beside it stays text.
    const { container } = render(<PlateMark variant='annotated' label='Experience' sub='経験' />);
    const sub = container.querySelector('.plate-mark__sub');
    expect(sub?.getAttribute('data-ornament'), 'the line does not carry its string').toBe('経験');
    expect(sub?.textContent, 'the line still carries its string as text').toBe('');
    expect(container.querySelector('.plate-mark')?.textContent, 'the label stopped being text').toBe('EXPERIENCE');
  });

  it('draws no subordinate line for one that is empty or only whitespace', () => {
    for (const sub of ['', '   ']) {
      const { container } = render(<PlateMark variant='annotated' label='Not Found' sub={sub} />);
      expect(container.querySelector('.plate-mark__sub'), `"${sub}" drew a line`).toBeNull();
      expect(container.querySelector('.plate-mark__label')?.textContent).toBe('NOT FOUND');
    }
  });

  it('draws a side-ruled mark as its label alone, with no trailing cell and no subordinate line', () => {
    const { container } = render(<PlateMark variant='side-ruled' label='Readout' align='end' />);
    const mark = container.querySelector('.plate-mark');
    expect([...(mark?.children ?? [])].map((cell) => cell.className)).toEqual(['plate-mark__label']);
  });
});

describe('the stylesheet names contract roles and nothing else', () => {
  /**
   * Every role the stylesheet reads, pinned so a role renamed in the contract fails here naming the
   * stale pin rather than the pin and the source agreeing on a name nothing declares.
   */
  const ROLES = [
    '--f-mono',
    '--lh-label',
    '--s-2xs',
    '--s-md',
    '--s-sm',
    '--s-xs',
    '--stroke-hair',
    '--t-3xs',
    '--token-accent-muted',
    '--token-border',
    '--token-text-secondary',
    '--tr-label',
    '--tr-meta',
  ] as const;

  /** The compiled stylesheet, which is what ships and carries no comments. */
  const css = compile(resolve(HERE, 'PlateMark.scss'), { style: 'compressed' }).css;

  /** Every declaration in the compiled sheet, as `[property, value]`. */
  const declarations = (source: string): [string, string][] =>
    [...source.matchAll(/(?<=[{;])([a-z-]+):([^;}]+)/g)].map((match) => [match[1], match[2].trim()]);

  it('names only roles the contract declares, and every one it pins', () => {
    const tokens = readFileSync(resolve(REPO_ROOT, 'contracts', 'tokens.css'), 'utf8');
    for (const role of ROLES) {
      expect(tokens, `${role} is pinned here but the published contract no longer declares it`).toMatch(
        new RegExp(`^\\s*${role}\\s*:`, 'm')
      );
      expect(css, `${role} is pinned here and the compiled stylesheet no longer reads it`).toContain(`var(${role})`);
    }
    const read = [...new Set([...css.matchAll(/var\((--[\w-]+)\)/g)].map((match) => match[1]))].sort();
    expect(read, 'the stylesheet reads a name this file does not pin').toEqual([...ROLES].sort());
  });

  it('writes no colour, no length and no custom property of its own', () => {
    expect(css, 'a hex colour').not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css, 'a colour function').not.toMatch(/\b(rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\(/);
    expect(css, 'a gradient').not.toContain('gradient(');
    expect(css, 'a shadow').not.toMatch(/shadow:/);
    expect(css, 'a length literal').not.toMatch(/(?<![\w-])\d*\.?\d+(px|rem|em|vh|vw|ch)\b/);
    expect([...css.matchAll(/(?<=[{;])(--[\w-]+):/g)].map((match) => match[1]), 'a declared custom property').toEqual([]);

    // **Every colour-bearing value is a role and nothing else.** A named colour survives the literal
    // guards above, since Sass can emit `#ff0000` as `red`; so a colour, background or border value
    // is stripped of its `var()` references and of the keywords a rule may carry, and must leave
    // nothing behind.
    const leftover = declarations(css)
      .filter(([property]) => /^(color|background|border|outline)/.test(property))
      .map(([property, value]) => [property, value.replace(/var\(--[\w-]+\)/g, '').replace(/\b(solid|none|transparent|inherit)\b|\b0\b/g, '').trim()])
      .filter(([, remainder]) => remainder !== '')
      .map(([property, remainder]) => `${property}: ${remainder}`);
    expect(leftover, 'a colour, background or border value carries something other than a role').toEqual([]);
  });

  it('and those guards fire on the literals they exist to refuse', () => {
    const planted = compile(resolve(HERE, 'PlateMark.scss'), { style: 'compressed' }).css + '.x{color:red;border:1px solid #fff;--own:1}';
    expect(planted).toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(planted).toMatch(/(?<![\w-])\d*\.?\d+(px|rem|em|vh|vw|ch)\b/);
    expect([...planted.matchAll(/(?<=[{;])(--[\w-]+):/g)]).toHaveLength(1);
    const named = declarations('.x{color:red}').map(([, value]) => value.replace(/var\(--[\w-]+\)/g, '').trim());
    expect(named, 'the colour strip leaves a named colour behind').toEqual(['red']);
  });

  it('carries the three variants, one modifier each, and no fourth', () => {
    const modifiers = [...new Set([...css.matchAll(/\.plate-mark--[\w-]+/g)].map((match) => match[0]))].sort();
    expect(modifiers).toEqual(['.plate-mark--annotated', '.plate-mark--end', '.plate-mark--side-ruled']);
    // The side-ruled rule sits on the leading edge with the contract's small step inside it, and the
    // mirror moves both to the trailing edge (`RESTYLE-SPEC.md` § 7).
    expect(css).toMatch(/\.plate-mark--side-ruled\{[^}]*padding-inline-start:var\(--s-sm\)/);
    expect(css).toMatch(/\.plate-mark--side-ruled\{[^}]*border-inline-start:var\(--stroke-hair\) solid var\(--token-border\)/);
    expect(css).toMatch(/\.plate-mark--end\{[^}]*padding-inline-end:var\(--s-sm\)/);
    expect(css).toMatch(/\.plate-mark--end\{[^}]*border-inline-end:var\(--stroke-hair\) solid var\(--token-border\)/);
  });

  it('sets the base in mono at the smallest step, uppercase, tracked, secondary and tabular, always', () => {
    const base = /\.plate-mark\{([^}]*)\}/.exec(css)?.[1] ?? '';
    for (const declaration of [
      'font-family:var(--f-mono)',
      'font-size:var(--t-3xs)',
      'letter-spacing:var(--tr-label)',
      'text-transform:uppercase',
      'font-variant-numeric:tabular-nums',
      'color:var(--token-text-secondary)',
      'border-block-end:var(--stroke-hair) solid var(--token-border)',
    ]) {
      expect(base, `the base rule does not carry ${declaration}`).toContain(declaration);
    }
    expect(css, 'the subordinate line is not the muted accent at meta tracking').toMatch(
      /\.plate-mark__sub\{color:var\(--token-accent-muted\);letter-spacing:var\(--tr-meta\)\}/
    );
    // DW-113: the line's string reaches the page through `::before` alone, and nothing else here does.
    expect([...css.matchAll(/([^{}]+)\{content:attr\(data-ornament\)\}/g)].map((match) => match[1])).toEqual([
      '.plate-mark__sub::before',
    ]);
  });

  it('carries no state at all, being signage', () => {
    expect(css, 'the mark carries a pointer or focus state').not.toMatch(/:(hover|focus|focus-visible|active)\b/);
    expect(css, 'the mark carries a cursor or a transition').not.toMatch(/cursor:|transition:/);
  });
});

describe('HudLabel is deleted rather than aliased', () => {
  /** Code with its comments removed, so a docblock recording the retirement is not read as a use. */
  const code = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:(])\/\/.*$/gm, '$1');

  /** Every shipped source under a root, tests excluded. */
  const sources = (root: string): string[] =>
    (readdirSync(join(REPO_ROOT, root), { recursive: true }) as string[])
      .map((path) => path.split('\\').join('/'))
      .filter((path) => /\.(tsx?|scss)$/.test(path) && !path.split('/').includes('__tests__'))
      .map((path) => `${root}/${path}`);

  const RETIRED = /\bHudLabel\b|hud-label/;

  it('leaves no directory, no import and no class name behind', () => {
    expect(existsSync(join(REPO_ROOT, 'components', 'atoms', 'HudLabel')), 'the atom directory is still on disk').toBe(false);
    const scanned = [...sources('app'), ...sources('components')];
    expect(scanned.length, 'the scan read almost nothing, so an empty result means little').toBeGreaterThan(40);
    expect(scanned, 'the scan did not reach this component').toContain('components/molecules/PlateMark/PlateMark.tsx');
    const found = scanned.filter((path) => RETIRED.test(code(readFileSync(join(REPO_ROOT, path), 'utf8'))));
    expect(found, 'a shipped source still names the retired atom or its class').toEqual([]);
  });

  it('and the scan fires on a use, while a comment recording the retirement passes', () => {
    expect(RETIRED.test(code("import HudLabel from '@/components/atoms/HudLabel/HudLabel';"))).toBe(true);
    expect(RETIRED.test(code('.hud-label--left { color: inherit; }'))).toBe(true);
    expect(RETIRED.test(code('/** HudLabel was folded in here. */\nconst a = 1;'))).toBe(false);
  });
});
