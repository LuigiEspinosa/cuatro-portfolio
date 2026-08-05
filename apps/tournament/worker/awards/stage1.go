package awards

import (
	"errors"
	"fmt"
	"sort"
	"strconv"
)

// Stage 1 — the seeded weighted live-category pick (Story 6-4b, FR-25 / FR-26 / AD-14 /
// SOLUTION-DESIGN §9.2).
//
//	weight(a, players, shelf, table):
//	    out = ResolveStage2(a.Award, players)          # the PROVISIONAL winner
//	    if out.Kind == tie:            REFUSE (ErrStage1Tie, names Story 6.5)        W9
//	    if out.Kind in {no_eligible_players, no_awardable_value}:
//	                                   idx = 0         # no player => empty shelf => heaviest
//	    else:                          idx = min(shelf[out.SteamID64], len(table)-1)  W8
//	    return table[idx]
//
//	Stage1Pick(stream, in):
//	    validate(table)                # non-empty, strictly decreasing, every entry > 0   W7
//	    validate(shelf)                # every size a NON-NEGATIVE integer                 W8
//	    validate(pool)                 # non-empty, no dup award_id, no dup priority,
//	                                   # every priority >= 1                               W2
//	    validate(live_count)           # 1 <= live_count <= len(pool)                       W6
//	    cand = sort(pool, by Priority) # ASCENDING, and that order is TOTAL                W2
//	    w    = [ weight(c) for c in cand ]              # the shelf is FROZEN here          W1
//	    for _ in range(live_count):
//	        total = sum(w[i] for i in remaining)        # RECOMPUTED each pick              W4
//	        r     = UniformInt(stream, total)           # ALWAYS drawn, no short-circuit    W5
//	        cum   = 0
//	        for i in remaining:                         # still ascending priority
//	            cum += w[i]
//	            if cum > r:                             # STRICTLY greater                  W3
//	                live = append(live, cand[i].AwardID); remove i; break
//	    return live                                     # in DRAW order
//
// ⭐ THIS IS THE FIRST STAGE THAT CONSUMES THE STREAM, so its BYTE ACCOUNTING is part of the
// contract rather than a side effect. Every draw reports the stream's cumulative position
// afterwards (Stage1Draw.ConsumedAfter), because that is the only externally visible proof that
// the producer and the browser verifier walked the same stream — and the only way a rejection
// inside UniformInt is observable at all. A pick that is right and a byte count that is wrong is
// still a broken ceremony: every later spin, and 6.9's verifier, inherit the position.
//
// THE SEAM (ARCHITECTURE-SPINE.md:73-76). This file conforms to `roulette/vectors/`, never to
// lib/roulette/stage1.ts. They are two independent implementations of one spec; neither is the
// reference and neither may be corrected by reading the other's source. When they disagree the
// vector decides; when the vector is silent, add a vector.
//
// ⛔ NOT IN THIS FILE, each with an owner: the FR-29 tiebreak ladder (6.5 — a tie REFUSES here),
// anti-sweep and the luck_weight_table's VALUES (6.6 — the table arrives as a parameter and is
// validated, never seeded), the pity draw (6.7), the spin plan's CONTENT and the pool's
// composition across spins (6.8 — Stage 1 receives one spin's pool, already filtered), and any
// persistence at all (6.8 — worker/awards stays the leaf TestPackageIsALeaf pins).

// ErrStage1 is the sentinel every refusal in this file wraps.
//
// ⭐ ITS OWN SENTINEL, not a reuse of ErrStage2. The 6-4a code review measured what an untyped
// refusal surface costs: when every refusal was a bare error string the vector gate could assert
// only "some error", so a mutation that made validation reject EVERY input left all sixteen
// refusal rows passing. Reusing ErrStage2 here would rebuild half of that hole — a Stage-1
// validation bug and a Stage-2 data defect would be indistinguishable to the suite.
//
// ⚠ A refusal that PROPAGATES from Stage 2 is wrapped in BOTH, so `errors.Is(err, ErrStage1)`
// holds for every refusal this package's Stage 1 returns while `errors.Is(err, ErrStage2)` still
// identifies where it came from.
var ErrStage1 = errors.New("awards: stage 1 refused")

