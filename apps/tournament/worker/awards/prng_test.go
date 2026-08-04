package awards

import (
	"bytes"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"go/parser"
	"go/printer"
	"go/token"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"testing"
)

// ── the shared contract ────────────────────────────────────────────────────────
//
// These tests read `roulette/vectors/*.json` AT RUNTIME. The values are NEVER transcribed into
// Go literals: a hard-coded copy greens on the day the vector is regenerated and silently stops
// testing the contract. `go test` runs with cwd = the package directory, hence ../../.

const vectorDir = "../../roulette/vectors"

// labelSource is the vector's machine-readable description of how a label is CONSTRUCTED.
// Without it a conformance suite only ever CONSUMES `label` as an opaque string, and the label
// generator is untested by the vector — the mutation pass found exactly that: bumping the "v1"
// prefix and making the spin 0-based both passed the vector-driven test cleanly.
type labelSource struct {
	Kind string `json:"kind"` // "stage1" | "pity"
	Spin int    `json:"spin"` // stage1 only, 1-based
}

type invalidSeed struct {
	Why     string `json:"why"`
	SeedHex string `json:"seed_hex"`
}

type blockCase struct {
	Name        string      `json:"name"`
	SeedHex     string      `json:"seed_hex"`
	Label       string      `json:"label"`
	LabelSource labelSource `json:"label_source"`
	I           uint64      `json:"i"`
	MsgHex      string      `json:"msg_hex"`
	BlockHex    string      `json:"block_hex"`
}

type invalidSpin struct {
	Why  string `json:"why"`
	Spin int    `json:"spin"`
}

type blockVector struct {
	Vector            string        `json:"vector"`
	AlgoVersion       string        `json:"algo_version"`
	InvalidSeedHex    []invalidSeed `json:"invalid_seed_hex"`
	InvalidStage1Spin []invalidSpin `json:"invalid_stage1_spin"`
	Cases             []blockCase   `json:"cases"`
}

type uniformDraw struct {
	N                  uint64 `json:"n"`
	Result             uint64 `json:"result"`
	BytesConsumedAfter uint64 `json:"bytes_consumed_after"`
}

type uniformCase struct {
	Name        string        `json:"name"`
	SeedHex     string        `json:"seed_hex"`
	Label       string        `json:"label"`
	LabelSource labelSource   `json:"label_source"`
	Note        string        `json:"note"`
	Draws       []uniformDraw `json:"draws"`
}

type uniformVector struct {
	Vector  string `json:"vector"`
	NBounds struct {
		Min uint64 `json:"min"`
		Max uint64 `json:"max"`
	} `json:"n_bounds"`
	Cases []uniformCase `json:"cases"`
}

// mustStream opens a stream or fails the test. NewStream returns an error since the 6.3 code
// review (it previously validated nothing, while the TS verifier refused an empty label — a
// producer that accepts what the verifier refuses can draw a ceremony nobody can check).
func mustStream(t *testing.T, seed [SeedLen]byte, label string) *Stream {
	t.Helper()
	s, err := NewStream(seed, label)
	if err != nil {
		t.Fatalf("NewStream(%q): %v", label, err)
	}
	return s
}

func loadVector[T any](t *testing.T, file string) T {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(vectorDir, file))
	if err != nil {
		t.Fatalf("read golden vector %s: %v (the vectors gate the build — a missing file is a failure, not a skip)", file, err)
	}
	var out T
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("parse golden vector %s: %v", file, err)
	}
	return out
}

// ── gate 1: the block function ─────────────────────────────────────────────────

