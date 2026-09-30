---
title: 'Story 4-6: Migrate cuatro.dev (and www) onto Traefik'
type: 'feature'
created: '2026-09-30'
status: 'awaiting-operator'
baseline_commit: '585a4d02335e981f17449e2713b7806355885bee'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
  - '{project-root}/ops/traefik-cutover.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** `cuatro.dev` and `www.cuatro.dev` still reach the Hub through the shared Caddy. Story 4-2 put Traefik beside it with routers for both, but nothing yet says how the flagship moves, whether the Hub's `docker-rollout` deploy keeps serving when Traefik's file provider names the `anchor-app` alias, or how to take the move back.

**Approach:** The Hub owns no store, so this is a routing move with no data step. Confirm the committed routers (apex, www 301, `contracts/` served by the Hub through the apex router, never by Traefik, per the 2026-09-24 ruling), prove locally that a rollout-shaped scale to two containers under the alias keeps curls through Traefik answering, pin the alias invariant in the Traefik suite, and write the per-hostname runbook section for the Operator. No application or compose change.

## Boundaries & Constraints

**Always:** each hostname moves by its own Origin Rule and rolls back by deleting it (`ops/traefik-cutover.md` § Moving a hostname); a load reading at each step; the Story 1.2 monitors read before and after; every claim of proof quotes real output.

**Never:** write to the box or the Cloudflare zone in this run; a `PathPrefix` or a Traefik-served `contracts/`; a change to `docker-compose.yml`, `ops/deploy-remote.sh` or any `apps/*` the move does not need; a step that stops Caddy or removes its site blocks (Story 4.11).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Apex through Traefik | `https://cuatro.dev/`, `/api/health`, `/contracts/tokens.css` via 8443 | 200, 200 with `"status":"ok"`, 200 `text/css` | a non-200 stops the step; delete the rule |
| www | `https://www.cuatro.dev/<path>?<q>` | 301 to `https://cuatro.dev/<path>?<q>`, no port | same |
| Rollout under the alias | `docker rollout anchor-app` while curls run through Traefik | every request answers 200 | a non-200 during the deploy is a finding; delete the apex rule |
| Rollback | the apex or www rule deleted | the hostname is back on Caddy, which never lost its block | none needed |

</frozen-after-approval>

## Code Map

- `ops/traefik/dynamic/routes.yml`: routers `cuatro-portfolio` (Host `cuatro.dev`, house headers, service `http://anchor-app:3000`) and `www` (`www-to-apex` redirectRegex, permanent). Already correct against Caddy's blocks (`docker/Caddyfile`, `ops/routing-inventory.md` § The site blocks). No change.
- `docker-compose.yml` `anchor-app`: joins `cs-tracker_default` with alias `anchor-app`, no `container_name`, no ports, healthcheck on `/api/health`. docker-rollout names containers `cuatro-portfolio-anchor-app-<n>` (the box runs `-4`), so only the alias is stable. No change.
- `ops/deploy-remote.sh`: `docker rollout --env-file .env.production --timeout 120 anchor-app`, v0.14, sha256 pinned: scale to 2, wait healthy, stop and remove the old. No change.
- `ops/__tests__/traefik-config.test.ts`: reads the files as indented text; add one case here.
- `ops/traefik-cutover.md`: owns the move mechanism (§ Moving a hostname, and moving it back) and the rollback; gains the Hub's section.
- `ops/monitoring.md`: monitors 803749849 (root), 803756371 (`/api/health` keyword), 803756083 (www 301).

## Tasks & Acceptance

