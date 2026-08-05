package awards

import (
	"errors"
	"math/big"
)

// The FR-29 tie ladder — the producer side (Story 6.5, FR-29 / AD-14 / AD-19 /
// SOLUTION-DESIGN §9.3 / SPEC Constraint 7).
//
//	ABSENT_TS = -1                       # 0024:704, the PUBLISHED absent sentinel
//
//	value(key, block) = block[key]       # int   if key in volumeStatKeys  (17)
//	                  = {num, den}       # pair  if key in rateStatKeys    (4)
//	                                     # otherwise: REFUSE                        L5
//
//	beats(dir, a, b)  = cmp(a, b) > 0 for 'max';  < 0 for 'min'
//	best(S, dir, f)   = { p in S : no q in S with beats(dir, f(q), f(p)) }   # a SET
//
//	ladder(award, tied, players):
//	    validate(award, tied, players)                                       # order below
//	    S = tied                                        # byte-lex, |S| >= 2
//
//	    if award.SecondaryStat is present:                                   # L2 SKIP
//	        S1 = best(S, dir, p -> value(SecondaryStat, p.Secondary))
//	        if |S1| == 1: return winner(S1[0], 1)
//	        S = S1                                                           # L3 NARROW
//
//	    if award.EffNumKey and award.EffDenKey are present:                   # L2 SKIP
//	        ratio(p) = { num: p.Eff[nk].Num * p.Eff[dk].Den,                  # L6
//	                     den: p.Eff[nk].Den * p.Eff[dk].Num }
//	        S2 = best(S, dir, ratio)
//	        if |S2| == 1: return winner(S2[0], 2)
//	        S = S2
//
//	    D = { p in S : for every q in S, q != p:
//	                       p.H2H has q and q.H2H has p                        # L8, BOTH ways
//	                   and beats(dir, value(DecidingStat, p.H2H[q]),
//	                                  value(DecidingStat, q.H2H[p])) }
//	    if |D| == 1: return winner(D[0], 3)
//	    if |D| >  1: REFUSE internal   # a strict dominator cannot be plural   # L7
//	    # |D| == 0 -> SKIP, S unchanged (nobody was eliminated)
//
//	    P = [ p in S : p.AchievementTS != ABSENT_TS ]                         # L9
//	    if P is non-empty:
//	        m  = min(p.AchievementTS for p in P)      # NEVER inverted         # L4
//	        S4 = [ p in P : p.AchievementTS == m ]
//	        if |S4| == 1: return winner(S4[0], 4)
//	        S = S4
//	    # every survivor absent -> SKIP with S unchanged
//
//	    return shared(S in byte-lex order, exit_step = 5)   # TERMINAL, no PRNG  L10 / DECISION H
//
// ⛔⛔ L1 — THE LADDER TAKES NO STREAM AND DRAWS ZERO BYTES, AND THE SIGNATURE IS THE PROOF.
// There is no `*Stream` parameter anywhere in this file and there must never be one. It is what
// keeps 6-4b's MEASURED 22-byte 12-spin ceremony valid, and what lets 6.9's browser reproduce a
// ladder-resolved award without a stream at all. ⚠ Do not "verify" this with a runtime assertion:
// a test that opens a fresh stream and asserts `Consumed()` is unchanged around a call to a
// function that cannot reach a stream CANNOT FAIL for any implementation — the 6-4b code review
// deleted exactly two such assertions rather than repairing them. The type carries the property.
//
// ⛔ DECISION H (Cuatro, 2026-08-04, answering deferred-work.md:281's NAMED BLOCKER). Rung 5 — the
// shared co-winner — IS the deterministic terminal rung the blocker asked for. It is satisfied by
// RECOGNISING the rung FR-29 already ends with rather than by adding a seeded one: a seeded rung
// would make this a stream CONSUMER, moving every byte position after it and invalidating both the
// measured ceremony and everything the browser verifier reproduces. The consequence is reported
// rather than engineered away — on a 1v1 corpus where rung 4 provably cannot separate duel
// opponents (0024:898-907), SHARED TROPHIES WILL BE COMMON. That is the design working.
//
// ⛔ DECISION K — DECISION E's carve-out is UPSTREAM and stays upstream. A `max` volume award whose
// best value is 0 returns KindNoAwardableValue and never becomes a tie, so the 27-way zero tie
// deferred-work.md:270 predicted never reaches this file. Its width is there to be READ, never
// resolved.
//
// ⛔ DECISION C carried — the FR-21 floors and the 24/20 literals are UNTOUCHED, including
// `El Inofensivo`'s anti-qualifying kill floor (deferred-work.md:268). That is a catalog/floors
// call and never a rung special-case; L12 forbids this file from re-applying a floor at all.
//
// THE SEAM (ARCHITECTURE-SPINE.md:73-76). This file conforms to `roulette/vectors/`, never to
// lib/roulette/ladder.ts. They are two independent implementations of one spec; neither is the
// reference and neither may be corrected by reading the other's source. When they disagree the
// vector decides; when the vector is silent, add a vector.
//
// ⛔ NOT IN THIS FILE, each with an owner: `award_result.tie_ladder_exit_step` PERSISTENCE and the
// 1..N `award_result_winner` rows (6.8 — this file EMITS the exit step and stores nothing), the
// anti-sweep overflow loop that re-drives this ladder over a REDUCED set (6.6 — `ResolveLadder`
// takes an explicit `tied` so 6.6 needs no fake tie Outcome), the pity draw (6.7), the
// canonicalized bundle (6.9), and the one-card-two-prize-chips reveal (6.10).

