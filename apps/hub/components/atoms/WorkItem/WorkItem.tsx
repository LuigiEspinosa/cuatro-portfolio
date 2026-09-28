'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { type WorkEntry } from '@/content/work';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import './WorkItem.scss';

interface WorkItemProps {
  entry: WorkEntry;
  isOpen: boolean;
  onToggle: () => void;
}

/**
 * The disclosure's two durations, in seconds, and they are the contract's rather than this file's
 * (Story 2-31).
 *
 * Opening runs the contract's major duration and closing its exit duration, both on an ease-out.
 * The close used to run an ease-in over 0.3s, which holds visible movement back to exactly the frames
 * after the click and reads as lag (`review-apple-design-2026-09-15.md` A-4). The contract's own exit
 * easing is an ease-in too, so the curve is stated here by hand rather than borrowed from it: that is
 * DW-103, a contract change, and not this component's to make.
 *
 * **Written as numbers because GSAP takes numbers**, which puts them out of reach of the contract's
 * reduced-motion collapse; `useReduceMotion` below is what takes them to zero instead.
 * `__tests__/WorkItem.test.tsx` reads both values off the published contract and holds these equal to
 * them, so a retuned duration fails there rather than drifting here.
 */
const OPEN_DURATION = 0.42;
const CLOSE_DURATION = 0.165;

/** Both tweens ease out: movement starts at speed, the moment the click lands. */
const EASE = 'power2.out';

export function WorkItem({ entry, isOpen, onToggle }: WorkItemProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef<boolean>(false);
  const reducedMotion = useReduceMotion();

  /**
   * Whether this entry was closed on the render that ships, which is the only render whose inline
   * style reaches a browser (Story 2-16).
   *
   * **The mount-time `gsap.set` below is not enough on its own**, and the comment there claiming
   * there is no flash was true only after hydration. `height: 0` used to be written into the panel
   * unconditionally, so a statically rendered document showed the open entry collapsed until
   * JavaScript ran, and on `/cv` with scripting off it never opened at all. The fix is at the point
   * the style is written, and it is asserted on server output in `app/cv/__tests__/page.test.tsx`
   * rather than in a browser: a browser fast enough to hydrate before the first paint would hide
   * the defect rather than report it.
   *
   * **Frozen at the first render rather than read from `isOpen` directly, and that is
   * load-bearing.** React diffs the `style` prop and clears any key that leaves it, so a prop that
   * flipped to `undefined` on open would wipe the very inline `height` and `overflow` GSAP is
   * mid-way through owning: the effect below would then measure a panel already at its full height
   * and tween it to the height it is already at, and the close branch would measure a panel React
   * had just set to zero. Either way the accordion silently stops animating. Frozen here, the prop
   * never changes after the first render, GSAP keeps sole ownership of the DOM, and the behaviour
   * Story 2-33 is required not to alter is exactly what it was.
   * `__tests__/WorkItem.test.tsx` holds that, watched against the unfrozen variant.
   *
   * **A `useState` initializer rather than a ref, deliberately.** A ref read during render is a
   * rule violation that nothing is obliged to preserve, the React Compiler included, and the freeze
   * is exactly what a lazy `useState` initializer is for: it runs once, its value is state rather
   * than a mutable box, and the setter is discarded because nothing may change it. The mechanism is
   * different from the ref this was written as; the value and the behaviour are identical.
   *
   * The value is deterministic on both sides, `isOpen` being decided by
   * `WorkTimeLine.tsx:14`'s `useState` initializer from the same list, so this adds no hydration
   * branch and no read of anything the server cannot see.
   */
  const [collapsedOnFirstRender] = useState<boolean>(() => !isOpen);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    // Skip animation on the first render, and set the state directly so the initially open entry
    // shows its content.
    //
    // **This runs after hydration, so it is not what makes the open entry visible on arrival.** It
    // was written as though it were, and the panel it corrects no longer needs correcting: the
    // collapsed style is not written for an open entry at all (see `collapsedOnFirstRender` above).
    // What this still does is take an open panel off any height GSAP left on it, which is the state
    // a re-mount can arrive in.
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      if (isOpen) {
        gsap.set(el, { height: 'auto', overflow: '' });
      }
      return;
    }

    let tween: gsap.core.Tween;
    const duration = reducedMotion ? 0 : undefined;

    // **Height is a layout property, and this is the one place the system animates it.** A disclosure
    // that jumps is worse than one that eases, so `EXPERIENCE.md` § Work item records this tween as the
    // single named exception to "only transform and opacity animate", and reduced motion takes it to
    // zero rather than removing it.
    if (isOpen) {
      const targetHeight = el.scrollHeight;
      gsap.set(el, { overflow: 'hidden' });
      tween = gsap.to(el, {
        height: targetHeight,
        duration: duration ?? OPEN_DURATION,
        ease: EASE,
        onComplete: () => {
          gsap.set(el, { height: 'auto', overflow: '' });
        },
      });
    } else {
      gsap.set(el, { height: el.offsetHeight, overflow: 'hidden' });
      tween = gsap.to(el, {
        height: 0,
        duration: duration ?? CLOSE_DURATION,
        ease: EASE,
      });
    }

    return () => {
      tween?.kill();
    };
  }, [isOpen, reducedMotion]);

  return (
    <article className='work-item' data-open={isOpen}>
      <button
        className='work-item__header'
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`${entry.id}-content`}
      >
        <div className='work-item__meta'>
          <h2 id={`${entry.id}-heading`} className='work-item__company'>
            {entry.company}
          </h2>
          <div className='work-item__sub'>
            <span>{entry.role}</span>
            <span>
              {entry.period} &middot; {entry.location}
            </span>
          </div>
        </div>
        <span className='work-item__icon' aria-hidden={true}>
          {isOpen ? '▼' : '▶'}
        </span>
      </button>

      {/* **A labelled region, named by its company** (`EXPERIENCE.md` § Work item). Named by the
          heading rather than by the trigger, whose accessible name carries the role and the dates
          as well, so a landmark list reads four companies rather than four sentences. */}
      <div
        id={`${entry.id}-content`}
        className='work-item__content'
        role='region'
        aria-labelledby={`${entry.id}-heading`}
        ref={contentRef}
        style={collapsedOnFirstRender ? { height: 0, overflow: 'hidden' } : undefined}
      >
        {entry.initiative && <p className='work-item__initiative'>{entry.initiative}</p>}
        <p className='work-item__description'>{entry.description}</p>
        {/* `role='list'` on both lists, because the stylesheet sets `list-style: none` and WebKit
            stops exposing such a list as a list. The `//` marker is generated content, so the items
            carry their text and nothing else. */}
        <ul className='work-item__highlights' role='list'>
          {entry.highlights.map((hightlight, i) => (
            <li key={i}>{hightlight}</li>
          ))}
        </ul>
        <ul className='work-item__tech' role='list'>
          {entry.tech.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}
