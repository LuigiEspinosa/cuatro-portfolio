// Package db writes the demo acquisition row via a direct Supabase Postgres connection (AD-2 single
// writer). The worker connects as the database owner (SUPABASE_DB_PASSWORD), which bypasses RLS — the
// service-role-equivalent write path. It writes ONLY the acquisition record (never stat_row — that is
// Story 3.3's single-writer table). The recorder is an interface so `go test` injects a fake with no
// real DB (the Go analogue of Epic 2's HttpPost seam).
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
// ExistingKey carries the prior row's storage_key so the caller can return the prior result.
type RecordOutcome struct {
	Inserted    bool   // true => a new row was written; false => a duplicate (match_id, demo_sha256) already existed
	ExistingKey string // the row's storage_key: the just-inserted key when Inserted, else the prior row's key
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
// with ON CONFLICT (match_id, demo_sha256) DO NOTHING RETURNING storage_key: a returned key means a new
// row (Inserted); zero rows means a duplicate (match_id, demo_sha256) already exists, so it fetches the
// prior row's storage_key and reports Inserted=false (the caller short-circuits to the prior result).
// parser_version is omitted (a NULL shell); retention_class/parse_generation/archived_at take their
// column defaults. A 0 size / empty SHA256 are stored as NULL (a NULL sha256 never dedups — NULLs are
// distinct in the UNIQUE — which is exactly how the un-hashed manual path stays unaffected).
func (r *PgxRecorder) RecordDemo(ctx context.Context, row DemoRow) (RecordOutcome, error) {
	var sizeBytes *int64
	if row.SizeBytes > 0 {
		sizeBytes = &row.SizeBytes
	}
	var sha *string
	if row.SHA256 != "" {
		sha = &row.SHA256
	}
	var insertedKey string
	err := r.pool.QueryRow(ctx,
		`insert into demo (match_id, storage_backend, storage_key, size_bytes, source, demo_sha256)
		 values ($1, $2, $3, $4, $5, $6)
		 on conflict (match_id, demo_sha256) do nothing
		 returning storage_key`,
		row.MatchID, row.StorageBackend, row.StorageKey, sizeBytes, row.Source, sha,
	).Scan(&insertedKey)
	switch {
	case err == nil:
		return RecordOutcome{Inserted: true, ExistingKey: insertedKey}, nil
	case errors.Is(err, pgx.ErrNoRows):
		// Conflict on (match_id, demo_sha256): the row already exists. Fetch its storage_key so the
		// caller returns the prior result (AD-3 short-circuit).
		var existingKey string
		if e := r.pool.QueryRow(ctx,
			`select storage_key from demo where match_id = $1 and demo_sha256 = $2`,
			row.MatchID, row.SHA256,
		).Scan(&existingKey); e != nil {
			return RecordOutcome{}, fmt.Errorf("fetch existing demo key (match %d): %w", row.MatchID, e)
		}
		return RecordOutcome{Inserted: false, ExistingKey: existingKey}, nil
	default:
		return RecordOutcome{}, fmt.Errorf("insert demo acquisition row (match %d): %w", row.MatchID, err)
	}
}
