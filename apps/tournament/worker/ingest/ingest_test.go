package ingest

import (
	"bytes"
	"context"
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

	key, err := Acquire(context.Background(), s, rec, AcquireMeta{MatchID: 7, Source: SourceMatchzy}, bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}

	obj, ok := s.Object(key)
	if !ok {
		t.Fatalf("object not stored under %q", key)
	}
	if !bytes.Equal(obj, body) {
		t.Fatal("stored bytes differ from the input")
	}

	rows := rec.Recorded()
	if len(rows) != 1 {
		t.Fatalf("want exactly 1 recorded row, got %d", len(rows))
	}
	r := rows[0]
	if r.MatchID != 7 || r.Source != SourceMatchzy || r.StorageBackend != string(store.BackendR2) || r.StorageKey != key {
		t.Fatalf("unexpected recorded row: %+v", r)
	}
	if r.SizeBytes != int64(len(body)) {
		t.Fatalf("streamed size should be counted: got %d want %d", r.SizeBytes, len(body))
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
