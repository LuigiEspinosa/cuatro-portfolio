package awards

import (
	"errors"
	"fmt"
	"math/big"
	"reflect"
	"sort"
)

// Stage 2 — the deterministic winner (Story 6-4a, FR-25 / AD-14 / AD-15 / AD-19 /
// SOLUTION-DESIGN §9.3).
//
//	eligible(award, players) = [ p for p in players sorted BYTE-LEX on the decimal
//	                             steamid64 STRING
//	                             if p.rounds_played >= award.floor_rounds
//	                            and p.kills         >= award.floor_kills
//	                            and not p.idle_dq ]
//
//	value(award, p) = p.stats_int.volume[award.deciding_stat]             class 'volume'
//	                = p.stats_int.rate[award.deciding_stat]  # {num,den}  class 'rate'
//
//	cmp(award, p, q) = (volume) sign(p - q)
//	                   (rate)   sign(p.num*q.den - q.num*p.den)
//	beats(award, p, q) = cmp > 0 for direction 'max';  cmp < 0 for 'min'
//
//	resolve(award, players):
//	    validate(award)                     # refuses BEFORE eligibility is computed
//	    E = eligible(award, players)
//	    if E is empty:                      return no_eligible_players
//	    best = { p in E : no q in E with beats(award, q, p) }   # a SET, never a champion
//	    if class == 'volume' and direction == 'max' and value(best[0]) == 0:
//	                                        return no_awardable_value(best)   # DECISION E
//	    if len(best) == 1:                  return winner(best[0], value(best[0]))
//	    return tie(best, equal_value if class == 'volume' else equal_cross_product)
//
// NO RANDOMNESS AND NO STREAM. Stage 2 consumes no PRNG bytes at all — it is a pure integer
// function of the frozen snapshot, and that is what makes it replayable by a skeptic with
// nothing but the published bundle.
//
// THE SEAM (ARCHITECTURE-SPINE.md:73-76). This file conforms to `roulette/vectors/`, never to
// lib/roulette/stage2.ts. They are two independent implementations of one spec; neither is the
// reference and neither may be corrected by reading the other's source. When they disagree the
// vector decides; when the vector is silent, add a vector.
//
// ⛔ NOT IN THIS FILE, each with an owner: the FR-29 tiebreak ladder's RUNGS (6.5 — this file
// defines the PORT, ships the implementation that refuses, and carries the shapes the rungs read;
// `ladder.go` holds the five rungs), Stage 1's weighted pick (6-4b), anti-sweep (6.6), pity
// (6.7), and any persistence at all (6.8 — worker/awards stays the leaf `TestPackageIsALeaf`
// pins).

// ErrStage2 is the sentinel every programmer/data refusal in this file wraps.
//
// ⭐ TYPED, not a bare error string. The 6-4a code review measured the consequence of it being
// untyped: the vector-driven refusal gate could only assert "some error", so a mutation that made
// validateAward reject EVERY award left all sixteen refusal rows passing. TypeScript has had
// `Stage2Error` since the first commit for exactly this reason (its own comment records the 6.3
// mutation that motivated it); this is the Go half of that mirror, so `errors.Is(err, ErrStage2)`
// distinguishes this module's own refusal from an incidental failure.
//
// ⚠ LadderRefusedError is deliberately NOT wrapped in it: a refused tie is a business seam 6.5
// will replace, not a malformed input.
var ErrStage2 = errors.New("awards: stage 2 refused")

// AwardClass mirrors 0023's `award_class_valid` closed set.
//
// ⭐ THE BRANCH IS ON THE CLASS, never on whether a value happens to look like a pair.
// `award_class_key_coherent` (0023:129-133) is documented in its own comment as "precisely the
// discriminator 6.4's Stage 2 branches on", and it is a database CHECK exactly so this branch
// can trust it.
type AwardClass string

const (
	ClassVolume AwardClass = "volume"
	ClassRate   AwardClass = "rate"
)

// AwardDirection mirrors 0023's `award_direction_valid` closed set.
type AwardDirection string

const (
	DirectionMax AwardDirection = "max"
	DirectionMin AwardDirection = "min"
)

