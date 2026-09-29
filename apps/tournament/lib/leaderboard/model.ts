import { es } from '@/lib/i18n/es';

/**
 * Pure leaderboard board model (Story 5.7, Task 5/AC4/AC5). All standings numbers come from the SINGLE
 * `public.leaderboard` view (migration 0021, AD-20) — this module only FILTERS/ORDERS/FORMATS that wide
 * per-player row. It NEVER re-aggregates and NEVER re-derives the 24/20 floors: it reads the view's
 * `eligible_rate` flag (AC5). No React, no DB here.
 */

/** A raw `public.leaderboard` row (hand-typed from 0021:91-131). Rate columns can be NULL (0-opportunity). */
export interface LeaderboardRow {
  steamid64: string;
  display_name: string | null;
  matches_played: number;
  rounds_played_total: number;
  kills_total: number;
  // rate (Σnum/Σden; NULL when the denominator is 0 — render "sin datos")
  adr: number | string | null;
  kast_pct: number | string | null;
  hs_pct: number | string | null;
  // volume totals
  deaths_total: number;
  assists_total: number;
  knife_kills_total: number;
  wallbang_kills_total: number;
  through_smoke_kills_total: number;
  no_scope_kills_total: number;
  blind_kills_total: number;
  entry_frags_total: number;
  opening_deaths_total: number;
  // eligibility flags (READ these — never re-derive the floors)
  meets_round_floor: boolean;
  meets_kill_floor: boolean;
  eligible_rate: boolean;
}

export type BoardKind = 'rate' | 'volume';

/** One ranked row for the board table (already sorted; rank is 1-based). */
export interface RankedRow {
  steamid64: string;
  name: string;
  rank: number;
  primary: string; // the primary (sort) column, formatted
  secondary: string; // the secondary column, formatted
  meta: string; // the row's context line (KAST + rounds for rate; rounds for volume)
}

/** One eligibility-section row — every player, eligible or DQ'd (the DQ'd are dimmed by the surface). */
export interface EligibilityRow {
  steamid64: string;
  name: string;
  rounds: number;
  kills: number;
  eligible: boolean;
}

export interface BoardView {
  kind: BoardKind;
  rows: RankedRow[];
  eligibility: EligibilityRow[];
}

// ── formatting ───────────────────────────────────────────────────────────────
/** Coerce a PostgREST numeric (which may arrive as a string) to a number; non-finite → null. */
function num(v: number | string | null): number | null {
  if (v == null) return null;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

/** ADR-style rate: one decimal, or "sin datos" for a NULL (0-opportunity denominator — AC5/AC9). */
export function formatRate(v: number | string | null): string {
  const n = num(v);
  return n == null ? es.player.noData : n.toFixed(1);
}

/** A fraction (0..1) → an integer percent, or "sin datos" for NULL. */
export function formatPct(v: number | string | null): string {
  const n = num(v);
  return n == null ? es.player.noData : `${Math.round(n * 100)}%`;
}

/** Resolve the display name from the view row (it carries display_name), degrading to the steamid tail. */
export function nameOfRow(row: Pick<LeaderboardRow, 'display_name' | 'steamid64'>): string {
  // Truthy (not nullish): an EMPTY-string display_name must fall back to the steamid tail too — matches the
  // shared resolveNames behavior, so the same player never renders blank here and tailed there.
  return row.display_name || `#${row.steamid64.slice(-4)}`;
}

// ── board definitions ─────────────────────────────────────────────────────────
/**
 * The lean default board set (the flagged decision, confirmed):
 *   Tasa (rate)   → ADR primary + HS% secondary, KAST in the meta line. Below-floor players HIDDEN (AC5).
 *   Volumen (vol) → Kills primary + a weird total (knife) secondary, rounds in the meta. No floor hiding.
 */
function sortValue(row: LeaderboardRow, kind: BoardKind): number {
  const v = kind === 'rate' ? num(row.adr) : row.kills_total;
  return v == null ? Number.NEGATIVE_INFINITY : v; // a NULL-rate player sorts to the bottom (defensive)
}

function rankedRow(row: LeaderboardRow, kind: BoardKind, rank: number): RankedRow {
  if (kind === 'rate') {
    return {
      steamid64: row.steamid64,
      name: nameOfRow(row),
      rank,
      primary: formatRate(row.adr),
      secondary: formatPct(row.hs_pct),
      meta: `KAST ${formatPct(row.kast_pct)} · ${row.rounds_played_total} ${es.leaderboards.roundsUnit}`,
    };
  }
  return {
    steamid64: row.steamid64,
    name: nameOfRow(row),
    rank,
    primary: String(row.kills_total),
    secondary: String(row.knife_kills_total),
    meta: `${row.rounds_played_total} ${es.leaderboards.roundsUnit}`,
  };
}

/**
 * Build a board view from the raw rows.
 *   * rate boards HIDE below-floor players from the ranking (eligible_rate=false) — they only appear in the
 *     eligibility section (AC5). volume boards keep everyone (raw totals — the floor does not hide).
 *   * sort desc by the board's primary stat; ties keep input order (a stable sort).
 *   * the eligibility section lists ALL rows (eligible + DQ'd), each with rounds/kills + the eligible flag.
 */
export function buildBoard(rows: LeaderboardRow[], kind: BoardKind): BoardView {
  const ranked = (kind === 'rate' ? rows.filter((r) => r.eligible_rate) : rows.slice())
    .sort((a, b) => sortValue(b, kind) - sortValue(a, kind))
    .map((row, i) => rankedRow(row, kind, i + 1));

  const eligibility: EligibilityRow[] = rows
    .slice()
    .sort((a, b) => Number(b.eligible_rate) - Number(a.eligible_rate) || b.rounds_played_total - a.rounds_played_total)
    .map((row) => ({
      steamid64: row.steamid64,
      name: nameOfRow(row),
      rounds: row.rounds_played_total,
      kills: row.kills_total,
      eligible: row.eligible_rate,
    }));

  return { kind, rows: ranked, eligibility };
}
