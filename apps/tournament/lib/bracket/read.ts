import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveNames } from '@/lib/roster/names';
import {
  type BracketGroups,
  type MatchRow,
  collectCompetitorIds,
  groupBracket,
} from '@/lib/bracket/model';

/**
 * The reusable bracket snapshot read (Story 5.7, AC2/AC3/AC7/AC8) — a self-contained function taking
 * `(client, tournamentId)` so Story 5.8 can re-invoke it verbatim on a realtime nudge / reconnect (it must
 * never replay events). It reads `public.match` (viewer-readable only after migration 0022), batch-resolves
 * competitor names + seeds, and returns the fully-shaped, grouped snapshot. The surface does no further data
 * work (AC8).
 *
 * ⚠ Read path: the caller MUST pass the anon, RLS-respecting `createSupabaseServerClient()` — NEVER the
 * service-role admin client. A pending/live score never leaks because the model renders a score ONLY for
 * resolved/manual_resolved states (AC2/AC3); stat rows stay gated at `stat_row` (0009, AD-7).
 */

export type BracketSnapshot =
  | { ok: true; groups: BracketGroups }
  | { ok: false; reason: 'read_failed' };

/**
 * Read + fully resolve a tournament's bracket.
 *
 * 1. `match where tournament_id = $1 order by bracket_slot` (the anon client; uses match_tournament_bracket_idx).
 * 2. Batch-resolve competitor names (shared roster→player resolver) + seeds (roster_entry.bracket_seed), each
 *    ONE `in(...)` query over the whole id set.
 * 3. Group by bracket, order by bracket_slot, drop void nodes, mark the champion — via the pure model.
 * Empty bracket → `{ ok: true, groups: {three empty arrays} }` (the surface shows its pre-bracket empty state).
 */
export async function fetchBracketSnapshot(
  client: SupabaseClient,
  tournamentId: number,
): Promise<BracketSnapshot> {
  const { data, error } = await client
    .from('match')
    .select(
      'id, tournament_id, bracket, bracket_position, bracket_slot, gf_order, competitor_a, competitor_b, winner_entry, score_a, score_b, state, demo_id',
    )
    .eq('tournament_id', tournamentId)
    .order('bracket_slot', { ascending: true })
    // Secondary key: the grand final is two rows at the SAME bracket_slot=0 (game 1 gf_order=1, reset
    // gf_order=2 — generate.ts:458-463). Without this the reset can sort above the game it resets.
    .order('gf_order', { ascending: true, nullsFirst: true });
  if (error) {
    console.error('[fetchBracketSnapshot] match read failed:', error.message);
    return { ok: false, reason: 'read_failed' };
  }

  const matches = (data ?? []) as MatchRow[];
  if (matches.length === 0) {
    return { ok: true, groups: { winners: [], losers: [], grandFinal: [] } };
  }

  const ids = collectCompetitorIds(matches);
  const [names, seeds] = await Promise.all([
    resolveNames(client, ids),
    resolveSeeds(client, ids),
  ]);

  return { ok: true, groups: groupBracket(matches, names, seeds) };
}

/**
 * roster_entry.id → bracket_seed, one batched `in(...)` query. Non-fatal: any error yields an empty map so
 * nodes render without a seed chip rather than blanking the bracket (a broken seed join must not hide the
 * structure). The seed lives on roster_entry (0004:30); the active-only viewer policy means a removed player
 * simply has no seed, which is the same graceful-degradation posture as the name resolve.
 */
async function resolveSeeds(client: SupabaseClient, rosterIds: number[]): Promise<Map<number, number>> {
  const seeds = new Map<number, number>();
  if (rosterIds.length === 0) return seeds;

  const { data, error } = await client
    .from('roster_entry')
    .select('id, bracket_seed')
    .in('id', rosterIds);
  if (error || !data) {
    if (error) console.error('[fetchBracketSnapshot] seed resolve failed:', error.message);
    return seeds;
  }
  for (const r of data as Array<{ id: number; bracket_seed: number | null }>) {
    if (r.bracket_seed != null) seeds.set(r.id, r.bracket_seed);
  }
  return seeds;
}
