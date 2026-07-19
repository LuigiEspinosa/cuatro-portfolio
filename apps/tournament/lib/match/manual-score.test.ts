import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { manualResolveMatch } from '@/lib/match/manual-score';

const ADMIN = '76561198388441171';
/** Ids deliberately NOT 1..n, so an index/id mix-up cannot pass silently (mirrors bind.test.ts). */
const MATCH = 501;
const WINNER = 733;

/**
 * The `.rpc()` seam mock (lib/match/approve.test.ts). This wrapper does NO table reads — the RPC is the sole
 * authority — so `from` is wired only to PIN that fact: a later pre-read turns `expect(from).not…` red.
 */
function makeAdmin(rpcResult: { data?: unknown; error?: unknown } = { data: { ok: true }, error: null }) {
  const from = vi.fn(() => {
    throw new Error('manual-score wrappers must not read tables — the RPC is the authority');
  });
  const rpc = vi.fn((_fn: string, _args: Record<string, unknown>) => Promise.resolve(rpcResult));
  const admin = { from, rpc } as unknown as SupabaseClient;
  return { admin, from, rpc };
}

/** The RPC's full ok-payload for a successful manual resolution. */
function okPayload(over: Record<string, unknown> = {}) {
  return {
    ok: true,
    state: 'manual_resolved',
    score_a: 16,
    score_b: 14,
    winner_entry: WINNER,
    override: false,
    advanced: 1,
    champion: null,
    ...over,
  };
}

