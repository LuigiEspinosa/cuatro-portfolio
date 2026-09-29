package awards

import (
	"encoding/json"
	"math/big"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"testing"
)

// ══════════════════════════════════════════════════════════════════════════════════════════════
// STORY 6.11 — GATE 5, THE END-TO-END CEREMONY VECTOR (FR-25 / AD-14 / AD-19)
// ══════════════════════════════════════════════════════════════════════════════════════════════
//
// ⭐⭐ THIS IS THE FILE `ceremony.go:19-26` NAMES. Its header says, in as many words: "THE COST,
// STATED PLAINLY: this file carries no cross-language proof until 6.11's gate 5", and
// `ceremony_test.go:16-21` adds "Everything here is therefore a SINGLE-RUNTIME property test."
// Every other resolver in this package is pinned to a language-neutral vector; the ORCHESTRATOR —
// the thing that decides which stage runs when, what the shelf carries between spins and when pity
// fires — was pinned to nothing but its own behaviour. This closes that.
//
// ⛔ THE SNAPSHOT IS NOT IN THE VECTOR, AND THAT IS THE CONTRACT (DECISION AE). `end-to-end.json`
// names `canonical-bundle-input.json` as its projection source and carries no player data. So this
// file must PROJECT the published AD-19 integer form — decimal-STRING magnitudes, {num,den} rate
// pairs, the class-shaped secondary/h2h union, the uniform efficiency form, the integer
// achievement_ts — back into `SnapshotPlayer`. That projection IS the capture shape AD-19 requires
// the end-to-end vector to test, and a vector carrying pre-projected players would not test it.
//
// ⛔ NOTHING BELOW TRANSCRIBES A VECTOR VALUE INTO SOURCE. Every expected number is read from the
// JSON at runtime; the only literals here are the names of files and the shape of the contract.

const e2eSourceFile = "canonical-bundle-input.json"

// ── the projection source, as PUBLISHED ───────────────────────────────────────

type bundlePair struct {
	Num string `json:"num"`
	Den string `json:"den"`
}

type bundlePlayer struct {
	SteamID64     string                                `json:"steamid64"`
	RoundsPlayed  string                                `json:"rounds_played"`
	Kills         string                                `json:"kills"`
	IdleDQ        bool                                  `json:"idle_dq"`
	Volume        map[string]string                     `json:"volume"`
	Rate          map[string]bundlePair                 `json:"rate"`
	Secondary     map[string]json.RawMessage            `json:"secondary"`
	Efficiency    map[string]bundlePair                 `json:"efficiency"`
	H2H           map[string]map[string]json.RawMessage `json:"h2h"`
	AchievementTS string                                `json:"achievement_ts"`
}

type bundleDoc struct {
	AlgoVersion string         `json:"algo_version"`
	SeedHex     string         `json:"seed_hex"`
	Players     []bundlePlayer `json:"players"`
	Luck        struct {
		WeightTable []int `json:"weight_table"`
	} `json:"luck"`
}

// ── the vector ────────────────────────────────────────────────────────────────

type e2eCatalogRow struct {
	AwardID       string `json:"award_id"`
	Priority      int    `json:"priority"`
	DecidingStat  string `json:"deciding_stat"`
	Class         string `json:"class"`
	Direction     string `json:"direction"`
	FloorRounds   int    `json:"floor_rounds"`
	FloorKills    int    `json:"floor_kills"`
	SecondaryStat string `json:"secondary_stat"`
	EffNumKey     string `json:"eff_num_key"`
	EffDenKey     string `json:"eff_den_key"`
}

type e2eDraw struct {
	N             uint64 `json:"n"`
	R             uint64 `json:"r"`
	ConsumedAfter uint64 `json:"consumed_after"`
}

type e2eDecidingValue struct {
	Class string `json:"class"`
	Value string `json:"value"`
	Num   string `json:"num"`
	Den   string `json:"den"`
}

type e2eResult struct {
	AwardID        string            `json:"award_id"`
	Priority       int               `json:"priority"`
	Kind           string            `json:"kind"`
	SteamID64      string            `json:"steamid64"`
	DecidingValue  *e2eDecidingValue `json:"deciding_value"`
	Winners        []string          `json:"winners"`
	Tied           []string          `json:"tied"`
	LadderExitStep int               `json:"ladder_exit_step"`
	SweptOut       []string          `json:"swept_out"`
	Reresolved     bool              `json:"reresolved"`
}

type e2eSpin struct {
	Spin          int         `json:"spin"`
	Kind          string      `json:"kind"`
	Label         string      `json:"label"`
	Pool          []string    `json:"pool"`
	LiveCount     int         `json:"live_count"`
	Weights       []int       `json:"weights"`
	TotalWeight   int         `json:"total_weight"`
	Draws         []e2eDraw   `json:"draws"`
	BytesConsumed uint64      `json:"bytes_consumed"`
	Live          []string    `json:"live"`
	Results       []e2eResult `json:"results"`
	Assigned      []string    `json:"assigned"`
}

type e2ePityDraw struct {
	N          uint64 `json:"n"`
	K          int    `json:"k"`
	Rejections int    `json:"rejections"`
	Value      uint64 `json:"value"`
}

type e2ePity struct {
	Label         string        `json:"label"`
	Winless       []string      `json:"winless"`
	RevealOrder   []string      `json:"reveal_order"`
	Draws         []e2ePityDraw `json:"draws"`
	BytesConsumed uint64        `json:"bytes_consumed"`
}

type e2eAnchors struct {
	MainSpinCount        int      `json:"main_spin_count"`
	MainSpinBytes        uint64   `json:"main_spin_bytes"`
	PityBytes            uint64   `json:"pity_bytes"`
	TotalBytes           uint64   `json:"total_bytes"`
	DrawnOrder           []string `json:"drawn_order"`
	WinlessCount         int      `json:"winless_count"`
	ShelfHolders         int      `json:"shelf_holders"`
	MaxTrophiesPerPlayer int      `json:"max_trophies_per_player"`
	LadderExitSteps      []int    `json:"ladder_exit_steps"`
	OutcomeKinds         []string `json:"outcome_kinds"`
}

