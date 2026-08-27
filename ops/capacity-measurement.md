# Capacity measurement week

The written record of how the box's footprint is being measured, what is sampled and at what
cost, where the raw data lives, when the week started, and exactly what the close-out session
has to do. It is the artifact Story 1-5 delivers. The number Story 1-6 writes into the gate
comes out of this week, so anything unstated here is a number nobody can defend later.

This file is a record, not Registry data, and nothing here is a published contract surface. It
follows the pattern `ops/estate.md`, `ops/monitoring.md`, `ops/routing-inventory.md` and
`ops/bot-mitigation.md` set: every value is marked as either a decision or an observation, and
the two are never presented as the same kind of fact (NFR-9).

Governing decision: **AD-9, capacity fails closed.** `ops/capacity-gate.yml` refuses a new
application id mechanically and stays blocked until a measured threshold exists. AD-9 names
per-container `cpu.pressure` as the diagnostic that attributes pressure to one application
rather than to the box, which is why this week samples cgroup v2 PSI and not `docker stats`.

**This story measures. It does not open the gate.** Story 1-6 writes `threshold` and only then
may `status` become `open`. Nothing in this file authorises either.

## The week

| Item | Value | Nature |
|---|---|---|
| Box | `srv1842312`, `177.7.52.248`, 2 vCPU, 7.9 GB, `Etc/UTC`, NTP synchronised | **Observed 2026-08-17** |
| First sample written | `2026-08-17T20:59:34Z` | **Observed.** A by-hand run of the unit, to verify the install before enabling the timer |
| **Week start, first timer sample** | **`2026-08-17T20:59:52Z`** | **Observed.** The timer was enabled at this instant and has fired every 60 seconds since |
| Earliest close-out | **2026-08-24T21:00Z** | **Decided.** Seven full days after the week start |
| Sample interval | 60 seconds, from `OnUnitActiveSec` | **Decided** |
| Containers at week start | 14, across four compose projects | **Observed** |
| Gate state during the week | `status: blocked`, `threshold` empty | **Observed.** Unchanged by this story |

**The week is post-mitigation, which is what makes it citable.** `ops/bot-mitigation.md` records
the WAF rules applied at **2026-08-17T17:27:46Z** and the origin bypass closed at
**2026-08-17T18:14Z**. The week starts after both, so the footprint it measures is the estate
behind the filter rather than the estate plus whatever was crawling it. The one capacity figure
that existed before this week (639,880 KB RSS, 103.3% CPU, quoted in `ops/bot-mitigation.md`)
was captured during a bot crawl and is not a baseline for anything.

**The first row in the file is not a timer run.** It was written by hand 18 seconds before the
timer's first fire, so the first interval in the data is 18 seconds rather than 60. The
summariser divides by observed elapsed time, so this is arithmetic rather than error, but a
reader inspecting the raw CSV should know why the first two timestamps are close together.

## What is running on the box

**Observed 2026-08-17T20:59:34Z**, from `docker ps --no-trunc`. All 14 are sampled, including
the databases and the proxy, because what consumes the box is a different question from which
ids the gate governs. `placements` in `ops/capacity-gate.yml` answers the second one and lists
four.

| Compose project | Containers |
|---|---|
| `cuatro-portfolio-anchor` | `app-1`, `db-1`, `umami-1` |
| `cs-tracker` | `app-1`, `db-1`, `caddy-1` |
| `cuatro-tracker` | `app-1`, `worker-1`, `postgres-1`, `redis-1`, `qbittorrent-1` |
| `digital-library` | `web-1`, `api-1`, `redis-1` |

## The method

One systemd timer fires `/usr/local/sbin/capacity-sampler.sh` every 60 seconds. Each run writes
one sample: a box row, one row per running container, and one row recording what that run itself
cost. Every row in a run carries the same timestamp, so a container's CPU counter and the box's
15-minute load average are one reading rather than two readings correlated by proximity.

**Counters are recorded raw and cumulative, and nothing on the box computes a rate.**
`ops/capacity-summary.mjs`, in this repository, turns the CSV into per-day and per-run
aggregates at close-out. Three reasons that split is deliberate:

