---
title: 'Story 4-11: Retire Caddy and decommission the old topology'
type: 'feature'
created: '2026-10-01'
status: 'done'
baseline_commit: '04ab44803db611d7eeae10a9e98007ce96375379'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
  - '{project-root}/ops/traefik-cutover.md'
  - '{project-root}/ops/routing-inventory.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** Seven hostnames reach Traefik through Cloudflare Origin Rules to 8443 while the shared Caddy (`cs-tracker-caddy-1`) still holds 80 and 443, serves `tournament.cuatro.dev` and every plain-HTTP request, and the Origin CA pair Traefik serves sits in Caddy's volume. Three Postgres 16 stores, their move dumps and env copies stand as rollback copies, and `ops/routing-inventory.md` still calls one shared Caddy the ingress. Nothing may be removed before every hostname is accounted on the new topology (story acceptance intent).

**Approach:** Traefik takes 80 (redirect to https) and 443 itself, with the Origin CA pair in a volume of its own, proven locally and held by the suite; a runbook, `ops/caddy-retirement.md`, for the Operator: account every hostname, move the tournament by Origin Rule, hand 80 and 443 to a second Traefik instance beside the 8443 one, delete the eight rules one at a time, close 8443, then retire Caddy and the three old stores, each after a final dump copied offsite. The two `cs-tracker` changes are exact diffs. The inventory, estate and KV records are rewritten to the current reality as dated revisions.

## Boundaries & Constraints

**Always:** every box step carries its commands, verification and rollback; every removal names exactly what it removes and comes last in its step, after its data is live elsewhere (counts matched) or archived offsite and verified; Caddy stays stopped, not removed, until 443 is proven for every hostname; placeholders only; every proof claim quotes real output.