func TestVectorBlockFunction(t *testing.T) {
	v := loadVector[blockVector](t, "prng-block.json")
	if v.Vector != "prng-block" {
		t.Fatalf("loaded the wrong vector file: %q", v.Vector)
	}
	if len(v.Cases) == 0 {
		t.Fatal("prng-block.json has no cases")
	}

	for _, tc := range v.Cases {
		t.Run(tc.Name, func(t *testing.T) {
			seed, err := DecodeSeed(tc.SeedHex)
			if err != nil {
				t.Fatalf("DecodeSeed(%q): %v", tc.SeedHex, err)
			}

			// ⭐ Assert the MESSAGE first. msg_hex exists so `utf8(label) || LE64(i)` is directly
			// testable instead of hiding inside the digest — otherwise a LE/BE counter mistake
			// and a key-encoding mistake are indistinguishable ("wrong digest" either way).
			var counter [8]byte
			binary.LittleEndian.PutUint64(counter[:], tc.I)
			gotMsg := hex.EncodeToString(append([]byte(tc.Label), counter[:]...))
			if gotMsg != tc.MsgHex {
				t.Errorf("msg mismatch\n got %s\nwant %s", gotMsg, tc.MsgHex)
			}

			// Then the digest — read through the real Stream via the PUBLIC Read, so the
			// pos -> block-index mapping is genuinely exercised.
			//
			// The 6.3 code review caught this calling the unexported s.block(tc.I) directly while
			// claiming to test "the block INDEXING": handing an index to block() is precisely a
			// bare HMAC call and maps nothing. Reading (i+1)*32 bytes and taking the last 32 makes
			// the counter arithmetic load-bearing, which is what reaches the i=255 / i=256 cases.
			s := mustStream(t, seed, tc.Label)
			var got []byte
			for j := uint64(0); j <= tc.I; j++ {
				b, err := s.Read(blockLen)
				if err != nil {
					t.Fatalf("Read block %d: %v", j, err)
				}
				got = b
			}
			if hex.EncodeToString(got) != tc.BlockHex {
				t.Errorf("block mismatch\n got %s\nwant %s", hex.EncodeToString(got), tc.BlockHex)
			}
			if s.Consumed() != (tc.I+1)*blockLen {
				t.Errorf("Consumed() = %d, want %d", s.Consumed(), (tc.I+1)*blockLen)
			}
		})
	}
}

// The stream really is the concatenation block_0 || block_1 || …: reading 96 bytes from position
// 0 must equal the three blocks laid end to end. This is what makes E3 (straddling) meaningful.
func TestVectorStreamIsBlockConcatenation(t *testing.T) {
	v := loadVector[blockVector](t, "prng-block.json")

	// Group the vector's blocks by (seed,label) so we can rebuild a prefix of each stream.
	type key struct{ seed, label string }
	blocks := map[key]map[uint64]string{}
	for _, c := range v.Cases {
		k := key{c.SeedHex, c.Label}
		if blocks[k] == nil {
			blocks[k] = map[uint64]string{}
		}
		blocks[k][c.I] = c.BlockHex
	}

	checked := 0
	for k, byIdx := range blocks {
		b0, ok0 := byIdx[0]
		b1, ok1 := byIdx[1]
		if !ok0 || !ok1 {
			continue
		}
		seed, err := DecodeSeed(k.seed)
		if err != nil {
			t.Fatalf("DecodeSeed: %v", err)
		}
		s := mustStream(t, seed, k.label)
		got, err := s.Read(2 * blockLen)
		if err != nil {
			t.Fatalf("Read: %v", err)
		}
		if want := b0 + b1; hex.EncodeToString(got) != want {
			t.Errorf("%s: stream prefix != block_0||block_1\n got %s\nwant %s", k.label, hex.EncodeToString(got), want)
		}
		if s.Consumed() != 2*blockLen {
			t.Errorf("%s: Consumed() = %d, want %d", k.label, s.Consumed(), 2*blockLen)
		}
		checked++
	}
	if checked == 0 {
		t.Fatal("no (seed,label) in prng-block.json has both i=0 and i=1 — the counter never gets exercised")
	}
}

// ── the label GENERATOR is part of the contract, not just the label string ─────
//
// Added after the mutation pass: `label v1 -> v2` and `stage1 spin 1-based -> 0-based` both
// SURVIVED the vector-driven test, because every conformance case read `label` straight out of
// the file and never asked the code to produce it. `label_source` closes that — the expected
// value still comes from the vector, so this stays vector-driven rather than hand-written.

// buildLabel reconstructs a case's label from the vector's label_source using the package's own
// generator. Any drift in the prefix, the version, the padding or the 1-based index shows up here.
func buildLabel(t *testing.T, src labelSource) string {
	t.Helper()
	switch src.Kind {
	case "pity":
		return PityLabel
	case "stage1":
		got, err := Stage1Label(src.Spin)
		if err != nil {
			t.Fatalf("Stage1Label(%d): %v", src.Spin, err)
		}
		return got
	default:
		t.Fatalf("unknown label_source kind %q — the vector and the suite have drifted", src.Kind)
		return ""
	}
}

