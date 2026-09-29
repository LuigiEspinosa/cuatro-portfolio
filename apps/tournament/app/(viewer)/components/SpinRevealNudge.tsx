'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CEREMONY_EVENTS, ceremonyTopic } from '@/lib/realtime/status';
import { releaseChannel, retainChannel } from './realtime-channels';

/**
 * The `spin.reveal` consumer (Story 6.10, AC6 — DECISION F, closed at last).
 *
 * ⭐⭐ THIS IS THE OTHER HALF OF A SEAM THAT HAS BEEN OPEN SINCE 6.8b. `reveal_spin` has emitted
 * `spin.reveal` on `ceremony:<id>` since `0028:872-886` and it has been *"consumed by NOBODY"* —
 * DECISION F deliberately withheld the consumer until the UI that needs it existed, and accepted the
 * consequence in writing: *"a viewer sitting on the feed during the ceremony does not see the new
 * card until they reload"* (`6-8b:827-834`). This file is that consumer, and it ships in the same
 * commit as the reveal it drives, exactly as DECISION F requires.
 *
 * ⛔ IT RENDERS NOTHING, AND THAT IS THE POINT. The reveal is a Server Component tree resolved from
 * reveal-gated tables; this island's entire job is to call `router.refresh()` so that tree re-reads.
 * ⛔ The payload is NEVER read as state and a missed event is NEVER replayed (AD-11): `spin.reveal`
 * carries `spin_index`, `revealed_spins` and `ceremony_complete`, and trusting any of them would make
 * the surface depend on a delivery guarantee Broadcast does not offer — `realtime.send` swallows its
 * own errors BY DESIGN so a Realtime hiccup can never abort a reveal (`0028:863-867`). The reveal is
 * a ROW STATE (`spin.revealed_at`); a reload always shows the correct ceremony, with or without this
 * island. That is AD-11, and it is why this file can be four lines of effect.
 *
 * ⚠ HOLDING LAST-KNOWN TRUTH WHILE DISCONNECTED IS STRUCTURAL HERE (UX-DR54/55/56): there is no
 * client state to wipe and nothing to invent. The quiet `Reconectando…` is the shell's `LivePill`,
 * which reflects the SAME websocket transport — Supabase multiplexes every topic over one socket, so
 * a drop that silences `ceremony:<id>` silences `tournament:<id>` too and the pill already says so.
 *
 * ⛔ NOT A SECOND `.channel()`. It retains the topic-keyed store `RealtimeNudge` uses (DECISION W);
 * the StrictMode dead-subscription reasoning lives there, once.
 *
 * ⭐⭐ CODE REVIEW 2026-08-11 — IT LIVES IN `components/` BECAUSE TWO ROUTES MOUNT IT, AND THE SECOND
 * ONE IS THE POINT. `/ceremonia` was the only consumer, so the gap DECISION F actually named — *"a
 * viewer sitting on THE FEED during the ceremony does not see the new card until they reload"* — was
 * still wide open even though Task 7 was checked off. The feed (`/`) now retains the same
 * `ceremony:<id>` topic while the tournament is in `ceremony` state, which closes it. ⛔ `spin.reveal`
 * is still NOT in `NUDGE_EVENTS`: AC6 forbids that by name, and it is unnecessary — two islands
 * retaining one topic is exactly what the ref-counted store was generalised to do.
 */
export function SpinRevealNudge({ ceremonyId }: { ceremonyId: number }) {
  const router = useRouter();
  const topic = ceremonyTopic(ceremonyId);

  useEffect(() => {
    // ⚠ COALESCED at `COALESCE_MS = 300` inside the store, so a burst of reveals collapses to ONE
    // refresh — comfortably inside the ~2 s budget FR-31 and AC6 both name.
    retainChannel(topic, CEREMONY_EVENTS, () => router.refresh());
    return () => releaseChannel(topic);
  }, [topic, router]);

  return null;
}
