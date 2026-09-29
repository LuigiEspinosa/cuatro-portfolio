---
title: Architecture Spine — Pre-Handoff Rubric Review
artifact: ARCHITECTURE-SPINE.md (InclusivCup CS2 Tournament)
reviewer: rubric-walker (pre-handoff gate)
date: 2026-06-30
verdict: CONCERNS
---

# Rubric Review — InclusivCup Architecture Spine

**Verdict: CONCERNS** — The invariant surface is strong, dense, and correctly enforceable;
capability coverage of the PRD's functional requirements is essentially complete. But the spine
leaves the **operational/environmental envelope** (deploy/environments, secrets, observability,
backup/DR) almost entirely silent, and it asserts the **parse-latency NFR (SM-5)** as a fact
without any governing AD or component (no async/queue model, no failure-handling story). These
are dimensions the feature altitude owns. Fix the silent operational dimension and the SM-5 gap
and this is a PASS.

---

## 1. Does it fix the real divergence points for the level below, and miss none?

**Mostly yes.** The four-pattern paradigm names the genuine fork-in-the-road decisions that, if
left unstated, would let two builders diverge: who writes stats (single-writer, AD-2), what is
truth (immutable demo, AD-1), how reads stay safe (RLS-gated CQRS-lite, AD-7), and how the
ceremony stays reproducible across two languages (deterministic recomputation + golden vectors,
AD-14). The dependency-direction rule ("no edge between `worker/*` and `app/`+`lib/`; only coupling
is the two shared contracts") is exactly the kind of structural invariant that prevents the
single most likely architectural drift in a polyglot repo. Idempotency keys, the score-source
discriminator (AD-5), and the seed-vs-bracket-seed split (AD-13) all close real ambiguity.

**Gaps:**
- **Async/job model for ingestion is an unfixed divergence point.** Whether parse is a synchronous
  HTTP handler, a background job, a queue/worker-pool, or an Admin-triggered CLI run is left
  open — yet it determines the SM-5 latency budget, retry behavior, and concurrency. Two builders
  could implement this completely differently and both "conform" to the spine. (See §5/§6.)
- **Registration-window lifecycle (FR-3)** has no governing invariant — only a `roster_entry`
  table. Open/close state and the "Admin-only after close" rule are unfixed. Low severity (it's a
  small state machine), but it is a dimension the altitude owns and it is silent.

## 2. Is every AD's Rule enforceable, and does it actually prevent its stated divergence?

**Yes — this is the spine's strongest quality.** The Rules are written as schema- and
policy-level mechanisms, not aspirations:

- AD-2 / AD-7: "no insert/update/delete policy for `anon`/`authenticated`"; "two policies, never
  one OR'd policy, so a malformed admin policy fails closed" + `FORCE ROW LEVEL SECURITY`. These
  are checkable in the migration files — genuinely enforceable, and the fail-closed framing is
  exactly right.
- AD-3: `UNIQUE` constraints named explicitly; re-parse defined as `ON CONFLICT … DO UPDATE` plus
  delete-missing in one transaction. Enforced by the DB, not by discipline.
- AD-12: role from `app_metadata` only (service-role-writable), never `user_metadata`
  (client-mutable); RLS reads from `auth.jwt() -> 'app_metadata'`. Prevents the stated
  client-side escalation by construction.
- AD-14: integer-only arithmetic, HMAC-CTR, rejection sampling, cross-language golden vectors
  gating the build. The golden-vector suite is what makes "enforceable" real for the
  producer/verifier parity claim.
- AD-17: append-only "by absence" (INSERT for service-role only, no UPDATE/DELETE policy) — an
  enforceable definition of append-only, not a promise.

**One soft spot:** AD-11's "every viewer surface is fully reconstructable from a published-state
read alone" is the right invariant but is enforced only by convention/review, not by a mechanism.
There is no structural guard preventing a builder from putting load-bearing state on the wire
(e.g., a `spin.reveal` payload the UI depends on without a re-fetchable backing row). Acceptable
for this altitude, but flag it for the build handoff as a review checklist item rather than an
enforced rule.

## 3. Could anything under Deferred let two units diverge?

**No — Deferred is disciplined.** Each deferred item is correctly classified as config/content
or out-of-scope, not as an unmade structural decision:
- MatchZy→match association is explicitly "ingest config, not a divergence-class invariant."
- AFK/idle cadence, formats, thresholds, spin plan are organizer/content config — and crucially,
  the fairness-affecting ones (`luck.weight_table`, `spin_plan`, floors) are **published in the
  verification bundle**, so tuning stays reproducible (does not threaten AD-14). Good.
- Seasons-aware-but-no-season-features is locked by AD-18.

The one item to watch: "Operational envelope beyond v1 scale" defers *scaling* — that is fine.
But it is being used to wave past the *existence* of an operational envelope at v1 scale too
(see §6). Deferring "revisit at season scale" is legitimate; not deciding deploy/secrets/backup
*at all* is not the same thing and is a finding below.

## 4. Is named tech verified-current? (note only — another lens owns web verification)

Recording the version claims for the verification lens; **not** re-checked against the web here:
- Next.js **16.2.x** (Node 20.9+), App Router
- Supabase Free tier (Postgres 15+)
- Go **1.26.x**
- demoinfocs-golang **v5.2.0 (pinned)** — pinning is correct per NFR/parser-churn; the *specific
  version's* currency is for the tech-verification lens to confirm.
- Cloudflare R2, Railway Hobby, MatchZy, RFC 8785 (JCS), HMAC-SHA256.

**Note for the verification lens:** Next.js 16.2.x and Go 1.26.x are the two most aggressive
version claims (both ahead of what a 2026-01 knowledge cutoff would treat as obviously-stable) —
worth a targeted currency check. No internal inconsistency in the versions as stated.

## 5. Does it cover the driving spec's capabilities?

### FR coverage (FR-1 … FR-34)

| FR | Governed by | Status |
| --- | --- | --- |
| FR-1 Steam OAuth | AD-12, `app/auth/steam` | ✅ |
| FR-2 SteamID64 capture/reconcile | AD-4 (unreconciled left-join list) | ✅ |
| FR-3 Roster & registration window | `roster_entry` only — **no AD for window open/close lifecycle** | ⚠️ partial |
| FR-4 Roles (admin/viewer) | AD-12, AD-8 | ✅ |
| FR-5 Random-seeded bracket gen | AD-13 (`bracket_seed`), F2 map | ✅ |
| FR-6 Double-elim structure | `lib/bracket` (two-loss-from-edges), `match.bracket` | ✅ (component) |
| FR-7 Advance live | AD-8 (idempotent, dest-slot keyed), AD-11 | ✅ |
| FR-8 Byes | AD-9 | ✅ |
| FR-9 Forfeit + grace | AD-9 (grace timer, logged) | ✅ |
| FR-10 Pre-declared format/tie | AD-10 | ✅ |
| FR-11 Demo acquisition (no Vercel body) | AD-16 | ✅ |
| FR-12 Parse → stat rows + conservation | AD-3; Validating state checks kills==deaths | ✅ |
| FR-13 Staged pending→approved | AD-6, AD-7 | ✅ |
| FR-14 Re-parse / rollback | AD-3, AD-8 (transitive revert + flag) | ✅ |
| FR-15 Raw retention + hash | AD-1, AD-16 (`permanent_seed`, Delete refuses) | ✅ |
| FR-16 Score derivation | AD-5 | ✅ |
| FR-17 Walkover stat hygiene | AD-9 (no reachable stat-write path) | ✅ |
| FR-18 Core stats (ADR/KAST/HS%) | F4 map + Conventions (overkill-cap, KAST 5s locked) | ✅ |
| FR-19 Weird demo-only stats | F4 map, `worker/ingest` derivations | ✅ (component) |
| FR-20 Derived stats (entry/clutch) | F4 map, `worker/ingest` | ✅ (component) |
| FR-21 Anti-farm + AFK-DQ | AD-14 floors, `stat_row.idle_dq/rounds_played`; cadence Deferred | ✅ |
| FR-22 Rate vs volume | `award.class`, AD-14 cross-multiplication, leaderboard reads | ✅ |
| FR-23 Leaderboards/views | AD-7, F5 (Spanish, mobile-first) | ✅ |
| FR-24 Award catalog/buckets | `award` ERD, catalog-lock at ceremony-start (AD-15); blur is UX | ✅ |
| FR-25 Two-stage draw | AD-14 (Stage 1/2 contract) | ✅ |
| FR-26 Anti-sweep + luck-meter | AD-14 (ascending priority, removal) | ✅ |
| FR-27 Provably-fair seed | AD-13 | ✅ |
| FR-28 Pity roulette | AD-14 (pity stream, invariant outcome) | ✅ |
| FR-29 Tie ladder | AD-14, `award_result.tie_ladder_exit_step` | ✅ |
| FR-30 Ceremony reveal + replayable | AD-14/AD-15 + published verification bundle (linkable) | ✅ |
| FR-31 Timeline feed (single SoT) | AD-6, AD-11 | ✅ |
| FR-32 Navigation / IA | F7/F5 read surfaces, mobile-first convention | ✅ (light) |
| FR-33 Admin-gated actions | AD-8, AD-17 | ✅ |
| FR-34 Viewer read-only | AD-7 | ✅ |

**No FR is wholly ungoverned.** FR-3 is the only partial (registration-window state machine
unfixed). FR-6 / FR-18-20 / FR-32 are covered at component-granularity rather than by a named
invariant — appropriate, since they are derivation/routing detail, not divergence classes.

### NFR coverage

| NFR | Governed by | Status |
| --- | --- | --- |
| Parse latency **P50<5min / P95<15min** (SM-5) | Asserted in Deferred ("SM-5 parse budget"); PoC ~3.4s — **no AD/component, no async/queue/retry/concurrency model** | ❌ **gap** |
| ~2s realtime propagation | AD-11, AD-6 (post-commit emit) | ✅ |
| Idempotency (`match_id`+steamid64) | AD-3, Conventions | ✅ |
| Parser pinning (format churn) | Stack (v5.2.0 pinned), `demo.parser_version`, AD-3 | ✅ |
| Security & authorization | AD-2, AD-7, AD-8, AD-12, AD-17 | ✅ (strong) |
| Mobile-first | Conventions, F5/F7 | ✅ |
| Verifiability | AD-13, AD-14, AD-15, verification bundle | ✅ |

**The SM-5 finding:** parse latency is the spine's only *quantitative performance NFR*, and it is
the one NFR with no governing decision. The architecture never states whether ingestion is sync
or async, how a slow/failed parse is retried (the `ParseFailed → Parsing` self-loop exists in the
lifecycle diagram but nothing schedules or bounds it), or how concurrent match parses behave on a
single Railway Hobby worker. "PoC parsed in 3.4s" covers *parse compute* but not *end-to-end
demo-landing→stats-visible latency* (acquisition of a 50–170MB upload + R2 round-trip + parse +
DB write), which is what SM-5 actually measures. This needs at least one AD (e.g., "ingestion is
an idempotent async job; a parse failure leaves the demo in `ParseFailed`, retriable, and never
blocks acquisition").

### Success-metric coverage (SM-1 … SM-5)

- SM-1 zero manual stat entry → AD-2, AD-5 ✅
- SM-2 everyone stays in it → AD-14 (pity guarantee) ✅
- SM-3 no rigging disputes → AD-1, AD-13, AD-14 (byte-reproducible) ✅
- SM-4 full event end-to-end → whole spine ✅
- SM-5 latency → **see NFR gap above** ❌
- (Counter-metrics SM-C1 award credibility → AD-14 floors/DQ ✅; SM-C2 admin effort → atomic
  Aprobar AD-6 ✅ — both implicitly supported.)

## 6. Is every dimension the altitude owns decided, deferred, or an open question?

**This is where the spine falls short.** Several operational/environmental dimensions — which the
feature-altitude architecture owns and the rubric specifically calls out — are *silent* (neither
decided, nor explicitly deferred, nor listed as an open question):

1. **Deployment & environments — SILENT.** No dev/staging/prod model, no environment separation,
   no statement of how the Next.js app, the Go worker, and the DB are promoted or configured per
   environment. "Vercel host" and "Railway Hobby" are hosting *targets*, not a deployment
   decision. For a polyglot two-runtime system this is a real divergence point.
2. **Secrets management — SILENT.** The spine depends on at least four secrets — Supabase
   service-role key, MatchZy→worker shared secret (AD-16), R2 credentials, Steam OpenID
   verification — yet never says where they live (Vercel/Railway env vars, a vault) or how the
   worker and app obtain them. Given that AD-2/AD-12's entire security model rests on the
   service-role key never leaking to a client, the absence of a secrets-handling invariant is a
   notable hole in an otherwise security-forward spine.
3. **Observability / monitoring — SILENT.** `audit_log` is a *business* audit, not operations.
   There is no story for worker failure visibility, parse-failure alerting, or logs. The
   `ParseFailed` state exists but nothing observes it — an admin would have no signal that a
   match silently failed to ingest, which directly threatens SM-4/SM-5.
4. **Backup / DR — SILENT.** All *derived* state (brackets, stats, ceremony, audit) lives only in
   free-tier Supabase Postgres, which has limited/short backup retention. The raw demos in R2 are
   the source-of-truth and *are* re-parseable (good) — but bracket state, approvals, audit log,
   roster, and roles are not reconstructable from demos. A DB loss is unrecoverable as specified.
   At minimum this deserves an explicit deferral acknowledging the risk, not silence.

The existing "Operational envelope beyond v1 scale" deferral covers *scaling* (concurrency,
growth) correctly, but it is being stretched to imply the operational dimension is handled. It is
not: deferring "revisit at season scale" ≠ deciding deploy/secrets/observability/backup at v1
scale. Even a single terse paragraph — "secrets in Vercel/Railway env; single prod environment,
no staging in v1; observability = Railway/Vercel logs + an admin-visible ParseFailed surface;
backup = R2 is recoverable, DB loss accepted/relies on Supabase PITR" — would close this.

All *other* altitude-owned dimensions (data model, auth, read/write split, realtime topology,
storage abstraction, fairness contract, naming/consistency) are decided and decided well.

## 7. Does it read as a terse build-substrate (invariants first, seed minimal), not bloated?

**Yes — and this is a genuine strength.** Invariants lead; the ERD/source-tree/diagrams are seed,
not specification; Deferred is crisp. Density is high without being padded. Minor notes (no action
required, listed for the editorial lens):

- The Design-Paradigm prose and the Mermaid dependency graph restate the same "no edge between
  worker and app" rule twice; the second is a useful visual, so keep both but it is the one place
  of light redundancy.
- The Provably-Fair section is the longest prose block. It is load-bearing (it *is* the AD-14
  contract surface) and explicitly punts byte-level pseudocode to the build-handoff doc, so this
  is appropriate depth, not bloat.
- No speculative tech, no gold-plating, no requirements invented beyond the PRD. Seasons-awareness
  is correctly held to schema-only.

---

## Findings summary (by severity)

| # | Severity | Finding | Fix |
| --- | --- | --- | --- |
| F1 | **High** | Operational/environmental envelope is silent: no deploy/environments, secrets management, observability, or backup/DR — a whole altitude-owned dimension left unaddressed (rubric #6). | Add one terse "Operations & Environments" section (or ADs): secrets location, single-env v1 stance, log/alert surface for `ParseFailed`, and an explicit backup/DR stance (R2 recoverable; DB loss accepted or via Supabase PITR). |
| F2 | **High** | SM-5 parse-latency NFR has no governing AD/component; no async/queue/retry/concurrency model — the lifecycle's `ParseFailed` loop is unscheduled and unbounded. | Add an AD: "ingestion is an idempotent async job; parse failure → retriable `ParseFailed`, never blocks acquisition; end-to-end budget = SM-5." State sync-vs-async explicitly. |
| F3 | **Medium** | FR-3 registration-window lifecycle (open/close, Admin-only-after-close) is unfixed — only a table exists. | Add a one-line invariant or a small registration-state note governing window open/close + post-close admin-only writes. |
| F4 | **Low** | AD-11's "reconstructable from published read alone" is enforced by convention, not mechanism — a builder could put load-bearing state on the wire. | Flag as a build-handoff review checklist item (no structural change needed). |
| F5 | **Low (note)** | Next.js 16.2.x and Go 1.26.x are aggressive version claims. | For the tech-verification lens to confirm currency; not re-checked here. |

**Bottom line:** Invariants, enforceability, FR/SM coverage, and terseness are all PASS-grade. The
spine is gated to **CONCERNS** solely on the silent operational dimension (F1) and the
un-architected SM-5 latency NFR (F2). Both are additive — closing them requires new content, not
rework of existing decisions — so a focused revision lands this at PASS.
