import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Accept a held (anomalous) demo — the `Anomalous → Pending` admin decision (Story 4.9, DELIVERABLE 3; Story
 * 3.4 AC2). One admin command, a thin wrapper over migration 0020's `accept_anomaly` RPC.
 *
 * The worker HOLDS a demo that fails a validation gate by stamping `demo.validation_state='anomalous'` (Story
 * 3.4), and `bind_match_demo` (4.6a) REFUSES to bind a held demo. This is the missing unblock step: an admin
 * explicitly accepts the anomaly (LOGGED), flipping `validation_state → pending` so the demo becomes bindable.
 * It touches ONLY the validation axis — no bind, no approve, no `idle_dq` (DECISION D/G).
 *
 * ⚠ THIS FILE IS UX, NOT TEETH — the same division of labour as lib/match/rollback.ts. The single-row lock, the
 * guards, the state flip and the audit row all live in the DATABASE (migration 0020's RPC), because
 * `service_role` holds UPDATE on `demo` + INSERT on `audit_log` and has BYPASSRLS — no route-level discipline
 * can bind it. All writes go through the INJECTED service-role `admin` client (AD-2).
 *
 * ⚠ SQLSTATES. `accept_anomaly` RAISES NOTHING — every refusal is RETURNED as {ok:false, reason}. It touches
 * only `demo` and `audit_log`, trips no trigger and calls no other RPC, so there is no custom SQLSTATE to map;
 * anything on `error` is a transport/infra failure → fail closed to `write_failed`.
 */

/** The RPC's typed reply. `ok:false` carries a `reason`; the ok payload carries the accepted demo's new state. */
interface RpcResult {
  ok: boolean;
  reason?: string;
  demo_id?: number;
  validation_state?: string;
}

export type AcceptAnomalyResult =
  | { ok: true; demoId: number; validationState: string }
  | {
      ok: false;
      reason:
        | 'bad_demo' // no such demo
        | 'not_anomalous' // the demo is not `anomalous` — nothing to accept (also AC2 idempotency: a 2nd accept)
        | 'write_failed';
    };

/** Every reason the RPC can RETURN. A reason outside this set is not trusted — the lib fails closed. */
const ACCEPT_REASONS = new Set(['bad_demo', 'not_anomalous']);

/**
 * Accept demo `demoId`'s anomaly: flip `demo.validation_state` `anomalous → pending` + write one
 * `accept_anomaly` audit row, atomically (migration 0020 `accept_anomaly`). IDEMPOTENT in effect — a second
 * accept of an already-`pending` demo returns `not_anomalous` having written nothing.
 */
export async function acceptAnomaly(
  admin: SupabaseClient,
  params: { actingAdmin: string; demoId: number },
): Promise<AcceptAnomalyResult> {
  const { data, error } = await admin.rpc('accept_anomaly', {
    p_demo_id: params.demoId,
    p_actor_steamid64: params.actingAdmin,
  });

  if (error) {
    console.error('[acceptAnomaly] accept_anomaly RPC failed:', error.message);
    return { ok: false, reason: 'write_failed' };
  }

  const result = data as RpcResult | null;
  if (!result?.ok) {
    const reason = result?.reason;
    if (reason && ACCEPT_REASONS.has(reason)) {
      return { ok: false, reason: reason as 'bad_demo' | 'not_anomalous' };
    }
    return { ok: false, reason: 'write_failed' }; // fail closed on an unrecognised refusal
  }

  // Validate the ok-payload's SHAPE before trusting it (the 4.1 review lesson: a typo'd jsonb key must not read
  // as success with `undefined` fields).
  if (typeof result.demo_id !== 'number' || typeof result.validation_state !== 'string') {
    console.error('[acceptAnomaly] ok reply missing a usable field:', result);
    return { ok: false, reason: 'write_failed' };
  }

  return { ok: true, demoId: result.demo_id, validationState: result.validation_state };
}
