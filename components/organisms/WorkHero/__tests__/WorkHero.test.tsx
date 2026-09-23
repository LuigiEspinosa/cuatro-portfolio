import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ComponentType, RefObject } from 'react';
import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { compile } from 'sass';
import { WorkHero } from '../WorkHero';
import { work } from '@/content/work';

/**
 * The `/work` hero as the server renders it, as the client draws it, and as its stylesheet compiles
 * (Stories 2-28 and 2-33).
 *
 * **Story 2-33 rebuilt it token-native.** The display line is the page's one `<h1>`, the meta line is
 * a section Plate mark, the entrance is one CSS keyframe, and the torus sits behind one `next/dynamic`
 * boundary that is never rendered under reduced motion and that contains a chunk which fails to
 * arrive. The browser half (the tree, the requests, the pixels, the entrance on a running page, the
 * boundary with its chunk aborted) is `tests/e2e/work-hero.pw.ts`.
 *
 * **What the mocks honour.** `next/dynamic` is replaced by a recorder that keeps the loader and the
 * options it was handed, so the options are read as the component wrote them and the loader can be
 * driven against a module that resolves, one that lacks the export and one that fails. GSAP records
 * every tween it is asked for, so the binding's vars are read as written and an entrance tween coming
 * back is seen. `useReduceMotion` answers whatever the case sets, which is the one input the torus's
 * branch reads.
 */

const mocks = vi.hoisted(() => ({
  reduceMotion: false,
  dynamicCalls: [] as { loader: () => Promise<unknown>; options?: Record<string, unknown> }[],
  to: vi.fn(),
  from: vi.fn(),
  fromTo: vi.fn(),
}));

vi.mock('gsap', () => {
  const gsapMock = {
    registerPlugin: vi.fn(),
    to: mocks.to,
    from: mocks.from,
    fromTo: mocks.fromTo,
    context: vi.fn((fn: (context: unknown) => void) => {
      fn({});
      return { revert: vi.fn() };
    }),
  };
  return { gsap: gsapMock, default: gsapMock };
});

vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }));

vi.mock('@/hooks/useReduceMotion', () => ({ useReduceMotion: () => mocks.reduceMotion }));

vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<unknown>, options?: Record<string, unknown>) => {
    mocks.dynamicCalls.push({ loader, options });
    const MockTorus = () => <div data-testid='torus-canvas' />;
    MockTorus.displayName = 'MockTorus';
    return MockTorus;
  },
}));

/** The component's directory, and the repository root the contract is read from. */
const HERE = resolve(__dirname, '..');
const REPO_ROOT = resolve(HERE, '..', '..', '..');

/** The published token contract, which every role the stylesheet reads has to be declared in. */
const TOKENS = readFileSync(resolve(REPO_ROOT, 'contracts', 'tokens.css'), 'utf8');

/** The component's own source, read for what it imports rather than for what it renders. */
const SOURCE = readFileSync(resolve(HERE, 'WorkHero.tsx'), 'utf8');

/** A markup string as a document, so every read goes through the browser's own parser. */
const parse = (markup: string): Document => new DOMParser().parseFromString(markup, 'text/html');

/** The server markup: no effect runs, so this is the document every visitor gets first. */
const MARKUP = renderToStaticMarkup(<WorkHero />);
const SERVED = parse(MARKUP);

beforeEach(() => {
  mocks.reduceMotion = false;
  mocks.to.mockClear();
  mocks.from.mockClear();
  mocks.fromTo.mockClear();
});

