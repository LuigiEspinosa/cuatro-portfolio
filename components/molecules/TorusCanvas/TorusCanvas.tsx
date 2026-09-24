'use client';

import { type RefObject, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGsapContext } from '@/hooks/useGsapContext';
import { Scene } from '@/components/atoms/Scene/Scene';
import { Torus } from '@/components/atoms/Torus/Torus';
import { CanvasOrbitControls } from '@/components/atoms/CanvasOrbitControls/CanvasOrbitControls';

// Registered here, the one module in the Hub that uses it, so the plugin loads with the torus and
// never without it (DW-36, Operator ruling 2026-09-24). Until then `app/providers.tsx` registered it
// on every route and `WorkHero` did again on `/work`, which put it on a document at first paint for
// the visitor who never gets the torus.
gsap.registerPlugin(ScrollTrigger);

/**
 * Everything on the WebGL side of `/work`'s one dynamic boundary (Story 2-33), and since 2026-09-24
 * the scroll binding that turns the torus (DW-36).
 *
 * `WorkHero` imports this module through `next/dynamic` and nothing else in the Hub imports it, so
 * `Scene`, `Torus`, the orbit controls, the binding and the libraries under them load together, on
 * demand, and only where motion is allowed. `Scene` is imported statically for that reason: until
 * Story 2-33 it sat behind a second `next/dynamic` call here while `Torus` and the controls pulled
 * `three`, R3F and drei in statically beside it, so the libraries landed in the page's own chunks
 * and only `Scene` was deferred. One boundary, at the hero, is the shape `GemNarrative.tsx` gave the
 * homepage.
 */
interface TorusCanvasProps {
  /** The hero section the torus turns through: the binding runs while it crosses the viewport. */
  triggerRef: RefObject<HTMLElement | null>;
  className?: string;
}

export function TorusCanvas({ triggerRef, className }: TorusCanvasProps) {
  // The bridge: GSAP writes it, `Torus`'s `useFrame` reads it. A plain object, so a write re-renders
  // nothing.
  const scrollRef = useRef<{ value: number }>({ value: 0 });

  // **`scrub: true`**, so the rotation tracks the scroll rather than trailing it (review A-7; it was
  // `1.5`, up to a second and a half behind the wheel). Created when the torus mounts and reverted
  // when it goes, which `WorkHero` decides from the motion preference.
  useGsapContext(() => {
    gsap.to(scrollRef.current, {
      value: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: triggerRef.current,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      },
    });
  });

  return (
    <Scene className={className}>
      <ambientLight intensity={0.5} />
      <Torus scrollRef={scrollRef} />
      <CanvasOrbitControls />
    </Scene>
  );
}
