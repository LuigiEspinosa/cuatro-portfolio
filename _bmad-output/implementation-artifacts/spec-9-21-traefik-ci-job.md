---
title: 'Story 9-21: add a CI job that starts Traefik against ops/traefik and probes each router'
type: 'feature'
created: '2026-10-18'
status: 'in-review'
route: 'oneshot'
review_loop_iteration: 0
baseline_commit: 'd413780c9f609250f4463b1e6d504324718471b6'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-9-plan-2026-10-18.md'
  - '{project-root}/_bmad-output/implementation-artifacts/dw-triage-2026-10-18.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The box's Traefik watches `ops/traefik/dynamic/` in the checkout every deploy resets to `main`, and no CI job starts Traefik, so a routing file Traefik rejects, or one that routes a hostname to the wrong upstream, passes every gate and goes live at the next deploy (DW-299). The only proof was one local rehearsal on 2026-09-30.

**Approach:** Add a blocking `traefik-routes` job to `ci.yml` that runs `ops/traefik-routes.sh`: the committed `ops/traefik/compose.yml` service with the committed `traefik.yml` and `dynamic/`, against whoami stand-ins on a scratch internal network, every router probed in both branches of the dashboard template and compared with expected answers. Move both job-name pins, put the job's wiring cases beside its script, and prove a planted bad `dynamic/` file fails it locally. Whether it joins `main`'s required checks is the Operator's ruling.

</frozen-after-approval>

## Implementation Notes

- Implemented directly in this session at `5caf14ddc20c77c24ffa6625eb5993512a9b1a3e`: this workflow sub-agent has no agent tool, so no implementation or reviewer subagent could be launched. Epic 9 has no `epic-9-context.md`; the plan and the triage are the context, as in 9-18.
- `ops/traefik-routes.sh` follows `ops/provider-swap.sh`'s shape (scratch internal network, compose override, `trap cleanup`, `host_path` for Git Bash). The override only unpublishes the ports (`!reset []`), swaps the `.env` for a scratch one, binds a throwaway self-signed pair over `/etc/traefik/origin-ca`, and renames the external `cs-tracker_default` network to the scratch one; image, `traefik.yml` and `dynamic/` are what the box mounts. Probes run from one `curlimages/curl` container on the network (`--connect-to ::ingress:`), so nothing is published on the runner.
- Probed per router: status, `X-Frame-Options`, the whoami `Name:` that answered, redirect target; plus cs-tracker's `X-Forwarded-Proto` on an HTTP/1.1 upgrade (the `forwarded-proto-https` middleware; over HTTP/2 the upgrade never happens and the probe proved nothing, found by planting P3), an unknown host (404), the plain-HTTP redirect, the dashboard with and without the login, `/oauth2/`, the dashboard Host on websecure (404), and the dashboard API's `@file` router set and statuses. Run twice: `DASHBOARD_FORWARD_AUTH` unset, then `on` with a whoami stand-in at `forward-auth:4180` that admits every request.
- Internal network: the `dns01-probe` router's resolver logs one ACME error and reaches nothing; its router still serves `noop@internal` (418).
- `TRAEFIK_ROUTES_PREFIX` names everything the script creates (default `traefik-routes`), so local runs used `epic-scratch-9-21-traefik-ci-job`. whoami v1.11 and curl 8.11.1 are pinned by their manifest-list digests (checked with `docker buildx imagetools inspect`).
- The pins: `ops/__tests__/contract-purity.test.ts` and `ops/__tests__/registry-schema.test.ts` now list `traefik-routes` last, with a comment naming the wiring suite. `ops/__tests__/traefik-routes.test.ts` holds the job's wiring and ties the script to `routes.yml`: every upstream URL has a stand-in, and each branch's expected router list equals the routers that branch of the rendered template declares.
- Records: `AGENTS.md`'s DW-299 pitfall now names the job and says it is not a required check; `ops/traefik-cutover.md` § Rehearsed off the box carries a dated amendment. No new ops record.
- Not a required check on `main`: only an Operator ruling adds it (the fourteen required since 2026-10-06 are unchanged).

