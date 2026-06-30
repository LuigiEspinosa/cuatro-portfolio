---
id: SPEC-cs-tournament
companions:
  - capability-map.md
  - glossary.md
  - ../../planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md
  - ../../planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md
  - ../../planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md
  - ../../planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/DESIGN.md
sources:
  - ../../planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md
  - ../../planning-artifacts/prds/prd-cs-tournament-2026-06-29/addendum.md
  - ../../planning-artifacts/briefs/brief-cs-tournament-2026-06-29/brief.md
  - ../../planning-artifacts/briefs/brief-cs-tournament-2026-06-29/addendum.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents in `sources:` are traceability only — consult them for narrative rationale this contract intentionally omits. On any conflict, the architecture spine (`ARCHITECTURE-SPINE.md`) wins; this SPEC inherits its decisions and does not re-open them.

# InclusivCup — CS2 Tournament (v1)

## Why

A vision to realize for a private group of 8–16 friends. Once the bracket leaders pull ahead, everyone else loses a reason to stay invested — and the event dies for most of the room. InclusivCup keeps the whole group in it to the final whistle by running orthogonal reward tracks off one trustworthy source: the CS2 demo, which is both the dispute referee and the RNG seed. v1 delivers the Champion bracket, a demo-sourced stats/leaderboard layer, and a provably-fair Awards Roulette ceremony that manufactures spotlight for non-winners ("fuerza en lo que otros ignoran"). Because every result derives from the demo and every award is reproducible client-side, "is it rigged?" stops being an accusation against the admin and becomes a game anyone can check — you argue with the bytes, and the bytes win.

## Capabilities

Capabilities map 1:1 to the SOLUTION-DESIGN §12 seven-epic seams. Each cites the PRD FRs it satisfies and the architecture ADs that govern it. Full seam matrix (CAP ↔ epic ↔ spine F-unit ↔ FR ↔ AD ↔ owning module) is in [capability-map.md](capability-map.md).

- **CAP-1 — Foundation & Schema**
  - **intent:** The system stands on a seasons-aware Postgres schema with fail-closed row-level security and provisioned infrastructure, so every later capability inherits one RLS-gated data substrate keyed by a single canonical identity column.
  - **success:** Migrations apply cleanly to an empty database; every table has `ENABLE` + `FORCE ROW LEVEL SECURITY` with an explicit viewer policy or no viewer SELECT at all; SteamID64 is Postgres `text` with a `CHECK (~ '^[0-9]{17}$')` constraint; all event data scopes by `tournament` under a `season`; `audit_log` and snapshot tables are append-only (no UPDATE/DELETE policy); no secret is exposed through a `NEXT_PUBLIC_*` variable.
  - **traces:** NFR-Data, NFR-Security; AD-4, AD-7, AD-12, AD-17, AD-18, AD-25.

- **CAP-2 — Identity & Roster**
  - **intent:** A player signs in with Steam and the system captures their SteamID64 as canonical identity; the admin opens and closes registration and manages the roster.
  - **success:** Steam OpenID 2.0 is verified server-side via a `check_authentication` round-trip (never trusting redirect params); SteamID64 and role are written to Supabase `app_metadata` through the Admin API only (never `user_metadata`); the admin opens/closes the registration window and can remove a player before bracket generation; a parsed SteamID64 absent from the roster appears in an unreconciled list and is never silently dropped; revoking a role both updates `app_role` and invalidates the session so a stale JWT cannot retain admin.
  - **traces:** FR-1, FR-2, FR-3, FR-4; AD-4, AD-12.

- **CAP-3 — Demo Ingestion Worker**
  - **intent:** A finished match's demo (MatchZy auto-upload or admin manual upload) flows to the Go worker, which hashes, dedupes, parses, validates, and writes per-player stat rows as the single writer.
  - **success:** Demo bytes reach R2/the worker without transiting a Vercel function; the raw `.dem` is retained write-once and re-hashable byte-for-byte to its stored SHA-256; the worker (service-role) is the only writer of `demo` and `stat_row`; ingestion is idempotent on `(match_id, sha256)` and `(match_id, steamid64)`; validation anomalies (Σkills ≠ Σdeaths, zero stat rows, unreconciled SteamID64) gate the match to `Anomalous` for admin review rather than publishing; a re-uploaded demo short-circuits to the prior result; a 170 MB demo parses in seconds and end-to-end demo→stats latency meets SM-5.
  - **traces:** FR-11, FR-12, FR-13, FR-14, FR-15, FR-16; AD-1, AD-2, AD-3, AD-5, AD-16, AD-23, AD-26.

