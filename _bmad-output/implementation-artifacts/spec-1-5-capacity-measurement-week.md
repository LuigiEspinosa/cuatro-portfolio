---
title: 'Capacity measurement week'
type: 'feature'
created: '2026-08-17'
status: 'done'
baseline_commit: '454f031d4d621fa15c331a79edb6016c9a33ad1e'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/ops/capacity-gate.yml'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** `ops/capacity-gate.yml` carries `measured_at`, `baseline` and `reading` empty, and nothing on `177.7.52.248` samples per-container footprint. `sysstat` collects at box level only, so the estate cannot say what any single application costs, and Story 1-6 has no measurement to derive a threshold from. AD-9 names per-container `cpu.pressure` as the diagnostic that attributes pressure to one application rather than to the box, and nothing captures it.

**Approach:** Install a one-minute sampler on the box under a systemd timer, reading cgroup v2 counters and `/proc/loadavg` directly into CSV, and commit a dependency-free summarizer that turns that CSV into per-day aggregates. This session builds, installs, verifies and starts the week. The week runs unattended for seven days, and a close-out session summarizes it into `ops/capacity-measurement.md` and fills the three gate keys.

## Boundaries & Constraints

**Always:**
- The sampler is a guest on a production box: `Nice=10`, idle IO scheduling, cgroup reads rather than `docker stats`, and its own cost measured and written into the record rather than assumed negligible.
- Counters are recorded raw and cumulative. The summarizer derives rates from real elapsed time, so a missed sample understates nothing and a container restart is detected rather than averaged in.
- Every container is sampled, infrastructure included. Which ids the gate governs is `placements`, a separate question from what consumes the box.
- Dates are ISO 8601 UTC. The box is `Etc/UTC`, so no conversion is involved.
- Decided state is never written as observed state (NFR-9): the record marks each value as one or the other.
- Prose carries no em-dash, no en-dash used as a dash, no double-dash standing in for a dash, and no emoji. The commit is a subject line only, no body and no trailer.

**Ask First:**
- Before generating artificial load. The week measures what the estate actually does, and a synthetic burst on a serving two vCPU box is the Operator's decision.
- Before adding any package to the box, or any dependency to the repository.

**Never:**
- Never write `threshold`, and never move `status` off `blocked`. Story 1-6 opens the gate.
- Never change `ops/capacity-gate.mjs` behaviour. Its reader takes `baseline` and `reading` as scalars, so structured detail belongs in `ops/capacity-measurement.md`, not in a nested key it would refuse.
- Never touch the shared `/home/deploy/cs-tracker/Caddyfile`, the `DOCKER-USER` chain, or any running container.
- Never claim a rendered-output or browser check. Playwright arrives in Story 1-10.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Normal sample | Timer fires, 14 containers up | One row per container plus one box row, all sharing one timestamp | N/A |
| Container recreated | Deploy replaces a container, cgroup id changes, counters restart at zero | Summarizer segments by `(container, cgroup)`, never emits a negative delta | Segment boundary, not a data point |
| Missed samples | Gap larger than one interval | Rates divide by real elapsed time, gap reported per day | N/A |
| New container appears | An id absent from earlier days | Included from its first sample, partial coverage stated | N/A |
| Docker unreachable | `docker ps` fails during a sample | Box row still written, container rows skipped and marked | Sampler exits non-zero, timer continues |
| Single-sample segment | Fewer than two samples | No rate emitted for it, and the summary says so | Never divide by zero |
| Empty input | Zero rows | Exit non-zero naming the file | Fail loudly |

</frozen-after-approval>

## Code Map

Gathered 2026-08-17 over SSH as `deploy@177.7.52.248` against `454f031`, read-only.

