package awards

import (
	"errors"
	"sort"
)

// Anti-sweep — at most one trophy per player per spin (Story 6.6, FR-26 / AD-14 /
// SOLUTION-DESIGN §9.4 / review-data-integrity.md M1).
//
//	resolve_spin(live, players, ladder):
//	    validate(live)                                  # A2, A13 — the WHOLE set, FIRST
//	    ordered  = sort(live, by ascending award.priority)      # A2 — over a COPY
//	    assigned = {}
//	    for a in ordered:
//	        reduced   = [ p for p in players if p.steamid64 not in assigned ]   # A3 / DECISION E'
//	        swept_out = [ p.steamid64 for p in players if p.steamid64 in assigned ]
//	        out = ResolveStage2(a.Award, reduced)       # A4 / DECISION D — a FULL re-run
//	        if out.Kind == tie:
//	            out = ladder.Resolve(a.Award, out, reduced)     # A8 — width >= 2 by construction
//	        winners = out.Winners  (shared)  |  [out.SteamID64]  (winner)  |  []   # A5, A6
//	        assigned |= winners
//	    return { results, sorted(assigned) }
//
// ⛔ NO STREAM, NO CLOCK, NO RANDOMNESS, NO I/O (A1), AND THE SIGNATURE IS THE PROOF. Re-resolution
// is Stage 2 plus the FR-29 ladder, and both are pure — `stage2.go:339-343` and `ladder.go`'s L1
// carry the same discipline for the same reason. ⛔ Do NOT add a `*Stream` parameter "for the
// overflow": a runtime `Consumed()` assertion around a function that cannot reach a stream is
// VACUOUS (the 6-4b code review deleted exactly that assertion), and a byte drawn here would move
// every stream position after it and invalidate 6-4b's measured 22-byte twelve-spin ceremony,
// which Story 6.9's browser has to reproduce exactly.
//
// ⛔ NO `math/big` HERE, AND `prng_test.go`'s exception list MUST NOT BE WIDENED FOR THIS FILE.
// This pass performs no arithmetic of its own: every comparison it depends on is delegated to
// `ResolveStage2` and to the injected `Ladder`, both of which hold the exemption because THEIR
// operands are unbounded snapshot magnitudes. The same argument Story 6-4b was told to make about
// `stage1.go`, made again — the exemption is about the arithmetic, never the convenience.
//
// THE SEAM (ARCHITECTURE-SPINE.md:73-76). This file conforms to `roulette/vectors/antisweep-
// resolve.json`, never to lib/roulette/sweep.ts. Two independent implementations of one spec;
// neither is the reference and neither may be corrected by reading the other. When they disagree
// the vector decides; when the vector is silent, add a vector.
//
// ⛔ NOT IN THIS FILE, each with an owner: the luck-meter's VALUES and the shelf (6.6's Task 5, but
// `stage1.go` — this pass never touches a shelf, see A10), the pity draw and the winless sweep
// (6.7), every WRITE to `spin` / `award_result` / `award_result_winner` and the reveal axis (6.8),
// canonicalization and the bundle (6.9), any UI at all (6.10), the end-to-end ceremony vector
// (6.11). `worker/awards` stays the leaf `TestPackageIsALeaf` pins.

// ErrSweep is the sentinel every refusal in this file wraps.
//
// ⭐ TYPED, mirroring ErrStage1 and ErrLadder, and for the reason 6-4a measured one level up: with
// an untyped surface a vector-driven refusal gate can only assert "some error", so a mutation that
// made validation reject EVERY input leaves every refusal row passing.
var ErrSweep = errors.New("awards: anti-sweep refused")

