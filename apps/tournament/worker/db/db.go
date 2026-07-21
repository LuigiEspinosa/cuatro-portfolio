// Package db writes the demo acquisition row AND the parsed stat_row rows via a direct Supabase Postgres
// connection (AD-2 single writer). The worker connects as the database owner (SUPABASE_DB_PASSWORD),
// which bypasses RLS — the service-role-equivalent write path. It is the sole writer of BOTH `demo`
// (acquisition — Story 3.1/3.2) and `stat_row` (parse — Story 3.3); no app/anon/authenticated path
// writes either. The recorders are interfaces so `go test` injects fakes with no real DB (the Go
// analogue of Epic 2's HttpPost seam).
package db

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DemoRow is the acquisition record inserted at the Acquiring node (Story 3.1). SHA256 is the SHA-256
// of the exact stored .dem bytes (Story 3.2, computed while streaming); an empty SHA256 records a NULL
// demo_sha256 (the admin manual-upload path, which does not hash — Epic 5). parser_version is left NULL
// (a shell) until Story 3.3 backfills it.
type DemoRow struct {
	MatchID        int64
	StorageBackend string
	StorageKey     string
	SizeBytes      int64 // 0 => recorded as NULL (an unknown size)
	Source         string
	SHA256         string // "" => recorded as NULL demo_sha256 (manual path); a real hash on the worker paths
}

// RecordOutcome reports whether RecordDemo inserted a new row or short-circuited to an existing one
// (the AD-3 idempotency key bit). On a duplicate (match_id, demo_sha256) the insert does nothing and
// ExistingKey carries the prior row's storage_key so the caller can return the prior result. DemoID is
// the demo row's PK either way (the just-inserted id, or the prior row's id on a dedup) — the parse step
// (Story 3.3) stamps it as stat_row.demo_id provenance.
type RecordOutcome struct {
	Inserted    bool   // true => a new row was written; false => a duplicate (match_id, demo_sha256) already existed
	ExistingKey string // the row's storage_key: the just-inserted key when Inserted, else the prior row's key
	DemoID      int64  // the demo row's PK (provenance for stat_row.demo_id): the new id when Inserted, else the prior row's id
}

// DemoRecorder persists a demo acquisition row and reports whether it deduped. Injectable for tests.
type DemoRecorder interface {
	RecordDemo(ctx context.Context, row DemoRow) (RecordOutcome, error)
}

// PgxRecorder is the production DemoRecorder backed by a pgx connection pool.
type PgxRecorder struct {
	pool *pgxpool.Pool
}

var _ DemoRecorder = (*PgxRecorder)(nil)

// NewPgxRecorder opens a pooled connection to the worker DB URL.
func NewPgxRecorder(ctx context.Context, databaseURL string) (*PgxRecorder, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("connect worker DB: %w", err)
	}
	return &PgxRecorder{pool: pool}, nil
}

// Close releases the pool.
func (r *PgxRecorder) Close() {
	if r.pool != nil {
		r.pool.Close()
	}
}

