import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  declareMatchFormat,
  MATCH_FORMATS,
  TIE_POLICIES,
  type FormatCommandResult,
} from '@/lib/match/format';

const ADMIN = '76561198388441171';
const T_ID = 7;
/** Match ids deliberately NOT 1..n, so an index/id mix-up cannot pass silently. */
const M1 = 501;
const M2 = 502;

/**
 * The chainable/thenable builder mock with its `.rpc()` seam (lib/bracket/generate.test.ts:536-575).
 *
 * `declareMatchFormat` does no table reads at all — the RPC is the sole authority, so there is no
 * "friendly early exit" read to mock here (unlike `generateAndPersistBracket`, which pre-reads the
 * tournament). `from` is still wired up so the tests can PIN that fact: if someone later adds a pre-read,
 * `expect(from).not.toHaveBeenCalled()` turns red and the decision gets made deliberately.
 */
function makeAdmin(rpcResult: { data?: unknown; error?: unknown } = { data: { ok: true }, error: null }) {
  const from = vi.fn(() => {
    throw new Error('declareMatchFormat must not read tables — the RPC is the authority');
  });
  // Typed params (rather than `vi.fn(() => …)`) so `rpc.mock.calls[0]` is a real [fn, args] tuple —
  // that is what lets the happy-path test assert the EXACT RPC payload, not merely the call count.
  const rpc = vi.fn((_fn: string, _args: Record<string, unknown>) => Promise.resolve(rpcResult));
  const admin = { from, rpc } as unknown as SupabaseClient;
  return { admin, from, rpc };
}

/** The RPC's success reply. The lib reports the DB's committed count, so the mock must supply it. */
const rpcOk = (declared: number, override = false) => ({
  data: { ok: true, declared, override },
  error: null,
});

const declare = (
  admin: SupabaseClient,
  overrides: Partial<Parameters<typeof declareMatchFormat>[1]> = {},
): Promise<FormatCommandResult> =>
  declareMatchFormat(admin, {
    actingAdmin: ADMIN,
    tournamentId: T_ID,
    format: 'mr12',
    tiePolicy: 'ot_mr3',
    ...overrides,
  });

// ── The catalog (organizer config — editable without a migration) ───────────

describe('the format catalog', () => {
  it('ships the starter vocabulary as plain arrays — editing it must never need a migration (OQ-4)', () => {
    // `match.format`/`tie_policy` are deliberately FREE TEXT in the DB (no CHECK enum), so THIS is the
    // vocabulary. If a future migration adds `check (format in (…))`, these arrays and that CHECK must be
    // kept in sync — this test is the reminder that the source of truth lives here, in code.
    expect(MATCH_FORMATS).toContain('mr12');
    expect(TIE_POLICIES).toContain('ot_mr3');
    expect(MATCH_FORMATS.length).toBeGreaterThan(0);
    expect(TIE_POLICIES.length).toBeGreaterThan(0);

    // ⭐ REGRESSION PIN (code review 2026-07-13). `bo3_mr12` shipped in the first cut and was pulled: the
    // `match` schema has ONE score_a/score_b, ONE demo_id and ONE winner_entry, and AD-18 is
    // single-demo-per-match — a best-of-three is unrepresentable. Because `format_locked` is a LATCH,
    // picking it would have created a permanently-latched row the system cannot model. Re-add it only
    // alongside a story that gives Bo3 a schema home.
    expect(MATCH_FORMATS).not.toContain('bo3_mr12');
  });
});

// ── Catalog validation happens BEFORE any I/O ───────────────────────────────

describe('declareMatchFormat — the catalog is validated before the database is touched', () => {
  it.each([
    ['an unknown format', { format: 'mr15' }],
    ['an unknown tie_policy', { tiePolicy: 'sudden_death' }],
    ['a blank format', { format: '' }],
    ['a blank tie_policy', { tiePolicy: '   ' }],
    ['a format that is nearly right', { format: 'MR12' }], // case-sensitive: the DB stores the exact string
    ['the withdrawn bo3_mr12', { format: 'bo3_mr12' }], // pulled at code review — no schema home for a Bo3
  ])('refuses %s with bad_format and NEVER calls the RPC', async (_label, patch) => {
    const { admin, rpc } = makeAdmin();
    await expect(declare(admin, patch)).resolves.toEqual({ ok: false, reason: 'bad_format' });
    // The whole point of the TS catalog: an unknown format never reaches the database at all.
    expect(rpc).not.toHaveBeenCalled();
  });
});

// ── The happy paths — and the EXACT payload ─────────────────────────────────

