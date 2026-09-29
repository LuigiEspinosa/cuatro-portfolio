package ingest

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"cs-tournament/worker/db"
	"cs-tournament/worker/store"
)

// Story 3.8 defaults (package constants — event-time tuning of these knobs is Story 7.4, "when the worker
// is configured for the event"). A CS2 parse is CPU/RAM-heavy and v1 is a single tournament (matches arrive
// minutes apart), so the concurrency bound is deliberately small; the parse is ~3.4 s (PoC), so a capped
// retry with a few-second base backoff stays well inside the SM-5 budget (P50 < 5 min, P95 < 15 min).
const (
	defaultMaxConcurrentParses = 2               // bounded concurrency (semaphore-equivalent worker count)
	defaultMaxParseAttempts    = 3               // capped ParseFailed attempts before the never-silent alert
	defaultBackoffBase         = 3 * time.Second // exponential backoff base: base * 2^(attempt-1)
	defaultQueueBuffer         = 64              // in-process channel buffer (transient; R2 is the durability backstop)
)

// Job is one enqueued parse of a retained demo (Story 3.8): the fresh acquire's {MatchID, DemoID, StorageKey}
// carried through the in-process queue. It carries NOTHING the parse core can't re-derive — the demo bytes
// are already durable in R2 the instant Acquire returns, so a job lost to a worker restart is recoverable by
// re-driving (the durable recovery sweep is Story 7.4; AD-1: the raw demo is the source of truth).
type Job struct {
	MatchID    int64
	DemoID     int64
	StorageKey string

	enqueuedAt time.Time // stamped at Enqueue for the AC3 landing->visible elapsed instrumentation
}

// Enqueuer is the seam handleMatchZy (and POST /ingest/parse) submit a parse job through — the *Runner in
// production, a recording fake in tests. Enqueue MUST be non-blocking: the HTTP response returns as soon as
// the bytes are durable in R2, never blocking on the ~3.4 s parse (AC1/AC3 — a slow parse must not time out
// MatchZy's upload).
type Enqueuer interface {
	Enqueue(Job)
}

// Alerter is the never-silent seam an exhausted ParseFailed raises through (SOLUTION-DESIGN §11: "ParseFailed
// + parse anomalies → admin:<id> alert + log; never silent"). Story 3.8 ships the LOG half via LogAlerter;
// Story 7.4 (which needs the Epic-5 AD-11 Broadcast topology) swaps in the real admin:<id> channel by
// injecting a different Alerter here — no rework, a clean hand-off.
type Alerter interface {
	AlertParseFailed(matchID int64, attempts int, err error)
}

// LogAlerter is the default Alerter: it logs a structured, never-silent line naming the match + attempts +
// the terminal error. It is the injection point Story 7.4 replaces with the real admin:<id> Broadcast.
type LogAlerter struct{}

var _ Alerter = LogAlerter{}

// AlertParseFailed logs the terminal parse failure (never silent). Story 7.4 wires the admin:<id> channel.
func (LogAlerter) AlertParseFailed(matchID int64, attempts int, err error) {
	log.Printf("ALERT: match %d parse FAILED after %d attempts — never silent (real admin:<id> Broadcast wiring = Story 7.4 / Epic 5): %v", matchID, attempts, err)
}

// Runner is the bounded, in-process async parse-job queue (Story 3.8, AD-26): a buffered channel drained by a
// fixed pool of worker goroutines (bounded concurrency), each running the SHARED parseAndRecord core with a
// capped, ctx-aware retry+backoff on a ParseFailed and a never-silent Alerter on exhaustion. The queue is
// EPHEMERAL by design (no jobs table, no migration) — durable restart recovery is Story 7.4; R2 is the
// durability backstop. It never bumps the pinned parser version in the retry loop (a version upgrade to
// recover from Valve format churn is a deliberate operator action, not automatic).
type Runner struct {
	store   store.DemoStore
	parser  Parser
	statRec db.StatRecorder
	roster  db.RosterReader
	alerter Alerter

	maxConcurrent int
	maxAttempts   int
	backoffBase   time.Duration

	ch   chan Job
	quit chan struct{}
	ctx  context.Context

	wg        sync.WaitGroup
	startOnce sync.Once
	closeOnce sync.Once

	// sleep is the ctx-aware backoff wait (injectable so retry/backoff tests run fast without real sleeps).
	sleep func(ctx context.Context, d time.Duration) error
	// now supplies the clock for the landing->visible elapsed proxy (injectable in tests; time.Now default).
	now func() time.Time
	// onJobDone, when set, is called after each job reaches a terminal outcome (success, exhaustion, or
	// ctx-abort). Test-only synchronization hook (nil in production).
	onJobDone func(Job, error)
}