// The closed set of things an anti-sweep refusal can be ABOUT (A12). Three distinct FACTS, three
// distinct labels, because they mean genuinely different things to a caller:
//
//	SweepDetailLive     the live set's own shape is wrong — a caller or spin-plan bug
//	SweepDetailStage2   the award surface or the snapshot is malformed — propagated, never swallowed
//	SweepDetailLadder   the FR-29 ladder ran and refused, or none was injected at all
//	SweepDetailInternal an invariant this file believes unreachable
//
// ⭐ AND IT IS GENUINELY CLOSED. Story 6-4b shipped a "closed set" that was 9 / 7 / 7 across three
// implementations with one input carrying two different labels; Story 6.5 shipped one whose fifth
// value no suite inspected. The vocabulary is declared once in the vector's `refusal_details`, all
// three implementations read it, and `TestSweepDetailsAreExactlyTheDeclaredSet` pins these
// constants against it so a fifth cannot be added on one side alone.
const (
	SweepDetailLive     = "live"
	SweepDetailStage2   = "stage2"
	SweepDetailLadder   = "ladder"
	SweepDetailInternal = "internal"
)

// ⚠ `internal` IS DECLARED AND IS NOT ROW-REPRESENTABLE, and the distinction is the whole reason
// this note exists (the rule `stage1.go:118-131` and `ladder.go`'s `refusal_details` both state).
// A vector row is a set of INPUTS, and every producer of `internal` here is a state no input can
// reach: `Ladder` is an INJECTED PORT, so it can hand this file an outcome no code in this package
// built — a non-tie-resolving kind, an empty winner set, an empty SteamID64 — none of which the
// shipped `FR29Ladder` can produce, because `validateLadder` refuses an empty tied member and
// `bestSurvivors` refuses an empty best set. The guards exist because 6.9's verifier reimplements
// the port and any third-party implementation reaches exactly these arms; they are driven by a STUB
// port in this package's own tests, which is the machinery Story 6-5b built for `stage1`'s twin
// pair. The generator refuses to write a row carrying this label.

// SweepInvalidError is every refusal, and it NAMES WHICH INPUT was rejected.
//
// Mirrors Stage1InvalidError (`stage1.go:133-159`) and LadderInvalidError deliberately: one shape
// for refusals across the package means one thing for a caller to switch on.
type SweepInvalidError struct {
	Detail string
	Reason string
	// Cause is the propagated Stage-2 or ladder refusal on those two details, nil otherwise.
	Cause error
}

func (e *SweepInvalidError) Error() string {
	return "awards: anti-sweep refused (" + e.Detail + "): " + e.Reason
}

// Unwrap returns BOTH ErrSweep and any propagated cause, so `errors.Is(err, ErrSweep)` answers
// "did the anti-sweep pass refuse" while `errors.Is(err, ErrStage2)` / `errors.Is(err, ErrLadder)`
// still says where a propagated refusal came from.
func (e *SweepInvalidError) Unwrap() []error {
	if e.Cause == nil {
		return []error{ErrSweep}
	}
	return []error{ErrSweep, e.Cause}
}

// sweepRefuse builds a typed refusal. Every non-propagating return in this file goes through it, so
// no refusal can reach a caller without naming its input.
func sweepRefuse(detail, reason string) error {
	return &SweepInvalidError{Detail: detail, Reason: reason}
}

