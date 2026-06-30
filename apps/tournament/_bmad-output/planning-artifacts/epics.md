---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/specs/spec-cs-tournament/SPEC.md
  - _bmad-output/specs/spec-cs-tournament/capability-map.md
  - _bmad-output/specs/spec-cs-tournament/glossary.md
  - _bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md
  - _bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/addendum.md
  - _bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/DESIGN.md
---

# cs-tournament (InclusivCup) - Epic Breakdown

## Overview

This document decomposes the InclusivCup CS2 tournament app into 7 epics and 51 stories. It is an **ADOPT** decomposition: the epics are the SPEC kernel's seven capabilities (CAP-1..CAP-7) one-to-one, in build order, and every story's acceptance criteria trace to the functional requirement(s) it satisfies **and** the architecture decision(s) that govern it. Stable IDs from upstream (CAP-1..7, FR-1..34, AD-1..26, UX-DR refs) are inherited verbatim; no requirement is re-derived and no locked decision is reopened.

The product keeps a private group of 8–16 friends invested to the final whistle by running orthogonal reward tracks off one trustworthy source — the CS2 demo, which is both the dispute referee and the RNG seed. v1 delivers the Champion bracket, a demo-sourced stats/leaderboard layer, the Awards Roulette ceremony, the timeline feed, and admin/viewer surfaces.

**Locked stack (do not reopen):** Next.js 16.2 (App Router, Node 20.9+) on Vercel · Supabase free tier (Postgres 15+, Auth, Realtime) · Go 1.26 worker with `demoinfocs-golang v5.2.0` (pinned) · Cloudflare R2 · MatchZy. Demo = single source of truth. SteamID64 (`text`, `CHECK (~ '^[0-9]{17}$')`) is the sole canonical join key. All mutations are server-gated, admin-only, idempotent, audited; RLS is `ENABLE`+`FORCE` everywhere, fail-closed. Schema is seasons-aware but no season feature ships.

**Out of scope (v1):** meta-games (predictions/fantasy/streaks/Wrapped), in-app money/prize handling, gentle/privacy "shame-award" opt-out mode, in-app scheduling/Discord-bot, season-persistence features, native mobile app, light mode, in-app dispute-raise affordance (disputes are evidence-only — read-only demo hash + re-parse + seed snapshot, settled in Discord).

## Requirements Inventory

### Functional Requirements

- **FR-1: Steam OAuth login** — A person authenticates with Steam; on success the system stores their SteamID64 and resolves to one roster identity.
- **FR-2: SteamID64 capture & reconciliation** — The system records each player's SteamID64 as the canonical join key and tolerates Steam display-name changes without breaking the link to their stats.
- **FR-3: Roster & registration window** — The admin can open and close registration and view/manage the roster.
- **FR-4: Roles (Admin vs Viewer)** — The system distinguishes Admin from Viewer; all event-mutating actions are admin-only.
- **FR-5: Random-seeded bracket generation** — The admin generates a double-elimination bracket from the closed roster using a random, recorded seed; non-power-of-two counts produce byes.
- **FR-6: Double-elimination structure** — Winners bracket, losers bracket, and grand final; each match loser routes into the losers bracket until a second loss eliminates them.
- **FR-7: Advance a match (live)** — The admin advances a match by tapping or dragging the winner forward; the change propagates to all viewers in real time.
- **FR-8: Byes** — A bye advances a player with a badge and creates no stats.
- **FR-9: No-show / Forfeit with grace timer** — The admin can mark a match a forfeit once the grace timer expires; the present player advances.
- **FR-10: Pre-declared match format & tie policy** — Each match's format and overtime/tie rule is declared, stored, and enforced before the match starts; no ad-hoc mid-match changes.
- **FR-11: Demo acquisition (MatchZy + manual fallback)** — The system accepts a demo for a match from MatchZy auto-upload and, as a fallback, from admin manual upload.
- **FR-12: Parse demo to stat rows** — The parsing worker turns a demo into normalized per-player stat rows keyed by `match_id` + SteamID64.
- **FR-13: Staged Pending → Approved** — Parsed stats land `Pending`; an admin reviews and Approves; only Approved stats reach leaderboards, the bracket, and the timeline feed.
- **FR-14: Re-parse / rollback** — An admin can re-parse a retained demo and can roll back an Approved match's stats.
- **FR-15: Raw demo retention & hash** — Every match's raw demo is retained in durable object storage and its SHA-256 hash is recorded (source of truth + fairness seed).
- **FR-16: Score derivation from demo** — Where a demo is present, the match score is derived from it rather than entered by hand.
- **FR-17: Walkover / Forfeit stat hygiene** — Forfeited/walkover matches contribute no stats; leaderboards normalize for matches actually played.
- **FR-18: Core per-player stats** — kills, deaths, assists, ADR, HS%, MVPs, flash assists, utility damage, KAST.
- **FR-19: Weird demo-only stats** — knife kills, wallbangs, through-smoke kills, no-scope kills, blind kills, molotov/HE damage.
- **FR-20: Derived stats** — entry frags / opening duels and 1vX clutches from the demo event stream.
- **FR-21: Anti-farm thresholds & AFK/idle DQ** — minimum-participation floors; idle players' match stats are disqualified from award eligibility.
- **FR-22: Rate vs volume normalization** — rate-class stats normalized per opportunity; volume-class stats as totals.
- **FR-23: Leaderboards / stat views** — a viewer browses leaderboards and a player's stat detail, mobile-first.
- **FR-24: Award catalog & buckets** — admin curates the award catalog before the ceremony; each award has a bucket, class, deciding stat, and eligibility floor, blurred from non-admins until its spin.
- **FR-25: Two-stage draw** — each spin selects live categories by seeded luck (Stage 1), then deterministically resolves each live category's winner from the locked stat snapshot (Stage 2).
- **FR-26: Anti-sweep (one-per-spin cap + luck-meter)** — within a spin a player wins at most one trophy; a hidden luck-meter biases Stage-1 selection toward players with empty shelves.
- **FR-27: Provably-fair seed** — the draw is seeded by the SHA-256 hash of the final match's demo, published with the results so anyone can recompute the ceremony.
- **FR-28: Pity roulette** — any player holding zero awards after the main spins enters a guaranteed consolation draw.
- **FR-29: Award-tie ladder** — ties on a deciding stat resolve by a fixed ladder ending in a shared co-winner trophy.
- **FR-30: Ceremony reveal** — each spin presents as a wheel animation with a dramatic per-category flip, on mobile and a shared screen.
- **FR-31: Timeline feed (single source of truth)** — posts bracket advances, Approved match results, and award reveals in chronological order, updating live.
- **FR-32: Navigation / information architecture** — mobile-first navigation across the timeline feed, the bracket, leaderboards, and (at end of event) the ceremony.
- **FR-33: Admin-gated actions** — the admin console exposes roster management, bracket generation/advancement, ingestion approval and re-parse/rollback, match-format/tie declaration, and ceremony control — all server-enforced admin-only.
- **FR-34: Viewer read-only mode** — a viewer has full read access to bracket, leaderboards, timeline feed, and ceremony, with no mutating capability.

### NonFunctional Requirements

- **NFR-Perf** — Demo-to-stats latency per SM-5 (P50 < 5 min, P95 < 15 min, demo-landed → stats-visible); live bracket/feed propagation to connected viewers within ~2 s; a 170 MB demo parses in seconds (PoC ~3.4 s, ~257 MB RAM).
- **NFR-Mobile** — Every viewer surface (home, feed, bracket, leaderboards, ceremony) usable one-handed at ~390 px; admin surfaces may assume a larger screen.
- **NFR-Reliability** — Ingestion idempotent on `match_id` + SteamID64; raw demos retained so any match can be re-parsed; parser version pinned to survive Valve format churn.
- **NFR-Security** — Steam OAuth for identity; all event-mutating actions server-enforced admin-only; worker writes use a service-role path distinct from viewer access; secrets server-only.
- **NFR-Verifiability** — Provably-fair seed (final demo hash), stat snapshot, and draw algorithm are published so any player can reproduce the ceremony; every retained demo is re-hashable to its stored value.
- **NFR-Data** — SteamID64 is the canonical join key across roster and stats; schema is seasons-aware (no season features built).

### Additional Requirements

Binding architecture decisions (ARCHITECTURE-SPINE, AD-1..26) governing implementation:

