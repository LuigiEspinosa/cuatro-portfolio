# Currency lens — was every committed decision reality-checked?

Configured reviewer 1. Run 2026-08-15 against `ARCHITECTURE-SPINE.md`.

## Verdict

The Stack table is the strongest part of the spine on this axis — every pinned version was
read from a primary source today, and one research figure was corrected in the process. Two
entries are inherited rather than verified, and one runtime is quietly out of active support.

## Verified today, primary source

| Entry | Result |
| --- | --- |
| Traefik v3.7.10 | confirmed, 2026-07-31 — matches research |
| Turborepo 2.10.x | confirmed, 2.10.10 current |
| Style Dictionary ≥5.5.1 | confirmed via `registry.npmjs.org` — **a search summary claiming 5.5.0 was wrong**; 5.5.1 is the prototype-pollution floor and the research was right |
| restic 0.19.1 | confirmed, 2026-07-05 — research said 0.19.0, now superseded |
| docker-rollout v0.14 | confirmed, 2026-07-12 — still one release in the trailing 12 months, so research's cadence caveat stands and is not softened |
| PostgreSQL 18.6 | confirmed, 2026-08-13; 19 GA expected Sept 2026 |
| @playwright/test 1.62.1 | confirmed |
| Repo pins (Next 16.1.6, React 19.2.4, Sass 1.97.3, pnpm 10.31.0, Vitest 4.0.18) | read from `package.json`, not asserted |

## Findings

### V-1 — MEDIUM. Node 22 is out of active support

Active support ended 2025-10-21; Node 22 is in maintenance until 2027-04-30. `ci.yml`,
`lighthouse.yml` and the Dockerfile all use it. Node 24 is Active LTS today; Node 26 becomes
LTS 2026-10-28. Pinning a maintenance-only runtime in a spine authored today is a decision
made by inertia rather than by choice.

*Fix:* pin Node 24; AD-22's window already covers the Node 26 question.

### V-2 — LOW. Two entries are inherited, not verified

`oidcc 3.8.0` and `Tailwind v4` come from the research rather than from a check run today.
Tailwind is expressed as a major only, so it cannot go stale in a harmful way. `oidcc` is
load-bearing for Epic 5 and is single-sourced — but Epic 5 falls after 2026-11-15, so AD-22
already requires a re-check before it is acted on. No change needed; recorded so the
inheritance is visible.

### V-3 — LOW. daisyUI is deliberately unpinned

The spine lists Tailwind v4 but not daisyUI, whose version research flagged as provisional
(5.7.17, single-source). This is correct rather than an omission: Phoenix vendors daisyUI into
the application, so the version is whatever `cs-tracker`'s own vendored files carry, and
pinning it in the spine would assert control the Anchor does not have.

### V-4 — Positive. The spine does not repeat research's stale figures as fact

The 103.3% CPU measurement and the Cloudflare 90% bot-reduction figure — both flagged by the
research's own staleness map as past their window and single-sourced — appear nowhere in the
spine as numbers. AD-9 replaces both with a measurement the Operator takes, which is the
correct treatment.