// ErrLadder is the sentinel every refusal in this file wraps.
//
// ⭐ ITS OWN SENTINEL, not a reuse of ErrStage2 or ErrStage1. The 6-4a code review measured what an
// untyped refusal surface costs: when every refusal was a bare error string the vector gate could
// assert only "some error", so a mutation that made validation reject EVERY input left all sixteen
// refusal rows passing. Reusing another stage's sentinel rebuilds half of that hole — a ladder
// validation bug and a Stage-2 data defect would be indistinguishable to the suite.
//
// ⚠ A refusal that PROPAGATES from Stage 2 is wrapped in BOTH, so `errors.Is(err, ErrLadder)` holds
// for every refusal this file returns while `errors.Is(err, ErrStage2)` still says where it came
// from — the same double-wrap `Stage1InvalidError` uses.
var ErrLadder = errors.New("awards: FR-29 ladder refused")

// The closed set of things a ladder refusal can be ABOUT, in the ORDER the three implementations
// check them.
//
// ⭐ THE ORDER IS CONTRACT, NOT TASTE, and it is published in `ladder-resolve.json`'s `spec` string.
// Story 6-4b's headline defect was three implementations disagreeing about whether `live_count` was
// validated before or after weighting — invisible because no vector row was malformed in two ways
// at once, so nothing could pin WHICH guard fires first. The vector's
// `MALFORMED IN TWO WAYS AT ONCE` row (a width-1 tied set whose award ALSO names a bogus
// secondary_stat) is the only row that can redden a regression here.
//
// ⭐ AND IT IS GENUINELY CLOSED. Story 6-4b shipped a "closed set" that was not: nine constants in
// Go against seven in TypeScript and seven in the vector, with TypeScript emitting the missing two
// anyway. All five below are declared once in the anchor, carried in the vector's
// `refusal_details`, and pinned against these constants by exact equality in both suites.
const (
	LadderDetailStage2   = "stage2"   // the Stage-2 award surface refused; propagated, never swallowed
	LadderDetailAward    = "award"    // a rung key outside the vocabulary, or a HALF-CONFIGURED pair
	LadderDetailTied     = "tied"     // the tied set's own shape
	LadderDetailPlayer   = "player"   // a snapshot row is malformed or missing a key the ladder needs
	LadderDetailInternal = "internal" // an invariant this file believes unreachable
)

// ⚠ `internal` IS DECLARED AND IS NOT ROW-REPRESENTABLE, exactly as stage1.go's `stream` and
// `internal` are — and here the unreachability is PROVABLE rather than asserted. Rung 3's dominator
// test is antisymmetric (`compareValues(a,b) == -compareValues(b,a)`), so `p` beating `q` means `q`
// does not beat `p`, so two players can never both beat everyone: |D| > 1 is reachable ONLY from a
// broken comparator. That is exactly why it is a loud typed refusal (Cuatro's call, 2026-08-04)
// rather than a fall-through — falling through converts a comparator bug into a silently SHARED
// trophy, indistinguishable from a legitimate rung-5 bottom-out, and rung-5 bottom-outs are the
// outcome this ceremony is going to produce a lot of.

// LadderInvalidError is every ladder refusal, and it NAMES WHICH INPUT was rejected. It mirrors
// Stage1InvalidError deliberately: one shape for a refusal across the whole package.
type LadderInvalidError struct {
	Detail string
	Reason string
	// Cause is the propagated Stage-2 refusal on a LadderDetailStage2 refusal, nil otherwise.
	Cause error
}

func (e *LadderInvalidError) Error() string {
	return "awards: FR-29 ladder refused (" + e.Detail + "): " + e.Reason
}

// Unwrap returns BOTH ErrLadder and any propagated cause, so `errors.Is(err, ErrLadder)` answers
// "did the ladder refuse" while `errors.Is(err, ErrStage2)` still says where a propagated refusal
// came from.
func (e *LadderInvalidError) Unwrap() []error {
	if e.Cause == nil {
		return []error{ErrLadder}
	}
	return []error{ErrLadder, e.Cause}
}

// ladderRefuse builds a typed refusal. Every return-with-error in this file goes through it or
// through a &LadderInvalidError literal, so no refusal can reach a caller without naming its input.
func ladderRefuse(detail, reason string) error {
	return &LadderInvalidError{Detail: detail, Reason: reason}
}

// AbsentAchievementTS is the PUBLISHED absent sentinel for `stat_snapshot_row.achievement_ts`
// (0024:704, 898-907): a rostered player with no contributing approved row.
//
// ⭐ IT IS NUMERICALLY THE SMALLEST VALUE IN THE COLUMN, which is the entire reason L9 exists.
const AbsentAchievementTS = -1