// e2eWinlessWidth — `deferred-work.md:347`: the winless set at one Stage-1 width, over the real
// snapshot and a floors-ZERO catalog.
//
// ⭐ 6.7's AC6 asked for this set at all four widths and the entry deferred it as costing "a full
// 14-demo corpus rebuild". It does not — it is a pure function of the committed snapshot — and 6.11's
// code review made the point that if it is cheap enough to assert it is cheap enough to COMMIT.
type e2eWinlessWidth struct {
	LiveCount         int      `json:"live_count"`
	MainSpins         int      `json:"main_spins"`
	Winless           []string `json:"winless"`
	ShelfDistribution []struct {
		Trophies int `json:"trophies"`
		Players  int `json:"players"`
	} `json:"shelf_distribution"`
}

// e2eUnreachableRung — DECISION AF. A ladder rung the vector declares structurally unreachable
// END-TO-END over this corpus, with the reason and with what gates it instead.
//
// ⛔ NAMED RATHER THAN ANONYMOUS SO IT CAN BE POINTED AT. Until 6.11's code review the rung-3 check
// was a bare `range` + `continue` over this slice, which ran zero times — and therefore passed — when
// the declaration was absent.
type e2eUnreachableRung struct {
	Rung           int    `json:"rung"`
	Why            string `json:"why"`
	GatedInsteadBy string `json:"gated_instead_by"`
	Note           string `json:"note"`
}

type e2eCase struct {
	Name       string `json:"name"`
	Why        string `json:"why"`
	Projection struct {
		Snapshot             string   `json:"snapshot"`
		SnapshotSource       string   `json:"snapshot_source"`
		Seed                 string   `json:"seed"`
		WeightTable          string   `json:"weight_table"`
		Catalog              string   `json:"catalog"`
		CounterfactualFields []string `json:"counterfactual_fields"`
	} `json:"projection"`
	SeedHex     string          `json:"seed_hex"`
	LiveCount   int             `json:"live_count"`
	WeightTable []int           `json:"weight_table"`
	Catalog     []e2eCatalogRow `json:"catalog"`
	Expected    struct {
		Spins   []e2eSpin      `json:"spins"`
		Pity    e2ePity        `json:"pity"`
		Shelf   map[string]int `json:"shelf"`
		Anchors e2eAnchors     `json:"anchors"`
	} `json:"expected"`
}

type e2eVector struct {
	Vector      string `json:"vector"`
	AlgoVersion string `json:"algo_version"`
	Spec        string `json:"spec"`
	Source      struct {
		File        string `json:"file"`
		Present     bool   `json:"present"`
		UTF8Bytes   int    `json:"utf8_bytes"`
		PlayerCount int    `json:"player_count"`
		AwardCount  int    `json:"award_count"`
		SeedHex     string `json:"seed_hex"`
		WeightTable []int  `json:"weight_table"`
	} `json:"source"`
	WinlessByWidth         []e2eWinlessWidth    `json:"winless_by_width"`
	UnreachableLadderRungs []e2eUnreachableRung `json:"unreachable_ladder_rungs"`
	Cases                  []e2eCase            `json:"cases"`
}

// ── the projection: PUBLISHED integer form -> SnapshotPlayer ──────────────────

// e2eStatValue reads one class-shaped entry. A volume key is published as a bare decimal STRING and
// a rate key as a {num,den} object, so the branch is on the published SHAPE — never on a vocabulary
// list this file would then have to keep in sync with 0023.
func e2eStatValue(t *testing.T, where string, raw json.RawMessage) StatValue {
	t.Helper()
	trimmed := strings.TrimSpace(string(raw))
	if strings.HasPrefix(trimmed, "{") {
		var p bundlePair
		if err := json.Unmarshal(raw, &p); err != nil {
			t.Fatalf("%s: %v", where, err)
		}
		return StatValue{
			Class: ClassRate,
			Num:   mustBig(t, where+".num", p.Num),
			Den:   mustBig(t, where+".den", p.Den),
		}
	}
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		t.Fatalf("%s: a class-shaped value that is neither an object nor a string: %v", where, err)
	}
	return StatValue{Class: ClassVolume, Value: mustBig(t, where, s)}
}

func e2eProjectPlayer(t *testing.T, p bundlePlayer) SnapshotPlayer {
	t.Helper()
	out := SnapshotPlayer{
		SteamID64:    p.SteamID64,
		RoundsPlayed: mustBig(t, p.SteamID64+".rounds_played", p.RoundsPlayed),
		Kills:        mustBig(t, p.SteamID64+".kills", p.Kills),
		IdleDQ:       p.IdleDQ,
		Volume:       map[string]*big.Int{},
		Rate:         map[string]RatePair{},
		Secondary:    map[string]StatValue{},
		Efficiency:   map[string]RatePair{},
		H2H:          map[string]map[string]StatValue{},
	}
	for k, v := range p.Volume {
		out.Volume[k] = mustBig(t, p.SteamID64+".volume."+k, v)
	}
	for k, v := range p.Rate {
		out.Rate[k] = RatePair{
			Num: mustBig(t, p.SteamID64+".rate."+k+".num", v.Num),
			Den: mustBig(t, p.SteamID64+".rate."+k+".den", v.Den),
		}
	}
	for k, v := range p.Secondary {
		out.Secondary[k] = e2eStatValue(t, p.SteamID64+".secondary."+k, v)
	}
	for k, v := range p.Efficiency {
		out.Efficiency[k] = RatePair{
			Num: mustBig(t, p.SteamID64+".efficiency."+k+".num", v.Num),
			Den: mustBig(t, p.SteamID64+".efficiency."+k+".den", v.Den),
		}
	}
	for opp, blk := range p.H2H {
		inner := map[string]StatValue{}
		for k, v := range blk {
			inner[k] = e2eStatValue(t, p.SteamID64+".h2h["+opp+"]."+k, v)
		}
		out.H2H[opp] = inner
	}
	// ⚠ `achievement_ts` travels as a decimal STRING like every other snapshot value — the split is
	// by PROVENANCE, not by magnitude (README:294-299). It is epoch-MILLISECONDS and sits well
	// inside 2^53 today, and it is still a string, and still a *big.Int here.
	out.AchievementTS = mustBig(t, p.SteamID64+".achievement_ts", p.AchievementTS)
	return out
}

