'use client';

import { useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { WorkItem } from '@/components/atoms/WorkItem/WorkItem';
import { useGsapContext } from '@/hooks/useGsapContext';
import { work } from '@/content/work';
import './WorkTimeline.scss';

export function WorkTimeline() {
  const [openId, setOpenId] = useState<string | null>(work[0].id);

  // If the list grows beyond 20 entries, the initial batch on page
  // load many animate too many times simultaneously. Add a `batchMax` option then.
  const listRef = useGsapContext<HTMLUListElement>(() => {
    ScrollTrigger.batch('.work-item', {
      onEnter: (batch) =>
        gsap.from(batch, {
          y: 40,
          opacity: 0,
          stagger: 0.1,
          duration: 0.6,
          ease: 'power2.out',
        }),
      start: 'top 85%',
    });
  }, []);

  const handleToggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <ul className='work-timeline' ref={listRef}>
      {work.map((entry) => (
        <li key={entry.id}>
          <WorkItem
            entry={entry}
            isOpen={openId === entry.id}
            onToggle={() => handleToggle(entry.id)}
          />
        </li>
      ))}
    </ul>
  );
}
