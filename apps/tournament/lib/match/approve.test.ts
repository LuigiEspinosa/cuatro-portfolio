import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { approveMatch } from '@/lib/match/approve';

const ADMIN = '76561198388441171';
/** Ids deliberately NOT 1..n, so an index/id mix-up cannot pass silently (mirrors walkover.test.ts). */
const MATCH = 501;
const WINNER = 88;

/**
 * The `.rpc()` seam mock (lib/match/walkover.test.ts). approveMatch does NO table reads — the RPC is the sole
 * authority — so `from` is wired only to PIN that fact: a later pre-read turns `expect(from).not…` red.
 */
function makeAdmin(rpcResult: { data?: unknown; error?: unknown } = { data: { ok: true }, error: null }) {
  const from = vi.fn(() => {
    throw new Error('approve wrapper must not read tables — the RPC is the authority');
  });
  const rpc = vi.fn((_fn: string, _args: Record<string, unknown>) => Promise.resolve(rpcResult));
  const admin = { from, rpc } as unknown as SupabaseClient;
  return { admin, from, rpc };
}

/** A well-formed ok payload (the demo-derived 16-13 shape). */
const OK_PAYLOAD = {
  ok: true,
  stat_rows_approved: 2,
  score_a: 16,
  score_b: 13,
  winner_entry: WINNER,
  advanced: 1,
  champion: null,
};

describe('approveMatch — the RPC payload + classification', () => {
  it('calls approve_match with the EXACT snake_case payload and returns the publish outcome', async () => {
    const { admin, rpc, from } = makeAdmin({ data: OK_PAYLOAD, error: null });

    const result = await approveMatch(admin, { actingAdmin: ADMIN, matchId: MATCH });
    expect(result).toEqual({
      ok: true,
      statRowsApproved: 2,
      scoreA: 16,
      scoreB: 13,
      winnerEntry: WINNER,
      advanced: 1,
      champion: null,
    });

    // ⚠ PIN EVERY ARGUMENT NAME — a typo'd key silently passes NULL into the RPC (the 4.1 review lesson).
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe('approve_match');
    expect(args).toEqual({ p_match_id: MATCH, p_actor_steamid64: ADMIN });
    expect(from).not.toHaveBeenCalled();
  });

  it('carries a non-null champion through (a Grand-Final Aprobar crowns)', async () => {
    const { admin } = makeAdmin({
      data: { ...OK_PAYLOAD, advanced: 0, champion: WINNER },
      error: null,
    });
    await expect(approveMatch(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
      ok: true,
      statRowsApproved: 2,
      scoreA: 16,
      scoreB: 13,
      winnerEntry: WINNER,
      advanced: 0,
      champion: WINNER,
    });
  });

  // `ceremony_locked` is Story 6.2's (migration 0024, AD-15). It must be TRUSTED here, or a locked ceremony
  // surfaces as an opaque 500 `write_failed` instead of the 409 the admin needs — exactly what THE BAR found.
  it.each([['bad_match'], ['ceremony_locked'], ['not_pending'], ['not_bound'], ['wrong_demo'], ['demo_mismatch'], ['bad_score'], ['tied']])(
    'surfaces the RPC %s refusal unchanged',
    async (reason) => {
      const { admin } = makeAdmin({ data: { ok: false, reason }, error: null });
      await expect(approveMatch(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
        ok: false,
        reason,
      });
    },
  );

  it('maps the IC903 advance-refused RAISE to advance_refused (NOT a 500)', async () => {
    // ⭐⭐ THE LOAD-BEARING HAND-OFF. approve_match RAISES (distinct SQLSTATE) when advance_match returns
    // {ok:false}, rolling the whole publish back. A rollback is a REFUSAL, not a server fault — report as one.
    const { admin } = makeAdmin({
      data: null,
      error: { code: 'IC903', message: 'approve_match: advance refused (slot_taken)' },
    });
    await expect(approveMatch(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
      ok: false,
      reason: 'advance_refused',
    });
  });

  it('maps the IC904 terminal-guard RAISE to terminal (NOT a 500)', async () => {
    const { admin } = makeAdmin({
      data: null,
      error: { code: 'IC904', message: 'state resolved is a committed demo result (AD-23)' },
    });
    await expect(approveMatch(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
      ok: false,
      reason: 'terminal',
    });
  });

  it('maps a 23514 check_violation to format_not_declared (NOT a 500)', async () => {
    const { admin } = makeAdmin({
      data: null,
      error: { code: '23514', message: 'match_live_requires_locked_format' },
    });
    await expect(approveMatch(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
      ok: false,
      reason: 'format_not_declared',
    });
  });

  it('does NOT hijack a bare P0001 (that belongs to lib/match/format.ts) — it fails closed', async () => {
    const { admin } = makeAdmin({ data: null, error: { code: 'P0001', message: 'some other trigger' } });
    await expect(approveMatch(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });

  it.each([['IC901'], ['IC902']])(
    'does NOT hijack %s (that belongs to lib/match/walkover.ts) — it fails closed',
    async (code) => {
      // IC901/IC902 are walkover.ts's terminal/advance-refused codes. approve_match never raises them, and
      // mapping them here would misreport a walkover refusal that leaked through as an approve refusal.
      const { admin } = makeAdmin({ data: null, error: { code, message: 'a walkover refusal' } });
      await expect(approveMatch(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
        ok: false,
        reason: 'write_failed',
      });
    },
  );

  it('fails CLOSED on an unrecognised refusal reason', async () => {
    const { admin } = makeAdmin({ data: { ok: false, reason: 'something_new' }, error: null });
    await expect(approveMatch(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });

  it('fails CLOSED on a transport error', async () => {
    const { admin } = makeAdmin({ data: null, error: { code: '40P01', message: 'deadlock' } });
    await expect(approveMatch(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });

  it('fails CLOSED when ok is claimed without the outcome fields', async () => {
    const { admin } = makeAdmin({ data: { ok: true, score_a: 16 }, error: null });
    await expect(approveMatch(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });

  it('fails CLOSED when a numeric field arrives as the wrong type', async () => {
    // A stringified score (a serialization slip) must not sail through as a valid publish.
    const { admin } = makeAdmin({ data: { ...OK_PAYLOAD, score_a: '16' }, error: null });
    await expect(approveMatch(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });
});