// Award is the resolution-relevant projection of one `award` row.
//
// The floors are plain ints, not big.Ints, and the asymmetry with SnapshotPlayer's magnitudes
// is deliberate: `floor_rounds`/`floor_kills` are bounded `int` columns (0023:74-75) while every
// snapshot magnitude is an unbounded integer (AD-19). Provenance, not taste.
//
// ⭐ WIDENED BY STORY 6.5 with the three FR-29 rung keys (0023:71-73). They were deliberately
// omitted at 6-4a because the ladder had made no decisions yet; rungs 1 and 2 cannot read a key
// they were never handed, so the projection grows.
type Award struct {
	DecidingStat string
	Class        AwardClass
	Direction    AwardDirection
	FloorRounds  int
	FloorKills   int

	// The FR-29 rung keys, all three NULLABLE (0023:97-115 declares them `text` with closed-set
	// CHECKs that admit NULL).
	//
	// ⭐ ABSENT IS THE EMPTY STRING, and that is a DELIBERATE representation choice stated here
	// rather than left to a reader. Go has no nullable string, and a `*string` would put a
	// pointer identity into a value type that is compared and copied freely. `""` costs nothing
	// and buys the property the vector actually needs: `encoding/json` leaves this field at its
	// zero value for a JSON `null` AND for an OMITTED key, so both spell "absent" here without a
	// single line of loader code. `stage2-resolve.json`'s award objects carry none of the three
	// and must keep not carrying them — that file has to regenerate with `outcome_kinds` as its
	// only changed bytes.
	//
	// ⚠ THE COST, AND WHY IT IS PAID ON PURPOSE: Go cannot tell "absent" from "present and
	// empty". So `""` MUST mean absent in the other two runtimes too, or the seam disagrees on
	// an input neither would report — the same class of divergence the 6-4b review resolved for
	// an absent container. The vector carries it as a CASE (not a refusal) whose expected block
	// is byte-identical to its `null` twin, in the shape `an-omitted-shelf-key-is-the-empty-
	// shelf` established.
	//
	// ⚠ ALL THREE ARE NOW FILLED FOR ALL TWELVE SHIPPED AWARDS — 6.5's catalog pass (Question 2,
	// measured) set `secondary_stat` and the `kills`/`deaths` efficiency pair on every one, so the
	// deterministic SKIP these fields describe (ladder.go's L2) is exercised by the VECTOR and by a
	// reduced 6.6 award, never by a shipped ceremony. The fields stay nullable because 0023's
	// columns are. (Comment corrected at the Group-1 code review, 2026-08-04 — it still said "absent
	// until 6.5 fills them" in the commit that filled them.)
	SecondaryStat string
	EffNumKey     string
	EffDenKey     string
}

// RatePair is one AD-19 `{num, den}` integer pair. It is NEVER pre-divided: the snapshot
// deliberately carries the two integer halves and 0024:690-691 refuses to divide them, because a
// `numeric` quotient is not reproducible across two runtimes.
//
// ⚠ A `Den` of 0 is CORRECT and reachable, not a defect to coalesce away — see the note on
// compareValues.
type RatePair struct {
	Num *big.Int
	Den *big.Int
}

// SnapshotPlayer is one `stat_snapshot_row` in AD-19 integer form (0024:664-737).
//
// ⚠ IdleDQ carries the SNAPSHOT's meaning, which differs from `stat_row.idle_dq`: it is true iff
// the player has AT LEAST ONE approved row and EVERY one of them is idle — "fully DQ'd"
// (0024:909-916). A rostered player with ZERO approved rows is `false` with zero stats: winless,
// not disqualified.
type SnapshotPlayer struct {
	SteamID64    string
	RoundsPlayed *big.Int
	Kills        *big.Int
	IdleDQ       bool

	// Volume holds the 17 integer totals; Rate the four `{num,den}` pairs. An ABSENT key is a
	// refusal, never a zero — a zero would silently become a real comparison, the same doctrine
	// 0024:918-923 applies to an absent h2h opponent.
	Volume map[string]*big.Int
	Rate   map[string]RatePair

	// ── The four AD-19 blocks Story 6.5 is the FIRST consumer of (0024:716-737). ──────────────
	//
	// Nothing had ever read them: 6-4a took `volume` / `rate` / `rounds_played` / `kills` /
	// `idle_dq` and stopped, because the FR-29 rungs that need these had made no decisions yet.

	// Secondary is rung 1's block: `volume || rate` (0024:723), so every one of the 21
	// vocabulary keys in its CLASS-SHAPED form — an integer for a volume key, a `{num,den}` pair
	// for a rate key.
	//
	// ⭐ IT IS THE SAME TYPE `H2H`'s inner map uses, deliberately, because 0024 builds both from
	// the same `p.vol || p.rat` expression (`:650`, `:723`). Two near-identical types is how the
	// two runtimes drift.
	Secondary map[string]StatValue

	// Efficiency is rung 2's block: every key in the UNIFORM `{num,den}` form, so a volume key
	// `k` with value `v` arrives as `{v, 1}` (`snapshot_efficiency_form`, 0024:338-370 — the ONE
	// definition site; do not restate the shape at a call site). That uniformity is what lets a
	// rung-2 ratio over two arbitrary vocabulary keys resolve by pure integer cross-
	// multiplication with no class branching and no division.
	Efficiency map[string]RatePair

	// H2H is rung 3's block: `{opponent_steamid64: {the same class-shaped union}}` over the
	// matches the two players SHARED.
	//
	// ⛔ AN ABSENT OPPONENT KEY IS THE `NEVER MET` SIGNAL AND IS NEVER A ZERO (0024:918-923,
	// verbatim: "a zero would silently become a real comparison"). It is `{}` for a player with
	// no shared approved matches, and a player is never a key in their own map.
	H2H map[string]map[string]StatValue

	// AchievementTS is rung 4's value: an epoch-MILLISECOND integer with the PUBLISHED ABSENT
	// SENTINEL `-1` (0024:703-709, 898-907). It is NEVER NULL in the snapshot.
	//
	// ⭐ `-1` IS NUMERICALLY THE SMALLEST VALUE IN THE COLUMN, which is the whole reason
	// ladder.go's L9 exists: a naive `min` over this field crowns the player with NO APPROVED
	// ROWS AT ALL, for a rung whose entire meaning is "did it first".
	//
	// ⚠ It is a DOCUMENTED PROXY — `min(stat_row.approved_at)`, i.e. admin approval order, not a
	// demo tick (deferred-work.md:282).
	AchievementTS *big.Int
}

