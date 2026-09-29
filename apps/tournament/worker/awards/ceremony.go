// ceremony.go — Story 6.8a, FR-25 / FR-26 / FR-28 / FR-29 / AD-14 / SOLUTION-DESIGN §9.2.
//
// ⭐ THE THESIS. Until this file, `worker/awards` was SEVEN LEAF MODULES WITH NOTHING CALLING THEM
// IN SEQUENCE: labels, prng, stage1, stage2, ladder, sweep and pity each shipped with a golden
// vector and none of them ever ran one after another. This is the orchestrator — the one place that
// knows a ceremony is a SEQUENCE of spins rather than a spin.
//
// ⭐⭐ IT IS A PURE FUNCTION, AND THAT IS THE ARCHITECTURAL POINT (AD-14,
// ARCHITECTURE-SPINE.md:73-76). `RunCeremony` maps `(seed, catalog, snapshot, plan config)` to a run
// DOCUMENT. It opens no database, reads no clock, takes no configuration from the ambient
// environment and returns no handle to anything. The `persist_ceremony` RPC is the only thing that
// writes, and Story 6.9's browser verifier must be able to reproduce every byte of this from the
// published bundle alone — which it cannot if this file ever learns where a row lives.
//
// ⛔ DO NOT ADD AN IMPORT OUTSIDE THE STANDARD LIBRARY. `TestPackageIsALeaf` (`prng_test.go:985`)
// pins the four forbidden edges (`worker/ingest`, `worker/store`, `worker/db`, `worker/config`) and
// this file must not be the one that creates a fifth. No `net/http`, no driver, no config package.
//
// ⚠ GO ONLY, AND THE ABSENCE OF A TYPESCRIPT MIRROR IS DELIBERATE (Cuatro, 2026-08-08). Stories
// 6.3-6.7 each shipped their module in BOTH runtimes with a golden vector holding them equal; this
// one does not, because `lib/roulette` is the VERIFIER and a verifier needs an orchestrator only
// once it has a published bundle to verify against — which is 6.9's deliverable. `roulette/vectors/
// README.md`'s own gate table gives 6.8 NO GATE: gate 4 (canonical JSON + `bundle_sha256`) is 6.9's
// and gate 5 (end-to-end ceremony from a REAL captured snapshot) is 6.11's, and a synthetic chaining
// vector added now would half-cover ground 6.11 must cover properly. THE COST, STATED PLAINLY: this
// file carries no cross-language proof until 6.11's gate 5.
//
// ⭐ WHAT THIS FILE DECIDES, AND WHAT IT DELIBERATELY DOES NOT. It decides the SPIN PLAN (which
// awards are in which spin's pool), the STREAM PER SPIN (a fresh one, domain-separated by
// `Stage1Label(S)`), and the SHELF THREADING (the cumulative trophy count that makes FR-26's luck
// meter biased across spins rather than within one). It decides NOTHING about who wins: Stage 2, the
// FR-29 ladder, the anti-sweep pass and the pity draw already own that, and this file calls them.

package awards

import (
	"errors"
	"sort"
)

// ErrCeremony is the sentinel every refusal in this file wraps.
//
// ⭐ TYPED, mirroring ErrStage1 / ErrSweep / ErrLadder / ErrPity, and for the reason 6-4a measured
// four stories up: with an untyped surface a caller can only assert "some error", so a mutation that
// made validation reject EVERY input leaves every refusal path passing.
//
// ⚠ A refusal that PROPAGATES from a lower module is wrapped in BOTH, so `errors.Is(err, ErrCeremony)`
// holds for every refusal this file returns while `errors.Is(err, ErrStage1)` / `ErrSweep` / `ErrPity`
// still identifies where it came from.
var ErrCeremony = errors.New("awards: ceremony refused")

