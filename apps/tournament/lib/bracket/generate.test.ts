import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  generateBracket,
  generateAndPersistBracket,
  seedOrder,
  nextPowerOfTwo,
  winnersRoundCount,
  winnersRoundSize,
  winnersSlot,
  losersRoundCount,
  losersRoundSize,
  losersSlot,
  losersRoundOf,
  winnersWinnerTarget,
  winnersLoserTarget,
  losersWinnerTarget,
  MIN_FIELD,
  MAX_FIELD,
  type Rng,
  type Edge,
  type EdgeRef,
  type MatchRow,
  type RosterEntryRef,
} from '@/lib/bracket/generate';

const ADMIN = '76561198388441171';
const T_ID = 7;

/** roster_entry ids 101..100+n — deliberately NOT 1..n, so an id/seed mix-up cannot pass silently. */
const roster = (n: number): RosterEntryRef[] =>
  Array.from({ length: n }, (_, i) => ({ id: 101 + i }));

/**
 * The IDENTITY rng: Fisher–Yates swaps out[i] with out[rng(i+1)], so returning `max-1` always swaps an
 * element with itself. The draw is then the roster's own order — entry 101 -> seed 1, 102 -> seed 2, …
 * That makes every seeding/bye assertion below readable and exact, while still exercising the real
 * shuffle code path. (A stub rng is exactly what "injected RNG" in Task 3 buys us.)
 */
const identityRng: Rng = (max) => max - 1;

/** A deterministic non-identity rng: a fixed LCG. Used to prove determinism on a REAL permutation. */
const seededRng = (seed: number): Rng => {
  let s = seed >>> 0;
  return (max) => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s % max;
  };
};

const ok = (n: number, rng: Rng = identityRng) => {
  const r = generateBracket(roster(n), rng);
  if (!r.ok) throw new Error(`expected a bracket for N=${n}, got ${r.reason}`);
  return r.bracket;
};

const find = (matches: MatchRow[], bracket: string, slot: number) =>
  matches.find((m) => m.bracket === bracket && m.bracket_slot === slot)!;

describe('seedOrder — standard single-elim seeding (the source of AC3s deterministic byes)', () => {
  it('produces the canonical 8- and 16-bracket orders', () => {
    // Consecutive pairs are the R1 matches: 1v8, 4v5, 2v7, 3v6 — so seeds 1 and 2 can only meet in the final.
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(seedOrder(16)).toEqual([1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]);
  });

  it('always lists the STRONGER seed first in a pair, and pairs k with size+1-k', () => {
    // Both properties are load-bearing. (a) => in a bye match the present player is ALWAYS competitor_a.
    // (b) => the absent seeds (N+1..size) are exactly the R1 opponents of seeds 1..(size-N), which is
    // WHY the byes land on the top seeds with no special-casing. Byes are a CONSEQUENCE of standard
    // seeding, not a rule bolted on top — if this ever broke, AC3 would break silently.
    for (const size of [8, 16]) {
      const order = seedOrder(size);
      expect(order).toHaveLength(size);
      expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: size }, (_, i) => i + 1));
      for (let i = 0; i < size / 2; i++) {
        const [a, b] = [order[2 * i], order[2 * i + 1]];
        expect(a).toBeLessThan(b);
        expect(a + b).toBe(size + 1);
      }
    }
  });
});

describe('structure sizing (AC2 — the double-elim skeleton)', () => {
  it('derives bracketSize as the next power of two', () => {
    expect(nextPowerOfTwo(8)).toBe(8);
    for (const n of [9, 11, 13, 15, 16]) expect(nextPowerOfTwo(n)).toBe(16);
  });

  it.each([
    // bracketSize, winners, losers  — winners = size-1, losers = size-2, +1 GF => 2*size-2 total
    [8, 7, 6],
    [16, 15, 14],
  ])('a %i-bracket has %i winners and %i losers matches', (size, wCount, lCount) => {
    let w = 0;
    for (let r = 1; r <= winnersRoundCount(size); r++) w += winnersRoundSize(size, r);
    let l = 0;
    for (let r = 1; r <= losersRoundCount(size); r++) l += losersRoundSize(size, r);
    expect(w).toBe(wCount);
    expect(l).toBe(lCount);
    // Slots are contiguous 0-based within each bracket (no gaps, no collisions).
    expect(winnersSlot(size, winnersRoundCount(size), 0)).toBe(wCount - 1);
    expect(losersSlot(size, losersRoundCount(size), 0)).toBe(lCount - 1);
  });
});

