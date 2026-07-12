package ingest

import (
	"context"
	"errors"
	"io"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"cs-tournament/worker/db"
	"cs-tournament/worker/store"
)

// FakeAlerter records AlertParseFailed calls so tests assert the never-silent, exactly-once terminal alert
// on exhaustion (and its absence on a retry-then-succeed or a held anomaly). This is the seam Story 7.4
// swaps the real admin:<id> Broadcast into.
type FakeAlerter struct {
	mu    sync.Mutex
	calls []alertCall
}

type alertCall struct {
	matchID  int64
	attempts int
	err      error
}

func (a *FakeAlerter) AlertParseFailed(matchID int64, attempts int, err error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.calls = append(a.calls, alertCall{matchID, attempts, err})
}

func (a *FakeAlerter) Calls() []alertCall {
	a.mu.Lock()
	defer a.mu.Unlock()
	out := make([]alertCall, len(a.calls))
	copy(out, a.calls)
	return out
}

// parserFunc adapts a func to the Parser seam (a lightweight inline parser for a single test).
type parserFunc func(io.Reader) (ParseResult, error)

func (f parserFunc) Parse(r io.Reader) (ParseResult, error) { return f(r) }

// flakyParser fails the first failUntil Parse calls (returning err) then succeeds with result — it drives
// both the exhaustion path (failUntil ≥ maxAttempts) and the retry-then-succeed path (failUntil < maxAttempts).
type flakyParser struct {
	mu        sync.Mutex
	calls     int
	failUntil int
	err       error
	result    ParseResult
}

func (p *flakyParser) Parse(r io.Reader) (ParseResult, error) {
	_, _ = io.Copy(io.Discard, r)
	p.mu.Lock()
	p.calls++
	n := p.calls
	p.mu.Unlock()
	if n <= p.failUntil {
		return ParseResult{}, p.err
	}
	return p.result, nil
}

func (p *flakyParser) Count() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.calls
}

const testStorageKey = "demos/1/fixture.dem"

// newSeededRunner builds a Runner over a FakeStore pre-seeded with one object at testStorageKey (so
// parseAndRecord's s.Get succeeds and the parser — not the read — decides the outcome), with the backoff
// sleep replaced by a fast recorder (*[]time.Duration) so retry tests never actually sleep. It returns the
// runner, the stat recorder, and the recorded backoff durations.
func newSeededRunner(t *testing.T, parser Parser, roster *db.FakeRosterReader, alerter Alerter) (*Runner, *db.FakeStatRecorder, *[]time.Duration) {
	t.Helper()
	s := store.NewFakeStore()
	if err := s.Put(context.Background(), testStorageKey, bytesReader(demoBytes()), int64(len(demoBytes()))); err != nil {
		t.Fatal(err)
	}
	statRec := db.NewFakeStatRecorder()
	runner := NewRunner(s, parser, statRec, roster, alerter)
	var slept []time.Duration
	runner.sleep = func(_ context.Context, d time.Duration) error {
		slept = append(slept, d)
		return nil
	}
	return runner, statRec, &slept
}

func bytesReader(b []byte) io.Reader { return &sliceReader{b: b} }

type sliceReader struct {
	b []byte
	i int
}

func (r *sliceReader) Read(p []byte) (int, error) {
	if r.i >= len(r.b) {
		return 0, io.EOF
	}
	n := copy(p, r.b[r.i:])
	r.i += n
	return n, nil
}