- **AD-1** Demo is the immutable source of truth — raw `.dem` retained write-once, identified by `(match_id, sha256)`, re-hashable byte-for-byte; re-parse/rollback touch only derived rows.
- **AD-2** Single-writer derivation — the Go worker (service-role) is the only writer of `demo` and `stat_row`; the app has no stat-write code path.
- **AD-3** Idempotent ingestion — `demo UNIQUE(match_id, sha256)`, `stat_row UNIQUE(match_id, steamid64)`; re-parsing an Approved match runs revert→reparse→republish in one transaction.
- **AD-4** SteamID64 is the sole canonical join key — Postgres `text`, `CHECK (~ '^[0-9]{17}$')`; `display_name` cosmetic, never a join key; unmatched IDs land in an unreconciled list.
- **AD-5** One score source per match — `score_source ∈ {demo_derived, admin_manual}`; manual permitted only when `demo_id IS NULL` or with a matching audited override.
- **AD-6** "Aprobar" is one atomic transaction — publish rows, set demo-derived score, advance bracket, post feed entry, recompute leaderboards in one DB transaction; realtime emit only after commit.
- **AD-7** Viewers read approved-only at row level — RLS `FORCE`; viewer policy `USING (status='approved')`, admin Pending visibility a separate `USING (is_admin())` policy; never OR'd.
- **AD-8** Idempotent, server-gated, admin-only mutations — every mutation re-verifies `is_admin()` server-side; advance is a conditional consequence of a result (`WHERE slot IS NULL OR = winner`); rollback reverts dependent advances transitively first.
- **AD-9** Forfeit and Bye produce zero stats — no reachable stat-write path; leaderboards normalize by construction; forfeit only after grace timer, logged.
- **AD-10** Match format/tie policy locked before start — declared, stored, frozen before Live; later change is an audited override.
- **AD-11** Realtime Broadcast is nudge, not source of truth — every surface reconstructable from a published read alone; reconnect re-fetches snapshot, never replays.
- **AD-12** Identity & role bound server-side in `app_metadata` — Steam OpenID verified via `check_authentication`; SteamID64 + role written to `app_metadata` (Admin API only), never `user_metadata`; `is_admin()` fail-closed.
- **AD-13** Fairness seed is the final demo's hash, distinct from bracket seed — `fair_seed = SHA-256(final_demo_bytes)` vs `bracket_seed`; never reused for each other.
- **AD-14** Draw engine is deterministic and client-reproducible — HMAC-SHA256 counter-mode PRNG, integer-only arithmetic, rejection sampling; cross-language golden vectors gate the build.
- **AD-15** Ceremony decides from immutable frozen snapshot — winners resolved from write-once `stat_snapshot`/`stat_snapshot_row` captured under a SERIALIZABLE ceremony-lock, never live `stat_row`.
- **AD-16** Demo bodies bypass Vercel; storage is an abstraction — MatchZy→worker HTTP (shared-secret) or presigned R2 multipart; `DemoStore` interface hides backend; permanent demos delete-proofed at the storage layer.
- **AD-17** Append-only audit log — every mutating admin action writes an `audit_log` row (actor, timestamp, before/after); INSERT to service-role only, no UPDATE/DELETE policy.
- **AD-18** Seasons-aware schema, no season features — all event data scopes by `tournament_id` under a `season`; no season-spanning feature in v1.
- **AD-19** Snapshot is the verifier's complete integer-form contract — volume ints, rate `{num, den}` pairs, secondary stat, efficiency `{num, den}`, per-opponent head-to-head, `achievement_ts` integer (with absent-sentinel), eligibility inputs.
- **AD-20** Leaderboards have one owner and one normalization site — a single SQL view/RPC over `status='approved'` applies FR-21 floors and rate/volume normalization in exactly one place.
- **AD-21** Grand-final reset is two ordered `match` rows — GF then GF-reset; champion = winner of the last GF row; champion slot never overwritten in place.
- **AD-22** Reveal-gating and commit-then-publish — reveal-state is a distinct RLS axis; award identities & per-spin winners invisible until their spin (`spin.revealed_at`); `seed_hex` + `bundle_hash` published up front as commitment; bundle released progressively.
- **AD-23** One terminal match state, single-writer precedence — once Forfeit/Bye commits, a later demo is archived for evidence but produces no `stat_row` and does not flip the match; the `match` row is the single arbiter.
- **AD-24** Spanish-UI invariant — all viewer copy Spanish from one i18n module; fixed strings exact; reduced-motion ceremony uses the identical resolution path and identical published spin order.
- **AD-25** Single-environment v1; secrets server-only; demos backup — one each of Supabase/Railway/R2/Vercel; secrets only in server env; R2 raw demos are the durable DR source.
- **AD-26** Ingestion is an idempotent, bounded async job meeting SM-5 — pinned parser version, bounded retriable `ParseFailed` (capped attempts + backoff), bounded concurrency; never inline in a Vercel request.

SPEC constraints applied as global acceptance criteria where they govern a story: RLS `ENABLE`+`FORCE` (two-policy, fail-closed); single-writer worker; demo bytes never transit a Vercel function (~4.5 MB cap); deterministic integer-only client-reproducible fairness; Spanish-only viewer copy; mobile-first / dark-only / reduced-motion parity; secrets server-only.

Build-time configuration (carried as config, not new decisions): hosted Railway worker + MatchZy auto-ingest with a proven local Go CLI fallback; ADR uses the overkill-capped `HealthDamageTaken` convention; AFK/idle cadence + epsilon, MatchZy match-association, match formats/thresholds, and the `spin_plan` / `luck_weight_table` are reproducible config whose fairness-affecting values are published in the `verification_bundle`.

### UX Design Requirements

From EXPERIENCE.md + DESIGN.md (the bmad-ux spine pair, treated as one contract). Story-generating rules:

- **UX-DR1 (Home/feed = source of truth)** — Tournament Home / timeline feed is the single surfaced source of truth; bracket advances, Approved results, and award reveals post chronologically and live; other surfaces reached via a four-up nav tab row.
- **UX-DR2 (Mobile-first ~390 px)** — every viewer surface single-column, one-handed, 16 px side margins; admin console may assume a larger two-pane screen.
- **UX-DR3 (Bracket-position labels)** — nodes labeled Winners R1 / Losers R1 / Grand final, never a running match number.
- **UX-DR4 (Admin actions server-gated)** — admin-only actions never render for viewers, not even disabled.
- **UX-DR5 (Ceremony tab locked)** — dimmed + lock glyph until the admin starts it; lock glyph never gold.
- **UX-DR6/7 (Dark-only; two accents)** — dark-first/dark-only palette; exactly two accents: blue (live/trust/primary action) and gold (award reveals/winners/wheel/champion only). Gold never on wordmark, nav, bracket chrome, admin "pending," links, focus rings.
- **UX-DR8/34 (Tabular numerals)** — all stats, scores, seeds, timers, hashes, counters use tabular lining numerals so columns align and never reflow.
- **UX-DR11 (Wordmark)** — `INCLUSIVCUP`, `INCLUSIV` in ink-primary + `CUP` in accent-blue, invariant, never gold.
- **UX-DR13/14 (Spanish + fixed strings)** — all UI Spanish from one i18n module; fixed load-bearing strings verbatim: `Verificado desde el demo`, `Sembrado por el demo final · reproducible`, `Verificar la ceremonia`; state labels `Pendiente` / `Aprobado`.
- **UX-DR16/17/18 (Broadcast Slate tokens)** — live-pill (blue, pulsing; swaps to gold "Final" once the event resolves); feed-card rail node encodes type by color (neutral / blue advance / win / gold award-reveal); only the resolved champion node may carry a gold border.
- **UX-DR20/25 (Award-card / blurred-lock)** — locked award shows `Premio X de 12 — bloqueado hasta que gire` behind a 7 px blur + lock glyph; no gold leaks through the blur; revealed name in gold.
- **UX-DR24/27/48 (Verify-strip / evidence-only)** — persistent verify-strip with seed caption + `Verificar la ceremonia` (blue, not gold); evidence block is read-only (hash + re-parse + seed), no in-app raise-dispute button.
- **UX-DR28/29/30/31 (Match badges)** — grace-timer MM:SS in tabular numerals shifting to loss-red near threshold; bye-badge `Pase directo` (neutral); forfeit-badge `W.O. / Ausente` with `sin estadísticas`; anomaly-flag in loss-tint, never gold, never silent.
- **UX-DR32/23/42 (Reduced-motion ceremony — CRITICAL)** — with `prefers-reduced-motion`, the wheel does not spin and the flip does not animate; the category resolves and the winner appears directly in gold; outcome and order identical to the animated path, only motion removed.
- **UX-DR37 (Screen-reader live regions)** — new feed entries and award reveals announce via `aria-live`; grace-timer threshold crossings and live/Final pill changes announced.
- **UX-DR39 (Leaderboards)** — `Tasa` / `Volumen` segmented toggle; rate boards hide below-floor players (`aún no elegible · Mín. 24 rondas`); no horizontal scroll on the primary ranking.
- **UX-DR54/55/56 (Feed states)** — cold load shows skeleton + `Cargando el evento…`; live entries arrive within ~2 s without wiping scroll; realtime drop holds last-known truth with quiet `Reconectando…`, reconciles silently on reconnect.
- **UX-DR59 (Shared co-winner)** — a tie that bottoms out the ladder presents both names on one card with two prize-chips; screen reader announces both; a designed outcome, never an error state.