// The closed set of things a ceremony refusal can be ABOUT. Each is a genuinely different fact with a
// different remedy, which is the rule `stage1.go:85-131` established and `sweep.go` / `pity.go` copied:
//
//	CeremonyDetailSeed      the seed_hex is not 64 lowercase hex characters — a bad ceremony row
//	CeremonyDetailCatalog   the frozen catalog's own shape is wrong — empty, or a duplicate priority
//	CeremonyDetailLiveCount the organizer's live_count is out of range for the catalog
//	CeremonyDetailStream    a stream could not be opened for a label this file built
//	CeremonyDetailStage1    a Stage-1 refusal, propagated rather than swallowed
//	CeremonyDetailSweep     an anti-sweep refusal, propagated rather than swallowed
//	CeremonyDetailPity      a pity refusal, propagated rather than swallowed
//	CeremonyDetailInternal  an invariant this file believes unreachable
const (
	CeremonyDetailSeed      = "seed"
	CeremonyDetailCatalog   = "catalog"
	CeremonyDetailLiveCount = "live_count"
	CeremonyDetailStream    = "stream"
	CeremonyDetailStage1    = "stage1"
	CeremonyDetailSweep     = "sweep"
	CeremonyDetailPity      = "pity"
	CeremonyDetailInternal  = "internal"
)

// ⚠ THE LAST TWO ARE DECLARED AND ARE NOT INPUT-REPRESENTABLE, and the distinction is stated rather
// than left for a reader to trip over — it is the rule `stage1.go:118-131` and `sweep.go:77-86` both
// record. `stream` here can only fire if `Stage1Label` or `PityLabel` produced an empty or non-UTF-8
// label, which no INPUT can cause because this file builds both labels itself from a validated
// 1-based counter; `internal` covers arms whose precondition the validation above has already
// established. Both are reachable only by a mutation of this file, which is exactly what the tests
// that drive them are for — they are driven by the suite, never by a caller's data.

// CeremonyInvalidError is every refusal, and it NAMES WHICH INPUT was rejected.
//
// Mirrors Stage1InvalidError (`stage1.go:133-159`), SweepInvalidError and PityInvalidError
// deliberately: one shape for refusals across the package means one thing for a caller to switch on,
// and the thin worker-side caller routes on exactly that.
type CeremonyInvalidError struct {
	Detail string
	Reason string
	// Cause is the propagated lower-level refusal on the stage1/sweep/pity details, nil otherwise.
	Cause error
}

func (e *CeremonyInvalidError) Error() string {
	return "awards: ceremony refused (" + e.Detail + "): " + e.Reason
}

// Unwrap returns BOTH ErrCeremony and any propagated cause, so `errors.Is(err, ErrCeremony)` answers
// "did the ceremony refuse" while `errors.Is(err, ErrStage1)` still says where it came from.
func (e *CeremonyInvalidError) Unwrap() []error {
	if e.Cause == nil {
		return []error{ErrCeremony}
	}
	return []error{ErrCeremony, e.Cause}
}

// ceremonyRefuse builds a typed refusal carrying no cause.
//
// ⚠ IT IS NOT THE ONLY CONSTRUCTION SITE — the three propagating arms build their own inline because
// they carry a `Cause` and this helper takes none. Stated because `pity.go:138-142` records that the
// same comment used to claim otherwise and the 6.7 code review caught it.
func ceremonyRefuse(detail, reason string) error {
	return &CeremonyInvalidError{Detail: detail, Reason: reason}
}

// WinnersOf projects an outcome onto its winner set.
//
// ⚠ ALWAYS NON-NIL, and it COPIES. A payload must carry `[]` rather than `null` — three spellings of
// absence is a hazard this epic has already paid for twice — and returning `out.Winners` directly
// would hand a caller a slice aliasing the engine's own result.
//
// ⭐⭐ EXPORTED HERE BECAUSE THERE USED TO BE TWO OF IT, AND THEY DISAGREED (Story 6.8a code review).
// `worker/ceremony` held this version; `sweep_test.go` held a test-only copy that returned `nil` for
// the default case and ALIASED `out.Winners` for the shared case. The Go suite built its EXPECTATIONS
// with the test copy while the DATABASE received the output of the production one — so the two could
// drift apart with every gate green. One exported function used by both removes the question instead
// of documenting it.
func WinnersOf(out Outcome) []string {
	switch out.Kind {
	case KindWinner:
		return []string{out.SteamID64}
	case KindShared:
		return append([]string{}, out.Winners...)
	default:
		return []string{}
	}
}

