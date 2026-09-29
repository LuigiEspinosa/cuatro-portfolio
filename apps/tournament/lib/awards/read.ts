import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The viewer's ONLY read of the award catalog (Story 6.1, AC4) — and it returns an INTEGER.
 *
 * ⭐ AD-22 IS A DATA-FLOW PROPERTY FIRST, A CSS PROPERTY SECOND. A viewer holds NO grant on `award` (migration
 * 0023) and 42501s at the table-grant gate before RLS is even consulted, so there is no anon `select` to write
 * here even if someone wanted one. `public.award_catalog_count()` is `security definer` PRECISELY because the
 * caller has no grant — it exists to leak exactly one number and nothing else. An award's name, bucket, class,
 * deciding stat, floors and id must never reach the client before that award's spin, which is Story 6.8's to
 * open, per spin.
 *
 * ⛔ DO NOT ADD A ROW READ TO THIS FILE. If a future surface needs award identity it needs 6.8's reveal gate, not
 * a second function here. The mock's blurred-real-names DOM (mock-leaderboards.html:483-515) is exactly the
 * failure AD-22 names — view-source, DevTools or a screen reader defeat a CSS blur instantly.
 *
 * Mirrors `lib/leaderboard/read.ts`'s `(client)`-taking shape and `{ok:…}` snapshot — do not invent a new read
 * shape. ⚠ Anon client only (`createSupabaseServerClient()`), NEVER `getAdminClient()`: a service-role read here
 * would work, and would be the exact hole this file exists to keep shut.
 */

/** Mirrors `curate_award_catalog`'s `c_max_awards` (migration 0023) — a declared, pinned value-parity duplicate. */
export const MAX_AWARDS = 64;

export type AwardCatalogCount = { ok: true; count: number } | { ok: false; reason: 'read_failed' };

export async function fetchAwardCatalogCount(
  client: SupabaseClient,
  tournamentId: number,
): Promise<AwardCatalogCount> {
  const { data, error } = await client.rpc('award_catalog_count', { p_tournament_id: tournamentId });

  if (error) {
    console.error('[fetchAwardCatalogCount] award_catalog_count failed:', error.message);
    return { ok: false, reason: 'read_failed' };
  }
  // The function returns `int`; supabase-js hands it back as a bare number. Anything else is a contract break —
  // fail closed rather than render `Premio 1 de NaN`.
  if (typeof data !== 'number' || !Number.isInteger(data) || data < 0) {
    console.error('[fetchAwardCatalogCount] award_catalog_count returned a non-count:', data);
    return { ok: false, reason: 'read_failed' };
  }
  // Upper bound, in parity with `curate_award_catalog`'s c_max_awards = 64 (6.1 code review). `Number.isInteger`
  // alone is not a range check — it is TRUE for 1e21, the same gap `isPositiveInt` exists to close on the admin
  // route. The RPC's cap does not bind `service_role` or raw SQL, which are the only writers on `award`, so a
  // mis-seeded catalog would otherwise make the PUBLIC viewer page render an unbounded list of placeholder rows.
  // Fail closed: a count above the cap is a contract break, not something to render.
  if (data > MAX_AWARDS) {
    console.error('[fetchAwardCatalogCount] award_catalog_count above the catalog cap:', data);
    return { ok: false, reason: 'read_failed' };
  }
  return { ok: true, count: data };
}
