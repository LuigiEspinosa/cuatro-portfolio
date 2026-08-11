import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { OUTCOME_KINDS } from '@/lib/roulette/stage2';
import type { RevealedAward, RevealedCeremony, RevealedSpin, RevealedWinner } from '@/lib/ceremony/reveal-read';
import {
  buildRevealView,
  REVEAL_OUTCOMES,
  REVEAL_PHASES,
  revealParityKey,
  SHELF_STATES,
  type RevealModelInput,
} from '@/lib/ceremony/reveal-model';

/**
 * The reveal view-model (Story 6.10, AC5/AC7/AC8/AC9/AC12).
 *
 * ⚠ COLOCATED UNDER `lib/` BECAUSE THERE IS NOWHERE ELSE — `vitest.config.ts:15-18` is
 * `environment: 'node'` with `include: ['lib/**` + `/*.test.ts']`, so a test beside the components
 * under `app/` would be DOUBLY invisible (no jsdom, no collection) and would report a silent zero.
 * That constraint is DECISION X, and it is why every decision this story makes is a `lib/` module.
 */

// ── fixtures ────────────────────────────────────────────────────────────────────────────────────
// Deliberately not 1, so an id/index/position mix-up cannot pass silently (the lib/match convention).
const CEREMONY = 77;

function winner(rosterEntryId: number, displayName: string | null, refusal?: RevealedWinner['nameRefusal']) {
  return {
    rosterEntryId,
    displayName,
    ...(refusal === undefined ? {} : { nameRefusal: refusal }),
  } satisfies RevealedWinner;
}

function award(over: Partial<RevealedAward> & { awardResultId: number }): RevealedAward {
  return {
    awardId: 500 + over.awardResultId,
    name: 'Muralla',
    bucket: 'skill',
    decidingStat: 'kills',
    outcomeKind: 'winner',
    isPity: false,
    isShared: false,
    decidingValue: '21',
    decidingNum: null,
    decidingDen: null,
    winners: [winner(11, 'Dex')],
    ...over,
  };
}

function spin(spinIndex: number, kind: string, awards: readonly RevealedAward[]): RevealedSpin {
  return { spinIndex, kind, awards };
}

function view(spins: readonly RevealedSpin[], over: Partial<RevealModelInput> = {}) {
  const ceremony: RevealedCeremony = { ceremonyId: CEREMONY, spins };
  return buildRevealView({
    ceremony,
    awardCount: 12,
    complete: false,
    ...over,
  });
}

/**
 * ⭐⭐ THE MEASURED CORPUS, NOT A SYNTHETIC HAPPY PATH (AC12). 0 of 28 players clear the FR-21 floors,
 * so the standing ceremony is TWELVE `no_eligible_players` main spins and TWENTY-EIGHT single-winner
 * consolation spins — and those bytes are cryptographically committed by 6.9a's bundle. A fixture
 * built around a winner would be a fixture of a ceremony that does not exist.
 */
function measuredCorpus(): RevealedSpin[] {
  const spins: RevealedSpin[] = [];
  for (let i = 1; i <= 12; i++) {
    spins.push(
      spin(i, 'main', [
        award({
          awardResultId: 100 + i,
          awardId: 400 + i,
          name: `Premio ${i}`,
          outcomeKind: 'no_eligible_players',
          decidingValue: null,
          winners: [],
        }),
      ]),
    );
  }
  for (let p = 0; p < 28; p++) {
    spins.push(
      spin(13 + p, 'pity', [
        award({
          awardResultId: 200 + p,
          awardId: null,
          name: null,
          bucket: null,
          decidingStat: null,
          outcomeKind: 'winner',
          isPity: true,
          decidingValue: null,
          winners: [winner(900 + p, `Jugador ${p}`)],
        }),
      ]),
    );
  }
  return spins;
}

// ── the closed sets ─────────────────────────────────────────────────────────────────────────────

