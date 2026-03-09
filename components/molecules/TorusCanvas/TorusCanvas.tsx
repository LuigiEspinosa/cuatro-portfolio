'use client';

import type { RefObject } from 'react';
import dynamic from 'next/dynamic';
import { Torus } from '@/components/atoms/Torus/Torus';

const Scene = dynamic(() => import('@/components/atoms/Scene/Scene').then((m) => m.Scene), {
  ssr: false,
});

interface TorusCanvasProps {
  scrollRef: RefObject<{ value: number }>;
  className?: string;
}

export function TorusCanvas({ scrollRef, className }: TorusCanvasProps) {
  return (
    <Scene className={className}>
      <ambientLight intensity={0.5} />
      <Torus scrollRef={scrollRef} />
    </Scene>
  );
}
