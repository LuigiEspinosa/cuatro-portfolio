package awards

import (
	"errors"
	"math/big"
	"os"
	"reflect"
	"regexp"
	"sort"
	"strings"
	"testing"
)

// ceremony_test.go — Story 6.8a, the orchestrator's own suite.
//
// ⭐ WHAT THIS FILE CAN AND CANNOT PROVE, STATED UP FRONT. Every other module in this package is
// pinned by a golden vector that `lib/roulette` and `generate_vectors.py` conform to independently.
// This one is not — 6.8a ships Go only (the flagged departure; see `ceremony.go`'s package note), so
// gate 5's end-to-end vector at 6.11 is the first cross-language proof the orchestrator will ever
// get. Everything here is therefore a SINGLE-RUNTIME property test, and it is written to be
// falsifiable by a mutation of `ceremony.go` rather than to restate its signature.
//
// ⛔⛔ GUARD THE GUARDS. The project's recurring defect — now at its SIXTH occurrence, and the last
// one was inside the file whose own header mandated the fix (`6-7-pity-roulette.md:1455`: a
// `pins_inputs` of `lambda e, c: 256 % 3 != 0`, a constant ignoring both arguments) — is a coverage
// flag that cannot fail. Every assertion below either re-derives its expectation from the run's own
// emitted data or compares against an INDEPENDENTLY computed value, and the fixture is asserted
// NON-DEGENERATE before any property is read off it.

// ── the fixture ───────────────────────────────────────────────────────────────
//
// ⭐ DESIGNED SO THE SHELF ACTUALLY MOVES, which the real corpus cannot do. At the shipped FR-21
// floors 0 of 28 players clear `24`/`20`, so every main spin resolves `no_eligible_players` and every
// shelf stays 0 — a corpus on which a NON-THREADED shelf and a threaded one are byte-identical, and
// therefore a corpus on which the luck meter's whole point is untestable. `ceremonyFixture` uses
// floor-0 awards and a dominant player so the shelf climbs 0 -> 1 -> 2 -> 3 and each step is visible
// in the next spin's weights.

const (
	// A dominates every deciding stat, so A is the provisional winner of EVERY award and — at
	// live_count 1, where anti-sweep has nothing to sweep — wins every spin. That makes the shelf's
	// effect on the weights exactly derivable by hand from the published table.
	fixtureA = "76561198000000001"
	fixtureB = "76561198000000002"
	fixtureC = "76561198000000003"
)

// fixtureTable is `0025`'s shipped `ceremony.luck_weight_table` default, verbatim.
func fixtureTable() []int { return []int{100, 40, 16, 6, 2, 1} }

// fixtureCatalog is four floor-0 volume/max awards at priorities 1..4.
//
// ⚠ SUPPLIED OUT OF PRIORITY ORDER ON PURPOSE. `RunCeremony` must publish every pool in ascending
// priority regardless of the order it was handed, and a fixture already in order would let a mutant
// that dropped the sort pass every ordering assertion below.
func fixtureCatalog() []Stage1Candidate {
	return []Stage1Candidate{
		{AwardID: "mvps-award", Priority: 3, Award: s1Award("mvps")},
		{AwardID: "kills-award", Priority: 1, Award: s1Award("kills")},
		{AwardID: "flash-award", Priority: 4, Award: s1Award("flash_assists")},
		{AwardID: "assists-award", Priority: 2, Award: s1Award("assists")},
	}
}

func fixturePlayers() []SnapshotPlayer {
	return []SnapshotPlayer{
		s1PlayerAt(fixtureA, 30, 50, map[string]int64{"assists": 40, "mvps": 30, "flash_assists": 20}),
		s1PlayerAt(fixtureB, 30, 10, map[string]int64{"assists": 9, "mvps": 8, "flash_assists": 7}),
		s1PlayerAt(fixtureC, 30, 5, map[string]int64{"assists": 4, "mvps": 3, "flash_assists": 2}),
	}
}

func fixtureInput() CeremonyInput {
	return CeremonyInput{
		SeedHex:   realSeedHex,
		Catalog:   fixtureCatalog(),
		Players:   fixturePlayers(),
		Table:     fixtureTable(),
		LiveCount: 1,
	}
}

func mustRun(t *testing.T, in CeremonyInput) CeremonyRun {
	t.Helper()
	run, err := RunCeremony(in)
	if err != nil {
		t.Fatalf("RunCeremony: %v", err)
	}
	return run
}

// ⭐⭐ THE NON-DEGENERACY GATE, RUN BEFORE ANY OTHER PROPERTY IS READ OFF THE FIXTURE. A fixture on
// which nobody ever wins makes the shelf test, the pity test and the anti-sweep interaction all pass
// for the wrong reason — which is exactly the shape of the six coverage-guard defects this epic has
// now shipped. If this fails, every other test in the file is suspect.
func TestCeremonyFixtureIsNotDegenerate(t *testing.T) {
	run := mustRun(t, fixtureInput())

	if len(run.Spins) < 3 {
		t.Fatalf("fixture produced %d spins — too few for a shelf to climb across spins", len(run.Spins))
	}
	// ⭐ THE SEED IS ECHOED BACK. Added after THE BAR found the run document dropping it: the writer's
	// `seed_mismatch` guard compares the payload's seed against `ceremony.seed_demo_sha256`, and an
	// empty string there refuses every well-formed run. Nothing in this suite could see it, because
	// nothing in this suite persists.
	if run.SeedHex != realSeedHex {
		t.Errorf("run.SeedHex = %q, want the input seed %q", run.SeedHex, realSeedHex)
	}
	if len(run.Shelf) == 0 {
		t.Fatal("nobody won anything: the shelf is empty, so every shelf-dependent property below " +
			"would pass against a implementation that never threaded it")
	}
	// The shelf must genuinely CLIMB past 1, or `table[min(shelf, max)]` never leaves index 1 and the
	// difference between a threaded shelf and a per-spin reset is one weight step rather than three.
	top := 0
	for _, n := range run.Shelf {
		if n > top {
			top = n
		}
	}
	if top < 3 {
		t.Fatalf("the deepest shelf reached %d — the fixture must drive it past 2 for the weight "+
			"table's tail to be exercised at all", top)
	}
	// …and somebody must be left WINLESS, or the pity draw resolves an empty set and its tests are
	// vacuous.
	winless := 0
	for _, p := range fixturePlayers() {
		if run.Shelf[p.SteamID64] == 0 {
			winless++
		}
	}
	if winless == 0 {
		t.Fatal("every player won something: the pity draw has an empty input and its assertions " +
			"below cannot fail")
	}
	if len(run.Pity.Winless) != winless {
		t.Errorf("pity resolved %d winless, the shelf says %d", len(run.Pity.Winless), winless)
	}
}