// ErrStage1Tie is the W9 refusal: the provisional winner is a TIE, which has no single shelf.
//
// ⭐ DISTINGUISHABLE FROM AN INVALID INPUT, and the vector's `refusal_kind` makes both runtimes
// keep it that way. The two mean different things to the caller: an invalid input is a bug to
// fix, while a tie is the FR-29 seam Story 6.5 fills — 6-4a measured ties on 5 of 12 awards once
// the floors admit anyone, so this fires often and is a designed outcome, not a malfunction.
//
// It wraps ErrStage1, so a caller that only wants "did Stage 1 refuse" needs one check.
var ErrStage1Tie = fmt.Errorf(
	"%w: the provisional winner is a TIE and therefore has no single shelf to look up — that is "+
		"Story 6.5's FR-29 ladder. Stage 1 will not pick one: min-shelf-over-the-tied-set, "+
		"byte-lex-first and lowest-SteamID64 are each a silent argmax that 6.5 would later "+
		"contradict, changing every drawn byte from this spin onward with nothing red anywhere",
	ErrStage1)

// The closed set of things a Stage-1 refusal can be ABOUT. It travels in the vector next to the
// refusal rows, so both runtimes must agree on it.
//
// ⭐ WHY A REFUSAL NAMES ITS INPUT AT ALL. Story 6-4b's mutation pass found the reason and it is
// worth keeping: deleting the NEGATIVE-SHELF guard left every gate GREEN in TypeScript, because a
// negative index there yields `undefined`, which becomes `NaN` in the weight sum and is refused
// three functions later — still a typed Stage-1 refusal, still the right `refusal_kind`. Go
// instead PANICS on `table[-1]`. So the shared row could not distinguish "refused by the guard
// that exists for exactly this" from "refused by accident" or "crashed". `Detail` makes them
// distinguishable in both languages, and it sharpens every invalid row rather than only that one.
// It is 6-4a's untyped-refusal lesson applied one level deeper.
const (
	DetailWeightTable = "weight_table" // W7 — the published luck table's shape
	DetailShelf       = "shelf"        // W8 — a shelf size
	DetailPool        = "pool"         // W2/W6 — the candidate pool's shape
	DetailLiveCount   = "live_count"   // W6 — how many awards the spin asked for
	DetailTotalWeight = "total_weight" // the sum left uniform_int's [1, 2^32]
	DetailStage2      = "stage2"       // a Stage-2 refusal propagated rather than swallowed
	DetailTie         = "tie"          // W9 — which is a refusal KIND, not an invalid input
	DetailStream      = "stream"       // no stream was supplied at all
	DetailInternal    = "internal"     // an invariant this file believes unreachable
)

// ⚠ THE LAST TWO ARE DECLARED BUT NOT ROW-REPRESENTABLE, and that distinction is the whole reason
// this note exists. A vector row is a set of INPUTS; "no stream was supplied" and "an invariant
// broke" are not inputs, so no row can produce them — but both are reachable in both runtimes, so
// leaving them out of the declared set made `Detail` a closed set that was not closed. The 6-4b
// code review found all three of the ways that went wrong: Go declared nine while TypeScript and
// the vector declared seven, TypeScript threw 'stream' and 'internal' anyway while its own JSDoc
// promised the value was one of the seven, and the unreachable unknown-outcome arm refused as
// `internal` here and as `stage2` there — the same input, two different values, in the field the
// vector calls shared contract. All three now declare the same NINE, the vector's
// `refusal_details` carries all nine, and `TestStage1DetailsAreExactlyTheDeclaredSet` pins the
// constants against it so a tenth cannot be added on one side alone.
//
// Which of the nine a ROW may carry is a separate, narrower rule, enforced by the generator:
// seven. See README.md's representability rule.

// Stage1InvalidError is every non-tie refusal, and it NAMES WHICH INPUT was rejected.
type Stage1InvalidError struct {
	Detail string
	Reason string
	// Cause is the propagated Stage-2 refusal on a DetailStage2 refusal, nil otherwise.
	Cause error
}

func (e *Stage1InvalidError) Error() string {
	return "awards: stage 1 refused (" + e.Detail + "): " + e.Reason
}

