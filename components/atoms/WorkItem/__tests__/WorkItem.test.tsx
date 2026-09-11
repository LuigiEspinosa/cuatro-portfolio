import { render, cleanup } from '@testing-library/react';
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
 * The component skips the animation on its first render (`WorkItem.tsx:58-64`), so a transition is
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

    // Every panel id is distinct, which is the other half of `WorkItem.tsx:100,117` being correct.
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
    // The close branch is a separate `gsap.to` at `WorkItem.tsx:82-86` with its own default, so a
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
