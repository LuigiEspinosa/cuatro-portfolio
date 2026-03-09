'use client';

import { OrbitControls } from '@react-three/drei';
import { useRef, useCallback } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

export function GemOrbitControls() {
  const controlsRef = useRef<OrbitControlsImpl>(null!);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleStart = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (controlsRef.current) controlsRef.current.autoRotate = false;
  }, []);

  const handleEnd = useCallback(() => {
    timerRef.current = setTimeout(() => {
      if (controlsRef.current) controlsRef.current.autoRotate = true;
    }, 800);
  }, []);

  return (
    <OrbitControls
      ref={controlsRef}
      autoRotate
      autoRotateSpeed={0.8}
      enableZoom={false}
      enablePan={false}
      onStart={handleStart}
      onEnd={handleEnd}
    />
  );
}