describe('the closed sets are asserted against RUNTIME-DERIVED counterparts (AC12)', () => {
  it('⛔ REVEAL_OUTCOMES is EXACTLY the engine’s OUTCOME_KINDS, in order', () => {
    // ⛔⛔ THIS IS THE PIN, AND IT IS THE WHOLE REASON THE ARRAY IS WRITTEN OUT IN THE MODULE.
    // `OUTCOME_KINDS` (`lib/roulette/stage2.ts:320`) is typed `readonly string[]`, so it yields no
    // literal union and cannot type a total `Record` — but it IS the engine's own runtime export, so
    // comparing against it makes drift impossible. A literal array copied beside its own assertion is
    // this project's signature defect, shipped EIGHT times (`6-9b:576-588`).
    expect([...REVEAL_OUTCOMES]).toEqual([...OUTCOME_KINDS]);
  });

  it('the counterpart is non-empty, so the equality above cannot pass vacuously', () => {
    expect(OUTCOME_KINDS.length).toBeGreaterThan(0);
    expect(REVEAL_OUTCOMES).toContain('no_eligible_players');
    expect(REVEAL_OUTCOMES).toContain('shared');
    // ⚠ `tie` IS a member and can never be persisted (`award_result_outcome_kind_not_tie`, `0027:268`).
    // It is modelled loudly rather than dropped — the M19 precedent (`deferred-work.md:396`).
    expect(REVEAL_OUTCOMES).toContain('tie');
  });

  it('the phase rail and the shelf vocabulary are closed and non-empty', () => {
    expect([...REVEAL_PHASES]).toEqual(['stage1', 'stage2', 'revealed']);
    expect([...SHELF_STATES]).toEqual(['locked', 'empty', 'won']);
  });
});

// ── totality ────────────────────────────────────────────────────────────────────────────────────

describe('the model is TOTAL over OUTCOME_KINDS (AC12)', () => {
  it('the case table is non-empty — an it.each over [] is zero tests and a green run', () => {
    expect(OUTCOME_KINDS.length).toBe(5);
  });

  it.each([...OUTCOME_KINDS])('shapes a %s result without throwing and preserves the kind', (kind) => {
    const built = view([spin(1, 'main', [award({ awardResultId: 9, outcomeKind: kind, winners: [] })])]);
    expect(built.spins).toHaveLength(1);
    expect(built.spins[0]!.awards[0]!.outcome).toBe(kind);
  });

  it('an outcome kind the CHECK constraint could not produce falls to the LOUD arm, never to a win', () => {
    // ⛔ A sixth kind must not render as a quiet success. `tie`'s copy says the category was not
    // resolved, which is the honest statement for "the producer skipped the ladder".
    const built = view([spin(1, 'main', [award({ awardResultId: 9, outcomeKind: 'jackpot', winners: [] })])]);
    expect(built.spins[0]!.awards[0]!.outcome).toBe('tie');
    expect(built.spins[0]!.awards[0]!.outcome).not.toBe('winner');
  });
});

// ── order, positions and the locked grid ────────────────────────────────────────────────────────