describe('routing invariants (AC2 — two-loss elimination is derived from EDGES, never a stored flag)', () => {
  it.each([[8], [16]])(
    'every slot of a %i-bracket has exactly the in-edges it should, and losers losers have NO edge',
    (size) => {
      const bracket = ok(size === 8 ? 8 : 16);
      const wRounds = winnersRoundCount(size);
      const lRounds = losersRoundCount(size);

      // Collect every edge the bracket defines.
      const edges: Edge[] = [];
      for (let r = 1; r <= wRounds; r++) {
        for (let i = 0; i < winnersRoundSize(size, r); i++) {
          edges.push(winnersWinnerTarget(size, r, i)); // the winner advances
          edges.push(winnersLoserTarget(size, r, i)); // the loser DROPS (first loss)
        }
      }
      for (let r = 1; r <= lRounds; r++) {
        for (let i = 0; i < losersRoundSize(size, r); i++) {
          edges.push(losersWinnerTarget(size, r, i)); // only the WINNER has an edge…
          // …a losers LOSER has none. That absence IS two-loss elimination (FR-6): there is no
          // `losersLoserTarget` to call, so a second loss cannot route anywhere by construction.
        }
      }
      // Winners: 2 edges each (win + drop). Losers: 1 each (win only). Hence 2(size-1) + (size-2).
      expect(edges).toHaveLength(2 * (size - 1) + (size - 2));

      // Every edge must land in a real slot, on a real side.
      const inDeg = new Map<string, number>();
      for (const e of edges) {
        const row = bracket.matches.find(
          (m) => m.bracket === e.bracket && m.bracket_slot === e.slot && m.gf_order === e.gfOrder,
        );
        expect(row, `edge -> ${e.bracket}:${e.slot} must target a real match`).toBeDefined();
        const k = `${e.bracket}:${e.slot}:${e.side}`;
        inDeg.set(k, (inDeg.get(k) ?? 0) + 1);
      }

      // Winners R1 is SEEDED, so it takes no in-edges. Every other competitor slot in the whole
      // bracket is fed by exactly ONE edge — no slot is double-fed (which would silently overwrite a
      // competitor) and none is starved (which would strand the bracket).
      for (let i = 0; i < winnersRoundSize(size, 1); i++) {
        expect(inDeg.get(`winners:${winnersSlot(size, 1, i)}:a`)).toBeUndefined();
        expect(inDeg.get(`winners:${winnersSlot(size, 1, i)}:b`)).toBeUndefined();
      }
      for (let r = 2; r <= wRounds; r++) {
        for (let i = 0; i < winnersRoundSize(size, r); i++) {
          expect(inDeg.get(`winners:${winnersSlot(size, r, i)}:a`)).toBe(1);
          expect(inDeg.get(`winners:${winnersSlot(size, r, i)}:b`)).toBe(1);
        }
      }
      for (let r = 1; r <= lRounds; r++) {
        for (let i = 0; i < losersRoundSize(size, r); i++) {
          expect(inDeg.get(`losers:${losersSlot(size, r, i)}:a`)).toBe(1);
          expect(inDeg.get(`losers:${losersSlot(size, r, i)}:b`)).toBe(1);
        }
      }
      // The Grand Final is fed by exactly the two finalists: Winners-Final winner (A), LB survivor (B).
      expect(inDeg.get('grand_final:0:a')).toBe(1);
      expect(inDeg.get('grand_final:0:b')).toBe(1);
    },
  );

  it.each([[8], [16]])(
    'the %i-bracket LB dropdown never lets a Winners loser replay the player who knocked them down — at ANY major round',
    (size) => {
      // ⚠ THE TEST THAT MUST NOT BE NARROW. The obvious version of this checks only LB round 2, which is
      // the ONE round a full index-reversal (count-1-index) happens to get right — its symmetry argument
      // covers exactly that round and no other. A reversal then breaks the block confinement of the next
      // minor round, and in a 16-bracket the loser of a Winners-R2 match meets the very player who beat
      // them again in LB R4. So walk EVERY major round, and follow each dropped player forward through
      // the whole losers bracket rather than looking one hop ahead.
      //
      // For each Winners match (r, m): trace where its LOSER can travel in the LB, then check no LATER
      // Winners match that its WINNER could reach drops into any of those nodes. The one legitimate
      // exception is the FINAL major round (count === 1): there the Winners-Final loser necessarily meets
      // the LB survivor, and that rematch is structurally unavoidable in any double-elim bracket.
      const lbNodeOf = (e: Edge) => `${e.slot}`;
      const reachableLbNodes = (r: number, m: number): Set<string> => {
        const out = new Set<string>();
        let edge = winnersLoserTarget(size, r, m);
        // walk forward along the winner-edges from the node the loser drops into
        for (;;) {
          out.add(lbNodeOf(edge));
          const { round, index } = losersRoundOf(size, edge.slot);
          const next = losersWinnerTarget(size, round, index);
          if (next.bracket !== 'losers') break; // reached the Grand Final
          edge = next;
        }
        return out;
      };

      for (let r = 1; r < winnersRoundCount(size); r++) {
        for (let m = 0; m < winnersRoundSize(size, r); m++) {
          const loserPath = reachableLbNodes(r, m);
          // The WINNER of (r, m) sits in Winners (r+k, m >> k). Wherever they later lose, they drop.
          for (let r2 = r + 1; r2 <= winnersRoundCount(size); r2++) {
            const m2 = m >> (r2 - r);
            const lbRound = 2 * (r2 - 1);
            if (losersRoundSize(size, lbRound) === 1) continue; // the legitimate WF-loser vs LB-survivor
            const drop = lbNodeOf(winnersLoserTarget(size, r2, m2));
            expect(
              loserPath.has(drop),
              `W-R${r} m${m}: its winner drops into LB slot ${drop} after losing W-R${r2} m${m2}, ` +
                `which its own loser can also reach — an avoidable rematch`,
            ).toBe(false);
          }
        }
      }
    },
  );
});