// TestRunnerRetriesToExhaustionThenAlerts: a parse that fails every attempt drives the loop to the capped
// maxParseAttempts, backs off between attempts (base, 2×base), and raises EXACTLY ONE never-silent terminal
// alert — and records NO stat rows. The loop is BOUNDED (headline risk (a)).
func TestRunnerRetriesToExhaustionThenAlerts(t *testing.T) {
	parseErr := errors.New("corrupt demo (format churn)")
	parser := &flakyParser{failUntil: 99, err: parseErr} // always fails
	alerter := &FakeAlerter{}
	runner, statRec, slept := newSeededRunner(t, parser, cannedRoster(), alerter)

	runner.work(context.Background(), Job{MatchID: 501, DemoID: 9, StorageKey: testStorageKey})

	if parser.Count() != runner.maxAttempts {
		t.Fatalf("a persistently-failing parse must be attempted exactly maxParseAttempts (%d) times, got %d", runner.maxAttempts, parser.Count())
	}
	calls := alerter.Calls()
	if len(calls) != 1 {
		t.Fatalf("exhaustion must raise EXACTLY ONE terminal alert (never silent), got %d", len(calls))
	}
	if calls[0].matchID != 501 || calls[0].attempts != runner.maxAttempts {
		t.Fatalf("the terminal alert must name the match + the capped attempt count, got %+v", calls[0])
	}
	if len(statRec.Calls()) != 0 {
		t.Fatal("a ParseFailed that exhausts must record NO stat rows")
	}
	// Backoff fired between attempts (not after the terminal one): base, then 2×base for maxAttempts=3.
	want := []time.Duration{runner.backoffBase, runner.backoffBase * 2}
	if len(*slept) != len(want) {
		t.Fatalf("want %d backoff waits (one between each of %d attempts), got %d: %v", len(want), runner.maxAttempts, len(*slept), *slept)
	}
	for i, d := range want {
		if (*slept)[i] != d {
			t.Fatalf("backoff[%d] = %s, want %s (exponential base*2^(attempt-1))", i, (*slept)[i], d)
		}
	}
}

// TestRunnerRetryThenSucceedNoAlert: a parse that fails k<maxAttempts times then succeeds records the rows
// and raises NO alert (the retry recovered — a transient failure must not page the admin).
func TestRunnerRetryThenSucceedNoAlert(t *testing.T) {
	parser := &flakyParser{failUntil: 1, err: errors.New("transient"), result: cannedParse()} // fail once, then succeed
	alerter := &FakeAlerter{}
	runner, statRec, slept := newSeededRunner(t, parser, cannedRoster(), alerter)

	runner.work(context.Background(), Job{MatchID: 502, DemoID: 3, StorageKey: testStorageKey})

	if parser.Count() != 2 {
		t.Fatalf("a fail-once-then-succeed parse must be attempted exactly twice, got %d", parser.Count())
	}
	if len(alerter.Calls()) != 0 {
		t.Fatal("a recovered retry must raise NO alert")
	}
	calls := statRec.Calls()
	if len(calls) != 1 || len(calls[0].Rows) != 2 {
		t.Fatalf("the recovered parse must RecordParse the 2 rows exactly once, got %+v", calls)
	}
	if len(*slept) != 1 || (*slept)[0] != runner.backoffBase {
		t.Fatalf("exactly one base backoff must precede the successful retry, got %v", *slept)
	}
}

// TestRunnerAnomalyIsNotRetried: a CLEAN parse whose validation gate fails (an anomaly) is a SUCCESS — the
// rows are upserted and the match HELD; it must NOT enter the retry loop and must NOT alert (headline risk
// (b): an anomaly is not a ParseFailed; retrying would re-upsert identical rows forever).
func TestRunnerAnomalyIsNotRetried(t *testing.T) {
	parser := &flakyParser{failUntil: 0, result: cannedParse()} // always parses cleanly
	// Roster does NOT include …042 -> an unreconciled anomaly (a successful parse with a failed gate).
	roster := db.NewFakeRosterReader("76561197960287930")
	alerter := &FakeAlerter{}
	runner, statRec, slept := newSeededRunner(t, parser, roster, alerter)

	runner.work(context.Background(), Job{MatchID: 503, DemoID: 4, StorageKey: testStorageKey})

	if parser.Count() != 1 {
		t.Fatalf("an anomaly is success — the parse must run exactly once (NOT retried), got %d", parser.Count())
	}
	if len(*slept) != 0 {
		t.Fatal("an anomaly must not back off / retry")
	}
	if len(alerter.Calls()) != 0 {
		t.Fatal("an anomaly must NOT raise a ParseFailed alert (it is a held match, not a parse failure)")
	}
	calls := statRec.Calls()
	if len(calls) != 1 || !calls[0].Val.Anomalous || len(calls[0].Rows) != 2 {
		t.Fatalf("the anomaly must upsert both rows once with an anomalous outcome, got %+v", calls)
	}
}

