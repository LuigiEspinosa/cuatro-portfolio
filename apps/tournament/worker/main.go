// Command worker is the CS2 demo-ingestion worker (Epic 3). It runs off Vercel (Railway host) so the
// 50–170 MB demo bytes bypass the ~4.5 MB Vercel request cap (SPEC Constraint 6). Two modes:
//
//	worker serve                        # HTTP: MatchZy auto-upload receiver + admin presign endpoint
//	worker ingest <path.dem> --match <id>   # CLI: ingest a local .dem
//
// Story 3.1 covers acquisition only (store the .dem in R2 + record the demo row). Hashing/dedup is
// Story 3.2; parse→stat_row is Story 3.3; the async job queue is Story 3.8.
package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"cs-tournament/worker/config"
	"cs-tournament/worker/db"
	"cs-tournament/worker/ingest"
	"cs-tournament/worker/store"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	switch os.Args[1] {
	case "serve":
		if err := runServe(); err != nil {
			log.Fatalf("serve: %v", err)
		}
	case "ingest":
		if err := runIngest(os.Args[2:]); err != nil {
			log.Fatalf("ingest: %v", err)
		}
	default:
		usage()
		os.Exit(2)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, "usage:")
	fmt.Fprintln(os.Stderr, "  worker serve")
	fmt.Fprintln(os.Stderr, "  worker ingest <path.dem> --match <id>")
}

// build wires the real R2 store + pgx recorder from the environment (fail-fast on missing config).
func build(ctx context.Context) (store.DemoStore, *db.PgxRecorder, config.Config, error) {
	cfg, err := config.Load()
	if err != nil {
		return nil, nil, config.Config{}, err
	}
	rec, err := db.NewPgxRecorder(ctx, cfg.DatabaseURL)
	if err != nil {
		return nil, nil, config.Config{}, err
	}
	return store.NewR2Store(cfg), rec, cfg, nil
}

func runServe() error {
	ctx := context.Background()
	s, rec, cfg, err := build(ctx)
	if err != nil {
		return err
	}
	defer rec.Close()
	if cfg.MatchZySharedSecret == "" {
		return fmt.Errorf("WORKER_MATCHZY_SHARED_SECRET is required for serve mode")
	}
	srv := &ingest.Server{Store: s, Recorder: rec, Secret: cfg.MatchZySharedSecret}
	addr := ":" + port()
	log.Printf("worker listening on %s (POST /ingest/matchzy, POST /ingest/presign)", addr)
	return http.ListenAndServe(addr, srv.Routes())
}

func runIngest(args []string) error {
	path, matchID, err := parseIngestArgs(args)
	if err != nil {
		return err
	}
	ctx := context.Background()
	s, rec, _, err := build(ctx)
	if err != nil {
		return err
	}
	defer rec.Close()
	key, err := ingest.RunCLI(ctx, s, rec, path, matchID)
	if err != nil {
		return err
	}
	log.Printf("ingested %s -> %s", path, key)
	return nil
}

// parseIngestArgs accepts the flag in any position (Go's flag package would stop at the first
// positional), so both `ingest <path> --match <id>` and `ingest --match <id> <path>` work.
func parseIngestArgs(args []string) (path string, matchID int64, err error) {
	for i := 0; i < len(args); i++ {
		a := args[i]
		switch {
		case a == "--match" || a == "-match":
			if i+1 >= len(args) {
				return "", 0, fmt.Errorf("--match requires a value")
			}
			matchID, err = strconv.ParseInt(args[i+1], 10, 64)
			if err != nil {
				return "", 0, fmt.Errorf("--match: %w", err)
			}
			i++
		case strings.HasPrefix(a, "--match="):
			matchID, err = strconv.ParseInt(strings.TrimPrefix(a, "--match="), 10, 64)
			if err != nil {
				return "", 0, fmt.Errorf("--match: %w", err)
			}
		default:
			if path != "" {
				return "", 0, fmt.Errorf("unexpected extra argument %q", a)
			}
			path = a
		}
	}
	if path == "" {
		return "", 0, fmt.Errorf("path to a .dem file is required: worker ingest <path.dem> --match <id>")
	}
	return path, matchID, nil
}

func port() string {
	if p := strings.TrimSpace(os.Getenv("PORT")); p != "" {
		return p
	}
	return "8080"
}
