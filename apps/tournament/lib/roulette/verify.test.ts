import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { blankOut } from '../../test/source-scan';
import { PITY_LABEL, stage1Label } from './labels';
import { fr29Ladder } from './ladder';
import { resolvePity } from './pity';
import { createStream, decodeSeedHex } from './prng';
import { stage1Pick } from './stage1';
import type { Stage1Candidate } from './stage1';
import { resolveSpin } from './sweep';
import type { Outcome, SnapshotPlayer } from './stage2';
import { canonicalSha256Hex, canonicalize } from './canonical';
import {
  ALGO_MAJOR,
  ALGO_NAME,
  ALGO_VERSION,
  REASON_OUTCOME,
  VERIFY_OUTCOMES,
  VERIFY_REASONS,
  parseAlgoVersion,
  parseBundle,
  verifyCeremony,
  webCryptoAvailable,
} from './verify';

/**
 * The browser ceremony orchestrator's suite (Story 6.9b, AC5/AC6/AC8/AC9/AC12).
 *
 * ⭐⭐ THE FIXTURE IS PRODUCED BY THE ENGINE, NOT TYPED OUT. `buildCeremony` below is a miniature of
 * `worker/ceremony`'s builder: it runs the REAL `stage1Pick` / `resolveSpin` / `resolvePity` over a
 * synthetic roster, threads the shelf, and renders the result as a bundle document in the exact
 * shape `bundle.go` publishes. `verifyCeremony` then re-derives that document from the seed alone.
 * A hand-typed expected document would assert that the verifier agrees with whatever the author
 * believed the engine did; this asserts it agrees with what the engine ACTUALLY did.
 *
 * ⛔⛔ AND THE FIXTURE IS DELIBERATELY NOT THE REAL CORPUS'S SHAPE. On the measured corpus 0 of 28
 * players clear the FR-21 floors, so every main spin resolves `no_eligible_players`, NOBODY is ever
 * put on a shelf, and the shelf stays empty for the whole ceremony — which means the W10
 * `Promise.all` mutant would SURVIVE a corpus-only run, because concurrent spins weighing against an
 * empty shelf compute exactly the same weights as sequential ones. This roster has floors of 0, four
 * awards with four DIFFERENT winners, and a weight table with distinct entries, so the shelf is
 * non-empty from spin 2 onward and shelf corruption changes the drawn bytes. See
 * `verify.ts`'s header for why that, and not the reentrancy throw, is what the mutant breaks.
 *
 * ⚠ AC5's REAL-CORPUS INVARIANTS (main-spin 22 bytes, pity 27 bytes / 27 draws, whole ceremony 49
 * bytes, the `aw-04,aw-12,…` drawn order) are NOT assertable here: the corpus lives in a database,
 * not in the repo. They are measured in THE BAR (AC13) against a rebuilt corpus, and the report shape
 * this suite pins — `drawOrder`, `mainBytes`, `pityBytes` — is what makes them assertable there.
 */

// ── the synthetic ceremony ────────────────────────────────────────────────────

const SEED_HEX = '1b3cd6780000000000000000000000000000000000000000000000000003279c';

/** ⚠ Strictly decreasing positive integers, and DISTINCT — an all-equal table hides shelf damage. */
const WEIGHT_TABLE = [100, 60, 30];

interface FixtureAward {
  readonly id: string;
  readonly priority: number;
  readonly decidingStat: string;
  /**
   * ⭐ THE FIFTH AWARD IS A `rate`, AND THE MUTATION PASS IS WHY. With only volume awards every
   * outcome's deciding value is a single magnitude, so `deciding_num` / `deciding_den` are absent on
   * every row — and a mutant that dropped the `deciding_den` comparison SURVIVED, because no fixture
   * could produce a pair to disagree about. A rate award also drives the verifier through Stage 2's
   * cross-multiplication rather than its scalar path.
   */
  readonly cls: 'volume' | 'rate';
}

/**
 * FIVE awards whose winners OVERLAP — three go to `1001`, one to `1004`, and the fifth is the RATE
 * award that `cls` above explains (added so the `deciding_num`/`deciding_den` comparisons have a pair
 * to disagree about; without it two mutants survived).
 *
 * ⚠ 6.9b CODE REVIEW — this header said "Four awards" while the array below has five. Corrected.
 *
 * ⛔⛔ THE OVERLAP IS THE WHOLE POINT AND THE FIRST DRAFT GOT IT BACKWARDS. With four DISTINCT
 * winners the shelf grows every spin and STILL never changes a weight: each remaining award's
 * provisional winner is a different player who holds nothing, so every candidate keeps `table[0]`
 * for the whole ceremony and the fixture is as shelf-blind as the real corpus is. Because `1001`
 * wins three of these, their second and third awards weigh `table[1]` and `table[2]`, so the shelf
 * genuinely moves the drawn bytes — which is what makes the W10 `Promise.all` mutant killable here.
 */
const AWARDS: readonly FixtureAward[] = [
  { id: '11', priority: 1, decidingStat: 'kills', cls: 'volume' },
  { id: '12', priority: 2, decidingStat: 'deaths', cls: 'volume' },
  { id: '13', priority: 3, decidingStat: 'assists', cls: 'volume' },
  { id: '14', priority: 4, decidingStat: 'headshots', cls: 'volume' },
  { id: '15', priority: 5, decidingStat: 'adr', cls: 'rate' },
];

/**
 * `[steamid64, kills, deaths, assists, headshots, adrNum]` — SIX columns.
 *
 * ⚠ 6.9b CODE REVIEW — this line listed five columns while the tuple carries six; the sixth is the
 * rate award's numerator (its denominator is always 1). Corrected, because a fixture legend that
 * disagrees with its own data is how the next reader mis-reads a failure.
 *
 * `1001` tops three columns and `1004` tops the fourth, so the shelf reaches the remaining
 * candidates. The other five win nothing and land in the consolation draw.
 *
 * ⚠ EVERY COLUMN HOLDS DISTINCT VALUES, DELIBERATELY. An accidental tie would route through the
 * FR-29 ladder, and with `secondary`/`efficiency`/`h2h` empty and every `achievement_ts` at the
 * absent sentinel it would bottom out at rung 5 as a SHARED trophy — changing who is winless and
 * making the fixture's shape depend on a tiebreak nobody chose.
 */
const ROSTER: readonly (readonly [string, number, number, number, number, number])[] = [
  // sid, kills, deaths, assists, headshots, adrNum (the rate award's numerator; den is always 1)
  ['1001', 10, 10, 10, 1, 50],
  ['1002', 1, 2, 3, 2, 10],
  ['1003', 2, 3, 4, 3, 20],
  ['1004', 3, 4, 5, 20, 100],
  ['1005', 4, 5, 6, 4, 30],
  ['1006', 5, 6, 7, 5, 40],
  ['1007', 6, 7, 8, 6, 60],
];

function players(): SnapshotPlayer[] {
  return ROSTER.map(([sid, k, d, a, h, adr]) => ({
    steamid64: sid,
    roundsPlayed: 30n,
    kills: BigInt(k),
    idleDq: false,
    volume: { kills: BigInt(k), deaths: BigInt(d), assists: BigInt(a), headshots: BigInt(h) },
    // ⚠ NEVER PRE-DIVIDED: AD-19 carries the two integer halves and 0024:690-691 refuses to divide
    // them, because a `numeric` quotient is not reproducible across two runtimes.
    rate: { adr: { num: BigInt(adr), den: 1n } },
    secondary: {},
    efficiency: {},
    h2h: {},
    achievementTs: -1n,
  }));
}

