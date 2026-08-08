// Package ceremony is the THIN CALLER that joins the pure producer to the database (Story 6.8a,
// FR-25 / AD-2 / AD-6 / AD-14).
//
// ⭐⭐ IT CONTAINS NO CEREMONY LOGIC, AND THAT IS THE ENTIRE POINT. Every decision — the spin plan,
// the seeded draw, the FR-29 ladder, the FR-26 anti-sweep pass, the FR-28 consolation order — lives in
// `worker/awards`, which is a pure leaf with no database access at all. Every WRITE lives in the
// `persist_ceremony` RPC (migration 0027), because `service_role` holds the grants and has BYPASSRLS,
// so no caller-level discipline can bind it. This package does three mechanical things: LOAD the
// frozen inputs, CALL the orchestrator, POST the run. If a rule ever appears here, it is in the wrong
// file.
//
// ⚠ THIS IS THE DIRECTION THE DEPENDENCY EDGE IS ALLOWED TO RUN. `worker/awards` must never import
// `worker/db`, `worker/store`, `worker/ingest` or `worker/config` — `TestPackageIsALeaf`
// (`awards/prng_test.go:985`) pins that. This package importing `worker/awards` is the correct
// direction and creates no cycle: the producer stays reproducible from the published bundle alone,
// which is what Story 6.9's browser verifier depends on.
//
// ⚠ REFUSAL HANDLING FOLLOWS `lib/ceremony/lock.ts`'s SHAPE DELIBERATELY: a discriminated result, a
// closed SET of trusted reasons, and FAIL CLOSED on anything unrecognised. A reason the RPC did not
// declare is treated as a write failure rather than surfaced verbatim — an unrecognised refusal is
// exactly the case where a caller must not guess.
package ceremony

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"cs-tournament/worker/awards"
)

// ── the loaded inputs ─────────────────────────────────────────────────────────

// Inputs is everything `persist_ceremony` and the orchestrator need, read under one snapshot of the
// frozen ceremony row.
type Inputs struct {
	CeremonyID   int64
	TournamentID int64
	Run          awards.CeremonyInput
}

// LoadInputs reads the FROZEN ceremony inputs: the seed, the published luck weight table, the award
// catalog, and the AD-19 integer-form snapshot.
//
// ⛔ EVERY VALUE COMES FROM THE CEREMONY'S OWN FROZEN ROWS, never from live tables. The snapshot is
// `stat_snapshot_row` as captured at lock (AD-15, write-once), NOT a fresh scan of `stat_row` — the
// whole point of AD-19 is that the ceremony's inputs stopped moving at the lock. Reading a live table
// here would make the ceremony unreproducible from the published bundle the moment anything changed.
func LoadInputs(ctx context.Context, pool *pgxpool.Pool, ceremonyID int64, liveCount int) (Inputs, error) {
	var (
		in         Inputs
		snapshotID *int64
		seedHex    *string
		table      []int32
	)

	err := pool.QueryRow(ctx, `
		select c.tournament_id, c.snapshot_id, c.seed_demo_sha256, c.luck_weight_table
		  from public.ceremony c
		 where c.id = $1`, ceremonyID).
		Scan(&in.TournamentID, &snapshotID, &seedHex, &table)
	if errors.Is(err, pgx.ErrNoRows) {
		return Inputs{}, fmt.Errorf("ceremony %d does not exist", ceremonyID)
	}
	if err != nil {
		return Inputs{}, fmt.Errorf("reading ceremony %d: %w", ceremonyID, err)
	}
	if snapshotID == nil {
		return Inputs{}, fmt.Errorf("ceremony %d has no snapshot — lock_ceremony has not run", ceremonyID)
	}
	if seedHex == nil {
		return Inputs{}, fmt.Errorf("ceremony %d has no frozen seed (AD-13)", ceremonyID)
	}

	in.CeremonyID = ceremonyID
	in.Run.SeedHex = *seedHex
	in.Run.LiveCount = liveCount
	in.Run.Table = make([]int, len(table))
	for i, w := range table {
		in.Run.Table[i] = int(w)
	}

	if in.Run.Catalog, err = loadCatalog(ctx, pool, in.TournamentID); err != nil {
		return Inputs{}, err
	}
	if in.Run.Players, err = loadSnapshot(ctx, pool, *snapshotID); err != nil {
		return Inputs{}, err
	}
	return in, nil
}

