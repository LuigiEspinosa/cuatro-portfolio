# Glossary — InclusivCup CS2 Tournament (v1)

Companion to [SPEC.md](SPEC.md). Canonical vocabulary for writing epics, stories, and acceptance
criteria. Names are stable — use them verbatim. Detail and DDL live in the adopted
`SOLUTION-DESIGN.md`; this is the reference index.

## Data entities (ERD)

| Entity | What it is |
|--------|-----------|
| `season` | Top scope; v1 has one. Exists for seasons-awareness (AD-18); no season feature is built. |
| `tournament` | The event. All data scopes by `tournament_id` under a `season`. |
| `player` | A person identified by SteamID64 (canonical) + mutable `display_name`. |
| `app_role` | A player's role (`admin` / `viewer`), mirrored into `app_metadata`; no client write policy. |
| `roster_entry` | A player's enrollment in a tournament; holds `bracket_seed`. |
| `demo` | A retained raw `.dem`: `(match_id, sha256)`, `(storage_backend, storage_key)`, `retention_class`. Single source of truth. |
| `match` | A bracket slot/fixture; single arbiter of result; holds `format`, `tie_policy`, `score_source`, terminal state. |
| `stat_row` | Per-player-per-match derived stats, `UNIQUE(match_id, steamid64)`; written only by the worker. |
| `award` | A catalog entry: bucket, class, deciding stat, eligibility floors; blurred until its spin. |
| `ceremony` | The Awards Roulette session; carries `state` and the ceremony-lock. |
| `stat_snapshot` / `stat_snapshot_row` | Immutable, integer-form copy of stats frozen at ceremony-lock; what the draw reads (AD-15, AD-19). |
| `spin` | One roulette spin; carries `revealed_at` (reveal-gating). |
| `award_result` / `award_result_winner` | A resolved award and its winner(s); `UNIQUE(spin_id, winner_entry_id)` enforces anti-sweep. |
| `verification_bundle` | The published, canonical (RFC-8785) JSON the client re-verifies; carries `bundle_hash`. |
| `audit_log` | Append-only record of every mutating admin action (actor, timestamp, before/after). |

## Match state machine

`Declared` → (`Bye` | `AwaitingGrace` | `Live`) ; `AwaitingGrace` → (`Forfeit` | `Live`) ;
`Live` → (`Pending` | `ManualResolved`) ; `Pending` → `Resolved` ; `Resolved` ↔ `Pending` (rollback)
and `Resolved` ↔ `Resolved` (re-parse-republish, one txn). Terminal: `Bye`, `Forfeit`, `Resolved`,
`ManualResolved`.

- **Declared** — `format` + `tie_policy` locked before the match goes live (AD-10).
- **Bye** — no opponent (seed-assigned); structural advance + badge, zero stats (AD-9).
- **AwaitingGrace** — one player absent; grace timer running.
- **Forfeit** — grace elapsed + admin walkover; zero stats; a late demo is archived but never flips the match (AD-23).
- **Live** — both present, match in progress.
- **Pending** — demo parsed, awaiting Aprobar; visible to admin only.
- **Resolved** — Aprobar committed; score from demo (AD-5/AD-6).
- **ManualResolved** — no demo; admin-entered score (permitted only when `demo_id IS NULL` or audited override).

## Ingest state machine

`Acquiring` → `Hashing` → `Deduped` → (`AlreadyIngested` | `Parsing`) ; `Parsing` ↔ `ParseFailed`
(bounded retry, pinned version) ; `Parsing` → `Validating` → (`Anomalous` | `Pending`) ;
`Anomalous` → `Pending` (admin accepts, logged) ; `Pending` → `Approved` (Aprobar, atomic) ;
`Approved` ↔ `Pending` (rollback) ; `Approved` ↔ `Approved` (re-parse-republish, one txn).

- **AlreadyIngested** — `(match_id, sha256)` exists; short-circuits to the prior result (AD-3).
- **Anomalous** — failed a validation gate (Σkills ≠ Σdeaths, zero stat rows, unreconciled SteamID64).
- **Pending / Approved** — status governing RLS visibility: viewers read `Approved` only (AD-7).

## The two seeds (never reused for each other — AD-13)

- **`bracket_seed`** — random seed for double-elimination bracket generation; stored on `roster_entry`/`match`; CAP-4.
- **`fair_seed`** — `SHA-256(final_demo_bytes)`, the Awards Roulette RNG seed; frozen when the championship demo is Approved; published as `seed_hex`; CAP-6.

