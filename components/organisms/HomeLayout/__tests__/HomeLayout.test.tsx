import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile } from 'sass';
import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { NarrativePath, ServedNarrativePath } from '@/hooks/useNarrativePath';
import HomeLayout from '../HomeLayout';

/**
 * The decision is mocked here and nowhere else in this file's subject (Story 2-13).
 *
 * `hooks/__tests__/useNarrativePath.test.ts` proves which inputs produce which answer. What this
 * file is about is what the hero renders for each answer, so the answer is supplied directly:
 * driving it through a canvas stub would make every case below depend on the probe as well as on
 * the layout, and a failure would name neither.
 *
 * **The mock records what it was called with, which is the half that was missing.** A mock that
 * ignored its argument left the whole `servedPath` chain untested: deleting the prop from the route,
 * from this component's signature, or from the call below changed nothing any case here could see.
 * The same holds one level down, so the `GemComponent` mock records the path it was handed.
 */
const decided = vi.hoisted(() => ({
  path: 'narrative' as NarrativePath,
  served: [] as (ServedNarrativePath | undefined)[],
  handedToGem: [] as (NarrativePath | undefined)[],
}));

vi.mock('@/hooks/useNarrativePath', () => ({
  useNarrativePath: (served?: ServedNarrativePath) => {
    decided.served.push(served);
    return decided.path;
  },
}));

beforeEach(() => {
  decided.path = 'narrative';
  decided.served = [];
  decided.handedToGem = [];
});

/**
 * **The `gsap` and `useGsapContext` mocks left with the timeline (Story 2-29).**
 *
 * DW-41 recorded that the `useGsapContext` mock received the callback holding the whole entrance
 * and dropped it, so no case here could observe the homepage entrance at all and the mock read as
 * coverage while covering nothing. The entry dissolves rather than being fixed: the entrance is
 * `animation-delay` declarations on keyframes in `HomeLayout.scss`, this
 * component imports neither `gsap` nor the hook, and what there is to assert about the entrance is
 * a stylesheet read (below) and a browser read (`tests/e2e/narrative.pw.ts`), not a mock.
 */

vi.mock('@/components/molecules/GemComponent/GemComponent', () => ({
  default: ({ path }: { path?: NarrativePath }) => {
    decided.handedToGem.push(path);
    return <div data-testid='gem-component' data-path={path} />;
  },
}));

vi.mock('@/components/molecules/GlitchText/GlitchText', () => ({
  default: ({ text }: { text: string }) => <div>{text}</div>,
}));

vi.mock('@/components/molecules/ContactContainer/ContactContainer', () => ({
  default: () => (
    <div>
      <a href='htpps://github.com'>Github</a>
      <a href='htpps://linkedin.com'>LinkdIn</a>
    </div>
  ),
}));

