import { useEffect, useState } from 'react';
import { useReduceMotion } from './useReduceMotion';

/**
 * Which front door this visitor gets (Story 2-13, FR-2, `EXPERIENCE.md:154-176`).
 *
 * **One decision, one source, and that means one call.** The WebGL probe, `prefers-reduced-motion`
 * and the connection read are answered together, here, and the hero calls this hook **once**:
 * `HomeLayout` holds the answer and hands `GemComponent` the decided value as a prop. Calling it in
 * both would be two state machines, two WebGL contexts and three `useReduceMotion` subscriptions on
 * one page load, which is re-deriving the decision however identical the inputs are. Until this
 * story the probe lived inside `GemComponent` and `HomeLayout` could not see it, which is why the
 * fold and the skip control could not follow it.
 *
 * **Three states rather than two, and the third one is load-bearing.** `next/dynamic` issues its
 * import on first render of the returned component, so a hook that answered `'narrative'` before
 * the probe had run would have every device without WebGL download the whole narrative to draw
 * nothing. `'undecided'` is what both consumers render until the effect below has answered, and it
 * renders the default path's geometry: the flat path is a smaller hero, so arriving at it late
 * shrinks the page rather than growing it.
 *
 * **The server's verdict is an input, not something to re-derive.** `app/page.tsx` reads the
 * `Save-Data` request header, which exists only on the server, and passes `'flat'` down when it is
 * set. That value is this hook's starting state on both sides of hydration, so the served document
 * is already the flat hero for that visitor and the client's first render agrees with it. Once the
 * server has answered `'flat'` nothing here revisits it: a proxy may set the header for a client
 * whose `navigator.connection` reports nothing, and the two must not disagree about which door the
 * visitor came through. Operator ruling of 2026-09-07: every trigger that can be answered before
 * the document paints must be.
 *
 * **Nothing branches on `useReduceMotion` in render output.** Its docblock records why: the
 * corrected hook returns `true` on the client's first render where the server rendered `false`, so
 * a consumer that put the value in its markup would take a hydration mismatch rather than a
 * warning. This hook preserves that by starting `'undecided'` on both sides of hydration and
 * moving only in an effect, which never runs on the server.
 */
export type NarrativePath = 'undecided' | 'narrative' | 'flat';

/**
 * What the server is able to settle from the request alone.
 *
 * Narrower than `NarrativePath` on purpose. `'narrative'` is not a thing a request can prove: it
 * means WebGL is present and no preference forbids the scene, and neither is knowable from a
 * header. Typed as the full union, a caller could hand this hook `'narrative'` and start the
 * dynamic import before any probe had run, on a device that may not be able to draw it, which is
 * exactly the payload defect the undecided state exists to prevent.
 */
export type ServedNarrativePath = Extract<NarrativePath, 'undecided' | 'flat'>;

/**
 * The Network Information API, declared here because `lib.dom.d.ts` does not carry it.
 *
 * `tsconfig.json:4-8` is `["dom","dom.iterable","esnext"]` and none of the three declares
 * `NetworkInformation` or `Navigator.connection`, so reading either is a type error without this.
 * Declared inside this module rather than in a top-level `types/` directory: a new source root
 * fails `app/__tests__/anchor-contract.test.ts:671-740`, which holds `SCANNED` against the tracked
 * tree. Both members are optional, because every one of them is optional in the browsers that ship
 * the API at all and absent in the ones that do not.
 */
declare global {
  interface NetworkInformation {
    readonly saveData?: boolean;
    readonly effectiveType?: string;
  }

  interface Navigator {
    readonly connection?: NetworkInformation;
  }
}

/**
 * What counts as a slow connection. Operator ruling of 2026-09-07, recorded here because no
 * planning document defines it: `Save-Data`, `effectiveType` and Network Information have zero
 * occurrences across every planning artifact.
 *
 * `4g`, and an absent `navigator.connection`, both take the default path.
 */
const SLOW_EFFECTIVE_TYPES = ['slow-2g', '2g', '3g'];