### FR Coverage Map

| FR | Epic(s) | Where |
|----|---------|-------|
| FR-1 | E2 | 2.1, 2.2 |
| FR-2 | E1, E2, E3 | 1.2 (key), 2.3, 2.6, 3.4 |
| FR-3 | E2 | 2.5 |
| FR-4 | E2 | 2.2, 2.4 |
| FR-5 | E4 | 4.1 |
| FR-6 | E4 | 4.1, 4.4 |
| FR-7 | E4 | 4.3 |
| FR-8 | E4 | 4.1, 4.5 |
| FR-9 | E4 | 4.5 |
| FR-10 | E4 | 4.2 |
| FR-11 | E3 | 3.1, 3.8 |
| FR-12 | E3 | 3.3, 3.4 |
| FR-13 | E3, E4 | 3.5 (stage Pending) · 4.6 (Aprobar publish) |
| FR-14 | E3, E4 | 3.6 (re-parse) · 4.7 (rollback) |
| FR-15 | E3, E7 | 3.2 · 7.1 |
| FR-16 | E3, E4 | 3.7 (demo-derived) · 4.8 (manual override) |
| FR-17 | E5 | 5.5 |
| FR-18 | E5 | 5.1 |
| FR-19 | E5 | 5.2 |
| FR-20 | E5 | 5.3 |
| FR-21 | E5 | 5.4, 5.5 |
| FR-22 | E5 | 5.5 |
| FR-23 | E5 | 5.7 |
| FR-24 | E6 | 6.1, 6.8 |
| FR-25 | E6 | 6.3, 6.4, 6.11 |
| FR-26 | E6 | 6.4, 6.6 |
| FR-27 | E6 | 6.2, 6.9 |
| FR-28 | E6 | 6.7 |
| FR-29 | E6 | 6.5 |
| FR-30 | E6 | 6.8, 6.9, 6.10 |
| FR-31 | E4, E5 | 4.6 (post) · 5.6, 5.8 (read) |
| FR-32 | E5 | 5.6, 5.7 |
| FR-33 | E4 | 4.9 |
| FR-34 | E5 | 5.7 |

All 34 FRs mapped. Dual-owned FR-13/14/16 split across E3 (ingest) and E4 (admin action); FR-31 split across E4 (post) and E5 (read).

## Epic List

### Epic 1: Foundation & Schema (CAP-1)
Stand up one RLS-gated Postgres substrate keyed by canonical SteamID64, with provisioned single-environment infrastructure and server-only secrets, so every later capability inherits one fail-closed data foundation.
**FRs covered:** NFR-Data, NFR-Security (substrate for FR-2 key). **ADs:** AD-4, AD-7, AD-12, AD-17, AD-18, AD-25.

### Epic 2: Identity & Roster (CAP-2)
A player signs in with Steam and the system captures their SteamID64 as canonical identity; the admin opens/closes registration and manages the roster.
**FRs covered:** FR-1, FR-2, FR-3, FR-4. **ADs:** AD-4, AD-12.

### Epic 3: Demo Ingestion Worker (CAP-3)
A finished match's demo (MatchZy auto-upload or admin manual upload) flows to the Go worker, which hashes, dedupes, parses, validates, and writes per-player stat rows as the single writer, bypassing Vercel.
**FRs covered:** FR-11, FR-12, FR-13 (ingest), FR-14 (re-parse), FR-15, FR-16 (demo-derived). **ADs:** AD-1, AD-2, AD-3, AD-5, AD-16, AD-23, AD-26.

### Epic 4: Bracket & Admin Command Routes (CAP-4)
The admin generates a random-seeded double-elimination bracket and drives matches through server-gated, idempotent, audited command routes, with "Aprobar" atomically publishing a match.
**FRs covered:** FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-13 (publish), FR-14 (rollback), FR-16 (manual), FR-31 (post), FR-33. **ADs:** AD-5, AD-6, AD-8, AD-9, AD-10, AD-13 (bracket), AD-17, AD-21, AD-23.

### Epic 5: Stats, Leaderboards & Realtime Viewer Surfaces (CAP-5)
The worker derives core, weird, and derived stats; a single normalized leaderboard view feeds mobile-first Spanish read-only surfaces — timeline feed, bracket, leaderboards, player detail — updated live within ~2 s.
**FRs covered:** FR-17, FR-18, FR-19, FR-20, FR-21, FR-22, FR-23, FR-31 (read), FR-32, FR-34. **ADs:** AD-2, AD-7, AD-9, AD-11, AD-20, AD-24.

### Epic 6: Awards Roulette — Producer & Verifier (CAP-6)
At the ceremony, the system runs a two-stage, provably-fair Awards Roulette from a frozen stat snapshot seeded by the final demo's hash; any viewer reproduces the outcome client-side.
**FRs covered:** FR-24, FR-25, FR-26, FR-27, FR-28, FR-29, FR-30. **ADs:** AD-13 (fair), AD-14, AD-15, AD-19, AD-22, AD-24.

### Epic 7: Hardening & Operations (CAP-7)
The operator runs the one-off event on a single environment with cost guards, demo durability, and a tested recovery path; the build-handoff checklist is verified before launch.
**FRs covered:** NFR-Reliability, NFR-Perf, NFR-Security (+ FR-15 durability). **ADs:** AD-11, AD-25, AD-26.

---

## Epic 1: Foundation & Schema

Stand up the RLS-gated Postgres substrate and single-environment infrastructure that every later capability inherits. This epic owns the `supabase/migrations` substrate slice (identity/scope tables + the RLS framework + helper functions + the append-only convention); each later epic adds its own tables in its own migration. The success bar: migrations apply cleanly to an empty database, every table has `ENABLE` + `FORCE ROW LEVEL SECURITY` with an explicit viewer policy or no viewer SELECT at all, SteamID64 is `text` with a 17-digit `CHECK`, and no secret is exposed through a `NEXT_PUBLIC_*` variable.

### Story 1.1: Provision the single environment and server-only secrets

As an operator,
I want one provisioned environment with every secret held server-side only,
So that the whole event runs on a single low-cost footprint and no credential can leak to a client bundle.

**Acceptance Criteria:**

**Given** the v1 single-environment constraint (AD-25),
**When** infrastructure is provisioned,
**Then** exactly one Supabase project, one Vercel project, one Railway worker, and one Cloudflare R2 bucket exist and are wired together.

**Given** the secrets-server-only constraint (AD-25),
**When** the Supabase service-role key, the R2 write credentials, and the worker↔MatchZy shared secret are configured,
**Then** they live only in Vercel/Railway server environment variables,
**And** no secret is referenced through any `NEXT_PUBLIC_*` variable and none appears in a client bundle.

**Given** the metered services (R2, Supabase, Railway),
**When** the environment is stood up,
**Then** connection/config for each is captured so cost guards (Epic 7) can attach billing alerts later.

_Traces: AD-25 · NFR-Security · SPEC Constraint 12 (single environment, secrets server-only)_

### Story 1.2: Identity and scope schema (migration 0001)

As a platform,
I want the canonical identity and scope tables created with the SteamID64 domain constraint,
So that every later capability joins on one stable key under one seasons-aware scope.

**Acceptance Criteria:**

**Given** the canonical-key constraint (AD-4),
**When** migration 0001 creates `player`,
**Then** the SteamID64 column is Postgres `text` with `CHECK (~ '^[0-9]{17}$')` as the canonical identity,
**And** `display_name` is a mutable, cosmetic column that is never used as a join key.

**Given** the seasons-aware-but-no-season-features constraint (AD-18),
**When** migration 0001 creates `season` and `tournament`,
**Then** all event data scopes by `tournament_id` under a `season`,
**And** no season-spanning feature, query, or UX is introduced.

**Given** the role model,
**When** `app_role` is created,
**Then** it carries `role ∈ {admin, viewer}` keyed `UNIQUE` on SteamID64, with no client write policy.

**Given** an empty database,
**When** migration 0001 is applied,
**Then** it applies cleanly with all CHECK/closed-set constraints in place.

_Traces: FR-2 (canonical key) · AD-4, AD-18 · NFR-Data_

### Story 1.3: Fail-closed RLS framework and helper functions (migration 0002)

As a platform,
I want row-level security enabled and forced on every table with fail-closed admin/viewer helpers,
So that viewers can only ever read approved data and a malformed policy fails closed rather than open.

**Acceptance Criteria:**

**Given** the RLS constraint (AD-7),
**When** migration 0002 runs,
**Then** every table has both `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`.