// RecordDemo inserts the acquisition row and enforces the AD-3 idempotency key. It inserts demo_sha256
// with ON CONFLICT (match_id, demo_sha256) DO NOTHING RETURNING id, storage_key: a returned row means a
// new row (Inserted); zero rows means a duplicate (match_id, demo_sha256) already exists, so it fetches
// the prior row's id + storage_key and reports Inserted=false (the caller short-circuits to the prior
// result). Either way DemoID carries the demo PK so Story 3.3's parse can stamp stat_row.demo_id
// provenance. parser_version is omitted (a NULL shell Story 3.3 stamps on parse);
// retention_class/parse_generation/archived_at take their column defaults. A 0 size / empty SHA256 are
// stored as NULL (a NULL sha256 never dedups — NULLs are distinct in the UNIQUE — which is exactly how
// the un-hashed manual path stays unaffected).
func (r *PgxRecorder) RecordDemo(ctx context.Context, row DemoRow) (RecordOutcome, error) {
	var sizeBytes *int64
	if row.SizeBytes > 0 {
		sizeBytes = &row.SizeBytes
	}
	var sha *string
	if row.SHA256 != "" {
		sha = &row.SHA256
	}
	var insertedID int64
	var insertedKey string
	// NOTE the column is `matchzy_match_id` (migration 0010): MatchID here is the EXTERNAL ingest id —
	// MatchZy's game-server matchid, or the CLI's --match. It is NOT a bracket `match.id` and never was.
	// 0010 renamed the column to say so and added a separate nullable `demo.match_id` FK, which Story 4.6
	// (Aprobar) populates when it binds a demo to the match it decided. The AD-3 dedup key travelled with
	// the rename, so (matchzy_match_id, demo_sha256) still dedups exactly what it always did.
	err := r.pool.QueryRow(ctx,
		`insert into demo (matchzy_match_id, storage_backend, storage_key, size_bytes, source, demo_sha256)
		 values ($1, $2, $3, $4, $5, $6)
		 on conflict (matchzy_match_id, demo_sha256) do nothing
		 returning id, storage_key`,
		row.MatchID, row.StorageBackend, row.StorageKey, sizeBytes, row.Source, sha,
	).Scan(&insertedID, &insertedKey)
	switch {
	case err == nil:
		return RecordOutcome{Inserted: true, ExistingKey: insertedKey, DemoID: insertedID}, nil
	case errors.Is(err, pgx.ErrNoRows):
		// Conflict on (matchzy_match_id, demo_sha256): the row already exists. Fetch its id + storage_key
		// so the caller returns the prior result (AD-3 short-circuit) with the prior row's provenance id.
		var existingID int64
		var existingKey string
		if e := r.pool.QueryRow(ctx,
			`select id, storage_key from demo where matchzy_match_id = $1 and demo_sha256 = $2`,
			row.MatchID, row.SHA256,
		).Scan(&existingID, &existingKey); e != nil {
			return RecordOutcome{}, fmt.Errorf("fetch existing demo key (match %d): %w", row.MatchID, e)
		}
		return RecordOutcome{Inserted: false, ExistingKey: existingKey, DemoID: existingID}, nil
	default:
		return RecordOutcome{}, fmt.Errorf("insert demo acquisition row (match %d): %w", row.MatchID, err)
	}
}

// Pool exposes the shared connection pool so a sibling recorder (PgxStatRecorder) can reuse it — the
// PgxRecorder owns the pool's lifecycle (Close closes it); the stat recorder only borrows it.
func (r *PgxRecorder) Pool() *pgxpool.Pool { return r.pool }

// StatRow is one parsed player's row destined for the single-writer stat_row table (AD-2). SteamID64 is
// the 17-digit decimal TEXT (the caller converts the parser's uint64 via strconv.FormatUint — the DB
// layer never sees the numeric form). Story 3.3 fills MatchID/SteamID64/DemoID + Kills/Deaths/
// RoundsPlayed; Story 4.6a adds RoundsWon; Story 5.1 adds the FR-18 CORE SEVEN (Assists, ADRDamage, HSKills,
// MVPs, FlashAssists, UtilityDamage, KASTRounds); Story 5.2 adds the FR-19 WEIRD FIVE (KnifeKills,
// WallbangKills, ThroughSmokeKills, NoScopeKills, BlindKills) — all raw counts/totals, the leaderboard view
// divides (AD-20). The still-later derived/idle columns (FR-20/FR-21, Stories 5.3–5.4) stay NULL at their
// column defaults. Rows written BEFORE a widening keep NULL in the new columns until their demo is
// re-parsed (Story 3.6 RunReparse re-derives everything through this same upsert) — that is expected, and
// is not a backfill.
//
// ⚠ MatchID is the EXTERNAL matchzy_match_id, NOT a bracket match(id) — at parse time no bracket row is
// associated with the demo at all (the bind is a later admin act), and the worker never learns one.
// RoundsWon is therefore per-player and NOT score_a/score_b; Story 4.6b maps the tally onto the match's
// competitor seats. See ingest.PlayerStat for the full reasoning (DECISION B, and why "by AD-2 design" was
// the wrong shorthand for it).
type StatRow struct {
	MatchID      int64
	SteamID64    string
	DemoID       int64
	Kills        int
	Deaths       int
	RoundsPlayed int
	RoundsWon    int
	// The FR-18 core seven (Story 5.1). Raw numerators/counts; ADR/HS%/KAST% are ratios computed in the 5.5
	// leaderboard view (AD-20), so ADRDamage is the TOTAL capped damage, HSKills/KASTRounds are counts.
	Assists       int
	ADRDamage     int
	HSKills       int
	MVPs          int
	FlashAssists  int
	UtilityDamage int
	KASTRounds    int
	// The FR-19 weird five (Story 5.2). Per-kill counts credited to the KILLER off native events.Kill
	// flags; each is an overlapping subset of Kills. A zero count is written as an explicit 0 (never
	// omitted/NULL) — FR-19's testable consequence — because all five are unconditionally in the INSERT
	// column list below.
	//
	// ⚠ BlindKills / `blind_kills` is ATTACKER-blind: the KILLER was flashed when they got the kill (the
	// "blind justice" sense). events.Kill carries no victim-blind field at all, so there is no other
	// reading — but the column name does not say so, and the common CS reading is the opposite ("killed
	// someone who was flashed"). Whoever labels this in the Story-5.5 leaderboard/awards UI must say
	// "killer was blind", or the award goes to the wrong behaviour and the data can never contradict it.
	KnifeKills        int
	WallbangKills     int
	ThroughSmokeKills int
	NoScopeKills      int
	BlindKills        int
}

