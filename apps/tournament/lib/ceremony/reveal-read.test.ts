import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchRevealedCeremony, REVEAL_READ_REASONS } from '@/lib/ceremony/reveal-read';

/**
 * The reveal-gated server read (Story 6.10, AC5 — AD-22 / AD-11).
 *
 * ⚠ COLOCATED UNDER `lib/` ON PURPOSE — `vitest.config.ts:17` restricts collection to test files
 * under `lib`, so a test written beside the page under `app/` would SILENTLY NEVER RUN.
 *
 * ⭐ WHAT THIS SUITE CAN AND CANNOT PROVE, STATED UP FRONT. The reveal GATE is the database's
 * (`0028`'s four policies), and a fake client cannot exercise RLS — that half is pgTAP's and THE
 * BAR's. What is provable here is everything this file could get wrong on top of a correct gate:
 * naming its columns, refusing a malformed row, keeping the published order, judging each name
 * separately, and never touching a table it has no business in.
 */

const CEREMONY = 77;

type TableResult = { data?: unknown; error?: { message: string } | null };

/**
 * A chainable stub of the PostgREST builder.
 *
 * ⚠ EVERY CHAIN LINK RETURNS THE SAME THENABLE, so `.select().eq().order()` resolves to the table's
 * canned result however the reader happens to order its calls — the test must not silently depend on
 * a call ORDER the reader is free to change.
 */
function makeClient(tables: Record<string, TableResult>) {
  const selects: Record<string, string> = {};
  const filters: Array<{ table: string; op: string; column: string; value: unknown }> = [];
  const orders: Array<{ table: string; column: string; ascending: unknown }> = [];

  const from = vi.fn((table: string) => {
    const result = tables[table] ?? { data: [], error: null };
    const builder: Record<string, unknown> = {
      select: (cols: string) => {
        selects[table] = cols;
        return builder;
      },
      eq: (column: string, value: unknown) => {
        filters.push({ table, op: 'eq', column, value });
        return builder;
      },
      in: (column: string, value: unknown) => {
        filters.push({ table, op: 'in', column, value });
        return builder;
      },
      order: (column: string, opts: { ascending?: unknown } = {}) => {
        orders.push({ table, column, ascending: opts.ascending });
        return builder;
      },
      maybeSingle: () => Promise.resolve(result),
      then: (res: (v: TableResult) => unknown, rej: (e: unknown) => unknown) =>
        Promise.resolve(result).then(res, rej),
    };
    return builder;
  });

  const rpc = vi.fn(() => {
    throw new Error('fetchRevealedCeremony must not call an RPC — the gate is RLS, not a function');
  });

  return { client: { from, rpc } as unknown as SupabaseClient, from, selects, filters, orders };
}

// ── fixtures shaped like the real tables ────────────────────────────────────────────────────────

const SPIN_ROWS = [
  { id: 900, spin_index: 1, kind: 'main', live_award_ids: [401, 402] },
  { id: 901, spin_index: 2, kind: 'main', live_award_ids: [403] },
  { id: 902, spin_index: 3, kind: 'pity', live_award_ids: null },
];

const RESULT_ROWS = [
  // ⚠ Deliberately inserted in an order that DISAGREES with `live_award_ids`, so the ordering
  // assertion cannot pass by accident of insertion.
  { id: 12, spin_id: 900, award_id: 402, outcome_kind: 'no_eligible_players', is_pity: false, is_shared: false, tie_ladder_exit_step: null, deciding_value: null, deciding_num: null, deciding_den: null },
  { id: 11, spin_id: 900, award_id: 401, outcome_kind: 'winner', is_pity: false, is_shared: false, tie_ladder_exit_step: null, deciding_value: 21, deciding_num: null, deciding_den: null },
  { id: 13, spin_id: 901, award_id: 403, outcome_kind: 'shared', is_pity: false, is_shared: true, tie_ladder_exit_step: 5, deciding_value: '4', deciding_num: null, deciding_den: null },
  { id: 14, spin_id: 902, award_id: null, outcome_kind: 'winner', is_pity: true, is_shared: false, tie_ladder_exit_step: null, deciding_value: null, deciding_num: null, deciding_den: null },
];

const WINNER_ROWS = [
  { id: 1, award_result_id: 11, winner_entry_id: 111 },
  { id: 2, award_result_id: 13, winner_entry_id: 111 },
  { id: 3, award_result_id: 13, winner_entry_id: 222 },
  { id: 4, award_result_id: 14, winner_entry_id: 333 },
];

