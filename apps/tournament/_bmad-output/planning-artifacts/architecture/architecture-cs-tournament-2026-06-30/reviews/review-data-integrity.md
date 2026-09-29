---
review-type: data-integrity (pre-handoff gate)
spine: ARCHITECTURE-SPINE.md
scope: data model + schema + RLS + determinism contract ONLY
reviewer-role: data-integrity reviewer
date: 2026-06-30
verdict: CONCERNS
---

# Data-Integrity Review — InclusivCup Architecture Spine

**Scope:** Reviewed ONLY data/schema/security integrity per the probe. Did not assess UX,
performance, cost, or general feature completeness except where they bear on integrity.

**What I reviewed against:** the spine's ERD, invariants AD-1..AD-18, the Provably-Fair
contract, and the Consistency Conventions table — cross-checked against the PRD FRs
(FR-2, FR-13, FR-16, FR-21, FR-29, FR-34) it binds. No SQL migrations exist yet
(`supabase/migrations/` is empty); this is a review of the *contract as specified*, so every
finding names the constraint/field that must appear in `0001`/`0002` to close it.

---

## Verdict: CONCERNS

The spine is unusually disciplined: FORCE RLS with split viewer/admin policies, service-role
sole-writer, append-only audit by absence of UPDATE/DELETE, content-addressed immutable demos,
integer-only determinism, and a frozen snapshot for the ceremony are all the *right* primitives,
and the high-level shapes are correct. It does **not** FAIL — none of the load-bearing invariants
are wrong. But there are several concrete integrity holes where the *prose invariant* is correct
yet the *constraint that enforces it is unstated or under-specified*, and at handoff a builder
would have latitude to implement a version that drifts, leaks Pending, orphans rows, or breaks
determinism. Those must be closed in the migration contract before build.

---

## Findings

### Severity legend
- **HIGH** — a path to data corruption, a published-result drift, or an RLS leak / fail-open.
- **MEDIUM** — an orphan/cascade/uniqueness gap that produces wrong-but-not-leaked data, or a
  determinism hole that breaks reproducibility.
- **LOW** — a hardening gap; correct as written but one missing constraint from being load-bearing.

---

### H1 [HIGH] — Re-parse delete-missing + status reset can silently un-publish an *approved* match's stats

**Where:** AD-3 + AD-8 + ingest lifecycle (`Approved --> Approved: re-parse-republish, one txn`).

AD-3's re-parse rule is `INSERT … ON CONFLICT (match_id, steamid64) DO UPDATE` **plus a delete of
SteamIDs absent from the new parse**, **and forces rows back to `status='pending'`**. But the
lifecycle also allows `Approved --> Approved` re-parse. Two collisions:

1. **The forced `status='pending'`** on re-parse of an **already-Approved** match means a
   re-parse momentarily (or, if the txn is interrupted, permanently) drops an approved match out
   of viewer visibility — and if AD-6's atomic republish is *not* re-run in the same transaction,
   the bracket score, feed entry, and leaderboard remain on the old (now-pending) data. AD-3 says
   "forces back to pending"; AD-8 says "re-parse-republish, one txn". These two rules are in
   tension and the spine never states which wins for an Approved match. **A re-parse of an
   approved match must NOT reset to pending without re-running the full AD-6 publish atomically,
   or it tears published state.**
2. **The delete-missing step is unscoped against the ceremony snapshot.** If the deciding/final
   demo is re-parsed after `stat_snapshot` is frozen, delete-missing on `stat_row` is fine for the
   snapshot (AD-15 reads only the snapshot) — but it is **not** fine for the published bracket
   score if that match decided an advance. Re-parse that drops a SteamID who was the basis of a
   score-of-record can change `demo_derived` score under a *resolved* bracket edge with no
   transitive rollback. AD-8 handles rollback→advance transitivity but not **re-parse→advance**
   transitivity.