// Unwrap returns BOTH ErrStage1 and any propagated cause, so `errors.Is(err, ErrStage1)` answers
// "did Stage 1 refuse" while `errors.Is(err, ErrStage2)` still says where a propagated refusal
// came from.
func (e *Stage1InvalidError) Unwrap() []error {
	if e.Cause == nil {
		return []error{ErrStage1}
	}
	return []error{ErrStage1, e.Cause}
}

// refuse builds a typed refusal. Every non-tie return in this file goes through it, so no refusal
// can reach a caller without naming its input.
func refuse(detail, reason string) error {
	return &Stage1InvalidError{Detail: detail, Reason: reason}
}

// Stage1TieError is the W9 refusal with its CONTENTS attached, mirroring stage2.go's
// LadderRefusedError.
//
// ⭐ IT CARRIES THE TIE, not just a message. Story 6.5 has to know which award tied, how wide, and
// on which equality — and a caller that can only read prose has to parse English to find out.
// TypeScript's Stage1TieError has carried `awardId` and `tied` since it was written, so without
// this the two halves of the seam exposed different information about the same refusal; Task 5's
// mechanical transcript diff is what surfaced it, because the only two lines that differed between
// the runtimes were the ones printing this error's text.
//
// Unwrap returns ErrStage1Tie, which itself wraps ErrStage1 — so `errors.Is(err, ErrStage1)`
// answers "did Stage 1 refuse", `errors.Is(err, ErrStage1Tie)` answers "was it a tie", and
// `errors.As(err, &tie)` reads the tie itself.
type Stage1TieError struct {
	AwardID string
	Tied    []string
	Reason  TieReason
}

func (e *Stage1TieError) Error() string {
	return "awards: stage 1 refused: award " + e.AwardID + " has a " + itoa(len(e.Tied)) +
		"-way " + string(e.Reason) + " provisional winner and therefore no single shelf to look" +
		" up — that is Story 6.5's FR-29 ladder. Stage 1 will not pick one: min-shelf-over-the-" +
		"tied-set, byte-lex-first and lowest-SteamID64 are each a silent argmax that 6.5 would" +
		" later contradict, changing every drawn byte from this spin onward"
}

func (e *Stage1TieError) Unwrap() error { return ErrStage1Tie }

// Detail reports the closed-set label the vector's refusal rows carry. A tie is its own kind, so
// it is DetailTie and never one of the invalid-input labels.
func (e *Stage1TieError) Detail() string { return DetailTie }

// Stage1Candidate is one award in a spin's candidate pool.
//
// The pool arrives ALREADY FILTERED — "minus already-revealed" is the spin plan's bookkeeping and
// belongs to Story 6.8. Stage 1 receives one spin's candidates and nothing else.
type Stage1Candidate struct {
	AwardID string

	// Priority is the catalog's `priority` column. W2 — the cumulative walk is over candidates in
	// ASCENDING priority, and `UNIQUE(tournament_id, priority)` (0023:150) is the ONLY reason that
	// order is TOTAL. A duplicate is refused rather than broken by a stable sort: two honest
	// implementations would break it differently and the whole walk would shift.
	Priority int

	Award Award
}

// Stage1Input is everything one spin's pick depends on. All of it is INJECTED: this package
// reads no database, no clock and no ambient configuration, which is what makes a ceremony
// replayable from the published bundle alone.
type Stage1Input struct {
	Candidates []Stage1Candidate
	Players    []SnapshotPlayer

	// Shelf maps SteamID64 to the number of trophies that player already holds.
	//
	// W1 — IT IS FROZEN AT SPIN START (SOLUTION-DESIGN:411) and it is an INJECTED MAP, never read
	// from a database inside this package. An ABSENT player is shelf 0 — the normal shape at the
	// first spin, never an error (W8).
	Shelf map[string]int

	// Table is the published `luck.weight_table`: strictly decreasing positive integers, heaviest
	// first, e.g. [100 40 16 6 2 1]. Its VALUES are organizer config (ARCHITECTURE-SPINE.md:471)
	// and belong to 6.6/6.8; this file validates its SHAPE and never seeds one.
	Table []int

	LiveCount int
}

