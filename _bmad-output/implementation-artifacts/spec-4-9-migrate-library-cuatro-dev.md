---
title: 'Story 4-9: Migrate library.cuatro.dev onto Traefik, the store left in place'
type: 'feature'
created: '2026-09-30'
status: 'awaiting-operator'
baseline_commit: '8c995868f6a91799078597ee47098275660834bf'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
  - '{project-root}/ops/backup-digital-library.md'
  - '{project-root}/ops/traefik-cutover.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** `library.cuatro.dev` still reaches `digital-library` through the shared Caddy. Story 4-2 committed two Traefik routers for it (the path split between `library-web` and `library-api` under one `Host`), but nothing says how the hostname moves, how its SQLite and Redis stores are proven safe across the move, how the move is verified or how it goes back.

**Approach:** The stores are a host bind mount and a named volume that no routing change touches, so this is a routing move with a backup proof before it and a cron proof after it. Confirm the routers against the box's Caddy block and the containers' aliases, rehearse locally with the real `digital-library` images behind a throwaway Traefik and a Caddy stand-in, pin the routers in the Traefik suite, and write the move as a section of `ops/backup-digital-library.md`.

## Boundaries & Constraints

**Always:** a cron-shape `library-backup.sh` run exiting 0 with `offsite=ok`, `roundtrip=sha256-match` and `restore=verified`, and the restored row counts equal to the live store's, before the rule is created; one Origin Rule moves the hostname and deleting it moves it back; a load reading at each step; monitor 803750025 read before and after; the next night's cron line read after; every claim of proof quotes real output.

**Never:** write to the box, the zone or another repository in this run; move, copy over, stop or restart the store or its containers; change `digital-library`'s build or deploy shape in the hostname move (AD-20, Epic 4 reading); stop Caddy or remove its `library.cuatro.dev` block (Story 4.11); edit `contracts/registry.json`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Web root | `GET /` | `302` to `/login` from `library-web`, the three library headers | a status differing from Caddy's stops the step; delete the rule |
| Web page | `GET /login` | `200` `text/html` from `library-web` | same |
| API | `GET /api/health` | `200` JSON from `library-api` | same |
| Files | `GET /files/<missing>` | `404` JSON from `library-api`, never the web's page | same |
| Near miss | `GET /apix`, `/api` | `library-web`, as Caddy's `/api/*` matcher sends them | same |
| Rollback | the rule deleted | back on Caddy, `via: 1.1 Caddy` | none needed |

</frozen-after-approval>

## Code Map