// AwardAssignment is what one live award concluded, plus what anti-sweep did to its candidate set.
type AwardAssignment struct {
	AwardID  string
	Priority int

	// Outcome is Stage 2's answer over the REDUCED set, with a tie already resolved by the ladder.
	// ⚠ It can never be KindTie: every tie goes through the ladder, which returns KindWinner or
	// KindShared. The vector declares that as `unreachable_outcome_kinds` and both suites assert
	// zero rows carry it — an implementation that skipped the ladder would leak one.
	Outcome Outcome

	// SweptOut is every rostered player removed from THIS award's candidate set because they were
	// already assigned this spin, in byte-lex order.
	//
	// ⭐ IT IS A FACT ABOUT THE INPUT, NOT ABOUT THE OUTCOME, and the clean-spin vector row is what
	// makes the difference visible: on a spin where nobody wins twice, awards 2 and 3 still resolve
	// over reduced sets and still crown exactly the players the full sets would have crowned. A
	// vector that pinned only the winner would let a pass that reached the right player WITHOUT
	// EVER REMOVING ANYONE pass every row, and the removal is the whole story — so this is pinned on
	// every result.
	//
	// ⭐⭐ IT ALSO CARRIES DECISION F. When removal empties a later award's candidate set,
	// `ResolveStage2` returns KindNoEligiblePlayers — the SAME kind it returns when nobody cleared
	// the FR-21 floors, and those are completely different facts for Story 6.7's pity draw and
	// Story 6.8's reveal copy. A non-empty SweptOut on a KindNoEligiblePlayers row is EXHAUSTION;
	// an empty one is "nobody qualified". The distinction is carried here rather than as a sixth
	// OutcomeKind because OUTCOME_KINDS is pinned by exact equality in both suites and in two other
	// vector files, and widening it is a cross-cutting change this story has no mandate for.
	SweptOut []string

	// Reresolved reports that this award's Stage 2 ran over a REDUCED candidate set.
	//
	// ⚠ IT IS NOT "THE WINNER CHANGED", and the two readings diverge on every clean spin. Deriving
	// "the winner changed" would mean resolving each award twice — once with the removal and once
	// without — which is a counterfactual the ceremony has no reason to compute and no way to
	// publish. It is exactly `len(SweptOut) > 0`, and it is kept as its own field because a caller
	// reading a result row should not have to know that.
	Reresolved bool
}

// SpinResult is the whole spin's answer.
type SpinResult struct {
	// Results is in ASCENDING PRIORITY order — the order the awards were PROCESSED, which is not
	// the reveal order. `Stage1Result.Live` holds the reveal (draw) order and is untouched by this
	// pass; Story 6.8 is the one that reconciles the two for the stage.
	Results []AwardAssignment

	// Assigned is every player who won anything this spin, in byte-lex order — the same order
	// Stage 2 iterates and the ladder's rung 5 returns. Its LENGTH against the number of trophies
	// handed out is the invariant `UNIQUE(spin_id, winner_entry_id)` backstops in the database
	// (migration 0025): this pass makes a duplicate impossible by construction, and the constraint
	// exists because `review-data-integrity.md:169-174` measured that nothing in the schema caught
	// a producer bug or a re-run that did not clean prior rows.
	Assigned []string
}