// AnomalyReason is one machine-readable validation-gate failure (Story 3.4). Gate is the gate id
// (conservation | empty_stats | unreconciled); Detail is a log/human-readable description. The struct is
// DB-serialized — it is marshaled to the jsonb array persisted in demo.anomaly_reasons, so the json tags
// ARE the on-disk shape. It lives in db (not ingest) so RecordParse marshals it with no ingest→db type
// leak (ingest already imports db).
type AnomalyReason struct {
	Gate   string `json:"gate"`
	Detail string `json:"detail"`
}

// ValidationOutcome is the result of the AC1 gates over a fresh parse (Story 3.4): Anomalous is true iff
// ANY gate failed; Reasons is the ordered, machine-readable failure list (nil/empty when clean). The worker
// stamps demo.validation_state='anomalous' + anomaly_reasons=Reasons when Anomalous, else 'pending' + NULL
// — both in the same transaction as the stat_row upsert (RecordParse).
type ValidationOutcome struct {
	Anomalous bool
	Reasons   []AnomalyReason
}

// StatRecorder upserts a match's parsed stat rows and stamps the demo's parser_version — the worker is the
// single writer of stat_row (AD-2), just as it is of demo. Injectable for tests (FakeStatRecorder).
type StatRecorder interface {
	// RecordParse stamps demo.parser_version + the validation outcome (validation_state/anomaly_reasons/
	// validated_at, Story 3.4) and upserts rows in ONE transaction (the AD-3/AD-26 idempotent-parse spirit).
	// A re-parse REPLACES a player's row via ON CONFLICT (match_id, steamid64) DO UPDATE; it does NOT delete
	// SteamIDs absent from the new parse (that delete-missing is RecordReparse, below). Rows are upserted
	// regardless of the outcome — an anomaly is a HOLD FLAG on demo, never a write-block. It leaves
	// demo.parse_generation untouched (a first parse stays generation 1).
	RecordParse(ctx context.Context, demoID int64, parserVersion string, rows []StatRow, val ValidationOutcome) error

	// RecordReparse re-derives a match's rows from a deliberate re-parse of the RETAINED demo, in ONE
	// transaction (the AD-3 revert→reparse): it (a) re-stamps parser_version + the Story-3.4 validation
	// outcome AND bumps demo.parse_generation, (b) upserts every freshly-parsed row ON CONFLICT
	// (match_id, steamid64) DO UPDATE — PRESERVING status (the set-list omits it, so an approved row stays
	// approved: AD-7, no Pending flicker), and (c) DELETES every stat_row for matchID whose steamid64 is
	// absent from the new parse (the AD-3 "delete of SteamIDs absent from the new parse"). matchID is passed
	// EXPLICITLY (not derived from rows) so a zero-player re-parse deletes ALL of the match's rows. It
	// touches only derived rows — the raw demo + its sha256 are never written (AD-1). All-or-nothing
	// (fail-closed on any error), so published truth jumps old→corrected with no intermediate state visible.
	RecordReparse(ctx context.Context, matchID, demoID int64, parserVersion string, rows []StatRow, val ValidationOutcome) error
}

