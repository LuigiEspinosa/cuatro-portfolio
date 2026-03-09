'use client';

import type { ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { ACESFilmicToneMapping } from 'three';

interface SceneProps {
  children: ReactNode;
  className?: string;
}

// A second canvas needing orthographic camera requries either a prop
// override or a second Scene variant.
export function Scene({ children, className }: SceneProps) {
  return (
    <Canvas
      className={className}
      camera={{ position: [0, 0, 5], fov: 45 }}
      gl={{ toneMapping: ACESFilmicToneMapping, antialias: true }}
      dpr={[1, 2]}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          // Prevent the browser from permanently disabling the context.
          // Without this, a single context-lost event kills the canvas for the session.
          e.preventDefault();
        });
      }}
    >
      <PerformanceMonitor />
      {children}
    </Canvas>
  );
}
