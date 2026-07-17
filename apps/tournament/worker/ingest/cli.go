package ingest

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"strconv"

	"cs-tournament/worker/db"
	"cs-tournament/worker/store"
)

// CLIResult reports what `worker ingest` did: the underlying acquire (StorageKey/SHA256/AlreadyIngested/
// DemoID) plus, when a FRESH acquire triggered a parse, the parsed player + round counts and the Story-3.4
// validation outcome. Parsed is false when an AlreadyIngested re-run short-circuited the parse (AD-3) —
// which also skips validation (the prior ingest already validated).
type CLIResult struct {
	AcquireResult
	Parsed    bool               // true => this run parsed + upserted stat_row; false => AlreadyIngested skipped the parse
	Players   int                // stat_row rows upserted (0 when Parsed is false)
	Rounds    int                // rounds played reported by the parser (0 when Parsed is false)
	Anomalous bool               // Story 3.4: a validation gate failed → the match is HELD (demo.validation_state='anomalous')
	Reasons   []db.AnomalyReason // the machine-readable gate failures (nil when clean or not parsed)
}

// RunCLI ingests a local .dem end-to-end (AC5): validate the Source-2 header, stream the file to object
// storage (computing its SHA-256 in the same pass) and record the acquisition row, then — on a FRESH
// acquire — read the stored object back, parse it, and upsert the per-player stat_row rows as the single
// writer. The whole Acquiring → Hashing → Deduped → Parsing chain in one operator command (the local-
// verify path 3.1/3.2 QA used). An AlreadyIngested re-run reports the short-circuit and SKIPS the parse
// (its stat rows already exist — AD-3; deliberate re-parse is Story 3.6). The MatchZy-HTTP-triggered
// parse + the bounded async queue are Story 3.8 (not wired here).
func RunCLI(ctx context.Context, s store.DemoStore, rec db.DemoRecorder, parser Parser, statRec db.StatRecorder, roster db.RosterReader, path string, matchID int64) (CLIResult, error) {
	if matchID <= 0 {
		return CLIResult{}, fmt.Errorf("--match <id> is required and must be a positive integer")
	}
	f, err := os.Open(path)
	if err != nil {
		return CLIResult{}, fmt.Errorf("open %q: %w", path, err)
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return CLIResult{}, fmt.Errorf("stat %q: %w", path, err)
	}
	if err := checkDemHeader(f); err != nil {
		return CLIResult{}, err
	}

	acq, err := Acquire(ctx, s, rec, AcquireMeta{
		MatchID: matchID,
		Size:    info.Size(),
		Source:  SourceManualUpload,
	}, f)
	if err != nil {
		return CLIResult{}, err
	}
	res := CLIResult{AcquireResult: acq}
	if acq.AlreadyIngested {
		// AD-3 short-circuit: the prior ingest already wrote this demo's stat rows; do NOT re-parse
		// (deliberate re-parse is Story 3.6). Only a FRESH acquire parses.
		return res, nil
	}

	// Fresh acquire: parse the RETAINED object (AD-1 source of truth), not a tee of the upload — via the
	// SHARED parseAndRecord core the Story-3.8 bounded async job also runs (the parse logic lives ONCE). R2
	// is read-after-write consistent for a new PUT, so the just-stored object is immediately readable.
	out, err := parseAndRecord(ctx, s, parser, statRec, roster, matchID, acq.DemoID, acq.StorageKey)
	if err != nil {
		return CLIResult{}, err
	}
	res.Parsed = true
	res.Players = out.Players
	res.Rounds = out.Rounds
	res.Anomalous = out.Anomalous
	res.Reasons = out.Reasons
	return res, nil
}

// parseOutcome reports what one parseAndRecord produced: the upserted player-row count, the parser's rounds
// played, and the Story-3.4 validation result. An anomaly is a SUCCESSFUL parse with a failed gate (rows ARE
// upserted, the demo is HELD) — parseAndRecord returns it as success (nil error) with Anomalous=true, NEVER
// an error. That distinction is load-bearing for the Story-3.8 retry loop: only a genuine parse/read/record
// error is an error the loop retries; a held anomaly must not be re-tried (it would re-upsert forever).
type parseOutcome struct {
	Players   int
	Rounds    int
	Anomalous bool
	Reasons   []db.AnomalyReason
}

