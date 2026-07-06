// Package config loads the worker's server-only configuration from the environment (AD-25).
// Every value is a secret or an infrastructure endpoint — never exposed to any browser and never
// mirrored to a NEXT_PUBLIC_ variable. The names match .env.example (R2_* + WORKER_MATCHZY_SHARED_SECRET
// on lines 44–52, SUPABASE_URL/SUPABASE_DB_PASSWORD on lines 15/22). No net-new env names are invented.
package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"
)

// Config is the resolved worker configuration.
type Config struct {
	R2AccountID         string
	R2AccessKeyID       string
	R2SecretAccessKey   string
	R2Bucket            string
	R2S3Endpoint        string
	MatchZySharedSecret string // the worker↔MatchZy (and admin-presign) shared secret; required for serve mode
	DatabaseURL         string // derived from SUPABASE_URL + SUPABASE_DB_PASSWORD (direct owner connection, bypasses RLS)
}

// Load reads and validates the worker configuration, failing fast (a single error listing every
// missing required var). R2 credentials + the derived DB URL are required by BOTH modes (serve and
// CLI both store→record). The MatchZy shared secret is validated at serve start (CLI does not need it).
func Load() (Config, error) {
	get := func(name string) string { return strings.TrimSpace(os.Getenv(name)) }

	cfg := Config{
		R2AccountID:         get("R2_ACCOUNT_ID"),
		R2AccessKeyID:       get("R2_ACCESS_KEY_ID"),
		R2SecretAccessKey:   get("R2_SECRET_ACCESS_KEY"),
		R2Bucket:            get("R2_BUCKET"),
		R2S3Endpoint:        get("R2_S3_ENDPOINT"),
		MatchZySharedSecret: get("WORKER_MATCHZY_SHARED_SECRET"),
	}

	required := map[string]string{
		"R2_ACCOUNT_ID":        cfg.R2AccountID,
		"R2_ACCESS_KEY_ID":     cfg.R2AccessKeyID,
		"R2_SECRET_ACCESS_KEY": cfg.R2SecretAccessKey,
		"R2_BUCKET":            cfg.R2Bucket,
		"R2_S3_ENDPOINT":       cfg.R2S3Endpoint,
	}
	var missing []string
	for name, value := range required {
		if value == "" {
			missing = append(missing, name)
		}
	}
	if len(missing) > 0 {
		return Config{}, fmt.Errorf("missing required worker env: %s", strings.Join(missing, ", "))
	}

	dbURL, err := buildDatabaseURL(get("SUPABASE_URL"), get("SUPABASE_DB_PASSWORD"))
	if err != nil {
		return Config{}, err
	}
	cfg.DatabaseURL = dbURL

	return cfg, nil
}

// buildDatabaseURL derives the Postgres DSN for the worker's direct (owner/service-role) DB access
// from the Supabase project URL and the database password — no net-new env name. Supabase's hosted
// direct-connection pattern is db.<ref>.supabase.co:5432 (user postgres, db postgres, TLS required).
// The local dev stack (`supabase start`) instead exposes Postgres on 127.0.0.1:54322 (no TLS), so for
// local verify (Task 9) point SUPABASE_URL at http://127.0.0.1:54321 and this maps to the local DB.
func buildDatabaseURL(supabaseURL, password string) (string, error) {
	if supabaseURL == "" {
		return "", fmt.Errorf("SUPABASE_URL is required to derive the worker DB connection")
	}
	if password == "" {
		return "", fmt.Errorf("SUPABASE_DB_PASSWORD is required for direct worker DB access")
	}
	u, err := url.Parse(supabaseURL)
	if err != nil {
		return "", fmt.Errorf("SUPABASE_URL is not a valid URL: %w", err)
	}
	host := u.Hostname()
	if host == "" {
		return "", fmt.Errorf("SUPABASE_URL %q has no host", supabaseURL)
	}
	// Local dev stack: the API gateway is 127.0.0.1:54321; Postgres is on 54322 (no TLS).
	if host == "127.0.0.1" || host == "localhost" {
		return fmt.Sprintf("postgresql://postgres:%s@127.0.0.1:54322/postgres?sslmode=disable", url.QueryEscape(password)), nil
	}
	// Hosted: https://<ref>.supabase.co -> db.<ref>.supabase.co:5432 (TLS required).
	ref := strings.TrimSuffix(host, ".supabase.co")
	if ref == host || ref == "" {
		return "", fmt.Errorf("SUPABASE_URL host %q is not a *.supabase.co project URL (or 127.0.0.1/localhost)", host)
	}
	return fmt.Sprintf("postgresql://postgres:%s@db.%s.supabase.co:5432/postgres?sslmode=require", url.QueryEscape(password), ref), nil
}