// ResolveSpin is FR-26's anti-sweep pass over one spin's live award set.
//
// ⭐ A3 / DECISION E' — REMOVAL IS APPLIED TO THE CANDIDATE SET, BEFORE STAGE 2 RUNS, never to an
// Outcome afterwards. That is what makes `review-data-integrity.md:175-179` structurally impossible
// rather than defensively handled: "if a tie bottoms out to a shared trophy (FR-29.5) including
// player P, and P already won a higher-priority award this spin, the anti-sweep rule must remove P
// from the *shared* set too." If P was never a candidate, no shared set can contain P. Trimming the
// winners afterwards would additionally leave `LadderExitStep: 5` on what is now a sole winner — a
// lie Story 6.8 renders on stage — and would crown a player who was not the best of the set they
// actually competed in.
//
// ⭐ A4 / DECISION D — RE-RESOLUTION IS A FULL STAGE-2 RE-RUN, NEVER A "POP THE WINNER". Three
// reasons, each independently sufficient: (i) the ladder's rung 3 is a strict dominator over the
// REMAINING set, and the remaining set changed; (ii) `best` is a SET, so removing one member changes
// which players are tied and therefore which rung resolves them; (iii) DECISION E's zero carve-out is
// evaluated against the reduced set's best value, which may NEWLY be 0. A pop-the-winner shortcut is
// correct only when the original outcome was a lone winner with no tie behind it, and distinguishing
// that case is more code than re-running. All three have their own vector rows.
//
// ⭐ A9 — THE FR-21 FLOORS ARE NEVER RE-APPLIED. `eligiblePlayers` applies them inside
// `ResolveStage2`; this pass reduces the PLAYER LIST and lets Stage 2 filter it. Note what is absent
// below: no floor comparison, no IdleDQ read, no Volume/Rate lookup, no re-derived deciding value.
//
// ⭐ A10 — THE SHELF IS NEITHER READ NOR WRITTEN, and there is no parameter to read it with. The
// shelf is FROZEN at spin start (W1, SOLUTION-DESIGN:411) and Stage 1's provisional winners are
// computed BEFORE any anti-sweep removal, so a category's luck weight can be justified by a player
// who then does not win that category. That is intended (DECISION G) — it is what keeps Stage 1 a
// pure function of the frozen shelf and therefore reproducible from the published bundle alone — and
// it is stated in NO architecture document, which is why it is stated here. Advancing the shelf
// across spins is the caller's job; Story 6.7's pity reads the result.
//
// `ladder` is REQUIRED, unlike Stage 1's optional one. Stage 1 made its ladder optional to preserve
// 6-4b's shipped no-ladder contract; this pass has no such contract, and an anti-sweep pass that
// cannot resolve a tie cannot do its job — so an absent one refuses up front, exactly as
// `ResolveAward` does.
func ResolveSpin(live []Stage1Candidate, players []SnapshotPlayer, ladder Ladder) (SpinResult, error) {
	// ⭐ A PLAIN `ladder == nil` IS NOT ENOUGH — `ladderIsNil` (`stage2.go:407-428`) catches a TYPED
	// nil, which the 6-4a code review measured: an interface holding `(*someLadder)(nil)` is itself
	// non-nil, so the plain check passes and the tie path then dereferences a nil receiver, taking
	// the worker down instead of returning the documented refusal.
	//
	// ⚠ THIS ARM IS NOT ROW-REPRESENTABLE — "no ladder was injected" is not a JSON input — so it is
	// driven by this package's own test, the way `TestStage1PickRefusesANilStream` drives Stage 1's.
	if ladderIsNil(ladder) {
		return SpinResult{}, sweepRefuse(SweepDetailLadder,
			"a Ladder must be injected — anti-sweep re-resolves overflows through the FR-29 ladder "+
				"and will not pick a tie's winner itself")
	}

	// ⛔ A13 — THE LIVE SET'S OWN SHAPE IS VALIDATED FIRST, IN FULL, OVER THE WHOLE SET, before any
	// award is resolved. The order is CONTRACT, it is published in the vector's `spec` string, and
	// two refusal rows are malformed in TWO WAYS AT ONCE so a regression that resolved
	// award-by-award (and therefore refused `stage2` on a set whose own shape was already broken) is
	// observable. 6-4b's headline defect was three implementations disagreeing on validation order
	// with NO row able to see it; 6.5 shipped the same class again.
	if err := validateLive(live); err != nil {
		return SpinResult{}, err
	}

	// A2 — ASCENDING `priority`, over a COPY. ⚠ `Stage1Result.Live` is in DRAW order, which is the
	// REVEAL order and is deliberately unsorted — `stage1.go:269-274` says so and names this story
	// by number. Never sort the caller's slice: a pass that reordered its input would make two
	// consecutive resolutions of the same spin observably different operations, which is exactly
	// what `eligiblePlayers` and `stage1Weighted` both refuse to do. `sort.Slice` needs no stability
	// here because `validateLive` has just proven the priorities unique, so the order is TOTAL.
	ordered := make([]Stage1Candidate, len(live))
	copy(ordered, live)
	sort.Slice(ordered, func(i, j int) bool { return ordered[i].Priority < ordered[j].Priority })

	assigned := make(map[string]struct{}, len(players))
	results := make([]AwardAssignment, 0, len(ordered))

	for _, c := range ordered {
		// ── REMOVAL, HERE, ON THE CANDIDATE SET, BEFORE RESOLUTION (A3 / DECISION E') ──────────
		reduced := make([]SnapshotPlayer, 0, len(players))
		sweptOut := make([]string, 0, len(players))
		reducedIDs := make(map[string]struct{}, len(players))
		for _, p := range players {
			// ⭐⭐ STORY 6.9a — the Go half of the `deferred-work.md:335` fix, landed in the same
			// edit as `pity.go`'s and `lib/roulette/{pity,sweep}.ts`'s. Two sibling modules
			// guaranteeing DIFFERENT things about one field is worse than both guaranteeing
			// nothing, which is why 6.7 deferred rather than half-fix.
			if err := validSteamID64(p.SteamID64); err != nil {
				return SpinResult{}, sweepRefuse(SweepDetailInternal,
					"the roster carries a steamid64 that is not decimal digits — it would sort "+
						"differently in the three runtimes while every byte count agreed")
			}
			if _, done := assigned[p.SteamID64]; done {
				sweptOut = append(sweptOut, p.SteamID64)
				continue
			}
			reduced = append(reduced, p)
			reducedIDs[p.SteamID64] = struct{}{}
		}
		// Byte-lex, the same order Stage 2 iterates and rung 5 returns.
		// ⭐ TRUE BY CONSTRUCTION SINCE 6.9a, because of the guard directly above: `sort.Strings`
		// orders by UTF-8 byte, and on `[0-9]+` that is the identical order JavaScript's UTF-16
		// `.sort()` and Python's code-point `sorted` produce. ⛔ Do NOT unify this with
		// `worker/ceremony/bundle.go`'s key sort, which RFC-8785 §3.2.3 requires to be UTF-16 code
		// units — the OPPOSITE rule, also correct. Breaking either is invisible to the byte gate.
		sort.Strings(sweptOut)

		out, err := ResolveStage2(c.Award, reduced)
		if err != nil {
			// A12 — PROPAGATED under its own label, never swallowed into an outcome. Double-wrapped
			// so `errors.Is(err, ErrSweep)` holds for every refusal this pass returns while
			// `errors.Is(err, ErrStage2)` still says where it came from.
			return SpinResult{}, &SweepInvalidError{
				Detail: SweepDetailStage2,
				Reason: "resolving award " + c.AwardID + ": " + err.Error(),
				Cause:  err,
			}
		}

		if out.Kind == KindTie {
			// ⭐ A8 — A REDUCED TIE OF WIDTH 1 IS NEVER CONSTRUCTED, AND THAT IS WHY THE RE-RUN
			// ABOVE IS A RE-RUN. `ResolveStage2` cannot emit a width-1 tie (a lone best is a
			// KindWinner) and `validateLadder` REFUSES `len(tied) < 2` (L11, `ladder.go:749-755`),
			// so the only way to hand the ladder a width-1 set is to BUILD one — by popping the
			// removed player out of the ORIGINAL tie and passing the remainder. This code cannot:
			// the tie it hands over is one Stage 2 just produced over the reduced players. The
			// width-1 vector row proves it, and it proves it by outcome KIND rather than by winner —
			// the shortcut refuses where this resolves.
			// ⚠ `reduced`, NOT `players` — AND PASSING `players` HERE IS AN EQUIVALENT MUTANT ON
			// REACHABLE INPUTS, which is recorded rather than left for the next reader to
			// rediscover (Story 6.6's mutation pass measured it as one of its two survivors).
			//
			// ⛔ THE OBVIOUS ARGUMENT FOR THE EQUIVALENCE IS WRONG, AND THE CODE REVIEW CAUGHT IT.
			// It is NOT true that "the ladder reads `byID[sid]` only for `sid` in its survivors":
			// `validateLadder` (`ladder.go:782-790`) iterates EVERY row of `players` to build that
			// index and REFUSES on any duplicate steamid64 it finds there. So a duplicate row
			// belonging to an already-assigned player is visible to the ladder when it is handed
			// `players` and invisible when it is handed `reduced` — the two arguments are not
			// interchangeable as a matter of what the ladder reads.
			//
			// ⭐ THE EQUIVALENCE HOLDS FOR A DIFFERENT REASON, ONE LAYER UP: `eligiblePlayers`
			// (`stage2.go:684-694`) scans the WHOLE roster for duplicates before it filters, and it
			// runs inside the `ResolveStage2(c.Award, reduced)` call on the FIRST award, whose
			// candidate set is the unreduced roster because `assigned` is still empty. So any
			// duplicate refuses at award 1 and no input carrying one ever reaches this line. Given
			// a duplicate-free roster, tied ⊆ reduced ⊆ players and both calls index the same
			// entries — equivalent on every input that can get here, and only on those.
			//
			// ⛔ IT STILL PASSES `reduced`, AND THAT IS NOT A STYLE CHOICE. L12 forbids the ladder
			// from re-filtering eligibility, so the set it is handed must already BE the set the tie
			// was formed over; handing it a wider roster would make the two disagree the moment
			// anything downstream started reading `players` for something other than the tied ids —
			// which is exactly what rung 3's dominator loop would do if it ever iterated the roster.
			resolved, lerr := ladder.Resolve(c.Award, out, reduced)
			if lerr != nil {
				return SpinResult{}, &SweepInvalidError{
					Detail: SweepDetailLadder,
					Reason: "the FR-29 ladder refused the tie on award " + c.AwardID + ": " + lerr.Error(),
					Cause:  lerr,
				}
			}
			// ⛔ THE PORT'S OWN OUTPUT IS GUARDED, because `Ladder` is INJECTED and this arm can
			// therefore carry an outcome no code in this package built. A ladder that returned its
			// tie unchanged — or a KindNoEligiblePlayers — would otherwise fall through the winners
			// switch below and assign NOBODY, silently turning a resolved tie into a category with
			// no trophy.
			if resolved.Kind != KindWinner && resolved.Kind != KindShared {
				return SpinResult{}, sweepRefuse(SweepDetailInternal,
					"the FR-29 ladder resolved award "+c.AwardID+" to kind "+string(resolved.Kind)+
						" — a ladder returns a winner or a shared co-win, never anything else")
			}
			out = resolved
		}

		winners, err := spinWinners(c.AwardID, out)
		if err != nil {
			return SpinResult{}, err
		}

		// ⛔⛔ THE CAP'S OWN INVARIANT, CHECKED AGAINST THE SET THE AWARD ACTUALLY COMPETED OVER.
		// Everything above makes an anti-sweep violation impossible for outcomes THIS package built:
		// removal is applied to the candidate set before Stage 2 runs (A3 / DECISION E'), so Stage 2
		// cannot return a player who is not in `reduced`. ⚠ BUT `Ladder` IS AN INJECTED PORT — 6.9's
		// browser verifier reimplements it, and the `internal` arms below exist precisely because
		// this arm can carry an outcome no code in this package built. The guards there check only
		// that a winner id is non-EMPTY; a port returning a well-formed id that is already assigned,
		// or that is on no roster row at all, would sail through and hand one player two trophies in
		// one spin — the single invariant FR-26 exists to guarantee. The code review measured that
		// the story claimed this was impossible "by construction" when it was impossible only for
		// the SHIPPED ladder.
		//
		// `reduced` is exactly `players` minus `assigned`, so ONE membership test carries BOTH
		// facts: a winner outside it is either already holding a trophy this spin or is not on the
		// roster, and both are `internal` — a broken port, never a malformed input. This is a
		// backstop that the shipped composition can never trip, which is why `UNIQUE(spin_id,
		// winner_entry_id)` in `0025` is the SECOND line and this is the first.
		for _, sid := range winners {
			if _, ok := reducedIDs[sid]; !ok {
				return SpinResult{}, sweepRefuse(SweepDetailInternal,
					"award "+c.AwardID+" resolved to winner "+sid+", who is not in the candidate set "+
						"it competed over — either already awarded this spin (an anti-sweep violation) "+
						"or absent from the roster entirely")
			}
		}

		for _, sid := range winners {
			assigned[sid] = struct{}{}
		}

		results = append(results, AwardAssignment{
			AwardID:    c.AwardID,
			Priority:   c.Priority,
			Outcome:    out,
			SweptOut:   sweptOut,
			Reresolved: len(sweptOut) > 0,
		})
	}

	all := make([]string, 0, len(assigned))
	for sid := range assigned {
		all = append(all, sid)
	}
	// Byte-lex, the same order Stage 2 iterates and rung 5 returns. Go map iteration is randomised,
	// so without this the field would be a different slice on every run of the same spin.
	sort.Strings(all)

	return SpinResult{Results: results, Assigned: all}, nil
}