**Fix:**
- State explicitly that re-parse of a match in `status='approved'` runs the **entire AD-6
  transaction** (publish + score + advance + feed + leaderboard) atomically, or is rejected and
  routed through rollback-first. Add a guard: re-parse may only set `status='pending'` for a
  match whose bracket edge is **not yet consumed by a resolved downstream match**; otherwise it
  must flag (AD-8's "flag, never auto-revert" rule) rather than mutate.
- Add `CHECK`/trigger: deleting a `stat_row` whose `(match_id)` feeds a `score_source='demo_derived'`
  match that is already `resolved` requires the re-parse txn to recompute and re-assert the score
  in the same transaction.

---

### H2 [HIGH] — Viewer RLS `USING (status='approved')` leaks Pending through *child/joined* tables that carry no status column

**Where:** AD-7. The split-policy design is correct **for `stat_row`** (which has a `status`
column). But the leak surface is the tables that have **no `status` of their own** yet expose
pending-derived facts by FK:

- `award_result` / `award_result_winner` / `spin` — these belong to a `ceremony` and reference the
  **snapshot**, so they are gated by ceremony state, not by `stat_row.status`. If a viewer policy
  is written naively as "ceremony rows are public once started," a viewer could read award results
  while the ceremony is `spinning` but a `spin.reveal` has not yet fired — i.e., read a winner
  before its dramatic flip. The spine's AD-11 says ceremony channel is "public once started" but
  never states the **row-level** gate: an `award_result` must be viewer-readable only **after its
  spin's reveal is committed**, not merely after ceremony start.
- `demo` table — has `storage_key`, `demo_sha256`, `retention_class` but **no viewer policy is
  specified at all** in AD-7 (which only names `stat_row`). If RLS is enabled+FORCE but **no
  viewer SELECT policy exists** on `demo`, viewers correctly see nothing (fail-closed — good). But
  the verification bundle publishes `seed_hex`; if a builder adds a "public demo metadata" view to
  serve the seed and forgets the gate, the pre-publish seed of an unfinished tournament leaks. The
  seed must only be readable once `ceremony.state IN ('locked','spinning','complete')`.
- `audit_log` — contains `detail jsonb` with **before/after of every admin action**, including
  unpublished/pending state and granted roles. AD-17 specifies INSERT-only-by-service-role and no
  UPDATE/DELETE, but **says nothing about SELECT**. With FORCE RLS and no SELECT policy, viewers
  see nothing (good) — but the spine must *state* "no viewer SELECT policy on `audit_log`;
  admin-only via `is_admin()`," because an append-only log of admin before/after is a Pending-leak
  vector if a builder adds a "recent activity" feed sourced from it.

**Fix:**
- For every table reachable by a viewer, the migration must declare its **explicit** viewer policy
  or explicitly declare *no* viewer policy (fail-closed). Add to AD-7: "Every table has FORCE RLS;
  a table with no viewer SELECT policy is viewer-invisible by design — this is enumerated per table
  in `0002`, never left implicit."
- `award_result` viewer policy: `USING (EXISTS (SELECT 1 FROM spin s WHERE s.id = spin_id AND
  s.revealed_at IS NOT NULL))` — add a `spin.revealed_at timestamptz` column so reveal is a
  committed row fact, not a wire event. (Closes the "winner visible before flip" leak and makes
  AD-11's "reconstructable from published-state read alone" literally true.)
- `demo` / seed exposure: gate any seed-bearing read on `ceremony.state <> 'not_started'`.
- `audit_log`: state admin-only SELECT via `is_admin()`, no viewer policy.

---

### H3 [HIGH] — `is_admin()` source-of-truth and the app_metadata refresh hole

**Where:** AD-12. The chain Steam-OpenID → service-role writes `app_metadata` → RLS reads
`auth.jwt() -> 'app_metadata'` is correct and the right design. Two precision/escalation/refresh
holes:

1. **Stale JWT after role grant/revoke.** Role is written to the `app_role` table **and mirrored**
   to `app_metadata`. But `app_metadata` is baked into the JWT at token-issue time. If an admin
   **revokes** a role (e.g., removes a co-admin), the revoked user's *existing* JWT still carries
   `role=admin` in `app_metadata` until it expires/refreshes. RLS reading from the JWT will keep
   honoring the stale admin claim. For a grant this is merely a delay; for a **revoke** it is a
   privilege-escalation window. The spine never states a forced-refresh / session-invalidation on
   role change.
2. **`is_admin()` must read the JWT, not the table, to be RLS-safe — but then the table and JWT
   can disagree.** If `is_admin()` is defined as "SELECT role FROM app_role WHERE steamid64 =
   jwt.steamid64" it re-reads the table (consistent, but `app_role` then needs its own RLS that
   doesn't recurse). If it reads `auth.jwt()->'app_metadata'->>'role'` it is stale per (1). The
   spine asserts both ("RLS reads role/steamid64 only from app_metadata" **and** "Role lives in an
   app_role table") without resolving which `is_admin()` trusts. This ambiguity is a fail-open
   risk: a builder could write `is_admin()` to fall back to `true` on a null claim.

**Fix:**
- Define `is_admin()` canonically in the spine: `SECURITY DEFINER`, reads
  `auth.jwt()->'app_metadata'->>'role' = 'admin'`, **returns false on any null/missing claim**
  (explicit fail-closed: `COALESCE(... , false)`).
- State the refresh contract: a role **revoke** must invalidate the target's active sessions
  (Supabase Admin API sign-out / token revocation) in the same admin action that updates
  `app_role` + `app_metadata`, and that action writes an `audit_log` row. Without forced
  invalidation, revoke is not effective until token expiry — document the chosen max token TTL as
  the bounded escalation window if forced sign-out is deferred.
- `app_role` gets FORCE RLS, **no client write policy** (already stated), and an admin/service SELECT
  policy that does not recursively call `is_admin()` (avoid infinite RLS recursion — read steamid64
  directly from the JWT).

---

### M1 [MEDIUM] — Co-winner shape: sole-vs-shared is expressible but **anti-sweep accounting is under-constrained**, and `is_shared` can disagree with the winner count

**Where:** ERD `AWARD_RESULT ||--|{ AWARD_RESULT_WINNER` (1..N) + `is_shared` flag + AD-14
anti-sweep.

The 1..N child-row shape **cleanly expresses sole vs shared** (one winner row = sole; N>1 = shared
co-winners), and is correctly chosen over a string/array (Consistency table) — good. But:

1. **`is_shared` is a derived denormalization that can drift.** `award_result.is_shared` is a
   boolean while the truth is `COUNT(award_result_winner) > 1`. Nothing constrains them to agree.
   A re-run or a partial write could leave `is_shared=false` with 2 winner rows, or vice-versa.
2. **Anti-sweep accounting has no DB-level uniqueness.** AD-14's "≤1 trophy per player per spin"
   is enforced only in worker logic. There is **no constraint** that a given `winner_entry_id`
   appears at most once across all `award_result_winner` rows whose `award_result.spin_id` is the
   same spin. A producer bug (or a re-run that doesn't clean prior rows) could award the same
   player two trophies in one spin, violating the published anti-sweep invariant **and** the
   determinism contract, with nothing in the schema to catch it.
3. **A shared co-winner trophy can itself violate anti-sweep silently.** If a tie bottoms out to a
   shared trophy (FR-29.5) including player P, and P already won a higher-priority award this spin,
   the anti-sweep rule ("remove already-awarded from later candidate sets") must remove P from the
   *shared* set too. There is no constraint asserting this; the worker must, but the schema can
   guard it.

**Fix:**
- Replace `is_shared` boolean with a **generated/derived** check, or drop it and compute on read.
  If kept for query convenience, add a deferred constraint / trigger asserting
  `is_shared = (winner_count > 1)`.
- Add `UNIQUE` enforcement for anti-sweep: a partial unique index over
  `(spin_id, winner_entry_id)` — i.e., **one trophy per player per spin** as a hard DB constraint.
  This requires `award_result_winner` to carry `spin_id` (denormalized from its `award_result`) or
  a unique index on a join; recommend adding `spin_id` to `award_result_winner` with a FK-consistency
  check, then `CREATE UNIQUE INDEX ON award_result_winner (spin_id, winner_entry_id)`.
- State that the producer, on re-run of a spin, **deletes the spin's prior `award_result` (cascade
  to winners) before re-inserting**, so accounting can't accumulate.

---

### M2 [MEDIUM] — Orphan / cascade behavior is entirely unspecified across the ERD

**Where:** all FK relationships. The ERD shows cardinalities but the spine **never states ON
DELETE / ON UPDATE behavior** for a single FK. Concrete risks:

- `stat_row.match_id → match`, `stat_row` derived from `demo` (via `demo.match_id`): if a `match`
  or `demo` is deleted, are `stat_row`s cascaded or orphaned? AD-1 says the raw demo and hash are
  **never deleted** — good — but `match` deletion (e.g., a mis-generated bracket regenerated) has
  no stated rule. Orphaned `stat_row` (match_id pointing nowhere) breaks every leaderboard join.
- `award_result.spin_id → spin`, `award_result_winner.award_result_id → award_result`: a deleted
  spin (re-run) must cascade to results→winners or it orphans. M1's "delete prior before re-insert"
  needs `ON DELETE CASCADE` here to be safe.
- `stat_snapshot_row → stat_snapshot`, `ceremony.snapshot_id → stat_snapshot`,
  `verification_bundle → stat_snapshot`: the snapshot is immutable (AD-15) and the bundle references
  it — these must be `ON DELETE RESTRICT` (you must never be able to delete a snapshot that a
  published ceremony/bundle depends on), the opposite default from the others.
- `award_result_winner.winner_entry_id → roster_entry`: if a roster entry is removed
  (FR-3 allows removal **before bracket generation**), this FK is fine pre-ceremony, but post-
  ceremony it must be `RESTRICT` — you cannot delete a roster entry that won a published award.

**Fix:** add a cascade policy column to the spine's contract — recommended defaults:
- **Derived, regenerable children:** `stat_row`, `award_result`, `award_result_winner`, `spin` →
  `ON DELETE CASCADE` from their owning parent (match/demo for stats; ceremony/spin for awards).
- **Published / immutable referents:** `stat_snapshot`, `stat_snapshot_row`, `verification_bundle`,
  and any `roster_entry`/`player` referenced by a *published* award → `ON DELETE RESTRICT`.
- `audit_log.actor_steamid64 → player` → `ON DELETE RESTRICT` (you must never lose the actor of a
  logged action — that would defeat AD-17's traceability).
- `demo` → never deletable for `retention_class='permanent_seed'` (AD-16) — see M4.

---

### M3 [MEDIUM] — Frozen snapshot vs live `stat_row`: the snapshot's *immutability* is asserted but not *enforced*, and the capture moment is racy

**Where:** AD-15 + `CEREMONY ||--|| STAT_SNAPSHOT : freezes`.

The design (resolve winners only from `stat_snapshot`/`_row`, never live `stat_row`) is exactly
right and is the correct drift-defense. But:

1. **Nothing makes `stat_snapshot_row` actually immutable.** AD-17 makes `audit_log` append-only
   "by absence of UPDATE/DELETE policy." The same technique must be stated for `stat_snapshot` /
   `stat_snapshot_row`: service-role INSERT only at lock, **no UPDATE/DELETE policy thereafter**.
   The spine asserts immutability in prose but never assigns it the audit_log's enforcement
   mechanism. Without it, the service-role (sole writer) could overwrite a snapshot row and the
   "reproducible result" silently drifts — and the published `bundle_hash` would then not match a
   re-verification, surfacing as a *failed* verification rather than a caught bug.
2. **Capture-moment race.** AD-15 says the snapshot is "captured at ceremony-lock." AD-3 allows
   re-parse of an Approved match. If a re-parse commits **between** snapshot read and snapshot
   write (or between lock and the first spin), the snapshot could capture a half-updated set. The
   snapshot capture must be a single serializable transaction that reads `stat_row WHERE
   status='approved'` and writes `stat_snapshot_row` atomically, **and** ceremony lock must block
   further approves/re-parses of any match feeding the snapshot.

**Fix:**
- State the immutability mechanism explicitly: `stat_snapshot` and `stat_snapshot_row` get INSERT
  (service-role) only, **no UPDATE/DELETE policy** — append-once, like `audit_log`. Add
  `ceremony.locked_at` and assert rows are only insertable while `ceremony.state='locked'` in the
  same txn.
- State that ceremony lock sets a tournament-level guard (`tournament.ceremony_locked_at`) that the
  Aprobar/re-parse server routes check and **reject** further mutations of matches whose stats feed
  the snapshot, so AD-15's "live re-parses change leaderboards but never the ceremony" is true by
  construction rather than by convention. Capture runs at `ISOLATION LEVEL SERIALIZABLE`.
- Persist the `bundle_hash` and `snapshot_id` together in `verification_bundle` so a re-verify
  proves it verified *this* snapshot (already partially implied; make it a NOT NULL FK + stored
  hash).

---

### M4 [MEDIUM] — `permanent_seed` delete-proofing is application-level only; one missing DB guard and it is deletable

**Where:** AD-16. `retention_class='permanent_seed'` ⇒ `delete_after = NULL` and `DemoStore.Delete()`
**refuses** them. This is correct at the application layer, but:

- The refusal lives in Go code (`worker/store`), not in the DB or the object store. A direct
  service-role DELETE on the `demo` row (or an R2 lifecycle rule, or a future admin tool) bypasses
  the Go guard entirely. The seed demo is the **fairness seed source** (AD-13) and the **dispute
  referee** (AD-1) — losing it is unrecoverable and breaks `Verificar la ceremonia` forever.

**Fix:**
- Add a DB-level guard on the `demo` row: a `BEFORE DELETE` trigger that raises if
  `retention_class='permanent_seed'` (or a separate `is_deletable boolean GENERATED ALWAYS AS
  (retention_class <> 'permanent_seed')` plus a delete-rule). Defense in depth so neither a stray
  service-role call nor a future tool can drop the seed.
- Pair with an R2 **Object Lock / retention policy** on the seed key, or at minimum document that
  R2 lifecycle rules must exclude `permanent_seed` keys, since the DB trigger does not protect the
  bytes in R2.
- Note: AD-16 stores `(storage_backend, storage_key)` + hash but the ERD's `DEMO` entity does not
  list `delete_after`. Add `delete_after timestamptz NULL` to the entity so the contract is visible.

---

### M5 [MEDIUM] — `(match_id, sha256)` and `(match_id, steamid64)` are *correct* but insufficient alone under re-parse versioning

**Where:** AD-3, ERD `DEMO`, `STAT_ROW`.

The two unique constraints are correct for idempotent ingestion: `UNIQUE(match_id, sha256)`
short-circuits a duplicate-bytes re-upload, and `UNIQUE(match_id, steamid64)` makes the upsert
target unambiguous. **However:**

1. **`UNIQUE(match_id, sha256)` permits multiple distinct demos per match.** That is *intended*
   (a re-uploaded different demo, or a corrected demo, is a new row with a new hash and bumped
   `parse_generation`). But then **which demo is the score-of-record?** `match.demo_id` is a single
   nullable FK — fine — but nothing constrains `match.demo_id` to point at the *latest/approved*
   demo for that match, nor that `stat_row.match_id` rows came from *that* demo. `stat_row` is keyed
   `(match_id, steamid64)` with **no `demo_id`**, so if match M has demo A (gen 1) and a later demo
   B (gen 2) for the same match, the single `stat_row` per (M, steamid) cannot say which demo
   produced it. Under re-parse this is the upsert target (good) but it means **you cannot tell
   whether a stat_row is stale relative to `match.demo_id`** — an integrity ambiguity at the heart
   of the determinism story.

**Fix:**
- Add `demo_id` (and/or `parse_generation`) to `stat_row`, with a check that all rows for a match
  share the `demo_id` currently designated by `match.demo_id`. Either:
  (a) keep `UNIQUE(match_id, steamid64)` and add `stat_row.source_demo_id` + a trigger asserting it
  equals `match.demo_id` at approve time; or
  (b) if multiple demos per match should each retain rows, change the unique key to
  `(demo_id, steamid64)` and resolve "score of record" purely through `match.demo_id`.
  Recommend (a) — it keeps the clean upsert and adds a provenance/staleness guard.
- Add a check that `match.demo_id`'s row has `match_id = match.id` (a demo can't be the score source
  for a different match) — a composite-FK or trigger, since `match.demo_id → demo.id` alone does not
  prevent a cross-match mispoint.

---

### M6 [MEDIUM] — Seasons-aware scoping: several tables reach `tournament_id` only transitively, which is a scope-leak risk for cross-tournament queries

**Where:** AD-18 + ERD. AD-18 requires "all event data scopes by `tournament_id`." The ERD scopes
the **top-level** entities to `TOURNAMENT` (roster_entry, match, award, ceremony, audit_log,
verification_bundle) — good. But the **derived/child** tables reach `tournament_id` only through a
chain:

- `stat_row → match → tournament` (no direct `tournament_id`)
- `demo → match → tournament`
- `award_result → spin → ceremony → tournament`; `award_result_winner → award_result → …`
- `stat_snapshot_row → stat_snapshot → ceremony → tournament`
- `app_role → player` (player is **global**, not tournament-scoped — correct, but `app_role.role`
  is then **global admin**, not per-tournament admin; see below).

Two concerns:

1. **Cross-tournament join hazard.** Once a second tournament exists (seasons-aware), any
   leaderboard/aggregate that forgets to filter by `tournament_id` will silently mix tournaments
   because `stat_row`/`demo` carry no direct scope. RLS does not save you here — viewer RLS gates on
   `status='approved'`, not on tournament. A builder query `SELECT … FROM stat_row WHERE
   steamid64 = ?` returns rows across all tournaments.
2. **`app_role` is global.** `role='admin'` per the ERD is a single global flag per player, not
   scoped to a tournament. For v1 (one event) this is fine, but AD-18's whole point is to not force
   a future migration. A future season with a different admin would need `app_role` to be
   `(steamid64, tournament_id, role)`. As written, granting admin for one event grants it for all.

**Fix:**
- Add a denormalized `tournament_id` to `stat_row`, `demo`, `award_result`, `award_result_winner`,
  `stat_snapshot_row` (and a trigger/generated-column keeping it consistent with the parent), so
  every aggregate can — and a future RLS policy can — scope directly. This is the cheap insurance
  AD-18 is explicitly buying.
- Decide now whether `app_role` is global or `(steamid64, tournament_id)`-scoped. For true
  seasons-awareness, scope it; if intentionally global for v1, **state that explicitly in AD-12/
  AD-18** so it's a recorded decision, not an accident. The current `UNIQUE` on `app_role.steamid64`
  encodes "one global role per player" — that is the choice that needs to be deliberate.

---

### L1 [LOW] — `steamid64` as `text` is the right call; lock it down further

**Where:** AD-4, ERD `PLAYER`. `text` with `CHECK (~ '^[0-9]{17}$')` correctly dodges the int64/JS
precision trap and the bundle's "SteamID64 as decimal strings" rule (Provably-Fair) is consistent.
This is **correct** — bigint would lose precision in the JS verifier and JSON. One hardening gap:
the regex `^[0-9]{17}$` admits non-canonical values (e.g., not starting with the `7656119…`
SteamID64 individual-account prefix, leading-zero strings). Not a correctness bug, but a stricter
`CHECK` (prefix `7656119`, or a numeric-range check on the 17-digit value) would reject malformed
IDs at the boundary rather than letting a typo'd manual entry become a permanent orphan join key.
**Fix:** tighten the CHECK to the SteamID64 individual range, and apply the **identical** regex on
`app_role.steamid64`, `stat_row.steamid64`, `audit_log.actor_steamid64`, and
`award_result_winner.winner_entry_id` (if that resolves to a steamid) so the contract is uniform.

---

### L2 [LOW] — `fair_seed` vs bracket seed separation is correct; assert non-reuse in schema, not just prose

**Where:** AD-13. The separation (`tournament.fair_seed = SHA-256(final_demo)` vs
`roster_entry.bracket_seed`/`match`) is correct and the lifecycles are properly distinct. The
"never reused for each other" rule is prose-only. **Fix:** keep them in **different tables/columns
with different types** (fair_seed is a 64-char hex `text`/`bytea`; bracket seed is whatever the RNG
recorded) so they are physically non-interchangeable, and add a `CHECK` that `fair_seed` matches
`^[0-9a-f]{64}$`. Also assert `fair_seed` is **write-once**: a `BEFORE UPDATE` trigger that refuses
to change a non-null `fair_seed` (AD-13's "never re-rolled" made structural). Today nothing stops a
service-role UPDATE from re-rolling it.

### L3 [LOW] — `match.state` / `match.score_source` / `award.priority` need DB-level enums + the priority global-unique constraint

**Where:** ERD `MATCH`, `AWARD`. `score_source ∈ {demo_derived, admin_manual}`, `match.state`,
`award.bucket`, `award.class`, `ceremony.state`, `demo.retention_class` are all described as closed
sets in prose but typed `text` in the ERD. **Fix:** make each a Postgres `enum` or `CHECK`-bounded
`text` so an out-of-set value can't be written. Critically, `award.priority` is documented as
"GLOBAL unique strict order (anti-sweep)" — this **must** be `UNIQUE NOT NULL` (per tournament, if
scoped per M6) or the anti-sweep "ascending priority" iteration is non-deterministic when two
awards share a priority, breaking AD-14's determinism contract. State the `UNIQUE(tournament_id,
priority)` constraint explicitly.

### L4 [LOW] — AD-5 `admin_manual` override condition is an OR that can be satisfied without an audit row

**Where:** AD-5. "an `admin_manual` override requires `demo_id IS NULL` *or* an explicit override
flag **and** a matching audit row." Operator-precedence ambiguity: `A OR B AND C` parses as
`A OR (B AND C)`, so the `demo_id IS NULL` branch does **not** require an audit row. That's likely
intended (no demo ⇒ manual entry is the only source) — but FR-16/AD-17 imply *every* mutating admin
action is audited. **Fix:** state the grouping explicitly and require an `audit_log` row for **any**
`score_source='admin_manual'` write regardless of branch (a manual entry is itself a mutating admin
action under AD-17). Enforce with a trigger that rejects a manual-score write lacking a same-txn
audit row, or assert it in the server route contract.

---

## Summary of constraints that must appear in `0001`/`0002` to close findings

| # | Sev | Hole | Closing constraint / field |
|---|-----|------|----------------------------|
| H1 | HIGH | Re-parse can un-publish / tear an approved match | Re-parse of approved = full AD-6 txn or reject; guard on consumed bracket edges |
| H2 | HIGH | Pending/seed/audit leak via status-less child tables | Per-table explicit viewer policy (fail-closed); `spin.revealed_at` gate; seed gated on ceremony.state; audit_log admin-only SELECT |
| H3 | HIGH | Stale-JWT escalation on role revoke; `is_admin()` fail-open | `is_admin()` = `COALESCE(jwt app_metadata role='admin', false)`; force session-invalidation on revoke |
| M1 | MED | Anti-sweep / co-winner accounting unconstrained | `UNIQUE(spin_id, winner_entry_id)`; derive/assert `is_shared`; delete-prior-on-rerun |
| M2 | MED | No ON DELETE/UPDATE behavior anywhere | CASCADE for derived children; RESTRICT for snapshot/bundle/audit actor/published winners |
| M3 | MED | Snapshot immutability + capture race | No UPDATE/DELETE policy on snapshot tables; SERIALIZABLE capture; ceremony-lock guard |
| M4 | MED | permanent_seed deletable below the Go guard | DB BEFORE DELETE trigger + R2 object-lock; add `delete_after` to ERD |
| M5 | MED | stat_row provenance vs `match.demo_id` ambiguous | Add `stat_row.source_demo_id` + match.demo_id consistency check |
| M6 | MED | Derived tables reach `tournament_id` only transitively; app_role global | Denormalize `tournament_id` onto child tables; decide app_role scope |
| L1 | LOW | steamid64 CHECK too permissive | Tighten regex to SteamID64 range; apply uniformly |
| L2 | LOW | fair_seed non-reuse / write-once prose-only | Different type/column; `^[0-9a-f]{64}$`; refuse-update trigger |
| L3 | LOW | enums + `award.priority` uniqueness | enum/CHECK on closed sets; `UNIQUE(tournament_id, priority)` |
| L4 | LOW | AD-5 override OR-precedence skips audit | Group explicitly; require audit row for any admin_manual write |

**Bottom line:** the invariants are right; the *enforcement* is too often left in prose or in
worker code where a builder could implement a drifting version. Close H1–H3 (publish-tear,
RLS leak surface, role-revoke escalation) before handoff — those are the ones that corrupt
published data or leak Pending. M1–M6 are real integrity gaps that the migration contract should
nail down rather than leave to convention. With those constraints written into `0001`/`0002`, this
spine is sound.
