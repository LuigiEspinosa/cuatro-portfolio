import { createElement } from 'react';
import { render, renderHook } from '@testing-library/react';
import { useReduceMotion } from '../useReduceMotion';

/**
 * `useReduceMotion` (Stories 1-x and 2-12).
 *
 * Renamed from `useReducedMotion.test.ts` in Story 2-12 so the file is named for the hook it
 * covers, which is what made the defect below easy to miss: the file, the hook and the query string
 * all differed by a letter or a bracket.
 *
 * **The media query string is the payload here.** Until Story 2-12 the initial read passed
 * `'prefers-reduced-motion: reduce'` without parentheses, which is not a valid media query, so the
 * first commit answered `false` for a visitor who had asked for reduced motion and the homepage's
 * entrance started before the effect corrected it. Every case below that used a mock answering the
 * same `matches` for any query was green throughout, which is why the mock here discriminates on
 * the query instead.
 */

/** The one valid form. A test that accepted either would not have caught the defect. */
const VALID_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * A `matchMedia` that answers `matches` only for a query the browser would actually parse.
 *
 * A real `matchMedia` given `'prefers-reduced-motion: reduce'` returns a list whose `matches` is
 * `false` forever, because the string is not a media query. This reproduces that rather than
 * answering the same value to every caller.
 */
const mockMatchMedia = (matches: boolean, matching: string = VALID_QUERY) => {
  const impl = vi.fn().mockImplementation((query: string) => ({
    matches: query === matching ? matches : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  Object.defineProperty(window, 'matchMedia', { writable: true, value: impl });
  return impl;
};

describe('useReduceMotion', () => {
  it('returns false when prefers-reduced-motion does not match', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useReduceMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when prefers-reduced-motion: reduce matches', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useReduceMotion());
    expect(result.current).toBe(true);
  });

  it('asks matchMedia for the parenthesised query and never for the bare one', () => {
    // The regression. `'prefers-reduced-motion: reduce'` is not a media query, and `matchMedia`
    // answers an unparseable string with a list that never matches rather than by throwing, so the
    // only visible symptom was a burst of entrance no assertion looked at.
    const impl = mockMatchMedia(true);
    renderHook(() => useReduceMotion());

    const asked = impl.mock.calls.map(([query]) => query as string);
    expect(asked.length, 'the hook never called matchMedia, so this case measures nothing').toBeGreaterThan(0);
    expect(asked.every((query) => query === VALID_QUERY), `matchMedia was asked ${JSON.stringify(asked)}`).toBe(true);
  });

  it('answers true on the very first render, before any effect has run', () => {
    // `result.current` is read after effects, so the two cases above pass whether the initial read
    // is right or not: the effect at `:19` corrects it either way. What the visitor sees is the
    // first commit, so that is what this reads. Rendering a component and recording the value on
    // every render is the only way to see it from here.
    mockMatchMedia(true);

    const seen: boolean[] = [];
    const Probe = () => {
      const value = useReduceMotion();
      seen.push(value);
      return null;
    };

    // `createElement` rather than JSX, so this file stays a `.ts` named for the `.ts` hook it
    // covers. The mismatch between the two names is what let the defect above sit unread.
    render(createElement(Probe));

    expect(seen.length, 'the probe never rendered').toBeGreaterThan(0);
    expect(
      seen[0],
      'the first render answered false for a visitor asking for reduced motion, which is the ' +
        'unparenthesised-query defect: the entrance starts and the effect then corrects it'
    ).toBe(true);
  });

  it('Subscribes to matchMedia changes on mount', () => {
    // `vi.fn()`, not `vi.fn`. The two cases below carried the factory itself forward from the file
    // this one replaces, so the hook was calling `addEventListener` on a mock-maker rather than on
    // a mock and the counterpart assertion passed only because the other spy was real.
    const addEventListener = vi.fn();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        media: '',
        addEventListener,
        removeEventListener: vi.fn(),
      }),
    });
    renderHook(() => useReduceMotion());
    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('removes the change listener on unmount', () => {
    const removeEventListener = vi.fn();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        media: '',
        addEventListener: vi.fn(),
        removeEventListener,
      }),
    });
    const { unmount } = renderHook(() => useReduceMotion());
    unmount();
    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('answers false rather than throwing where matchMedia does not exist', () => {
    // A bare jsdom and some embedded webviews have no `matchMedia`. The call sits in a `useState`
    // initializer, so a throw there is a component that never mounts rather than a caught render
    // error, and this hook is on every route through four consumers.
    Object.defineProperty(window, 'matchMedia', { writable: true, value: undefined });
    const { result } = renderHook(() => useReduceMotion());
    expect(result.current).toBe(false);
  });
});