describe('the published spin order IS the reveal order (UX-DR32/42)', () => {
  it('⛔ never re-sorts the spins it is given', () => {
    const built = view([
      spin(1, 'main', [award({ awardResultId: 1 })]),
      spin(2, 'main', [award({ awardResultId: 2 })]),
      spin(3, 'main', [award({ awardResultId: 3 })]),
    ]);
    expect(built.spins.map((s) => s.spinIndex)).toEqual([1, 2, 3]);
  });

  it('⛔ never re-orders the awards WITHIN a spin — `live_award_ids` is the draw order', () => {
    // The reader resolves the draw order; the model must carry it through untouched.
    // `sweep.test.ts:448` warns this story by name that sorting it in place discards it.
    const built = view([
      spin(1, 'main', [
        award({ awardResultId: 30, awardId: 903, name: 'C' }),
        award({ awardResultId: 10, awardId: 901, name: 'A' }),
        award({ awardResultId: 20, awardId: 902, name: 'B' }),
      ]),
    ]);
    expect(built.spins[0]!.awards.map((a) => a.name)).toEqual(['C', 'A', 'B']);
  });

  it('numbers MAIN positions 1..k and gives a pity spin none', () => {
    const built = view([
      spin(1, 'main', [award({ awardResultId: 1 })]),
      spin(2, 'main', [award({ awardResultId: 2 })]),
      spin(3, 'pity', [award({ awardResultId: 3, awardId: null, isPity: true })]),
      spin(4, 'main', [award({ awardResultId: 4 })]),
    ]);
    expect(built.spins.map((s) => s.position)).toEqual([1, 2, null, 3]);
    expect(built.mainSpins).toHaveLength(3);
  });

  it('marks ONLY the last spin newest', () => {
    const built = view([
      spin(1, 'main', [award({ awardResultId: 1 })]),
      spin(2, 'main', [award({ awardResultId: 2 })]),
    ]);
    expect(built.spins.map((s) => s.isNewest)).toEqual([false, true]);
  });

  it('locks exactly the positions that have not been revealed — a COUNT, never a hidden row', () => {
    const built = view([spin(1, 'main', [award({ awardResultId: 1 })])], { awardCount: 4 });
    expect(built.lockedPositions).toEqual([2, 3, 4]);
  });

  it('locks nothing once every catalog position has spun', () => {
    const built = view(
      [1, 2].map((i) => spin(i, 'main', [award({ awardResultId: i })])),
      { awardCount: 2 },
    );
    expect(built.lockedPositions).toEqual([]);
  });
});

// ── the shelf ───────────────────────────────────────────────────────────────────────────────────

describe('the trophy shelf reports what actually landed', () => {
  it('marks won / empty / locked, and never lets a pity spin claim a catalog slot', () => {
    const built = view(
      [
        spin(1, 'main', [award({ awardResultId: 1 })]), // one winner → won
        spin(2, 'main', [award({ awardResultId: 2, outcomeKind: 'no_eligible_players', winners: [] })]),
        spin(3, 'pity', [award({ awardResultId: 3, awardId: null, isPity: true })]),
      ],
      { awardCount: 4 },
    );
    expect(built.shelf.map((s) => s.state)).toEqual(['won', 'empty', 'locked', 'locked']);
  });

  it('flags the newest slot only when the newest spin is a MAIN one that won', () => {
    const built = view([
      spin(1, 'main', [award({ awardResultId: 1 })]),
      spin(2, 'main', [award({ awardResultId: 2 })]),
    ]);
    expect(built.shelf.filter((s) => s.isNewest).map((s) => s.position)).toEqual([2]);
  });

  // ⚠ `trophiesAwarded` WAS ASSERTED HERE AND THE FIELD IS GONE (code review, 2026-08-11, Cuatro's
  // call). It was computed, tested three ways and rendered by NOTHING — the surface never showed a
  // trophy count — so the tests were measuring a number no viewer could ever see. What the shelf and
  // the record actually render is asserted above and below.
});

// ── the deciding value ──────────────────────────────────────────────────────────────────────────

describe('the deciding value is carried, never computed', () => {
  it('renders a volume value verbatim', () => {
    const built = view([spin(1, 'main', [award({ awardResultId: 1, decidingValue: '21' })])]);
    expect(built.spins[0]!.awards[0]!.decidingText).toBe('21');
  });

  it('⛔ NEVER divides the AD-19 rate pair — a quotient is not reproducible across two runtimes', () => {
    const built = view([
      spin(1, 'main', [award({ awardResultId: 1, decidingValue: null, decidingNum: '73', decidingDen: '100' })]),
    ]);
    expect(built.spins[0]!.awards[0]!.decidingText).toBe('73/100');
    expect(built.spins[0]!.awards[0]!.decidingText).not.toBe('0.73');
  });

  it('is null when the outcome had none — ⛔ never `0`, which would read as a measured zero', () => {
    const built = view([
      spin(1, 'main', [award({ awardResultId: 1, outcomeKind: 'no_eligible_players', decidingValue: null, winners: [] })]),
    ]);
    expect(built.spins[0]!.awards[0]!.decidingText).toBeNull();
  });
});

