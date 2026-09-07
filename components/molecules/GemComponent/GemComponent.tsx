'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

/**
 * The homepage's WebGL probe and its fallback, and nothing else (Story 2-12).
 *
 * Everything narrative sits behind the one dynamic boundary below, in `GemNarrative`. Nothing in
 * this module's import graph reaches `three`, `@react-three/fiber` or `@react-three/postprocessing`
 * at module scope, which is what keeps them off the eager entry chunk the `/` document references.
 *
 * No `loading:` option and no `<Suspense>` fallback: `EXPERIENCE.md:658-659` refuses a spinner, and
 * an empty transparent container is the intended state while the narrative is on its way.
 */
const GemNarrative = dynamic(
  () =>
    import('./GemNarrative')
      // A module that resolves without the export is as fatal as one that never resolves: React
      // throws element-type-invalid on `undefined` and Next's default error boundary takes the
      // route with it. The `??` is the same containment as the `catch` below, one failure earlier.
      .then((module) => module.GemNarrative ?? (() => null))
      .catch((error: unknown) => {
        // Logged rather than swallowed. Without this a genuine regression and a visitor whose
        // connection dropped one request are indistinguishable, and the suite that asserts no
        // uncaught error would be certifying the silence rather than the containment.
        console.error('GemComponent: the narrative chunk failed to load, so the gem is not drawn', error);

        // A chunk that never arrives resolves to a component that draws nothing, so the rest of the
        // page is untouched. That is the payload independence `EXPERIENCE.md:951-952` claims and
        // `tests/e2e/narrative.pw.ts` measures by aborting the request outright. Rendering nothing
        // rather than the 1.75 MB fallback image is deliberate: the non-3D front door is Story
        // 2-13's, and an empty transparent container is the state this route is already designed
        // around.
        return () => null;
      }),
  { ssr: false }
);

const GemComponent = () => {
  // null = not yet checked (avoids fallback flash on capable devices)
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    const ctx =
      canvas.getContext('webgl') ??
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    setWebglAvailable(!!ctx);
  }, []);

  // Three branches, not two, and the middle one is the payload fix. Rendering `<GemNarrative />`
  // while the probe still answers `null` starts the dynamic import before anyone knows whether the
  // device can use it, so a visitor with no WebGL would download the whole narrative to draw a
  // static PNG. An empty container is what the route is designed around anyway, so waiting one
  // effect costs nothing visible.
  if (webglAvailable === null) {
    return <div id='gem-canvas' />;
  }

  if (!webglAvailable) {
    return (
      <div id='gem-canvas'>
        {/* Static screenshot shown on devices without WebGL support */}
        <img src='/assets/home/gem-fallback.png' alt='' aria-hidden='true' />
      </div>
    );
  }

  return (
    <div id='gem-canvas'>
      <GemNarrative />
    </div>
  );
};

export default GemComponent;