func TestVectorLabelConstruction(t *testing.T) {
	bv := loadVector[blockVector](t, "prng-block.json")
	uv := loadVector[uniformVector](t, "prng-uniform-int.json")

	checkedStage1, checkedPity := 0, 0
	check := func(name, want string, src labelSource) {
		t.Run(name, func(t *testing.T) {
			if got := buildLabel(t, src); got != want {
				t.Errorf("label built from %+v = %q, want %q (the vector's label)", src, got, want)
			}
		})
		switch src.Kind {
		case "stage1":
			checkedStage1++
		case "pity":
			checkedPity++
		}
	}

	for _, c := range bv.Cases {
		check("block/"+c.Name, c.Label, c.LabelSource)
	}
	for _, c := range uv.Cases {
		check("uniform/"+c.Name, c.Label, c.LabelSource)
	}

	// A vector that lost its label_source fields would make every check above vacuous.
	if checkedStage1 == 0 || checkedPity == 0 {
		t.Fatalf("label_source coverage is vacuous: %d stage1, %d pity", checkedStage1, checkedPity)
	}
}

// The seed shapes both runtimes must REFUSE (E4) travel in the vector too, so the two suites
// cannot drift into two different hand-written lists. Added after `seed decode accepts a 31-byte
// key` survived the vector-driven test in both languages.
func TestVectorRejectsInvalidSeeds(t *testing.T) {
	v := loadVector[blockVector](t, "prng-block.json")
	if len(v.InvalidSeedHex) == 0 {
		t.Fatal("prng-block.json carries no invalid_seed_hex list — E4 is not part of the shared contract")
	}
	for _, bad := range v.InvalidSeedHex {
		t.Run(bad.Why, func(t *testing.T) {
			if got, err := DecodeSeed(bad.SeedHex); err == nil {
				t.Errorf("DecodeSeed(%q) = %x, want an error (%s)", bad.SeedHex, got, bad.Why)
			}
		})
	}
}

// The stage-1 spins both runtimes must REFUSE travel in the vector for the same reason the seed
// shapes do. Added by the 6.3 code review: a reviewer-independent mutation relaxing Stage1Label's
// 1-based lower bound SURVIVED the vector-driven test — seed refusals were shared contract while
// label refusals were not, an asymmetry with no justification.
func TestVectorRejectsInvalidStage1Spins(t *testing.T) {
	v := loadVector[blockVector](t, "prng-block.json")
	if len(v.InvalidStage1Spin) == 0 {
		t.Fatal("prng-block.json carries no invalid_stage1_spin list — the label refusals are not shared contract")
	}
	for _, bad := range v.InvalidStage1Spin {
		t.Run(bad.Why, func(t *testing.T) {
			if got, err := Stage1Label(bad.Spin); err == nil {
				t.Errorf("Stage1Label(%d) = %q, want an error (%s)", bad.Spin, got, bad.Why)
			}
		})
	}
}

// ── gate 2: uniform_int ────────────────────────────────────────────────────────

func TestVectorUniformInt(t *testing.T) {
	v := loadVector[uniformVector](t, "prng-uniform-int.json")
	if v.Vector != "prng-uniform-int" {
		t.Fatalf("loaded the wrong vector file: %q", v.Vector)
	}
	if len(v.Cases) == 0 {
		t.Fatal("prng-uniform-int.json has no cases")
	}
	// The vector declares the same E2 bounds this package enforces. If they ever diverge, the
	// two runtimes will disagree about which n is legal.
	if v.NBounds.Min != 1 || v.NBounds.Max != MaxN {
		t.Errorf("vector n_bounds = [%d, %d], package = [1, %d]", v.NBounds.Min, v.NBounds.Max, MaxN)
	}

	for _, tc := range v.Cases {
		t.Run(tc.Name, func(t *testing.T) {
			seed, err := DecodeSeed(tc.SeedHex)
			if err != nil {
				t.Fatalf("DecodeSeed: %v", err)
			}
			s := mustStream(t, seed, tc.Label)
			for i, d := range tc.Draws {
				got, err := UniformInt(s, d.N)
				if err != nil {
					t.Errorf("draw %d: UniformInt(n=%d): %v", i+1, d.N, err)
					continue
				}
				if got != d.Result {
					t.Errorf("draw %d (n=%d): result = %d, want %d", i+1, d.N, got, d.Result)
				}
				// ⭐ The byte position is the assertion that makes AC2 real. A wrong result and a
				// wrong number of consumed bytes are DIFFERENT bugs, and only the second one
				// corrupts every later draw.
				if s.Consumed() != d.BytesConsumedAfter {
					t.Errorf("draw %d (n=%d): consumed = %d, want %d", i+1, d.N, s.Consumed(), d.BytesConsumedAfter)
				}
				if got >= d.N {
					t.Errorf("draw %d: result %d is not in [0, %d)", i+1, got, d.N)
				}
			}
		})
	}
}