describe('6.9a DECISION J — the ladder step is ABSENT, never 0', () => {
  it('omits the key entirely when no ladder ran', () => {
    const built = view([spin(1, 'main', [award({ awardResultId: 1 })])]);
    expect(Object.hasOwn(built.spins[0]!.awards[0]!, 'ladderExitStep')).toBe(false);
  });

  it('carries a real rung through unchanged', () => {
    const built = view([spin(1, 'main', [award({ awardResultId: 1, ladderExitStep: 3 })])]);
    expect(built.spins[0]!.awards[0]!.ladderExitStep).toBe(3);
  });
});

// ── AC9: winners as separate elements ───────────────────────────────────────────────────────────

describe('AC9 — a shared co-winner is ONE card with N winner elements', () => {
  it('keeps every winner as its own element rather than a joined string', () => {
    const built = view([
      spin(1, 'main', [
        award({
          awardResultId: 1,
          outcomeKind: 'shared',
          isShared: true,
          winners: [winner(11, 'Dex'), winner(22, 'Theo'), winner(33, 'Mara')],
        }),
      ]),
    ]);
    const only = built.spins[0]!.awards[0]!;
    expect(only.winners).toHaveLength(3);
    expect(only.winners.map((w) => w.displayName)).toEqual(['Dex', 'Theo', 'Mara']);
  });

  it('⛔ a REFUSED element is refused, never DROPPED — it keeps its slot and its reason', () => {
    // Dropping it would misreport who won, which is the one thing this surface exists to get right.
    const built = view([
      spin(1, 'main', [
        award({
          awardResultId: 1,
          outcomeKind: 'shared',
          isShared: true,
          winners: [winner(11, 'Dex'), winner(22, null, 'zero_width'), winner(33, null, 'unresolved')],
        }),
      ]),
    ]);
    const only = built.spins[0]!.awards[0]!;
    expect(only.winners).toHaveLength(3);
    expect(only.winners[1]).toMatchObject({ rosterEntryId: 22, displayName: null, nameRefusal: 'zero_width' });
    // ⚠ TWO DIFFERENT FACTS, KEPT APART: a guard refusal is not a player who left the roster.
    expect(only.winners[2]!.nameRefusal).toBe('unresolved');
  });
});

// ── the measured corpus ─────────────────────────────────────────────────────────────────────────

describe('⭐ the MEASURED corpus — twelve “nobody qualified” cards and a 28-way consolation', () => {
  const built = view(measuredCorpus(), { revealedSpins: 40, totalSpins: 40, complete: true });

  it('reports twelve zero-winner main spins and nothing else on the shelf', () => {
    expect(built.mainSpins).toHaveLength(12);
    expect(built.mainSpins.every((s) => s.awards.every((a) => a.outcome === 'no_eligible_players'))).toBe(true);
    expect(built.shelf.map((s) => s.state)).toEqual(Array.from({ length: 12 }, () => 'empty'));
    expect(built.lockedPositions).toEqual([]);
  });

  it('reports twenty-eight consolation winners, flattened in published order', () => {
    expect(built.pity).not.toBeNull();
    expect(built.pity!.spins).toHaveLength(28);
    expect(built.pity!.winners).toHaveLength(28);
    expect(built.pity!.winners[0]!.rosterEntryId).toBe(900);
    expect(built.pity!.winners[27]!.rosterEntryId).toBe(927);
  });

  it('⛔ every trophy comes from the consolation round — not one from a category', () => {
    // ⚠ The `trophiesAwarded === 28` half of this assertion went with the field itself (see above).
    // The half that describes what the SURFACE renders is the half that mattered, and it stays.
    expect(built.pity!.winners).toHaveLength(28);
    expect(built.mainSpins.flatMap((s) => s.awards).flatMap((a) => a.winners)).toHaveLength(0);
  });

  it('has no pity block at all when the consolation round has not run', () => {
    expect(view([spin(1, 'main', [award({ awardResultId: 1 })])]).pity).toBeNull();
  });
});

