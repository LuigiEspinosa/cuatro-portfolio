'use client';

import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { ParticleWave } from '@/components/atoms/ParticleWave/ParticleWave';
import { Scene } from '@/components/atoms/Scene/Scene';

/**
 * Everything on the WebGL side of the homepage's one dynamic boundary (Story 2-12).
 *
 * This module exists so that `GemComponent` can import **nothing** from `three` or R3F at module
 * scope. Before it, `GemComponent.tsx:5-6` imported `@react-three/postprocessing` and
 * `ParticleWave` statically beside a dynamic `Scene` call, and a static import is not deferred by a
 * dynamic call next to it: `three`, `@react-three/fiber` and `postprocessing` all landed in the
 * homepage's eager entry chunk regardless. `ops/asset-budget.md` measured the result, 6,459 of
 * 418,757 gzipped narrative bytes deferred.
 *
 * So the four narrative pieces are collapsed into one module and one boundary. `Scene` and
 * `ParticleWave` are unchanged and correct: they were on the wrong side of the boundary rather than
 * wrong in themselves.
 *
 * **No loading state.** `GemComponent` imports this with `next/dynamic` and no `loading:` option,
 * because `EXPERIENCE.md:658-659` refuses a spinner: on the one path where nothing is missing,
 * announcing a wait is the defect. An empty transparent container is the intended state.
 *
 * `tests/e2e/narrative.pw.ts` holds the boundary from the served document, by fingerprint rather
 * than by chunk name, and proves the page whole with this module's request aborted.
 */
export function GemNarrative() {
  return (
    <Scene>
      <ParticleWave />
      <EffectComposer>
        <Bloom luminanceThreshold={0.2} intensity={0.55} radius={0.4} mipmapBlur />
      </EffectComposer>
    </Scene>
  );
}

export default GemNarrative;