// StatValue is AD-19's CLASS-SHAPED integer union: an integer for a volume key, a `{num,den}`
// pair for a rate key.
//
// ⭐ IT IS `DecidingValue`, REUSED RATHER THAN RESTATED. The two are the same shape because they
// are the same thing — one integer value read out of the frozen snapshot, branched on the key's
// class — and Story 6.5's rungs 1 and 3 must compare them with the EXACT arithmetic Stage 2 uses
// (`compareValues`: cross-multiplication, never `num == num && den == den`, and 6-4a's verbatim
// zero-denominator total order). A second near-identical type would be a second comparator
// waiting to be written, which is precisely how the producer and the verifier drift apart.
//
// ⚠ THE `DISPLAY ONLY` WARNING ON `DecidingValue` IS ABOUT THE OUTCOME FIELD, not about the
// shape. `Outcome.DecidingValue` is display-only and nothing re-derives a winner from it; the
// TYPE is just "a class-shaped integer", and `Secondary` / `H2H` are genuine resolution inputs.
type StatValue = DecidingValue

// OutcomeKind is the closed set of things Stage 2 can conclude.
//
// ⭐ THIS SHAPE IS THE SEAM 6-4b, 6.5 AND 6.8 ALL INHERIT. A tie is a RETURNED OUTCOME, not a
// resolution and not an error state — EXPERIENCE.md:123 calls a shared co-winner a designed
// outcome, and AD-14 requires an equal deciding value to enter the FR-29 ladder rather than be
// settled by a silent argmax over iteration order.
type OutcomeKind string

const (
	KindWinner            OutcomeKind = "winner"
	KindTie               OutcomeKind = "tie"
	KindNoEligiblePlayers OutcomeKind = "no_eligible_players"
	KindNoAwardableValue  OutcomeKind = "no_awardable_value"

	// KindShared is Story 6.5's FIFTH ARM: the FR-29 ladder bottomed out at rung 5 and the award
	// is genuinely SHARED by every survivor.
	//
	// ⭐ A DESIGNED OUTCOME, NEVER AN ERROR STATE — EXPERIENCE.md:123 says so in those words, and
	// FR-29, AD-14, epics.md:1084 and SOLUTION-DESIGN §9.3 all end the ladder here. It is the
	// deterministic TERMINAL rung (DECISION H, Cuatro 2026-08-04): there is no seeded rung below
	// it, which is what keeps the ladder a zero-byte function and 6-4b's measured 22-byte
	// ceremony valid.
	//
	// ⚠ THE PURE STAGE CAN NEVER PRODUCE IT. `ResolveStage2` resolves no tie, so `shared` only
	// ever comes out of a ladder — pinned over every case in the vector by
	// `TestPureStage2NeverProducesALadderOutcome`.
	KindShared OutcomeKind = "shared"
)

// LadderExitStep is which FR-29 rung decided a ladder-resolved award: 1..5, or 0 for "no ladder
// was involved".
//
// ⭐ AS LOAD-BEARING AS THE WINNER, and 6.8 is why: it persists this as
// `award_result.tie_ladder_exit_step` (SOLUTION-DESIGN:222, nullable), so a ladder that reaches
// the RIGHT player by the WRONG rung ships a false explanation to the audience. Every vector case
// pins it.
const (
	LadderExitNone       = 0 // no ladder ran — the column is NULL
	LadderExitSecondary  = 1
	LadderExitEfficiency = 2
	LadderExitH2H        = 3
	LadderExitAchieved   = 4
	LadderExitShared     = 5
)

// TieReason records WHICH equality tied the award, because the two are different bugs when they
// are wrong: an equal integer and an equal cross product over different `{num,den}` pairs.
type TieReason string

const (
	ReasonEqualValue        TieReason = "equal_value"
	ReasonEqualCrossProduct TieReason = "equal_cross_product"
)

// DecidingValue is the winning value.
//
// ⛔ DISPLAY ONLY. `award_result.deciding_value` carries the identical warning at
// SOLUTION-DESIGN:219 — "display only; never an input to resolution". Nothing in this file reads
// it back, and nothing downstream may re-derive a winner from it: the winner is a function of the
// snapshot, and a rendered value that disagreed with the snapshot would be a display bug, never
// a different result.
type DecidingValue struct {
	Class AwardClass

	// Value is set for ClassVolume; Num/Den for ClassRate. The unused half stays nil.
	Value *big.Int
	Num   *big.Int
	Den   *big.Int
}

