# InclusivCup — Solution Design (Build Handoff)

**Companion to `ARCHITECTURE-SPINE.md`.** The spine is the *contract* (invariants AD-1..26, the
durable calls). This doc is the *expanded design* that the BMad epics/stories + dev phases build
from: concrete schema, policies, pseudocode, and a build order. Where the two ever disagree, **the
spine wins** — fix this doc, not the AD. Every section cites the ADs it realizes.

Status: final · Date: 2026-06-30 · Stack verified current mid-2026 (see spine *Stack*).

---

## 1. How to read this

- **`ARCHITECTURE-SPINE.md`** — invariants, paradigm, diagrams, capability map. Read first.
- **This doc** — the seed detail: DDL, RLS, the deterministic draw algorithm, the ingest job
  model, the auth flow, ops. Owned by the code once it exists; treat as a strong starting point.
- **`reviews/`** — the five gate reviews (tech-currency, adversarial, rubric, reconcile,
  data-integrity) that hardened the spine. Useful as a "why is this here" reference.
- **`.memlog.md`** — the chronological decision log (50 entries: every AD, version, and gate fix).

---

## 2. System topology & component responsibilities

| Component | Host | Responsibility | Writes | ADs |
| --- | --- | --- | --- | --- |
| Next.js app | Vercel | Viewer read surfaces (Spanish, mobile-first) + admin command routes | DB via service-role *after* `is_admin()` re-check | AD-6,7,8,11,12,24 |
| Go worker | Railway Hobby | Parse demos → derive stats → write; roulette **producer**; demo archival | `demo`, `stat_row`, snapshot, bundle — service-role | AD-1,2,3,14,16,26 |
| Cloudflare R2 | — | Raw-demo system of record (write-once, object-lock on seed) | worker only | AD-1,16 |
| Supabase | free tier | Postgres (RLS), Realtime (Broadcast), Auth (session) | — | AD-7,11,12 |
| Browser verifier | client | Pure re-verifier behind "Verificar la ceremonia" | none (reads published bundle) | AD-14,22 |
| MatchZy | CS2 server | Records GOTV, POSTs `.dem` to the worker | — | AD-16 |

**The two no-edge boundaries** (AD-2, dependency diagram): `worker/*` never imports `app/`+`lib/`
and vice-versa; their only coupling is `supabase/migrations` (schema+RLS) and `roulette/vectors`
(golden vectors). The roulette **producer** (`worker/awards`) and **verifier** (`lib/roulette`)
conform to the vectors independently.

---

## 3. Data model (DDL sketch)

Realizes AD-3,4,5,9,10,13,17,18,19,23 + the Consistency Conventions. SteamID64 is `text`
(`CHECK ~ '^[0-9]{17}$'`) everywhere — never `bigint` (JS `Number` precision). Surrogate `bigint`
PKs elsewhere. All event tables scope by `tournament_id` (AD-18). Closed-set columns are CHECK
enums. FKs declare `ON DELETE` (RESTRICT for source-of-truth, CASCADE for derived children).