// CeremonyInput is everything a ceremony run depends on. All of it is INJECTED — see the package note
// above on why that is the whole design.
type CeremonyInput struct {
	// SeedHex is `ceremony.seed_demo_sha256` — 64 LOWERCASE hex characters (AD-13). It is taken as
	// HEX rather than as a decoded [32]byte deliberately: the decode is a REFUSAL SURFACE
	// (`prng.go:52`, "a 31-byte key silently produces a valid-looking, completely different stream,
	// and there is no later symptom"), and a caller handed a `[32]byte` has already had to do the
	// decode somewhere this file cannot see.
	SeedHex string

	// Catalog is the FROZEN award catalog — every candidate the ceremony can ever draw, which for the
	// shipped tournament is exactly twelve (`lib/awards/catalog.test.ts:33-34`, priorities 1..12).
	//
	// ⚠ IT IS THE WHOLE CATALOG, NOT ONE SPIN'S POOL. Deriving each spin's pool is this file's job and
	// is the substance of AC1; `Stage1Input.Candidates` receives the DERIVED pool
	// (`stage1.go:194-197`: "the pool arrives ALREADY FILTERED — 'minus already-revealed' is the spin
	// plan's bookkeeping and belongs to Story 6.8").
	Catalog []Stage1Candidate

	// Players is the frozen AD-19 snapshot, REUSED rather than restated (the rule 6.5 stated about
	// StatValue and 6.6 about Stage1Candidate: two near-identical player shapes is how runtimes drift).
	Players []SnapshotPlayer

	// Table is the published `ceremony.luck_weight_table` — organizer config, defaulted by `0025` to
	// [100, 40, 16, 6, 2, 1]. This file validates NOTHING about it and seeds NOTHING into it: its
	// shape is `stage1.go`'s `validateWeightTable` to refuse and its VALUES are the database column's
	// to hold (`0025:365-371`, which forbids both engine halves from seeding one).
	Table []int

	// LiveCount is how many awards each main spin draws — ORGANIZER CONFIG, not a constant.
	//
	// ⛔ NOT HARD-CODED TO 1 ANYWHERE IN THIS FILE, AND THAT IS DELIBERATE.
	// `generate_vectors.py:6298-6310` states the rule: "UX fixes the pacing at ONE award per spin …
	// `spin_plan` is organizer config that can widen without a code change". A `1` written into the
	// engine would make widening a code change, which is precisely what the spin plan exists to avoid.
	LiveCount int
}

// SpinPlanEntry is one row of the published `ceremony.spin_plan` (AC1, SOLUTION-DESIGN:407).
//
// ⭐ THE PLAN IS A RECORD OF THE RUN'S STRUCTURE, NOT A PREDICTION OF IT, and the difference is worth
// stating because `0024:201` created the column as a SHELL and a reader may expect it to be
// computable before the ceremony starts. It is not: `pool[S]` is "the catalog minus every award
// already assigned in an earlier spin", and WHICH awards those are is decided by Stage 1's seeded
// draw. The plan is therefore derived AS the run proceeds and published with it — deterministically,
// because the draw is a pure function of the seed, so re-running the same input reproduces the same
// plan byte for byte.
type SpinPlanEntry struct {
	// Spin is 1-BASED, matching `Stage1Label`'s counter (`labels.go:56-64`) and the `spin.spin_index`
	// column the writer fills.
	Spin int

	// Pool is the candidate award ids for this spin in ASCENDING PRIORITY — the catalog minus every
	// award drawn in spins < Spin.
	Pool []string

	// LiveCount is how many awards THIS spin drew.
	//
	// ⚠ IT IS PER-ENTRY, NOT A CONSTANT COPIED N TIMES, and the last spin is why: when the catalog
	// does not divide evenly by `CeremonyInput.LiveCount` the final spin draws the REMAINDER. The
	// alternative — refusing a catalog that does not divide evenly — would make a twelve-award catalog
	// undrawable at `live_count = 5` for no reason a viewer could understand. At the shipped
	// `live_count = 1` the two designs are identical and this one needs no extra refusal.
	LiveCount int
}

