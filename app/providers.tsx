'use client';

import { ReactNode, useEffect } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register at module level so the plugin is available before any component.
// Components hydrate before effects run and would miss the plugin on first render.
gsap.registerPlugin(ScrollTrigger);

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis();

    // Without this, ScrollTrigger uses raw scroll events
    // that lag begind Lenis' inertia.
    lenis.on('scroll', ScrollTrigger.update);

    const lenisRaf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(lenisRaf);

    // Prevent GSAP from adding artificial lag compensation
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(lenisRaf);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