// TestRunnerCtxCancelDuringBackoffAborts: if the ctx is cancelled during a backoff wait (shutdown), the loop
// aborts WITHOUT exhausting or alerting — the demo persists in R2 (Story 7.4 re-drives it). A shutdown must
// not hang on a long backoff, and a cancelled retry is not a terminal parse failure.
func TestRunnerCtxCancelDuringBackoffAborts(t *testing.T) {
	parser := &flakyParser{failUntil: 99, err: errors.New("boom")}
	alerter := &FakeAlerter{}
	runner, statRec, _ := newSeededRunner(t, parser, cannedRoster(), alerter)
	runner.sleep = func(_ context.Context, _ time.Duration) error { return context.Canceled } // ctx cancelled mid-backoff

	runner.work(context.Background(), Job{MatchID: 504, DemoID: 5, StorageKey: testStorageKey})

	if parser.Count() != 1 {
		t.Fatalf("a ctx-cancel during the first backoff must abort after attempt 1, got %d attempts", parser.Count())
	}
	if len(alerter.Calls()) != 0 {
		t.Fatal("a ctx-cancelled retry must NOT alert (it is not a terminal parse failure)")
	}
	if len(statRec.Calls()) != 0 {
		t.Fatal("an aborted retry records nothing")
	}
}

// TestRunnerPanicRecoveredAndAlerts: a panic raised OUTSIDE the demoinfocs recover (modeled here by a parser
// that panics — standing in for a panic in s.Get / RecordParse / roster read) must NOT crash the worker
// process; work() recovers it into exactly ONE never-silent terminal alert and completes the job (records
// nothing). Defense-in-depth for the "never crash the worker process" posture.
func TestRunnerPanicRecoveredAndAlerts(t *testing.T) {
	parser := parserFunc(func(io.Reader) (ParseResult, error) { panic("boom outside the parser recover") })
	alerter := &FakeAlerter{}
	runner, statRec, _ := newSeededRunner(t, parser, cannedRoster(), alerter)

	// Must return normally — a panic escaping work() would crash the process/pool.
	runner.work(context.Background(), Job{MatchID: 700, DemoID: 1, StorageKey: testStorageKey})

	if calls := alerter.Calls(); len(calls) != 1 || calls[0].matchID != 700 {
		t.Fatalf("a recovered panic must raise exactly one terminal alert naming the match, got %+v", calls)
	}
	if len(statRec.Calls()) != 0 {
		t.Fatal("a panicked job records no stat rows")
	}
}

// TestRunnerBoundedConcurrency: with maxConcurrentParses=2, enqueuing 4 jobs never runs more than 2 parses
// at once (bounded concurrency, AD-26) — while proving 2 DO overlap (the pool is actually concurrent).
func TestRunnerBoundedConcurrency(t *testing.T) {
	const jobs = 4
	s := store.NewFakeStore()
	if err := s.Put(context.Background(), testStorageKey, bytesReader(demoBytes()), int64(len(demoBytes()))); err != nil {
		t.Fatal(err)
	}
	release := make(chan struct{})
	var inflight, maxSeen int32
	parser := parserFunc(func(r io.Reader) (ParseResult, error) {
		_, _ = io.Copy(io.Discard, r)
		cur := atomic.AddInt32(&inflight, 1)
		for {
			old := atomic.LoadInt32(&maxSeen)
			if cur <= old || atomic.CompareAndSwapInt32(&maxSeen, old, cur) {
				break
			}
		}
		<-release // hold each parse to force overlap
		atomic.AddInt32(&inflight, -1)
		return cannedParse(), nil
	})
	runner := NewRunner(s, parser, db.NewFakeStatRecorder(), cannedRoster(), &FakeAlerter{})
	done := make(chan struct{}, jobs)
	runner.onJobDone = func(Job, error) { done <- struct{}{} }
	runner.Start(context.Background())
	t.Cleanup(runner.Close)

	for i := 0; i < jobs; i++ {
		runner.Enqueue(Job{MatchID: int64(600 + i), DemoID: int64(i + 1), StorageKey: testStorageKey})
	}

	// Wait until the two workers are both parsing (inflight == maxConcurrent), proving real concurrency.
	deadline := time.After(2 * time.Second)
	for atomic.LoadInt32(&inflight) < int32(runner.maxConcurrent) {
		select {
		case <-deadline:
			t.Fatalf("expected %d concurrent parses, only saw %d in-flight", runner.maxConcurrent, atomic.LoadInt32(&inflight))
		case <-time.After(time.Millisecond):
		}
	}
	// Give any (incorrect) 3rd worker a window to start; with the bound it cannot.
	time.Sleep(20 * time.Millisecond)
	if got := atomic.LoadInt32(&maxSeen); got > int32(runner.maxConcurrent) {
		t.Fatalf("bounded concurrency violated: %d parses ran at once (bound %d)", got, runner.maxConcurrent)
	}

	close(release) // let all jobs finish
	for i := 0; i < jobs; i++ {
		select {
		case <-done:
		case <-time.After(2 * time.Second):
			t.Fatalf("only %d/%d jobs completed", i, jobs)
		}
	}
	if got := atomic.LoadInt32(&maxSeen); got != int32(runner.maxConcurrent) {
		t.Fatalf("expected exactly %d concurrent parses at peak, saw %d", runner.maxConcurrent, got)
	}
}