/** The bundle's `players` entries, in the byte-lex order `bundle.go:1052` sorts them into. */
function playersDoc(): unknown[] {
  return ROSTER.map(([sid, k, d, a, h, adr]) => ({
    steamid64: sid,
    volume: { kills: String(k), deaths: String(d), assists: String(a), headshots: String(h) },
    rate: { adr: { num: String(adr), den: '1' } },
    secondary: {},
    efficiency: {},
    h2h: {},
    rounds_played: '30',
    kills: String(k),
    idle_dq: false,
    achievement_ts: '-1',
  }));
}

function awardOf(a: FixtureAward) {
  return {
    decidingStat: a.decidingStat,
    class: a.cls,
    direction: 'max' as const,
    floorRounds: 0,
    floorKills: 0,
    secondaryStat: null,
    effNumKey: null,
    effDenKey: null,
  };
}

/** Render one `Outcome` into the flat `awards` entry `bundle.go:839-885` publishes. */
function awardEntry(a: FixtureAward, outcome: Outcome): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    award_id: a.id,
    bucket: 'skill',
    class: a.cls,
    deciding_stat: a.decidingStat,
    direction: 'max',
    floor_rounds: 0,
    floor_kills: 0,
    priority: a.priority,
    outcome_kind: outcome.kind,
    is_shared: outcome.kind === 'shared',
    is_pity: false,
    winners:
      outcome.kind === 'winner' ? [outcome.steamid64] : outcome.kind === 'shared' ? [...outcome.winners] : [],
  };
  // ⭐ DECISION J — ABSENT, never `0`.
  const step = outcome.kind === 'winner' || outcome.kind === 'shared' ? outcome.ladderExitStep : undefined;
  if (step !== undefined) entry.tie_ladder_exit_step = step;
  if (outcome.kind === 'winner' && outcome.decidingValue !== undefined) {
    const dv = outcome.decidingValue;
    if (dv.class === 'volume') entry.deciding_value = dv.value.toString();
    else {
      entry.deciding_num = dv.num.toString();
      entry.deciding_den = dv.den.toString();
    }
  }
  return entry;
}

interface BuiltCeremony {
  readonly doc: Record<string, unknown>;
  readonly sha256: string;
  readonly mainSpins: number;
  readonly drawOrder: readonly string[];
  readonly mainBytes: readonly number[];
  readonly pityBytes: number;
  readonly pitySpins: number;
}

/**
 * Run the ceremony with the real engine and render the document.
 *
 * ⛔ SEQUENTIAL, AND THREADING THE SHELF ITSELF — the same contract `verify.ts` carries. If this
 * producer were concurrent it would build a document the verifier correctly rejects, and the suite
 * would report a verifier bug that is really a fixture bug.
 */
async function buildCeremony(): Promise<BuiltCeremony> {
  const seed = decodeSeedHex(SEED_HEX);
  const roster = players();
  const shelf: Record<string, number> = {};
  const outcomes = new Map<string, Outcome>();
  const spinPlan: Record<string, unknown>[] = [];
  const drawOrder: string[] = [];
  const mainBytes: number[] = [];

  let pool = AWARDS.map((a) => a.id);
  let spin = 0;

  while (pool.length > 0) {
    spin += 1;
    const candidates: Stage1Candidate[] = pool.map((id) => {
      const a = AWARDS.find((x) => x.id === id) as FixtureAward;
      return { awardId: id, priority: a.priority, award: awardOf(a) };
    });
    const stream = await createStream(seed, stage1Label(spin));
    const picked = await stage1Pick(stream, {
      candidates,
      players: roster,
      shelf,
      table: WEIGHT_TABLE,
      liveCount: 1,
      ladder: fr29Ladder,
    });

    spinPlan.push({
      spin,
      kind: 'main',
      label: stream.label,
      bytes_consumed: stream.consumed,
      live_count: 1,
      pool: [...pool],
      live: [...picked.live],
      weights: [...picked.weights],
      total_weight: picked.totalWeight,
      draws: picked.draws.map((d) => ({ n: d.n, r: d.r, consumed_after: d.consumedAfter })),
    });
    mainBytes.push(stream.consumed);

    const live = picked.live.map((id) => candidates.find((c) => c.awardId === id) as Stage1Candidate);
    const result = resolveSpin(live, roster, fr29Ladder);
    for (const assignment of result.results) outcomes.set(assignment.awardId, assignment.outcome);
    for (const sid of result.assigned) shelf[sid] = (shelf[sid] ?? 0) + 1;

    for (const id of picked.live) drawOrder.push(id);
    pool = pool.filter((id) => !picked.live.includes(id));
  }

  const mainSpins = spin;

  const pityStream = await createStream(seed, PITY_LABEL);
  const pity = await resolvePity({ players: roster, shelf, stream: pityStream });

  // One consolation spin per winner, the whole draw's cost attributed to the first (the
  // `persist_ceremony` convention the measured corpus shows: spin 13 carries 27, 14-40 carry 0).
  for (let i = 0; i < pity.revealOrder.length; i++) {
    spinPlan.push({
      spin: mainSpins + i + 1,
      kind: 'pity',
      label: PITY_LABEL,
      bytes_consumed: i === 0 ? pity.bytesConsumed : 0,
    });
  }

  const doc: Record<string, unknown> = {
    algo_version: ALGO_VERSION,
    seed_hex: SEED_HEX,
    luck: { weight_table: [...WEIGHT_TABLE] },
    spin_plan: spinPlan,
    awards: AWARDS.map((a) => awardEntry(a, outcomes.get(a.id) as Outcome)),
    pity: {
      label: PITY_LABEL,
      winless: [...pity.winless],
      reveal_order: [...pity.revealOrder],
      draws: pity.draws.map((d) => ({ n: d.n, k: d.k, rejections: d.rejections, value: d.value })),
      bytes_consumed: pity.bytesConsumed,
    },
    players: playersDoc(),
  };

  return {
    doc,
    sha256: await canonicalSha256Hex(canonicalize(doc, { asciiOnly: true })),
    mainSpins,
    drawOrder,
    mainBytes,
    pityBytes: pity.bytesConsumed,
    pitySpins: pity.revealOrder.length,
  };
}

/**
 * `verification_bundle_read`'s progressive projection, mirrored (`0029:1519-1625`).
 *
 * ⚠ IT SUBTRACTS, IT NEVER BLANKS. An unrevealed spin is ABSENT, its awards are absent, and `pity`
 * is absent ENTIRELY until a consolation spin is revealed — an empty-but-present `pity` would
 * announce that a consolation phase exists before any of it is public.
 */
function project(source: BuiltCeremony, revealedSpins: number): Record<string, unknown> {
  // ⛔⛔ CLONED FIRST, AND THIS IS A BUG THIS SUITE ACTUALLY SHIPPED BEFORE IT WAS CAUGHT. `filter`
  // returns a new ARRAY holding the SAME element objects, so a projection built straight off the
  // fixture aliases it — and one test mutating a projected award to prove a tamper refuses silently
  // corrupted the shared document for every test that ran afterwards. Three later tests failed with
  // a divergence that had nothing to do with them, which is the worst shape a fixture bug can take:
  // real-looking failures pointing at innocent code.
  const built: BuiltCeremony = { ...source, doc: clone(source.doc) };
  const plan = (built.doc.spin_plan as Record<string, unknown>[]).filter(
    (s) => (s.spin as number) <= revealedSpins,
  );
  const revealedIds = new Set(
    plan.filter((s) => s.kind === 'main').flatMap((s) => s.live as string[]),
  );
  const out: Record<string, unknown> = {
    algo_version: built.doc.algo_version,
    seed_hex: built.doc.seed_hex,
    luck: built.doc.luck,
    players: built.doc.players,
    spin_plan: plan,
    awards: (built.doc.awards as Record<string, unknown>[]).filter((a) =>
      revealedIds.has(a.award_id as string),
    ),
  };
  const pityRevealed = plan.filter((s) => s.kind === 'pity').length;
  if (pityRevealed > 0) {
    const full = built.doc.pity as Record<string, unknown>;
    // ⚠ `winless` IS TRUNCATED TO THE REVEALED PREFIX OF `reveal_order` and is therefore IDENTICAL
    // to it mid-flight (`0029:1580-1606`), and `bytes_consumed` is WITHHELD until the phase is done.
    const prefix = (full.reveal_order as string[]).slice(0, pityRevealed);
    const pity: Record<string, unknown> = {
      label: full.label,
      winless: prefix,
      reveal_order: prefix,
      draws: (full.draws as unknown[]).slice(0, pityRevealed),
    };
    if (pityRevealed === built.pitySpins) pity.bytes_consumed = full.bytes_consumed;
    out.pity = pity;
  }
  return out;
}