// CeremonySpin is one main spin, whole: what it was planned to draw, what it drew, what that cost the
// stream, and what the awards concluded.
type CeremonySpin struct {
	// Spin is 1-based.
	Spin int

	// Label is the domain separator this spin's stream was opened with — recorded rather than
	// re-derivable-in-principle, because "which stream did spin 7 draw from" is the single most
	// load-bearing fact in a provably-fair ceremony and 6.9's verifier re-opens it by name.
	Label string

	// Plan is this spin's entry in the published plan.
	Plan SpinPlanEntry

	// ShelfAtStart is the cumulative trophy count as it stood BEFORE this spin drew — the shelf Stage
	// 1 froze and weighted from (W1, `stage1.go:219-222`).
	//
	// ⭐ RECORDED SO THE WEIGHTS ARE RE-DERIVABLE FROM THE RUN DOCUMENT ALONE. Without it
	// `Stage1.Weights` is a list of integers nobody can check: FR-26's weight is
	// `table[min(shelf[provisional_winner], table_max)]`, so a reader who cannot see the shelf cannot
	// tell a correctly biased meter from a constant. It is a COPY, never the live map.
	ShelfAtStart map[string]int

	// Stage1 is the seeded weighted pick. `Stage1.Live` is in DRAW order, which IS the reveal order
	// (`stage1.go:269-274`, `0025:127-129`) and is what the writer stores in `spin.live_award_ids`.
	Stage1 Stage1Result

	// Result is the anti-sweep pass's answer. `Result.Results` is in ASCENDING PRIORITY (processed
	// order), NOT reveal order — `sweep.go:161-163` names this story as the one that reconciles the two.
	Result SpinResult

	// Consumed is `Stream.Consumed()` after the spin — MEASURED FROM THE STREAM, never re-derived
	// from the draw list.
	//
	// ⛔ THE DISTINCTION IS NOT PEDANTRY. 6.7's code review found TypeScript and Python stream guards
	// that checked `label` and `consumed` but never `read`, so a structurally-shaped stand-in silently
	// published an INVENTED byte count while resolving a degenerate set. A count re-derived from the
	// draws would reproduce that defect here: rejections inside `UniformInt` are observable in no
	// other way than the position advancing by more than k.
	Consumed uint64
}

// CeremonyRun is the whole ceremony: the published plan, every main spin, the shelf the main spins
// left behind, and the one consolation draw.
type CeremonyRun struct {
	// SeedHex is the seed this run was drawn from, echoed back verbatim.
	//
	// ⭐⭐ IT IS PROVENANCE, NOT DECORATION, AND ITS ABSENCE WAS A REAL DEFECT. Every byte below is a
	// pure function of this value (AD-13/AD-14), so a run document that did not carry it could not say
	// WHICH ceremony it describes — and `persist_ceremony`'s `seed_mismatch` guard, which exists to
	// stop exactly that, had nothing to compare against. THE BAR is what found it: the writer refused
	// a perfectly well-formed run because the payload's `seed_hex` was the empty string.
	SeedHex string

	// Plan is `ceremony.spin_plan` — one entry per main spin, in ascending Spin.
	Plan []SpinPlanEntry

	// Spins is every main spin in order. `Spins[i].Spin == i+1`.
	Spins []CeremonySpin

	// Shelf is the cumulative trophy count AFTER every main spin — the input FR-28's pity draw reads
	// to decide who is winless (P6 / DECISION G, `pity.go:165-168`: pity reads the shelf, the CALLER
	// accumulates it, and `ResolveSpin` deliberately never touches it).
	//
	// ⚠ A PLAYER WHO WON NOTHING IS ABSENT, NOT PRESENT-WITH-ZERO. That is W8's spelling
	// (`stage1.go:220-221`, "an ABSENT player is shelf 0 … never an error") and it is what
	// `validatePityShelf` accepts; writing explicit zeros would be a second spelling of the same fact.
	Shelf map[string]int

	// PityLabel is the domain separator the consolation stream was opened with. Recorded for the same
	// reason `CeremonySpin.Label` is.
	PityLabel string

	// Pity is FR-28's consolation draw, run EXACTLY ONCE after the last main spin.
	Pity PityResult
}

