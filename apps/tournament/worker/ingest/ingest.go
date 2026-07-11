// Package ingest is the acquisition core (the Acquiring node of the ingest state machine). It streams
// the canonical .dem to object storage and records the acquisition row — the shared store→record core
// of the MatchZy auto-upload and CLI paths. It stops at acquisition: NO hashing (Story 3.2), NO parse
// (Story 3.3), NO job queue (Story 3.8). The admin manual-upload path records via the Next.js
// /api/ingest/register route instead (this package only mints its presigned URL — see server.go).
package ingest

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"log"

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

// AcquireResult is the outcome of an acquire. StorageKey is the authoritative object key (the just-
// stored key on a fresh demo; the PRIOR row's key when AlreadyIngested). SHA256 is the hex SHA-256 of
// the exact stored .dem bytes. AlreadyIngested is true when a byte-identical demo for this match was
// already recorded, so this acquire short-circuited to the prior result (AD-3).
type AcquireResult struct {
	StorageKey      string
	SHA256          string
	AlreadyIngested bool
}

// Acquire streams the canonical .dem to object storage, computing its SHA-256 in the SAME single pass
// (io.TeeReader into a sha256 hasher — zero extra memory/disk, and the hash is provably over exactly the
// stored bytes, AD-1), then records the acquisition row with that hash. Store happens BEFORE record so a
// row always points at a real object. Dedup is at the record step (the hash is only known after the
// stream): if the row's (match_id, demo_sha256) already exists, the record short-circuits to the prior
// row and Acquire deletes the redundant just-uploaded object (byte-identical to the retained prior one;
// the retention guard permits event_archive). It never buffers the full body and never parses.
func Acquire(ctx context.Context, s store.DemoStore, rec db.DemoRecorder, meta AcquireMeta, r io.Reader) (AcquireResult, error) {
	key, err := store.NewStorageKey(meta.MatchID)
	if err != nil {
		return AcquireResult{}, err
	}

	// Single pass: the counter tallies the true .dem length (for size_bytes when unknown upfront), the
	// tee feeds every byte the store reads into the hasher. Ordering the counter INSIDE the tee keeps the
	// count over the real .dem bytes and the hash over exactly what Put streams to storage.
	counter := &countingReader{r: r}
	hasher := sha256.New()
	if err := s.Put(ctx, key, io.TeeReader(counter, hasher), meta.Size); err != nil {
		return AcquireResult{}, err
	}
	sha := hex.EncodeToString(hasher.Sum(nil))

	size := meta.Size
	if size == 0 {
		size = counter.n
	}
	outcome, err := rec.RecordDemo(ctx, db.DemoRow{
		MatchID:        meta.MatchID,
		StorageBackend: string(s.Backend()),
		StorageKey:     key,
		SizeBytes:      size,
		Source:         meta.Source,
		SHA256:         sha,
	})
	if err != nil {
		return AcquireResult{}, err
	}
	if outcome.Inserted {
		return AcquireResult{StorageKey: key, SHA256: sha}, nil
	}

	// AlreadyIngested: a byte-identical demo for this match already exists. The object we just uploaded
	// is a redundant duplicate of the retained prior object — delete it so R2 stays clean (first real
	// DemoStore.Delete caller; event_archive => the guard permits it). If the delete fails the DB already
	// has no duplicate row (correctness holds), so log and continue; Epic-7 GC is the backstop.
	if delErr := s.Delete(ctx, key, store.RetentionEventArchive, false); delErr != nil {
		log.Printf("[acquire] match %d already ingested; failed to delete redundant object %s: %v", meta.MatchID, key, delErr)
	}
	return AcquireResult{StorageKey: outcome.ExistingKey, SHA256: sha, AlreadyIngested: true}, nil
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