func e2eLoadSource(t *testing.T) (bundleDoc, int) {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(vectorDir, e2eSourceFile))
	if err != nil {
		t.Fatalf("read the projection source %s: %v (the vectors gate the build — a missing file is a failure, not a skip)", e2eSourceFile, err)
	}
	var doc bundleDoc
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatalf("parse %s: %v", e2eSourceFile, err)
	}
	return doc, len(raw)
}

func e2eCatalog(t *testing.T, rows []e2eCatalogRow) []Stage1Candidate {
	t.Helper()
	out := make([]Stage1Candidate, 0, len(rows))
	for _, r := range rows {
		out = append(out, Stage1Candidate{
			AwardID:  r.AwardID,
			Priority: r.Priority,
			Award: Award{
				DecidingStat:  r.DecidingStat,
				Class:         AwardClass(r.Class),
				Direction:     AwardDirection(r.Direction),
				FloorRounds:   r.FloorRounds,
				FloorKills:    r.FloorKills,
				SecondaryStat: r.SecondaryStat,
				EffNumKey:     r.EffNumKey,
				EffDenKey:     r.EffDenKey,
			},
		})
	}
	return out
}

// ── the gate ──────────────────────────────────────────────────────────────────

func TestVectorEndToEndCeremony(t *testing.T) {
	v := loadVector[e2eVector](t, "end-to-end.json")
	if v.Vector != "end-to-end" {
		t.Fatalf("loaded the wrong vector file: %q", v.Vector)
	}
	// The protocol version, pinned the way `ladder_test.go:457` pins it. ⚠ This is a PROTOCOL
	// constant, not a vector-derived expected value: the ban is on transcribing a computed answer
	// into source, and `algo_version` is neither computed nor an answer.
	if v.AlgoVersion != "inclusivcup-roulette-1.0.0" {
		t.Fatalf("algo_version %q, this package speaks inclusivcup-roulette-1.0.0", v.AlgoVersion)
	}
	// ⛔ NON-VACUITY. An empty `cases` array would make every assertion below run zero times, which
	// is this project's most-recorded failure shape (five occurrences by 6.7's count).
	if len(v.Cases) < 2 {
		t.Fatalf("end-to-end.json carries %d cases; DECISION AB requires an anchor run AND a forced run", len(v.Cases))
	}
	if !v.Source.Present {
		t.Fatalf("end-to-end.json was generated with no projection source — %s was missing", v.Source.File)
	}

	doc, rawLen := e2eLoadSource(t)

	// ⭐⭐ AC4's 75,013-BYTE TRIPWIRE, ASSERTED HERE AS WELL AS IN `worker/ceremony`. The vector
	// carries the length it was generated against; this compares it to the bytes actually on disk.
	// A wholesale corpus swap produces a SELF-CONSISTENT set of vectors with a different hash and
	// `--check` reports OK on all nine — this is one of the two assertions standing in the way.
	if v.Source.File != e2eSourceFile {
		t.Fatalf("the vector projects from %q, this suite loads %q", v.Source.File, e2eSourceFile)
	}
	if rawLen != v.Source.UTF8Bytes {
		t.Errorf("projection source is %d bytes on disk, the vector was generated against %d", rawLen, v.Source.UTF8Bytes)
	}
	if len(doc.Players) != v.Source.PlayerCount {
		t.Errorf("projection source holds %d players, the vector declares %d", len(doc.Players), v.Source.PlayerCount)
	}
	if doc.SeedHex != v.Source.SeedHex {
		t.Errorf("projection source seed %q, the vector declares %q", doc.SeedHex, v.Source.SeedHex)
	}
	if !reflect.DeepEqual(doc.Luck.WeightTable, v.Source.WeightTable) {
		t.Errorf("projection source weight table %v, the vector declares %v", doc.Luck.WeightTable, v.Source.WeightTable)
	}

	players := make([]SnapshotPlayer, 0, len(doc.Players))
	for _, p := range doc.Players {
		players = append(players, e2eProjectPlayer(t, p))
	}

	// ⭐ DECISION AF — rung 3 is declared UNREACHABLE end-to-end over this corpus. The declaration is
	// only worth anything if it is CHECKED: re-derive the reason from the projected snapshot rather
	// than trusting the prose. Every player must have exactly one h2h opponent, which is what makes
	// a strict dominator over 2+ survivors impossible.
	//
	// ⛔ THE DECLARATION MUST BE PROVEN TO EXIST BEFORE ANYTHING IS CHECKED ABOUT IT. Until 6.11's
	// code review this was a bare `range` with a `continue`: an empty `unreachable_ladder_rungs`, or
	// one that stopped naming rung 3, ran the body ZERO times and passed — so the guard whose stated
	// purpose is "the declaration is CHECKED, NOT TRUSTED" was satisfied by DELETING the declaration.
	// The TypeScript twin already did this correctly (`expect(rung3).toBeDefined()`), so it was also
	// one-sided.
	var rung3 *e2eUnreachableRung
	for i := range v.UnreachableLadderRungs {
		if v.UnreachableLadderRungs[i].Rung == 3 {
			rung3 = &v.UnreachableLadderRungs[i]
			break
		}
	}
	if rung3 == nil {
		t.Fatalf("no `unreachable_ladder_rungs` entry names rung 3 — DECISION AF is what explains why "+
			"the forced run's ladder_exit_steps are %v rather than all five, and an absent declaration "+
			"must redden rather than silently skip its own proof", v.Cases[len(v.Cases)-1].Expected.Anchors.LadderExitSteps)
	}
	if rung3.GatedInsteadBy == "" {
		t.Error("rung 3 is declared unreachable end-to-end without naming what DOES gate it — " +
			"`ladder-resolve.json` gates it as a unit, and that must be stated in data, not assumed")
	}
	for _, p := range players {
		if len(p.H2H) != 1 {
			t.Errorf("rung 3 is declared unreachable because every player has exactly one h2h opponent, but %s has %d", p.SteamID64, len(p.H2H))
		}
	}

	seenCase := map[string]bool{}
	sawReal, sawCounterfactual := false, false

	for _, tc := range v.Cases {
		if seenCase[tc.Name] {
			t.Fatalf("duplicate end-to-end case name %q", tc.Name)
		}
		seenCase[tc.Name] = true

		t.Run(tc.Name, func(t *testing.T) {
			// ⭐ AC3 — the PROJECTION BLOCK is data, and it is asserted rather than read past. The
			// snapshot must be REAL on every case: that is DECISION AA's whole content, and a case
			// that quietly switched to a synthetic roster would still pass every numeric assertion
			// below while making AD-19's real-snapshot rule false.
			if tc.Projection.Snapshot != "real" {
				t.Errorf("projection.snapshot is %q — AD-19 requires a real captured snapshot on every case", tc.Projection.Snapshot)
			}
			if tc.Projection.SnapshotSource != e2eSourceFile {
				t.Errorf("projection.snapshot_source is %q, want %q", tc.Projection.SnapshotSource, e2eSourceFile)
			}
			// ⛔ `seed: "real"` IS CHECKED ON EVERY CASE, NOT ONLY THE REAL-CATALOG ONE. Until 6.11's
			// code review the `tc.SeedHex == doc.SeedHex` comparison lived inside `case "real":`, so
			// the forced run could carry an INVENTED seed while its projection block declared the
			// seed real — the one field a reader most needs to trust, unchecked on the case that
			// varies the most.
			if tc.Projection.Seed != "real" {
				t.Errorf("projection.seed is %q — the seed is the real frozen fair_seed on both cases", tc.Projection.Seed)
			} else if tc.SeedHex != doc.SeedHex {
				t.Errorf("case %q declares projection.seed=real but runs seed %q; the source's seed is %q",
					tc.Name, tc.SeedHex, doc.SeedHex)
			}

			// ⛔ `weight_table` WAS DECLARED AND NEVER READ. Both runtimes parsed
			// `projection.weight_table` and neither ever asserted it, while the surrounding comment
			// claimed the projection block "is DATA and is asserted rather than read past" — one
			// member was read past. Found at 6.11's code review.
			if tc.Projection.WeightTable != "real" {
				t.Errorf("projection.weight_table is %q — FR-26's luck meter is not a catalog field and "+
					"is real on both cases", tc.Projection.WeightTable)
			} else if !reflect.DeepEqual(tc.WeightTable, v.Source.WeightTable) {
				t.Errorf("case %q declares projection.weight_table=real but runs %v; the source's table is %v",
					tc.Name, tc.WeightTable, v.Source.WeightTable)
			}

			switch tc.Projection.Catalog {
			case "real":
				sawReal = true
				// A real-catalog case must declare NO counterfactual fields — otherwise the
				// projection block is decorative and a reader cannot trust either half.
				if len(tc.Projection.CounterfactualFields) != 0 {
					t.Errorf("catalog is declared real but %d counterfactual fields are listed", len(tc.Projection.CounterfactualFields))
				}
			case "counterfactual":
				sawCounterfactual = true
				if len(tc.Projection.CounterfactualFields) == 0 {
					t.Error("catalog is declared counterfactual but no counterfactual fields are listed")
				}
				// ⭐ EVERY NAMED FIELD MUST BE A REAL LEVER, RE-DERIVED FROM THE CATALOG STRUCT'S OWN
				// JSON TAGS RATHER THAN FROM A HAND-WRITTEN LIST — a list restated here would drift
				// from the shape it claims to describe, which is the whole failure mode this block
				// exists to prevent.
				//
				// ⚠ `live_count` IS THE ONE DELIBERATE EXCEPTION, and it is named rather than waved
				// through. DECISION AA says the catalog is the counterfactual lever and that every
				// field here is a catalog field; `live_count` is a CEREMONY parameter, not a catalog
				// row field. It is genuinely counterfactual (6 against the real ceremony's 1) and
				// DECISION AB requires it — anti-sweep overflow is unreachable at `live_count = 1` —
				// so the honest record is that DECISION AA has exactly one documented exception,
				// not that `live_count` is quietly a catalog field.
				catalogFields := map[string]bool{}
				rt := reflect.TypeOf(e2eCatalogRow{})
				for i := 0; i < rt.NumField(); i++ {
					if tag := rt.Field(i).Tag.Get("json"); tag != "" {
						catalogFields[tag] = true
					}
				}
				if len(catalogFields) == 0 {
					t.Fatal("no json tags found on e2eCatalogRow — the membership check below would be vacuous")
				}
				const ceremonyLever = "live_count"
				sawLever := false
				for _, f := range tc.Projection.CounterfactualFields {
					if f == ceremonyLever {
						sawLever = true
						continue
					}
					if !catalogFields[f] {
						t.Errorf("counterfactual field %q is neither a catalog row field nor the one "+
							"declared ceremony lever %q — DECISION AA says the catalog is the lever, so "+
							"an unexplained third kind of field means the block no longer describes "+
							"what actually varies", f, ceremonyLever)
					}
				}
				if !sawLever {
					t.Errorf("the counterfactual case does not list %q, but it runs live_count=%d "+
						"against the real ceremony's 1 — an undeclared counterfactual is exactly what "+
						"the projection block exists to prevent", ceremonyLever, tc.LiveCount)
				}
			default:
				t.Fatalf("projection.catalog is %q; the closed set is {real, counterfactual}", tc.Projection.Catalog)
			}

			run, err := RunCeremony(CeremonyInput{
				SeedHex:   tc.SeedHex,
				Catalog:   e2eCatalog(t, tc.Catalog),
				Players:   players,
				Table:     tc.WeightTable,
				LiveCount: tc.LiveCount,
			})
			if err != nil {
				t.Fatalf("RunCeremony refused a well-formed vector case: %v", err)
			}

			assertE2ESpins(t, run, tc)
			assertE2EPity(t, run, tc)
			assertE2EShelf(t, run, tc)
			assertE2EAnchors(t, run, tc)
		})
	}

	if !sawReal || !sawCounterfactual {
		t.Errorf("DECISION AB requires BOTH an anchor run (real catalog) and a forced run (counterfactual); saw real=%v counterfactual=%v", sawReal, sawCounterfactual)
	}
}

