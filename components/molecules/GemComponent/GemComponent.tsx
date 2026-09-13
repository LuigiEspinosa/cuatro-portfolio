'use client';

import dynamic from 'next/dynamic';
import type { NarrativePath } from '@/hooks/useNarrativePath';

/**
 * The homepage's narrative, and nothing else (Stories 2-12 and 2-13).
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
        // rather than an image of the scene is the same answer the flat path below gives, and for
        // the same reason: `EXPERIENCE.md:173-176` refuses a still of a 3D scene by name.
        return () => null;
      }),
  { ssr: false }
);

/**
 * The two states a gem that is on the page can be in.
 *
 * `'flat'` is not one of them, and that is structural rather than an omission: the non-3D front
 * door renders no `.home-gem` wrapper at all, so this component is not mounted on it. Deleting
 * `public/assets/home/gem-fallback.png` is what made that possible. There is no third branch here
 * drawing nothing, because nothing is drawn by not being rendered, and a branch for a value this
 * component cannot receive would be a branch no test could reach honestly.
 */
type MountedNarrativePath = Exclude<NarrativePath, 'flat'>;

interface GemComponentProps {
  /**
   * The decided path, taken from `HomeLayout` rather than decided again here.
   *
   * One page, one decision: `useNarrativePath` is called once, by the component that owns the hero,
   * and this reads the answer. Calling the hook here as well would probe WebGL a second time and
   * subscribe to the motion query a third.
   */
  path: MountedNarrativePath;
}

const GemComponent = ({ path }: GemComponentProps) => {
  // Two branches, and the first one is the payload fix. Rendering `<GemNarrative />` while the
  // decision is still `'undecided'` starts the dynamic import before anyone knows whether this
  // visitor is on the narrative path at all, so a device with no WebGL, a connection reporting
  // `saveData` or a reduced-motion preference would download the whole narrative to draw nothing.
  // An empty container is what the route is designed around anyway, so waiting one effect costs
  // nothing visible, and it is the default path's geometry rather than the flat path's.
  if (path === 'undecided') {
    return <div id='gem-canvas' />;
  }

  return (
    <div id='gem-canvas'>
      <GemNarrative />
    </div>
  );
};

export default GemComponent;
