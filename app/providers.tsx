'use client';

import { ReactNode, useEffect } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useReduceMotion } from '@/hooks/useReduceMotion';

// Register at module level so the plugin is available before any component.
// Components hydrate before effects run and would miss the plugin on first render.
gsap.registerPlugin(ScrollTrigger);

export function Providers({ children }: { children: ReactNode }) {
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    // Prevent GSAP from adding artificial lag compensation
    gsap.ticker.lagSmoothing(0);

    // Smooth scroll is a vestibular trigger on its own (review-accessibility.md A-17,
    // review-apple-design-2026-09-15.md A-1). ScrollTrigger works on native scroll without Lenis,
    // so a reduced-motion visitor gets the browser's scroll everywhere; this gates Lenis and nothing
    // else, which is why `lagSmoothing` sits above it. Unlike `hooks/useNarrativePath.ts:157-168`,
    // which decides once because the narrative is layout a flat hero must not grow back into, the
    // scroll mechanism follows a live flip: Lenis has no layout to undo.
    if (reduceMotion) return;

    const lenis = new Lenis();

    // Without this, ScrollTrigger uses raw scroll events
    // that lag behind Lenis' inertia.
    lenis.on('scroll', ScrollTrigger.update);

    const lenisRaf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(lenisRaf);

    // The dependency array is the teardown: a flip to reduce reruns the effect, so React runs
    // this cleanup on the running instance and the early return above then constructs nothing.
    return () => {
      gsap.ticker.remove(lenisRaf);
      lenis.destroy();
    };
  }, [reduceMotion]);

  return <>{children}</>;
}
