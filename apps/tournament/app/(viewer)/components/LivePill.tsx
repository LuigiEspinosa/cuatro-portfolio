'use client';

import { es } from '@/lib/i18n/es';
import type { IndicatorToken } from '@/lib/realtime/status';
import styles from '../viewer.module.css';

/**
 * The topbar live pill (Story 5.8, AC5/AC6) — now CONNECTION-AWARE. It replaces the static server span
 * (old `layout.tsx:39-42`): the `RealtimeNudge` island computes the token from the live channel status
 * layered over the server-resolved tournament state and hands it here. Purely presentational.
 *
 * Copy is ALL from `lib/i18n/es` (AD-24 — no inline literals); this is the extended `PILL_COPY` the story
 * calls for, with `reconnecting`/`loading` added (the strings already existed at `es.live.*`). Variants
 * reuse `viewer.module.css` `.pill*` + `@keyframes pulse` — no new palette, no new component shell. The
 * reconnect tone is the MUTED `.pillSoft` (never alarm-red — DESIGN.md:263). `aria-live="polite"` announces
 * every state change (EXPERIENCE.md:145).
 */
const PILL_COPY: Record<IndicatorToken, string> = {
  live: es.live.on,
  off: es.live.off,
  final: es.live.final,
  reconnecting: es.live.reconnecting,
  loading: es.live.loading,
};

const PILL_CLASS: Record<IndicatorToken, string> = {
  live: styles.pillLive,
  final: styles.pillDone,
  off: styles.pillSoft,
  reconnecting: styles.pillSoft, // muted, quiet — never red (UX-DR56 / DESIGN.md:263)
  loading: styles.pillSoft,
};

export function LivePill({ token }: { token: IndicatorToken }) {
  return (
    <span className={`${styles.pill} ${PILL_CLASS[token]}`} aria-live="polite">
      <span className={styles.pulse} aria-hidden="true" />
      {PILL_COPY[token]}
    </span>
  );
}