// loadCatalog projects the frozen `award` rows onto Stage-1 candidates.
//
// ⚠ `AwardID` IS `award.id` RENDERED AS DECIMAL, and the choice is deliberate. The producer never
// touches a database, so its award identity is an opaque STRING — and `persist_ceremony` re-resolves
// every one of them against this tournament's catalog. Using the surrogate id rather than `award.name`
// keeps the producer free of display copy and of the collation questions a text key would raise;
// Story 6.9 owns whatever identity the published bundle carries.
func loadCatalog(ctx context.Context, pool *pgxpool.Pool, tournamentID int64) ([]awards.Stage1Candidate, error) {
	rows, err := pool.Query(ctx, `
		select a.id, a.priority, a.deciding_stat, a.class, a.direction,
		       a.floor_rounds, a.floor_kills,
		       coalesce(a.secondary_stat, ''), coalesce(a.eff_num_key, ''), coalesce(a.eff_den_key, '')
		  from public.award a
		 where a.tournament_id = $1
		 order by a.priority`, tournamentID)
	if err != nil {
		return nil, fmt.Errorf("reading the award catalog: %w", err)
	}
	defer rows.Close()

	var out []awards.Stage1Candidate
	for rows.Next() {
		var (
			id                                int64
			priority, floorRounds, floorKills int
			stat, class, direction            string
			secondary, effNum, effDen         string
		)
		if err := rows.Scan(&id, &priority, &stat, &class, &direction,
			&floorRounds, &floorKills, &secondary, &effNum, &effDen); err != nil {
			return nil, fmt.Errorf("scanning an award row: %w", err)
		}
		out = append(out, awards.Stage1Candidate{
			AwardID:  strconv.FormatInt(id, 10),
			Priority: priority,
			Award: awards.Award{
				DecidingStat:  stat,
				Class:         awards.AwardClass(class),
				Direction:     awards.AwardDirection(direction),
				FloorRounds:   floorRounds,
				FloorKills:    floorKills,
				SecondaryStat: secondary,
				EffNumKey:     effNum,
				EffDenKey:     effDen,
			},
		})
	}
	return out, rows.Err()
}

// snapshotStats is the AD-19 `stats_int` shape (`0024:720-725`), read rather than restated.
type snapshotStats struct {
	Volume     map[string]json.Number     `json:"volume"`
	Rate       map[string]ratePair        `json:"rate"`
	Secondary  map[string]json.RawMessage `json:"secondary"`
	Efficiency map[string]ratePair        `json:"efficiency"`
}

type ratePair struct {
	Num json.Number `json:"num"`
	Den json.Number `json:"den"`
}