// Outcome is Stage 2's answer for one award.
type Outcome struct {
	Kind OutcomeKind

	// Winner only.
	SteamID64     string
	DecidingValue DecidingValue

	// Tied is the FULL set in byte-lex order — never the first, never the last, never the lowest
	// SteamID64. It is populated for KindTie and, since the 6-4a code review, ALSO for
	// KindNoAwardableValue: DECISION E's zero check runs before the |best| branch, so without
	// carrying the set here the tie that would have formed is discarded and 6.5 / 6.6 / 6.7
	// cannot see how wide it was — the 27-way zero tie deferred-work.md:270 predicted would
	// arrive as a bare kind. On a KindNoAwardableValue outcome len(Tied) IS that width, and it
	// is 1 when a lone eligible player sat at zero.
	//
	// Reason is KindTie only: nothing "tied" when the suppressed set holds one player.
	Tied   []string
	Reason TieReason

	// Winners is KindShared only: the FULL surviving set in byte-lex order, never a first and
	// never a lowest SteamID64. It is a SEPARATE field from Tied on purpose — Tied is the tie
	// that FORMED, Winners is who actually WON, and on a narrowed ladder those differ (a width-3
	// tie can share between two).
	Winners []string

	// LadderExitStep is 1..5 when the FR-29 ladder decided this award and LadderExitNone (0)
	// otherwise. It rides on KindWinner (rungs 1-4) as well as on KindShared (always 5), because
	// "A won" and "A won at rung 3" are different facts and 6.8 stores the second.
	LadderExitStep int
}

// Ladder is the FR-29 tiebreak PORT (Story 6.5).
//
// ⭐ IT IS INJECTED, AND ITS 6-4a-ERA IMPLEMENTATION REFUSES. The spec assumes Stage 2 yields one
// player. It does not, and it must not: 6.2's review proved the most common tie shape in a 1v1
// bracket is GUARANTEED to reach the ladder's rung 4 and fail there (deferred-work.md:281, a
// named blocker on 6.5). Every self-contained fallback — first-in-byte-lex, lowest SteamID64,
// the running-max accident — is a silent argmax wearing a different hat: it produces a plausible
// winner that 6.5 will later contradict, changing the drawn bytes and the whole ceremony from
// that spin onward, with nothing red anywhere.
//
// Resolve receives the tie Outcome whole and returns whatever the ladder concludes. It returns
// an Outcome rather than a bare winner on purpose: what a LADDER-resolved award looks like is
// 6.5's design, and inventing a field for it here would be inventing a contract for a story that
// has not made its decisions.
//
// ⭐ WIDENED BY STORY 6.5 TO CARRY THE PLAYERS, and the reason is structural rather than
// convenient: rungs 1-4 read `Secondary`, `Efficiency`, `H2H` and `AchievementTS`, none of which
// is on an `Award` or on a tie's `[]string`. The 6-4a signature could not see the data the ladder
// exists to read, so the port grows rather than the ladder guessing.
//
// ⛔ THERE IS NO `*Stream` PARAMETER, AND THE SIGNATURE IS THE PROOF (ladder.go's L1). The FR-29
// ladder consumes ZERO PRNG bytes: rung 5 is deterministic, so nothing below it needs randomness.
// A runtime assertion that "the ladder drew nothing" is VACUOUS against a function that cannot
// reach a stream — the 6-4b code review deleted exactly that assertion — so the property is
// carried here, by the type, where no implementation can opt out of it.
type Ladder interface {
	Resolve(award Award, tie Outcome, players []SnapshotPlayer) (Outcome, error)
}

// LadderRefusedError is what a ladder that cannot resolve a tie returns. It carries the tie
// whole so a caller — 6-4b's `provisional_winner`, most immediately — can see the tied set and
// its reason instead of only a message.
type LadderRefusedError struct {
	Award Award
	Tie   Outcome
}

func (e *LadderRefusedError) Error() string {
	return "awards: Stage 2 tied on " + e.Award.DecidingStat + " (" + string(e.Tie.Reason) +
		", " + itoa(len(e.Tie.Tied)) + " players) and the FR-29 tiebreak ladder is not implemented" +
		" — it is Story 6.5's. Stage 2 will not pick one: every self-contained fallback is a" +
		" silent argmax that 6.5 would later contradict"
}

// RefusingLadder is the 6-4a-era Ladder: it refuses, loudly, naming the story that supplies the
// real one. It is the DEFAULT and there is deliberately no dev-only fallback ladder in this
// package — a fallback that exists is a fallback someone wires into production.
//
// ⭐ IT SURVIVES STORY 6.5 AND IT STAYS REFUSING (DECISION J). Now that `FR29Ladder` exists, the
// temptation is to delete this — but it is what EVERY tie row in `stage2-resolve.json` is driven
// through, and 6-4a's mutation M13 (the ladder's refusal swallowed by `ResolveAward`) only became
// vector-killable that way. Deleting it would silently weaken the Stage-2 gate while this story
// was busy elsewhere, and would make that file impossible to regenerate byte-identically.
type RefusingLadder struct{}

// Resolve returns the tie unchanged alongside the refusal. Both halves matter: the error is what
// makes the refusal impossible to ignore, and the Outcome is what makes the tied set readable.
//
// `players` is accepted and deliberately unused: this ladder refuses before it could read
// anything, and the parameter exists so the type satisfies the widened port.
func (RefusingLadder) Resolve(award Award, tie Outcome, _ []SnapshotPlayer) (Outcome, error) {
	return tie, &LadderRefusedError{Award: award, Tie: tie}
}

