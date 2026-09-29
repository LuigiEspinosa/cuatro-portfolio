---
title: 'Story 3.7, placement half: put cs-tournament on the box at tournament.cuatro.dev'
type: 'feature'
created: '2026-09-29'
status: 'done'
baseline_commit: '8c16399aca63e164a255d1931bd6ebce50e9b3dd'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-3-7-merge-cs-tournament-into-apps-tournament-and-leave-vercel.md'
  - '{project-root}/ops/tracker-cutover.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** `cs-tournament` is merged and imaged (Story 3-7's merge half) but serves nowhere: its
compose service cannot be reached by the shared Caddy, its browser bundle is built without the public
Supabase values (DW-281), the Capacity Gate does not list it, and the Registry says `Complete`.

**Approach:** Make the repository ready for a by-hand placement the orchestrator runs on the box from a
runbook, recording the Operator's rulings of 2026-09-29, and release the Registry with the entry `Live`
at `https://tournament.cuatro.dev` in a separate commit that reaches `main` only after the URL serves.

## Boundaries & Constraints

**Always:**

- `tournament` joins `cs-tracker_default` with alias `tournament` and keeps `default`;
  `tournament-worker` stays on `default` only (Operator ruling: no public worker hostname).
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` reach the image as build arguments
  from `vars.*`, and the build fails naming the missing one when either is empty.
- `cs-tournament` in `placements` in the file's own form, dated 2026-09-29, one entry for both units.
- Registry: `status` `Live`, `live` `https://tournament.cuatro.dev`, `demo` `none`, `tech` checked;
  `contract_version` MINOR (1.7.0); the history in `ops/registry-schema.md` amended.
- Every pin that reads these files moves with them; no gate weakens.

**Never:** no push, no box step, no `deploy.yml` wiring (DW-275, Epic 4), no change to
`ops/tournament-identity.mjs`'s refusal, no data move, no application code change.

