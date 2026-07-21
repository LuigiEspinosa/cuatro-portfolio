package db

import "testing"

// TestClutchesJSON pins the FR-20 jsonb rendering (Story 5.3 AC3). The nil case is THE MONEY TEST: a nil
// map marshaled directly yields the literal `null`, which would force Story 5.5's leaderboard view to carry
// a NULL branch around every `clutches->>'1'` read. clutchesJSON's make() is what turns that into the empty
// object `{}` — replace it with `var out map[string]int` and this test is the one that reddens.
//
// ⚠ What no Go test here can reach: the SQL-level distinction between a column written `{}` and one left
// SQL NULL. That is decided by `clutches` sitting unconditionally in upsertStatRows' INSERT list (verified
// by reading that statement + live QA), not by this test.
func TestClutchesJSON(t *testing.T) {
	cases := []struct {
		name string
		in   map[int]int
		want string
	}{
		{"nil map renders the EMPTY OBJECT, never null", nil, `{}`},
		{"empty map renders the empty object", map[int]int{}, `{}`},
		{"a single 1v1 clutch", map[int]int{1: 1}, `{"1":1}`},
		// Keys are STRINGS (jsonb object keys always are) and marshal in sorted order, so the stored text is
		// deterministic across runs — a re-parse of unchanged data rewrites byte-identical jsonb.
		{"several X values, string keys, deterministic order", map[int]int{3: 1, 1: 2}, `{"1":2,"3":1}`},
		// A zero/negative count is the ABSENCE of a clutch. Publishing "1":0 would read in the 5.5 view as a
		// present-but-zero award rather than no award, so those entries are skipped entirely.
		{"a zero count is omitted", map[int]int{1: 0, 2: 3}, `{"2":3}`},
		{"a negative count is omitted", map[int]int{1: -1}, `{}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := clutchesJSON(tc.in)
			if err != nil {
				t.Fatal(err)
			}
			if got != tc.want {
				t.Fatalf("clutchesJSON(%v): got %s want %s", tc.in, got, tc.want)
			}
		})
	}
}