- **Reaching the box.** The Windows OpenSSH client holds no key for it. Every command runs through WSL, as `wsl -d Ubuntu-22.04 ssh deploy@177.7.52.248 '<command>'`, or by piping a heredoc into `ssh deploy@177.7.52.248 'bash -s'` from a script under WSL. Note that `wslpath` mangles Windows paths passed from PowerShell, so use the `/mnt/c/...` form directly. `deploy` is in `docker` and `sudo` with passwordless sudo.
- **PSI is on and readable without sudo.** `/proc/pressure/cpu` exists, and each container has `/sys/fs/cgroup/system.slice/docker-<full-id>.scope/` carrying `cpu.stat` (`usage_usec`), `cpu.pressure` (cumulative `some` and `full` totals) and `memory.current`. Docker is cgroup v2 with the `systemd` driver, so that path shape is stable.
- **The box:** 2 vCPU, 7.9 GB, 72 GB free, `Etc/UTC`, NTP active, load 0.39 / 0.21 / 0.13 when probed. 14 containers across four compose projects plus Umami and three databases, all `unless-stopped`.
- **`sysstat` already collects box-level history** every 10 minutes, so `sar -q` corroborates load average but attributes nothing. That gap is what this story fills.
- **Install precedent:** `/usr/local/sbin/cf-origin-firewall.sh` plus a unit, left by Story 1-3 and recorded at `ops/bot-mitigation.md:139`. That script was never committed; this one is, because a summarizer outside the repository cannot be tested.
- `ops/capacity-gate.yml:23-27`: the three keys this story fills at close-out, and `status: blocked`.
- `ops/capacity-gate.mjs:25`: `baseline` and `reading` are `SCALAR_KEYS`, so any nesting under them is refused. `:179` refuses `open` without a threshold, so nothing here can open the gate by accident.
- `ops/__tests__/capacity-gate.test.ts`: the layout and dependency-free style the new test follows. `vitest.config.ts` has no `include` filter, so a new file under `ops/__tests__/` is collected with no config edit. `tsconfig.json:34-41` excludes `.mjs`, so the summarizer is untypechecked and its test carries the contract.
- `ops/bot-mitigation.md:295`: mitigation applied **2026-08-17T18:14Z**, so a week started now is post-mitigation, which is what AD-9 and Story 1.3's ordering require.
- **Likely source of the loaded footprint:** `deploy.yml` runs `docker compose up --build -d` on the box (the standing AD-8 violation), so a merge to `main` compiles on the serving box. This work is on `dev`.
- Read-only sources: `epics.md:1273-1305` (this story), `ARCHITECTURE-SPINE.md:130-134` (AD-9).

## Tasks & Acceptance

**Execution:**
- [x] `ops/capacity-sampler.sh` -- the sampler: one timestamp per run, a box row (`load1`, `load5`, `load15`, `/proc/pressure/cpu` totals, `MemAvailable`) and one row per container (`container`, `cgroup`, `usage_usec`, `some_total`, `full_total`, `memory_current`). Names come from `docker ps --no-trunc` each run, because a redeploy changes ids.
- [x] `ops/capacity-sampler.service`, `ops/capacity-sampler.timer` -- the units, `OnUnitActiveSec=60`, `Nice=10`, idle IO class, `User=deploy`. Committed rather than only described, so the install is reproducible.
- [x] `ops/capacity-summary.mjs` -- the summarizer: per day and per container, mean and peak CPU as a share of one core and of the box, mean and peak memory, PSI `some` as a share of wall time, plus box load15 quantiles, an idle floor, a loaded band, and which container dominates under load. Emits the record's markdown block and the two scalars the gate needs.
- [x] `ops/__tests__/capacity-summary.test.ts` -- one case per matrix row, on fixture CSV strings.
- [x] Box install -- script to `/usr/local/sbin`, units to `/etc/systemd/system`, `/var/log/cuatro-capacity` owned by `deploy`, timer enabled, three consecutive samples confirmed.
- [x] `ops/capacity-measurement.md` -- the record: method, what is sampled and at what cost, where the raw files live, the exact start timestamp, the close-out procedure, and the named limits.

