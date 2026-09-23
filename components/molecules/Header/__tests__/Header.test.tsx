import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { compile } from 'sass';
import { Header } from '../Header';

/**
 * The chrome as it renders and as its four stylesheets compile (Story 2-32).
 *
 * **The markup.** A band that carries the ground and the hairline at the viewport's full width,
 * with the page's container inside it holding the wordmark and then the two destinations (DW-63),
 * and nothing at all on the home route.
 *
 * **The stylesheets, read as they compile**, which is what ships and carries no comments. The four
 * files the header is built from (`Header.scss`, `Navbar.scss`, `Logo.scss` and `Container.scss`) are
 * held to the contract together, one table, because the claim is one claim about one surface: roles
 * only, no literal but the ones `DESIGN.md` states, every hover gated, no motion and no ring of their
 * own. The browser half (the boxes, the pixels, the hover and the tap on a running page) is
 * `tests/e2e/chrome-nav.pw.ts`.
 */

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn<() => string>() }));

vi.mock('next/navigation', () => ({ usePathname }));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

/** The repository root, which every stylesheet path below and the contract are read from. */
const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..');

/** The published token contract, which every role a stylesheet reads has to be declared in. */
const TOKENS = readFileSync(resolve(REPO_ROOT, 'contracts', 'tokens.css'), 'utf8');

/** Render the header for one pathname, the hook answering exactly that. */
const renderAt = (pathname: string) => {
  usePathname.mockReturnValue(pathname);
  return render(<Header />);
};

describe('the header renders a band holding the wordmark and the two destinations', () => {
  it('renders nothing on the home route, which carries its own navigation', () => {
    const { container } = renderAt('/');
    expect(container.innerHTML, 'a header rendered on /, where the hero panels are the navigation').toBe('');
  });

  it('paints the band on the header and puts the content in the page container inside it', () => {
    // DW-63: the 2023 header was itself the container, so its ground stopped at 80% of the
    // viewport. The band is the full-width element; the container inside it aligns the content.
    const { container } = renderAt('/work');
    const header = container.querySelector('header');
    expect(header, 'no header rendered on /work').not.toBeNull();
    expect(header?.className).toBe('header-container');
    expect([...(header?.children ?? [])].map((child) => child.className)).toEqual(['header-container__inner container']);

    const inner = header?.firstElementChild;
    expect(
      [...(inner?.children ?? [])].map((child) => `${child.tagName.toLowerCase()}.${child.className}`),
      'the band does not hold the wordmark and then the nav'
    ).toEqual(['a.logo', 'nav.navbar']);
  });

  it('hands the pathname down, so the destination the route is marks itself', () => {
    renderAt('/cv');
    expect(screen.getByRole('link', { name: 'CV' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Suite' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Cuatro' })).not.toHaveAttribute('aria-current');
  });

  it('carries no image and no alternative text anywhere, since the raster retired', () => {
    const { container } = renderAt('/work');
    expect(container.querySelectorAll('img, svg, picture, [alt]')).toHaveLength(0);
  });
});

/** Every declaration in a compiled sheet, as `[property, value]`. */
const declarations = (css: string): [string, string][] =>
  [...css.matchAll(/(?<=[{;])([a-z-]+):([^;}]+)/g)].map((match) => [match[1], match[2].trim()]);