- **`docker stats` was rejected.** It reports a rate over an interval it chose, costs an API
  round trip per container, and cannot distinguish a missed sample from an idle minute.
  Cumulative microseconds from `cpu.stat` let the summariser divide by observed elapsed time, so
  a gap becomes visible instead of being silently smoothed into the minutes around it.
- **A summariser outside the repository cannot be tested.** The arithmetic here is the part that
  turns counters into a number a gate is written against, so it is committed and covered by
  `ops/__tests__/capacity-summary.test.ts`, one case per edge case that can corrupt a reading.
- **A summariser can be fixed and rerun against the week. A sampler that threw away the raw
  counters cannot.** If the aggregation turns out to be wrong in six days, the week is not lost.

**Segments are `(container, cgroup)`, never `container`.** A deploy recreates a container under
the same name with a new cgroup whose counters start at zero. Keyed on the name alone that reset
reads as a large negative delta, and clamping it to zero would quietly discard the busiest
minutes of the week, which are exactly the minutes a peak reading exists to capture. A cgroup
change starts a new segment, and the boundary between two segments is not an interval at all.

**The idle floor and the loaded band are percentiles of the load15 the box actually had**, not
thresholds chosen in advance. Idle is every sample at or below the tenth percentile, loaded every
sample at or above the ninetieth. Picking a load number now would smuggle in the guess Story 1-6
exists to derive from this data. Quantiles use nearest rank rather than interpolation, so every
figure printed is a load average the box genuinely had.

## What is sampled

Twelve columns, one shape for every kind of row, defined once in `ops/capacity-sampler.sh` and
asserted in `ops/__tests__/capacity-summary.test.ts` so the two cannot drift apart.

| Column | Source | Rows that carry it |
|---|---|---|
| `ts` | `printf %(...)T`, ISO 8601 UTC | every row |
| `kind` | `box`, `container`, `sampler` or `note` | every row |
| `name` | container name from `docker ps --no-trunc` | container, and the two sentinels `_box` and `_sampler` |
| `cgroup` | full container id, which is the cgroup name | container |
| `usage_usec` | `cpu.stat`, cumulative CPU microseconds | container, sampler |
| `psi_some_usec` | `cpu.pressure` `some total=`, cumulative stall microseconds | box (from `/proc/pressure/cpu`), container |
| `psi_full_usec` | `cpu.pressure` `full total=` | box, container |
| `memory_bytes` | `memory.current` for a container, `MemAvailable` for the box | box, container, sampler |
| `load1`, `load5`, `load15` | `/proc/loadavg` | box |
| `note` | free text, no comma | note rows and the sampler row |

**Names are read from `docker ps` every run rather than from a cached list**, because a redeploy
replaces a container under the same name with a new id, and that new id is the cgroup.

**Everything else is a bash builtin read against `/proc` or `/sys`.** Outside the one `docker ps`
the sampler forks no processes.

## What the measurement costs

**Observed, not assumed.** The unit sets `CPUAccounting=yes`, so its own cgroup carries a
`cpu.stat` the sampler reads at the end of every run and writes into the `sampler` row. The
service is `Type=oneshot`, so that cgroup is created fresh per invocation and the figure is a
per-run total rather than a cumulative counter. This is the one row in the file the summariser
must not difference.

**Measured over the first 12 runs**, `2026-08-17T20:59:34Z` to `2026-08-17T21:10:00Z`, a span of
10 minutes. These figures are the install-time reading and are superseded by the whole-week
figures the close-out block prints.

| Reading | Value | Nature |
|---|---|---|
| Runs measured | 12 of 12 rows, so every run reported its own cost | **Observed** |
| CPU per run, mean | 73 ms, which is **0.073 CPU seconds per run** | **Observed** |
| CPU per run, peak | 88 ms, on the by-hand run that populated the cold page cache | **Observed** |
| CPU per run, range | 63 ms to 88 ms | **Observed** |
| Peak RSS of a run | 10 MiB | **Observed** |
| Share of one core over the span | **0.140%** | **Derived** |
| Share of the box | **0.070%** | **Derived** |