**Never:** write to the box, the zone or another repository in this run; push; weaken a gate; remove `/home/deploy/origin-ca`, the estate stores, the `digital-library` stores or the `cuatro-tracker` Redis and qBittorrent; close DW-308, DW-185, DW-187, DW-306, DW-275 or DW-311 (each another story's change).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Handover | Caddy stopped, `ingress` started beside the 8443 instance | HTTPS keeps answering through the rules; plain HTTP gap of seconds only | `$T stop ingress && docker start cs-tracker-caddy-1` |
| Plain HTTP | `http://<host>/p?q` on 80 | permanent redirect to `https://<host>/p?q`, no port | rollback as above |
| Rule deletion | one rule deleted | that hostname answers from `ingress` on 443, same status | re-create the rule |
| Old store | counts before the final dump | old unchanged since its move; estate equal or moved on | a lower or missing table stops the step |

</frozen-after-approval>

## Code Map

- `ops/traefik/compose.yml`, `traefik.yml`: today `traefik` service on 8443 and loopback 8080, origin pair from `cs-tracker_caddy_data` subpath (DW-296). Change to service `ingress` on 80, 443, loopback 8081; `web` entrypoint redirect; `websecure` on 443; external volume `traefik-origin-ca`.
- `ops/traefik/dynamic/routes.yml`: routers unchanged (`cs-tournament` = Caddy's tournament block); comments only.
- `ops/__tests__/traefik-config.test.ts`: parses `## Every hostname in the zone` rows whose 2nd cell is `177.7.52.248`, row tails `alias \`x\` | port |`, `\nlibrary.cuatro.dev {\n` (Caddy's block) and asserts the scratch host absent from the inventory; port, timeout and volume cases to flip.
- `ops/routing-inventory.md`: § Ingress (572), § The site blocks (653), § The shared network (1334), § Backup coverage (1432), § Every hostname (336), TOC; findings in § Configuration that exists only on the box, § Volumes.
- `ops/estate.md` amendments block (~310-375); `ops/known-violations.md` KV-1 (77-200); `docker-compose.yml` `anchor-db` comment (finance still names it, DW-300).
- Box, read 2026-10-01T02:33Z: containers, volumes (incl. dangling `4fc208dc...`, DW-307), crontab (03:15 estate, 03:30 `cuatro-backup.sh`, 03:45 library and tournament), Caddyfile digests and 95 insertions, six `Caddyfile.bak-*`, `cs-tracker` at `ca75686`, firewall 17/9 `DOCKER-USER` lines and 22 `ufw` 8443 rules, `/etc/cuatro/postgres-backup.env`, move counts files.
- `LuigiEspinosa/cs-tracker` at `ca75686`: `docker-compose.yml` (`caddy`, `db`), `Caddyfile`, `docs/deployment.md`; no CI.
- Ledger: DW-296 (closed by the config), DW-309 (closed by survey), notes on DW-185, 187, 275, 287, 300, 301, 306, 307, 308, 311; new DW for `docker/Caddyfile` and AGENTS.md.

## Tasks & Acceptance

**Execution:**
- [x] `ops/traefik/compose.yml`, `traefik.yml`, `dynamic/routes.yml`: the end state above, so Traefik holds 80 and 443
- [x] `ops/__tests__/traefik-config.test.ts`: flip the port, timeout and volume cases, add web redirect and tournament cases, refine the scratch check, so the suite holds the end state
- [x] `ops/caddy-retirement.md`: new runbook (proof, decisions, two cs-tracker diffs with sha256 and subjects, sequence, pending actions), for the box half
- [x] `ops/routing-inventory.md`, `ops/estate.md`, `ops/known-violations.md`, `docker-compose.yml` comment: dated revisions, so records describe today and the runbook's end state
- [x] `deferred-work.md`, `sprint-status.yaml`: DW notes and closures; 4-11 `awaiting-operator`, for the ledger and board

**Acceptance Criteria:**
- Given the committed `ops/traefik/`, when run locally beside the 4-2 instance and a Caddy stand-in, then `ingress` starts with Caddy stopped and the 8443 instance running, every hostname answers the same on 443 as on 8443, plain HTTP redirects, and the 8443 instance's stop leaves 443 and 80 answering.
- Given the runbook, when read end to end, then each removal is preceded by a count check and an offsite copy verified by restore, and every rollback names its command.
- Given `ops/routing-inventory.md`, when read, then no section it owns presents one shared Caddy as the current ingress.

## Implementation Notes

- Implemented inline (no subagent tool in this run). The three `ops/traefik/` files and the suite's cases were drafted during investigation so the local proof could run against them, before the spec was written; each was re-read against the approved spec. Files: `ops/traefik/compose.yml`, `traefik.yml`, `dynamic/routes.yml` (comments only), `ops/__tests__/traefik-config.test.ts`, `ops/caddy-retirement.md` (new), `ops/routing-inventory.md`, `ops/estate.md`, `ops/known-violations.md`, `docker-compose.yml` (the `anchor-db` comment), `deferred-work.md`, `sprint-status.yaml`, this spec.
- **The handover, proven locally** (`ops/caddy-retirement.md` § Rehearsed off the box): Story 4-2's instance from `git archive HEAD`, a Caddy stand-in on 80 and 443, then `docker stop` of Caddy and `up -d --wait` of `ingress`: compose named the 8443 instance an orphan and left it running; 706 loop lines, the 8443 column never failed while that instance ran; 443 and 80 failed for one or two lines across the port change. One line failed on all three ports when the 8443 instance stopped; three repeats of that stop (94 lines) and five stops of an unrelated container (75 lines) failed nothing, so it is recorded as unexplained and step 7 watches for it. A `HEAD` sent as `-X HEAD` hung the probe script until killed; the runbook uses `-I`.
- **The suite against the 4-2 files**: the extended `traefik-config.test.ts` passes 26 of 26 on the new files and fails 5 (the 443, `web`, 8081, port and volume cases) with `ops/traefik/compose.yml` and `traefik.yml` stashed back to `04ab448`.
- **The two `cs-tracker` patches** were made in a scratch export of `ca75686` and checked: change A then `git rm Caddyfile`, then change B, apply in order to a second fresh export, and the results equal the written files; `docker compose config --services` printed `app db` after A and `app` after B (`migrate` under its profile); no added line carries a dash or emoji. Extraction from the record by Pending action 3's `awk` gives both sha256 values from an LF and a CRLF copy.
- **The archive and offsite helpers** ran against a local restic repository as uid 1001; the tar came out `0644`, so the runbook sets `0600`. The local run widened the Docker Desktop VM's socket mode inside a throwaway container to let uid 1001 reach it; a desktop-only side effect, reset by Docker Desktop's restart. The count comparison (`cmpq`) was checked on sample rows (`MISSING`, `LOWER`, `ok`, extra estate tables ignored) and with mixed-case Prisma table names; `join` is pinned to `LC_ALL=C` to match the sort.
- **DW-309 closed by survey**, not by a change: no upstream but `cs-tracker`'s serves an upgrade through the origin.
- Box reads, all read-only, 2026-10-01T02:33Z to 02:38Z: `docker ps -a`, `docker volume ls`, `docker inspect` (environment names only), `docker network inspect`, `crontab -l`, `ss -ltn`, `ls`, `cat` of the stamp and counts files, `git` and `sha256sum` in `/home/deploy/cs-tracker`, `sudo iptables -S`, `sudo ufw status`, `sudo ls` of the dangling volume's directory. Plain-HTTP and tournament probes from the workstation through the edge.
- Local cleanup verified: no container, volume or network of the proofs remains, `ops/traefik/.env` removed (`git status` shows only the tracked edits).

## Spec Change Log

- 2026-10-01: box half ran from 05:02Z to 06:12Z (runbook `ops/caddy-retirement.md` § The sequence, steps 1 to 16), recorded in that file's § Retirement run; status `done`. The tournament moved onto Traefik by rule `24428c40a067407983ee72b4abf32016`, `traefik-ingress-1` took 80 and 443, the eight rules were deleted, 8443 closed, Caddy and the 8443 instance removed, and the three old stores retired after offsite dumps; `cs-tracker` changes A and B landed as `9a5a4be` (under a different subject, content identical) and `bde2b3f`. Pending Operator actions 1 to 5 dated, 6 and 7 deferred to the Operator's clean start. DW-296 closed; DW-313 and DW-314 filed; DW-312 half taken.

## Review Triage Log

Pass 1, 2026-10-01, all six layers run inline by this session (no subagent tool in this run), against the diff from `04ab448` with the untracked files (140.9 kB; blind floor N = min(floor(sqrt(140.9) + 1), 10) = 10).

| # | Layer | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | blind | After the merge, `ops/traefik-cutover.md`'s `$T` names `ingress`: its § Rollback to Caddy, whole would leave the 8443 instance running, and its step 4 would start the 443 instance | medium | `$T down` acts on the file's services; `traefik` is an orphan from then on | patch: dated notes at that file's head and in the section |
| 2 | blind | Step 5's redirect probe read `%{redirect_url}`, which printed nothing for the same request in the rehearsal | low | `GET cuatro.dev/some/path?q=1 301 ` in the proof output | patch: the `Location` read from the headers; the line printed `308` with the URL three times against Caddy through the edge |
| 3 | blind | Step 2 compares Traefik's established count with a step 1 baseline step 1 never read | low | Step 1 had no `est` line | patch: `est traefik-traefik-1 8443` in step 1 |
| 4 | blind | Step 1 expected `_domainconnect` to answer its CNAME target and every moved hostname to show its proxy by `via` | low | Read 2026-10-01: `_domainconnect` `[0,[]]` (proxied), `analytics` `403` with no `via` from a bare `curl` | patch: the observed values, and why `analytics` reads `0` |
| 5 | blind | The API may refuse to delete a phase's last rule | maybe-false | Not checked against Cloudflare; settled by step 6 on the box; if true, low | one-sentence fallback added (delete the entrypoint ruleset) |
| 6 | blind | "One request in each of the two ports failed" misstates the loop | low | Phase 2 lines: `200 000 000` and `200 000 301`, so 443 twice and 80 once | patch: wording |
| 7 | blind | "The twelve routers of `routes.yml`" | low | The file has eleven; the twelfth in Story 4-2's count is Traefik's `ping` router | patch: wording |
| 8 | blind, ponytail | The inventory's routers table restates `routes.yml` and can drift from it | low | No test reads that table | patch: one clause, the file wins where they differ (`shrink:`; the table kept as the dated description the story asks for) |
| 9 | blind | `cmpq`'s `join` ran in the box's locale while both inputs were sorted in `C`, so mixed-case Prisma tables could misjoin | medium | `join` needs the sort's collation; found while checking the helper | patch: `LC_ALL=C join`, checked with `Account`, `MediaItem`, `User`, `_prisma_migrations` |
| 10 | blind | A restart of the 8443 instance between the merge and step 7 reads the 443 static file and breaks every rule | low | Needs a restart in a window the runbook keeps to one session; § Why two instances at once gives the recovery (delete every rule, Caddy's 443 serves) | reject: a separate static file for a window of minutes is new configuration |
| 11 | blind | Archiving Caddy's volume puts the Origin CA key offsite | false | It is a decision, encrypted by restic, recorded with its alternative for the Operator (step 11.1, Pending action 1) | reject |
| 12 | blind | `offsite` can collide with the nightly `forget --prune`'s lock | false | The preconditions exclude 02:45 to 03:50 UTC | reject |
| 13 | edge-case | Step 13's `crontab -l \| grep -v \| crontab -` installs an empty crontab if `crontab -l` fails | low | The step saves `crontab.before-4-11` first and expects "three lines remain", which shows it | reject: detection and rollback exist; a guard adds a branch |
| 14 | edge-case | Step 4's `docker stop` may wait up to 10 seconds on Caddy's connections, widening the plain-HTTP gap | maybe-false | Settled by step 4's probe; the rehearsal's gap was about a second; if true, low | reject, noted |
| 15 | edge-case | Step 15's `rmdir` could meet a file the 03:30 job wrote after the manifest | false | Step 13 removes the 03:30 line before step 15; `rmdir` refusing is the check | reject |
| 16 | verification-gap | The `web` redirect, the 443 entrypoint and the ports are held by source-text cases only; CI runs no Traefik | low | `ops/__tests__/traefik-config.test.ts` reads files as text (Story 4-2's design); the runtime is the rehearsal's; the new cases fail 5 of 26 against the 4-2 files | reject: a runtime Traefik in CI is new machinery (DW-297's note), as Story 4-10's review ruled |
| 17 | verification-gap | The runbook's shell helpers (`cmpq`, `offsite`, `del`) have no automated check | low | Human-run, each step with expected output; `cmpq` and `offsite` checked locally | reject |
| 18 | ponytail | Otherwise lean. Ship. | n/a | | none |
| 19 | ecc-verification-loop | Build PASS, types PASS, lint N/A (no lint command, AGENTS.md), tests PASS (75 files, 1844 passed, 1 skipped, after the patches), no secret in the diff (added long strings are sha256 digests, rule ids and path slugs) | n/a | Outputs under Verification | none |
| 20 | design | No UI surface in this diff. Design review skipped. | n/a | No `.scss`/`.tsx` outside tests, no motion term in added lines | none |

## Design Notes

**Spec size.** Measured at step 2's check: 932 words before these notes (about 1,240 tokens), under the 1,600 line; these notes take it over. The Operator's instruction of 2026-10-01, relayed by the orchestrator for this named spec: **Keep** an oversized spec. The story is one decommissioning whose steps depend on each other in order.

Decisions, each one the Operator may overrule (Pending action 1 of the runbook):

1. **A new record, `ops/caddy-retirement.md`.** It retires stores as well as a proxy; `ops/traefik-cutover.md` owns the per-hostname mechanism, which this references rather than restates.
2. **Traefik takes 80 and 443; the rules go and 8443 closes.** Against keeping 8443 with the rules: the rules are routing outside git, they cap the estate at the Free plan's ten, and 8443 is a port the firewall admits for nothing else. The refresh record named this choice (`ops/settled-inputs-refresh.md` § What it leaves to Story 4.11). Rollback until Caddy's removal step: stop `ingress`, start Caddy.
3. **Two instances at once, so HTTPS never changes hands under traffic.** `ingress` starts on 80 and 443 while the 8443 instance still serves every rule, then the rules are deleted one by one. Its dashboard moves to loopback 8081, since the 8443 instance holds 8080. Only plain HTTP has a gap, the seconds between Caddy's stop and `ingress` binding 80.
4. **Plain HTTP:** Traefik answers 301 to GET and 308 to other methods where Caddy answered 308 to all; both permanent, same `Location`. Accepted, as Story 4-6 accepted it for www.
5. **Offsite for retired data:** one restic snapshot set, tag `retired-4-11`, in the estate repository (R2), verified by restoring and comparing every file's sha256; the nightly `forget` filters on its own tag and never touches it. The `.env` copy and rollback overrides hold secrets and served only the rollback, so they are shredded, not archived.
6. **Caddy's volumes are archived, Origin CA key included**, which gives the key its first copy off the box (encrypted). Its live copies are `traefik-origin-ca` and `/home/deploy/origin-ca`.
7. **Scope kept:** `anchor-db`'s declaration stays for finance (DW-300); the `cuatro-tracker` project keeps Redis and qBittorrent (DW-306); `list-wheel` and `digital-library` keep building on the box (DW-308, DW-185, DW-187): the story retires the topology, not each application's deploy. DW-275 and DW-311 stay open.
8. **The Capacity Gate:** Traefik is ingress, not a placement, so no `placements` entry (AD-9). **The second serving address** was decommissioned by Story 1.21 and is recorded (`ops/routing-inventory.md` § The address the estate left); nothing repeats it.

## Verification

**Commands:**
- `corepack pnpm typecheck`: expected exit 0
- `corepack pnpm --filter hub build`: expected exit 0
- `corepack pnpm test --run`: expected all files pass (DW-135 flakes re-run)

**Observed 2026-10-01 on the final tree:**
- `corepack pnpm typecheck`: `tsc --noEmit`, exit 0 (before and after the review patches).
- `corepack pnpm --filter hub build`: exit 0 (before and after).
- `corepack pnpm test --run`, before the patches: 72 of 75 files, `Tests  3 failed | 1841 passed | 1 skipped`, the three each failing at about 30 seconds in `deploy-remote`, `library-backup` and `postgres-backup` (DW-135, DW-303); those three files re-run: `Test Files  3 passed (3)`, `Tests  107 passed | 1 skipped`. After the patches: `Test Files  75 passed (75)`, `Tests  1844 passed | 1 skipped (1845)`, exit 0.
- `ops/__tests__/traefik-config.test.ts`: 26 passed; against the 4-2 `compose.yml` and `traefik.yml`, 5 failed and 21 passed.
- The local handover proof, the archive and offsite proof, the two patches' application and extraction digests: `ops/caddy-retirement.md` § Rehearsed off the box and § The cs-tracker changes, and Implementation Notes.

**Box half (the Operator's):** `ops/caddy-retirement.md` § The sequence steps 1 to 16, § Pending Operator actions 1 to 7.