**Execution:**
- [x] `ops/__tests__//traefik-config.test.ts`: one case: the apex service's upstream host is an alias `anchor-app` declares on `cs-tracker_default` in `docker-compose.yml`, not a container name, and no router rule names `/contracts`; the alias is what makes a rollout invisible to Traefik, and the ruling keeps `contracts/` on the Hub.
- [x] `ops/traefik-cutover.md`: a section `Moving cuatro.dev and www (Story 4-6)`: preconditions, the local rollout proof, the sequence (www rule, apex rule, a CI-built deploy through Traefik, verification, the record), rollback, and its Pending Operator actions; the runbook the box half runs from.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml`: 4-6 to `awaiting-operator` with a dated comment.

**Acceptance Criteria:**
- Given the committed `ops/traefik/`, when the suite runs, then the new case passes and fails if the apex service names a container or a router names `/contracts`.
- Given a throwaway Traefik from the committed files and the real Hub image under the real `docker-compose.yml`, when `docker rollout` v0.14 rolls `anchor-app` repeatedly while curls run through Traefik, then the output quoted in Implementation Notes shows the count of each status.
- Given the runbook section, when the Operator reads it, then every box, Cloudflare and GitHub step is an exact command, and each is listed under its Pending Operator actions.

## Implementation Notes

No subagent tool in this run: implemented, and every review layer run, inline.

- **Routers checked, unchanged.** `cuatro-portfolio` and `www` in `ops/traefik/dynamic/routes.yml` match Caddy's two blocks (headers, upstream, permanent redirect keeping path and query). No router names `contracts/`.
- **Box read, 2026-09-30T13:15:14Z, read-only:** load `0.03, 0.08, 0.13`; the Hub is `cuatro-portfolio-anchor-app-4` on `hub:373e33d8...`, healthy, aliases on `cs-tracker_default` `cuatro-portfolio-anchor-app-4` and `anchor-app`; checkout at `373e33d8` with no `ops/traefik/`; 8443 count `0`. UptimeRobot 803749849, 803756371, 803756083 `UP`. Live: `https://cuatro.dev/contracts/tokens.css` carries `via: 1.1 Caddy`, which step 4 of the runbook uses to tell the proxies apart; a throwaway Traefik v3.7.13 in front of `traefik/whoami` returned no `Via` header.
- **The rollout proof** (runbook § Rehearsed off the box: a rollout under the alias): committed `ops/traefik/`, the real Hub image `373e33d8` from GHCR, a byte-identical copy of `docker-compose.yml` (sha256 `24495620...95bece0` both), docker-rollout v0.14 whose download matched the pinned sha256 `cdeaba6a...fda05b`, run as a CLI plugin in `docker:29-cli`. Through Traefik before rolling: `/` 200 `text/html`, `/api/health` 200 `application/json`, `/contracts/tokens.css` 200 `text/css`, www `301` to `https://cuatro.dev/contracts/tokens.css?q=1`. Four runs, 20 rollouts, 1,822 requests: 1,821 answered 200 and one timed out (`000` after 10 s) in run 1, after both of its rollouts had finished; not reproduced in 18 further rollouts. Recorded in the runbook as unexplained, not dropped. Everything removed afterwards; `git status --short` clean of rehearsal files.
- **Test:** one case in `ops/__tests__/traefik-config.test.ts`. Mutations: the apex upstream set to `cuatro-portfolio-anchor-app-1` failed it (`expected [ 'anchor-app' ] to include 'cuatro-portfolio-anchor-app-1'`); a `contracts` line appended to `routes.yml` failed it; both restored. A `container_name` assertion was dropped as it duplicated `docker/__tests__/compose.test.ts` and tripped on a comment.
- **Checks:** `corepack pnpm typecheck` exit 0; `corepack pnpm --filter hub build` exit 0; `corepack pnpm test --run` exit 0, `Test Files 75 passed (75)`, `Tests 1833 passed | 1 skipped (1834)`.
- **Matrix coverage.** Rows 1 to 3 by the rehearsal above and the suite's router cases; row 4 (rollback) is a Cloudflare rule deletion, not exercisable off the zone: the runbook gives its exact command, and it is the mechanism § Moving a hostname already records.
- **Epic context** was stale by mtime only (a Style Dictionary row in the spine); its content was unchanged, so it was re-validated rather than recompiled.

## Spec Change Log

## Review Triage Log