At one run a minute, 0.073 CPU seconds per run is roughly 0.12% of one core, or about 4.4 CPU
seconds an hour on a box that has 7,200 available. That is small, and the point of the row above
is that it is small because it was measured and not because measuring seemed cheap.

**The peak in that table is measured by a different instrument from the rest.** A run started by
hand has no `capacity-sampler.service` cgroup to read, so the script falls back to
`/proc/self/stat`, which counts the script process and its children rather than the service
cgroup. The 88 ms peak is that by-hand run. Timer runs, which are every run the week is actually
built from, are cgroup readings in the 63 to 75 ms band. The two are close enough that the
conclusion is unchanged, and far enough apart that quoting them as one range would be mixing
instruments.

**It is a guest on a box that is serving, and the unit says so.** `Nice=10` puts it behind every
serving process, `IOSchedulingClass=idle` makes its append wait for any real request, and
`TimeoutStartSec=45` means a stuck run is killed rather than allowed to overlap the next one on a
two core box. The unit also runs confined: `ProtectSystem=strict` with a single writable directory,
`ProtectHome`, `PrivateTmp`, `NoNewPrivileges` and `RestrictSUIDSGID`. `ProtectControlGroups=no`
is deliberate and load-bearing, because the cgroup tree is the thing being read.

**That writable directory is declared as `LogsDirectory=cuatro-capacity`, not as a bare
`ReadWritePaths`.** systemd then creates `/var/log/cuatro-capacity` itself, owns it to `deploy`,
and recreates it if it is ever removed. With `ReadWritePaths` alone, a missing directory makes
systemd refuse to start the unit at all, which would leave the script's own `mkdir -p` and its
documented exit 3 unreachable from the timer: the week would end on a failure mode nothing in this
file describes.

**Every figure the week produces includes the sampler.** Its cost is stated rather than
subtracted, because subtracting it would be a modelling decision presented as a measurement.

## Where the raw files live

| Item | Path | Nature |
|---|---|---|
| Raw samples | `/var/log/cuatro-capacity/capacity-YYYY-MM-DD.csv` on `177.7.52.248` | **Observed.** One file per UTC day, schema header on line 1 |
| Directory owner | `deploy:deploy`, mode 0755 | **Observed** |
| Sampler | `/usr/local/sbin/capacity-sampler.sh`, `root:root`, mode 0755 | **Observed** |
| Units | `/etc/systemd/system/capacity-sampler.{service,timer}`, `root:root`, mode 0644 | **Observed** |
| Source of truth for all three | `ops/capacity-sampler.sh`, `ops/capacity-sampler.service`, `ops/capacity-sampler.timer` | **Decided.** Committed, so the install is reproducible and a later reader can diff the box against the intent |

**The raw CSVs are not committed.** They are the week's evidence and they stay on the box until
close-out, when they are pulled down and summarised. Nothing rotates or truncates them; a week at
16 rows a minute is a few megabytes.

**The units are committed rather than only described**, which is the one thing the Story 1-3
precedent got wrong. `/usr/local/sbin/cf-origin-firewall.sh` exists only on the box, so there is
nothing to diff it against.

## Reproducing the install

Performed 2026-08-17. Recorded so the box can be rebuilt, not so it has to be.

```
scp ops/capacity-sampler.sh ops/capacity-sampler.service ops/capacity-sampler.timer deploy@177.7.52.248:/tmp/
ssh deploy@177.7.52.248
sudo install -o root -g root -m 0755 /tmp/capacity-sampler.sh /usr/local/sbin/capacity-sampler.sh
sudo install -o root -g root -m 0644 /tmp/capacity-sampler.service /etc/systemd/system/capacity-sampler.service
sudo install -o root -g root -m 0644 /tmp/capacity-sampler.timer /etc/systemd/system/capacity-sampler.timer
sudo systemctl daemon-reload
sudo systemctl start capacity-sampler.service    # one run by hand, to verify before enabling
sudo systemctl enable --now capacity-sampler.timer
```