- **CAP-4 — Bracket & Admin Command Routes**
  - **intent:** The admin generates a random-seeded double-elimination bracket and drives matches (advance, bye, forfeit, grand-final reset) through server-gated, idempotent, audited command routes, with "Aprobar" atomically publishing a match.
  - **success:** A bracket is generated for 8–16 players with byes for non-power-of-two and a `bracket_seed` stored separately from the fairness seed; advance is a conditional consequence of a result (`WHERE slot IS NULL OR = winner`, no double-route) and never an independent control racing publish; "Aprobar" publishes stat rows, sets the demo-derived score, advances the bracket, posts the feed entry, and recomputes leaderboards in **one DB transaction**, with the realtime event emitted only after commit; a forfeit is markable only after the grace timer (default 10 min, configurable) elapses, logged with actor + timestamp; the grand final is up to two ordered `match` rows and the champion slot is never overwritten in place; re-parse/rollback transitively revert dependent advances before unpublishing; every mutation re-verifies `is_admin()` server-side and writes an append-only `audit_log` row.
  - **traces:** FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-13, FR-14, FR-16, FR-33; AD-5, AD-6, AD-8, AD-9, AD-10, AD-13, AD-17, AD-21, AD-23.

- **CAP-5 — Stats, Leaderboards & Realtime Viewer Surfaces**
  - **intent:** The worker derives core, weird, and derived stats per player per match; a single normalized leaderboard view feeds mobile-first Spanish read-only surfaces — timeline feed, bracket, leaderboards, player detail — updated live within ~2s.
  - **success:** Core stats (K/D/A, ADR overkill-capped, HS%, MVPs, flash assists, utility damage, KAST), weird demo-only stats (knife, wallbang, through-smoke, no-scope, blind kills, molotov/HE damage), and derived stats (entry frags, 1vX clutches) are all written; FR-21 anti-farm floors (≥24 rounds, ≥20 kills for rate/HS%, AFK/idle DQ at ≥50% idle rounds) and rate-vs-volume classing are applied in **exactly one** SQL view/RPC over `status='approved'` rows; forfeits and byes contribute zero rows so leaderboards normalize over matches actually played; the timeline feed is the chronological, approved-only single source of truth (pending excluded); every viewer surface is read-only and reconstructable from the published snapshot alone; a Broadcast nudges clients within ~2s and a reconnecting client re-fetches the snapshot rather than replaying missed events; all viewer copy is Spanish, mobile-first with no horizontal scroll on the primary ranking and tabular numerals throughout.
  - **traces:** FR-17, FR-18, FR-19, FR-20, FR-21, FR-22, FR-23, FR-31, FR-32, FR-34; AD-2, AD-7, AD-9, AD-11, AD-20, AD-24.

- **CAP-6 — Awards Roulette: Producer & Verifier**
  - **intent:** At the ceremony, the system runs a two-stage, provably-fair Awards Roulette from a frozen stat snapshot seeded by the final demo's hash, and any viewer can independently reproduce the outcome client-side.
  - **success:** `fair_seed = SHA-256(final_demo_bytes)` is frozen the moment the championship-deciding demo is Approved, distinct from `bracket_seed` and never re-rolled; winners are resolved only from an immutable `stat_snapshot` captured under a SERIALIZABLE ceremony-lock (never live `stat_row`); the PRNG is HMAC-SHA256 counter-mode with per-decision domain separation, decision arithmetic is integer-only (rate stats compared by cross-multiplication, equal value is a tie not a silent argmax), and sampling is unbiased via rejection; the two-stage draw (luck-meter category selection → deterministic winner → FR-29 tie ladder → anti-sweep ≤1 trophy/player/spin enforced by `UNIQUE(spin_id, winner_entry_id)` → pity for every winless player) is parameterized by the published `spin_plan`; award identities are reveal-gated (invisible until their spin; `seed_hex` + `bundle_hash` published up front as commitment); "Verificar la ceremonia" reproduces every revealed outcome client-side and can never compute an unrevealed winner; the Go producer and JS verifier pass the cross-language golden-vector suite byte-for-byte, including an end-to-end vector projected from a *real* captured snapshot.
  - **traces:** FR-24, FR-25, FR-26, FR-27, FR-28, FR-29, FR-30; AD-13, AD-14, AD-15, AD-19, AD-22, AD-24.

- **CAP-7 — Hardening & Operations**
  - **intent:** The operator runs the one-off event on a single environment with cost guards, demo durability, and a tested recovery path.
  - **success:** `permanent_seed` demos carry storage-layer object-lock/retention plus a DB delete-guard (`delete_after = NULL`); billing alerts are configured on the metered services (R2, Supabase, Railway); a DR runbook documents that R2 raw demos are the durable source and all derived DB state is re-derivable by re-parse, complemented by Supabase managed backups for catalog/roster/audit; `ParseFailed` retries are bounded (capped attempts + backoff) with a pinned parser version and bounded concurrency, surfacing to an admin alert and never silently; the build-handoff checklist (AD-11 reconstructable-from-published-read, AD-19 real-snapshot golden vector) is verified before launch.
  - **traces:** NFR-Reliability, NFR-Perf, NFR-Security; AD-11, AD-25, AD-26.

## Constraints