describe('LIVENESS (AC2 + AC3) — every legal field can actually COMPLETE', () => {
  // ⭐ THE TEST THAT WOULD HAVE CAUGHT THE BYE BUG. A bye produces a WINNER but no LOSER, so the Losers
  // slot waiting on that loser is fed by nothing. Emit the full Losers skeleton anyway and it stays empty
  // forever: the match is never playable, the stall cascades, the Grand Final's side B never fills, and
  // NO non-power-of-two field can finish (a single bye at N=15 is enough to strand the whole LB spine).
  // Counting rows cannot see this. Only asking "can a player actually reach the Grand Final?" can.
  //
  // Independent reachability fixpoint over the REAL edges — deliberately not a re-implementation of
  // generateBracket's own propagation, but an outside check of its output: a 'declared' node must
  // genuinely be able to receive two players, a 'bye' exactly one, a 'void' none.
  const analyse = (n: number) => {
    const b = ok(n, seededRng(n * 13));
    const size = b.bracketSize;
    const key = (bracket: string, slot: number) => `${bracket}:${slot}`;
    const filled = new Map<string, { a: boolean; b: boolean }>();
    for (const m of b.matches) filled.set(key(m.bracket, m.bracket_slot), { a: false, b: false });
    for (const m of b.matches) {
      const f = filled.get(key(m.bracket, m.bracket_slot))!;
      if (m.competitor_a !== null) f.a = true;
      if (m.competitor_b !== null) f.b = true;
    }
    const fill = (e: Edge) => {
      const f = filled.get(key(e.bracket, e.slot))!;
      const before = f[e.side];
      f[e.side] = true;
      return !before;
    };
    const rowAt = (bracket: string, slot: number) =>
      b.matches.find((m) => m.bracket === bracket && m.bracket_slot === slot)!;

    for (let changed = true; changed; ) {
      changed = false;
      for (let r = 1; r <= winnersRoundCount(size); r++) {
        for (let i = 0; i < winnersRoundSize(size, r); i++) {
          const row = rowAt('winners', winnersSlot(size, r, i));
          const f = filled.get(key('winners', row.bracket_slot))!;
          const isBye = row.state === 'bye';
          if (!(isBye || (f.a && f.b))) continue;
          if (fill(winnersWinnerTarget(size, r, i))) changed = true;
          if (!isBye && fill(winnersLoserTarget(size, r, i))) changed = true; // a bye has NO loser
        }
      }
      for (let r = 1; r <= losersRoundCount(size); r++) {
        for (let i = 0; i < losersRoundSize(size, r); i++) {
          const row = rowAt('losers', losersSlot(size, r, i));
          if (row.state === 'void') continue; // never played, advances nobody
          const f = filled.get(key('losers', row.bracket_slot))!;
          const live = row.state === 'bye' ? f.a || f.b : f.a && f.b; // a walkover needs ONE, a match TWO
          if (!live) continue;
          if (fill(losersWinnerTarget(size, r, i))) changed = true;
        }
      }
    }
    return { bracket: b, size, filled, key, rowAt };
  };

  it.each([[8], [9], [10], [11], [12], [13], [14], [15], [16]])(
    'N=%i: the Grand Final is REACHABLE from both sides — the tournament can be finished',
    (n) => {
      const { filled, key } = analyse(n);
      const gf = filled.get(key('grand_final', 0))!;
      expect(gf.a, `N=${n}: the Winners champion must reach the Grand Final`).toBe(true);
      expect(gf.b, `N=${n}: a Losers survivor must reach the Grand Final — if not, the bracket STALLS`).toBe(true);
    },
  );

  it.each([[9], [10], [11], [12], [13], [14], [15]])(
    'N=%i: every match state matches what can actually reach it (declared=2, bye=1, void=0)',
    (n) => {
      const { bracket, size, filled, key } = analyse(n);
      for (let r = 1; r <= losersRoundCount(size); r++) {
        for (let i = 0; i < losersRoundSize(size, r); i++) {
          const slot = losersSlot(size, r, i);
          const row = bracket.matches.find((m) => m.bracket === 'losers' && m.bracket_slot === slot)!;
          const f = filled.get(key('losers', slot))!;
          const arrivals = (f.a ? 1 : 0) + (f.b ? 1 : 0);
          const expected = row.state === 'declared' ? 2 : row.state === 'bye' ? 1 : 0;
          expect(
            arrivals,
            `N=${n} LB R${r} m${i} is '${row.state}' but ${arrivals} competitor(s) can reach it`,
          ).toBe(expected);
        }
      }
    },
  );

  it('N=15 — a SINGLE bye still poisons nothing: the lone stranded feeder becomes a walkover', () => {
    // The narrowest case, and the one a "byes are an edge case" instinct would skip. One bye means one
    // Winners-R1 match produces no loser, which leaves exactly one LB-R1 side unfillable — and that alone
    // used to strand LB R1 -> R2 -> ... -> R6 -> the Grand Final.
    const b = ok(15);
    expect(b.byeSeeds).toEqual([1]);
    const lbByes = b.matches.filter((m) => m.bracket === 'losers' && m.state === 'bye');
    expect(lbByes).toHaveLength(1); // exactly one Losers walkover…
    expect(b.matches.filter((m) => m.state === 'void')).toHaveLength(0); // …and nothing is void
  });
});