**The by-hand `systemctl start` is a verification step, not a requirement.** The timer declares
`OnBootSec=2min` and `OnUnitActiveSec=60` and no `OnActiveSec`, which reads as though it could
never fire on a unit that has never run. It fires regardless: on a box booted long ago the
`OnBootSec` moment is already in the past, so systemd triggers it as soon as the timer is enabled,
and on a freshly booted box `OnBootSec` covers it two minutes in. Observed on 2026-08-17: the
first timer sample landed 18 seconds after the by-hand run. Checked rather than assumed, because
a timer that silently never fires is the one failure this whole story cannot survive.

**Reaching the box.** The Windows OpenSSH client holds no key for it. Every command above runs
through WSL, as `wsl -d Ubuntu-22.04 ssh deploy@177.7.52.248 '<command>'`, or by piping a script
into `ssh deploy@177.7.52.248 'bash -s'`. `wslpath` mangles Windows paths passed from PowerShell,
so use the `/mnt/c/...` form directly.

**Verified at install:** the timer is `enabled` and `active (running)`, samples arrive one per
minute with strictly increasing timestamps, and each sample carries 16 rows, which is one box row
plus 14 containers plus one sampler row.

## The mid-week check

Nothing outside the box watches the sampler. A full disk, a stopped timer or a removed log
directory all produce the same symptom, which is silence, and silence is what a working week looks
like too. One command around **2026-08-21** distinguishes them, and the cost of skipping it is
discovering on close-out day that the week ended on day three.

```
wsl -d Ubuntu-22.04 ssh deploy@177.7.52.248 "systemctl is-active capacity-sampler.timer; systemctl show capacity-sampler.service -p Result -p ExecMainStatus; wc -l /var/log/cuatro-capacity/*.csv; df -h /var/log | tail -1"
```

Expect `active`, `Result=success`, `ExecMainStatus=0`, one file per day since the start, and
roughly 16 rows a minute in the current day's file. A `Result=exit-code` with `ExecMainStatus=3`
means the log became unwritable and the week is losing samples now.

A degraded sample is not a failure: exit 4 means Docker was unreachable for one run, the box row
was still written, and a note row records why the container rows are absent. `SuccessExitStatus=4`
in the unit keeps that from marking the service failed, so `Result=success` stays meaningful as a
signal rather than becoming permanently red after one transient hiccup.

## Close-out procedure

Run on or after **2026-08-24T21:00Z**. Until then this story is awaiting the week, not done.

**1. Confirm the week actually ran.** A week that stopped on day three is a shorter week, not a
failed one, but the record has to say which.

```
wsl -d Ubuntu-22.04 ssh deploy@177.7.52.248 'systemctl status capacity-sampler.timer --no-pager; ls -l /var/log/cuatro-capacity/'
```

**2. Pull the raw files down.** They are the evidence; keep them until Story 1-6 has closed.

The commands in this section are PowerShell, because that is the shell this repository is driven
from. Two traps are worth stating rather than rediscovering. `mkdir -p` is not a PowerShell flag.
And a path handed to a WSL binary resolves against the WSL working directory, not the Windows one,
so the destination is written as a `/mnt/c/...` path rather than as `./something`.

```
New-Item -ItemType Directory -Force capacity-week
wsl -d Ubuntu-22.04 bash -c "scp 'deploy@177.7.52.248:/var/log/cuatro-capacity/capacity-*.csv' /mnt/c/CuatroEcosystem/cuatro-portfolio/capacity-week/"
```

**3. Summarise.** The summariser takes every day at once, so the per-day table and the whole-run
figures come from the same code and cannot disagree about what a mean is.

PowerShell does not expand a wildcard for a native command, so `capacity-week/capacity-*.csv`
would reach the summariser as one literal path and fail with "could not be read". Expand it in the
shell instead:

```
node ops/capacity-summary.mjs (Get-ChildItem capacity-week/capacity-*.csv | ForEach-Object { $_.FullName })
```