// parseAndRecord is the shared parse tail of the FRESH-acquire path, extracted so `worker ingest` (RunCLI)
// and the Story-3.8 bounded async job run the SAME core with NO duplicated parse logic: read the RETAINED
// object back (AD-1 source of truth — never a tee of the upload; demoinfocs consumes the whole stream), map
// each parsed player to a stat_row (SteamID64 uint64 -> 17-digit decimal text, AD-4; stamping match/demo/
// rounds provenance; the Epic-5 stat columns stay NULL), validate against the ACTIVE roster (Story 3.4),
// and upsert via RecordParse. It NEVER acquires — the demo bytes are already durable in R2; the caller
// supplies the demoID + storageKey of the retained object (the AcquireResult on the CLI/MatchZy path).
//
// Fail-closed semantics are preserved VERBATIM from the pre-refactor RunCLI: a roster-read error returns an
// error (do NOT record a parse we could not validate — the acquired demo row + object persist, recovery is
// Story 3.6/3.8); an anomaly is NOT an error (rows upserted, demo.validation_state='anomalous', warn logged).
func parseAndRecord(ctx context.Context, s store.DemoStore, parser Parser, statRec db.StatRecorder, roster db.RosterReader, matchID, demoID int64, storageKey string) (parseOutcome, error) {
	rc, err := s.Get(ctx, storageKey)
	if err != nil {
		return parseOutcome{}, fmt.Errorf("read stored demo %q for parse (match %d): %w", storageKey, matchID, err)
	}
	defer rc.Close()
	result, err := parser.Parse(rc)
	if err != nil {
		return parseOutcome{}, fmt.Errorf("parse demo (match %d): %w", matchID, err)
	}

	// Map each parsed player to a stat_row, converting SteamID64 uint64 -> 17-digit decimal text (AD-4;
	// the DB layer never sees the numeric form) and stamping match/demo/rounds provenance. Only
	// kills/deaths/rounds_played/rounds_won — the Epic-5 stat columns stay NULL.
	rows := make([]db.StatRow, 0, len(result.Players))
	for _, pl := range result.Players {
		sid := strconv.FormatUint(pl.SteamID64, 10)
		// Defense-in-depth mirror of stat_row's `steamid64 ~ '^[0-9]{17}$'` CHECK. FormatUint emits only
		// digits, so for a uint64 `len == 17` is exactly that CHECK. A non-zero id that isn't 17 digits
		// would make RecordParse's single-transaction batch upsert roll back EVERY player's row for this
		// match (23514) and wedge the demo. The parser already skips SteamID64 == 0; skip (and log) any
		// other malformed id so one phantom entity can't wipe the whole match. A resulting K/D imbalance
		// is exactly what Story 3.4's Σkills==Σdeaths gate is designed to catch.
		if len(sid) != 17 {
			log.Printf("warn: match %d: skipping stat_row for SteamID64 %q (not a 17-digit id; parser anomaly)", matchID, sid)
			continue
		}
		rows = append(rows, db.StatRow{
			MatchID:      matchID,
			SteamID64:    sid,
			DemoID:       demoID,
			Kills:        pl.Kills,
			Deaths:       pl.Deaths,
			RoundsPlayed: result.RoundsPlayed,
			RoundsWon:    pl.RoundsWon, // the FR-16 demo-derived tally (Story 4.6a)
		})
	}
	// Validate the just-parsed rows against the ACTIVE roster BEFORE recording (Story 3.4, the Validating
	// node). Fail CLOSED: if the roster read errors, do NOT record a parse we could not validate — the
	// acquired demo row + object persist (write-once), recovery is Story 3.6/3.8.
	rosterSet, err := roster.ActiveSteamIDs(ctx)
	if err != nil {
		return parseOutcome{}, fmt.Errorf("read active roster to validate (match %d): %w", matchID, err)
	}
	val := Validate(result, rows, rosterSet)
	if val.Anomalous {
		// Never silent (SOLUTION-DESIGN §6): a structured warn line names the match + the reasons. The
		// worker only SETS + logs the hold flag; the admin accept-anomaly decision is Epic 4.
		log.Printf("warn: match %d ANOMALOUS: %v", matchID, val.Reasons)
	}
	// The stat rows are upserted either way (the anomaly is a hold flag on demo, not a write-block); the
	// validation outcome is stamped on the demo row in the SAME transaction.
	if err := statRec.RecordParse(ctx, demoID, ParserVersion, rows, val); err != nil {
		return parseOutcome{}, fmt.Errorf("record stat rows (match %d): %w", matchID, err)
	}
	return parseOutcome{Players: len(rows), Rounds: result.RoundsPlayed, Anomalous: val.Anomalous, Reasons: val.Reasons}, nil
}

// checkDemHeader reads the leading magic and rewinds. It rejects a non-Source-2 file (CS:GO Source-1
// "HL2DEMO" is unsupported). A cheap guard against a wrong-format upload — it is NOT a parse.
func checkDemHeader(f *os.File) error {
	head := make([]byte, len(dem2Magic))
	if _, err := io.ReadFull(f, head); err != nil {
		return fmt.Errorf("read demo header: %w", err)
	}
	if !bytes.Equal(head, dem2Magic) {
		return fmt.Errorf("not a Source-2 CS2 demo (missing PBDEMS2 header; CS:GO Source-1 HL2DEMO is unsupported)")
	}
	if _, err := f.Seek(0, io.SeekStart); err != nil {
		return fmt.Errorf("rewind demo file: %w", err)
	}
	return nil
}