describe('generateBracket — the draw (AC1)', () => {
  it('assigns every active entry a unique seed position 1..N', () => {
    const b = ok(11, seededRng(42));
    expect(b.seeds).toHaveLength(11);
    expect([...b.seeds].map((s) => s.seed).sort((a, c) => a - c)).toEqual(
      Array.from({ length: 11 }, (_, i) => i + 1),
    );
    // …and every seat belongs to a distinct real roster entry.
    expect(new Set(b.seeds.map((s) => s.roster_entry_id)).size).toBe(11);
    expect(b.seeds.map((s) => s.roster_entry_id).sort((a, c) => a - c)).toEqual(
      roster(11).map((e) => e.id),
    );
  });

  it('is DETERMINISTIC: the same rng sequence produces a byte-identical bracket', () => {
    // Reproducibility is the AC1 promise. Two independent runs over the same draw must agree on every
    // seat, every pairing and every row — not merely on the counts.
    const a = ok(13, seededRng(2026));
    const b = ok(13, seededRng(2026));
    expect(a).toEqual(b);
    // …and a DIFFERENT draw really does produce a different seating (the rng is genuinely consumed).
    const c = ok(13, seededRng(7));
    expect(c.seeds).not.toEqual(a.seeds);
  });

  it('records the raw draw for the audit row (AD-17) without ever touching fair_seed', () => {
    const b = ok(9);
    expect(b.draw.algorithm).toBe('fisher-yates');
    expect(b.draw.field_size).toBe(9);
    expect(b.draw.bracket_size).toBe(16);
    expect(b.draw.draw).toEqual(b.seeds);
    expect(b.draw.bye_seeds).toEqual(b.byeSeeds);
  });

  it.each([[MIN_FIELD - 1], [7], [17], [0]])('refuses a field of %i (outside AC1s 8..16)', (n) => {
    const r = generateBracket(roster(n), identityRng);
    expect(r).toEqual({ ok: false, reason: 'bad_field_count' });
  });

  it('accepts exactly the AC1 boundaries', () => {
    expect(generateBracket(roster(MIN_FIELD), identityRng).ok).toBe(true);
    expect(generateBracket(roster(MAX_FIELD), identityRng).ok).toBe(true);
  });
});

describe('generateBracket — power-of-two fields have NO byes (AC2)', () => {
  it.each([
    [8, 8, 7, 6, 14],
    [16, 16, 15, 14, 30],
  ])(
    'N=%i: bracketSize %i, Winners %i, Losers %i, %i rows total, zero byes',
    (n, size, wCount, lCount, total) => {
      const b = ok(n);
      expect(b.bracketSize).toBe(size);
      expect(b.byeSeeds).toEqual([]);
      expect(b.matches).toHaveLength(total);
      expect(b.matches.filter((m) => m.bracket === 'winners')).toHaveLength(wCount);
      expect(b.matches.filter((m) => m.bracket === 'losers')).toHaveLength(lCount);

      // Exactly ONE grand final, gf_order = 1. The AD-21 reset row (gf_order=2) is Story 4.4's.
      const gf = b.matches.filter((m) => m.bracket === 'grand_final');
      expect(gf).toHaveLength(1);
      expect(gf[0].gf_order).toBe(1);
      expect(gf[0].bracket_position).toBe('Grand Final');

      // No byes => every match is 'declared' and nobody is pre-advanced.
      expect(b.matches.every((m) => m.state === 'declared')).toBe(true);
      expect(b.matches.every((m) => m.winner_entry === null)).toBe(true);

      // Every player enters exactly one Winners R1 slot; all later slots wait on Story 4.3.
      const r1 = b.matches.filter((m) => m.bracket_position === 'Winners R1');
      expect(r1).toHaveLength(size / 2);
      const seated = r1.flatMap((m) => [m.competitor_a, m.competitor_b]);
      expect(seated.filter((x) => x !== null)).toHaveLength(n);
      expect(new Set(seated).size).toBe(n);
      for (const m of b.matches) {
        if (m.bracket_position !== 'Winners R1') {
          expect(m.competitor_a).toBeNull();
          expect(m.competitor_b).toBeNull();
        }
      }
    },
  );

  it('an 8-player R1 seats the canonical 1v8 / 4v5 / 2v7 / 3v6 pairings', () => {
    const b = ok(8); // identity rng => entry 101 is seed 1, 102 is seed 2, … 108 is seed 8
    const entryOf = (seed: number) => 100 + seed;
    const pairs = [
      [1, 8],
      [4, 5],
      [2, 7],
      [3, 6],
    ];
    pairs.forEach(([sa, sb], i) => {
      const m = find(b.matches, 'winners', winnersSlot(8, 1, i));
      expect(m.competitor_a).toBe(entryOf(sa));
      expect(m.competitor_b).toBe(entryOf(sb));
      expect(m.state).toBe('declared');
    });
  });
});