```sql
-- migration 0001_core_schema.sql (intent; not final SQL)

create table season (
  id            bigint generated always as identity primary key,
  name          text not null,
  created_at    timestamptz not null default now()
);

create table tournament (
  id            bigint generated always as identity primary key,
  season_id     bigint not null references season(id) on delete restrict,
  name          text not null,
  state         text not null default 'registration_open'
                check (state in ('registration_open','registration_closed','bracket_live','ceremony','closed')),
  format_default text,
  final_match_id bigint,                 -- FK added after match exists; the seed source (AD-13)
  fair_seed     text,                    -- = SHA-256(final demo); WRITE-ONCE (set-once trigger) (AD-13)
  created_at    timestamptz not null default now()
);

create table player (
  steamid64     text primary key check (steamid64 ~ '^[0-9]{17}$'),  -- AD-4
  display_name  text not null,           -- MUTABLE, cosmetic, never a join key
  avatar_url    text,
  created_at    timestamptz not null default now()
);

create table app_role (                  -- event-global in v1 (per-season scoping deferred)
  steamid64     text primary key references player(steamid64) on delete cascade,
  role          text not null check (role in ('admin','viewer')),   -- AD-12
  granted_by    text references player(steamid64),
  granted_at    timestamptz not null default now()
);

create table roster_entry (
  id            bigint generated always as identity primary key,
  tournament_id bigint not null references tournament(id) on delete cascade,
  steamid64     text not null references player(steamid64) on delete restrict,
  bracket_seed  int,                     -- recorded random seed position (AD-13, distinct from fair_seed)
  status        text not null default 'active' check (status in ('active','removed')),
  registered_at timestamptz not null default now(),
  unique (tournament_id, steamid64)      -- one entry per Steam (FR-1)
);

create table demo (
  id              bigint generated always as identity primary key,
  match_id        bigint not null,       -- FK below
  demo_sha256     text not null,
  storage_backend text not null default 'r2' check (storage_backend in ('r2','supabase')),
  storage_key     text not null,         -- opaque (AD-16)
  size_bytes      bigint,
  source          text not null check (source in ('matchzy','manual_upload')),
  retention_class text not null default 'event_archive'
                  check (retention_class in ('event_archive','permanent_seed')),
  delete_after    timestamptz,           -- NULL = keep forever; permanent_seed => NULL (AD-16)
  parser_version  text not null,         -- pinned (NFR)
  parse_generation int not null default 1,
  archived_at     timestamptz not null default now(),
  unique (match_id, demo_sha256)         -- AD-3 idempotent demo identity
);

create table match (
  id            bigint generated always as identity primary key,
  tournament_id bigint not null references tournament(id) on delete cascade,
  bracket       text not null check (bracket in ('winners','losers','grand_final')),
  bracket_position text not null,        -- label "Winners R1", not running number
  bracket_slot  int not null,            -- structural routing index
  gf_order      int,                     -- 1 = GF, 2 = GF-reset (AD-21); NULL otherwise
  competitor_a  bigint references roster_entry(id),
  competitor_b  bigint references roster_entry(id),
  winner_entry  bigint references roster_entry(id),
  format        text,                    -- declared+locked BEFORE start (AD-10)
  tie_policy    text,
  format_locked boolean not null default false,
  state         text not null default 'declared'
                check (state in ('declared','awaiting_grace','live','bye','forfeit','pending','resolved','manual_resolved','rolled_back')),
  score_a       int,
  score_b       int,
  score_source  text check (score_source in ('demo_derived','admin_manual')),  -- AD-5 single discriminator
  manual_override boolean not null default false,
  demo_id       bigint references demo(id),
  created_at    timestamptz not null default now(),
  unique (tournament_id, bracket, bracket_slot, coalesce(gf_order,0))
);
alter table demo add constraint demo_match_fk foreign key (match_id) references match(id) on delete restrict;
-- AD-5 guard: admin_manual only when no demo, or explicit override + audit row exists
alter table match add constraint score_source_guard check (
  score_source is null
  or (score_source = 'demo_derived' and demo_id is not null)
  or (score_source = 'admin_manual'  and (demo_id is null or manual_override = true))
);

create table stat_row (
  id            bigint generated always as identity primary key,
  match_id      bigint not null references match(id) on delete cascade,
  steamid64     text not null,           -- NOT FK (FR-2 unreconciled left-join), AD-4
  demo_id       bigint not null references demo(id) on delete restrict,  -- provenance
  status        text not null default 'pending' check (status in ('pending','approved')),  -- AD-7
  kills int, deaths int, assists int,
  adr_damage int, rounds_played int,     -- ADR = adr_damage/rounds_played (overkill-capped) computed in the view
  hs_kills int, mvps int, flash_assists int, utility_damage int,
  kast_rounds int,                       -- KAST numerator (5s trade window); denom = rounds_played
  knife_kills int, wallbang_kills int, through_smoke_kills int, no_scope_kills int, blind_kills int,
  entry_frags int, opening_deaths int, clutches jsonb,   -- {"1":n,"2":n,...}
  idle_dq boolean not null default false, idle_round_count int,
  approved_at timestamptz, approved_by text references player(steamid64),
  unique (match_id, steamid64)           -- AD-3; re-parse = ON CONFLICT DO UPDATE
);

create table award (
  id            bigint generated always as identity primary key,
  tournament_id bigint not null references tournament(id) on delete cascade,
  name          text not null,
  bucket        text not null check (bucket in ('skill','clutch','weird','comedy')),
  class         text not null check (class in ('rate','volume')),
  deciding_stat text not null,
  direction     text not null default 'max' check (direction in ('max','min')),
  secondary_stat text,
  eff_num_key   text, eff_den_key text,  -- efficiency ratio (FR-29 rung 2), integer keys
  floor_rounds  int not null default 24, -- FR-21
  floor_kills   int not null default 0,  -- 20 for rate/HS awards
  priority      int not null,
  unique (tournament_id, name),
  unique (tournament_id, priority)       -- AD: global strict order for anti-sweep
);

create table ceremony (
  id            bigint generated always as identity primary key,
  tournament_id bigint not null references tournament(id) on delete cascade,
  state         text not null default 'not_started' check (state in ('not_started','locked','spinning','complete')),
  seed_demo_sha256 text,                 -- = tournament.fair_seed, frozen at lock (AD-13)
  snapshot_id   bigint,                  -- FK below; immutable (AD-15)
  algorithm_version text,
  spin_plan     jsonb,                   -- published spin plan (OQ-7)
  luck_weight_table int[],               -- luck-meter params
  started_at timestamptz, completed_at timestamptz
);

create table stat_snapshot (             -- write-once (AD-15)
  id            bigint generated always as identity primary key,
  tournament_id bigint not null references tournament(id) on delete cascade,
  taken_at      timestamptz not null default now(),
  content_sha256 text not null
);
alter table ceremony add constraint ceremony_snapshot_fk foreign key (snapshot_id) references stat_snapshot(id);

create table stat_snapshot_row (         -- the AD-19 verifier contract; write-once
  snapshot_id   bigint not null references stat_snapshot(id) on delete cascade,
  steamid64     text not null,
  stats_int     jsonb not null,          -- volume ints; rate {num,den}; secondary; efficiency {num,den}
  h2h           jsonb,                   -- per-opponent deciding values
  achievement_ts bigint,                 -- integer tick/epoch-ms; sentinel if absent
  rounds_played int, kills int, idle_dq boolean,
  primary key (snapshot_id, steamid64)
);

create table spin (
  id            bigint generated always as identity primary key,
  ceremony_id   bigint not null references ceremony(id) on delete cascade,
  spin_index    int not null,
  kind          text not null check (kind in ('main','pity')),
  live_award_ids jsonb,                  -- Stage-1 luck output
  revealed_at   timestamptz,             -- reveal-gating axis (AD-22)
  unique (ceremony_id, spin_index)
);

create table award_result (
  id            bigint generated always as identity primary key,
  spin_id       bigint not null references spin(id) on delete cascade,
  award_id      bigint not null references award(id) on delete restrict,
  deciding_value numeric,                -- display only; never an input to resolution
  is_pity       boolean not null default false,
  is_shared     boolean not null default false,   -- derived from winner count
  tie_ladder_exit_step int,
  unique (spin_id, award_id)
);

create table award_result_winner (       -- 1..N rows = co-winner shape (FR-29.5)
  id              bigint generated always as identity primary key,
  award_result_id bigint not null references award_result(id) on delete cascade,
  spin_id         bigint not null references spin(id) on delete cascade,  -- denormalized for the unique below
  winner_entry_id bigint not null references roster_entry(id),
  unique (award_result_id, winner_entry_id),
  unique (spin_id, winner_entry_id)       -- anti-sweep: <=1 trophy/player/spin (AD-26/FR-26), DB-enforced
);

create table verification_bundle (
  id            bigint generated always as identity primary key,
  tournament_id bigint not null references tournament(id) on delete cascade,
  seed_demo_sha256 text not null,
  snapshot_id   bigint not null references stat_snapshot(id),
  ceremony_id   bigint not null references ceremony(id),
  bundle_sha256 text not null,           -- the up-front commitment hash (AD-22)
  algorithm_version text not null,
  published_url text,
  published_at  timestamptz
);

create table audit_log (                 -- append-only (AD-17): no UPDATE/DELETE policy ever
  id            bigint generated always as identity primary key,
  tournament_id bigint not null references tournament(id) on delete cascade,
  actor_steamid64 text not null references player(steamid64),
  action        text not null,           -- generate_bracket|advance|mark_walkover|approve|reparse|rollback|declare_format|start_ceremony|grant_role
  target_match_id bigint,
  detail        jsonb,                   -- before/after
  occurred_at   timestamptz not null default now()
);
```

