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

export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(REDUCE_MOTION_QUERY).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(REDUCE_MOTION_QUERY);
    setReduceMotion(mq.matches);

    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener('change', handler);

    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduceMotion;
}