describe('generateBracket — byes on non-power-of-two fields (AC3)', () => {
  it.each([
    [9, 7, [1, 2, 3, 4, 5, 6, 7]],
    [11, 5, [1, 2, 3, 4, 5]],
    [13, 3, [1, 2, 3]],
    [15, 1, [1]],
  ])('N=%i: %i byes, landing on exactly the TOP seeds %j', (n, byeCount, topSeeds) => {
    const b = ok(n);
    expect(b.bracketSize).toBe(16);
    // byes = bracketSize - N, and they go to the top seeds DETERMINISTICALLY (AC3).
    expect(byeCount).toBe(16 - n);
    expect(b.byeSeeds).toEqual(topSeeds);

    // The WINNERS byes — the seeded ones AC3 is about. (The Losers bracket also carries walkovers now,
    // as the consequence of these byes; those are the LIVENESS suite's business.)
    const byes = b.matches.filter((m) => m.state === 'bye' && m.bracket === 'winners');
    expect(byes).toHaveLength(byeCount);

    for (const m of byes) {
      // A bye is a walkover: one competitor, no opponent, the present player already the winner.
      expect(m.bracket_position).toBe('Winners R1'); // seeded byes only ever exist in round 1
      expect(m.competitor_a).not.toBeNull();
      expect(m.competitor_b).toBeNull();
      expect(m.winner_entry).toBe(m.competitor_a);
    }

    // AD-9: a bye creates NO stats. The structural guarantee is that generation emits no demo and no
    // score field AT ALL — stat rows are written only by the demo parser, keyed off a demo, and a bye
    // never gets one. Pin the emitted key set exactly: if anyone ever adds a `demo_id` or a `score_a` to
    // a generated row, a stat-write path becomes reachable from a bye and THIS goes red.
    // (`expect(m).not.toHaveProperty('demo_id')` would assert nothing — the object literal never had it.)
    // `winner_to`/`loser_to` joined the payload in Story 4.3 (D1 — the persisted routing edges). They are
    // ROUTING, not results: no score, no demo, no stat-write path. The pin is what proves that.
    for (const m of b.matches) {
      expect(Object.keys(m).sort()).toEqual([
        'bracket',
        'bracket_position',
        'bracket_slot',
        'competitor_a',
        'competitor_b',
        'gf_order',
        'loser_to',
        'state',
        'winner_entry',
        'winner_to',
      ]);
    }

    // The whole field is still seated exactly once across Winners R1.
    const r1 = b.matches.filter((m) => m.bracket_position === 'Winners R1');
    const seated = r1.flatMap((m) => [m.competitor_a, m.competitor_b]).filter((x) => x !== null);
    expect(seated).toHaveLength(n);
    expect(new Set(seated).size).toBe(n);
  });

  it('N=9: each bye player is PRE-ADVANCED into their Winners R2 slot, and the one real match is 8v9', () => {
    const b = ok(9); // identity rng => seed s is entry 100+s
    const entryOf = (seed: number) => 100 + seed;

    // The only R1 pair with both seeds present is (8,9).
    const real = b.matches.filter((m) => m.bracket_position === 'Winners R1' && m.state === 'declared');
    expect(real).toHaveLength(1);
    expect(real[0].competitor_a).toBe(entryOf(8));
    expect(real[0].competitor_b).toBe(entryOf(9));
    expect(real[0].winner_entry).toBeNull();

    // Winners R2 slot 0 gets bye-seed 1 on side A and WAITS on the 8v9 winner for side B.
    const w2s0 = find(b.matches, 'winners', winnersSlot(16, 2, 0));
    expect(w2s0.competitor_a).toBe(entryOf(1));
    expect(w2s0.competitor_b).toBeNull();
    expect(w2s0.state).toBe('declared');

    // The other three Winners R2 matches are fed by TWO byes each, so they are already fully seated —
    // a legitimate and expected consequence of a 7-bye field, and they stay 'declared' (real matches).
    for (const [slotIdx, sa, sb] of [
      [1, 4, 5],
      [2, 2, 7],
      [3, 3, 6],
    ] as const) {
      const m = find(b.matches, 'winners', winnersSlot(16, 2, slotIdx));
      expect(m.competitor_a).toBe(entryOf(sa));
      expect(m.competitor_b).toBe(entryOf(sb));
      expect(m.state).toBe('declared');
      expect(m.winner_entry).toBeNull();
    }

    // No PLAYER is placed outside Winners: every Losers competitor is the loser of a match nobody has
    // played yet, so those slots are necessarily still empty and Story 4.3 fills them.
    for (const m of b.matches) {
      if (m.bracket !== 'winners') {
        expect(m.competitor_a).toBeNull();
        expect(m.competitor_b).toBeNull();
        expect(m.winner_entry).toBeNull();
      }
    }

    // …but their STATE is decided here, and that is the whole point. With 7 byes only ONE Winners-R1
    // match (8v9) can produce a loser, so almost the entire Losers bracket is walkovers and voids.
    // The earlier version of this test asserted the losers bracket "stays empty for 4.3" and stopped —
    // which is exactly how a bracket that could never reach its Grand Final passed a green suite.
    const lb = b.matches.filter((m) => m.bracket === 'losers');
    expect(lb.filter((m) => m.state === 'void').length).toBeGreaterThan(0);
    expect(lb.filter((m) => m.state === 'bye').length).toBeGreaterThan(0);
    // LB R1 has 4 nodes fed by the 8 Winners-R1 matches. Only m0 (the 8v9 match) yields a loser, so
    // exactly one LB-R1 node is a one-competitor walkover and the other three can never be contested.
    const lbR1 = [0, 1, 2, 3].map((i) => find(b.matches, 'losers', losersSlot(16, 1, i)));
    expect(lbR1.filter((m) => m.state === 'bye')).toHaveLength(1);
    expect(lbR1.filter((m) => m.state === 'void')).toHaveLength(3);
  });

  it('emits a unique (bracket, slot, gf_order) for every row — the tables UNIQUE index cannot fire', () => {
    for (const n of [8, 9, 11, 13, 16]) {
      const b = ok(n, seededRng(n));
      const keys = b.matches.map((m) => `${m.bracket}:${m.bracket_slot}:${m.gf_order ?? 0}`);
      expect(new Set(keys).size, `N=${n}`).toBe(b.matches.length);
    }
  });
});

