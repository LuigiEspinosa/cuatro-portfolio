package awards

import (
	"strings"
	"testing"
)

func TestStage1Label(t *testing.T) {
	cases := []struct {
		name string
		spin int
		want string
		err  bool
	}{
		{name: "first spin", spin: 1, want: "inclusivcup/v1/stage1/spin/1"},
		{name: "single digit", spin: 9, want: "inclusivcup/v1/stage1/spin/9"},
		// The 10/12 cases pin "decimal, NO padding": a zero-padded ".../spin/09" would look
		// perfectly reasonable and key a completely different stream.
		{name: "two digits", spin: 10, want: "inclusivcup/v1/stage1/spin/10"},
		{name: "last award of the catalog", spin: 12, want: "inclusivcup/v1/stage1/spin/12"},
		{name: "three digits", spin: 100, want: "inclusivcup/v1/stage1/spin/100"},
		// 1-BASED: there is no spin 0. A 0-based off-by-one is silent — every spin draws a
		// valid-looking but wrong stream — so it is an error, not a label.
		{name: "zero rejected (1-based)", spin: 0, err: true},
		{name: "negative rejected", spin: -1, err: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := Stage1Label(tc.spin)
			if tc.err {
				if err == nil {
					t.Errorf("Stage1Label(%d) = %q, want error", tc.spin, got)
				}
				return
			}
			if err != nil {
				t.Errorf("Stage1Label(%d) unexpected error: %v", tc.spin, err)
				return
			}
			if got != tc.want {
				t.Errorf("Stage1Label(%d) = %q, want %q", tc.spin, got, tc.want)
			}
		})
	}
}

func TestPityLabel(t *testing.T) {
	if PityLabel != "inclusivcup/v1/pity" {
		t.Errorf("PityLabel = %q, want %q", PityLabel, "inclusivcup/v1/pity")
	}
}

// Every label carries the versioned namespace. Bumping "v1" invalidates every ceremony, so it is
// pinned here rather than left to be silently edited during a refactor.
func TestLabelsShareVersionedPrefix(t *testing.T) {
	spin, err := Stage1Label(1)
	if err != nil {
		t.Fatalf("Stage1Label(1): %v", err)
	}
	for _, l := range []string{spin, PityLabel} {
		if !strings.HasPrefix(l, "inclusivcup/v1/") {
			t.Errorf("label %q does not carry the inclusivcup/v1/ namespace", l)
		}
	}
}

// The two label families must be prefix-disjoint: if one were a prefix of the other, two distinct
// decisions could otherwise be argued into sharing a stream.
func TestStreamsAreDistinct(t *testing.T) {
	seen := map[string]string{}
	for spin := 1; spin <= 12; spin++ {
		l, err := Stage1Label(spin)
		if err != nil {
			t.Fatalf("Stage1Label(%d): %v", spin, err)
		}
		if prev, dup := seen[l]; dup {
			t.Errorf("label collision: spin %d and %s both produce %q", spin, prev, l)
		}
		seen[l] = "spin"
		if l == PityLabel {
			t.Errorf("stage1 label %q collides with PityLabel", l)
		}
	}
}
