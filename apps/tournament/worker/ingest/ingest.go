// Package ingest is the acquisition core (the Acquiring node of the ingest state machine). It streams
// the canonical .dem to object storage and records the acquisition row — the shared store→record core
// of the MatchZy auto-upload and CLI paths. It stops at acquisition: NO hashing (Story 3.2), NO parse
// (Story 3.3), NO job queue (Story 3.8). The admin manual-upload path records via the Next.js
// /api/ingest/register route instead (this package only mints its presigned URL — see server.go).
package ingest

import (
	"context"
	"io"

	"cs-tournament/worker/db"
	"cs-tournament/worker/store"
)

// Source values — must match the demo.source CHECK (migration 0005).
const (
	SourceMatchzy      = "matchzy"
	SourceManualUpload = "manual_upload"
)

// dem2Magic is the Source-2 (CS2) demo header. Source-1 (CS:GO) demos start with "HL2DEMO" and are
// unsupported (PoC README L15–16). Used only as a cheap acquisition sanity check — NOT a parse.
var dem2Magic = []byte("PBDEMS2")

// AcquireMeta carries the acquisition metadata recorded alongside the stored bytes.
type AcquireMeta struct {
	MatchID int64
	Size    int64 // decompressed .dem size when known upfront (CLI); 0 => count the streamed bytes
	Source  string
}

// Acquire streams the canonical .dem to object storage and records the acquisition row. Store happens
// BEFORE record so the row always points at a real object (a record failure leaves an orphan object,
// which 3.2's hash+dedup reconciles — never a row pointing at nothing). It never buffers the full body
// and never parses. Returns the opaque storage key.
func Acquire(ctx context.Context, s store.DemoStore, rec db.DemoRecorder, meta AcquireMeta, r io.Reader) (string, error) {
	key, err := store.NewStorageKey(meta.MatchID)
	if err != nil {
		return "", err
	}

	// Count the streamed bytes so a path that does not know the size upfront (MatchZy's streamed,
	// decompressed body) still records a real size_bytes. The counter reflects the true .dem length.
	counter := &countingReader{r: r}
	if err := s.Put(ctx, key, counter, meta.Size); err != nil {
		return "", err
	}

	size := meta.Size
	if size == 0 {
		size = counter.n
	}
	if err := rec.RecordDemo(ctx, db.DemoRow{
		MatchID:        meta.MatchID,
		StorageBackend: string(s.Backend()),
		StorageKey:     key,
		SizeBytes:      size,
		Source:         meta.Source,
	}); err != nil {
		return "", err
	}
	return key, nil
}

// countingReader tallies the bytes read through it (to record a streamed body's size after Put).
type countingReader struct {
	r io.Reader
	n int64
}

func (c *countingReader) Read(p []byte) (int, error) {
	n, err := c.r.Read(p)
	c.n += int64(n)
	return n, err
}