**4. Paste the markdown block it prints into this file**, under a new `## What the week measured`
heading, replacing nothing above it. The block already marks every figure as observed or derived.

**5. Fill exactly three keys in `ops/capacity-gate.yml`**, and nothing else:

| Key | Value | Source |
|---|---|---|
| `measured_at` | the UTC date the week closed, ISO 8601, as `2026-08-24` | the close-out session |
| `baseline` | the `baseline:` line the summariser printed | `ops/capacity-summary.mjs` |
| `reading` | the `reading:` line the summariser printed | `ops/capacity-summary.mjs` |

**`threshold` stayed empty and `status` stayed `blocked` through this close-out**, which ran on
2026-08-25. A threshold written here would have been Story 1-6's judgement made by whoever happened
to run the close-out. The pasted summariser block further down repeats the same instruction, and it
was true on close-out day for the same reason.

**Story 1-6 has since written both**, on **2026-08-25**: `threshold` carries `load15 0.60 on 2 vCPU`
and `status` is `open`. The derivation is `ops/capacity-threshold.md`. So the committed gate no
longer matches the two cells this step told the close-out to leave alone, and that is the intended
end state rather than a drift from it.

**Both values are scalars, and must stay on one line.** `ops/capacity-gate.mjs` lists `baseline`
and `reading` in `SCALAR_KEYS` and refuses anything nested under them, and it refuses any value
containing a `#` because it strips no inline comments. Structured detail belongs in the markdown
block in this file, never in the gate. `ops/__tests__/capacity-summary.test.ts` asserts that the
summariser's two lines parse cleanly through the gate's own reader, so a paste that fails is a
paste error rather than a contract mismatch.

**6. Stop the sampler**, once the CSVs are safely down and summarised.

```
wsl -d Ubuntu-22.04 ssh deploy@177.7.52.248 'sudo systemctl disable --now capacity-sampler.timer'
```

Leaving it running is not harmful, but the week it measured is over, and a file that keeps
growing after the record was written invites a later reader to summarise a different span than
the one the gate cites.

**7. Re-run the repository's gates.** `corepack pnpm test --run` and `corepack pnpm typecheck`
both have to pass.

**What `ops/__tests__/capacity-gate.test.ts` asserted about the committed gate on close-out day,
2026-08-25:** that `status` was `blocked` and `threshold` was empty. Those were the two keys the
close-out must not touch, and a failure there would have meant the edit went further than it should
have. **Story 1-6 inverted both assertions on 2026-08-25**, because it is the one story AD-9 permits
to write a threshold and move the status. Read this paragraph as a record of what guarded the
close-out, not as a description of the current file: the committed gate is now `open` against
`load15 0.60 on 2 vCPU`, and the test asserts that instead, plus that the baseline load15 sits below
the threshold load15.

**It did not assert that `measured_at`, `baseline` and `reading` were empty, and it must not.**
It did until Story 1-5, which meant a correct close-out turned CI red while this file told the
operator to read that red as proof the edit was wrong. The obvious response would have been to
revert the measurement the week was run to produce. The demonstration that a gate with all three
measurement keys filled and `threshold` still empty refuses a new id and passes an incumbent lives
on in the suite, moved onto a synthetic gate by Story 1-6 once the committed one stopped being
blocked.

## What this week will not claim

The named limits, written before the data exists so they cannot be quietly relaxed to fit it.

- **Coverage is stated in minutes, never as "a week".** The summariser reports the time actually
  bracketed by two consecutive samples, capped at one interval per pair, so a gap is excluded from
  coverage rather than counted as observed and two samples inside one minute cannot report more
  coverage than the span they ran over.
- **This measures what the estate did, not what it can hold.** Load average is the box, and PSI
  plus cgroup CPU is the attribution. Neither says anything about what the box would do under
  traffic it did not receive. No artificial load was generated: a synthetic burst on a serving two
  vCPU box is the Operator's decision, and it was not taken.