describe('HomeLayout', () => {
  it('renders the name heading', () => {
    render(<HomeLayout />);
    expect(screen.getByText('Luigi Espinosa')).toBeInTheDocument();
  });

  it('renders the role line', () => {
    render(<HomeLayout />);
    expect(screen.getByText('Senior Fullstack Engineer / Team Lead')).toBeInTheDocument();
  });

  it('renders the work link with correct href', () => {
    render(<HomeLayout />);
    const link = screen.getByRole('link', { name: /professional experience/i });
    expect(link).toHaveAttribute('href', '/work');
  });

  it('renders the suite link with correct href', () => {
    // Repointed and relabelled by Story 2-15. `/projects` is a 301 to `/#suite`, so this panel used
    // to spend a round trip on a redirect the App Router resolves client-side, dropping the
    // fragment and landing the visitor at the top of the page (DW-55, DW-58). Pointing it at the
    // fragment directly makes the click a same-route navigation that never reaches the redirect.
    render(<HomeLayout />);
    const link = screen.getByRole('link', { name: /suite directory/i });
    expect(link).toHaveAttribute('href', '/#suite');
  });

  it('renders the gem component', () => {
    render(<HomeLayout />);
    expect(screen.getByTestId('gem-component')).toBeInTheDocument();
  });

  it('renders three panels, name, navigation and contact, and no readout on either door', () => {
    // Operator ruling 2026-09-24 (DW-110): the readout panel and its Plate mark are removed, so no
    // panel carries a mark and nothing on the hero reads a code. Both doors, because the flat one
    // served the panel too and only hid it.
    for (const path of ['narrative', 'flat'] as const) {
      decided.path = path;
      const { container, unmount } = render(<HomeLayout />);
      expect(
        [...container.querySelectorAll('.home-panel')].map((panel) => panel.className),
        `the ${path} door renders some other set of panels`
      ).toEqual(['home-panel home-panel--name', 'home-panel home-panel--nav', 'home-panel home-panel--contact']);
      expect(container.querySelectorAll('.plate-mark'), `the ${path} door still draws a Plate mark in the hero`).toHaveLength(0);
      expect(container.textContent, `the ${path} door still reads the readout's code`).not.toContain('SYS_ONLINE');
      unmount();
    }
  });

  it('carries each Japanese ornament in data-ornament rather than as text, hidden from assistive technology', () => {
    // Operator ruling 2026-09-24 (DW-113): axe scores contrast on a text node whatever `aria-hidden`
    // says, and these three are set in the muted accent at 2.74:1, so as text they failed
    // Lighthouse's audit on ornament no reader needs. As generated content they are not page text.
    const { container } = render(<HomeLayout />);
    for (const [selector, ornament] of [
      ['.home-role__jp', 'フロントエンドエンジニア'],
      ['.home-nav-jp', 'ナビゲーション'],
      ['.home-contact-jp', '接続'],
    ] as const) {
      const node = container.querySelector(selector);
      expect(node, `${selector} is not rendered`).not.toBeNull();
      expect(node?.getAttribute('data-ornament'), `${selector} does not carry its string`).toBe(ornament);
      expect(node?.textContent, `${selector} still carries its string as text`).toBe('');
      expect(node, `${selector} is in the accessibility tree`).toHaveAttribute('aria-hidden', 'true');
    }
    expect(container.textContent, 'an ornament string is still page text somewhere in the hero').not.toMatch(/[\u3040-\u30ff\u4e00-\u9fff]/);
  });
});