// ResolveAward is the full Stage-2 entry point: resolve, and hand any tie to the injected ladder.
//
// ⚠ The tie path genuinely CALLS the ladder rather than merely declaring the port, so the seam is
// exercised by every tie case in the vector suite. Swallowing the ladder's error here — returning
// `out, nil` — would turn a refusal into a silent tie-shaped success.
func ResolveAward(award Award, players []SnapshotPlayer, ladder Ladder) (Outcome, error) {
	if ladderIsNil(ladder) {
		return Outcome{}, fmt.Errorf(
			"%w: a Ladder must be injected — Stage 2 never resolves a tie itself", ErrStage2)
	}
	out, err := ResolveStage2(award, players)
	if err != nil {
		return out, err
	}
	if out.Kind != KindTie {
		return out, nil
	}
	// ⭐ THE PLAYERS TRAVEL WITH THE TIE (Story 6.5). The ladder receives the SAME slice Stage 2
	// resolved over — not a re-read and not a re-filter — because L12 forbids the ladder from
	// re-applying the FR-21 floors or re-deriving the deciding value: doing either could empty
	// the set or disagree with the caller about who is even in the race.
	return ladder.Resolve(award, out, players)
}

// ladderIsNil reports whether the injected Ladder is unusable.
//
// ⭐ A PLAIN `ladder == nil` IS NOT ENOUGH, and the 6-4a code review measured why: an interface
// holding a TYPED nil (`var l *someLadder; ResolveAward(award, players, l)`) is itself non-nil,
// so the plain check passes and the tie path then dereferences a nil receiver — a panic that
// takes the worker down instead of the documented refusal. TypeScript's guard is structural
// (`typeof ladder.resolve !== 'function'`) and already rejected every such shape, so the two
// halves of the seam 6-4b and 6.5 inherit did not refuse the same inputs.
//
// `reflect` is used ONLY here. It reaches no decision: the resolution itself never touches it.
func ladderIsNil(ladder Ladder) bool {
	if ladder == nil {
		return true
	}
	v := reflect.ValueOf(ladder)
	switch v.Kind() {
	case reflect.Pointer, reflect.Interface, reflect.Map, reflect.Slice, reflect.Func:
		return v.IsNil()
	default:
		return false
	}
}

// ResolveStage2 is the pure stage: no ladder, no I/O, no clock, no randomness.
//
// It is exported separately from ResolveAward because 6-4b needs the raw outcome — a tied award
// has no single `provisional_winner`, and Stage 1 must see that rather than be handed a ladder's
// answer or a refusal it cannot inspect.
func ResolveStage2(award Award, players []SnapshotPlayer) (Outcome, error) {
	if err := validateAward(award); err != nil {
		return Outcome{}, err
	}

	eligible, err := eligiblePlayers(award, players)
	if err != nil {
		return Outcome{}, err
	}
	// S5 — an empty eligible set is a TYPED OUTCOME, not a crash and not a zero-winner. It is
	// reachable today, not hypothetically: 6.2 measured 0 of 28 players clearing the shipped
	// 24/20 floors on the real corpus (deferred-work.md:269).
	if len(eligible) == 0 {
		return Outcome{Kind: KindNoEligiblePlayers}, nil
	}

	// Read every ELIGIBLE player's value up front, so a missing or malformed key refuses even
	// for a player who would have lost. An ineligible player is never read — they are not in the
	// race, and a tripwire on rows nobody consults is not a signal.
	values := make([]DecidingValue, len(eligible))
	for i, p := range eligible {
		v, err := decidingValue(award, p)
		if err != nil {
			return Outcome{}, err
		}
		values[i] = v
	}

	// ⭐ S7 — "BEST" IS COMPUTED AS A SET: best = { p : no q beats p }. A running champion
	// replaced on `>` silently keeps the FIRST of an equal pair and IS the argmax AD-14 forbids;
	// replaced on `>=` it silently keeps the LAST. Both produce a plausible winner and nothing
	// red anywhere. n <= the roster, so the quadratic scan is free and obviously correct.
	best := make([]int, 0, len(eligible))
	for i := range eligible {
		beaten := false
		for j := range eligible {
			won, err := beats(award, values[j], values[i])
			if err != nil {
				return Outcome{}, err
			}
			if won {
				beaten = true
				break
			}
		}
		if !beaten {
			best = append(best, i)
		}
	}
	if len(best) == 0 {
		// Unreachable: compareValues is TOTAL — every pair is comparable — and with non-negative
		// denominators (enforced in decidingValue) its STRICT part is acyclic, so somebody is
		// always unbeaten.
		//
		// ⚠ IT IS NOT A TOTAL PREORDER, and the 6-4a code review corrected this comment for
		// claiming it was. A 0/0 rate cross-multiplies to 0 against EVERY pair, so indifference
		// is not transitive: 0/0 ~ 10/5 and 0/0 ~ 6/5 while 10/5 > 6/5. The vector carries that
		// counterexample by name (`rate-zero-denominator-is-equal-to-everyone`). This guard holds
		// because of ACYCLICITY, not transitivity — do not "simplify" it against the wrong
		// reason. Loud rather than silent if acyclicity ever stops being true: an empty best set
		// would otherwise become a phantom no-winner.
		return Outcome{}, fmt.Errorf(
			"%w: empty best set over %d eligible players — the comparator's strict part is not acyclic",
			ErrStage2, len(eligible))
	}

	bestValue := values[best[0]]

	// ⭐ DECISION E (Cuatro, 2026-08-04). A `max` VOLUME award whose best deciding value is 0 has
	// NO WINNER, rather than crowning a whole-roster co-win over a stat nobody scored on. This is
	// the measured case, not a hypothetical: 6.1's review found `knife_kills` non-zero for 1 of 28
	// players, so if that player misses the floors award #6 is a 27-way tie at zero
	// (deferred-work.md:270), and lib/awards/catalog.ts:132-137 hands the question here by name.
	//
	// ⚠ SCOPE IS DELIBERATE AND NARROW. `min` awards are untouched — fewest deaths is an
	// achievement. `rate` awards are untouched — the vector pins both halves, so widening this
	// reddens `volume-min-zero-is-awardable` and `rate-max-zero-numerator-is-awardable`. And it
	// is a rule about the VALUE, not the tie width: one lone eligible player at zero still wins
	// nothing.
	//
	// ⭐ IT CARRIES THE SUPPRESSED SET (6-4a code review). The check runs BEFORE the |best|
	// branch, so the tie that would have formed never becomes a KindTie; carrying `Tied` is what
	// keeps its WIDTH visible to 6.5 / 6.6 / 6.7 instead of handing them a bare kind. No Reason:
	// nothing tied when the set holds one player.
	if award.Class == ClassVolume && award.Direction == DirectionMax && bestValue.Value.Sign() == 0 {
		return Outcome{Kind: KindNoAwardableValue, Tied: tiedSet(eligible, best)}, nil
	}

	if len(best) == 1 {
		return Outcome{
			Kind:          KindWinner,
			SteamID64:     eligible[best[0]].SteamID64,
			DecidingValue: bestValue,
		}, nil
	}

	// AC2 — the FULL tied set, in byte-lex order, with the reason it tied. Never pick one.
	reason := ReasonEqualValue
	if award.Class == ClassRate {
		reason = ReasonEqualCrossProduct
	}
	return Outcome{Kind: KindTie, Tied: tiedSet(eligible, best), Reason: reason}, nil
}

