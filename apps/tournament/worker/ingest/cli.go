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
// DemoID) plus, when a FRESH acquire triggered a parse, the parsed player + round counts. Parsed is false
// when an AlreadyIngested re-run short-circuited the parse (AD-3).
type CLIResult struct {
	AcquireResult
	Parsed  bool // true => this run parsed + upserted stat_row; false => AlreadyIngested skipped the parse
	Players int  // stat_row rows upserted (0 when Parsed is false)
	Rounds  int  // rounds played reported by the parser (0 when Parsed is false)
}

// RunCLI ingests a local .dem end-to-end (AC5): validate the Source-2 header, stream the file to object
// storage (computing its SHA-256 in the same pass) and record the acquisition row, then — on a FRESH
// acquire — read the stored object back, parse it, and upsert the per-player stat_row rows as the single
// writer. The whole Acquiring → Hashing → Deduped → Parsing chain in one operator command (the local-
// verify path 3.1/3.2 QA used). An AlreadyIngested re-run reports the short-circuit and SKIPS the parse
// (its stat rows already exist — AD-3; deliberate re-parse is Story 3.6). The MatchZy-HTTP-triggered
// parse + the bounded async queue are Story 3.8 (not wired here).
func RunCLI(ctx context.Context, s store.DemoStore, rec db.DemoRecorder, parser Parser, statRec db.StatRecorder, path string, matchID int64) (CLIResult, error) {
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

	// Fresh acquire: parse the RETAINED object (AD-1 source of truth), not a tee of the upload — demoinfocs
	// consumes the whole stream, and this read-back is exactly the path Story 3.6 re-parse reuses. R2 is
	// read-after-write consistent for a new PUT, so the just-stored object is immediately readable.
	rc, err := s.Get(ctx, acq.StorageKey)
	if err != nil {
		return CLIResult{}, fmt.Errorf("read stored demo %q for parse (match %d): %w", acq.StorageKey, matchID, err)
	}
	defer rc.Close()
	result, err := parser.Parse(rc)
	if err != nil {
		return CLIResult{}, fmt.Errorf("parse demo (match %d): %w", matchID, err)
	}

	// Map each parsed player to a stat_row, converting SteamID64 uint64 -> 17-digit decimal text (AD-4;
	// the DB layer never sees the numeric form) and stamping match/demo/rounds provenance. Only
	// kills/deaths/rounds_played — the Epic-5 stat columns stay NULL.
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
			DemoID:       acq.DemoID,
			Kills:        pl.Kills,
			Deaths:       pl.Deaths,
			RoundsPlayed: result.RoundsPlayed,
		})
	}
	if err := statRec.RecordParse(ctx, acq.DemoID, ParserVersion, rows); err != nil {
		return CLIResult{}, fmt.Errorf("record stat rows (match %d): %w", matchID, err)
	}
	res.Parsed = true
	res.Players = len(rows)
	res.Rounds = result.RoundsPlayed
	return res, nil
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