// ── The PERSISTED routing edges (Story 4.3, D1) ─────────────────────────────
//
// The advance runs inside Story 4.6's Aprobar TRANSACTION, so plpgsql has to know where a winner goes
// without calling back out to TypeScript — hence the edges are emitted here and stored on `match`
// (migration 0013). These tests exist to keep that mapping HONEST, and they assert VALUES, not shapes:
// the 4.1 review's headline lesson was that a suite asserting shape/counts stays green through a broken
// payload. `match_routing_complete` (0013) enforces the same structure at the DB; this is the layer that
// proves the structure is also CORRECT.

const edgeKey = (e: EdgeRef) => `${e.bracket}:${e.slot}:${e.gf_order ?? 0}:${e.side}`;

describe('routing EDGES on every emitted row (Story 4.3 D1 — persisted, never re-derived in SQL)', () => {
  it.each([[8], [16]])(
    'bracketSize %i: winners rows carry BOTH edges, losers rows carry a winner edge and NO loser edge, the GF carries neither',
    (size) => {
      const b = ok(size, seededRng(size));

      for (const m of b.matches) {
        if (m.bracket === 'winners') {
          // Both. The loser edge is what fills the Losers bracket — without it the LB never receives
          // anybody, the GF's side B never fills, and NO tournament can complete.
          expect(m.winner_to, `winners slot ${m.bracket_slot}`).not.toBeNull();
          expect(m.loser_to, `winners slot ${m.bracket_slot}`).not.toBeNull();
        } else if (m.bracket === 'losers') {
          expect(m.winner_to, `losers slot ${m.bracket_slot}`).not.toBeNull();
          // The ABSENCE *is* two-loss elimination (FR-6) — a Losers loser is out. Assert the absence, or
          // it is not proven.
          expect(m.loser_to, `losers slot ${m.bracket_slot}`).toBeNull();
        } else {
          // The champion goes nowhere; the runner-up goes nowhere.
          expect(m.winner_to).toBeNull();
          expect(m.loser_to).toBeNull();
        }
      }
    },
  );

  it.each([[8], [16]])(
    'bracketSize %i: every edge is EXACTLY the routing function that owns it (values, not merely keys)',
    (size) => {
      const b = ok(size, seededRng(size));

      for (let r = 1; r <= winnersRoundCount(size); r++) {
        for (let i = 0; i < winnersRoundSize(size, r); i++) {
          const m = find(b.matches, 'winners', winnersSlot(size, r, i));
          const w: Edge = winnersWinnerTarget(size, r, i);
          const l: Edge = winnersLoserTarget(size, r, i);
          expect(m.winner_to, `W R${r}m${i} winner`).toEqual({
            bracket: w.bracket,
            slot: w.slot,
            gf_order: w.gfOrder,
            side: w.side,
          });
          expect(m.loser_to, `W R${r}m${i} loser`).toEqual({
            bracket: l.bracket,
            slot: l.slot,
            gf_order: l.gfOrder,
            side: l.side,
          });
        }
      }

      for (let r = 1; r <= losersRoundCount(size); r++) {
        for (let i = 0; i < losersRoundSize(size, r); i++) {
          const m = find(b.matches, 'losers', losersSlot(size, r, i));
          const w: Edge = losersWinnerTarget(size, r, i);
          expect(m.winner_to, `L R${r}m${i} winner`).toEqual({
            bracket: w.bracket,
            slot: w.slot,
            gf_order: w.gfOrder,
            side: w.side,
          });
        }
      }
    },
  );

  it.each([[8], [16]])(
    'bracketSize %i: the two finals converge on the Grand Final — Winners Final -> side A, Losers Final -> side B',
    (size) => {
      const b = ok(size, seededRng(size));

      const wf = find(b.matches, 'winners', winnersSlot(size, winnersRoundCount(size), 0));
      expect(wf.winner_to).toEqual({ bracket: 'grand_final', slot: 0, gf_order: 1, side: 'a' });

      const lf = find(b.matches, 'losers', losersSlot(size, losersRoundCount(size), 0));
      expect(lf.winner_to).toEqual({ bracket: 'grand_final', slot: 0, gf_order: 1, side: 'b' });
    },
  );

  // ⭐ THE EDGES MUST BE A FIXPOINT OF THE SKELETON. A dangling edge would commit a bracket that
  // `advance_match` can only ever RAISE on — and `match` has no DELETE grant, so it would be
  // unrecoverable. A DUPLICATED destination (row, side) means two players routed into ONE seat.
  it.each([[8], [9], [10], [11], [12], [13], [14], [15], [16]])(
    'N=%i: every edge target resolves to a row that EXISTS, and no two edges share a destination seat',
    (n) => {
      const b = ok(n, seededRng(n));
      const rows = new Set(b.matches.map((m) => `${m.bracket}:${m.bracket_slot}:${m.gf_order ?? 0}`));
      const seats = new Map<string, string>();

      for (const m of b.matches) {
        const from = `${m.bracket}:${m.bracket_slot}`;
        for (const [kind, e] of [
          ['winner', m.winner_to],
          ['loser', m.loser_to],
        ] as const) {
          if (!e) continue;

          expect(rows.has(`${e.bracket}:${e.slot}:${e.gf_order ?? 0}`), `${from} ${kind} -> ${edgeKey(e)}`).toBe(true);

          const seat = edgeKey(e);
          expect(seats.has(seat), `${from} ${kind} collides with ${seats.get(seat)} on seat ${seat}`).toBe(false);
          seats.set(seat, `${from}:${kind}`);
        }
      }
    },
  );

  // The gf_order guard mirrors the table's own (0013 match_*_edge_gf_order): an edge carries a gf_order
  // IFF it targets the grand final. An edge to ('grand_final', 0, NULL) would resolve through
  // coalesce(gf_order,0)=0 and match NOTHING — the bracket would dead-end at the final.
  it.each([[8], [11], [16]])('N=%i: gf_order is set on an edge exactly when it targets the grand final', (n) => {
    const b = ok(n, seededRng(n));
    for (const m of b.matches) {
      for (const e of [m.winner_to, m.loser_to]) {
        if (!e) continue;
        expect(e.gf_order === null, `edge ${edgeKey(e)}`).toBe(e.bracket !== 'grand_final');
      }
    }
  });
});

