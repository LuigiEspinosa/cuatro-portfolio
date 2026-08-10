import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { revealSpin } from '@/lib/ceremony/reveal';

const ADMIN = '76561198388441171';
/** Deliberately not 1, so an id/index mix-up cannot pass silently (the lib/match/*.test.ts convention). */
const CEREMONY = 77;
/** Likewise deliberately not 1 AND different from the ceremony id — the two are adjacent RPC arguments. */
const SPIN_INDEX = 5;

const OK = {
  ok: true,
  ceremony_id: CEREMONY,
  spin_id: 4242,
  spin_index: SPIN_INDEX,
  kind: 'main',
  revealed_at: '2026-08-08T19:40:17.773739+00:00',
  revealed_spins: 5,
  total_spins: 40,
  awards: 1,
  winners: 0,
  ceremony_state: 'spinning',
  ceremony_complete: false,
};

/**
 * The `.rpc()` seam mock (lib/ceremony/lock.test.ts's shape). The wrapper does NO table reads — the RPC is
 * the sole authority — so `from` is wired only to PIN that fact: a convenience pre-read (say, "is this spin
 * already revealed?") would run OUTSIDE the RPC's transaction and its answer would be stale by the time the
 * RPC took its locks, which is the whole reason the guard lives in SQL.
 */
function makeAdmin(rpcResult: { data?: unknown; error?: unknown } = { data: OK, error: null }) {
  const from = vi.fn(() => {
    throw new Error('revealSpin must not read tables — the RPC is the authority');
  });
  const rpc = vi.fn((_fn: string, _args: Record<string, unknown>) => Promise.resolve(rpcResult));
  const admin = { from, rpc } as unknown as SupabaseClient;
  return { admin, from, rpc };
}

describe('revealSpin — the RPC payload (AC5)', () => {
  it('calls reveal_spin with the EXACT snake_case arguments and nothing else', async () => {
    const { admin, rpc, from } = makeAdmin();

    const result = await revealSpin(admin, {
      actingAdmin: ADMIN,
      ceremonyId: CEREMONY,
      spinIndex: SPIN_INDEX,
    });
    expect(result).toEqual({
      ok: true,
      spinId: 4242,
      spinIndex: SPIN_INDEX,
      kind: 'main',
      revealedAt: OK.revealed_at,
      revealedSpins: 5,
      totalSpins: 40,
      awards: 1,
      winners: 0,
      ceremonyState: 'spinning',
      ceremonyComplete: false,
    });

    // ⚠ PIN EVERY ARGUMENT NAME — a typo'd key silently passes NULL into the RPC (the 4.1 review lesson).
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe('reveal_spin');
    expect(Object.keys(args as object).sort()).toEqual(['p_actor', 'p_ceremony_id', 'p_spin_index']);
    expect((args as Record<string, unknown>).p_ceremony_id).toBe(CEREMONY);
    expect((args as Record<string, unknown>).p_spin_index).toBe(SPIN_INDEX);
    expect((args as Record<string, unknown>).p_actor).toBe(ADMIN);
    expect(from).not.toHaveBeenCalled();
  });

  it('threads the ACTING admin as the actor — never a value derived from the ceremony', async () => {
    const { admin, rpc } = makeAdmin();
    await revealSpin(admin, {
      actingAdmin: '76561197960287930',
      ceremonyId: CEREMONY,
      spinIndex: SPIN_INDEX,
    });
    expect((rpc.mock.calls[0][1] as Record<string, unknown>).p_actor).toBe('76561197960287930');
  });

  it('carries ceremony_complete=true through — the one fact that says there is no next spin to press', async () => {
    const { admin } = makeAdmin({
      data: { ...OK, spin_index: 40, revealed_spins: 40, ceremony_state: 'complete', ceremony_complete: true },
      error: null,
    });
    const result = await revealSpin(admin, {
      actingAdmin: ADMIN,
      ceremonyId: CEREMONY,
      spinIndex: 40,
    });
    expect(result).toMatchObject({ ok: true, ceremonyState: 'complete', ceremonyComplete: true });
  });

  it('accepts winners = 0 as a SUCCESS — over the measured corpus a zero-winner reveal is the COMMON case', async () => {
    // 0/28 players clear the FR-21 24/20 floors, so all 12 main spins resolved `no_eligible_players`.
    // A reveal that "succeeded but awarded nobody" is a correct reveal of a real measurement, not an error.
    const { admin } = makeAdmin({ data: { ...OK, awards: 1, winners: 0 }, error: null });
    const result = await revealSpin(admin, {
      actingAdmin: ADMIN,
      ceremonyId: CEREMONY,
      spinIndex: SPIN_INDEX,
    });
    expect(result.ok).toBe(true);
    expect(result).toMatchObject({ winners: 0, awards: 1 });
  });

  it('accepts awards = 0 as a SUCCESS — that is exactly what a PITY reveal looks like', async () => {
    // A pity result carries award_id NULL (0026:90-91), so it reveals no catalog award at all — R6.
    const { admin } = makeAdmin({ data: { ...OK, kind: 'pity', awards: 0, winners: 1 }, error: null });
    const result = await revealSpin(admin, {
      actingAdmin: ADMIN,
      ceremonyId: CEREMONY,
      spinIndex: SPIN_INDEX,
    });
    expect(result).toMatchObject({ ok: true, kind: 'pity', awards: 0, winners: 1 });
  });
});