// AC2 — one FRESH stream per spin, keyed by Stage1Label(S), 1-based.
//
// ⭐ THE LABELS ARE RE-DERIVED FROM `Stage1Label`, NOT HARD-CODED, and the byte cost is re-measured
// by REPLAYING each spin's draw on an independently opened stream. A test that only checked
// `strings.HasSuffix(label, "/7")` would pass for an implementation that opened ONE stream and
// relabelled it — the replay is what makes "fresh, and it consumed exactly this much" falsifiable.
func TestRunCeremonyOpensAFreshLabelledStreamPerSpin(t *testing.T) {
	in := fixtureInput()
	run := mustRun(t, in)

	seed, err := DecodeSeed(in.SeedHex)
	if err != nil {
		t.Fatalf("DecodeSeed: %v", err)
	}

	for i, spin := range run.Spins {
		wantLabel, err := Stage1Label(i + 1)
		if err != nil {
			t.Fatalf("Stage1Label(%d): %v", i+1, err)
		}
		if spin.Spin != i+1 {
			t.Errorf("spin at index %d reports Spin=%d — the counter is 1-based and dense", i, spin.Spin)
		}
		if spin.Label != wantLabel {
			t.Errorf("spin %d label = %q, want %q", spin.Spin, spin.Label, wantLabel)
		}

		// REPLAY: a brand-new stream on the same label, driven through the same Stage-1 call with the
		// shelf the run says that spin started from. If the orchestrator had carried one stream
		// across spins, spin 2 onward would start mid-stream and this would diverge on both the
		// drawn set and the byte count.
		replayStream, err := NewStream(seed, wantLabel)
		if err != nil {
			t.Fatalf("NewStream(%q): %v", wantLabel, err)
		}
		replay, err := Stage1Pick(replayStream, Stage1Input{
			Candidates: candidatesForPool(t, in.Catalog, spin.Plan.Pool),
			Players:    in.Players,
			Shelf:      spin.ShelfAtStart,
			Table:      in.Table,
			LiveCount:  spin.Plan.LiveCount,
			Ladder:     FR29Ladder{},
		})
		if err != nil {
			t.Fatalf("replay of spin %d: %v", spin.Spin, err)
		}
		if !reflect.DeepEqual(replay.Live, spin.Stage1.Live) {
			t.Errorf("spin %d drew %v, a fresh stream on the same label draws %v — the spin did not "+
				"start at counter 0", spin.Spin, spin.Stage1.Live, replay.Live)
		}
		if replayStream.Consumed() != spin.Consumed {
			t.Errorf("spin %d reports %d bytes, the replay consumed %d",
				spin.Spin, spin.Consumed, replayStream.Consumed())
		}
		if spin.Consumed == 0 {
			t.Errorf("spin %d consumed 0 bytes — a weighted draw over a %d-award pool must read the "+
				"stream", spin.Spin, len(spin.Plan.Pool))
		}
		if len(spin.Stage1.Draws) != spin.Plan.LiveCount {
			t.Errorf("spin %d published %d draws for live_count %d",
				spin.Spin, len(spin.Stage1.Draws), spin.Plan.LiveCount)
		}
	}
}

// AC2 — the pity stream is FRESH and keyed by PityLabel, opened once, after the last main spin.
//
// ⭐ RE-DERIVED BY A STANDALONE `ResolvePity` OVER THE RUN'S OWN FINAL SHELF. `pity.go:419-434`
// refuses a Stage-1 label or an already-drawn stream, so a mutant that reused spin N's stream would
// be REFUSED rather than wrong — but a mutant that opened the pity stream BEFORE the last spin, or
// fed it a stale shelf, would not be, and only this comparison catches those.
func TestRunCeremonyRunsPityOnceOnItsOwnFreshStream(t *testing.T) {
	in := fixtureInput()
	run := mustRun(t, in)

	if run.PityLabel != PityLabel {
		t.Errorf("pity label = %q, want the frozen %q", run.PityLabel, PityLabel)
	}

	seed, err := DecodeSeed(in.SeedHex)
	if err != nil {
		t.Fatalf("DecodeSeed: %v", err)
	}
	stream, err := NewStream(seed, PityLabel)
	if err != nil {
		t.Fatalf("NewStream(PityLabel): %v", err)
	}
	want, err := ResolvePity(PityInput{Players: in.Players, Shelf: run.Shelf, Stream: stream})
	if err != nil {
		t.Fatalf("standalone ResolvePity: %v", err)
	}
	if !reflect.DeepEqual(want, run.Pity) {
		t.Errorf("pity result\n got %+v\nwant %+v", run.Pity, want)
	}
	if run.Pity.BytesConsumed != stream.Consumed() {
		t.Errorf("pity reports %d bytes, the standalone stream consumed %d",
			run.Pity.BytesConsumed, stream.Consumed())
	}

	// The winless set must be exactly "shelf 0 and not fully DQ'd", re-derived from the run's own
	// shelf rather than from a hard-coded list.
	var wantWinless []string
	for _, p := range in.Players {
		if run.Shelf[p.SteamID64] == 0 && !p.IdleDQ {
			wantWinless = append(wantWinless, p.SteamID64)
		}
	}
	sort.Strings(wantWinless)
	if !reflect.DeepEqual(wantWinless, run.Pity.Winless) {
		t.Errorf("winless = %v, re-derived from the shelf = %v", run.Pity.Winless, wantWinless)
	}
}