**Acceptance Criteria:**
- Given AD-9 names per-container `cpu.pressure` as the attribution diagnostic, when a sample is inspected on the box, then every running container has a `cpu.pressure` reading and a CPU counter in the same row, and the box's 15-minute load average carries the same timestamp.
- Given the sampler measures a box it also runs on, when the record is written, then it states the sampler's observed CPU cost per run rather than asserting that it is small.
- Given this story measures and does not open the gate, when `ops/capacity-gate.yml` is read after close-out, then `status` is still `blocked`, `threshold` is still empty, and `measured_at` carries the UTC date the week closed.
- Given the week cannot complete inside this session, when the build finishes, then the timer is enabled and confirmed firing, the record names the close-out date and the exact commands, and the story is left awaiting the Operator rather than reported as done.

## Spec Change Log

### Execution findings, 2026-08-17

**1. The week is running.** First timer sample `2026-08-17T20:59:52Z`, one sample a minute, 16 rows each (one box row, 14 containers, one sampler row). Earliest close-out `2026-08-24T21:00Z`. The timer is `enabled` and `active`, the last run reports `Result=success`, and the three installed files are byte-identical to the committed ones by `sha256sum`.

**2. The layout is one file per UTC day, not the two files the tasks implied.** `/var/log/cuatro-capacity/capacity-YYYY-MM-DD.csv` carries box, container, sampler and note rows distinguished by a `kind` column, on one twelve-column schema. One schema means the summariser has one parser and one field-count check rather than two that can drift apart, and a day boundary is a file boundary, which is what makes a partial week readable.

**3. The pipeline was verified end to end against real data, not fixtures.** 219 samples over 221 minutes pulled off the box and summarised: exit 0, no negative rates, container CPU 3.0% of the box mean and 3.4% peak, `cs-tracker-db-1` dominant at 1.2% of one core, 1.20 GiB container RSS. The two scalars it printed parse cleanly through `ops/capacity-gate.mjs`, which is asserted as a test rather than left to the close-out session to discover.

**4. Defect found by that run, and it compounds over seven days.** The report reads `2 samples were missed, in 0 gaps totalling 0 seconds`, which contradicts itself. `missedSamples` compares the observed count against `floor(span / interval) + 1`, but `OnUnitActiveSec=60` measures from the previous activation, so each cycle is 60 seconds plus the run's own duration and the samples drift. Over 221 minutes that drift alone accounts for both allegedly missed samples: nothing was missed. Extrapolated to a full week the report would claim roughly 70 missed samples against zero gaps. The gap detector, which compares real elapsed time against twice the interval, is correct and reports nothing. This is a reporting defect in `ops/capacity-summary.mjs`, not a sampling one, so the week's data is unaffected either way.

**5. The punctuation sweep passed only on its second attempt, and the first pass was vacuous.** The initial pattern used `\u{1F300}` syntax, which .NET rejects, so `Select-String` errored on every file while still printing `clean` for each. The rebuilt sweep runs one alternation rather than two patterns, because `Select-String` reports a line against the first pattern that matches it and would have hidden an emoji sitting on the same line as an em dash. It runs against a positive control carrying all three forbidden characters and reports clean only when that control reports three hits.

### Review findings, 2026-08-18

Three review layers ran against the diff. No finding reached the frozen block, and none was a
spec-level defect: the intent, boundaries and matrix all held. Every finding below was caused by
this change and fixed in place, so nothing was reverted or re-derived. Three findings were real but
belong to no story yet and went to `deferred-work.md`.

**6. The story's central deliverable was committed as a binary file and could not be reviewed.**
`ops/capacity-summary.mjs` carried five literal NUL bytes at offsets 6560, 6572, 6586, 13807 and
14126, used as key separators inside three template literals. Git classifies a file with a NUL as
binary, so the arithmetic the capacity threshold will be derived from arrived in review as
`Binary files ... differ` with no content, would produce no line-level history, could not be
three-way merged, and is skipped by every repository-wide search. Found independently by two of
the three layers. Replaced with `\u0000` escapes, which is byte-identical in behaviour, and the
file now diffs as 860 lines of text. Verified before and after by counting NUL bytes directly.