### Indexes worth pinning
- `stat_row (status)` partial + `(match_id)`; `demo (match_id)`; `match (tournament_id, bracket)`;
  `audit_log (tournament_id, occurred_at)`; `award (tournament_id, priority)`.

---

## 4. RLS policies (migration 0002) — AD-7, AD-12, AD-22

`ALTER TABLE … ENABLE ROW LEVEL SECURITY; … FORCE ROW LEVEL SECURITY;` on **every** table. The
worker + admin server routes use the **service-role** key (bypasses RLS). No `anon`/`authenticated`
write policy exists on any event table.

```sql
-- fail-closed admin check (AD-12)
create function is_admin() returns boolean language sql stable as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;
create function jwt_steamid64() returns text language sql stable as $$
  select auth.jwt() -> 'app_metadata' ->> 'steamid64'
$$;

-- stat_row: two SEPARATE policies, never OR'd (AD-7)
create policy stat_view  on stat_row for select using (status = 'approved');
create policy stat_admin on stat_row for select using (is_admin());

-- reveal-gated tables (AD-22): visible to viewers only once revealed; admins always
create policy spin_view  on spin for select using (revealed_at is not null);
create policy spin_admin on spin for select using (is_admin());
-- award / award_result / award_result_winner: gate on the parent spin.revealed_at; admins always.
-- award (catalog): viewer sees a row only once its spin has revealed it; name/deciding_stat hidden until then.
-- ceremony: viewer select using (state <> 'not_started'); seed/snapshot exposed per ceremony.state.

-- admin-only, no viewer policy at all:
create policy audit_admin    on audit_log        for select using (is_admin());
create policy snaprow_admin  on stat_snapshot_row for select using (is_admin());
-- (verification_bundle: public select using (published_at is not null))

-- NO insert/update/delete policy on any event table for anon/authenticated.
-- audit_log + stat_snapshot* have NO update/delete policy => append-only / write-once (AD-15,17).
```

