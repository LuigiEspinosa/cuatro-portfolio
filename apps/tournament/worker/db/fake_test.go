package db

import (
	"context"
	"errors"
	"testing"
)

func TestFakeRecorderCapturesRows(t *testing.T) {
	rec := NewFakeRecorder()
	row := DemoRow{MatchID: 5, StorageBackend: "r2", StorageKey: "demos/5/a.dem", SizeBytes: 100, Source: "matchzy"}
	if err := rec.RecordDemo(context.Background(), row); err != nil {
		t.Fatal(err)
	}
	got := rec.Recorded()
	if len(got) != 1 || got[0] != row {
		t.Fatalf("unexpected captured rows: %+v", got)
	}
}

func TestFakeRecorderReturnsConfiguredErr(t *testing.T) {
	rec := NewFakeRecorder()
	rec.Err = errors.New("boom")
	if err := rec.RecordDemo(context.Background(), DemoRow{}); err == nil {
		t.Fatal("expected the configured error")
	}
	if len(rec.Recorded()) != 0 {
		t.Fatal("must not capture a row when Err is set")
	}
}