// The 17/4 vocabulary split, transcribed from 0023's `award_deciding_stat_valid` CHECK (0023:89-96)
// and `award_secondary_stat_valid` / `award_eff_*_key_valid` (0023:98-115).
//
// ⭐ WHY THIS PACKAGE RESTATES IT AT ALL. `worker/awards` is a LEAF (TestPackageIsALeaf) and cannot
// read the database, but L5 needs a key's CLASS derived from the KEY — `secondary` is
// `volume || rate` (0024:723), so `secondary[k]` is an integer for a volume key and a `{num,den}`
// pair for a rate key INDEPENDENTLY of the class of the award's deciding stat. Without the split,
// rung 1 has no way to know which shape to read.
//
// ⚠ IT IS THE FOURTH RESTATEMENT (0023's CHECKs, `award_stat_vocabulary()`, lib/awards/catalog.ts,
// and now the two runtimes), so it is PINNED against the vector's `stat_vocabulary` block by exact
// equality in both suites rather than trusted. A key added on one side alone reddens.
var volumeStatKeys = []string{
	"kills", "deaths", "assists", "mvps", "flash_assists", "utility_damage",
	"knife_kills", "wallbang_kills", "through_smoke_kills", "no_scope_kills", "blind_kills",
	"entry_frags", "opening_deaths", "rounds_won", "rounds_played", "matches_played", "hs_kills",
}

var rateStatKeys = []string{"adr", "hs_pct", "kast_pct", "entry_success"}

var statKeyClass = func() map[string]AwardClass {
	m := make(map[string]AwardClass, len(volumeStatKeys)+len(rateStatKeys))
	for _, k := range volumeStatKeys {
		m[k] = ClassVolume
	}
	for _, k := range rateStatKeys {
		m[k] = ClassRate
	}
	return m
}()

// classOfStatKey is L5's whole rule: a key's class comes from the VOCABULARY, never from
// `award.Class`. A key in neither half is a refusal — never a guess and never a default.
func classOfStatKey(key string) (AwardClass, bool) {
	c, ok := statKeyClass[key]
	return c, ok
}

// rungKey is the ONE normalisation of a nullable rung key.
//
// ⭐ ABSENT IS THE EMPTY STRING HERE, and that is forced by the representation rather than chosen
// for convenience: `Award.SecondaryStat` is a plain Go `string`, so `encoding/json` leaves it at
// `""` for BOTH a JSON `null` and an OMITTED key. This function exists so the rule has ONE site,
// and the vector carries all three spellings (`null`, omitted, `""`) as CASES with byte-identical
// expected blocks — because Go cannot distinguish "absent" from "present and empty", so the other
// two runtimes must agree that `""` is absent or the seam disagrees on an input neither would
// report. Same resolution as 6-4b's absent container.
func rungKey(value string) (string, bool) {
	if value == "" {
		return "", false
	}
	return value, true
}

// FR29Ladder is the real FR-29 tiebreak ladder — the Ladder the ceremony injects.
//
// ⚠ It is a zero-size struct with no state on purpose: the ladder is a pure function of the award,
// the tied set and the frozen snapshot. Anything it remembered between calls would make two
// resolutions of the same tie observably different operations.
type FR29Ladder struct{}

// Resolve satisfies the Ladder port.
//
// ⚠ It refuses a non-tie Outcome rather than passing it through. The port is only ever handed a
// KindTie by ResolveAward, so anything else means the caller is broken — and DECISION K makes the
// point sharp: a KindNoAwardableValue outcome CARRIES a `Tied` set, so a ladder that resolved
// whatever it was given would re-crown the very zero tie DECISION E exists to suppress.
func (FR29Ladder) Resolve(award Award, tie Outcome, players []SnapshotPlayer) (Outcome, error) {
	if tie.Kind != KindTie {
		return Outcome{}, ladderRefuse(LadderDetailTied,
			"the ladder resolves a "+string(KindTie)+" outcome and was handed a "+
				string(tie.Kind)+" — DECISION K: a no_awardable_value outcome carries a Tied set "+
				"whose WIDTH is to be read, never resolved")
	}
	return ResolveLadder(award, tie.Tied, players)
}

