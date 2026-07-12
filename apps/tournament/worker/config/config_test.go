package config

import (
	"strings"
	"testing"
)

func TestBuildDatabaseURLHosted(t *testing.T) {
	got, err := buildDatabaseURL("", "https://abcdef.supabase.co", "p@ss word")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// @ and space must be percent-encoded so the DSN is valid.
	want := "postgresql://postgres:p%40ss+word@db.abcdef.supabase.co:5432/postgres?sslmode=require"
	if got != want {
		t.Fatalf("hosted DSN\n got %q\nwant %q", got, want)
	}
}

func TestBuildDatabaseURLLocal(t *testing.T) {
	got, err := buildDatabaseURL("", "http://127.0.0.1:54321", "postgres")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(got, "@127.0.0.1:54322/postgres") {
		t.Fatalf("local DSN should target the local DB port: %q", got)
	}
	if !strings.Contains(got, "sslmode=disable") {
		t.Fatalf("local DSN should disable TLS: %q", got)
	}
}

// A DATABASE_URL override wins verbatim and needs NEITHER SUPABASE_URL NOR the password — the
// IPv4/pooler escape hatch (Story 3.1 live-QA finding): the operator owns the whole pooler DSN.
func TestBuildDatabaseURLOverrideWins(t *testing.T) {
	pooler := "postgresql://postgres.abcdef:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"
	got, err := buildDatabaseURL(pooler, "", "")
	if err != nil {
		t.Fatalf("override must not require SUPABASE_URL/password: %v", err)
	}
	if got != pooler {
		t.Fatalf("override DSN must be used verbatim\n got %q\nwant %q", got, pooler)
	}
	// It also wins over a present (would-be-derived) hosted URL.
	got, err = buildDatabaseURL(pooler, "https://abcdef.supabase.co", "other")
	if err != nil {
		t.Fatal(err)
	}
	if got != pooler {
		t.Fatalf("override must win over the derived hosted DSN: got %q", got)
	}
}

func TestBuildDatabaseURLErrors(t *testing.T) {
	cases := map[string]struct{ url, pw string }{
		"empty url":         {"", "pw"},
		"empty password":    {"https://x.supabase.co", ""},
		"non-supabase host": {"https://example.com", "pw"},
	}
	for name, c := range cases {
		if _, err := buildDatabaseURL("", c.url, c.pw); err == nil {
			t.Errorf("%s: expected an error, got nil", name)
		}
	}
}
