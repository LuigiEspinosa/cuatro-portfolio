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

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    // Skip animation on the first render
    // Set state directly so the initially open entry shows its content
    // without a flash of collapsed height
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
    <article className='work-item'>
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
        style={{ height: 0, overflow: 'hidden' }}
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