/** The declarations of the one rule whose whole selector is `selector`, outside any at-rule. */
const ruleOf = (css: string, selector: string): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|})${escaped}\\{([^{}]*)\\}`).exec(css)?.[1] ?? '';
};

/** A compiled sheet with every `@media (hover: hover)` block cut out. */
const ungated = (css: string): string => css.replace(/@media\(hover: hover\)\{(?:[^{}]*\{[^{}]*\})*\}/g, '');

/** What a colour, background, border or outline value leaves once its roles and keywords are gone. */
const colourLeftovers = (css: string): string[] =>
  declarations(css)
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

/** A length written as a number and a unit. */
const LENGTHS = /(?<![\w-])\d*\.?\d+(px|rem|em|ch|[dsl]?vh|[dsl]?vw|vmin|vmax)\b/g;

/** A percentage written as a number. */
const PERCENTAGES = /(?<![\w-])\d*\.?\d+%/g;

/**
 * The four chrome stylesheets, each with the roles it reads and the literals `DESIGN.md` states for
 * it. Pinned in both directions: a role read and not listed fails, and a role listed and not read
 * fails, so neither an alias nor a dropped value arrives unnoticed.
 */
const SHEETS = [
  {
    path: 'components/molecules/Header/Header.scss',
    roles: ['--s-lg', '--stroke-hair', '--tap', '--token-bg', '--token-border', '--z-sticky'],
    lengths: [],
    percentages: [],
  },
  {
    path: 'components/atoms/Navbar/Navbar.scss',
    roles: [
      '--f-mono',
      '--lh-label',
      '--s-lg',
      '--s-md',
      '--stroke-emphasis',
      '--stroke-hair',
      '--t-2xs',
      '--tap',
      '--token-accent',
      '--token-accent-hover',
      '--token-border-interactive',
      '--token-text',
      '--tr-label',
    ],
    lengths: [],
    percentages: [],
  },
  {
    path: 'components/atoms/Logo/Logo.scss',
    roles: ['--f-display', '--lh-heading', '--t-sm', '--tap', '--token-text', '--tr-name', '--w-black'],
    lengths: [],
    // The `wdth 75` DESIGN.md sets the wordmark at, through font matching (`Premise.scss:68`).
    percentages: ['75%'],
  },
  {
    path: 'components/atoms/Container/Container.scss',
    roles: ['--page-pad'],
    // The cap DESIGN.md states for the container, and the full width it takes below it.
    lengths: ['1920px'],
    percentages: ['100%'],
  },
] as const;

/** One sheet, compiled. */
const compiled = (path: string): string => compile(resolve(REPO_ROOT, path), { style: 'compressed' }).css;

describe.each(SHEETS)('$path names contract roles and nothing else', ({ path, roles, lengths, percentages }) => {
  const css = compiled(path);

  it('reads exactly the roles pinned here, each one the contract declares', () => {
    for (const role of roles) {
      expect(TOKENS, `${role} is pinned here but the published contract no longer declares it`).toMatch(
        new RegExp(`^\\s*${role}\\s*:`, 'm')
      );
    }
    const read = [...new Set([...css.matchAll(/var\((--[\w-]+)\)/g)].map((match) => match[1]))].sort();
    expect(read, `${path} reads a name this file does not pin, or no longer reads one it pins`).toEqual([...roles].sort());
  });

  it('writes no colour, no stray length, no shadow, no gradient, no blur, no layer integer and no custom property', () => {
    expect(css, 'a hex colour').not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css, 'a colour function').not.toMatch(/\b(rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\(/);
    expect(css, 'a gradient').not.toContain('gradient(');
    expect(css, 'a shadow').not.toMatch(/shadow:/);
    expect(css, 'a backdrop filter').not.toMatch(/backdrop-filter/);
    expect(css, 'a z-index integer rather than a level').not.toMatch(/z-index:\d/);
    expect([...css.matchAll(LENGTHS)].map((match) => match[0]), 'a length literal DESIGN.md does not state').toEqual([
      ...lengths,
    ]);
    expect([...css.matchAll(PERCENTAGES)].map((match) => match[0]), 'a percentage DESIGN.md does not state').toEqual([
      ...percentages,
    ]);
    expect([...css.matchAll(/(?<=[{;])(--[\w-]+):/g)].map((match) => match[1]), 'a declared custom property').toEqual([]);
    expect(colourLeftovers(css), 'a colour, background or border value carries something other than a role').toEqual([]);
  });

  it('gates every hover on a pointer that can hover, and carries no motion, ring or pressed state of its own', () => {
    expect(ungated(css), 'a :hover rule sits outside @media (hover: hover)').not.toContain(':hover');
    expect(css, 'a transition: a Link recolours instantly and nothing in the chrome moves').not.toMatch(/transition|animation/);
    expect(css, 'a ring of its own: the global rule in app/app.scss is the one ring').not.toMatch(/outline|:focus/);
    expect(css, 'a pressed state, which the system does not have (RESTYLE-SPEC § 1)').not.toMatch(/:active\b/);
  });
});

describe('the guards fire on the literals the 2023 chrome carried', () => {
  it('reports a planted colour, length, weight-free face and ungated hover', () => {
    // The shapes `navbar.scss`, `header.scss` and `logo.scss` shipped until this story, planted into
    // a compiled sheet, so each guard above is seen refusing what it exists to refuse.
    const planted = '.navbar a{font-family:sans-serif;font-size:1.2em;font-weight:300;color:#fff}.navbar a:hover{text-decoration:underline}.header-container{min-block-size:140px}.logo img{width:184px}';
    expect(planted).toMatch(/#[0-9a-f]{3,8}\b/i);
    expect([...planted.matchAll(LENGTHS)].map((match) => match[0])).toEqual(['1.2em', '140px', '184px']);
    expect(ungated(planted)).toContain(':hover');
    expect(ungated('@media(hover: hover){.a:hover{color:red}}')).not.toContain(':hover');
    expect(colourLeftovers('.a{color:white;border-block-end:1px solid red}').join('\n')).toMatch(/white/);
  });
});

describe('the rules each sheet exists for', () => {
  it('Header.scss: a sticky opaque band at the sticky level, closed by a hairline, as tall as its content', () => {
    const css = compiled('components/molecules/Header/Header.scss');
    const band = ruleOf(css, '.header-container');
    for (const declaration of [
      'position:sticky',
      'inset-block-start:0',
      'z-index:var(--z-sticky)',
      'background-color:var(--token-bg)',
      'border-block-end:var(--stroke-hair) solid var(--token-border)',
      'padding-block:var(--s-lg)',
    ]) {
      expect(band, `the band does not declare ${declaration}`).toContain(declaration);
    }
    // Content-driven (DW-62): nothing in the chrome declares a block size.
    expect(css, 'a declared height, which is what content-driven rules out').not.toMatch(/(?<![\w-])(min-|max-)?(height|block-size):/);

    const inner = ruleOf(css, '.header-container__inner');
    for (const declaration of ['display:flex', 'flex-wrap:wrap', 'align-items:center', 'justify-content:space-between', 'gap:var(--s-lg)']) {
      expect(inner, `the row does not declare ${declaration}`).toContain(declaration);
    }

    // The scroll padding restates the band's block size from the same four tokens, never a number.
    expect(ruleOf(css, 'html:has(.header-container)')).toBe(
      'scroll-padding-block-start:calc(var(--s-lg) + var(--tap) + var(--s-lg) + var(--stroke-hair))'
    );
  });

  it('Navbar.scss: mono uppercase links at the floor, a hairline at rest, the emphasis when current, a recolour on hover', () => {
    const css = compiled('components/atoms/Navbar/Navbar.scss');
    expect(ruleOf(css, '.navbar')).toContain('gap:var(--s-lg)');
    const link = ruleOf(css, '.navbar a');
    for (const declaration of [
      'display:inline-flex',
      'align-items:center',
      'min-block-size:var(--tap)',
      'min-inline-size:var(--tap)',
      'padding-inline:var(--s-md)',
      'font-family:var(--f-mono)',
      'font-size:var(--t-2xs)',
      'line-height:var(--lh-label)',
      'letter-spacing:var(--tr-label)',
      'text-transform:uppercase',
      'text-decoration:none',
      'color:var(--token-text)',
    ]) {
      expect(link, `the link does not declare ${declaration}`).toContain(declaration);
    }
    expect(link, 'a weight: the mono face publishes 400 alone').not.toMatch(/font-weight/);
    expect(ruleOf(css, '.navbar__label')).toBe('border-block-end:var(--stroke-hair) solid var(--token-border-interactive)');
    expect(ruleOf(css, ".navbar a[aria-current=page] .navbar__label")).toBe(
      'border-block-end:var(--stroke-emphasis) solid var(--token-accent)'
    );
    // DW-69: one rule, recoloured at its own width, never a second one added.
    expect(css).toContain('@media(hover: hover){.navbar a:hover .navbar__label{border-block-end-color:var(--token-accent-hover)}}');
    expect(css, 'hover adds an underline rather than recolouring the one drawn').not.toMatch(/text-decoration:underline/);
  });

  it('Logo.scss: the wordmark in the display face at wdth 75 and the black weight, at the floor, with no hover', () => {
    const css = compiled('components/atoms/Logo/Logo.scss');
    expect(ruleOf(css, '.logo')).toBe(
      [
        'display:inline-flex',
        'align-items:center',
        'min-block-size:var(--tap)',
        'min-inline-size:var(--tap)',
        'font-family:var(--f-display)',
        'font-size:var(--t-sm)',
        'font-weight:var(--w-black)',
        'font-stretch:75%',
        'line-height:var(--lh-heading)',
        'letter-spacing:var(--tr-name)',
        'text-transform:uppercase',
        'text-decoration:none',
        'color:var(--token-text)',
      ].join(';')
    );
    expect(css, 'the wordmark carries a hover, which no document gives it').not.toContain(':hover');
    expect(css, 'the retired raster is still styled').not.toMatch(/\bimg\b/);
  });

  it('Container.scss: capped rather than percentaged, centred, at the page padding', () => {
    const css = compiled('components/atoms/Container/Container.scss');
    expect(ruleOf(css, '.container')).toBe('width:min(100%,1920px);margin-inline:auto;padding-inline:var(--page-pad)');
  });
});
