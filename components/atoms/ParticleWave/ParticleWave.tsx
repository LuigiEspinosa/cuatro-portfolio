'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

const COLS = 60;
const ROWS = 60;
const SPACING = 0.08;

const WAVE_FREQ = 1.4;
const WAVE_AMP = 0.28;
const WAVE_SPEED = 0.5;

const MOUSE_RADIUS = 1.2;
const MOUSE_LIFT = 0.9;
const MOUSE_RADIUS_SQ = MOUSE_RADIUS * MOUSE_RADIUS;

const SPRING_K = 0.1;
const DAMPING = 0.82;

const H_SEGS = ROWS * (COLS - 1);
const V_SEGS = (ROWS - 1) * COLS;
const LINE_VERT_COUNT = (H_SEGS + V_SEGS) * 2;

export function ParticleWave() {
  const groupRef = useRef<THREE.Group>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const pointsRef = useRef<THREE.Points>(null);

  const velZ = useRef(new Float32Array(COLS * ROWS));
  const mouseLocal = useRef(new THREE.Vector3(999, 999, 0));
  const _tmp = useRef(new THREE.Vector3());

  const { pointGeo, lineGeo, basePos } = useMemo(() => {
    const count = COLS * ROWS;
    const pos = new Float32Array(count * 3);
    const base = new Float32Array(count * 3);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = (r * COLS + c) * 3;
        const x = (c - COLS / 2) * SPACING;
        const y = (r - ROWS / 2) * SPACING;

        pos[i] = x;
        pos[i + 1] = y;
        pos[i + 2] = 0;

        base[i] = x;
        base[i + 1] = y;
        base[i + 2] = 0;
      }
    }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    const lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(LINE_VERT_COUNT * 3), 3)
    );

    return { pointGeo: pGeo, lineGeo: lGeo, basePos: base };
  }, []);

  useEffect(() => {
    pointGeo.dispose();
    lineGeo.dispose();
  }, [pointGeo, lineGeo]);

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!groupRef.current) return;
    groupRef.current.worldToLocal(_tmp.current.copy(e.point));
    mouseLocal.current.copy(_tmp.current);
  };

  const handlePointerLeave = () => {
    mouseLocal.current.set(999, 999, 0);
  };

  useFrame(({ clock }) => {
    if (!pointsRef.current || !linesRef.current) return;

    const pPos = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const lPos = linesRef.current.geometry.attributes.position.array as Float32Array;
    const vel = velZ.current;
    const t = clock.getElapsedTime() * WAVE_SPEED;
    const mx = mouseLocal.current.x;
    const my = mouseLocal.current.y;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const idx = r * COLS + c;
        const i = idx * 3;
        const bx = basePos[i];
        const by = basePos[i + 1];

        const waveZ =
          Math.sin(bx * WAVE_FREQ + t) * Math.cos(by * WAVE_FREQ * 0.9 + t * 0.8) * WAVE_AMP;

        const dx = bx - mx;
        const dy = by - my;
        const dist2 = dx * dx + dy * dy;
        let lift = 0;
        if (dist2 < MOUSE_RADIUS_SQ) {
          const s = 1 - Math.sqrt(dist2) / MOUSE_RADIUS;
          lift = s * s * MOUSE_LIFT;
        }

        const targetZ = waveZ + lift;
        const spring = (targetZ - pPos[i + 2]) * SPRING_K;
        vel[idx] = vel[idx] * DAMPING + spring;
        pPos[i + 2] += vel[idx];
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;

    let li = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = (r * COLS + c) * 3;

        if (c < COLS - 1) {
          const ni = i + 3;
          lPos[li++] = pPos[i];
          lPos[li++] = pPos[i + 1];
          lPos[li++] = pPos[i + 2];
          lPos[li++] = pPos[ni];
          lPos[li++] = pPos[ni + 1];
          lPos[li++] = pPos[ni + 2];

          if (r < ROWS - 1) {
            const ni = i + COLS * 3;
            lPos[li++] = pPos[i];
            lPos[li++] = pPos[i + 1];
            lPos[li++] = pPos[i + 2];
            lPos[li++] = pPos[ni];
            lPos[li++] = pPos[ni + 1];
            lPos[li++] = pPos[ni + 2];
          }
        }
      }
    }

    linesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <group ref={groupRef} rotation={[-0.3, 0.15, 0]}>
      <mesh onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave}>
        <planeGeometry args={[COLS * SPACING * 1.8, ROWS * SPACING * 1.8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      <lineSegments ref={linesRef} geometry={lineGeo}>
        <lineBasicMaterial color='#3b0764' transparent opacity={0.35} />
      </lineSegments>

      <points ref={pointsRef} geometry={pointGeo}>
        <pointsMaterial size={0.032} color='#8b5cf6' sizeAttenuation transparent opacity={0.9} />
      </points>
    </group>
  );
}