// loadSnapshot rebuilds `SnapshotPlayer` from the write-once `stat_snapshot_row` rows.
//
// ⛔ EVERY MAGNITUDE IS PARSED AS `big.Int` FROM ITS DECIMAL TEXT, never through a float. AD-19's
// magnitudes are unbounded and `encoding/json`'s default number type is `float64`, which silently
// rounds past 2^53 — the exact class of defect `.Float64()` and `.Int64()` are banned in the producer
// for. `json.Number` keeps the text and `SetString` reads it exactly.
func loadSnapshot(ctx context.Context, pool *pgxpool.Pool, snapshotID int64) ([]awards.SnapshotPlayer, error) {
	rows, err := pool.Query(ctx, `
		select r.steamid64, r.stats_int, coalesce(r.h2h, '{}'::jsonb),
		       coalesce(r.achievement_ts, -1), coalesce(r.rounds_played, 0),
		       coalesce(r.kills, 0), coalesce(r.idle_dq, false)
		  from public.stat_snapshot_row r
		 where r.snapshot_id = $1
		 order by r.steamid64`, snapshotID)
	if err != nil {
		return nil, fmt.Errorf("reading snapshot %d: %w", snapshotID, err)
	}
	defer rows.Close()

	var out []awards.SnapshotPlayer
	for rows.Next() {
		var (
			sid                    string
			statsRaw, h2hRaw       []byte
			achievementTS          int64
			roundsPlayed, killsCol int
			idleDQ                 bool
		)
		if err := rows.Scan(&sid, &statsRaw, &h2hRaw, &achievementTS, &roundsPlayed, &killsCol, &idleDQ); err != nil {
			return nil, fmt.Errorf("scanning a snapshot row: %w", err)
		}

		var stats snapshotStats
		if err := json.Unmarshal(statsRaw, &stats); err != nil {
			return nil, fmt.Errorf("snapshot row %s: decoding stats_int: %w", sid, err)
		}

		p := awards.SnapshotPlayer{
			SteamID64:     sid,
			RoundsPlayed:  big.NewInt(int64(roundsPlayed)),
			Kills:         big.NewInt(int64(killsCol)),
			IdleDQ:        idleDQ,
			AchievementTS: big.NewInt(achievementTS),
			Volume:        map[string]*big.Int{},
			Rate:          map[string]awards.RatePair{},
			Secondary:     map[string]awards.StatValue{},
			Efficiency:    map[string]awards.RatePair{},
			H2H:           map[string]map[string]awards.StatValue{},
		}

		for k, v := range stats.Volume {
			n, err := parseBig(v, sid, "volume."+k)
			if err != nil {
				return nil, err
			}
			p.Volume[k] = n
			p.Secondary[k] = awards.StatValue{Class: awards.ClassVolume, Value: n}
		}
		for k, v := range stats.Rate {
			pair, err := parsePair(v, sid, "rate."+k)
			if err != nil {
				return nil, err
			}
			p.Rate[k] = pair
			p.Secondary[k] = awards.StatValue{Class: awards.ClassRate, Num: pair.Num, Den: pair.Den}
		}
		for k, v := range stats.Efficiency {
			pair, err := parsePair(v, sid, "efficiency."+k)
			if err != nil {
				return nil, err
			}
			p.Efficiency[k] = pair
		}

		// h2h: {opponent: {key: class-shaped value}} — the same union `secondary` carries.
		var h2h map[string]map[string]json.RawMessage
		if err := json.Unmarshal(h2hRaw, &h2h); err != nil {
			return nil, fmt.Errorf("snapshot row %s: decoding h2h: %w", sid, err)
		}
		for opp, block := range h2h {
			inner := map[string]awards.StatValue{}
			for k, raw := range block {
				sv, err := parseStatValue(raw, sid, "h2h."+opp+"."+k)
				if err != nil {
					return nil, err
				}
				inner[k] = sv
			}
			p.H2H[opp] = inner
		}

		out = append(out, p)
	}
	return out, rows.Err()
}

func parseBig(v json.Number, sid, where string) (*big.Int, error) {
	n, ok := new(big.Int).SetString(v.String(), 10)
	if !ok {
		return nil, fmt.Errorf("snapshot row %s: %s = %q is not an integer", sid, where, v.String())
	}
	return n, nil
}

func parsePair(v ratePair, sid, where string) (awards.RatePair, error) {
	num, err := parseBig(v.Num, sid, where+".num")
	if err != nil {
		return awards.RatePair{}, err
	}
	den, err := parseBig(v.Den, sid, where+".den")
	if err != nil {
		return awards.RatePair{}, err
	}
	return awards.RatePair{Num: num, Den: den}, nil
}