// AC1 — the published plan: one entry per main spin, ascending priority, minus already-drawn.
func TestRunCeremonyPublishesThePlanMinusAlreadyDrawn(t *testing.T) {
	in := fixtureInput()
	run := mustRun(t, in)

	if len(run.Plan) != len(run.Spins) {
		t.Fatalf("plan has %d entries for %d spins", len(run.Plan), len(run.Spins))
	}

	priorityOf := map[string]int{}
	for _, c := range in.Catalog {
		priorityOf[c.AwardID] = c.Priority
	}

	drawn := map[string]struct{}{}
	for i, entry := range run.Plan {
		if entry.Spin != i+1 {
			t.Errorf("plan entry %d reports Spin=%d", i, entry.Spin)
		}

		// pool[S] = catalog MINUS everything drawn in spins < S, re-derived here from the run's own
		// earlier `Stage1.Live` lists rather than restated.
		var wantPool []string
		for _, c := range in.Catalog {
			if _, gone := drawn[c.AwardID]; !gone {
				wantPool = append(wantPool, c.AwardID)
			}
		}
		sort.Slice(wantPool, func(a, b int) bool { return priorityOf[wantPool[a]] < priorityOf[wantPool[b]] })
		if !reflect.DeepEqual(wantPool, entry.Pool) {
			t.Errorf("spin %d pool = %v, want %v (catalog minus already-drawn, ascending priority)",
				entry.Spin, entry.Pool, wantPool)
		}

		// ⚠ ASCENDING PRIORITY, ASSERTED DIRECTLY AS WELL. The re-derivation above sorts the same
		// way, so a mutant that dropped BOTH sorts would agree with it; this reads the order off the
		// published pool itself.
		for k := 1; k < len(entry.Pool); k++ {
			if priorityOf[entry.Pool[k-1]] >= priorityOf[entry.Pool[k]] {
				t.Errorf("spin %d pool is not in ascending priority: %v", entry.Spin, entry.Pool)
				break
			}
		}

		if entry.LiveCount != len(run.Spins[i].Stage1.Live) {
			t.Errorf("spin %d planned live_count %d but drew %d awards",
				entry.Spin, entry.LiveCount, len(run.Spins[i].Stage1.Live))
		}
		for _, id := range run.Spins[i].Stage1.Live {
			drawn[id] = struct{}{}
		}
	}

	// Every catalog award is drawn EXACTLY ONCE across the whole ceremony — the invariant the
	// "minus already-drawn" rule exists to produce.
	if len(drawn) != len(in.Catalog) {
		t.Errorf("the ceremony drew %d distinct awards from a %d-award catalog",
			len(drawn), len(in.Catalog))
	}
}

// AC2 — the shelf is CARRIED, and carrying it changes a later spin's WEIGHTS.
//
// ⭐⭐ THE WEIGHTS ARE ASSERTED, NOT JUST "IT RAN" (T6's words). Two independent expectations are
// checked against each other:
//
//	(1) the weight the run published for each candidate equals `table[min(shelf, table_max)]`,
//	    recomputed here from the run's OWN ShelfAtStart and the shipped table; and
//	(2) that value DIFFERS from what a NON-threaded (always-empty) shelf would have produced.
//
// (2) is what makes this falsifiable: without it, an implementation that reset the shelf every spin
// satisfies (1) trivially, because its published weights and its published shelf would agree with
// each other while both being wrong.
func TestRunCeremonyThreadsTheShelfAndItMovesTheWeights(t *testing.T) {
	in := fixtureInput()
	run := mustRun(t, in)
	table := fixtureTable()

	movedAtLeastOnce := false
	for _, spin := range run.Spins {
		// Recompute this spin's weights from ITS OWN recorded shelf, via the package's own pure
		// weighting entry point — `Stage1Weights` draws nothing (`stage1.go:287-295`).
		got, err := Stage1Weights(Stage1Input{
			Candidates: candidatesForPool(t, in.Catalog, spin.Plan.Pool),
			Players:    in.Players,
			Shelf:      spin.ShelfAtStart,
			Table:      table,
			Ladder:     FR29Ladder{},
		})
		if err != nil {
			t.Fatalf("spin %d Stage1Weights: %v", spin.Spin, err)
		}
		if !equalInts(got, spin.Stage1.Weights) {
			t.Errorf("spin %d published weights %v; recomputed from its own recorded shelf %v -> %v",
				spin.Spin, spin.Stage1.Weights, spin.ShelfAtStart, got)
		}

		// …and what an UNTHREADED shelf would have produced.
		flat, err := Stage1Weights(Stage1Input{
			Candidates: candidatesForPool(t, in.Catalog, spin.Plan.Pool),
			Players:    in.Players,
			Shelf:      map[string]int{},
			Table:      table,
			Ladder:     FR29Ladder{},
		})
		if err != nil {
			t.Fatalf("spin %d flat Stage1Weights: %v", spin.Spin, err)
		}
		if !equalInts(flat, spin.Stage1.Weights) {
			movedAtLeastOnce = true
		}

		// The first spin starts from the EMPTY shelf by definition, so it must agree with the flat
		// weighting — a run whose spin 1 differed would be carrying state in from somewhere.
		if spin.Spin == 1 {
			if len(spin.ShelfAtStart) != 0 {
				t.Errorf("spin 1 started from a non-empty shelf %v", spin.ShelfAtStart)
			}
			if !equalInts(flat, spin.Stage1.Weights) {
				t.Errorf("spin 1 weights %v differ from the empty-shelf weighting %v",
					spin.Stage1.Weights, flat)
			}
		}
	}

	if !movedAtLeastOnce {
		t.Error("no spin's weights ever differed from the empty-shelf weighting — the shelf was not " +
			"threaded, or the fixture cannot show it")
	}

	// The shelf itself must grow monotonically across spins, by exactly the winners of each spin.
	running := map[string]int{}
	for _, spin := range run.Spins {
		if !reflect.DeepEqual(running, spin.ShelfAtStart) {
			t.Errorf("spin %d started from shelf %v, the accumulated winners say %v",
				spin.Spin, spin.ShelfAtStart, running)
		}
		for _, sid := range spin.Result.Assigned {
			running[sid]++
		}
	}
	if !reflect.DeepEqual(running, run.Shelf) {
		t.Errorf("final shelf %v, accumulated from every spin's Assigned %v", run.Shelf, running)
	}
}

