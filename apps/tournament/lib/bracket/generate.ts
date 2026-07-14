import 'server-only';
import { randomInt } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Double-elimination bracket generation (Story 4.1, AC1/AC2/AC3 + D2).
 *
 * TWO layers live here, mirroring `lib/roster.ts`'s "domain module" shape:
 *
 *   1. `generateBracket(entries, rng)` — a PURE, deterministic function: shuffle the closed roster
 *      with an INJECTED rng, assign seed positions 1..N, and build the COMPLETE match skeleton
 *      (full Winners + full Losers + the single Grand-Final row). No I/O, no clock, no globals — so
 *      the whole double-elim routing is exhaustively Vitest-testable with a stub rng.
 *
 *   2. `generateAndPersistBracket(admin, …)` — the ATOMIC admin command: read the active roster,
 *      compute (1), then hand the result to the `generate_bracket` RPC which commits every write in
 *      ONE transaction (migration 0011). `supabase-js` cannot do multi-statement transactions and a
 *      half-built bracket is not recoverable by retry, so the RPC is genuinely required (AD-6).
 *      ⭐ This is the first atomic admin transaction in the app — Story 4.6 (Aprobar) reuses the shape.
 *
 * SEEDING / AD-13. The bracket draw is OS entropy (`node:crypto`), lives on `roster_entry.bracket_seed`
 * as the seed POSITION 1..N, and is *structurally* distinct from `tournament.fair_seed` (= SHA-256 of
 * the final demo, Epic 6). They are never derived from one another. The positions are the reproducible
 * artifact: the entire bracket — pairings, byes, routing — is a pure function of them, which is exactly
 * what `generateBracket` being pure means. The raw draw is additionally recorded in the
 * `generate_bracket` audit row's `detail` for traceability (AD-17), not because reproduction needs it.
 *
 * OUT OF SCOPE (each has an owning story — do not add here):
 *   * the idempotent conditional advance on a RESULT -> Story 4.3. 4.1 performs only the STRUCTURAL
 *     advance at generation, using the same "write into the target slot" shape 4.3 generalizes.
 *     The routing functions below are exported precisely so 4.3 consumes them rather than re-deriving.
 *
 *     ⭐ THE CONTRACT 4.3 MUST HONOUR: a bye has no loser, so on a non-power-of-two field some Losers
 *     nodes can only ever receive ONE competitor (`state='bye'`, a walkover) and some can receive NONE
 *     (`state='void'`). Generation marks both — see the propagation block in `generateBracket`. When 4.3
 *     places a player into a Losers node already marked `'bye'`, it MUST advance them straight through
 *     it (that match is won, unplayed) instead of waiting for an opponent who can never arrive; a
 *     `'void'` node is never played and never advances anyone. Without that, the Losers bracket stalls.
 *   * the Grand-Final RESET row (gf_order=2) -> Story 4.4. 4.1 emits only gf_order=1.
 *   * format/tie_policy (4.2), forfeit + grace timer (4.5), scores/Aprobar (4.6), rollback (4.7).
 */

// ── Field bounds (AC1) ──────────────────────────────────────────────────────
export const MIN_FIELD = 8;
export const MAX_FIELD = 16;

/**
 * Injected randomness: returns a uniform integer in [0, maxExclusive). The default draws from OS
 * entropy via `node:crypto.randomInt` (which rejection-samples internally, so it is unbiased — a
 * plain `Math.floor(Math.random()*n)` is both biased and not cryptographic). Tests inject a stub.
 */
export type Rng = (maxExclusive: number) => number;

const cryptoRng: Rng = (maxExclusive) => randomInt(maxExclusive);

export interface RosterEntryRef {
  /** roster_entry.id — the seeded entry. Matches join the ROSTER, never `player` (AD-4). */
  id: number;
}

/** One drawn seat: which roster entry drew which seed position (1..N). Persisted to roster_entry.bracket_seed. */
export interface SeedAssignment {
  roster_entry_id: number;
  seed: number;
}