// ── the parity key (AC3's oracle) ───────────────────────────────────────────────────────────────

describe('revealParityKey — AC3’s oracle, and it must be SENSITIVE to be worth anything', () => {
  const base = view(measuredCorpus(), { revealedSpins: 40, totalSpins: 40, complete: true });

  it('is stable for the same view', () => {
    expect(revealParityKey(base)).toBe(revealParityKey(view(measuredCorpus(), { revealedSpins: 40, totalSpins: 40, complete: true })));
  });

  it('is non-empty and covers every spin', () => {
    const lines = revealParityKey(base).split('\n');
    expect(lines.filter((l) => l.startsWith('spin\t'))).toHaveLength(40);
    expect(lines.filter((l) => l.startsWith('winner\t'))).toHaveLength(28);
  });

  // ⛔⛔ NON-VACUITY. A parity oracle that returns the same string for two DIFFERENT ceremonies proves
  // nothing, and "the two captures matched" would then be a fact about the oracle rather than about
  // the page. Each case below changes exactly one thing AC3 says must not differ.
  it.each([
    ['a reordered spin list', (s: RevealedSpin[]) => [s[1]!, s[0]!, ...s.slice(2)]],
    ['a changed winner name', (s: RevealedSpin[]) => [...s.slice(0, 12), spin(13, 'pity', [award({ awardResultId: 200, awardId: null, isPity: true, winners: [winner(900, 'OTRO')] })]), ...s.slice(13)]],
    ['a changed outcome', (s: RevealedSpin[]) => [spin(1, 'main', [award({ awardResultId: 101, awardId: 401, name: 'Premio 1', outcomeKind: 'winner', decidingValue: null })]), ...s.slice(1)]],
  ])('changes when %s changes', (_label, mutate) => {
    const mutated = view(mutate(measuredCorpus()), { revealedSpins: 40, totalSpins: 40, complete: true });
    expect(revealParityKey(mutated)).not.toBe(revealParityKey(base));
  });

  /**
   * ⭐⭐ MUTATION SURVIVOR M18, AND WHY THE `a changed winner name` CASE ABOVE WAS VACUOUS.
   *
   * Dropping the winner's IDENTITY from the key — `winner\t${awardResultId}` and nothing more —
   * SURVIVED the case above, because that case rebuilds the spin with the `award()` helper's
   * DEFAULTS (a name, a bucket, a stat, a value) where the corpus's pity award carries nulls. So the
   * AWARD line already differed and the key changed for a reason that had nothing to do with the
   * winner. ⛔ A parity oracle blind to WHO WON would let the reduced-motion path announce a
   * different person and still report parity — which is the one thing AC3 exists to prevent.
   *
   * The case below changes ONE field of ONE winner and touches nothing else.
   */
  it('⛔⛔ changes when ONLY a winner’s display name changes — nothing else touched', () => {
    const spins = measuredCorpus();
    const renamed = spins.map((s, i) =>
      i !== 12 ? s : { ...s, awards: s.awards.map((a) => ({ ...a, winners: [{ ...a.winners[0]!, displayName: 'OTRO' }] })) },
    );
    const after = view(renamed, { revealedSpins: 40, totalSpins: 40, complete: true });
    // The only difference is the name — assert that, so the case cannot silently become the old one.
    expect(after.pity!.winners[0]!.rosterEntryId).toBe(base.pity!.winners[0]!.rosterEntryId);
    expect(after.pity!.winners[0]!.displayName).not.toBe(base.pity!.winners[0]!.displayName);
    expect(revealParityKey(after)).not.toBe(revealParityKey(base));
  });

  it('⛔ changes when ONLY a winner’s REFUSAL reason changes — a refused element still identifies itself', () => {
    const spins = measuredCorpus();
    const refused = spins.map((s, i) =>
      i !== 12
        ? s
        : { ...s, awards: s.awards.map((a) => ({ ...a, winners: [{ rosterEntryId: 900, displayName: null, nameRefusal: 'zero_width' as const }] })) },
    );
    const alsoRefused = spins.map((s, i) =>
      i !== 12
        ? s
        : { ...s, awards: s.awards.map((a) => ({ ...a, winners: [{ rosterEntryId: 900, displayName: null, nameRefusal: 'unresolved' as const }] })) },
    );
    const a = revealParityKey(view(refused, { revealedSpins: 40, totalSpins: 40, complete: true }));
    const b = revealParityKey(view(alsoRefused, { revealedSpins: 40, totalSpins: 40, complete: true }));
    expect(a).not.toBe(b);
  });

  it('⛔ carries no PRESENTATIONAL fact — `isNewest` and the shelf must not enter the domain', () => {
    // AC3 permits decoration to differ; folding it in would make the key fail for a reason AC3 allows.
    const key = revealParityKey(base);
    expect(key).not.toContain('newest');
    expect(key).not.toContain('locked');
  });
});