- **A quiet week measures a quiet week.** If the load15 tenth and ninetieth percentiles come out
  equal, the two bands are not distinct, every sample falls in both, and the summariser says so in
  the record instead of printing two rows that look like a comparison. The fix is a longer span or
  real traffic, not a narrower percentile.
- **The sampler is inside every figure.** Its cost is stated above and never subtracted.
- **`deploy.yml` still builds on the serving box** (`docker compose up --build -d`, the standing
  AD-8 violation tracked in Story 1-9). A merge to `main` during the week compiles Next.js on the
  two cores being measured, which will show as a large CPU peak attributed to
  `cuatro-portfolio-anchor-app-1`. That is a real cost of the current topology and is not
  excluded, but the close-out must say whether any such build fell inside the week, because a
  threshold derived from a build minute is a threshold about the build and not about serving.
- **No rendered-output or browser check is claimed anywhere.** Playwright arrives in Story 1-10.
- **A container that appears in exactly one sample gets no CPU rate at all.** One cumulative
  counter is not a rate, and the record names those segments rather than leaving a blank.

## What the week measured

**Observed** from `2026-08-17T20:59:34Z` to `2026-08-25T00:33:34Z` UTC, a span of 10294 minutes. 10129 box samples against 10129 expected at one sample every 60 seconds, bracketing 10127 minutes of observed time. No samples were missed.

Every share below is stated against **one core** and against the **whole box**, which is 2 vCPU. Rates come from the elapsed time between two samples of the same cgroup, never from the nominal interval.

### The box

| Reading | Value | Nature |
|---|---|---|
| load15 min | 0.05 | **Observed** |
| load15 p10, the idle floor | 0.08 | **Observed** |
| load15 p50 | 0.11 | **Observed** |
| load15 p90, the loaded band | 0.16 | **Observed** |
| load15 p99 | 0.21 | **Observed** |
| load15 max | 0.27 | **Observed** |
| MemAvailable mean | 5.47 GiB | **Observed** |
| MemAvailable floor | 5.21 GiB | **Observed** |
| Box PSI some, share of wall time | 1.6% | **Observed** |
| All containers, CPU mean | 3.0% of the box | **Derived** |
| All containers, CPU peak in one interval | 7.1% of the box | **Derived** |
| All containers, RSS mean | 1.23 GiB | **Derived** |
| All containers, RSS peak | 1.37 GiB | **Derived** |

### Per container, whole run

| Container | Samples | Segments | CPU mean (1 core) | CPU peak (1 core) | CPU mean (box) | Mem mean | Mem peak | PSI some | Coverage |
|---|---|---|---|---|---|---|---|---|---|
| `cs-tracker-db-1` | 10129 | 1 | 1.2% | 1.4% | 0.6% | 194 MiB | 206 MiB | 0.1% | full |
| `cuatro-tracker-redis-1` | 10129 | 1 | 0.8% | 0.9% | 0.4% | 5 MiB | 7 MiB | 0.1% | full |
| `cuatro-portfolio-anchor-app-1` | 10129 | 1 | 0.7% | 3.5% | 0.3% | 72 MiB | 103 MiB | 0.0% | full |
| `cuatro-portfolio-anchor-db-1` | 10129 | 1 | 0.6% | 0.7% | 0.3% | 24 MiB | 27 MiB | 0.1% | full |
| `cuatro-tracker-postgres-1` | 10129 | 1 | 0.6% | 0.9% | 0.3% | 65 MiB | 68 MiB | 0.1% | full |
| `cs-tracker-app-1` | 10129 | 1 | 0.5% | 2.2% | 0.3% | 201 MiB | 344 MiB | 0.0% | full |
| `digital-library-redis-1` | 10129 | 1 | 0.4% | 0.6% | 0.2% | 4 MiB | 6 MiB | 0.0% | full |
| `digital-library-web-1` | 10129 | 1 | 0.3% | 0.6% | 0.2% | 45 MiB | 61 MiB | 0.0% | full |
| `digital-library-api-1` | 10129 | 1 | 0.3% | 0.6% | 0.2% | 43 MiB | 57 MiB | 0.0% | full |
| `cuatro-tracker-app-1` | 10129 | 1 | 0.3% | 7.3% | 0.1% | 112 MiB | 147 MiB | 0.0% | full |
| `cuatro-tracker-worker-1` | 10129 | 1 | 0.2% | 0.4% | 0.1% | 131 MiB | 134 MiB | 0.0% | full |
| `cuatro-tracker-qbittorrent-1` | 10129 | 1 | 0.0% | 0.0% | 0.0% | 25 MiB | 25 MiB | 0.0% | full |
| `cs-tracker-caddy-1` | 10129 | 1 | 0.0% | 2.4% | 0.0% | 26 MiB | 38 MiB | 0.0% | full |
| `cuatro-portfolio-anchor-umami-1` | 10129 | 1 | 0.0% | 2.0% | 0.0% | 307 MiB | 314 MiB | 0.0% | full |

