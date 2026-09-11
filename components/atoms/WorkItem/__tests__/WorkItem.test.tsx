import { render, cleanup } from '@testing-library/react';
import { WorkItem } from '../WorkItem';
import { work } from '@/content/work';

/**
 * The accordion entry, at the two points nothing in the repository asserted (Story 2-16).
 *
 * `components/organisms/WorkTimeline/__tests__/WorkTimeline.test.tsx` covers which entry is open
 * and what a click does. It hard-mocks `useReduceMotion` to `false` at `:26` and mocks gsap
 * wholesale, which is exactly why the duration branch has never been exercised: the hook can only
 * answer one thing there and the tween's arguments are never read. And nothing anywhere held a
 * trigger's `aria-controls` against a panel that exists, so a typo in either half of
 * `${entry.id}-content` was invisible to every gate.
 *
 * Both are asserted here because `/cv` mounts this component on a second route (Story 2-16), which
 * doubles the number of surfaces a defect in either would ship on.
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
    // reader below can name `vars.duration` instead of casting an empty tuple.
    to: vi.fn((_target: unknown, _vars: { duration?: unknown }) => ({ kill: vi.fn() })),
    set: vi.fn(),
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