// PgxStatRecorder is the production StatRecorder. It borrows the PgxRecorder's pool (see PgxRecorder.Pool)
// so both single-writer paths share one pool; the PgxRecorder owns Close.
type PgxStatRecorder struct {
	pool *pgxpool.Pool
}

var _ StatRecorder = (*PgxStatRecorder)(nil)

// NewPgxStatRecorder builds a stat recorder over an existing (shared) pool.
func NewPgxStatRecorder(pool *pgxpool.Pool) *PgxStatRecorder {
	return &PgxStatRecorder{pool: pool}
}

// RecordParse stamps demo.parser_version + the Story-3.4 validation outcome and upserts the match's stat
// rows in ONE transaction, so a parse is all-or-nothing. The upsert is ON CONFLICT (match_id, steamid64) DO
// UPDATE, so a re-parse REPLACES a player's row rather than duplicating it; stat_row.status keeps its
// 'pending' publish-axis default (orthogonal to the demo anomaly axis). It does NOT delete SteamIDs missing
// from the new parse — that delete-missing is Story 3.6. An empty rows slice still stamps the demo row +
// commits (a zero-player parse is written unconditionally; it is flagged 'anomalous' via the empty_stats
// gate, but the anomaly is a hold flag on demo, never a write-block).
func (r *PgxStatRecorder) RecordParse(ctx context.Context, demoID int64, parserVersion string, rows []StatRow, val ValidationOutcome) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin parse tx (demo %d): %w", demoID, err)
	}
	defer tx.Rollback(ctx) // a no-op once Commit succeeds; rolls back on any early return (fail-closed)

	// A first parse stamps the validation outcome (bumpGeneration=false leaves parse_generation at 1) and
	// upserts the rows. It does NOT delete SteamIDs absent from the parse — that delete-missing is
	// RecordReparse's revert half.
	if err := stampDemo(ctx, tx, demoID, parserVersion, val, false); err != nil {
		return err
	}
	if err := upsertStatRows(ctx, tx, demoID, rows); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit parse tx (demo %d): %w", demoID, err)
	}
	return nil
}

// RecordReparse re-derives a match's stat rows from a deliberate re-parse of the RETAINED demo, in ONE
// transaction (AD-3 revert→reparse — no observable Pending window). It (a) re-stamps parser_version + the
// Story-3.4 validation outcome AND bumps demo.parse_generation, (b) upserts every freshly-parsed row
// PRESERVING status (the status-preserving upsert shared with RecordParse — an approved row stays approved,
// AD-7), and (c) DELETES every stat_row for matchID whose steamid64 is absent from the new parse. matchID
// is passed EXPLICITLY so a zero-player re-parse (empty rows) deletes ALL of the match's rows (correct: it
// then trips the empty_stats gate). All statements run inside the SAME tx — fail-closed on any error. It
// writes only derived rows + demo parse-metadata; the raw demo + demo_sha256/storage_key are never touched
// (AD-1).
func (r *PgxStatRecorder) RecordReparse(ctx context.Context, matchID, demoID int64, parserVersion string, rows []StatRow, val ValidationOutcome) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin reparse tx (match %d, demo %d): %w", matchID, demoID, err)
	}
	defer tx.Rollback(ctx) // a no-op once Commit succeeds; rolls back on any early return (fail-closed)

	// (a) re-stamp + BUMP parse_generation (the ONLY stamp delta vs RecordParse).
	if err := stampDemo(ctx, tx, demoID, parserVersion, val, true); err != nil {
		return err
	}
	// (b) status-preserving upsert (identical to the first-parse upsert — the DO UPDATE omits `status`).
	if err := upsertStatRows(ctx, tx, demoID, rows); err != nil {
		return err
	}
	// (c) delete-missing: every stat_row for THIS match whose steamid64 is absent from the new parse's set.
	// The set is passed as a non-nil text[] so an EMPTY set encodes as ARRAY[]::text[] (not NULL): in
	// Postgres `steamid64 <> ALL(ARRAY[]::text[])` is TRUE for every row, so a zero-player re-parse deletes
	// ALL of the match's rows (the correct revert). Scoped by match_id (NOT demo_id) and run INSIDE the tx.
	newIDs := make([]string, 0, len(rows)) // make() => non-nil even when len==0 (avoids a NULL that would delete nothing)
	for _, row := range rows {
		newIDs = append(newIDs, row.SteamID64)
	}
	if _, err := tx.Exec(ctx,
		`delete from stat_row where matchzy_match_id = $1 and steamid64 <> all($2::text[])`,
		matchID, newIDs,
	); err != nil {
		return fmt.Errorf("delete-missing stat_row (match %d): %w", matchID, err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit reparse tx (match %d, demo %d): %w", matchID, demoID, err)
	}
	return nil
}