**Given** the two-policy rule (AD-7),
**When** policies are defined for any table exposing staged data,
**Then** the viewer policy is `USING (status = 'approved')` and the admin-visibility policy is a separate `USING (is_admin())` policy,
**And** the two are never combined into one OR'd policy, so a malformed admin policy cannot widen viewer access.

**Given** the server-side identity binding (AD-12),
**When** `is_admin()` and `jwt_steamid64()` are created,
**Then** they read only from `auth.jwt() -> 'app_metadata'`,
**And** `is_admin()` is `COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)` (fail-closed on missing role).

**Given** the single-writer model (AD-2, applied here as substrate),
**When** policies are defined,
**Then** no `anon`/`authenticated` role holds any insert/update/delete policy on event tables, and the service-role key bypasses RLS.

_Traces: AD-7, AD-12, AD-17 · NFR-Security_

### Story 1.4: Append-only audit and snapshot convention

As an operator,
I want the audit and snapshot tables to be append-only by construction,
So that the admin action trail and ceremony snapshots cannot be rewritten after the fact.

**Acceptance Criteria:**

**Given** the append-only-by-absence rule (AD-17),
**When** the `audit_log` table and the snapshot tables (`stat_snapshot`, `stat_snapshot_row`) are created as substrate,
**Then** each grants INSERT to the service-role only and defines no UPDATE and no DELETE policy.

**Given** RLS is `FORCE` on these tables,
**When** any non-service role attempts to read or mutate them,
**Then** access is denied unless an explicit read policy permits it (snapshot tables are admin-only until reveal; see Epic 6).

**Given** the full substrate migration set (0001 + 0002 + this convention),
**When** applied to an empty database,
**Then** all migrations apply cleanly and the database satisfies the CAP-1 success criterion.

_Traces: AD-17 · NFR-Security, NFR-Data_

---

## Epic 2: Identity & Roster

A player signs in with Steam; the system captures their SteamID64 as canonical identity and binds role into `app_metadata` server-side; the admin opens/closes registration and manages the roster, including an unreconciled list so no parsed identity is ever silently dropped. Adds the `roster_entry` migration slice.

### Story 2.1: Steam OpenID 2.0 server-side login

As a player,
I want to sign in with my Steam account,
So that the system knows who I am by my real Steam identity.

**Acceptance Criteria:**

**Given** the server-side verification rule (AD-12),
**When** a player completes the Steam OpenID 2.0 flow and returns to `/auth/steam/callback`,
**Then** the server performs a `check_authentication` round-trip to Steam and never trusts the redirect parameters,
**And** only the verified `claimed_id` is converted to a SteamID64.

**Given** a successful verification (FR-1),
**When** identity is resolved,
**Then** the service role upserts a `player` row keyed by SteamID64 with `display_name` synced cosmetically from Steam.

**Given** verification fails or is tampered,
**When** the callback is processed,
**Then** no session is minted and no `player`/role write occurs.

_Traces: FR-1 · AD-12 · NFR-Security_

### Story 2.2: Bind identity and role into app_metadata

As a platform,
I want SteamID64 and role written only into `app_metadata` via the Admin API,
So that RLS can trust identity and role from the JWT and a client cannot self-escalate.

**Acceptance Criteria:**

**Given** the binding rule (AD-12),
**When** a verified player's identity and role are persisted,
**Then** `{ steamid64, role }` is written to Supabase `app_metadata` through the Admin API (service-role) only,
**And** nothing identity- or role-bearing is written to client-mutable `user_metadata`.

**Given** role bootstrap,
**When** a player's SteamID64 is on the env-listed admin allowlist,
**Then** their role resolves to `admin`; otherwise it defaults to `viewer` (FR-4).

**Given** the binding completes,
**When** a Supabase session is minted,
**Then** the JWT carries role and SteamID64 in `app_metadata` and `is_admin()`/`jwt_steamid64()` resolve correctly.

_Traces: FR-1, FR-4 · AD-12_

### Story 2.3: Canonical SteamID64 capture and display-name tolerance

As a player,
I want my stats to follow my SteamID64 even if I change my Steam name,
So that renaming on Steam never detaches me from my results.

**Acceptance Criteria:**

**Given** the canonical-key rule (AD-4, FR-2),
**When** any stat or roster record links to a player,
**Then** it joins by SteamID64 and never by `display_name`.

**Given** a player changes their Steam display name,
**When** they next sign in,
**Then** `display_name` updates cosmetically and the link to their existing stats and roster entry is preserved unchanged.

_Traces: FR-2 · AD-4 · NFR-Data_

### Story 2.4: Roles, admin gating, and revoke-invalidates-session

As an operator,
I want admin and viewer roles enforced and a revoked admin's session invalidated immediately,
So that only admins can mutate the event and a stale JWT cannot retain admin after revoke.

**Acceptance Criteria:**

**Given** the role model (FR-4),
**When** any event-mutating action is attempted,
**Then** it is permitted only for an admin and is server-enforced (not merely hidden in the UI).

**Given** an admin role is revoked (AD-12),
**When** the revoke is applied,
**Then** `app_role` is updated and the player's session is invalidated/forced to refresh,
**And** a previously issued JWT can no longer pass `is_admin()` after the refresh.

_Traces: FR-4 · AD-12 · NFR-Security_

### Story 2.5: Registration window and roster management

As an admin,
I want to open and close registration and manage the roster,
So that I control who is enrolled before the bracket is generated.

**Acceptance Criteria:**

**Given** the registration window (FR-3),
**When** the admin opens or closes registration,
**Then** `tournament.state` reflects `registration_open` / `registration_closed` and players can enroll only while open.

**Given** the `roster_entry` migration slice (this story),
**When** a player enrolls,
**Then** a `roster_entry` is created `UNIQUE(tournament_id, steamid64)` under RLS `FORCE`.

**Given** roster management (FR-3),
**When** the admin removes a player before bracket generation,
**Then** the removal succeeds and is reflected to all surfaces; after bracket generation, roster membership is locked.

_Traces: FR-3 · AD-18_

### Story 2.6: Unreconciled-SteamID64 list (roster side)

As an admin,
I want any parsed SteamID64 that is not on the roster surfaced for me to reconcile,
So that a real participant's stats are never silently dropped.

**Acceptance Criteria:**

**Given** the never-silently-dropped rule (AD-4, FR-2, UX-DR57),
**When** ingestion reports a parsed SteamID64 absent from the roster,
**Then** it appears in an admin "unreconciled" list rather than being discarded.

**Given** an entry in the unreconciled list,
**When** the admin links it to the correct roster identity (one-tap),
**Then** the association is recorded by SteamID64 and the previously-unreconciled stats attach to that player.

_Traces: FR-2 · AD-4 · UX-DR57_

---

## Epic 3: Demo Ingestion Worker

A finished match's demo flows to the Go worker, which hashes, dedupes, parses, validates, and writes per-player stat rows as the single writer. Demo bytes never transit Vercel. Adds the `demo` and `stat_row` migration slice. This epic owns the ingest half of the dual-owned FR-13/14/16 (stage to Pending, re-parse, demo-derived score); the admin-action half lives in Epic 4.

### Story 3.1: Demo acquisition that bypasses Vercel

As a platform,
I want demo bytes to reach the worker/R2 without passing through a Vercel function,
So that large demos are never blocked by the ~4.5 MB request cap and arrive reliably.

**Acceptance Criteria:**

**Given** the bypass-Vercel constraint (AD-16, FR-11),
**When** MatchZy auto-uploads a finished match's demo,
**Then** the bytes go to the worker over shared-secret-authed HTTP (or presigned R2 multipart) and never through a Next.js route.

**Given** the manual fallback (FR-11),
**When** an admin uploads a demo from the web,
**Then** the browser uploads via R2 presigned multipart and only a small `register {match_id, r2_key}` notify call touches the app.

**Given** the CLI fallback (assumption: hosted worker + MatchZy, local CLI fallback),
**When** the operator runs the local Go CLI on a `.dem`,
**Then** it uploads to R2 and registers the demo via the service role.

**Given** the storage abstraction (AD-16),
**When** a demo is stored,
**Then** the `DemoStore` interface (R2 primary) hides the backend and the database records only opaque `(storage_backend, storage_key)` plus the content hash.

_Traces: FR-11 · AD-16, AD-25 · SPEC Constraint 6 (demo bypasses Vercel)_

### Story 3.2: Hash, dedup, and write-once retention

As a platform,
I want every demo hashed, deduplicated, and retained write-once,
So that the raw demo is an immutable source of truth and re-uploads short-circuit to the prior result.

**Acceptance Criteria:**

**Given** the immutable-source rule (AD-1, FR-15),
**When** a demo is acquired,
**Then** the worker computes its SHA-256, stores the raw `.dem` write-once, and records the hash with `retention_class`,
**And** the stored raw demo re-hashes byte-for-byte to its stored SHA-256.