// Stage1Draw records one draw, including what it cost the stream.
type Stage1Draw struct {
	// N is the total weight this draw ran over — RECOMPUTED per pick (W4), so on a
	// live_count > 1 spin the second N is smaller than the first by exactly the removed weight.
	N uint64
	R uint64

	// ConsumedAfter is the stream's CUMULATIVE byte position after the draw. ⭐ Not decorative:
	// it is what makes "both runtimes consumed identical bytes" an assertion instead of a claim,
	// and `ConsumedAfter - previous > k` is the only way a rejection inside UniformInt is visible
	// from outside. Do not remove it because nothing in the engine reads it.
	ConsumedAfter uint64
}

// Stage1Result is one spin's answer.
type Stage1Result struct {
	// Live is in DRAW order, which is the REVEAL order (EXPERIENCE.md:162-173).
	//
	// ⚠ IT IS DELIBERATELY NOT SORTED BY PRIORITY. Story 6.6 re-sorts by ascending priority for
	// anti-sweep processing (SOLUTION-DESIGN §9.4); that is 6.6's transformation of this list, not
	// a defect in it. Sorting here would silently discard the reveal order the UI needs.
	Live []string

	// Weights is aligned to the ASCENDING-PRIORITY order, not to the order Candidates was
	// supplied in.
	Weights []int

	// TotalWeight is the WHOLE pool's total. On a live_count > 1 spin it is NOT the second draw's
	// N — each draw carries its own recomputed total.
	TotalWeight int

	Draws []Stage1Draw
}

// Stage1Weights returns the candidates' integer weights in ASCENDING PRIORITY order.
//
// Pure, and it draws NOTHING: no stream, no bytes, no randomness. It is exported separately from
// Stage1Pick so 6.6's luck meter can render the weights it is about to bias without consuming a
// byte of a ceremony's stream.
//
// LiveCount is deliberately NOT consulted — weighting a pool does not depend on how many awards
// will be drawn from it. The split is mirrored in all three implementations so the shared refusal
// surface stays one surface.
func Stage1Weights(in Stage1Input) ([]int, error) {
	_, weights, err := stage1Weighted(in, false)
	return weights, err
}

// stage1Weighted is the shared half: validate, sort, weight. `checkLiveCount` is false for the
// Stage1Weights path, which does not consult LiveCount at all.
//
// ⭐ VALIDATION ORDER IS PART OF THE CONTRACT, not an implementation detail. When an input is
// malformed in TWO ways at once — a bad LiveCount over a pool whose first candidate TIES — the
// order decides WHICH refusal the caller sees, and a caller routing on `refusal_kind` hands a
// malformed spin plan to Story 6.5's ladder if the two runtimes disagree about it. The 6-4b code
// review measured exactly that divergence: this file weighted FIRST and returned `tie`, while the
// Python anchor validated LiveCount first and returned `invalid`/`live_count`. The anchor is
// right — this story's own transcribed algorithm and the vector's published `spec` string both
// put `1 <= live_count <= |pool|` in the POOL group, before the weight loop — so LiveCount is
// checked here, alongside the other shape checks and still before any byte can move.
//
// The vector's `live-count-zero-over-a-tied-pool` refusal row is the ONLY row that can redden a
// regression of this, because it is the only row carrying two defects at once.
func stage1Weighted(in Stage1Input, checkLiveCount bool) ([]Stage1Candidate, []int, error) {
	if err := validateWeightTable(in.Table); err != nil {
		return nil, nil, err
	}
	if err := validateShelf(in.Shelf); err != nil {
		return nil, nil, err
	}
	if err := validatePool(in.Candidates); err != nil {
		return nil, nil, err
	}
	if checkLiveCount {
		if err := validateLiveCount(in.LiveCount, len(in.Candidates)); err != nil {
			return nil, nil, err
		}
	}

	// W2 — ASCENDING `priority`, over a COPY. Never sort the caller's slice: a selector that
	// reordered its input would make two consecutive picks over the same pool observably
	// different operations, which is exactly what stage2.go's eligiblePlayers refuses to do.
	// sort.Slice needs no stability here because validatePool has just proven the priorities are
	// unique, so the order is total.
	ordered := make([]Stage1Candidate, len(in.Candidates))
	copy(ordered, in.Candidates)
	sort.Slice(ordered, func(i, j int) bool { return ordered[i].Priority < ordered[j].Priority })

	// W1 — THE SHELF IS FROZEN HERE. Every weight is computed once, from the shelf as it stood at
	// spin start, BEFORE the first draw. See the note in Stage1Pick for why that matters on a
	// live_count > 1 spin.
	weights := make([]int, len(ordered))
	for i, c := range ordered {
		w, err := stage1Weight(c, in.Players, in.Shelf, in.Table)
		if err != nil {
			return nil, nil, err
		}
		weights[i] = w
	}
	return ordered, weights, nil
}