// stampDemo writes the Story-3.4 validation outcome (validation_state/anomaly_reasons/validated_at) and
// parser_version onto the demo row, in the caller's tx (AD-2 single writer). A gate failure =>
// validation_state='anomalous' + the machine-readable reasons jsonb; a clean parse => 'pending' + NULL
// reasons. When bumpGeneration is set (a re-parse) it also bumps parse_generation — the sole difference
// between the first-parse and re-parse stamps.
func stampDemo(ctx context.Context, tx pgx.Tx, demoID int64, parserVersion string, val ValidationOutcome, bumpGeneration bool) error {
	validationState := "pending"
	var reasons *string // nil => SQL NULL (no reasons when clean, or anomalous with no reasons)
	if val.Anomalous {
		validationState = "anomalous"
		// Only marshal when there is at least one reason: json.Marshal of a nil/empty slice yields the
		// jsonb literal `null`, so guarding here keeps anomaly_reasons a clean SQL NULL rather than a jsonb
		// null scalar. Unreachable via Validate (Anomalous <=> len(Reasons)>0) but this seam is reused by
		// both parse paths, so keep the state flag authoritative and the payload well-formed.
		if len(val.Reasons) > 0 {
			b, err := json.Marshal(val.Reasons)
			if err != nil {
				return fmt.Errorf("marshal anomaly reasons (demo %d): %w", demoID, err)
			}
			s := string(b)
			reasons = &s
		}
	}
	sql := `update demo set parser_version = $1, validation_state = $2, anomaly_reasons = $3::jsonb, validated_at = now() where id = $4`
	if bumpGeneration {
		sql = `update demo set parser_version = $1, validation_state = $2, anomaly_reasons = $3::jsonb, validated_at = now(), parse_generation = parse_generation + 1 where id = $4`
	}
	if _, err := tx.Exec(ctx, sql, parserVersion, validationState, reasons, demoID); err != nil {
		return fmt.Errorf("stamp parser_version + validation (demo %d): %w", demoID, err)
	}
	return nil
}

