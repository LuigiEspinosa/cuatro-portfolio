// Package store is the demo-blob storage abstraction (AD-16). A DemoStore hides the backend so the
// DB records only opaque (storage_backend, storage_key) — never R2 specifics. R2 is the v1 primary; an
// in-memory fake backs `go test`; a Supabase-Storage backend is deferred (YAGNI — R2 is primary).
package store

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"time"
)

// StorageBackend is the opaque backend id recorded in the demo row (AD-16). Callers never branch on it.
type StorageBackend string

// BackendR2 is the Cloudflare R2 backend (the v1 primary and only built impl).
const BackendR2 StorageBackend = "r2"

// RetentionPermanentSeed marks an object that must be delete-proofed (AD-16). Story-3.1 enforces the
// Go-side guard below; storage-layer object-lock hardening is Epic 7.
const RetentionPermanentSeed = "permanent_seed"

// RetentionEventArchive is the default retention class (recorded since Story 3.1). Unlike
// permanent_seed it is freely deletable — the Story-3.2 orphan-cleanup path (deleting the redundant
// object left by an AlreadyIngested re-upload) relies on the guard permitting it.
const RetentionEventArchive = "event_archive"

// ErrPermanentSeedProtected is returned by Delete when asked to remove a permanent_seed object without
// an explicit override — the Go-side half of AD-16 delete-proofing.
var ErrPermanentSeedProtected = errors.New("store: refusing to delete a permanent_seed object without force")

// DemoStore abstracts durable demo-blob storage (AD-16).
type DemoStore interface {
	// Backend returns the opaque backend id recorded in the demo row.
	Backend() StorageBackend
	// Put streams the demo bytes to key. Used by the MatchZy + CLI paths (server-side upload). size is
	// advisory (the decompressed .dem size when known); a backend may stream without relying on it.
	Put(ctx context.Context, key string, r io.Reader, size int64) error
	// PresignPut mints a time-limited URL the browser PUTs the demo bytes to directly (bypassing
	// Vercel) — the admin manual-upload path. ≤5 GB single PUT covers the 50–170 MB demo size.
	PresignPut(ctx context.Context, key string, expiry time.Duration) (string, error)
	// Get opens the stored object for the AD-1 byte-for-byte re-hash round-trip. Caller Closes it.
	Get(ctx context.Context, key string) (io.ReadCloser, error)
	// Delete removes an object. Retention-guarded: it refuses a permanent_seed object unless force is
	// set (AD-16 delete-proofing; object-lock hardening is Epic 7).
	Delete(ctx context.Context, key, retentionClass string, force bool) error
}

// NewStorageKey builds an opaque, match-scoped, collision-resistant object key. The sha256 is unknown
// at acquisition (hashing is Story 3.2), so the key is deliberately NOT content-addressed here. The
// structure is opaque — Story 3.2/3.3 must not depend on it.
func NewStorageKey(matchID int64) (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", fmt.Errorf("generate storage key: %w", err)
	}
	return fmt.Sprintf("demos/%d/%s.dem", matchID, hex.EncodeToString(b[:])), nil
}

// guardDelete is the retention guard shared by every backend so the rule is enforced identically.
func guardDelete(retentionClass string, force bool) error {
	if retentionClass == RetentionPermanentSeed && !force {
		return ErrPermanentSeedProtected
	}
	return nil
}