// stage1Weight is FR-26's rule for ONE candidate: table[min(shelf[provisional_winner], table_max)].
//
// ⭐ DECISION F (Cuatro, 2026-08-04) lives here, and the two no-winner shapes must NOT be
// collapsed:
//
//   - KindTie has SEVERAL candidate shelves, and choosing among them is the silent argmax AD-14
//     forbids — so it refuses, naming Story 6.5 (W9).
//   - KindNoEligiblePlayers / KindNoAwardableValue have NO PLAYER AT ALL, therefore no shelf,
//     therefore index 0 — the heaviest weight, which is exactly what FR-26's "empty shelf =>
//     heaviest" is written to produce.
//
// The consequence is measured, not hypothetical, and it is worth seeing coming: 6-4a found all
// twelve real awards resolving to KindNoEligiblePlayers under the shipped 24/20 floors, so on
// today's corpus every candidate weighs the heaviest and Stage 1 draws UNIFORMLY. That is a
// correct output of a measured input. Refusing on a no-winner outcome instead would make the
// ceremony unrunnable today; weighting a TIE as an empty shelf would invent a winner 6.5 will
// contradict.
//
// ⛔ ResolveStage2, NEVER ResolveAward. ResolveAward hands a tie to the injected ladder, which in
// this era refuses — so Stage 1 would receive an error it cannot inspect instead of the tie it
// must SEE in order to refuse for the right reason. stage2.go:280-284 exports the pure stage for
// precisely this caller.
func stage1Weight(c Stage1Candidate, players []SnapshotPlayer, shelf map[string]int, table []int) (int, error) {
	out, err := ResolveStage2(c.Award, players)
	if err != nil {
		// ⭐ DOUBLE-WRAPPED. errors.Is(err, ErrStage1) holds for every refusal Stage 1 returns,
		// and errors.Is(err, ErrStage2) still says where it came from. Swallowing this — treating
		// an unresolvable award as a zero, or as the heaviest weight — would let a malformed
		// catalog draw a ceremony.
		return 0, &Stage1InvalidError{
			Detail: DetailStage2,
			Reason: "weighting award " + c.AwardID + ": " + err.Error(),
			Cause:  err,
		}
	}

	switch out.Kind {
	case KindTie:
		// W9 — propagated, never swallowed, and carrying the tie WHOLE so 6.5 can read it.
		return 0, &Stage1TieError{AwardID: c.AwardID, Tied: out.Tied, Reason: out.Reason}

	case KindNoEligiblePlayers, KindNoAwardableValue:
		// DECISION F — no player, no shelf, the maximal empty shelf: index 0.
		return table[0], nil

	case KindWinner:
		// W8 — `tableMax` is len(table) - 1, NOT a length. Using the length here indexes one past
		// the end for any shelf at or beyond it: a panic in Go, `undefined` in the browser.
		tableMax := len(table) - 1
		// An ABSENT player is shelf 0 — a missing key yields Go's zero value, which is the right
		// answer for the right reason and is the NORMAL case at the first spin. validateShelf has
		// already refused any negative size, so the index cannot go below 0.
		idx := shelf[out.SteamID64]
		if idx > tableMax {
			idx = tableMax
		}
		return table[idx], nil
	}

	// Unreachable: OutcomeKind is a closed set of four and every one is handled above. Loud rather
	// than silent — a fifth kind added by a later story must not fall through to a plausible
	// weight. (6-4a's review found the TypeScript conformance switch lacking exactly this arm.)
	return 0, refuse(DetailInternal,
		"award "+c.AwardID+" resolved to an unknown Stage-2 outcome kind "+string(out.Kind))
}