// ShelfAtStart must be a SNAPSHOT, not a window onto the live map.
func TestRunCeremonyShelfSnapshotsDoNotAliasTheLiveMap(t *testing.T) {
	run := mustRun(t, fixtureInput())
	if len(run.Spins) < 2 {
		t.Fatal("need at least two spins")
	}
	first := run.Spins[0].ShelfAtStart
	if first == nil {
		t.Fatal("spin 1's ShelfAtStart is nil — an absent container must be the EMPTY container")
	}
	if len(first) != 0 {
		t.Fatalf("spin 1's ShelfAtStart is %v; if it aliased the live map it would hold every "+
			"later spin's winners", first)
	}
	// Mutating a returned snapshot must not disturb the final shelf.
	before := len(run.Shelf)
	first["76561198999999999"] = 99
	if len(run.Shelf) != before {
		t.Error("mutating a spin's ShelfAtStart changed the run's final shelf — they share a map")
	}
}

// AC10 — determinism, PROVEN by two runs from the same seed rather than asserted.
func TestRunCeremonyIsDeterministicAcrossTwoRuns(t *testing.T) {
	a := mustRun(t, fixtureInput())
	b := mustRun(t, fixtureInput())
	if !reflect.DeepEqual(a, b) {
		t.Error("two runs from the same seed produced different ceremonies")
	}

	// …and a DIFFERENT seed must produce a different ceremony, or the equality above is satisfied by
	// an implementation that ignores the seed entirely.
	other := fixtureInput()
	other.SeedHex = strings.Repeat("0", 64)
	c := mustRun(t, other)
	if reflect.DeepEqual(a, c) {
		t.Error("a different seed produced a byte-identical ceremony — the seed is not reaching the " +
			"streams")
	}
}

// The last spin draws the REMAINDER when the catalog does not divide evenly by live_count.
func TestRunCeremonyLastSpinDrawsTheRemainder(t *testing.T) {
	in := fixtureInput()
	in.LiveCount = 3 // 4 awards / 3 -> spins of 3 and 1
	run := mustRun(t, in)

	if len(run.Spins) != 2 {
		t.Fatalf("4 awards at live_count 3 produced %d spins, want 2", len(run.Spins))
	}
	if got := run.Plan[0].LiveCount; got != 3 {
		t.Errorf("spin 1 live_count = %d, want the organizer's 3", got)
	}
	if got := run.Plan[1].LiveCount; got != 1 {
		t.Errorf("spin 2 live_count = %d, want the 1-award remainder", got)
	}
	for i, spin := range run.Spins {
		if len(spin.Stage1.Live) != run.Plan[i].LiveCount {
			t.Errorf("spin %d drew %d awards, planned %d",
				spin.Spin, len(spin.Stage1.Live), run.Plan[i].LiveCount)
		}
	}
}

// RunCeremony must not reorder or otherwise disturb the caller's slices — the rule
// `stage1Weighted`, `ResolveSpin` and `eligiblePlayers` all keep.
//
// ⛔⛔ THE BASELINE IS RE-DERIVED FROM `fixtureInput()`, NOT COPIED WITH `append(nil, …)`, AND THAT
// IS THE WHOLE POINT OF THIS TEST (Story 6.8a code review). `append([]SnapshotPlayer(nil), s...)` is
// a SHALLOW copy: `SnapshotPlayer` carries `map[string]*big.Int`, `map[string]RatePair`,
// `map[string]map[string]StatValue` and a `*big.Int`, and the copy shares every one of those objects
// with the original. If any callee mutated a player's `Volume` map, or called `.Add`/`.Set` on a
// shared `big.Int` IN PLACE, both slices would observe the identical mutated object and
// `reflect.DeepEqual` would cheerfully report equality. The old test could see only reordering and
// element replacement — while its own doc comment claimed "or otherwise disturb" — in a package
// whose entire correctness story rests on unbounded `big.Int` values. In-place `big.Int` mutation is
// precisely the aliasing bug this test is named for, and it was the one thing it could not catch.
//
// `fixtureInput()` allocates everything fresh, so the baseline shares NO memory with `in`.
// `reflect.DeepEqual` follows pointers and compares pointed-to values, so an in-place `.Set` on any
// shared `big.Int` now shows up as a difference.
func TestRunCeremonyDoesNotMutateItsInputs(t *testing.T) {
	in := fixtureInput()
	pristine := fixtureInput() // an INDEPENDENT allocation, not a view onto `in`

	// Non-vacuity: the baseline must be equal to the input BEFORE the run, or the comparison after it
	// proves nothing. A fixture that was not deterministic would make every assertion below noise.
	if !reflect.DeepEqual(pristine, in) {
		t.Fatal("fixtureInput() is not deterministic — two calls differ, so it cannot serve as a " +
			"before-baseline and every assertion in this test would be meaningless")
	}

	mustRun(t, in)

	if !reflect.DeepEqual(pristine.Catalog, in.Catalog) {
		t.Errorf("the catalog was disturbed: %v", in.Catalog)
	}
	if !reflect.DeepEqual(pristine.Players, in.Players) {
		t.Error("the player slice was disturbed — reordered, replaced, or mutated THROUGH a shared " +
			"map or *big.Int")
	}
	if !reflect.DeepEqual(pristine.Table, in.Table) {
		t.Errorf("the weight table was mutated: %v", in.Table)
	}
}

// ⭐ A GUARD THAT PROVES THE GUARD ABOVE CAN FAIL. The re-derived baseline is only worth having if it
// actually observes mutation reached through a shared pointer — so this drives that mutation by hand
// and asserts the comparison reddens. Without it, `TestRunCeremonyDoesNotMutateItsInputs` would be
// one refactor away from silently returning to a shallow copy with nothing to say so.
func TestInputMutationBaselineActuallyObservesInPlaceMutation(t *testing.T) {
	in := fixtureInput()
	pristine := fixtureInput()

	// Reach through the map to the *big.Int and mutate it IN PLACE — the exact operation a shallow
	// `append(nil, …)` baseline is blind to.
	var touched bool
	for _, p := range in.Players {
		for _, v := range p.Volume {
			if v != nil {
				v.Add(v, big.NewInt(1))
				touched = true
				break
			}
		}
		if touched {
			break
		}
	}
	if !touched {
		t.Fatal("the fixture carries no *big.Int volume to mutate, so this guard proves nothing — " +
			"fix the fixture rather than deleting the guard")
	}

	if reflect.DeepEqual(pristine.Players, in.Players) {
		t.Error("an in-place big.Int mutation was NOT observed — the baseline is aliasing the input " +
			"again, and TestRunCeremonyDoesNotMutateItsInputs cannot see what it claims to")
	}
}

