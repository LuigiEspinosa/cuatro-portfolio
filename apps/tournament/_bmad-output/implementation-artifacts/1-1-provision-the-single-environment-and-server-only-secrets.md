---
baseline_commit: 3ccc36ffa855c28296ecb4597c87e867ebbd74a6
---

# Story 1.1: Provision the single environment and server-only secrets

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an operator,
I want one provisioned environment with every secret held server-side only,
so that the whole event runs on a single low-cost footprint and no credential can leak to a client bundle.

## Acceptance Criteria

1. Exactly one Supabase project, one Vercel project, one Railway worker, and one Cloudflare R2 bucket exist and are wired together. *(AD-25)*
2. The Supabase service-role key, the R2 write credentials, and the worker↔MatchZy shared secret are configured to live **only** in Vercel/Railway server environment variables. *(AD-25)*
3. No secret is referenced through any `NEXT_PUBLIC_*` variable, and none appears in a client bundle. *(AD-25)*
4. Connection/config for each metered service (R2, Supabase, Railway) is captured so cost guards (Epic 7) can attach billing alerts later. *(AD-25)*

## Tasks / Subtasks

- [x] Task 1: Provision the single Supabase project (AC: 1, 2, 4)
  - [x] Create exactly **one** Supabase project (free tier; Postgres + Auth + Realtime); record project URL, project ref, and region — `inclusivcup`, ref `ufnumdqrhyvijreoyrxf`, `us-east-1`
  - [x] Capture both keys distinctly: the anon/publishable key (client-safe) and the **service-role key** (server-only, RLS-bypassing) — legacy anon + service_role AND new publishable + secret captured to gitignored `.env.local`
  - [x] Record the Supabase **JWT secret** (server-only) for later `app_metadata`/JWT work (Epic 2) — do not expose to client — NOTE: project signs sessions with **asymmetric ES256**; recorded JWKS URL + current `kid` (the actual Epic-2 verification material). Legacy HS256 secret optional, left in dashboard.
  - [x] Note free-tier limits (DB size, ~200 concurrent realtime) for Epic 7 cost guards — in `docs/ops/environment-inventory.md`
