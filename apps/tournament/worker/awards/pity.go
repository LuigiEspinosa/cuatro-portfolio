package awards

import (
	"errors"
	"sort"
)

// Pity — the guaranteed consolation draw (Story 6.7, FR-28 / AD-14 / SM-2 /
// SOLUTION-DESIGN §9.4 / ARCHITECTURE-SPINE.md:221).
//
//	resolve_pity(players, shelf, stream):
//	    validate(stream); validate(players); validate(shelf)      # the PUBLISHED order (P10)
//
//	    # ── the WINLESS SET. shelf == 0 AND not fully DQ'd. An ABSENT key is 0.   (AC1, P6)
//	    #    ⛔ NO FR-21 floors here — never                                        (P7)
//	    #    ⛔ NO read of Outcome.Tied                                  (DECISION K', P8)
//	    winless = sorted(p.SteamID64 for p in players
//	                     if shelf[p.SteamID64] == 0 and not p.IdleDQ)   # byte-lex   (P4)
//
//	    # ── the SEEDED REVEAL ORDER. The OUTCOME is invariant; only this is drawn. (AC2, P2)
//	    order = copy(winless)
//	    for i = len(order) - 1 down to 1:            # DECISION D — Durstenfeld, DESCENDING (P3)
//	        j = UniformInt(stream, i + 1)            #   n = i+1, strictly decreasing; n is never 1
//	        swap(order[i], order[j])                 #   i == j is a LEGAL self-swap
//
//	    return { Winless, RevealOrder: order, Draws, BytesConsumed: stream.Consumed() }
//
// ⭐⭐ P1 — THIS PASS TAKES A STREAM AND THE BYTE COST IS PART OF THE CONTRACT. THE WHOLE
// DISCIPLINE INVERTS FROM `sweep.go`. There, "it draws nothing and the SIGNATURE is the proof" was
// the property, and a `Consumed()` assertion around a function that cannot reach a stream is
// VACUOUS — the 6-4b code review deleted exactly that assertion. Here the stream is a REQUIRED
// parameter, the import of the PRNG primitives is load-bearing, and a `Consumed()` assertion is
// THE GATE: 6.9's browser has to consume the same bytes, not merely reach the same answer.
//
// ⛔ THE CALLER CONSTRUCTS THE STREAM AND PASSES IT IN, the same injection discipline `Stage1Pick`
// uses, because the seed and the label are the ceremony's to publish and not this file's to invent.
// ⭐⭐ AND "THE STREAM IS FRESH AND KEYED BY PityLabel" IS A CLAIM ABOUT A CALLER, NOT A
// CONSTRUCTION — SO IT IS CHECKED, NOT ASSERTED. Story 6.6's AC1 claimed a property held "by
// construction" when it held only for the shipped composition and the code review measured it.
// `validatePityStream` below checks both halves.
//
// ⛔ NO `math/big` HERE, AND `prng_test.go`'s EXCEPTION LIST MUST NOT BE WIDENED FOR THIS FILE.
// This pass performs no magnitude arithmetic at all: it INDEXES and SWAPS. Its only numbers are a
// slice length, a loop counter and `UniformInt`'s own result, all bounded by `MaxN` by
// construction. The same argument 6-4b was told to make about `stage1.go` and 6.6 made about
// `sweep.go`, made again — the exemption is about the arithmetic, never the convenience.
//
// ⛔ NO CLOCK, NO I/O, NO DATABASE, NO AMBIENT CONFIG (DECISION B). The verifier must reproduce
// this from the published bundle alone (SOLUTION-DESIGN:448-449), which is also why `pity` is a
// published bundle key (§9.5:433) — and therefore outcome-affecting for 6.9's `bundle_sha256`.
//
// THE SEAM (ARCHITECTURE-SPINE.md:73-76). This file conforms to `roulette/vectors/pity-draw.json`,
// never to lib/roulette/pity.ts. Two independent implementations of one spec; neither is the
// reference and neither may be corrected by reading the other. When they disagree the vector
// decides; when the vector is silent, add a vector.
//
// ⛔ NOT IN THIS FILE, each with an owner: every WRITE — the pity `spin` row(s), `spin.kind =
// 'pity'`, `spin_index`, `award_result` with `is_pity = true`, `award_result_winner`, the
// `steamid64 -> roster_entry.id` mapping, the reveal axis — is Story 6.8's; RFC-8785
// canonicalization, `bundle_sha256` and the `pity` bundle key's SHAPE are 6.9's; the `ronda de
// consolación` UI and every i18n string are 6.10's; the END-TO-END ceremony vector that must
// exercise a pity draw (§9.6 gate 4) is 6.11's — this file's vector is the UNIT one.
// `worker/awards` stays the leaf `TestPackageIsALeaf` pins.