// ⛔ VALIDATION ORDER IS CONTRACT, and it is pinned with inputs malformed in TWO WAYS AT ONCE — one
// on each ADJACENT boundary. This is the shape `pity.go:265-270` and `sweep.go:224-229` both use, and
// it exists because 6-4b's headline defect was implementations disagreeing about validation order
// with NO case able to see it.
//
// ⚠ ON "A REFUSAL COSTS ZERO STREAM BYTES": it is carried by the SIGNATURE here, not asserted.
// `RunCeremony` opens its own streams and returns none, so a caller has no stream to measure — and an
// assertion that cannot fail for any implementation is one this project deletes rather than ships
// (`6-7-pity-roulette.md:745-746`). What IS observable and IS asserted is that all three ceremony-level
// refusals are reached in a fixed order, which is what puts them before the first `NewStream`.
func TestRunCeremonyRefusalsAreTypedAndOrdered(t *testing.T) {
	badSeed := "not-a-seed"

	cases := []struct {
		name       string
		mutate     func(*CeremonyInput)
		wantDetail string
	}{
		{
			name:       "a malformed seed refuses as seed",
			mutate:     func(in *CeremonyInput) { in.SeedHex = badSeed },
			wantDetail: CeremonyDetailSeed,
		},
		{
			name:       "an uppercase seed is not a lowercase hex digest",
			mutate:     func(in *CeremonyInput) { in.SeedHex = strings.ToUpper(realSeedHex) },
			wantDetail: CeremonyDetailSeed,
		},
		{
			name:       "an empty catalog refuses as catalog",
			mutate:     func(in *CeremonyInput) { in.Catalog = nil },
			wantDetail: CeremonyDetailCatalog,
		},
		{
			name: "a duplicate priority refuses as catalog",
			mutate: func(in *CeremonyInput) {
				in.Catalog = append([]Stage1Candidate(nil), in.Catalog...)
				in.Catalog[1].Priority = in.Catalog[0].Priority
			},
			wantDetail: CeremonyDetailCatalog,
		},
		{
			name: "a duplicate award id refuses as catalog",
			mutate: func(in *CeremonyInput) {
				in.Catalog = append([]Stage1Candidate(nil), in.Catalog...)
				in.Catalog[1].AwardID = in.Catalog[0].AwardID
			},
			wantDetail: CeremonyDetailCatalog,
		},
		{
			name: "an empty award id refuses as catalog",
			mutate: func(in *CeremonyInput) {
				in.Catalog = append([]Stage1Candidate(nil), in.Catalog...)
				in.Catalog[2].AwardID = ""
			},
			wantDetail: CeremonyDetailCatalog,
		},
		{
			name:       "live_count 0 refuses as live_count",
			mutate:     func(in *CeremonyInput) { in.LiveCount = 0 },
			wantDetail: CeremonyDetailLiveCount,
		},
		{
			name:       "live_count past the catalog refuses as live_count",
			mutate:     func(in *CeremonyInput) { in.LiveCount = len(in.Catalog) + 1 },
			wantDetail: CeremonyDetailLiveCount,
		},
		// ── the two ADJACENT-BOUNDARY rows: malformed in TWO ways at once ──────────────────────
		{
			name: "seed BEFORE catalog: both malformed, the seed is what refuses",
			mutate: func(in *CeremonyInput) {
				in.SeedHex = badSeed
				in.Catalog = nil
			},
			wantDetail: CeremonyDetailSeed,
		},
		{
			name: "catalog BEFORE live_count: both malformed, the catalog is what refuses",
			mutate: func(in *CeremonyInput) {
				in.Catalog = nil
				in.LiveCount = 0
			},
			wantDetail: CeremonyDetailCatalog,
		},
		// A malformed weight table is NOT a ceremony-level refusal — it propagates from Stage 1
		// under its own label, because "the organizer's table is malformed" is Stage 1's rule to
		// state and this file is forbidden from restating it (`0025:365-371`).
		{
			name:       "a malformed table propagates as stage1, not as a ceremony detail",
			mutate:     func(in *CeremonyInput) { in.Table = []int{1, 2, 3} },
			wantDetail: CeremonyDetailStage1,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			in := fixtureInput()
			tc.mutate(&in)

			run, err := RunCeremony(in)
			if err == nil {
				t.Fatalf("expected a refusal, got a %d-spin run", len(run.Spins))
			}
			if !errors.Is(err, ErrCeremony) {
				t.Errorf("refusal does not wrap ErrCeremony: %v", err)
			}
			var invalid *CeremonyInvalidError
			if !errors.As(err, &invalid) {
				t.Fatalf("refusal is not a *CeremonyInvalidError: %v", err)
			}
			if invalid.Detail != tc.wantDetail {
				t.Errorf("detail = %q, want %q (%v)", invalid.Detail, tc.wantDetail, err)
			}
			if invalid.Reason == "" {
				t.Error("a typed refusal must name what it rejected")
			}
			if len(run.Spins) != 0 || len(run.Plan) != 0 {
				t.Errorf("a refusal returned a partial run: %d spins, %d plan entries",
					len(run.Spins), len(run.Plan))
			}
		})
	}
}

// A propagated refusal must stay identifiable as the LOWER module's, not be flattened into this
// file's vocabulary — the rule `SweepInvalidError.Unwrap` (`sweep.go:103-111`) states.
func TestRunCeremonyPropagatedRefusalsKeepTheirOrigin(t *testing.T) {
	in := fixtureInput()
	in.Table = []int{1, 2, 3} // not strictly decreasing — Stage 1's validateWeightTable refuses

	_, err := RunCeremony(in)
	if err == nil {
		t.Fatal("a non-decreasing weight table must refuse")
	}
	if !errors.Is(err, ErrCeremony) {
		t.Error("the refusal does not wrap ErrCeremony")
	}
	if !errors.Is(err, ErrStage1) {
		t.Error("the refusal does not wrap ErrStage1 — the origin was flattened away")
	}
	var s1 *Stage1InvalidError
	if !errors.As(err, &s1) {
		t.Fatalf("the propagated cause is not a *Stage1InvalidError: %v", err)
	}
	if s1.Detail != DetailWeightTable {
		t.Errorf("propagated Stage-1 detail = %q, want %q", s1.Detail, DetailWeightTable)
	}
}

