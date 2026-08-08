package awards

import (
	"errors"
	"math/big"
	"reflect"
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
func TestRunCeremonyDoesNotMutateItsInputs(t *testing.T) {
	in := fixtureInput()
	catalogBefore := append([]Stage1Candidate(nil), in.Catalog...)
	playersBefore := append([]SnapshotPlayer(nil), in.Players...)
	tableBefore := append([]int(nil), in.Table...)

	mustRun(t, in)

	if !reflect.DeepEqual(catalogBefore, in.Catalog) {
		t.Errorf("the catalog was reordered: %v", in.Catalog)
	}
	if !reflect.DeepEqual(playersBefore, in.Players) {
		t.Errorf("the player slice was reordered")
	}
	if !reflect.DeepEqual(tableBefore, in.Table) {
		t.Errorf("the weight table was mutated: %v", in.Table)
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

// A pity refusal propagates under its own label too. Driven by a shelf key naming nobody on the
// roster, which `validatePityShelf` refuses — reached by handing the run a player set the pity pass
// cannot reconcile with the shelf the main spins built.
func TestRunCeremonyPityRefusalPropagates(t *testing.T) {
	in := fixtureInput()
	// A duplicate roster row: `validatePityPlayers` refuses it, and so does `eligiblePlayers` one
	// layer down — so this must surface as the FIRST module that sees it, which is Stage 1's
	// propagated Stage-2 scan on spin 1, never as `pity`.
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
	if !errors.Is(err, ErrCeremony) {
		t.Error("the refusal does not wrap ErrCeremony")
	}
}

// The declared detail set must be exactly what the file uses — the "closed set that was not closed"
// defect (`stage1.go:118-131`), now pinned for this module too.
func TestCeremonyDetailsAreExactlyTheDeclaredSet(t *testing.T) {
	declared := []string{
		CeremonyDetailSeed,
		CeremonyDetailCatalog,
		CeremonyDetailLiveCount,
		CeremonyDetailStream,
		CeremonyDetailStage1,
		CeremonyDetailSweep,
		CeremonyDetailPity,
		CeremonyDetailInternal,
	}
	seen := map[string]struct{}{}
	for _, d := range declared {
		if d == "" {
			t.Error("a declared detail is the empty string")
		}
		if _, dup := seen[d]; dup {
			t.Errorf("duplicate declared detail %q", d)
		}
		seen[d] = struct{}{}
	}
	if len(seen) != 8 {
		t.Errorf("declared %d distinct details, want 8", len(seen))
	}
	// ⚠ THE ONES A CALLER'S DATA CAN REACH, named explicitly. `stream` and `internal` are not
	// input-representable (this file builds both labels itself from a validated 1-based counter, and
	// `internal` covers arms the validation above has already established) — stated as data so a
	// later reader does not try to write a case for them and conclude the set is wrong.
	inputReachable := map[string]bool{
		CeremonyDetailSeed:      true,
		CeremonyDetailCatalog:   true,
		CeremonyDetailLiveCount: true,
		CeremonyDetailStage1:    true,
		CeremonyDetailSweep:     true,
		CeremonyDetailPity:      true,
	}
	if len(inputReachable) != 6 {
		t.Errorf("declared %d input-reachable details, want 6", len(inputReachable))
	}
	for d := range inputReachable {
		if _, ok := seen[d]; !ok {
			t.Errorf("input-reachable detail %q is not in the declared set", d)
		}
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
		for _, sid := range winnersOf(res.Outcome) {
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