// tiedSet projects the best-set indices back onto ids, preserving the byte-lex order `eligible`
// already carries.
func tiedSet(eligible []SnapshotPlayer, best []int) []string {
	out := make([]string, len(best))
	for i, idx := range best {
		out[i] = eligible[idx].SteamID64
	}
	return out
}

// beats reports whether a is strictly better than b for this award.
//
// S1 — `direction` inverts "BEST", AND ONLY "BEST". It does not invert the floors (DECISION C:
// `El Inofensivo` keeps its `floor_kills = 20` even though a kill floor on the catalog's only
// `min` award is anti-QUALIFICATION — deferred-work.md:268), and it does not change the tie rule:
// equal is still equal in both directions.
func beats(award Award, a, b DecidingValue) (bool, error) {
	c, err := compareValues(award.Class, a, b)
	if err != nil {
		return false, err
	}
	if award.Direction == DirectionMax {
		return c > 0, nil
	}
	return c < 0, nil
}

// compareValues returns sign(a - b) for a volume pair and sign(a.num*b.den - b.num*a.den) for a
// rate pair.
//
// ⭐ S3 — A ZERO DENOMINATOR IS A REAL, REACHABLE INPUT. A rostered player with zero approved rows
// is `idle_dq = false` with zero stats (0024:909-916), so their `adr` is 0/0. Cross-multiplication
// is TOTAL: with a `Den` of 0 both products are still computable. Two such players compare EQUAL
// and therefore tie. Nothing here divides, nothing throws, and nothing filters them out — a
// silent den-0 filter is an argmax by another name.
//
// ⚠ S3 HAS TWO CONSEQUENCES the original note left unstated; the 6-4a code review surfaced both
// and each now has its own vector row rather than waiting to be discovered in a ceremony:
//
//  1. 0/0 compares EQUAL TO EVERY PAIR (0*q.Den == q.Num*0 == 0), so a player with no data is
//     unbeatable and always lands in `best`. With A=0/0, B=10/5, C=6/5 the answer is a TIE of
//     {A,B} even though B beats C outright — an unambiguous win becomes the ladder's refusal.
//     Pinned by `rate-zero-denominator-is-equal-to-everyone` and, under the catalog's REAL
//     floors, by `rate-zero-denominator-clears-a-real-floor` (entry_success's denominator has no
//     volume counterpart, so a den-0 player can clear 24/20).
//  2. n/0 WITH n > 0 BEATS EVERY FINITE RATE at any magnitude (n*q.Den > q.Num*0 == 0) — it
//     behaves as +infinity and is crowned outright, with 1/0 rendered as the deciding value.
//     Pinned by `rate-max-positive-numerator-over-zero-beats-every-finite-rate`.
//
// Both are the formula applied verbatim, reported rather than patched around: excluding den-0
// players is exactly the silent filter S3 forbids.
//
// ⭐ S4 — THE ARITHMETIC MUST NOT OVERFLOW, and this is the highest-value divergence in the story
// because a wrapped product yields a PLAUSIBLE winner. `math/big` is stdlib and unbounded, which
// is exactly the property the TypeScript verifier gets from `BigInt`. It is NOT the same trade as
// prng.go, where `n <= 2^32` bounds `256^k` inside a uint64 by construction — here the operands
// are snapshot magnitudes with no such bound, so the package ban on `math/big` is scoped to the
// PRNG files rather than to the package (see TestPackageSourceHasNoBannedConstructs).
//
// ⚠ EQUALITY IS THE CROSS PRODUCT, never `(num == num && den == den)`. 3/6 and 2/4 are the same
// value carried by different pairs, and a pair-equality check misses that tie entirely.
//
// ⛔ THE MIXED-CLASS ARM REFUSES, it does not dereference. Both languages call it unreachable —
// every value in one resolution is read through the same award's class — but before the 6-4a code
// review only TypeScript FAILED SAFELY there: Go took the class from the award and dereferenced
// whichever half it expected, so a caller constructing a mismatched DecidingValue got a
// nil-pointer panic that takes the worker down instead of a typed refusal. That is the same defect
// this package already fixed once in the test loader (a malformed vector row panicking the whole
// binary rather than failing one named test), re-introduced in the production path.
func compareValues(class AwardClass, a, b DecidingValue) (int, error) {
	if class == ClassVolume {
		if a.Class != ClassVolume || b.Class != ClassVolume || a.Value == nil || b.Value == nil {
			return 0, fmt.Errorf("%w: cannot compare a volume value with a rate value", ErrStage2)
		}
		return a.Value.Cmp(b.Value), nil
	}
	if a.Class != ClassRate || b.Class != ClassRate ||
		a.Num == nil || a.Den == nil || b.Num == nil || b.Den == nil {
		return 0, fmt.Errorf("%w: cannot compare a rate value with a volume value", ErrStage2)
	}
	left := new(big.Int).Mul(a.Num, b.Den)
	right := new(big.Int).Mul(b.Num, a.Den)
	return left.Cmp(right), nil
}