// The vector must actually CONTAIN the three cases that carry the story's weight. A suite that
// passes because the interesting rows quietly disappeared is the failure mode this guards.
func TestVectorCoversTheHardCases(t *testing.T) {
	v := loadVector[uniformVector](t, "prng-uniform-int.json")

	var sawRejection, sawStraddle, sawZeroByte, sawK3, sawK4, sawExactThreshold bool
	for _, tc := range v.Cases {
		seed, err := DecodeSeed(tc.SeedHex)
		if err != nil {
			t.Fatalf("DecodeSeed: %v", err)
		}
		// A second stream over the same label, read RAW, so the actual x of every k-byte group
		// (including the rejected ones) can be inspected.
		raw := mustStream(t, seed, tc.Label)

		prev := uint64(0)
		for i, d := range tc.Draws {
			// ⛔ Validate the vector's own numbers BEFORE doing arithmetic on them. UniformInt
			// range-checks n, but this test does not call it — so a malformed "n": 0 row used to
			// panic the whole test binary on an integer divide-by-zero (space % d.N) instead of
			// failing one named test, and a non-monotonic bytes_consumed_after underflowed the
			// uint64 subtraction below into ~2^64. Caught by the 6.3 code review.
			if d.N < 1 || d.N > MaxN {
				t.Fatalf("%s draw %d: vector carries out-of-range n = %d, outside [1, %d]", tc.Name, i+1, d.N, MaxN)
			}
			if d.BytesConsumedAfter < prev {
				t.Fatalf("%s draw %d: bytes_consumed_after went backwards (%d < %d) — the vector is malformed",
					tc.Name, i+1, d.BytesConsumedAfter, prev)
			}

			k, space := minimalK(d.N)
			limit := space - (space % d.N)
			delta := d.BytesConsumedAfter - prev

			if delta > uint64(k) {
				sawRejection = true // a draw that burned more than k bytes can only be a rejection
			}
			if delta == 0 && d.N == 1 {
				sawZeroByte = true // E1
			}
			if k == 3 {
				sawK3 = true // the three-byte width — reached by no case before the 6.3 review
			}
			if k == 4 {
				sawK4 = true // the n = 2^32 upper bound
			}

			buf, err := raw.Read(int(delta))
			if err != nil {
				t.Fatalf("Read: %v", err)
			}
			// Walk the individual k-byte READS inside this draw (a rejection makes more than one).
			pos := prev
			for off := 0; k > 0 && off+k <= len(buf); off += k {
				// ⭐ A per-READ straddle: this k-byte read begins at pos and ends at pos+k-1.
				// The previous version compared the whole DRAW's span, which a rejection sequence
				// at bytes 30/31/32 satisfies with three one-byte reads and no straddle at all —
				// so the guard could pass with the straddle case deleted. Caught by the review.
				if pos/blockLen != (pos+uint64(k)-1)/blockLen {
					sawStraddle = true
				}
				var x uint64
				for _, b := range buf[off : off+k] {
					x = x<<8 | uint64(b)
				}
				if x == limit {
					sawExactThreshold = true
				}
				pos += uint64(k)
			}
			prev = d.BytesConsumedAfter
		}
	}

	if !sawRejection {
		t.Error("no vector case exercises a REAL rejection (a draw consuming more than k bytes)")
	}
	if !sawStraddle {
		t.Error("no vector case straddles a 32-byte block boundary")
	}
	if !sawZeroByte {
		t.Error("no vector case exercises E1 (n=1 consuming zero bytes)")
	}
	if !sawK3 {
		t.Error("no vector case exercises k=3 — a three-byte big-endian assembly bug is untested")
	}
	if !sawK4 {
		t.Error("no vector case exercises k=4 (the n = 2^32 bound)")
	}
	// ⭐ Without a draw whose x is EXACTLY limit, `x >= limit` and `x > limit` are
	// indistinguishable — the mutation pass found that off-by-one surviving the whole suite in
	// both languages. This assertion is what keeps the case in the file.
	if !sawExactThreshold {
		t.Error("no vector case contains a draw with x == limit exactly — `x >= limit` vs `x > limit` is untested")
	}
}

// ── E1 / E2 / E3 / E4 as direct assertions ─────────────────────────────────────