export type BracketName = 'winners' | 'losers' | 'grand_final';

/**
 * The states generation itself can emit. Everything else is a later story's transition.
 *
 *   'declared' — a real match: two competitors can reach it.
 *   'bye'      — a WALKOVER: only one competitor can ever reach it, so it is won without being played.
 *                In Winners R1 that player is known now (an absent seed) and is pre-advanced. In the
 *                Losers bracket the player is the loser of a match not yet played, so the row is marked
 *                and left with NULL competitors — Story 4.3 advances straight through it on arrival.
 *   'void'     — NOTHING can ever reach it: both of its feeders were byes, so neither produced a loser.
 *                It is never played and produces no winner. Only reachable on a non-power-of-two field.
 */
export type GeneratedMatchState = 'declared' | 'bye' | 'void';

/**
 * A routing EDGE, in the jsonb shape the `generate_bracket` RPC reads into match.winner_to_* /
 * loser_to_* (migration 0013, D1). It is the `Edge` type below in snake_case — a MAPPING of the routing,
 * never a second definition of it.
 *
 * ⭐ WHY THE EDGES ARE PERSISTED AT ALL. Story 4.3's advance runs INSIDE Story 4.6's Aprobar transaction
 * (SOLUTION-DESIGN §8), and a plpgsql transaction cannot call back out to TypeScript to ask where a
 * winner goes — so the DB has to know. The alternative was porting `index ^ 1` into plpgsql, which would
 * give the routing a SECOND implementation, in the layer nobody unit-tests. These fields exist so that
 * cannot happen: the routing is computed exactly once, here, by the functions below.
 */
export interface EdgeRef {
  bracket: BracketName;
  slot: number;
  gf_order: number | null;
  side: 'a' | 'b';
}

/** A `match` row as generation emits it (the RPC inserts these verbatim under `p_matches`). */
export interface MatchRow {
  bracket: BracketName;
  bracket_position: string;
  bracket_slot: number;
  gf_order: number | null;
  competitor_a: number | null;
  competitor_b: number | null;
  winner_entry: number | null;
  state: GeneratedMatchState;
  /** Where this row's WINNER goes. NULL only on the grand-final row — its winner is the champion. */
  winner_to: EdgeRef | null;
  /**
   * Where this row's LOSER drops. NULL on a `losers` row — and that ABSENCE *is* two-loss elimination
   * (FR-6): a Losers loser has already lost once, so there is nowhere below to drop to. NULL on the
   * grand-final row too (its loser is the runner-up).
   */
  loser_to: EdgeRef | null;
}

/** The raw draw, recorded in the audit row's `detail` for traceability (AD-17). */
export interface DrawRecord {
  algorithm: 'fisher-yates';
  field_size: number;
  bracket_size: number;
  bye_seeds: number[];
  draw: SeedAssignment[];
}

export interface GeneratedBracket {
  fieldSize: number;
  bracketSize: number;
  /** The seed positions that received a bye — always the TOP `bracketSize - N` seeds (AC3). */
  byeSeeds: number[];
  seeds: SeedAssignment[];
  matches: MatchRow[];
  draw: DrawRecord;
}

export type GenerateResult =
  | { ok: true; bracket: GeneratedBracket }
  | { ok: false; reason: 'bad_field_count' };

// ── Structure: sizes and slot numbering ─────────────────────────────────────
// `bracket_slot` is a 0-based index that is unique WITHIN a bracket (the table's
// UNIQUE(tournament_id, bracket, bracket_slot, coalesce(gf_order,0))). Winners and Losers each number
// their rounds consecutively from 0; the Grand Final is the single slot 0 of its own bracket.