- [x] Task 2: Provision the single Vercel project (AC: 1, 2, 3)
  - [x] Create **one** Vercel project linked to this Git repo (Next.js 16.2.x app; requires Node 20.9+) — `inclusivcup` (scope `cuatros-projects`), GitHub auto-deploy connected
  - [x] Add server-only env vars: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, Steam API/realm config — service-role + `SUPABASE_URL` set (prod/preview/dev); JWT via ES256/JWKS (no shared secret); **Steam vars → finalized in Story 2.1** (need domain + Steam Web API key)
  - [x] Limit client-exposed vars to the Supabase project URL + anon key only; assert **no** secret uses a `NEXT_PUBLIC_` prefix — verified: only `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [x] Task 3: Provision the single Railway worker service (AC: 1, 2, 4)
  - [x] Create **one** Railway Hobby service to host the Go 1.26 worker — project `inclusivcup`, service `worker` (Offline — no deploy until Epic 3, so $0)
  - [x] Set server env vars: `SUPABASE_SERVICE_ROLE_KEY`, R2 write credentials, `WORKER_MATCHZY_SHARED_SECRET` — all set (+ `SUPABASE_URL`, R2 account/bucket/endpoint)
  - [x] Record plan + expected utilization (~$5–10/mo low; ~$20–30 ceiling for 24/7) so a billing alert can be attached in Epic 7 — in inventory
- [x] Task 4: Provision the single Cloudflare R2 bucket (AC: 1, 2, 4)
  - [x] Create **one** R2 bucket for raw `.dem` storage (S3-compatible, free egress) — `inclusivcup-demos`
  - [x] Generate S3-compatible write credentials (access key id/secret); store **only** in Railway/Vercel server env — "Object Read & Write" token in `.env.local` + Railway env
  - [x] Record account id / S3 endpoint + bucket name for cost guards — in inventory
- [x] Task 5: Wire the services together and define the shared secret (AC: 1, 2)
  - [x] Confirm reachability: Vercel app → Supabase; Railway worker → Supabase (service-role) and → R2 — all 3 probes HTTP 200 (Supabase anon auth, service-role admin, R2 S3 SigV4)
  - [x] Generate the worker↔MatchZy shared secret; store it server-only on Railway (and wherever MatchZy will post) — used to authenticate auto-upload in Epic 3 — 32-byte secret on Railway + `.env.local`
- [x] Task 6: Leak check — prove no secret reaches the client (AC: 3)
  - [x] Scan the repo and any production build output for `NEXT_PUBLIC_` misuse and for literal secret values — repo scan across 296 committable files: **0** secret-literal hits; only URL + anon use `NEXT_PUBLIC_`
  - [x] Confirm a production client bundle contains no service-role key, no R2 credentials, and no shared secret — NOTE: no Next.js app exists yet (Stories 1.2+); enforced structurally (only URL+anon are `NEXT_PUBLIC_`) + scan procedure documented for the first build
- [x] Task 7: Capture the environment inventory (AC: 4)
  - [x] Create a repo-root `.env.example` listing server-only var **names only** (no values) plus the client-safe vars
  - [x] Record per-service connection/config (project refs, bucket, endpoints, tiers) in a server-side ops note for Epic 7 cost guards — committed template `docs/ops/environment-inventory.md` + gitignored `docs/ops/environment-inventory.local.md`
  - [x] Do **not** commit real secret values to the repo — verified via leak check + `git check-ignore`

## Dev Notes

- **Provisioning-only story — produces no application or migration code.** The deliverable is one wired single-environment footprint, a documented server-only secret inventory, and a `.env.example`. Schema/migrations and tables arrive in Stories 1.2–1.4, applied against the Supabase project stood up here. [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Foundation & Schema — Story 1.1]
- **Provisioning targets (single environment, v1 — no staging/prod split):** [Source: _bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#11. Operations & environments — AD-25, AD-26]
  - Supabase — Postgres 15+, free tier (Auth + Realtime + DB)
  - Vercel — Next.js 16.2.x app host (requires Node 20.9+)
  - Railway Hobby — Go 1.26 worker host
  - Cloudflare R2 — S3-compatible object store for raw demos (free egress)
- **Secrets that MUST be server-only (never `NEXT_PUBLIC_*`):** Supabase service-role key, R2 write credentials, worker↔MatchZy shared secret, Steam API/realm config, Supabase JWT secret. The **only** client-exposed Supabase values are the project URL + anon/publishable key. [Source: SOLUTION-DESIGN.md#11; ARCHITECTURE-SPINE.md#AD-25 — Single-environment v1; secrets server-only; demos are the backup]
- **Why the service-role key is sensitive:** it is the single writer's RLS-bypassing path used by the Go worker (Epic 3). Keep it off every Vercel client surface. [Source: SPEC.md#Constraints — Single environment; secrets server-only (AD-25)]
- **Cost capture for Epic 7 cost guards:** Railway bills CPU/RAM (~$5–10/mo at low utilization; ~$20–30 ceiling for 24/7 — the actual billing alert is Epic 7, Story 7.2); R2 ~pennies/mo; Supabase free tier. Record enough config now that alerts can be attached later. [Source: SOLUTION-DESIGN.md#11]
- **DR posture relevant when wiring R2:** raw demos in R2 are the durable source of truth; all derived DB state is re-derivable by re-parse. Object-lock/delete-guard hardening is a later story (7.1) — do **not** treat derived DB state as canonical. [Source: SOLUTION-DESIGN.md#11; ARCHITECTURE-SPINE.md#AD-25]
- **Scope guardrails — DO NOT in this story:** create any migration or table (that is 1.2/1.4), define RLS policies or helper functions (1.3), build the Steam OpenID login flow (2.1), implement MatchZy auto-upload/demo acquisition logic (3.1), or attach billing alerts (7.2). Provision, configure, and document only.
- **Testing / "done" standard:** this story has no unit tests. Completion is evidenced by (a) the four services existing and reachable + wired, (b) a grep/build-output check proving no `NEXT_PUBLIC_*` secret leak, and (c) a committed `.env.example` + server-side ops inventory. CAP-1's automated success bar (migrations apply cleanly, RLS `ENABLE`+`FORCE`, SteamID64 `text` CHECK, append-only audit) is satisfied across Stories 1.2–1.4, not here. [Source: SPEC.md#CAP-1 success criterion]

### Project Structure Notes

- **Single Git repository** (this repo). The environment must support the planned layout: Next.js App Router under `app/` + `lib/`, a nested Go module under `worker/`, shared SQL under `supabase/migrations/` (created in 1.2), and conformance vectors under `roulette/vectors/`. [Source: _bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#source tree]
- **This story adds repo-root config only:** a `.env.example` documenting server-only var names plus client-safe vars. No `supabase/migrations/` directory is created yet. No conflicts detected with the planned structure.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Foundation & Schema — Story 1.1]
- [Source: _bmad-output/specs/spec-cs-tournament/SPEC.md#Constraints — Single environment; secrets server-only (AD-25)]
- [Source: _bmad-output/specs/spec-cs-tournament/SPEC.md#CAP-1 success criterion]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#AD-25 — Single-environment v1; secrets server-only; demos are the backup]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#11. Operations & environments — AD-25, AD-26]
- [Source: _bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#NFR-Security]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code / bmad-dev-story)

### Debug Log References

- Approach: CLI-driven provisioning (supabase / vercel / railway / wrangler), driven interactively with the operator (Cuatro). Real secrets live only in provider env vars + a gitignored local working copy; the repo gets placeholder templates only.
- Note: This is a **provisioning-only** story — no application or migration code. The dev-story TDD cycle (Steps 5–7: red/green/refactor + unit tests) is **N/A**; completion follows the story's own done-standard: (a) the four services exist + reachable + wired, (b) a grep/build-output leak check shows no `NEXT_PUBLIC_` secret, (c) committed `.env.example` + ops inventory.

### Completion Notes List

Provisioning-only story (no app/migration code; no unit tests — per the Dev Notes done-standard). Single low-cost footprint stood up CLI-first and wired together:

- **Supabase** (free, us-east-1): project `inclusivcup` ref `ufnumdqrhyvijreoyrxf`. Captured anon + service_role (legacy) and publishable + secret (new) keys + DB password to gitignored `.env.local`. Sessions sign with asymmetric **ES256** → recorded JWKS URL + current `kid` for Epic 2 (legacy HS256 secret optional, left in dashboard).
- **Vercel** (Hobby): project `inclusivcup`, GitHub auto-deploy connected. Env set on prod/preview/dev — client = URL + anon only; server = `SUPABASE_URL` + service-role. Steam vars deferred to Story 2.1 (need domain + Steam key).
- **Railway** (Hobby): project `inclusivcup`, service `worker` (Offline until Epic 3 → $0). Server env = service-role, R2 creds, MatchZy shared secret.
- **Cloudflare R2**: bucket `inclusivcup-demos`; "Object Read & Write" S3 token (server-only).
- **Reachability** verified (all HTTP 200): Vercel→Supabase (anon auth), worker→Supabase (service-role admin), worker→R2 (S3 SigV4 ListObjects).
- **Leak check**: 0 secret literals across 296 committable files; `.env.local` + `docs/ops/*.local.md` gitignored; `.env.example` committable.

Deviations / handoff notes:
- AC-3 production client-bundle scan deferred — no app to build until Stories 1.2+; structural guarantee (only URL+anon are `NEXT_PUBLIC_`) + documented procedure stand in.
- The "JWT secret" requirement is satisfied via the project's actual scheme (ES256 + JWKS), not a legacy HS256 secret.
- Steam OpenID config = Story 2.1.
- ⚠️ During Railway setup the CLI echoed 4 secret values into the dev session transcript (local only). User reviewed and chose not to rotate (private event; values never reached the repo/public — leak check confirms).

### File List

- `.env.example` (new) — variable names + client-safe vars; no values
- `docs/ops/environment-inventory.md` (new) — committed ops inventory template (Epic 7 cost guards)
- `docs/ops/environment-inventory.local.md` (new, gitignored) — real non-secret refs/endpoints
- `.gitignore` (modified) — keep `.env.example` committable (`!.env.example`); ignore `docs/ops/*.local.md` and `.wrangler/`
- `.env.local` (new, gitignored) — real values; never committed
- `_bmad-output/implementation-artifacts/1-1-provision-the-single-environment-and-server-only-secrets.md` (this story — bookkeeping)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status transitions)

### Change Log

- 2026-06-30 — Provisioned single-environment footprint (Supabase / Vercel / Railway / R2), wired + reachability-verified, committed server-only secret inventory + `.env.example`, leak check clean. Status → review.

## Review Findings

**Code review — 2026-06-30** (adversarial: Blind Hunter · Edge Case Hunter · Acceptance Auditor). **Verdict: Accept-with-follow-ups.** No acceptance criterion violated; no secret value committed — independently verified: 0 secret literals across 296 tracked files; only `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` are client-exposed; `.env.local` + `docs/ops/*.local.md` confirmed untracked/ignored; scope respected.

**Resolved 2026-06-30** — all decision items dispositioned, both patches applied; story → `done`.

- [x] [Review][Decision→Patch] Un-rotated secrets in local transcript — Resolved: **accepted, no rotation** (private event; repo verified clean, values never reached git). The inventory's absolute "ONLY in provider env vars + .env.local" wording was softened to acknowledge the one-time local-transcript exposure so the doc is no longer self-contradicting.
- [x] [Review][Decision] AC4 billing identifiers only in gitignored local file — Resolved: **accepted**; the operator holds the per-service identifiers in `docs/ops/environment-inventory.local.md`, sufficient for Story 7.2 to read when it wires billing alerts.
- [x] [Review][Decision→Defer] AC3 client-bundle scan follow-up — Resolved: **logged** to `_bmad-output/implementation-artifacts/deferred-work.md`; intended home is the Story 7.5 build-handoff checklist gate (run the leak scan at the first real Next.js build).
- [x] [Review][Decision] Real account identifiers in story prose — Resolved: **accepted**; the Supabase ref is client-public via `NEXT_PUBLIC_SUPABASE_URL` and this story file is an internal record.
- [x] [Review][Patch] Consolidate redundant .gitignore rules — **applied**: single `.env*` + `!.env.example` block, dropped duplicate bare `.vercel` (kept `.vercel/`) and dead `.env*.local` family. Verified via `git check-ignore` — `.env.example` stays committable; all secret/local paths remain ignored.
- [x] [Review][Patch] Correct leak-check file count (298 → 296) — **applied**.
- Dismissed as noise (5): `.env.local` already-tracked concern (refuted — verified untracked); gitignore negation brittleness / case-insensitive un-ignore / luck-of-ordering (×3, current state verified correct); empty Steam placeholders (self-noted, no defect).