// Stage1Pick draws `LiveCount` awards from the pool, consuming `s`.
//
// ⭐ W10 — A NOTE THAT COSTS GO NOTHING AND THE VERIFIER EVERYTHING. This function is
// synchronous and cannot exhibit it, but its TypeScript mirror is `async`: `uniformInt` returns a
// Promise and lib/roulette/prng.ts THROWS if two draws overlap on one stream. The 6.3 code review
// measured the failure — after read(30), two concurrent read(4) delivered de11f26e / 7b537ef2
// where the true bytes are de7b92537ef2f26e, byte 32 never delivered and stream byte 0 injected,
// with `consumed` IDENTICAL in the correct and the corrupt run. So a `Promise.all` over the
// LiveCount picks in the verifier would produce a different-but-valid-looking ceremony that the
// byte-position assertion cannot see. It is a verifier-only divergence that would surface at 6.9
// as the browser calling a correctly-produced ceremony unfair — which is why it is recorded on
// BOTH sides of the seam rather than only where it can happen.
func Stage1Pick(s *Stream, in Stage1Input) (Stage1Result, error) {
	if s == nil {
		return Stage1Result{}, refuse(DetailStream, "a Stream must be supplied — Stage 1 is stream-driven")
	}

	// ⛔ EVERY VALIDATION RUNS BEFORE THE FIRST DRAW (W7). A malformed table or pool must not
	// consume a byte and THEN fail: the stream position would then depend on the failure, and a
	// retry after fixing the config would produce a different ceremony from the same seed. The
	// vector's generator asserts this directly — every refusal row is checked to have left the
	// stream at position 0.
	ordered, weights, err := stage1Weighted(in, true)
	if err != nil {
		return Stage1Result{}, err
	}

	remaining := make([]int, len(ordered))
	for i := range remaining {
		remaining[i] = i
	}

	totalWeight, err := sumWeights(weights, remaining)
	if err != nil {
		return Stage1Result{}, err
	}

	result := Stage1Result{
		Live:        make([]string, 0, in.LiveCount),
		Weights:     weights,
		TotalWeight: totalWeight,
		Draws:       make([]Stage1Draw, 0, in.LiveCount),
	}

	for pick := 0; pick < in.LiveCount; pick++ {
		// W4 — RECOMPUTED over the REMAINING candidates, every time. Never `r - cumulative` and
		// never a second walk over the first draw's remainder: two picks are two UniformInt calls
		// and two byte movements, and Stage1Draw.ConsumedAfter is what proves it.
		total, err := sumWeights(weights, remaining)
		if err != nil {
			return Stage1Result{}, err
		}

		// W5 / DECISION G — THE DRAW ALWAYS HAPPENS. There is no single-candidate short-circuit:
		// a one-candidate pool of weight 100 still draws n = 100 and still consumes a byte.
		// `n = 1` — and therefore E1's zero-byte draw — arises ONLY when the remaining total is 1.
		// The two rules produce identical PICKS and different STREAM POSITIONS, which is invisible
		// until 6.9's browser declares a correct ceremony unfair.
		r, err := UniformInt(s, uint64(total))
		if err != nil {
			return Stage1Result{}, &Stage1InvalidError{
				Detail: DetailTotalWeight,
				Reason: "drawing pick " + strconv.Itoa(pick+1) + " over total weight " +
					strconv.Itoa(total) + ": " + err.Error(),
				Cause: err,
			}
		}
		result.Draws = append(result.Draws, Stage1Draw{
			N: uint64(total), R: r, ConsumedAfter: s.Consumed(),
		})

		// The cumulative walk, still in ascending priority over what remains.
		cum := uint64(0)
		picked := -1
		for _, i := range remaining {
			cum += uint64(weights[i])
			// ⭐ W3 — STRICTLY GREATER, and this is the highest-value line in the file. With
			// weights [3, 2] and r = 3: `>` selects the SECOND candidate, which is correct because
			// r in {0,1,2} is the first candidate's share and {3,4} is the second's. `>=` selects
			// the FIRST and silently hands it 4/5 of the probability mass. The result SHAPE is
			// identical either way and every award in the ceremony shifts. Pinned by the vector's
			// `r-lands-exactly-on-a-cumulative-boundary` row, which is the only row where r sits
			// exactly on a boundary — the same class as uniform_int's
			// `exact-threshold-rejection-x-equals-limit`, which the 6.3 mutation pass found
			// surviving the entire suite in both languages.
			if cum > r {
				picked = i
				break
			}
		}
		if picked < 0 {
			// Unreachable: r < total = the sum of the remaining weights, so the cumulative
			// necessarily exceeds it on some candidate. Loud rather than silent — falling through
			// with no pick would return a spin shorter than the plan promised, which is exactly
			// what W6 refuses to do by accident.
			return Stage1Result{}, refuse(DetailInternal,
				"the cumulative walk selected nothing — UniformInt's range broke")
		}

		result.Live = append(result.Live, ordered[picked].AwardID)
		remaining = removeIndex(remaining, picked)
	}

	return result, nil
}

