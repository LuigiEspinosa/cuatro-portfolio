---
title: 'Story 3.4: Deploy by pulling a tag with docker-rollout'
type: 'feature'
created: '2026-09-28'
status: 'done'
route: 'dispatch'
baseline_commit: '7cad0846a7732731191a6b144c08d0146b70b691'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/ops/contract-serving.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** Every deploy compiles the Hub on the serving two-core box: `ops/deploy-remote.sh`, the
deploy key's forced command, runs `docker compose --env-file .env.production up --build -d
--remove-orphans` (KV-1, AD-8), although Story 3-3 pushes `ghcr.io/luigiespinosa/hub:<sha>` from CI
on every push. Nothing orders a deploy after its image, and no step says where a migration runs
(AD-23).

**Approach:** Make the Deploy workflow one chain (gate, image, deploy, report) whose image job calls
`image.yml`, and rewrite the script to install docker-rollout v0.14 from its checksummed release
asset, pull the sha tag, run a declared migration service, roll `anchor-app` with `docker rollout`
and check what then runs. `docker-compose.yml` names the image by `HUB_TAG` and builds nothing.

## Boundaries & Constraints

**Always:**

- The script keeps its path, its refusals and its two ways of reading the sha. The SSH step's string
  is unchanged and ends in the sha, so the `authorized_keys` line needs no edit.
- No `--build`, no `build:` and no compile step reaches the box. The image is
  `ghcr.io/luigiespinosa/hub:<sha>`, never a floating tag, and compose refuses to start without it.
- What can fail for an outside reason (the plugin, the pull) runs before the checkout moves.
- The ref refusal and the Capacity Gate, blocking with both AD-9 rules, run before anything is built.
- Records say committed on `dev`: the workflow is live at the Epic 3 merge, and the script from the
  dispatch after it (Decision 3). KV-1 is never written as retired.

**Never:**

- No push, no merge to `main`, nothing on the box, no GitHub setting, no new secret.
- No rename of `anchor-app`, no change to `anchor-umami`, `anchor-db` or the SSH action.

**Decisions** (unattended run: the orchestrator relayed the Operator's instruction of 2026-09-28 to
finish Epic 3 with the stories as written. Each answers an intent gap from the sources, is
reversible, keeps every gate green, and is an Operator item):

1. **The step name stays "Deploy over SSH to SERVER_HOST".** Story 1-21 replaced "Deploy to
   Hetzner" on 2026-08-17 and named no provider, because the workflow cannot verify where the secret
   points (`ops/known-violations.md` § The naming question). Criterion 1's third clause is met by it.
2. **The service keeps its name, `anchor-app`** (DW-260). The box's Caddyfile routes
   `anchor-app:3000`, and a rename recreates the live container outside any rollout.
3. **The first Deploy run after the Epic 3 merge fails, by design, and a dispatch completes it.**
   The forced command runs the checkout's copy of the script, the Epic 2 one: it resets to the merge,
   and its `up --build` line then stops at `HUB_TAG` before touching a container. The dispatch runs
   the new script. Lifting the forced command for one run would avoid the red run and weaken the key.
4. **A migration is a one-off service, `<service>-migrate`, under the `migrate` profile**, run with
   `docker compose run --rm` after the pull and before the rollout when the file declares it. The Hub
   declares none.
5. **DW-130 is not taken.** The DW-94 amendment keeps the SSH step as it is, and closing DW-130 with a
   pinned `known_hosts` line needs the box's host key, which no session here can read.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Push to `main` | a change beyond Markdown | gate, then the image job pushes the sha tag, then the script: plugin, pull, reset, migration, rollout, check | any failed job: the report job opens an issue |
| Missing image | the sha has no tag in GHCR | the pull fails before the reset; nothing on the box changes | the run fails |
| Plugin absent or another version | `docker rollout --version` is not v0.14 | the asset is downloaded, its sha256 checked, then installed | a mismatch is refused before the pull, and nothing is installed |
| Unhealthy new container | its healthcheck never passes | docker-rollout removes it and the old one keeps serving | the run fails |
| Stopped container | docker-rollout replaces it and exits 0 without rolling | the check reads another image | refused, the run fails |
| Declared migration | `anchor-app-migrate` under `migrate` | it runs after the pull and before the rollout | its failure stops the rollout |
| Refused ref or new id | a dispatch on `dev`; an id outside `placements` while blocked | the gate job fails; nothing is built or deployed | the run fails |
| First run after the merge | the box's Epic 2 script | it resets, then compose stops at `HUB_TAG`; no container changes | the run fails; the Operator dispatches |

</frozen-after-approval>

## Code Map

- `ops/deploy-remote.sh:32-64`: `main` reads and refuses the sha (`:34-47`), runs `git reset --hard`
  (`:53`) and the compose line (`:60`); `main "$@"; exit` sits on one line (`:64`). LF, executable.
- `.github/workflows/deploy.yml`: one job with the ref refusal, a checkout, `setup-node` on 22
  (DW-251), the gate, `appleboy/ssh-action` with the `script: >-` string, an `if: failure()` issue step;
  `concurrency: deploy`, `paths-ignore: '**.md'`.
- `.github/workflows/image.yml`: `push` on `['**']`; job `hub` builds from the root, answers
  `/api/health`, logs in with the job token, pushes `$IMAGE`.
- `docker-compose.yml:23-69`: `anchor-app` with `build:` (`:24-37`) and the healthcheck (`:46-68`: 15 s
  interval, 30 s start period, 5 retries). CRLF worktree.
- docker-rollout v0.14 (read in full): `docker rollout [-f] [--env-file] [-t N] SERVICE`. With no
  container it runs `up --no-recreate` and exits 0; with any stopped container it removes those,
  runs `up --no-recreate` and exits 0, rolling nothing; otherwise it scales to twice with
  `--no-recreate`, waits up to `-t` seconds (default 60) for `healthy`, and on failure stops and
  removes the new containers and exits 1, else stops and removes the old ones. Release asset sha256
  `cdeaba6ae9eee3b0b606286e585bbda6787283d801a6ad6d9b9d2bc347fda05b`, GitHub's digest; MIT.
- `ops/__tests__/deploy-remote.test.ts`: scratch origin A to D and X, a stub `docker` logging
  `$PWD|$*`, the `COMPOSE` literal (`:153`), the workflow block (`:300-333`) reading the first
  `steps:`. `docker/__tests__/compose.test.ts` finds the Hub by its `dockerfile:` and holds
  `context: .`. `docker/__tests__/image-workflow.test.ts:83-85` pins the trigger.
  `ops/__tests__/workflow-hardening.test.ts:60-63,117-123` holds the Node 22 exception and the widened
  jobs. `ops/__tests__/capacity-gate.test.ts:361-389` (gate named, before `ssh-action`, `failure()`
  alone) stays green unchanged.
- Records: `ops/contract-serving.md` § The deploy runs one script (`:513-585`) and Pending Operator
  actions (`:809-831`); `ops/known-violations.md` KV-1 (`:66`, `:77-112`, action 3 `:674`);
  `ops/routing-inventory.md` § Where the deploy goes (`:1613-1685`, DW-263's block);
  `AGENTS.md:143-148`; `README.md:52-72` (CRLF); comments at `apps/hub/Dockerfile:5`, `image.yml:4`
  and both suites' headers.
- Observed 2026-09-28: `main`'s script equals `dev`'s, and the box runs it under the forced command
  since 2026-09-25; an anonymous client read `hub:7cad084...`'s manifest, HTTP 200; `curl` runs on the
  box (`ops/s3-object.sh`). Compose v5.5.1 stops an `up --build` at a `:?` variable, exit 1, no
  container; lists a profiled service under `--profile` alone; prints `{{.Image}}` as the reference.
- DW-251 (the deploy half), DW-260, DW-262 and DW-263 name this story; DW-130 and DW-179 name it as a
  trigger. The next free id is DW-264.

## Tasks & Acceptance

**Execution:**

- [x] `.github/workflows/deploy.yml`: jobs `gate` (ref refusal, checkout, Node 24, gate), `image`
  (`needs: gate`, calls `image.yml`, `contents: read` and `packages: write`), `deploy` (`needs: image`,
  the SSH step unchanged), `report` (`needs` all three, `if: failure()`, `issues: write`): one
  chain, and DW-251's deploy half.
- [x] `.github/workflows/image.yml`: `push` on `['**', '!main']` and `workflow_call`, so `main`'s
  image is built once, by the deploy that needs it.
- [x] `ops/deploy-remote.sh`: after the checks, v0.14 ready or installed (curl, sha256, atomic
  move, re-check), `docker pull` of the tag, reset, `HUB_TAG`, the migration step,
  `docker rollout --env-file .env.production --timeout 120 anchor-app`, refused unless
  `compose ps --format '{{.Image}}'` reads the tag alone.
- [x] `docker-compose.yml`: `anchor-app` takes
  `image: ghcr.io/luigiespinosa/hub:${HUB_TAG:?ops/deploy-remote.sh sets it to the sha it deploys}`
  and loses `build:`.
- [x] `ops/__tests__/deploy-remote.test.ts`: stubs answering `rollout --version`, `config
  --services` and `ps`, and a stub `curl`; each case's command sequence; cases for a failed pull, a
  tampered download, a declared and a failing migration, a failed rollout and another image running;
  the four-job chain.
- [x] `docker/__tests__/compose.test.ts`: the Hub by its image, the tag from `HUB_TAG` with no
  default, no `build:` on any service; the probe run against 200, 503 and a refused port (DW-262).
- [x] `docker/__tests__/image-workflow.test.ts`, `ops/__tests__/workflow-hardening.test.ts`: the
  trigger; three widened jobs; no Node 22 exception for `deploy.yml`.
- [x] Records: `ops/contract-serving.md` (the section, the transition, action 8's report job, a
  merge action), `ops/known-violations.md` (KV-1's closing change and what the Operator confirms;
  action 3), `ops/routing-inventory.md` (the mechanism row, DW-263's procedure), `AGENTS.md`,
  `README.md`, the comments; `deferred-work.md` (close DW-251's deploy half, DW-262, DW-263; note
  DW-130, DW-179, DW-260, DW-261; file DW-264, the one-deploy lag).

**Acceptance Criteria:**

- Given AD-8, when a deploy runs, then it pulls `ghcr.io/luigiespinosa/hub:<sha>` and runs
  docker-rollout v0.14 from a sha256-checked asset, no `--build`, `build:` or compile step reaches
  the box, and a planted `build:`, `--build` or floating tag fails a suite.
- Given a deploy needs its image, when the workflow runs, then the SSH job needs the image job, which
  needs the gate job, so no deploy starts before its tag is pushed.
- Given AD-9, when the workflow runs, then the gate refuses a new id while blocked and passes an
  incumbent whatever the status, before anything is built.
- Given scale-then-drain, when a rollout runs on this host with the real compose file behind Caddy,
  then a request loop sees no failure across it, and a new container that never turns healthy is
  removed while the old one keeps serving. cuatro.dev's continuity is the Operator's, at the merge.
- Given AD-23, when a service declares `<service>-migrate`, then it runs after the pull and before
  the rollout, and its failure stops the rollout; the Hub declares none.
- Given KV-1, when this story closes, then `ops/known-violations.md` names the closing change and
  what the Operator confirms to date the Anchor's half at the merge, and the entry stays `Open`.
- Given the step name, when the workflow is read, then it names no provider, as Story 1-21 left it.

## Implementation Notes

Implemented inline (a workflow sub-agent has no Agent tool), from this spec.

- `deploy.yml`: four jobs as the task says; the SSH step, its name and its string are byte-identical,
  and the issue body now says the log names the job. `image.yml`: the trigger alone changed.
- `ops/deploy-remote.sh`: the refusals untouched; `install_rollout` and the steps after them as the
  task says. The download lands in `~/.docker/`, beside the plugin directory, because docker lists any
  `docker-*` file inside it as a plugin candidate and would warn about a half-written one.
- `docker-compose.yml`: `anchor-app` loses `build:` and takes the `HUB_TAG` image line; the healthcheck
  comment names DW-262's case, and `anchor-db`'s budget comment is put in the past tense, since a
  deploy no longer builds beside it. No service definition other than `anchor-app`'s changed.
- Tests: `deploy-remote.test.ts` 18 cases to 28 (stub `docker` answering three questions, stub `curl`,
  the calls asserted in order); `compose.test.ts` 3 to 9, the probe run under node on `127.0.0.2:3000`
  and the script's image repository held to the file's (review row 4);
  `image-workflow.test.ts` and `workflow-hardening.test.ts` rewritten where the task says.
- Records as the task says. KV-1 stays `Open` and `_not retired_`; its cells say what the Operator
  confirms at the merge.

**Surprises.** (1) docker-rollout v0.14 exits 0 without rolling anything when the service has a stopped
container, which is why the script ends by reading the running image. (2) The forced command runs the
checkout's copy, so the merge's own Deploy run runs the Epic 2 script (Decision 3, DW-264). (3)
actionlint 1.7.7 does not check that a called local workflow declares `workflow_call` (planted and
unreported), so `image-workflow.test.ts` holds the trigger. (4) This shell's heredocs broke on mixed
quotes, as Story 3-3 found, and Git Bash's `sed` reads files in text mode and drops CRs, so edits to
CRLF files went through node scripts written with the Write tool. (5) The matrix's install row had no
unit case for its success half, since the asset's bytes are not in the repository; the case added
writes the stub download's sha256 over the pin in the box's copy, its one change to the script.

**Matrix audit.** Every row has a covering case that ran and passed in the final suite: push to `main`
(the chain and report cases, and the full call sequence in the deploy cases), missing image (stops at
the pull), plugin absent or another version (both refusals and the install case), unhealthy new
container (the failed-rollout case; docker-rollout's rollback itself observed on this host), stopped
container (another image running), declared migration (runs, and its failure stops the rollout),
refused ref or new id (the ref-refusal and chain cases, and `capacity-gate.test.ts`), and the first run
after the merge (`compose.test.ts` holds the `:?` guard that stops the Epic 2 line; the line itself was
run on this host).

## Spec Change Log

**2026-09-28, fix round 1, after the independent verification, which passed.** It returned two minor
findings, both taken as corrections to the records and to one suite comment; no workflow, script,
compose or product file changed, and no assertion either. Verification and Design Notes state neither
corrected claim, so neither changed.

1. Two Story 3-3 amendments said `image.yml` builds the image on every push: the "Reaches production
   by" row in `ops/contract-serving.md`, and `ops/token-contract.md`'s note on what the `deps` check
   does not do, with its action 5. Since this story it runs on a push to any branch but `main`, and
   from the Epic 3 merge a push to `main` builds only through `deploy.yml`'s `image` job, before every
   deploy. Each now carries a dated Story 3-4 amendment saying so, and `image-workflow.test.ts`'s
   header, which contradicted its own trigger bullet, says the same (`353333e`).
2. `ops/contract-serving.md` Pending Operator action 11 said nothing on the box is needed first, which
   holds only while the package stays public, an open Operator ruling since Story 3-3. § The deploy
   pulls a tag and rolls it now says so and gives the `deploy` user's GHCR login, with a personal
   access token (classic) scoped `read:packages` alone and kept in the gitignored `.env`, and action 11
   runs it before its dispatch if the ruling makes the package private first (`92b7ec6`). This takes
   review row 12, which pass 1 rejected, as a record: the script still logs in to nothing.

Observed on this tree, over `ff16632`: an anonymous registry token read the manifests of
`hub:7cad084...` and `hub:38f9a28...`, HTTP 200 each, so the package is still public; the login's
extraction, its `sed` and `tr` run on a throwaway file in CRLF and in LF, gave the value's bytes
alone; GitHub's Container registry documentation names a personal access token (classic) and the
`read:packages` scope for a pull; `grep -rn 'every push' ops/*.md docker/__tests__/image-workflow.test.ts`
finds `image.yml` said to build on every push only in the Story 3-3 text each new amendment follows;
`corepack pnpm typecheck` exit 0; `corepack pnpm --filter hub build` exit 0 (11 files published,
Next.js 16.2.1, the same six routes), and the root's `corepack pnpm build` exit 1, "Command "build"
not found", as Story 3-2 designed; `corepack pnpm test --run` exit 0, "Test Files 66 passed (66)",
"Tests 1683 passed (1683)"; `node ops/contract-purity.mjs`, `node ops/registry-schema.mjs` and
`node ops/literal-conformance.mjs` exit 0.

## Review Triage Log

Pass 1, 2026-09-28, over a 135 kB diff (Blind Hunter floor: the square root of 132.3 kB plus one is
12.5, capped at 10). Every layer ran inline in this session, which has no subagent tool, so none is
independent. No `intent_gap` or `bad_spec`, so no loopback; `review_loop_iteration` stays 0.

| # | Layer | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | Blind | Called from `deploy.yml`, `image.yml`'s top-level `permissions: contents: read` could cap the `hub` job's `packages: write` | false | GitHub's reusable-workflow reference: a called workflow may only narrow the caller's token, and the `image` job grants `contents: read` and `packages: write`, the `hub` job's own block; a job-level block replaces the workflow-level one, which is how Image run 36507763627 pushed from the same file | reject |
| 2 | Blind | A job past its `timeout-minutes` may conclude `cancelled`, so the report's `if: failure()` would skip a hung image build | maybe-false | Settled by one throwaway run of a timed-out job and a dependent `failure()` job, which this session cannot push; medium if true | defer, DW-265 |
| 3 | Blind | The plugin download has no retry, so one transient GitHub error fails the merge's deploy | low | Real; one flag fixes it | patch: `--retry 3` |
| 4 | Blind | The script's `REPOSITORY` and the compose file's image repository are two literals held by separate suites, so renaming one ships a deploy that rolls one image and refuses on another | low | Real; DW-260's pending ruling on the Hub's one id is the rename that would meet it | patch: `compose.test.ts` holds the two equal; a planted second name failed it, 1 of 9 |
| 5 | Blind | The README says a push to `main` deploys itself, and a Markdown-only push does not | low | Real, `paths-ignore` | patch: the exception named |
| 6 | Blind | A dispatch redeploy rebuilds the sha's image and re-pushes its tag at a new digest | low | Real and harmless: the tag still names the commit (AD-3), and skipping a present tag adds a branch | reject |
| 7 | Blind | `127.0.0.2` does not bind on macOS | low | No macOS host in the estate: CI is Ubuntu, and it bound on this Windows host | reject |
| 8 | Blind | The `deploy` job sets no `timeout-minutes` | false | The pinned `ssh-action`'s 10-minute command timeout bounds the step, above a pull and a 120 s health wait | reject |
| 9 | Blind | A hand run beside a workflow run can interleave two rollouts | low | Pre-existing and recorded, `ops/contract-serving.md` "Two limits, stated" | reject |
| 10 | Blind | The merge's own Deploy run fails and opens an issue the Operator must expect | low | By design, Decision 3; action 11 and DW-264 say so | reject |
| 11 | Blind | A README-only push changes the image and deploys nothing | low | Pre-existing, DW-93's `paths-ignore` | reject |
| 12 | Blind | Pulls rest on the package staying public | low | The pull fails before the reset and the box is unchanged; visibility is an open Operator ruling since Story 3-3 | reject |
| 13 | Edge | docker-rollout's no-container and stopped-container paths skip the health wait, and the check reads the image alone | low | Real; the path starts from a box already serving nothing, which the restart policy and UptimeRobot report, and a wait loop is more than a direct correction | reject |
| 14 | Edge | `compose.test.ts`'s server has no `error` handler, so a taken port hangs to the timeout instead of naming the cause | low | Real | patch: the promise rejects on `error` |
| 15 | Edge (claim) | "`main`'s image is built once": a dispatch builds the same sha again | low | Real for the wording | patch: `image.yml`, `ops/contract-serving.md` and the suite header say no push builds it twice |
| 16 | Edge (deletion) | `--remove-orphans` is gone, so a service later removed from the file keeps running | low | Recorded in § The deploy pulls a tag and rolls it; a deploy names one id (AD-7) | reject |
| 17 | Edge (deletion) | `compose.test.ts` no longer holds the build context `.` | false | The context is `image.yml`'s now, where a wrong one fails the Image build in CI at the prune (Story 3-3 observed it); nothing reaches the box | reject |
| 18 | Verification gap | The chain's `image` job, `image.yml` through `workflow_call`, first runs at the Epic 3 merge | medium (pre-verified) | As filed: no push or dispatch before the merge reaches the call | defer, DW-266; action 11 names its failure |
| 19 | Verification gap (other) | `ops/routing-inventory.md` § 5's two Anchor `config --services` lines stop at `HUB_TAG` from the merge | medium | Real: a procedure Epic 4's rebuild runs, and the same interpolation stopped the `up` line on this host | patch: a dated amendment with the working command |
| 20 | Verification gap (other) | `ops/contract-serving.md:296-303` and `ops/routing-inventory.md:1118` say in the present tense that the Anchor's deploy builds on the box | low | Real, false from the merge | patch: dated amendments |
| 21 | Ponytail | `compose.test.ts`'s five-line map repeats one message | low | Real | patch: an inline ternary |
| 22 | Ponytail | The migration hook serves a schema nobody owns | false | Story 3.4's AD-23 criterion asks for the shape "the later merges inherit" | reject |
| 23 | ECC | The layer's literal build, `corepack pnpm build`, exits 1 at the root | medium | Observed, "Command "build" not found", DW-259's claim; the phase ran `corepack pnpm --filter hub build` per `AGENTS.md` | defer, DW-259 already filed |
| 24 | ECC | None else: the Hub build exit 0, types 0 errors, 1682 of 1682, no secret pattern or `console.log` in 1011 added lines, lint N/A | none | Observed on the tree reviewed | none |
| 25 | Design Review | No `.scss` or `.tsx` changed; the one keyword hit is the word "transition" in this spec's prose | none | The layer's own first check | none |

After the patches: `corepack pnpm typecheck` exit 0, `corepack pnpm --filter hub build` exit 0, the
three node gates exit 0, shellcheck exit 0, and `corepack pnpm test --run` "Test Files 66 passed (66)",
"Tests 1683 passed (1683)".

## Design Notes

**Oversized, kept.** At the plan checkpoint the spec measured about 3,430 tokens (13,718 characters
over four; 2,039 words) against the SCOPE STANDARD's 1600. Answer **Keep**, relayed by the
orchestrating workflow on 2026-09-28 as the Operator's instruction of that day to finish Epic 3
unattended with the stories as written, the answer the unattended Epic 2 run used on 2026-09-23. The
multi-goal check found one goal: the chain, the script, the compose file and the records are one
deploy path, and the migration step and KV-1's record are its own criteria.

**Open Questions, answered from the sources.** Five intent gaps, answered as Decisions 1 to 5 from
`epics.md` Story 3.4 and its DW-94 amendment, AD-8, AD-9, AD-20 and AD-23, `ops/known-violations.md`,
`ops/contract-serving.md`, `ops/routing-inventory.md` and DW-130, DW-260 and DW-263, per the
orchestrator's standing instruction. None is irreversible.

**Pull before reset.** The old script reset first, so a failed build left the checkout ahead of the
running container. The plugin and the pull are the two steps that fail for an outside reason, so
both run first, and such a failure leaves the box exactly as it was.

**Why the plugin check is by version.** `docker rollout --version` printing
`docker-rollout version v0.14` skips the install; anything else downloads the asset, checks it
against the pinned sha256, installs it and asks again. The sha256 guards the supply chain; the
installed file is writable only by `deploy`, whose holder already controls the box. The suite can
then run the real script, since no case needs the asset's bytes.

**The verification step.** docker-rollout exits 0 without rolling when the service has a stopped
container, so the script ends by reading which image the service runs.

## Verification

**Commands:**

- `corepack pnpm typecheck`: exit 0.
- `corepack pnpm --filter hub build`: exit 0. The root's `corepack pnpm build` exits 1,
  "Command "build" not found", by Story 3-2's design; both are run and quoted.
- `corepack pnpm test --run`: exit 0 over the whole suite, re-run once on an empty-output
  WSL failure (DW-135).
- `node ops/contract-purity.mjs`, `node ops/registry-schema.mjs`, `node ops/literal-conformance.mjs`:
  exit 0.

**Manual checks:**

- The script's install path in a scratch home on this host: the real asset installs and
  `docker rollout --version` reads v0.14; a tampered download is refused and nothing is installed.
- The real `docker-compose.yml` on this host's Docker, the external network created locally, images
  tagged locally, Caddy proxying `anchor-app:3000`: a request loop across `docker rollout` sees 200
  alone and the service ends on the new tag; with a new image that serves nothing, the rollout exits
  1, the new container is removed and the loop still sees 200 alone.
- The Epic 2 script's compose line against the new compose file: exit 1 at `HUB_TAG`, no container.
- A planted `build:`, `--build`, floating tag or probe that exits 0 on a refused port fails its suite.

**Observed** on 2026-09-28 on this host (Windows 11, Node v24.15.0, pnpm 10.31.0, Docker 29.8.1,
Compose v5.5.1) over `7cad084` plus the working tree, unless a line says otherwise.

- `corepack pnpm typecheck` exit 0. The root's `corepack pnpm build` exit 1,
  "ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "build" not found", as Story 3-2 designed;
  `corepack pnpm --filter hub build` exit 0, "packages/contracts-serve: published 11 files at
  /contracts/", "Next.js 16.2.1 (Turbopack)", routes `/`, `/_not-found`, `/api/health`, `/celeste`,
  `/cv`, `/work`.
- `corepack pnpm test --run` exit 0, "Test Files 66 passed (66)", "Tests 1683 passed (1683)", on the
  final tree (1667 at Story 3-3's; 1681 before the install case, 1682 before the review's patches).
- `node ops/contract-purity.mjs` "11 files, none executable and no link (AD-1)."; `node
  ops/registry-schema.mjs` "16 applications, valid"; `node ops/literal-conformance.mjs` "read 25
  stylesheets ... no colour, spacing or type literal outside it". All exit 0.
- `rhysd/actionlint:1.7.7` over both workflows: "Found 0 errors in 2 files". `koalaman/shellcheck:v0.11.0`
  at style severity over the final script: exit 0, nothing printed.
- The real asset: GitHub's API gave the v0.14 release (2026-07-12) one asset, `docker-rollout`, 9076
  bytes, digest `sha256:cdeaba6a...`; the downloaded asset and the tag's source both hash to it; MIT.
  The script read in full before use.
- The script as the box runs it, in a `docker:29-cli` container with bash, git, curl and coreutils,
  the host's daemon through its socket, no credentials, a scratch origin whose `main` carries the
  script, the checkout at its first commit and the target its second: "deploying ed5a160..., read from
  its argument", the asset downloaded, `sha256sum` equal to the pin, 9076 bytes in
  `~/.docker/cli-plugins/`, `docker rollout --version` "docker-rollout version v0.14", then the pull
  "ghcr.io/luigiespinosa/hub:ed5a160...: not found", exit 1, the checkout still at the first commit. Run
  again with every `curl` failing: the same, and zero `curl` calls. After the download was moved beside
  the plugin directory, run once more from a fresh home: the same, and `~/.docker` holding
  `cli-plugins` alone.
- The rollout, with the real `docker-compose.yml`, a local `cs-tracker_default` network and `caddy:2`
  proxying `anchor-app:3000` as the box's `cuatro.dev` block does: `ghcr.io/luigiespinosa/hub:38f9a28...`
  and `:7cad084...` pulled with no credentials; the Hub started on the first, healthy; then
  `HUB_TAG=7cad084... docker rollout --env-file .env.production --timeout 120 anchor-app` printed
  "Scaling 'anchor-app' to '2' instances", "Waiting for new containers to be healthy (timeout: 120
  seconds)", "Stopping and removing old containers", exit 0 after 7 s, the service running
  `anchor-app-2` on the second tag. Then to an image built from the second with a command that serves
  nothing: exit 1 after 134 s, "New containers are not healthy. Rolling back.", the serving container's
  id the same before and after. Two request loops through Caddy across both, `/api/health` and `/`,
  about eight requests a second each: 1305 and 1201 requests over 158 s, every one 200; `uptime` fell
  from 21 to 5 at +12 s, where the new container took over.
- The Epic 2 script's line, `docker compose --env-file .env.production up --build -d --remove-orphans`,
  with `HUB_TAG` unset against the new compose file: "error while interpolating services.anchor-app.image:
  required variable HUB_TAG is missing a value: ops/deploy-remote.sh sets it to the sha it deploys",
  exit 1, the running container's id unchanged. Every container, network and image the rehearsal made
  was removed afterwards; `caddy:2` and `rhysd/actionlint:1.7.7` were on this host before it and stay.
- Planted in the real files, each suite run and the file restored byte-identical: `build: .` on the Hub
  (compose, 2 of 8 failed), `${HUB_TAG:-latest}` (2 of 8), the probe's `.catch` exiting 0 (2 of 8), the
  Epic 2 `up --build` line in place of the pull (deploy, 9 of 27), the deploy job needing the gate (1 of
  27), `image.yml` without `workflow_call` (image workflow, 2 of 5); on the final suite, the install's
  `mv` removed (the install case alone failed, 1 of 28) and its sha256 check removed (both refusal cases
  failed, 2 of 28).

**Not observed in this run, and why:** the Deploy chain itself, whose first run is the Epic 3 merge,
the first time `image.yml` runs through `workflow_call`; the Epic 2 script failing on the box and the
dispatch that follows; and `cuatro.dev` served across a real rollout. All three are the Operator's at the
merge (`ops/contract-serving.md` Pending Operator action 11). Lighthouse and the rendered-output suite
were not run: no Hub source changed, and neither reads a file this story changed.