const AWARD_ROWS = [
  { id: 401, name: 'Máquina de Frags', bucket: 'skill', deciding_stat: 'kills' },
  { id: 402, name: 'Muralla', bucket: 'clutch', deciding_stat: 'adr' },
  { id: 403, name: 'Cuchillero', bucket: 'weird', deciding_stat: 'knife_kills' },
];

const ROSTER_ROWS = [
  { id: 111, steamid64: '76561100000000111' },
  { id: 222, steamid64: '76561100000000222' },
  { id: 333, steamid64: '76561100000000333' },
];

const PLAYER_ROWS = [
  { steamid64: '76561100000000111', display_name: 'Dex' },
  { steamid64: '76561100000000222', display_name: 'Theo' },
  { steamid64: '76561100000000333', display_name: 'Mara' },
];

function happyTables(over: Partial<Record<string, TableResult>> = {}): Record<string, TableResult> {
  return {
    spin: { data: SPIN_ROWS, error: null },
    award_result: { data: RESULT_ROWS, error: null },
    award_result_winner: { data: WINNER_ROWS, error: null },
    award: { data: AWARD_ROWS, error: null },
    roster_entry: { data: ROSTER_ROWS, error: null },
    player: { data: PLAYER_ROWS, error: null },
    ...over,
  };
}

// ── the closed refusal set ──────────────────────────────────────────────────────────────────────

describe('the refusal set is closed and exported as a runtime array (AC12)', () => {
  it('is exactly the two reasons this reader can produce', () => {
    expect([...REVEAL_READ_REASONS]).toEqual(['no_revealed_spins', 'read_failed']);
    expect(REVEAL_READ_REASONS.length).toBeGreaterThan(0);
  });
});

// ── AC5: the projection ─────────────────────────────────────────────────────────────────────────

describe('AC5 — the columns are NAMED, and the wrong tables are never touched', () => {
  it('⛔ never issues `select(*)` on ANY table', () => {
    const { client, selects } = makeClient(happyTables());
    return fetchRevealedCeremony(client, CEREMONY).then(() => {
      expect(Object.keys(selects).length).toBeGreaterThan(0);
      for (const [table, cols] of Object.entries(selects)) {
        expect(cols, table).not.toContain('*');
      }
    });
  });

  it('names every column each surface actually renders', async () => {
    const { client, selects } = makeClient(happyTables());
    await fetchRevealedCeremony(client, CEREMONY);
    expect(selects.spin).toBe('id, spin_index, kind, live_award_ids');
    for (const col of ['outcome_kind', 'is_pity', 'is_shared', 'tie_ladder_exit_step', 'deciding_value', 'deciding_num', 'deciding_den']) {
      expect(selects.award_result, col).toContain(col);
    }
    expect(selects.award).toBe('id, name, bucket, deciding_stat');
  });

  it('⛔⛔ NEVER reads `ceremony` — the `select=*` 42501 trap lives there, and that read is not this file’s', () => {
    // `0028:485-490`: PostgREST's default projection 42501s on `ceremony`'s four UNGRANTED columns
    // even though the row is visible. `lib/ceremony/verification.ts` owns that read, with its columns
    // named; a second one here would be a second place to get it wrong.
    const { client, from } = makeClient(happyTables());
    return fetchRevealedCeremony(client, CEREMONY).then(() => {
      const tables = from.mock.calls.map((c) => c[0]);
      expect(tables).not.toContain('ceremony');
      expect(tables).not.toContain('verification_bundle');
      expect(tables).not.toContain('stat_row_snapshot');
    });
  });

  it('⛔ never calls an RPC — the gate is RLS, and a `security definer` bypass is the hole AD-22 shuts', () => {
    const { client } = makeClient(happyTables());
    // The stub THROWS on `.rpc`, so a call would fail this test loudly rather than silently.
    return expect(fetchRevealedCeremony(client, CEREMONY)).resolves.toMatchObject({ ok: true });
  });

  it('scopes the spin read to the ceremony and asks for ASCENDING spin_index', async () => {
    const { client, filters, orders } = makeClient(happyTables());
    await fetchRevealedCeremony(client, CEREMONY);
    expect(filters).toContainEqual({ table: 'spin', op: 'eq', column: 'ceremony_id', value: CEREMONY });
    expect(orders).toContainEqual({ table: 'spin', column: 'spin_index', ascending: true });
  });

  it('⛔ never writes a `revealed_at` filter of its own — the secrecy is the POLICY, not this file', () => {
    // A filter here would read as though the gate lived in TypeScript, and a later edit could remove
    // it believing it was redundant. `0028`'s `spin_viewer_read` is the gate.
    const { client, filters } = makeClient(happyTables());
    return fetchRevealedCeremony(client, CEREMONY).then(() => {
      expect(filters.map((f) => f.column)).not.toContain('revealed_at');
    });
  });
});