// removeIndex drops value `v` from `idx`, preserving the ascending-priority order of the rest.
func removeIndex(idx []int, v int) []int {
	out := idx[:0]
	for _, i := range idx {
		if i != v {
			out = append(out, i)
		}
	}
	return out
}

// sumWeights totals the weights at `idx`, refusing rather than overflowing.
//
// ⚠ CHECKED AFTER EVERY ADDITION, not once at the end. Every weight is > 0 (validateWeightTable),
// so the running total only grows — which means a bound checked each step catches an oversized
// table BEFORE the addition that would wrap `int`. Checking only the final sum would let a wrapped
// total land back inside [1, MaxN] and draw a perfectly plausible, completely wrong ceremony.
//
// The bound is UniformInt's own: n must be in [1, 2^32]. lib/roulette/prng.ts:54-58 records that
// the largest REAL total is about 1200 (12 awards x weight 100), so a total anywhere near the
// bound means the weight table is wrong, not that the bound is tight.
func sumWeights(weights []int, idx []int) (int, error) {
	total := 0
	for _, i := range idx {
		total += weights[i]
		if total < 1 || uint64(total) > MaxN {
			return 0, refuse(DetailTotalWeight,
				"the total weight left uniform_int's [1, 2^32] range — the largest real total is "+
					"about 1200 (12 awards x weight 100), so this means the weight table is wrong")
		}
	}
	return total, nil
}

// validateWeightTable is W7, and it runs BEFORE any draw.
//
// Non-empty, STRICTLY DECREASING, every entry > 0. Each clause earns its place:
//   - a NON-DECREASING table inverts FR-26's bias — the luck meter would favour the player who
//     already holds the most trophies, the exact opposite of the underdog rule the feature exists
//     for, and nothing downstream would look wrong;
//   - a `0` entry makes a candidate unpickable while it still occupies the cumulative walk, so
//     the pool silently shrinks with no refusal anywhere;
//   - an empty table has no index 0 to give the empty shelf.
func validateWeightTable(table []int) error {
	if len(table) == 0 {
		return refuse(DetailWeightTable,
			"luck_weight_table must be non-empty — there is no index 0 to give the empty shelf")
	}
	for i, w := range table {
		if w <= 0 {
			return refuse(DetailWeightTable,
				"luck_weight_table["+strconv.Itoa(i)+"] = "+strconv.Itoa(w)+" must be > 0 — a "+
					"non-positive weight makes a candidate unpickable while it still occupies "+
					"the cumulative walk")
		}
		if i > 0 && w >= table[i-1] {
			return refuse(DetailWeightTable,
				"luck_weight_table must be STRICTLY DECREASING, got "+strconv.Itoa(table[i-1])+
					" then "+strconv.Itoa(w)+" at index "+strconv.Itoa(i)+" — a non-decreasing "+
					"table inverts FR-26's bias toward the empty shelf")
		}
	}
	return nil
}

