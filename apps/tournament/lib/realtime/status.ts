import type { TournamentState } from '@/lib/feed/read';

/**
 * The pure, framework-free half of the realtime layer (Story 5.8, AD-11 "reconnect-reconcile").
 *
 * This module is REACHED FROM THE BROWSER (imported by the `'use client'` subscription island), so it
 * must never pull in a `server-only` module at runtime. `TournamentState` is imported **type-only**
 * (erased under `verbatimModuleSyntax`, so `lib/feed/read.ts`'s `import 'server-only'` never enters the
 * client bundle). The base pill mapping is RE-DERIVED here rather than importing `livePillState` (which is
 * a runtime export of that server-only reader) — pinned by the unit tests below so it cannot drift.
 *
 * Everything here is deterministic and clock-injectable, so the whole file is unit-tested under
 * node-Vitest with faked inputs (mirrors `lib/feed/read.test.ts`). The subscription island that consumes
 * it is thin glue verified by live-QA (no jsdom/RTL in the repo).
 */

/** The four Supabase channel statuses delivered to a `.subscribe((status) => …)` callback. */
export type ChannelStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';

/** The topbar-pill indicator token (drives copy + `.pill*` variant). `live` is the connected `bracket_live` state. */
export type IndicatorToken = 'live' | 'off' | 'final' | 'reconnecting' | 'loading';

/**
 * The four SHIPPED semantic broadcast events on `tournament:<id>` (server-emitted, post-commit —
 * `0017:439`, `0013:848`/`0014`, `0018:377`, `0019:377`). The action on any of them is identical
 * (re-fetch published truth); the name matters only for logging/announcement.
 */
export const NUDGE_EVENTS = [
  'match.approved',
  'bracket.advanced',
  'match.rolled_back',
  'match.manual_resolved',
] as const;

/** Coalesce window (ms): a burst of nudges collapses to ONE `router.refresh()`, well inside the ~2 s budget. */
export const COALESCE_MS = 300;

/**
 * Mirrors `livePillState` (`lib/feed/read.ts`) — re-derived, not imported, because that reader is
 * `import 'server-only'` and this reducer is reached from the browser. Kept in lockstep by unit tests.
 */
function basePillState(state: TournamentState): 'on' | 'off' | 'final' {
  if (state === 'bracket_live') return 'on';
  if (state === 'ceremony' || state === 'closed') return 'final';
  return 'off'; // registration_open / registration_closed — sin transmisión
}

/**
 * Reduce the realtime connection status + the server-resolved tournament state to the pill token (AC5/AC6).
 *
 * - `state === null` (no tournament resolved) ⇒ `loading` (`Cargando el evento…`) — the cold/no-event case
 *   (Task 5 guard). Never a blank pill (EXPERIENCE.md:108).
 * - `channel === null` (pre-subscribe / SSR) or `SUBSCRIBED` ⇒ the base state (`live`/`off`/`final`). The
 *   `null` case makes the client's first render EQUAL the server render (no hydration flash).
 * - any dropped status (`CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`) ⇒ `reconnecting`, OVERRIDING the base state —
 *   including `final`, because freshness still matters mid-ceremony ([decision-final-reconnect]).
 */
export function indicatorToken(
  channel: ChannelStatus | null,
  state: TournamentState | null,
): IndicatorToken {
  if (state === null) return 'loading';
  if (channel === null || channel === 'SUBSCRIBED') {
    const base = basePillState(state);
    return base === 'on' ? 'live' : base === 'final' ? 'final' : 'off';
  }
  return 'reconnecting';
}

/**
 * True only for a FRESH `SUBSCRIBED` after a prior drop — the reconnect that must fire exactly ONE silent
 * `router.refresh()` (AC4). The very first subscribe (`prev === null`) is NOT a reconnect: the server
 * already rendered current truth, so refreshing then would be a redundant (and StrictMode-doubling) fetch.
 * A `SUBSCRIBED → SUBSCRIBED` repeat is likewise not a reconnect.
 */
export function isReconnect(prev: ChannelStatus | null, next: ChannelStatus): boolean {
  return next === 'SUBSCRIBED' && prev !== null && prev !== 'SUBSCRIBED';
}

/** Opaque timer handle (browser `window.setTimeout` returns `number`; the fake test clock matches). */
export type TimerHandle = number;

/** Injectable clock so the coalescer is deterministically testable (real clock lives in the browser island). */
export interface Clock {
  setTimeout(fn: () => void, ms: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}

export interface Coalescer {
  /** Schedule the action; a call within the window RESTARTS the timer, so a burst collapses to one run. */
  trigger(): void;
  /** Drop any pending run (unmount cleanup). */
  cancel(): void;
}

/**
 * Trailing debounce (AC2 burst-coalesce): N `trigger()`s within `windowMs` fire `action` exactly once,
 * `windowMs` after the LAST trigger. A single Aprobar already emits one Broadcast (the fold rule), but
 * rapid successive admin actions could stack — this guarantees one re-fetch per burst.
 */
export function createCoalescer(action: () => void, windowMs: number, clock: Clock): Coalescer {
  let handle: TimerHandle | null = null;
  return {
    trigger() {
      if (handle !== null) clock.clearTimeout(handle);
      handle = clock.setTimeout(() => {
        handle = null;
        action();
      }, windowMs);
    },
    cancel() {
      if (handle !== null) {
        clock.clearTimeout(handle);
        handle = null;
      }
    },
  };
}