func assertE2ESpins(t *testing.T, run CeremonyRun, tc e2eCase) {
	t.Helper()
	if len(run.Spins) != len(tc.Expected.Spins) {
		t.Fatalf("ran %d main spins, the vector expects %d", len(run.Spins), len(tc.Expected.Spins))
	}
	if run.SeedHex != tc.SeedHex {
		t.Errorf("run echoes seed %q, the case declares %q", run.SeedHex, tc.SeedHex)
	}
	for i, want := range tc.Expected.Spins {
		got := run.Spins[i]
		if want.Kind != "main" {
			t.Fatalf("spin %d is kind %q; `expected.spins` holds MAIN spins only", want.Spin, want.Kind)
		}
		if got.Spin != want.Spin {
			t.Errorf("spin index %d, want %d", got.Spin, want.Spin)
		}
		if got.Label != want.Label {
			t.Errorf("spin %d label %q, want %q", want.Spin, got.Label, want.Label)
		}
		if !reflect.DeepEqual(got.Plan.Pool, want.Pool) {
			t.Errorf("spin %d pool %v, want %v", want.Spin, got.Plan.Pool, want.Pool)
		}
		if got.Plan.LiveCount != want.LiveCount {
			t.Errorf("spin %d live_count %d, want %d", want.Spin, got.Plan.LiveCount, want.LiveCount)
		}
		if !reflect.DeepEqual(got.Stage1.Weights, want.Weights) {
			t.Errorf("spin %d weights %v, want %v", want.Spin, got.Stage1.Weights, want.Weights)
		}
		if got.Stage1.TotalWeight != want.TotalWeight {
			t.Errorf("spin %d total_weight %d, want %d", want.Spin, got.Stage1.TotalWeight, want.TotalWeight)
		}
		// ⛔ THE BYTE ACCOUNTING IS THE CONTRACT. `Consumed` is measured from the stream, and each
		// draw's cumulative position is the only way a rejection inside UniformInt is observable.
		if got.Consumed != want.BytesConsumed {
			t.Errorf("spin %d consumed %d bytes, want %d", want.Spin, got.Consumed, want.BytesConsumed)
		}
		if len(got.Stage1.Draws) != len(want.Draws) {
			t.Errorf("spin %d made %d draws, want %d", want.Spin, len(got.Stage1.Draws), len(want.Draws))
		} else {
			for j, wd := range want.Draws {
				gd := got.Stage1.Draws[j]
				if gd.N != wd.N || gd.R != wd.R || gd.ConsumedAfter != wd.ConsumedAfter {
					t.Errorf("spin %d draw %d = {n:%d r:%d after:%d}, want {n:%d r:%d after:%d}",
						want.Spin, j, gd.N, gd.R, gd.ConsumedAfter, wd.N, wd.R, wd.ConsumedAfter)
				}
			}
		}
		// ⚠ `Live` is in DRAW order, which is the REVEAL order and is deliberately NOT priority
		// sorted. Comparing it to a sorted list would silently accept a runtime that reordered the
		// reveal.
		if !reflect.DeepEqual(got.Stage1.Live, want.Live) {
			t.Errorf("spin %d live %v, want %v", want.Spin, got.Stage1.Live, want.Live)
		}
		if !reflect.DeepEqual(got.Result.Assigned, want.Assigned) {
			t.Errorf("spin %d assigned %v, want %v", want.Spin, got.Result.Assigned, want.Assigned)
		}
		assertE2EResults(t, want.Spin, got.Result.Results, want.Results)
	}
}