// spinWinners is A5 and A6: who this outcome assigns.
//
// ⭐ A5 — EVERY WINNER COUNTS, INCLUDING EVERY CO-WINNER. "Co-winners all count"
// (SOLUTION-DESIGN:427). A KindShared outcome assigns ALL of its Winners, and that is also what
// makes `UNIQUE(spin_id, winner_entry_id)` the correct backstop SHAPE — the constraint is
// per-PLAYER-per-SPIN, not per-award-result, precisely because one award can hand out several
// trophies. A pass that credited only `Winners[0]` would leave the second co-winner in every later
// candidate set, which is the silent violation `review-data-integrity.md:175-179` names.
//
// ⭐ A6 / DECISION K — KindNoEligiblePlayers AND KindNoAwardableValue ASSIGN NOBODY, AND NEITHER IS
// A REFUSAL. They pass through with an empty winner set and `assigned` unchanged. ⛔ The suppressed
// set a KindNoAwardableValue outcome CARRIES is to be READ for its width — AD-14 names this pass
// when it says so — and NEVER resolved: a pass that "helpfully" crowned it would re-crown the 27-way
// zero tie DECISION E exists to suppress (`deferred-work.md:270`).
func spinWinners(awardID string, out Outcome) ([]string, error) {
	switch out.Kind {
	case KindWinner:
		// ⛔ SYMMETRIC WITH THE SHARED ARM BELOW, and unreachable through `ResolveStage2` alone —
		// `validSteamID64` refuses an empty id. It is reachable through the injected `Ladder`, whose
		// KindWinner arm this file cannot vet, and an empty id assigned here would be an entry in
		// `assigned` that matches no roster row: it would remove nobody, and it would then be
		// written to `award_result_winner` at 6.8 as a foreign key to nothing.
		// ⭐ STORY 6.9a tightened this to the decimal-string guard (`deferred-work.md:335`). The id
		// lands in `assigned`, which `sort.Strings(all)` publishes, so it is on the same byte-lex
		// axis as the roster guard and a non-digit id would reorder a published array. Reused from
		// `stage2.go:773` rather than restated.
		if err := validSteamID64(out.SteamID64); err != nil {
			return nil, sweepRefuse(SweepDetailInternal,
				"award "+awardID+" resolved to a WINNER with no steamid64")
		}
		return []string{out.SteamID64}, nil

	case KindShared:
		if len(out.Winners) == 0 {
			return nil, sweepRefuse(SweepDetailInternal,
				"award "+awardID+" resolved to a SHARED outcome with no winners")
		}
		// ⛔ EMPTY **AND** DUPLICATE, because both are reachable only through the injected port and
		// both are silently destructive. `eligiblePlayers` refuses a duplicate steamid64 in the
		// SNAPSHOT for the same reason (`stage2.go:684-694`); a duplicate in a WINNER set is the
		// same fact one layer up. `assigned` is a map and would dedupe it, so the violation would
		// not show in `SpinResult.Assigned` at all — it would show at 6.8, as two
		// `award_result_winner` rows for one player, tripping `unique (award_result_id,
		// winner_entry_id)` on a write the producer believed was legal, and the `is_shared` trigger
		// would count 2 rows and AGREE with the flag while the ceremony was already wrong.
		seenWinner := make(map[string]struct{}, len(out.Winners))
		for _, sid := range out.Winners {
			// ⭐ 6.9a: same tightening as the KindWinner arm — a co-winner id also lands in
			// `assigned`, which is published as a sorted array.
			if err := validSteamID64(sid); err != nil {
				return nil, sweepRefuse(SweepDetailInternal,
					"award "+awardID+" resolved to a SHARED outcome with an empty steamid64")
			}
			if _, dup := seenWinner[sid]; dup {
				return nil, sweepRefuse(SweepDetailInternal,
					"award "+awardID+" resolved to a SHARED outcome listing "+sid+" twice — a "+
						"co-winner set holds one entry per player")
			}
			seenWinner[sid] = struct{}{}
		}
		return out.Winners, nil

	case KindNoEligiblePlayers, KindNoAwardableValue:
		return nil, nil

	case KindTie:
		// Unreachable: every tie is handed to the ladder above, which returns a winner or a shared
		// co-win. Loud rather than silent — a tie that reached here would assign nobody and quietly
		// drop a category, which is exactly what a re-resolution that skipped the ladder produces.
		return nil, sweepRefuse(SweepDetailInternal,
			"award "+awardID+" reached the assignment step as an unresolved TIE — every tie goes "+
				"through the FR-29 ladder")
	}

	// Unreachable: OutcomeKind is a closed set of five and every one is handled above. Loud rather
	// than silent — a sixth kind added by a later story must not fall through to "assigns nobody",
	// which is a plausible-looking answer for a category that in fact has a winner.
	return nil, sweepRefuse(SweepDetailInternal,
		"award "+awardID+" resolved to an unknown outcome kind "+string(out.Kind))
}