**Decisions** (Operator rulings of 2026-09-29, relayed by the orchestrator, and the builder's calls):

1. **Data stays in Supabase Cloud** (DW-280 option one): a declared external store, AD-10's exception,
   its offsite backup the Operator's. The worker reaches Postgres by the session pooler, since the
   direct host answers on IPv6 only and `cuatro-portfolio_default` has no IPv6.
2. **Hostname `tournament.cuatro.dev`**, declared in `live` (AD-3). DNS and WAF rules 1 and 3 already
   done at 22:03:32Z to 22:03:33Z.
3. **Two commits.** Commit A carries compose, image, gate, Caddyfile, runbook and records; commit B the
   Registry release. The runbook places from a `main` holding A, and B reaches `main` only after the
   off-box probe answers (FR-28), so the Suite Directory never links a URL that does not serve.
4. **`demo: none`**: deployed, no demo access offered; `not-deployed` would be false once placed.
5. **`tech` gains `Go`**: the placement runs the Go worker as its second deploy unit.
6. **Identity:** the export refused on the one Auth user (the admin, created 2026-07-02) holding a
   password hash, so Decision 4 of the merge spec's "no user has a password" is off by one. No data
   moves, so nothing is reset; the proof is the Operator's Steam sign-in on the placed site.
7. **The worker is unreachable from outside**, so MatchZy's upload and the admin's presigned demo
   upload cannot reach it until it has a route: filed as a DW item, not built here.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Image build | both variables set | image inlines both; `/api/health` 200; pushed | none |
| Image build | either variable empty | build fails before `next build`, naming it | nothing pushed |
| Compose | `HUB_TAG`, `TOURNAMENT_TAG` set | `config` parses; `tournament` on both networks, worker on `default` | none |
| Gate | `cs-tournament` | incumbent, exit 0 | none |

</frozen-after-approval>

## Code Map

- `docker-compose.yml` tournament services; `docker/__tests__/compose.test.ts` `the tournament services`
  (the tracker's network case is the model).
- `apps/tournament/Dockerfile` builder stage; `.github/workflows/image-tournament.yml` job `tournament`
  Build step; `docker/__tests__/tournament-image.test.ts`. Model: `apps/hub/Dockerfile` ARG/ENV and
  `image.yml`'s `--build-arg NAME` form.
- `ops/capacity-gate.yml` `placements`; `ops/__tests__/capacity-gate.test.ts` (placements pin, and the
  new-id probe `cs-tournament`, which moves to the still unplaced `cuatro-finance`).
- `docker/Caddyfile`: the tournament block after `analytics.cuatro.dev`, the house header set.
- `contracts/registry.json` `cs-tournament`; `ops/registry-schema.md` `contract_version` row;
  `ops/__tests__/registry-schema.test.ts` version pin; `registry-verification.test.ts` probe counts; Hub
  tests that name `cs-tournament` as the committed `Complete` entry.
- New `ops/tournament-placement.md`, in `ops/tracker-cutover.md`'s shape.
- Records: `ops/estate.md` (§ `cs-tournament`, the table row, the placement list), `ops/bot-mitigation.md`
  (rules table, AD-17b line), `ops/routing-inventory.md` (zone table, site blocks, shared network),
  `deferred-work.md` (DW-275, 278, 280, 281, a new item for Decision 7), the merge spec's Verification.

## Tasks & Acceptance

**Execution:**

- [x] `docker-compose.yml`, `compose.test.ts`: networks and pins; Caddy reaches `tournament:3000`.
- [x] `apps/tournament/Dockerfile`, `image-tournament.yml`, `tournament-image.test.ts`: build args and the empty check; DW-281.
- [x] `ops/capacity-gate.yml`, `capacity-gate.test.ts`: placement entry, probe id moved; AD-9.
- [x] `docker/Caddyfile`: tournament block; mirror of the box file.
- [x] `ops/tournament-placement.md`: the runbook with rollback and Pending Operator actions.
- [x] Records listed in the Code Map: dated facts and rulings.
- [x] Commit B: `contracts/registry.json`, `ops/registry-schema.md`, pins: Registry 1.7.0, then held
  back on `dev` by `6d72963` (Spec Change Log), released by its revert.

**Acceptance Criteria:**

- Given commit A alone, when the suite, typecheck, build and gates run, then all pass and the Registry
  still reads `Complete` 1.6.0.
- Given commit B, when `node ops/registry-schema.mjs` runs, then it validates 1.7.0 with the entry `Live`.
- Given the runbook, when the orchestrator follows it, then every box step, probe, reading and the
  rollback is named, with commit B's merge after the probe.

## Implementation Notes

- Commit A `93949e6` holds everything but the Registry; commit B `9099973` is Registry 1.7.0 and the pins
  that read it (`registry-schema.test.ts`, `registry-verification.test.ts` at 41 checks and 44 requests,
  `ops/registry-verification.md`, three stale `SuiteDirectory.test.tsx` comments). Each commit was
  verified on its own tree (Verification).
- The gate's new-id probe in `capacity-gate.test.ts` moved from `cs-tournament` to `cuatro-finance`,
  the one merged application still unplaced. `node ops/capacity-gate.mjs cs-tournament` was run before
  the entry was appended and answered the open-gate line, "cs-tournament may be placed", exit 0.
- `demo` went to `none` per Decision 4. The merged source serves read-only viewer pages
  (`app/(viewer)/`) with the anon client, which reads as `open` under the schema's wording; that is the
  Operator's call, raised as an Operator item, since changing it edits this spec's frozen block.
- The Dockerfile refuses an empty value with one `RUN test -n` per variable, before the `ENV` that
  inlines it and the build, so the error names the variable. The browser bundle carries both (one
  static chunk each in the local build).
- Records: DW-275 widened, DW-278 settled (done), DW-280 and DW-281 closed (done), DW-287 (worker
  route), DW-288 (readiness probe) and DW-289 (stale `AGENTS.md`) filed. DW-286 stays open: its owner
  is the next story editing `ops/estate.md`, and this run's orchestration limits the scope to the
  `cs-tournament` records.

## Spec Change Log

- 2026-09-29, after verification (finding 21 below): commits `2053c87` and `28bc579` landed after B, so
  "A reaches `main` first" could not be pushed without rewriting history, and pushing `dev` whole put
  1.7.0 on origin before the URL served. `6d72963` restores B's six files as A left them, so `dev`
  carries A, the records and the fixes with the Registry at 1.6.0 and pushes whole; commit B's release
  becomes `git revert 6d72963` (runbook step 10), which reproduces B plus `28bc579`'s count fix.
  Decision 3's intent (the Registry reaches `main` only after the probe) holds unchanged.

## Review Triage Log

No subagents in this run: all six layers ran inline in the builder's session over the diff since
`8c16399` (79.9 kB, `_bmad-output/` excluded). Blind Hunter floor: sqrt(79.9) is 8.9, plus 1, floor 9.
One pass, no loopback; `review_loop_iteration` stays 0.

| # | Layer | Finding | Verdict | Route |
|---|---|---|---|---|
| 1 | Blind Hunter | The runbook's rollback never removes `cs-tournament` from `placements`, so an abandoned placement leaves an incumbent that any later attempt passes the gate as (AD-9) | medium: real, `evaluate` passes any listed id | patch: the rollback names the removal |
| 2 | Blind Hunter | The gate entry says `observed: 2026-09-29` and "serving" before anything serves | low: the date is the orchestrator's instruction and the placement is the same evening; the runbook moves the date if it runs later | rejected; runbook § After the placement holds it |
| 3 | Blind Hunter | `docker/Caddyfile`'s header names only `anchor-app` and `anchor-umami` as aliases | low: a direct correction | patch |
| 4 | Blind Hunter | `apps/tournament/README.md` says both images are placed nowhere | low: a direct correction | patch |
| 5 | Blind Hunter | `AGENTS.md` says "two images in CI, neither placed" | low: real once placed; an agent-context file | defer: DW-289 |
| 6 | Blind Hunter | The workflow header's rewrap left a line past the file's width | low: cosmetic, a direct correction | patch |
| 7 | Blind Hunter | The build-time public values (repository variables) and the runtime `TOURNAMENT_SUPABASE_*` values could name different Supabase projects, and nothing compares them | low: only by an Operator mistake, and the fix is a new cross-check | rejected |
| 8 | Blind Hunter | Joining `cs-tracker_default` lets the server reach every container on it | false as new exposure: every placed Anchor service does, and it is the ingress pattern `ops/routing-inventory.md` records | rejected |
| 9 | Blind Hunter | `registry-verification.yml` runs on a push touching the Registry, so pushing commit B before the URL serves turns that run red | low: real | patch: runbook step 10 says push A alone until step 6 answers |
| 10 | Edge Case | `test -n` passes a whitespace-only value | low: a repository variable of spaces is not a realistic state, and the guard would add a branch | rejected |
| 11 | Edge Case, claims | Decision 4's `demo: none` against public read-only viewer pages, which the schema calls `open` | maybe-false: `none` is the value `ops/registry-inputs.md` held before Vercel left; which one FR-27 wants here is a ruling | rejected (the fix edits the frozen spec); Operator item |
| 12 | Verification Gap | The empty-value refusal is held by source text in `tournament-image.test.ts`, which the layer's evidence rules do not count as execution | low: CI runs the positive path on every push; the negative path ran here (Verification) | rejected; the repository verifies Dockerfiles this way |
| 13 | Verification Gap | The compose networks are held by source text; the consumer (the box's Caddy) is outside the repository | low: `docker compose config` resolved both networks here, and runbook step 4 probes from the ingress | rejected |
| 14 | Ponytail | The worker's explicit `networks: default:` is what compose does implicitly | false as waste: it states the ruling, and the suite pins it so a later shared-network alias fails loudly. Otherwise "Lean already. Ship." | rejected |
| 15 | ECC verification loop | Build, types and the full suite pass on each commit; lint N/A (no lint command, `AGENTS.md`); no secret or connection string in the diff (a scan for JWTs, `service_role`, `supabase.co` refs and URLs with credentials found none) | no defect | none |
| 16 | Design Review | No `.scss` or `.tsx` outside tests changed and no motion keyword was added | No UI surface in this diff. Design review skipped. | none |

An independent verifier then read the committed placement half (`93949e6`, `9099973`, `2053c87`) and
returned four findings, all patched in one follow-up commit:

| # | Layer | Finding | Verdict | Route |
|---|---|---|---|---|
| 17 | Verifier | Runbook step 2 runs `node ops/capacity-gate.mjs` on the box, which has no `node` (`ops/backup-digital-library.md`, observed 2026-08-24), so the placement stops there | blocking: real | patch: step 2 runs from a workstation checkout at the box's sha |
| 18 | Verifier | With `cs-tournament` already in `placements`, step 2's gate run exits 0 whatever `status` says, so the runbook never checks "fails unless `status: open`" | minor: real; the pre-append run above is the AC's evidence | patch: step 2 also asserts `grep -x 'status: open'`. The note keeps "serving": the suite pins every placed id's note to end with its Registry host, and row 2 above holds the date |
| 19 | Verifier | `ops/registry-verification.md`'s expected-count row kept 40 checks and 7 `live` in its value cell under the 1.7.0 amendment | minor: real | patch: the cell reads 41 and 8 (5 by 2xx), the amendment names the old value |
| 20 | Verifier | `ops/estate.md` called the four public GHCR packages "the four merged applications'" | minor: four packages of three merged applications | patch |

A second verifier pass over those commits returned four minor findings:

| # | Layer | Finding | Verdict | Route |
|---|---|---|---|---|
| 21 | Verifier | The records and fix commits sit after B, so step 10's `git push origin <A sha>:dev` left the spec, the sprint-status row and the corrected step 2 local, and `main` would carry the old step 2; pushing `dev` whole put 1.7.0 on origin before the URL served | minor: real | patch: `6d72963` holds the Registry back; step 10 releases by reverting it (Spec Change Log) |
| 22 | Verifier | The rollback restores the Caddyfile backup without saying `cp`; the file is a single-file read-only bind mount, so `mv` leaves Caddy reading the old inode | minor: real | patch: the rollback names `cp`, never `mv`, and why; step 5's failed-validate path points at it |
| 23 | Verifier | `demo: none` against public viewer pages (row 11) | not a defect in this diff | rejected: already the Operator's item |
| 24 | Verifier | The `placements` entry and its "serving" note precede the placement (rows 1, 2) | minor: mitigated by the rollback's removal and the date-move rule | rejected: moving it would reopen the gate pins A settled, for a record the runbook already corrects |

## Design Notes

**Oversized, kept.** The draft measured about 1,902 tokens (7,608 characters over four; 997 words) against the SCOPE STANDARD's 1600. Answer **Keep**, relayed by the
orchestrating workflow on 2026-09-29 as the Operator's instruction of 2026-09-29 to finish Epic 3.

**Multi-goal check:** one goal, the placement; each file is a facet of it. **Checkpoint 1:** no human present; the builder reviewed the spec against the READY FOR DEVELOPMENT standard and approved it, per the orchestrator's standing answer.

**Open Questions, answered from the facts and records.** Decisions 1 and 2 are the Operator's rulings
of 2026-09-29; 3 to 7 answer gaps from FR-28, the Registry schema's `demo` enum, the merged source
(`lib/ingest.ts`: the browser uploads through a worker-minted presigned URL) and `tracker-cutover.md`.

## Verification

**Commands** (observed 2026-09-29 on this host):

- Commit A alone (`93949e6`, the Registry at 1.6.0): `corepack pnpm typecheck` exit 0;
  `corepack pnpm test --run` "Test Files  71 passed (71)", "Tests  1761 passed (1761)", exit 0;
  `corepack pnpm --filter hub build` exit 0 ("Compiled successfully"); `node ops/registry-schema.mjs`
  "16 applications, valid", exit 0; `node ops/contract-purity.mjs` "11 files, none executable and no
  link", exit 0.
- Commit B (`9099973`, Registry 1.7.0): the same five, the same totals, each exit 0.
- `dev` at the findings 21 and 22 patch (Registry 1.6.0 after `6d72963`): typecheck exit 0; the suite "Test
  Files  71 passed (71)", "Tests  1761 passed (1761)", exit 0; the Hub build exit 0; `registry-schema`
  "16 applications, valid" and `contract-purity` exit 0.
- `HUB_TAG=abc TOURNAMENT_TAG=def docker compose --profile tournament config`: exit 0; services
  `anchor-app anchor-db anchor-umami tournament tournament-worker`; resolved networks: `tournament`
  `{"cs-tracker_default":{"aliases":["tournament"]},"default":null}`, `tournament-worker`
  `{"default":null}`.
- actionlint 1.7.7 (the `rhysd/actionlint` image) over `.github/workflows`: exit 0, no output.
- `docker build --file apps/tournament/Dockerfile .` without the arguments: "NEXT_PUBLIC_SUPABASE_URL is
  empty: pass it with --build-arg (DW-281)", exit 1, before the build step. With both set to
  placeholders: exit 0, 384 MB; `/api/health` answered `{"status":"ok"}`, the in-container probe exit 0,
  and each placeholder appears in one file under `.next/static`.
- `caddy adapt` (`caddy:2`) on `docker/Caddyfile`: exit 0; `caddy fmt` differs from the file only in
  whitespace on lines 40 to 50, which predate this change.
- `node ops/capacity-gate.mjs cs-tournament` before the entry: "status is open against a threshold of
  load15 0.60 ... cs-tournament may be placed", exit 0; after it: "cs-tournament is in placements, the
  deploy may proceed", exit 0.

**Not verifiable here:** everything on the box and at the edge, which is `ops/tournament-placement.md`:
the containers on the real networks, the site block in the shared Caddyfile, the off-box probes, the
load reading (SM-C4) and the Operator's Steam sign-in.
