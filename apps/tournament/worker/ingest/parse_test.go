package ingest

import (
	"bytes"
	"errors"
	"strings"
	"testing"
)

// TestFakeParserEchoesResultAndErr proves the test seam: the canned Result is returned verbatim, and the
// Err seam wins (fail-closed) so the wiring tests can force a parse failure.
func TestFakeParserEchoesResultAndErr(t *testing.T) {
	want := ParseResult{RoundsPlayed: 24, Players: []PlayerStat{{SteamID64: 76561197960287930, Kills: 20, Deaths: 14, RoundsWon: 16}}}
	got, err := FakeParser{Result: want}.Parse(strings.NewReader("ignored stream"))
	if err != nil {
		t.Fatal(err)
	}
	if got.RoundsPlayed != 24 || len(got.Players) != 1 || got.Players[0] != want.Players[0] {
		t.Fatalf("FakeParser did not echo its canned result: %+v", got)
	}
	if _, err := (FakeParser{Result: want, Err: errors.New("boom")}).Parse(strings.NewReader("x")); err == nil {
		t.Fatal("FakeParser.Err must be returned (the fail-closed seam)")
	}
}

// TestDemoinfocsParserRejectsCorruptStream drives the REAL parser on a stream that carries the Source-2
// magic but then garbage: it must fail CLEANLY (return a wrapped error, not panic), so a corrupt or
// truncated retained object surfaces as a fail-closed error rather than crashing the worker. The real
// parser's happy-path correctness on a genuine .dem is the live-QA gate (Task 7) — this only proves the
// production impl is not shipped entirely unexercised.
func TestDemoinfocsParserRejectsCorruptStream(t *testing.T) {
	_, err := DemoinfocsParser{}.Parse(bytes.NewReader([]byte("PBDEMS2\x00 not actually a valid demo body — truncated garbage")))
	if err == nil {
		t.Fatal("expected a parse error on a corrupt/truncated demo stream")
	}
}
