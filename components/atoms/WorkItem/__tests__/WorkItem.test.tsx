import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile } from 'sass';
import { render, cleanup, screen, within } from '@testing-library/react';
import { WorkItem } from '../WorkItem';
import { work } from '@/content/work';

/**
 * The accordion entry, at the three points nothing in the repository asserted (Story 2-16).
 *
 * `components/organisms/WorkTimeline/__tests__/WorkTimeline.test.tsx` covers which entry is open
 * and what a click does. It hard-mocks `useReduceMotion` to `false` at `:26` and mocks gsap
 * wholesale, which is exactly why the duration branch has never been exercised: the hook can only
 * answer one thing there and the tween's arguments are never read. And nothing anywhere held a
 * trigger's `aria-controls` against a panel that exists, so a typo in either half of
 * `${entry.id}-content` was invisible to every gate.
 *
 * The third is the collapsed style being **frozen at the first render**. `app/cv/__tests__/page.test.tsx`
 * reads the markup that ships, which is the half a reader notices; what nothing held is that the
 * prop must not move afterwards. Unfreezing it leaves the server output correct and every other case
 * in this file, in that one and in `WorkTimeline.test.tsx` green, while the accordion stops
 * animating on a real page: React clears any style key that leaves the prop, so it would wipe the
 * inline box GSAP owns and each tween would then run from the value it was tweening to.
 *
 * All three are asserted here because `/cv` mounts this component on a second route, which doubles
 * the number of surfaces a defect in any of them would ship on.
 *
 * **The hook is driven rather than pinned.** `reduceMotion` below is a value each case sets before
 * it renders, so both branches are reachable from one file and neither reading is supplied by the
 * assertion that reads it. Every clean result is taken only after the same measurement has been
 * watched producing the other answer.
 */

/** The motion preference the component reads, driven per case rather than fixed at the mock. */
const { reduceMotion } = vi.hoisted(() => ({ reduceMotion: { current: false } }));

vi.mock('@/hooks/useReduceMotion', () => ({ useReduceMotion: () => reduceMotion.current }));

/**
 * gsap, mocked to the four calls this component makes.
 *
 * `to` answers a tween with a `kill`, because the effect's cleanup calls it and a bare `undefined`
 * would throw on every unmount rather than on the case that cares.
 */
const { gsapMock } = vi.hoisted(() => ({
  gsapMock: {
    // The parameters are declared rather than inferred, so `mock.calls` is typed as a pair and the
    // readers below can name the target and the vars instead of indexing an empty tuple.
    to: vi.fn((_target: unknown, _vars: Record<string, unknown>) => ({ kill: vi.fn() })),
    set: vi.fn((_target: unknown, _vars: Record<string, unknown>) => undefined),
    context: vi.fn(),
    registerPlugin: vi.fn(),
  },
}));

vi.mock('gsap', () => ({ gsap: gsapMock, default: gsapMock }));

const noop = () => {};

/** The entry every duration case drives, so a failure names one component rather than four. */
const ENTRY = work[0];

beforeEach(() => {
  reduceMotion.current = false;
  gsapMock.to.mockClear();
  gsapMock.set.mockClear();
});

/**
 * Every `aria-controls` in the document that resolves to no element.
 *
 * A predicate over the rendered tree rather than an inline `expect`, so the planted control below
 * drives **this** computation instead of asserting something adjacent to it. An empty `aria-controls`
 * counts as dangling: the attribute present and pointing nowhere is the same defect as a typo.
 */
const dangling = (): string[] =>
  [...document.querySelectorAll('[aria-controls]')]
    .map((node) => node.getAttribute('aria-controls') ?? '')
    .filter((id) => id === '' || document.getElementById(id) === null);

/**
 * The `style` attribute React left on a node, or `null` where it wrote none.
 *
 * Read off the attribute rather than off `node.style`, because the two answer differently for the
 * case that matters: React clearing every key it owns leaves the attribute present and empty, which
 * `node.style.height` reports as `''` exactly as an absent attribute does.
 */
const styleAttribute = (node: Element | null): string | null => node?.getAttribute('style') ?? null;