/**
 * The WebGL probe, moved out of `GemComponent.tsx:44-50`.
 *
 * The `try` is the one addition. `getContext` throws rather than answering `null` in a browser
 * whose WebGL is disabled by policy rather than absent, and an unhandled throw inside the effect
 * below would take the whole route with it. The matrix this story is built from books "WebGL
 * absent **or throwing**" as one row, answering false, so it is answered rather than propagated.
 *
 * **The context is released rather than dropped.** A browser caps how many live WebGL contexts a
 * document may hold, around sixteen in Chromium, and silently loses the oldest when the cap is
 * reached. This probe's context is worth nothing after the boolean is read, and the narrative asks
 * for its own a moment later through `Scene`, so it is handed back with
 * `WEBGL_lose_context.loseContext()` rather than left to garbage collection, whose timing is not
 * ours. The extension is absent in some implementations, hence the optional call.
 *
 * Not memoised across calls, and it is now called once per page load rather than once per consumer:
 * `HomeLayout` owns the only call to the hook below. A module-level cache would be state that reads
 * as fresh and is not, and every test toggling the probe would have to reset it.
 */
const release = (ctx: WebGLRenderingContext): void => {
  // In its own guard, and deliberately not inside the detection's. A context that cannot be handed
  // back is still a context, and an implementation without the extension, or a test double standing
  // in for one, must not make this probe answer "no WebGL" because the tidying failed.
  try {
    ctx.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    // Nothing to release, and nothing to report: the boolean above is what this function is for.
  }
};

const hasWebgl = (): boolean => {
  try {
    const canvas = document.createElement('canvas');
    const ctx =
      canvas.getContext('webgl') ??
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);

    if (!ctx) return false;

    release(ctx);
    return true;
  } catch {
    return false;
  }
};

/**
 * `saveData`, or an `effectiveType` the ruling above calls slow. No connection is not slow.
 *
 * **This is the client half of a signal whose other half is read on the server.** A browser that
 * sets `navigator.connection.saveData` also sends `Save-Data: on`, and `app/page.tsx` reads that
 * header and answers `'flat'` before this ever runs, which is why a data-saving visitor sees no
 * collapse. This read still matters: the header can be absent where the property is not, in a
 * browser that implements Network Information without the header, and it is the second of the two
 * paths to the same door rather than a duplicate of the first.
 */
const savesData = (): boolean => {
  const connection = navigator.connection;
  if (!connection) return false;
  if (connection.saveData === true) return true;
  return SLOW_EFFECTIVE_TYPES.includes(connection.effectiveType ?? '');
};

/**
 * The decision itself, module-private because the hook is the only way in.
 *
 * The order is short-circuiting on purpose. A server that already answered `'flat'` is never
 * second-guessed, and a visitor who asked for reduced motion is never asked for a WebGL context at
 * all, which is what `EXPERIENCE.md:656` means by never requested.
 */
const decideNarrativePath = (reduceMotion: boolean, served: ServedNarrativePath): NarrativePath => {
  if (served === 'flat') return 'flat';
  if (reduceMotion) return 'flat';
  if (savesData()) return 'flat';
  return hasWebgl() ? 'narrative' : 'flat';
};

/**
 * **The decision is taken once and is then terminal, which is a rule about layout rather than
 * about capability.**
 *
 * `prefers-reduced-motion` is live: a visitor can turn it off in the middle of a session and this
 * hook's effect re-runs. Re-deciding there would move a hero that had already collapsed back to
 * `100dvh`, pushing the Directory down the page under someone who was reading it, and this story
 * asserts in the browser that the hero only ever shrinks. So the effect answers only while the path
 * is still undecided, and a preference changed afterwards is honoured the way the rest of the page
 * honours it: `HomeLayout.scss`'s reduced-motion media query keeps that visitor's layout flat, and
 * the token contract collapses every duration to 1ms, both live. What does not happen is the 3D
 * narrative starting mid-session, or a flat hero growing back.
 *
 * @param served what the server settled from the request, `'flat'` for a `Save-Data` visitor and
 *   `'undecided'` for everyone else. It is the initial state on both sides of hydration, so passing
 *   it is what makes the served document and the first client render agree.
 */
export function useNarrativePath(served: ServedNarrativePath = 'undecided'): NarrativePath {
  const reduceMotion = useReduceMotion();
  const [path, setPath] = useState<NarrativePath>(served);

  useEffect(() => {
    setPath((current) => (current === 'undecided' ? decideNarrativePath(reduceMotion, served) : current));
  }, [reduceMotion, served]);

  return path;
}
