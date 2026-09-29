import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { lockCeremony } from '@/lib/ceremony/lock';

const ADMIN = '76561198388441171';
/** Deliberately not 1, so an id/index mix-up cannot pass silently (the lib/match/*.test.ts convention). */
const TOURNAMENT = 77;

const SEED = 'a'.repeat(64);
const CONTENT = 'b'.repeat(64);

const OK = {
  ok: true,
  ceremony_state: 'locked',
  snapshot_id: 42,
  content_sha256: CONTENT,
  seed_hex: SEED,
  row_count: 28,
  eligible_count: 0,
};

/**
 * The `.rpc()` seam mock (lib/awards/curate.test.ts / lib/match/bind.test.ts). The wrapper does NO table
 * reads — the RPC is the sole authority — so `from` is wired only to PIN that fact: a later pre-read (say, a
 * "check whether the ceremony is already locked" convenience read) turns the assertion red, because such a
 * read would be OUTSIDE the RPC's transaction and its answer stale by the time the RPC ran.
 */
function makeAdmin(rpcResult: { data?: unknown; error?: unknown } = { data: OK, error: null }) {
  const from = vi.fn(() => {
    throw new Error('lockCeremony must not read tables — the RPC is the authority');
  });
  const rpc = vi.fn((_fn: string, _args: Record<string, unknown>) => Promise.resolve(rpcResult));
  const admin = { from, rpc } as unknown as SupabaseClient;
  return { admin, from, rpc };
}

describe('lockCeremony — the RPC payload (AC2)', () => {
  it('calls lock_ceremony with the EXACT snake_case arguments and nothing else', async () => {
    const { admin, rpc, from } = makeAdmin();

    const result = await lockCeremony(admin, { actingAdmin: ADMIN, tournamentId: TOURNAMENT });
    expect(result).toEqual({
      ok: true,
      snapshotId: 42,
      contentSha256: CONTENT,
      seedHex: SEED,
      rowCount: 28,
      eligibleCount: 0,
    });

    // ⚠ PIN EVERY ARGUMENT NAME — a typo'd key silently passes NULL into the RPC (the 4.1 review lesson).
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe('lock_ceremony');
    expect(Object.keys(args as object).sort()).toEqual(['p_actor', 'p_tournament_id']);
    expect((args as Record<string, unknown>).p_tournament_id).toBe(TOURNAMENT);
    expect((args as Record<string, unknown>).p_actor).toBe(ADMIN);
    expect(from).not.toHaveBeenCalled();
  });

  it('threads the ACTING admin as the actor — never a value derived from the tournament', async () => {
    const { admin, rpc } = makeAdmin();
    await lockCeremony(admin, { actingAdmin: '76561197960287930', tournamentId: TOURNAMENT });
    expect((rpc.mock.calls[0][1] as Record<string, unknown>).p_actor).toBe('76561197960287930');
  });

  it('carries a NON-ZERO eligible_count through (the measured eligibility picture, not just a bare ok)', async () => {
    const { admin } = makeAdmin({ data: { ...OK, row_count: 28, eligible_count: 3 }, error: null });
    await expect(lockCeremony(admin, { actingAdmin: ADMIN, tournamentId: TOURNAMENT })).resolves.toEqual({
      ok: true,
      snapshotId: 42,
      contentSha256: CONTENT,
      seedHex: SEED,
      rowCount: 28,
      eligibleCount: 3,
    });
  });

  it('accepts eligible_count = 0 as a SUCCESS — a zero-eligible capture is a correct snapshot of a real problem', async () => {
    // 6.1 measured 0/28 players clearing floor_kills=20 on this corpus. The lock must still succeed and report
    // the zero; refusing here would hide the finding 6.4/6.5 need (Story 6.2 AC4).
    const { admin } = makeAdmin({ data: { ...OK, eligible_count: 0 }, error: null });
    const result = await lockCeremony(admin, { actingAdmin: ADMIN, tournamentId: TOURNAMENT });
    expect(result.ok).toBe(true);
    expect(result).toMatchObject({ eligibleCount: 0 });
  });
});

describe('lockCeremony — typed refusals surfaced verbatim, nothing written (AC2)', () => {
  it.each([
    'no_tournament',
    'already_locked',
    'not_bracket_live',
    'champion_undecided',
    'seed_unavailable',
    // ⭐ code review 2026-08-03: the seed names a demo that is no longer championship-deciding. Pinned here
    // because a refusal missing from the trusted Set fails closed to an opaque 500 — the exact defect THE BAR
    // caught for approve/rollback/manual-score, and the reason every new reason must land in this list.
    'seed_stale',
    'no_roster',
    'empty_snapshot',
  ])('surfaces `%s` verbatim', async (reason) => {
    const { admin, rpc } = makeAdmin({ data: { ok: false, reason }, error: null });
    await expect(lockCeremony(admin, { actingAdmin: ADMIN, tournamentId: TOURNAMENT })).resolves.toEqual({
      ok: false,
      reason,
    });
    // Exactly one RPC call and no table access: a refusal costs one round trip and writes nothing.
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('fails CLOSED on an unrecognised refusal reason (never invents an ok)', async () => {
    const { admin } = makeAdmin({ data: { ok: false, reason: 'something_new' }, error: null });
    await expect(lockCeremony(admin, { actingAdmin: ADMIN, tournamentId: TOURNAMENT })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });

  it('fails closed on a null reply', async () => {
    const { admin } = makeAdmin({ data: null, error: null });
    await expect(lockCeremony(admin, { actingAdmin: ADMIN, tournamentId: TOURNAMENT })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });

  it("maps a transport/SQL error to write_failed and does NOT map another lib's SQLSTATE", async () => {
    // P0001 is lib/match/format.ts's; IC903/IC905/IC907 belong to approve/rollback/manual-score; IC908 is the
    // fair_seed write-once trigger, reachable only from an approve. This lib raises nothing of its own.
    for (const code of ['P0001', 'IC903', 'IC905', 'IC907', 'IC908', '23514', '42501']) {
      const { admin } = makeAdmin({ data: null, error: { code, message: `boom ${code}` } });
      await expect(lockCeremony(admin, { actingAdmin: ADMIN, tournamentId: TOURNAMENT })).resolves.toEqual({
        ok: false,
        reason: 'write_failed',
      });
    }
  });
});

describe('the module is SERVER-ONLY', () => {
  it("declares `import 'server-only'` — this module holds the service-role seam for the seed and the snapshot", () => {
    // `server-only` only throws when a CLIENT component imports it, so the bundler is the real enforcement and
    // no runtime test can exercise it. Deleting the import reddens NOTHING (the 6.1 review's finding, and its
    // honest caveat). Asserting on the SOURCE is what makes the guard non-removable in silence.
    const source = readFileSync(new URL('./lock.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/^\s*import 'server-only';/m);
  });
});

describe('lockCeremony — the ok payload is VALIDATED before it is trusted', () => {
  it('rejects an ok reply missing any usable field (no silent success)', async () => {
    for (const data of [
      { ok: true },
      { ...OK, snapshot_id: undefined },
      { ...OK, snapshot_id: '42' }, // a string id is not an id
      { ...OK, content_sha256: undefined },
      { ...OK, seed_hex: undefined },
      { ...OK, row_count: undefined },
      { ...OK, eligible_count: undefined },
      { ...OK, row_count: '28' },
    ]) {
      const { admin } = makeAdmin({ data, error: null });
      await expect(lockCeremony(admin, { actingAdmin: ADMIN, tournamentId: TOURNAMENT })).resolves.toEqual({
        ok: false,
        reason: 'write_failed',
      });
    }
  });
});