/** The panel the entry under test renders, looked up the way `aria-controls` addresses it. */
const panelOf = (id: string): HTMLElement | null => document.getElementById(`${id}-content`);

/** The id the unfrozen counterpart renders under, so the same reader can be pointed at it. */
const UNFROZEN_ID = 'planted-unfrozen-panel';

/**
 * The shape `WorkItem` would have with the freeze removed: the collapsed style follows `isOpen` on
 * every render rather than being decided once.
 *
 * A counterpart rather than a second component to maintain. It exists so the readings below are
 * watched producing the other answer inside this file, on every run, instead of once by whoever
 * wrote them: an assertion that React writes nothing is indistinguishable from a reader that never
 * finds a node.
 */
const Unfrozen = ({ collapsed }: { collapsed: boolean }) => (
  <div id={UNFROZEN_ID} style={collapsed ? { height: 0, overflow: 'hidden' } : undefined} />
);

/**
 * The `duration` of every `gsap.to` call one transition produces, driven end to end.
 *
 * The component skips the animation on its first render (`WorkItem.tsx:87-92`), so a transition is
 * two renders and not one, and the mock is cleared between them. What is returned is read off the
 * tween's own arguments, because `useReduceMotion` never reaches render output
 * (`hooks/useReduceMotion.ts:22-30`) and there is nothing in the markup to assert it against.
 */
const tweenDurations = (from: boolean, to: boolean, reduced: boolean): unknown[] => {
  cleanup();
  reduceMotion.current = reduced;

  const { rerender } = render(<WorkItem entry={ENTRY} isOpen={from} onToggle={noop} />);
  gsapMock.to.mockClear();
  rerender(<WorkItem entry={ENTRY} isOpen={to} onToggle={noop} />);

  return gsapMock.to.mock.calls.map((call) => call[1].duration);
};

describe('every trigger points at a panel that exists', () => {
  it('resolves each aria-controls to an id in the document', () => {
    render(
      <>
        {work.map((entry) => (
          <WorkItem key={entry.id} entry={entry} isOpen={false} onToggle={noop} />
        ))}
      </>
    );

    expect(
      document.querySelectorAll('[aria-controls]').length,
      'no trigger rendered an aria-controls at all, so the check below is over nothing'
    ).toBe(work.length);
    expect(dangling(), 'a trigger names a panel id no element in the document carries').toEqual([]);

    // Every panel id is distinct, which is the other half of `WorkItem.tsx:133,155` being correct.
    // Two entries sharing an id resolve fine and point at each other's panel.
    const ids = [...document.querySelectorAll('[aria-controls]')].map((node) =>
      node.getAttribute('aria-controls')
    );
    expect(new Set(ids).size, 'two entries build the same panel id').toBe(ids.length);
  });

  it('reports a trigger whose panel is missing, so the clean reading above is a measurement', () => {
    // **Planted through the DOM, so no fixture is left in the tree.** Same separation the browser
    // suites draw between a planted control and a committed defect.
    render(<WorkItem entry={ENTRY} isOpen={false} onToggle={noop} />);
    expect(dangling(), 'the entry starts out dangling, so the plant below shows nothing').toEqual([]);

    const trigger = document.querySelector('[aria-controls]');
    trigger?.setAttribute('aria-controls', `${ENTRY.id}-contnet`);

    expect(dangling(), 'the check does not react to a trigger pointing at a panel that is not there').toEqual([
      `${ENTRY.id}-contnet`,
    ]);

    trigger?.setAttribute('aria-controls', '');
    expect(dangling(), 'an empty aria-controls is read as resolving').toEqual(['']);
  });
});