**Given** the idempotency key (AD-3),
**When** a demo is registered,
**Then** `demo` enforces `UNIQUE(match_id, sha256)`.

**Given** a re-uploaded identical demo (`AlreadyIngested`),
**When** `(match_id, sha256)` already exists,
**Then** ingestion short-circuits to the prior result and writes no duplicate rows.

_Traces: FR-15 · AD-1, AD-3_

### Story 3.3: Parse the demo to stat rows as the single writer

As a platform,
I want the worker to parse a demo into normalized per-player stat rows as the only writer,
So that there is exactly one trustworthy path from demo to stats with no client write surface.

**Acceptance Criteria:**

**Given** the single-writer rule (AD-2),
**When** stat rows are written,
**Then** they are written only by the Go worker via the service role; no `anon`/`authenticated` role and no app code path can write `demo` or `stat_row`.

**Given** the parse step (FR-12),
**When** a demo is parsed,
**Then** the pinned `demoinfocs-golang v5.2.0` produces normalized per-player rows keyed by `match_id` + SteamID64; the `stat_row` migration slice is created here.

**Given** the idempotency key (AD-3, AD-26),
**When** stat rows are upserted,
**Then** `stat_row` enforces `UNIQUE(match_id, steamid64)` so a re-parse replaces rather than duplicates.

_Traces: FR-12 · AD-2, AD-3, AD-26 · SPEC Constraint 4 (single writer)_

### Story 3.4: Validation and anomaly gate

As an admin,
I want parsed matches that fail conservation or reconciliation checks held for review,
So that suspect stats never auto-publish and unreconciled identities are surfaced.

**Acceptance Criteria:**

**Given** the validation gates (AD-2),
**When** a parse completes,
**Then** the worker checks Σkills == Σdeaths, non-zero stat rows, and that every SteamID64 is on the roster.

**Given** any gate fails,
**When** validation runs,
**Then** the match enters `Anomalous` (held for admin review, logged) and is not published; an admin must explicitly accept the anomaly (logged) to advance it to `Pending`.

**Given** an unreconciled SteamID64 (AD-4, FR-2),
**When** validation detects an ID absent from the roster,
**Then** it is flagged to the admin unreconciled list (Story 2.6), never silently dropped.

_Traces: FR-12 · AD-2, AD-4_

### Story 3.5: Stage stats to Pending (ingest side of FR-13)

As an admin,
I want parsed stats to land in a Pending state visible only to me,
So that nothing reaches viewers until I approve it.

**Acceptance Criteria:**

**Given** the staged-publish rule (FR-13, AD-7),
**When** a parsed, validated match completes,
**Then** its stat rows are written with `status='pending'` and the match enters the `Pending` state labeled `Pendiente`.

**Given** RLS `FORCE` with the two-policy model (AD-7),
**When** a viewer queries,
**Then** Pending rows are invisible to them; only the admin-visibility policy (`is_admin()`) exposes them.

**Given** the dual-ownership split,
**When** this story stages to Pending,
**Then** the act of publishing (Aprobar) is explicitly out of scope here and is owned by Story 4.6.

_Traces: FR-13 (ingest) · AD-7_

### Story 3.6: Re-parse a retained demo (ingest side of FR-14)

As an admin,
I want to re-parse a retained demo and have published truth jump straight to the corrected result,
So that a fixed parser or corrected derivation updates stats with no flicker back to Pending.

**Acceptance Criteria:**

**Given** the re-parse rule (FR-14, AD-3),
**When** an admin re-parses an Approved match,
**Then** the worker runs revert → reparse → republish as one DB transaction so there is no observable Pending window,
**And** `stat_row UNIQUE(match_id, steamid64)` ensures rows are replaced, not duplicated.

**Given** the immutable-demo rule (AD-1),
**When** a re-parse runs,
**Then** it touches only derived rows; the raw demo and its stored SHA-256 are never altered.

**Given** the dual-ownership split,
**When** this story re-parses,
**Then** admin-initiated rollback of an Approved match (without re-parse) is owned by Story 4.7.

_Traces: FR-14 (re-parse) · AD-1, AD-3_

### Story 3.7: Demo-derived score from ingest (ingest side of FR-16)

As a platform,
I want the match score derived from the demo whenever a demo exists,
So that scores are never hand-typed and a late demo cannot overturn a committed forfeit.

**Acceptance Criteria:**

**Given** the score-source rule (AD-5, FR-16),
**When** a demo is parsed for a match,
**Then** the worker computes the demo-derived score and the match's `score_source` is `demo_derived`.

**Given** single-writer precedence (AD-23),
**When** a demo arrives for a match already committed `Forfeit` or `Bye`,
**Then** the demo is archived for evidence but produces no `stat_row` and does not flip the match.

**Given** the dual-ownership split,
**When** this story derives the score,
**Then** admin manual override of a score is owned by Story 4.8.

_Traces: FR-16 (demo-derived) · AD-5, AD-23_

### Story 3.8: Bounded async ingest job meeting the latency budget

As an operator,
I want ingestion to run as a bounded, retriable async job,
So that demos parse within the SM-5 budget and parse failures surface to me instead of silently stalling.

**Acceptance Criteria:**

**Given** the async-job rule (AD-26),
**When** an upload triggers ingestion,
**Then** parsing runs off-request (never inline in a Vercel function) with bounded concurrency and a pinned parser version.

**Given** a parse failure (`ParseFailed`),
**When** the job fails,
**Then** it retries with capped attempts and backoff against the pinned version, and on exhaustion raises an admin alert — never failing silently.

**Given** the latency target (SM-5, NFR-Perf),
**When** ingestion runs end-to-end,
**Then** demo-landed → stats-visible holds P50 < 5 min and P95 < 15 min.

_Traces: FR-11 · AD-26 · NFR-Perf, NFR-Reliability_

---

## Epic 4: Bracket & Admin Command Routes

The admin generates a random-seeded double-elimination bracket and drives matches through server-gated, idempotent, audited command routes. "Aprobar" atomically publishes a match in one transaction. Adds the `match` and `audit_log` migration slice. This epic owns the admin-action half of the dual-owned FR-13/14/16 (Aprobar publish, rollback, manual override) and the feed *post* half of FR-31.

### Story 4.1: Random-seeded double-elimination bracket generation

As an admin,
I want to generate a seeded double-elimination bracket from the closed roster,
So that the field is drawn fairly and reproducibly with byes for odd counts.

**Acceptance Criteria:**

**Given** the seeded-generation rule (FR-5, AD-13 bracket),
**When** the admin generates the bracket from a closed roster of 8–16 players,
**Then** a random `bracket_seed` is recorded and stored separately from the fairness `fair_seed`, never reused for it.

**Given** the double-elimination structure (FR-6),
**When** the bracket is generated,
**Then** it maintains Winners, Losers, and Grand-final routing so each loser drops to Losers until a second loss eliminates them.

**Given** a non-power-of-two field (FR-8, AD-9),
**When** byes are required,
**Then** byes are assigned deterministically by seed and a bye advances a player with a badge and creates no stats.

_Traces: FR-5, FR-6, FR-8 · AD-13 (bracket), AD-9_

### Story 4.2: Pre-declared match format and tie policy

As an admin,
I want each match's format and tie policy locked before it goes live,
So that rules cannot be changed mid-match and any change is on the record.

**Acceptance Criteria:**

**Given** the lock-before-live rule (FR-10, AD-10),
**When** a match is declared,
**Then** its `format` and `tie_policy` are stored and frozen before the match transitions to `Live`.

**Given** a frozen match,
**When** an admin changes the format or tie policy afterward,
**Then** the change is permitted only as an explicit audited override (writes an `audit_log` row), never a silent edit.

_Traces: FR-10 · AD-10_

### Story 4.3: Idempotent conditional advance

As an admin,
I want advancing a winner to be a conditional, idempotent consequence of a result,
So that double-taps or races cannot mis-route the bracket.

**Acceptance Criteria:**

**Given** the conditional-advance rule (AD-8, FR-7),
**When** a match result advances a winner,
**Then** the advance writes under `WHERE slot IS NULL OR = winner` so re-applying it is a no-op (no double-route).

**Given** the consequence-not-control rule (AD-8),
**When** an advance occurs,
**Then** it is a consequence of a result transition (Aprobar/Forfeit/Bye) and never an independent control that races publish.

**Given** the realtime requirement (FR-7),
**When** an advance commits,
**Then** the change propagates to viewers in real time (emitted only after commit).

_Traces: FR-7 · AD-8_

### Story 4.4: Grand-final reset as two ordered match rows

As an admin,
I want the grand final modeled as up to two ordered match rows,
So that a losers-bracket player can force a reset without the champion slot ever being overwritten in place.