// ── The atomic command (D2) ─────────────────────────────────────────────────

/**
 * The lib/roster.test.ts chainable+thenable builder mock, extended with the `.rpc()` seam the Dev Notes
 * call for (`generate_bracket` is the app's first RPC, so the roster mock could not reach it).
 */
function makeAdmin(
  plan: Record<string, Array<{ data?: unknown; error?: unknown }>> = {},
  rpcResult: { data?: unknown; error?: unknown } = { data: { ok: true }, error: null },
) {
  const queues: Record<string, Array<{ data?: unknown; error?: unknown }>> = {};
  for (const [t, rs] of Object.entries(plan)) queues[t] = [...rs];

  // Every `.eq(col, val)` a caller chains, per table — so a test can assert the FILTER, not merely that
  // the table was touched. Without this the builder swallows its arguments and a test that means to pin
  // `.eq('status','active')` can only ever assert `from('roster_entry')` was called, which would stay
  // green if the filter were deleted outright.
  const filters: Record<string, Array<[string, unknown]>> = {};

  function makeBuilder(table: string, result: { data?: unknown; error?: unknown }) {
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.eq = (col: string, val: unknown) => {
      (filters[table] ??= []).push([col, val]);
      return builder;
    };
    builder.maybeSingle = () => Promise.resolve(result);
    builder.then = (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(onF, onR);
    return builder;
  }

  const from = vi.fn((table: string) => {
    const q = queues[table];
    return makeBuilder(table, q && q.length ? q.shift()! : { data: null, error: null });
  });
  // Typed params (rather than `vi.fn(() => …)`) so `rpc.mock.calls[0]` is a real [fn, args] tuple —
  // that is what lets the happy-path test assert the exact RPC payload instead of just the call count.
  const rpc = vi.fn((_fn: string, _args: Record<string, unknown>) => Promise.resolve(rpcResult));
  const admin = { from, rpc } as unknown as SupabaseClient;
  return { admin, from, rpc, filters };
}

const closedTournament = [{ data: { state: 'registration_closed' }, error: null }];
const activeRoster = (n: number) => [{ data: roster(n), error: null }];
/** The RPC's success reply. The lib reports the DB's committed counts, so the mock must supply them. */
const rpcOk = (fieldSize: number, bracketSize: number, matchCount: number) => ({
  data: { ok: true, field_size: fieldSize, bracket_size: bracketSize, match_count: matchCount },
  error: null,
});

describe('generateAndPersistBracket — the atomic admin command (D2)', () => {
  it('generates from the closed roster and hands the whole bracket to the RPC in ONE call', async () => {
    const { admin, rpc } = makeAdmin(
      { tournament: closedTournament, roster_entry: activeRoster(8) },
      rpcOk(8, 8, 14),
    );

    const result = await generateAndPersistBracket(admin, {
      actingAdmin: ADMIN,
      tournamentId: T_ID,
      rng: identityRng,
    });
    expect(result).toEqual({ ok: true, fieldSize: 8, bracketSize: 8, matchCount: 14, byeSeeds: [] });

    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe('generate_bracket');
    expect(args.p_tournament_id).toBe(T_ID);
    expect(args.p_actor_steamid64).toBe(ADMIN); // the audit row's actor, inside the txn
    expect(args.p_seeds).toHaveLength(8);
    expect(args.p_matches).toHaveLength(14); // 7 winners + 6 losers + 1 GF — the COMPLETE skeleton
    expect(args.p_bracket_seed).toMatchObject({ algorithm: 'fisher-yates', field_size: 8, bracket_size: 8 });
  });

  it('refuses a field outside 8..16 BEFORE touching the DB (no partial write is even attempted)', async () => {
    const { admin, rpc } = makeAdmin({ tournament: closedTournament, roster_entry: activeRoster(3) });
    const result = await generateAndPersistBracket(admin, { actingAdmin: ADMIN, tournamentId: T_ID });
    expect(result).toEqual({ ok: false, reason: 'bad_field_count' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['bracket_live', 'already_live'], // single-shot: a second generate is REFUSED, never duplicated
    ['registration_open', 'not_closed'],
    ['ceremony', 'not_closed'],
  ])('early-exits on tournament.state=%s with %s, without generating', async (state, reason) => {
    const { admin, rpc } = makeAdmin({ tournament: [{ data: { state }, error: null }] });
    const result = await generateAndPersistBracket(admin, { actingAdmin: ADMIN, tournamentId: T_ID });
    expect(result).toEqual({ ok: false, reason });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns bad_tournament when the event does not exist', async () => {
    const { admin, rpc } = makeAdmin({ tournament: [{ data: null, error: null }] });
    const result = await generateAndPersistBracket(admin, { actingAdmin: ADMIN, tournamentId: 999 });
    expect(result).toEqual({ ok: false, reason: 'bad_tournament' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('surfaces the RPCs roster_changed refusal (a roster write raced our read — optimistic concurrency)', async () => {
    const { admin } = makeAdmin(
      { tournament: closedTournament, roster_entry: activeRoster(8) },
      { data: { ok: false, reason: 'roster_changed' }, error: null },
    );
    const result = await generateAndPersistBracket(admin, {
      actingAdmin: ADMIN,
      tournamentId: T_ID,
      rng: identityRng,
    });
    expect(result).toEqual({ ok: false, reason: 'roster_changed' });
  });

  it('surfaces the RPCs already_live refusal even when our early read said otherwise (the RPC is the authority)', async () => {
    // The early read is UX only. If a concurrent generate committed between our read and the RPC's
    // FOR UPDATE lock, the RPC is what refuses — and that refusal must win.
    const { admin } = makeAdmin(
      { tournament: closedTournament, roster_entry: activeRoster(8) },
      { data: { ok: false, reason: 'already_live' }, error: null },
    );
    const result = await generateAndPersistBracket(admin, {
      actingAdmin: ADMIN,
      tournamentId: T_ID,
      rng: identityRng,
    });
    expect(result).toEqual({ ok: false, reason: 'already_live' });
  });

  it('fails CLOSED on an RPC error, and on an unrecognised refusal reason', async () => {
    const boom = makeAdmin(
      { tournament: closedTournament, roster_entry: activeRoster(8) },
      { data: null, error: { message: 'deadlock detected' } },
    );
    await expect(
      generateAndPersistBracket(boom.admin, { actingAdmin: ADMIN, tournamentId: T_ID, rng: identityRng }),
    ).resolves.toEqual({ ok: false, reason: 'write_failed' });

    // An unknown reason string must never be mistaken for success (fail-closed, never a silent no-op).
    const weird = makeAdmin(
      { tournament: closedTournament, roster_entry: activeRoster(8) },
      { data: { ok: false, reason: 'something_new' }, error: null },
    );
    await expect(
      generateAndPersistBracket(weird.admin, { actingAdmin: ADMIN, tournamentId: T_ID, rng: identityRng }),
    ).resolves.toEqual({ ok: false, reason: 'write_failed' });
  });

  it('seeds ONLY the active roster (a soft-removed player is never drawn)', async () => {
    // The lib filters status='active'; a removed player keeps bracket_seed NULL. Assert the FILTER is
    // genuinely applied to the roster read — deleting `.eq('status','active')` must turn this test red,
    // because an unfiltered read would silently draw soft-removed players into the bracket.
    const { admin, from, filters } = makeAdmin(
      { tournament: closedTournament, roster_entry: activeRoster(8) },
      rpcOk(8, 8, 14),
    );
    await generateAndPersistBracket(admin, { actingAdmin: ADMIN, tournamentId: T_ID, rng: identityRng });

    expect(from).toHaveBeenCalledWith('roster_entry');
    expect(filters.roster_entry).toEqual([
      ['tournament_id', T_ID],
      ['status', 'active'],
    ]);
  });

  it('reports the DATABASE committed counts, never the locally-computed array length', async () => {
    // The RPC returns match_count from GET DIAGNOSTICS ROW_COUNT — what actually landed. If the lib
    // reported `matches.length` instead, a short insert (or any divergence between what we computed and
    // what committed) would be invisible to the caller BY CONSTRUCTION. Here the RPC deliberately reports
    // counts that differ from the local computation, and the lib must surface the RPC's.
    const { admin } = makeAdmin(
      { tournament: closedTournament, roster_entry: activeRoster(8) },
      rpcOk(8, 8, 13), // the DB says 13 landed, though we computed 14
    );
    const result = await generateAndPersistBracket(admin, {
      actingAdmin: ADMIN,
      tournamentId: T_ID,
      rng: identityRng,
    });
    expect(result).toEqual({ ok: true, fieldSize: 8, bracketSize: 8, matchCount: 13, byeSeeds: [] });
  });

  it('fails CLOSED if the RPC reports ok WITHOUT the committed counts', async () => {
    // Never silently substitute our own numbers for the ones the DB failed to report.
    const { admin } = makeAdmin(
      { tournament: closedTournament, roster_entry: activeRoster(8) },
      { data: { ok: true }, error: null },
    );
    await expect(
      generateAndPersistBracket(admin, { actingAdmin: ADMIN, tournamentId: T_ID, rng: identityRng }),
    ).resolves.toEqual({ ok: false, reason: 'write_failed' });
  });

  it.each([['bad_seeds'], ['bad_skeleton']])(
    'surfaces the RPCs %s payload refusal (the DB does not trust what it is handed)',
    async (reason) => {
      const { admin } = makeAdmin(
        { tournament: closedTournament, roster_entry: activeRoster(8) },
        { data: { ok: false, reason }, error: null },
      );
      await expect(
        generateAndPersistBracket(admin, { actingAdmin: ADMIN, tournamentId: T_ID, rng: identityRng }),
      ).resolves.toEqual({ ok: false, reason });
    },
  );
});
