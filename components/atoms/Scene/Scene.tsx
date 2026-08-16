'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { ACESFilmicToneMapping, type WebGLRenderer } from 'three';

interface SceneProps {
  children: ReactNode;
  className?: string;
  cameraZ?: number;
}

// cleanupRef stores the listener teardown from onCreated so the useEffect
// cleanup can remove them when the Canvas unmounts. onCreated does not
// support returning a cleanup function, so we bridge via a ref.

// A second canvas needing orthographic camera requries either a prop
// override or a second Scene variant.
export function Scene({ children, className, cameraZ = 4 }: SceneProps) {
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  return (
    <Canvas
      className={className}
      camera={{ position: [0, 0, cameraZ], fov: 45 }}
      gl={{ toneMapping: ACESFilmicToneMapping, antialias: true }}
      dpr={[1, 2]}
      onCreated={({ gl }: { gl: WebGLRenderer }) => {
        const canvas = gl.domElement;

        const onContextLost = (e: Event) => {
          // Prevent the browser from permanently disabling the context after loss.
          e.preventDefault();
        };

        const onContextRestored = () => {
          // Reset Three.js internal state cache so it re-uploads uniforms/buffers.
          gl.resetState();
        };

        canvas.addEventListener('webglcontextlost', onContextLost);
        canvas.addEventListener('webglcontextrestored', onContextRestored);

        cleanupRef.current = () => {
          canvas.removeEventListener('webglcontextlost', onContextLost);
          canvas.removeEventListener('webglcontextrestored', onContextRestored);
        };
      }}
    >
      <PerformanceMonitor />
      {children}
    </Canvas>
  );
}