func assertE2EResults(t *testing.T, spin int, got []AwardAssignment, want []e2eResult) {
	t.Helper()
	if len(got) != len(want) {
		t.Errorf("spin %d produced %d assignments, want %d", spin, len(got), len(want))
		return
	}
	for i, w := range want {
		g := got[i]
		if g.AwardID != w.AwardID || g.Priority != w.Priority {
			t.Errorf("spin %d row %d is %s/p%d, want %s/p%d", spin, i, g.AwardID, g.Priority, w.AwardID, w.Priority)
			continue
		}
		if string(g.Outcome.Kind) != w.Kind {
			t.Errorf("spin %d %s kind %q, want %q", spin, w.AwardID, g.Outcome.Kind, w.Kind)
		}
		// ⛔ NEVER `err != nil` AND NEVER MESSAGE PROSE — the typed kind and the declared step.
		if g.Outcome.LadderExitStep != w.LadderExitStep {
			t.Errorf("spin %d %s ladder_exit_step %d, want %d", spin, w.AwardID, g.Outcome.LadderExitStep, w.LadderExitStep)
		}
		if g.Outcome.SteamID64 != w.SteamID64 {
			t.Errorf("spin %d %s winner %q, want %q", spin, w.AwardID, g.Outcome.SteamID64, w.SteamID64)
		}
		if !equalStrings(g.Outcome.Winners, w.Winners) {
			t.Errorf("spin %d %s winners %v, want %v", spin, w.AwardID, g.Outcome.Winners, w.Winners)
		}
		if !equalStrings(g.Outcome.Tied, w.Tied) {
			t.Errorf("spin %d %s tied %v, want %v", spin, w.AwardID, g.Outcome.Tied, w.Tied)
		}
		// ⭐ `SweptOut` AND `Reresolved` ARE FACTS ABOUT THE INPUT. A vector pinning only the winner
		// would let a pass that reached the right player WITHOUT EVER REMOVING ANYONE pass every
		// row, and the removal is the whole of FR-26.
		if !equalStrings(g.SweptOut, w.SweptOut) {
			t.Errorf("spin %d %s swept_out %v, want %v", spin, w.AwardID, g.SweptOut, w.SweptOut)
		}
		if g.Reresolved != w.Reresolved {
			t.Errorf("spin %d %s reresolved %v, want %v", spin, w.AwardID, g.Reresolved, w.Reresolved)
		}
		// ⭐ The `deciding_value` XOR `ladder_exit_step` invariant, carried end-to-end: a Stage-2
		// winner has a value and no rung; a ladder-resolved winner has a rung and no value.
		if w.DecidingValue != nil {
			assertE2EDecidingValue(t, spin, w.AwardID, g.Outcome.DecidingValue, w.DecidingValue)
		}
		// ⛔ A tie must NEVER survive to an assignment — every tie goes through the ladder.
		if g.Outcome.Kind == KindTie {
			t.Errorf("spin %d %s leaked a KindTie into an assignment — the ladder was skipped", spin, w.AwardID)
		}
	}
}

