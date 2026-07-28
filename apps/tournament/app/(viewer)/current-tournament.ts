import 'server-only';
import { cache } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { resolveCurrentTournament, type ResolveTournamentResult } from '@/lib/feed/read';

/**
 * Per-request memoized tournament resolution for the viewer shell + page (Story 5.6 review, P3).
 *
 * The layout (live pill + Ceremonia lock) and the page (feed scope) both need the current
 * tournament. React `cache()` collapses their two calls into ONE `tournament` read per request and
 * guarantees both render off the same resolved state — no within-render drift, no wasted round-trip.
 *
 * The pure, testable primitive stays `resolveCurrentTournament(client)` in `lib/feed/read.ts`
 * (framework-free, faked-client tests); this is the request-scoped convenience the server-rendered
 * viewer entry points share. Kept in the viewer layer so `read.ts` never imports the server client.
 */
export const currentTournament = cache(async (): Promise<ResolveTournamentResult> => {
  const client = await createSupabaseServerClient();
  return resolveCurrentTournament(client);
});
