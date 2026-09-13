'use client';

import { useEffect } from 'react';

/**
 * The `suite-reach` event, SM-1's numerator (Story 2-24, FR-34, AD-18).
 *
 * **This is the only client boundary the Directory has, and it renders nothing.** The two link
 * events cost two attributes on anchors `SuiteDirectory` already renders, because the deployed
 * tracker fires a custom event on any click inside `[data-umami-event]`; reach has no click to hang
 * on, so it is the one event that needs script. It imports nothing from `@/lib/registry`, which is
 * what `lib/__tests__/registry.test.ts` refuses of a client file, and it takes the heading's id as a
 * prop rather than knowing it.
 *
 * **Reach means the heading entered the viewport or is already above it.** `isIntersecting` is the
 * ordinary arrival; `boundingClientRect.bottom < 0` is a visitor who flicked past the heading before
 * the tracker had loaded, and the observer's initial notification answers both at once. The heading
 * rather than the section, because `/#suite`, the skip control and the nav link all resolve to it,
 * and a section would count a one-pixel sliver.
 *
 * **The root reaches far above the viewport, so "above" is a state the observer can see.** An
 * observer notifies on a change of intersection, and a jump past the heading between two frames
 * (End, Ctrl+End, a fast scrollbar drag) takes it from below the viewport to above it with no
 * intersection in between: against the bare viewport that is "not intersecting" both before and
 * after, and nothing fires. `ROOT_MARGIN` extends the root's top edge a hundred thousand pixels up,
 * so the heading intersects from the moment its top passes the viewport's bottom edge until it is
 * that far above, and the jump is a crossing. `EXPERIENCE.md:696` allows scroll work through an
 * observer and never through a raw `scroll` listener, and `tests/e2e/narrative.pw.ts` sweeps the
 * source for one; Operator ruling of 2026-09-12 chose the margin over accepting the gap.
 *
 * **The send waits for the tracker rather than assuming it.** `app/layout.tsx` injects the script
 * `afterInteractive`, so this effect usually runs before `window.umami` exists. It checks once at
 * once, for a tracker already present (a client navigation back to `/`), then polls, bounded, and
 * only then observes, so the initial notification covers a heading already in view. A tracker is
 * something with a `track` function, not anything that took the name. No tracker within the bound
 * (an ad blocker, or a build with no `NEXT_PUBLIC_UMAMI_*`) means nothing is observed and nothing
 * is sent.
 *
 * **Once per session is a `sessionStorage` flag**, keyed on the event name and set when the event
 * is sent. Both accesses sit inside `try`, as does the `track` call: a storage or a tracker that
 * throws never blocks the send and never escapes an observer callback.
 */
export const REACH_EVENT = 'suite-reach';

/** How often the tracker is looked for after the immediate check, and how many times: 80 ticks is 20 s. */
export const TRACKER_POLL_MS = 250;
export const TRACKER_POLL_LIMIT = 80;

/**
 * The observer's root, extended upward. Far larger than any document the Hub serves, so a heading
 * scrolled past stays "intersecting" rather than leaving the root at the top. Top only: the bottom
 * edge stays the viewport's, which is what makes the heading's arrival the event.
 */
export const ROOT_MARGIN = '100000px 0px 0px 0px';

/**
 * The tracker's global, declared here because `lib.dom.d.ts` does not carry it. Same reason and
 * same placement as `hooks/useNarrativePath.ts:60-69`: a top-level `types/` root would fail
 * `app/__tests__/anchor-contract.test.ts`. Optional, because the script is gated and may never load.
 */
declare global {
  interface Window {
    umami?: {
      track: (name: string, data?: Record<string, unknown>) => unknown;
    };
  }
}

const trackerReady = (): boolean => typeof window.umami?.track === 'function';

export function SuiteReach({ target }: { target: string }) {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    try {
      if (sessionStorage.getItem(REACH_EVENT) !== null) return;
    } catch {
      // A storage that throws never blocks the send.
    }

    let observer: IntersectionObserver | undefined;

    const send = () => {
      observer?.disconnect();
      try {
        window.umami?.track(REACH_EVENT);
      } catch {
        // A throwing tracker is the tracker's defect, and it must not escape a callback.
      }
      try {
        sessionStorage.setItem(REACH_EVENT, '1');
      } catch {
        // Once per session is a nicety; the send above is the point.
      }
    };

    const observe = () => {
      // The Directory is in the server HTML on `/`, so the heading is in the document before this
      // runs. Nothing retries a missing heading, because nothing later would put one there.
      const heading = document.getElementById(target);
      if (heading === null) return;
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting || entry.boundingClientRect.bottom < 0)) send();
        },
        { rootMargin: ROOT_MARGIN }
      );
      observer.observe(heading);
    };

    let poll: ReturnType<typeof setInterval> | undefined;
    if (trackerReady()) {
      observe();
    } else {
      let ticks = 0;
      poll = setInterval(() => {
        const ready = trackerReady();
        if (!ready && ++ticks < TRACKER_POLL_LIMIT) return;
        clearInterval(poll);
        if (ready) observe();
      }, TRACKER_POLL_MS);
    }

    return () => {
      clearInterval(poll);
      observer?.disconnect();
    };
  }, [target]);

  return null;
}
