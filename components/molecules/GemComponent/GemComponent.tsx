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
      .then((module) => module.GemNarrative)
      // A chunk that never arrives resolves to a component that draws nothing, so the rest of the
      // page is untouched. Without this the rejected import reaches React, which hands it to Next's
      // default error boundary, and a visitor whose connection dropped one request gets an error
      // page instead of the premise and the Suite Directory. That is the payload independence
      // `EXPERIENCE.md:951-952` claims and `tests/e2e/narrative.pw.ts` measures by aborting the
      // request outright. Rendering nothing rather than the 1.75 MB fallback image is deliberate:
      // the non-3D front door is Story 2-13's, and an empty transparent container is the state this
      // route is already designed around.
      .catch(() => () => null),
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

  if (webglAvailable === false) {
    return (
      <div id='gem-canvas'>
        {/* Static screenshort shown on devices without WebGL support */}
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