// ResolveLadder is the pure ladder over injected inputs, and the entry point Story 6.6 drives.
//
// ⭐ IT TAKES AN EXPLICIT `tied` RATHER THAN AN Outcome, and that is the seam decision worth getting
// right once: 6.6's anti-sweep re-resolves an award over a REDUCED set after the original winner is
// removed, and building a fake tie Outcome to do that would be inventing a Stage-2 result that
// Stage 2 never produced.
//
// ⛔ NO STREAM, NO CLOCK, NO RANDOMNESS, NO I/O (L1). And no `*big.Int` from the caller's snapshot
// is ever returned or mutated — the Outcome carries only strings and an int, so 6-4a's aliasing
// hazard (a returned pointer into the frozen snapshot, retroactively mutable) cannot arise here at
// all. Every product below is computed into a fresh big.Int.
func ResolveLadder(award Award, tied []string, players []SnapshotPlayer) (Outcome, error) {
	byID, err := validateLadder(award, tied, players)
	if err != nil {
		return Outcome{}, err
	}

	direction := award.Direction
	survivors := make([]string, len(tied))
	copy(survivors, tied)

	// ── RUNG 1 — the secondary stat ──────────────────────────────────────────────────────────
	//
	// L2 — a NULL/absent `secondary_stat` is a deterministic SKIP. Not a refusal, not a zero, and
	// not "fall back to the deciding stat": the award simply declines this rung.
	//
	// ⚠ THE SKIP IS NOW EXERCISED ONLY BY THE VECTOR, NOT IN PRODUCTION. All twelve shipped awards
	// had all three keys NULL until 6.5's own catalog pass filled them, so this branch WAS the
	// common path and is now taken by ZERO shipped awards. It stays a first-class contract because
	// 0023's columns are nullable and 6.6 may hand the ladder a reduced award — but do not read
	// this rung as "usually skipped" any more. (Comment corrected at the Group-1 code review,
	// 2026-08-04, which found it asserting the opposite of what the same commit shipped.)
	if key, present := rungKey(award.SecondaryStat); present {
		narrowed, err := bestSurvivors(survivors, direction, func(sid string) (StatValue, error) {
			return statValue(key, byID[sid].Secondary, sid+".secondary")
		})
		if err != nil {
			return Outcome{}, err
		}
		if len(narrowed) == 1 {
			return ladderWinner(narrowed[0], LadderExitSecondary), nil
		}
		// L3 — NARROW. The next rung runs over THESE, never over the original `tied`. A ladder
		// that re-read the full tied set at every rung is a VOTE, not a ladder, and it can crown a
		// player this rung already eliminated.
		survivors = narrowed
	}

	// ── RUNG 2 — the efficiency ratio: a RATIO OF TWO RATIOS ─────────────────────────────────
	//
	// ⭐⭐ THE SHIPPED PAIR IS `kills`/`deaths`, SO A ZERO DENOMINATOR IS AN ORDINARY SHAPE HERE, NOT
	// AN EXOTIC ONE — accepted and documented rather than engineered away (Cuatro, Group-1 code
	// review, 2026-08-04). S3's semantics are inherited verbatim from Stage 2 and L6 forbids
	// "fixing" them, so on a 1v1 corpus expect both of these to be reachable:
	//
	//   - a survivor with 0 deaths gives n/0, which BEATS every finite value — they win this rung
	//     outright on a `max` award, and lose to everyone on `El Inofensivo`;
	//   - a survivor with 0 kills AND 0 deaths gives 0/0, which is EQUAL to everything — they can
	//     never be eliminated at rung 1 or rung 2 and ride to the shared rung 5.
	//
	// Both agree with Stage 2 by construction (this rung and `ResolveStage2` share `compareValues`),
	// both have their own vector rows, and neither is reachable on today's corpus because rung 1
	// resolves all five real ties. ⛔ Do not special-case them here — the place to change this
	// behaviour is the catalog's choice of denominator, and that is a measured decision.
	numKey, hasNum := rungKey(award.EffNumKey)
	denKey, hasDen := rungKey(award.EffDenKey)
	if hasNum && hasDen {
		narrowed, err := bestSurvivors(survivors, direction, func(sid string) (StatValue, error) {
			// L6 — `Efficiency[k]` is ALWAYS a {Num, Den} pair (`snapshot_efficiency_form`,
			// 0024:352-364: a volume `v` becomes {v, 1}), so the ratio of two of them is
			//     num = eff[numKey].Num * eff[denKey].Den
			//     den = eff[numKey].Den * eff[denKey].Num
			// and comparing two players cross-multiplies THOSE — four multiplications of unbounded
			// snapshot magnitudes per side. ⭐ THIS IS WHY `math/big`'s package ban is widened to
			// this file where Story 6-4b was explicitly told NOT to widen it for stage1.go: Stage
			// 1's operands are weights bounded by uniform_int's own n <= 2^32, and these have no
			// bound at all. The difference is the arithmetic, not the convenience.
			eff := byID[sid].Efficiency
			num, err := efficiencyPair(eff, numKey, sid+".efficiency")
			if err != nil {
				return StatValue{}, err
			}
			den, err := efficiencyPair(eff, denKey, sid+".efficiency")
			if err != nil {
				return StatValue{}, err
			}
			return StatValue{
				Class: ClassRate,
				Num:   new(big.Int).Mul(num.Num, den.Den),
				Den:   new(big.Int).Mul(num.Den, den.Num),
			}, nil
		})
		if err != nil {
			return Outcome{}, err
		}
		if len(narrowed) == 1 {
			return ladderWinner(narrowed[0], LadderExitEfficiency), nil
		}
		survivors = narrowed
	}

	// ── RUNG 3 — the head-to-head STRICT dominator over the REMAINING set ─────────────────────
	dominators, err := h2hDominators(award, survivors, byID)
	if err != nil {
		return Outcome{}, err
	}
	if len(dominators) == 1 {
		return ladderWinner(dominators[0], LadderExitH2H), nil
	}
	if len(dominators) > 1 {
		// L7 — unreachable over an antisymmetric comparator; see the note on LadderDetailInternal.
		return Outcome{}, ladderRefuse(LadderDetailInternal,
			"rung 3 computed "+itoa(len(dominators))+" strict dominators, which is impossible over "+
				"an antisymmetric comparator — the comparator is broken")
	}
	// |D| == 0 -> SKIP, and `survivors` is UNCHANGED. Failing to dominate is not losing: nobody was
	// eliminated, so every survivor reaches rung 4.

	// ── RUNG 4 — the earliest achievement_ts; the SENTINEL NEVER WINS ─────────────────────────
	//
	// ⭐ L9 — FILTER THE ABSENTS BEFORE MINIMISING. `-1` is the published absent sentinel AND
	// numerically the smallest value in the column, so a naive `min` crowns the player with NO
	// APPROVED ROWS AT ALL — the worst possible outcome for a rung whose whole meaning is "did it
	// first".
	absent := big.NewInt(AbsentAchievementTS)
	present := make([]string, 0, len(survivors))
	for _, sid := range survivors {
		if byID[sid].AchievementTS.Cmp(absent) != 0 {
			present = append(present, sid)
		}
	}
	if len(present) > 0 {
		// ⭐ L4 — ALWAYS THE EARLIEST, NEVER INVERTED BY `direction`. Rung 4 is a RECENCY rule, not
		// a stat: inverting it would mean "the latest achievement wins" for the catalog's one `min`
		// award (`El Inofensivo`) and for no other, which is a rule nobody wrote down anywhere.
		earliest := byID[present[0]].AchievementTS
		for _, sid := range present[1:] {
			if byID[sid].AchievementTS.Cmp(earliest) < 0 {
				earliest = byID[sid].AchievementTS
			}
		}
		narrowed := make([]string, 0, len(present))
		for _, sid := range present {
			if byID[sid].AchievementTS.Cmp(earliest) == 0 {
				narrowed = append(narrowed, sid)
			}
		}
		if len(narrowed) == 1 {
			return ladderWinner(narrowed[0], LadderExitAchieved), nil
		}
		survivors = narrowed
	}
	// Every survivor absent -> SKIP with `survivors` unchanged. Not a refusal, and not a crash on
	// an empty minimum: it is the ordinary shape for a roster whose matches are unapproved.

	// ── RUNG 5 — the shared co-winner. TERMINAL. NO PRNG. (L10 / DECISION H) ──────────────────
	//
	// The FULL surviving set, in the byte-lex order it has carried since `tied` — never the first,
	// never the lowest SteamID64. Returning one of them is the silent argmax AD-14 forbids, wearing
	// its last available hat. EXPERIENCE.md:123: "a designed outcome, never an error state".
	shared := make([]string, len(survivors))
	copy(shared, survivors)
	return Outcome{Kind: KindShared, Winners: shared, LadderExitStep: LadderExitShared}, nil
}

