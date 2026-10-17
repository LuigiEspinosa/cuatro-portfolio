---
title: 'DW-363: the tournament server listens on every address'
type: 'bugfix'
created: '2026-10-17'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** The tournament's standalone Next server binds `process.env.HOSTNAME`, which Docker sets to the
container's name. The container sits on `default` and `cs-tracker_default`, the name resolves to one address of
the two, and after R23's recreate on 2026-10-17 it was the `default` one: Traefik was refused on 3000 and
`tournament.cuatro.dev` answered 502 for three minutes while the healthcheck, which probes the same name, read
healthy (DW-363, `ops/restyle-floor.md` R23).

**Approach:** In `docker-compose.yml` give the `tournament` service `HOSTNAME=0.0.0.0` and make its healthcheck
probe the fixed loopback `127.0.0.1`. Check every other service on two networks that binds its hostname and
apply the same where it is exposed. Prove it locally on two scratch networks, amend
`ops/tournament-placement.md` § Later rollouts, and record the box recreate as a dated Pending Operator action.

</frozen-after-approval>

## Acceptance Criteria

- AC1. Given `docker-compose.yml`, when the `tournament` service is read, then its environment carries
  `HOSTNAME=0.0.0.0` and its healthcheck is the Hub's probe with the host fixed at `127.0.0.1`, reading no
  `process.env.HOSTNAME`; `docker/__tests__/compose.test.ts` holds both and fails the file as it stood.
- AC2. Given the tournament image on two networks, when started as compose starts it (created on one, connected
  to the second before start) with `HOSTNAME=0.0.0.0`, then `/api/health` answers 200 from a client on each
  network and the loopback healthcheck reads `healthy`; without it, one address is refused and the loopback probe
  reads `unhealthy` (the control).
- AC3. Given every other service on two or more networks, when checked for binding its hostname, then each
  exposed one that does gets the same change, and the spec names each one checked.
- AC4. Given `ops/tournament-placement.md` § Later rollouts, when read, then the Traefik probe stays as the
  check and the second recreate is stated unnecessary once the change is on `main`, and § Pending Operator
  actions carries a dated row to recreate the tournament after the epic promotion and probe it from Traefik,
  closing DW-363.
- AC5. Given the root suite, when run with `corepack pnpm test --run`, then it passes.

## Implementation Notes

Files changed:

- `docker-compose.yml`, service `tournament`: `- HOSTNAME=0.0.0.0` with a comment naming DW-363, and the
  healthcheck now `fetch('http://127.0.0.1:3000/api/health')`. The Hub's comment, which explains why its own probe
  follows `process.env.HOSTNAME`, is unchanged: the Hub joins one network only.
- `docker/__tests__/compose.test.ts`, `the tournament services`: the probe case now asserts `HOSTNAME=0.0.0.0` and
  that the probe equals the Hub's with the host replaced by `127.0.0.1`, so the Hub's run cases (200, 503, nothing
  listening, a probe rewritten to pass) still cover its handling, as the tracker's `/api/ready` case does.
- `ops/tournament-placement.md`: § Later rollouts amended; Pending Operator action 8 added.
- `_bmad-output/implementation-artifacts/sprint-status.yaml`: a dated note under `epic-8` (not a retro item).

Services checked (AC3), every service on more than one network or exposed to Traefik:

- `tournament` (`default`, `cs-tracker_default`): standalone `server.js`, binds `process.env.HOSTNAME`. Fixed.
- `tracker` (`estate-postgres`, `cuatro-tracker_default`, `cs-tracker_default`): `apps/tracker/Dockerfile` runs
  `node node_modules/next/dist/bin/next start` with no `-H`, and Next 15.5.13's `next start` takes its hostname
  from `-H` alone (`next/dist/bin/next`, the `start` command has no `.env('HOSTNAME')`), so
  `start-server.js` calls `server.listen(port, undefined)`: every address. Its probe on `process.env.HOSTNAME`
  reaches one of those addresses and answers. Not exposed; unchanged. (`apps/tracker/docker/Dockerfile`, which
  sets `HOSTNAME="0.0.0.0"`, is not the one `image-tracker.yml` builds.)
- `anchor-umami` (`estate-postgres`, `cs-tracker_default`): its image sets `HOSTNAME=0.0.0.0` and its probe is
  already `127.0.0.1`. Not exposed.
- `anchor-app` (`cs-tracker_default` only) and `finance` (`default` only, placed nowhere): one network, so the
  name has one address. Not exposed; unchanged.
- `tournament-worker`, `tracker-worker` and the migrate one-offs serve no traffic through Traefik; Go's server
  listens on every address.

Negative control: with `docker-compose.yml` restored from `HEAD` and the new test in place, the suite failed
`listens on every address and probes /api/health on loopback ...` with
`expected [ '  tournament:', ...(27) ] to include '      - HOSTNAME=0.0.0.0'` (1 failed, 28 passed).

### Local proof (AC2)

Image `ghcr.io/luigiespinosa/tournament:3f8a12e9864fe6e406cdc6575cfb4618b0f5b5f9` (pulled, absent before, removed
after). Networks `epic-scratch-dw363-a` and `epic-scratch-dw363-b`; each container created on `a`, connected to
`b` before start, the healthcheck being the compose probe at a 2 s interval; a client container on each network
fetched `/api/health` on that network's address. Output, 2026-10-17:

