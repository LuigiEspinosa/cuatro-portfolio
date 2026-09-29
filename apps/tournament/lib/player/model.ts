import { es } from '@/lib/i18n/es';
import { formatPct, formatRate, nameOfRow } from '@/lib/leaderboard/model';

/**
 * Pure player-detail view-model (Story 5.7, Task 7/AC6). The headline/aggregate numbers come from the
 * player's SINGLE `public.leaderboard` row (AD-20 single site — NOT a re-aggregation); the weird demo-only
 * totals come from the same row; the "matches behind them" list (FR-23) is a RAW per-match listing of the
 * player's approved stat rows joined to `match` (bracket position, opponent, score) — display only, never a
 * re-aggregation. No React, no DB here.
 */

/** The subset of the leaderboard row the player headline reads (a narrow hand-typed view). */
export interface PlayerHeadline {
  steamid64: string;
  display_name: string | null;
  kills_total: number;
  deaths_total: number;
  assists_total: number;
  adr: number | string | null;
  hs_pct: number | string | null;
  kast_pct: number | string | null;
  knife_kills_total: number;
  wallbang_kills_total: number;
  through_smoke_kills_total: number;
  no_scope_kills_total: number;
  blind_kills_total: number;
}

/** One raw stat_row×match row for the matches-behind list (the embedded `match` fields, flattened). */
export interface RawPlayerMatch {
  match_id: number;
  bracket_position: string | null;
  competitor_a: number | null;
  competitor_b: number | null;
  winner_entry: number | null;
  score_a: number | null;
  score_b: number | null;
  state: string;
  demo_id: number | null;
}

export interface PlayerMatchLine {
  matchId: number;
  position: string;
  opponent: string;
  outcome: 'win' | 'loss' | null; // relative to THIS player; null when the match is not scored
  scoreSelf: number | null;
  scoreOpp: number | null;
  verified: boolean;
}

export interface WeirdStat {
  key: string;
  label: string;
  value: number;
}

export interface PlayerDetailModel {
  steamid64: string;
  name: string;
  seed: number | null;
  base: { kda: string; adr: string; hsPct: string; kast: string };
  weird: WeirdStat[];
  matches: PlayerMatchLine[];
  verified: boolean; // any approved match has a bound demo → the provenance line reads "Verificado desde el demo"
}

const isScored = (state: string): boolean => state === 'resolved' || state === 'manual_resolved';

function matchLine(
  m: RawPlayerMatch,
  playerRosterId: number | null,
  names: Map<number, string>,
): PlayerMatchLine {
  const playerIsA = playerRosterId != null && m.competitor_a === playerRosterId;
  const playerIsB = playerRosterId != null && m.competitor_b === playerRosterId;
  // Orientation requires knowing which seat this player occupied. A player REMOVED after playing has no
  // active roster_entry (the anon policy is active-only), so `playerRosterId` is null and we cannot orient —
  // do NOT fabricate a seat: that would show every match as a loss, swap seat-B scores, and (via the old
  // `competitor_b ?? competitor_a` fallback) list the player as their own opponent. Degrade to a neutral row.
  const oriented = playerIsA || playerIsB;
  const opponentId = playerIsA ? m.competitor_b : playerIsB ? m.competitor_a : null;
  const opponent = opponentId == null ? es.bracket.tbd : (names.get(opponentId) ?? es.unknownPlayer);

  const scored = isScored(m.state);
  const scoreSelf = scored && oriented ? (playerIsB ? m.score_b : m.score_a) : null;
  const scoreOpp = scored && oriented ? (playerIsB ? m.score_a : m.score_b) : null;
  const outcome: 'win' | 'loss' | null =
    scored && oriented ? (m.winner_entry != null && m.winner_entry === playerRosterId ? 'win' : 'loss') : null;

  return {
    matchId: m.match_id,
    position: m.bracket_position ?? '',
    opponent,
    outcome,
    scoreSelf,
    scoreOpp,
    verified: m.demo_id != null,
  };
}

export function buildPlayerDetail(
  headline: PlayerHeadline,
  seed: number | null,
  playerRosterId: number | null,
  rawMatches: RawPlayerMatch[],
  names: Map<number, string>,
): PlayerDetailModel {
  const matches = rawMatches
    .slice()
    .sort((a, b) => b.match_id - a.match_id) // most recent first
    .map((m) => matchLine(m, playerRosterId, names));

  return {
    steamid64: headline.steamid64,
    name: nameOfRow(headline),
    seed,
    base: {
      // The FIXED label is "Muertes / Bajas / Asist." → Deaths / Kills / Assists, so the numbers follow suit.
      kda: `${headline.deaths_total} / ${headline.kills_total} / ${headline.assists_total}`,
      adr: formatRate(headline.adr),
      hsPct: formatPct(headline.hs_pct),
      kast: formatPct(headline.kast_pct),
    },
    weird: [
      { key: 'knife', label: es.player.weird.knife, value: headline.knife_kills_total },
      { key: 'wallbang', label: es.player.weird.wallbang, value: headline.wallbang_kills_total },
      { key: 'smoke', label: es.player.weird.smoke, value: headline.through_smoke_kills_total },
      { key: 'noScope', label: es.player.weird.noScope, value: headline.no_scope_kills_total },
      { key: 'blind', label: es.player.weird.blind, value: headline.blind_kills_total },
    ],
    matches,
    verified: matches.some((m) => m.verified),
  };
}