// ladderWinner is a ladder-resolved single winner.
//
// ⚠ NO DecidingValue, DELIBERATELY. The tie this ladder resolves carries none (Stage 2's tie arm
// has no value), and L12 forbids re-deriving one: the ladder reads the tied set as given and never
// re-reads the deciding magnitudes. Story 6.8, which persists `award_result`, holds the snapshot
// and can render it there.
func ladderWinner(steamID64 string, exitStep int) Outcome {
	return Outcome{Kind: KindWinner, SteamID64: steamID64, LadderExitStep: exitStep}
}

// bestSurvivors is `best` as a SET over the survivors, preserving their byte-lex order.
//
// ⭐ A SET, NEVER A CHAMPION — the same S7 rule Stage 2 obeys, for the same reason: a running
// champion replaced on `>` silently keeps the FIRST of an equal pair and IS the argmax AD-14
// forbids; replaced on `>=` it silently keeps the LAST. Both produce a plausible winner with
// nothing red anywhere.
func bestSurvivors(
	survivors []string,
	direction AwardDirection,
	valueOf func(string) (StatValue, error),
) ([]string, error) {
	values := make(map[string]StatValue, len(survivors))
	for _, sid := range survivors {
		v, err := valueOf(sid)
		if err != nil {
			return nil, err
		}
		values[sid] = v
	}
	out := make([]string, 0, len(survivors))
	for _, p := range survivors {
		beaten := false
		for _, q := range survivors {
			won, err := beatsStat(direction, values[q], values[p])
			if err != nil {
				return nil, err
			}
			if won {
				beaten = true
				break
			}
		}
		if !beaten {
			out = append(out, p)
		}
	}
	// ⛔ AN EMPTY BEST SET IS A REFUSAL, NEVER A SILENT NARROWING — the same guard stage2.go:490
	// carries, for the same reason and with the same caveat: it holds because of ACYCLICITY, not
	// transitivity (`0/0` is equal to everything, so the relation is NOT transitive and that is
	// fine). Every non-empty set has an unbeaten member while the strict part is acyclic; if this
	// ever fires, the comparator is broken. ⭐ Without it the emptiness propagates silently to rung
	// 5 and `ResolveLadder` hands back a SHARED outcome with ZERO winners — a trophy awarded to
	// nobody, which is the "plausible, wrong, nothing red" failure Stage 2's twin exists to prevent.
	// The guard belongs HERE because this is the only place `survivors` can shrink to empty: rung 3
	// never narrows, and rung 4's minimum is drawn from a non-empty `present`.
	// (Code review, Group 1, 2026-08-04.)
	if len(out) == 0 {
		return nil, ladderRefuse(LadderDetailInternal,
			"empty best set over "+itoa(len(survivors))+" survivors — the comparator's strict part "+
				"is not acyclic")
	}
	return out, nil
}