// ⚠ RENAMED, BECAUSE THE OLD NAME PROMISED THE OPPOSITE OF WHAT THE BODY ASSERTS (Story 6.8a code
// review). It was called `TestRunCeremonyPityRefusalPropagates` and its comment said "a pity refusal
// propagates under its own label too" — while the body asserted the pity detail is NEVER reached.
// The property is real and worth keeping; only its name was lying. The genuine pity-propagation case
// is `TestRunCeremonyPityRefusalPropagates` below, which now exists.
//
// What this pins: a duplicate roster row is refused by `validatePityPlayers` AND by `eligiblePlayers`
// one layer down, so it must surface as the FIRST module that sees it — Stage 1's propagated Stage-2
// scan on spin 1 — never as `pity`. Validation order is contract.
func TestRunCeremonyDuplicateRosterRefusesBeforePity(t *testing.T) {
	in := fixtureInput()
	in.Players = append(append([]SnapshotPlayer(nil), in.Players...), fixturePlayers()[0])

	_, err := RunCeremony(in)
	if err == nil {
		t.Fatal("a duplicate roster row must refuse somewhere")
	}
	var invalid *CeremonyInvalidError
	if !errors.As(err, &invalid) {
		t.Fatalf("not a *CeremonyInvalidError: %v", err)
	}
	if invalid.Detail == CeremonyDetailPity {
		t.Error("a duplicate roster row reached the PITY pass — Stage 2's own duplicate scan runs " +
			"on spin 1 and should have refused first")
	}
	if invalid.Detail != CeremonyDetailStage1 {
		t.Errorf("duplicate roster row refused as %q, want %q — validation ORDER is the property "+
			"here, not merely that something refused", invalid.Detail, CeremonyDetailStage1)
	}
	if !errors.Is(err, ErrCeremony) {
		t.Error("the refusal does not wrap ErrCeremony")
	}
}

// ⭐⭐ THE CLAIM THE OLD PARTITION GOT WRONG, NOW PINNED AS A PROPERTY (Story 6.8a code review).
//
// The review found `CeremonyDetailSweep` and `CeremonyDetailPity` DECLARED AS INPUT-REACHABLE with
// no test producing either — so flattening the pity error into `CeremonyDetailInternal` left the
// whole suite green. Trying to write those cases is what showed the declaration itself was false:
//
//   - `pity` cannot be reached from any `CeremonyInput`. `ResolvePity`'s three refusal surfaces are
//     the STREAM (built here, always fresh and always `PityLabel`), the PLAYERS (a duplicate or
//     empty id is caught by Stage 2's own scan on spin 1 — pinned directly above) and the SHELF
//     (accumulated HERE from `SpinResult.Assigned`, so every key is a roster member and every count
//     is a non-negative increment). `CeremonyInput` carries no shelf for a caller to poison.
//   - `sweep` is the same shape: `ResolveSpin` receives a pool this file derived and a player slice
//     Stage 1 has already validated.
//
// So both are DEFENSIVE arms, not input-representable ones, and the honest fix is to say so in the
// partition rather than to invent a degenerate input that reaches them. What remains genuinely
// testable — and is what this test asserts — is the PROPERTY that makes that classification true:
// no hostile input reaches a defensive arm. If a future change makes one reachable, this reddens and
// whoever made it must move the constant into the reachable half and write its case.
func TestDefensiveDetailsAreUnreachableFromAnyInput(t *testing.T) {
	defensive := map[string]struct{}{
		CeremonyDetailStream:   {},
		CeremonyDetailSweep:    {},
		CeremonyDetailPity:     {},
		CeremonyDetailInternal: {},
	}

	cases := []struct {
		name   string
		mutate func(*CeremonyInput)
	}{
		{"no players at all", func(in *CeremonyInput) { in.Players = nil }},
		{"one player", func(in *CeremonyInput) { in.Players = in.Players[:1] }},
		{"a duplicate roster row", func(in *CeremonyInput) {
			in.Players = append(append([]SnapshotPlayer(nil), in.Players...), fixturePlayers()[0])
		}},
		{"an empty steamid64", func(in *CeremonyInput) {
			in.Players = append([]SnapshotPlayer(nil), in.Players...)
			in.Players[0].SteamID64 = ""
		}},
		{"a single-award catalog", func(in *CeremonyInput) { in.Catalog = in.Catalog[:1] }},
		{"live_count equal to the whole catalog", func(in *CeremonyInput) {
			in.LiveCount = len(in.Catalog)
		}},
		{"live_count past the catalog", func(in *CeremonyInput) { in.LiveCount = len(in.Catalog) + 1 }},
		{"live_count zero", func(in *CeremonyInput) { in.LiveCount = 0 }},
		{"live_count negative", func(in *CeremonyInput) { in.LiveCount = -1 }},
		{"an empty weight table", func(in *CeremonyInput) { in.Table = []int{} }},
		{"a negative weight", func(in *CeremonyInput) { in.Table = []int{100, -1, 16} }},
	}

	var refused int
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			in := fixtureInput()
			tc.mutate(&in)

			_, err := RunCeremony(in)
			if err == nil {
				return // a legal input; it proves nothing here and is not an error
			}
			refused++

			var invalid *CeremonyInvalidError
			if !errors.As(err, &invalid) {
				t.Fatalf("refused with a non-typed error: %v", err)
			}
			if _, isDefensive := defensive[invalid.Detail]; isDefensive {
				t.Errorf("input %q reached the DEFENSIVE detail %q — it is declared "+
					"not-input-representable in TestCeremonyDetailsAreExactlyTheDeclaredSet, so either "+
					"that partition is wrong or this input should have been refused earlier: %v",
					tc.name, invalid.Detail, invalid.Reason)
			}
		})
	}

	// ⚠ NON-VACUITY. If every case above happened to be a LEGAL input, the loop would assert nothing
	// while looking thorough — the degenerate-coverage defect this project keeps paying for. At least
	// most of these must actually refuse for the property to have been exercised.
	if refused < len(cases)/2 {
		t.Errorf("only %d of %d hostile inputs refused at all — this test is not exercising the "+
			"refusal paths it claims to", refused, len(cases))
	}
}

