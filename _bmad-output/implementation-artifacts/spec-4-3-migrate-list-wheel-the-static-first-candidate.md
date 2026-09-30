---
title: 'Story 4-3: Migrate list-wheel, the static first candidate, onto Traefik'
type: 'feature'
created: '2026-09-30'
status: 'awaiting-operator'
baseline_commit: '6dcb2bc3b11cc4b444b2dc595b757966622af337'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
  - '{project-root}/ops/traefik-cutover.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** `wheel.cuatro.dev` still reaches `list-wheel` through the shared Caddy. Story 4-2 put Traefik beside it with a `list-wheel` router, but nothing says how the hostname moves, how the move is verified or how it goes back, and KV-1's `list-wheel` half (the box compiles `list-wheel` on each deploy) is booked to this story.

**Approach:** `list-wheel` has no store and no server-side runtime, so this is a routing move with no data step. Confirm the committed router against the box's Caddy block and the container's network alias, rehearse it locally with the real `list-wheel` image behind a throwaway Traefik, pin the router in the Traefik suite, and write the move as the first hostname section of `ops/traefik-cutover.md`. State whether KV-1's `list-wheel` half closes here.

## Boundaries & Constraints

**Always:** one Origin Rule moves the hostname and deleting it moves it back; a load reading at each step; monitor 803983277 read before and after; every claim of proof quotes real output; data-loss protection holds (nothing here touches a store).

**Never:** write to the box, the zone or another repository in this run; change `list-wheel`'s deploy shape in the same step as its hostname move (AD-20, Epic 4 reading); stop Caddy or remove its `wheel.cuatro.dev` block (Story 4.11).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Shell through Traefik | `GET https://wheel.cuatro.dev/` | 200, `Cache-Control: no-cache`, the three house headers, no `via: 1.1 Caddy` | a non-200 stops the step; delete the rule |
| Unknown path | `/no/such/path` | 200 with the shell (`try_files`), as through Caddy | same |
| Hashed asset | `/main-<hash>.js` named by the shell | 200, `text/javascript` | same |
| Rollback | the rule deleted | the hostname is back on Caddy, `via: 1.1 Caddy` again | none needed |

</frozen-after-approval>

## Code Map

- `ops/traefik/dynamic/routes.yml`: router `list-wheel` (Host `wheel.cuatro.dev`, `[house-headers]`) and service `http://list-wheel:80`. Matches the box's Caddyfile block (lines 111 to 119, read 2026-09-30: the same three headers, `reverse_proxy list-wheel:80`) and the container's aliases (`list-wheel` on `cs-tracker_default`). No change.
- `ops/__tests__/traefik-config.test.ts`: reads files as indented text; the apex case (Story 4-6) is the shape to copy for one wheel case.
- `ops/routing-inventory.md` § Every hostname in the zone, the `wheel.cuatro.dev` row: alias `list-wheel`, port 80.
- `ops/traefik-cutover.md`: § Moving a hostname owns the mechanism; § Moving cuatro.dev and www (4-6) is the section shape, its `CF` helper and the guarded `PUT`.
- `ops/known-violations.md` KV-1: `Retired by, the list-wheel half` and `Retired on` cells, index row at line 66.
- `LuigiEspinosa/list-wheel` on `main` at `718f194`: `docker-compose.yml` builds (`build:`), joins `cs-tracker_default` with alias `list-wheel`, healthcheck; `ops/deploy-remote.sh:62` runs `docker compose up --build -d --remove-orphans`. Read only.
- `ops/monitoring.md`: monitor 803983277, `https://wheel.cuatro.dev`, HTTP status code.

## Tasks & Acceptance

**Execution:**
- [x] `ops/__tests__/traefik-config.test.ts`: one case: the wheel router carries the house headers and its service dials the alias and port the inventory's wheel row names, pins what the move depends on.
- [x] `ops/traefik-cutover.md`: a section `Moving wheel.cuatro.dev (Story 4-3)` before 4-6's: what serves today, what the move changes, the local rehearsal, the sequence, rollback, the record; Pending Operator actions 7 and 8.
- [x] `ops/known-violations.md`: KV-1: what is true today about the `list-wheel` half and where its closer now sits.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md`: DW-308: the `list-wheel` GHCR image and pull deploy that retires KV-1's second half.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml`: 4-3 to `awaiting-operator` with a dated comment.

**Acceptance Criteria:**
- Given the committed `ops/traefik/`, when the suite runs, then the wheel case passes, and fails if the router drops the house headers or the service names another host or port.
- Given a throwaway Traefik from the committed files and the real `list-wheel` image under alias `list-wheel`, when the I/O matrix's requests run through 8443, then the output quoted in Implementation Notes matches the matrix.
- Given the runbook section, when the Operator reads it, then every box, Cloudflare and monitor step is an exact command and each is a Pending Operator action.

## Implementation Notes

Implemented inline (the run has no Agent tool). Files: `ops/__tests__/traefik-config.test.ts` (one case),
`ops/traefik-cutover.md` (§ Moving wheel.cuatro.dev, Pending actions 7 and 8), `ops/known-violations.md`
(KV-1 index row and the `Retired by, the list-wheel half` cell, dated 2026-09-30), `deferred-work.md`
(DW-308), `sprint-status.yaml`.

**Box read, 2026-09-30T16:19:11Z, read-only:** `list-wheel-list-wheel-1 list-wheel-list-wheel Up 5 days
(healthy)`, aliases `["list-wheel-list-wheel-1","list-wheel","list-wheel"]` on `cs-tracker_default`, checkout
`718f1943bbf9a8cf15c9ee718eaa08cfe719a2b5`, Caddyfile lines 111 to 119 the block quoted in the runbook,
nothing on 8443, the forced-command line for the `list-wheel` key present (count 1), load
`0.43, 0.25, 0.20`. **UptimeRobot, same day:** 803983277 `UP`, `currentStateDuration` 16d 22h,
`successHttpResponseCodes` `2xx`, `3xx`, `httpMethodType` null.

