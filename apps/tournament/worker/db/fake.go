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

// FakeStatRecorder captures RecordParse/RecordReparse calls for unit tests (no real DB). Besides recording
// each call, it keeps an in-memory upsert MIRROR keyed on (MatchID, SteamID64) so a repeat pair REPLACES
// rather than appends — tests assert idempotency against Upserted() exactly as the DB's ON CONFLICT
// (match_id, steamid64) DO UPDATE behaves. Each mirror entry also carries a `status` so tests prove the
// AD-7 status-preservation guarantee (a re-parse must NOT flicker an approved row back to pending); a
// per-demo generation counter mirrors the demo.parse_generation bump. Set Err to exercise the fail-closed
// paths.
type FakeStatRecorder struct {
	mu           sync.Mutex
	calls        []RecordParseCall
	reparseCalls []RecordReparseCall
	rows         map[string]mirrorRow // "matchID\x00steamid64" -> latest upserted row + its status
	generations  map[int64]int        // demoID -> number of re-parses (parse_generation bumps)
	Err          error
}

// mirrorRow is one in-memory stat_row: the upserted payload plus the `status` the DB column carries (which
// the worker never writes — it is DB-defaulted 'pending' on insert and PRESERVED across upserts). Tracking
// it here lets orchestration tests prove status preservation without a real DB.
type mirrorRow struct {
	row    StatRow
	status string
}

// RecordParseCall is one captured RecordParse invocation (incl. the Story-3.4 validation outcome, so
// cli_test can assert the flag + reasons the worker persisted).
type RecordParseCall struct {
	DemoID        int64
	ParserVersion string
	Rows          []StatRow
	Val           ValidationOutcome
}

// RecordReparseCall is one captured RecordReparse invocation (Story 3.6). MatchID is carried explicitly (it
// drives the delete-missing scope) so tests assert the exact match the re-parse reverted.
type RecordReparseCall struct {
	MatchID       int64
	DemoID        int64
	ParserVersion string
	Rows          []StatRow
	Val           ValidationOutcome
}

var _ StatRecorder = (*FakeStatRecorder)(nil)

// NewFakeStatRecorder returns an empty capturing stat recorder.
func NewFakeStatRecorder() *FakeStatRecorder { return &FakeStatRecorder{} }

func mirrorKey(matchID int64, steamID string) string {
	return fmt.Sprintf("%d\x00%s", matchID, steamID)
}

// upsertLocked applies one row to the mirror with the DB's status semantics (caller holds f.mu): a NEW key
// takes the 'pending' column default; an EXISTING key preserves its current status (the DO UPDATE set-list
// omits `status`). Shared by RecordParse and RecordReparse so both model the AD-7 preservation identically.
func (f *FakeStatRecorder) upsertLocked(row StatRow) {
	if f.rows == nil {
		f.rows = make(map[string]mirrorRow)
	}
	key := mirrorKey(row.MatchID, row.SteamID64)
	status := "pending" // a brand-new steamid lands pending (the stat_row column default)
	if existing, ok := f.rows[key]; ok {
		status = existing.status // preserve (upsert DO UPDATE omits status)
	}
	f.rows[key] = mirrorRow{row: row, status: status}
}

// SeedRow pre-populates the mirror with a row at the given status (test helper): it simulates a
// pre-existing published row — e.g. an 'approved' row a future Story-4.6 Aprobar created — so a re-parse
// test can prove that status is PRESERVED (the 3.5 "seed an approved row" technique).
func (f *FakeStatRecorder) SeedRow(status string, row StatRow) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.rows == nil {
		f.rows = make(map[string]mirrorRow)
	}
	f.rows[mirrorKey(row.MatchID, row.SteamID64)] = mirrorRow{row: row, status: status}
}

