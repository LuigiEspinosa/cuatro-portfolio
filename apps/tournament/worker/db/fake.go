package db

import (
	"context"
	"sync"
)

// FakeRecorder captures RecordDemo calls for unit tests (no real DB). Set Err to force a failure and
// exercise the fail-closed paths.
type FakeRecorder struct {
	mu   sync.Mutex
	Rows []DemoRow
	Err  error
}

var _ DemoRecorder = (*FakeRecorder)(nil)

// NewFakeRecorder returns an empty capturing recorder.
func NewFakeRecorder() *FakeRecorder { return &FakeRecorder{} }

// RecordDemo captures the row (or returns the configured Err).
func (f *FakeRecorder) RecordDemo(_ context.Context, row DemoRow) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.Err != nil {
		return f.Err
	}
	f.Rows = append(f.Rows, row)
	return nil
}

// Recorded returns a snapshot copy of the captured rows.
func (f *FakeRecorder) Recorded() []DemoRow {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]DemoRow, len(f.Rows))
	copy(out, f.Rows)
	return out
}
