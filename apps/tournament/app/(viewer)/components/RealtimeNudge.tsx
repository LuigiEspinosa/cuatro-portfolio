'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import {
  type ChannelStatus,
  type Clock,
  type Coalescer,
  COALESCE_MS,
  createCoalescer,
  indicatorToken,
  isReconnect,
  NUDGE_EVENTS,
} from '@/lib/realtime/status';
import type { TournamentState } from '@/lib/feed/read';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { LivePill } from './LivePill';

/**
 * The realtime subscription island (Story 5.8, AC2/AC3/AC4) — the FIRST `.channel()`/`.subscribe()` in the
 * repo, and the whole consumer half of AD-11. It owns THE single per-tab channel + the connection status,
 * and renders the connection-aware pill directly (Task 4 folded in).
 *
 * MODEL (the doorbell, not the mail): the server already Broadcasts a NUDGE on `tournament:<id>` after every
 * Aprobar/advance/rollback/manual-resolve. On ANY nudge we call `router.refresh()` — which re-executes the
 * current route's `force-dynamic` Server Components, re-invoking the existing Approved-only readers and
 * reconciling the RSC tree IN PLACE (id-keyed lists keep scroll — EXPERIENCE.md:134). We NEVER read the
 * broadcast payload as state and NEVER replay missed events (AD-11). `router.refresh()` is the only
 * re-fetch seam; this island imports NO `server-only` reader and does NO browser data read.
 *
 * RECONNECT (AC4): on a FRESH `SUBSCRIBED` after a prior drop, fire exactly one silent reconcile to current
 * Approved truth — no backlog replay (there is no event log; the surfaces are re-derived from published
 * state). While the channel is down the pill shows a quiet `Reconectando…` and the last-rendered DOM stays
 * on screen (never wiped — UX-DR56 / EXPERIENCE.md:120).
 *
 * ONE CHANNEL PER TAB (AC1): the channel + status live in a module-level singleton store, NOT in per-mount
 * `useState`/`supabase.channel()`. This is required for correctness, not just tidiness: `removeChannel()` is
 * async (it awaits an unsubscribe round-trip) while React StrictMode runs setup→cleanup→setup synchronously,
 * so a per-mount `supabase.channel(topic)` on the second mount would get the still-`leaving` channel back
 * from the client's topic-dedup and `subscribe()` would skip wiring the callbacks (`isClosed()` gate) —
 * leaving the live instance with a DEAD subscription (no nudges, no reconnect). The singleton subscribes
 * exactly once, is retained by ref-count, and is torn down on a deferred tick so the StrictMode remount just
 * re-retains it. Every mounted island reads the shared status via `useSyncExternalStore`.
 *
 * `tournamentId === null` (no tournament resolved) ⇒ render the shell pill (`loading`) and open no channel.
 */

/** The real browser clock for the coalescer (`window.setTimeout` returns `number` = our `TimerHandle`). */
const browserClock: Clock = {
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (handle) => window.clearTimeout(handle),
};

// --- Module-level singleton subscription store (one channel per tab) --------------------------------------
let channel: RealtimeChannel | null = null;
let boundTournamentId: number | null = null;
let coalescer: Coalescer | null = null;
let status: ChannelStatus | null = null;
let prevStatus: ChannelStatus | null = null;
let refCount = 0;
let teardownTimer: number | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribeStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function hardTeardown() {
  coalescer?.cancel();
  if (channel) createSupabaseBrowserClient().removeChannel(channel);
  channel = null;
  boundTournamentId = null;
  coalescer = null;
  status = null;
  prevStatus = null;
  refCount = 0;
  emit();
}

/** Open the single channel for `tournamentId` if not already open (idempotent). Rebuilds on an id change. */
function ensureChannel(tournamentId: number, refresh: () => void) {
  if (channel && boundTournamentId !== tournamentId) hardTeardown();
  if (channel) return;

  boundTournamentId = tournamentId;
  const supabase = createSupabaseBrowserClient();
  coalescer = createCoalescer(refresh, COALESCE_MS, browserClock);

  const ch = supabase.channel(`tournament:${tournamentId}`);
  for (const event of NUDGE_EVENTS) {
    // Every nudge → the SAME coalesced refresh; the event name is only for the (dev) log below.
    ch.on('broadcast', { event }, () => {
      if (process.env.NODE_ENV !== 'production') console.debug('[realtime] nudge', event);
      coalescer?.trigger();
    });
  }
  ch.subscribe((next) => {
    const nextStatus = next as ChannelStatus;
    // A fresh SUBSCRIBED after a drop = reconnect ⇒ one silent reconcile (AC4), routed through the SAME
    // coalescer as nudges so a reconnect coinciding with a buffered nudge collapses to one refresh (and a
    // flapping connection can't fire an uncoalesced refresh per SUBSCRIBED). The FIRST subscribe is not a
    // reconnect (server already rendered current truth) — so no redundant / StrictMode-doubled fetch.
    if (isReconnect(prevStatus, nextStatus)) coalescer?.trigger();
    prevStatus = nextStatus;
    status = nextStatus;
    emit();
  });
  channel = ch;
}

function retain(tournamentId: number, refresh: () => void) {
  if (teardownTimer !== null) {
    window.clearTimeout(teardownTimer);
    teardownTimer = null;
  }
  ensureChannel(tournamentId, refresh);
  refCount++;
}

function release() {
  refCount--;
  if (refCount <= 0) {
    // Deferred so StrictMode's synchronous remount (which re-retains) cancels it — the channel survives the
    // fake unmount and is only actually removed on a real unmount.
    teardownTimer = window.setTimeout(() => {
      teardownTimer = null;
      if (refCount <= 0) hardTeardown();
    }, 0);
  }
}
// ----------------------------------------------------------------------------------------------------------

export function RealtimeNudge({
  tournamentId,
  state,
}: {
  tournamentId: number | null;
  state: TournamentState | null;
}) {
  const router = useRouter();
  const channelStatus = useSyncExternalStore(
    subscribeStore,
    () => status,
    () => null,
  );

  useEffect(() => {
    if (tournamentId === null) return;
    retain(tournamentId, () => router.refresh());
    return () => release();
  }, [tournamentId, router]);

  return <LivePill token={indicatorToken(channelStatus, state)} />;
}