// ErrPity is the sentinel every refusal in this file wraps.
//
// ⭐ TYPED, mirroring ErrSweep, ErrStage1 and ErrLadder, and for the reason 6-4a measured two
// stories up: with an untyped surface a vector-driven refusal gate can only assert "some error", so
// a mutation that made validation reject EVERY input leaves every refusal row passing.
var ErrPity = errors.New("awards: pity refused")

// The closed set of things a pity refusal can be ABOUT (P9). THREE distinct FACTS, three distinct
// labels, because they mean genuinely different things to a caller:
//
//	PityDetailStream   the injected stream is absent, keyed by the wrong label, or already drawn on
//	PityDetailPlayers  the roster's own shape is wrong — a duplicate or an empty steamid64
//	PityDetailShelf    a shelf count is negative, or a shelf key names nobody on the roster
//
// ⭐ AND IT IS GENUINELY CLOSED. Story 6-4b shipped a "closed set" that was 9 / 7 / 7 across three
// implementations with one input carrying two different labels; Story 6.5 shipped one whose fifth
// value no suite inspected; 6.6 was the first that closed it properly and this copies 6.6 rather
// than inventing a third design. The vocabulary is declared once in the vector's `refusal_details`,
// all three implementations read it, and `TestPityDetailsAreExactlyTheDeclaredSet` pins these
// constants against it so a fourth cannot be added on one side alone.
const (
	PityDetailStream  = "stream"
	PityDetailPlayers = "players"
	PityDetailShelf   = "shelf"
)

// ⭐⭐ THERE IS DELIBERATELY NO `internal` LABEL HERE, AND THE ABSENCE IS ARGUED RATHER THAN
// OVERLOOKED. `sweep.go` declares one because `Ladder` is an INJECTED PORT that can hand it an
// outcome no code in this package built — 6.9's browser reimplements that port, and any third-party
// implementation reaches exactly those arms. PITY HAS NO SUCH PORT. Every value it decides from is
// either a plain input it has just validated or the return of `UniformInt`, whose `[0, n)` contract
// is pinned by gate 2's own vector in the same three implementations. A fourth label would be a
// COMPARTMENT rather than a contract — one no suite could ever drive, which is the defect
// `stage1.go:118-131` records under a different name. The multiset identity between `Winless` and
// `RevealOrder` is therefore asserted as a TEST over every vector case in all three
// implementations, rather than as a runtime refusal nothing can reach.
//
// ⚠ ALL THREE LABELS ARE ROW-REPRESENTABLE, so the vector's `refusal_details` and
// `row_representable_refusal_details` are EQUAL — which is a fact worth stating as data rather than
// a key worth omitting. The one arm no ROW can express is `stream` with NO STREAM AT ALL: "no
// stream was supplied" is not a JSON input, so that half is driven by this package's own test the
// way `TestStage1PickRefusesANilStream` drives Stage 1's.

// PityInvalidError is every refusal, and it NAMES WHICH INPUT was rejected.
//
// Mirrors SweepInvalidError (`sweep.go:88-117`) and Stage1InvalidError deliberately: one shape for
// refusals across the package means one thing for a caller to switch on.
type PityInvalidError struct {
	Detail string
	Reason string
	// Cause is a propagated lower-level refusal — today only a `UniformInt` error, which is
	// unreachable through the shipped primitive because every `n` this pass passes is in `[2, len]`
	// and `len` is bounded by the roster. It is carried rather than swallowed because a caller that
	// cannot see the cause cannot tell a broken primitive from a broken input.
	Cause error
}

