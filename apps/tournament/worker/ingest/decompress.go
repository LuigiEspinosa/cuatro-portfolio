package ingest

import (
	"archive/zip"
	"bufio"
	"bytes"
	"compress/gzip"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
)

// Framing magic prefixes.
var (
	gzipMagic = []byte{0x1f, 0x8b}
	zipMagic  = []byte{0x50, 0x4b, 0x03, 0x04} // "PK\x03\x04"
)

// decompressToDem returns a reader over the canonical .dem bytes regardless of how MatchZy framed the
// upload (AD-1: the retained object must be the raw .dem — the re-hashable source of truth and the
// fairness-seed input SHA-256(final_demo_bytes), taken over the .dem, not the zip). It auto-detects the
// framing so the receiver is robust to whatever the deployed MatchZy build sends (the exact
// compression is pinned at deploy — Task 9 / Epic 7):
//
//   - gzip  (0x1f 0x8b)   → streamed via gzip.Reader (no full-body buffering)
//   - zip   (PK\x03\x04)  → the single .dem entry. A zip's central directory is at the END, so it needs
//     random access; the COMPRESSED body is spooled to a temp file (disk, not RAM) and the entry is
//     streamed from there. The decompressed 50–170 MB never lands fully in memory.
//   - raw   (PBDEMS2)     → passed through unchanged.
//
// The returned ReadCloser MUST be Closed by the caller (it releases the gzip reader / removes the temp
// file for the zip path).
func decompressToDem(r io.Reader) (io.ReadCloser, error) {
	br := bufio.NewReader(r)
	head, err := br.Peek(8)
	if err != nil && err != io.EOF {
		return nil, fmt.Errorf("read upload header: %w", err)
	}
	var dem io.ReadCloser
	switch {
	case bytes.HasPrefix(head, gzipMagic):
		zr, err := gzip.NewReader(br)
		if err != nil {
			return nil, fmt.Errorf("gzip open: %w", err)
		}
		dem = zr
	case bytes.HasPrefix(head, zipMagic):
		dem, err = openZipDem(br)
		if err != nil {
			return nil, err
		}
	case bytes.HasPrefix(head, dem2Magic):
		dem = io.NopCloser(br)
	default:
		return nil, fmt.Errorf("unrecognized demo upload framing (not gzip, zip, or a PBDEMS2 .dem)")
	}
	// Ceiling the DECOMPRESSED .dem so a gzip/zip bomb cannot stream unbounded bytes to R2. The raw
	// request body is separately capped by http.MaxBytesReader in the handler; this guards the far
	// larger decompressed output. io.LimitReader would silently TRUNCATE at the cap (a truncated demo
	// must FAIL the acquisition, never be stored as canonical) — so newLimitedReadCloser errors instead.
	return newLimitedReadCloser(dem, maxDemoBytes), nil
}

// maxDemoBytes bounds an ingest upload — both the raw request body (via http.MaxBytesReader in the
// handler) and the decompressed .dem stream (via newLimitedReadCloser above) — so a misconfigured or
// hostile source holding the shared secret cannot stream an unbounded object to R2 or fill the worker's
// disk. Defense-in-depth: the ingest endpoints are already shared-secret gated. 300 MiB comfortably
// exceeds the 50–170 MB demo size (the PoC's largest was ~170 MB).
const maxDemoBytes = 300 << 20 // 300 MiB

// errUploadTooLarge is returned when an ingest stream exceeds maxDemoBytes.
var errUploadTooLarge = errors.New("ingest upload exceeds max demo size (300 MiB)")

// limitedReadCloser wraps a ReadCloser and returns errUploadTooLarge once the stream reads past n bytes.
// Unlike io.LimitReader — which silently returns EOF at the limit and would let a truncated body be
// stored as a "complete" demo — this fails the read so the acquisition aborts (no partial demo is kept).
type limitedReadCloser struct {
	rc io.ReadCloser
	n  int64 // bytes still permitted before the stream is over-limit
}

func newLimitedReadCloser(rc io.ReadCloser, n int64) *limitedReadCloser {
	return &limitedReadCloser{rc: rc, n: n}
}

func (l *limitedReadCloser) Read(p []byte) (int, error) {
	if l.n < 0 {
		return 0, errUploadTooLarge
	}
	if int64(len(p)) > l.n+1 { // read at most one byte past the cap to detect an over-limit stream
		p = p[:l.n+1]
	}
	read, err := l.rc.Read(p)
	l.n -= int64(read)
	if l.n < 0 {
		return read, errUploadTooLarge
	}
	return read, err
}

func (l *limitedReadCloser) Close() error { return l.rc.Close() }

// openZipDem spools the compressed zip to a temp file (zip needs io.ReaderAt) and returns a reader over
// the first .dem entry that removes the temp file on Close.
func openZipDem(r io.Reader) (io.ReadCloser, error) {
	tmp, err := os.CreateTemp("", "matchzy-*.zip")
	if err != nil {
		return nil, fmt.Errorf("zip spool temp: %w", err)
	}
	cleanup := func() {
		_ = tmp.Close()
		_ = os.Remove(tmp.Name())
	}

	size, err := io.Copy(tmp, r)
	if err != nil {
		cleanup()
		return nil, fmt.Errorf("zip spool copy: %w", err)
	}
	zr, err := zip.NewReader(tmp, size)
	if err != nil {
		cleanup()
		return nil, fmt.Errorf("zip open: %w", err)
	}
	for _, f := range zr.File {
		if strings.HasSuffix(strings.ToLower(f.Name), ".dem") {
			entry, err := f.Open()
			if err != nil {
				cleanup()
				return nil, fmt.Errorf("zip entry open %q: %w", f.Name, err)
			}
			return &zipEntryReader{entry: entry, cleanup: cleanup}, nil
		}
	}
	cleanup()
	return nil, fmt.Errorf("zip contains no .dem entry")
}

// zipEntryReader streams a zip entry and removes the spooled temp file on Close.
type zipEntryReader struct {
	entry   io.ReadCloser
	cleanup func()
}

func (z *zipEntryReader) Read(p []byte) (int, error) { return z.entry.Read(p) }

func (z *zipEntryReader) Close() error {
	err := z.entry.Close()
	z.cleanup()
	return err
}