// parseStatValue reads AD-19's CLASS-SHAPED union: a bare integer for a volume key, a `{num,den}`
// object for a rate key. The SHAPE is the discriminator, exactly as `0024`'s builder emits it.
func parseStatValue(raw json.RawMessage, sid, where string) (awards.StatValue, error) {
	var pair ratePair
	if err := json.Unmarshal(raw, &pair); err == nil && pair.Num != "" && pair.Den != "" {
		p, err := parsePair(pair, sid, where)
		if err != nil {
			return awards.StatValue{}, err
		}
		return awards.StatValue{Class: awards.ClassRate, Num: p.Num, Den: p.Den}, nil
	}
	var n json.Number
	if err := json.Unmarshal(raw, &n); err != nil {
		return awards.StatValue{}, fmt.Errorf("snapshot row %s: %s is neither an integer nor a {num,den} pair", sid, where)
	}
	v, err := parseBig(n, sid, where)
	if err != nil {
		return awards.StatValue{}, err
	}
	return awards.StatValue{Class: awards.ClassVolume, Value: v}, nil
}

// ── the Payload ───────────────────────────────────────────────────────────────

type PayloadResult struct {
	AwardID           *string  `json:"award_id"`
	OutcomeKind       string   `json:"outcome_kind"`
	DecidingValue     *string  `json:"deciding_value"`
	DecidingNum       *string  `json:"deciding_num"`
	DecidingDen       *string  `json:"deciding_den"`
	TieLadderExitStep int      `json:"tie_ladder_exit_step"`
	Winners           []string `json:"winners"`
}

type PayloadSpin struct {
	SpinIndex     int             `json:"spin_index"`
	Kind          string          `json:"kind"`
	Label         string          `json:"label"`
	BytesConsumed uint64          `json:"bytes_consumed"`
	LiveAwardIDs  []string        `json:"live_award_ids"`
	Results       []PayloadResult `json:"results"`
}

type PayloadPlanEntry struct {
	Spin      int      `json:"spin"`
	Pool      []string `json:"pool"`
	LiveCount int      `json:"live_count"`
}

type Payload struct {
	SeedHex  string             `json:"seed_hex"`
	SpinPlan []PayloadPlanEntry `json:"spin_plan"`
	Spins    []PayloadSpin      `json:"spins"`
}