// E1 — n = 1 reads NOTHING. Vector-pinned too, but stated here so the intent is unmissable at
// the implementation site.
func TestE1UniformIntOneConsumesZeroBytes(t *testing.T) {
	seed, err := DecodeSeed(realSeedHex)
	if err != nil {
		t.Fatalf("DecodeSeed: %v", err)
	}
	s := mustStream(t, seed, PityLabel)
	for i := 0; i < 5; i++ {
		got, err := UniformInt(s, 1)
		if err != nil {
			t.Fatalf("UniformInt(1): %v", err)
		}
		if got != 0 {
			t.Errorf("UniformInt(1) = %d, want 0", got)
		}
		if s.Consumed() != 0 {
			t.Fatalf("UniformInt(1) consumed %d bytes, want 0 (DECISION A: minimal k for n=1 is 0)", s.Consumed())
		}
	}
	// …and the stream is untouched afterwards: the next real draw must start at byte 0.
	fresh := mustStream(t, seed, PityLabel)
	a, _ := UniformInt(s, 200)
	b, _ := UniformInt(fresh, 200)
	if a != b {
		t.Errorf("n=1 draws perturbed the stream: %d != %d", a, b)
	}
}

// E2 — out-of-range n is a programmer error, loudly.
func TestE2NBounds(t *testing.T) {
	seed, _ := DecodeSeed(realSeedHex)

	for _, n := range []uint64{0, MaxN + 1, MaxN * 2} {
		s := mustStream(t, seed, PityLabel)
		if _, err := UniformInt(s, n); err == nil {
			t.Errorf("UniformInt(n=%d) returned no error, want out-of-range error", n)
		}
		if s.Consumed() != 0 {
			t.Errorf("UniformInt(n=%d) consumed %d bytes before rejecting the argument", n, s.Consumed())
		}
	}
	// The bound itself is INCLUSIVE and accepted.
	s := mustStream(t, seed, PityLabel)
	if _, err := UniformInt(s, MaxN); err != nil {
		t.Errorf("UniformInt(n=MaxN) = %v, want accepted", err)
	}
	if s.Consumed() != 4 {
		t.Errorf("UniformInt(n=2^32) consumed %d bytes, want 4 (k=4)", s.Consumed())
	}
}

func TestMinimalK(t *testing.T) {
	cases := []struct {
		n     uint64
		k     int
		space uint64
	}{
		{n: 1, k: 0, space: 1}, // E1
		{n: 2, k: 1, space: 256},
		{n: 200, k: 1, space: 256},
		{n: 255, k: 1, space: 256},
		{n: 256, k: 1, space: 256},   // exactly 256^1
		{n: 257, k: 2, space: 65536}, // the k boundary
		{n: 65536, k: 2, space: 65536},
		{n: 65537, k: 3, space: 1 << 24},
		{n: 1 << 24, k: 3, space: 1 << 24},
		{n: (1 << 24) + 1, k: 4, space: 1 << 32},
		{n: MaxN, k: 4, space: 1 << 32},
	}
	for _, tc := range cases {
		k, space := minimalK(tc.n)
		if k != tc.k || space != tc.space {
			t.Errorf("minimalK(%d) = (%d, %d), want (%d, %d)", tc.n, k, space, tc.k, tc.space)
		}
	}
}

// E3 — a read that begins at byte 31 takes byte 31 of block 0 and byte 0 of block 1.
func TestE3ReadStraddlesBlockBoundary(t *testing.T) {
	seed, _ := DecodeSeed(realSeedHex)
	label := PityLabel

	whole := mustStream(t, seed, label)
	all, err := whole.Read(3 * blockLen)
	if err != nil {
		t.Fatalf("Read: %v", err)
	}

	straddler := mustStream(t, seed, label)
	if _, err := straddler.Read(blockLen - 1); err != nil { // position -> 31
		t.Fatalf("Read: %v", err)
	}
	pair, err := straddler.Read(2)
	if err != nil {
		t.Fatalf("Read: %v", err)
	}
	if pair[0] != all[31] || pair[1] != all[32] {
		t.Errorf("straddling read = %x, want %x (byte 31 of block_0 then byte 0 of block_1)", pair, all[31:33])
	}
	if straddler.Consumed() != 33 {
		t.Errorf("Consumed() = %d, want 33", straddler.Consumed())
	}

	// …and byte-at-a-time equals one big read: the block cache must not change what is produced.
	oneByOne := mustStream(t, seed, label)
	for i := 0; i < 3*blockLen; i++ {
		b, err := oneByOne.Read(1)
		if err != nil {
			t.Fatalf("Read: %v", err)
		}
		if b[0] != all[i] {
			t.Fatalf("byte %d: one-at-a-time %02x != bulk %02x", i, b[0], all[i])
		}
	}
}