/** A deep clone that keeps the document JSON-shaped, so a tamper cannot alias the original. */
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const built = await buildCeremony();

// ── the fixture is not degenerate ─────────────────────────────────────────────

describe('the fixture exercises what it claims to exercise', () => {
  // ⛔ NON-VACUITY, FIRST. Every `it.each` below runs over data derived from this document; a
  // fixture that silently produced zero spins, zero awards or an empty shelf would make most of
  // this file a green run over nothing — the exact failure `canonical.test.ts:79-84` records.
  it('produced a real multi-spin ceremony with a NON-EMPTY shelf and a real pity draw', () => {
    expect(built.mainSpins).toBe(AWARDS.length);
    expect(built.drawOrder).toHaveLength(AWARDS.length);
    expect(built.mainBytes).toHaveLength(AWARDS.length);
    // Every main spin drew bytes: an all-zero ceremony would verify trivially.
    expect(built.mainBytes.every((b) => b > 0)).toBe(true);
    // ⭐ THE SHELF'S DEPTH, NOT JUST ITS EMPTINESS. Every award is won, by exactly TWO players, and
    // one of them holds THREE — so the shelf reaches `table[2]`, the third rung of the weight table,
    // rather than merely leaving 0. That depth is the W10 mutant's prerequisite: a shelf that only
    // ever holds 0 or 1 gives concurrent spins fewer ways to differ.
    const winners = (built.doc.awards as Record<string, unknown>[]).flatMap((a) => a.winners as string[]);
    expect(winners).toHaveLength(AWARDS.length);
    const held = new Map<string, number>();
    for (const w of winners) held.set(w, (held.get(w) ?? 0) + 1);
    expect(held.size).toBe(2);
    expect(Math.max(...held.values())).toBe(3);
    // …and a genuine consolation draw, not the 0/1-member degenerate case.
    expect(built.pitySpins).toBeGreaterThan(1);
    expect(built.pityBytes).toBeGreaterThan(0);
    expect((built.doc.pity as Record<string, unknown>).draws).toHaveLength(built.pitySpins - 1);
  });

  it('the shelf really changes the weights — otherwise shelf damage is invisible', () => {
    // Spin 1 weighs everything against an EMPTY shelf, so every candidate gets table[0]. From spin 2
    // one candidate's provisional winner already holds a trophy and drops to table[1]. If this ever
    // stopped being true, the W10 mutant would survive for a fixture reason rather than a real one.
    const plan = (built.doc.spin_plan as Record<string, unknown>[]).filter((s) => s.kind === 'main');
    expect(plan[0]!.weights).toEqual(AWARDS.map(() => WEIGHT_TABLE[0]));
    const later = plan.slice(1).flatMap((s) => s.weights as number[]);
    expect(later.some((w) => w !== WEIGHT_TABLE[0])).toBe(true);
  });
});

// ── AC12: the closed sets read their evidence ─────────────────────────────────

describe('the closed sets are runtime values, compared runtime-against-runtime', () => {
  // ⛔ NO LITERAL ARRAY COPIED BESIDE THE ASSERTION. `canonical.test.ts:213` records that this
  // project has shipped that defect eight times: an "expected" typed out beside the value it is
  // checking passes for whatever the source happens to say. Both sides below are read from the
  // module at runtime.
  it('every VERIFY_REASONS member has an outcome, and REASON_OUTCOME invents none', () => {
    expect(Object.keys(REASON_OUTCOME).sort()).toEqual([...VERIFY_REASONS].sort());
  });

  it('every outcome REASON_OUTCOME maps to is a declared VERIFY_OUTCOMES member', () => {
    expect(VERIFY_REASONS.length).toBeGreaterThan(0);
    for (const reason of VERIFY_REASONS) {
      expect(VERIFY_OUTCOMES).toContain(REASON_OUTCOME[reason]);
    }
  });

  it('the outcome set is exactly the five AC7 authors Spanish for, with no duplicates', () => {
    expect(new Set(VERIFY_OUTCOMES).size).toBe(VERIFY_OUTCOMES.length);
    expect(VERIFY_OUTCOMES.length).toBe(5);
  });

  it('the reason set has no duplicates', () => {
    expect(new Set(VERIFY_REASONS).size).toBe(VERIFY_REASONS.length);
  });

  // ⭐ The two outcomes NO reason maps to are the two successes, and that is the property rather
  // than an accident of the table: `matched` and `not_yet_revealed` are reached only by running to
  // the end, so a reason that mapped to either would be a refusal rendered as a pass.
  it('no reason maps to matched or not_yet_revealed', () => {
    const reached = new Set(VERIFY_REASONS.map((r) => REASON_OUTCOME[r]));
    expect(reached.has('matched')).toBe(false);
    expect(reached.has('not_yet_revealed')).toBe(false);
    expect([...reached].sort()).toEqual(['mismatched', 'unsupported_algo_version', 'web_crypto_unavailable']);
  });
});

// ── AC8: the version gate ─────────────────────────────────────────────────────

describe('AC8 — an unimplemented MAJOR algo_version is a refusal, not a guess', () => {
  it('ALGO_VERSION composes from its own parts, so the three constants cannot drift', () => {
    const parsed = parseAlgoVersion(ALGO_VERSION);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.name).toBe(ALGO_NAME);
    expect(parsed.major).toBe(ALGO_MAJOR);
    expect(`${parsed.name}-${String(parsed.major)}.${String(parsed.minor)}.${String(parsed.patch)}`).toBe(
      ALGO_VERSION,
    );
  });

  const ACCEPTED = [`${ALGO_NAME}-1.0.0`, `${ALGO_NAME}-1.0.9`, `${ALGO_NAME}-1.7.0`, `${ALGO_NAME}-1.99.99`];
  it('the accepted table is non-empty', () => {
    expect(ACCEPTED.length).toBeGreaterThan(0);
  });
  // ⭐ MINOR AND PATCH ARE ACCEPTED AT ANY VALUE, BY DEFINITION: a non-MAJOR bump is a change that
  // does not alter what this file re-derives. Only MAJOR refuses.
  it.each(ACCEPTED)('accepts %s — only MAJOR refuses', (v) => {
    expect(parseAlgoVersion(v).ok).toBe(true);
  });

  const REFUSED: readonly (readonly [unknown, string])[] = [
    [`${ALGO_NAME}-2.0.0`, 'algo_version_unsupported_major'],
    [`${ALGO_NAME}-0.9.9`, 'algo_version_unsupported_major'],
    ['someone-elses-roulette-1.0.0', 'algo_version_unknown_name'],
    [`${ALGO_NAME}-1.0`, 'algo_version_unparseable'],
    [`${ALGO_NAME}-1.0.0-rc1`, 'algo_version_unparseable'],
    [`${ALGO_NAME}-v1.0.0`, 'algo_version_unparseable'],
    [` ${ALGO_NAME}-1.0.0`, 'algo_version_unparseable'],
    [`${ALGO_NAME}-1.0.0 `, 'algo_version_unparseable'],
    ['', 'algo_version_unparseable'],
    [undefined, 'algo_version_unparseable'],
    [42, 'algo_version_unparseable'],
    [{ major: 1 }, 'algo_version_unparseable'],
  ];
  it('the refusal table is non-empty and covers all three refusal reasons', () => {
    expect(REFUSED.length).toBeGreaterThan(0);
    expect(new Set(REFUSED.map(([, r]) => r)).size).toBe(3);
  });
  it.each(REFUSED)('refuses %s as %s', (raw, reason) => {
    const parsed = parseAlgoVersion(raw);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toBe(reason);
  });

  // ⛔ THE TWO VERSION AXES ARE NOT THE SAME AXIS. `inclusivcup/v1` is the HMAC's domain separation
  // and keys every stream; `algo_version` declares which rules produced the document and keys
  // nothing. Conflating them would make a MINOR bump invalidate every ceremony ever published.
  it('the algo version is not the label prefix', () => {
    expect(ALGO_VERSION.includes('inclusivcup/v1')).toBe(false);
    expect(PITY_LABEL.includes(ALGO_VERSION)).toBe(false);
    expect(PITY_LABEL.startsWith('inclusivcup/v1')).toBe(true);
  });
});