func (e *PityInvalidError) Error() string {
	return "awards: pity refused (" + e.Detail + "): " + e.Reason
}

// Unwrap returns BOTH ErrPity and any propagated cause, so `errors.Is(err, ErrPity)` answers "did
// the pity draw refuse" while a wrapped cause stays reachable.
func (e *PityInvalidError) Unwrap() []error {
	if e.Cause == nil {
		return []error{ErrPity}
	}
	return []error{ErrPity, e.Cause}
}

// pityRefuse builds a typed refusal. Every VALIDATION return in this file goes through it, so no
// refusal can reach a caller without naming its input.
//
// ⚠ IT IS NOT THE ONLY CONSTRUCTION SITE, AND THE COMMENT USED TO CLAIM IT WAS (6.7 code review).
// The `UniformInt` arm inside the shuffle builds its `PityInvalidError` inline because it carries a
// `Cause` and this helper takes none. Two consequences a maintainer must not be misled about: this
// is NOT a chokepoint suitable for cross-cutting behaviour, and the one arm it does not cover is
// also the one refusal that fires AFTER the stream has advanced.
func pityRefuse(detail, reason string) error {
	return &PityInvalidError{Detail: detail, Reason: reason}
}

// PityInput is everything the consolation draw depends on. All of it is INJECTED.
//
// ⭐ A STRUCT, NOT THREE POSITIONAL PARAMETERS — `Stage1Input` is the precedent. `(players, shelf,
// stream)` is three arguments a caller can transpose, and two of them are keyed by the same string
// type; a struct literal names each one at the call site.
type PityInput struct {
	// Players is the frozen AD-19 snapshot, REUSED rather than restated. Two near-identical player
	// shapes is how the two runtimes drift — 6.5 said it about `StatValue` and 6.6 about
	// `Stage1Candidate`.
	//
	// ⚠ AN ABSENT CONTAINER IS THE EMPTY CONTAINER (P11, Cuatro's call at the 6-4b review): a nil
	// slice is the EMPTY roster and resolves to an empty draw, never a refusal. Go cannot
	// idiomatically tell a nil slice from an empty one, so the other two runtimes must agree.
	Players []SnapshotPlayer

	// Shelf maps SteamID64 to the number of trophies that player already holds after ALL main
	// spins, and it is THE SHAPE `Stage1Input.Shelf` ALREADY DEFINES — reused, not redeclared.
	//
	// ⭐ P6 / DECISION G — IT IS READ, NEVER WRITTEN, and there is no return path that could write
	// it. Advancing the shelf across spins is the CALLER's job: `ResolveSpin` deliberately never
	// touches it (A10, `sweep.go:198-209`, which names this story), so the caller accumulates
	// `SpinResult.Assigned` across the twelve spins into this map and pity reads the result.
	//
	// ⚠ AN ABSENT PLAYER IS SHELF 0, exactly as W8 defines it for Stage 1 (`stage1.go:220-221`) —
	// the normal shape after a ceremony where nobody won, never an error. The INVERSE is a refusal:
	// see `validatePityShelf`.
	Shelf map[string]int

	// Stream is the pity draw's own domain-separated stream, keyed by PityLabel and starting at
	// counter 0. REQUIRED — see P1 on the package comment above.
	Stream *Stream
}

