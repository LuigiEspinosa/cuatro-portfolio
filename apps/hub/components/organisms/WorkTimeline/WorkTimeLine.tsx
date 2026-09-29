'use client';

import { useState } from 'react';
import { WorkItem } from '@/components/atoms/WorkItem/WorkItem';
import { work } from '@/content/work';
import './WorkTimeline.scss';

/**
 * The work timeline, mounted by `/work` and by `/cv` (Stories 2-16 and 2-33).
 *
 * **The rows simply exist.** Until Story 2-33 a `ScrollTrigger.batch` faded every row up from 40px as
 * it scrolled into view, with no motion preference read: the universal scroll-triggered fade-up
 * `EXPERIENCE.md` § Motion bans, and a second entrance on a route whose one entrance is the hero's.
 * Deleting it was ruled a presentation change on 2026-09-15, so the structure, the props and the
 * disclosure Story 2-16 built are what they were.
 */
export function WorkTimeline() {
  const [openId, setOpenId] = useState<string | null>(work[0]?.id ?? null);

  const handleToggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    // `role='list'` because `list-style: none` drops list semantics in WebKit, so a screen reader
    // there would not hear a list of four (the Story 2-31 and 2-32 precedent).
    <ul className='work-timeline' role='list'>
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