// ── AC9: the environmental refusal ────────────────────────────────────────────

describe('AC9 — crypto.subtle absent is a typed refusal, not a TypeError', () => {
  it('reports WebCrypto as present under the test runtime', () => {
    // The positive control. Without it the refusal test below would pass in a world where the probe
    // simply always returned false.
    expect(webCryptoAvailable()).toBe(true);
  });

  const ABSENT: readonly (readonly [string, unknown])[] = [
    ['crypto undefined (a non-secure context)', undefined],
    ['crypto present but subtle undefined', {}],
    ['crypto.subtle present but null', { subtle: null }],
    // ⛔ EACH OF THE THREE DEREFERENCE SITES IS PROBED BY NAME. `deferred-work.md:289`'s own line
    // numbers were stale and named only two of them; the third, `canonical.ts:390`'s `digest`, is
    // the one the button reaches first on a complete ceremony. A probe that only checked
    // `crypto.subtle` being an object would pass all three of these.
    ['subtle without digest (canonical.ts:390)', { subtle: { sign: () => 0, importKey: () => 0 } }],
    ['subtle without sign (prng.ts:201)', { subtle: { digest: () => 0, importKey: () => 0 } }],
    ['subtle without importKey (prng.ts:279)', { subtle: { digest: () => 0, sign: () => 0 } }],
  ];
  it('the absent-WebCrypto table is non-empty', () => {
    expect(ABSENT.length).toBeGreaterThan(0);
  });

  it.each(ABSENT)('%s — webCryptoAvailable() is false', (_name, stub) => {
    vi.stubGlobal('crypto', stub);
    try {
      expect(webCryptoAvailable()).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('verifyCeremony refuses BEFORE any engine call, with the typed outcome', async () => {
    vi.stubGlobal('crypto', undefined);
    try {
      const report = await verifyCeremony({ complete: true, bundleSha256: built.sha256, bundle: built.doc });
      expect(report.outcome).toBe('web_crypto_unavailable');
      expect(report.reason).toBe('web_crypto_unavailable');
      // ⭐ AND IT CLAIMS NO EVIDENCE. A refusal that reported spins-checked would be a verification
      // that never ran, rendered as one that did.
      expect(report.mainSpinsChecked).toBe(0);
      expect(report.awardOutcomesChecked).toBe(0);
      expect(report.hashBound).toBe(false);
      expect(report.full).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// ── AC5: the full re-derivation ───────────────────────────────────────────────

describe('AC5 — the browser reproduces the ceremony from the bundle alone', () => {
  it('re-derives a complete ceremony and matches every published field', async () => {
    const report = await verifyCeremony({
      complete: true,
      bundleSha256: built.sha256,
      bundle: built.doc,
      seedDemoSha256: SEED_HEX,
    });
    expect(report.reason).toBeUndefined();
    expect(report.outcome).toBe('matched');
    expect(report.full).toBe(true);
    expect(report.hashBound).toBe(true);
    expect(report.mainSpinsChecked).toBe(built.mainSpins);
    expect(report.awardOutcomesChecked).toBe(AWARDS.length);
    expect(report.pityDrawsChecked).toBe(built.pitySpins - 1);
  });

  // ⭐ THE RE-DERIVED ORDER AND BYTE COUNTS, NOT COPIES OF THE PUBLISHED ONES. This is the report
  // shape THE BAR asserts the real corpus's 22 / 27 / 49-byte and `aw-04,…` invariants against.
  it('reports the RE-DERIVED draw order and byte counts', async () => {
    const report = await verifyCeremony({ complete: true, bundleSha256: built.sha256, bundle: built.doc });
    expect(report.drawOrder).toEqual(built.drawOrder);
    expect(report.mainBytes).toEqual(built.mainBytes);
    expect(report.pityBytes).toBe(built.pityBytes);
  });

  it('the whole-ceremony byte total is the sum of its streams', async () => {
    const report = await verifyCeremony({ complete: true, bundleSha256: built.sha256, bundle: built.doc });
    const total = report.mainBytes.reduce((a, b) => a + b, 0) + (report.pityBytes ?? 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBe(built.mainBytes.reduce((a, b) => a + b, 0) + built.pityBytes);
  });

  // ⚠ `bytes_consumed` IS REPRODUCED, NEVER RE-DERIVED — so a published count that disagrees with
  // the stream refuses, even though every other field of the spin is untouched and correct.
  it('a bytes_consumed that disagrees with the stream refuses, with everything else correct', async () => {
    const doc = clone(built.doc);
    const plan = doc.spin_plan as Record<string, unknown>[];
    plan[0]!.bytes_consumed = (plan[0]!.bytes_consumed as number) + 1;
    const report = await verifyCeremony({ complete: true, bundleSha256: built.sha256, bundle: doc });
    expect(report.reason).toBe('bytes_divergence');
    expect(report.outcome).toBe('mismatched');
  });

  it('parseBundle reads the document the producer actually emitted', () => {
    const parsed = parseBundle(built.doc);
    expect(parsed.algoVersion).toBe(ALGO_VERSION);
    expect(parsed.seedHex).toBe(SEED_HEX);
    expect(parsed.weightTable).toEqual(WEIGHT_TABLE);
    expect(parsed.awards).toHaveLength(AWARDS.length);
    expect(parsed.players).toHaveLength(ROSTER.length);
    expect(parsed.pity).toBeDefined();
    // ⛔ EVERY MAGNITUDE IS A `bigint`, NEVER A `Number`. `6-5b:587` measured what `Number`-parsing
    // does: both sides read as 2^53, tie, and bottom the ladder out at rung 5.
    expect(typeof parsed.players[0]!.kills).toBe('bigint');
    expect(typeof parsed.players[0]!.volume.kills).toBe('bigint');
    expect(typeof parsed.players[0]!.achievementTs).toBe('bigint');
  });

  // ⭐ DECISION J — the key is ABSENT, and the comparison is `undefined === undefined`. A `0`
  // sentinel appearing in the document is a DIFFERENT document, and RFC-8785 hashes it differently.
  it('tie_ladder_exit_step is absent on every outcome no ladder decided', () => {
    const awards = built.doc.awards as Record<string, unknown>[];
    expect(awards.length).toBeGreaterThan(0);
    for (const a of awards) {
      expect(Object.hasOwn(a, 'tie_ladder_exit_step')).toBe(false);
    }
  });

  it('a fabricated 0 exit step refuses rather than reading as "no ladder"', async () => {
    const doc = clone(built.doc);
    (doc.awards as Record<string, unknown>[])[0]!.tie_ladder_exit_step = 0;
    const report = await verifyCeremony({ complete: true, bundleSha256: built.sha256, bundle: doc });
    expect(report.reason).toBe('outcome_divergence');
  });
});

// ── the tamper matrix ─────────────────────────────────────────────────────────

interface Tamper {
  readonly name: string;
  readonly reason: string;
  readonly apply: (doc: Record<string, unknown>) => void;
}

const TAMPERS: readonly Tamper[] = [
  {
    name: 'a flipped winner',
    reason: 'outcome_divergence',
    apply: (d) => {
      (d.awards as Record<string, unknown>[])[0]!.winners = ['1007'];
    },
  },
  {
    name: 'a flipped outcome kind',
    reason: 'outcome_divergence',
    apply: (d) => {
      (d.awards as Record<string, unknown>[])[0]!.outcome_kind = 'no_eligible_players';
    },
  },
  {
    // ⛔ THE DECIDING VALUE IS DISPLAY-ONLY AND IT IS STILL HASHED. `award_result.deciding_value`
    // carries "display only; never an input to resolution" (SOLUTION-DESIGN:219) — so nothing
    // re-derives a winner from it, and it is therefore the field most likely to go unchecked. It is
    // inside `bundle_sha256`, so a wrong one is a wrong document: the number the audience is shown
    // beside a winner would be a lie the commitment vouches for. The mutation pass found this arm
    // undriven (M32 survived a run where the comparison was deleted outright).
    name: 'a rewritten deciding_value on a correctly-won award',
    reason: 'outcome_divergence',
    apply: (d) => {
      const a = (d.awards as Record<string, unknown>[]).find((x) => x.class === 'volume');
      (a as Record<string, unknown>).deciding_value = '999';
    },
  },
  {
    name: 'a fabricated deciding_num/den pair on a volume award',
    reason: 'outcome_divergence',
    apply: (d) => {
      const a = (d.awards as Record<string, unknown>[]).find((x) => x.class === 'volume');
      (a as Record<string, unknown>).deciding_num = '1';
      (a as Record<string, unknown>).deciding_den = '2';
    },
  },
  {
    // ⛔ THE `den` HALF ALONE. A verifier that compared only `deciding_num` would pass a rate award
    // whose published DENOMINATOR is wrong — and a rate is a pair, so half of it is not a value.
    // The mutation pass found this arm undriven until the fixture gained a rate award at all.
    name: 'a rewritten deciding_den on a RATE award, with deciding_num left correct',
    reason: 'outcome_divergence',
    apply: (d) => {
      const a = (d.awards as Record<string, unknown>[]).find((x) => x.class === 'rate');
      (a as Record<string, unknown>).deciding_den = '7';
    },
  },
  {
    name: 'a rewritten deciding_num on a RATE award, with deciding_den left correct',
    reason: 'outcome_divergence',
    apply: (d) => {
      const a = (d.awards as Record<string, unknown>[]).find((x) => x.class === 'rate');
      (a as Record<string, unknown>).deciding_num = '7';
    },
  },
  {
    name: "a rate player's num/den pair parsed as JSON numbers rather than decimal strings",
    reason: 'bundle_shape',
    apply: (d) => {
      (d.players as Record<string, unknown>[])[0]!.rate = { adr: { num: 50, den: 1 } };
    },
  },
  {
    name: 'an ABSENT deciding_value on an award that was won',
    reason: 'outcome_divergence',
    apply: (d) => {
      const a = (d.awards as Record<string, unknown>[]).find((x) => x.class === 'volume');
      delete (a as Record<string, unknown>).deciding_value;
    },
  },
  {
    name: 'a rewritten drawn order',
    reason: 'draw_divergence',
    apply: (d) => {
      const plan = (d.spin_plan as Record<string, unknown>[]).filter((s) => s.kind === 'main');
      plan[0]!.live = [(plan[0]!.pool as string[])[1]!];
    },
  },
  {
    name: 'a rewritten weight',
    reason: 'draw_divergence',
    apply: (d) => {
      const plan = (d.spin_plan as Record<string, unknown>[]).filter((s) => s.kind === 'main');
      (plan[0]!.weights as number[])[0] = 99;
    },
  },
  {
    name: 'a rewritten draw r',
    reason: 'draw_divergence',
    apply: (d) => {
      const plan = (d.spin_plan as Record<string, unknown>[]).filter((s) => s.kind === 'main');
      (plan[0]!.draws as Record<string, unknown>[])[0]!.r = 0;
    },
  },
  {
    name: "a spin label that is not its own spin's separator",
    reason: 'draw_divergence',
    apply: (d) => {
      const plan = (d.spin_plan as Record<string, unknown>[]).filter((s) => s.kind === 'main');
      plan[1]!.label = stage1Label(1);
    },
  },
  {
    name: 'a pity spin keyed by a Stage-1 label',
    reason: 'pity_divergence',
    apply: (d) => {
      const plan = (d.spin_plan as Record<string, unknown>[]).filter((s) => s.kind === 'pity');
      plan[0]!.label = stage1Label(1);
    },
  },
  {
    name: 'a rewritten consolation reveal order',
    reason: 'pity_divergence',
    apply: (d) => {
      const pity = d.pity as Record<string, unknown>;
      pity.reveal_order = [...(pity.reveal_order as string[])].reverse();
    },
  },
  {
    name: "a pity phase cost the per-spin entries do not total",
    reason: 'bytes_divergence',
    apply: (d) => {
      const plan = (d.spin_plan as Record<string, unknown>[]).filter((s) => s.kind === 'pity');
      plan[0]!.bytes_consumed = 0;
    },
  },
  {
    name: 'a different seed',
    reason: 'draw_divergence',
    apply: (d) => {
      d.seed_hex = '0'.repeat(63) + '1';
    },
  },
  {
    name: 'a weight table the producer did not use',
    reason: 'draw_divergence',
    apply: (d) => {
      d.luck = { weight_table: [90, 50, 20] };
    },
  },
  {
    name: 'an unsupported MAJOR',
    reason: 'algo_version_unsupported_major',
    apply: (d) => {
      d.algo_version = `${ALGO_NAME}-2.0.0`;
    },
  },
  {
    name: 'a U+0000 in the document',
    reason: 'nul_in_document',
    apply: (d) => {
      (d.awards as Record<string, unknown>[])[0]!.bucket = 'sk' + String.fromCodePoint(0) + 'ill';
    },
  },
  {
    name: 'a player magnitude parsed as a JSON number rather than a decimal string',
    reason: 'bundle_shape',
    apply: (d) => {
      (d.players as Record<string, unknown>[])[0]!.kills = 10;
    },
  },
  {
    name: 'an absent rounds_played (a NULL the builder must not spell as zero)',
    reason: 'bundle_shape',
    apply: (d) => {
      delete (d.players as Record<string, unknown>[])[0]!.rounds_played;
    },
  },
  {
    // ⛔ `BigInt` TRIMS SURROUNDING WHITESPACE — `BigInt(' 10 ')` is `10n` — so without the decimal
    // regex a padded magnitude decodes to a plausible number and the whole ceremony verifies. Go's
    // `strconv.ParseInt` accepts neither, so the two halves of the seam would disagree about an
    // input neither would report. The mutation pass found this arm undriven.
    name: 'a padded magnitude that BigInt would silently accept',
    reason: 'bundle_shape',
    apply: (d) => {
      (d.players as Record<string, unknown>[])[0]!.kills = ' 10 ';
    },
  },
  {
    name: 'an EMPTY magnitude, which BigInt reads as 0n',
    reason: 'bundle_shape',
    apply: (d) => {
      (d.players as Record<string, unknown>[])[0]!.rounds_played = '';
    },
  },
  {
    name: 'a magnitude with a leading plus sign',
    reason: 'bundle_shape',
    apply: (d) => {
      (d.players as Record<string, unknown>[])[0]!.kills = '+10';
    },
  },
  {
    // ⭐ 6.9b CODE REVIEW — THE DROPPED AWARD IS COMPUTED, NOT POSITIONAL, AND THE ROW IS NOW
    // DETERMINISTIC. It used to `slice(1)` off the front of `awards`: whether that produced
    // `bundle_shape` (the POOL mapping, which is what the row is about) or `outcome_divergence` (the
    // LIVE mapping, which runs first) depended on whether the PRNG happened to draw `awards[0]` in
    // spin 1 — a seed- and engine-dependent fact. It passed by luck of the draw, not by
    // construction. Removing the LAST-DRAWN award is deterministic: every award sits in spin 1's
    // POOL, but the last-drawn one reaches no earlier spin's LIVE set, so the pool mapping is
    // guaranteed to be the arm that refuses.
    name: 'an award that the pool names but the document does not describe',
    reason: 'bundle_shape',
    apply: (d) => {
      const mains = (d.spin_plan as Record<string, unknown>[]).filter((s) => s.kind === 'main');
      const lastDrawn = ((mains[mains.length - 1] as Record<string, unknown>).live as string[])[0] as string;
      d.awards = (d.awards as Record<string, unknown>[]).filter((a) => a.award_id !== lastDrawn);
    },
  },
  {
    name: 'a duplicated award_id',
    reason: 'bundle_shape',
    apply: (d) => {
      const awards = d.awards as Record<string, unknown>[];
      awards.push(clone(awards[0]!));
    },
  },
  {
    name: 'an engine-refused weight table (not strictly decreasing)',
    reason: 'engine_refused',
    apply: (d) => {
      d.luck = { weight_table: [10, 10, 10] };
    },
  },

  // ── 6.9b CODE REVIEW — the seven guards the review added, each driven here ────
  //
  // ⛔ Every row below refuses a document that verified as `matched` before the review. They are
  // grouped rather than scattered so the delta this review made is legible as a set.
  {
    // A duplicated main-spin entry was processed TWICE: the shelf double-advanced and `drawOrder`
    // double-counted, and sorting HID it rather than refusing it.
    name: 'a duplicated spin index in the plan',
    reason: 'bundle_shape',
    apply: (d) => {
      const plan = d.spin_plan as Record<string, unknown>[];
      plan.push(clone(plan[0]!));
    },
  },
  {
    // `live_count` was read ONLY inside the `complete` branch and handed straight to `stage1Pick`,
    // never compared to the array it describes. A reviewer-independent mutant that replaced it with
    // `entry.live.length` survived the entire suite — this row is what kills that mutant.
    name: 'a live_count that disagrees with its own live array',
    reason: 'draw_divergence',
    apply: (d) => {
      const mains = (d.spin_plan as Record<string, unknown>[]).filter((s) => s.kind === 'main');
      (mains[0] as Record<string, unknown>).live_count = 99;
    },
  },
  {
    // `intOf` accepted 0 and negatives, so `stage1Label` threw a bare `RangeError` and a malformed
    // DOCUMENT FIELD was reported as `engine_refused` — "the engine refused an input the document
    // handed it" — bypassing the reason that exists for exactly this.
    name: 'a 0 spin index, which is not 1-based',
    reason: 'bundle_shape',
    apply: (d) => {
      const mains = (d.spin_plan as Record<string, unknown>[]).filter((s) => s.kind === 'main');
      (mains[0] as Record<string, unknown>).spin = 0;
    },
  },
  {
    // ⛔ THE ONE THE COMMITMENT DOES NOT BACKSTOP. `publish_bundle` hashes the payload it is handed,
    // so a complete document that NEVER carried `pity` hashes correctly and `hash_divergence` never
    // fires — the whole consolation phase was declared verified with `pityDrawsChecked: 0`.
    name: 'a complete document whose pity block is missing entirely',
    reason: 'bundle_shape',
    apply: (d) => {
      delete d.pity;
    },
  },
  {
    // Comparison was driven only by `spinResult.results`, so an `awards` entry no spin ever named
    // was parsed and compared to nothing — a fabricated winners list riding inside `bundle_sha256`.
    name: 'an extra award entry that no spin ever decided',
    reason: 'outcome_divergence',
    apply: (d) => {
      const awards = d.awards as Record<string, unknown>[];
      const extra = clone(awards[0]!);
      extra.award_id = '9999';
      extra.winners = ['1007'];
      awards.push(extra);
    },
  },
  {
    // The pool was read forward and never related to the spin before it, so a plan that RESURRECTED
    // an already-drawn award into a later pool — or silently dropped one so it could never be
    // drawn — verified as `matched`.
    name: 'an already-drawn award resurrected into a later pool',
    reason: 'draw_divergence',
    apply: (d) => {
      const mains = (d.spin_plan as Record<string, unknown>[]).filter((s) => s.kind === 'main');
      const firstLive = ((mains[0] as Record<string, unknown>).live as string[])[0] as string;
      ((mains[1] as Record<string, unknown>).pool as string[]).push(firstLive);
    },
  },
  {
    // The depth sentinel shared its return value with the NUL sentinel, so an over-deep document was
    // refused as "the served document contains U+0000" — a cause that is not present, on the one
    // path whose whole purpose is naming causes precisely.
    name: 'a document nested past the depth bound',
    reason: 'document_depth',
    apply: (d) => {
      let nested: Record<string, unknown> = {};
      for (let i = 0; i < 300; i += 1) nested = { deeper: nested };
      d.reviewDepthProbe = nested;
    },
  },
];

describe('the tamper matrix — every corruption stops with its OWN typed reason', () => {
  it('the tamper matrix is non-empty and each entry has a distinct name', () => {
    expect(TAMPERS.length).toBeGreaterThan(0);
    expect(new Set(TAMPERS.map((t) => t.name)).size).toBe(TAMPERS.length);
    // ⭐ AND IT REACHES MOST OF THE CLOSED SET. A matrix that only ever produced one reason would
    // prove the verifier refuses, not that it refuses for the right reason.
    expect(new Set(TAMPERS.map((t) => t.reason)).size).toBeGreaterThanOrEqual(7);
  });

  it.each(TAMPERS.map((t) => [t.name, t] as const))('%s', async (_name, tamper) => {
    const doc = clone(built.doc);
    tamper.apply(doc);
    const report = await verifyCeremony({ complete: true, bundleSha256: built.sha256, bundle: doc });
    expect(report.reason).toBe(tamper.reason);
    expect(report.outcome).toBe(REASON_OUTCOME[tamper.reason as keyof typeof REASON_OUTCOME]);
    // ⛔ A REFUSAL NEVER CLAIMS EVIDENCE. Reporting a partial check beside a refusal is how a
    // "verified" badge ends up beside a verification that stopped at the first field.
    expect(report.hashBound).toBe(false);
    expect(report.full).toBe(false);
  });

  /**
   * ⛔⛔ THE ELIGIBILITY-KEY GUARD IS ABOUT THE *REASON*, NOT ONLY THE REFUSAL, AND THE MUTATION PASS
   * IS WHAT FOUND THIS UNDRIVEN. Deleting `playerOf`'s explicit `has(o, k)` check leaves the tamper
   * row above still passing: `bigOf(undefined)` refuses as `bundle_shape` too, so the closed-set
   * assertion cannot tell the guard that exists for exactly this from an accidental type refusal.
   * The DETAIL is the difference — it names the field and states why a zero must not be substituted
   * — and it is what an operator reads when a bundle is genuinely incomplete.
   */
  it('the absent-eligibility-key refusal names the field and the fabrication it prevents', async () => {
    const doc = clone(built.doc);
    delete (doc.players as Record<string, unknown>[])[0]!.rounds_played;
    const report = await verifyCeremony({ complete: true, bundleSha256: built.sha256, bundle: doc });
    expect(report.reason).toBe('bundle_shape');
    expect(report.detail).toContain('rounds_played is absent');
    expect(report.detail).toContain('FR-21');
  });

  it('the absent idle_dq refusal names ITS field too, not the first one checked', async () => {
    const doc = clone(built.doc);
    delete (doc.players as Record<string, unknown>[])[0]!.idle_dq;
    const report = await verifyCeremony({ complete: true, bundleSha256: built.sha256, bundle: doc });
    expect(report.reason).toBe('bundle_shape');
    expect(report.detail).toContain('idle_dq is absent');
  });

  // ⭐ THE HASH IS THE LAST GATE, AND IT IS INDEPENDENT OF THE OTHERS: a document whose every field
  // re-derives correctly still refuses if the commitment does not match it.
  it('a correct document under the wrong commitment refuses as hash_divergence', async () => {
    const report = await verifyCeremony({
      complete: true,
      bundleSha256: 'f'.repeat(64),
      bundle: built.doc,
    });
    expect(report.reason).toBe('hash_divergence');
  });

  // ⭐ DECISION P — the seed is cross-checked against the column `0028:501` grants anon.
  it('a seed_hex that disagrees with ceremony.seed_demo_sha256 refuses', async () => {
    const report = await verifyCeremony({
      complete: true,
      bundleSha256: built.sha256,
      bundle: built.doc,
      seedDemoSha256: '0'.repeat(64),
    });
    expect(report.reason).toBe('seed_mismatch');
  });

  it('an absent bundle and a malformed envelope are distinct refusals', async () => {
    expect((await verifyCeremony({ complete: true, bundleSha256: built.sha256, bundle: null })).reason).toBe(
      'bundle_absent',
    );
    const bad = { complete: 'yes', bundleSha256: built.sha256, bundle: built.doc } as unknown;
    expect((await verifyCeremony(bad as Parameters<typeof verifyCeremony>[0])).reason).toBe('envelope_shape');
  });
});

// ── AC6: the reveal gate, from the client's side ──────────────────────────────

describe('AC6 — the client cannot compensate for what it was not served', () => {
  const PARTIALS = [1, 2, 3];
  it('the partial-reveal table is non-empty and every projection really is smaller', () => {
    expect(PARTIALS.length).toBeGreaterThan(0);
    for (const k of PARTIALS) {
      const doc = project(built, k);
      expect((doc.spin_plan as unknown[]).length).toBe(k);
      expect((doc.awards as unknown[]).length).toBeLessThan(AWARDS.length);
      // ⛔ `pity` IS ABSENT ENTIRELY, not present-and-empty: an empty-but-present block would
      // announce that a consolation phase exists before any of it is public.
      expect(Object.hasOwn(doc, 'pity')).toBe(false);
    }
  });

  it.each(PARTIALS)('at %i revealed spins it verifies the revealed outcomes and binds no hash', async (k) => {
    const report = await verifyCeremony({
      complete: false,
      bundleSha256: built.sha256,
      bundle: project(built, k),
      seedDemoSha256: SEED_HEX,
    });
    expect(report.reason).toBeUndefined();
    expect(report.outcome).toBe('not_yet_revealed');
    // ⚠ THE HONEST LIMITATION, MEASURED: a prefix is a different document, so the commitment cannot
    // be checked against it. The UI states this; here it is asserted.
    expect(report.hashBound).toBe(false);
    expect(report.full).toBe(false);
    // …and every revealed outcome WAS re-derived, so `not_yet_revealed` is not a silent skip.
    expect(report.mainSpinsChecked).toBe(k);
    expect(report.awardOutcomesChecked).toBe(k);
    // ⭐ 6.9b CODE REVIEW — `drawOrder` IS EMPTY MID-CEREMONY, AND THAT IS THE FIX, NOT A REGRESSION.
    // It used to be pushed from the PUBLISHED `entry.live` after the `complete` branch, so this
    // assertion passed by comparing the document to itself — exactly what the field's own doc comment
    // says it must never do. It is now pushed from `stage1Pick`'s `picked.live`, which only runs at
    // `complete`, so mid-ceremony there is no re-derived order to report.
    expect(report.drawOrder).toHaveLength(0);
  });

  // ⭐⭐ 6.9b CODE REVIEW — THE k=0 WINDOW, PINNED. `verification_bundle_read` serves the SUCCESS
  // preface from the instant of publication with `spin_plan`/`awards` coalesced to `[]`, so between
  // `publish_bundle` and spin 1 this function is handed a document describing NOTHING and returns a
  // positive outcome over zero re-derivations. ⛔ THE ENGINE IS NOT WHERE THAT IS FIXED — AC7's five
  // outcome strings are approved verbatim, so `app/(viewer)/ceremonia/page.tsx` gates the strip on
  // `revealedSpins === 0` instead. This test pins the engine's honest reporting of the vacuum so the
  // page's gate can never be removed without something going red.
  it('at 0 revealed spins it reports a VACUOUS check — the counters say so and the page gates on it', async () => {
    const report = await verifyCeremony({
      complete: false,
      bundleSha256: built.sha256,
      bundle: project(built, 0),
      seedDemoSha256: SEED_HEX,
    });
    expect(report.outcome).toBe('not_yet_revealed');
    expect(report.full).toBe(false);
    expect(report.hashBound).toBe(false);
    // ⛔ EVERY COUNTER IS ZERO. A caller rendering `outcome` alone would be announcing a pass over
    // nothing; these are the fields that make that detectable, and the page reads `revealedSpins`
    // from the envelope for the same reason.
    expect(report.mainSpinsChecked).toBe(0);
    expect(report.awardOutcomesChecked).toBe(0);
    expect(report.pityDrawsChecked).toBe(0);
    expect(report.drawOrder).toHaveLength(0);
  });

  it('a mid-ceremony document with a tampered REVEALED outcome still refuses', async () => {
    const doc = project(built, 2);
    (doc.awards as Record<string, unknown>[])[0]!.winners = ['1007'];
    const report = await verifyCeremony({ complete: false, bundleSha256: built.sha256, bundle: doc });
    expect(report.reason).toBe('outcome_divergence');
    expect(report.outcome).toBe('mismatched');
  });

  // ⛔⛔ THE STRUCTURAL HALF: it must never READ the key the projection withholds. A Proxy that
  // throws on any access to `pity` proves the property by construction rather than by reading the
  // source and believing it.
  //
  // ⭐⭐ 6.9b CODE REVIEW — THE NAME AND THE TRAPS BOTH LIED, AND THE TEST IS NOW SCOPED TO WHAT IT
  // CAN ACTUALLY PROVE. Two defects, both of the "coverage guard that is vacuous" class:
  // (1) It was called "never touches an unrevealed spin, an unrevealed AWARD or the withheld pity
  //     block", but the projection SUBTRACTS unrevealed spins and awards — they are absent from the
  //     document entirely, so there is no property for a trap to guard and two thirds of the name
  //     asserted nothing at all. Only `pity` is a real withheld key on a document that exists.
  // (2) The `has` trap could NEVER fire: `verify.ts` probes presence with `Object.hasOwn`, which
  //     triggers `getOwnPropertyDescriptor`, not `has`. So `touched` could never contain
  //     `'has:pity'` and nothing noticed, because nothing asserted on it.
  // The `getOwnPropertyDescriptor` trap below is now the load-bearing one, and the probe is
  // ASSERTED — that is the difference between "the verifier did not read `pity`" and "the verifier
  // deliberately checked whether `pity` was there before deciding not to read it".
  it('probes the withheld pity block for presence and never reads it', async () => {
    const doc = project(built, 2);
    const touched: string[] = [];
    const guarded = new Proxy(doc, {
      get(target, key) {
        if (typeof key === 'string') {
          touched.push(key);
          if (key === 'pity') throw new Error('the verifier reached for the withheld pity block');
        }
        return Reflect.get(target, key) as unknown;
      },
      getOwnPropertyDescriptor(target, key) {
        if (key === 'pity') touched.push('hasOwn:pity');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    const report = await verifyCeremony({ complete: false, bundleSha256: built.sha256, bundle: guarded });
    expect(report.reason).toBeUndefined();
    expect(report.outcome).toBe('not_yet_revealed');
    // The positive control: the proxy really was consulted, so a silent pass-through would show.
    expect(touched.length).toBeGreaterThan(0);
    expect(touched).toContain('spin_plan');
    // ⛔ THE PROBE HAPPENED — presence was TESTED, not assumed — and the value was never read.
    expect(touched).toContain('hasOwn:pity');
    expect(touched).not.toContain('pity');
  });

  it('a mid-ceremony pity block is NOT asserted against the full winless set', async () => {
    // ⚠ `winless` is truncated to the revealed prefix and is byte-identical to `reveal_order`
    // (`0029:1580-1606`), so a verifier that compared it against the re-derived full set would call
    // a correct ceremony wrong on every consolation reveal but the last.
    const k = built.mainSpins + 1;
    const doc = project(built, k);
    const pity = doc.pity as Record<string, unknown>;
    expect(pity.winless).toEqual(pity.reveal_order);
    expect(Object.hasOwn(pity, 'bytes_consumed')).toBe(false);
    const report = await verifyCeremony({ complete: false, bundleSha256: built.sha256, bundle: doc });
    expect(report.reason).toBeUndefined();
    expect(report.outcome).toBe('not_yet_revealed');
  });
});

// ── AC3's completeness clause, inherited from 6.9a ────────────────────────────

describe("AC3 (inherited) — the verifier runs with EVERY non-bundle read stubbed to throw", () => {
  /**
   * ⛔⛔ SOLUTION-DESIGN:448-449 IS THE STANDARD: "The JS verifier needs NOTHING outside the bundle;
   * if it does, the bundle is incomplete (a spec bug)". So a failure here is a BUNDLE defect to
   * ESCALATE, never a stub to loosen. `deferred-work.md:379` records that this clause belonged to
   * nobody until now — it was untestable until the verifier existed.
   *
   * ⚠ `crypto` IS NOT STUBBED, DELIBERATELY, AND THAT IS NOT A LOOPHOLE: WebCrypto is the one
   * capability the verification IS, not a read it performs. Everything a page could use to reach the
   * network, the DOM or storage is below.
   *
   * ⛔⛔ AND `process`, `navigator` AND `location` ARE DELIBERATELY *NOT* STUBBED — MEASURED, NOT
   * ASSUMED. The first version of this harness trapped `process` too, and the suite went
   * INTERMITTENTLY red with `Error: the verifier reached outside the bundle: process` raised from
   * `TestRunner.onTaskUpdate` — VITEST'S OWN reporter reads `process` from a timer, so the trap
   * fired inside the framework rather than inside the verifier, on whichever runs happened to tick
   * while the stub was installed. It looked exactly like the unowned `prng.test.ts` timeout flake
   * `deferred-work.md:336` records, which is what makes it worth writing down: a harness that
   * poisons its own runner produces failures that point at innocent code.
   *
   * Those three are covered by the SOURCE SCAN below instead, which is strictly stronger anyway —
   * it proves the capability is not referenced at all, rather than that one run did not reach it.
   */
  const FORBIDDEN = [
    'fetch',
    'XMLHttpRequest',
    'WebSocket',
    'EventSource',
    'localStorage',
    'sessionStorage',
    'indexedDB',
    'document',
    'window',
  ] as const;

  it('the forbidden-globals list is non-empty and names the network, the DOM and storage', () => {
    expect(FORBIDDEN.length).toBeGreaterThan(0);
    for (const name of ['fetch', 'document', 'localStorage']) {
      expect(FORBIDDEN as readonly string[]).toContain(name);
    }
    // ⛔ The three the runner itself needs are absent BY NAME, so a future reader adding one back
    // reddens here with the reason rather than rediscovering the intermittent failure.
    for (const name of ['process', 'navigator', 'location']) {
      expect(FORBIDDEN as readonly string[]).not.toContain(name);
    }
  });

  /**
   * ⭐ THE SOURCE SCAN — the half that cannot be defeated by a run that simply did not take the
   * branch. `prng.test.ts`'s banned-construct pin is the house form: read the shipped modules with
   * comments and string bodies blanked, and assert the capability is not NAMED. It covers the whole
   * transitive package, including the three globals the stub list cannot safely trap.
   */
  it('no module in the package names a way out of the bundle', () => {
    const ROOT = path.join(process.cwd(), 'lib', 'roulette');
    const modules = readdirSync(ROOT).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    expect(modules.length).toBeGreaterThan(0);
    expect(modules).toContain('verify.ts');

    const ESCAPES = [
      'fetch(',
      'XMLHttpRequest',
      'WebSocket',
      'EventSource',
      'localStorage',
      'sessionStorage',
      'indexedDB',
      'document.',
      'window.',
      'process.',
      'navigator.',
      'location.',
      'require(',
      'import(',
    ];
    for (const file of modules) {
      const src = readFileSync(path.join(ROOT, file), 'utf8');
      // Comments and string bodies blanked, so the prose that EXPLAINS these bans does not trip
      // its own rule — the same reason `prng.test.ts:868-870` blanks before scanning.
      const code = blankOut(src, { strings: true });
      for (const needle of ESCAPES) {
        expect(code.includes(needle), `${file} names "${needle}"`).toBe(false);
      }
    }
  });

  function trap(name: string): unknown {
    return new Proxy(
      {},
      {
        get() {
          throw new Error(`the verifier reached outside the bundle: ${name}`);
        },
        apply() {
          throw new Error(`the verifier called outside the bundle: ${name}`);
        },
      },
    );
  }

  it('the traps really fire — a stub nobody reaches proves nothing', () => {
    const t = trap('probe') as Record<string, unknown>;
    expect(() => t.anything).toThrow('reached outside the bundle');
  });

  it('re-derives the whole ceremony with every non-bundle global trapped', async () => {
    for (const name of FORBIDDEN) vi.stubGlobal(name, trap(name));
    try {
      const report = await verifyCeremony({
        complete: true,
        // ⚠ FROZEN, so the verifier cannot mutate the envelope into a second read either.
        bundleSha256: built.sha256,
        bundle: Object.freeze(clone(built.doc)),
        seedDemoSha256: SEED_HEX,
      });
      expect(report.reason).toBeUndefined();
      expect(report.outcome).toBe('matched');
      expect(report.hashBound).toBe(true);
      expect(report.mainSpinsChecked).toBe(built.mainSpins);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