// PityDraw records one shuffle step, including what it cost the stream.
//
// ⭐ MIRRORS `Stage1Draw` (`stage1.go:253-265`) IN PURPOSE, and carries `Rejections` where that
// carries `ConsumedAfter`, because `Rejections` is strictly the more informative of the two here:
// the byte cost of a step is `K * (1 + Rejections)` exactly, so the cumulative position is
// derivable from the sequence while the rejection count is not derivable from the position without
// knowing `K`. The vector pins all four fields on every step and the total separately, and the
// anchor re-derives the total from the steps so the summary cannot drift from what it summarises.
//
// ⛔ DO NOT REMOVE THESE BECAUSE NOTHING IN THE ENGINE READS THEM. They are what makes "both
// runtimes consumed identical bytes" an assertion instead of a claim, and a rejection inside
// `UniformInt` is observable from outside in no other way.
type PityDraw struct {
	// N is the `n` this step drew over: `i + 1`, strictly decreasing from len(winless) down to 2.
	N uint64
	// K is `minimalK(N)` — 1 for every roster this ceremony can produce.
	K int
	// Rejections is how many times `UniformInt` rejected before returning, derived from the byte
	// position rather than counted inside a second copy of the primitive.
	Rejections int
	// Value is the index `j` the step swapped with. `j == i` is a LEGAL self-swap.
	Value uint64
}

// PityResult is the whole consolation draw's answer.
type PityResult struct {
	// Winless is every player who holds no trophy and is not fully DQ'd, in BYTE-LEX order — the
	// same order Stage 2 iterates and the ladder's rung 5 returns.
	//
	// ⭐⭐ THIS IS THE OUTCOME, AND IT IS INVARIANT. "Everyone winless gets one" (SPINE:221) means
	// the set of winners IS this set: no selection, no elimination, no weighting.
	Winless []string

	// RevealOrder is the SEEDED permutation of Winless — the order the consolation prizes are
	// revealed in, and the only thing the stream decides.
	//
	// ⭐⭐ TWO FIELDS, NEVER ONE, so a caller cannot accidentally publish the canonical order as the
	// reveal order or vice versa. With one field that would be a typo; with two it is a type error
	// at the call site. Both are ALWAYS non-nil, even when empty, so the JSON a harness or 6.9's
	// bundle prints carries `[]` rather than `null` — three spellings of absence is a hazard this
	// epic has paid for twice already.
	RevealOrder []string

	// Draws is one entry per shuffle step, in the order they were drawn. Empty for a winless set of
	// length 0 or 1, which is AC3's whole content: the loop body never runs, so there are no draws
	// and no bytes.
	Draws []PityDraw

	// BytesConsumed is the stream's cumulative position after the draw — `Stream.Consumed()`.
	BytesConsumed uint64
}