describe('manualResolveMatch — the RPC payload + classification', () => {
  it('calls manual_resolve_match with the EXACT snake_case payload (incl. p_override) and returns the resolution', async () => {
    const { admin, rpc, from } = makeAdmin({ data: okPayload(), error: null });

    const result = await manualResolveMatch(admin, {
      actingAdmin: ADMIN,
      matchId: MATCH,
      scoreA: 16,
      scoreB: 14,
      override: false,
    });
    expect(result).toEqual({
      ok: true,
      state: 'manual_resolved',
      scoreA: 16,
      scoreB: 14,
      winnerEntry: WINNER,
      override: false,
      advanced: 1,
      champion: null,
    });

    // ⚠ PIN EVERY ARGUMENT NAME — a typo'd key silently passes NULL into the RPC (the 4.1 review lesson).
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe('manual_resolve_match');
    expect(args).toEqual({
      p_match_id: MATCH,
      p_score_a: 16,
      p_score_b: 14,
      p_actor_steamid64: ADMIN,
      p_override: false,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('carries the override flag + champion through on a crowning audited override', async () => {
    // An override of the GF-deciding row: override=true, champion set. The flags are what the admin/queue reads.
    const { admin, rpc } = makeAdmin({
      data: okPayload({ override: true, advanced: 2, champion: WINNER }),
      error: null,
    });
    await expect(
      manualResolveMatch(admin, { actingAdmin: ADMIN, matchId: MATCH, scoreA: 16, scoreB: 9, override: true }),
    ).resolves.toEqual({
      ok: true,
      state: 'manual_resolved',
      scoreA: 16,
      scoreB: 14, // straight from the RPC reply, not the request — proves the wrapper trusts the DB's score
      winnerEntry: WINNER,
      override: true,
      advanced: 2,
      champion: WINNER,
    });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_override: true, p_score_a: 16, p_score_b: 9 });
  });

  it.each([
    ['bad_match'],
    ['not_manual_resolvable'],
    ['undetermined'],
    ['format_not_declared'],
    ['bad_score'],
    ['tied'],
    ['override_required'],
    ['nothing_to_override'],
  ])('surfaces the RPC %s refusal unchanged', async (reason) => {
    const { admin } = makeAdmin({ data: { ok: false, reason }, error: null });
    await expect(
      manualResolveMatch(admin, { actingAdmin: ADMIN, matchId: MATCH, scoreA: 16, scoreB: 14, override: false }),
    ).resolves.toEqual({ ok: false, reason });
  });

  it('fails CLOSED on an unrecognised refusal reason', async () => {
    const { admin } = makeAdmin({ data: { ok: false, reason: 'something_new' }, error: null });
    await expect(
      manualResolveMatch(admin, { actingAdmin: ADMIN, matchId: MATCH, scoreA: 16, scoreB: 14, override: false }),
    ).resolves.toEqual({ ok: false, reason: 'write_failed' });
  });

  it('fails CLOSED on a null/!ok reply with no reason at all', async () => {
    const nul = makeAdmin({ data: null, error: null });
    await expect(
      manualResolveMatch(nul.admin, { actingAdmin: ADMIN, matchId: MATCH, scoreA: 16, scoreB: 14, override: false }),
    ).resolves.toEqual({ ok: false, reason: 'write_failed' });
    const bare = makeAdmin({ data: { ok: false }, error: null });
    await expect(
      manualResolveMatch(bare.admin, { actingAdmin: ADMIN, matchId: MATCH, scoreA: 16, scoreB: 14, override: false }),
    ).resolves.toEqual({ ok: false, reason: 'write_failed' });
  });

  // ── The ok-payload SHAPE gate (the 4.1 review lesson: a typo'd jsonb key must not read as success) ──

  it.each([
    ['state', { state: undefined }],
    ['score_a', { score_a: undefined }],
    ['score_b', { score_b: undefined }],
    ['winner_entry', { winner_entry: undefined }],
    ['override', { override: undefined }],
    ['advanced', { advanced: undefined }],
  ])('fails CLOSED when the ok reply is missing %s', async (_field, over) => {
    const { admin } = makeAdmin({ data: okPayload(over), error: null });
    await expect(
      manualResolveMatch(admin, { actingAdmin: ADMIN, matchId: MATCH, scoreA: 16, scoreB: 14, override: false }),
    ).resolves.toEqual({ ok: false, reason: 'write_failed' });
  });

  it('fails CLOSED when a field is present but the WRONG TYPE, but accepts a null champion', async () => {
    // `typeof` gates, not truthiness: score 0 is valid and must pass, while a string "16" must not. A null
    // champion is VALID (only a Grand Final crowns one) and must pass.
    const wrong = makeAdmin({ data: okPayload({ score_a: '16' }), error: null });
    await expect(
      manualResolveMatch(wrong.admin, { actingAdmin: ADMIN, matchId: MATCH, scoreA: 16, scoreB: 14, override: false }),
    ).resolves.toEqual({ ok: false, reason: 'write_failed' });

    const nullChamp = makeAdmin({ data: okPayload({ champion: null }), error: null });
    await expect(
      manualResolveMatch(nullChamp.admin, { actingAdmin: ADMIN, matchId: MATCH, scoreA: 16, scoreB: 14, override: false }),
    ).resolves.toMatchObject({ ok: true, champion: null });
  });

  // ── SQLSTATE classification ──────────────────────────────────────────────

  it('maps the IC906 advance-refused RAISE to advance_refused (NOT a 500)', async () => {
    // advance_match returned {ok:false}; manual_resolve_match RAISED IC906 to roll the whole resolution back. A
    // rollback refusal is a REFUSAL, not a server fault (the 4.5/4.6b convention).
    const { admin } = makeAdmin({
      data: null,
      error: { code: 'IC906', message: 'advance refused (slot_taken) — the whole resolution is rolled back' },
    });
    await expect(
      manualResolveMatch(admin, { actingAdmin: ADMIN, matchId: MATCH, scoreA: 16, scoreB: 14, override: true }),
    ).resolves.toEqual({ ok: false, reason: 'advance_refused' });
  });

  it('maps the IC907 override-gate RAISE to override_not_audited (NOT a 500)', async () => {
    // match_manual_override_audited refused an admin_manual override with no matching manual_score audit row.
    // Should never surface through the RPC (it writes the row first), but a trigger refusal is a REFUSAL — the
    // honest report, exactly as bind.ts maps its should-never-happen 23514.
    const { admin } = makeAdmin({
      data: null,
      error: { code: 'IC907', message: 'an admin_manual override requires a manual_score audit_log row' },
    });
    await expect(
      manualResolveMatch(admin, { actingAdmin: ADMIN, matchId: MATCH, scoreA: 16, scoreB: 14, override: true }),
    ).resolves.toEqual({ ok: false, reason: 'override_not_audited' });
  });

  it.each([
    ['P0001', 'format.ts owns already_locked'],
    ['IC901', 'walkover.ts owns terminal'],
    ['IC902', 'walkover.ts owns advance_refused'],
    ['IC903', 'approve.ts owns advance_refused'],
    ['IC904', 'approve.ts owns terminal'],
    ['IC905', 'rollback.ts owns its invariant'],
  ])('does NOT hijack %s (%s) — it fails closed', async (code) => {
    const { admin } = makeAdmin({ data: null, error: { code, message: 'another lib owns this' } });
    await expect(
      manualResolveMatch(admin, { actingAdmin: ADMIN, matchId: MATCH, scoreA: 16, scoreB: 14, override: false }),
    ).resolves.toEqual({ ok: false, reason: 'write_failed' });
  });

  it('fails CLOSED on a transport error', async () => {
    const { admin } = makeAdmin({ data: null, error: { code: '40P01', message: 'deadlock detected' } });
    await expect(
      manualResolveMatch(admin, { actingAdmin: ADMIN, matchId: MATCH, scoreA: 16, scoreB: 14, override: false }),
    ).resolves.toEqual({ ok: false, reason: 'write_failed' });
  });
});
