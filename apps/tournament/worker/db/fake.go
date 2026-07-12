package db

import (
	"context"
	"fmt"
	"sync"
)

// FakeRecorder captures RecordDemo calls for unit tests (no real DB). It mirrors the DB's AD-3 dedup
// in-memory: a repeat (MatchID, SHA256) short-circuits to the first row's key + id (Inserted=false) so
// tests exercise the AlreadyIngested path without a DB. A NULL/empty SHA256 never dedups (NULLs are
// distinct in the UNIQUE — the manual path). Every insert is assigned a monotonically increasing fake
// DemoID (from 1) so a fresh acquire yields a non-zero provenance id for stat_row.demo_id. Set Err to
// force a failure and exercise the fail-closed paths.
type FakeRecorder struct {
	mu     sync.Mutex
	Rows   []DemoRow
	Err    error
	seen   map[string]recordedDemo // "matchID\x00sha256" -> the first row's key + id
	nextID int64
}

// recordedDemo remembers a deduped demo's key + id so a repeat (MatchID, SHA256) returns the FIRST row's
// provenance (both storage_key and the demo id).
type recordedDemo struct {
	key string
	id  int64
}

var _ DemoRecorder = (*FakeRecorder)(nil)

// NewFakeRecorder returns an empty capturing recorder.
func NewFakeRecorder() *FakeRecorder { return &FakeRecorder{} }

// RecordDemo captures the row and mirrors the dedup (or returns the configured Err). A repeat
// (MatchID, SHA256) with a non-empty SHA256 returns Inserted=false + the first row's key + id and
// captures nothing new; otherwise it assigns a fresh DemoID, captures the row, and returns Inserted=true.
func (f *FakeRecorder) RecordDemo(_ context.Context, row DemoRow) (RecordOutcome, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.Err != nil {
		return RecordOutcome{}, f.Err
	}
	if row.SHA256 != "" {
		k := fmt.Sprintf("%d\x00%s", row.MatchID, row.SHA256)
		if existing, ok := f.seen[k]; ok {
			return RecordOutcome{Inserted: false, ExistingKey: existing.key, DemoID: existing.id}, nil
		}
		if f.seen == nil {
			f.seen = make(map[string]recordedDemo)
		}
		f.nextID++
		f.seen[k] = recordedDemo{key: row.StorageKey, id: f.nextID}
		f.Rows = append(f.Rows, row)
		return RecordOutcome{Inserted: true, ExistingKey: row.StorageKey, DemoID: f.nextID}, nil
	}
	// NULL/empty sha256 (the un-hashed manual path): never dedups, still gets a fresh id.
	f.nextID++
	f.Rows = append(f.Rows, row)
	return RecordOutcome{Inserted: true, ExistingKey: row.StorageKey, DemoID: f.nextID}, nil
}

// Recorded returns a snapshot copy of the captured rows.
func (f *FakeRecorder) Recorded() []DemoRow {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]DemoRow, len(f.Rows))
	copy(out, f.Rows)
	return out
}

// FakeStatRecorder captures RecordParse calls for unit tests (no real DB). Besides recording each call
// (the demoID, parserVersion, and rows), it keeps an in-memory upsert MIRROR keyed on (MatchID,
// SteamID64) so a repeat pair REPLACES rather than appends — tests assert idempotency against Upserted()
// exactly as the DB's ON CONFLICT (match_id, steamid64) DO UPDATE behaves. Set Err to exercise the
// fail-closed paths.
type FakeStatRecorder struct {
	mu    sync.Mutex
	calls []RecordParseCall
	rows  map[string]StatRow // "matchID\x00steamid64" -> latest upserted row
	Err   error
}

// RecordParseCall is one captured RecordParse invocation (incl. the Story-3.4 validation outcome, so
// cli_test can assert the flag + reasons the worker persisted).
type RecordParseCall struct {
	DemoID        int64
	ParserVersion string
	Rows          []StatRow
	Val           ValidationOutcome
}

var _ StatRecorder = (*FakeStatRecorder)(nil)

// NewFakeStatRecorder returns an empty capturing stat recorder.
func NewFakeStatRecorder() *FakeStatRecorder { return &FakeStatRecorder{} }

// RecordParse captures the call (incl. the validation outcome) and applies each row to the in-memory
// upsert mirror (or returns Err).
func (f *FakeStatRecorder) RecordParse(_ context.Context, demoID int64, parserVersion string, rows []StatRow, val ValidationOutcome) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.Err != nil {
		return f.Err
	}
	captured := make([]StatRow, len(rows))
	copy(captured, rows)
	f.calls = append(f.calls, RecordParseCall{DemoID: demoID, ParserVersion: parserVersion, Rows: captured, Val: val})
	if f.rows == nil {
		f.rows = make(map[string]StatRow)
	}
	for _, row := range rows {
		f.rows[fmt.Sprintf("%d\x00%s", row.MatchID, row.SteamID64)] = row // upsert: a repeat pair replaces
	}
	return nil
}

// Calls returns a snapshot copy of the captured RecordParse invocations.
func (f *FakeStatRecorder) Calls() []RecordParseCall {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]RecordParseCall, len(f.calls))
	copy(out, f.calls)
	return out
}

// Upserted returns the in-memory upsert mirror — one row per distinct (MatchID, SteamID64), latest wins.
func (f *FakeStatRecorder) Upserted() []StatRow {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]StatRow, 0, len(f.rows))
	for _, r := range f.rows {
		out = append(out, r)
	}
	return out
}

// FakeRosterReader is a RosterReader for unit tests (no real DB): it returns a settable active-id set, or
// the configured Err to exercise the fail-closed roster-read path (RunCLI must not record a parse it could
// not validate). Mirrors the FakeStore/FakeStatRecorder in-package seams.
type FakeRosterReader struct {
	IDs map[string]struct{}
	Err error
}

var _ RosterReader = (*FakeRosterReader)(nil)

// NewFakeRosterReader builds a fake seeded with the given active steamid64s.
func NewFakeRosterReader(ids ...string) *FakeRosterReader {
	set := make(map[string]struct{}, len(ids))
	for _, id := range ids {
		set[id] = struct{}{}
	}
	return &FakeRosterReader{IDs: set}
}

// ActiveSteamIDs returns the configured Err, or a COPY of the seeded set (so a caller mutating the result
// cannot corrupt the fake's state).
func (f *FakeRosterReader) ActiveSteamIDs(context.Context) (map[string]struct{}, error) {
	if f.Err != nil {
		return nil, f.Err
	}
	out := make(map[string]struct{}, len(f.IDs))
	for id := range f.IDs {
		out[id] = struct{}{}
	}
	return out, nil
}