// RecordParse captures the call (incl. the validation outcome) and applies each row to the in-memory
// upsert mirror (or returns Err). It does NOT delete-missing or bump a generation — that is RecordReparse.
func (f *FakeStatRecorder) RecordParse(_ context.Context, demoID int64, parserVersion string, rows []StatRow, val ValidationOutcome) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.Err != nil {
		return f.Err
	}
	captured := make([]StatRow, len(rows))
	copy(captured, rows)
	f.calls = append(f.calls, RecordParseCall{DemoID: demoID, ParserVersion: parserVersion, Rows: captured, Val: val})
	for _, row := range rows {
		f.upsertLocked(row)
	}
	return nil
}

// RecordReparse mirrors the real re-parse transaction in memory: it (a) bumps the per-demo generation
// counter, (b) status-preservingly upserts the fresh rows, and (c) DELETES mirror rows for matchID whose
// steamid64 is absent from the new set (empty rows => ALL of the match's rows are removed). Tests assert the
// surviving row set + preserved status + the generation bump. Returns Err (fail-closed) without touching
// the mirror.
func (f *FakeStatRecorder) RecordReparse(_ context.Context, matchID, demoID int64, parserVersion string, rows []StatRow, val ValidationOutcome) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.Err != nil {
		return f.Err
	}
	captured := make([]StatRow, len(rows))
	copy(captured, rows)
	f.reparseCalls = append(f.reparseCalls, RecordReparseCall{MatchID: matchID, DemoID: demoID, ParserVersion: parserVersion, Rows: captured, Val: val})
	if f.generations == nil {
		f.generations = make(map[int64]int)
	}
	f.generations[demoID]++
	// (b) status-preserving upsert of the fresh rows; collect the new steamid set for the delete-missing.
	newSet := make(map[string]struct{}, len(rows))
	for _, row := range rows {
		f.upsertLocked(row)
		newSet[row.SteamID64] = struct{}{}
	}
	// (c) delete-missing: drop mirror rows for THIS match whose steamid64 is absent from the new set.
	for key, mr := range f.rows {
		if mr.row.MatchID == matchID {
			if _, ok := newSet[mr.row.SteamID64]; !ok {
				delete(f.rows, key)
			}
		}
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

// Reparsed returns a snapshot copy of the captured RecordReparse invocations (empty when none fired — the
// fail-closed assertion that a re-parse never recorded).
func (f *FakeStatRecorder) Reparsed() []RecordReparseCall {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]RecordReparseCall, len(f.reparseCalls))
	copy(out, f.reparseCalls)
	return out
}

// Generation reports how many times the given demo was re-parsed (the fake analogue of the delta between
// demo.parse_generation and its default 1) — 0 before any re-parse, +1 per RecordReparse.
func (f *FakeStatRecorder) Generation(demoID int64) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.generations[demoID]
}

// StatusOf returns the mirror status for (matchID, steamid64) and whether such a row exists — the accessor
// tests use to prove an approved row survived a re-parse (or that a new id landed 'pending').
func (f *FakeStatRecorder) StatusOf(matchID int64, steamID string) (string, bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	mr, ok := f.rows[mirrorKey(matchID, steamID)]
	return mr.status, ok
}

// Upserted returns the in-memory upsert mirror — one row per distinct (MatchID, SteamID64), latest wins.
func (f *FakeStatRecorder) Upserted() []StatRow {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]StatRow, 0, len(f.rows))
	for _, r := range f.rows {
		out = append(out, r.row)
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

// FakeDemoReader is a DemoReader for unit tests (no real DB): it returns a settable DemoRef, or the
// configured Err to exercise the fail-closed no-demo path (a re-parse of a match with no retained demo).
// Mirrors the FakeRosterReader/FakeStatRecorder in-package seams.
type FakeDemoReader struct {
	Ref DemoRef
	Err error
}

var _ DemoReader = (*FakeDemoReader)(nil)

// NewFakeDemoReader builds a fake that returns ref for any match.
func NewFakeDemoReader(ref DemoRef) *FakeDemoReader { return &FakeDemoReader{Ref: ref} }

// DemoForMatch returns the configured Err (fail-closed no-demo path) or the seeded DemoRef.
func (f *FakeDemoReader) DemoForMatch(context.Context, int64) (DemoRef, error) {
	if f.Err != nil {
		return DemoRef{}, f.Err
	}
	return f.Ref, nil
}