// E4 — the seed key is exactly 32 bytes decoded from 64 LOWERCASE hex chars.
func TestE4DecodeSeed(t *testing.T) {
	cases := []struct {
		name string
		in   string
		err  bool
	}{
		{name: "the real frozen seed", in: realSeedHex},
		{name: "all zeros", in: strings.Repeat("0", 64)},
		{name: "all f", in: strings.Repeat("f", 64)},
		{name: "uppercase rejected", in: strings.ToUpper(realSeedHex), err: true},
		{name: "mixed case rejected", in: "1B3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c", err: true},
		{name: "0x prefix rejected", in: "0x" + realSeedHex[2:], err: true},
		{name: "31 bytes rejected", in: realSeedHex[:62], err: true},
		{name: "33 bytes rejected", in: realSeedHex + "ab", err: true},
		{name: "leading whitespace rejected", in: " " + realSeedHex[1:], err: true},
		{name: "trailing newline rejected", in: realSeedHex + "\n", err: true},
		{name: "non-hex char rejected", in: realSeedHex[:63] + "g", err: true},
		{name: "empty rejected", in: "", err: true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := DecodeSeed(tc.in)
			if tc.err {
				if err == nil {
					t.Errorf("DecodeSeed(%q) = %x, want error", tc.in, got)
				}
				return
			}
			if err != nil {
				t.Errorf("DecodeSeed(%q): %v", tc.in, err)
			}
		})
	}
}

// The key is the RAW 32 bytes, never the hex TEXT. Both produce a valid-looking stream; only one
// is the spec. (The vector proves which — this states why it matters.)
func TestKeyIsRawBytesNotHexText(t *testing.T) {
	seed, _ := DecodeSeed(realSeedHex)
	s := mustStream(t, seed, PityLabel)
	raw := s.block(0)

	var asText [SeedLen]byte
	copy(asText[:], realSeedHex) // the first 32 CHARACTERS of the hex string
	textKeyed := mustStream(t, asText, PityLabel).block(0)

	if raw == textKeyed {
		t.Fatal("raw-byte key and text key produced the same block — the test is not testing anything")
	}
}

// Streams are independent: same seed, different labels, different bytes — and each starts at 0.
func TestStreamsAreIndependentPerLabel(t *testing.T) {
	seed, _ := DecodeSeed(realSeedHex)

	seen := map[string]string{}
	for spin := 1; spin <= 12; spin++ {
		label, err := Stage1Label(spin)
		if err != nil {
			t.Fatalf("Stage1Label: %v", err)
		}
		b, err := mustStream(t, seed, label).Read(blockLen)
		if err != nil {
			t.Fatalf("Read: %v", err)
		}
		h := hex.EncodeToString(b)
		if prev, dup := seen[h]; dup {
			t.Errorf("%s and %s produce identical block_0 — the labels are not separating the streams", label, prev)
		}
		seen[h] = label
	}
	pity, _ := mustStream(t, seed, PityLabel).Read(blockLen)
	if prev, dup := seen[hex.EncodeToString(pity)]; dup {
		t.Errorf("pity stream collides with %s", prev)
	}
}

// A drawn value is always in range and the distribution is not degenerate. This is a sanity net,
// not a statistical test: the vectors carry correctness, this catches "always returns 0".
func TestUniformIntStaysInRangeAndVaries(t *testing.T) {
	seed, _ := DecodeSeed(realSeedHex)
	s := mustStream(t, seed, PityLabel)
	counts := map[uint64]int{}
	const n, draws = 12, 600
	for i := 0; i < draws; i++ {
		v, err := UniformInt(s, n)
		if err != nil {
			t.Fatalf("UniformInt: %v", err)
		}
		if v >= n {
			t.Fatalf("draw %d out of range: %d", i, v)
		}
		counts[v]++
	}
	if len(counts) != n {
		t.Errorf("only %d of %d residues appeared in %d draws", len(counts), n, draws)
	}
	// Rejection sampling must have burned MORE than one byte per draw somewhere across 600 draws
	// of n=12 (limit = 252, so 4/256 of bytes reject).
	if s.Consumed() <= draws {
		t.Errorf("consumed %d bytes over %d draws of n=12 — no rejection ever occurred, which is implausible", s.Consumed(), draws)
	}
}