// h2hDominators is rung 3: every survivor who STRICTLY beats every other survivor head-to-head.
func h2hDominators(
	award Award,
	survivors []string,
	byID map[string]*SnapshotPlayer,
) ([]string, error) {
	out := make([]string, 0, len(survivors))
	for _, p := range survivors {
		mine := byID[p].H2H
		dominates := true
		for _, q := range survivors {
			if q == p {
				continue
			}
			theirs := byID[q].H2H
			// ⛔ L8 — BOTH DIRECTIONS MUST EXIST, AND AN ABSENT OPPONENT KEY IS NEVER A ZERO.
			// `H2H[p][q]` holds P's OWN stats over the matches p and q shared, so a comparison
			// needs both halves; one present and one absent is still "not comparable". An absent
			// opponent key is the NEVER-MET signal and DISQUALIFIES p as a dominator — 0024:920-923
			// gives the reason verbatim: "a zero would silently become a real comparison".
			// ⚠ H2H is `{}` for a player with no shared approved matches, and a player is never a
			// key in their own map.
			pq, okPQ := mine[q]
			qp, okQP := theirs[p]
			if !okPQ || !okQP {
				dominates = false
				break
			}
			a, err := statValue(award.DecidingStat, pq, p+".h2h["+q+"]")
			if err != nil {
				return nil, err
			}
			b, err := statValue(award.DecidingStat, qp, q+".h2h["+p+"]")
			if err != nil {
				return nil, err
			}
			// L7 — STRICT. `p` must BEAT `q`, not merely not-lose to them. Relaxing this to "beats
			// at least one" turns a dominator into a plurality vote.
			won, err := beatsStat(award.Direction, a, b)
			if err != nil {
				return nil, err
			}
			if !won {
				dominates = false
				break
			}
		}
		if dominates {
			out = append(out, p)
		}
	}
	return out, nil
}

// beatsStat is `beats` over two CLASS-SHAPED values, taking the DIRECTION alone.
//
// ⚠ IT TAKES A DIRECTION, NOT AN AWARD, and that is deliberate: rung 4 must never be inverted (L4)
// and rung 2 compares a COMPUTED ratio that belongs to no award's class. Passing the whole award
// would invite both mistakes.
//
// ⚠ S3's ZERO-DENOMINATOR SEMANTICS ARE INHERITED VERBATIM by calling stage2.go's own
// `compareValues`: cross-multiplication stays total, `0/0` compares EQUAL to everything, and `n/0`
// with `n > 0` beats every finite value. 6-4a's review made both halves explicit vector rows, and
// this rung has its own rows for both rather than a special case — sharing the comparator is what
// makes "the ladder agrees with Stage 2" a fact instead of a claim.
func beatsStat(direction AwardDirection, a, b StatValue) (bool, error) {
	if a.Class != b.Class {
		// Unreachable: every value inside one rung is read through ONE key, so they share a class.
		return false, ladderRefuse(LadderDetailInternal,
			"cannot compare a "+string(a.Class)+" value with a "+string(b.Class)+" value")
	}
	c, err := compareValues(a.Class, a, b)
	if err != nil {
		return false, &LadderInvalidError{
			Detail: LadderDetailInternal,
			Reason: "comparing two " + string(a.Class) + " values: " + err.Error(),
			Cause:  err,
		}
	}
	if direction == DirectionMax {
		return c > 0, nil
	}
	return c < 0, nil
}

// statValue reads one CLASS-SHAPED value out of a `Secondary` or `H2H[opp]` block.
//
// ⚠ AN ABSENT KEY IS A REFUSAL, NEVER A ZERO — the same doctrine 0024:918-923 states for an absent
// h2h OPPONENT, applied one level in. The two absences mean different things and must stay
// distinguishable: an absent OPPONENT is "they never met" (a skip, handled by the caller); an
// absent STAT KEY inside a present opponent block is a CORRUPT ROW, because 0024 writes all 21 keys
// into every block it writes at all.
//
// ⚠ AN ABSENT BLOCK IS THE EMPTY BLOCK (Cuatro's rule at the 6-4b review): a nil map here reads as
// empty rather than refusing, because Go cannot idiomatically tell nil from empty and the verifier
// must agree with it. That still lands on the absent-KEY refusal a line later, which is the right
// answer for the right reason.
func statValue(key string, block map[string]StatValue, where string) (StatValue, error) {
	class, known := classOfStatKey(key)
	if !known {
		return StatValue{}, ladderRefuse(LadderDetailAward,
			where+": "+key+" is not one of the 21 vocabulary keys")
	}
	v, ok := block[key]
	if !ok {
		return StatValue{}, ladderRefuse(LadderDetailPlayer,
			where+": key "+key+" is absent — an absent key is a refusal, never a zero")
	}
	// ⭐ L5 — THE SHAPE IS CHECKED AGAINST THE KEY'S CLASS, NEVER AGAINST `award.Class`. `secondary`
	// is `volume || rate`, so a VOLUME award may perfectly well name `hs_pct` as its secondary and
	// the value read is then a {num,den} PAIR. An implementation that branched on `award.Class`
	// reads that pair as a bare integer for every award whose secondary crosses classes.
	if v.Class != class {
		return StatValue{}, ladderRefuse(LadderDetailPlayer,
			where+": key "+key+" is a "+string(class)+" key carrying a "+string(v.Class)+" value")
	}
	// ⛔ NEGATIVE MAGNITUDES ARE REFUSED, exactly as stage2.go:638,658 refuses them on the DECIDING
	// value, and for the identical reason stated there: cross-multiplication `a.Num*b.Den >
	// b.Num*a.Den` is the right test only while both denominators are non-negative, and one negative
	// SILENTLY INVERTS the comparison — the ladder then returns a plausible, wrong survivor with
	// nothing red anywhere. ⚠ S3's zero semantics are inherited verbatim (`beatsStat`); only a
	// NEGATIVE is refused. Every one of these is a `coalesce`d count in 0024, so this is unreachable
	// from a real snapshot — which is precisely why Stage 2 keeps its own copy loud rather than
	// trusting the producer, and why the ladder, reading THREE blocks Stage 2 never touches, needs
	// its own. (Code review, Group 1, 2026-08-04.)
	if class == ClassVolume {
		if v.Value == nil {
			return StatValue{}, ladderRefuse(LadderDetailPlayer,
				where+": volume key "+key+" carries no integer")
		}
		if v.Value.Sign() < 0 {
			return StatValue{}, ladderRefuse(LadderDetailPlayer,
				where+": volume key "+key+" is negative — every volume stat is a count")
		}
		return StatValue{Class: ClassVolume, Value: v.Value}, nil
	}
	if v.Num == nil || v.Den == nil {
		return StatValue{}, ladderRefuse(LadderDetailPlayer,
			where+": rate key "+key+" carries an incomplete {num, den} pair")
	}
	if v.Num.Sign() < 0 || v.Den.Sign() < 0 {
		return StatValue{}, ladderRefuse(LadderDetailPlayer,
			where+": rate key "+key+" has a negative half — both halves are counts")
	}
	return StatValue{Class: ClassRate, Num: v.Num, Den: v.Den}, nil
}

