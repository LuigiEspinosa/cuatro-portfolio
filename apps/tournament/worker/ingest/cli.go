package ingest

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"

	"cs-tournament/worker/db"
	"cs-tournament/worker/store"
)

// RunCLI ingests a local .dem (AC3): validate the Source-2 header, stream the file to object storage,
// and record the acquisition row (source=manual_upload). The same store→record core as the HTTP paths.
func RunCLI(ctx context.Context, s store.DemoStore, rec db.DemoRecorder, path string, matchID int64) (string, error) {
	if matchID <= 0 {
		return "", fmt.Errorf("--match <id> is required and must be a positive integer")
	}
	f, err := os.Open(path)
	if err != nil {
		return "", fmt.Errorf("open %q: %w", path, err)
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return "", fmt.Errorf("stat %q: %w", path, err)
	}
	if err := checkDemHeader(f); err != nil {
		return "", err
	}

	return Acquire(ctx, s, rec, AcquireMeta{
		MatchID: matchID,
		Size:    info.Size(),
		Source:  SourceManualUpload,
	}, f)
}

// checkDemHeader reads the leading magic and rewinds. It rejects a non-Source-2 file (CS:GO Source-1
// "HL2DEMO" is unsupported). A cheap guard against a wrong-format upload — it is NOT a parse.
func checkDemHeader(f *os.File) error {
	head := make([]byte, len(dem2Magic))
	if _, err := io.ReadFull(f, head); err != nil {
		return fmt.Errorf("read demo header: %w", err)
	}
	if !bytes.Equal(head, dem2Magic) {
		return fmt.Errorf("not a Source-2 CS2 demo (missing PBDEMS2 header; CS:GO Source-1 HL2DEMO is unsupported)")
	}
	if _, err := f.Seek(0, io.SeekStart); err != nil {
		return fmt.Errorf("rewind demo file: %w", err)
	}
	return nil
}