describe('the reduced-motion branch reaches the tween', () => {
  it('opens with duration 0 when the visitor asked for reduced motion', () => {
    const durations = tweenDurations(false, true, true);
    expect(durations, 'opening an entry produced no tween at all').toHaveLength(1);
    expect(durations[0], 'the open tween ignores the motion preference').toBe(0);
  });

  it('opens over a real duration when they did not, which is what makes the reading above one', () => {
    const durations = tweenDurations(false, true, false);
    expect(durations, 'opening an entry produced no tween at all').toHaveLength(1);
    expect(
      durations[0],
      'the open tween is zero-length with reduced motion off, so asserting 0 above says nothing'
    ).not.toBe(0);
    expect(Number(durations[0]), 'the open tween has no positive duration to shorten').toBeGreaterThan(0);
  });

  it('closes with duration 0 when the visitor asked for reduced motion', () => {
    // The close branch is a separate `gsap.to` at `WorkItem.tsx:113-119` with its own default, so a
    // fix applied to one branch and not the other passes every case above.
    const durations = tweenDurations(true, false, true);
    expect(durations, 'closing an entry produced no tween at all').toHaveLength(1);
    expect(durations[0], 'the close tween ignores the motion preference').toBe(0);
  });

  it('closes over a real duration when they did not', () => {
    const durations = tweenDurations(true, false, false);
    expect(durations, 'closing an entry produced no tween at all').toHaveLength(1);
    expect(
      durations[0],
      'the close tween is zero-length with reduced motion off, so asserting 0 above says nothing'
    ).not.toBe(0);
    expect(Number(durations[0]), 'the close tween has no positive duration to shorten').toBeGreaterThan(0);
  });

  it('runs no tween on the first render, so the two readings above are transitions', () => {
    // Without this, a component that tweened on mount would make every `toHaveLength(1)` above
    // true for the wrong reason.
    cleanup();
    reduceMotion.current = true;
    gsapMock.to.mockClear();
    render(<WorkItem entry={ENTRY} isOpen onToggle={noop} />);
    expect(gsapMock.to, 'the entry animates on arrival rather than on a toggle').not.toHaveBeenCalled();
  });
});