### The idle floor and the loaded band

Both bands are percentiles of the load15 the box actually had, not thresholds chosen in advance. Idle is every sample at or below the tenth percentile, loaded every sample at or above the ninetieth.

| Band | load15 | Samples | Containers, CPU | Container RSS | Dominant container |
|---|---|---|---|---|---|
| Idle, load15 at or below 0.08 | 0.08 | 1402 | 3.0% of the box | 1.23 GiB | cs-tracker-db-1 |
| Loaded, load15 at or above 0.16 | 0.18 | 1508 | 3.0% of the box | 1.23 GiB | cs-tracker-db-1 |

Under load the three heaviest are `cs-tracker-db-1` at 1.2% of one core, `cuatro-tracker-redis-1` at 0.8% of one core, `cuatro-portfolio-anchor-app-1` at 0.7% of one core.

### What the measurement cost

**Observed, not assumed.** The sampler recorded its own CPU time on each of 10129 runs out of 10129 rows. Mean 69 ms of CPU per run, peak 104 ms, peak RSS 10 MiB. Over the covered span that is 0.113% of one core and 0.057% of the box.

### Per day

| Day | Box samples | Missed | load15 p50 | load15 max | Containers CPU mean | Containers CPU peak | RSS peak |
|---|---|---|---|---|---|---|---|
| 2026-08-17 | 179 | 0 | 0.09 | 0.18 | 3.0% | 3.4% | 1.23 GiB |
| 2026-08-18 | 1417 | 0 | 0.11 | 0.22 | 3.0% | 4.1% | 1.31 GiB |
| 2026-08-19 | 1416 | 0 | 0.11 | 0.25 | 3.0% | 4.4% | 1.35 GiB |
| 2026-08-20 | 1417 | 0 | 0.12 | 0.25 | 3.0% | 3.7% | 1.28 GiB |
| 2026-08-21 | 1417 | 0 | 0.11 | 0.24 | 3.0% | 5.5% | 1.36 GiB |
| 2026-08-22 | 1416 | 0 | 0.12 | 0.26 | 3.0% | 7.1% | 1.35 GiB |
| 2026-08-23 | 1417 | 0 | 0.11 | 0.27 | 3.0% | 5.5% | 1.35 GiB |
| 2026-08-24 | 1416 | 0 | 0.10 | 0.21 | 3.0% | 3.7% | 1.37 GiB |
| 2026-08-25 | 34 | 0 | 0.12 | 0.19 | 3.0% | 3.3% | 1.26 GiB |

### What this summary does not claim

- Coverage is 10127 minutes, stated in minutes rather than as a week, because the number of minutes actually sampled is the only thing the data supports.

- The sampler is a guest on the box it measures, so every figure includes the sampler. Its cost is stated above rather than subtracted.

- Load average is the box, and PSI plus cgroup CPU is the attribution. Neither says anything about what the box would do under traffic it did not receive.

### The two scalars `ops/capacity-gate.yml` takes

> **Annotation added 2026-08-25 by Story 1-6, outside the pasted output below:** the closing line of
> this block is the summariser's instruction to the close-out session and was true that day. It is
> **retired**. `threshold` now carries `load15 0.60 on 2 vCPU` and `status` is `open`. Do not copy
> that line into the gate. See `ops/capacity-threshold.md`.