```
== epic-scratch-dw363-control: epic-scratch-dw363-a 172.25.0.2, epic-scratch-dw363-b 172.30.0.2, env HOSTNAME=7ded946178d9
  log: - Local:         http://7ded946178d9:3000
  log: - Network:       http://7ded946178d9:3000
  from epic-scratch-dw363-a to 172.25.0.2:3000 -> 200
  from epic-scratch-dw363-b to 172.30.0.2:3000 -> ECONNREFUSED
  health: unhealthy
  probe exit 1

== epic-scratch-dw363-fixed: epic-scratch-dw363-a 172.25.0.3, epic-scratch-dw363-b 172.30.0.3, env HOSTNAME=0.0.0.0
  log: - Local:         http://localhost:3000
  log: - Network:       http://0.0.0.0:3000
  from epic-scratch-dw363-a to 172.25.0.3:3000 -> 200
  from epic-scratch-dw363-b to 172.30.0.3:3000 -> 200
  health: healthy
  probe exit 0

== left over:
```

The control reproduces the box's 502 exactly (one network refused) and shows the loopback probe would have
failed the old service, which is why the environment and the probe change together. Nothing named
`epic-scratch-*` was left. Compose renders the change: `HUB_TAG=x TOURNAMENT_TAG=3f8a12e docker compose --profile
tournament config tournament` prints `HOSTNAME: 0.0.0.0` and the `127.0.0.1` probe.

### Tests

`corepack pnpm vitest --run docker/__tests__/compose.test.ts`:

```
 Test Files  1 passed (1)
      Tests  29 passed (29)
```

`corepack pnpm test --run`, 2026-10-17:

```
 Test Files  6 failed | 74 passed (80)
      Tests  6 failed | 1975 passed | 1 skipped (1982)
   Duration  103.99s
```

The six failures were one case each in the WSL-bash suites DW-135 names (`demo-reset`, `deploy-remote`,
`library-backup`, `postgres-backup`, `tournament-backup`, `tracker-backup`), none of which reads
`docker-compose.yml`. Re-run together, four still failed one case each; re-run alone, one file at a time, every
one passed:

```
== demo-reset       Tests  30 passed (30)
== deploy-remote    Tests  28 passed (28)
== library-backup   Tests  59 passed (59)
== postgres-backup  Tests  20 passed | 1 skipped (21)
== tournament-backup Tests  15 passed (15)
== tracker-backup   Tests  11 passed (11)
```

### Review

The Blind Hunter layer could not launch: this builder runs without a subagent tool. The diff was read in full
before committing instead, and the independent verifier is the review. Checked by hand: the Hub deploy rolls
`anchor-app` alone, so nothing recreates the tournament before action 8; `0.0.0.0` is IPv4 only, which
is what Traefik used: DW-363's evidence has it refused at the IPv4 `172.18.0.9`, and the old bind was an IPv4
address too.

### Operator steps

- `ops/tournament-placement.md` § Pending Operator actions, row 8 (added 2026-10-17): after the epic promotion
  that carries this change reaches `main` and the Deploy has reset the box's checkout, recreate the tournament
  (`$C --profile tournament up -d tournament` with `HUB_TAG` and the running `TOURNAMENT_TAG` exported) and probe
  it from Traefik (`docker exec traefik-ingress-1 wget -q -O /dev/null -S http://tournament:3000/api/health`);
  its readings close DW-363.

## Verification

**Independent verifier, round 1, 2026-10-17: pass with one minor finding.** Re-run from scratch in
`C:/CuatroEcosystem/cuatro-portfolio-wt-dw-363` on `f0ba341`, trusting none of the builder's figures:

- Diff read against `origin/dev` (`9a4817c`): `docker-compose.yml` adds `HOSTNAME=0.0.0.0` to `tournament` and
  fixes its probe at `127.0.0.1`; the compose case asserts both and that no `process.env.HOSTNAME` remains; the
  runbook amendment keeps the Traefik probe as the check and drops the second recreate once on `main`; Pending
  action 8 is dated. No dash or emoji in any added line; the commit is one subject line.
- AC3 checked independently: the tracker's image is `apps/tracker/Dockerfile` (`image-tracker.yml` line 36),
  whose `CMD` is `next start` with no `-H`; in the installed Next 15.5.13, `cli/next-start.js` takes its hostname
  from `options.hostname` alone and the `start` command binds no `HOSTNAME` env, so it listens on every address.
  `anchor-umami` already probes `127.0.0.1` on an image setting `HOSTNAME=0.0.0.0`. `anchor-app` and `finance`
  join one network each. Agreed: only the tournament is exposed.
- Own two-network proof, the image `tournament:3f8a12e9864fe6e406cdc6575cfb4618b0f5b5f9` pulled, each container
  created on `epic-scratch-v363-a`, connected to `epic-scratch-v363-b` before start, health command the new
  compose probe: without the variable, `Network: http://638f79079dfc:3000`, `a` 200, `b` `ECONNREFUSED`, health
  `unhealthy`; with `HOSTNAME=0.0.0.0`, `Network: http://0.0.0.0:3000`, 200 on both, health `healthy`. Every
  `epic-scratch-*` container and network, and the pulled image, removed; none left.
- `HUB_TAG=x TOURNAMENT_TAG=y docker compose --profile tournament config tournament` renders `HOSTNAME: 0.0.0.0`
  and the `127.0.0.1` probe. The four suites reading `docker-compose.yml` (`docker/__tests__/compose.test.ts`,
  `tracker-image.test.ts`, `ops/__tests__/demo-principal.test.ts`, `traefik-config.test.ts`) are in the root run.
- `corepack pnpm test --run` (root): the first run failed ten cases, and the seven its truncated output listed were
  all in DW-135 WSL-bash suites (none reads the compose file); the full suite re-run: `Test Files 80 passed (80)`, `Tests 1981 passed | 1 skipped (1982)`.

Minor finding: the new compose comment, like DW-363's summary, says Docker sets `HOSTNAME` to the container's
name; it is the container's short id (`638f79079dfc` above). The reasoning and the fix are unaffected.
