'use client';

import { type RefObject, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { PlateMark } from '@/components/molecules/PlateMark/PlateMark';
import { work } from '@/content/work';
import './WorkHero.scss';

const POSITION_COUNT = work.length;
const EARLIEST_YEAR = '2017';

/**
 * The torus, and everything WebGL on `/work`, behind one dynamic boundary (Story 2-33).
 *
 * `TorusCanvas` is the only module here that reaches `three`, `@react-three/fiber` or drei, so none
 * of them is in the document's eager chunks: until this story it was imported statically and its
 * libraries arrived with the page, torus or no torus. The import is issued only when the torus is
 * rendered, which `WorkHero` does only once it knows motion is allowed. **Since 2026-09-24 it holds
 * the scroll binding as well** (DW-36), so GSAP's `ScrollTrigger`, which exists here only to turn the
 * torus, arrives with it rather than with the page.
 *
 * A module that resolves without the export, or a chunk that never arrives, resolves to a component
 * that draws nothing, so the page is untouched and the canvas box stays empty. The failure is logged
 * rather than swallowed, the shape `GemComponent.tsx` gave the homepage (DW-37). No `loading:`
 * option: an empty box is the intended state while the torus is on its way, never a spinner.
 */
const TorusCanvas = dynamic<{ triggerRef: RefObject<HTMLElement | null> }>(
  () =>
    import('@/components/molecules/TorusCanvas/TorusCanvas')
      .then((module) => module.TorusCanvas ?? (() => null))
      .catch((error: unknown) => {
        console.error('WorkHero: the torus chunk failed to load, so the torus is not drawn', error);
        return () => null;
      }),
  { ssr: false }
);

export function WorkHero() {
  // The section the torus turns through, handed to it as the scroll binding's trigger.
  const heroRef = useRef<HTMLElement>(null);
  const reduceMotion = useReduceMotion();

  // **The torus is decided in an effect, so the first paint never depends on it.** `false` on the
  // server and on the first client render, which keeps hydration identical for every visitor, and
  // then whatever the motion preference allows: under `prefers-reduced-motion: reduce` it is never
  // rendered, so its chunk is never requested. Live rather than decided once: a preference turned on
  // mid-session takes the torus away, and the stylesheet omits its box under the same query.
  const [drawTorus, setDrawTorus] = useState(false);

  useEffect(() => {
    setDrawTorus(!reduceMotion);
  }, [reduceMotion]);

  // **No GSAP here since 2026-09-24.** The entrance is the stylesheet's, and the scroll binding moved
  // into `TorusCanvas` (DW-36), where it is created when the torus mounts and reverted when the
  // preference above takes it away.
  return (
    <section className='work-hero' ref={heroRef}>
      <div className='work-hero__text'>
        {/* The page's section identity, on the Plate mark's annotated variant since Story 2-31. The
            `//` that led the label is gone rather than moved: it was decoration inside a string a
            screen reader speaks, and the Plate mark carries no marker (`EXPERIENCE.md` § Plate
            mark). The kanji stays as the subordinate line, which is ornament and never read. */}
        <PlateMark variant='annotated' label='EXPERIENCE' sub='経験' />
        <h1 className='work-hero__heading'>
          Frontend Developer
          <br />
          and Team Lead
        </h1>
        {/* **The meta line is a Plate mark** (Story 2-33, `DESIGN.md` § Work hero and timeline), so
            one component carries every readout on the site. The count leads and the period trails,
            in the order the free mono line read; the `//` that stood between them was decoration a
            screen reader speaks, and the two cells separate them now. The wrapper is what the
            entrance addresses. */}
        <div className='work-hero__meta'>
          <PlateMark label={`${POSITION_COUNT} POSITIONS`} domain={`${EARLIEST_YEAR} - PRESENT`} />
        </div>
      </div>

      <div className='work-hero__canvas-wrap'>{drawTorus && <TorusCanvas triggerRef={heroRef} />}</div>
    </section>
  );
}