**Role revoke (AD-12):** the grant/revoke admin route writes `app_role`, re-mints the target's
`app_metadata`, and **invalidates their session** (force refresh) so a stale JWT can't keep admin.

---

## 5. Identity & auth flow — AD-12

Steam is OpenID 2.0 (not OIDC), so it can't use Supabase's generic provider. Flow:

1. `GET /auth/steam/login` → redirect to Steam OpenID with `return_to=/auth/steam/callback`.
2. Callback **verifies server-side** via the Steam `check_authentication` round-trip (never trust
   redirect params), extracts `claimed_id` → SteamID64.
3. Upsert `player` (service-role); look up `app_role` (default `viewer`; bootstrap admins from an
   env-listed SteamID64 allowlist).
4. Ensure a Supabase auth user exists; write `{ steamid64, role }` into **`app_metadata`** via the
   Admin API (server-only; `user_metadata` is never read by RLS).
5. Mint the Supabase session cookie. RLS reads role/steamid64 from `auth.jwt()->'app_metadata'`.

Realtime auth and token refresh ride on Supabase Auth (this is why Option A beats a fully-custom
JWT). `display_name` is synced from Steam cosmetically only.

---

## 6. Ingest pipeline — AD-1,2,3,16,23,26

### Triggers → one pipeline
- **MatchZy auto** (primary, v1): `matchzy_demo_upload_url` → worker HTTP endpoint (shared-secret
  header). Worker streams the body straight to R2, then enqueues a parse job.
- **Admin web upload** (fallback): browser → R2 **presigned multipart** PUT (direct, bypasses
  Vercel 4.5MB cap) → small `POST /api/ingest/register {match_id, r2_key}` (well under the cap) →
  enqueues a parse job.
- **CLI** (offline fallback): admin runs the same Go binary on a local `.dem`; it uploads to R2 +
  writes via service-role. Identical `parse→write` core.

### Job model (AD-26)
Async job off the trigger (never inline in a request). Bounded concurrency; `ParseFailed` retried
with capped attempts + backoff against the **pinned** parser version. SM-5 budget (P50<5min,
P95<15min landing→visible) — parse is ~3.4s, so upload + queue depth dominate.

### State machine (AD-3) — see the spine's ingest stateDiagram
`Acquiring → Hashing → Deduped → (AlreadyIngested | Parsing) → Validating → (Anomalous | Pending) →
Approved`, with re-parse/rollback edges. Validation gate: conservation (`Σkills==Σdeaths`),
0-stat-row, unreconciled SteamID64 → `Anomalous` (rows written, match stays Pending, admin must
accept — logged). **Re-parse of an Approved match runs the full revert→reparse→republish in one
transaction** (AD-3/AD-6/AD-8) — no observable Pending window.

