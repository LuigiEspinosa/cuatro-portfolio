import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FeedRow } from '@/lib/feed/types';
import { type CardModel, collectRosterIds, toCardModel } from '@/lib/feed/model';

/**
 * The reusable snapshot read (Story 5.6, AC1/AC4/AC8) — the AD-11 seam.
 *
 * `fetchFeedSnapshot` is the ONE published-state read that materializes the entire feed: it reads
 * `timeline_feed` newest-first, batch-resolves roster ids → display names, and returns a fully-shaped,
 * ordered `CardModel[]`. The surface does no further data work. **Story 5.8 re-invokes THIS exact
 * function** on a realtime nudge / reconnect — it must never replay events — so it stays self-contained
 * and takes the client + tournamentId as parameters.
 *
 * ⚠ Read path: the caller MUST pass the anon, RLS-respecting `createSupabaseServerClient()` — NEVER the
 * service-role admin client. AD-7 is satisfied by construction (timeline_feed rows are only ever written
 * post-approval inside approve_match; the table has no status column and nothing pending to leak).
 */

/** tournament.state (0001) — drives the live pill + the Ceremonia lock; no feed rows carry it. */
export type TournamentState =
  | 'registration_open'
  | 'registration_closed'
  | 'bracket_live'
  | 'ceremony'
  | 'closed';

export type FeedSnapshot =
  | { ok: true; cards: CardModel[] }
  | { ok: false; reason: 'read_failed' };

export type ResolveTournamentResult =
  | { ok: true; id: number; state: TournamentState }
  | { ok: false; reason: 'no_tournament' | 'read_failed' };

/**
 * Resolve the current tournament (id + state). v1 is a single private event, so the newest row is
 * "current". A small, deliberately replaceable helper — there is no "current tournament" concept in
 * the codebase yet (roster/bracket always pass an explicit id); 5.6 introduces the minimal one.
 */
export async function resolveCurrentTournament(
  client: SupabaseClient,
): Promise<ResolveTournamentResult> {
  const { data, error } = await client
    .from('tournament')
    .select('id, state')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[fetchFeedSnapshot] tournament resolve failed:', error.message);
    return { ok: false, reason: 'read_failed' };
  }
  if (!data) {
    return { ok: false, reason: 'no_tournament' };
  }
  return { ok: true, id: data.id as number, state: data.state as TournamentState };
}

/**
 * Count the active registrants for the empty-state registration pill (AC5). Anon-readable via the
 * `roster_entry` active-only viewer policy (0004:58). Non-fatal: any error → 0 (the pill still renders).
 */
export async function fetchRegisteredCount(
  client: SupabaseClient,
  tournamentId: number,
): Promise<number> {
  const { count, error } = await client
    .from('roster_entry')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId);
  if (error) {
    console.error('[fetchFeedSnapshot] roster count failed:', error.message);
    return 0;
  }
  return count ?? 0;
}

/** The live/status pill state (AC1 renders it statically; 5.8 drives the transitions). */
export function livePillState(state: TournamentState): 'on' | 'off' | 'final' {
  if (state === 'bracket_live') return 'on';
  if (state === 'ceremony' || state === 'closed') return 'final';
  return 'off'; // registration_open / registration_closed — sin transmisión
}

/** Ceremonia nav tab is locked until the ceremony has started (AC6). */
export function ceremonyUnlocked(state: TournamentState): boolean {
  return state === 'ceremony' || state === 'closed';
}

/**
 * Read + fully resolve the feed for a tournament, newest-first.
 *
 * 1. `timeline_feed where tournament_id = $1 order by id desc` (the identity PK — NEVER occurred_at;
 *    an atomic Aprobar stamps every row with the same now(); uses `timeline_feed_tournament_idx`).
 * 2. Batch-resolve names: collect all winner/loser (+ speculative advancing) roster ids → one
 *    `roster_entry` lookup (id → steamid64) → one `player` lookup (steamid64 → display_name).
 * 3. Shape each row via `toCardModel`. Empty feed → `{ ok: true, cards: [] }`.
 *
 * Name resolution degrades gracefully: `roster_entry`'s viewer policy is active-only, so a player
 * REMOVED after playing has no visible roster row → the id is absent from the map → the card shows a
 * neutral label (toCardModel), never a crash. `player` grants anon SELECT so names resolve for viewers.
 */
export async function fetchFeedSnapshot(
  client: SupabaseClient,
  tournamentId: number,
): Promise<FeedSnapshot> {
  const { data, error } = await client
    .from('timeline_feed')
    .select('id, tournament_id, entry_type, occurred_at, target_match_id, detail')
    .eq('tournament_id', tournamentId)
    .order('id', { ascending: false });
  if (error) {
    console.error('[fetchFeedSnapshot] timeline_feed read failed:', error.message);
    return { ok: false, reason: 'read_failed' };
  }

  const rows = (data ?? []) as FeedRow[];
  if (rows.length === 0) {
    return { ok: true, cards: [] };
  }

  const names = await resolveNames(client, rows);
  return { ok: true, cards: rows.map((row) => toCardModel(row, names)) };
}

/**
 * roster_entry.id → player.display_name, via two batched `in(...)` queries. Any read error here is
 * non-fatal: it yields an empty map so cards fall back to neutral labels (the feed still renders —
 * a broken join must not blank an approved-and-published result).
 */
async function resolveNames(
  client: SupabaseClient,
  rows: FeedRow[],
): Promise<Map<number, string>> {
  const names = new Map<number, string>();
  const rosterIds = collectRosterIds(rows);
  if (rosterIds.length === 0) return names;

  const { data: rosterRows, error: rosterErr } = await client
    .from('roster_entry')
    .select('id, steamid64')
    .in('id', rosterIds);
  if (rosterErr || !rosterRows || rosterRows.length === 0) {
    if (rosterErr) console.error('[fetchFeedSnapshot] roster_entry resolve failed:', rosterErr.message);
    return names; // no visible roster rows (all removed?) → neutral labels downstream
  }

  const rosterToSteam = new Map<number, string>();
  const steamIds: string[] = [];
  for (const r of rosterRows as Array<{ id: number; steamid64: string }>) {
    rosterToSteam.set(r.id, r.steamid64);
    steamIds.push(r.steamid64);
  }

  const { data: playerRows, error: playerErr } = await client
    .from('player')
    .select('steamid64, display_name')
    .in('steamid64', steamIds);
  if (playerErr) {
    console.error('[fetchFeedSnapshot] player resolve failed:', playerErr.message);
    return names;
  }

  const steamToName = new Map<string, string>();
  for (const p of (playerRows ?? []) as Array<{ steamid64: string; display_name: string | null }>) {
    if (p.display_name) steamToName.set(p.steamid64, p.display_name);
  }

  for (const [rosterId, steamid64] of rosterToSteam) {
    const name = steamToName.get(steamid64);
    // Prefer the display name; if the player row is somehow missing a name, fall back to the
    // steamid64 tail (a stable, if ugly, identifier) rather than dropping the player entirely.
    names.set(rosterId, name ?? `#${steamid64.slice(-4)}`);
  }
  return names;
}