describe('HomeLayout on the two front doors', () => {
  it('renders the skip control on the default path, outside every panel', () => {
    // FR-2's one interaction. Outside `.home-panel` deliberately: the entrance fades the panels
    // in over two and a bit seconds and a control that answers a cold arrival may not wait for it.
    // The dim-siblings rule this comment also cited was retired by Story 2-29, so opacity no
    // longer expresses state on this surface at all and the entrance is the whole of the reason.
    const { container } = render(<HomeLayout />);
    const control = container.querySelector('.skip-control');
    expect(control, 'the default path renders no skip control').not.toBeNull();
    expect(control?.closest('.home-panel'), 'the skip control is inside a panel').toBeNull();
    expect(control?.parentElement?.className).toContain('home-container');
  });

  it('renders neither the gem nor the skip control on the non-3D path, and marks the container', () => {
    // The whole of the flat front door as this layer can see it: no 3D block, and no control,
    // because reaching the Directory costs zero interactions on this path
    // (`EXPERIENCE.md:154-169`). The modifier is what releases the viewport lock in the stylesheet.
    decided.path = 'flat';
    const { container } = render(<HomeLayout />);

    expect(container.querySelector('.home-gem'), 'the non-3D path still renders the gem box').toBeNull();
    expect(screen.queryByTestId('gem-component')).not.toBeInTheDocument();
    expect(container.querySelector('.skip-control'), 'the non-3D path renders a skip control').toBeNull();
    expect(container.querySelector('.home-container')?.className).toContain('home-container--flat');
  });

  it('hands the server verdict to the hook, unchanged and exactly once', () => {
    // Up the chain: the route reads `Save-Data` and this component passes what it was given
    // straight through, or the server's answer never reaches the decision at all. Exactly once,
    // because one page means one decision, and a second call is a second WebGL probe.
    decided.path = 'flat';
    render(<HomeLayout servedPath='flat' />);

    expect(decided.served, 'the served verdict did not reach the hook unchanged, or reached it twice').toEqual([
      'flat',
    ]);
  });

  it('defaults the verdict to undecided when the route passes none', () => {
    // The control for the case above: a component that ignored the prop entirely would pass the
    // first case by accident if the default and the served value were the same string.
    render(<HomeLayout />);
    expect(decided.served).toEqual(['undecided']);
  });

  it('hands the gem the decided path rather than the served one', () => {
    // Down the chain, and this is the one the review found: the gem used to be handed `servedPath`
    // and to call the hook itself, which is two state machines, two probes and three motion
    // subscriptions on one load. Both values are read, because a component that passed a constant
    // would satisfy either one alone.
    render(<HomeLayout />);
    expect(decided.handedToGem, 'the gem was not handed the decided path').toEqual(['narrative']);

    decided.handedToGem = [];
    decided.path = 'undecided';
    render(<HomeLayout />);
    expect(decided.handedToGem, 'the gem is handed a constant rather than the decision').toEqual(['undecided']);
  });

  it('serves the flat hero as markup when the server already answered, with no client render', () => {
    // `renderToStaticMarkup` is the served document: no effects, no hydration. This is what a
    // `Save-Data` visitor's bytes look like, and the whole point of reading the header on the server
    // is that the hero arrives flat rather than arriving whole and being corrected a frame later.
    decided.path = 'flat';
    const served = renderToStaticMarkup(<HomeLayout servedPath='flat' />);

    expect(served, 'the served markup is not the flat hero').toContain('home-container--flat');
    expect(served, 'the served markup carries the gem container').not.toContain('home-gem');
    expect(served, 'the served markup carries the skip control').not.toContain('skip-control');
  });

  it('hands the reach event the decided door, observing the Directory heading (DW-88)', () => {
    // Operator ruling 2026-09-24: `suite-reach` carries which front door the visitor had. The door
    // is this component's decision, so it renders the reach instrument and hands it the answer; the
    // Directory is a server component and cannot see it. Nothing is observed while undecided.
    const observed: Element[] = [];
    const callbacks: IntersectionObserverCallback[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          callbacks.push(callback);
        }
        observe(target: Element) {
          observed.push(target);
        }
        disconnect() {}
      }
    );
    const track = vi.fn();
    window.umami = { track };
    const heading = document.createElement('h2');
    heading.id = 'suite';
    document.body.append(heading);
    try {
      decided.path = 'undecided';
      const undecided = render(<HomeLayout />);
      expect(observed, 'an undecided door observed the heading').toEqual([]);
      undecided.unmount();

      for (const path of ['flat', 'narrative'] as const) {
        sessionStorage.clear();
        observed.length = 0;
        callbacks.length = 0;
        track.mockReset();
        decided.path = path;
        const { unmount } = render(<HomeLayout />);
        expect(observed, `the ${path} door did not observe the Directory heading`).toEqual([heading]);
        callbacks[0](
          [{ isIntersecting: true, boundingClientRect: { bottom: 100 } } as unknown as IntersectionObserverEntry],
          {} as IntersectionObserver
        );
        expect(track.mock.calls, `the ${path} door sent something other than its door`).toEqual([['suite-reach', { door: path }]]);
        unmount();
      }
    } finally {
      heading.remove();
      sessionStorage.clear();
      delete window.umami;
      vi.unstubAllGlobals();
    }
  });

  it('renders the default path geometry while the decision is undecided', () => {
    // The undecided state renders the geometry the narrative path will keep, so resolving either
    // way never grows the page: it either changes nothing or removes a box. Both boxes are part of
    // that geometry, the skip control included: below 768 it is a static item in the hero's column,
    // and one that arrived a frame after paint would push the page down by its own height.
    decided.path = 'undecided';
    const { container } = render(<HomeLayout />);

    expect(container.querySelector('.home-gem'), 'the undecided state drops the gem box').not.toBeNull();
    expect(container.querySelector('.skip-control'), 'the undecided state drops the skip control').not.toBeNull();
    expect(container.querySelector('.home-container')?.className).not.toContain('home-container--flat');
  });
});

/**
 * The five hero links are held `inert` while their entrance waits (Operator ruling 2026-09-25,
 * DW-125). jsdom runs no CSS animation, so each element's `getAnimations()` is stubbed here with the
 * shape a browser reports: a delay, and a current time before or past it. The browser half, the hold
 * and Tab and the click, is `tests/e2e/front-door.pw.ts`.
 */