// NewStream validates its label since the 6.3 code review. The producer previously accepted an
// empty label the TS verifier refuses, and accepted arbitrary bytes the browser's TextEncoder
// would rewrite — either one draws a ceremony nobody can verify.
func TestNewStreamValidatesLabel(t *testing.T) {
	seed, _ := DecodeSeed(realSeedHex)

	bad := []struct{ name, label string }{
		{"empty", ""},
		{"lone surrogate (WTF-8)", "\xed\xa0\x80"},
		{"bare continuation byte", "\x80"},
		{"truncated multi-byte sequence", "spin/\xc3"},
	}
	for _, tc := range bad {
		t.Run(tc.name, func(t *testing.T) {
			if s, err := NewStream(seed, tc.label); err == nil {
				t.Errorf("NewStream(%q) = %v, want an error", tc.label, s)
			}
		})
	}

	// …and every label the ceremony actually uses is accepted.
	for spin := 1; spin <= 12; spin++ {
		label, err := Stage1Label(spin)
		if err != nil {
			t.Fatalf("Stage1Label(%d): %v", spin, err)
		}
		if _, err := NewStream(seed, label); err != nil {
			t.Errorf("NewStream(%q): %v", label, err)
		}
	}
	if _, err := NewStream(seed, PityLabel); err != nil {
		t.Errorf("NewStream(PityLabel): %v", err)
	}
}

// Read is exported, so an unbounded k is a multi-gigabyte allocation followed by billions of
// HMACs — a hang, where every other programmer error in this package is a loud refusal.
func TestReadIsBounded(t *testing.T) {
	seed, _ := DecodeSeed(realSeedHex)
	s := mustStream(t, seed, PityLabel)

	if _, err := s.Read(MaxReadBytes + 1); err == nil {
		t.Errorf("Read(%d) returned no error, want a bound violation", MaxReadBytes+1)
	}
	if _, err := s.Read(-1); err == nil {
		t.Error("Read(-1) returned no error")
	}
	if s.Consumed() != 0 {
		t.Errorf("a refused Read consumed %d bytes, want 0", s.Consumed())
	}
	// The bound itself is inclusive and works.
	if _, err := s.Read(MaxReadBytes); err != nil {
		t.Errorf("Read(MaxReadBytes): %v", err)
	}
	if s.Consumed() != MaxReadBytes {
		t.Errorf("Consumed() = %d, want %d", s.Consumed(), MaxReadBytes)
	}
}

// ── pinning: the bans are tested, because an absent import reddens nothing when deleted ───────

// productionSources returns each non-test .go file in the package as source text with ALL
// COMMENTS STRIPPED, plus its import paths.
//
// The stripping matters: this file's own first attempt failed because labels.go's doc comment
// says "No float64" — a substring scan over raw text flags the documentation that explains the
// ban. Parsing and re-printing without comments makes the scan mean "this construct is in the
// CODE", which is the rule actually being pinned.
func productionSources(t *testing.T) map[string]struct {
	code    string
	imports []string
} {
	t.Helper()
	out := map[string]struct {
		code    string
		imports []string
	}{}

	entries, err := os.ReadDir(".")
	if err != nil {
		t.Fatalf("read package dir: %v", err)
	}
	for _, e := range entries {
		name := e.Name()
		if e.IsDir() || !strings.HasSuffix(name, ".go") || strings.HasSuffix(name, "_test.go") {
			continue
		}
		fset := token.NewFileSet()
		file, err := parser.ParseFile(fset, name, nil, 0 /* comments discarded */)
		if err != nil {
			t.Fatalf("parse %s: %v", name, err)
		}
		var buf bytes.Buffer
		if err := printer.Fprint(&buf, fset, file); err != nil {
			t.Fatalf("print %s: %v", name, err)
		}
		var imports []string
		for _, imp := range file.Imports {
			path, err := strconv.Unquote(imp.Path.Value)
			if err != nil {
				t.Fatalf("unquote import in %s: %v", name, err)
			}
			imports = append(imports, path)
		}
		out[name] = struct {
			code    string
			imports []string
		}{buf.String(), imports}
	}
	if len(out) == 0 {
		t.Fatal("scanned no source files — the pinning test is vacuous")
	}
	return out
}

// The exact set of shipped files this package scans.
//
// Asserted as an EXACT EQUALITY, mirroring lib/roulette's module list: every non-test .go file
// here is production code bound by the bans below, so a new one added without thinking about
// them should fail loudly rather than slip in unscanned. Story 6-4a added stage2.go, and the
// per-file ban exemption below is only meaningful if the file set itself is pinned.
func TestScannedSourceFilesAreExactlyTheShippedModules(t *testing.T) {
	var got []string
	for name := range productionSources(t) {
		got = append(got, name)
	}
	sort.Strings(got)
	want := []string{"labels.go", "prng.go", "stage2.go"}
	if strings.Join(got, ",") != strings.Join(want, ",") {
		t.Errorf("scanned %v, want %v", got, want)
	}
}