// efficiencyPair reads one `{num, den}` out of the efficiency block. Uniform — there is no class
// branch here, because `snapshot_efficiency_form` gives EVERY key that shape.
func efficiencyPair(block map[string]RatePair, key, where string) (RatePair, error) {
	if _, known := classOfStatKey(key); !known {
		return RatePair{}, ladderRefuse(LadderDetailAward,
			where+": "+key+" is not one of the 21 vocabulary keys")
	}
	pair, ok := block[key]
	if !ok {
		return RatePair{}, ladderRefuse(LadderDetailPlayer,
			where+": key "+key+" is absent — an absent key is a refusal, never a zero")
	}
	if pair.Num == nil || pair.Den == nil {
		return RatePair{}, ladderRefuse(LadderDetailPlayer,
			where+": efficiency["+key+"] carries an incomplete {num, den} pair — "+
				"snapshot_efficiency_form gives every key that shape, a volume v as {v, 1}")
	}
	// ⛔ NEGATIVE HALVES ARE REFUSED — see the note in `statValue`. It matters MORE here: rung 2
	// multiplies FOUR of these halves together, so a single negative flips the sense of the whole
	// four-term product and makes the "beats" relation cyclic rather than merely wrong.
	if pair.Num.Sign() < 0 || pair.Den.Sign() < 0 {
		return RatePair{}, ladderRefuse(LadderDetailPlayer,
			where+": efficiency["+key+"] has a negative half — both halves are counts")
	}
	return pair, nil
}

