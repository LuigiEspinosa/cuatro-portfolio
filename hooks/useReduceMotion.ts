import { useEffect, useState } from 'react';

/**
 * The media query, written once so the initial read and the subscription cannot disagree.
 *
 * They did until Story 2-12: the initial read passed `'prefers-reduced-motion: reduce'` with no
 * parentheses, which is not a valid media query, so `matchMedia` answered a list that never
 * matches. A visitor who asks for reduced motion was therefore told `false` on the first commit and
 * saw the entrance start before the effect below corrected it.
 */
const REDUCE_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Whether this environment can answer the question at all.
 *
 * `matchMedia` is absent in a bare jsdom and in some embedded webviews. Calling it there throws
 * inside a `useState` initializer, which is not a caught render error but a component that never
 * mounts, and this hook has four consumers across every route.
 */
const canAsk = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

/**
 * **Repairing the initial read does not create a hydration mismatch, checked rather than assumed.**
 * The server always renders `false` and, for a reduced-motion visitor, the client's first render
 * now returns `true`, which React would report if either value reached the markup. It does not:
 * verified 2026-09-07 across all four consumers (`HomeLayout.tsx:14`, `GlitchText.tsx:24`,
 * `WorkHero.tsx:23`, `WorkItem.tsx:18`), each of which reads the value only inside a
 * `useGsapContext` or `useEffect` callback and its dependency array. Nothing branches on it in
 * render output. A consumer that starts to must guard its own first paint.
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(
    () => canAsk() && window.matchMedia(REDUCE_MOTION_QUERY).matches
  );

  useEffect(() => {
    if (!canAsk()) return;

    const mq = window.matchMedia(REDUCE_MOTION_QUERY);
    setReduceMotion(mq.matches);

    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener('change', handler);

    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduceMotion;
}
