---
title: 'Story 4-1: Refresh the settled inputs and choose the rebuild topology'
type: 'chore'
created: '2026-09-30'
status: 'done'
baseline_commit: 'f4f9935735c9d34a20af49b03c86685470583e01'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** Epic 4 opens on inputs last verified in August (versions, prices, the serving topology, the adoption probes), and it cannot start until it knows whether the rebuild runs in place or on a second box, which PostgreSQL major it targets, and how every hostname keeps serving while one box holds one 80/443 pair (NFR-2).

**Approach:** Re-verify exactly AD-22's own list in the spine, write the result as a dated record `ops/settled-inputs-refresh.md`, date each probe's re-run into its own record, update the spine's Stack table only where a verified version moved, and record three decisions the Operator may overrule: PostgreSQL major, topology, and the NFR-2 mechanism Story 4.2 implements.

## Boundaries & Constraints

**Always:** every value in the record is marked Observed (with UTC date and method) or Decision; every probe's exit code and date goes into its own record; box reads are read-only over the WSL `deploy` key; a moved input that implies work elsewhere becomes a DW entry or an Operator item, never a widened diff.

**Never:** re-open anything outside AD-22's list; write to the box; bump a dependency (a moved security floor is filed, not fixed here); print or commit a secret; touch `contracts/`; weaken a gate.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Version unchanged | upstream latest equals the Stack row | record says unchanged, Stack row untouched | N/A |
| Version moved | upstream latest differs | Stack row updated, dated 2026-09-30 | a moved security floor below the repository's pin files a DW |
| Probe regression | a probe exits 1 on a new failure | exit code and failure recorded, DW filed | exit 3 is recorded as nothing observed, re-run after fixing the host |
| Probe with standing findings | accessibility probe exits 1 on the known 74 and 38 | recorded as reproduced, not as a new regression | counts compared with the 2026-08-27 record |
| Box read denied | classifier refuses a box read | take the ops record, name the unread item as an Operator item | no retry in another form |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/architecture/architecture-cuatro-portfolio-2026-08-15/ARCHITECTURE-SPINE.md`: AD-22 (line 214) is the scope; `## Stack` table (line 268) is where moved versions land.
- `ops/routing-inventory.md`: observed topology (§ Every hostname, § Ingress, § The origin is firewalled, § Zone settings), dated 2026-08-24 plus Story 2-25 and 3-7 rows.
- `ops/capacity-gate.yml`: threshold load15 0.60 (AD-9), baseline 0.08.
- `ops/daisyui-route.md`, `ops/cs-tracker-token-adoption.md`, `ops/cs-tracker-accessibility-pass.md`: each gains a dated re-run section; accessibility action 2 and `ops/contract-adoption.md` action 4 cells note the AD-22 run.
- `ops/contract-adoption.md` § The estate, observed: policy table cells replaced per its maintenance rule; parsed by `ops/__tests__/contract-adoption.test.ts` (keep header rows and one row per repository).
- `ops/registry-verification.md` § Observed runs: one new row for the dispatch.
- `ops/font-contract.md`: a dated re-check note beside § The upstream pins, re-checked 2026-09-25.
- `packages/fonts/sources.json`, `package.json` (Tailwind 4.3.3), `packages/tokens/package.json` (style-dictionary 5.5.2), `packages/tokens/build.mjs` `TAILWIND_NAMESPACES`: read only.
- `AGENTS.md` line 37: the record count (30) and list gain the new record.
- `_bmad-output/implementation-artifacts/sprint-status.yaml`: `epic-4` and `4-1` rows.
- `_bmad-output/implementation-artifacts/deferred-work.md`: appended DW entries only.

## Tasks & Acceptance