describe('the hero links are inert only while their entrance waits (DW-125)', () => {
  const HERO_LINKS = '.home-panel--nav a, .home-panel--contact a';
  let clock: number | null = 0;
  let running = true;

  beforeEach(() => {
    clock = 0;
    running = true;
    // jsdom declares no `getAnimations` at all, so it is defined for this block and removed after it.
    Object.defineProperty(Element.prototype, 'getAnimations', {
      configurable: true,
      value: () => (running ? [{ currentTime: clock, effect: { getTiming: () => ({ delay: 2000 }) } }] : []),
    });
  });

  afterEach(() => {
    delete (Element.prototype as { getAnimations?: unknown }).getAnimations;
  });

  const inert = (root: ParentNode) => [...root.querySelectorAll(HERO_LINKS)].map((link) => link.hasAttribute('inert'));

  it('holds every link inert through its delay, and frees each one when its entrance starts, ends or is cancelled', () => {
    const { container } = render(<HomeLayout />);
    const links = [...container.querySelectorAll<HTMLElement>(HERO_LINKS)];
    expect(links.length, 'the hero rendered no links, so the reads below are over nothing').toBeGreaterThan(2);
    expect(inert(container), 'a link is reachable while its entrance has not begun').toEqual(links.map(() => true));

    links[0].dispatchEvent(new Event('animationstart'));
    links[1].dispatchEvent(new Event('animationend'));
    links[2].dispatchEvent(new Event('animationcancel'));
    expect(inert(container).slice(0, 3), 'a link stayed inert after its entrance started, ended or was cancelled').toEqual([false, false, false]);
    expect(inert(container).slice(3), 'an event on one link freed another').toEqual(links.slice(3).map(() => true));
  });

  it('never strands a link: unmounting, or the door turning flat, frees every one', () => {
    const { container, rerender, unmount } = render(<HomeLayout />);
    expect(inert(container).every(Boolean)).toBe(true);
    decided.path = 'flat';
    rerender(<HomeLayout />);
    expect(inert(container), 'a link stayed inert after the door turned flat').not.toContain(true);

    decided.path = 'narrative';
    const second = render(<HomeLayout />);
    const held = [...second.container.querySelectorAll(HERO_LINKS)];
    second.unmount();
    expect(held.map((link) => link.hasAttribute('inert')), 'a link stayed inert after the hero unmounted').not.toContain(true);
    unmount();
  });

  it('holds nothing where no entrance waits: reduced motion, a delay already passed, or a flat door', () => {
    running = false; // reduced motion: `animation: none`, so the browser reports no animation
    expect(inert(render(<HomeLayout />).container), 'a link is inert with no animation running').not.toContain(true);

    running = true;
    clock = 2500; // hydration after the delay: the link is already fading in
    expect(inert(render(<HomeLayout />).container), 'a link was made inert after its turn had come').not.toContain(true);

    clock = null; // a pending animation has no time yet, and is still before its delay
    expect(inert(render(<HomeLayout />).container).every(Boolean), 'a pending entrance left a link reachable').toBe(true);

    clock = 0;
    decided.path = 'flat';
    expect(inert(render(<HomeLayout />).container), 'a link is inert on the flat door').not.toContain(true);
  });

  it('never serves a link inert: the attribute comes from script alone', () => {
    decided.path = 'undecided';
    expect(renderToStaticMarkup(<HomeLayout />), 'the served markup carries inert').not.toContain('inert');
  });
});