// ── DECISION U, as a source scan ────────────────────────────────────────────────────────────────

describe('⭐⭐ DECISION U — the model has no motion parameter, and there is nowhere to put one', () => {
  const RAW = readFileSync(new URL('./reveal-model.ts', import.meta.url), 'utf8');

  /**
   * ⚠⚠ THE SCAN READS CODE, NOT PROSE, AND THE FIRST DRAFT DID NOT — IT FAILED ON ITS OWN MODULE'S
   * COMMENTS. `reveal-model.ts` EXPLAINS why it has no `Math.random` and no `prefers-reduced-motion`,
   * so an unstripped scan reddens on the very sentences that document the rule, and the obvious
   * "fix" — deleting the explanation — would make the module worse to satisfy its own test.
   * ⛔ This is the same trap `verification.test.ts:44-46` records from the other direction (a trailing
   * comment on a VALUE line reads as data), and the same class as `6-9b:854-860`'s broken oracle.
   */
  const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const SOURCE = codeOnly(RAW);

  it('the stripped source is real code — a scan over an empty string passes everything', () => {
    // ⛔ NON-VACUITY, IN BOTH DIRECTIONS: the stripper must remove the prose AND keep the code.
    expect(RAW.length).toBeGreaterThan(1000);
    expect(SOURCE.length).toBeGreaterThan(1000);
    expect(SOURCE).toContain('export function buildRevealView');
    expect(SOURCE).toContain('export function revealParityKey');
    // The prose really was removed — this phrase exists only inside a comment.
    expect(RAW).toContain('DECISION U');
    expect(SOURCE).not.toContain('DECISION U');
  });

  it.each(['matchMedia', 'prefers-reduced-motion', 'MotionPreference', 'window.'])(
    'never mentions %s in CODE',
    (needle) => {
      expect(SOURCE).not.toContain(needle);
    },
  );

  it('⛔ has no clock, no randomness and no locale formatting', () => {
    for (const needle of ['Date.now', 'new Date', 'Math.random', 'Intl.', 'toLocaleString']) {
      expect(SOURCE).not.toContain(needle);
    }
  });

  it('`buildRevealView` takes exactly ONE argument — a motion flag would have to be a second', () => {
    expect(buildRevealView.length).toBe(1);
  });
});

// ── the two counts are RECONCILED, not trusted (code review, 2026-08-11) ────────────────────────

