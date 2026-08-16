'use client';

import type { RefObject } from 'react';
import dynamic from 'next/dynamic';
import { TorusKnot } from '@/components/atoms/TorusKnot/TorusKnot';
import { CanvasOrbitControls } from '@/components/atoms/CanvasOrbitControls/CanvasOrbitControls';

const Scene = dynamic(() => import('@/components/atoms/Scene/Scene').then((m) => m.Scene), {
  ssr: false,
});

interface TorusKnotCanvasProps {
  scrollRef: RefObject<{ value: number }>;
  className?: string;
}

export function TorusKnotCanvas({ scrollRef, className }: TorusKnotCanvasProps) {
  return (
    <Scene className={className} cameraZ={5}>
      <ambientLight intensity={0.5} />
      <TorusKnot scrollRef={scrollRef} />
      <CanvasOrbitControls />
    </Scene>
  );
}