- **Stack is fixed.** Next.js 16.2 (App Router, Node 20.9+) on Vercel · Supabase free tier (Postgres 15+, Auth, Realtime) · Go 1.26 worker with demoinfocs-golang v5.2.0 (pinned) · Cloudflare R2 · MatchZy demo source. [stack, locked]
- **The raw demo is the single source of truth.** Every match's `.dem` is retained write-once in R2 (`permanent_seed` never deleted), identified by `(match_id, sha256)`, byte-for-byte re-hashable; re-parse and rollback touch only *derived* rows. [AD-1, FR-15]
- **SteamID64 is the sole canonical join key.** Postgres `text` with `CHECK (~ '^[0-9]{17}$')`; display names are cosmetic and never a join key; a parsed ID absent from the roster surfaces in an unreconciled list, never silently dropped. [AD-4, FR-2]
- **One writer of derived data.** The Go worker via service-role is the only writer of `demo` and `stat_row`; no client role has any stat-write path. [AD-2]
- **All mutations are server-gated, admin-only, idempotent, and audited.** RLS is `ENABLE` + `FORCE` on every table, fail-closed; viewers read approved-only via a policy never OR'd with the admin policy. [AD-7, AD-8, AD-17]
- **Demo bytes never transit a Vercel function** (≈4.5 MB body cap): MatchZy → worker HTTP (shared-secret) or presigned R2 multipart, never through a Next.js route. [AD-16, FR-11]
- **The ceremony is a deterministic, client-reproducible pure function** of `fair_seed` (SHA-256 of the final demo) + a frozen integer-form snapshot + the published `inclusivcup-roulette-1.0.0` algorithm; HMAC-SHA256 counter-mode PRNG, integer-only arithmetic, rejection sampling; the Go producer and JS verifier must pass a cross-language golden-vector suite byte-for-byte. [AD-13, AD-14, AD-15, AD-19, AD-22]
- **The schema is seasons-aware but no season feature ships in v1.** All data scopes by `tournament` under a `season`; no season-spanning UX, feature, or query is built. [AD-18]
- **Viewer copy is Spanish-only, from one i18n module.** Load-bearing transparency strings (`Verificar la ceremonia`, `Verificado desde el demo`, `Sembrado por el demo final · reproducible`) and state labels (`pending → Pendiente`, `approved → Aprobado`) are fixed and exact. [AD-24]
- **Viewer experience is mobile-first, dark-only, reduced-motion-safe.** One-handed at ~390px; reduced-motion uses the *identical* ceremony outcome and spin order (only motion is removed); tabular numerals everywhere. [EXPERIENCE, DESIGN, NFR-Mobile]
- **No money in the app.** Winners are recorded only; token-shirt prizes settle outside the app (sidesteps KYC/gambling/tax). [brief]
- **Single environment; secrets server-only.** One Supabase project, one Railway worker, one R2 bucket, one Vercel project; service-role key, R2 write creds, and the worker↔MatchZy shared secret live only in server env. [AD-25]

## Non-goals

- **Meta-games reward track** — predictions, fantasy, streaks, participation economy, player "Wrapped"/recap, MVP eye-test voting. Deferred to v2.
- **In-app money/prize handling** — buy-ins, payouts, prize-cap logic. Prizes settle outside the app; token prizes remove the need for a cap.
- **Gentle/privacy "shame-award" opt-out mode** — the private group ships sharp comedy awards; gentle mode becomes a prerequisite only if the app ever opens to the public.
- **In-app scheduling** — match windows, time zones, reminders, or a Discord-bot front door. Coordination stays in Discord.
- **Season-persistence features** — status tiers, claimable map segments, achievement log, hall of fame. The schema is seasons-aware but none ship.
- **Native mobile app and light mode** — responsive, dark-only web only.
- **In-app dispute-raise affordance** — disputes are evidence-only (read-only demo hash + re-parse + seed snapshot), raised in Discord and settled by the demo. [OQ-6 designed non-feature]

## Success signal

One full 8–16-player event runs end-to-end in-app — registration → champion crowning → Awards Ceremony — with **zero hand-typed stats** (every completed non-forfeit match sourced from its demo), **every contested result settled by re-hashing** the retained demo to its stored SHA-256, **every award reproducible client-side** from the published seed + snapshot + algorithm, and **no registered player finishing without at least one live reward track**. Demo→stats latency holds P50 < 5 min / P95 < 15 min, with zero awards won by AFK/idle or below-floor participation. [SM-1, SM-2, SM-3, SM-4, SM-5, SM-C1, SM-C2]

## Assumptions

- v1 auto-ingestion runs on the hosted Railway worker with MatchZy auto-upload; the proven local Go CLI is the fallback if hosting is deferred. [locked; PRD addendum §2]
- ADR uses the overkill-capped (`HealthDamageTaken`) convention to match the in-game scoreboard. [PRD addendum §4/§5 — locked]
- AFK/idle DQ sampling cadence + epsilon, MatchZy match-association, match formats/thresholds, and the `spin_plan` are build-time configuration tuned within the SM-5 budget; fairness-affecting values are published in the verification bundle so tuning stays reproducible. [spine deferred list]

## Open Questions

None spec-blocking. The architecture resolved OQ-2 (hosted worker + MatchZy auto-ingest, local-CLI fallback), OQ-3 (parser = demoinfocs-golang/Go), and OQ-8 (raw demos in R2 indefinitely), and designated OQ-4/OQ-5/OQ-6/OQ-7 as build-time configuration or designed non-features. They surface as Assumptions above, not as gaps requiring a decision before downstream consumes this SPEC.