describe('the collapsed style is decided once, and GSAP owns the panel box after that', () => {
  it('writes nothing for an entry open on arrival, and still nothing when it closes', () => {
    // The close branch reads `el.offsetHeight` to know what to tween from. React setting
    // `height: 0px` on this render, one commit before the effect runs, makes that read zero and the
    // tween a 0-to-0 no-op. The panel therefore has to carry no React-written style at all.
    cleanup();
    const { rerender } = render(<WorkItem entry={ENTRY} isOpen onToggle={noop} />);

    expect(
      styleAttribute(panelOf(ENTRY.id)),
      'the entry that is open on arrival ships collapsed, which is the flash this story removed'
    ).toBeNull();

    rerender(<WorkItem entry={ENTRY} isOpen={false} onToggle={noop} />);

    expect(
      styleAttribute(panelOf(ENTRY.id)),
      'React wrote the collapsed style when the entry closed, so the close tween measures a panel ' +
        'React has already set to zero and the accordion stops animating'
    ).toBeNull();
  });

  it('keeps the collapsed style it wrote at mount when the entry opens', () => {
    // The other direction, and the other tween. The open branch reads `el.scrollHeight` while the
    // panel is still collapsed. React clearing the style on this render leaves the panel at its
    // natural height, so the tween runs from the height it is tweening to.
    cleanup();
    const { rerender } = render(<WorkItem entry={ENTRY} isOpen={false} onToggle={noop} />);

    const atMount = styleAttribute(panelOf(ENTRY.id));
    expect(atMount, 'a closed entry ships with no collapsed style').toContain('height: 0');

    rerender(<WorkItem entry={ENTRY} isOpen onToggle={noop} />);

    expect(
      styleAttribute(panelOf(ENTRY.id)),
      'React changed the panel style when the entry opened, so the open tween measures a panel that ' +
        'is already at its target height'
    ).toBe(atMount);
  });

  it('and both readings fire against the unfrozen shape, which is what the freeze avoids', () => {
    // **The counterpart, driven through the same reader.** Without it, "React wrote nothing" above
    // is indistinguishable from a lookup that found no node, and the claim that a prop following
    // `isOpen` would clobber GSAP is an argument rather than a measurement.
    cleanup();
    const node = () => document.getElementById(UNFROZEN_ID);

    const opening = render(<Unfrozen collapsed={false} />);
    expect(styleAttribute(node()), 'the unfrozen counterpart started out carrying a style').toBeNull();
    opening.rerender(<Unfrozen collapsed />);
    expect(
      styleAttribute(node()),
      'the unfrozen shape writes nothing on close either, so the first reading above is not about ' +
        'the freeze'
    ).toContain('height: 0');

    cleanup();

    const closing = render(<Unfrozen collapsed />);
    expect(styleAttribute(node()), 'the unfrozen counterpart rendered no collapsed style').toContain('height: 0');

    // A direct write standing in for GSAP's, which is what the next render has to be seen clearing.
    node()?.setAttribute('style', 'height: 123px; overflow: hidden;');
    closing.rerender(<Unfrozen collapsed={false} />);
    expect(
      styleAttribute(node()) ?? '',
      "the unfrozen shape leaves a directly written height alone, so React's diff is not the " +
        'mechanism the freeze exists for'
    ).not.toContain('123px');
  });

  it('leaves GSAP as the only writer of the panel box', () => {
    // The companion claim. "React wrote nothing" is only good news if something else did, and what
    // the two cases above cannot see is whether the panel is being animated at all.
    cleanup();
    const { rerender } = render(<WorkItem entry={ENTRY} isOpen onToggle={noop} />);
    gsapMock.set.mockClear();
    gsapMock.to.mockClear();

    rerender(<WorkItem entry={ENTRY} isOpen={false} onToggle={noop} />);

    const target = panelOf(ENTRY.id);
    expect(target, 'the panel is not in the document, so the calls below were handed something else').not.toBeNull();

    expect(gsapMock.set, 'the close branch set nothing up before tweening').toHaveBeenCalledTimes(1);
    expect(gsapMock.set.mock.calls[0][0], 'GSAP was handed something other than the panel').toBe(target);
    expect(gsapMock.set.mock.calls[0][1], 'the close branch did not clip the panel before tweening it').toMatchObject(
      { overflow: 'hidden' }
    );

    expect(gsapMock.to, 'the close branch ran no tween').toHaveBeenCalledTimes(1);
    expect(gsapMock.to.mock.calls[0][0], 'the tween was handed something other than the panel').toBe(target);
    expect(gsapMock.to.mock.calls[0][1], 'the close tween does not collapse the panel').toMatchObject({ height: 0 });

    // And React wrote nothing over it, so on a real page every byte of that box came from the two
    // calls above rather than from a render that happened to agree with them.
    expect(styleAttribute(target), 'React wrote the box GSAP was handed').toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Story 2-31: the row rebuilt token-native.
// ---------------------------------------------------------------------------

const HERE = resolve(__dirname, '..');
const REPO_ROOT = resolve(HERE, '..', '..', '..');

/** The published contract, read as text: the durations below are its values, never restated. */
const TOKENS = readFileSync(resolve(REPO_ROOT, 'contracts', 'tokens.css'), 'utf8');

/**
 * A duration token's value in seconds, as GSAP takes it.
 *
 * The first declaration is the `:root` one; the reduced-motion block redeclares every duration at
 * 1ms further down the file, and that value is the contract's reach into CSS, not into a tween.
 */
const durationOf = (name: string): number => {
  const found = new RegExp(`${name}\\s*:\\s*([\\d.]+)ms`).exec(TOKENS);
  if (!found) throw new Error(`the contract declares no ${name} in milliseconds`);
  return Number(found[1]) / 1000;
};

/** The vars of every `gsap.to` one transition produces, driven the way `tweenDurations` drives it. */
const tweenVars = (from: boolean, to: boolean): Record<string, unknown>[] => {
  cleanup();
  reduceMotion.current = false;
  const { rerender } = render(<WorkItem entry={ENTRY} isOpen={from} onToggle={noop} />);
  gsapMock.to.mockClear();
  rerender(<WorkItem entry={ENTRY} isOpen={to} onToggle={noop} />);
  return gsapMock.to.mock.calls.map((call) => call[1]);
};

/** The real GSAP's ease parser, since the module is mocked for the component above. */
const parseEase = async (ease: string): Promise<(progress: number) => number> => {
  const actual = await vi.importActual<typeof import('gsap')>('gsap');
  const parsed = actual.gsap.parseEase(ease);
  if (typeof parsed !== 'function') throw new Error(`GSAP does not know the ease "${ease}"`);
  return parsed;
};

describe("the disclosure runs the contract's durations, on an ease-out both ways", () => {
  it('opens over the major duration and closes over the exit duration', () => {
    // `review-apple-design-2026-09-15.md` A-4: the close ran 0.3s and the open 0.4s, neither of
    // them a contract value. Both are the contract's now, read off the published file so a retuned
    // token fails here rather than leaving the component on the old figure.
    const [open] = tweenVars(false, true);
    const [close] = tweenVars(true, false);
    expect(open?.duration, 'the open tween does not run the major duration').toBe(durationOf('--dur-major'));
    expect(close?.duration, 'the close tween does not run the exit duration').toBe(durationOf('--dur-exit'));
    // The two differ, so a component that used one figure for both fails one of the reads above.
    expect(durationOf('--dur-major')).not.toBe(durationOf('--dur-exit'));
  });

  it('eases out on both tweens, so movement starts at speed the moment the click lands', async () => {
    // Measured on the curve rather than read off its name: an ease-out has covered more than a
    // quarter of the distance a quarter of the way in, and an ease-in less. The contract's exit
    // easing is an ease-in (DW-103), which is why the component states its own.
    const [open] = tweenVars(false, true);
    const [close] = tweenVars(true, false);
    for (const [which, vars] of [
      ['open', open],
      ['close', close],
    ] as const) {
      const ease = await parseEase(String(vars?.ease));
      expect(ease(0.25), `the ${which} tween is not front-loaded, so it holds movement back after the click`).toBeGreaterThan(0.25);
      expect(ease(0.5), `the ${which} tween is not an ease-out at the midpoint`).toBeGreaterThan(0.5);
    }
  });

  it('and the curve read separates an ease-out from the ease-in the close used to run', async () => {
    const shipped = await parseEase('power2.in');
    expect(shipped(0.25), 'the read cannot tell an ease-in from an ease-out').toBeLessThan(0.25);
  });
});

describe('the panel is a region named by its company, and both lists are lists', () => {
  it('exposes each panel as a region whose name is its company', () => {
    render(
      <>
        {work.map((entry, index) => (
          <WorkItem key={entry.id} entry={entry} isOpen={index === 0} onToggle={noop} />
        ))}
      </>
    );
    for (const entry of work) {
      const region = screen.getByRole('region', { name: entry.company });
      expect(region.id, `the ${entry.company} region is not the panel its trigger controls`).toBe(`${entry.id}-content`);
    }
    expect(screen.getAllByRole('region'), 'a region exists with no company to name it').toHaveLength(work.length);
  });

  it('marks both lists as lists, with the items carrying their text and no marker', () => {
    // `list-style: none` drops the list role in WebKit, so it is stated. The `//` is generated
    // content in the stylesheet, so an item's text is the highlight alone and nothing is read twice.
    const { container } = render(<WorkItem entry={ENTRY} isOpen onToggle={noop} />);
    const region = screen.getByRole('region', { name: ENTRY.company });
    const lists = within(region).getAllByRole('list');
    expect(lists, 'the panel does not expose two lists').toHaveLength(2);
    const items = within(lists[0]).getAllByRole('listitem').map((item) => item.textContent);
    expect(items, "the highlights list does not carry the entry's highlights").toEqual(ENTRY.highlights);
    expect(container.textContent, 'a // marker is in the document text, so it is read aloud').not.toContain('//');
  });

  it('keeps the chips out of the tab order and out of the controls', () => {
    const { container } = render(<WorkItem entry={ENTRY} isOpen onToggle={noop} />);
    const chips = container.querySelector('.work-item__tech');
    expect(chips?.querySelectorAll('li'), 'the chips did not render').toHaveLength(ENTRY.tech.length);
    expect(chips?.querySelectorAll('a, button, input, select, textarea, summary, [tabindex]')).toHaveLength(0);
    expect(container.querySelectorAll('button'), 'a control other than the trigger arrived in the row').toHaveLength(1);
  });
});

describe('the stylesheet names contract roles and nothing else', () => {
  /** Every role `WorkItem.scss` reads, pinned against the contract before it is read in the source. */
  const ROLES = [
    '--dur-micro',
    '--ease-toggle',
    '--f-display',
    '--f-mono',
    '--lh-body',
    '--lh-heading',
    '--lh-label',
    '--measure',
    '--r-none',
    '--s-2xs',
    '--s-md',
    '--s-sm',
    '--s-xs',
    '--stroke-emphasis',
    '--stroke-hair',
    '--t-2xs',
    '--t-3xs',
    '--t-base',
    '--t-sm',
    '--tap',
    '--token-accent',
    '--token-accent-hover',
    '--token-border',
    '--token-border-interactive',
    '--token-text',
    '--token-text-secondary',
    '--tr-meta',
    '--tr-name',
    '--w-bold',
  ] as const;

  /** The compiled stylesheet, which is what ships and carries no comments. */
  const css = compile(resolve(HERE, 'WorkItem.scss'), { style: 'compressed' }).css;

  /** Every declaration in a compiled sheet, as `[property, value]`. */
  const declarations = (source: string): [string, string][] =>
    [...source.matchAll(/(?<=[{;])([a-z-]+):([^;}]+)/g)].map((match) => [match[1], match[2].trim()]);

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

  it('writes no colour, no length, no shadow, no gradient, no opacity and no custom property of its own', () => {
    expect(css, 'a hex colour survived the rebuild').not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css, 'a colour function survived the rebuild, the alpha hover ground and chip border among them').not.toMatch(
      /\b(rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\(/
    );
    expect(css, 'a gradient').not.toContain('gradient(');
    expect(css, 'a shadow').not.toMatch(/shadow:/);
    expect(css, 'opacity is barred from expressing state (AD-19)').not.toMatch(/opacity:/);
    expect(css, 'a length literal survived the rebuild').not.toMatch(/(?<![\w-])\d*\.?\d+(px|rem|em|vh|vw|ch)\b/);
    expect([...css.matchAll(/(?<=[{;])(--[\w-]+):/g)].map((match) => match[1]), 'a declared custom property').toEqual([]);
    expect(colourLeftovers(css), 'a colour, background or border value carries something other than a role').toEqual([]);
    expect(
      [...css.matchAll(/(\d+(?:\.\d+)?%)/g)].map((match) => match[1]),
      "a percentage other than the trigger's full width and the display face at wdth 85"
    ).toEqual(['100%', '85%']);
    expect(css).toContain('inline-size:100%');
    expect(css).toContain('font-stretch:85%');
  });

  it('and those guards fire on the literals the 2023 sheet carried', () => {
    // The shapes the old file shipped, planted into the compiled sheet, so each guard above is seen
    // refusing the thing it exists to refuse rather than passing over a sheet that has none.
    const planted = css.replace(
      '.work-item__header{',
      '.work-item__header{background:rgba(91,33,182,.06);letter-spacing:.1em;border:1px solid red;'
    );
    expect(planted, 'the planted rule did not land').not.toBe(css);
    expect(planted).toMatch(/\b(rgba?)\(/);
    expect(planted).toMatch(/(?<![\w-])\d*\.?\d+(px|rem|em|vh|vw|ch)\b/);
    expect(colourLeftovers(planted).join('\n'), 'the colour strip lets a named colour through').toMatch(/red/);
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

  it('recolours the leading rule on hover and nothing else, and carries no pressed state', () => {
    const gated = css.slice(css.indexOf('@media(hover: hover)'));
    expect(gated, 'the hover block recolours something other than the rule').toMatch(
      /^@media\(hover: hover\)\{\.work-item:has\(>\.work-item__header:hover\)::before,\.work-item:has\(>\.work-item__header:hover\)::after\{border-inline-start-color:var\(--token-accent-hover\)\}\}/
    );
    expect(css, 'a pressed state, which the system does not have (RESTYLE-SPEC § 1)').not.toMatch(/:active\b/);
  });

  it('transitions border colour alone, never all, never height', () => {
    const transitions = declarations(css).filter(([property]) => property.startsWith('transition'));
    expect(transitions.map(([, value]) => value)).toEqual(['border-color var(--dur-micro) var(--ease-toggle)']);
    expect(css, 'the stylesheet animates something').not.toMatch(/@keyframes|animation:/);
  });

  it('spends the accent on the open rule alone, drawn as a border and switched by transform', () => {
    expect([...css.matchAll(/var\(--token-accent\)/g)], 'the accent appears somewhere other than the open rule').toHaveLength(1);
    expect(css).toMatch(
      /\.work-item::after\{border-inline-start:var\(--stroke-emphasis\) solid var\(--token-accent\);transform:scaleX\(0\)\}/
    );
    expect(css).toMatch(/\.work-item\[data-open=["']?true["']?\]::after\{transform:none\}/);
    expect(css).toMatch(/\.work-item::before\{border-inline-start:var\(--stroke-hair\) solid var\(--token-border\)\}/);
    expect(
      declarations(css)
        .filter(([property]) => property.startsWith('background'))
        .map(([property, value]) => `${property}:${value}`),
      'a ground is painted somewhere, and the only background this row may set is none'
    ).toEqual(['background:none']);
  });

  it('marks each highlight with a generated // that carries no text of its own', () => {
    expect(css).toMatch(/\.work-item__highlights li::before\{content:"\/\/";content:"\/\/"\/"";/);
    expect(css, 'the marker is not the secondary role').toMatch(
      /\.work-item__highlights li::before\{[^}]*color:var\(--token-text-secondary\)/
    );
  });

  it('gives the trigger the page type, the description the body leading and the highlights the secondary role', () => {
    // F-3, F-9 and F-5 in `ops/hub-accessibility-pass.md`, at source; the browser read of each is in
    // `tests/e2e/plate-mark-and-work-item.pw.ts`.
    expect(css, 'the trigger does not inherit the page type, so its text falls back to the button face').toMatch(
      /\.work-item__header\{[^}]*font:inherit/
    );
    expect(css, 'the description is not at the body leading').toMatch(/\.work-item__description\{[^}]*line-height:var\(--lh-body\)/);
    expect(css, 'the highlights are not the secondary role').toMatch(
      /\.work-item__highlights li\{[^}]*color:var\(--token-text-secondary\)/
    );
  });

  it('asks no family for a weight it does not publish (F-4)', () => {
    expect(
      declarations(css)
        .filter(([property]) => property === 'font-weight')
        .map(([, value]) => value),
      "a weight other than the row name's"
    ).toEqual(['var(--w-bold)']);
    expect(css).toMatch(/\.work-item__company\{[^}]*font-family:var\(--f-display\)[^}]*font-weight:var\(--w-bold\)/);
  });

  it('opens every panel when scripting is off, with the two declarations the print sheet opens them with (DW-76)', () => {
    // Operator ruling 2026-09-24. No handler runs without script, so a panel the first render closed
    // would keep its inline zero height and three companies of four would be missing. `!important`
    // is what outranks that inline style; the browser half is `tests/e2e/cv.pw.ts`.
    const opened = '.work-item__content{height:auto !important;overflow:visible !important}';
    expect(css, 'no rule opens the panels when scripting is off').toContain(`@media(scripting: none){${opened}}`);
    const print = compile(resolve(REPO_ROOT, 'app', 'scss', '_print.scss'), { style: 'compressed' }).css;
    expect(print, 'the print sheet no longer opens the panels with these two declarations').toContain(opened);
    // Scoped to that medium alone: nowhere else does this sheet touch the panel the tween owns.
    expect(css.replace(`@media(scripting: none){${opened}}`, ''), 'a rule on the panel outside the scripting block').not.toContain(
      '.work-item__content'
    );
  });
});
