package ceremony

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// ══════════════════════════════════════════════════════════════════════════════════════════════
// STORY 6.11 — GATE 5's SERIALIZATION HALF (FR-25 / AD-14 / AD-19)
// ══════════════════════════════════════════════════════════════════════════════════════════════
//
// ⭐⭐ WHY GATE 5 IS TWO GO TESTS IN TWO PACKAGES, AND WHAT JOINS THEM. `worker/awards` is pinned as
// a LEAF (`prng_test.go`, `TestPackageIsALeaf`) and therefore cannot import this package's
// canonicalizer, so ONE Go test cannot walk seed → draw → canonical bytes in a single process. The
// decision (Cuatro, Story 6.11 Question 3) was TWO tests joined ONLY by the vector rather than a new
// package importing both — which would have reddened the file-set pin and reopened "is
// `worker/awards` still a leaf?", an architecture question a vector story should not answer alone.
//
// So: `worker/awards/end_to_end_test.go` projects the snapshot and re-runs the whole DRAW against
// `end-to-end.json`. This file proves the other end — that the document the draw was projected FROM
// is the same document gate 4 canonicalizes, byte for byte. The vector is the only thing either side
// shares, which is exactly the property `roulette/vectors/README.md`'s three house rules require.
//
// ⛔ WITHOUT THIS FILE THE TWO GATES COULD DRIFT SILENTLY. Gate 4 canonicalizes an `input_json`
// EMBEDDED in `canonical-bundle.json`; gate 5 projects from the SIBLING FILE
// `canonical-bundle-input.json`. Nothing asserted those were the same 75,013 bytes — so a corpus
// swap that updated one and not the other would leave both `--check` and both suites green while the
// producer and the verifier described different ceremonies.

type e2eSourceBlock struct {
	File        string `json:"file"`
	Present     bool   `json:"present"`
	UTF8Bytes   int    `json:"utf8_bytes"`
	PlayerCount int    `json:"player_count"`
	AwardCount  int    `json:"award_count"`
	SeedHex     string `json:"seed_hex"`
	WeightTable []int  `json:"weight_table"`
}

type e2eVectorHead struct {
	Vector      string         `json:"vector"`
	AlgoVersion string         `json:"algo_version"`
	Source      e2eSourceBlock `json:"source"`
	Cases       []struct {
		Name       string `json:"name"`
		Projection struct {
			Snapshot       string `json:"snapshot"`
			SnapshotSource string `json:"snapshot_source"`
		} `json:"projection"`
	} `json:"cases"`
}

func loadEndToEndHead(t *testing.T) e2eVectorHead {
	t.Helper()
	path := filepath.Join("..", "..", "roulette", "vectors", "end-to-end.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read end-to-end.json: %v (the vectors gate the build — a missing file is a failure, not a skip)", err)
	}
	var v e2eVectorHead
	if err := json.Unmarshal(raw, &v); err != nil {
		t.Fatalf("parse end-to-end.json: %v", err)
	}
	if v.Vector != "end-to-end" {
		t.Fatalf("loaded the wrong vector: %q", v.Vector)
	}
	return v
}

