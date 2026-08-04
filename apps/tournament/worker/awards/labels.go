// Package awards is the roulette PRODUCER side of the Provably-Fair draw engine (Story 6.3,
// FR-25 / AD-14). It holds the deterministic, integer-only PRNG primitives the ceremony draws
// from: domain-separated labels, the HMAC-SHA256 counter-mode block stream, and the unbiased
// uniform_int.
//
// THE SEAM (ARCHITECTURE-SPINE.md:73-76). There is NO dependency edge between worker/* and
// app/+lib/. This package is the producer; lib/roulette is the browser VERIFIER. They conform to
// `roulette/vectors/` INDEPENDENTLY — never to each other. Neither is the reference
// implementation and NEITHER MAY BE CORRECTED BY READING THE OTHER'S SOURCE: when they disagree
// the vector decides, and when the vector is silent, add a vector first.
//
// This package is a LEAF: it imports nothing from worker/ingest, worker/store or worker/db. The
// producer wiring that reads the AD-19 snapshot and writes results is Story 6.4+; 6.3 ships the
// primitive and its tests only.
//
// INTEGER-ONLY (SPEC Constraint 7). No float64, no math/rand, no time, no locale-aware
// formatting anywhere in the draw path. The whole point is that a browser can reproduce every
// byte; anything that varies by platform, clock or locale breaks that.
package awards

import (
	"fmt"
	"strconv"
)

// The domain separators. Each label is an INDEPENDENT stream that starts at counter i = 0, so a
// Stage-1 spin can never consume bytes that a later pity draw expects (and vice versa).
//
// AD-14 / SOLUTION-DESIGN §9.1 fix these strings exactly:
//
//	"inclusivcup/v1/stage1/spin/<S>"   S = 1,2,3,…  1-based decimal, NO padding
//	"inclusivcup/v1/pity"
//
// The "v1" is the algorithm version and is part of the domain separation: bumping it is a
// deliberate, ceremony-invalidating act, not a refactor.
const (
	// labelPrefix is the versioned namespace shared by every stream.
	labelPrefix = "inclusivcup/v1"

	// PityLabel is the single pity stream. Story 6.3 defines the LABEL only; the pity
	// ALGORITHM (FR-26's pity roulette) is Story 6.7's.
	PityLabel = labelPrefix + "/pity"
)

// Stage1Label returns the domain separator for Stage-1 spin S.
//
// spin is 1-BASED (spin 1 is the first award drawn) and is formatted as plain decimal with no
// zero padding: spin 1 -> ".../spin/1", spin 12 -> ".../spin/12". strconv.Itoa is used rather
// than fmt.Sprintf precisely because it cannot be given a width/flag by a later edit and is not
// locale-aware — a padded ".../spin/01" is a DIFFERENT stream that would still look correct.
//
// A non-positive spin is a programmer error (there is no spin 0 and no negative spin), so it
// returns an error rather than producing a label that would silently key a valid-looking stream.
func Stage1Label(spin int) (string, error) {
	if spin < 1 {
		return "", fmt.Errorf("awards: stage1 spin must be >= 1 (1-based), got %d", spin)
	}
	return labelPrefix + "/stage1/spin/" + strconv.Itoa(spin), nil
}