// decidingValue reads one player's deciding stat, branching on the award's CLASS.
//
// ⭐ EVERY MAGNITUDE IS COPIED, never aliased. `*big.Int` is a mutable pointer, so returning the
// caller's own value would put the frozen snapshot inside the Outcome: a later in-place mutation
// anywhere downstream (6.8's persistence normalising a value, most plausibly) would retroactively
// change an already-returned `deciding_value`. TypeScript cannot exhibit this — `bigint` is an
// immutable value — so it is a producer-only divergence of exactly the class this directory
// exists to catch, and the 6-4a code review caught it. The copy costs one allocation per eligible
// player per award.
func decidingValue(award Award, p SnapshotPlayer) (DecidingValue, error) {
	switch award.Class {
	case ClassVolume:
		v, ok := p.Volume[award.DecidingStat]
		if !ok || v == nil {
			return DecidingValue{}, fmt.Errorf(
				"%w: volume key %q absent from %s's stats_int.volume — an absent key is a refusal, never a zero",
				ErrStage2, award.DecidingStat, p.SteamID64)
		}
		if v.Sign() < 0 {
			return DecidingValue{}, fmt.Errorf(
				"%w: volume %q is negative for %s — every volume stat is a count",
				ErrStage2, award.DecidingStat, p.SteamID64)
		}
		return DecidingValue{Class: ClassVolume, Value: new(big.Int).Set(v)}, nil

	case ClassRate:
		pair, ok := p.Rate[award.DecidingStat]
		if !ok || pair.Num == nil || pair.Den == nil {
			return DecidingValue{}, fmt.Errorf(
				"%w: rate key %q absent from %s's stats_int.rate — an absent key is a refusal, never a zero",
				ErrStage2, award.DecidingStat, p.SteamID64)
		}
		// ⛔ A NEGATIVE DENOMINATOR SILENTLY INVERTS THE COMPARISON: `a.num*b.den > b.num*a.den`
		// is the right test only while both denominators are non-negative, and with one negative
		// the inequality flips and the resolver returns a plausible, wrong winner. Every rate
		// half is a count (0021:66-71,84,108) and 0024 coalesces to 0, so this is unreachable
		// from a real snapshot — which is precisely why it is loud rather than trusted. `Den == 0`
		// stays LEGAL (S3); only a negative is refused.
		if pair.Num.Sign() < 0 || pair.Den.Sign() < 0 {
			return DecidingValue{}, fmt.Errorf(
				"%w: rate %q has a negative half for %s — both halves are counts",
				ErrStage2, award.DecidingStat, p.SteamID64)
		}
		return DecidingValue{
			Class: ClassRate,
			Num:   new(big.Int).Set(pair.Num),
			Den:   new(big.Int).Set(pair.Den),
		}, nil
	}
	// Unreachable: validateAward pinned the class to the closed set before eligibility ran.
	return DecidingValue{}, fmt.Errorf("%w: unknown award class %q", ErrStage2, award.Class)
}