### AFK/idle (FR-21)
Per-tick positions (demoinfocs `Player.Position()`) + per-tick action events. Idle-round =
position-delta < epsilon AND zero shots/utility/damage that round. Idle-DQ a stat row at ≥50% idle
rounds. Sampling cadence + epsilon are config tuned within the SM-5 budget (Deferred).

---

## 7. Bracket & match — AD-8,9,10,21,23

- **Generation (FR-5):** double-elim from the closed roster using a recorded `bracket_seed`;
  non-power-of-two → byes assigned **by the seed**, reproducibly. Losers-bracket bye routing is a
  module detail (deterministic from the seed).
- **Advance (FR-7):** admin-only, server-gated, **idempotent** — `SET occupant = winner WHERE slot
  IS NULL OR occupant = winner`. Re-routing a different winner requires an explicit rollback first.
- **Two-loss elimination (FR-6)** is derived from bracket edges, never a stored flag.
- **Grand-final reset (AD-21):** two ordered `match` rows (`gf_order` 1, then 2 if the LB player
  wins game 1). Champion = winner of the last GF row; the slot is never overwritten in place.
- **Bye/Forfeit (AD-9,23):** zero stat rows; Forfeit only after the grace timer (default 10min,
  configurable) elapses, logged who/when. A late demo for a committed Forfeit/Bye is archived for
  evidence but produces **no** stat row (AD-23).
- **Format lock (AD-10):** `format`/`tie_policy` frozen before `live`; later change = audited
  override.

---

## 8. The Aprobar transaction & realtime — AD-6,11,20

**`POST /api/admin/approve` (one DB transaction):** (1) `stat_row.status='approved'` for the match;
(2) `match.score_source='demo_derived'`, `score`, `state='resolved'`; (3) idempotent bracket
advance; (4) append `timeline_feed` entry + refresh the single leaderboard materialization (AD-20).
**After commit only**, emit one Broadcast on `tournament:<id>` carrying the semantic change.

**Leaderboards (AD-20):** one SQL view/RPC over `status='approved'` rows applies FR-21 floors +
rate/volume normalization in exactly one place. ADR = `sum(adr_damage)/sum(rounds_played)` over
non-forfeit matches; KAST = `sum(kast_rounds)/sum(rounds_played)`. No second hand-rolled aggregate.

**Realtime (AD-11):** channels `tournament:<id>` (public), `ceremony:<id>` (public once started),
`admin:<id>` (admin-private). Broadcast is a **nudge** — clients re-fetch the published snapshot on
reconnect, never replay. Every surface is reconstructable from a published read alone.

---

## 9. Provably-fair engine (full spec) — AD-13,14,15,19,22

`algo_version = inclusivcup-roulette-1.0.0`. **Integer-only, explicitly-ordered, UTF-8-byte, no
floats, no locale.** Go (`crypto/hmac`+`crypto/sha256`) and browser (`SubtleCrypto`) must produce
bit-identical output.

### 9.1 PRNG (HMAC-SHA256 counter-mode)
```
seed       = SHA-256(final_demo_bytes)         # 32 raw bytes; published as 64-hex seed_hex
block(i,L) = HMAC_SHA256(key=seed, msg = utf8(L) || LE64(i))     # 32-byte blocks, i from 0
```
- `LE64` = 8-byte little-endian counter (the ONLY little-endian thing). Key = raw 32 bytes, **not**
  the hex string. Stream per label consumed left-to-right, byte by byte.
- Labels (domain separation): `inclusivcup/v1/stage1/spin/<S>` (S 1-based), `inclusivcup/v1/pity`.
  Each spin's stream is independent (counter starts 0).
- `uniform_int(stream, n)`: minimal `k` with `256^k ≥ n`; assemble `k` bytes **big-endian** into
  `x`; reject while `x ≥ 256^k − (256^k mod n)`; return `x mod n`. (For n ≤ 16, k=1.) Both runtimes
  reject on identical thresholds → identical byte consumption.

### 9.2 Stage 1 — weighted live-category selection
Per spin S, candidate pool = `spin_plan[S].pool` minus already-revealed. Integer weight per award
`a` = `luck_weight_table[min(shelf[provisional_winner(a)], table_max)]` (empty shelf ⇒ heaviest;
strictly-decreasing positive ints, e.g. `[100,40,16,6,2,1]`). `provisional_winner` = the
deterministic Stage-2 winner (no randomness). Draw `live_count` awards via stream-driven weighted
pick over awards in **ascending priority**; shelf is frozen at spin start for weighting.