// BuildPayload renders a `CeremonyRun` as the jsonb `persist_ceremony` validates.
//
// ⭐ AC4 — PITY PERSISTS AS N SPINS, ONE WINNER EACH, NOT AS ONE SHARED SPIN. That is Story 6.7's
// recorded answer (`6-7-pity-roulette.md:1330-1338`), and it is what makes
// `award_result_award_or_pity` (`0026`) satisfied BY CONSTRUCTION: every consolation row carries
// `award_id = NULL`, `is_pity = true`, `is_shared = false` and exactly one winner. `RevealOrder` — the
// SEEDED permutation, never the byte-lex `Winless` — is what `spin_index` follows, continuing the main
// sequence.
//
// ⛔ `tie_ladder_exit_step` IS SENT AS THE ENGINE'S RAW INTEGER, INCLUDING THE 0 SENTINEL, and the RPC
// applies `nullif(v, 0)`. The mapping belongs at ONE seam (`0025:162-174` says so in an explicit
// callout), and doing it here as well would make two places responsible for one rule.
func BuildPayload(run awards.CeremonyRun) Payload {
	p := Payload{
		// ⛔ CARRIED FROM THE RUN, NOT RE-READ FROM THE CEREMONY ROW. `persist_ceremony` compares this
		// against `ceremony.seed_demo_sha256` and refuses `seed_mismatch` on any difference — a check
		// that is only worth anything if this value comes from the thing that actually DREW the bytes.
		SeedHex:  run.SeedHex,
		SpinPlan: make([]PayloadPlanEntry, 0, len(run.Plan)),
		Spins:    make([]PayloadSpin, 0, len(run.Spins)+len(run.Pity.RevealOrder)),
	}
	for _, e := range run.Plan {
		p.SpinPlan = append(p.SpinPlan, PayloadPlanEntry{Spin: e.Spin, Pool: e.Pool, LiveCount: e.LiveCount})
	}

	for _, spin := range run.Spins {
		ps := PayloadSpin{
			SpinIndex:     spin.Spin,
			Kind:          "main",
			Label:         spin.Label,
			BytesConsumed: spin.Consumed,
			LiveAwardIDs:  spin.Stage1.Live,
			Results:       make([]PayloadResult, 0, len(spin.Result.Results)),
		}
		for _, res := range spin.Result.Results {
			awardID := res.AwardID
			pr := PayloadResult{
				AwardID:           &awardID,
				OutcomeKind:       string(res.Outcome.Kind),
				TieLadderExitStep: res.Outcome.LadderExitStep,
				Winners:           winnersOf(res.Outcome),
			}
			applyDecidingValue(&pr, res.Outcome.DecidingValue)
			ps.Results = append(ps.Results, pr)
		}
		p.Spins = append(p.Spins, ps)
	}

	// The consolation spins continue the main sequence, in RevealOrder.
	next := len(run.Spins)
	for _, sid := range run.Pity.RevealOrder {
		next++
		p.Spins = append(p.Spins, PayloadSpin{
			SpinIndex:     next,
			Kind:          "pity",
			Label:         run.PityLabel,
			BytesConsumed: run.Pity.BytesConsumed,
			LiveAwardIDs:  []string{},
			Results: []PayloadResult{{
				// ⛔ NIL, NOT THE EMPTY STRING. FR-28's consolation prize is not a category: it has no
				// deciding stat, no bucket and no direction, so there is no `award` row that honestly
				// describes it (`0026`'s whole thesis).
				AwardID:     nil,
				OutcomeKind: string(awards.KindWinner),
				Winners:     []string{sid},
			}},
		})
	}
	return p
}

func applyDecidingValue(pr *PayloadResult, dv awards.DecidingValue) {
	switch dv.Class {
	case awards.ClassVolume:
		if dv.Value != nil {
			s := dv.Value.String()
			pr.DecidingValue = &s
		}
	case awards.ClassRate:
		if dv.Num != nil && dv.Den != nil {
			n, d := dv.Num.String(), dv.Den.String()
			pr.DecidingNum, pr.DecidingDen = &n, &d
		}
	}
}

// winnersOf projects an outcome onto its winner set. ⚠ ALWAYS NON-NIL, so the Payload carries `[]`
// rather than `null` — three spellings of absence is a hazard this epic has already paid for twice.
func winnersOf(out awards.Outcome) []string {
	switch out.Kind {
	case awards.KindWinner:
		return []string{out.SteamID64}
	case awards.KindShared:
		return append([]string{}, out.Winners...)
	default:
		return []string{}
	}
}

// ── the call ──────────────────────────────────────────────────────────────────

// Result is `persist_ceremony`'s reply, discriminated. Mirrors `lib/ceremony/lock.ts`'s shape.
type Result struct {
	OK bool `json:"ok"`

	// Reason is set only when OK is false, and is always a member of PersistReasons — an
	// unrecognised refusal is normalised to ReasonWriteFailed rather than passed through.
	Reason string `json:"reason"`

	CeremonyState string `json:"ceremony_state"`
	Spins         int    `json:"spins"`
	Results       int    `json:"results"`
	Winners       int    `json:"winners"`
	DeletedSpins  int    `json:"deleted_spins"`
}

// ReasonWriteFailed is the FAIL-CLOSED value: an RPC error, or a refusal reason the RPC never
// declared. ⛔ It is deliberately NOT in PersistReasons — it is what a reason becomes when it is not
// in that set.
const ReasonWriteFailed = "write_failed"