**Local rehearsal** (the real image built from `list-wheel` `main` at `718f194`, the committed Traefik, a
`caddy:2` v2.11.4 stand-in with the box's block), quoted in the runbook: every path `200` on both sides,
identical headers, bytes and sha256 but for `via: 1.1 Caddy` on Caddy's side; `HEAD / traefik 200`;
`Traefik log errors: 0`. The runbook's re-run block was then run as written and printed the same statuses
and headers; all containers, the volume, the network, the `.env`, `offline.yml` and both images were
removed.

**Suite mutation:** with the wheel service's port changed to 8080, the new case failed
(`× sends wheel.cuatro.dev to the alias and port the inventory names, with the house headers`,
`Tests 1 failed | 20 passed (21)`); restored, `21 passed`.

**Verification, 2026-09-30:** `corepack pnpm typecheck` exit 0; `corepack pnpm --filter hub build` exit 0;
`corepack pnpm test --run`: `Test Files 4 failed | 71 passed (75)`, `Tests 7 failed | 1832 passed |
1 skipped (1840)`, the seven all around 30 s with empty output in `deploy-remote`, `library-backup`,
`postgres-backup` and `tournament-backup` (DW-135's shape, none touched here); those four files re-run:
`Test Files 4 passed (4)`, `Tests 122 passed | 1 skipped (123)`.

## Review Triage Log

Six layers, run inline (no Agent tool). Design Review: skipped, no `.scss` or `.tsx` and no motion in the
diff. Ponytail: `Lean already. Ship.` Verification gap: `No verification gaps found.` (the router is
pinned by the new case; the runbook is prose, not deterministic code). ECC verification loop: build PASS,
types PASS, lint N/A (no lint command, see AGENTS.md), tests PASS after the DW-135 re-run above, security:
no token, password or key in the diff (the throwaway `.env` was removed and is gitignored). Blind Hunter
(floor N = min(floor(sqrt(31.2) + 1), 10) = 6) and Edge Case Hunter findings:

| # | Finding | Verdict | Route |
|---|---|---|---|
| 1 | The probe loop printed an empty status when curl got no answer, shifting awk's columns so step 4's count read `no-via 000` instead of a status | low: real, a finding still surfaced but mislabeled | patch: `000` default in the awk, documented in step 2 |
| 2 | The rehearsal quoted output with no re-run form, unlike § Rehearsed off the box and 4-6's section | low: a proof claim a reader could not reproduce | patch: re-run block added and run as written |
| 3 | Step 4 asserted one clean `caddy` to `no-via` switch, but a new rule reaches edge locations over seconds | low: would have flagged a healthy move | patch (during implementation): a mix inside the first minute is expected |
| 4 | The `via` test assumes the edge adds no `Via` of its own | false: the edge response read 2026-09-30 carried only `via: 1.1 Caddy`, and 4-6's step 4 relies on the same | rejected |
| 5 | 4-6's Pending action 6 does not say to run after wheel | low: both orders work (each section guards the entrypoint `PUT`), and action 8 carries the order | rejected: editing another story's row adds nothing |
| 6 | The rollback runs `DELETE` with an empty ruleset or rule id | false: both are tested non-empty before the call, and it prints `rule not found` | rejected |
| 7 | KV-1's `Retired by` Decision cell still names Story 4-3 | false: the file's convention is a dated amendment in the Nature cell, which now names DW-308; the index row names both | rejected |

## Design Notes

Decisions the Operator may overrule:

1. **No routing change and no `list-wheel` change.** Router, headers and upstream already equal Caddy's block, and the alias exists on the shared network. No diff for that repository.
2. **The section lives in `ops/traefik-cutover.md`**, which owns the mechanism; `list-wheel` has no ops record here and no store, so a new record would restate it.
3. **Wheel moves first**, before 4-6's www and apex (addendum §G): a static site with no runtime isolates the edge, the firewall and Traefik. 4-6's section already handles an existing ruleset.
4. **KV-1's `list-wheel` half stays open.** Retiring it needs a CI image workflow, GHCR, a compose `image:` and a pull deploy in another repository: a deploy-shape change. Epic 4's AD-20 reading makes a cutover its own shipped and verified step, and this story's value is a move with nothing else changing. Filed as DW-308; KV-1 records today's truth.

Oversized spec: about 1,600 tokens at planning (6,328 characters, 913 words, estimated), at or over the 1,600 limit. The Operator's instruction of 2026-09-30, relayed by the orchestrator for this run: Keep.

## Verification

**Commands:**
- `corepack pnpm typecheck`: exit 0
- `corepack pnpm --filter hub build`: exit 0
- `corepack pnpm test --run`: all files pass (DW-135 flakes re-run)

## Operator items

1. **Preconditions from wave 1:** `ops/traefik-cutover.md` Pending actions 1 to 4 (Traefik on the box, step 5's
   `wheel.cuatro.dev/` pair matching) and `ops/settled-inputs-refresh.md` Pending action 4 (the origin rules
   token). No Postgres runbook is needed.
2. **Pending action 7:** confirm or overrule the four decisions above, including where DW-308 (KV-1's
   `list-wheel` half) is built: a story of its own before 4.11, or 4.11.
3. **Pending action 8:** run `ops/traefik-cutover.md` § Moving wheel.cuatro.dev steps 1 to 5, before § Moving
   cuatro.dev and www; the rollback is the `DELETE` block under it.
4. **No change in `LuigiEspinosa/list-wheel`** for this move: Traefik reaches the existing alias.
