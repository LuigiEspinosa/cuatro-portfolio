'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const COLS = 60;
const ROWS = 60;
const SPACING = 0.08;

const WAVE_FREQ = 1.4;
const WAVE_AMP = 0.28;
const WAVE_SPEED = 0.5;

const FOLD_DEPTH = 1.4;

// The wave's pose, which nothing changes. Until 2026-09-24 it was only the starting point of a
// pointer drag that turned the wave and let it coast at 0.92 a frame after the release, with a grab
// cursor set on the body to advertise it. The canvas is decoration and `EXPERIENCE.md` § Pointer and
// touch allows no gesture, so DW-119's Operator ruling of that day removed all three.
//
// **The wave answers no pointer at all** (Operator ruling 2026-09-25, DW-123). Until that day an
// invisible plane caught the pointer, each frame lifted the points within 1.2 of it by up to 0.9, and
// a spring eased them back when it left: a deformation that followed the cursor, which
// `EXPERIENCE.md` § Motion bans as a cursor follower. The plane, the lift and the spring are gone,
// and each point stands at its fold plus the wave on its own clock. `tests/e2e/narrative.pw.ts`
// hovers the canvas and reads the drawn points.
const ROT_X = -0.816;
const ROT_Y = 15.977;

const H_SEGS = ROWS * (COLS - 1);
const V_SEGS = (ROWS - 1) * COLS;
const LINE_VERT_COUNT = (H_SEGS + V_SEGS) * 2;

export function ParticleWave() {
  const linesRef = useRef<THREE.LineSegments>(null);
  const pointsRef = useRef<THREE.Points>(null);

  const { pointGeo, lineGeo, basePos } = useMemo(() => {
    const count = COLS * ROWS;
    const pos = new Float32Array(count * 3);
    const base = new Float32Array(count * 3);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = (r * COLS + c) * 3;
        const normX = (c / (COLS - 1)) * 2 - 1;
        const normY = (r / (ROWS - 1)) * 2 - 1;
        const x = (c - COLS / 2) * SPACING;
        const y = (r - ROWS / 2) * SPACING;

        const foldZ = -(normX * normX * FOLD_DEPTH + normY * normY * FOLD_DEPTH * 0.35);

        pos[i] = x;
        pos[i + 1] = y;
        pos[i + 2] = foldZ;
        base[i] = x;
        base[i + 1] = y;
        base[i + 2] = foldZ;
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

  useEffect(
    () => () => {
      pointGeo.dispose();
      lineGeo.dispose();
    },
    [pointGeo, lineGeo]
  );

  useFrame(({ clock }) => {
    if (!pointsRef.current || !linesRef.current) return;

    const pPos = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const lPos = linesRef.current.geometry.attributes.position.array as Float32Array;
    const t = clock.getElapsedTime() * WAVE_SPEED;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = (r * COLS + c) * 3;
        const bx = basePos[i];
        const by = basePos[i + 1];
        const bz = basePos[i + 2];

        const waveZ =
          Math.sin(bx * WAVE_FREQ + t) * Math.cos(by * WAVE_FREQ * 0.9 + t * 0.8) * WAVE_AMP;

        pPos[i + 2] = bz + waveZ;
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
        }
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

    linesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <group rotation={[ROT_X, ROT_Y, 0]}>
      <lineSegments ref={linesRef} geometry={lineGeo}>
        <lineBasicMaterial color='#3b0764' transparent opacity={0.35} />
      </lineSegments>

      <points ref={pointsRef} geometry={pointGeo}>
        <pointsMaterial size={0.032} color='#8b5cf6' sizeAttenuation transparent opacity={0.9} />
      </points>
    </group>
  );
}
