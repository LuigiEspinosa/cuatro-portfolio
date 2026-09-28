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
 * mounts, and this hook has four consumers across `/`, `/work` and `/cv`: `HomeLayout.tsx`,
 * `WorkHero.tsx`, `WorkItem.tsx` and `hooks/useNarrativePath.ts` (calling since 2026-09-07 and never
 * counted here until A-17). `GlitchText` was one more until 2026-09-14, when Story 2-27 rebuilt it
 * with no script in it, and `app/providers.tsx` was one on every route from 2026-09-15 (A-17) until
 * 2026-09-24, when DW-36 deleted it with Lenis.
 */
const canAsk = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

/**
 * **Repairing the initial read does not create a hydration mismatch, checked rather than assumed.**
 * The server always renders `false` and, for a reduced-motion visitor, the client's first render
 * now returns `true`, which React would report if either value reached the markup. It does not:
 * verified 2026-09-07 across all four consumers of the day (`HomeLayout.tsx:27`, `WorkHero.tsx:22`,
 * `WorkItem.tsx:18`, and `GlitchText.tsx`, which stopped calling this hook on 2026-09-14 when Story
 * 2-27 moved its entrance into CSS), each of which reads the value only inside a `useGsapContext`
 * or `useEffect` callback and its dependency array. `hooks/useNarrativePath.ts:175` was a consumer
 * that day too, uncounted, and reads it in its effect and dependency array only, so the claim holds
 * for it. `app/providers.tsx`, a consumer from 2026-09-15 (A-17) until DW-36 deleted it on
 * 2026-09-24, read it the same way. Nothing branches on it in render output. A consumer that starts
 * to must guard its own first paint.
 *
 * **`WorkHero.tsx` is the one that does, since 2026-09-23 (Story 2-33), and it guards its first
 * paint as this paragraph asks.** It reads the value only in an effect and its dependency array, as
 * the others do, and copies it into its own state there: that state is `false` on the server and on
 * the first client render, so the torus it gates is absent from both and hydration compares equal,
 * and the render branch moves only once the effect has run. It runs no GSAP since 2026-09-24: its
 * entrance is the stylesheet's and the torus's scroll binding is `TorusCanvas`'s (DW-36).
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