// ── AC2: the non-zero denominator ───────────────────────────────────────────────────────────────

describe('AC2 — zero revealed spins is a REFUSAL, not an empty success', () => {
  it('refuses `no_revealed_spins` when the gate hides everything', async () => {
    const { client } = makeClient(happyTables({ spin: { data: [], error: null } }));
    expect(await fetchRevealedCeremony(client, CEREMONY)).toEqual({ ok: false, reason: 'no_revealed_spins' });
  });

  it('refuses it for a null payload too', async () => {
    const { client } = makeClient(happyTables({ spin: { data: null, error: null } }));
    expect(await fetchRevealedCeremony(client, CEREMONY)).toEqual({ ok: false, reason: 'no_revealed_spins' });
  });

  it('⛔ does not go on to read the child tables once it has refused', async () => {
    const { client, from } = makeClient(happyTables({ spin: { data: [], error: null } }));
    await fetchRevealedCeremony(client, CEREMONY);
    expect(from.mock.calls.map((c) => c[0])).toEqual(['spin']);
  });
});

// ── fail closed ─────────────────────────────────────────────────────────────────────────────────

describe('⚠ FAIL CLOSED — a half-built ceremony is worse than none', () => {
  const TRANSPORT_FAILURES = ['spin', 'award_result', 'award_result_winner', 'award'] as const;

  it('the case table is non-empty', () => {
    expect(TRANSPORT_FAILURES.length).toBe(4);
  });

  it.each(TRANSPORT_FAILURES)('a transport error on %s becomes read_failed', async (table) => {
    const { client } = makeClient(happyTables({ [table]: { data: null, error: { message: 'boom' } } }));
    expect(await fetchRevealedCeremony(client, CEREMONY)).toEqual({ ok: false, reason: 'read_failed' });
  });

  const MALFORMED = [
    ['a spin with a non-numeric id', { spin: { data: [{ ...SPIN_ROWS[0], id: '900' }], error: null } }],
    ['a spin_index below 1 (verify.ts refuses those too)', { spin: { data: [{ ...SPIN_ROWS[0], spin_index: 0 }], error: null } }],
    ['a fractional spin_index', { spin: { data: [{ ...SPIN_ROWS[0], spin_index: 1.5 }], error: null } }],
    ['a spin with no kind', { spin: { data: [{ ...SPIN_ROWS[0], kind: null }], error: null } }],
    ['a result whose outcome_kind is not text', { award_result: { data: [{ ...RESULT_ROWS[0], outcome_kind: 7 }], error: null } }],
    ['a result whose is_pity is not a boolean', { award_result: { data: [{ ...RESULT_ROWS[0], is_pity: 'yes' }], error: null } }],
    ['a result whose award_id is neither an id nor null', { award_result: { data: [{ ...RESULT_ROWS[0], award_id: 'x' }], error: null } }],
    ['a result pointing at a spin that is not visible', { award_result: { data: [{ ...RESULT_ROWS[0], spin_id: 5150 }], error: null } }],
    ['a ladder step that is not an integer', { award_result: { data: [{ ...RESULT_ROWS[0], tie_ladder_exit_step: 2.5 }], error: null } }],
    ['a deciding_value that is a boolean', { award_result: { data: [{ ...RESULT_ROWS[0], deciding_value: true }], error: null } }],
    ['a winner row with a non-numeric entry id', { award_result_winner: { data: [{ ...WINNER_ROWS[0], winner_entry_id: '111' }], error: null } }],
    ['an award with no bucket', { award: { data: [{ ...AWARD_ROWS[0], bucket: null }], error: null } }],
    ['an award with no deciding_stat', { award: { data: [{ ...AWARD_ROWS[0], deciding_stat: undefined }], error: null } }],
  ] as const;

  it('the malformed-row table is non-empty', () => {
    expect(MALFORMED.length).toBeGreaterThan(10);
  });

  it.each(MALFORMED)('refuses %s', async (_label, over) => {
    const { client } = makeClient(happyTables(over as Partial<Record<string, TableResult>>));
    expect(await fetchRevealedCeremony(client, CEREMONY)).toEqual({ ok: false, reason: 'read_failed' });
  });

  /**
   * ⭐⭐ MUTATION SURVIVOR M02, AND WHY THE ORIGINAL CASE WAS VACUOUS.
   *
   * The table above already carried *"a spin_index below 1"*, and deleting the `row.spin_index < 1`
   * guard did NOT redden it — the mutant SURVIVED. The reason is the fixture, not the guard: that
   * case replaces the whole `spin` table with ONE row while leaving all four `award_result` rows in
   * place, so results pointing at spins 901/902 hit the `spinIndexById.has(row.spin_id)` membership
   * check and the read fails for a completely different reason. The assertion passed either way, so
   * it was measuring nothing.
   *
   * ⛔ THE PAIR BELOW IS THE FIX, AND IT IS A PAIR ON PURPOSE: one self-consistent fixture that
   * differs from the other in EXACTLY the index. Without the positive control, "it refuses" would
   * again be a fact about the fixture rather than about the guard.
   * ⚠ `verify.ts:658-661` refuses `< 1` as `bundle_shape` for the same reason: `spin_index` is
   * 1-based (`0029:697-698`), so a 0 means the producer and this reader disagree about the axis.
   */
  const consistent = (spinIndex: number) => ({
    spin: { data: [{ id: 900, spin_index: spinIndex, kind: 'main', live_award_ids: [401] }], error: null },
    award_result: {
      data: [{ id: 11, spin_id: 900, award_id: 401, outcome_kind: 'no_eligible_players', is_pity: false, is_shared: false, tie_ladder_exit_step: null, deciding_value: null, deciding_num: null, deciding_den: null }],
      error: null,
    },
    award_result_winner: { data: [], error: null },
    award: { data: [AWARD_ROWS[0]], error: null },
    roster_entry: { data: [], error: null },
    player: { data: [], error: null },
  });

  it('⛔ refuses spin_index 0 — and the fixture is otherwise wholly consistent', async () => {
    const { client } = makeClient(consistent(0));
    expect(await fetchRevealedCeremony(client, CEREMONY)).toEqual({ ok: false, reason: 'read_failed' });
  });

  it('…and accepts the SAME fixture at spin_index 1, so the refusal is the INDEX and nothing else', async () => {
    const { client } = makeClient(consistent(1));
    const result = await fetchRevealedCeremony(client, CEREMONY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ceremony.spins.map((s) => s.spinIndex)).toEqual([1]);
  });

  it('refuses a NEGATIVE index too', async () => {
    const { client } = makeClient(consistent(-1));
    expect(await fetchRevealedCeremony(client, CEREMONY)).toEqual({ ok: false, reason: 'read_failed' });
  });

  it('a numeric handed back as a STRING is fine — PostgREST spells `numeric` both ways', async () => {
    const { client } = makeClient(happyTables());
    const result = await fetchRevealedCeremony(client, CEREMONY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Row 11 sent `21` as a JSON number, row 13 sent `'4'` as text; both normalise to text.
    expect(result.ceremony.spins[0]!.awards[0]!.decidingValue).toBe('21');
    expect(result.ceremony.spins[1]!.awards[0]!.decidingValue).toBe('4');
  });
});

// ── order ───────────────────────────────────────────────────────────────────────────────────────

describe('⛔⛔ the DRAW order is the REVEAL order and is never re-sorted', () => {
  it('orders a spin’s awards by `live_award_ids`, ⛔ not by insertion and not by id', async () => {
    // `sweep.test.ts:448` warns this story BY NAME: `live_award_ids` *"is the REVEAL order Story 6.10
    // renders — sorting it in place would silently discard it."* The fixture inserts result 12
    // (award 402) BEFORE result 11 (award 401), while the draw order is [401, 402].
    const { client } = makeClient(happyTables());
    const result = await fetchRevealedCeremony(client, CEREMONY);
    if (!result.ok) throw new Error(result.reason);
    expect(result.ceremony.spins[0]!.awards.map((a) => a.awardId)).toEqual([401, 402]);
    // ⛔ and NOT the insertion order the rows arrived in.
    expect(result.ceremony.spins[0]!.awards.map((a) => a.awardResultId)).not.toEqual([12, 11]);
  });

  it('keeps a result whose award is absent from the draw list AFTER the drawn ones', async () => {
    const tables = happyTables({
      spin: { data: [{ id: 900, spin_index: 1, kind: 'main', live_award_ids: [402] }], error: null },
      award_result: {
        data: [
          { ...RESULT_ROWS[1], id: 11, spin_id: 900, award_id: 401 },
          { ...RESULT_ROWS[0], id: 12, spin_id: 900, award_id: 402 },
        ],
        error: null,
      },
      // ⚠ CODE REVIEW 2026-08-11 — THE WINNER ROWS MUST BE OVERRIDDEN TOO, and the reader is what
      // said so. This case narrows `award_result` to ids 11/12 while `WINNER_ROWS` still points at
      // 13 and 14, so the default fixture describes a ceremony whose winners belong to results that
      // were never returned. The reader now REFUSES that (it used to drop the rows in silence), and
      // it refusing here is the guard working — the fixture was inconsistent, not the guard.
      award_result_winner: { data: [{ id: 1, award_result_id: 11, winner_entry_id: 111 }], error: null },
    });
    const { client } = makeClient(tables);
    const result = await fetchRevealedCeremony(client, CEREMONY);
    if (!result.ok) throw new Error(result.reason);
    // 402 is drawn (index 0); 401 is unplaced and sorts after — ⛔ never ahead of a drawn one.
    expect(result.ceremony.spins[0]!.awards.map((a) => a.awardId)).toEqual([402, 401]);
  });

  it('returns the spins in the order the server sent them', async () => {
    const { client } = makeClient(happyTables());
    const result = await fetchRevealedCeremony(client, CEREMONY);
    if (!result.ok) throw new Error(result.reason);
    expect(result.ceremony.spins.map((s) => s.spinIndex)).toEqual([1, 2, 3]);
    expect(result.ceremony.spins.map((s) => s.kind)).toEqual(['main', 'main', 'pity']);
  });
});

// ── identity, names and the guard ───────────────────────────────────────────────────────────────

describe('the award identity opens per-award, and a pity result has none (R6)', () => {
  it('resolves name, bucket and deciding stat for a catalog award', async () => {
    const { client } = makeClient(happyTables());
    const result = await fetchRevealedCeremony(client, CEREMONY);
    if (!result.ok) throw new Error(result.reason);
    expect(result.ceremony.spins[0]!.awards[0]).toMatchObject({
      awardId: 401,
      name: 'Máquina de Frags',
      bucket: 'skill',
      decidingStat: 'kills',
    });
  });

  it('⚠ a PITY result carries nulls BY CONSTRUCTION and is not an error', async () => {
    // `0026:90-91` — *"a consolation prize is not a category"* — so `award_id is null` and the join
    // yields nothing (`0028:402-412`). ⛔ Model it; do not invent a name for it.
    const { client } = makeClient(happyTables());
    const result = await fetchRevealedCeremony(client, CEREMONY);
    if (!result.ok) throw new Error(result.reason);
    expect(result.ceremony.spins[2]!.awards[0]).toMatchObject({
      awardId: null,
      name: null,
      bucket: null,
      decidingStat: null,
      isPity: true,
    });
  });

  it('⛔ does not ask the `award` table anything when no result names one', async () => {
    const tables = happyTables({
      spin: { data: [SPIN_ROWS[2]], error: null },
      award_result: { data: [RESULT_ROWS[3]], error: null },
      award_result_winner: { data: [WINNER_ROWS[3]], error: null },
    });
    const { client, from } = makeClient(tables);
    await fetchRevealedCeremony(client, CEREMONY);
    expect(from.mock.calls.map((c) => c[0])).not.toContain('award');
  });

  it('⛔ 6.9a DECISION J — the ladder step is ABSENT for null, present for a real rung', async () => {
    const { client } = makeClient(happyTables());
    const result = await fetchRevealedCeremony(client, CEREMONY);
    if (!result.ok) throw new Error(result.reason);
    expect(Object.hasOwn(result.ceremony.spins[0]!.awards[0]!, 'ladderExitStep')).toBe(false);
    expect(result.ceremony.spins[1]!.awards[0]!.ladderExitStep).toBe(5);
  });
});

describe('AC9 — every viewer-bound name is judged PER ELEMENT', () => {
  it('resolves each co-winner separately, in insertion order', async () => {
    const { client } = makeClient(happyTables());
    const result = await fetchRevealedCeremony(client, CEREMONY);
    if (!result.ok) throw new Error(result.reason);
    const shared = result.ceremony.spins[1]!.awards[0]!;
    expect(shared.isShared).toBe(true);
    expect(shared.winners.map((w) => w.displayName)).toEqual(['Dex', 'Theo']);
  });

  it('⛔⛔ ONE refused name costs ONE name — ⛔ not the whole co-winner set', async () => {
    // ⭐ THIS IS THE MEASURED HAZARD `6-9b:354` FOUND AND HOMED HERE. Judging a `' · '`-JOINED
    // aggregate against `VIEWER_TEXT_MAX = 80` meant a single co-winner with an emoji-ZWJ Steam name
    // (U+200D is ubiquitous in them) sent the WHOLE subtitle to the fallback — so a shared trophy
    // announced nobody. Per element, the damage is one element.
    const { client } = makeClient(
      happyTables({
        player: {
          data: [
            { steamid64: '76561100000000111', display_name: 'Dex' },
            { steamid64: '76561100000000222', display_name: 'The\u200Do' },
            { steamid64: '76561100000000333', display_name: 'Mara' },
          ],
          error: null,
        },
      }),
    );
    const result = await fetchRevealedCeremony(client, CEREMONY);
    if (!result.ok) throw new Error(result.reason);
    const shared = result.ceremony.spins[1]!.awards[0]!;
    expect(shared.winners).toHaveLength(2);
    expect(shared.winners[0]!.displayName).toBe('Dex');
    expect(shared.winners[1]).toMatchObject({ displayName: null, nameRefusal: 'zero_width' });
    // ⛔ REFUSED, NEVER DROPPED — dropping it would misreport who won.
    expect(shared.winners[1]!.rosterEntryId).toBe(222);
  });

  it('a player REMOVED after playing is `unresolved` — ⛔ a different fact from a refused name', async () => {
    const { client } = makeClient(happyTables({ roster_entry: { data: [ROSTER_ROWS[0]], error: null } }));
    const result = await fetchRevealedCeremony(client, CEREMONY);
    if (!result.ok) throw new Error(result.reason);
    const shared = result.ceremony.spins[1]!.awards[0]!;
    expect(shared.winners[1]).toMatchObject({ rosterEntryId: 222, displayName: null, nameRefusal: 'unresolved' });
  });

  it('an award NAME that fails the guard is refused with its reason, and the card survives', async () => {
    // `0023`'s `[^[:space:]]` check RETURNS TRUE for a lone U+200B, so an award named with one is
    // accepted, stored, and would render as an EMPTY card at the ceremony (`safe-text.ts:4-12`).
    const { client } = makeClient(
      happyTables({ award: { data: [{ ...AWARD_ROWS[0], name: '\u200B' }, AWARD_ROWS[1], AWARD_ROWS[2]], error: null } }),
    );
    const result = await fetchRevealedCeremony(client, CEREMONY);
    if (!result.ok) throw new Error(result.reason);
    expect(result.ceremony.spins[0]!.awards[0]).toMatchObject({
      awardId: 401,
      name: null,
      nameRefusal: 'zero_width',
      bucket: 'skill',
    });
  });

  it('a name that is merely long-but-legal is NOT refused', async () => {
    // ⛔ NON-VACUITY FOR THE GUARD ITSELF: if everything were refused the assertions above would pass
    // for the wrong reason. 40 characters is well inside `VIEWER_TEXT_MAX = 80`.
    const { client } = makeClient(
      happyTables({ award: { data: [{ ...AWARD_ROWS[0], name: 'A'.repeat(40) }, AWARD_ROWS[1], AWARD_ROWS[2]], error: null } }),
    );
    const result = await fetchRevealedCeremony(client, CEREMONY);
    if (!result.ok) throw new Error(result.reason);
    expect(result.ceremony.spins[0]!.awards[0]!.name).toBe('A'.repeat(40));
  });
});

describe('the assembled ceremony', () => {
  it('returns the ceremony id it was asked for, and groups results under their spins', async () => {
    const { client } = makeClient(happyTables());
    const result = await fetchRevealedCeremony(client, CEREMONY);
    if (!result.ok) throw new Error(result.reason);
    expect(result.ceremony.ceremonyId).toBe(CEREMONY);
    expect(result.ceremony.spins.map((s) => s.awards.length)).toEqual([2, 1, 1]);
  });

  it('gives a zero-winner result an EMPTY winner list rather than a placeholder', async () => {
    // ⛔ 6.9a DECISION B: *"a `redacted` placeholder is a defect"* — it leaks cardinality-by-position.
    const { client } = makeClient(happyTables());
    const result = await fetchRevealedCeremony(client, CEREMONY);
    if (!result.ok) throw new Error(result.reason);
    const zero = result.ceremony.spins[0]!.awards[1]!;
    expect(zero.outcomeKind).toBe('no_eligible_players');
    expect(zero.winners).toEqual([]);
  });
});

// ── the guards the 2026-08-11 code review added ─────────────────────────────────────────────────

describe('⛔ numericText refuses what it cannot render faithfully', () => {
  it('⭐ a FLOAT is refused rather than rounded — the module said so and did the opposite', () => {
    // `Number.isFinite` excluded only NaN/Infinity, so `21.5` rendered as "21.5 bajas" and
    // `0.1 + 0.2` would have announced "0.30000000000000004" beside a hash promising reproducibility.
    const tables = happyTables({
      award_result: { data: [{ ...RESULT_ROWS[0], deciding_value: 21.5 }], error: null },
      award_result_winner: { data: [], error: null },
    });
    const { client } = makeClient(tables);
    return fetchRevealedCeremony(client, CEREMONY).then((r) => {
      expect(r.ok).toBe(false);
    });
  });

  it('⭐ an integer past 2^53 is refused — `0027:970` permits 38 digits and a double holds 15', async () => {
    const tables = happyTables({
      award_result: { data: [{ ...RESULT_ROWS[0], deciding_value: 12345678901234567890 }], error: null },
      award_result_winner: { data: [], error: null },
    });
    const { client } = makeClient(tables);
    expect((await fetchRevealedCeremony(client, CEREMONY)).ok).toBe(false);
  });

  it('a SAFE integer as a JSON number is still fine — the refusal is precision, not type', async () => {
    const tables = happyTables({
      award_result: { data: [{ ...RESULT_ROWS[0], deciding_value: 21 }], error: null },
      award_result_winner: { data: [], error: null },
    });
    const { client } = makeClient(tables);
    const r = await fetchRevealedCeremony(client, CEREMONY);
    if (!r.ok) throw new Error(r.reason);
    expect(r.ceremony.spins[0]!.awards[0]!.decidingValue).toBe('21');
  });

  it('a numeric handed back as a STRING keeps every digit, however many', async () => {
    const big = '123456789012345678901234567890123456';
    const tables = happyTables({
      award_result: { data: [{ ...RESULT_ROWS[0], deciding_value: big }], error: null },
      award_result_winner: { data: [], error: null },
    });
    const { client } = makeClient(tables);
    const r = await fetchRevealedCeremony(client, CEREMONY);
    if (!r.ok) throw new Error(r.reason);
    expect(r.ceremony.spins[0]!.awards[0]!.decidingValue).toBe(big);
  });
});

describe('⛔ density and forward-onlyness are a SERVER fact — a broken read is refused, not rendered', () => {
  /**
   * ⭐⭐ A SELF-CONSISTENT PAIR THAT DIFFERS IN EXACTLY ONE FIELD, AND THE MUTATION PASS IS WHY.
   *
   * The first version of these cases overrode ONLY the `spin` table and left the default four
   * `award_result` rows behind — one of which pointed at spin 902, which the override had removed. So
   * the read refused via the result→spin orphan check and the test passed for a reason that had
   * nothing to do with the duplicate. Cutting the duplicate guard out left it green: **M18 SURVIVED**.
   * ⚠ This is the same trap the story's own `M02` hit (`:1216`) — a fixture that replaces one table
   * and orphans another tests a DIFFERENT check than the one it names. The `valid` builder below is
   * the control: it must SUCCEED, so any refusal in the cases beneath it is attributable to the one
   * field that changed.
   */
  const consistent = (spins: ReadonlyArray<Record<string, unknown>>) =>
    happyTables({
      spin: { data: spins, error: null },
      award_result: {
        data: [
          { ...RESULT_ROWS[1], id: 11, spin_id: 900, award_id: 401 },
          { ...RESULT_ROWS[0], id: 12, spin_id: 901, award_id: 402 },
        ],
        error: null,
      },
      award_result_winner: { data: [{ id: 1, award_result_id: 11, winner_entry_id: 111 }], error: null },
    });

  it('⛔ THE CONTROL — the same fixture with DISTINCT ids and indexes reads clean', async () => {
    const { client } = makeClient(
      consistent([
        { id: 900, spin_index: 1, kind: 'main', live_award_ids: [401] },
        { id: 901, spin_index: 2, kind: 'main', live_award_ids: [402] },
      ]),
    );
    const r = await fetchRevealedCeremony(client, CEREMONY);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ceremony.spins.map((s) => s.spinIndex)).toEqual([1, 2]);
  });

  it('refuses two spins sharing a spin_index', async () => {
    // ⚠ IDENTICAL to the control above except `spin_index`. Nothing else can explain the refusal.
    const { client } = makeClient(
      consistent([
        { id: 900, spin_index: 1, kind: 'main', live_award_ids: [401] },
        { id: 901, spin_index: 1, kind: 'main', live_award_ids: [402] },
      ]),
    );
    const r = await fetchRevealedCeremony(client, CEREMONY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('read_failed');
  });

  it('refuses two spin rows sharing an id', async () => {
    // ⚠ IDENTICAL to the control except the second row's `id`. See the note above.
    const { client } = makeClient(
      consistent([
        { id: 900, spin_index: 1, kind: 'main', live_award_ids: [401] },
        { id: 900, spin_index: 2, kind: 'main', live_award_ids: [402] },
      ]),
    );
    expect((await fetchRevealedCeremony(client, CEREMONY)).ok).toBe(false);
  });

  it('⛔ refuses a spin_index that is not a safe integer', async () => {
    const { client } = makeClient(
      consistent([
        { id: 900, spin_index: 1.5, kind: 'main', live_award_ids: [401] },
        { id: 901, spin_index: 2, kind: 'main', live_award_ids: [402] },
      ]),
    );
    expect((await fetchRevealedCeremony(client, CEREMONY)).ok).toBe(false);
  });

  it('⛔ refuses a RESULT whose parent spin is absent — the mirror of the winner check', async () => {
    // M20 survived the first pass: nothing exercised this direction, even though the reader's own
    // comment cites it as the precedent the winner→result guard was modelled on.
    const tables = happyTables({
      spin: { data: [{ id: 900, spin_index: 1, kind: 'main', live_award_ids: [401] }], error: null },
      award_result: { data: [{ ...RESULT_ROWS[1], id: 11, spin_id: 555, award_id: 401 }], error: null },
      award_result_winner: { data: [], error: null },
    });
    const { client } = makeClient(tables);
    const r = await fetchRevealedCeremony(client, CEREMONY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('read_failed');
  });

  it('⛔ a REPEATED award id in live_award_ids keeps its FIRST draw position, never its last', async () => {
    // `live_award_ids` IS the draw order (`0025:127-129`). Taking the last occurrence would silently
    // move an award later in the ceremony than the server drew it.
    const tables = happyTables({
      spin: { data: [{ id: 900, spin_index: 1, kind: 'main', live_award_ids: [401, 402, 401] }], error: null },
      award_result: {
        data: [
          { ...RESULT_ROWS[0], id: 12, spin_id: 900, award_id: 402 },
          { ...RESULT_ROWS[1], id: 11, spin_id: 900, award_id: 401 },
        ],
        error: null,
      },
      award_result_winner: { data: [{ id: 1, award_result_id: 11, winner_entry_id: 111 }], error: null },
    });
    const { client } = makeClient(tables);
    const r = await fetchRevealedCeremony(client, CEREMONY);
    if (!r.ok) throw new Error(r.reason);
    // 401 was drawn FIRST (index 0). If the repeat at index 2 won, 402 would sort ahead of it.
    expect(r.ceremony.spins[0]!.awards.map((a) => a.awardId)).toEqual([401, 402]);
  });

  it('⭐ refuses a winner whose parent award_result is absent — ⛔ silence would misreport who won', async () => {
    // The mirrored direction (result -> spin) already failed closed; this one dropped the row and
    // then rendered "Nadie alcanzo el minimo" over a winner the database had actually returned.
    const tables = happyTables({
      award_result_winner: { data: [{ id: 1, award_result_id: 99999, winner_entry_id: 111 }], error: null },
    });
    const { client } = makeClient(tables);
    const r = await fetchRevealedCeremony(client, CEREMONY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('read_failed');
  });
});