describe('revealSpin — typed refusals surfaced verbatim, nothing written (AC5)', () => {
  it.each([
    'no_ceremony',
    'ceremony_not_spinning',
    // ⭐ Story 6.9a / migration 0029: no reveal before the commitment exists. The mirror of
    // publish_bundle's `reveal_in_progress` — one closes publish-after-reveal, this closes
    // reveal-before-publish, and either alone leaves the other order legal.
    'bundle_not_published',
    'no_such_spin',
    // ⭐ R9 / Cuatro 2026-08-08: a double-tap REFUSES rather than returning ok. A reason missing from the
    // trusted Set fails closed to an opaque 500 — the exact defect THE BAR caught for approve/rollback.
    'already_revealed',
    // ⭐ AC5: the published spin order IS the reveal order (UX-DR32/42).
    'out_of_order',
    'unknown_actor',
  ])('surfaces `%s` verbatim', async (reason) => {
    const { admin, rpc } = makeAdmin({ data: { ok: false, reason }, error: null });
    await expect(
      revealSpin(admin, { actingAdmin: ADMIN, ceremonyId: CEREMONY, spinIndex: SPIN_INDEX }),
    ).resolves.toEqual({ ok: false, reason });
    // Exactly one RPC call and no table access: a refusal costs one round trip and writes nothing.
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  // ⭐⭐ CODE-REVIEW FIX 2026-08-08 — the refusal's CONTEXT, which was parsed and then dropped.
  // `RpcResult.expected_spin_index` was declared and never read anywhere, while 0028's comment and this
  // module's header both promise it travels to the caller "so the admin learns what to press". The two
  // cases below are what makes the promise falsifiable; without them the field could be dropped again and
  // nothing would redden.
  it('carries `expected_spin_index` out of an out_of_order refusal — the admin learns what to press', async () => {
    const { admin } = makeAdmin({
      data: { ok: false, reason: 'out_of_order', spin_index: 40, expected_spin_index: 4, revealed_spins: 3, total_spins: 40 },
      error: null,
    });
    await expect(
      revealSpin(admin, { actingAdmin: ADMIN, ceremonyId: CEREMONY, spinIndex: 40 }),
    ).resolves.toEqual({ ok: false, reason: 'out_of_order', expectedSpinIndex: 4 });
  });

  it('carries `revealed_at` out of an already_revealed refusal — which fact is true, not just that one is', async () => {
    const { admin } = makeAdmin({
      data: { ok: false, reason: 'already_revealed', spin_index: 1, revealed_at: '2026-08-08T20:57:44.430235+00:00' },
      error: null,
    });
    await expect(
      revealSpin(admin, { actingAdmin: ADMIN, ceremonyId: CEREMONY, spinIndex: 1 }),
    ).resolves.toEqual({
      ok: false,
      reason: 'already_revealed',
      revealedAt: '2026-08-08T20:57:44.430235+00:00',
    });
  });

  it('fails CLOSED on an unrecognised refusal reason (never invents an ok)', async () => {
    const { admin } = makeAdmin({ data: { ok: false, reason: 'something_new' }, error: null });
    await expect(
      revealSpin(admin, { actingAdmin: ADMIN, ceremonyId: CEREMONY, spinIndex: SPIN_INDEX }),
    ).resolves.toEqual({ ok: false, reason: 'write_failed' });
  });

  it('fails closed on a null reply', async () => {
    const { admin } = makeAdmin({ data: null, error: null });
    await expect(
      revealSpin(admin, { actingAdmin: ADMIN, ceremonyId: CEREMONY, spinIndex: SPIN_INDEX }),
    ).resolves.toEqual({ ok: false, reason: 'write_failed' });
  });

  it("maps a transport/SQL error to write_failed, including its OWN IC911, and maps no other lib's code", async () => {
    // ⭐ IC911 is 0028's and is deliberately NOT given a friendly reason: it means the revealed set is not a
    // dense prefix, i.e. `spin.revealed_at` was written outside this RPC and the published spin order is
    // already broken. A 500 is the honest answer. IC901–IC910 belong to walkover/approve/rollback/
    // manual-score/fair-seed/ceremony-transition; P0001 is lib/match/format.ts's.
    for (const code of ['IC911', 'P0001', 'IC903', 'IC905', 'IC907', 'IC908', 'IC910', '23514', '42501']) {
      const { admin } = makeAdmin({ data: null, error: { code, message: `boom ${code}` } });
      await expect(
        revealSpin(admin, { actingAdmin: ADMIN, ceremonyId: CEREMONY, spinIndex: SPIN_INDEX }),
      ).resolves.toEqual({ ok: false, reason: 'write_failed' });
    }
  });
});

describe('the module is SERVER-ONLY', () => {
  it("declares `import 'server-only'` — this module holds the service-role seam that turns the reveal axis", () => {
    // `server-only` only throws when a CLIENT component imports it, so the bundler is the real enforcement and
    // no runtime test can exercise it. Deleting the import reddens NOTHING (the 6.1 review's finding, and its
    // honest caveat). Asserting on the SOURCE is what makes the guard non-removable in silence.
    const source = readFileSync(new URL('./reveal.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/^\s*import 'server-only';/m);
  });
});

describe('revealSpin — the ok payload is VALIDATED before it is trusted', () => {
  it('rejects an ok reply missing any usable field (no silent success)', async () => {
    for (const data of [
      { ok: true },
      { ...OK, spin_id: undefined },
      { ...OK, spin_id: '4242' }, // a string id is not an id
      { ...OK, spin_index: undefined },
      { ...OK, kind: undefined },
      { ...OK, revealed_at: undefined },
      { ...OK, revealed_spins: undefined },
      { ...OK, total_spins: undefined },
      { ...OK, awards: undefined },
      { ...OK, winners: undefined },
      { ...OK, ceremony_state: undefined },
      // ⭐ the one a boolean field makes easy to get wrong: `undefined` is falsy, so a bare truthiness check
      // would have read a MISSING ceremony_complete as "not complete" and silently hidden the end of the
      // ceremony from the caller.
      { ...OK, ceremony_complete: undefined },
      { ...OK, ceremony_complete: 'false' },
      { ...OK, total_spins: '40' },
    ]) {
      const { admin } = makeAdmin({ data, error: null });
      await expect(
        revealSpin(admin, { actingAdmin: ADMIN, ceremonyId: CEREMONY, spinIndex: SPIN_INDEX }),
      ).resolves.toEqual({ ok: false, reason: 'write_failed' });
    }
  });
});

/**
 * ⭐⭐ GUARD THE GUARDS — the project's signature defect, at its seventh occurrence (`6-8a:909`:
 * "`if len(inputReachable) != 6` measures the size of a map literal written two lines above it, and nothing
 * in the test reads `ceremony.go`"). The `it.each` list above is a HAND-WRITTEN list, so on its own it can
 * only prove that the reasons SOMEBODY THOUGHT OF are handled. This block instead reads BOTH sides from
 * SOURCE — the reasons the migration actually returns, and the reasons the lib actually trusts — and asserts
 * they are the same set in BOTH directions. Neither side is a copy of anything in this file.
 */
describe('the trusted reason set is the migration’s reason set — read from source, both directions', () => {
  const MIGRATIONS_DIR = new URL('../../supabase/migrations/', import.meta.url);
  const LIB = new URL('./reveal.ts', import.meta.url);

  /**
   * ⭐⭐ THE **LATEST** DEFINITION WINS, AND FINDING IT IS PART OF THE TEST (Story 6.9a).
   *
   * This used to read `0028_reveal_gating.sql` by name. Migration 0029 `create or replace`s
   * `reveal_spin` to add `bundle_not_published`, so a hard-coded 0028 would have compared the LIVE
   * lib against a SUPERSEDED body — the cross-check would have gone red for the right reason and
   * been "fixed" by re-pointing it at 0029, which is the same trap one migration later.
   *
   * ⛔ So the file is DISCOVERED rather than named: every migration is scanned for a definition of
   * this function and the highest-numbered one is authoritative, exactly as PostgreSQL's own
   * `create or replace` semantics say. A future 0030 that replaces `reveal_spin` again is picked up
   * with no edit here, and if it adds a reason the lib does not trust, THIS test is what reddens.
   */
  function latestRevealSpinSource(): { file: string; sql: string; start: number } {
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort(); // zero-padded numeric prefixes, so lexicographic IS numeric order
    expect(files.length).toBeGreaterThan(0);

    // ⛔ 6.9a CODE REVIEW — `lastIndexOf`, NOT `indexOf`, AND THE MARKER LOOP TAKES THE LATEST
    // POSITION RATHER THAN THE LAST MARKER CHECKED. Both were the same trap this helper exists to
    // close, reproduced one level in: `indexOf` returns the FIRST definition, so a migration that
    // replaces the function twice (a first attempt, then a corrected one later in the same file)
    // would have measured the body PostgreSQL has already superseded — while staying green. And
    // iterating markers with an unconditional assignment kept whichever marker was checked LAST,
    // not whichever appeared last in the file, so a file containing both forms picked by loop
    // order instead of by position.
    let latest: { file: string; sql: string; start: number } | null = null;
    for (const file of files) {
      const sql = readFileSync(new URL(file, MIGRATIONS_DIR), 'utf8');
      let best = -1;
      for (const marker of ['create function public.reveal_spin(', 'create or replace function public.reveal_spin(']) {
        const start = sql.lastIndexOf(marker);
        if (start > best) best = start;
      }
      if (best > -1) latest = { file, sql, start: best };
    }
    // ⚠ A non-null assertion here would let a rename silently produce an EMPTY reason set, which the
    // count guard below would then catch — but one layer later and with a confusing message.
    expect(latest, 'no migration defines public.reveal_spin').not.toBeNull();
    return latest!;
  }

  /** The `reveal_spin` body ONLY — its migration also replaces other RPCs whose reasons are not ours. */
  function revealSpinBody(): string {
    const { sql, start } = latestRevealSpinSource();
    const end = sql.indexOf('comment on function public.reveal_spin(', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return (
      sql
        .slice(start, end)
        .split('\n')
        // Strip comment lines: the header lists the closed set in prose, and a prose list is not evidence.
        .filter((line) => !line.trimStart().startsWith('--'))
        .join('\n')
    );
  }

  function migrationReasons(): string[] {
    const matches = [...revealSpinBody().matchAll(/'reason',\s*'([a-z_]+)'/g)].map((m) => m[1]);
    // ⚠ ASSERT THE COUNT BEFORE THE SET. `bool_and`-style "all of these are present" assertions pass
    // vacuously over an EMPTY match list (6.8a's review), and so would a set comparison of [] against [] if
    // the slice above ever stopped matching. A non-trivial count is what makes the comparison mean anything.
    expect(matches.length).toBeGreaterThanOrEqual(6);
    return [...new Set(matches)].sort();
  }

  function libReasons(): string[] {
    const src = readFileSync(LIB, 'utf8');
    // ⚠ The closing bracket only — the declaration ends `] as const)` since the code-review fix that
    // derives the union FROM this set, and a regex anchored on `])` silently matched NOTHING and would
    // have reddened on `expect(block).not.toBeNull()` rather than drifting green.
    const block = /const REVEAL_REASONS = new Set\(\[([\s\S]*?)\]/.exec(src);
    expect(block).not.toBeNull();
    const found = [
      ...block![1]
        .split('\n')
        // Strip comment lines, exactly as revealSpinBody() does for the SQL side: a reason named in prose
        // beside the list is not evidence that the list contains it.
        .filter((line) => !line.trimStart().startsWith('//') && !line.trimStart().startsWith('*'))
        .join('\n')
        .matchAll(/'([a-z_]+)'/g),
    ].map((m) => m[1]);
    expect(found.length).toBeGreaterThanOrEqual(6);
    return [...new Set(found)].sort();
  }

  it('every reason reveal_spin RETURNS is trusted by the lib (a new SQL refusal cannot fail closed silently)', () => {
    expect(libReasons()).toEqual(expect.arrayContaining(migrationReasons()));
  });

  it('every reason the lib trusts is one reveal_spin can actually RETURN (no phantom reason)', () => {
    expect(migrationReasons()).toEqual(expect.arrayContaining(libReasons()));
  });

  it('the two sets are EXACTLY equal, and non-empty', () => {
    const sql = migrationReasons();
    expect(sql.length).toBeGreaterThan(0);
    expect(libReasons()).toEqual(sql);
  });

  it('`write_failed` is the lib’s OWN fail-closed reason and is NOT in the SQL set', () => {
    // It is the reason a transport error, a null reply, an unrecognised refusal or a malformed ok maps to.
    // If it ever appeared in the migration, the two-direction equality above would silently start allowing a
    // SQL refusal that the route maps to 500 — which is the opposite of a typed refusal.
    expect(migrationReasons()).not.toContain('write_failed');
  });
});

/**
 * ⚠ THE ROUTE'S `STATUS_FOR` NUMERIC VALUES ARE NOT TESTED HERE, AND THAT IS STATED RATHER THAN PRETENDED
 * OTHERWISE. `vitest.config.ts:17` restricts collection to `lib/**`, so a test placed under `app/` silently
 * does not run — the trap that would make a green suite meaningless. What IS enforced at compile time is
 * exhaustiveness: `Record<Extract<RevealSpinResult, {ok:false}>['reason'], number>` makes a reason with no
 * status entry a BUILD error (`npm run build`, which `npm test` does not perform). The numeric mapping
 * itself is untested for exactly the same reason every other admin route's is — `deferred-work.md:279`,
 * homed to Epic 7. This is the fifth such map.
 */