**Acceptance Criteria:**

**Given** the GF-reset rule (AD-21, FR-6),
**When** the grand final is created,
**Then** it is up to two ordered `match` rows (`gf_order` 1 then 2).

**Given** the losers-bracket player wins the first GF row,
**When** the reset row is played,
**Then** the champion is whoever resolves the last GF row and the champion slot is never overwritten in place.

**Given** the conditional-advance rule (AD-8),
**When** each GF row resolves,
**Then** AD-8 conditional advance applies per row.

_Traces: FR-6 · AD-21_

### Story 4.5: Bye and forfeit walkover with grace timer

As an admin,
I want byes and forfeits to advance a player with zero stats and only after a grace timer,
So that no-shows are handled cleanly without phantom stat wins.

**Acceptance Criteria:**

**Given** the zero-stats rule (AD-9, FR-8, FR-17),
**When** a match resolves as `Bye` or `Forfeit`,
**Then** there is no reachable stat-write path; the present player advances with a structural badge and no stat rows are created.

**Given** the grace-timer rule (FR-9, AD-9),
**When** one player is absent,
**Then** the match sits in `AwaitingGrace` and the admin can mark `Forfeit` only after the grace timer (default 10 min, configurable) elapses,
**And** the forfeit is logged with actor + timestamp.

**Given** single-writer precedence (AD-23),
**When** a demo later arrives for a committed forfeit/bye,
**Then** it is archived for evidence but never flips the match.

_Traces: FR-8, FR-9 · AD-9, AD-23_

### Story 4.6: "Aprobar" atomic publish (publish side of FR-13)

As an admin,
I want a single "Aprobar" action to publish stats, set the score, advance the bracket, post the feed entry, and recompute leaderboards atomically,
So that one tap produces consistent published truth with no half-applied state.

**Acceptance Criteria:**

**Given** the atomic-transaction rule (AD-6, FR-13),
**When** the admin taps `Aprobar` on a `Pending` match,
**Then** in one DB transaction: stat rows flip to `status='approved'` (`Aprobado`), the match `score_source='demo_derived'` and state becomes `Resolved`, the bracket advances (idempotent), a timeline feed entry is posted, and affected leaderboards are recomputed.

**Given** the post-commit-emit rule (AD-6, AD-11),
**When** the transaction commits,
**Then** the realtime event is emitted only after commit (never mid-transaction).

**Given** the feed-post ownership split (FR-31),
**When** Aprobar runs,
**Then** posting the feed entry is part of this transaction; the feed *read* surface is owned by Epic 5 (Story 5.6).

_Traces: FR-13 (publish), FR-31 (post) · AD-6, AD-5_

### Story 4.7: Rollback an Approved match (rollback side of FR-14)

As an admin,
I want to roll back an Approved match and have dependent advances reverted first,
So that unpublishing a result never leaves the bracket in an inconsistent state.

**Acceptance Criteria:**

**Given** the transitive-rollback rule (AD-8, FR-14),
**When** an admin rolls back an Approved match,
**Then** dependent advances are reverted transitively *before* the match's stats are unpublished.

**Given** idempotency (AD-8),
**When** a rollback is applied,
**Then** it is server-gated, re-verifies `is_admin()`, and is idempotent.

**Given** the dual-ownership split,
**When** this story rolls back,
**Then** re-parsing a retained demo is owned by Story 3.6.

_Traces: FR-14 (rollback) · AD-8_

### Story 4.8: Manual score override (manual side of FR-16)

As an admin,
I want to enter a manual score only where no demo exists or with an audited override,
So that demo-less matches can resolve without ever quietly overriding demo truth.

**Acceptance Criteria:**

**Given** the one-score-source rule (AD-5, FR-16),
**When** an admin enters a manual score,
**Then** `score_source='admin_manual'` is permitted only when `demo_id IS NULL`, or when `manual_override=true` with a matching `audit_log` row, and the match becomes `ManualResolved`.

**Given** single-writer precedence (AD-23),
**When** a manual score is entered,
**Then** the `match` row remains the single arbiter and a `Resolved` (demo) result and a `Forfeit` cannot coexist.

_Traces: FR-16 (manual) · AD-5, AD-23_

### Story 4.9: Server-gated, audited command routes

As an operator,
I want every admin mutation to re-verify admin server-side and write an append-only audit row,
So that there is a complete, tamper-evident trail and no action can bypass authorization.

**Acceptance Criteria:**

**Given** the server-gated rule (AD-8, FR-33),
**When** any admin command route runs (generate bracket, advance, mark walkover, approve, re-parse, rollback, declare format, start ceremony, grant role),
**Then** it re-verifies `is_admin()` server-side and writes via the service role; viewers cannot invoke it.

**Given** the audit rule (AD-17),
**When** any mutating admin action commits,
**Then** it writes an `audit_log` row with actor SteamID64, timestamp, and before/after detail; the `audit_log` migration slice is created here with no UPDATE/DELETE policy.

_Traces: FR-33 · AD-8, AD-17_

---

## Epic 5: Stats, Leaderboards & Realtime Viewer Surfaces

The worker derives core, weird, and derived stats; a single normalized leaderboard view applies the anti-farm floors and rate/volume classing in exactly one place; mobile-first Spanish read-only surfaces present the feed, bracket, leaderboards, and player detail, updated live within ~2 s. This epic owns the feed *read* half of FR-31; the feed *post* is Story 4.6.

### Story 5.1: Core stat derivation

As a viewer,
I want each player's core CS2 stats computed from the demo,
So that the scoreboard reflects real in-game performance with no hand entry.

**Acceptance Criteria:**

**Given** the core-stats requirement (FR-18, AD-2),
**When** the worker derives a match,
**Then** it computes per player: kills, deaths, assists, ADR, HS%, MVPs, flash assists, utility damage, and KAST (5 s trade window).

**Given** the ADR convention (build-time config: overkill-capped `HealthDamageTaken`),
**When** ADR is computed,
**Then** per-round damage is overkill-capped before aggregation to match the in-game scoreboard.

**Given** the single-writer rule (AD-2),
**When** these stats are written,
**Then** they are written only by the worker via the service role into `stat_row`.

_Traces: FR-18 · AD-2_

### Story 5.2: Weird demo-only stat derivation

As a viewer,
I want the niche, demo-only stats computed,
So that the comedy/weird award tracks have real data behind them.

**Acceptance Criteria:**

**Given** the weird-stats requirement (FR-19, AD-2),
**When** the worker derives a match,
**Then** it computes knife kills, wallbang kills, through-smoke kills, no-scope kills, blind kills, and molotov/HE damage per player.

**Given** the single-writer rule (AD-2),
**When** these stats are written,
**Then** they are written only by the worker into `stat_row`.

_Traces: FR-19 · AD-2_

### Story 5.3: Derived stat derivation

As a viewer,
I want entry frags and 1vX clutches derived from the event stream,
So that opening-duel and clutch award tracks are accurate.

**Acceptance Criteria:**

**Given** the derived-stats requirement (FR-20, AD-2),
**When** the worker derives a match,
**Then** it computes entry frags / opening duels and 1vX clutches from the demo event stream and stores them on `stat_row`.

_Traces: FR-20 · AD-2_

### Story 5.4: Anti-farm floors and AFK/idle DQ

As an operator,
I want minimum-participation floors and AFK/idle disqualification applied,
So that no award is won by idle farming or below-floor participation.

**Acceptance Criteria:**

**Given** the anti-farm rule (FR-21, SM-C1),
**When** a player's match stats are evaluated for award eligibility,
**Then** floors of ≥24 rounds played and ≥20 kills (for rate/HS% awards) apply.

**Given** the AFK/idle rule (FR-21; cadence/epsilon as published config),
**When** a player shows no movement beyond the position epsilon and no shots/utility/damage across a round,
**Then** that round counts as idle, and a player idle in ≥50% of rounds is `idle_dq` for that match.

**Given** the published-config rule (build-time config),
**When** the AFK cadence/epsilon are set,
**Then** their values are reproducible config and published in the `verification_bundle`.

_Traces: FR-21 · SM-C1_

### Story 5.5: Single normalized leaderboard view/RPC

As a viewer,
I want one normalized leaderboard computed in exactly one place,
So that rankings are consistent, floor-gated, and reflect only matches actually played.

**Acceptance Criteria:**

**Given** the one-owner rule (AD-20, FR-17, FR-21, FR-22),
**When** standings are computed,
**Then** a single SQL view/RPC over `status='approved'` rows applies the FR-21 floors and rate-vs-volume classing in exactly one place; no component hand-rolls a second aggregate; the leaderboard migration slice is created here.

**Given** the stat-hygiene rule (FR-17, AD-9),
**When** the leaderboard normalizes,
**Then** forfeits and byes contribute zero rows, so rates normalize over matches actually played.