### 9.3 Stage 2 — deterministic winner
Eligible (FR-21: `rounds_played≥24`; `kills≥20` for rate/HS; not `idle_dq`) candidates iterated in
`players_sorted` order (byte-lex on decimal SteamID64). Best deciding-stat value: volume = integer
compare; rate = cross-multiply `p.num*q.den vs q.num*p.den`. **Equal value/cross-product = tie →
ladder** (never silent argmax). ⚠ **DECISION E** (Cuatro 2026-08-04; recorded here by the 6-4a code
review): the single carve-out is a `max` **volume** award whose best value is `0` — it returns
`no_awardable_value` **carrying the suppressed byte-lex set** (its length is the width of the tie
that did not form, `1` when a lone eligible player sat at zero) and never reaches the ladder.
Scoped deliberately: `min` awards and `rate` awards tie at zero like any other value. FR-29 ladder: (1) secondary stat → (2) efficiency (cross-multiply)
→ (3) head-to-head (a strict dominator over the remaining set, else skip) → (4) earliest
`achievement_ts` (integer) → (5) shared co-winner.

### 9.4 Anti-sweep & pity
Process live awards in ascending priority; remove `assigned_this_spin` players from later candidate
sets (overflow re-resolves via the ladder). Co-winners all count. **Pity:** after all spins, every
non-fully-DQ'd player with `shelf==0` gets a consolation award (seeded reveal order via the pity
stream; outcome — everyone winless gets one — is invariant).

### 9.5 Bundle, commitment & reveal timing (AD-19, AD-22)
Bundle = RFC-8785 canonical JSON, ASCII-restricted, integers-only, SteamID64 as decimal **strings**:
`{algo_version, seed_hex, luck, spin_plan, awards, pity, players}` where `players` is the
**integer-form snapshot** (AD-19: volume ints; rate `{num,den}`; secondary; efficiency `{num,den}`;
h2h; integer `achievement_ts` + sentinel; eligibility inputs). `bundle_sha256` is published.
**Timing:** seed hash + `bundle_sha256` committed at ceremony start; catalog/snapshot/spin-plan
reveal-gated and released progressively per spin + in full at completion — verify confirms, never
spoils.

### 9.6 Conformance vectors (`roulette/vectors/`) — the build gate
Language-neutral golden JSON both Go + JS must pass byte-for-byte: (1) HMAC block vector; (2)
`uniform_int` incl. a rejection; (3) weighted pick; (4) canonicalization + `bundle_sha256`; (5)
**end-to-end golden ceremony** projected from a **real captured snapshot** (with forced ties
exercising every ladder rung, an anti-sweep overflow, and a pity draw). "Verificar la ceremonia"
runs the gate-5 code path against the real published bundle.

Build order: primitives (gate 1–2) → canonicalizer (gate 4) → Stage 2 + ladder → Stage 1 + anti-
sweep → pity → end-to-end (gate 5) → wire the JS verifier. The JS verifier needs **nothing** outside
the bundle; if it does, the bundle is incomplete (a spec bug).

> ⚠ **RENUMBERED BY STORY 6.11 (2026-08-12), DECISION AG — gates 4 and 5 were previously the other
> way round in this section.** For nine stories this document numbered **4** = the end-to-end
> ceremony vector and **5** = canonicalization, while `roulette/vectors/README.md`'s ownership table
> numbered them the opposite way, and the build-order sentence above named "gate 5" and "gate 4" in
> that reversed sense. Both readings always agreed on *what* was owed and on *who* owed it, so
> nothing about the build was ever ambiguous — only the label. 6.7 and 6.8a each recorded the clash
> without resolving it; 6.9a decided it (Cuatro, 2026-08-08) and deferred the edit to the story that
> would land the final row, because renumbering is only safe once the complete table exists. **The
> README's numbering is the one that survived** — it is the one already shipped in a table, in
> `generate_vectors.py`'s `outputs` map and in nine stories of prose since 6.3, and the one that
> matches the real build order (the canonicalizer landed at 6.9a; the end-to-end vector landed last,
> at 6.11). This section has been corrected to match it. Three sites were brought into agreement in
> one commit: this section, the README's ownership table, and `generate_vectors.py`'s two
> `outputs`-map comment blocks.
>
> ⚠ **A limitation the gate-5 vector declares on its own face:** FR-29 **rung 3** is unreachable
> *end-to-end* over the shipped corpus, because all 28 players have `matches_played = 1` and exactly
> one h2h opponent, so a Stage-2 tie on the deciding stat guarantees an h2h tie on it and rung 3's
> strict dominator can never exist. Rung 3 remains gated as a **unit** by `ladder-resolve.json`. The
> "every ladder rung" clause above is therefore satisfied across the suite, not within the single
> end-to-end case — stated here so a future reader does not read it as an unmet requirement.