**Execution:**
- [x] `ops/settled-inputs-refresh.md`: new record (each AD-22 item with observed value, source, date and verdict; the three decisions with cost (NFR-4) and load (SM-C4); Operator items), the refresh's one home.
- [x] `ops/daisyui-route.md`, `ops/cs-tracker-token-adoption.md`, `ops/cs-tracker-accessibility-pass.md`, `ops/contract-adoption.md`, `ops/registry-verification.md`, `ops/font-contract.md`: dated re-run and re-observation entries (AD-22 says each result lives in its record).
- [x] `ARCHITECTURE-SPINE.md`: Stack rows for Traefik, PostgreSQL and Style Dictionary, dated (only rows whose verified value moved or was decided).
- [x] `deferred-work.md`: DW for the Style Dictionary floor now above the pin (scope discipline).
- [x] `AGENTS.md`: record count and list (keeps the orientation line true).
- [x] `sprint-status.yaml`: `epic-4: in-progress`, `4-1: done` with a dated comment.

**Acceptance Criteria:**
- Given AD-22's list in the spine, when the record is read, then every item on it has an observed value with a UTC date and nothing outside the list is re-opened.
- Given PostgreSQL's release state on 2026-09-30, when the record is read, then 18 versus 19 is decided with the evidence quoted.
- Given the observed topology, when the record is read, then in-place versus second box is decided with its marginal cost against NFR-4 and its load against SM-C4, and the NFR-2 mechanism Story 4.2 implements is named with its box-side and Cloudflare prerequisites.
- Given the four probes and the dispatch, when their records are read, then each carries the 2026-09-30 exit code or run conclusion.
- Given the change, when typecheck, the Hub build and the full suite run, then all pass.

## Implementation Notes

- Implemented inline (no subagent tool in this run). Every probe, sweep and box read ran before the record was written; the record quotes their output.
- Box reads, 2026-09-30T08:28:09Z, read-only over the WSL `deploy` key: `uptime`, `docker ps`, `free -m`, `df -h /`, `nproc`, `docker version`, `grep` and `sed -n` over the shared Caddyfile. Nothing written. Public DNS (DNS-over-HTTPS), the edge certificate (`openssl s_client`), `curl -I` per hostname and `docker stats --no-stream cs-tracker-caddy-1` read at 09:05Z to 09:07Z after the verifier's finding. Only the zone's SSL mode and ruleset phases need the zone token: Operator item 1 in the record.
- Probes: daisyUI exit 0 (7 of 7); adoption exit 0 (19 of 19); accessibility exit 1 on the standing 74 and 38 findings, throwaway `postgres:16` container `cuatro-4-1-pg` and the `mix phx.server` process removed afterwards, `cs-tracker`'s `git status --porcelain` identical before and after. Registry verification dispatch run 36690453047 green, 41 of 41.
- `ops/contract-adoption.md`: moved cells replaced (Anchor test count 339 at `373e33d`, 0 of 32, thirteen required checks; `cs-tracker` remote `2519fe3`; `list-wheel` `718f194`) and every row's Nature cell dated; `ops/__tests__/contract-adoption.test.ts` 30 of 30.
- Style Dictionary 5.5.2 sits inside both new advisories' vulnerable ranges; filed as DW-295 rather than bumped (Never: bump a dependency here).
- `AGENTS.md` record count 30 to 31, with the new record named, so the orientation line stays true.

## Spec Change Log

- 2026-09-30, independent verifier: the topology item's DNS and edge halves were carried forward on the premise that no token meant no observation. Public DNS and the edge were then observed and written in, Operator item 1 shrank to the zone settings, the prose dashes in this spec became colons, the spine's Deferred item on the PostgreSQL major was dated closed, and the Caddy container's measured cost was added to the load row.

## Review Triage Log

