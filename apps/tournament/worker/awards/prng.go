package awards

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"unicode/utf8"
)

// The deterministic, integer-only PRNG (FR-25 / AD-14 / SOLUTION-DESIGN §9.1).
//
//	seed        = 32 raw bytes            # hex-decoded from seed_hex (lowercase, 64 chars)
//	block(i, L) = HMAC_SHA256(key = seed, msg = utf8(L) || LE64(i))     # 32 bytes, i from 0
//	stream(L)   = block(0,L) || block(1,L) || block(2,L) || …           # consumed left-to-right
//
//	uniform_int(stream, n):
//	    k     = minimal integer with 256^k >= n        # n=1 -> k=0  (E1)
//	    limit = 256^k - (256^k mod n)
//	    loop:
//	        x = big-endian integer from the next k bytes of stream     # bytes are CONSUMED
//	        if x >= limit: continue                                    # rejected bytes are GONE
//	        return x mod n
//
// Every value here is checked against `roulette/vectors/*.json` by prng_test.go. Do not "fix"
// anything in this file by reading lib/roulette/prng.ts — fix the vector first (see the package
// doc comment in labels.go).

// SeedLen is the raw key length: the HMAC key is the 32 DECODED bytes, never the 64-char hex
// string. Keying with the hex text produces a perfectly valid-looking, completely different
// stream, which is exactly the failure class E4 and the golden vectors exist to catch.
const SeedLen = 32

// blockLen is the HMAC-SHA256 output width, and therefore the stride at which the counter
// advances: byte 31 is the last byte of block i, byte 32 the first byte of block i+1.
const blockLen = sha256.Size

// MaxN is the inclusive upper bound on uniform_int's n (E2 / DECISION C). Nothing in the engine
// approaches it — the largest real n is a Stage-1 total weight (≤ 12 awards × weight 100 = 1200)
// or a candidate count (≤ 16 players). The bound is what keeps k ≤ 4, so 256^k always fits a
// uint64 and the whole 256^8 = 2^64 overflow class simply cannot arise. It changes no reachable
// outcome; it converts an unreachable overflow into a loud error.
const MaxN = uint64(1) << 32

// DecodeSeed decodes a 64-character LOWERCASE hex seed into the raw 32-byte HMAC key (E4).
//
// The accepted shape is exactly `^[0-9a-f]{64}$` — the same shape the tournament_fair_seed_hex
// CHECK enforces at the database (migration 0024). Uppercase hex, a "0x" prefix, surrounding
// whitespace, or any other length is an ERROR, not a best-effort decode: a 31-byte key silently
// produces a valid-looking, completely different stream, and there is no later symptom.
func DecodeSeed(seedHex string) ([SeedLen]byte, error) {
	var out [SeedLen]byte
	if len(seedHex) != 2*SeedLen {
		return out, fmt.Errorf("awards: seed_hex must be exactly %d chars, got %d", 2*SeedLen, len(seedHex))
	}
	for i := 0; i < len(seedHex); i++ {
		c := seedHex[i]
		if (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') {
			continue
		}
		return out, fmt.Errorf("awards: seed_hex must be lowercase hex [0-9a-f], got %q at index %d", c, i)
	}
	raw, err := hex.DecodeString(seedHex)
	if err != nil {
		return out, fmt.Errorf("awards: seed_hex decode: %w", err)
	}
	copy(out[:], raw)
	return out, nil
}

// Stream is one domain-separated byte stream: the concatenation block_0 || block_1 || … for a
// single label, consumed left-to-right. It is NOT safe for concurrent use — each decision owns
// its own stream, which is the point of the per-decision labels.
type Stream struct {
	seed  [SeedLen]byte
	label string

	// pos is the cumulative byte position — the stream's entire state. Everything else is cache.
	pos uint64

	// One materialized block, kept so a 32-byte block is not re-HMAC'd once per byte.
	cached    [blockLen]byte
	cachedIdx uint64
	hasCached bool
}

// MaxReadBytes caps a single Read. Nothing in the engine reads more than 4 bytes at a time
// (k <= 4 by MaxN), so this is far above any real call — it exists because Read is exported and
// an unbounded k is a 2 GB allocation followed by billions of HMACs, i.e. a hang rather than the
// loud refusal every other programmer error in this package gets.
const MaxReadBytes = 4096

// NewStream opens the stream for `label`. The counter starts at 0 and nothing is computed until
// the first Read — each label is independent and every one of them starts at block 0.
//
// `label` must be a non-empty, well-formed UTF-8 string. Both checks exist because the verifier
// enforces them and a producer that accepts what the verifier refuses can draw a whole ceremony
// nobody can check:
//
//   - EMPTY: lib/roulette's createStream throws on "". Before the 6.3 code review this function
//     validated nothing, so an unchecked map lookup in 6.4 could have keyed a real ceremony on
//     the empty label — a stream the browser verifier cannot even open.
//   - NOT WELL-FORMED UTF-8: the spec says msg = utf8(label) || LE64(i). Go strings may hold
//     arbitrary bytes and would HMAC them verbatim, while the browser's TextEncoder rewrites a
//     lone surrogate to EF BF BD. Measured at review: the same label produced 9e671492… in Go and
//     d61f6c62… in the browser, with no error on either side.
func NewStream(seed [SeedLen]byte, label string) (*Stream, error) {
	if label == "" {
		return nil, fmt.Errorf("awards: label must be a non-empty string")
	}
	if !utf8.ValidString(label) {
		return nil, fmt.Errorf("awards: label must be well-formed UTF-8, got %q", label)
	}
	return &Stream{seed: seed, label: label}, nil
}