describe('declareMatchFormat — the RPC payload', () => {
  it('BULK-declares a whole tournament when matchIds is omitted (p_match_ids: null)', async () => {
    const { admin, rpc, from } = makeAdmin(rpcOk(30));

    const result = await declare(admin);
    expect(result).toEqual({ ok: true, declared: 30, override: false });

    // ⚠ PIN EVERY ARGUMENT NAME. `toEqual` on the whole payload means a typo'd key (`p_matchids`,
    // `p_tie_policy` -> `p_tiepolicy`) fails HERE — instead of silently passing NULL into a column and
    // leaving the suite green, which is exactly the class of bug Story 4.1's review caught.
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe('declare_match_format');
    expect(args).toEqual({
      p_tournament_id: T_ID,
      p_match_ids: null, // an explicit null selects the bulk path; `undefined` would be dropped from the JSON body
      p_format: 'mr12',
      p_tie_policy: 'ot_mr3',
      p_actor_steamid64: ADMIN, // the audit row's actor, written inside the same transaction
      p_override: false,
    });
    // No pre-read: the RPC re-validates everything under its own row locks, so there is nothing for the
    // lib to usefully check first.
    expect(from).not.toHaveBeenCalled();
  });

  it('targets specific matches, and carries the override flag through', async () => {
    const { admin, rpc } = makeAdmin(rpcOk(1, true));

    const result = await declare(admin, {
      matchIds: [M1, M2],
      format: 'mr8',
      tiePolicy: 'draw',
      override: true,
    });
    expect(result).toEqual({ ok: true, declared: 1, override: true });

    const [, args] = rpc.mock.calls[0];
    expect(args).toEqual({
      p_tournament_id: T_ID,
      p_match_ids: [M1, M2],
      p_format: 'mr8',
      p_tie_policy: 'draw',
      p_actor_steamid64: ADMIN,
      p_override: true,
    });
  });

  it('reports the count the DATABASE committed, not the number of ids we asked for', async () => {
    // The RPC returns GET DIAGNOSTICS ROW_COUNT. If the lib substituted `matchIds.length`, a short write
    // would be invisible to the caller by construction.
    const { admin } = makeAdmin(rpcOk(1));
    await expect(declare(admin, { matchIds: [M1, M2] })).resolves.toEqual({
      ok: true,
      declared: 1,
      override: false,
    });
  });
});

// ── Every RPC refusal maps through unchanged ────────────────────────────────

describe('declareMatchFormat — refusals', () => {
  it.each([
    ['bad_tournament'],
    ['bad_match'],
    ['bad_format'],
    ['override_needs_ids'],
    ['not_declarable'], // targeting a bye/void/forfeit row — the latch would make it irreversible
    ['already_locked'],
    ['not_overridable'], // override=true on a match that was never locked
    ['no_eligible_matches'],
  ])('surfaces the RPCs %s refusal unchanged (the route maps it to an HTTP status)', async (reason) => {
    const { admin } = makeAdmin({ data: { ok: false, reason }, error: null });
    await expect(declare(admin, { matchIds: [M1] })).resolves.toEqual({ ok: false, reason });
  });

  it('maps a format-lock triggers P0001 to already_locked, NOT to a 500', async () => {
    // ⭐ STORY 4.1'S REVIEW LESSON, APPLIED. Its D3 trigger's P0001 was left unmapped, so the ONE code
    // path the trigger existed for reported an HTTP 500. A frozen format is a REFUSAL, not a server
    // fault. (Unreachable through the RPC — it re-reads state under FOR UPDATE and writes the authorizing
    // audit row before the UPDATE — but a direct illegal write must still report honestly.)
    const { admin } = makeAdmin({ data: null, error: { code: 'P0001', message: 'format/tie_policy are FROZEN' } });
    await expect(declare(admin, { matchIds: [M1] })).resolves.toEqual({
      ok: false,
      reason: 'already_locked',
    });
  });

  it('fails CLOSED on an RPC transport error', async () => {
    const { admin } = makeAdmin({ data: null, error: { code: '40P01', message: 'deadlock detected' } });
    await expect(declare(admin)).resolves.toEqual({ ok: false, reason: 'write_failed' });
  });

  it('fails CLOSED on an unrecognised refusal reason — never a silent success', async () => {
    const { admin } = makeAdmin({ data: { ok: false, reason: 'something_new' }, error: null });
    await expect(declare(admin)).resolves.toEqual({ ok: false, reason: 'write_failed' });
  });

  it('fails CLOSED when the RPC claims ok but returns no count', async () => {
    // A reply the lib cannot trust is a write failure, not a success with an invented `declared: 0`.
    const { admin } = makeAdmin({ data: { ok: true }, error: null });
    await expect(declare(admin)).resolves.toEqual({ ok: false, reason: 'write_failed' });
  });

  it('fails CLOSED when the RPC claims ok but committed ZERO rows', async () => {
    // ⭐ `{ok: true, declared: 0}` used to be reported to the admin as HTTP 200 "done" over a write that
    // changed nothing. The RPC's `no_eligible_matches` guard makes zero unreachable today — but the code
    // review's fix added real state predicates to the target resolution, and "the DB said ok and changed
    // nothing" must never render as success.
    const { admin } = makeAdmin(rpcOk(0));
    await expect(declare(admin)).resolves.toEqual({ ok: false, reason: 'write_failed' });
  });

  it('fails CLOSED on a null RPC reply', async () => {
    const { admin } = makeAdmin({ data: null, error: null });
    await expect(declare(admin)).resolves.toEqual({ ok: false, reason: 'write_failed' });
  });
});