Paste these two lines, and nothing nested, because `ops/capacity-gate.mjs` reads both as scalars.

```
baseline: idle band load15 0.08, containers 3.0% of 2 vCPU, 1.23 GiB container RSS, measured over 10127 minutes to 2026-08-25T00:33:34Z
reading: loaded band load15 0.18 max 0.27, containers 3.0% of 2 vCPU, peak 7.1%, top cs-tracker-db-1 at 1.2% of one core, 1.23 GiB container RSS
```

`threshold` stays empty and `status` stays `blocked`. Story 1-6 opens the gate, not this one.

### Close-out notes the summariser could not know

**The week ran past its earliest close-out and the record says so.** The span above ends at
`2026-08-25T00:33:34Z` rather than at the decided `2026-08-24T21:00Z`, because the close-out was
performed three and a half hours after the gate opened rather than at it. Those extra minutes are
included rather than trimmed: discarding observed samples to make a span match a planned number
would be the decided-as-observed substitution NFR-9 forbids. `measured_at` is therefore `2026-08-25`,
the UTC date the data actually ends, and not the `2026-08-24` the procedure anticipated.

**No deploy to `main` landed inside the week**, which closes Operator action 4. `main` is at
`54d3a0d` from 2026-08-15, two days before the week started, and carries no merges since. So no
`docker compose up --build` minute from the standing AD-8 violation is inside this data, and the
threshold Story 1-6 derives is a threshold about serving rather than about a build. This is the
one caveat in "What this week will not claim" that the week resolved by observation.

**The two bands are distinct in load15 and identical in container CPU.** `p10` is 0.08 and `p90`
is 0.16, so the percentile split is real rather than the degenerate case the method section warned
about. But container CPU reads 3.0% of the box and container RSS 1.23 GiB in **both** bands. The
variation in load15 is therefore not attributable to the containers the gate governs. Story 1-6
should read this as evidence that a threshold anchored to container CPU has very little observed
dynamic range to sit in, and should not read the loaded band as showing what load costs.

## Pending Operator actions

| # | Action | Note | Completed (UTC) |
|---|---|---|---|
| 1 | Install the sampler and units, create the log directory, enable the timer | Verified: timer enabled and active, samples one per minute, 16 rows each | **2026-08-17T20:59:52Z** |
| 2 | **Let the week run to 2026-08-24T21:00Z** | Nothing to do. The timer is enabled, so it survives a reboot | **2026-08-24T21:00:00Z** |
| 2a | **Check once, around 2026-08-21** | A week measured by nobody can die on day three and look identical to a week that ran. One command, below | **2026-08-24T09:55:45Z.** Late, and it should be recorded as late rather than as done on time. The check that was meant for day four was run on close-out day, so for four days nothing was watching. The week survived it: 10129 of 10129 expected samples, no gaps, `Result=success` |
| 3 | **Run the close-out procedure above** | Pull the CSVs, summarise, paste the block, fill the three gate keys, stop the timer | **2026-08-25T00:33:34Z** |
| 4 | Note whether any deploy to `main` landed inside the week | A build on the serving box is a real but atypical minute, and the threshold Story 1-6 derives should not be anchored to one | **2026-08-25T00:33:34Z.** None did. `main` is at `54d3a0d` from 2026-08-15 with no merges since, so no build minute is inside the data |
| 5 | Hand the closed record to Story 1-6 | Story 1-6 writes `threshold` and opens the gate. It is the only story that may | **2026-08-25.** Done. Story 1-6 derived `load15 0.60 on 2 vCPU` from the figures above and moved `status` to `open`, the measured baseline of load15 0.08 being 13% of it. The derivation, the rejected alternative and the condition that re-blocks the gate are in `ops/capacity-threshold.md` |

**Maintaining this file.** When an action is performed, replace the cell with the ISO 8601 UTC
completion date and leave the row in place. Deletion is not used: which part of the measurement
was established when is what a later reader needs when the threshold stops holding.