// TestParseAndRecordParity asserts the extracted shared core produces the same mapped rows + validation the
// pre-refactor RunCLI tail did: 17-digit-guarded rows stamped with the demo provenance, validated against the
// roster, RecordParsed once with the pinned version. (RunCLI's own cli_test.go cases also stay green — the
// refactor is behavior-preserving; this is the direct unit over the shared function the async job calls.)
func TestParseAndRecordParity(t *testing.T) {
	s := store.NewFakeStore()
	if err := s.Put(context.Background(), testStorageKey, bytesReader(demoBytes()), int64(len(demoBytes()))); err != nil {
		t.Fatal(err)
	}
	statRec := db.NewFakeStatRecorder()
	out, err := parseAndRecord(context.Background(), s, FakeParser{Result: cannedParse()}, statRec, cannedRoster(), 42, 8, testStorageKey)
	if err != nil {
		t.Fatal(err)
	}
	if out.Players != 2 || out.Rounds != 24 || out.Anomalous {
		t.Fatalf("parity outcome mismatch: %+v", out)
	}
	calls := statRec.Calls()
	if len(calls) != 1 || calls[0].DemoID != 8 || calls[0].ParserVersion != ParserVersion || len(calls[0].Rows) != 2 {
		t.Fatalf("parseAndRecord must RecordParse the 2 rows once with demo 8 + pinned version, got %+v", calls)
	}
	byID := map[string]db.StatRow{}
	for _, r := range calls[0].Rows {
		byID[r.SteamID64] = r
	}
	r930, ok := byID["76561197960287930"]
	if !ok || r930.MatchID != 42 || r930.DemoID != 8 || r930.Kills != 20 || r930.Deaths != 14 || r930.RoundsPlayed != 24 {
		t.Fatalf("mapped row for …930 mismatch: %+v (present=%t)", r930, ok)
	}
}

// TestParseAndRecordRosterErrorFailsClosed: a roster-read error propagates as an ERROR (so the async retry
// loop treats it as retriable and can exhaust → alert — the accepted fail-closed behavior) and records nothing.
func TestParseAndRecordRosterErrorFailsClosed(t *testing.T) {
	s := store.NewFakeStore()
	if err := s.Put(context.Background(), testStorageKey, bytesReader(demoBytes()), int64(len(demoBytes()))); err != nil {
		t.Fatal(err)
	}
	statRec := db.NewFakeStatRecorder()
	roster := db.NewFakeRosterReader()
	roster.Err = errors.New("roster db down")
	if _, err := parseAndRecord(context.Background(), s, FakeParser{Result: cannedParse()}, statRec, roster, 42, 8, testStorageKey); err == nil {
		t.Fatal("a roster-read error must propagate (fail closed — never record an unvalidated parse)")
	}
	if len(statRec.Calls()) != 0 {
		t.Fatal("RecordParse must not fire when the roster read fails")
	}
}