func assertE2EDecidingValue(t *testing.T, spin int, award string, got DecidingValue, want *e2eDecidingValue) {
	t.Helper()
	if string(got.Class) != want.Class {
		t.Errorf("spin %d %s deciding_value class %q, want %q", spin, award, got.Class, want.Class)
		return
	}
	switch want.Class {
	case "volume":
		if got.Value == nil || got.Value.String() != want.Value {
			t.Errorf("spin %d %s deciding_value %v, want %s", spin, award, got.Value, want.Value)
		}
	case "rate":
		if got.Num == nil || got.Den == nil || got.Num.String() != want.Num || got.Den.String() != want.Den {
			t.Errorf("spin %d %s deciding_value %v/%v, want %s/%s", spin, award, got.Num, got.Den, want.Num, want.Den)
		}
	}
}

func assertE2EPity(t *testing.T, run CeremonyRun, tc e2eCase) {
	t.Helper()
	w := tc.Expected.Pity
	if run.PityLabel != w.Label {
		t.Errorf("pity label %q, want %q", run.PityLabel, w.Label)
	}
	if !equalStrings(run.Pity.Winless, w.Winless) {
		t.Errorf("pity winless %v, want %v", run.Pity.Winless, w.Winless)
	}
	// ⭐⭐ TWO FIELDS, NEVER ONE. Publishing the canonical order as the reveal order is the single
	// most destructive thing a caller can do with this result, so both are pinned separately.
	if !equalStrings(run.Pity.RevealOrder, w.RevealOrder) {
		t.Errorf("pity reveal_order %v, want %v", run.Pity.RevealOrder, w.RevealOrder)
	}
	if run.Pity.BytesConsumed != w.BytesConsumed {
		t.Errorf("pity consumed %d bytes, want %d", run.Pity.BytesConsumed, w.BytesConsumed)
	}
	if len(run.Pity.Draws) != len(w.Draws) {
		t.Errorf("pity made %d draws, want %d", len(run.Pity.Draws), len(w.Draws))
		return
	}
	for i, wd := range w.Draws {
		gd := run.Pity.Draws[i]
		if gd.N != wd.N || gd.K != wd.K || gd.Rejections != wd.Rejections || gd.Value != wd.Value {
			t.Errorf("pity draw %d = {n:%d k:%d rej:%d val:%d}, want {n:%d k:%d rej:%d val:%d}",
				i, gd.N, gd.K, gd.Rejections, gd.Value, wd.N, wd.K, wd.Rejections, wd.Value)
		}
	}
	// The multiset identity, re-derived rather than read: same length, same members, no additions,
	// no drops.
	a := append([]string{}, run.Pity.Winless...)
	b := append([]string{}, run.Pity.RevealOrder...)
	sort.Strings(a)
	sort.Strings(b)
	if !equalStrings(a, b) {
		t.Errorf("pity reveal_order is not a permutation of winless: %v vs %v", a, b)
	}
}

func assertE2EShelf(t *testing.T, run CeremonyRun, tc e2eCase) {
	t.Helper()
	want := tc.Expected.Shelf
	if len(run.Shelf) != len(want) {
		t.Errorf("shelf holds %d players, want %d", len(run.Shelf), len(want))
	}
	for sid, n := range want {
		if run.Shelf[sid] != n {
			t.Errorf("shelf[%s] = %d, want %d", sid, run.Shelf[sid], n)
		}
	}
	// ⚠ A player who won nothing is ABSENT, not present-with-zero — W8's spelling. A zero in the
	// map is a second spelling of the same fact and would break `validatePityShelf`'s contract.
	for sid, n := range run.Shelf {
		if n == 0 {
			t.Errorf("shelf carries %s with an explicit 0; an absent player IS shelf 0", sid)
		}
	}
}