/** The smallest power of two >= n. 8 -> 8; 9..16 -> 16. */
export function nextPowerOfTwo(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

/** log2 of a power of two. */
function log2(size: number): number {
  return Math.round(Math.log2(size));
}

/** Winners rounds: 3 for an 8-bracket, 4 for a 16-bracket. The last one is the Winners Final. */
export function winnersRoundCount(bracketSize: number): number {
  return log2(bracketSize);
}

/** Matches in Winners round r (1-based): bracketSize/2^r. Totals bracketSize-1 across all rounds. */
export function winnersRoundSize(bracketSize: number, round: number): number {
  return bracketSize / 2 ** round;
}

/** Losers rounds: 2*(k-1) — 4 for an 8-bracket, 6 for a 16-bracket. Odd = minor, even = major. */
export function losersRoundCount(bracketSize: number): number {
  return 2 * (log2(bracketSize) - 1);
}

/**
 * Matches in Losers round `round` (1-based). The losers bracket alternates:
 *   MINOR (odd, 2j-1): the LB survivors play each other.
 *   MAJOR (even, 2j):  the LB survivors meet that round's fresh Winners dropdowns.
 * Both rounds of a pair j have the same width, 2^(k-1-j), so the bracket halves every TWO rounds.
 * Totals bracketSize-2 (6 for an 8-bracket, 14 for a 16-bracket).
 */
export function losersRoundSize(bracketSize: number, round: number): number {
  const k = log2(bracketSize);
  const j = Math.ceil(round / 2);
  return 2 ** (k - 1 - j);
}

/** The 0-based slot of Winners round `round`, match `index`. */
export function winnersSlot(bracketSize: number, round: number, index: number): number {
  let offset = 0;
  for (let r = 1; r < round; r++) offset += winnersRoundSize(bracketSize, r);
  return offset + index;
}

/** The 0-based slot of Losers round `round`, match `index`. */
export function losersSlot(bracketSize: number, round: number, index: number): number {
  let offset = 0;
  for (let r = 1; r < round; r++) offset += losersRoundSize(bracketSize, r);
  return offset + index;
}

/** The inverse of `losersSlot`: which (round, index) a Losers slot denotes. */
export function losersRoundOf(bracketSize: number, slot: number): { round: number; index: number } {
  let offset = 0;
  for (let r = 1; r <= losersRoundCount(bracketSize); r++) {
    const width = losersRoundSize(bracketSize, r);
    if (slot < offset + width) return { round: r, index: slot - offset };
    offset += width;
  }
  throw new RangeError(`losersRoundOf: slot ${slot} is outside a ${bracketSize}-bracket`);
}

// ── Routing: the bracket EDGES (exported — Story 4.3's advance consumes these) ──
// Two-loss elimination is DERIVED from these edges, never stored as a flag (FR-6, §7 L359): a Winners
// loser has a losers-drop edge (first loss); a Losers loser has NONE (second loss = eliminated).

/** A destination competitor slot: which match, and which side of it. */
export interface Edge {
  bracket: BracketName;
  slot: number;
  side: 'a' | 'b';
  gfOrder: number | null;
}

/**
 * Project an `Edge` into the persisted `EdgeRef` shape (D1). A pure rename of `gfOrder` -> `gf_order` to
 * match the column names the RPC reads — deliberately NOT a place where routing is decided.
 */
const edgeRef = (e: Edge): EdgeRef => ({
  bracket: e.bracket,
  slot: e.slot,
  gf_order: e.gfOrder,
  side: e.side,
});

/** Where the WINNER of Winners round `round`, match `index` goes. The Winners Final winner takes GF side A. */
export function winnersWinnerTarget(bracketSize: number, round: number, index: number): Edge {
  if (round < winnersRoundCount(bracketSize)) {
    return {
      bracket: 'winners',
      slot: winnersSlot(bracketSize, round + 1, index >> 1),
      side: index % 2 === 0 ? 'a' : 'b',
      gfOrder: null,
    };
  }
  return { bracket: 'grand_final', slot: 0, side: 'a', gfOrder: 1 };
}

/**
 * Where the LOSER of Winners round `round`, match `index` DROPS (their first loss).
 *
 *   Round 1 losers fill the LB's first minor round two-per-match (they have never met, so no rematch).
 *   Round r>=2 losers drop into LB MAJOR round 2*(r-1), on side 'b' (the dropdown side).
 *
 * The major-round dropdown index is CROSSED by an adjacent-pair swap (`index ^ 1`). The crossover is
 * load-bearing and this is the RIGHT one: Winners match `m` of round r is contested by the winners of
 * Winners matches 2m/2m+1, whose losers already sit in LB block `m`. Dropping straight down (index `m`)
 * would pair a player against someone they JUST beat, so the index must move.
 *
 * ⚠ It must move by a swap, NOT by a full reversal (`count-1-index`). A full reversal is rematch-free at
 * the FIRST major round, which is the only round its symmetry argument covers — but it destroys the block
 * confinement of the following minor round, and in a 16-bracket the loser of Winners-R2 match m then meets
 * the very player who knocked them down again in LB R4. `index ^ 1` keeps each LB block inside one Winners
 * half, so every later major round stays disjoint. (The two agree whenever count===2 — so the 8-bracket is
 * unchanged — and `count===1` is the final major round, where the Winners-Final loser meets the LB
 * survivor: a rematch there is legitimate and structurally unavoidable.)
 */
export function winnersLoserTarget(bracketSize: number, round: number, index: number): Edge {
  if (round === 1) {
    return {
      bracket: 'losers',
      slot: losersSlot(bracketSize, 1, index >> 1),
      side: index % 2 === 0 ? 'a' : 'b',
      gfOrder: null,
    };
  }
  const lbRound = 2 * (round - 1);
  const count = losersRoundSize(bracketSize, lbRound);
  return {
    bracket: 'losers',
    slot: losersSlot(bracketSize, lbRound, count === 1 ? 0 : index ^ 1),
    side: 'b',
    gfOrder: null,
  };
}

/**
 * Where the WINNER of Losers round `round`, match `index` goes. A losers LOSER goes nowhere — that is
 * the second loss, and elimination is read off the ABSENCE of an edge here (FR-6).
 *
 *   MINOR (odd) winner  -> the SAME index of the next (major) round, side 'a' (the survivor side).
 *   MAJOR (even) winner -> pairs up into the next (minor) round, sides a/b.
 *   The FINAL losers round's winner -> Grand Final, side B.
 */
export function losersWinnerTarget(bracketSize: number, round: number, index: number): Edge {
  if (round === losersRoundCount(bracketSize)) {
    return { bracket: 'grand_final', slot: 0, side: 'b', gfOrder: 1 };
  }
  if (round % 2 === 1) {
    return {
      bracket: 'losers',
      slot: losersSlot(bracketSize, round + 1, index),
      side: 'a',
      gfOrder: null,
    };
  }
  return {
    bracket: 'losers',
    slot: losersSlot(bracketSize, round + 1, index >> 1),
    side: index % 2 === 0 ? 'a' : 'b',
    gfOrder: null,
  };
}

// ── Seeding ─────────────────────────────────────────────────────────────────

/**
 * The standard single-elimination seeding order for a bracket of `size`, as a flat list of seed
 * numbers in Winners-R1 slot order: consecutive PAIRS are the R1 matches.
 *
 *   size 8  -> [1,8, 4,5, 2,7, 3,6]  i.e. 1v8, 4v5, 2v7, 3v6 (so 1 and 2 can only meet in the final)
 *
 * Built by the classic reflection: each round doubles the list, mapping every seed p to the pair
 * (p, sum-p) where sum = 2^(i+1)+1. Two properties fall out and BOTH are load-bearing here:
 *   (a) the first element of every pair is always the STRONGER (lower) seed — so in a bye match the
 *       present player is always `competitor_a` and the absent one always `competitor_b`;
 *   (b) seed k always faces seed size+1-k in R1 — so when the field is short by `size-N`, the ABSENT
 *       seeds (N+1..size) are precisely the R1 opponents of seeds 1..(size-N). The byes therefore land
 *       on the TOP seeds deterministically (AC3) with no special-casing at all: it is a consequence of
 *       standard seeding, not a rule bolted on top.
 */
export function seedOrder(size: number): number[] {
  let order = [1, 2];
  for (let i = 1; i < log2(size); i++) {
    const sum = 2 ** (i + 1) + 1;
    const next: number[] = [];
    for (const p of order) {
      next.push(p, sum - p);
    }
    order = next;
  }
  return order;
}

/** Unbiased Fisher–Yates using the injected rng. Returns a new array; the input is not mutated. */
function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── Generation (AC1, AC2, AC3) ──────────────────────────────────────────────

const key = (bracket: BracketName, slot: number, gfOrder: number | null) =>
  `${bracket}:${slot}:${gfOrder ?? 0}`;

/**
 * Draw the bracket. PURE: identical `entries` + identical `rng` sequence => byte-identical output.
 *
 * Emits the COMPLETE skeleton — every Winners row, every Losers row, and the single Grand-Final row —
 * with only the Winners-R1 competitors filled (from the draw) plus any bye winners pre-advanced into
 * Winners R2. Every other competitor slot is NULL and is filled by Story 4.3's advance as results land.
 */
export function generateBracket(entries: readonly RosterEntryRef[], rng: Rng = cryptoRng): GenerateResult {
  const fieldSize = entries.length;
  if (fieldSize < MIN_FIELD || fieldSize > MAX_FIELD) {
    return { ok: false, reason: 'bad_field_count' };
  }

  const bracketSize = nextPowerOfTwo(fieldSize);
  const wRounds = winnersRoundCount(bracketSize);
  const lRounds = losersRoundCount(bracketSize);

  // AC1 — the draw. Shuffle the field, then hand out seed positions 1..N in the shuffled order.
  const drawn = shuffle(entries, rng);
  const seeds: SeedAssignment[] = drawn.map((e, i) => ({ roster_entry_id: e.id, seed: i + 1 }));
  const entryOfSeed = new Map<number, number>(seeds.map((s) => [s.seed, s.roster_entry_id]));

  // ── Build the full skeleton first; fill competitors afterwards. ────────────
  const rows = new Map<string, MatchRow>();
  const add = (
    bracket: BracketName,
    position: string,
    slot: number,
    gfOrder: number | null,
    winnerTo: EdgeRef | null,
    loserTo: EdgeRef | null,
  ) => {
    rows.set(key(bracket, slot, gfOrder), {
      bracket,
      bracket_position: position,
      bracket_slot: slot,
      gf_order: gfOrder,
      competitor_a: null,
      competitor_b: null,
      winner_entry: null,
      state: 'declared',
      winner_to: winnerTo,
      loser_to: loserTo,
    });
  };

  // ⭐ D1 — the edges are PERSISTED, and they are computed HERE, by the routing functions above and by
  // nothing else. Story 4.3's advance follows these pointers instead of re-deriving the routing in
  // plpgsql. If you ever feel the need to write `index ^ 1` or `losersSlot(...)` again below this line,
  // stop: the routing must have exactly one implementation, or the DB's copy is the one nobody tests.
  for (let r = 1; r <= wRounds; r++) {
    for (let i = 0; i < winnersRoundSize(bracketSize, r); i++) {
      add(
        'winners',
        `Winners R${r}`,
        winnersSlot(bracketSize, r, i),
        null,
        edgeRef(winnersWinnerTarget(bracketSize, r, i)),
        // EVERY winners row drops its loser — that is what fills the Losers bracket, and without it no
        // tournament can ever complete.
        edgeRef(winnersLoserTarget(bracketSize, r, i)),
      );
    }
  }
  for (let r = 1; r <= lRounds; r++) {
    for (let i = 0; i < losersRoundSize(bracketSize, r); i++) {
      add(
        'losers',
        `Losers R${r}`,
        losersSlot(bracketSize, r, i),
        null,
        edgeRef(losersWinnerTarget(bracketSize, r, i)),
        // NO loser edge: a Losers loser has taken their SECOND loss and is eliminated. The absence IS the
        // rule (FR-6) — elimination is derived from the edges, never stored as a flag.
        null,
      );
    }
  }
  // Exactly ONE grand-final row this story. The AD-21 reset row (gf_order=2) is Story 4.4's.
  // Neither edge: the winner is the CHAMPION and goes nowhere; the loser is the runner-up.
  add('grand_final', 'Grand Final', 0, 1, null, null);

  /** Write an entry into an edge's competitor slot. */
  const place = (edge: Edge, entryId: number) => {
    const row = rows.get(key(edge.bracket, edge.slot, edge.gfOrder))!;
    if (edge.side === 'a') row.competitor_a = entryId;
    else row.competitor_b = entryId;
  };

  // ── Winners R1: seat the draw, and resolve byes (AC3). ─────────────────────
  const order = seedOrder(bracketSize);
  const byeSeeds: number[] = [];
  const byeIndices = new Set<number>(); // which Winners-R1 matches are byes — the fixpoint below needs this

  for (let i = 0; i < bracketSize / 2; i++) {
    const seedA = order[2 * i];
    const seedB = order[2 * i + 1];
    const row = rows.get(key('winners', winnersSlot(bracketSize, 1, i), null))!;

    // seedA is always the stronger seed of the pair and always <= bracketSize/2 <= 8 <= N, so it ALWAYS
    // exists: with the AC1 floor of 8 players no R1 match can ever be empty. Only seedB can be absent.
    const entryA = entryOfSeed.get(seedA)!;
    const entryB = entryOfSeed.get(seedB);

    row.competitor_a = entryA;

    if (entryB === undefined) {
      // A BYE: no opponent because the field is not a power of two. The present player advances with
      // no match played and — critically — NO stat_row is ever created for this match (AD-9): a `bye`
      // never gets a demo, and stat rows are written only by the demo parser.
      row.state = 'bye';
      row.winner_entry = entryA;
      byeSeeds.push(seedA);
      byeIndices.add(i);
      place(winnersWinnerTarget(bracketSize, 1, i), entryA);
    } else {
      row.competitor_b = entryB;
    }
  }

  byeSeeds.sort((a, b) => a - b);

  // ── Propagate each bye's consequence through the Losers bracket (AC2 + AC3). ───────────────────
  //
  // THE BUG THIS EXISTS TO PREVENT. A bye produces a WINNER but *no LOSER*. The Losers slot that waits
  // on that non-existent loser is therefore fed by nothing — and if the full Losers skeleton is emitted
  // regardless, that slot stays empty forever, its match never becomes playable, and the stall cascades:
  // the Grand Final's side B never fills and NO non-power-of-two field can complete. (A single bye at
  // N=15 is enough to strand the entire Losers spine.) Story 4.3 cannot repair this — 4.3 advances on a
  // RESULT, and a bye never produces one. The consequence is a STRUCTURAL fact of the field size, fully
  // knowable here, so it is settled here.
  //
  // Walk the DAG in topological order (Winners feeds Losers; Losers round r feeds r+1) and count how
  // many competitors can EVER arrive at each Losers node:
  //
  //   arrivals = 2 -> `declared` — a real match.
  //   arrivals = 1 -> `bye`      — a WALKOVER: one feeder was a bye, so one side can never be filled.
  //   arrivals = 0 -> `void`     — BOTH feeders were byes. Nothing ever arrives; it is never played.
  //
  // A walkover still produces a winner (its lone arrival); a void produces nothing, so the shortfall
  // keeps cascading forward. Note a Losers walkover's player is NOT known here — every Losers competitor
  // is the loser of a match that has not been played — so the row is marked and left with NULL
  // competitors. Story 4.3 sees `state='bye'` when it places that player and advances straight through.
  // Only the Winners-R1 byes have a player at generation, and those are pre-advanced above.
  const lbArrivals: number[][] = [];
  for (let r = 1; r <= lRounds; r++) lbArrivals[r] = new Array(losersRoundSize(bracketSize, r)).fill(0);
  let gfArrivals = 1; // side A is the Winners champion — a Winners match always produces a winner

  const arrive = (edge: Edge) => {
    if (edge.bracket === 'grand_final') {
      gfArrivals++;
      return;
    }
    const { round, index } = losersRoundOf(bracketSize, edge.slot);
    lbArrivals[round][index]++;
  };

  // Winners losers drop in. A Winners match produces a loser iff it is NOT a bye.
  for (let r = 1; r <= wRounds; r++) {
    for (let i = 0; i < winnersRoundSize(bracketSize, r); i++) {
      if (r === 1 && byeIndices.has(i)) continue; // a bye has no loser to drop
      arrive(winnersLoserTarget(bracketSize, r, i));
    }
  }

  // Then the Losers rounds in order. Round r's arrivals are complete once r-1 has been settled, because
  // its only feeders are Winners (all counted above) and Losers round r-1.
  for (let r = 1; r <= lRounds; r++) {
    for (let i = 0; i < losersRoundSize(bracketSize, r); i++) {
      const row = rows.get(key('losers', losersSlot(bracketSize, r, i), null))!;
      const arrivals = lbArrivals[r][i];
      row.state = arrivals === 2 ? 'declared' : arrivals === 1 ? 'bye' : 'void';
      if (arrivals >= 1) arrive(losersWinnerTarget(bracketSize, r, i)); // a walkover still yields a winner
    }
  }

  // The Grand Final. Side A is always the Winners champion; side B is the Losers survivor — which exists
  // unless the Losers bracket produced nobody at all (not reachable for a field of 8..16, but the state
  // is derived rather than assumed, so a future field range cannot silently regress it).
  rows.get(key('grand_final', 0, 1))!.state = gfArrivals === 2 ? 'declared' : 'bye';

  const matches = [...rows.values()];
  return {
    ok: true,
    bracket: {
      fieldSize,
      bracketSize,
      byeSeeds,
      seeds,
      matches,
      draw: {
        algorithm: 'fisher-yates',
        field_size: fieldSize,
        bracket_size: bracketSize,
        bye_seeds: byeSeeds,
        draw: seeds,
      },
    },
  };
}

// ── The atomic admin command (D2) ───────────────────────────────────────────

export type BracketCommandResult =
  | { ok: true; fieldSize: number; bracketSize: number; matchCount: number; byeSeeds: number[] }
  | {
      ok: false;
      reason:
        | 'bad_tournament'   // no such tournament
        | 'not_closed'       // registration is still open (or the event is past the bracket)
        | 'already_live'     // single-shot: the bracket exists — a second generate is REFUSED, never duplicated
        | 'roster_changed'   // a roster write landed between our read and the RPC's lock (optimistic concurrency)
        | 'bad_field_count'  // outside the AC1 8..16 range
        | 'bad_seeds'        // p_seeds was not a permutation of 1..N (only reachable on a direct RPC call)
        | 'bad_skeleton'     // p_matches was not the complete 2*bracketSize-2 skeleton (ditto)
        | 'write_failed';
    };

/** The RPC's typed reply. `ok:false` carries the same reason strings as the union above. */
interface RpcResult {
  ok: boolean;
  reason?: string;
  match_count?: number;
  field_size?: number;
  bracket_size?: number;
}

const RPC_REASONS = new Set([
  'bad_tournament',
  'not_closed',
  'already_live',
  'roster_changed',
  'bad_field_count',
  'bad_seeds',
  'bad_skeleton',
]);

/**
 * Generate + persist the bracket in one atomic transaction (D2, AC1).
 *
 * TS computes, a thin RPC persists — the split plays to the repo's two strengths (heavily unit-tested
 * TS logic + DB-enforced invariants). The RPC is the AUTHORITY: it re-locks the tournament `FOR UPDATE`
 * and re-checks the state, the field size and the roster id-set under that lock, so the reads below are
 * FRIENDLY EARLY EXITS only (a clean 404/409 without a round-trip through a doomed transaction) — never
 * the teeth. That is the same division of labour as `requireMutableTournament` in lib/roster.ts vs the
 * roster-lock trigger: the lib is UX, the DB is truth.
 *
 * `roster_changed` is the optimistic-concurrency check: we read the roster, generate from it, then the
 * RPC asserts under the lock that the active roster is STILL exactly the set we seeded. If a concurrent
 * add/remove slipped in, the bracket we computed is stale, so it is refused rather than committed.
 */
export async function generateAndPersistBracket(
  admin: SupabaseClient,
  params: { actingAdmin: string; tournamentId: number; rng?: Rng },
): Promise<BracketCommandResult> {
  const { actingAdmin, tournamentId, rng } = params;

  // Friendly early exit (UX, not teeth — the RPC re-checks all of this under FOR UPDATE).
  const { data: tournament, error: readError } = await admin
    .from('tournament')
    .select('state')
    .eq('id', tournamentId)
    .maybeSingle();
  if (readError) return { ok: false, reason: 'write_failed' };
  if (!tournament) return { ok: false, reason: 'bad_tournament' };
  if (tournament.state === 'bracket_live') return { ok: false, reason: 'already_live' };
  if (tournament.state !== 'registration_closed') return { ok: false, reason: 'not_closed' };

  // The field: the ACTIVE roster only. A soft-removed player is not seeded (their bracket_seed stays NULL).
  const { data: roster, error: rosterError } = await admin
    .from('roster_entry')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('status', 'active');
  if (rosterError) return { ok: false, reason: 'write_failed' };

  const generated = generateBracket((roster ?? []) as RosterEntryRef[], rng);
  if (!generated.ok) return { ok: false, reason: generated.reason };
  const { seeds, matches, draw, byeSeeds } = generated.bracket;

  // One transaction: seed the roster, insert every match, flip the state, append the audit row.
  const { data, error } = await admin.rpc('generate_bracket', {
    p_tournament_id: tournamentId,
    p_actor_steamid64: actingAdmin,
    p_bracket_seed: draw,
    p_seeds: seeds,
    p_matches: matches,
  });
  if (error) {
    console.error('[generateAndPersistBracket] generate_bracket RPC failed:', error.message);
    return { ok: false, reason: 'write_failed' };
  }

  const result = data as RpcResult | null;
  if (!result?.ok) {
    const reason = result?.reason;
    // Fail closed: an unrecognised refusal is a write failure, never a silent success.
    if (reason && RPC_REASONS.has(reason)) {
      return { ok: false, reason: reason as Exclude<BracketCommandResult, { ok: true }>['reason'] };
    }
    return { ok: false, reason: 'write_failed' };
  }

  // Report what the DATABASE committed, not what we computed. `matches.length` would be the local
  // array's own length — so any divergence between what was generated and what actually landed (a short
  // insert, a partially-applied payload) would be invisible to the caller by construction. The RPC
  // returns these from GET DIAGNOSTICS ROW_COUNT and from the field it re-derived under the lock; those
  // are the facts. Fail closed if the reply is missing them rather than quietly substituting our own.
  const { match_count, field_size, bracket_size } = result;
  if (
    typeof match_count !== 'number' ||
    typeof field_size !== 'number' ||
    typeof bracket_size !== 'number'
  ) {
    console.error('[generateAndPersistBracket] generate_bracket returned ok without counts:', result);
    return { ok: false, reason: 'write_failed' };
  }

  return {
    ok: true,
    fieldSize: field_size,
    bracketSize: bracket_size,
    matchCount: match_count,
    byeSeeds,
  };
}
