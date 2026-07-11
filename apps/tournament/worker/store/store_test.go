package store

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"strings"
	"testing"
)

func TestNewStorageKey(t *testing.T) {
	k1, err := NewStorageKey(42)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(k1, "demos/42/") || !strings.HasSuffix(k1, ".dem") {
		t.Fatalf("unexpected key shape: %q", k1)
	}
	k2, _ := NewStorageKey(42)
	if k1 == k2 {
		t.Fatalf("keys must be unique per upload, got %q twice", k1)
	}
}

func TestFakeStoreRoundTrip(t *testing.T) {
	// AD-1: a stored object re-hashes byte-for-byte to its input bytes (the round-trip invariant the
	// R2 impl must also satisfy in live-QA).
	s := NewFakeStore()
	ctx := context.Background()
	input := []byte("PBDEMS2\x00 some demo bytes for the round-trip test …")
	key := "demos/1/x.dem"

	if err := s.Put(ctx, key, bytes.NewReader(input), int64(len(input))); err != nil {
		t.Fatal(err)
	}
	rc, err := s.Get(ctx, key)
	if err != nil {
		t.Fatal(err)
	}
	defer rc.Close()
	got, err := io.ReadAll(rc)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, input) {
		t.Fatal("round-trip bytes differ")
	}
	if sha256.Sum256(got) != sha256.Sum256(input) {
		t.Fatal("round-trip sha256 differs")
	}
}

// TestPutTeeHashRoundTrip proves the AD-1 invariant over the RECORDED hash (not merely byte-equality):
// hashing WHILE Put streams (the io.TeeReader the acquire path uses) yields a sha256 that a later Get +
// re-hash reproduces byte-for-byte. "The stored demo re-hashes byte-for-byte to its recorded SHA-256."
func TestPutTeeHashRoundTrip(t *testing.T) {
	s := NewFakeStore()
	ctx := context.Background()
	input := []byte("PBDEMS2\x00 canonical demo bytes for the recorded-hash round-trip …")
	key := "demos/1/tee.dem"

	// Compute the hash in the SAME single pass that streams to storage (mirrors ingest.Acquire).
	hasher := sha256.New()
	if err := s.Put(ctx, key, io.TeeReader(bytes.NewReader(input), hasher), int64(len(input))); err != nil {
		t.Fatal(err)
	}
	recorded := hex.EncodeToString(hasher.Sum(nil))

	rc, err := s.Get(ctx, key)
	if err != nil {
		t.Fatal(err)
	}
	defer rc.Close()
	stored, err := io.ReadAll(rc)
	if err != nil {
		t.Fatal(err)
	}
	rehash := sha256.Sum256(stored)
	if hex.EncodeToString(rehash[:]) != recorded {
		t.Fatalf("stored object does not re-hash to the recorded sha256: got %s want %s", hex.EncodeToString(rehash[:]), recorded)
	}
}

func TestFakeStoreDeleteRetentionGuard(t *testing.T) {
	s := NewFakeStore()
	ctx := context.Background()
	put := func(key string) {
		if err := s.Put(ctx, key, bytes.NewReader([]byte("x")), 1); err != nil {
			t.Fatal(err)
		}
	}

	// event_archive deletes freely.
	put("demos/1/a.dem")
	if err := s.Delete(ctx, "demos/1/a.dem", RetentionEventArchive, false); err != nil {
		t.Fatalf("event_archive delete should succeed: %v", err)
	}
	if _, ok := s.Object("demos/1/a.dem"); ok {
		t.Fatal("object should be gone after delete")
	}

	// permanent_seed is refused without force (AD-16 delete-proofing).
	put("demos/1/seed.dem")
	if err := s.Delete(ctx, "demos/1/seed.dem", RetentionPermanentSeed, false); err != ErrPermanentSeedProtected {
		t.Fatalf("permanent_seed delete should be refused, got %v", err)
	}
	if _, ok := s.Object("demos/1/seed.dem"); !ok {
		t.Fatal("a refused permanent_seed object must remain")
	}

	// …but force overrides (the explicit-override escape hatch).
	if err := s.Delete(ctx, "demos/1/seed.dem", RetentionPermanentSeed, true); err != nil {
		t.Fatalf("forced permanent_seed delete should succeed: %v", err)
	}
}