### Planted failures

Docker, the script itself, run as `TRAEFIK_ROUTES_PREFIX=epic-scratch-9-21-traefik-ci-job bash ops/traefik-routes.sh`, each plant restored with `git checkout -- ops/traefik/dynamic/routes.yml`:
- P1, a bad `dynamic/` file Traefik rejects (`routers: [broken` after `http:`): exit 1, every probe `404 - - -`, `-routers analytics,cs-tournament,...` / `+routers `, `-statuses enabled` / `+statuses `, `FAIL: Traefik answered differently from the expected lines above`.
- P2, `analytics` sent to `anchor-app:3000`: exit 1, `-analytics 200 DENY anchor-umami -` / `+analytics 200 DENY anchor-app -`.
- P3, `cs-tracker` loses `forwarded-proto-https`: first passed (exit 0) while the upgrade probe ran over HTTP/2; with `--http1.1` exit 1, `-cs-tracker-upgrade https` / `+cs-tracker-upgrade wss`.
- P4, a typo only inside the `on` branch (`service: forward-auht`): the off run passed, the on run exit 1, `-dashboard-oauth2 200 - forward-auth -` / `+dashboard-oauth2 404 - - -`, `-statuses enabled` / `+statuses disabled,enabled`.
- Clean tree after the plants: exit 0, `== every router answered as expected, in both dashboard branches`, about 34 s; no `epic-scratch-9-21-*` container, network or volume left.

Vitest, `corepack pnpm vitest run` on the three suites, each restored from a copy:
- A1, `run: bash ops/traefik-routes.sh || true`: `× runs the script and nothing else` (`expected [ Array(1) ] to deeply equal [ 'bash ops/traefik-routes.sh' ]`) and `× is blocking` (`not to contain '|| true'`), `Tests  2 failed | 172 passed (174)`.
- A2, `continue-on-error: true`: `× is blocking`, `not to match /continue-on-error\s*:/`.
- A3, `needs: test`: `× is blocking`, `not to match /^\s+(if|needs|env)\s*:/m`.
- A4, an extra `actions/setup-node@v7` step: `× runs the script and nothing else`, `expected [ 'actions/checkout@v7', …(1) ] to deeply equal [ 'actions/checkout@v7' ]`.
- A5, timeout removed: `× is blocking`, `to match /^\s+timeout-minutes: \d+$/m`.
- A6, `image: traefik:latest` in the override: `× starts the committed compose service and overrides none of the image, traefik.yml or dynamic/`, `not to match /image|traefik\.yml|...`.
- A7, `--internal` dropped: `× runs on an internal network`, `to contain 'docker network create --internal "$NE…'`.
- A8, `CURL` without its digest: `× pins each stand-in image by digest`, `to match /^CURL=\S+:\S+@sha256:[0-9a-f]{64}$/m`.
- A9, `tournament:3000` dropped from `STAND_INS`: `× stands in for every upstream routes.yml dials`, `expected [ 'anchor-app:3000', …(7) ] to deeply equal [ 'anchor-app:3000', …(8) ]`.
- A10, a `planted` router added to `routes.yml` with no expectation: `× expects exactly the routers routes.yml declares`, `the off branch: expected [ 'analytics', 'cs-tournament', …(9) ] to deeply equal [ …(10) ]`.
- A11, the off list expecting `dashboard-oauth2`: the same case, `the off branch: expected [ …(10) ] to deeply equal [ …(9) ]`.
- A12, the `traefik-routes` job removed from `ci.yml`: `× sits among the nine jobs the file carries, and adds no other` and `× sits after contract-purity, and adds no other job`, each `expected [ 'test', 'tokens-contract', …(6) ] to deeply equal [ …(7) ]`, `Tests  2 failed | 166 passed (168)` (the new suite fails to collect, `no job named traefik-routes in ci.yml`).

## Review Triage Log

