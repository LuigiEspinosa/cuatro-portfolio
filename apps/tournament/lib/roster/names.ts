import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The shared roster→player display-name resolver (Story 5.6, extracted for reuse in Story 5.7).
 *
 * Both the feed (Story 5.6) and the bracket (Story 5.7) hold `roster_entry.id` references (matches join the
 * SEEDED ROSTER, never `player` — AD-4) and need display names for the surface. Story 5.6 first implemented
 * this exact batched two-`in(...)`-query resolver INSIDE `lib/feed/read.ts`; Story 5.7 lifts it here so the
 * bracket read reuses it verbatim instead of copy-pasting. `fetchFeedSnapshot` now calls this too — its
 * behavior is unchanged (the same tests still pass).
 *
 * ⚠ Read path: the caller MUST pass the anon, RLS-respecting `createSupabaseServerClient()`. The
 * `roster_entry` viewer policy is ACTIVE-ONLY (0004:58), so a player REMOVED after playing has no visible
 * roster row → their id is simply ABSENT from the returned map, and the caller degrades to a neutral label
 * (`es.unknownPlayer`) rather than crashing. `player` grants anon SELECT + RLS `using(true)` (0002:51,71),
 * so names resolve for viewers.
 */

/**
 * Resolve a set of `roster_entry.id`s to display names, via two batched `in(...)` queries
 * (id → steamid64, then steamid64 → display_name). Returns `Map<rosterEntryId, displayName>`.
 *
 * Total and non-fatal by construction — a resolvable-but-crashing join must never blank an
 * already-published result:
 *   * empty input        → empty map, and NO queries are issued (the caller shows neutral labels);
 *   * roster read error / no visible rows (all removed?) → empty map (logged);
 *   * player read error  → empty map (logged);
 *   * a player row missing a `display_name` → the steamid64 TAIL (`#1234`), a stable if ugly id,
 *     rather than dropping the player entirely.
 * An id with no visible roster row is left OUT of the map (removed-after-playing) — the caller falls back.
 */
export async function resolveNames(
  client: SupabaseClient,
  rosterIds: number[],
): Promise<Map<number, string>> {
  const names = new Map<number, string>();
  if (rosterIds.length === 0) return names;

  const { data: rosterRows, error: rosterErr } = await client
    .from('roster_entry')
    .select('id, steamid64')
    .in('id', rosterIds);
  if (rosterErr || !rosterRows || rosterRows.length === 0) {
    if (rosterErr) console.error('[resolveNames] roster_entry resolve failed:', rosterErr.message);
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
    console.error('[resolveNames] player resolve failed:', playerErr.message);
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