func TestPackageSourceHasNoBannedConstructs(t *testing.T) {
	// AC3 — integer-only, locale-free, no language-specific RNG. Each of these would compile
	// fine and quietly make the Go producer irreproducible in a browser, and an import that
	// merely *should* be absent reddens nothing when someone deletes it — hence this test.
	//
	// `exceptIn` scopes a ban to everything BUT the named files. It is an exception list rather
	// than an allowlist on purpose: a file added later is banned by default.
	bannedImports := []struct {
		path     string
		why      string
		exceptIn []string
	}{
		{path: "math/rand", why: "language-specific RNG: the stream must come from HMAC only"},
		{path: "math/rand/v2", why: "language-specific RNG: the stream must come from HMAC only"},
		{path: "time", why: "no clock in the draw path — a ceremony must replay identically forever"},
		{path: "crypto/rand", why: "OS entropy is the BRACKET seed's business (AD-13), never the roulette's"},
		{path: "os", why: "the primitives take the seed as an argument; no ambient configuration"},
		// ⭐ SCOPED BY STORY 6-4a, not relaxed. In the PRNG files the bound n <= 2^32 keeps 256^k
		// inside a uint64 by construction, so reaching for math/big there would mean the bound had
		// been abandoned. Stage 2 has no such bound: its operands are snapshot magnitudes and its
		// cross-products are their PRODUCT, so unbounded arithmetic is the requirement (S4) rather
		// than a symptom — and it is what the TypeScript verifier gets from BigInt. Widening the
		// exception to another file needs the same argument made again.
		{
			path:     "math/big",
			why:      "the bound n <= 2^32 exists precisely so uint64 suffices",
			exceptIn: []string{"stage2.go"},
		},
	}
	bannedCode := []struct{ needle, why string }{
		{"float64", "SPEC Constraint 7: integer-only arithmetic"},
		{"float32", "SPEC Constraint 7: integer-only arithmetic"},
		{"strings.Title", "locale-dependent formatting"},
		{"golang.org/x/text", "locale/collation dependency"},
		// ⭐ labels.go's own doc comment justifies strconv.Itoa "precisely because it cannot be
		// given a width/flag by a later edit" — but nothing pinned that until the 6.3 code review.
		// fmt.Sprintf("%02d", spin) yields ".../spin/01": a DIFFERENT stream that still looks
		// correct. fmt is legitimately imported for errors, so the ban is on the formatting verb.
		{"fmt.Sprintf", "a width/flag verb silently pads the spin — use strconv.Itoa in the label path"},
		{"fmt.Sprint", "number formatting in the draw path must be strconv, not fmt"},
		// ⭐ Added by 6-4a alongside the math/big exception. Importing math/big and then leaving
		// its range is the same defect as never importing it: each of these silently narrows an
		// unbounded value back to a machine word or a float, and the result is a PLAUSIBLE winner.
		{"big.Float", "an arbitrary-precision FLOAT is still a float — SPEC Constraint 7"},
		{".Int64()", "silently truncates a big.Int past 2^63 — the exact wrap S4 exists to prevent"},
		{".Uint64()", "silently truncates a big.Int past 2^64"},
		{".Float64()", "converts an exact integer into a rounded float"},
	}

	for name, src := range productionSources(t) {
		for _, imp := range src.imports {
			for _, b := range bannedImports {
				if imp != b.path {
					continue
				}
				exempt := false
				for _, f := range b.exceptIn {
					if f == name {
						exempt = true
					}
				}
				if !exempt {
					t.Errorf("%s imports banned %q — %s", name, b.path, b.why)
				}
			}
		}
		for _, b := range bannedCode {
			if strings.Contains(src.code, b.needle) {
				t.Errorf("%s uses banned %q in code — %s", name, b.needle, b.why)
			}
		}
	}
}

// worker/awards is a LEAF (story scope boundary): the producer wiring that reads the AD-19
// snapshot and writes results is 6.4+. Checked over the parsed IMPORT LIST, not the file text —
// this test file necessarily mentions the forbidden paths as data.
func TestPackageIsALeaf(t *testing.T) {
	forbidden := []string{
		"cs-tournament/worker/ingest",
		"cs-tournament/worker/store",
		"cs-tournament/worker/db",
		"cs-tournament/worker/config",
	}
	for name, src := range productionSources(t) {
		for _, imp := range src.imports {
			for _, f := range forbidden {
				if imp == f {
					t.Errorf("%s imports %s — worker/awards must stay a leaf until the 6.4 producer wiring", name, f)
				}
			}
		}
	}
}

// The real frozen tournament.fair_seed (Story 6.2), byte-identical to demo.demo_sha256 of
// ziivanto-sosa.dem. Used so the Go suite exercises the primitives over the SAME seed the
// ceremony will actually run on — not a synthetic one.
const realSeedHex = "1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c"
