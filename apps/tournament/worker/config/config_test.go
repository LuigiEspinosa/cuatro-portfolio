package config

import (
	"strings"
	"testing"
)

func TestBuildDatabaseURLHosted(t *testing.T) {
	got, err := buildDatabaseURL("https://abcdef.supabase.co", "p@ss word")
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
	got, err := buildDatabaseURL("http://127.0.0.1:54321", "postgres")
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

func TestBuildDatabaseURLErrors(t *testing.T) {
	cases := map[string]struct{ url, pw string }{
		"empty url":         {"", "pw"},
		"empty password":    {"https://x.supabase.co", ""},
		"non-supabase host": {"https://example.com", "pw"},
	}
	for name, c := range cases {
		if _, err := buildDatabaseURL(c.url, c.pw); err == nil {
			t.Errorf("%s: expected an error, got nil", name)
		}
	}
}