// ResolvePity is FR-28's guaranteed consolation draw, run ONCE after all main spins.
//
// ⭐⭐ P2 — THE OUTCOME IS INVARIANT AND ONLY THE ORDER IS SEEDED. A "draw" here is a PERMUTATION,
// not a lottery. There is no selection, no elimination, no weighting and no luck meter: every
// winless player gets exactly one consolation award, and the stream decides only the sequence they
// are revealed in. This is stated because "pity ROULETTE" reads like a lottery and FR-28's own name
// invites the wrong implementation — the one that would draw N winners out of the winless set and
// leave the rest with nothing, defeating the entire requirement while looking like a faithful
// reading of the word.
//
// ⭐⭐ P7 — THE FR-21 FLOORS ARE NEVER CONSULTED, AND THIS IS THE EASIEST SEMANTIC IN THE STORY TO
// GET BACKWARDS. Pity's eligibility is "not fully AFK/idle-DQ'd" (FR-28, prd.md:385) and NOTHING
// else. A player who missed the floors won nothing PRECISELY BECAUSE OF THEM, so re-applying them
// here would exclude the very people FR-28 exists for and make SM-2 ("zero Players finish with no
// shot at a prize") unachievable by construction. ⛔ NOTE WHAT IS ABSENT BELOW: no `RoundsPlayed`
// read, no `Kills` read, no `eligiblePlayers` call, no `Award` parameter at all — there is nothing
// in this function's signature a floor could even be read from.
//
// ⭐ P8 / DECISION K' — THE SUPPRESSED `Tied` SET IS NOT READ, AND THAT IS A DECISION RATHER THAN AN
// OMISSION. `ARCHITECTURE-SPINE.md:148` says a `no_awardable_value` outcome carries its suppressed
// set "so the width of the tie that did not form stays readable to the ladder (6.5), anti-sweep
// (6.6) and pity (6.7)" — so a future maintainer WILL come here to "restore" the dependency.
// READABLE IS NOT THE SAME AS READ: a suppressed player did not win, so their shelf is unchanged,
// so the shelf ALREADY places them in the winless set. Reading `Tied` would be redundant at best
// and double-counting at worst, and it would couple this pass to a Stage-2 arm it has no other
// reason to know about. The width earns its keep at 6.8's reveal copy and in 6.9's bundle.
//
// ⭐ DECISION F' — THE EXHAUSTION / NOBODY-QUALIFIED DISTINCTION IS DELIBERATELY NOT BRANCHED ON.
// Story 6.6 carried it on `AwardAssignment.SweptOut` specifically for this story (`sweep.go:140-147`
// says so by name), and the answer is that it does not change who is winless: both facts leave the
// player at shelf 0 and both put them in pity. It matters for 6.8's reveal copy, not for this
// input. Stated here so the next reader does not assume it was missed.
func ResolvePity(in PityInput) (PityResult, error) {
	// ⛔ P10 — VALIDATION ORDER IS CONTRACT: stream -> players -> shelf. It is published in the
	// vector's `spec` string, mirrored in all three implementations, and two refusal rows are
	// malformed in TWO WAYS AT ONCE — one on each ADJACENT boundary — so a reordering is observable
	// in the file rather than only in prose. 6-4b's headline defect was three implementations
	// disagreeing about validation order with NO row able to see it, and 6.5 shipped the same class
	// again; this has now been the headline of two reviews.
	//
	// The STREAM goes first because it is this pass's one injected dependency, exactly as
	// `ResolveSpin` checks its `Ladder` before it reads anything else.
	if err := validatePityStream(in.Stream); err != nil {
		return PityResult{}, err
	}
	rosterIDs, err := validatePityPlayers(in.Players)
	if err != nil {
		return PityResult{}, err
	}
	if err := validatePityShelf(in.Shelf, rosterIDs); err != nil {
		return PityResult{}, err
	}

	// ── the WINLESS SET (AC1) ──────────────────────────────────────────────────────────────────
	//
	// ⭐ `IdleDQ` IS THE SNAPSHOT SENSE AND THE TWO FACTS ARE PINNED HERE BECAUSE THIS IS WHERE
	// GETTING THEM BACKWARDS IS EXPENSIVE (0024:584-589, restated on `SnapshotPlayer.IdleDQ` at
	// `stage2.go:145-148`):
	//
	//	(1) TRUE means FULLY DQ'd — the player has AT LEAST ONE approved stat_row and EVERY one of
	//	    them is idle. That is the only exclusion FR-28 admits.
	//	(2) A ROSTERED PLAYER WITH ZERO APPROVED ROWS IS `false` WITH ZERO STATS: winless, NOT
	//	    disqualified, "and 6.7's pity draw must still be able to reach them" — 0024's words.
	//
	// ⛔ THE DQ FILTER IS MEASURED-INERT ON THE REAL CORPUS: 0 of 28 players are fully DQ'd. That
	// is a measured zero recorded in this story's Completion Notes, NOT a reason to delete the
	// filter — it is FR-28's only stated exclusion, and a corpus where somebody idles the whole
	// tournament is one approved demo away.
	//
	// ⭐ P4 — SORTED BEFORE THE FIRST DRAW, NEVER AFTER. The seeded permutation is a function of
	// the input SEQUENCE, so without this the reveal order would depend on the order the caller
	// happened to iterate a database cursor in, and the ceremony would stop being reproducible from
	// the published bundle. Story 6.6's mutation pass measured the twin of this defect surviving
	// because every fixture roster was already sorted, which is why the vector's out-of-byte-lex
	// row was written in the same edit as this line.
	winless := make([]string, 0, len(in.Players))
	for _, p := range in.Players {
		// ⚠ ONE MAP READ, TWO FACTS. Go's zero value for a missing key IS 0, which is exactly W8's
		// "an ABSENT player is shelf 0 … never an error" — so the absent case needs no branch, and
		// adding one would be the first step toward treating absence as a refusal.
		if in.Shelf[p.SteamID64] == 0 && !p.IdleDQ {
			winless = append(winless, p.SteamID64)
		}
	}
	//
	// ⚠⚠ "BYTE-LEX" IS TRUE HERE AND IN THE PYTHON ANCHOR, AND IS *NOT* TRUE IN TYPESCRIPT (6.7
	// code review). `sort.Strings` orders by UTF-8 BYTE and Python's `sorted` orders by CODE POINT,
	// and those two agree — code-point order and UTF-8 byte order are the same order, by design of
	// UTF-8. JavaScript's default `.sort()` comparator orders by UTF-16 CODE UNIT, which disagrees
	// with both for supplementary-plane characters (a surrogate pair encodes as U+D800–DFFF, which
	// sorts BELOW U+E000–FFFF in UTF-16 and ABOVE it in UTF-8). All three validators require only a
	// NON-EMPTY STRING, where `stage2.*` guards the same field with `^[0-9]+$`.
	// ⛔ NOT FIXED IN THIS SLICE: `sweep.ts` carries the identical defect, 6.6's review already
	// deferred it to 6.9, and this story is scope-barred from touching `sweep.*` — fixing only pity
	// would leave two sibling modules guaranteeing different things about one field.
	// Home: 6.9, BOTH modules, by carrying `stage2.*`'s id-format guard into them.
	sort.Strings(winless)

	// ── the SEEDED REVEAL ORDER (AC2) ──────────────────────────────────────────────────────────
	//
	// ⭐⭐ P3 / DECISION D — THE SHUFFLE VARIANT IS PINNED, NOT "FISHER–YATES". Neither SPINE:221
	// nor §9.4:427-429 says WHICH shuffle, and "seeded reveal order" is satisfied by any of them —
	// so two honest implementers produce two different ceremonies while both correctly calling
	// their work Fisher–Yates. The variant is DURSTENFELD DESCENDING (Cuatro, 2026-08-07), and a
	// reader can execute it by hand from this comment:
	//
	//	i counts DOWN from len(order)-1 to 1 inclusive.  The loop body never runs for len <= 1.
	//	n for the step is i+1, so n is strictly decreasing and n is NEVER 1.
	//	j = UniformInt(stream, n) is in [0, i].
	//	order[i] and order[j] are SWAPPED. j == i is a LEGAL SELF-SWAP and consumes its byte anyway.
	//
	// ⛔ THE REJECTED ALTERNATIVE, RECORDED SO THE NEXT READER DOES NOT RE-OPEN IT: the ascending
	// sweep `for i = 0 to len-2: j = i + UniformInt(s, len-i)`. It is the same family and it
	// produces a DIFFERENT permutation from the same stream; its last step draws n = 1 for zero
	// bytes unless the bound is trimmed, which is an ambiguity the vector would then have to
	// arbitrate instead of the spec. Durstenfeld's per-step n is unambiguous, it never draws n = 1,
	// and it is the form `UniformInt`'s [1, MaxN] contract fits with no special case.
	//
	// ⭐ P5 — len(winless) <= 1 RESOLVES, IT DOES NOT REFUSE (AC3). The loop bound carries it with
	// no branch at all: with 0 or 1 members there is no i to count down from, so there are ZERO
	// draws and ZERO bytes, and the function returns normally. It is not an error and not a skip
	// the caller has to special-case. ⚠ `UniformInt(s, 1)` is legal and reads ZERO bytes
	// (`minimalK(1)` gives k = 0), so an implementation that DID call it here would be
	// byte-identical to this one — which is precisely why the vector pins the `draws` ARRAY and not
	// only the byte count.
	order := make([]string, len(winless))
	copy(order, winless)
	draws := make([]PityDraw, 0, len(order))

	for i := len(order) - 1; i >= 1; i-- {
		n := uint64(i + 1)
		k, _ := minimalK(n)
		before := in.Stream.Consumed()

		// ⭐ THE PRIMITIVE IS CALLED VERBATIM, NEVER RE-IMPLEMENTED. `UniformInt`'s rejection loop
		// is already pinned by gate 2's own vector in all three implementations; a second copy of
		// it here — written to count rejections from the inside — would be the single most subtle
		// piece of arithmetic in the engine, duplicated.
		j, err := UniformInt(in.Stream, n)
		if err != nil {
			// Unreachable through the shipped primitive: n is in [2, len(order)] and len(order) is
			// bounded by the roster, so it can never leave [1, MaxN]. Loud rather than silent, and
			// the cause is carried so a caller can tell a broken primitive from a broken input.
			//
			// ⛔⛔ THIS IS THE ONE REFUSAL IN THE FILE THAT COSTS BYTES, AND IT IS THE REASON THE
			// SUITES' INVARIANT IS SCOPED THE WAY IT IS (6.7 code review). Every other pity refusal
			// is raised by a VALIDATOR before the first draw, which is what makes "a refusal leaves
			// the stream untouched" true of them — `TestResolvePityLeavesTheStreamUntouchedOnEvery
			// Refusal` iterates the vector's refusal rows, all of which are pre-draw. This arm fires
			// mid-shuffle with `Consumed()` already at k*(1+rejections) per completed step, so the
			// invariant must NOT be generalised to it. It is not a hole in the test: it is a
			// property the test deliberately does not claim, stated here so nobody widens it.
			return PityResult{}, &PityInvalidError{
				Detail: PityDetailStream,
				Reason: "the pity stream refused a draw over " + itoa(int(n)) + " members: " + err.Error(),
				Cause:  err,
			}
		}

		// ⭐ `Rejections` IS DERIVED FROM THE BYTE POSITION. A rejection consumes its k bytes and
		// draws k fresh ones (`prng.go:196-230`), so the step's total is k * (1 + rejections) and
		// the count reads straight back out. k is never 0 here because n >= 2 on every step.
		consumed := in.Stream.Consumed() - before
		draws = append(draws, PityDraw{
			N:          n,
			K:          k,
			Rejections: int(consumed/uint64(k)) - 1,
			Value:      j,
		})

		order[i], order[j] = order[j], order[i]
	}

	return PityResult{
		Winless:       winless,
		RevealOrder:   order,
		Draws:         draws,
		BytesConsumed: in.Stream.Consumed(),
	}, nil
}