// The declared detail set must be exactly what the file uses — the "closed set that was not closed"
// defect (`stage1.go:118-131`), now pinned for this module too.
//
// ⭐⭐ THIS TEST READS `ceremony.go`. THE VERSION IT REPLACES DID NOT, AND COULD NOT FAIL.
// The 6.8a code review found it asserting `if len(inputReachable) != 6` against a six-entry map
// literal written two lines above it — the size of a literal is the same for every implementation of
// `ceremony.go`, so that branch was unreachable by construction. It is the identical shape to
// `6-7-pity-roulette.md:1455`'s `lambda e, c: 256 % 3 != 0`, and it was the SEVENTH occurrence of
// that defect class in this project — sitting inside the suite for the story whose own T6 was
// written to hunt it.
//
// What it does now is what the precedent it cited always did: `pity_test.go:190-196` pins its
// constants against the VECTOR's `refusal_details` with `slices.Equal`, i.e. against data the test
// did not author. There is no vector here (6.8a ships Go only), so the source file itself is the
// external evidence. Scanning it makes three previously-invisible mutations red:
//   - a NINTH constant added to the const block and used — the hand-written partition below no
//     longer covers the scanned set;
//   - a declared constant that NOTHING uses — it appears exactly once, in its own declaration;
//   - a constant moved between the reachable and unreachable halves without the comment moving.
func TestCeremonyDetailsAreExactlyTheDeclaredSet(t *testing.T) {
	// ⚠ THE PARTITION IS THE CLAIM. Together these two must equal the set `ceremony.go` declares —
	// not a count of them, the SET. `stream` and `internal` are not input-representable (this file
	// builds both labels itself from a validated 1-based counter, and `internal` covers arms the
	// validation above has already established), stated as data so a later reader does not try to
	// write a case for them and conclude the set is wrong.
	inputReachable := map[string]string{
		"CeremonyDetailSeed":      CeremonyDetailSeed,
		"CeremonyDetailCatalog":   CeremonyDetailCatalog,
		"CeremonyDetailLiveCount": CeremonyDetailLiveCount,
		"CeremonyDetailStage1":    CeremonyDetailStage1,
	}
	// ⚠ `sweep` AND `pity` MOVED HERE IN THE 6.8a CODE REVIEW, and the move is a correction rather
	// than a concession. They were declared input-reachable with no case producing either; writing
	// those cases is what established that no `CeremonyInput` can reach them at all — every input
	// `ResolveSpin` and `ResolvePity` could object to has already been refused by Stage 1, and the
	// shelf they validate is accumulated by this file rather than supplied by a caller. The property
	// is pinned by TestDefensiveDetailsAreUnreachableFromAnyInput, which reddens if that stops being
	// true. `internal` is reachable only by calling the unexported helper directly (the
	// `sweep.go:77-86` precedent); `stream` covers a label this file builds itself.
	notInputReachable := map[string]string{
		"CeremonyDetailStream":   CeremonyDetailStream,
		"CeremonyDetailSweep":    CeremonyDetailSweep,
		"CeremonyDetailPity":     CeremonyDetailPity,
		"CeremonyDetailInternal": CeremonyDetailInternal,
	}

	declared := map[string]string{}
	for k, v := range inputReachable {
		declared[k] = v
	}
	for k, v := range notInputReachable {
		if _, dup := declared[k]; dup {
			t.Errorf("%s is in BOTH halves of the partition", k)
		}
		declared[k] = v
	}

	src, err := os.ReadFile("ceremony.go")
	if err != nil {
		t.Fatalf("reading ceremony.go, which is the evidence this test rests on: %v", err)
	}
	text := string(src)

	// ── 1. The const block's identifiers ARE the declared set. ──
	constBlock := regexp.MustCompile(`(?m)^\t(CeremonyDetail[A-Za-z0-9]+)\s*=`)
	scanned := map[string]struct{}{}
	for _, m := range constBlock.FindAllStringSubmatch(text, -1) {
		scanned[m[1]] = struct{}{}
	}
	if len(scanned) == 0 {
		t.Fatal("scanned ceremony.go and found NO CeremonyDetail constants — the regex has rotted, " +
			"and a scan that matches nothing would pass every check below vacuously")
	}
	for id := range scanned {
		if _, ok := declared[id]; !ok {
			t.Errorf("ceremony.go declares %s, which this test's partition does not name — put it in "+
				"inputReachable or notInputReachable and say which it is", id)
		}
	}
	for id := range declared {
		if _, ok := scanned[id]; !ok {
			t.Errorf("this test names %s but ceremony.go no longer declares it", id)
		}
	}

	// ── 2. Every declared detail is USED, not merely declared. ──
	// A constant that appears exactly once appears only in its own declaration.
	for id := range declared {
		n := len(regexp.MustCompile(`\b`+id+`\b`).FindAllString(text, -1))
		if n < 2 {
			t.Errorf("%s appears %d time(s) in ceremony.go — declared but never used", id, n)
		}
	}

	// ── 3. The VALUES are distinct and non-empty; two details that stringify the same are one
	//       detail wearing two names, and a caller switching on the string cannot tell them apart.
	byValue := map[string]string{}
	for id, v := range declared {
		if v == "" {
			t.Errorf("%s is the empty string", id)
		}
		if prev, dup := byValue[v]; dup {
			t.Errorf("%s and %s both stringify to %q", prev, id, v)
		}
		byValue[v] = id
	}
}

// ⚠ THE ANTI-SWEEP UNIQUE MUST NEVER BE REACHABLE FROM A RUN (`0025:224-247`: "this constraint must
// NEVER fire — if it does, the producer is broken"). Asserted over the run rather than assumed: no
// player appears in more than one award's winner set within a single spin.
func TestRunCeremonyNeverAssignsOnePlayerTwiceInOneSpin(t *testing.T) {
	in := fixtureInput()
	in.LiveCount = len(in.Catalog) // every award live in ONE spin: the shape anti-sweep exists for
	run := mustRun(t, in)

	if len(run.Spins) != 1 {
		t.Fatalf("live_count = |catalog| must produce exactly one spin, got %d", len(run.Spins))
	}
	spin := run.Spins[0]
	if len(spin.Result.Results) < 2 {
		t.Fatalf("only %d awards resolved — the anti-sweep property is vacuous below two",
			len(spin.Result.Results))
	}

	seen := map[string]string{}
	for _, res := range spin.Result.Results {
		for _, sid := range WinnersOf(res.Outcome) {
			if prev, dup := seen[sid]; dup {
				t.Errorf("player %s won both %s and %s in spin %d", sid, prev, res.AwardID, spin.Spin)
			}
			seen[sid] = res.AwardID
		}
	}
	// …and the fixture must actually have made a sweep POSSIBLE, or the loop above proves nothing:
	// the dominant player is the provisional winner of every award, so at least one award must have
	// been re-resolved over a reduced set.
	reresolved := 0
	for _, res := range spin.Result.Results {
		if res.Reresolved {
			reresolved++
		}
	}
	if reresolved == 0 {
		t.Error("no award was re-resolved over a reduced set — the fixture never put one player in " +
			"line for two awards, so the anti-sweep assertion above cannot fail")
	}
}