---

## 10. Spanish UI & i18n — AD-24

All viewer copy Spanish, from one i18n module, no inline English literals. Exact load-bearing
strings + the state→label map:

| Key | String |
| --- | --- |
| verify.button | `Verificar la ceremonia` |
| stat.provenance | `Verificado desde el demo` |
| seed.caption | `Sembrado por el demo final · reproducible` |
| status.pending | `Pendiente`  (`stat_row.status='pending'`) |
| status.approved | `Aprobado`  (`stat_row.status='approved'`) |
| bracket.bye | `Pase directo` · forfeit | `W.O. / Ausente — sin estadísticas` |
| reconnect | `Reconectando…` · loading | `Cargando el evento…` |
| ceremony.stage1 | `Fase 1 — la suerte elige la categoría` · stage2 | `Fase 2 — las estadísticas eligen al ganador` |
| pity | `Ronda de consolación` · `Nadie se va con las manos vacías` |

Reduced-motion ceremony: identical resolution path + identical published spin order; motion is the
only difference (winners resolve directly in gold).

---

## 11. Operations & environments — AD-25, AD-26

- **Single env (v1):** one Supabase project, one Railway worker, one R2 bucket, one Vercel project.
- **Secrets** (server-only, never `NEXT_PUBLIC_*`): Supabase service-role key, R2 write creds, the
  worker↔MatchZy shared secret, the Steam API/realm config, Supabase JWT secret.
- **Cost:** CS2+MatchZy server ~$8–15/mo; Railway Hobby ~$5–10/mo at low utilization (bills
  CPU/RAM; ~$20–30 ceiling for 24/7 — **set a billing alert**); R2 ~pennies/mo; Supabase free.
- **Observability:** `ParseFailed` + parse anomalies → `admin:<id>` alert + log; never silent.
- **DR:** R2 raw demos are the durable source of truth (object-lock on `permanent_seed`); all
  derived DB state is re-derivable by re-parse; Supabase managed backups cover catalog/roster/audit.
- **Parser pinning:** `demoinfocs v5.2.0` pinned in `go.mod`; raw demos retained so a Valve format
  change is recovered by upgrading + re-parsing.

---

## 12. Suggested epic breakdown (for `bmad-create-epics-and-stories`)

Ordered by dependency; each maps to features/ADs.

1. **Foundation & schema** — migrations 0001/0002 (all constraints + RLS), Supabase/Vercel/Railway/R2
   project setup, secrets. (AD-1..18 substrate)
2. **Identity & roster** — Steam OpenID flow, `app_metadata` role binding, roster + registration
   window. (F1; AD-4,12)
3. **Demo ingest worker** — Go binary (HTTP + CLI), R2 `DemoStore`, parse→derive→upsert, anomaly
   gate, async job + retry. (F3; AD-1,2,3,16,23,26)
4. **Bracket & admin command routes** — double-elim gen/advance/forfeit/grand-final, Aprobar txn,
   re-parse/rollback, audit log. (F2,F7; AD-5,6,8,9,10,17,21,23)
5. **Leaderboards & realtime** — single leaderboard view (FR-21 floors), Broadcast topology,
   viewer surfaces (Spanish, mobile-first), reconnect. (F4,F5; AD-7,11,20,24)
6. **Awards roulette (producer + verifier)** — snapshot capture (AD-19), PRNG + two-stage draw +
   ladder + anti-sweep + pity, canonical bundle, reveal-gating, conformance vectors, ceremony UI +
   "Verificar la ceremonia". (F6; AD-13,14,15,19,22,24)
7. **Hardening** — billing alerts, object-lock, DR runbook, the build-handoff checklist items
   (AD-11 reconstructability, real-snapshot golden vector).

The provably-fair engine (epic 6) is the credibility keystone (SM-3) — build its primitives and
conformance vectors first within that epic.
