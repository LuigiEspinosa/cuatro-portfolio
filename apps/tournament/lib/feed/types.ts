/**
 * Hand-typed shapes for the timeline feed (Story 5.6). There are NO generated Supabase
 * types in this repo — we hand-type the row + the `detail` payload, mirroring the hand-typed
 * RPC-reply precedent (lib/match/approve.ts:33-40).
 *
 * Source of truth: migration 0017_aprobar_publish.sql (the `timeline_feed` DDL at :106-113 and
 * the `match_result` `detail` build at :392-405) + 0019_manual_score.sql:354-369 (manual rows).
 */

/** The three FR-31 entry types (0017:109 check constraint). Only `match_result` has a writer today. */
export type EntryType = 'match_result' | 'bracket_advance' | 'award_reveal';

/** A raw `timeline_feed` row as selected through the anon client. `detail` is opaque jsonb here. */
export interface FeedRow {
  id: number;
  tournament_id: number;
  entry_type: EntryType;
  occurred_at: string; // timestamptz — DISPLAY only, never the sort key
  target_match_id: number | null; // FK → match(id) ON DELETE SET NULL; tolerate null
  detail: unknown; // narrowed per entry_type below
}

/**
 * The `detail` payload for a `match_result` row (0017:397-404, + score_source/manual_override on
 * manual 0019 rows). ⚠ `winner_entry`/`loser_entry` are `roster_entry.id` (bigint) — NOT steamid64
 * and NOT display names. Resolving them to names is a required join (see lib/feed/read.ts).
 * `demo_sha256` is present only when a demo is bound.
 */
export interface MatchResultDetail {
  winner_entry: number;
  loser_entry: number;
  score_a: number;
  score_b: number;
  bracket_position: string | null;
  demo_sha256?: string | null;
  score_source?: string;
  manual_override?: boolean;
}
