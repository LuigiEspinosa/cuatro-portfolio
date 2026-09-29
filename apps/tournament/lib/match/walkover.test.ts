import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { beginMatchGrace, resumeMatch, markWalkover } from '@/lib/match/walkover';

const ADMIN = '76561198388441171';
/** Ids deliberately NOT 1..n, so an index/id mix-up cannot pass silently (mirrors format.test.ts). */
const MATCH = 501;
const WINNER = 88;
const LOSER = 99;

/**
 * The `.rpc()` seam mock (lib/match/format.test.ts). These wrappers do NO table reads — the RPC is the sole
 * authority — so `from` is wired only to PIN that fact: a later pre-read turns `expect(from).not…` red.
 */
function makeAdmin(rpcResult: { data?: unknown; error?: unknown } = { data: { ok: true }, error: null }) {
  const from = vi.fn(() => {
    throw new Error('walkover wrappers must not read tables — the RPC is the authority');
  });
  const rpc = vi.fn((_fn: string, _args: Record<string, unknown>) => Promise.resolve(rpcResult));
  const admin = { from, rpc } as unknown as SupabaseClient;
  return { admin, from, rpc };
}

// ════════════════════════════════════════════════════════════════════════════
// beginMatchGrace
// ════════════════════════════════════════════════════════════════════════════

