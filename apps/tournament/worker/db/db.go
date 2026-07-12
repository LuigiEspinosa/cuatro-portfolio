// Package db writes the demo acquisition row AND the parsed stat_row rows via a direct Supabase Postgres
// connection (AD-2 single writer). The worker connects as the database owner (SUPABASE_DB_PASSWORD),
// which bypasses RLS — the service-role-equivalent write path. It is the sole writer of BOTH `demo`
// (acquisition — Story 3.1/3.2) and `stat_row` (parse — Story 3.3); no app/anon/authenticated path
// writes either. The recorders are interfaces so `go test` injects fakes with no real DB (the Go
// analogue of Epic 2's HttpPost seam).
package db

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DemoRow is the acquisition record inserted at the Acquiring node (Story 3.1). SHA256 is the SHA-256
// of the exact stored .dem bytes (Story 3.2, computed while streaming); an empty SHA256 records a NULL
// demo_sha256 (the admin manual-upload path, which does not hash — Epic 5). parser_version is left NULL
// (a shell) until Story 3.3 backfills it.
type DemoRow struct {
	MatchID        int64
	StorageBackend string
	StorageKey     string
	SizeBytes      int64 // 0 => recorded as NULL (an unknown size)
	Source         string
	SHA256         string // "" => recorded as NULL demo_sha256 (manual path); a real hash on the worker paths
}

// RecordOutcome reports whether RecordDemo inserted a new row or short-circuited to an existing one
// (the AD-3 idempotency key bit). On a duplicate (match_id, demo_sha256) the insert does nothing and
// ExistingKey carries the prior row's storage_key so the caller can return the prior result. DemoID is
// the demo row's PK either way (the just-inserted id, or the prior row's id on a dedup) — the parse step
// (Story 3.3) stamps it as stat_row.demo_id provenance.
type RecordOutcome struct {
	Inserted    bool   // true => a new row was written; false => a duplicate (match_id, demo_sha256) already existed
	ExistingKey string // the row's storage_key: the just-inserted key when Inserted, else the prior row's key
	DemoID      int64  // the demo row's PK (provenance for stat_row.demo_id): the new id when Inserted, else the prior row's id
}

// DemoRecorder persists a demo acquisition row and reports whether it deduped. Injectable for tests.
type DemoRecorder interface {
	RecordDemo(ctx context.Context, row DemoRow) (RecordOutcome, error)
}

// PgxRecorder is the production DemoRecorder backed by a pgx connection pool.
type PgxRecorder struct {
	pool *pgxpool.Pool
}

var _ DemoRecorder = (*PgxRecorder)(nil)

// NewPgxRecorder opens a pooled connection to the worker DB URL.
func NewPgxRecorder(ctx context.Context, databaseURL string) (*PgxRecorder, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("connect worker DB: %w", err)
	}
	return &PgxRecorder{pool: pool}, nil
}

// Close releases the pool.
func (r *PgxRecorder) Close() {
	if r.pool != nil {
		r.pool.Close()
	}
}

// RecordDemo inserts the acquisition row and enforces the AD-3 idempotency key. It inserts demo_sha256
// with ON CONFLICT (match_id, demo_sha256) DO NOTHING RETURNING id, storage_key: a returned row means a
// new row (Inserted); zero rows means a duplicate (match_id, demo_sha256) already exists, so it fetches
// the prior row's id + storage_key and reports Inserted=false (the caller short-circuits to the prior
// result). Either way DemoID carries the demo PK so Story 3.3's parse can stamp stat_row.demo_id
// provenance. parser_version is omitted (a NULL shell Story 3.3 stamps on parse);
// retention_class/parse_generation/archived_at take their column defaults. A 0 size / empty SHA256 are
// stored as NULL (a NULL sha256 never dedups — NULLs are distinct in the UNIQUE — which is exactly how
// the un-hashed manual path stays unaffected).
func (r *PgxRecorder) RecordDemo(ctx context.Context, row DemoRow) (RecordOutcome, error) {
	var sizeBytes *int64
	if row.SizeBytes > 0 {
		sizeBytes = &row.SizeBytes
	}
	var sha *string
	if row.SHA256 != "" {
		sha = &row.SHA256
	}
	var insertedID int64
	var insertedKey string
	err := r.pool.QueryRow(ctx,
		`insert into demo (match_id, storage_backend, storage_key, size_bytes, source, demo_sha256)
		 values ($1, $2, $3, $4, $5, $6)
		 on conflict (match_id, demo_sha256) do nothing
		 returning id, storage_key`,
		row.MatchID, row.StorageBackend, row.StorageKey, sizeBytes, row.Source, sha,
	).Scan(&insertedID, &insertedKey)
	switch {
	case err == nil:
		return RecordOutcome{Inserted: true, ExistingKey: insertedKey, DemoID: insertedID}, nil
	case errors.Is(err, pgx.ErrNoRows):
		// Conflict on (match_id, demo_sha256): the row already exists. Fetch its id + storage_key so the
		// caller returns the prior result (AD-3 short-circuit) with the prior row's provenance id.
		var existingID int64
		var existingKey string
		if e := r.pool.QueryRow(ctx,
			`select id, storage_key from demo where match_id = $1 and demo_sha256 = $2`,
			row.MatchID, row.SHA256,
		).Scan(&existingID, &existingKey); e != nil {
			return RecordOutcome{}, fmt.Errorf("fetch existing demo key (match %d): %w", row.MatchID, e)
		}
		return RecordOutcome{Inserted: false, ExistingKey: existingKey, DemoID: existingID}, nil
	default:
		return RecordOutcome{}, fmt.Errorf("insert demo acquisition row (match %d): %w", row.MatchID, err)
	}
}