// PersistReasons is every reason `persist_ceremony` can RETURN (migration 0027). A reason outside this
// set is not trusted: the caller fails closed, exactly as `lib/ceremony/lock.ts` does, because an
// unrecognised refusal is precisely the case where guessing is worst.
var PersistReasons = map[string]struct{}{
	"no_ceremony":              {},
	"ceremony_not_locked":      {},
	"already_persisted":        {},
	"snapshot_missing":         {},
	"seed_missing":             {},
	"seed_mismatch":            {},
	"no_spins":                 {},
	"no_spin_plan":             {},
	"spin_index_missing":       {},
	"spin_index_not_dense":     {},
	"invalid_spin_kind":        {},
	"unknown_award":            {},
	"unknown_player":           {},
	"invalid_outcome_kind":     {},
	"outcome_kind_tie":         {},
	"winner_cardinality":       {},
	"pity_award_shape":         {},
	"invalid_ladder_exit_step": {},
}

// Persist posts one run to `persist_ceremony`. It writes nothing itself.
func Persist(
	ctx context.Context,
	pool *pgxpool.Pool,
	ceremonyID int64,
	actor string,
	run awards.CeremonyRun,
	replace bool,
) (Result, error) {
	body, err := json.Marshal(BuildPayload(run))
	if err != nil {
		return Result{Reason: ReasonWriteFailed}, fmt.Errorf("rendering the run Payload: %w", err)
	}

	var raw []byte
	err = pool.QueryRow(ctx,
		`select public.persist_ceremony($1, $2::jsonb, $3, $4)`,
		ceremonyID, string(body), actor, replace).Scan(&raw)
	if err != nil {
		// ⛔ FAIL CLOSED. A raised SQLSTATE here is genuine corruption by 0027's contract (every
		// business refusal is RETURNED), and the anti-sweep UNIQUE is deliberately unguarded so a
		// producer bug arrives as a loud 23505 rather than a polite reason. Both are surfaced.
		return Result{Reason: ReasonWriteFailed}, fmt.Errorf("persist_ceremony: %w", err)
	}

	var out Result
	if err := json.Unmarshal(raw, &out); err != nil {
		return Result{Reason: ReasonWriteFailed}, fmt.Errorf("decoding persist_ceremony reply: %w", err)
	}
	if !out.OK {
		if _, known := PersistReasons[out.Reason]; !known {
			return Result{Reason: ReasonWriteFailed},
				fmt.Errorf("persist_ceremony refused with an undeclared reason %q", out.Reason)
		}
		return out, nil
	}
	return out, nil
}

// Run is the whole caller: load the frozen inputs, run the producer, post the result.
//
// ⚠ THE THREE STEPS ARE SEPARATELY EXPORTED ABOVE so a harness can run the producer without a
// database and compare two runs byte for byte — which is how AC10's determinism proof is taken.
func Run(
	ctx context.Context,
	pool *pgxpool.Pool,
	ceremonyID int64,
	actor string,
	liveCount int,
	replace bool,
) (awards.CeremonyRun, Result, error) {
	in, err := LoadInputs(ctx, pool, ceremonyID, liveCount)
	if err != nil {
		return awards.CeremonyRun{}, Result{Reason: ReasonWriteFailed}, err
	}
	run, err := awards.RunCeremony(in.Run)
	if err != nil {
		// The producer's refusals are already typed (`awards.ErrCeremony` + a Detail); they are
		// propagated whole rather than flattened into a persist reason, because "the producer refused"
		// and "the writer refused" are different problems with different remedies.
		return awards.CeremonyRun{}, Result{Reason: ReasonWriteFailed}, err
	}
	res, err := Persist(ctx, pool, ceremonyID, actor, run, replace)
	return run, res, err
}
