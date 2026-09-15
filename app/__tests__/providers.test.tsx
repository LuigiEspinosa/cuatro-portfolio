import { act, render } from '@testing-library/react';
import { Providers } from '../providers';

/**
 * Lenis scoped to the motion preference (A-17).
 *
 * `app/providers.tsx` constructed `new Lenis()` for every visitor and read no preference, so a
 * visitor who asked for reduced motion still got rAF-driven inertial wheel scrolling on every route
 * while the front door steered them onto the flat path. `Providers` now reads `useReduceMotion()`
 * and constructs Lenis only when it answers `false`, with the preference in the effect's dependency
 * array so React's own cleanup is the teardown on a flip.
 *
 * The hook is real and driven through `matchMedia`, as `hooks/__tests__/useReduceMotion.test.ts`
 * drives it: the `change` handler the hook subscribes is captured from the `addEventListener` spy
 * and fired inside `act()` to flip the preference mid-life. Lenis and gsap are mocked to the calls
 * the component makes, in the `vi.hoisted` shape `WorkItem.test.tsx` set.
 */

const { LenisMock, instances, gsapMock, scrollTriggerMock } = vi.hoisted(() => {
  /** Every instance the constructor spy handed out, so a case can tell the old one from the new. */
  const instances: { on: ReturnType<typeof vi.fn>; raf: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> }[] = [];
  // A `function`, not an arrow: the component calls it with `new`, which Vitest 4 refuses on an
  // arrow implementation.
  const LenisMock = vi.fn(function () {
    const instance = { on: vi.fn(), raf: vi.fn(), destroy: vi.fn() };
    instances.push(instance);
    return instance;
  });
  const gsapMock = {
    registerPlugin: vi.fn(),
    ticker: { add: vi.fn(), remove: vi.fn(), lagSmoothing: vi.fn() },
  };
  const scrollTriggerMock = { update: vi.fn() };
  return { LenisMock, instances, gsapMock, scrollTriggerMock };
});

vi.mock('lenis', () => ({ default: LenisMock }));
vi.mock('gsap', () => ({ gsap: gsapMock, default: gsapMock }));
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: scrollTriggerMock }));

/**
 * A `matchMedia` answering `matches` and sharing one `addEventListener` spy across calls, so the
 * `change` handler the hook subscribes in its effect can be found and fired.
 */
const mockMatchMedia = (matches: boolean) => {
  const addEventListener = vi.fn();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn(() => ({ matches, addEventListener, removeEventListener: vi.fn() })),
  });

  const flip = (next: boolean) => {
    const handler = addEventListener.mock.calls[0]?.[1] as ((e: MediaQueryListEvent) => void) | undefined;
    expect(handler, 'the hook never subscribed to change, so there is nothing to flip').toBeTypeOf('function');
    act(() => handler!({ matches: next } as MediaQueryListEvent));
  };

  return { flip };
};

beforeEach(() => {
  instances.length = 0;
  vi.clearAllMocks();
});

// The cases that redefine `window.matchMedia`, or delete it, would otherwise leak into whichever
// case runs next under `--sequence.shuffle.tests`. This restores a stub answering `false`, which is
// what `vitest.setup.ts:9-17` answers, not its exact shape.
afterEach(() => mockMatchMedia(false));

describe('Providers', () => {
  it('constructs Lenis once and wires it to ScrollTrigger and the gsap ticker for a visitor with no preference', () => {
    // The suite-wide stub in `vitest.setup.ts` answers `false`, which is the existing behaviour.
    render(<Providers>child</Providers>);

    expect(LenisMock).toHaveBeenCalledTimes(1);
    expect(instances[0].on).toHaveBeenCalledWith('scroll', scrollTriggerMock.update);
    expect(gsapMock.ticker.add).toHaveBeenCalledTimes(1);
    expect(gsapMock.ticker.lagSmoothing).toHaveBeenCalledWith(0);
  });

  it('never constructs Lenis and adds nothing to the ticker when reduce matches on mount, but still sets lagSmoothing', () => {
    mockMatchMedia(true);
    const { unmount } = render(<Providers>child</Providers>);
    unmount();

    expect(LenisMock).not.toHaveBeenCalled();
    expect(gsapMock.ticker.add).not.toHaveBeenCalled();
    // The guard gates Lenis and nothing else: the ticker setting is for every visitor, as before.
    expect(gsapMock.ticker.lagSmoothing).toHaveBeenCalledWith(0);
  });

  it('renders the same markup whichever way the preference answers, so there is no hydration branch', () => {
    // `useReduceMotion.ts:26-34` records that no consumer lets the value reach the markup. This is
    // what holds `Providers` to that: the value is read in the effect and its dependency array only.
    mockMatchMedia(false);
    const noPreference = render(<Providers>child</Providers>);
    const markupWithLenis = noPreference.container.innerHTML;
    noPreference.unmount();

    mockMatchMedia(true);
    const reduce = render(<Providers>child</Providers>);

    expect(markupWithLenis, 'the component rendered nothing, so the two markups are trivially equal').not.toBe('');
    expect(reduce.container.innerHTML).toBe(markupWithLenis);
  });

  it('removes the ticker callback it added, then destroys the instance, when the preference flips to reduce', () => {
    const { flip } = mockMatchMedia(false);
    render(<Providers>child</Providers>);
    expect(LenisMock).toHaveBeenCalledTimes(1);

    flip(true);

    expect(gsapMock.ticker.add, 'nothing was added to the ticker, so there is nothing to remove').toHaveBeenCalledTimes(1);
    const added = gsapMock.ticker.add.mock.calls[0][0];
    expect(gsapMock.ticker.remove).toHaveBeenCalledTimes(1);
    expect(gsapMock.ticker.remove, 'the ticker was asked to remove a different function from the one added').toHaveBeenCalledWith(added);
    expect(instances[0].destroy).toHaveBeenCalledTimes(1);
    expect(
      gsapMock.ticker.remove.mock.invocationCallOrder[0],
      'destroy ran before the ticker stopped calling raf on it'
    ).toBeLessThan(instances[0].destroy.mock.invocationCallOrder[0]);
    expect(LenisMock, 'a second instance was constructed on the flip to reduce').toHaveBeenCalledTimes(1);
  });

  it('constructs a new instance rather than reusing the destroyed one when the preference flips back', () => {
    const { flip } = mockMatchMedia(false);
    render(<Providers>child</Providers>);

    flip(true);
    flip(false);

    expect(LenisMock).toHaveBeenCalledTimes(2);
    expect(instances[0].destroy).toHaveBeenCalledTimes(1);
    expect(instances[1].destroy).not.toHaveBeenCalled();
    expect(gsapMock.ticker.add).toHaveBeenCalledTimes(2);
  });

  it('constructs Lenis as before and throws nothing where matchMedia does not exist', () => {
    Object.defineProperty(window, 'matchMedia', { writable: true, value: undefined });

    expect(() => render(<Providers>child</Providers>)).not.toThrow();
    expect(LenisMock).toHaveBeenCalledTimes(1);
  });

  it('removes the ticker callback and destroys the instance on unmount', () => {
    const { unmount } = render(<Providers>child</Providers>);
    expect(gsapMock.ticker.add, 'nothing was added to the ticker, so there is nothing to remove').toHaveBeenCalledTimes(1);
    const added = gsapMock.ticker.add.mock.calls[0][0];

    unmount();

    expect(gsapMock.ticker.remove).toHaveBeenCalledWith(added);
    expect(instances[0].destroy).toHaveBeenCalledTimes(1);
  });
});
