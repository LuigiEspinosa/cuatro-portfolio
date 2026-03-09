'use client';

import { type RefObject, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh } from 'three';

interface TorusKnotProps {
  scrollRef: RefObject<{ value: number }>;
}

export function TorusKnot({ scrollRef }: TorusKnotProps) {
  const meshRef = useRef<Mesh>(null!);

  useFrame(() => {
    // Ambient base rotation keeps the knot readable when the page is not beign scrolled
    meshRef.current.rotation.y += 0.002;
    meshRef.current.rotation.z = scrollRef.current.value * Math.PI * 2;
  });

  return (
    <mesh ref={meshRef}>
      <torusKnotGeometry args={[1, 0.3, 100, 16, 2, 3]} />
      <meshBasicMaterial color='#ffffff' wireframe />
    </mesh>
  );
}