// ⭐⭐ THE FR-29 LADDER IS GENUINELY INJECTED INTO THE ANTI-SWEEP PASS, and this test exists because
// the mutation pass proved nothing else could tell. Swapping `FR29Ladder{}` for `RefusingLadder{}` in
// the `ResolveSpin` call left every other test in this file green — because the main fixture's
// dominant player never ties, so the ladder is never consulted and the two are indistinguishable.
//
// ⚠ THE FIXTURE IS THREE IDENTICAL PLAYERS, which is the shape that forces the ladder all the way to
// its terminal rung: every rung finds the survivors equal, so it bottoms out at rung 5 and the award
// is genuinely SHARED (`stage2.go:231-243` — a designed outcome, never an error state).
func TestRunCeremonyInjectsTheFR29LadderIntoTheAntiSweepPass(t *testing.T) {
	in := fixtureInput()
	in.Players = []SnapshotPlayer{
		tiedPlayer(fixtureA), tiedPlayer(fixtureB), tiedPlayer(fixtureC),
	}

	run, err := RunCeremony(in)
	if err != nil {
		t.Fatalf("a tied ceremony must RESOLVE through the injected ladder, not refuse: %v", err)
	}

	shared := 0
	for _, spin := range run.Spins {
		for _, res := range spin.Result.Results {
			if res.Outcome.Kind == KindTie {
				t.Errorf("spin %d award %s surfaced a raw tie — the ladder did not run",
					spin.Spin, res.AwardID)
			}
			if res.Outcome.Kind == KindShared {
				shared++
				if res.Outcome.LadderExitStep != LadderExitShared {
					t.Errorf("a shared outcome exited at rung %d, want %d (the terminal rung)",
						res.Outcome.LadderExitStep, LadderExitShared)
				}
				if len(res.Outcome.Winners) < 2 {
					t.Errorf("a shared outcome carries %d winners", len(res.Outcome.Winners))
				}
			}
		}
	}
	// NON-VACUITY: if the fixture never actually tied, the loop above proves nothing.
	if shared == 0 {
		t.Fatal("no award resolved as SHARED — the fixture did not tie, so this test cannot " +
			"distinguish an injected ladder from a refusing one")
	}
}

// ⚠ THE `internal` ARM, DRIVEN DIRECTLY — the machinery `sweep.go:77-86` established for arms no
// INPUT can reach. `candidatesByID` refuses an id that is not in the pool it was handed; no caller's
// data can produce that (Stage 1 draws only from the pool it was given), so the mutation pass found a
// `continue` here indistinguishable from the refusal. It is not equivalent: a skip would hand
// `ResolveSpin` a SHORTER live set than the plan published, and the ceremony would quietly reveal
// fewer awards than it promised.
func TestCandidatesByIDRefusesAnIDOutsideThePool(t *testing.T) {
	pool := fixtureCatalog()

	got, err := candidatesByID(pool, []string{pool[0].AwardID})
	if err != nil || len(got) != 1 {
		t.Fatalf("the positive control failed: got %d candidates, err %v", len(got), err)
	}

	_, err = candidatesByID(pool, []string{pool[0].AwardID, "an-award-that-was-never-live"})
	if err == nil {
		t.Fatal("an id outside the pool must REFUSE — a skip would silently shorten the live set")
	}
	if !errors.Is(err, ErrCeremony) {
		t.Errorf("the refusal does not wrap ErrCeremony: %v", err)
	}
	var invalid *CeremonyInvalidError
	if !errors.As(err, &invalid) {
		t.Fatalf("not a *CeremonyInvalidError: %v", err)
	}
	if invalid.Detail != CeremonyDetailInternal {
		t.Errorf("detail = %q, want %q", invalid.Detail, CeremonyDetailInternal)
	}
}

// ── helpers ───────────────────────────────────────────────────────────────────

// tiedPlayer is a snapshot row IDENTICAL to every other tiedPlayer but for its SteamID64 — the shape
// that drives the FR-29 ladder to its terminal rung.
//
// ⚠ `AchievementTS` MUST BE SET, and the ladder says so out loud: rung 4 refuses an absent value
// because `0024:703-709` makes the column NEVER NULL and publishes `-1` as the absent SENTINEL. All
// three carry the sentinel, so rung 4 separates nobody and the ladder falls through to rung 5.
// `H2H` is the empty map — "never met" (`0024:918-923`), never a zero.
func tiedPlayer(sid string) SnapshotPlayer {
	p := s1PlayerAt(sid, 30, 20, map[string]int64{"assists": 10, "mvps": 10, "flash_assists": 10})
	p.AchievementTS = big.NewInt(AbsentAchievementTS)
	p.Secondary = map[string]StatValue{}
	p.Efficiency = map[string]RatePair{}
	p.H2H = map[string]map[string]StatValue{}
	return p
}

// candidatesForPool rebuilds the Stage1Candidate slice for a published pool, from the catalog.
func candidatesForPool(t *testing.T, catalog []Stage1Candidate, pool []string) []Stage1Candidate {
	t.Helper()
	byID := map[string]Stage1Candidate{}
	for _, c := range catalog {
		byID[c.AwardID] = c
	}
	out := make([]Stage1Candidate, 0, len(pool))
	for _, id := range pool {
		c, ok := byID[id]
		if !ok {
			t.Fatalf("published pool names %q, which is not in the catalog", id)
		}
		out = append(out, c)
	}
	return out
}