// eligiblePlayers applies the FR-21 floors over the byte-lex-ordered roster.
func eligiblePlayers(award Award, players []SnapshotPlayer) ([]SnapshotPlayer, error) {
	// Never sort the CALLER's slice: a resolver that reordered its input would make two
	// consecutive resolutions over the same snapshot observably different operations.
	ordered := make([]SnapshotPlayer, len(players))
	copy(ordered, players)

	seen := make(map[string]struct{}, len(ordered))
	for _, p := range ordered {
		if err := validSteamID64(p.SteamID64); err != nil {
			return nil, err
		}
		if _, dup := seen[p.SteamID64]; dup {
			return nil, fmt.Errorf(
				"%w: duplicate steamid64 %q — a snapshot holds one row per player",
				ErrStage2, p.SteamID64)
		}
		seen[p.SteamID64] = struct{}{}
		if p.RoundsPlayed == nil || p.Kills == nil {
			return nil, fmt.Errorf(
				"%w: %q has a nil eligibility input — 0024 coalesces both to 0, never NULL",
				ErrStage2, p.SteamID64)
		}
		// The eligibility inputs are read for EVERY player, so they are validated for every
		// player. The deciding magnitudes are validated where they are read, which is only for
		// the eligible ones.
		if p.RoundsPlayed.Sign() < 0 || p.Kills.Sign() < 0 {
			return nil, fmt.Errorf(
				"%w: %q has a negative eligibility input — both are counts", ErrStage2, p.SteamID64)
		}
	}

	// ⭐ S6 — ITERATION ORDER IS BYTE-LEX OVER THE DECIMAL SteamID64 *STRING*. Go's `<` on strings
	// is byte-wise, which is what makes this agree with the snapshot's own
	// `order by p.steamid64 collate "C"` (0024:732, named at :545-547 as "Story 6.4's Stage-2
	// iteration order"). It is NOT a numeric order — "10" sorts before "9" — and every real
	// SteamID64 being 17 digits is exactly why that difference needs its own vector case rather
	// than being assumed harmless. sort.Slice needs no stability here: the ids are unique (proven
	// just above), so the order is total.
	sort.Slice(ordered, func(i, j int) bool { return ordered[i].SteamID64 < ordered[j].SteamID64 })

	// S2 — the floor test is `>=`, on the snapshot's OWN rounds_played / kills, plus `not
	// idle_dq`. `floor_kills` is 0 for volume awards and 20 for rate awards; a 0 floor still runs
	// the comparison rather than being special-cased away.
	floorRounds := big.NewInt(int64(award.FloorRounds))
	floorKills := big.NewInt(int64(award.FloorKills))

	out := make([]SnapshotPlayer, 0, len(ordered))
	for _, p := range ordered {
		if p.IdleDQ {
			continue
		}
		if p.RoundsPlayed.Cmp(floorRounds) < 0 {
			continue
		}
		if p.Kills.Cmp(floorKills) < 0 {
			continue
		}
		out = append(out, p)
	}
	return out, nil
}

// validateAward refuses a malformed award BEFORE eligibility is computed.
//
// ⚠ THE ORDER IS PART OF THE CONTRACT, and the vector now pins it: a malformed award refuses
// regardless of whether anyone would have cleared its floors. The Python anchor did not validate
// at all until the 6-4a code review, which is why "direction outside the enum", "a negative
// floor" and "an empty deciding_stat" could not be expressed as shared refusal rows and lived in
// two hand-written per-language lists instead.
func validateAward(award Award) error {
	if award.DecidingStat == "" {
		return fmt.Errorf("%w: award.DecidingStat must be set", ErrStage2)
	}
	if award.Class != ClassVolume && award.Class != ClassRate {
		return fmt.Errorf(
			"%w: unknown award class %q — 0023 constrains it to volume|rate", ErrStage2, award.Class)
	}
	if award.Direction != DirectionMax && award.Direction != DirectionMin {
		return fmt.Errorf(
			"%w: unknown award direction %q — 0023 constrains it to max|min", ErrStage2, award.Direction)
	}
	if award.FloorRounds < 0 || award.FloorKills < 0 {
		return fmt.Errorf(
			"%w: floors must be non-negative — 0023's award_floors_non_negative", ErrStage2)
	}
	return nil
}

// validSteamID64 accepts a non-empty decimal string and nothing else.
//
// Checked character by character rather than with a regexp, mirroring DecodeSeed: the shape is
// trivial and the loop is the whole rule, visible at the site. It is deliberately NOT pinned to
// 17 digits — the column is `text`, this file is a resolver rather than a SteamID64 validator,
// and the vector's byte-lex case needs short synthetic ids to tell a string sort from a numeric
// one at all.
func validSteamID64(s string) error {
	if s == "" {
		return fmt.Errorf("%w: steamid64 must be a non-empty decimal string", ErrStage2)
	}
	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return fmt.Errorf("%w: steamid64 must be a decimal string, got %q", ErrStage2, s)
		}
	}
	return nil
}

// itoa renders a small non-negative int for an error message.
//
// Hand-rolled because `fmt.Sprintf` is banned package-wide (a width verb silently pads a value
// that keys a stream) and `strconv` would be an extra import for one call site. The only caller
// is LadderRefusedError.Error, which is diagnostics — nothing here reaches a decision.
//
// ⚠ The domain is non-negative by construction (`len(...)`). A negative argument is not silently
// truncated to "" — it is refused visibly, because a hand-rolled partial function whose failure
// mode is a truncated error message is exactly the silent plausibility this file exists to reject.
func itoa(n int) string {
	if n < 0 {
		return "?"
	}
	if n == 0 {
		return "0"
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}