// RunCeremony is the whole producer side of a ceremony: derive the spin plan, run every main spin
// through its own domain-separated stream, thread the shelf across them so FR-26's luck meter is
// cumulative, and finish with the one FR-28 consolation draw.
//
// ⛔⛔ VALIDATION ORDER IS CONTRACT, AND EVERY *INPUT* REFUSAL COSTS ZERO STREAM BYTES. All three
// input checks run BEFORE the first `NewStream`, so a malformed input cannot advance a counter —
// which is what makes "a refusal is free" true here in the sense 6.7 narrowed it to: VALIDATION
// refusals, at every site. The order is seed -> catalog -> live_count, and it is mirrored in the
// refusal tests.
//
// ⚠ THE CLAIM IS NARROWED ON PURPOSE, BECAUSE THE UNQUALIFIED VERSION WAS FALSE (Story 6.8a code
// review). The `stage1`, `sweep`, `pity`, `stream` and `internal` arms all return AFTER a stream has
// been opened and — for `sweep` and `internal` — after an entire spin has been drawn. Those are
// PROPAGATED refusals from modules this file drives, not input validation, and they cost exactly
// what the draw before them cost. A reader relying on the old package-level sentence would have
// concluded that any `RunCeremony` error implied an untouched counter; it does not.
//
// ⛔ ONE STREAM PER SPIN, FRESH, NEVER REUSED AND NEVER SHARED. `Stage1Label(S)` is the whole point of
// `labels.go`: each spin's stream starts at counter 0 and is independent, so spin 7 can never consume
// bytes spin 8 expects. There is also no concurrency here and there must not be — `Stream` is
// documented as not safe for concurrent use (`prng.go:72-74`) and a `go` statement over the spin loop
// would make the ceremony's bytes depend on the scheduler.
func RunCeremony(in CeremonyInput) (CeremonyRun, error) {
	// ══ 1. THE SEED. First, because every stream below is keyed by it and a 31-byte key produces a
	//    valid-looking, completely different ceremony with no later symptom (`prng.go:46-51`).
	seed, err := DecodeSeed(in.SeedHex)
	if err != nil {
		return CeremonyRun{}, &CeremonyInvalidError{
			Detail: CeremonyDetailSeed,
			Reason: "seed_hex is not a 64-character lowercase hex digest: " + err.Error(),
			Cause:  err,
		}
	}

	// ══ 2. THE CATALOG'S OWN SHAPE, IN FULL, OVER THE WHOLE SET.
	if err := validateCeremonyCatalog(in.Catalog); err != nil {
		return CeremonyRun{}, err
	}

	// ══ 3. THE ORGANIZER'S live_count, against the WHOLE catalog — which is the first spin's pool.
	if err := validateCeremonyLiveCount(in.LiveCount, len(in.Catalog)); err != nil {
		return CeremonyRun{}, err
	}

	// ── `remaining` is the plan's state: the catalog minus every award already assigned, held in
	//    ASCENDING PRIORITY so every pool this file publishes is in that order. A COPY — never sort
	//    the caller's slice, the rule `stage1Weighted` and `ResolveSpin` both keep.
	remaining := make([]Stage1Candidate, len(in.Catalog))
	copy(remaining, in.Catalog)
	sort.Slice(remaining, func(i, j int) bool { return remaining[i].Priority < remaining[j].Priority })

	// ⭐ THE SHELF, THREADED. This map is the ONLY state that crosses a spin boundary, and it is what
	// makes FR-26's luck meter cumulative: Stage 1 weights each candidate by
	// `table[min(shelf[provisional_winner], table_max)]` (`stage1.go:213-229`), so a shelf that was
	// rebuilt per spin instead of carried would leave every spin's bias identical to the first and the
	// underdog rule would be silently OFF with nothing red anywhere.
	shelf := make(map[string]int, len(in.Players))

	run := CeremonyRun{
		SeedHex: in.SeedHex,
		Plan:    make([]SpinPlanEntry, 0, len(in.Catalog)),
		Spins:   make([]CeremonySpin, 0, len(in.Catalog)),
	}

	for spinIndex := 1; len(remaining) > 0; spinIndex++ {
		// This spin's live_count: the organizer's figure, or whatever is left when the catalog does
		// not divide evenly. See the note on SpinPlanEntry.LiveCount.
		liveCount := in.LiveCount
		if liveCount > len(remaining) {
			liveCount = len(remaining)
		}

		entry := SpinPlanEntry{
			Spin:      spinIndex,
			Pool:      awardIDs(remaining),
			LiveCount: liveCount,
		}

		label, err := Stage1Label(spinIndex)
		if err != nil {
			// Unreachable: spinIndex starts at 1 and only increments. Refused rather than ignored
			// because a label this file failed to build must never become a silently-empty stream key.
			return CeremonyRun{}, &CeremonyInvalidError{
				Detail: CeremonyDetailInternal,
				Reason: "building the stage-1 label for spin " + itoa(spinIndex) + ": " + err.Error(),
				Cause:  err,
			}
		}

		stream, err := NewStream(seed, label)
		if err != nil {
			return CeremonyRun{}, &CeremonyInvalidError{
				Detail: CeremonyDetailStream,
				Reason: "opening the stream for spin " + itoa(spinIndex) + " (" + label + "): " + err.Error(),
				Cause:  err,
			}
		}

		// A COPY, taken before the draw. `Stage1Input.Shelf` is frozen at spin start (W1) and
		// `stage1Weighted` computes every weight before the first byte moves, so passing the live map
		// would be correct today — but it would make a later edit that mutated mid-spin silently
		// change the weights, and the recorded ShelfAtStart would alias the map it claims to snapshot.
		shelfAtStart := copyShelf(shelf)

		// ⛔ `FR29Ladder{}`, NEVER `RefusingLadder{}`. `ResolveSpin` REQUIRES a ladder
		// (`sweep.go:206-209`) and Stage 1's is optional only to preserve 6-4b's shipped no-ladder
		// contract; a ceremony that could not resolve a tie would refuse on the first tied award.
		picked, err := Stage1Pick(stream, Stage1Input{
			Candidates: remaining,
			Players:    in.Players,
			Shelf:      shelfAtStart,
			Table:      in.Table,
			LiveCount:  liveCount,
			Ladder:     FR29Ladder{},
		})
		if err != nil {
			return CeremonyRun{}, &CeremonyInvalidError{
				Detail: CeremonyDetailStage1,
				Reason: "spin " + itoa(spinIndex) + " stage 1: " + err.Error(),
				Cause:  err,
			}
		}

		// ⛔ THE LOOP'S ONLY TERMINATION CONDITION IS THAT THIS DRAW SHRINKS `remaining`, SO THE DRAW
		// IS CHECKED RATHER THAN ASSUMED (Story 6.8a code review). `withoutAwards` is a no-op on an
		// empty `picked.Live`, so a Stage 1 that returned short — a regression in `stage1.go`, or a
		// future `LiveCount` interaction — would leave `remaining` untouched, and this loop would
		// climb `spinIndex` forever while `run.Plan` and `run.Spins` grew without bound. Every other
		// invariant in this file is a typed refusal; this one was an infinite loop and an OOM.
		// It is unreachable today (`stage1.go:558` sizes `Live` to `LiveCount` and fills it), which is
		// exactly why it is cheap to state.
		if len(picked.Live) != liveCount {
			return CeremonyRun{}, ceremonyRefuse(CeremonyDetailInternal,
				"spin "+itoa(spinIndex)+" promised "+itoa(liveCount)+" live award(s) but stage 1 drew "+
					itoa(len(picked.Live))+" — the spin plan and the draw disagree, and the pool "+
					"would never shrink")
		}

		// The drawn ids back to their candidates. `picked.Live` is in DRAW order and this preserves
		// it; `ResolveSpin` re-sorts by priority itself (A2, `sweep.go:234-242`) and neither order is
		// this file's to impose.
		live, err := candidatesByID(remaining, picked.Live)
		if err != nil {
			return CeremonyRun{}, err
		}

		spinResult, err := ResolveSpin(live, in.Players, FR29Ladder{})
		if err != nil {
			return CeremonyRun{}, &CeremonyInvalidError{
				Detail: CeremonyDetailSweep,
				Reason: "spin " + itoa(spinIndex) + " anti-sweep: " + err.Error(),
				Cause:  err,
			}
		}

		// ⭐ THE SHELF ADVANCES BY `Assigned`, WHICH IS THE DEDUPED SET OF PLAYERS WHO WON ANYTHING
		// THIS SPIN (`sweep.go:166-172`). A `++` per winner ROW would double-count a co-winner of two
		// awards — which the anti-sweep pass makes impossible within one spin, so the two agree today;
		// using `Assigned` means they agree by construction rather than by coincidence.
		for _, sid := range spinResult.Assigned {
			shelf[sid]++
		}

		run.Plan = append(run.Plan, entry)
		run.Spins = append(run.Spins, CeremonySpin{
			Spin:         spinIndex,
			Label:        label,
			Plan:         entry,
			ShelfAtStart: shelfAtStart,
			Stage1:       picked,
			Result:       spinResult,
			Consumed:     stream.Consumed(),
		})

		// ⚠⚠ THE POOL SHRINKS BY WHAT WAS *DRAWN*, NOT BY WHAT WAS *ASSIGNED*, AND THE STORY'S WORDING
		// SAYS OTHERWISE (Story 6.8a code review — the code is right, the prose was wrong).
		// AC1 and T2 both read "the catalog minus every award already ASSIGNED in an earlier spin".
		// Taken literally that is unimplementable here: at the shipped FR-21 floors NOTHING is ever
		// assigned (0 of 28 players clear 24/20, five stories running), so `remaining` would never
		// shrink and the loop above would not terminate. `SOLUTION-DESIGN.md:407` has the correct
		// formulation — "minus already-REVEALED" — and an award that was drawn is revealed whether or
		// not anybody qualified for it. Recorded here so 6.9's bundle spec does not inherit the
		// story's phrasing.
		remaining = withoutAwards(remaining, picked.Live)
	}

	// ══ 4. FR-28's CONSOLATION DRAW, EXACTLY ONCE, ON ITS OWN FRESH STREAM.
	//
	// ⛔ THE STREAM MUST BE FRESH AND KEYED BY `PityLabel`, and `validatePityStream`
	// (`pity.go:419-434`) REFUSES a Stage-1 label or an already-drawn stream. That refusal is a real
	// guard, not decoration: reusing spin 12's stream here would make the consolation order a function
	// of how many bytes the last spin happened to consume.
	pityStream, err := NewStream(seed, PityLabel)
	if err != nil {
		return CeremonyRun{}, &CeremonyInvalidError{
			Detail: CeremonyDetailStream,
			Reason: "opening the pity stream (" + PityLabel + "): " + err.Error(),
			Cause:  err,
		}
	}

	pity, err := ResolvePity(PityInput{
		Players: in.Players,
		Shelf:   shelf,
		Stream:  pityStream,
	})
	if err != nil {
		return CeremonyRun{}, &CeremonyInvalidError{
			Detail: CeremonyDetailPity,
			Reason: "the consolation draw: " + err.Error(),
			Cause:  err,
		}
	}

	run.Shelf = shelf
	run.PityLabel = PityLabel
	run.Pity = pity
	return run, nil
}