describe('the scrim layer, placed inside the canvas box (Story 2-29)', () => {
  it('renders the scrim as the last child of .home-gem, after the canvas', () => {
    // The placement **is** the guarantee. `ScanlineOverlay` covers the positioned box it is placed
    // in, so the parent has to be the imagery's box and not the container: beside the gem it would
    // cover the panels too, outside it would cover nothing the panels are above. Last child, so it
    // paints over the canvas inside that box.
    const { container } = render(<HomeLayout />);
    const gem = container.querySelector('.home-gem');
    expect(gem, 'the default path renders no gem box').not.toBeNull();

    const scrim = container.querySelector('.scanline-overlay');
    expect(scrim, 'no scrim is rendered on the default path').not.toBeNull();
    expect(scrim?.parentElement, 'the scrim is not inside the gem box, so the panels do not clear it').toBe(gem);
    expect(gem?.lastElementChild, 'the scrim is not the last child, so the canvas paints over it').toBe(scrim);
    expect(scrim, 'the scrim is not hidden from the accessibility tree').toHaveAttribute('aria-hidden', 'true');
  });

  it('renders no scrim on the flat front door, because no imagery moves under the text there', () => {
    // The flat path renders no `.home-gem`, and the layer is its child, so the scrim goes with its
    // parent and the modifier needs no rule of its own. A scrim with nothing moving beneath it is
    // the surface treatment `DESIGN.md:414-416` bars.
    decided.path = 'flat';
    const { container } = render(<HomeLayout />);
    expect(container.querySelector('.scanline-overlay'), 'the flat front door paints a scrim').toBeNull();
  });

  it('serves no scrim in the flat markup either', () => {
    decided.path = 'flat';
    expect(renderToStaticMarkup(<HomeLayout servedPath='flat' />)).not.toContain('scanline-overlay');
  });
});

describe('the canvas box is out of the accessibility tree (A-14)', () => {
  it('marks .home-gem aria-hidden and leaves nothing focusable inside it', () => {
    // A-14's two live clauses, at the wrapper. The element-level half is `Scene.tsx`'s, which sets
    // `aria-hidden` on the `<Canvas>` at `:40` and `aria-hidden` with `tabIndex = -1` on
    // `gl.domElement` at `:49-50` (Story 2-13, DW-46), asserted in `tests/e2e/front-door.pw.ts`;
    // this is the wrapper half, and neither may be dropped. **Corrected 2026-09-21**: this comment
    // named `GemComponent`, which sets neither and only renders the module that renders `Scene`. The
    // withdrawn third clause ("its content is stated in prose") is deliberately not implemented:
    // the Operator withdrew it on 2026-09-13 and DW-97 records the planning lines that still carry
    // it.
    const { container } = render(<HomeLayout />);
    const gem = container.querySelector('.home-gem');
    expect(gem, 'the default path renders no gem box').not.toBeNull();
    expect(gem, 'the gem box is in the accessibility tree').toHaveAttribute('aria-hidden', 'true');
    expect(
      gem?.querySelectorAll('a, button, input, select, textarea, [tabindex], [contenteditable]').length,
      'a focusable element sits inside an aria-hidden subtree'
    ).toBe(0);
  });
});

