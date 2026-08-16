'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function rand(seed: number, i: number): number {
  const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function makeRibbonCurve(seed: number, radius: number, euler: THREE.Euler): THREE.CatmullRomCurve3 {
  const N = 9;
  const pts: THREE.Vector3[] = [];

  for (let i = 0; i < N; i++) {
    const theta = (i / N) * Math.PI * 2;
    const r = radius * (1 + 0.45 * (rand(seed, i) - 0.5));
    const x = r * Math.cos(theta);
    const y = r * 0.52 * Math.sin(theta);
    const z = (rand(seed, i + 80) - 0.5) * radius * 0.65;
    pts.push(new THREE.Vector3(x, y, z).applyEuler(euler));
  }

  return new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
}

const venomMaterial = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color(0x0a001e), // dark purple, not black
  roughness: 0.08,
  metalness: 0.4,
  clearcoat: 1.0,
  clearcoatRoughness: 0.04,
  iridescence: 0.3,
  iridescenceIOR: 1.5,
  reflectivity: 0.9,
  emissive: new THREE.Color(0x5500b8), // vivid purple glow
  emissiveIntensity: 0.65, // Bloom catches this
});

interface RibbonProps {
  seed: number;
  radius: number;
  euler: THREE.Euler;
  tubeRadius: number;
  speed: number;
}

function Ribbon({ seed, radius, euler, tubeRadius, speed }: RibbonProps) {
  const ref = useRef<THREE.Mesh>(null);

  const geometry = useMemo(
    () => new THREE.TubeGeometry(makeRibbonCurve(seed, radius, euler), 128, tubeRadius, 6, true),
    [seed, radius, euler, tubeRadius]
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = clock.getElapsedTime() * speed;
  });

  return <mesh ref={ref} geometry={geometry} material={venomMaterial} />;
}

const RIBBONS: Omit<RibbonProps, 'euler'>[] = [
  { seed: 1, radius: 2.4, tubeRadius: 0.16, speed: 0.052 },
  { seed: 2, radius: 2.0, tubeRadius: 0.13, speed: -0.04 },
  { seed: 3, radius: 2.8, tubeRadius: 0.19, speed: 0.061 },
  { seed: 4, radius: 2.2, tubeRadius: 0.14, speed: -0.035 },
  { seed: 5, radius: 1.9, tubeRadius: 0.1, speed: 0.068 },
  { seed: 6, radius: 3.1, tubeRadius: 0.09, speed: -0.048 },
  { seed: 7, radius: 2.6, tubeRadius: 0.15, speed: 0.027 },
];

const TILTS = [
  new THREE.Euler(0, 0, 0),
  new THREE.Euler(Math.PI / 3, 0.4, 0),
  new THREE.Euler((Math.PI * 2) / 3, 0, 0.6),
  new THREE.Euler(Math.PI, 0.7, 0),
  new THREE.Euler(0.3, Math.PI / 2, 0),
  new THREE.Euler(0.9, 0, Math.PI / 4),
  new THREE.Euler(Math.PI / 5, (Math.PI * 3) / 4, 0.2),
];

export function VenomSculpture() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.getElapsedTime() * 0.065;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh scale={[1, 0.8, 0.92]}>
        <sphereGeometry args={[1.75, 96, 96]} />
        <meshPhysicalMaterial
          color={new THREE.Color(0x050015)}
          roughness={0.05}
          metalness={0.25}
          clearcoat={1.0}
          clearcoatRoughness={0.02}
          iridescence={0.18}
          iridescenceIOR={1.6}
          emissive={new THREE.Color(0x2d0060)}
          emissiveIntensity={0.45}
        />
      </mesh>

      {RIBBONS.map((r, i) => (
        <Ribbon key={r.seed} {...r} euler={TILTS[i]} />
      ))}
    </group>
  );
}
