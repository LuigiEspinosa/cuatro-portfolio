import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LeaderboardRow } from '@/lib/leaderboard/model';

/**
 * The reusable leaderboard read (Story 5.7, AC4/AC8) — a self-contained function taking `(client)` so Story
 * 5.8 can re-invoke it verbatim on a realtime nudge (it must never replay events). Reads the SINGLE
 * `public.leaderboard` view ONCE through the anon client (AD-20) and returns the raw per-player rows; the
 * board filtering/ordering/formatting is the pure model's job (the toggle re-ranks client-side off these).
 *
 * The view is EVENT-GLOBAL (not tournament-scoped) — correct for this single event (same posture as 5.6's
 * resolveCurrentTournament); a second tournament would need a scope predicate (out of scope, single-event).
 * ⚠ Anon client only — the view is `security_invoker=on`, so the caller's stat_row RLS (approved-only, 0009)
 * applies: a pending row never contributes.
 */

export type LeaderboardSnapshot =
  | { ok: true; rows: LeaderboardRow[] }
  | { ok: false; reason: 'read_failed' };

export async function fetchLeaderboard(client: SupabaseClient): Promise<LeaderboardSnapshot> {
  const { data, error } = await client
    .from('leaderboard')
    .select(
      'steamid64, display_name, matches_played, rounds_played_total, kills_total, adr, kast_pct, hs_pct, ' +
        'deaths_total, assists_total, knife_kills_total, wallbang_kills_total, through_smoke_kills_total, ' +
        'no_scope_kills_total, blind_kills_total, entry_frags_total, opening_deaths_total, ' +
        'meets_round_floor, meets_kill_floor, eligible_rate',
    );
  if (error) {
    console.error('[fetchLeaderboard] leaderboard read failed:', error.message);
    return { ok: false, reason: 'read_failed' };
  }
  return { ok: true, rows: (data ?? []) as unknown as LeaderboardRow[] };
}