// TestGate5ProjectionSourceIsGate4sDocument is the JOIN. Gate 5's projection source and gate 4's
// end-to-end row must be the same bytes, canonicalized by the REAL canonicalizer.
func TestGate5ProjectionSourceIsGate4sDocument(t *testing.T) {
	head := loadEndToEndHead(t)
	if !head.Source.Present {
		t.Fatal("end-to-end.json was generated with no projection source present")
	}

	path := filepath.Join("..", "..", "roulette", "vectors", head.Source.File)
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read the projection source %s: %v", head.Source.File, err)
	}

	// ⭐ THE TRIPWIRE, FROM THE FILE ON DISK. `README.md:129-135` is explicit that the byte LENGTH is
	// what stands between a silent corpus swap and a green suite, because the derived rows are
	// regenerated FROM this file and would come out self-consistent with a different hash.
	if len(raw) != head.Source.UTF8Bytes {
		t.Errorf("%s is %d bytes on disk, end-to-end.json was generated against %d",
			head.Source.File, len(raw), head.Source.UTF8Bytes)
	}

	// ⛔ bundle_sha256 IS DELIBERATELY NOT ASSERTED (DECISION AC). `achievement_ts` is wall-clock
	// approval time, so the hash moves on every corpus rebuild while the byte length does not — the
	// two values in circulation (`4c0614fa…` and `8b899112…`) are BOTH correct for their own build
	// and must never be "reconciled". What IS asserted is that canonicalizing the projection source
	// reproduces gate 4's committed canonical form and ITS OWN hash, which is a derivation rather
	// than an invariant.
	canonVec := loadCanonVector(t)
	if len(canonVec.EndToEnd) != 1 {
		t.Fatalf("canonical-bundle.json carries %d end_to_end rows, want 1", len(canonVec.EndToEnd))
	}
	row := canonVec.EndToEnd[0]

	if row.InputJSON != string(raw) {
		t.Errorf("gate 4's embedded input_json and gate 5's projection source %s are DIFFERENT BYTES "+
			"(%d vs %d) — the two gates describe different ceremonies",
			head.Source.File, len(row.InputJSON), len(raw))
	}

	got, err := CanonicalizeJSON(raw, true)
	if err != nil {
		t.Fatalf("canonicalize the projection source: %v", err)
	}
	if got != row.Canonical {
		t.Error("canonicalizing gate 5's projection source did not reproduce gate 4's committed canonical form")
	}
	if h := CanonicalSHA256Hex(got); h != row.SHA256 {
		t.Errorf("projection source hashes to %s, gate 4's row carries %s", h, row.SHA256)
	}
	if row.CanonicalUTF8Bytes != len([]byte(got)) {
		t.Errorf("gate 4 declares %d canonical bytes, recomputed %d", row.CanonicalUTF8Bytes, len([]byte(got)))
	}

	// ⭐ AC3 — every case must name THIS file as its snapshot source and declare the snapshot real.
	// Without this the `source` block could describe one document while the cases projected another.
	if len(head.Cases) < 2 {
		t.Fatalf("end-to-end.json carries %d cases; DECISION AB requires two", len(head.Cases))
	}
	for _, c := range head.Cases {
		if c.Projection.SnapshotSource != head.Source.File {
			t.Errorf("case %q projects from %q, the source block declares %q",
				c.Name, c.Projection.SnapshotSource, head.Source.File)
		}
		if c.Projection.Snapshot != "real" {
			t.Errorf("case %q declares a %q snapshot — AD-19 requires a real captured snapshot",
				c.Name, c.Projection.Snapshot)
		}
	}
}

// TestGate5SourceBlockMatchesTheDocument re-derives the `source` block's counts from the document
// itself, so the block cannot drift into being decoration.
func TestGate5SourceBlockMatchesTheDocument(t *testing.T) {
	head := loadEndToEndHead(t)
	path := filepath.Join("..", "..", "roulette", "vectors", head.Source.File)
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", head.Source.File, err)
	}
	var doc struct {
		SeedHex string            `json:"seed_hex"`
		Players []json.RawMessage `json:"players"`
		Awards  []json.RawMessage `json:"awards"`
		Luck    struct {
			WeightTable []int `json:"weight_table"`
		} `json:"luck"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatalf("parse %s: %v", head.Source.File, err)
	}

	if len(doc.Players) != head.Source.PlayerCount {
		t.Errorf("source declares %d players, the document holds %d", head.Source.PlayerCount, len(doc.Players))
	}
	if len(doc.Awards) != head.Source.AwardCount {
		t.Errorf("source declares %d awards, the document holds %d", head.Source.AwardCount, len(doc.Awards))
	}
	if doc.SeedHex != head.Source.SeedHex {
		t.Errorf("source declares seed %q, the document carries %q", head.Source.SeedHex, doc.SeedHex)
	}
	if len(doc.Luck.WeightTable) != len(head.Source.WeightTable) {
		t.Fatalf("source declares a %d-entry weight table, the document carries %d",
			len(head.Source.WeightTable), len(doc.Luck.WeightTable))
	}
	for i := range doc.Luck.WeightTable {
		if doc.Luck.WeightTable[i] != head.Source.WeightTable[i] {
			t.Errorf("weight table differs at %d: %d vs %d", i, doc.Luck.WeightTable[i], head.Source.WeightTable[i])
		}
	}
	// Non-vacuity: a document with no players or no awards would satisfy every equality above
	// against a `source` block that also said zero.
	if len(doc.Players) == 0 || len(doc.Awards) == 0 {
		t.Fatal("the projection source carries no players or no awards — every count above is vacuous")
	}
}
