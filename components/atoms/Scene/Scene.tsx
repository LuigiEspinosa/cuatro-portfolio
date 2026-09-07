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
      // A-14 (Story 2-13). The scene is decoration: it carries no information a reader loses by not
      // having it, and there is nothing inside it to operate. `@react-three/fiber` spreads unknown
      // props onto its own wrapper `<div>` rather than onto the `<canvas>`, so this removes the
      // whole subtree from the accessibility tree; the canvas element itself is treated below,
      // where a real reference to it exists.
      aria-hidden='true'
      onCreated={({ gl }: { gl: WebGLRenderer }) => {
        const canvas = gl.domElement;

        // The other half of A-14, on the element rather than on its wrapper. A `<canvas>` is not a
        // tab stop by default, so this is a guard rather than a repair: it is written where a
        // future `tabIndex` from the library, or a drei helper that adds one, would otherwise put
        // the scene in a keyboard reader's path with nothing to do there. `aria-hidden` is set here
        // as well, so the claim holds on the canvas whatever the wrapper is doing.
        canvas.setAttribute('aria-hidden', 'true');
        canvas.tabIndex = -1;

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