// validatePityStream is P1 and AC4 — the injected stream, checked rather than assumed.
//
// ⚠ THE NIL ARM IS NOT ROW-REPRESENTABLE. "No stream was supplied" is not a JSON input, so no
// vector row can produce it; it is driven by this package's own test, exactly as
// `TestStage1PickRefusesANilStream` drives Stage 1's. The other two arms ARE row-representable —
// the vector's refusal rows carry an optional `label` and an optional `pre_consumed`.
func validatePityStream(s *Stream) error {
	if s == nil {
		return pityRefuse(PityDetailStream,
			"a Stream must be injected — pity DRAWS its reveal order and will not open a stream of "+
				"its own, because the seed and the label are the ceremony's to publish")
	}
	// ⭐ THE LABEL, AND ONLY THE PITY LABEL (AC4). A Stage-1 label here would consume bytes that
	// spin's stream expects and move every byte position after it, which is invisible in the result
	// and fatal from the next draw onward. `PityLabel` is Story 6.3's and its VALUE is frozen —
	// moving one byte of it invalidates every ceremony ever published.
	if s.Label() != PityLabel {
		return pityRefuse(PityDetailStream,
			"the stream is keyed by "+s.Label()+", not "+PityLabel+" — pity draws from its OWN "+
				"domain-separated stream, and a Stage-1 label here would consume bytes a spin "+
				"expects and move every byte position after it")
	}
	// ⭐ AND IT MUST BE FRESH. `ARCHITECTURE-SPINE.md:216`: "each spin's stream is independent
	// (starts at counter 0)". A partly-drawn stream silently produces a DIFFERENT reveal order from
	// the same seed, which is the class of divergence that is invisible until 6.9's browser
	// declares a correct ceremony unfair.
	if s.Consumed() != 0 {
		return pityRefuse(PityDetailStream,
			"the stream has already consumed "+itoa(int(s.Consumed()))+" byte(s) — each stream is "+
				"independent and starts at counter 0 (SPINE:216), so a partly-drawn one silently "+
				"produces a different reveal order from the same seed")
	}
	return nil
}

