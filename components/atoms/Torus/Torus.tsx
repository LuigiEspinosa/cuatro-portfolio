'use client';

import { type RefObject, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh } from 'three';

interface TorursProps {
  scrollRef: RefObject<{ value: number }>;
}

// R3F's useScroll (drei ScrollControls) creates its own scroll container
// that conflicts with the Lenis instance.
export function Torus({ scrollRef }: TorursProps) {
  const meshRef = useRef<Mesh>(null!);

  useFrame(() => {
    meshRef.current.rotation.y = scrollRef.current.value * Math.PI * 4.5;
    meshRef.current.rotation.x = scrollRef.current.value * Math.PI * -4.5;
  });

  return (
    <mesh ref={meshRef}>
      <torusGeometry args={[1, 0.4, 12, 48]} />
      <meshBasicMaterial color='#ffffff' wireframe />
    </mesh>
  );
}