// upsertStatRows runs the status-preserving ON CONFLICT (match_id, steamid64) DO UPDATE batch inside the
// caller's tx: a repeat pair REPLACES the row (never duplicates — the AD-3 UNIQUE key) and the DO UPDATE
// set-list deliberately OMITS `status`, so an already-approved row keeps its status (AD-7). An empty rows
// slice is a no-op (a zero-player parse still stamps the demo row via stampDemo). Shared by RecordParse
// (first parse) and RecordReparse (re-parse).
func upsertStatRows(ctx context.Context, tx pgx.Tx, demoID int64, rows []StatRow) error {
	if len(rows) == 0 {
		return nil
	}
	batch := &pgx.Batch{}
	for _, row := range rows {
		batch.Queue(
			// `matchzy_match_id` is the EXTERNAL ingest id (see RecordDemo). The AD-3 re-parse key
			// travelled with 0010's rename, so this upserts on exactly the pair it always did.
			// `rounds_won` is the Story-4.6a demo-derived tally (FR-16); the seven Story-5.1 core columns
			// (assists..kast_rounds) are the FR-18 derivation; the five Story-5.2 columns
			// (knife_kills..blind_kills) are the FR-19 weird five. All re-derive on every parse exactly like
			// kills/deaths — present in BOTH lists with excluded.<col>. The weird five are UNCONDITIONALLY
			// in the INSERT list, which is what makes a zero count land as 0 rather than NULL (FR-19 AC2).
			// ⚠ `status` stays ABSENT from BOTH lists — see the note above.
			//
			// ⚠⚠ `match_id` MUST STAY ABSENT FROM BOTH LISTS TOO, and unlike `status` its absence is
			// silent — nothing here names it. It is the BRACKET match(id), written ONLY by 0016's
			// bind_match_demo (Story 4.6a); this worker holds no bracket knowledge (AD-2) and never sets
			// it. Adding it "for symmetry" would make the DO UPDATE write `match_id = excluded.match_id`
			// = NULL, so EVERY re-parse would silently UNBIND every bound match — a bound, `pending`
			// match whose stat rows no longer point at it. Leave it out.
			`insert into stat_row (matchzy_match_id, steamid64, demo_id, kills, deaths, rounds_played, rounds_won,
			   assists, adr_damage, hs_kills, mvps, flash_assists, utility_damage, kast_rounds,
			   knife_kills, wallbang_kills, through_smoke_kills, no_scope_kills, blind_kills)
			 values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
			 on conflict (matchzy_match_id, steamid64) do update set
			   kills = excluded.kills,
			   deaths = excluded.deaths,
			   rounds_played = excluded.rounds_played,
			   rounds_won = excluded.rounds_won,
			   assists = excluded.assists,
			   adr_damage = excluded.adr_damage,
			   hs_kills = excluded.hs_kills,
			   mvps = excluded.mvps,
			   flash_assists = excluded.flash_assists,
			   utility_damage = excluded.utility_damage,
			   kast_rounds = excluded.kast_rounds,
			   knife_kills = excluded.knife_kills,
			   wallbang_kills = excluded.wallbang_kills,
			   through_smoke_kills = excluded.through_smoke_kills,
			   no_scope_kills = excluded.no_scope_kills,
			   blind_kills = excluded.blind_kills,
			   demo_id = excluded.demo_id`,
			// ⚠ POSITIONAL: these arguments must line up 1:1 with $1..$19 in the column list above. A silent
			// off-by-one writes the wrong stat into the wrong column and NO unit test catches it (the fakes
			// store the StatRow struct, they never execute this SQL).
			row.MatchID, row.SteamID64, row.DemoID, row.Kills, row.Deaths, row.RoundsPlayed, row.RoundsWon,
			row.Assists, row.ADRDamage, row.HSKills, row.MVPs, row.FlashAssists, row.UtilityDamage, row.KASTRounds,
			row.KnifeKills, row.WallbangKills, row.ThroughSmokeKills, row.NoScopeKills, row.BlindKills,
		)
	}
	br := tx.SendBatch(ctx, batch)
	for range rows {
		if _, err := br.Exec(); err != nil {
			_ = br.Close()
			return fmt.Errorf("upsert stat_row (demo %d): %w", demoID, err)
		}
	}
	if err := br.Close(); err != nil {
		return fmt.Errorf("close stat_row batch (demo %d): %w", demoID, err)
	}
	return nil
}

// RosterReader reads the ACTIVE roster's SteamID64 set — the reconciliation target for the AC1 roster gate
// (Story 3.4). Injectable for tests (FakeRosterReader), the Go analogue of the DemoStore/StatRecorder seams.
type RosterReader interface {
	// ActiveSteamIDs returns the set of steamid64s on the active roster (roster_entry.status='active').
	ActiveSteamIDs(ctx context.Context) (map[string]struct{}, error)
}

// PgxRosterReader is the production RosterReader. Like PgxStatRecorder it borrows the PgxRecorder's shared
// pool (see PgxRecorder.Pool) — the PgxRecorder owns Close; this reader only borrows it.
type PgxRosterReader struct {
	pool *pgxpool.Pool
}

var _ RosterReader = (*PgxRosterReader)(nil)

// NewPgxRosterReader builds a roster reader over an existing (shared) pool.
func NewPgxRosterReader(pool *pgxpool.Pool) *PgxRosterReader {
	return &PgxRosterReader{pool: pool}
}

