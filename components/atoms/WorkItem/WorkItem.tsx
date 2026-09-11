'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { type WorkEntry } from '@/content/work';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import './WorkItem.scss';

interface WorkItemProps {
  entry: WorkEntry;
  isOpen: boolean;
  onToggle: () => void;
}

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
   * **Read from a ref rather than from `isOpen` directly, and that is load-bearing.** React diffs
   * the `style` prop and clears any key that leaves it, so a prop that flipped to `undefined` on
   * open would wipe the very inline `height` and `overflow` GSAP is mid-way through owning: the
   * effect below would then measure a panel already at its full height and tween it to the height
   * it is already at, which is the accordion's animation silently becoming a jump. Frozen here, the
   * prop never changes after the first render, GSAP keeps sole ownership of the DOM, and the
   * behaviour Story 2-33 is required not to alter is exactly what it was.
   *
   * The value is deterministic on both sides, `isOpen` being decided by
   * `WorkTimeLine.tsx:14`'s `useState` initializer from the same list, so this adds no hydration
   * branch and no read of anything the server cannot see.
   */
  const collapsedOnFirstRender = useRef<boolean>(!isOpen);

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

    if (isOpen) {
      const targetHeight = el.scrollHeight;
      gsap.set(el, { overflow: 'hidden' });
      tween = gsap.to(el, {
        height: targetHeight,
        duration: duration ?? 0.4,
        ease: 'power2.out',
        onComplete: () => {
          gsap.set(el, { height: 'auto', overflow: '' });
        },
      });
    } else {
      gsap.set(el, { height: el.offsetHeight, overflow: 'hidden' });
      tween = gsap.to(el, {
        height: 0,
        duration: duration ?? 0.3,
        ease: 'power2.in',
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
          <h2 className='work-item__company'>{entry.company}</h2>
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

      <div
        id={`${entry.id}-content`}
        className='work-item__content'
        ref={contentRef}
        style={collapsedOnFirstRender.current ? { height: 0, overflow: 'hidden' } : undefined}
      >
        {entry.initiative && <p className='work-item__initiative'>{entry.initiative}</p>}
        <p className='work-item__description'>{entry.description}</p>
        <ul className='work-item__highlights'>
          {entry.highlights.map((hightlight, i) => (
            <li key={i}>{hightlight}</li>
          ))}
        </ul>
        <ul className='work-item__tech'>
          {entry.tech.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}