**7. A correct close-out would have turned CI red, and this file told the operator to read that as
proof the edit was wrong.** `ops/__tests__/capacity-gate.test.ts` asserted `measured_at`,
`baseline` and `reading` were all empty on the committed gate, which was true for Story 1-4's
moment and stops being true the instant this story's close-out runs. The reviewer applied the exact
prescribed edit and got `1 failed | 45 passed`. Seven days from now, with nobody present who wrote
either file, the obvious response to that red is to revert the measurement the week was run to
produce. The test is now narrowed to the invariant AD-9 actually names, `status: blocked` with an
empty `threshold`, and gained a case proving a gate with all three measurement keys filled still
refuses a new id and still passes an incumbent. Verified by applying the real close-out edit to the
real file: 47 passed, then restored.

**8. The `missedSamples` defect from execution finding 4 is fixed, and pinned.** A reviewer
reproduced it at full scale: a synthetic week at the real 60.9 second cadence with no holes at all
reported `151 samples were missed, in 0 gaps totalling 0 seconds`. Every fixture in the suite was
spaced exactly 60,000 ms apart, so no test could ever see drift. `missedSamples` is now derived
from the gaps themselves, and `expectedBoxSamples` from what was observed plus what a gap proves is
absent, so the two halves of that sentence cannot contradict each other. Both original assertions
still hold. Two regression tests were added: a 60-sample drifted run must report zero missed and
zero gaps, and no summary may ever claim a missed sample without a gap to evidence it. Re-run
against the same real 219-sample data that produced the contradiction, the report now reads
`219 box samples against 219 expected ... No samples were missed.`

**9. The record claimed a drift guarantee that nothing enforced.** It said the twelve-column schema
is "defined once in `ops/capacity-sampler.sh` and asserted in the test so the two cannot drift
apart". The test asserted the summariser's own `HEADER` constant against a hand-written array and
never read the shell script, which is the one component installed outside the repository and the
one file `tsconfig.json` cannot typecheck. A rename in the script, or a comma added to any row
template, would have produced a week of files the parser refuses wholesale while CI stayed green
until close-out day. Two tests now read `ops/capacity-sampler.sh` itself: its `SCHEMA=` literal must
equal `HEADER`, and every `rows+=(...)` template must carry exactly twelve fields. Both were
mutation-checked, renaming a column and adding a field, and each mutation fails a test.

**10. A fresh clone would have shipped a broken sampler to the box.** `core.autocrlf` is `true` on
this machine and the repository had no `.gitattributes`, so a checkout would hand `scp` a CRLF
shell script, which bash rejects with `$'\r': command not found`, and CRLF unit files, which
systemd mis-parses. The working copy happened to be LF, so the install that already ran was fine
and the trap was invisible. A narrow `.gitattributes` now pins `*.sh`, `*.service`, `*.timer` and
`*.mjs` to LF. Deliberately narrow: a repository-wide `text=auto` would renormalise files no story
has touched.

**11. Two unit defects, both of which would surface only once something had already gone wrong.**
Exit 4, the documented "Docker was unreachable so the box row stands alone", marked the service
`failed`, and `systemctl status` is exactly what the close-out reads to decide whether the week
ran, so one transient hiccup would have made a real failure indistinguishable from a good week.
`SuccessExitStatus=4` fixes that while leaving exit 3, an unwritable log, a genuine failure. And
`ProtectSystem=strict` with a bare `ReadWritePaths` makes systemd refuse to start a unit whose
target directory is missing, which left the script's own `mkdir -p` and its documented exit 3
unreachable from the timer. Now `LogsDirectory=cuatro-capacity`, so systemd creates and owns the
directory and recreates it if it is removed. The unit was reinstalled on the box mid-week without
interrupting sampling: verified by checksum, by `Result=success`, and by a sample landing on the
following minute.