**Given** the rate/volume rule (FR-22),
**When** the leaderboard is presented,
**Then** rate-class stats are normalized per opportunity and volume-class stats are totals, each board stating its class.

_Traces: FR-17, FR-21, FR-22 · AD-20, AD-9_

### Story 5.6: Timeline feed read (read side of FR-31)

As a viewer,
I want a chronological feed of approved-only events as the single source of truth,
So that I follow the whole event from one place without seeing anything unpublished.

**Acceptance Criteria:**

**Given** the feed-as-truth rule (FR-31, AD-7),
**When** the feed is read,
**Then** it shows bracket advances, Approved match results, and award reveals in chronological order, and `Pending` events are excluded.

**Given** the navigation requirement (FR-32, UX-DR1),
**When** a viewer taps a feed card,
**Then** it routes to its subject (bracket match, leaderboard, or player detail) and the four-up nav reaches feed, bracket, leaderboards, and (when started) ceremony.

**Given** the dual-ownership split,
**When** this story renders the read feed,
**Then** posting an entry is owned by Story 4.6's Aprobar transaction.

_Traces: FR-31 (read), FR-32 · AD-7_

### Story 5.7: Spanish mobile-first read-only viewer surfaces

As a viewer,
I want read-only Spanish, mobile-first surfaces reconstructable from published state,
So that I can follow the bracket, leaderboards, and player detail on my phone with no ability to mutate anything.

**Acceptance Criteria:**

**Given** the read-only rule (FR-34, AD-7),
**When** a viewer uses any surface,
**Then** they have full read access to bracket, leaderboards, feed, and ceremony and no mutating capability; admin actions never render for them (UX-DR4).

**Given** the reconstructable rule (AD-11),
**When** any viewer surface renders,
**Then** it is fully reconstructable from a published-state read alone.

**Given** the Spanish/mobile constraints (AD-24, UX-DR2/6/8/13/14),
**When** surfaces render,
**Then** all copy is Spanish from one i18n module, dark-only, mobile-first with no horizontal scroll on the primary ranking, tabular numerals throughout, and provenance reads `Verificado desde el demo`.

_Traces: FR-23, FR-32, FR-34 · AD-11, AD-24_

### Story 5.8: Realtime nudge and reconnect reconcile

As a viewer,
I want live updates within ~2 s and a clean reconnect,
So that the event feels live but never shows invented or stale state.

**Acceptance Criteria:**

**Given** the nudge rule (AD-11, FR-31),
**When** a semantic change commits,
**Then** a post-commit Broadcast nudges connected clients to re-render within ~2 s.

**Given** the reconnect rule (AD-11),
**When** a client's realtime channel drops and reconnects,
**Then** it re-fetches the published snapshot and never replays missed events,
**And** while disconnected it holds last-known truth with a quiet `Reconectando…` (UX-DR56) and never wipes the feed.

_Traces: FR-31 · AD-11 · NFR-Perf_

---

## Epic 6: Awards Roulette — Producer & Verifier

At the ceremony, the system runs a two-stage, provably-fair Awards Roulette from a frozen stat snapshot seeded by the final demo's hash; any viewer reproduces the outcome client-side. Adds the ceremony schema slice (`ceremony`, `spin`, `award`, `award_result`, `award_result_winner`, `stat_snapshot`, `stat_snapshot_row`, `verification_bundle`) and owns the `roulette/vectors` cross-cutting seam. The Go producer (`worker/awards`) and JS verifier (`lib/roulette`) must agree byte-for-byte.

### Story 6.1: Award catalog and buckets

As an admin,
I want to curate the award catalog before the ceremony,
So that each award has a bucket, class, deciding stat, and floor, and stays hidden until its spin.

**Acceptance Criteria:**

**Given** the catalog rule (FR-24),
**When** the admin curates awards before the ceremony,
**Then** each `award` has a bucket (Habilidad / Clutch / Rarezas del demo / Comedia), a class (Tasa / Volumen), a deciding stat, and an eligibility floor.

**Given** the blurred-until-spin rule (AD-22, FR-24, UX-DR20/25),
**When** a non-admin views the catalog,
**Then** each unrevealed award shows `Premio X de 12 — bloqueado hasta que gire` behind a blur with no gold leaking through, invisible until its spin.

_Traces: FR-24 · AD-22_

### Story 6.2: fair_seed freeze and immutable snapshot capture

As a platform,
I want the fairness seed frozen and the deciding stats captured into an immutable snapshot at ceremony-lock,
So that the draw reads a fixed, integer-form contract that cannot change after the championship is decided.

**Acceptance Criteria:**

**Given** the seed rule (AD-13 fair, FR-27),
**When** the championship-deciding demo is Approved,
**Then** `fair_seed = SHA-256(final_demo_bytes)` is frozen, published as `seed_hex`, distinct from `bracket_seed`, and never re-rolled.

**Given** the snapshot rule (AD-15),
**When** the ceremony locks,
**Then** `stat_snapshot` / `stat_snapshot_row` are captured write-once under a SERIALIZABLE ceremony-lock that blocks further approves/re-parses for that tournament during capture; the draw reads only the snapshot, never live `stat_row`.

**Given** the integer-form contract (AD-19),
**When** the snapshot is written,
**Then** it holds volume stats as integers, rate stats as `{num, den}` integer pairs, the secondary stat, efficiency `{num, den}`, per-opponent head-to-head deciding values, `achievement_ts` as an integer (with a published absent-sentinel), and eligibility inputs (`rounds_played`, `kills`, `idle_dq`).

_Traces: FR-27 · AD-13 (fair), AD-15, AD-19_

### Story 6.3: PRNG core (HMAC-SHA256 counter-mode)

As a platform,
I want a deterministic integer-only PRNG keyed by the seed,
So that the Go producer and the JS verifier consume identical bytes for every decision.

**Acceptance Criteria:**

**Given** the PRNG rule (AD-14, FR-25),
**When** a decision draws randomness,
**Then** `block_i(label) = HMAC_SHA256(key = seed (raw 32 bytes), msg = utf8(label) || LE64(i))` with per-decision domain-separation labels (e.g. `inclusivcup/v1/stage1/spin/<S>`, `inclusivcup/v1/pity`).

**Given** the unbiased-draw rule (AD-14),
**When** `uniform_int(stream, n)` is drawn,
**Then** it assembles minimal big-endian bytes and rejection-samples with `limit = 256^k − 256^k mod n` so both runtimes reject on identical thresholds and consume identical bytes.

**Given** the integer-only constraint,
**When** any decision arithmetic runs,
**Then** it uses integers only — no floats, no locale-dependent operations.

_Traces: FR-25 · AD-14 · SPEC Constraint 7 (integer-only, client-reproducible)_

### Story 6.4: Two-stage draw

As a viewer,
I want each spin to pick live categories by seeded luck and then resolve each winner deterministically,
So that the ceremony is dramatic yet fully reproducible.

**Acceptance Criteria:**

**Given** the Stage-1 luck rule (FR-25, FR-26, AD-14),
**When** a spin selects live categories,
**Then** per-spin candidate awards (minus already-revealed) draw integer weights from `luck_weight_table[min(shelf[provisional_winner], table_max)]` (empty shelf ⇒ heaviest weight), and `live_count` awards are picked via stream-driven weighted selection in ascending `priority` order.

**Given** the Stage-2 deterministic rule (FR-25, AD-14),
**When** a live category resolves,
**Then** eligible players (FR-21 floors) are iterated in byte-lex sorted SteamID64 order, the best deciding value wins, rate stats compare by cross-multiplication (`p.num*q.den vs q.num*p.den`), and an equal value/cross-product is a tie that enters the FR-29 ladder — never a silent argmax.

_Traces: FR-25, FR-26 · AD-14_

### Story 6.5: FR-29 tie ladder

As a viewer,
I want ties resolved by a fixed, published ladder,
So that every tie has a deterministic, reproducible outcome ending in a shared trophy.

**Acceptance Criteria:**

**Given** the tie-ladder rule (FR-29, AD-14, AD-19),
**When** Stage 2 (or anti-sweep overflow) produces a tie,
**Then** it resolves in order: (1) secondary stat, (2) efficiency cross-multiply, (3) head-to-head (strict dominator over the remaining set, skip if they never met), (4) earliest `achievement_ts` (integer), (5) shared co-winner.

**Given** a ladder bottom-out (UX-DR59),
**When** step 5 is reached,
**Then** the award is shared, recorded as 1..N `award_result_winner` rows, and presented as one card with two prize-chips (a designed outcome, never an error).

_Traces: FR-29 · AD-14, AD-19_

### Story 6.6: Anti-sweep and luck-meter

As a viewer,
I want at most one trophy per player per spin with luck biased toward empty shelves,
So that no single player hoovers a spin and players with nothing yet get spotlight.