// validateCeremonyCatalog is the catalog half of the plan's shape.
//
// ⚠ IT MIRRORS `validatePool` (`stage1.go:768`) AND `validateLive` (`sweep.go:472`) CLAUSE FOR
// CLAUSE, deliberately: the three are the same rule about the same column, and a catalog this file
// accepted must not be a pool Stage 1 rejects. The one difference is the LABEL — `catalog` here,
// because the caller routes on it and "the frozen catalog is malformed" and "spin 7's pool is
// malformed" are different problems with different remedies.
//
// ⭐ THE DUPLICATE-PRIORITY CLAUSE IS THE POINT, one layer higher than Stage 1 enforces it.
// `UNIQUE(tournament_id, priority)` (`0023:150`) is the only thing making "ascending priority" a
// TOTAL order; without it the plan's own pool ordering — which is published — would depend on the
// order the caller happened to read a database cursor in.
func validateCeremonyCatalog(catalog []Stage1Candidate) error {
	if len(catalog) == 0 {
		return ceremonyRefuse(CeremonyDetailCatalog,
			"the frozen catalog is empty — a ceremony with nothing to draw is a refusal, never a "+
				"zero-spin run that looks like it completed")
	}
	seenID := make(map[string]struct{}, len(catalog))
	seenPriority := make(map[int]struct{}, len(catalog))
	for _, c := range catalog {
		if c.AwardID == "" {
			return ceremonyRefuse(CeremonyDetailCatalog, "award_id must be a non-empty string")
		}
		if _, dup := seenID[c.AwardID]; dup {
			return ceremonyRefuse(CeremonyDetailCatalog,
				"duplicate award_id "+c.AwardID+" — one award appears at most once in the catalog")
		}
		seenID[c.AwardID] = struct{}{}

		if c.Priority < 1 {
			return ceremonyRefuse(CeremonyDetailCatalog,
				"award "+c.AwardID+" has priority "+itoa(c.Priority)+
					" — 0023's award_priority_positive requires > 0")
		}
		if _, dup := seenPriority[c.Priority]; dup {
			return ceremonyRefuse(CeremonyDetailCatalog,
				"duplicate priority "+itoa(c.Priority)+" — UNIQUE(tournament_id, priority) is what "+
					"makes ascending priority a TOTAL order, so a duplicate is a refusal rather than "+
					"a coin flip")
		}
		seenPriority[c.Priority] = struct{}{}
	}
	return nil
}