// Pool exposes the shared connection pool so a sibling recorder (PgxStatRecorder) can reuse it — the
// PgxRecorder owns the pool's lifecycle (Close closes it); the stat recorder only borrows it.
func (r *PgxRecorder) Pool() *pgxpool.Pool { return r.pool }

// StatRow is one parsed player's row destined for the single-writer stat_row table (AD-2). SteamID64 is
// the 17-digit decimal TEXT (the caller converts the parser's uint64 via strconv.FormatUint — the DB
// layer never sees the numeric form). Story 3.3 fills MatchID/SteamID64/DemoID + Kills/Deaths/
// RoundsPlayed; the rich Epic-5 stat columns stay NULL (the parser does not compute them yet).
type StatRow struct {
	MatchID      int64
	SteamID64    string
	DemoID       int64
	Kills        int
	Deaths       int
	RoundsPlayed int
}

// StatRecorder upserts a match's parsed stat rows and stamps the demo's parser_version — the worker is the
// single writer of stat_row (AD-2), just as it is of demo. Injectable for tests (FakeStatRecorder).
type StatRecorder interface {
	// RecordParse stamps demo.parser_version and upserts rows in ONE transaction (the AD-3/AD-26
	// idempotent-parse spirit). A re-parse REPLACES a player's row via ON CONFLICT (match_id, steamid64)
	// DO UPDATE; it does NOT delete SteamIDs absent from the new parse (that delete-missing is Story 3.6).
	RecordParse(ctx context.Context, demoID int64, parserVersion string, rows []StatRow) error
}

// PgxStatRecorder is the production StatRecorder. It borrows the PgxRecorder's pool (see PgxRecorder.Pool)
// so both single-writer paths share one pool; the PgxRecorder owns Close.
type PgxStatRecorder struct {
	pool *pgxpool.Pool
}

var _ StatRecorder = (*PgxStatRecorder)(nil)

// NewPgxStatRecorder builds a stat recorder over an existing (shared) pool.
func NewPgxStatRecorder(pool *pgxpool.Pool) *PgxStatRecorder {
	return &PgxStatRecorder{pool: pool}
}

// RecordParse stamps demo.parser_version and upserts the match's stat rows in ONE transaction, so a parse
// is all-or-nothing. The upsert is ON CONFLICT (match_id, steamid64) DO UPDATE, so a re-parse REPLACES a
// player's row rather than duplicating it; status keeps its 'pending' default (the anomaly gate is Story
// 3.4). It does NOT delete SteamIDs missing from the new parse — that delete-missing is Story 3.6. An
// empty rows slice still stamps parser_version + commits (a zero-player parse is written unconditionally;
// Story 3.4 owns the non-zero-rows validation).
func (r *PgxStatRecorder) RecordParse(ctx context.Context, demoID int64, parserVersion string, rows []StatRow) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin parse tx (demo %d): %w", demoID, err)
	}
	defer tx.Rollback(ctx) // a no-op once Commit succeeds; rolls back on any early return (fail-closed)

	if _, err := tx.Exec(ctx,
		`update demo set parser_version = $1 where id = $2`,
		parserVersion, demoID,
	); err != nil {
		return fmt.Errorf("stamp parser_version (demo %d): %w", demoID, err)
	}

	if len(rows) > 0 {
		batch := &pgx.Batch{}
		for _, row := range rows {
			batch.Queue(
				`insert into stat_row (match_id, steamid64, demo_id, kills, deaths, rounds_played)
				 values ($1, $2, $3, $4, $5, $6)
				 on conflict (match_id, steamid64) do update set
				   kills = excluded.kills,
				   deaths = excluded.deaths,
				   rounds_played = excluded.rounds_played,
				   demo_id = excluded.demo_id`,
				row.MatchID, row.SteamID64, row.DemoID, row.Kills, row.Deaths, row.RoundsPlayed,
			)
		}
		br := tx.SendBatch(ctx, batch)
		for range rows {
			if _, err := br.Exec(); err != nil {
				_ = br.Close()
				return fmt.Errorf("upsert stat_row (demo %d): %w", demoID, err)
			}
		}
		if err := br.Close(); err != nil {
			return fmt.Errorf("close stat_row batch (demo %d): %w", demoID, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit parse tx (demo %d): %w", demoID, err)
	}
	return nil
}