// Consumed returns the cumulative byte position.
//
// ⭐ This exists so "the two runtimes consume identical bytes" is TESTABLE. AC2 cannot be
// asserted at all without it, and neither can a rejection be observed from outside: a rejection
// is visible only as Consumed() advancing by more than k. It is not decorative — do not remove it
// because "nothing in the engine reads it".
func (s *Stream) Consumed() uint64 { return s.pos }

// Label returns the domain separator this stream was opened with (diagnostics only).
func (s *Stream) Label() string { return s.label }

// block returns block_i, materializing it on demand.
//
//	block_i = HMAC_SHA256(key = seed, msg = utf8(label) || LE64(i))
//
// LE64 is an 8-byte LITTLE-endian counter and is the ONLY little-endian construct in the whole
// engine — uniform_int's byte assembly below is big-endian. Getting this one backwards produces
// a stream that is wrong from block 1 onward while block 0 (counter 0, all zero bytes either
// way) still matches, which is why the vectors carry an i = 1 case for every label.
func (s *Stream) block(i uint64) [blockLen]byte {
	if s.hasCached && s.cachedIdx == i {
		return s.cached
	}
	var counter [8]byte
	binary.LittleEndian.PutUint64(counter[:], i)

	mac := hmac.New(sha256.New, s.seed[:])
	mac.Write([]byte(s.label))
	mac.Write(counter[:])

	var out [blockLen]byte
	copy(out[:], mac.Sum(nil))

	s.cached, s.cachedIdx, s.hasCached = out, i, true
	return out
}

// Read consumes and returns the next k bytes of the stream.
//
// E3 — the stream is a BYTE stream over the block concatenation, so a read STRADDLES block
// boundaries: a 2-byte read beginning at byte 31 takes byte 31 of block 0 and byte 0 of block 1.
// Consumed bytes are never put back, including the bytes of a rejected uniform_int draw.
//
// k = 0 is legal and consumes nothing — that is E1's path (see UniformInt).
func (s *Stream) Read(k int) ([]byte, error) {
	if k < 0 {
		return nil, fmt.Errorf("awards: Read(k) requires k >= 0, got %d", k)
	}
	if k > MaxReadBytes {
		return nil, fmt.Errorf("awards: Read(k) requires k <= %d, got %d", MaxReadBytes, k)
	}
	out := make([]byte, k)
	for j := 0; j < k; j++ {
		b := s.block(s.pos / blockLen)
		out[j] = b[s.pos%blockLen]
		s.pos++
	}
	return out, nil
}

// minimalK returns the smallest k with 256^k >= n, together with 256^k.
//
// E1 — for n = 1 this is k = 0: 256^0 = 1 >= 1, so a one-candidate draw reads NOTHING and
// returns 0. An implementation that instead loops from k = 1 returns the same ANSWER (0) and a
// different STREAM POSITION, so every subsequent draw in that ceremony differs. It is the
// highest-value divergence in the whole engine precisely because it is invisible in the result.
// Pinned by the `e1-n1-consumes-zero-bytes` vector case.
//
// n is bounded by MaxN (E2), so k <= 4 and 256^k <= 2^32 always fits the uint64 return.
func minimalK(n uint64) (k int, space uint64) {
	space = 1
	for space < n {
		space <<= 8
		k++
	}
	return k, space
}

// UniformInt draws an unbiased integer in [0, n) from the stream.
//
// The rejection is what makes it unbiased: 256^k is not in general a multiple of n, so the top
// `256^k mod n` values of the k-byte space would over-represent the first residues. Those values
// are rejected — and a rejection CONSUMES its k bytes and draws k FRESH ones. That is the
// property that keeps the Go producer and the JS verifier byte-position-identical after every
// draw: both reject on exactly the same threshold and both burn exactly the same bytes.
//
// E2 — n outside [1, MaxN] is a PROGRAMMER error, not a business refusal and never a silent
// clamp: no user input reaches this function. (Go's uint64 parameter already excludes negatives
// and non-integers at the type level; the JS mirror must check them explicitly.)
func UniformInt(s *Stream, n uint64) (uint64, error) {
	if n < 1 || n > MaxN {
		return 0, fmt.Errorf("awards: uniform_int n must be in [1, %d], got %d", MaxN, n)
	}
	k, space := minimalK(n)
	limit := space - (space % n)

	for {
		buf, err := s.Read(k)
		if err != nil {
			return 0, err
		}
		// Big-endian assembly — the opposite endianness to the LE64 counter above, and the
		// only correct reading of "assembles those k bytes big-endian into x".
		var x uint64
		for _, b := range buf {
			x = x<<8 | uint64(b)
		}
		if x >= limit {
			continue // rejected: the k bytes are GONE, the next iteration reads k fresh ones
		}
		return x % n, nil
	}
}
