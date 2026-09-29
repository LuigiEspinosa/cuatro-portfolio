package store

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"sync"
	"time"
)

// FakeStore is an in-memory DemoStore for `go test` — no test hits real R2 (mirrors the TS injectable
// HttpPost/HttpGetJson seams from Epic 2). It reports the R2 backend id so demo-row shape assertions
// match production, and it enforces the same retention guard as the R2 impl.
type FakeStore struct {
	mu      sync.Mutex
	objects map[string][]byte
}

var _ DemoStore = (*FakeStore)(nil)

// NewFakeStore returns an empty in-memory store.
func NewFakeStore() *FakeStore {
	return &FakeStore{objects: make(map[string][]byte)}
}

// Backend reports r2 so recorded rows match production shape.
func (f *FakeStore) Backend() StorageBackend { return BackendR2 }

// Put reads the full reader into memory under key (tests use small fixtures).
func (f *FakeStore) Put(_ context.Context, key string, r io.Reader, _ int64) error {
	data, err := io.ReadAll(r)
	if err != nil {
		return err
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	buf := make([]byte, len(data))
	copy(buf, data)
	f.objects[key] = buf
	return nil
}

// PresignPut returns a deterministic fake URL embedding the key (no real signing).
func (f *FakeStore) PresignPut(_ context.Context, key string, _ time.Duration) (string, error) {
	return "https://fake-r2.local/" + key + "?sig=test", nil
}

// Get returns a reader over a copy of the stored bytes (for the round-trip re-hash test).
func (f *FakeStore) Get(_ context.Context, key string) (io.ReadCloser, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	data, ok := f.objects[key]
	if !ok {
		return nil, fmt.Errorf("fake store: no object at %q", key)
	}
	buf := make([]byte, len(data))
	copy(buf, data)
	return io.NopCloser(bytes.NewReader(buf)), nil
}

// Delete removes an object after the shared retention guard.
func (f *FakeStore) Delete(_ context.Context, key, retentionClass string, force bool) error {
	if err := guardDelete(retentionClass, force); err != nil {
		return err
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.objects, key)
	return nil
}

// Object returns the stored bytes for key (test helper).
func (f *FakeStore) Object(key string) ([]byte, bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	b, ok := f.objects[key]
	return b, ok
}

// Len reports how many objects are stored (test helper).
func (f *FakeStore) Len() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.objects)
}