All six layers ran inline (no subagent tool). Design review: no UI surface in this diff, skipped. Ponytail: lean already, no finding. ECC verification loop: build exit 0, typecheck exit 0, tests 75 of 75 files and 1833 passed (one run lost 23 cases in the WSL-spawning suites, `deploy-remote`, `library-backup`, `postgres-backup` and `capacity-gate`, with "the scratch box could not be prepared"; the re-run passed, the DW-135 family), lint N/A (no lint command, see AGENTS.md), no secret in the diff.

| # | Layer | Finding | Verdict | Route and evidence |
|---|---|---|---|---|
| 1 | edge-case | Step 3's `PUT` ran whenever the entrypoint read gave no id, so a failed read (a token without read access) would replace the whole entrypoint and every other hostname's rule | medium | patch: the read is printed, `POST` needs `.success`, and the `PUT` is the Operator's explicit choice only on a not-found error, with the reason stated |
| 2 | edge-case | The rollback's `DELETE` ran with an empty rule id when the description did not match | low | patch: `[ -n "$RS" ] && [ -n "$ID" ]` guard and the id printed |
| 3 | edge-case | `jq -r '.result.id'` prints `null` on a failed read, and step 4 then posted to `/null/rules` | low | patch: `select(.success)` and a non-empty guard; filters checked with jq 1.8.1 on both answer shapes (`0` bytes for the failure, `abc` and `r1` for the success) |
| 4 | verification-gap | The runbook assumed `jq` in WSL; the authoring machine's WSL answered `jq: command not found` | medium | patch: the precondition names the install |
| 5 | edge-case | Step 5 read the newest `workflow_dispatch` run immediately after dispatching, which can be an earlier dispatch | low | patch: the Operator lists until the fresh run shows, then watches its id |
| 6 | blind | Run 1's one request that timed out (`000` after 10 s) is unexplained | maybe-false | defer: DW-305, unverified medium if Traefik's; settled by step 6's probe through the real edge |
| 7 | verification-gap | The rollout under the alias is proven locally, not in CI | low | rejected: a CI proof needs Docker, GHCR and docker-rollout on the runner; the new case pins the one repository-side regression (the upstream renamed to a container name), and the mutation failed it |
| 8 | blind | `not.toMatch(/contracts/)` also refuses a comment naming contracts in `routes.yml` | low | rejected: deliberate strictness, the file's only mention would be a routing one, and the fix adds a branch |
| 9 | blind | The rehearsal's re-run block leans on 4-2's setup lines and `W` | false | the text names the setup lines to take, defines `W`, and ends with the Hub's teardown beside 4-2's |

## Design Notes

- **Oversized spec, kept.** Measured at step 2 at about 1,716 tokens (6,863 bytes over four), against the 1600 target. The Operator's instruction of 2026-09-30, relayed by the orchestrator: Keep. Answer recorded here per the ruling of 2026-09-24.
- **Decision: the section goes in `ops/traefik-cutover.md`, not a new `ops/anchor-cutover.md`.** That record owns the per-hostname mechanism and its rollback, and the Hub's move adds no data step and nothing Hub-specific beyond one deploy; a new file would restate the mechanism. The Operator may overrule.
- **Decision: www moves first, then the apex.** www only answers a redirect, so it exercises Traefik under live traffic at the least cost, and its monitor asserts the 301. Two rules, not one `in {...}` rule, so each rolls back alone (8 hostnames against the Free plan's 10 rules). The Operator may overrule.
- **Decision: Story 4.4 does not bind this move.** The epic lists 4.4 as a dependency, but the Hub has no database (Umami's store is 4.7's), so `ops/postgres.md` and `ops/postgres-backup.md` need not have run. Only `ops/traefik-cutover.md` steps 1 to 8 and the Origin Rules token are preconditions. The Operator may overrule.
- **The deploy through Traefik is `gh workflow run deploy.yml --ref main`**, which builds the sha's image and rolls it (`workflow_dispatch` exists); a Markdown-only push to `main` deploys nothing.

## Verification

**Commands:**
- `corepack pnpm typecheck`: exit 0
- `corepack pnpm --filter hub build`: exit 0
- `corepack pnpm test --run`: all pass (DW-135 flakes re-run)