// validateLadder validates in the PUBLISHED order and returns the SteamID64 -> player index.
//
// ⭐ THE ORDER IS PUBLISHED IN THE VECTOR'S `spec` STRING AND PINNED BY A ROW MALFORMED TWICE:
//
//  1. LadderDetailStage2 — the award's Stage-2 surface, re-run because ResolveLadder is a PUBLIC
//     entry point Story 6.6 drives directly over a REDUCED set, with no preceding Stage-2 call to
//     have checked it.
//  2. LadderDetailAward  — this file's own award surface: DecidingStat and every present rung key
//     must be one of the 21 vocabulary keys (rung 3 reads H2H[opp][DecidingStat] through the KEY's
//     class, so membership is what makes the read decidable at all), and the efficiency pair is
//     BOTH-OR-NEITHER (L2 — half a ratio is a half-configured rung, not a skip).
//  3. LadderDetailTied   — width >= 2 (L11), no duplicate, strictly ascending byte-lex, every
//     member has a snapshot row.
//  4. LadderDetailPlayer — every TIED player's AchievementTS.
//
// ⚠ WHY AchievementTS IS VALIDATED UP FRONT RATHER THAN AT RUNG 4. It is NEVER NULL in the snapshot
// (0024:706), so a value below the sentinel is a CORRUPT SNAPSHOT rather than a rung-specific
// concern — and a ladder that only noticed corruption when it happened to descend that far would
// report the same snapshot as fine or broken depending on how the tie broke. The per-key BLOCK
// lookups stay lazy, at the rung that reads them, mirroring Stage 2's own split between eligibility
// inputs (checked for everyone) and deciding magnitudes (checked where read).
//
// ⛔ L12 — THE LADDER NEVER RE-FILTERS ELIGIBILITY AND NEVER RE-DERIVES THE DECIDING VALUE. Stage 2
// already applied the FR-21 floors and `idle_dq`; re-applying them here could EMPTY the tied set,
// and re-deriving `best` could disagree with the caller about who is in the race. Note what is
// absent below: no floor comparison, no IdleDQ read, no Volume/Rate lookup.
func validateLadder(
	award Award,
	tied []string,
	players []SnapshotPlayer,
) (map[string]*SnapshotPlayer, error) {
	// 1 — the Stage-2 award surface, PROPAGATED rather than swallowed and re-labelled so a caller
	// can see where it came from.
	if err := validateAward(award); err != nil {
		return nil, &LadderInvalidError{
			Detail: LadderDetailStage2,
			Reason: err.Error(),
			Cause:  err,
		}
	}

	// 2 — this file's own award surface.
	if _, known := classOfStatKey(award.DecidingStat); !known {
		return nil, ladderRefuse(LadderDetailAward,
			"deciding_stat "+award.DecidingStat+" is not one of the 21 vocabulary keys — rung 3 "+
				"reads h2h[opp][deciding_stat] through the KEY's class, so membership is what "+
				"makes the read decidable at all")
	}
	for _, f := range []struct{ name, value string }{
		{"secondary_stat", award.SecondaryStat},
		{"eff_num_key", award.EffNumKey},
		{"eff_den_key", award.EffDenKey},
	} {
		key, present := rungKey(f.value)
		if !present {
			continue
		}
		if _, known := classOfStatKey(key); !known {
			return nil, ladderRefuse(LadderDetailAward,
				f.name+" "+key+" is not one of the 21 vocabulary keys (0023:98-115)")
		}
	}
	_, hasNum := rungKey(award.EffNumKey)
	_, hasDen := rungKey(award.EffDenKey)
	if hasNum != hasDen {
		// L2 — BOTH OR NEITHER. One without the other is a HALF-CONFIGURED rung, which is a refusal
		// rather than a skip: a skip means "this award declines rung 2", and half a ratio means
		// somebody edited the catalog and stopped.
		return nil, ladderRefuse(LadderDetailAward,
			"eff_num_key and eff_den_key are both-or-neither — one without the other is a "+
				"half-configured rung, not a skip")
	}

	// 3 — the tied set.
	if len(tied) < 2 {
		// L11 — Stage 2 only produces a tie at width >= 2, so anything narrower means the CALLER is
		// broken. A ladder that "resolved" a width-1 set would crown a player nobody tied with.
		return nil, ladderRefuse(LadderDetailTied,
			"a tied set has width >= 2, got "+itoa(len(tied))+" — Stage 2 never produces a "+
				"narrower one, so this is a broken caller")
	}
	seen := make(map[string]struct{}, len(tied))
	for i, sid := range tied {
		if err := validSteamID64(sid); err != nil {
			return nil, &LadderInvalidError{
				Detail: LadderDetailTied,
				Reason: "tied[" + itoa(i) + "]: " + err.Error(),
				Cause:  err,
			}
		}
		if _, dup := seen[sid]; dup {
			return nil, ladderRefuse(LadderDetailTied,
				"duplicate steamid64 "+sid+" in the tied set")
		}
		seen[sid] = struct{}{}
		// ⚠ STRICTLY ASCENDING BYTE-LEX, and it is REFUSED rather than sorted. The tied set arrives
		// in the order Stage 2 produced it (0024:732's `collate "C"`) and rung 5 must RETURN that
		// order, so sorting here would HIDE a caller that had reordered it and the shared set's
		// published order would silently depend on the caller. Go's `<` on strings is byte-wise,
		// which is what makes this agree with the snapshot's own collation.
		if i > 0 && sid <= tied[i-1] {
			return nil, ladderRefuse(LadderDetailTied,
				"the tied set must be in strictly ascending byte-lex order, got "+tied[i-1]+
					" then "+sid)
		}
	}

	byID := make(map[string]*SnapshotPlayer, len(players))
	for i := range players {
		sid := players[i].SteamID64
		if _, dup := byID[sid]; dup {
			return nil, ladderRefuse(LadderDetailPlayer,
				"duplicate steamid64 "+sid+" — a snapshot holds one row per player")
		}
		byID[sid] = &players[i]
	}
	for _, sid := range tied {
		if _, ok := byID[sid]; !ok {
			return nil, ladderRefuse(LadderDetailTied,
				"tied member "+sid+" has no matching snapshot row")
		}
	}

	// 4 — every TIED player's achievement_ts.
	absent := big.NewInt(AbsentAchievementTS)
	for _, sid := range tied {
		ts := byID[sid].AchievementTS
		if ts == nil {
			// ⚠ A SCALAR, NOT A CONTAINER, so the "absent is the empty case" rule does NOT apply
			// here. A nil *big.Int read as 0 would be an epoch of 1970 and would win rung 4
			// outright — the same class of silent plausibility L9 exists to prevent.
			return nil, ladderRefuse(LadderDetailPlayer,
				sid+": achievement_ts is absent — 0024:706 makes it NEVER NULL, with "+
					itoa(-AbsentAchievementTS)+" negated as the published absent sentinel")
		}
		if ts.Cmp(absent) < 0 {
			return nil, ladderRefuse(LadderDetailPlayer,
				sid+": achievement_ts is below the published absent sentinel")
		}
	}
	return byID, nil
}