describe('⛔ `Premio i de n` can never have i greater than n, and no won position can lack a slot', () => {
  it('⭐ awardCount 0 does not produce "Premio 12 de 0" — the shelf grows to the revealed rows', () => {
    // `lib/awards/read.ts` refuses < 0 and > 64 but ACCEPTS 0, and the page passed it straight in:
    // twelve revealed spins against a count of 0 rendered an empty shelf, an empty locked grid and
    // twelve record lines each reading "Premio i de 0".
    const built = view([spin(1, 'main', [award({ awardResultId: 1 })]), spin(2, 'main', [award({ awardResultId: 2 })])], { awardCount: 0 });
    expect(built.awardCount).toBe(2);
    expect(built.shelf).toHaveLength(2);
    expect(built.lockedPositions).toEqual([]);
  });

  it('⭐ more revealed main spins than catalog awards keeps every position on the shelf', () => {
    // A catalog re-curated mid-ceremony used to drop position 13 off the shelf ENTIRELY — a won
    // trophy with no slot — while the record still printed "Premio 13 de 12".
    const spins = Array.from({ length: 13 }, (_, i) => spin(i + 1, 'main', [award({ awardResultId: i + 1 })]));
    const built = view(spins, { awardCount: 12 });
    expect(built.awardCount).toBe(13);
    expect(built.shelf).toHaveLength(13);
    expect(built.shelf.map((s) => s.position)).toContain(13);
    expect(built.mainSpins.every((s) => s.position <= built.awardCount)).toBe(true);
  });

  it('the ordinary case is untouched — 12 awards, 2 revealed, 10 still locked', () => {
    const built = view([spin(1, 'main', [award({ awardResultId: 1 })]), spin(2, 'main', [award({ awardResultId: 2 })])]);
    expect(built.awardCount).toBe(12);
    expect(built.shelf).toHaveLength(12);
    expect(built.lockedPositions).toHaveLength(10);
  });

  it('⛔ a pity spin never consumes a catalog position', () => {
    const built = view([spin(1, 'main', [award({ awardResultId: 1 })]), spin(2, 'pity', [award({ awardResultId: 2, awardId: null, isPity: true })])]);
    expect(built.awardCount).toBe(12);
    expect(built.mainSpins).toHaveLength(1);
    expect(built.pity!.spins).toHaveLength(1);
  });
});

describe('the shelf distinguishes all THREE of its states', () => {
  it('⭐ a spun-but-unclaimed position is `empty`, an unspun one is `locked` — ⛔ not the same fact', () => {
    const built = view([
      spin(1, 'main', [award({ awardResultId: 1, outcomeKind: 'winner', winners: [winner(11, 'Dex')] })]),
      spin(2, 'main', [award({ awardResultId: 2, outcomeKind: 'no_eligible_players', winners: [] })]),
    ]);
    expect(built.shelf[0]!.state).toBe('won');
    expect(built.shelf[1]!.state).toBe('empty');
    expect(built.shelf[2]!.state).toBe('locked');
    // ⛔ THE MEASURED CORPUS: with every main spin unclaimed, the shelf must NOT read as all-locked.
    const dominant = view(Array.from({ length: 12 }, (_, i) => spin(i + 1, 'main', [award({ awardResultId: i + 1, outcomeKind: 'no_eligible_players', winners: [] })])));
    expect(dominant.shelf.every((s) => s.state === 'empty')).toBe(true);
    expect(dominant.shelf.some((s) => s.state === 'locked')).toBe(false);
  });
});

describe('`complete` reaches the view, because the renderer gates the animation on it', () => {
  it('carries both values through', () => {
    expect(view([spin(1, 'main', [award({ awardResultId: 1 })])], { complete: true }).complete).toBe(true);
    expect(view([spin(1, 'main', [award({ awardResultId: 1 })])], { complete: false }).complete).toBe(false);
  });
});

describe('a pity round with NO winners still models the round', () => {
  it('⭐ returns a pity block with an empty winners list — the RENDERER decides what to promise', () => {
    // The model must not hide the fact that the consolation round ran; what it must not do is let
    // the surface promise "Nadie se va con las manos vacias" over nothing. That guard is the
    // renderer's, and this asserts the shape it guards on actually occurs.
    const built = view([spin(1, 'pity', [award({ awardResultId: 1, awardId: null, isPity: true, outcomeKind: 'no_eligible_players', winners: [] })])]);
    expect(built.pity).not.toBeNull();
    expect(built.pity!.winners).toHaveLength(0);
  });
});
