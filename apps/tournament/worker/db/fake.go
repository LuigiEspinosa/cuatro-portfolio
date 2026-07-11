package db

import (
	"context"
	"fmt"
	"sync"
)

// FakeRecorder captures RecordDemo calls for unit tests (no real DB). It mirrors the DB's AD-3 dedup
// in-memory: a repeat (MatchID, SHA256) short-circuits to the first row's key (Inserted=false) so tests
// exercise the AlreadyIngested path without a DB. A NULL/empty SHA256 never dedups (NULLs are distinct
// in the UNIQUE — the manual path). Set Err to force a failure and exercise the fail-closed paths.
type FakeRecorder struct {
	mu   sync.Mutex
	Rows []DemoRow
	Err  error
	seen map[string]string // "matchID\x00sha256" -> the first row's storage_key
}

var _ DemoRecorder = (*FakeRecorder)(nil)

// NewFakeRecorder returns an empty capturing recorder.
func NewFakeRecorder() *FakeRecorder { return &FakeRecorder{} }

// RecordDemo captures the row and mirrors the dedup (or returns the configured Err). A repeat
// (MatchID, SHA256) with a non-empty SHA256 returns Inserted=false + the first row's key and captures
// nothing new; otherwise it captures the row and returns Inserted=true.
func (f *FakeRecorder) RecordDemo(_ context.Context, row DemoRow) (RecordOutcome, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.Err != nil {
		return RecordOutcome{}, f.Err
	}
	if row.SHA256 != "" {
		k := fmt.Sprintf("%d\x00%s", row.MatchID, row.SHA256)
		if existing, ok := f.seen[k]; ok {
			return RecordOutcome{Inserted: false, ExistingKey: existing}, nil
		}
		if f.seen == nil {
			f.seen = make(map[string]string)
		}
		f.seen[k] = row.StorageKey
	}
	f.Rows = append(f.Rows, row)
	return RecordOutcome{Inserted: true, ExistingKey: row.StorageKey}, nil
}

// Recorded returns a snapshot copy of the captured rows.
func (f *FakeRecorder) Recorded() []DemoRow {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]DemoRow, len(f.Rows))
	copy(out, f.Rows)
	return out
}
