package main

import "testing"

func TestParseIngestArgs(t *testing.T) {
	// Path first, flag after — the documented form that Go's flag package alone cannot parse.
	if p, id, err := parseIngestArgs([]string{"./cache.dem", "--match", "5"}); err != nil || p != "./cache.dem" || id != 5 {
		t.Fatalf("path-first: got (%q, %d, %v)", p, id, err)
	}
	// Flag first.
	if p, id, err := parseIngestArgs([]string{"--match", "7", "./x.dem"}); err != nil || p != "./x.dem" || id != 7 {
		t.Fatalf("flag-first: got (%q, %d, %v)", p, id, err)
	}
	// --match=N form.
	if p, id, err := parseIngestArgs([]string{"--match=9", "./y.dem"}); err != nil || p != "./y.dem" || id != 9 {
		t.Fatalf("eq-form: got (%q, %d, %v)", p, id, err)
	}
	// Missing path.
	if _, _, err := parseIngestArgs([]string{"--match", "5"}); err == nil {
		t.Fatal("expected a missing-path error")
	}
	// Missing --match value.
	if _, _, err := parseIngestArgs([]string{"./a.dem", "--match"}); err == nil {
		t.Fatal("expected a missing --match value error")
	}
	// Non-numeric --match.
	if _, _, err := parseIngestArgs([]string{"./a.dem", "--match", "abc"}); err == nil {
		t.Fatal("expected a non-numeric --match error")
	}
}

func TestParseReparseArgs(t *testing.T) {
	// --match <id> and --match=<id> forms both parse; no path is accepted (the retained object is looked up).
	if id, err := parseReparseArgs([]string{"--match", "5"}); err != nil || id != 5 {
		t.Fatalf("space form: got (%d, %v)", id, err)
	}
	if id, err := parseReparseArgs([]string{"--match=9"}); err != nil || id != 9 {
		t.Fatalf("eq form: got (%d, %v)", id, err)
	}
	// Missing --match.
	if _, err := parseReparseArgs([]string{}); err == nil {
		t.Fatal("expected a missing --match error")
	}
	// Zero / non-positive --match.
	if _, err := parseReparseArgs([]string{"--match", "0"}); err == nil {
		t.Fatal("expected a non-positive --match error")
	}
	// A stray path is rejected (reparse takes no path).
	if _, err := parseReparseArgs([]string{"--match", "5", "./x.dem"}); err == nil {
		t.Fatal("expected an unexpected-argument error for a stray path")
	}
	// Non-numeric --match.
	if _, err := parseReparseArgs([]string{"--match", "abc"}); err == nil {
		t.Fatal("expected a non-numeric --match error")
	}
}
