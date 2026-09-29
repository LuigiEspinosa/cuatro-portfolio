package ingest

import (
	"archive/zip"
	"bytes"
	"compress/gzip"
	"errors"
	"io"
	"testing"
)

// demoBytes is a tiny fake .dem payload (PBDEMS2 header) shared across the ingest package tests.
func demoBytes() []byte {
	return []byte("PBDEMS2\x00\x01\x02 fake demo payload for unit tests …")
}

func TestDecompressGzip(t *testing.T) {
	var buf bytes.Buffer
	zw := gzip.NewWriter(&buf)
	if _, err := zw.Write(demoBytes()); err != nil {
		t.Fatal(err)
	}
	zw.Close()

	rc, err := decompressToDem(&buf)
	if err != nil {
		t.Fatal(err)
	}
	defer rc.Close()
	got, _ := io.ReadAll(rc)
	if !bytes.Equal(got, demoBytes()) {
		t.Fatal("gzip-decompressed bytes differ from the canonical .dem")
	}
}

func TestDecompressZip(t *testing.T) {
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	f, err := zw.Create("match_1.dem")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.Write(demoBytes()); err != nil {
		t.Fatal(err)
	}
	zw.Close()

	rc, err := decompressToDem(&buf)
	if err != nil {
		t.Fatal(err)
	}
	defer rc.Close()
	got, _ := io.ReadAll(rc)
	if !bytes.Equal(got, demoBytes()) {
		t.Fatal("zip .dem entry bytes differ from the canonical .dem")
	}
}

func TestDecompressRawPassthrough(t *testing.T) {
	rc, err := decompressToDem(bytes.NewReader(demoBytes()))
	if err != nil {
		t.Fatal(err)
	}
	defer rc.Close()
	got, _ := io.ReadAll(rc)
	if !bytes.Equal(got, demoBytes()) {
		t.Fatal("raw PBDEMS2 passthrough bytes differ")
	}
}

func TestDecompressUnknownFraming(t *testing.T) {
	if _, err := decompressToDem(bytes.NewReader([]byte("not a demo at all, no magic"))); err == nil {
		t.Fatal("expected an error for unrecognized framing")
	}
}

func TestLimitedReadCloserErrorsPastCap(t *testing.T) {
	// A stream exactly at the cap passes with no truncation error.
	atCap := newLimitedReadCloser(io.NopCloser(bytes.NewReader(bytes.Repeat([]byte("d"), 10))), 10)
	got, err := io.ReadAll(atCap)
	if err != nil {
		t.Fatalf("at-cap stream: unexpected error %v", err)
	}
	if len(got) != 10 {
		t.Fatalf("at-cap stream: read %d bytes, want 10", len(got))
	}
	// A stream one byte past the cap FAILS (does not silently truncate like io.LimitReader), so a
	// decompression bomb aborts the acquisition instead of storing a truncated object.
	overCap := newLimitedReadCloser(io.NopCloser(bytes.NewReader(bytes.Repeat([]byte("d"), 11))), 10)
	if _, err := io.ReadAll(overCap); !errors.Is(err, errUploadTooLarge) {
		t.Fatalf("over-cap stream: got error %v, want errUploadTooLarge", err)
	}
}