// validateCeremonyLiveCount is the organizer-config half.
//
// ⛔ NEVER A CLAMP AT THE TOP OF THE RUN, which is `validateLiveCount`'s rule (`stage1.go:805-809`)
// and holds for the same reason: a ceremony whose FIRST spin quietly drew fewer awards than the
// organizer configured is indistinguishable from one that was configured smaller.
//
// ⚠ THE LAST SPIN'S REMAINDER IS A DIFFERENT THING AND IS NOT A CLAMP. It is published in that
// spin's own `SpinPlanEntry.LiveCount`, so what the spin drew and what the plan promised are the same
// number by construction. What this refuses is a live_count that was never satisfiable at all.
func validateCeremonyLiveCount(liveCount, catalogSize int) error {
	if liveCount < 1 {
		return ceremonyRefuse(CeremonyDetailLiveCount,
			"live_count must be >= 1, got "+itoa(liveCount)+
				" — the organizer config decides the pacing and zero is not a pacing")
	}
	if liveCount > catalogSize {
		return ceremonyRefuse(CeremonyDetailLiveCount,
			"live_count "+itoa(liveCount)+" exceeds the "+itoa(catalogSize)+
				"-award catalog — the first spin could never satisfy it")
	}
	return nil
}

// awardIDs projects a candidate slice onto its ids, preserving order.
func awardIDs(candidates []Stage1Candidate) []string {
	out := make([]string, len(candidates))
	for i, c := range candidates {
		out[i] = c.AwardID
	}
	return out
}

