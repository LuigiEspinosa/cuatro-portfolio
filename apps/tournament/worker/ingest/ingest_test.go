package ingest

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"testing"

	"cs-tournament/worker/db"
	"cs-tournament/worker/store"
)

func TestAcquireStoresThenRecords(t *testing.T) {
	s := store.NewFakeStore()
	rec := db.NewFakeRecorder()
	body := demoBytes()

	res, err := Acquire(context.Background(), s, rec, AcquireMeta{MatchID: 7, Source: SourceMatchzy}, bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if res.AlreadyIngested {
		t.Fatal("a fresh demo must not be reported already_ingested")
	}
	if res.DemoID == 0 {
		t.Fatal("a fresh acquire must carry a non-zero demo provenance id (stat_row.demo_id)")
	}

	obj, ok := s.Object(res.StorageKey)
	if !ok {
		t.Fatalf("object not stored under %q", res.StorageKey)
	}
	if !bytes.Equal(obj, body) {
		t.Fatal("stored bytes differ from the input")
	}

	wantSHA := hex.EncodeToString(sum256(body))
	if res.SHA256 != wantSHA {
		t.Fatalf("result sha256 mismatch: got %q want %q", res.SHA256, wantSHA)
	}

	rows := rec.Recorded()
	if len(rows) != 1 {
		t.Fatalf("want exactly 1 recorded row, got %d", len(rows))
	}
	r := rows[0]
	if r.MatchID != 7 || r.Source != SourceMatchzy || r.StorageBackend != string(store.BackendR2) || r.StorageKey != res.StorageKey {
		t.Fatalf("unexpected recorded row: %+v", r)
	}
	if r.SizeBytes != int64(len(body)) {
		t.Fatalf("streamed size should be counted: got %d want %d", r.SizeBytes, len(body))
	}
	if r.SHA256 != wantSHA {
		t.Fatalf("recorded row sha256 mismatch: got %q want %q", r.SHA256, wantSHA)
	}
}

func sum256(b []byte) []byte {
	h := sha256.Sum256(b)
	return h[:]
}

// TestAcquireRecordedHashRoundTrip closes the AC1 round-trip END-TO-END in one assertion: the object
// Acquire stored, fetched back and re-hashed, equals the demo_sha256 RECORDED on the row (not merely the
// input bytes). "The stored raw demo re-hashes byte-for-byte to the recorded demo_sha256" (AD-1).
func TestAcquireRecordedHashRoundTrip(t *testing.T) {
	s := store.NewFakeStore()
	rec := db.NewFakeRecorder()
	ctx := context.Background()

	res, err := Acquire(ctx, s, rec, AcquireMeta{MatchID: 42, Source: SourceMatchzy}, bytes.NewReader(demoBytes()))
	if err != nil {
		t.Fatal(err)
	}
	rows := rec.Recorded()
	if len(rows) != 1 {
		t.Fatalf("want exactly 1 recorded row, got %d", len(rows))
	}
	recorded := rows[0].SHA256
	if recorded == "" {
		t.Fatal("the worker path must record a non-empty demo_sha256")
	}

	// Fetch the stored object back (the production re-hash path) and re-hash it: it must equal the hash
	// RECORDED on the demo row, proving the retained object is verifiable against its recorded sha256.
	rc, err := s.Get(ctx, res.StorageKey)
	if err != nil {
		t.Fatal(err)
	}
	defer rc.Close()
	stored, err := io.ReadAll(rc)
	if err != nil {
		t.Fatal(err)
	}
	if got := hex.EncodeToString(sum256(stored)); got != recorded {
		t.Fatalf("stored object does not re-hash to the RECORDED demo_sha256: got %s want %s", got, recorded)
	}
}

// TestAcquireDedupSecondIsAlreadyIngested proves the AD-3 short-circuit: re-acquiring the SAME bytes for
// the SAME match writes no second row, reports AlreadyIngested with the PRIOR key, and deletes the
// redundant just-uploaded object (R2 does not grow).
func TestAcquireDedupSecondIsAlreadyIngested(t *testing.T) {
	s := store.NewFakeStore()
	rec := db.NewFakeRecorder()
	body := demoBytes()

	first, err := Acquire(context.Background(), s, rec, AcquireMeta{MatchID: 7, Source: SourceMatchzy}, bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if s.Len() != 1 {
		t.Fatalf("want 1 stored object after the first acquire, got %d", s.Len())
	}

	second, err := Acquire(context.Background(), s, rec, AcquireMeta{MatchID: 7, Source: SourceMatchzy}, bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if !second.AlreadyIngested {
		t.Fatal("the second identical acquire must be reported already_ingested")
	}
	if second.StorageKey != first.StorageKey {
		t.Fatalf("already_ingested must return the PRIOR key: got %q want %q", second.StorageKey, first.StorageKey)
	}
	if second.SHA256 != first.SHA256 {
		t.Fatalf("the recomputed sha256 must match the first: got %q want %q", second.SHA256, first.SHA256)
	}
	if second.DemoID != first.DemoID {
		t.Fatalf("an already_ingested acquire must return the PRIOR row's demo id: got %d want %d", second.DemoID, first.DemoID)
	}
	if len(rec.Recorded()) != 1 {
		t.Fatalf("a duplicate must not add a second row, have %d", len(rec.Recorded()))
	}
	if s.Len() != 1 {
		t.Fatalf("the redundant just-uploaded object must be deleted (R2 must not grow): objects=%d", s.Len())
	}
	if _, ok := s.Object(first.StorageKey); !ok {
		t.Fatal("the PRIOR object must be retained (write-once = first copy wins)")
	}
}

// TestAcquireDifferentMatchNoFalseDedup proves the same bytes under a DIFFERENT match are two rows.
func TestAcquireDifferentMatchNoFalseDedup(t *testing.T) {
	s := store.NewFakeStore()
	rec := db.NewFakeRecorder()
	body := demoBytes()

	if _, err := Acquire(context.Background(), s, rec, AcquireMeta{MatchID: 7, Source: SourceMatchzy}, bytes.NewReader(body)); err != nil {
		t.Fatal(err)
	}
	res, err := Acquire(context.Background(), s, rec, AcquireMeta{MatchID: 8, Source: SourceMatchzy}, bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if res.AlreadyIngested {
		t.Fatal("the same bytes under a different match must NOT dedup")
	}
	if len(rec.Recorded()) != 2 || s.Len() != 2 {
		t.Fatalf("want 2 rows + 2 objects, got %d rows / %d objects", len(rec.Recorded()), s.Len())
	}
}

func TestAcquireUsesExplicitSize(t *testing.T) {
	s := store.NewFakeStore()
	rec := db.NewFakeRecorder()
	_, err := Acquire(context.Background(), s, rec,
		AcquireMeta{MatchID: 1, Size: 999, Source: SourceManualUpload}, bytes.NewReader(demoBytes()))
	if err != nil {
		t.Fatal(err)
	}
	if got := rec.Recorded()[0].SizeBytes; got != 999 {
		t.Fatalf("an explicit meta.Size should win over the counter, got %d", got)
	}
}

// putErrStore is a DemoStore whose Put always fails (to prove the record step is skipped).
type putErrStore struct{ *store.FakeStore }

func (putErrStore) Put(context.Context, string, io.Reader, int64) error {
	return errors.New("put boom")
}

func TestAcquirePutErrorSkipsRecord(t *testing.T) {
	rec := db.NewFakeRecorder()
	s := putErrStore{store.NewFakeStore()}
	if _, err := Acquire(context.Background(), s, rec,
		AcquireMeta{MatchID: 1, Source: SourceMatchzy}, bytes.NewReader(demoBytes())); err == nil {
		t.Fatal("expected the put error to propagate")
	}
	if len(rec.Recorded()) != 0 {
		t.Fatal("must not record a row when the store fails (no row pointing at a missing object)")
	}
}

func TestAcquireRecordErrorPropagates(t *testing.T) {
	s := store.NewFakeStore()
	rec := db.NewFakeRecorder()
	rec.Err = errors.New("db boom")
	if _, err := Acquire(context.Background(), s, rec,
		AcquireMeta{MatchID: 1, Source: SourceMatchzy}, bytes.NewReader(demoBytes())); err == nil {
		t.Fatal("expected the record error to propagate")
	}
}