All six layers ran inline in this session (no subagent tool). Design Review: `No UI surface in this diff. Design review skipped.` (no `.scss` or `.tsx`, no motion token in the diff). Ponytail: `Lean already. Ship.` (records and a board flip; the one new file is the record the story asks for). Verification gap: `No verification gaps found.` (no deterministic code changed; the one parsed record, `ops/contract-adoption.md`, is held by `ops/__tests__/contract-adoption.test.ts`, which ran green). ECC verification loop: build PASS (`corepack pnpm --filter hub build`, exit 0), types PASS (`corepack pnpm typecheck`, exit 0), lint N/A (no lint command, see AGENTS.md), tests PASS (72 files, 1776 tests), security scan: no credential in any added line, diff 13 files. Blind Hunter floor: diff 92 kB, N = min(floor(sqrt(92) + 1), 10) = 10.

| # | Layer | Finding | Verdict | Route and evidence |
|---|---|---|---|---|
| 1 | blind | TLS row claimed "all eight blocks" from a line count that a comment could have inflated | low | patch: re-read the box by `grep` for `tls` lines, eight at lines 23 to 123, one per block; the row now cites them |
| 2 | blind | Style Dictionary row did not show 5.5.2 is actually inside the vulnerable ranges | low | patch: advisory ranges read (`>= 5.5.1, <= 5.5.4`, `>= 4.3.0`) and written in |
| 3 | blind | `{$PHX_HOST}` presented as `cs-tracker.cuatro.dev` without reading the variable | low | patch: marked as the record's, the variable unread |
| 4 | blind | "no v3.8" rested on the first page of releases | low | patch: tags read, no `v3.8` or later; wording made exact |
| 5 | blind | Policy-table Nature cells joined the new note without a sentence break in 10 rows | low | patch: period inserted; test re-run |
| 6 | blind | The spec's frozen tag carried the template's em-dash, against the house writing rule | low | patch: comma, as spec-3-8 writes it; the tag's wording is otherwise unchanged |
| 7 | blind | Second-box cost reads only the promotional price, not the shortest term | false | the record says the shortest term and its price were not read; the decision does not rest on the figure ($0 against any positive price) |
| 8 | blind | Proxy load in place is unmeasured | false | stated as unmeasured, with the per-step reading Story 4.2 takes; SM-C4's gate is unchanged |
| 9 | blind | 8443 is reachable through the edge before a hostname moves | false | stated in the record with its effect (WAF by host still applies, Traefik 404s an unmoved host) and blocked by the origin firewall until Operator item 4 |
| 10 | blind | The origin-rules token scope is unknown | false | recorded as Operator item 4 and a Story 4.2 prerequisite, not claimed |
| 11 | edge | Spec claims Stack rows change only where a version moved, yet the PostgreSQL row changed with no version move | false | the Tasks line says "moved or was decided"; the row's own text said the target is "chosen at Epic 4 under AD-22", which this story decides |
| 12 | edge | `sprint-status.yaml` `last_updated` not yet bumped when the diff was staged | low | patch: set with the done flip |

## Design Notes

**Oversized spec, kept.** About 1,730 tokens (6,932 characters over four) against the 1,600 guide. The Operator's instruction of 2026-09-30, relayed by the orchestrator for this spec, is Keep; the story is one refresh record with its dated entries, and splitting it would separate evidence from the decisions it supports.

**Decisions the Operator may overrule.** PostgreSQL 18 (19 is at Beta 4, no RC, GA planned October 2026; a greenfield on a beta or a week-old .0 breaks the pin-to-a-verified-version rule). In place on the one box (no data crosses hosts, $0 marginal, load15 0.17 of 0.60 measured today, the incumbent Caddy at 0.15% CPU and 21 MiB as the stand-in for an idle proxy). NFR-2 mechanism: Traefik runs beside Caddy on a second published port, and each hostname moves by a Cloudflare Origin Rule destination-port override (available on the Free plan, 10 rules, 8 hostnames), one hostname at a time and reversible by deleting its rule; no 80/443 handoff happens under live traffic.

## Verification

**Commands:**
- `corepack pnpm typecheck`: exit 0
- `corepack pnpm --filter hub build`: exit 0
- `corepack pnpm test --run`: all files pass (DW-135 flakes re-run)