- `ops/traefik/dynamic/routes.yml:48-61,102-106,135-142`: routers `digital-library` (Host only, `library-web:3000`) and `digital-library-api` (same Host, `PathPrefix(/api/) || PathPrefix(/files/)`, `library-api:4000`), both `[library-headers]` (SAMEORIGIN). Matches the box's Caddy block (read 2026-09-30) and the aliases `library-web`, `library-api` on `cs-tracker_default` from the box-only override (DW-187). Change only if the rehearsal shows a difference.
- `ops/__tests__/traefik-config.test.ts:158-168`: the wheel case (Story 4-3) is the shape for a library case; the split case at 110-117 stays.
- `ops/routing-inventory.md:349` (the library row: aliases, ports 4000 and 3000) and `:621-637` (the Caddy block as installed).
- `ops/backup-digital-library.md`: the store, the method, § The restore procedure, § Pending Operator actions (rows 1 to 9; the suite at `ops/__tests__/library-backup.test.ts:1597-1628` reads the Installed table and the open rows; a new section goes before `## Named limits` so the Pending section stays last).
- `ops/traefik-cutover.md` § Moving wheel.cuatro.dev (4-3): the `CF` helper, the guarded `PUT`, the probe loop and the rollback, copied for this hostname.
- `contracts/registry.json` entry `digital-library`: `tech` holds `SQLite` and `Redis`. Read only.
- `LuigiEspinosa/digital-library` `main` at `46d6e5f` (the box's checkout): `docker-compose.yml`, `apps/api/Dockerfile`, `apps/web/Dockerfile`. Read only.

## Tasks & Acceptance

**Execution:**
- [x] `ops/__tests__/traefik-config.test.ts`: one case: the web router carries `library-headers` and the API router `library-api-headers`, the split router's prefixes equal Caddy's `handle` paths in the inventory's block, and each service dials the alias and port the inventory's library row names; and one case pinning `readTimeout: 0` on `websecure`, pins what the move depends on.
- [x] `ops/traefik/dynamic/routes.yml`, `ops/traefik/traefik.yml`: the two corrections the rehearsal found (see Implementation Notes): `library-api-headers` without `referrerPolicy` on the API router, and `readTimeout: 0` on `websecure` (DW-297's measurement, owned by this story).
- [x] `ops/backup-digital-library.md`: section `Moving library.cuatro.dev onto Traefik (Story 4-9)`: why here, what serves today, what the move changes, the rehearsal, the sequence (backup and restore proof with counts, the rule, the probe, the verification per path, the monitor), rollback, the next night's cron, the record; Pending rows 10 and 11.
- [x] `ops/traefik-cutover.md`: one dated amendment bullet naming the two corrections, so 4-2's record still describes its stack.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md`: DW-297 closed with the measurement; no new consequence outside this story was found.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml`: 4-9 to `awaiting-operator` with a dated comment.

**Acceptance Criteria:**
- Given the committed `ops/traefik/`, when the suite runs, then the library cases pass, and fail if a router's header middleware changes, a prefix changes, a service names another host or port, or the read timeout returns.
- Given a throwaway Traefik from the committed files and the real images under their aliases, when the I/O matrix's requests run through 8443 and through a Caddy stand-in with the box's block, then the output quoted in Implementation Notes matches the matrix on both sides.
- Given the runbook section, when the Operator reads it, then every box, Cloudflare and monitor step is an exact command and is a Pending Operator action, and no step writes to the store.

## Implementation Notes

Implemented inline (the run has no Agent tool). Files: `ops/traefik/dynamic/routes.yml`, `ops/traefik/traefik.yml`,
`ops/__tests__/traefik-config.test.ts` (two cases), `ops/backup-digital-library.md` (the section, Pending rows 10
and 11), `ops/traefik-cutover.md` (one amendment bullet), `deferred-work.md` (DW-297 closed), `sprint-status.yaml`.

**Box read, 2026-09-30T17:03:36Z, read-only:** the three containers `Up 2 months (healthy)`; DNS names on
`cs-tracker_default` `[digital-library-api-1 api library-api ...]` and `[digital-library-web-1 web library-web ...]`;
checkout `46d6e5f2adbcfb33c9f7488973ccbc2b3e6f3cc2` with the override untracked; `bind /home/deploy/digital-library/data
/data true`; `redis-cli DBSIZE` `0`; the Caddy block as the inventory quotes it; the crontab's `45 3` line and the
night's `... restore=verified prune=removed-1-aged-over-14-whole-days exit=0`; installed script digests
`6d1c25f1...`, `0c4d8502...`, `5ab0b586...` (the 2026-08-24 install); nothing on 8443; load `0.07, 0.18, 0.19`.
UptimeRobot: 803750025 `UP`, 45d 7h, interval 300. Registry `tech`: `SvelteKit, Fastify, SQLite, Redis, BullMQ, Docker`
in the file and as served.

**Rehearsal** (real images from `digital-library` `main` at `46d6e5f`, the committed Traefik, a `caddy:2` v2.11.4
stand-in with the box's block), quoted in the runbook. On Story 4-2's files every status and body matched, with two
differences: API responses carried Caddy's and the API's headers both (`rp=strict-origin-when-cross-origin,no-referrer`,
browser-effective `no-referrer`) against Traefik's replaced `rp=strict-origin-when-cross-origin`; and a 90000 byte POST
at 1000 bytes a second read `9443 404 up=90000 secs=90` against `8443 404 up=60000 secs=60`. After the two
corrections: `rp=no-referrer` on every API path through Traefik and `8443 404 up=90000 secs=90`; the matrix rows `/`
302 to `/login`, `/login` 200, `/api/health` 200, `/files/missing.epub` 404 JSON, `/api`, `/apix`, `/files` 404
`library-web`'s page, equal on both sides; `Traefik log errors other than offline.yml's deliberate ACME failure: 0`.

**Counts pipeline** (step 2), proved in a throwaway `alpine:3` container with `sqlite` on a WAL database: the live
loop and the restore-verify line shape printed identical lines and `counts-match`; after one more insert on the live
side it printed the `users` difference and `counts-differ`.

**Suite:** mutation checks: `/file/` for `/files/`, port 4001, `DENY` for `SAMEORIGIN`, `house-headers` on the web
router, `library-headers` on the API router and `readTimeout: 60s` each failed the new cases; the committed files pass.

**Verification, after the review patches (2026-09-30):** `corepack pnpm typecheck` exit 0 (`tsc --noEmit`);
`corepack pnpm --filter hub build` exit 0 (`Compiled successfully in 3.6s`); `corepack pnpm test --run` exit 0,
`Test Files  75 passed (75)`, `Tests  1841 passed | 1 skipped (1842)`, no DW-135 re-run needed.

## Spec Change Log

- 2026-10-01: box half steps 1 to 5 ran from 00:04Z with the Operator present (runbook § Moving library.cuatro.dev onto Traefik), recorded in `ops/backup-digital-library.md` § Cutover run, library.cuatro.dev; Origin Rule `041740b5be6f41e588bbbc41f2af4e81` since 00:04:56Z, no rollback. Step 6, the 2026-10-01 03:45Z backup line, is still to be read (Pending Operator action 11); status stays `awaiting-operator` until it is.

## Review Triage Log

All six layers ran inline in the build session (the run has no Agent tool), so none is independent of the author; stated as a limit, not a pass. Design Review: no `.scss`, `.tsx` or motion in the diff, skipped. ECC verification loop: build, typecheck and the full suite observed green (below); lint N/A.

| # | Layer | Finding | Verdict | Evidence and route |
|---|---|---|---|---|
| 1 | blind | `traefik.yml`'s comment called the rehearsal's request "a slow book upload"; it was a 90 KB POST to `/api/health` | low | True as written. Patched: the comment names the 90 KB body and why book uploads are the case |
| 2 | blind | The spec's task and verification lines used the template's ` -- ` separators, a double-dash standing in for a dash | low | True; AGENTS.md forbids it. Patched to `: ` and `, ` |
| 3 | blind | `readTimeout: 0` lifts the read limit for every hostname, not only the library | false | Deliberate and recorded (Design Note 4, the record's decisions, the amendment in `ops/traefik-cutover.md`): it is Caddy's behaviour today for every hostname, and the firewall admits Cloudflare alone |
| 4 | blind | The probe loop sends about two API requests a second; an API rate limit would read as a finding | false | `digital-library` `main` at `46d6e5f` has no rate-limit plugin: `grep -rn -i "rate-limit\|rateLimit" apps/api/src apps/web/src` found nothing |
| 5 | blind | The `library-api-headers` pin ends at `    www-to-apex:`, so reordering the middlewares fails the case | low | True but it is what proves the block holds no `referrerPolicy` line; a reorder is a one-line test edit. Rejected: unlikely, and the fix adds a block parser |
| 6 | edge | Step 2's live read with `sudo sqlite3 -readonly` on a WAL database might create `-wal` or `-shm` as root | false | Both files already exist root-owned (`ls -la data`, 2026-09-30), the container writes as root, and a read-only connection never checkpoints; `library-backup.sh` already opens the live file with `sudo sqlite3` nightly |
| 7 | edge | Step 1's recreate needs `ops/traefik/.env`, which a fresh checkout lacks | false | The recreate only applies after 4-2's step 2 wrote `.env`, a precondition of this section |
| 8 | edge (claims) | AC 3 says every monitor step is an exact command; the monitor reads name the id and state, not a command | low | As in 4-3's section; the reads are UptimeRobot dashboard or API reads by id. Rejected: cosmetic, no user harm |
| 9 | verification-gap | The `readTimeout` behaviour and the header behaviour are proved by the rehearsal, not by CI | low | CI pins the configuration text; the behaviour needs a live Traefik, which this repository's suite does not run for `ops/traefik/` (4-2's precedent). Rejected: the rehearsal's re-run block is in the record |
| 10 | ponytail | Lean already; the `upstream` helper is used twice and the two new cases each pin one decision | false | No cut available that keeps the pins |

## Design Notes

1. **The runbook lives in `ops/backup-digital-library.md`**, the only record that owns `digital-library`'s operations (its store, restore procedure and cron). The routing mechanism is referenced from `ops/traefik-cutover.md`, not restated. The Operator may overrule.
2. **No compose change and no `digital-library` diff.** Traefik joins `cs-tracker_default`, where the containers already answer as `library-web` and `library-api`. The Operator may overrule.
3. **Only Story 4-2's runbook is a precondition.** `digital-library` has no Postgres; its offsite path is its own R2 job (AD-10's declared exception), so 4-4 and 4-5 need not have run. Action 9 (the 2026-09-24 reinstall) is not a precondition: the move needs a green run of whichever copy is installed. The Operator may overrule.
4. **Two corrections to Story 4-2's stack, not just a confirmation.** The rehearsal showed Traefik replacing the API's `Referrer-Policy` where Caddy adds beside it, and cutting a request body at 60 seconds where Caddy never does. The API router takes its own `library-api-headers` (no `referrerPolicy`), and `websecure` takes `readTimeout: 0`, Caddy's behaviour, rather than a bounded value: the origin firewall admits Cloudflare alone, and no measured upload bound exists to pick a number from. The Operator may overrule either; a bounded value is one line in `ops/traefik/traefik.yml` and the suite's case.
5. **Spec size.** About 1790 tokens at planning (7150 characters over four), over the 1600 the scope standard names; kept by the Operator's instruction of 2026-09-30, relayed by the orchestrator for this named spec.

## Verification

**Commands:**
- `corepack pnpm typecheck`: exit 0
- `corepack pnpm --filter hub build`: exit 0
- `corepack pnpm test --run`: all files pass (DW-135 flakes re-run)
