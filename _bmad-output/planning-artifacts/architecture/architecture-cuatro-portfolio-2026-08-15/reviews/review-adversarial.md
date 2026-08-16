# Adversarial lens, two compliant units that still build incompatibly

Configured reviewer 2. Run 2026-08-15 against `ARCHITECTURE-SPINE.md`.

Method: construct pairs of units one level down that obey every AD to the letter and still
collide. Each surviving pair is a hole to close.

## Verdict

Four real collisions found. One is a runtime data-loss class and has no AD at all; two are
unimplementable-as-written; one is a divergence the spine invites by omission.

## Collisions

### A-1: HIGH. `apps/finance` and `cs-tracker` both migrate, and `docker-rollout` overlaps them

Both obey AD-8 (build in CI, `docker-rollout` on deploy) and AD-10 (own database, own role).
Nothing in the spine says **when** schema migrations run.

`docker-rollout` is scale-then-drain by construction: the old container keeps serving while
the new one starts. So:

- `finance` chooses migrate-on-boot (the Prisma default shape). The new container migrates
  while the old container is still serving the **previous** schema. Any destructive migration
  breaks live requests for the length of the drain.
- `cs-tracker` chooses a discrete release task. No overlap problem.

Both are compliant. One breaks in production, silently, in an estate with no user to report
it. This is the single largest hole found.

*Fix:* a new AD, migrations run as a discrete step, and must be backward-compatible with the
version still serving (expand/contract), because the rollout strategy guarantees overlap.

### A-2: HIGH. AD-16's verification job cannot find what it verifies

AD-14 says the contract is "copied as a **folder**" but never names the folder. AD-16 requires
a scheduled job to fetch each Satellite's vendored `tokens.css` and compare its version header
to the Registry's `token_contract`.

Two compliant Satellites: `cs-tracker` vendors to `assets/css/`, `digital-library` to
`src/lib/styles/`, `list-wheel` to `src/`. All three obey AD-14. The verification job has no
way to locate the file across seven repositories, so AD-16 is unimplementable as written and
FR-19 goes unmet while appearing satisfied.

*Fix:* name the folder. One constant, and the job becomes a fixed path per repository.

### A-3: MEDIUM. Two apps implement `demo:reset` and disagree on both halves

AD-13 says "one well-known demo principal per application" and "runs on a schedule". Neither
is pinned:

- **Who the principal is.** One app uses `demo@cuatro.dev`, another a UUID in config, a third
  a boolean `is_demo` column. All are "well-known" to their author. The reset semantics stop
  being one contract.
- **Where the schedule lives.** One app runs an in-process scheduler (Quantum, node-cron),
  another expects a host cron. On a CPU-bound single box those have materially different
  costs, and the in-process one keeps a scheduler alive in every replica.

*Fix:* derive the principal from AD-3's id rule, and put the schedule on the host, outside the
application containers.

### A-4: MEDIUM. Two Anchor apps build images with different contexts

`apps/hub` and `apps/finance` both obey AD-7 (one Dockerfile, one image per id). In a pnpm +
Turborepo workspace the build context is a real fork:

- root context, copying the whole workspace → correct install, very large context, slow builds
- app-directory context → fails, because the lockfile and workspace links live at the root
- root context with `turbo prune --docker` → correct and small

Three compliant-looking choices, two of them bad, and the difference shows up as multi-minute
CI time and image bloat rather than as an error.

*Fix:* fix the pattern in AD-8.

## Attacks that failed

Recorded because a lens that only finds problems is not calibrated.

- **"Two apps claim the same subdomain."** AD-3 makes the Registry the only hostname mapping
  and AD-7 gives one router per id. Collision is visible at the Registry, before deploy.
- **"A Satellite imports a `packages/*` helper."** Structurally impossible: `packages/*` is
  never published, and AD-1's CI check keeps the published surface non-executable.
- **"Two apps disagree on the Registry's shape."** AD-5 plus schema validation in CI closes it;
  `demo` and `identity` being required-with-an-explicit-`none` removes the ambiguity that
  optional fields would create.
- **"The capacity gate is bypassed by deploying an existing app that grew."** True but
  correctly out of the gate's scope: AD-9 gates *placement*, and AD-18 plus per-container
  `cpu.pressure` catch growth. Not a hole; a different instrument.
- **"Archived apps lose their entries at the 8-repo end state."** AD-6 closes it directly.