// copyShelf takes a snapshot of the threaded shelf.
//
// ⚠ ALWAYS NON-NIL, even when empty — a nil map and an empty map are two spellings of "nobody has
// won anything yet", and three spellings of absence is a hazard this epic has already paid for twice
// (`pity.go:216-220`).
func copyShelf(shelf map[string]int) map[string]int {
	out := make(map[string]int, len(shelf))
	for sid, n := range shelf {
		out[sid] = n
	}
	return out
}

// candidatesByID resolves drawn award ids back to their catalog candidates, in the order given.
//
// ⚠ A MISS IS A REFUSAL, NOT A SKIP. `Stage1Pick` draws only from the pool it was handed, so an id
// it returned that is not in that pool means the two disagree about what was live — and a `continue`
// here would hand `ResolveSpin` a SHORTER live set than the spin plan published, producing a ceremony
// that silently revealed fewer awards than it promised. That is the exact failure
// `validateLiveCount` refuses to allow by clamping, arrived at from the other end.
func candidatesByID(pool []Stage1Candidate, ids []string) ([]Stage1Candidate, error) {
	byID := make(map[string]Stage1Candidate, len(pool))
	for _, c := range pool {
		byID[c.AwardID] = c
	}
	out := make([]Stage1Candidate, 0, len(ids))
	for _, id := range ids {
		c, ok := byID[id]
		if !ok {
			return nil, ceremonyRefuse(CeremonyDetailInternal,
				"stage 1 drew award "+id+", which is not in the pool it was handed — the draw and "+
					"the spin plan disagree about what was live")
		}
		out = append(out, c)
	}
	return out, nil
}

// withoutAwards returns the candidates whose ids are NOT in `drawn`, preserving the input order
// (which is ascending priority). This is the plan's "minus already-revealed" step
// (SOLUTION-DESIGN:407).
func withoutAwards(pool []Stage1Candidate, drawn []string) []Stage1Candidate {
	gone := make(map[string]struct{}, len(drawn))
	for _, id := range drawn {
		gone[id] = struct{}{}
	}
	out := make([]Stage1Candidate, 0, len(pool))
	for _, c := range pool {
		if _, done := gone[c.AwardID]; done {
			continue
		}
		out = append(out, c)
	}
	return out
}
