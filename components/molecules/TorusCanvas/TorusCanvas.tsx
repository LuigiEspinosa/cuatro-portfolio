'use client';

import type { RefObject } from 'react';
import { Scene } from '@/components/atoms/Scene/Scene';
import { Torus } from '@/components/atoms/Torus/Torus';
import { CanvasOrbitControls } from '@/components/atoms/CanvasOrbitControls/CanvasOrbitControls';

/**
 * Everything on the WebGL side of `/work`'s one dynamic boundary (Story 2-33).
 *
 * `WorkHero` imports this module through `next/dynamic` and nothing else in the Hub imports it, so
 * `Scene`, `Torus`, the orbit controls and the libraries under them load together, on demand, and
 * only where motion is allowed. `Scene` is imported statically for that reason: until this story it
 * sat behind a second `next/dynamic` call here while `Torus` and the controls pulled `three`, R3F and
 * drei in statically beside it, so the libraries landed in the page's own chunks and only `Scene`
 * was deferred. One boundary, at the hero, is the shape `GemNarrative.tsx` gave the homepage.
 */
interface TorusCanvasProps {
  scrollRef: RefObject<{ value: number }>;
  className?: string;
}

export function TorusCanvas({ scrollRef, className }: TorusCanvasProps) {
  return (
    <Scene className={className}>
      <ambientLight intensity={0.5} />
      <Torus scrollRef={scrollRef} />
      <CanvasOrbitControls />
    </Scene>
  );
}
