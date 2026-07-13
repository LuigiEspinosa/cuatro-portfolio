import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Ingest-notify domain logic (Story 3.1, AC2/AC5/AC7) — the admin manual-upload path.
 *
 * The 50–170 MB demo bytes go browser → R2 directly, via a worker-minted presigned URL (bypassing
 * Vercel — SPEC Constraint 6). Only a tiny `{ match_id, storage_key }` JSON notify (well under the
 * ~4.5 MB Vercel cap) touches the Next.js app: `POST /api/ingest/register`. This module records the
 * `demo` acquisition row via the INJECTED service-role `admin` client, mirroring `lib/roster.ts`
 * (injectable client, typed refusal the route maps to an HTTP status, no DB plumbing in the route).
 *
 * ⚠️ AD-2 nuance (flagged for code-review): this is the ONE place the *app* writes a `demo` row (a
 * consequence of the "create the table now + the register route inserts the acquisition row" decision).
 * It writes ONLY the acquisition metadata (`source='manual_upload'`, backend `r2`) — never `stat_row`.
 * The AD-2 structural teeth hold: `demo` has NO anon/authenticated grant/policy (0005), so no client
 * can write it; the worker remains the sole writer of derived stats. When the async queue lands (Story
 * 3.8) this may migrate to enqueue→worker-writes. `demo_sha256`/`parser_version` stay NULL shells here
 * (Story 3.2/3.3 backfill them); `size_bytes` is NULL for this path (the app never sees the bytes).
 */

export interface RegisterBody {
  match_id: number;
  storage_key: string;
}

/**
 * Validate the register notify body. Returns null on anything malformed (→ 400, no write): `match_id`
 * must be a positive integer and `storage_key` a non-empty string (the opaque R2 key the worker's
 * presign step returned). The key is treated as opaque — its structure is the worker's.
 *
 * ⚠ `match_id` here is the EXTERNAL ingest id (the operator's / MatchZy's), NOT a bracket `match.id`.
 * It lands in `demo.matchzy_match_id` (migration 0010 renamed the column to stop it lying: it never held
 * a match.id, and FK-ing it would 23503 every ingest). `demo.match_id` — the real FK — stays NULL until
 * Story 4.6 (Aprobar) binds this demo to the match it decided. The wire field keeps its name so the
 * worker's presign→register contract is unchanged.
 */
export function parseRegisterBody(raw: unknown): RegisterBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { match_id, storage_key } = raw as Record<string, unknown>;
  if (typeof match_id !== 'number' || !Number.isInteger(match_id) || match_id <= 0) return null;
  if (typeof storage_key !== 'string' || storage_key.trim() === '') return null;
  return { match_id, storage_key };
}

export type RegisterResult = { ok: true } | { ok: false; reason: 'write_failed' };

/**
 * Record the demo acquisition row for an admin manual upload (`source='manual_upload'`). Writes via the
 * service role (the single server-side writer, AD-2 — there is no client write policy/grant on `demo`).
 * A write error → `write_failed` (the route maps it to 500); the caller is `requireAdmin`-gated. Left
 * NULL by design: `demo_sha256` (Story 3.2), `parser_version` (Story 3.3), `size_bytes` (the app never
 * handles the bytes on this path). `retention_class`/`parse_generation`/`archived_at` take their DB
 * defaults.
 */
export async function recordManualUpload(
  admin: SupabaseClient,
  params: { matchId: number; storageKey: string },
): Promise<RegisterResult> {
  const { error } = await admin.from('demo').insert({
    matchzy_match_id: params.matchId, // the EXTERNAL ingest id — see parseRegisterBody
    storage_backend: 'r2',
    storage_key: params.storageKey,
    source: 'manual_upload',
  });
  if (error) {
    return { ok: false, reason: 'write_failed' };
  }
  return { ok: true };
}