## Fairness terms

- **Two-stage draw** — Stage 1 (seeded luck) picks which categories are live this spin; Stage 2 (deterministic) resolves each live category's winner from the frozen snapshot.
- **Luck-meter** — published `luck.weight_table` (decreasing ints, e.g. `[100,40,16,6,2,1]`) that biases Stage-1 category selection toward players with empty shelves (empty shelf ⇒ heaviest weight).
- **Tie ladder (FR-29)** — deterministic tie-break order: (1) secondary stat, (2) efficiency cross-multiply, (3) head-to-head, (4) earliest `achievement_ts`, (5) shared co-winner.
- **Anti-sweep** — ≤1 trophy per player per spin; an awarded player is removed from later candidate sets that spin; DB-enforced by `UNIQUE(spin_id, winner_entry_id)`.
- **Pity** — after all spins, every non-fully-DQ'd player with an empty shelf gets a guaranteed consolation award (seeded reveal order; the outcome is invariant).
- **Reveal-gating** — award identities and per-spin winners are invisible to non-admins until their spin (`spin.revealed_at`); a distinct RLS axis from pending/approved (AD-22).
- **Commitment** — `seed_hex` + `bundle_hash` published up front so the bundle bytes can't change; the full verification bundle is released progressively per reveal, in full at completion.
- **`algo_version`** — `inclusivcup-roulette-1.0.0`; a MAJOR bump signals an outcome-affecting change; a client refuses to "verify" a MAJOR it does not implement.
- **PRNG** — HMAC-SHA256 counter-mode, raw 32-byte seed key, per-decision domain-separation labels (e.g. `inclusivcup/v1/stage1/spin/<S>`, `inclusivcup/v1/pity`), unbiased `uniform_int` via rejection sampling; all decision arithmetic integer-only.
- **Golden / conformance vectors** — language-neutral JSON in `roulette/vectors/` the Go producer and JS verifier must both pass byte-for-byte; includes an end-to-end vector projected from a *real* captured snapshot (AD-14, AD-19).

## Award taxonomy

- **Buckets** — `skill`, `comedy`/anti-skill, `clutch`/heroic, `weird` (demo-only: knife kills, molotov damage, wallbangs).
- **Classes** — `rate` (normalized; early-eliminated players can still win) and `volume` (reward the grinders).
- **Anti-farm floors (FR-21)** — ≥24 rounds played for rate/comedy awards; ≥20 kills for HS%/rate; AFK/idle DQ at ≥50% idle rounds.

## Fixed Spanish strings (load-bearing — AD-24)

| String | Where |
|--------|-------|
| `INCLUSIVCUP` | Wordmark (`INCLUSIV` ink-primary, `CUP` accent-blue); invariant, never gold. |
| `Verificar la ceremonia` | Verify button — runs client-side reproduction. |
| `Verificado desde el demo` | Stat/result provenance label. |
| `Sembrado por el demo final · reproducible` | Verify-strip seed caption. |
| `Pendiente` | `status = pending` label. |
| `Aprobado` | `status = approved` label. |
| `Premio X de 12 — bloqueado hasta que gire` | Locked award-card label. |
| `fuerza en lo que otros ignoran` | Roulette framing — strength in what others ignore. |

## Visual identity (load-bearing — DESIGN.md)

- **Dark-only v1.** `page #0F1419`, `surface-1 #171E26`, `surface-2 #1E2832`, `border-hairline #232C36`.
- **Ink.** `ink-primary #F4F6F8`, `ink-secondary #B7C2CE`, `ink-muted #8A97A6`.
- **Two accents only.** `accent-live` blue `#2F81F7` (live, nav, verify, admin controls, `CUP`); `reveal-gold` `#FFB23E` (award reveals/winners, INCLUSIV360 wheel, champion border, prize chip) — withheld from ~95% of the app so the ceremony lands as an event.
- **Match semantics.** `win #3FB950`, `loss #F0556A` (scores, forfeits, anomalies, grace threshold only).
- **Type.** Archivo 700 (wordmark, display numbers, headings); system-ui/Inter (body); mandatory tabular lining numerals on every stat/score/seed/timer/hash.
- **Flat.** No gradients (one tolerated <10%-opacity ceremony glow), no extra hues, depth via tone + hairline, never shadow.