func assertE2EAnchors(t *testing.T, run CeremonyRun, tc e2eCase) {
	t.Helper()
	a := tc.Expected.Anchors

	// ⭐⭐ THIS BLOCK IS `deferred-work.md:401`. Until this story the 22 / 27 / 49 byte split and the
	// twelve-award drawn order lived ONLY in a deleted harness's transcript and in prose —
	// `verify.test.ts:2825-2828` said in as many words that they "are NOT assertable here". They are
	// now, in both runtimes, re-derived from the run rather than read back from the vector.
	if len(run.Spins) != a.MainSpinCount {
		t.Errorf("main_spin_count %d, want %d", len(run.Spins), a.MainSpinCount)
	}
	var mainBytes uint64
	drawn := []string{}
	steps := map[int]bool{}
	kinds := map[string]bool{}
	for _, s := range run.Spins {
		mainBytes += s.Consumed
		drawn = append(drawn, s.Stage1.Live...)
		for _, r := range s.Result.Results {
			if r.Outcome.LadderExitStep != LadderExitNone {
				steps[r.Outcome.LadderExitStep] = true
			}
			kinds[string(r.Outcome.Kind)] = true
		}
	}
	if mainBytes != a.MainSpinBytes {
		t.Errorf("main_spin_bytes %d, want %d", mainBytes, a.MainSpinBytes)
	}
	if run.Pity.BytesConsumed != a.PityBytes {
		t.Errorf("pity_bytes %d, want %d", run.Pity.BytesConsumed, a.PityBytes)
	}
	if mainBytes+run.Pity.BytesConsumed != a.TotalBytes {
		t.Errorf("total_bytes %d, want %d", mainBytes+run.Pity.BytesConsumed, a.TotalBytes)
	}
	if !equalStrings(drawn, a.DrawnOrder) {
		t.Errorf("drawn_order %v, want %v", drawn, a.DrawnOrder)
	}
	if len(run.Pity.Winless) != a.WinlessCount {
		t.Errorf("winless_count %d, want %d", len(run.Pity.Winless), a.WinlessCount)
	}
	if len(run.Shelf) != a.ShelfHolders {
		t.Errorf("shelf_holders %d, want %d", len(run.Shelf), a.ShelfHolders)
	}
	maxTrophies := 0
	for _, n := range run.Shelf {
		if n > maxTrophies {
			maxTrophies = n
		}
	}
	if maxTrophies != a.MaxTrophiesPerPlayer {
		t.Errorf("max_trophies_per_player %d, want %d", maxTrophies, a.MaxTrophiesPerPlayer)
	}

	gotSteps := []int{}
	for s := range steps {
		gotSteps = append(gotSteps, s)
	}
	sort.Ints(gotSteps)
	if !reflect.DeepEqual(gotSteps, a.LadderExitSteps) {
		t.Errorf("ladder_exit_steps %v, want %v", gotSteps, a.LadderExitSteps)
	}
	gotKinds := []string{}
	for k := range kinds {
		gotKinds = append(gotKinds, k)
	}
	sort.Strings(gotKinds)
	if !equalStrings(gotKinds, a.OutcomeKinds) {
		t.Errorf("outcome_kinds %v, want %v", gotKinds, a.OutcomeKinds)
	}

	// ⭐⭐ FR-26 AS AN ACCOUNTING IDENTITY, RE-DERIVED FROM THE RUN. "<=1 trophy/player/spin" is the
	// rule the whole anti-sweep pass exists to enforce, and it is checked here over the WINNERS of
	// each spin rather than trusted from `Assigned` — a pass that assigned a player twice and then
	// deduplicated `Assigned` would satisfy every other assertion in this file.
	for _, s := range run.Spins {
		perPlayer := map[string]int{}
		for _, r := range s.Result.Results {
			for _, w := range WinnersOf(r.Outcome) {
				perPlayer[w]++
			}
		}
		for sid, n := range perPlayer {
			if n > 1 {
				t.Errorf("FR-26 VIOLATED: spin %d gave %s %d trophies", s.Spin, sid, n)
			}
		}
	}
}

func equalStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC5 — SUITE COMPLETENESS: THE VECTOR FILE SET, BY EXACT EQUALITY
// ══════════════════════════════════════════════════════════════════════════════════════════════
//
// ⛔ NOTHING ASSERTED THIS BEFORE. Each suite hard-codes its own path, so adding, renaming or
// DELETING a vector file reddened nothing — a deleted gate is indistinguishable from a gate that
// never existed. `roulette/vectors/README.md`'s gate-5 row calls this out by name: "end-to-end
// ceremony vector + suite completeness".
//
// ⚠ THE LIST IS TEN, NOT NINE. Nine are `--check`-derived; `canonical-bundle-input.json` is an
// INPUT, deliberately outside the generator's `outputs` map and exempt from the format rules, and
// it is ALSO gate 5's projection source. Its presence is load-bearing twice over.
// TestVectorWinlessSetIsIdenticalAtEveryWidth — `deferred-work.md:347`, CLOSED WITH COMMITTED DATA.
//
// ⭐⭐ 6.7's AC6 asked for the winless SET at all four Stage-1 widths, printed rather than inferred.
// The entry deferred it as costing "a full 14-demo corpus rebuild"; it costs nothing of the sort,
// being a pure function of the committed snapshot and a floors-zero catalog. Story 6.11 said exactly
// that in its notes and then left the four numbers in prose, which its code review flagged as the
// same evidentiary class the entry was raised against. The generator now emits them.
//
// ⚠ THE ENTRY'S OWN REASONING WAS FALSE AND THAT IS WHY THE AC WAS RIGHT. `:347` argued the sets were
// "near-certainly identical" BECAUSE the recorded shelf distributions were identical across widths.
// They are not — the distributions genuinely differ at widths 3 and 4. The same 19 players win
// nothing while the trophies distribute differently among the 9 who do, so the inference the entry
// rested on does not hold even though its conclusion does.
func TestVectorWinlessSetIsIdenticalAtEveryWidth(t *testing.T) {
	v := loadVector[e2eVector](t, "end-to-end.json")
	if v.Vector != "end-to-end" {
		t.Fatalf("loaded the wrong vector file: %q", v.Vector)
	}

	// ⛔ NON-VACUITY FIRST. Every assertion below is inside a loop or a comparison against rows[0];
	// with an empty slice they all pass while proving nothing.
	if len(v.WinlessByWidth) != 4 {
		t.Fatalf("winless_by_width has %d rows, want the four widths 6.7's AC6 names", len(v.WinlessByWidth))
	}

	first := v.WinlessByWidth[0]
	for i, row := range v.WinlessByWidth {
		if row.LiveCount != i+1 {
			t.Errorf("row %d is live_count %d, want %d — the widths must be 1..4 in order", i, row.LiveCount, i+1)
		}

		// ⭐ THE SET IS THE ANSWER. Identical at every width is the claim, and it is compared as an
		// ordered list because the generator sorts it — a permutation would be a different bug.
		if !equalStrings(row.Winless, first.Winless) {
			t.Errorf("the winless set at live_count %d differs from width 1:\n got %v\nwant %v",
				row.LiveCount, row.Winless, first.Winless)
		}

		// ⛔ NOT EVERYBODY AND NOT NOBODY. A degenerate set would make the equality above trivially
		// true at every width — the shape this project's vacuity catalogue keeps recording.
		if len(row.Winless) == 0 || len(row.Winless) >= v.Source.PlayerCount {
			t.Errorf("live_count %d has %d winless of %d players — a set that is everybody or nobody "+
				"proves nothing about width", row.LiveCount, len(row.Winless), v.Source.PlayerCount)
		}

		// ⭐ THE SPIN COUNT IS RE-DERIVED FROM THE ROW'S OWN INPUTS, never restated: every spin
		// reveals min(width, |remaining pool|) awards, so it takes ceil(awards / width) of them.
		wantSpins := (v.Source.AwardCount + row.LiveCount - 1) / row.LiveCount
		if row.MainSpins != wantSpins {
			t.Errorf("live_count %d ran %d main spins, ceil(%d/%d) = %d",
				row.LiveCount, row.MainSpins, v.Source.AwardCount, row.LiveCount, wantSpins)
		}

		// ⭐ THE ACCOUNTING IDENTITY THAT TIES THE TWO HALVES TOGETHER: the distribution must cover
		// every player exactly once, and its zero-trophy bucket must BE the winless set. Without
		// this the two fields could drift into describing different runs.
		total, zeroBucket := 0, 0
		for _, b := range row.ShelfDistribution {
			total += b.Players
			if b.Trophies == 0 {
				zeroBucket = b.Players
			}
		}
		if total != v.Source.PlayerCount {
			t.Errorf("live_count %d's shelf distribution covers %d players, the snapshot has %d",
				row.LiveCount, total, v.Source.PlayerCount)
		}
		if zeroBucket != len(row.Winless) {
			t.Errorf("live_count %d has %d players on shelf 0 but %d winless — the distribution and "+
				"the set describe different runs", row.LiveCount, zeroBucket, len(row.Winless))
		}
	}
}

func TestVectorDirectoryIsComplete(t *testing.T) {
	want := []string{
		"antisweep-resolve.json",
		"canonical-bundle-input.json",
		"canonical-bundle.json",
		"end-to-end.json",
		"ladder-resolve.json",
		"pity-draw.json",
		"prng-block.json",
		"prng-uniform-int.json",
		"stage1-pick.json",
		"stage2-resolve.json",
	}

	entries, err := os.ReadDir(vectorDir)
	if err != nil {
		t.Fatalf("read %s: %v", vectorDir, err)
	}
	got := []string{}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		got = append(got, e.Name())
	}
	sort.Strings(got)

	if !equalStrings(got, want) {
		t.Errorf("roulette/vectors holds %v, want %v\n"+
			"⛔ A vector added, renamed or DELETED must be a deliberate change to this list — that is "+
			"the whole point of the assertion. If you added a gate, add it here and to the TypeScript "+
			"twin in lib/roulette/end-to-end.test.ts.", got, want)
	}

	// ⭐⭐ NON-VACUITY, PROVEN RATHER THAN ASSERTED (AC5) — AND THE FIRST PROOF WAS ITSELF VACUOUS.
	//
	// ⛔ WHAT WAS WRONG, recorded so it is not re-introduced: the leave-one-out loop below compared
	// `got` (ten entries) against `shorter` lists of NINE. A ten-element slice can never equal a
	// nine-element one, so `equalStrings(got, shorter)` was false on every iteration no matter what
	// the names were — the loop was dead, and the "proof" could only ever have failed on cardinality.
	// It is verbatim the shape this project's own vacuity catalogue lists, and 6.11's code review
	// found the identical defect in the TypeScript twin.
	//
	// ⭐ THE REAL PROOF VARIES ONE NAME AT A TIME AT CONSTANT LENGTH, so the equality can only hold
	// because of what the names ARE.
	if len(want) < 10 {
		t.Fatalf("the expected file set has shrunk to %d entries — a smaller list is a weaker gate", len(want))
	}
	for i := range want {
		swapped := append([]string{}, want...)
		swapped[i] = "not-a-real-vector.json"
		if len(swapped) != len(want) {
			t.Fatalf("the name-swap proof changed the length — it must vary only the NAME")
		}
		if equalStrings(got, swapped) {
			t.Errorf("renaming %q still matched the directory — the pin is not sensitive to that "+
				"name, so deleting or renaming that vector would pass unnoticed", want[i])
		}
	}

	// The weaker half, kept deliberately and labelled as the weaker half: a vector ADDED or DELETED
	// changes the count, and that must redden independently of any name.
	for i := range want {
		shorter := append(append([]string{}, want[:i]...), want[i+1:]...)
		if equalStrings(got, shorter) {
			t.Errorf("removing %q from the expected set still matched the directory", want[i])
		}
	}
	if equalStrings(got, append(append([]string{}, want...), "an-extra-vector.json")) {
		t.Error("an ADDED vector still matched the expected set")
	}
}