// validatePityPlayers is the roster's OWN shape, in full, over the WHOLE list.
//
// ⚠ THE DUPLICATE CLAUSE MIRRORS `eligiblePlayers`'s (`stage2.go:684-694`) CLAUSE FOR CLAUSE and for
// the same reason one layer up: a duplicated steamid64 would be counted twice in the winless set —
// one extra consolation prize — and at 6.8 it becomes a second `award_result_winner` row that trips
// `unique (spin_id, winner_entry_id)` on a write the producer believed was legal.
func validatePityPlayers(players []SnapshotPlayer) (map[string]struct{}, error) {
	seen := make(map[string]struct{}, len(players))
	for _, p := range players {
		if p.SteamID64 == "" {
			return nil, pityRefuse(PityDetailPlayers,
				"steamid64 must be a non-empty string — an empty id in the winless set would match "+
					"no roster row and would be written at 6.8 as a foreign key to nothing")
		}
		if _, dup := seen[p.SteamID64]; dup {
			return nil, pityRefuse(PityDetailPlayers,
				"duplicate steamid64 "+p.SteamID64+" — a roster holds one row per player, and a "+
					"duplicate here is one extra consolation prize")
		}
		seen[p.SteamID64] = struct{}{}
	}
	return seen, nil
}

// validatePityShelf is P6 — the shelf, read and never written.
//
// ⚠ ITERATED IN SORTED KEY ORDER, DELIBERATELY. Go's map iteration is RANDOMISED, so a shelf
// carrying two different defects would report a different MESSAGE on two runs of the same input.
// The `detail` would be stable and the transcript would not, which is exactly the class of
// difference Task 6's mechanical cross-runtime diff exists to catch. All three implementations sort.
//
// ⚠ A NEGATIVE COUNT IS A REFUSAL, NOT A CLAMP. `weightAt`'s two-sided guard (Story 6.6, closing
// `deferred-work.md:308`) is the precedent and this is the same class: a negative shelf is a caller
// that has been subtracting, and treating it as 0 would quietly hand a consolation prize to a
// player who is holding trophies.
//
// ⚠ A SHELF KEY NAMING NOBODY ON THE ROSTER IS ALSO A REFUSAL, AND IT IS THE EXACT INVERSE OF W8'S
// RULE RATHER THAN A CONTRADICTION OF IT. Roster -> shelf, an absent key is the NORMAL shape and
// means 0. Shelf -> roster, an unknown key means the shelf was accumulated over a DIFFERENT roster
// than the one being drawn for, and every winless computation over the two is then arithmetic on
// two different populations.
func validatePityShelf(shelf map[string]int, rosterIDs map[string]struct{}) error {
	keys := make([]string, 0, len(shelf))
	for sid := range shelf {
		keys = append(keys, sid)
	}
	sort.Strings(keys)

	for _, sid := range keys {
		count := shelf[sid]
		if sid == "" {
			return pityRefuse(PityDetailShelf, "a shelf key must be a non-empty steamid64")
		}
		if count < 0 {
			return pityRefuse(PityDetailShelf,
				"shelf["+sid+"] is "+itoa(count)+" — a trophy count is never negative, and clamping "+
					"it to 0 would hand a consolation prize to a player who is holding trophies")
		}
		if _, ok := rosterIDs[sid]; !ok {
			return pityRefuse(PityDetailShelf,
				"shelf key "+sid+" is on no roster row — an ABSENT key is shelf 0 (the normal "+
					"shape), but an UNKNOWN key means the shelf was accumulated over a different "+
					"roster")
		}
	}
	return nil
}