var _ Enqueuer = (*Runner)(nil)

// NewRunner builds a Runner over the shared parse dependencies with the Story-3.8 default knobs. Call Start
// to launch the worker pool and Close to drain + stop it (graceful shutdown).
func NewRunner(s store.DemoStore, parser Parser, statRec db.StatRecorder, roster db.RosterReader, alerter Alerter) *Runner {
	return &Runner{
		store:         s,
		parser:        parser,
		statRec:       statRec,
		roster:        roster,
		alerter:       alerter,
		maxConcurrent: defaultMaxConcurrentParses,
		maxAttempts:   defaultMaxParseAttempts,
		backoffBase:   defaultBackoffBase,
		ch:            make(chan Job, defaultQueueBuffer),
		quit:          make(chan struct{}),
		sleep:         ctxSleep,
		now:           time.Now,
	}
}

// Enqueue submits a job WITHOUT blocking the caller (the HTTP request path stays fast — AC1/AC3). It stamps
// the enqueue time for the elapsed proxy, then does a non-blocking channel send; if the buffer is momentarily
// full it hands the send to a goroutine that races delivery against shutdown (r.quit), so the caller still
// returns immediately, the job is delivered as soon as a slot frees, AND the overflow goroutine can never
// outlive Close — on shutdown it drops the job with a never-silent log (the retained R2 demo is the durable
// backstop; Story 7.4 re-drives it) rather than leaking blocked forever on a channel no worker reads. For v1
// single-tournament load (matches minutes apart) the overflow path is effectively unreachable.
func (r *Runner) Enqueue(j Job) {
	j.enqueuedAt = r.now()
	select {
	case r.ch <- j:
	default:
		go func() {
			select {
			case r.ch <- j:
			case <-r.quit:
				log.Printf("[parse-job] match %d DROPPED at shutdown (queue full during drain); re-drive from the retained R2 demo (durable recovery is Story 7.4): demo %d %s", j.MatchID, j.DemoID, j.StorageKey)
			}
		}()
	}
}

// Start launches the bounded worker pool draining the queue. The ctx governs in-flight parses and aborts a
// backoff sleep on cancellation (a shutdown must not hang on a long backoff). Idempotent (starts once).
func (r *Runner) Start(ctx context.Context) {
	r.startOnce.Do(func() {
		r.ctx = ctx
		for i := 0; i < r.maxConcurrent; i++ {
			r.wg.Add(1)
			go r.worker()
		}
	})
}

// Close signals a graceful stop and waits for the worker pool to drain the already-buffered jobs and exit.
// Anything still unqueued at shutdown is recoverable from the retained R2 demo (Story 7.4's durable sweep).
// Idempotent.
func (r *Runner) Close() {
	r.closeOnce.Do(func() { close(r.quit) })
	r.wg.Wait()
}

// worker drains the queue until a graceful Close (best-effort drain of buffered jobs) or ctx cancellation
// (abrupt stop). Each dequeued job runs the capped-retry parse loop.
func (r *Runner) worker() {
	defer r.wg.Done()
	for {
		select {
		case j := <-r.ch:
			r.work(r.ctx, j)
		case <-r.ctx.Done():
			return // abrupt: ctx cancelled (in-flight parse/backoff already aborts via the same ctx)
		case <-r.quit:
			// Graceful: drain whatever is already buffered, then exit. The R2 demo backstops anything the
			// overflow goroutine hasn't delivered yet (durable recovery is Story 7.4).
			for {
				select {
				case j := <-r.ch:
					r.work(r.ctx, j)
				default:
					return
				}
			}
		}
	}
}