describe('HomeLayout.scss is token-native (Story 2-29)', () => {
  const HERE = resolve(__dirname, '..');
  const REPO_ROOT = resolve(HERE, '..', '..', '..');

  /**
   * Every contract role the stylesheet consumes.
   *
   * Pinned rather than derived, and read in both directions below: a role dropped from the
   * stylesheet fails, and a name the stylesheet reaches for that is not listed here fails too, so
   * a Story 1-18 alias (Story 2-22 deleted them, and the tree is searched for their names) or a name
   * the contract does not declare cannot arrive unnoticed.
   */
  const ROLES = [
    '--token-bg',
    '--token-text',
    '--token-text-secondary',
    '--token-border',
    '--token-accent-hover',
    '--token-accent-muted',
    '--f-display',
    '--f-body',
    '--t-sm',
    '--t-md',
    '--t-xl',
    '--w-bold',
    '--lh-heading',
    '--lh-body',
    '--lh-label',
    '--tr-heading',
    '--tr-body',
    '--tr-meta',
    '--s-2xs',
    '--s-xs',
    '--s-sm',
    '--s-lg',
    '--s-xl',
    '--s-2xl',
    '--page-pad',
    '--tap',
    '--stroke-hair',
    '--dur-micro',
    '--dur-major',
    '--ease-entrance',
    '--ease-toggle',
    '--z-base',
    '--z-raised',
  ] as const;

  /**
   * The notch polygons, as `epics.md:3304-3305` requires them kept. Three since 2026-09-24: the
   * readout panel's, `polygon(0 0, 100% 0, 100% 100%, 10px 100%, 0 calc(100% - 10px))`, left with
   * the panel (Operator ruling 2026-09-24, DW-110), and the three that remain did not move.
   */
  const POLYGONS = [
    'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)',
    'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)',
    'polygon(10px 0, 100% 0, 100% 100%, 0 100%, 0 10px)',
  ] as const;

  /**
   * The compiled stylesheet, which is what ships and carries no comments, so a role or a literal
   * named in prose is neither counted as a consumer nor missed as one.
   */
  const css = compile(resolve(HERE, 'HomeLayout.scss'), { style: 'compressed' }).css;

  it('names only roles the contract declares, and every one it pins', () => {
    // The contract first, then the source (`ScanlineOverlay.test.tsx:34-41`): a role renamed in the
    // published contract has to fail here naming the stale pin, rather than the pin and the source
    // agreeing on a name the contract no longer declares.
    const tokens = readFileSync(resolve(REPO_ROOT, 'contracts', 'tokens.css'), 'utf8');
    for (const role of ROLES) {
      expect(tokens, `${role} is pinned here but the published contract no longer declares it`).toMatch(
        new RegExp(`^\\s*${role}\\s*:`, 'm')
      );
      expect(css, `${role} is pinned here and the compiled stylesheet no longer reads it`).toContain(`var(${role})`);
    }

    const read = [...new Set([...css.matchAll(/var\((--[\w-]+)\)/g)].map((match) => match[1]))].sort();
    expect(
      read.filter((name) => !(ROLES as readonly string[]).includes(name)),
      'the stylesheet reaches for a name this file does not pin. An alias, or a name the contract does not declare, then ' +
        'reaches the browser through a value that resolves by accident'
    ).toEqual([]);
  });

  it('declares no custom property of its own', () => {
    // `app/__tests__/anchor-contract.test.ts` holds every declared `--name` in the Hub to
    // `app/app.scss`, so a `--home-enter-delay` here would fail there. Read here as well, because
    // that suite names the alias layer and this one names the file.
    expect([...css.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]), 'the stylesheet declares a custom property').toEqual([]);
  });


  /**
   * Every CSS named colour, because a hex literal can leave this file as one.
   *
   * **The hex and `rgb(` guards below are leaky on their own, and this is what closes them.**
   * Dart Sass emits the shortest form: `#ff0000` compiles to `red` and `rgb(140, 90, 210)` compiles
   * to `#8c5ad2`. So the hex guard catches a written `rgb()` and neither catches a colour Sass can
   * shorten to a keyword. Added 2026-09-21 after the Step-04 review found the pair porous.
   *
   * Matched with a lookbehind and a lookahead on the identifier boundary, or `var(--token-text)`
   * would read as the keyword `tan`. `transparent` and `currentcolor` are deliberately absent: they
   * are keywords rather than named colours, Sass never produces them from a literal, and each has
   * honest uses.
   */
  const NAMED_COLOURS = `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue
    blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan
    darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange
    darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise
    darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia
    gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory
    khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow
    lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray
    lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue
    mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred
    midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid
    palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple
    rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue
    slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat
    white whitesmoke yellow yellowgreen`.split(/\s+/);

  it('carries no colour literal, no gradient, no transition: all and no bare z-index integer', () => {
    expect(css, 'a hex colour literal survived the rebuild').not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css, 'an rgba() literal survived the rebuild').not.toContain('rgba(');
    expect(css, 'an rgb() literal survived the rebuild').not.toContain('rgb(');
    expect(
      NAMED_COLOURS.filter((name) => new RegExp(`(?<![\\w-])${name}(?![\\w-])`, 'i').test(css)),
      'a CSS named colour survived the rebuild. Sass emits the shortest form, so a hex literal can ' +
        'leave this file as a keyword and slip past the two guards above'
    ).toEqual([]);
    expect(css, 'a gradient survived the rebuild').not.toContain('gradient(');
    expect(css, 'transition: all is barred (EXPERIENCE.md:689-691)').not.toMatch(/transition:\s*all\b/);
    expect(
      [...css.matchAll(/z-index:([^;}]+)/g)].map((match) => match[1].trim()),
      'a bare z-index integer survived the rebuild, so a level resolves to nothing named (UX-DR44)'
    ).toEqual(['var(--z-raised)', 'var(--z-base)']);
  });

  it('keeps the three notch polygons, and no rule for the readout panel', () => {
    for (const polygon of POLYGONS) {
      // Verbatim: the compiler preserves the spacing inside the function, so this is the authored
      // spelling compared against what ships.
      expect(css, `a notch polygon moved: ${polygon}`).toContain(polygon);
    }
    expect([...css.matchAll(/clip-path:/g)], 'the silhouette gained or lost a panel').toHaveLength(3);
    expect(css, 'a rule for the removed readout panel survived').not.toContain('home-panel--sys');
  });

  /**
   * One at-rule's body, brace-matched out of the compiled sheet.
   *
   * A regex cannot do this: a media block holds rule blocks, so the first `}` closes a rule rather
   * than the query. Written here rather than pulled in, because it is four lines and this is its
   * only reader.
   */
  const blockBody = (source: string, prelude: string): string => {
    const opens = source.indexOf(`${prelude}{`);
    if (opens < 0) throw new Error(`the compiled stylesheet carries no "${prelude}" block`);
    let depth = 0;
    for (let index = opens + prelude.length; index < source.length; index += 1) {
      if (source[index] === '{') depth += 1;
      if (source[index] === '}') {
        depth -= 1;
        if (depth === 0) return source.slice(opens + prelude.length + 1, index);
      }
    }
    throw new Error(`the "${prelude}" block is never closed`);
  };

  /**
   * Every `selector { order: N }` inside one block, in the order the block declares them.
   *
   * **The rule is parsed whole and `order:` is anchored to a declaration start**, since 2026-09-21.
   * The earlier form searched the body for `order:` unanchored, and `border:1px` contains it, so a
   * border shorthand entering the mobile block would have read as a fifth order declaration and
   * failed the case blaming the hero's reading order. Found by the Step-04 review against the real
   * regex.
   */
  const ordersIn = (block: string): [string, string][] =>
    [...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .map(([, selector, body]) => [selector.trim(), /(?:^|;)\s*order:\s*(\d+)/.exec(body)?.[1]] as const)
      .filter((entry): entry is readonly [string, string] => entry[1] !== undefined)
      .map(([selector, order]) => [selector, order]);

  it('stacks the hero in reading order below 768, with no scrim', () => {
    // **The matrix's below-768 row, read where jsdom cannot see it.** The cases above compile the
    // stylesheet and read the rules that apply everywhere; a media query applies to nothing in
    // jsdom, so the mobile block is invisible to a rendered read here and has to be read as text.
    // `tests/e2e/front-door.pw.ts` measures the same three claims on a real 360 viewport, which is
    // what makes this a reading of the rule rather than of the intention.
    const mobile = blockBody(css, '@media(max-width: 767px)');

    // Reading order: name, imagery, navigation, contact (`EXPERIENCE.md:529-530`). The gem is the
    // imagery and takes its place in the column rather than sitting behind it.
    const orders = ordersIn(mobile);
    expect(
      orders.length,
      `the mobile block gives ${orders.length} items an order and the column has four: ${JSON.stringify(orders)}`
    ).toBe(4);
    expect(
      [...orders].sort((one, two) => Number(one[1]) - Number(two[1])).map(([selector]) => selector),
      `the stacked hero is not in reading order below 768: ${JSON.stringify(orders)}`
    ).toEqual(['.home-panel--name', '.home-gem', '.home-panel--nav', '.home-panel--contact']);
    expect(mobile, 'the panels are not taken out of their absolute corners below 768').toContain(
      '.home-panel{position:static;width:100%}'
    );

    // The readout panel's `display: none` left with the panel (Operator ruling 2026-09-24, DW-110);
    // the case above reads that no rule anywhere names it.

    // And the scrim is absent, because the gem is a static item in the column here and no text
    // overlays it. A scrim with no text over it is a treatment on imagery, which `DESIGN.md:414-416`
    // bars, and the layer's own rule is present or absent, never faint.
    expect(mobile, 'the scrim still paints below 768, where no text overlays the imagery').toContain(
      '.home-gem .scanline-overlay{display:none}'
    );
  });

  it('paints the three ornaments from their attribute, and nothing else from one', () => {
    // The compiled half of DW-113: each ornament's string reaches the page through `::before` alone.
    const generated = [...css.matchAll(/([^{}]+)\{content:attr\(data-ornament\)\}/g)].flatMap((match) => match[1].split(','));
    expect(generated.sort()).toEqual(['.home-contact-jp::before', '.home-nav-jp::before', '.home-role__jp::before']);
  });

  it('gates every hover rule on @media (hover: hover)', () => {
    // A tap paints `:hover` on a coarse pointer and leaves it painted until the next tap lands
    // elsewhere (review A-5), so an ungated rule is a colour that sticks on the primary device.
    const outside = css.replace(/@media\(hover: hover\)\{(?:[^{}]*\{[^{}]*\})*\}/g, '');
    expect(outside, 'a :hover rule sits outside @media (hover: hover)').not.toContain(':hover');
    expect(css, 'no hover rule is gated at all, so the read above passed vacuously').toContain('@media(hover: hover)');
  });

  it('animates opacity alone, once, with no loop and no state in it, and hides no link with visibility', () => {
    // `EXPERIENCE.md:685-699`: one orchestrated entrance per page load, no loop inside it, and
    // opacity never expressing state. The keyframe declares only its `from`, so the base state is
    // the final state and a document with no script is already at it (DW-42).
    //
    // **One keyframe again since 2026-09-25** (Operator ruling, DW-125). From 2026-09-24 the five
    // links took a second keyframe whose `from` also held `visibility: hidden` (DW-106), which made a
    // link's first paint its reveal and moved `/`'s largest contentful paint onto the entrance. The
    // links are held out of reach by `inert` from script now (`HomeLayout.tsx`), so no rule in this
    // file declares `visibility` at all.
    expect([...css.matchAll(/@keyframes/g)], 'the stylesheet declares some other number of keyframes').toHaveLength(1);
    expect(css, 'the entrance keyframe was renamed or lost').toContain('@keyframes home-enter{from{opacity:0}}');
    expect(css, 'a rule declares visibility, so a link can again first paint at its reveal').not.toMatch(/visibility:/);
    expect(css, 'an animation repeats').not.toMatch(/animation[^;}]*infinite/);

    // **Every `opacity` the file declares, held to the one the keyframe's `from` carries**, the
    // shape the `z-index` read above uses. This was `not.toMatch(/opacity:0\.\d/)` until
    // 2026-09-21, which could not fail for any value: Dart Sass writes `opacity:.2`, never
    // `opacity:0.2`, so the pattern matched nothing at all. Found by the Step-04 review, which
    // compiled `.a{opacity:0.2}` through this repository's own sass to prove it.
    expect(
      [...css.matchAll(/opacity:([^;}]+)/g)].map((match) => match[1].trim()),
      'the stylesheet declares an opacity other than the entrance keyframe\'s from, so either ' +
        'opacity expresses state again or a second initial state arrived'
    ).toEqual(['0']);

    // Four animated rules since 2026-09-24, when the readout panel's left with the panel (Operator
    // ruling 2026-09-24, DW-110); five until then, which is what the file's header,
    // `sprint-status.yaml` and DW-100 said. `.home-panel--name` carried a sixth until 2026-09-21:
    // the retired timeline never named it, the 2023 stylesheet gave it no initial state, and it
    // painted immediately, so the entrance was hiding the hero's name for 500ms and running
    // `GlitchText`'s own delay inside a parent that was itself ramping. All four on the one keyframe
    // since 2026-09-25 (DW-125): the gem, the role line and the two link groups.
    const animated = (name: string) => [...css.matchAll(new RegExp(`animation:${name} `, 'g'))].length;
    expect(animated('home-enter'), 'the gem, the role line and the two link groups are not the four rules on the keyframe').toBe(4);
    expect(css, 'the links left the entrance keyframe').toMatch(/\.nav-link\{[^}]*animation:home-enter /);
    expect(css, 'the contact links left the entrance keyframe').toMatch(
      /\.home-panel--contact \.contact-container a\{[^}]*animation:home-enter /
    );
    expect(css, 'the name panel took the entrance back').not.toMatch(/\.home-panel--name\{[^}]*animation:/);
  });
});