Every layer ran inline in this session (no agent tool). The independent verifier below is the check these layers are not.

| # | Layer | Finding | Verdict | Evidence and route |
|---|---|---|---|---|
| 1 | blind | The upgrade probe proved nothing over HTTP/2 | high, patched | Found by P3; `--http1.1` added, P3 then fails as it should |
| 2 | blind | Stand-in images pulled by tag only | low, patched | Pinned by manifest-list digest, as `provider-swap.sh` pins dex; planted A8 |
| 3 | blind | The probe's field split shifted columns when `X-Frame-Options` was empty | medium, patched | `plain-http` showed its redirect in the header column on the first run; split on `|` instead of spaces |
| 4 | edge-case | A router added to `routes.yml` could go unprobed | medium, patched | The suite now derives each branch's routers from the rendered template; planted A10 |
| 5 | edge-case | The job is not a required check, so a red run can still merge to `main` | real, not this story's to change | Required checks are the Operator's ruling (plan row 21); returned to the Operator |
| 6 | edge-case | The DNS-01 resolver tries Let's Encrypt on every run | false as a defect | The network is internal, so it reaches nothing and logs one ERR line; no account is registered |
| 7 | ponytail | Two Traefik starts per run | kept | P4 shows a fault confined to the `on` branch, which the deploy never starts but the Operator's switch does |
| 8 | verification-loop | Typecheck, full root suite, wiring suites | pass | See Verification; no app workspace changed, so no per-app suite; lint N/A (AGENTS.md) |
| 9 | design | No `.scss`, `.tsx` or motion changed | n/a | Design review skipped |

## Independent verifier

pending

## Ledger closures

**DW-299:** **Closed 2026-10-18 by Story 9-21-traefik-ci-job** (`5caf14d`, `.github/workflows/ci.yml`: `traefik-routes`, `ops/traefik-routes.sh`): every push now starts `traefik:v3.7.13` from the committed `ops/traefik/compose.yml` with the committed `traefik.yml` and `dynamic/` against whoami stand-ins on a scratch internal network, and compares every router's answer (status, `X-Frame-Options`, the upstream that answered, redirect target, cs-tracker's forwarded scheme on an upgrade, the loaded routers and their statuses) with expected lines, with `DASHBOARD_FORWARD_AUTH` unset and `on`. A file Traefik rejects, a misrouted upstream, a dropped middleware and a typo inside the `on` branch each failed it locally. Both job-name pins moved; `ops/__tests__/traefik-routes.test.ts` fails a router or upstream the script does not name. The job is blocking but is not one of `main`'s required checks until the Operator rules it in.

Action items: none named for this story.

## Verification

**Commands** (observed 2026-10-18 on this host, the tree at `5caf14d` before the spec commit):
- `TRAEFIK_ROUTES_PREFIX=epic-scratch-9-21-traefik-ci-job bash ops/traefik-routes.sh`: exit 0, `== every router answered as expected, in both dashboard branches` (Docker 29.8.2, Compose 5.6.0).
- `corepack pnpm vitest run ops/__tests__/traefik-routes.test.ts`: `Tests  7 passed (7)`.
- `corepack pnpm vitest run` over `traefik-routes`, `contract-purity`, `registry-schema`, `workflow-hardening`: `Tests  221 passed (221)`.
- `corepack pnpm typecheck`: exit 0.
- `corepack pnpm test -- --run`: `Test Files  6 failed | 82 passed (88)`, `Tests  10 failed | 2031 passed | 4 skipped (2045)`, all ten in the WSL-bash suites `demo-reset`, `deploy-remote`, `library-backup`, `postgres-backup`, `tournament-backup`, `tracker-backup` (DW-135). Re-run alone: `Test Files  6 passed (6)`, `Tests  170 passed | 1 skipped (171)`. After the record edits, `ops/__tests__` and `apps/hub` again: 3 WSL-bash failures, re-run alone `Tests  114 passed | 1 skipped (115)`.
- The job's first CI run is not observed: nothing is pushed from this worktree.
