# Epic 1 runbook

Written 2026-08-16, after `bmad-loop validate` passed clean and
`bmad-loop run --epic 1 --dry-run` confirmed 20 stories.

**There is no prompt to paste.** `bmad-loop run` is the orchestrator: it spawns its own
sessions and invokes `/bmad-build-auto <story-key>` per story, then re-invokes it on the done
spec for the review pass. Your job is the command, the blocker below, and the operator parks.

---

## Blocker to settle first: stories 1-15 and 1-19 target a repo the loop cannot reach

> **Settled 2026-08-25: option 1 was taken.** `cs-tracker-workspace` was moved from
> `C:\Development` to **`C:\CuatroEcosystem\cs-tracker-workspace`**, so the repo now lives at
> `C:\CuatroEcosystem\cs-tracker-workspace\cs-tracker` on `main`, clean, at `ff7667b`. The whole
> workspace moved rather than the bare repo, because its `_bmad`, `_bmad-output`, `docs` and
> `claude-design` folders sit beside the repo rather than inside it, unlike `cuatro-portfolio`.
>
> **This fixes the location and not the commit boundary.** The caveat in option 1 below still
> holds in full: the loop commits to `cuatro-portfolio`'s `dev` branch and `[scm]` still has no
> notion of a second repository. Expect 1-19 to park or to leave uncommitted work in
> `cs-tracker` that a human commits. The paragraph below is left as written, with only the path
> corrected, because what the move did and did not buy is the point.

Two Epic 1 stories act on **`cs-tracker`**, which is a separate git repository at
`C:\CuatroEcosystem\cs-tracker-workspace\cs-tracker` — inside the ecosystem root since
2026-08-25, but still outside the loop's project root:

- **`1-15-determine-cs-tracker-s-daisyui-adoption-route`** — closes O-3, needs to read
  `cs-tracker`'s `assets/css/app.css` and test whether `@plugin "daisyui/theme"` accepts a
  `var()` reference
- **`1-19-cs-tracker-adopts-the-token-contract`** — vendors `cuatro-contracts/` into
  `cs-tracker` and wires the adapter. **FR-18 is measured on this story**, and it is Epic 1's
  headline outcome: two applications on different frameworks visibly one family

The loop commits to `cuatro-portfolio`'s `dev` branch. A dev session can read across to another
path, but it cannot commit there as part of this story, and `[scm]` has no notion of a second
repository. Expect 1-19 to either park or produce uncommitted work in a repo nobody is watching.

**Three ways to handle it, pick before the run reaches 1-15:**

1. **Move `cs-tracker` into `C:\CuatroEcosystem` first** (your stated convention: a repo moves
   when it joins the suite). Does not by itself give the loop commit rights there, but it puts
   the repo where the ecosystem expects it and makes the manual step obvious.
2. **Let the loop park 1-15 and 1-19 at `awaiting-operator`** and do the `cs-tracker` side by
   hand, then `bmad-loop confirm`. Most honest with how the tool works today.
3. **Run Epic 1 with `--max-stories 14`**, handle 1-15 through 1-20 deliberately afterwards.
   Stories 1-1 to 1-14 are all inside `cuatro-portfolio` and need none of this.

Option 3 is the lowest-surprise first run.

---

## The commands

```powershell
cd "C:\CuatroEcosystem\cuatro-portfolio"
git branch --show-current          # must be dev
bmad-loop validate --project "C:\CuatroEcosystem\cuatro-portfolio"
```

Then either the cautious first run:

```powershell
bmad-loop run --project "C:\CuatroEcosystem\cuatro-portfolio" --epic 1 --max-stories 14
```

or the full epic:

```powershell
bmad-loop run --project "C:\CuatroEcosystem\cuatro-portfolio" --epic 1
```

`--epic 1` scopes it; `gates.mode = "per-epic"` pauses at the epic boundary regardless.

**Every spawned session runs `claude ... --permission-mode bypassPermissions`.** That is how the
loop works unattended: no session will stop to ask you to approve a file write or a command.
It is also why `AGENTS.md` and the acceptance criteria carry the guardrails they do.

## Watching it

```powershell
bmad-loop tui        # interactive dashboard
bmad-loop status     # run + sprint state
bmad-loop list       # runs with their short ref
bmad-loop attach     # attach to the live session
bmad-loop stop       # stop a live run
bmad-loop resume     # resume a paused run
```

## The operator parks

`[operator] enabled = true`, so a story whose remaining work is a console action commits what
the agent could do, records the rest in its spec's `operator_actions:` frontmatter, parks at
`awaiting-operator`, and the run continues. Clear each with:

```powershell
bmad-loop confirm <story-key>
```

Expect parks on at least:

| Story | What you owe |
|---|---|
| `1-1-archive-the-four-retired-repositories` | Archive `Lumen`, `tcg-tracker`, `apple-music-workspace` and fold `connect-four-react` on GitHub. Note the story says **four** while PRD §5 archives three and absorbs one; read its AC before acting |
| `1-2-external-uptime-and-certificate-age-monitoring` | Buy and configure the monitor. Alert on certificate **age**, not expiry: lifetimes drop to 64 days in Feb 2027 and 45 in Feb 2028 |
| `1-3-bot-mitigation-on-the-four-live-subdomains` | Cloudflare rules on `cuatro.dev`, `cs-tracker.cuatro.dev`, `tracker.cuatro.dev`, `library.cuatro.dev`. **Gates Epic 2** via AD-17b |
| `1-5-capacity-measurement-week` | A week of `docker stats` on the box. Real calendar time; AD-9 defaults to blocked behind it |
| `1-7-enumerate-the-deployed-routing-table-on-the-box` | Read the live routing on the VPS. `docker/Caddyfile` routes only two of the four subdomains, so this cannot be answered from source |
| `1-16-serve-contracts-at-https-cuatro-dev-contracts` | Needs a deploy to be verifiable |

## If a story goes wrong

- `rollback_on_failure = false`, so a failed in-place attempt **pauses and leaves the tree** for
  inspection rather than auto-reverting. Do not assume the working tree is clean after a failure.
- `on_status_contradiction = "escalate"` — if a review writes sprint-status back off `done`, the
  run pauses naming both sides. Resolve with `bmad-loop resolve <story-key>`.
- `max_dev_attempts = 2`, `max_review_cycles = 3`.

## Done when

- Epic 1's twenty stories are `done` or `awaiting-operator` with their actions recorded
- A written capacity threshold exists in `ops/capacity-gate.yml` (SM-C4's instrument)
- Estate is down to the 11 waypoint
- External uptime and certificate-age monitoring is live: the first real error signal
- `cuatro.dev` and `cs-tracker.cuatro.dev` visibly share the token contract (FR-18, SM-6)
- The per-epic gate pauses the run: that is the promotion-PR point to `main`