describe('beginMatchGrace — the RPC payload + classification', () => {
  it('calls begin_match_grace with the EXACT snake_case payload and returns the clock', async () => {
    const since = '2026-07-15T12:00:00.000Z';
    const { admin, rpc, from } = makeAdmin({
      data: { ok: true, match_id: MATCH, awaiting_grace_since: since },
      error: null,
    });

    const result = await beginMatchGrace(admin, { actingAdmin: ADMIN, matchId: MATCH });
    expect(result).toEqual({ ok: true, matchId: MATCH, awaitingGraceSince: since });

    // ⚠ PIN EVERY ARGUMENT NAME — a typo'd key silently passes NULL into the RPC (the 4.1 review lesson).
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe('begin_match_grace');
    expect(args).toEqual({ p_match_id: MATCH, p_actor_steamid64: ADMIN });
    expect(from).not.toHaveBeenCalled();
  });

  it.each([['bad_match'], ['not_startable'], ['not_ready']])(
    'surfaces the RPC %s refusal unchanged',
    async (reason) => {
      const { admin } = makeAdmin({ data: { ok: false, reason }, error: null });
      await expect(beginMatchGrace(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
        ok: false,
        reason,
      });
    },
  );

  it('fails CLOSED on an unrecognised refusal reason', async () => {
    const { admin } = makeAdmin({ data: { ok: false, reason: 'something_new' }, error: null });
    await expect(beginMatchGrace(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });

  it('fails CLOSED on a transport error', async () => {
    const { admin } = makeAdmin({ data: null, error: { code: '40P01', message: 'deadlock' } });
    await expect(beginMatchGrace(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });

  it('fails CLOSED when ok is claimed without the clock fields', async () => {
    const { admin } = makeAdmin({ data: { ok: true, match_id: MATCH }, error: null });
    await expect(beginMatchGrace(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// resumeMatch
// ════════════════════════════════════════════════════════════════════════════

describe('resumeMatch — the RPC payload + classification', () => {
  it('calls resume_match with the EXACT payload and returns the match id', async () => {
    const { admin, rpc } = makeAdmin({ data: { ok: true, match_id: MATCH }, error: null });

    const result = await resumeMatch(admin, { actingAdmin: ADMIN, matchId: MATCH });
    expect(result).toEqual({ ok: true, matchId: MATCH });

    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe('resume_match');
    expect(args).toEqual({ p_match_id: MATCH, p_actor_steamid64: ADMIN });
  });

  it.each([['bad_match'], ['not_awaiting']])('surfaces the RPC %s refusal unchanged', async (reason) => {
    const { admin } = makeAdmin({ data: { ok: false, reason }, error: null });
    await expect(resumeMatch(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
      ok: false,
      reason,
    });
  });

  it('fails CLOSED on an unrecognised reason and on a transport error', async () => {
    const unknown = makeAdmin({ data: { ok: false, reason: 'nope' }, error: null });
    await expect(resumeMatch(unknown.admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
    const boom = makeAdmin({ data: null, error: { code: 'XXXXX', message: 'boom' } });
    await expect(resumeMatch(boom.admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// markWalkover
// ════════════════════════════════════════════════════════════════════════════

describe('markWalkover — the RPC payload + classification', () => {
  it('calls mark_walkover with the EXACT payload and returns the forfeit outcome', async () => {
    const { admin, rpc } = makeAdmin({
      data: { ok: true, forfeiting_entry: LOSER, winner_entry: WINNER, advanced: 1, champion: null },
      error: null,
    });

    const result = await markWalkover(admin, { actingAdmin: ADMIN, matchId: MATCH, winnerEntry: WINNER });
    expect(result).toEqual({ ok: true, forfeitingEntry: LOSER, winnerEntry: WINNER, advanced: 1, champion: null });

    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe('mark_walkover');
    expect(args).toEqual({ p_match_id: MATCH, p_actor_steamid64: ADMIN, p_winner_entry: WINNER });
  });

  it('carries a non-null champion through (a Grand-Final forfeit crowns)', async () => {
    const { admin } = makeAdmin({
      data: { ok: true, forfeiting_entry: LOSER, winner_entry: WINNER, advanced: 0, champion: WINNER },
      error: null,
    });
    await expect(
      markWalkover(admin, { actingAdmin: ADMIN, matchId: MATCH, winnerEntry: WINNER }),
    ).resolves.toEqual({ ok: true, forfeitingEntry: LOSER, winnerEntry: WINNER, advanced: 0, champion: WINNER });
  });

  it.each([['bad_match'], ['not_awaiting'], ['grace_active'], ['bad_winner']])(
    'surfaces the RPC %s refusal unchanged',
    async (reason) => {
      const { admin } = makeAdmin({ data: { ok: false, reason }, error: null });
      await expect(
        markWalkover(admin, { actingAdmin: ADMIN, matchId: MATCH, winnerEntry: WINNER }),
      ).resolves.toEqual({ ok: false, reason });
    },
  );

  it('maps the IC902 advance-refused RAISE to advance_refused (NOT a 500)', async () => {
    // ⭐ THE 4.3 HAND-OFF. mark_walkover RAISES (distinct SQLSTATE) when advance_match returns {ok:false},
    // rolling the forfeit back. A rollback is a REFUSAL, not a server fault — it must report as one.
    const { admin } = makeAdmin({
      data: null,
      error: { code: 'IC902', message: 'forfeit advance refused (slot_taken)' },
    });
    await expect(
      markWalkover(admin, { actingAdmin: ADMIN, matchId: MATCH, winnerEntry: WINNER }),
    ).resolves.toEqual({ ok: false, reason: 'advance_refused' });
  });

  it('maps the IC901 terminal-guard RAISE to terminal (NOT a 500, NOT format.ts P0001)', async () => {
    const { admin } = makeAdmin({
      data: null,
      error: { code: 'IC901', message: 'state forfeit is TERMINAL (AD-23)' },
    });
    await expect(
      markWalkover(admin, { actingAdmin: ADMIN, matchId: MATCH, winnerEntry: WINNER }),
    ).resolves.toEqual({ ok: false, reason: 'terminal' });
  });

  it('does NOT hijack a bare P0001 (that belongs to lib/match/format.ts) — it fails closed', async () => {
    // DECISION D's whole point: a P0001 from anywhere must NOT be read as a walkover reason here.
    const { admin } = makeAdmin({ data: null, error: { code: 'P0001', message: 'some other trigger' } });
    await expect(
      markWalkover(admin, { actingAdmin: ADMIN, matchId: MATCH, winnerEntry: WINNER }),
    ).resolves.toEqual({ ok: false, reason: 'write_failed' });
  });

  it('fails CLOSED on an unrecognised reason and when ok lacks usable fields', async () => {
    const unknown = makeAdmin({ data: { ok: false, reason: 'mystery' }, error: null });
    await expect(
      markWalkover(unknown.admin, { actingAdmin: ADMIN, matchId: MATCH, winnerEntry: WINNER }),
    ).resolves.toEqual({ ok: false, reason: 'write_failed' });

    const noFields = makeAdmin({ data: { ok: true, winner_entry: WINNER }, error: null });
    await expect(
      markWalkover(noFields.admin, { actingAdmin: ADMIN, matchId: MATCH, winnerEntry: WINNER }),
    ).resolves.toEqual({ ok: false, reason: 'write_failed' });
  });
});
