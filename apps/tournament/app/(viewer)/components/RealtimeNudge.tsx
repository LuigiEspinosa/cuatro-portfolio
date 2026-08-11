'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { indicatorToken, NUDGE_EVENTS, tournamentTopic } from '@/lib/realtime/status';
import type { TournamentState } from '@/lib/feed/read';
import { channelStatus, releaseChannel, retainChannel, subscribeChannelStatus } from './realtime-channels';
import { LivePill } from './LivePill';

/**
 * The realtime subscription island (Story 5.8, AC2/AC3/AC4) — the whole consumer half of AD-11. It owns THE
 * single per-tab `tournament:<id>` channel + the connection status, and renders the connection-aware pill.
 *
 * MODEL (the doorbell, not the mail): the server already Broadcasts a NUDGE on `tournament:<id>` after every
 * Aprobar/advance/rollback/manual-resolve. On ANY nudge we call `router.refresh()` — which re-executes the
 * current route's `force-dynamic` Server Components, re-invoking the existing Approved-only readers and
 * reconciling the RSC tree IN PLACE (id-keyed lists keep scroll — EXPERIENCE.md:134). We NEVER read the
 * broadcast payload as state and NEVER replay missed events (AD-11). `router.refresh()` is the only
 * re-fetch seam; this island imports NO `server-only` reader and does NO browser data read.
 *
 * RECONNECT (AC4): on a FRESH `SUBSCRIBED` after a prior drop, fire exactly one silent reconcile to current
 * Approved truth — no backlog replay. While the channel is down the pill shows a quiet `Reconectando…` and
 * the last-rendered DOM stays on screen (never wiped — UX-DR56 / EXPERIENCE.md:120).
 *
 * ⭐ STORY 6.10 (DECISION W) — THE STORE MOVED, THE SEMANTICS DID NOT. The module-level ref-counted
 * singleton that made this correct under StrictMode now lives in `./realtime-channels.ts`, keyed by
 * TOPIC, so `spin.reveal` can reuse it on `ceremony:<id>` instead of opening a second ad-hoc
 * `.channel()` — the known-broken pattern that left 5.8 with a DEAD subscription and bounced that
 * story `review → in-progress → done` (`epic-5-retro:53`). ⚠ An id change is now simply a different
 * key rather than a rebuild branch; every other property (subscribe once, retain by ref-count, tear
 * down on a deferred tick) is preserved verbatim, and the reasoning lives at the store.
 *
 * `tournamentId === null` (no tournament resolved) ⇒ render the shell pill (`loading`) and open no channel.
 */
export function RealtimeNudge({
  tournamentId,
  state,
}: {
  tournamentId: number | null;
  state: TournamentState | null;
}) {
  const router = useRouter();
  const topic = tournamentId === null ? null : tournamentTopic(tournamentId);

  const subscribe = useCallback(
    (listener: () => void) => (topic === null ? () => {} : subscribeChannelStatus(topic, listener)),
    [topic],
  );
  const snapshot = useCallback(() => (topic === null ? null : channelStatus(topic)), [topic]);
  // ⚠ The server snapshot is `null` so the client's FIRST render EQUALS the server render — the pill
  // resolves to the base state and there is no hydration flash.
  const status = useSyncExternalStore(subscribe, snapshot, () => null);

  useEffect(() => {
    if (topic === null) return;
    retainChannel(topic, NUDGE_EVENTS, () => router.refresh());
    return () => releaseChannel(topic);
  }, [topic, router]);

  return <LivePill token={indicatorToken(status, state)} />;
}