// validateLive is A2 and A13 — the live set's OWN shape.
//
// ⚠ IT MIRRORS `validatePool` (`stage1.go:720-756`) CLAUSE FOR CLAUSE, deliberately: the two are the
// same rule about the same column, one story apart, and a pool that Stage 1 accepted must not be a
// live set this pass rejects. The one difference is the LABEL — `pool` there, `live` here — because
// the two runtimes' callers route on it.
//
// ⭐ THE DUPLICATE-PRIORITY CLAUSE IS THE POINT. `review-data-integrity.md:388-389` says it in as
// many words: `award.priority` must be UNIQUE "or the anti-sweep 'ascending priority' iteration is
// non-deterministic when two awards share a priority". `0023:150` enforces it at the database
// (`award_tournament_priority_key`, deferrable) — CONFIRMED in the migration rather than assumed —
// and this refuses it again here rather than relying on a stable sort, because a stable sort makes
// the answer depend on the order the caller happened to supply.
func validateLive(live []Stage1Candidate) error {
	if len(live) == 0 {
		return sweepRefuse(SweepDetailLive,
			"the live award set is empty — a spin with nothing to resolve is a refusal, never a "+
				"short return")
	}
	seenID := make(map[string]struct{}, len(live))
	seenPriority := make(map[int]struct{}, len(live))
	for _, c := range live {
		if c.AwardID == "" {
			return sweepRefuse(SweepDetailLive, "award_id must be a non-empty string")
		}
		if _, dup := seenID[c.AwardID]; dup {
			return sweepRefuse(SweepDetailLive,
				"duplicate award_id "+c.AwardID+" — one award is live at most once in a spin")
		}
		seenID[c.AwardID] = struct{}{}

		if c.Priority < 1 {
			return sweepRefuse(SweepDetailLive,
				"award "+c.AwardID+" has priority "+itoa(c.Priority)+
					" — 0023's award_priority_positive requires > 0")
		}
		if _, dup := seenPriority[c.Priority]; dup {
			return sweepRefuse(SweepDetailLive,
				"duplicate priority "+itoa(c.Priority)+" — UNIQUE(tournament_id, priority) is what "+
					"makes ascending priority a TOTAL order, so a duplicate is a refusal rather "+
					"than a coin flip")
		}
		seenPriority[c.Priority] = struct{}{}
	}
	return nil
}