// ActiveSteamIDs reads the active roster into a set. v1 is single-tournament (AD-18) and there is no
// match→tournament link yet (no match table until Epic 4), so a match's parsed ids can only be reconciled
// against the ONE active roster — there is deliberately NO tournament_id filter here. Forward-scope: when
// Epic 4 links match→tournament, scope BOTH this read and the unreconciled_stat_row view to the match's
// tournament.
func (r *PgxRosterReader) ActiveSteamIDs(ctx context.Context) (map[string]struct{}, error) {
	rows, err := r.pool.Query(ctx, `select steamid64 from roster_entry where status = 'active'`)
	if err != nil {
		return nil, fmt.Errorf("read active roster: %w", err)
	}
	defer rows.Close()
	set := make(map[string]struct{})
	for rows.Next() {
		var sid string
		if err := rows.Scan(&sid); err != nil {
			return nil, fmt.Errorf("scan roster steamid64: %w", err)
		}
		set[sid] = struct{}{}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate active roster: %w", err)
	}
	return set, nil
}

// ErrNoDemo is the sentinel a DemoReader returns (wrapped) when a match has no retained demo of record — the
// fail-closed "nothing to re-parse" condition. Callers (e.g. the worker's POST /ingest/parse) errors.Is
// against it to map a genuinely-absent demo to a client 404, distinct from a transient DB/infra lookup fault
// (which must surface as a 500, not masquerade as "no demo").
var ErrNoDemo = errors.New("no retained demo for match")

// DemoRef identifies a match's retained demo of record for a re-parse (Story 3.6): the demo row's PK
// (stat_row.demo_id provenance), its opaque storage_key (the object the re-parse reads back — never
// re-acquires, AD-1), and the recorded SHA-256 (the AD-1 re-hash-verify target; empty when the demo was
// recorded on the un-hashed manual path — a NULL demo_sha256).
type DemoRef struct {
	DemoID     int64
	StorageKey string
	SHA256     string
}

// DemoReader looks up a match's retained demo of record for a deliberate re-parse (Story 3.6). Injectable
// for tests (FakeDemoReader), the Go analogue of the RosterReader/StatRecorder seams — the re-parse reads
// the RETAINED object back (via the returned storage_key), it never re-acquires.
type DemoReader interface {
	// DemoForMatch returns the match's demo of record (the latest by id if >1 — v1 is one demo per match,
	// AD-18; a stray second demo re-parses the newest). It returns an error if the match has no retained
	// demo (fail closed — there is nothing to re-parse).
	DemoForMatch(ctx context.Context, matchID int64) (DemoRef, error)
}

// PgxDemoReader is the production DemoReader. Like PgxStatRecorder/PgxRosterReader it borrows the
// PgxRecorder's shared pool (see PgxRecorder.Pool) — the PgxRecorder owns Close; this reader only borrows it.
type PgxDemoReader struct {
	pool *pgxpool.Pool
}

var _ DemoReader = (*PgxDemoReader)(nil)

// NewPgxDemoReader builds a demo reader over an existing (shared) pool.
func NewPgxDemoReader(pool *pgxpool.Pool) *PgxDemoReader { return &PgxDemoReader{pool: pool} }

// DemoForMatch reads the match's demo of record — the highest id (the latest ingest) when a match somehow
// has >1 demo row (v1 is single-demo-per-match, AD-18; scoping demo→tournament is Epic 4). demo_sha256 is
// NULL on the un-hashed manual path, surfaced as an empty SHA256 (the re-hash-verify then skips). A match
// with no demo row fails closed with a clear error (nothing to re-parse).
func (r *PgxDemoReader) DemoForMatch(ctx context.Context, matchID int64) (DemoRef, error) {
	var ref DemoRef
	var sha *string
	err := r.pool.QueryRow(ctx,
		`select id, storage_key, demo_sha256 from demo where matchzy_match_id = $1 order by id desc limit 1`,
		matchID,
	).Scan(&ref.DemoID, &ref.StorageKey, &sha)
	switch {
	case err == nil:
		if sha != nil {
			ref.SHA256 = *sha
		}
		return ref, nil
	case errors.Is(err, pgx.ErrNoRows):
		return DemoRef{}, fmt.Errorf("%w %d (nothing to re-parse)", ErrNoDemo, matchID)
	default:
		return DemoRef{}, fmt.Errorf("look up demo for match %d: %w", matchID, err)
	}
}