**12. The close-out commands could not have run as written.** Step 2 used `mkdir -p`, which is not
a PowerShell flag, and handed a Windows-relative destination to a WSL binary. Step 3 relied on
PowerShell expanding `capacity-week/capacity-*.csv` for a native command, which it does not do, so
the literal pattern would reach the summariser and fail with "could not be read". Both were run to
confirm the failure and then the fix, rather than reasoned about. The record now carries the
expanded form and states both traps.

**13. Smaller fixes.** The record's sampler-cost paragraph said 0.073 CPU seconds per run is "about
7.4 CPU seconds an hour"; it is 4.4, and that is precisely the class of number the file exists to
make defensible. The cost table's 88 ms peak came from the by-hand run, which has no service cgroup
and therefore falls back to `/proc/self/stat`, a different instrument from the cgroup reading every
timer run uses, and the record now says so instead of quoting one range across two instruments.
Every load fixture wrote the same value into `load1`, `load5` and `load15`, so a transposition of
the three columns would have left the whole suite green while the record reported a one-minute
average as the fifteen-minute one the gate is derived from; the three are now distinct. A mid-week
check was added, because nothing outside the box watches the sampler and a week that dies on day
three looks exactly like a week that ran.

**14. Rejected, with reasons.** A reviewer argued the timer could never fire, since
`OnUnitActiveSec` has no previous activation to measure from and there is no `OnActiveSec`. It does
fire: on a box booted long ago the `OnBootSec` moment is already past, so systemd triggers on
enable, and on a fresh boot `OnBootSec=2min` covers it. Observed both in the install and in every
minute since. The reasoning is now written into the record so it is not re-litigated. Two further
findings were rejected as not this story's: the sprint board's 1-4 transition was pre-existing
bookkeeping, and the infrastructure identifiers in `ops/` follow the pattern `estate.md`,
`monitoring.md` and `routing-inventory.md` already set rather than being introduced here.

**15. One process deviation, recorded rather than hidden.** The workflow requires all three review
layers to be launched before any of their output is read, so that triage is not anchored by
whichever returns first. I launched the first layer alone and read its findings before launching the
other two. The overlap between the three was high and the two strongest findings, the binary file
and the gate-test collision, were each raised independently by more than one layer, so the anchoring
risk appears not to have bitten. It is recorded because the check against it is the ordering, not
the outcome.

## Design Notes

**Why counters and not rates.** `docker stats` reports a rate over an interval it chose, costs an API round trip per container, and cannot distinguish a missed sample from an idle minute. Cumulative microseconds let the summarizer divide by observed elapsed time, so a gap becomes visible rather than silently smoothed, and a sample costs a few file reads.

**Why `(container, cgroup)` and not `container`.** A deploy recreates a container under the same name with a new cgroup and counters starting at zero. Keyed on name alone that reset reads as a large negative delta, or is clamped to zero and quietly discards the busiest minutes of the week, which are exactly the minutes the peak reading exists to capture.

**Why the loaded band is a percentile.** Picking a load number now would smuggle in the guess Story 1-6 is meant to derive. Idle is the lowest decile of load15 and loaded the highest, so both footprints come out of the data rather than out of a constant chosen before the data existed.

## Verification

**Commands:**
- `corepack pnpm test --run`. Expected: the 102 tests at `454f031` plus the new file, all passing.
- `corepack pnpm typecheck`. Expected: pass.
- `bash -n ops/capacity-sampler.sh`. Expected: clean parse.
- On the box, `systemctl status capacity-sampler.timer` plus three consecutive samples. Expected: active, one row per running container per minute, timestamps strictly increasing.
- `node ops/capacity-summary.mjs` against the first minutes of real data. Expected: a plausible table, no negative rates, coverage reported as minutes rather than as a claimed week.
- Sampler cost from the unit's own `cpu.stat` after ten runs, converted to CPU seconds per run, written into the record.
- Punctuation sweep over every file written, using regex escapes rather than literal characters, checked against a positive control so it cannot pass vacuously.

