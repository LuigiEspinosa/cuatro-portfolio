package ingest

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"strconv"

	"cs-tournament/worker/db"
	"cs-tournament/worker/store"
)

// ReparseResult reports what `worker reparse` did (Story 3.6): the match + its retained demo of record
// (DemoID/StorageKey — never a fresh acquire), the re-derived player + round counts, and the Story-3.4
// validation outcome re-run over the fresh parse. The new demo.parse_generation is NOT surfaced here — the
// atomic RecordReparse returns only an error (the generation bump is verified at live-QA by re-SELECTing
// demo.parse_generation, and asserted in unit tests via the fake's Generation accessor).
type ReparseResult struct {
	MatchID    int64
	DemoID     int64
	StorageKey string
	Players    int                // stat_row rows upserted by the re-parse
	Rounds     int                // rounds played reported by the parser
	Anomalous  bool               // Story 3.4: a validation gate failed → the match is HELD (demo.validation_state='anomalous')
	Reasons    []db.AnomalyReason // the machine-readable gate failures (nil when clean)
}

// RunReparse deliberately re-parses a match's RETAINED demo, re-deriving its stat_row rows from the
// immutable raw .dem (FR-14, AD-1/AD-3). It is a DISTINCT action from RunCLI's fresh-acquire path: it looks
// up the match's demo of record (DemoReader), reads the stored object BACK from the DemoStore (never
// re-acquires: no Put, no new demo row, no new storage_key), tees those bytes through a sha256 hasher WHILE
// parsing and asserts the re-hash equals the recorded demo_sha256 (AD-1 — a mismatch means corruption/
// tampering, so it FAILS CLOSED and records nothing), maps + re-validates (the Story-3.4 gates) exactly as
// RunCLI does, then hands the fresh rows to RecordReparse — the ONE transaction that upserts (preserving
// status) AND deletes the now-absent SteamIDs AND bumps parse_generation. The republish side-effects
// (advance bracket / post feed / recompute leaderboards) and the audited command route are Epic 4; the
// async job + MatchZy-HTTP trigger are Story 3.8.
func RunReparse(ctx context.Context, s store.DemoStore, reader db.DemoReader, parser Parser, statRec db.StatRecorder, roster db.RosterReader, matchID int64) (ReparseResult, error) {
	if matchID <= 0 {
		return ReparseResult{}, fmt.Errorf("--match <id> is required and must be a positive integer")
	}

	// Look up the retained demo of record — the source of truth is the stored object, never a fresh upload.
	ref, err := reader.DemoForMatch(ctx, matchID)
	if err != nil {
		return ReparseResult{}, err // fail closed: no retained demo => nothing to re-parse
	}

	// Read the RETAINED object back and tee it through sha256 WHILE the parser drains the stream (AD-1
	// single-pass re-hash-verify — the same io.TeeReader→sha256 pattern Acquire uses at ingest time). R2's
	// Get returns the immutable bytes; we never Put/Delete on the re-parse path.
	rc, err := s.Get(ctx, ref.StorageKey)
	if err != nil {
		return ReparseResult{}, fmt.Errorf("read retained demo %q for re-parse (match %d): %w", ref.StorageKey, matchID, err)
	}
	defer rc.Close()
	hasher := sha256.New()
	result, err := parser.Parse(io.TeeReader(rc, hasher))
	if err != nil {
		return ReparseResult{}, fmt.Errorf("parse retained demo (match %d): %w", matchID, err)
	}
	// Drain any bytes the parser left unread straight into the hasher: the re-hash MUST cover the WHOLE
	// stored object (demo_sha256 was computed at ingest over every byte via Acquire's tee→Put), not just
	// what the parser happened to consume. demoinfocs' ParseToEnd stops at the demo's stop command and may
	// leave a trailing tail unread — without this drain a valid retained demo could re-hash short and fail
	// closed on EVERY re-parse. Decouples hash correctness from the parser's read-behavior (and a future
	// demoinfocs bump). io.Copy writes the remaining bytes to the hasher (an io.Writer); rc is Closed above.
	if _, err := io.Copy(hasher, rc); err != nil {
		return ReparseResult{}, fmt.Errorf("drain retained demo for re-hash (match %d): %w", matchID, err)
	}

	// Assert the retained object re-hashes byte-for-byte to its recorded demo_sha256 (AD-1). A mismatch
	// means the stored object was corrupted or altered — a re-parse must NEVER silently re-derive from it,
	// so fail closed with nothing written. Skip only the un-hashed manual path (NULL demo_sha256 => empty).
	if ref.SHA256 != "" {
		got := hex.EncodeToString(hasher.Sum(nil))
		if got != ref.SHA256 {
			return ReparseResult{}, fmt.Errorf("re-parse aborted (match %d): retained demo %q re-hashes to %s but demo_sha256 is %s — object corrupted or altered; nothing re-derived", matchID, ref.StorageKey, got, ref.SHA256)
		}
	} else {
		log.Printf("warn: match %d: re-parse skipping sha256 re-hash-verify (demo recorded on the un-hashed manual path; NULL demo_sha256)", matchID)
	}

	// Map each parsed player to a stat_row, stamping the RETAINED demo's id as provenance (never a new demo
	// row). Reuse RunCLI's 17-digit SteamID64 guard verbatim (a phantom/relay entity can't wedge the batch).
	rows := make([]db.StatRow, 0, len(result.Players))
	for _, pl := range result.Players {
		sid := strconv.FormatUint(pl.SteamID64, 10)
		if len(sid) != 17 {
			log.Printf("warn: match %d: skipping stat_row for SteamID64 %q (not a 17-digit id; parser anomaly)", matchID, sid)
			continue
		}
		rows = append(rows, db.StatRow{
			MatchID:      matchID,
			SteamID64:    sid,
			DemoID:       ref.DemoID,
			Kills:        pl.Kills,
			Deaths:       pl.Deaths,
			RoundsPlayed: result.RoundsPlayed,
			RoundsWon:    pl.RoundsWon, // re-derived on every re-parse, exactly like K/D (Story 4.6a)
			// The FR-18 core seven (Story 5.1). ⚠ MUST mirror cli.go's first-parse map verbatim — dropping
			// any field here silently writes NULL over that column on every re-parse (the recurring Epic-4
			// "second path" failure mode). Both sites map PlayerStat -> StatRow; both carry all FIFTEEN
			// derived fields (the core seven here, the FR-19 weird five and the FR-20 derived three below).
			// Widen this count whenever you widen the map, or the warning stops describing what it guards.
			Assists:       pl.Assists,
			ADRDamage:     pl.ADRDamage,
			HSKills:       pl.HSKills,
			MVPs:          pl.MVPs,
			FlashAssists:  pl.FlashAssists,
			UtilityDamage: pl.UtilityDamage,
			KASTRounds:    pl.KASTRounds,
			// The FR-19 weird five (Story 5.2), under the SAME mirror warning — and unconditionally, so a
			// re-parse of a player with none of them re-writes explicit zeros, never NULLs.
			KnifeKills:        pl.KnifeKills,
			WallbangKills:     pl.WallbangKills,
			ThroughSmokeKills: pl.ThroughSmokeKills,
			NoScopeKills:      pl.NoScopeKills,
			BlindKills:        pl.BlindKills,
			// The FR-20 derived three (Story 5.3), under the SAME mirror warning. Dropping Clutches here is
			// WORSE than dropping an int: a nil map renders as `{}`, so a re-parse would silently ERASE a
			// player's clutch history with no error anywhere.
			EntryFrags:    pl.EntryFrags,
			OpeningDeaths: pl.OpeningDeaths,
			Clutches:      pl.Clutches,
		})
	}

	// Re-validate against the ACTIVE roster BEFORE recording (Story 3.4). Fail CLOSED on a roster-read error:
	// never record a re-parse we could not validate (the retained demo + object are untouched — AD-1).
	rosterSet, err := roster.ActiveSteamIDs(ctx)
	if err != nil {
		return ReparseResult{}, fmt.Errorf("read active roster to validate re-parse (match %d): %w", matchID, err)
	}
	val := Validate(result, rows, rosterSet)
	if val.Anomalous {
		// Never silent (SOLUTION-DESIGN §6): a structured warn line names the match + reasons. The re-stamp
		// of demo.validation_state is the ORTHOGONAL anomaly axis — it does NOT flip stat_row.status (AD-7).
		log.Printf("warn: match %d re-parse ANOMALOUS: %v", matchID, val.Reasons)
	}

	// The ONE atomic transaction (AD-3 revert→reparse): upsert (status-preserving) + delete-missing +
	// parse_generation bump. All-or-nothing — published truth jumps old→corrected with no Pending window.
	if err := statRec.RecordReparse(ctx, matchID, ref.DemoID, ParserVersion, rows, val); err != nil {
		return ReparseResult{}, fmt.Errorf("record re-parse (match %d): %w", matchID, err)
	}

	return ReparseResult{
		MatchID:    matchID,
		DemoID:     ref.DemoID,
		StorageKey: ref.StorageKey,
		Players:    len(rows),
		Rounds:     result.RoundsPlayed,
		Anomalous:  val.Anomalous,
		Reasons:    val.Reasons,
	}, nil
}