// validateShelf is W8's other half.
//
// A shelf size is a count, so it is non-negative. A NEGATIVE size is refused rather than trusted
// because it is silently plausible and DIFFERENTLY wrong in each language: Python and Ruby index
// from the END of the table (handing the LIGHTEST weight to the emptiest shelf — FR-26 exactly
// backwards), Go panics, and JavaScript yields `undefined`. Three behaviours, no error, one
// contract. Go's own `shelf[id]` would clamp nothing, so the guard has to be here.
//
// ⭐ AN ABSENT SHELF IS THE EMPTY SHELF (Cuatro, 2026-08-04, resolving the 6-4b code review). A nil
// map ranges zero times and is accepted, exactly as `map[string]int{}` is — Go cannot idiomatically
// tell the two apart without a pointer, and W8 already says an absent PLAYER is shelf 0, which is
// the normal shape at the first spin. The same holds for a nil Players slice, which ResolveStage2
// reports as KindNoEligiblePlayers rather than an error. The review found the seam disagreeing here
// — this side published a ceremony from an omitted map while the verifier refused it and the anchor
// crashed — so the rule is now written down in all three and carried by the vector's
// `an-omitted-shelf-key-is-the-empty-shelf` CASE (a case, not a refusal: it draws).
//
// ⚠ TypeScript and Python additionally refuse `null` and structurally-wrong types (an array as a
// shelf, a non-array roster). Go cannot express those states at all, so that guard is theirs alone
// and is deliberately NOT vectorable — the same reasoning as stage1.ts's `Object.hasOwn` note.
func validateShelf(shelf map[string]int) error {
	for sid, size := range shelf {
		if size < 0 {
			return refuse(DetailShelf,
				"shelf["+sid+"] = "+strconv.Itoa(size)+" must be a non-negative integer — a shelf size is a count")
		}
	}
	return nil
}

// validatePool is W2 and the pool half of W6.
func validatePool(candidates []Stage1Candidate) error {
	if len(candidates) == 0 {
		return refuse(DetailPool,
			"the candidate pool is empty — a spin with nothing to draw is a refusal, never a short return")
	}
	seenID := make(map[string]struct{}, len(candidates))
	seenPriority := make(map[int]struct{}, len(candidates))
	for _, c := range candidates {
		if c.AwardID == "" {
			return refuse(DetailPool, "award_id must be a non-empty string")
		}
		if _, dup := seenID[c.AwardID]; dup {
			return refuse(DetailPool,
				"duplicate award_id "+c.AwardID+" — one award appears at most once in a spin's pool")
		}
		seenID[c.AwardID] = struct{}{}

		// 0023:139's `award_priority_positive`.
		if c.Priority < 1 {
			return refuse(DetailPool,
				"award "+c.AwardID+" has priority "+strconv.Itoa(c.Priority)+
					" — 0023's award_priority_positive requires > 0")
		}
		if _, dup := seenPriority[c.Priority]; dup {
			// W2 — a refusal, NOT a stable-sort coin flip. UNIQUE(tournament_id, priority) is the
			// only thing making "ascending priority" a total order; without it two honest
			// implementations break the tie differently and the whole cumulative walk shifts.
			return refuse(DetailPool,
				"duplicate priority "+strconv.Itoa(c.Priority)+" — UNIQUE(tournament_id, priority) "+
					"is what makes ascending priority a TOTAL order, so a duplicate is a refusal "+
					"rather than a coin flip")
		}
		seenPriority[c.Priority] = struct{}{}
	}
	return nil
}

// validateLiveCount is W6.
//
// ⛔ NEVER A CLAMP AND NEVER A SHORT RETURN. A clamped spin reveals fewer categories than the
// spin plan promised, and nothing downstream can tell that apart from a plan that asked for
// fewer — the ceremony would simply be quietly smaller than the one that was published.
func validateLiveCount(liveCount, poolSize int) error {
	if liveCount < 1 {
		return refuse(DetailLiveCount, "live_count must be >= 1, got "+strconv.Itoa(liveCount))
	}
	if liveCount > poolSize {
		return refuse(DetailLiveCount,
			"live_count "+strconv.Itoa(liveCount)+" exceeds the "+strconv.Itoa(poolSize)+
				"-candidate pool — never a clamp: a clamped spin reveals fewer categories than "+
				"the spin plan promised")
	}
	return nil
}
