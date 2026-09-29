import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveNames } from '@/lib/roster/names';
import {
  type PlayerDetailModel,
  type PlayerHeadline,
  type RawPlayerMatch,
  buildPlayerDetail,
} from '@/lib/player/model';

/**
 * The reusable player-detail read (Story 5.7, AC6/AC7/AC8) — a self-contained function taking
 * `(client, steamid64)` so Story 5.8 can re-invoke it verbatim. Reads through the anon, RLS-respecting
 * `createSupabaseServerClient()` (NEVER service-role):
 *   1. the player's ONE `public.leaderboard` row (headline + weird totals — AD-20 single site);
 *   2. their `roster_entry` (seed + the roster id, to orient the matches-behind list);
 *   3. their approved `stat_row` rows joined to `match` (bracket_position, opponent, score) — a RAW per-match
 *      listing (FR-23), NOT a re-aggregation; the `stat_view` approved-only policy (0009) keeps pending out.
 * No leaderboard row → a graceful not-found (the player never played, or all their matches idle-DQ'd → they
 * VANISH from the view by design; AC7 of Story 5.5) — never a blank screen.
 */

export type PlayerDetailResult =
  | { ok: true; detail: PlayerDetailModel }
  | { ok: false; reason: 'not_found' | 'read_failed' };

const HEADLINE_COLS =
  'steamid64, display_name, kills_total, deaths_total, assists_total, adr, hs_pct, kast_pct, ' +
  'knife_kills_total, wallbang_kills_total, through_smoke_kills_total, no_scope_kills_total, blind_kills_total';

/** The PostgREST FK-embed shape: stat_row.match_id → match(...). Embedded `match` is a single object (many-to-one). */
interface StatRowEmbed {
  match_id: number | null;
  match: {
    bracket_position: string | null;
    competitor_a: number | null;
    competitor_b: number | null;
    winner_entry: number | null;
    score_a: number | null;
    score_b: number | null;
    state: string;
    demo_id: number | null;
  } | null;
}

export async function fetchPlayerDetail(
  client: SupabaseClient,
  steamid64: string,
): Promise<PlayerDetailResult> {
  // 1. headline — the ONE leaderboard row (AD-20).
  const { data: headline, error: headErr } = await client
    .from('leaderboard')
    .select(HEADLINE_COLS)
    .eq('steamid64', steamid64)
    .maybeSingle();
  if (headErr) {
    console.error('[fetchPlayerDetail] leaderboard read failed:', headErr.message);
    return { ok: false, reason: 'read_failed' };
  }
  if (!headline) {
    return { ok: false, reason: 'not_found' };
  }

  // 2. roster identity (seed + the roster_entry.id used to orient the matches list). Non-fatal.
  const { data: roster } = await client
    .from('roster_entry')
    .select('id, bracket_seed')
    .eq('steamid64', steamid64)
    .limit(1)
    .maybeSingle();
  const playerRosterId = (roster?.id as number | undefined) ?? null;
  const seed = (roster?.bracket_seed as number | null | undefined) ?? null;

  // 3. matches behind them — approved stat rows joined to match (raw per-match context, not a re-aggregation).
  const { data: statRows, error: srErr } = await client
    .from('stat_row')
    .select(
      'match_id, match:match_id(bracket_position, competitor_a, competitor_b, winner_entry, score_a, score_b, state, demo_id)',
    )
    .eq('steamid64', steamid64)
    .eq('status', 'approved');
  if (srErr) console.error('[fetchPlayerDetail] stat_row read failed:', srErr.message);

  const rawMatches: RawPlayerMatch[] = ((statRows ?? []) as unknown as StatRowEmbed[])
    .filter((r): r is StatRowEmbed & { match_id: number; match: NonNullable<StatRowEmbed['match']> } =>
      r.match_id != null && r.match != null,
    )
    .map((r) => ({
      match_id: r.match_id,
      bracket_position: r.match.bracket_position,
      competitor_a: r.match.competitor_a,
      competitor_b: r.match.competitor_b,
      winner_entry: r.match.winner_entry,
      score_a: r.match.score_a,
      score_b: r.match.score_b,
      state: r.match.state,
      demo_id: r.match.demo_id,
    }));

  // 4. resolve opponent names (the same shared batched resolver).
  const opponentIds = new Set<number>();
  for (const m of rawMatches) {
    for (const v of [m.competitor_a, m.competitor_b]) {
      if (typeof v === 'number' && Number.isFinite(v)) opponentIds.add(v);
    }
  }
  const names = await resolveNames(client, [...opponentIds]);

  return {
    ok: true,
    detail: buildPlayerDetail(headline as unknown as PlayerHeadline, seed, playerRosterId, rawMatches, names),
  };
}
