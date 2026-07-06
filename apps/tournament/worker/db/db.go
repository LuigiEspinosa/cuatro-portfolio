// Package db writes the demo acquisition row via a direct Supabase Postgres connection (AD-2 single
// writer). The worker connects as the database owner (SUPABASE_DB_PASSWORD), which bypasses RLS — the
// service-role-equivalent write path. It writes ONLY the acquisition record (never stat_row — that is
// Story 3.3's single-writer table). The recorder is an interface so `go test` injects a fake with no
// real DB (the Go analogue of Epic 2's HttpPost seam).
package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// DemoRow is the acquisition record inserted at the Acquiring node (Story 3.1). demo_sha256 and
// parser_version are left NULL (shells) — Story 3.2 (hash) and Story 3.3 (parse) backfill them.
type DemoRow struct {
	MatchID        int64
	StorageBackend string
	StorageKey     string
	SizeBytes      int64 // 0 => recorded as NULL (an unknown size)
	Source         string
}

// DemoRecorder persists a demo acquisition row. Injectable for tests.
type DemoRecorder interface {
	RecordDemo(ctx context.Context, row DemoRow) error
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

// RecordDemo inserts the acquisition row. demo_sha256/parser_version are omitted (NULL shells);
// retention_class/parse_generation/archived_at take their column defaults. A 0 size is stored as NULL.
func (r *PgxRecorder) RecordDemo(ctx context.Context, row DemoRow) error {
	var sizeBytes *int64
	if row.SizeBytes > 0 {
		sizeBytes = &row.SizeBytes
	}
	_, err := r.pool.Exec(ctx,
		`insert into demo (match_id, storage_backend, storage_key, size_bytes, source)
		 values ($1, $2, $3, $4, $5)`,
		row.MatchID, row.StorageBackend, row.StorageKey, sizeBytes, row.Source,
	)
	if err != nil {
		return fmt.Errorf("insert demo acquisition row (match %d): %w", row.MatchID, err)
	}
	return nil
}