// work runs one job to a terminal outcome: the capped ParseFailed retry loop over the SHARED parseAndRecord
// core. A success (INCLUDING a validation anomaly — a successful parse with a failed gate: rows upserted, the
// demo held) returns immediately; only a genuine parse/read/record error retries, with ctx-aware backoff,
// against the SAME pinned parser version. On exhaustion it raises the never-silent Alerter AND logs. It logs
// the AC3 landing->visible elapsed on success — the SM-5 budget made observable.
func (r *Runner) work(ctx context.Context, j Job) {
	// Defense-in-depth: the parser recovers its OWN panics into errors (parse.go), but a panic OUTSIDE the
	// parser (s.Get / RecordParse / roster read) in this worker goroutine would otherwise terminate the whole
	// worker process. Recover it into a never-silent terminal alert (a panic is not a retriable ParseFailed)
	// so one pathological job can't crash the pool/process — the same "fail closed, don't crash" posture the
	// DemoinfocsParser recover already gives the parse itself.
	attempt := 0
	defer func() {
		if rec := recover(); rec != nil {
			perr := fmt.Errorf("parse job panicked on attempt %d: %v", attempt, rec)
			log.Printf("[parse-job] match %d PANIC on attempt %d (recovered so the pool/process survives; never silent): %v", j.MatchID, attempt, rec)
			r.alerter.AlertParseFailed(j.MatchID, attempt, perr)
			r.finish(j, perr)
		}
	}()
	var err error
	for attempt = 1; attempt <= r.maxAttempts; attempt++ {
		var out parseOutcome
		out, err = parseAndRecord(ctx, r.store, r.parser, r.statRec, r.roster, j.MatchID, j.DemoID, j.StorageKey)
		if err == nil {
			// Success — a validation ANOMALY is success too (rows upserted, demo held; NOT a ParseFailed to
			// retry, else identical rows would re-upsert forever and never alert correctly — headline risk (b)).
			elapsed := r.now().Sub(j.enqueuedAt).Round(time.Millisecond)
			if out.Anomalous {
				log.Printf("[parse-job] match %d parsed but HELD anomalous (%v) in %s (landing->visible; attempt %d/%d)", j.MatchID, out.Reasons, elapsed, attempt, r.maxAttempts)
			} else {
				log.Printf("[parse-job] match %d parsed: %d players, %d rounds in %s (landing->visible; attempt %d/%d)", j.MatchID, out.Players, out.Rounds, elapsed, attempt, r.maxAttempts)
			}
			r.finish(j, nil)
			return
		}
		if attempt == r.maxAttempts {
			// Terminal exhaustion (headline risk (a): the loop is BOUNDED — it never becomes an unbounded
			// ParseFailed → Parsing retry). Never silent: raise the admin alert seam AND log the terminal error.
			log.Printf("[parse-job] match %d ParseFailed TERMINALLY after %d/%d attempts: %v", j.MatchID, attempt, r.maxAttempts, err)
			r.alerter.AlertParseFailed(j.MatchID, attempt, err)
			r.finish(j, err)
			return
		}
		d := backoff(r.backoffBase, attempt)
		log.Printf("[parse-job] match %d ParseFailed (attempt %d/%d), retrying in %s: %v", j.MatchID, attempt, r.maxAttempts, d, err)
		if serr := r.sleep(ctx, d); serr != nil {
			// ctx cancelled mid-backoff (shutdown) — abort without exhausting/alerting. The demo persists in
			// R2; Story 7.4's durable sweep re-drives it. Do NOT alert (this is not a terminal parse failure).
			log.Printf("[parse-job] match %d retry aborted (context cancelled during backoff after attempt %d/%d): %v", j.MatchID, attempt, r.maxAttempts, serr)
			r.finish(j, serr)
			return
		}
	}
}

// finish invokes the test-only completion hook (no-op in production).
func (r *Runner) finish(j Job, err error) {
	if r.onJobDone != nil {
		r.onJobDone(j, err)
	}
}

// backoff returns the exponential delay before the NEXT attempt: base * 2^(attempt-1). Kept small (base a few
// seconds) so a bounded retry stays well inside the SM-5 budget. Story 7.4 tunes the base for the event.
func backoff(base time.Duration, attempt int) time.Duration {
	if attempt < 1 {
		attempt = 1
	}
	return base * time.Duration(1<<(attempt-1))
}

// ctxSleep waits d, aborting early if ctx is cancelled (returns ctx.Err() then). A non-positive d returns nil
// immediately. It is the production r.sleep; tests inject a fast no-op that records the requested durations.
func ctxSleep(ctx context.Context, d time.Duration) error {
	if d <= 0 {
		return nil
	}
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-t.C:
		return nil
	}
}