describe('the hero as the server renders it', () => {
  it('carries one <h1>, the display line, in its own words and outside any aria-hidden subtree', () => {
    const headings = SERVED.querySelectorAll('h1');
    expect(headings, 'the hero does not render exactly one h1').toHaveLength(1);
    expect(headings[0].classList.contains('work-hero__heading'), 'the h1 lost the class its stylesheet sets').toBe(true);
    expect(headings[0].innerHTML, 'the display line changed its words or lost its break').toBe('Frontend Developer<br>and Team Lead');
    expect(headings[0].closest('[aria-hidden]'), 'the heading sits inside an aria-hidden subtree').toBeNull();
    // The predicate, on the shape `main` shipped before PR #65: the section itself hidden.
    const hidden = parse(MARKUP.replace("<section class=\"work-hero\"", "<section class=\"work-hero\" aria-hidden=\"true\""));
    expect(hidden.querySelector('h1')?.closest('[aria-hidden]'), 'the plant did not land, so the read above is not a read').not.toBeNull();
  });

  it('renders the meta line as a section Plate mark: the count, then the period, no // and no free text', () => {
    const meta = SERVED.querySelectorAll('.work-hero__meta > .plate-mark');
    expect(meta, 'the meta line is not one Plate mark').toHaveLength(1);
    expect(meta[0].className, 'the meta mark is not the section variant').toBe('plate-mark');
    expect(meta[0].querySelector('.plate-mark__label')?.textContent, 'the label is not the count of positions').toBe(
      `${work.length} POSITIONS`
    );
    expect(meta[0].querySelector('.plate-mark__domain')?.textContent, 'the domain is not the period').toBe('2017 - PRESENT');
    expect(SERVED.querySelector('.work-hero p'), 'a paragraph is back in the hero: the 2023 meta line was free text').toBeNull();
  });

  it('keeps the annotated mark, its subordinate line hidden, and carries exactly two marks', () => {
    const marks = SERVED.querySelectorAll('.work-hero .plate-mark');
    expect(marks, 'the hero does not carry exactly two marks').toHaveLength(2);
    const annotated = SERVED.querySelector('.work-hero .plate-mark--annotated');
    expect(annotated?.querySelector('.plate-mark__label')?.textContent).toBe('EXPERIENCE');
    expect(annotated?.querySelector('.plate-mark__sub')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('speaks no // anywhere in the hero, which a screen reader would read out', () => {
    const text = SERVED.querySelector('.work-hero')?.textContent ?? '';
    expect(text.length, 'the hero rendered no text, so this scan is over nothing').toBeGreaterThan(20);
    expect(text, 'a // is in the hero text').not.toContain('//');
    expect(`${text} // 2017`, 'the scan no longer sees a //').toContain('//');
  });

  it('serves the canvas box empty: the torus is never in the server markup', () => {
    const wrap = SERVED.querySelectorAll('.work-hero__canvas-wrap');
    expect(wrap, 'the hero renders no canvas wrap, or more than one').toHaveLength(1);
    expect(wrap[0].innerHTML, 'the server markup carries something inside the canvas wrap').toBe('');
    expect(MARKUP, 'the torus is rendered on the server').not.toContain('torus-canvas');
    // DW-102: one of the two reads that catch a returning overlay (Story 2-28).
    expect(MARKUP, 'the hero renders a .scanline-overlay').not.toContain('scanline-overlay');
  });
});

describe('the torus is drawn only where motion is allowed, and bound to the scroll 1:1', () => {
  it('draws the torus and binds it with scrub: true when no reduced motion is asked for', () => {
    const { container } = render(<WorkHero />);
    expect(screen.getByTestId('torus-canvas'), 'the torus was not drawn').toBeInTheDocument();
    expect(mocks.to, 'the scroll binding was not created exactly once').toHaveBeenCalledTimes(1);
    const [target, vars] = mocks.to.mock.calls[0] as [{ value: number }, Record<string, unknown>];
    expect(target, 'the binding does not drive the scroll bridge').toEqual({ value: 0 });
    expect(vars.value).toBe(1);
    expect(vars.ease, 'the binding eases, so the rotation would not track the scroll').toBe('none');
    expect(vars.scrollTrigger, 'the binding is not the hero scrolled through the viewport, 1:1').toEqual({
      trigger: container.querySelector('.work-hero'),
      start: 'top bottom',
      end: 'bottom top',
      scrub: true,
    });
  });

  it('requests no torus and creates no scroll binding under reduced motion', () => {
    mocks.reduceMotion = true;
    render(<WorkHero />);
    expect(screen.queryByTestId('torus-canvas'), 'the torus is drawn under reduced motion').not.toBeInTheDocument();
    expect(mocks.to, 'a scroll binding exists with nothing to drive').not.toHaveBeenCalled();
  });

  it('takes the torus away when the preference changes to reduce mid-session', () => {
    const { rerender } = render(<WorkHero />);
    expect(screen.getByTestId('torus-canvas')).toBeInTheDocument();
    mocks.reduceMotion = true;
    rerender(<WorkHero />);
    expect(screen.queryByTestId('torus-canvas'), 'the torus outlived a preference for reduced motion').not.toBeInTheDocument();
  });

  it('runs no entrance tween from script: the entrance is the stylesheet’s', () => {
    render(<WorkHero />);
    mocks.reduceMotion = true;
    render(<WorkHero />);
    expect(mocks.from, 'a from-tween is back').not.toHaveBeenCalled();
    expect(mocks.fromTo, 'a fromTo-tween is back').not.toHaveBeenCalled();
    expect(mocks.to.mock.calls.every(([target]) => (target as { value?: number }).value !== undefined), 'a tween targets something other than the scroll bridge').toBe(true);
  });
});

describe('the torus is behind one contained dynamic boundary', () => {
  it('imports nothing from the WebGL stack statically, and builds exactly one boundary', () => {
    for (const library of ['three', '@react-three/fiber', '@react-three/drei']) {
      expect(SOURCE, `${library} is imported by the hero`).not.toMatch(new RegExp(`from\\s+['"]${library}`));
    }
    expect(SOURCE, 'the torus module is imported statically').not.toMatch(/^import(?!\s+type)[^;]*TorusCanvas/m);
    expect("import { TorusCanvas } from '@/components/molecules/TorusCanvas/TorusCanvas';").toMatch(/^import(?!\s+type)[^;]*TorusCanvas/m);
    expect(mocks.dynamicCalls, 'the hero builds a number of dynamic boundaries other than one').toHaveLength(1);
  });

  it('is client-only and announces no wait', () => {
    const { options } = mocks.dynamicCalls[0];
    expect(options?.ssr, 'the boundary renders on the server').toBe(false);
    expect(options && 'loading' in options, 'the boundary takes a loading state').toBe(false);
  });

  it('passes the torus through when its module resolves', async () => {
    const Planted = () => null;
    vi.doMock('@/components/molecules/TorusCanvas/TorusCanvas', () => ({ TorusCanvas: Planted }));
    try {
      expect(await mocks.dynamicCalls[0].loader(), 'the loader did not hand back the module’s export').toBe(Planted);
    } finally {
      vi.doUnmock('@/components/molecules/TorusCanvas/TorusCanvas');
      vi.resetModules();
    }
  });

  it('draws nothing when the module resolves without the export', async () => {
    vi.doMock('@/components/molecules/TorusCanvas/TorusCanvas', () => ({ TorusCanvas: undefined }));
    try {
      const Resolved = (await mocks.dynamicCalls[0].loader()) as ComponentType<{ scrollRef: RefObject<{ value: number }> }>;
      expect(typeof Resolved, 'the loader resolved to something React cannot render').toBe('function');
      const { container } = render(<Resolved scrollRef={{ current: { value: 0 } }} />);
      expect(container.innerHTML, 'a missing export drew something').toBe('');
    } finally {
      vi.doUnmock('@/components/molecules/TorusCanvas/TorusCanvas');
      vi.resetModules();
    }
  });

  it('draws nothing and says so when the chunk fails to arrive', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.doMock('@/components/molecules/TorusCanvas/TorusCanvas', () => {
      throw new Error('the chunk did not arrive');
    });
    try {
      const Resolved = (await mocks.dynamicCalls[0].loader()) as ComponentType<{ scrollRef: RefObject<{ value: number }> }>;
      const { container } = render(<Resolved scrollRef={{ current: { value: 0 } }} />);
      expect(container.innerHTML, 'a failed chunk drew something').toBe('');
      expect(
        logged.mock.calls.some(([message]) => typeof message === 'string' && message.startsWith('WorkHero: the torus chunk failed to load')),
        'the failure was swallowed rather than logged'
      ).toBe(true);
    } finally {
      logged.mockRestore();
      vi.doUnmock('@/components/molecules/TorusCanvas/TorusCanvas');
      vi.resetModules();
    }
  });
});

describe('the stylesheet names contract roles and nothing else', () => {
  /** Every role `WorkHero.scss` reads, pinned against the contract before it is read in the source. */
  const ROLES = [
    '--dur-minor',
    '--ease-entrance',
    '--f-display',
    '--lh-display',
    '--s-2xl',
    '--s-lg',
    '--s-md',
    '--s-xl',
    '--stroke-boundary',
    '--t-display',
    '--token-border-interactive',
    '--token-text',
    '--tr-display',
    '--w-black',
  ] as const;

  /** The compiled stylesheet, which is what ships and carries no comments. */
  const css = compile(resolve(HERE, 'WorkHero.scss'), { style: 'compressed' }).css;

  /** Every declaration in a compiled sheet, as `[property, value]`. Media conditions are not declarations. */
  const declarations = (source: string): [string, string][] =>
    [...source.matchAll(/(?<=[{;])([a-z-]+):([^;}]+)/g)].map((match) => [match[1], match[2].trim()]);

  /** The declarations of the one rule whose whole selector is `selector`, outside any at-rule. */
  const ruleOf = (source: string, selector: string): string => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|})${escaped}\\{([^{}]*)\\}`).exec(source)?.[1] ?? '';
  };

  /** A length written as a number and a unit, the units a page can be laid out in included. */
  const LENGTH = /(?<![\w-])\d*\.?\d+(px|rem|em|ch|[dsl]?vh|[dsl]?vw|vmin|vmax)\b/;

  /** The declarations' values alone, so a breakpoint in a media condition is not read as a length. */
  const values = (source: string): string => declarations(source).map(([, value]) => value).join(';');

  it('names only roles the contract declares, and every one it pins', () => {
    for (const role of ROLES) {
      expect(TOKENS, `${role} is pinned here but the published contract no longer declares it`).toMatch(new RegExp(`^\\s*${role}\\s*:`, 'm'));
      expect(css, `${role} is pinned here and the compiled stylesheet no longer reads it`).toContain(`var(${role})`);
    }
    const read = [...new Set([...css.matchAll(/var\((--[\w-]+)\)/g)].map((match) => match[1]))].sort();
    expect(read, 'the stylesheet reads a name this file does not pin, an alias or an undeclared name').toEqual([...ROLES].sort());
  });

  it('writes no colour, no length, no shadow, no gradient, no layer, no clip, no image and no custom property', () => {
    expect(css, 'a hex colour').not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css, 'a colour function').not.toMatch(/\b(rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\(/);
    expect(css, 'a gradient').not.toContain('gradient(');
    expect(css, 'a shadow').not.toMatch(/shadow:/);
    expect(css, 'a z-index, which the ledger carried as z-work-hero').not.toMatch(/z-index:/);
    expect(css, 'a url(), a grain or a raster').not.toContain('url(');
    expect(css, 'overflow: hidden, which clips and which the contract bars').not.toMatch(/overflow:hidden/);
    expect(css, 'a transition: nothing in the hero changes state').not.toMatch(/transition/);
    expect(css, 'an !important').not.toContain('!important');
    expect(values(css), 'a length literal in a declaration').not.toMatch(LENGTH);
    expect(css, 'a percentage').not.toContain('%');
    expect([...css.matchAll(/(?<=[{;])(--[\w-]+):/g)].map((match) => match[1]), 'a declared custom property').toEqual([]);
  });

  it('and those guards fire on what the 2023 sheet carried', () => {
    const planted = css.replace(
      '.work-hero{',
      '.work-hero{min-height:42vh;padding:5rem var(--page-padding) 3rem;border-bottom:1px solid var(--accent-dim);overflow:hidden;z-index:2;color:#fff;letter-spacing:.08em;'
    );
    expect(planted, 'the planted rule did not land').not.toBe(css);
    expect(values(planted), 'the length guard lets a viewport height through').toMatch(LENGTH);
    expect(planted).toMatch(/z-index:/);
    expect(planted).toMatch(/overflow:hidden/);
    expect(planted).toMatch(/#[0-9a-f]{3,8}\b/i);
    const read = [...new Set([...planted.matchAll(/var\((--[\w-]+)\)/g)].map((match) => match[1]))].sort();
    expect(read, 'the role read does not see an alias').toContain('--accent-dim');
    expect(values('.a{}@media(min-width: 768px){.a{color:red}}'), 'the value read takes a breakpoint for a length').not.toMatch(LENGTH);
  });

  it('closes the hero beneath with the boundary rule and lays it out as one column, content-high', () => {
    const hero = ruleOf(css, '.work-hero');
    for (const declaration of [
      'display:grid',
      'grid-template-columns:minmax(0, 1fr)',
      'gap:var(--s-lg)',
      'align-items:center',
      'padding-block:var(--s-2xl) var(--s-xl)',
      'border-block-end:var(--stroke-boundary) solid var(--token-border-interactive)',
    ]) {
      expect(hero, `the hero does not declare ${declaration}`).toContain(declaration);
    }
    expect(hero, 'the hero holds a height of its own').not.toMatch(/(?:^|;)(?:min-|max-)?(?:height|block-size):/);
    expect(hero, 'the hero pads inline, which the container already does').not.toMatch(/padding(?:-inline)?:/);
    expect(ruleOf(css, '.work-hero__text'), 'the text column is not a column at the medium gap').toBe(
      'display:flex;flex-direction:column;gap:var(--s-md)'
    );
    expect(ruleOf(css, '.work-hero__canvas-wrap'), 'the canvas box does not reserve its space by ratio').toBe('aspect-ratio:4/3');
  });

  it('gives the display line the left three fifths, and only where the torus is drawn', () => {
    expect(css, 'the two columns are not gated on the breakpoint and on motion being allowed').toContain(
      '@media(min-width: 768px)and (prefers-reduced-motion: no-preference){.work-hero{grid-template-columns:minmax(0, 3fr) minmax(0, 2fr)}}'
    );
    expect([...css.matchAll(/grid-template-columns:/g)], 'a column template outside the two stated').toHaveLength(2);
  });

  it('sets the heading on the display row: face, size, weight, leading, tracking, case and the text role', () => {
    const heading = ruleOf(css, '.work-hero__heading');
    for (const declaration of [
      'font-family:var(--f-display)',
      'font-size:var(--t-display)',
      'font-weight:var(--w-black)',
      'line-height:var(--lh-display)',
      'letter-spacing:var(--tr-display)',
      'text-transform:uppercase',
      'overflow-wrap:break-word',
      'color:var(--token-text)',
    ]) {
      expect(heading, `the heading does not declare ${declaration}`).toContain(declaration);
    }
  });

  it('animates opacity once, from the base state, heading then meta, and not at all under reduced motion', () => {
    expect([...css.matchAll(/@keyframes/g)], 'the stylesheet declares a number of keyframes other than one').toHaveLength(1);
    expect(css, 'the entrance keyframe was renamed or gained a property').toContain('@keyframes work-hero-enter{from{opacity:0}}');
    expect(css, 'an animation repeats').not.toMatch(/infinite/);
    expect(
      [...css.matchAll(/opacity:([^;}]+)/g)].map((match) => match[1].trim()),
      'an opacity other than the keyframe’s from, so opacity expresses state'
    ).toEqual(['0']);
    const animated = ['.work-hero__heading', '.work-hero__meta'].map((selector) => [
      selector,
      /animation:([^;}]+)/.exec(ruleOf(css, selector))?.[1] ?? '',
    ]);
    expect(animated, 'the entrance is not one keyframe at the minor duration on the entrance curve, 100 and 400ms').toEqual([
      ['.work-hero__heading', 'work-hero-enter var(--dur-minor) var(--ease-entrance) 100ms both'],
      ['.work-hero__meta', 'work-hero-enter var(--dur-minor) var(--ease-entrance) 400ms both'],
    ]);
    expect([...css.matchAll(/animation:work-hero-enter/g)], 'a rule outside the two animates').toHaveLength(2);
    expect(css, 'reduced motion does not take the entrance off both and omit the canvas box').toContain(
      '@media(prefers-reduced-motion: reduce){.work-hero__heading,.work-hero__meta{animation:none}.work-hero__canvas-wrap{display:none}}'
    );
  });
});