**Manual checks:**
- Confirm `ops/capacity-gate.yml` is byte-identical after the build.
- Confirm the timer's next elapse is a minute out and `/var/log/cuatro-capacity` is owned by `deploy`.

## Suggested Review Order

**What the week is actually measuring, and what makes it citable**

- The schema every row is written on. Twelve columns, one shape, no computation on the box.
  [`capacity-sampler.sh:45`](../../ops/capacity-sampler.sh#L45)

- The container row: cgroup id carried beside the name, which is what makes a redeploy visible.
  [`capacity-sampler.sh:156`](../../ops/capacity-sampler.sh#L156)

- The sampler measures its own cost every run, so the record shows it rather than claiming it.
  [`capacity-sampler.sh:164`](../../ops/capacity-sampler.sh#L164)

- Segments are `(container, cgroup)`, so a counter reset is a boundary and never a data point.
  [`capacity-summary.mjs:179`](../../ops/capacity-summary.mjs#L179)

**The number Story 1-6 will be written against**

- The two scalars the gate takes. Both single-line, because its reader refuses anything nested.
  [`capacity-summary.mjs:577`](../../ops/capacity-summary.mjs#L577)

- Idle and loaded are percentiles of observed load15, not a constant chosen before the data.
  [`capacity-summary.mjs:344`](../../ops/capacity-summary.mjs#L344)

- Missed samples come from gaps, never a nominal grid. Drift claimed 151 losses that never happened.
  [`capacity-summary.mjs:335`](../../ops/capacity-summary.mjs#L335)

**The close-out, which runs in seven days with nobody who was here**

- The mid-week check. Nothing outside the box notices a week that died on day three.
  [`capacity-measurement.md:217`](../../ops/capacity-measurement.md#L217)

- The procedure itself, including which two keys must stay untouched and why.
  [`capacity-measurement.md:237`](../../ops/capacity-measurement.md#L237)

- The limits, written before the data exists so they cannot be relaxed to fit it.
  [`capacity-measurement.md:314`](../../ops/capacity-measurement.md#L314)

**Where the week could have died quietly**

- Exit 4 is a degraded sample, not a failure, so `Result=success` stays a real signal.
  [`capacity-sampler.service:48`](../../ops/capacity-sampler.service#L48)

- systemd owns the log directory, so a missing one is recreated rather than refusing to start.
  [`capacity-sampler.service:61`](../../ops/capacity-sampler.service#L61)

- A guest on a serving box: behind every real process, and its IO behind every real request.
  [`capacity-sampler.service:27`](../../ops/capacity-sampler.service#L27)

- Interval measured from the last activation, so a slow run shifts the next instead of stacking.
  [`capacity-sampler.timer:19`](../../ops/capacity-sampler.timer#L19)

**Peripherals**

- The gate test, narrowed. Asserting the measurement keys empty made a correct close-out fail CI.
  [`capacity-gate.test.ts:54`](../../ops/__tests__/capacity-gate.test.ts#L54)

- Filled measurement keys must still refuse a new id, because measuring is not opening.
  [`capacity-gate.test.ts:60`](../../ops/__tests__/capacity-gate.test.ts#L60)

- The schema read out of the shell script itself, so the two copies cannot drift apart.
  [`capacity-summary.test.ts:405`](../../ops/__tests__/capacity-summary.test.ts#L405)

- Drift is not loss. This is the regression that produced a self-contradicting record.
  [`capacity-summary.test.ts:222`](../../ops/__tests__/capacity-summary.test.ts#L222)

- LF pinned for the four file types that leave this repository and run elsewhere.
  [`.gitattributes:15`](../../.gitattributes#L15)