**Acceptance Criteria:**

**Given** the anti-sweep rule (FR-26, AD-14),
**When** live awards in a spin are processed in ascending `priority`,
**Then** a player assigned a trophy that spin is removed from later candidate sets, and overflow re-resolves via the FR-29 ladder to the next eligible.

**Given** the DB enforcement (AD-14),
**When** winners are written,
**Then** `UNIQUE(spin_id, winner_entry_id)` enforces ≤1 trophy per player per spin at the database level.

**Given** the luck-meter bias (FR-26),
**When** Stage-1 weights are computed,
**Then** an empty shelf yields the heaviest weight, biasing category selection toward players with empty shelves.

_Traces: FR-26 · AD-14_

### Story 6.7: Pity roulette

As a viewer who won nothing in the main spins,
I want a guaranteed consolation draw,
So that nobody finishes the ceremony empty-handed.

**Acceptance Criteria:**

**Given** the pity rule (FR-28, AD-14, SM-2),
**When** all main spins complete,
**Then** every non-fully-DQ'd player with an empty shelf gets one guaranteed consolation award via the seeded pity stream.

**Given** determinism (AD-14),
**When** pity runs,
**Then** the reveal order is seeded but the outcome is invariant — every winless eligible player gets exactly one (`Nadie se va con las manos vacías`).

_Traces: FR-28 · AD-14 · SM-2_

### Story 6.8: Reveal-gating and commitment

As a viewer,
I want the seed and bundle hash committed up front and identities revealed only at their spin,
So that the bytes can't change after commitment and nothing is spoiled early.

**Acceptance Criteria:**

**Given** the commitment rule (AD-22, FR-24, FR-30),
**When** the final demo is Approved,
**Then** `seed_hex` and `bundle_hash` are published up front as the immutable commitment.

**Given** the reveal-gating rule (AD-22),
**When** a non-admin queries award catalog metadata, per-spin live-category sets, or `award_result`/`award_result_winner` rows,
**Then** they are invisible until that spin's `spin.revealed_at` — a distinct RLS axis from pending/approved.

**Given** progressive release (AD-22),
**When** the ceremony proceeds,
**Then** the verification bundle is released progressively per reveal and in full at completion.

_Traces: FR-24, FR-30 · AD-22_

### Story 6.9: Verification bundle and "Verificar la ceremonia"

As a skeptical viewer,
I want to recompute the ceremony client-side from the published bundle,
So that I can confirm every revealed outcome and the system can never compute an unrevealed winner.

**Acceptance Criteria:**

**Given** the bundle rule (FR-27, AD-24),
**When** the `verification_bundle` is published,
**Then** it is RFC-8785 canonical JSON (`algo_version = inclusivcup-roulette-1.0.0`, `seed_hex`, `luck.weight_table`, `spin_plan`, `awards`, `pity`, `players` in integer form) with SteamID64 as decimal strings, and `bundle_sha256` published.

**Given** the verifier rule (FR-30),
**When** a viewer taps `Verificar la ceremonia`,
**Then** the client reproduces every revealed outcome from the published bundle and confirms it matches,
**And** the verifier can never compute a winner for an unrevealed spin.

**Given** the algo-version rule,
**When** a client encounters a MAJOR `algo_version` it does not implement,
**Then** it refuses to "verify" rather than guessing.

_Traces: FR-27, FR-30 · AD-24_

### Story 6.10: Ceremony reveal UI with reduced-motion parity

As a viewer,
I want the reveal to be dramatic on phone and shared screen and fully usable with reduced motion,
So that everyone gets the same reveal and order regardless of motion settings.

**Acceptance Criteria:**

**Given** the reveal rule (FR-30, UX-DR42),
**When** a spin plays,
**Then** the phone reveal is the source of truth (a wide shared-screen banner mirrors it) and presents Stage-1 wheel motion → Stage-2 category flip → one-trophy reveal, with a persistent verify-strip showing `Sembrado por el demo final · reproducible`.

**Given** the reduced-motion rule (AD-24, UX-DR32 — CRITICAL),
**When** `prefers-reduced-motion` is set,
**Then** the wheel does not spin and the flip does not animate; the category resolves and the winner appears directly in gold with brief non-animated emphasis,
**And** the outcome and published spin order are identical to the animated path — only motion is removed.

_Traces: FR-30 · AD-24_

### Story 6.11: Cross-language golden-vector suite

As an operator,
I want the Go producer and JS verifier to pass a shared golden-vector suite byte-for-byte,
So that the two implementations provably agree before launch.

**Acceptance Criteria:**

**Given** the conformance rule (AD-14, AD-19, FR-25),
**When** the build runs,
**Then** `roulette/vectors/` holds language-neutral golden vectors covering the HMAC block, `uniform_int` rejection, weighted pick, canonicalization + `bundle_sha256`, and an end-to-end ceremony,
**And** both the Go producer and the JS verifier pass every vector byte-for-byte.

**Given** the real-snapshot rule (AD-19),
**When** the end-to-end vector is built,
**Then** it is projected from a *real* captured snapshot (not synthetic), exercising forced ties across all ladder rungs, anti-sweep overflow, and a pity draw.

_Traces: FR-25 · AD-14, AD-19_

---

## Epic 7: Hardening & Operations

The operator runs the one-off event on a single environment with cost guards, demo durability, and a tested recovery path; the build-handoff checklist is verified before launch. This epic adds the operational slice over the substrate and seams the earlier epics established — it does not fork them.

### Story 7.1: Demo durability (object-lock + delete-guard)

As an operator,
I want permanent-seed demos protected at both the storage and database layers,
So that the source-of-truth demos can never be deleted.

**Acceptance Criteria:**

**Given** the durability rule (AD-25, AD-1, FR-15),
**When** a demo has `retention_class='permanent_seed'`,
**Then** R2 object-lock/retention is enforced at the storage layer and the database carries a delete-guard (`delete_after = NULL`) so neither layer can delete it.

**Given** the re-hashable rule (AD-1),
**When** a permanent-seed demo is later read,
**Then** it still re-hashes byte-for-byte to its stored SHA-256.

_Traces: AD-25, AD-1 · FR-15 · NFR-Reliability_

### Story 7.2: Cost guards (billing alerts)

As an operator,
I want billing alerts on the metered services,
So that a runaway cost on a free/hobby tier is caught early.

**Acceptance Criteria:**

**Given** the cost-guard rule (AD-25),
**When** the environment is operational,
**Then** billing alerts are configured on R2, Supabase, and Railway at sensible thresholds for a one-off event.

_Traces: AD-25 · NFR-Reliability_

### Story 7.3: DR runbook

As an operator,
I want a documented recovery path,
So that I can rebuild derived state from the durable demos if the database is lost.

**Acceptance Criteria:**

**Given** the DR stance (AD-25, NFR-Reliability),
**When** the runbook is written,
**Then** it documents that R2 raw demos are the durable source of truth and all derived DB state is re-derivable by re-parse, complemented by Supabase managed backups for catalog/roster/audit.

**Given** the runbook,
**When** recovery is rehearsed,
**Then** re-parsing the retained demos reconstructs stats, leaderboards, and (via the frozen snapshot + seed) the ceremony.

_Traces: AD-25 · NFR-Reliability_

### Story 7.4: Ingest recovery hardening (ops slice)

As an operator,
I want parse failures and anomalies to surface to me with the parser pinned and concurrency bounded,
So that ingestion never silently stalls and survives Valve format churn.

**Acceptance Criteria:**

**Given** the bounded-job rule (AD-26),
**When** the worker is configured for the event,
**Then** the parser version is pinned (`demoinfocs-golang v5.2.0`), `ParseFailed` retries are capped with backoff, and concurrency is bounded.

**Given** the never-silent rule (AD-26, UX-DR31),
**When** a parse fails past its cap or a match is `Anomalous`,
**Then** an alert is raised to the `admin:<id>` channel and logged — never failing silently.

_Traces: AD-26 · NFR-Reliability_

### Story 7.5: Build-handoff checklist gate

As an operator,
I want the reconstructability and real-snapshot guarantees verified before launch,
So that the two load-bearing invariants are proven, not assumed.

**Acceptance Criteria:**

**Given** the AD-11 invariant,
**When** the pre-launch checklist runs,
**Then** every viewer surface is verified to be fully reconstructable from a published-state read alone (no surface depends on replaying realtime events).

**Given** the AD-19 invariant,
**When** the pre-launch checklist runs,
**Then** the real-snapshot golden vector (Story 6.11) is verified to pass for both the Go producer and the JS verifier.

**Given** both gates,
**When** the checklist completes,
**Then** the event is cleared for launch only if both pass.

_Traces: AD-11, AD-26 · NFR-Security, NFR-Verifiability_
