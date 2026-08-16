# Project Context prompt — cuatro-portfolio (the Anchor)

Drafted 2026-08-15, after sprint planning produced `sprint-status.yaml` (82 actionable
stories). Paste the block below into a **fresh** Claude Code session opened at
`c:\Development\cuatro-portfolio`.

This is the last step before `bmad-loop run` on Epic 1.

---

/bmad-project-context

## Why this repo needs it now, specifically

This repository has **no `AGENTS.md` and no `CLAUDE.md`** — nothing telling an agent how
to work here. Within the hour it will be driven by **`bmad-loop`, largely unattended**:
fresh sessions spawned per story, running `bmad-build-auto`, self-reviewing and
committing without me watching each one.

That raises the stakes on this file well above the usual. An unattended session with no
repo conventions will invent them, and it will invent them differently each time across
82 stories. Write for that reader: **an agent with no memory of this conversation,
starting cold, about to change code in a live application.**

## What this repo is

`cuatro-portfolio` is a shipping Next.js portfolio at **v2.5.3**, live at `cuatro.dev`.
It is becoming the **Anchor** of the Cuatro Ecosystem — a Turborepo monorepo that will
hold four Next.js apps and publish the contracts seven independent Satellites consume.

**Today it is still the single portfolio app.** The monorepo structure arrives in
Epic 3. Do not document the target structure as if it exists — document what is here
now, and mark the transition where it helps.

Verified on disk:

- **Next.js + React + TypeScript**, pnpm (`pnpm-lock.yaml`)
- **Sass/SCSS, no Tailwind** — `app/scss/` plus per-component `.scss` files
- **Atomic design**: `components/atoms|molecules|organisms`, each component with its own
  stylesheet alongside it
- Routes: `/`, `/cv`, `/work`, `/projects`, `/recommendation`, `/celeste`, `/api/health`
- `content/` holds authored data (`work.ts`, `projects.ts`)
- Docker: `docker-compose.yml`, `docker/Dockerfile`, `docker/Caddyfile`
- CI: `.github/workflows/` including `deploy.yml`
- BMad: `_bmad/`, planning output in `_bmad-output/`

## Read these for the conventions that are being introduced

Under `_bmad-output/planning-artifacts/`:

- **`architecture/architecture-cuatro-portfolio-2026-08-15/ARCHITECTURE-SPINE.md`** —
  AD-1…AD-23 are the invariants. § Consistency Conventions and § Structural Seed are
  directly relevant to how code should be written here.
- **`ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md`** — the token contract and the
  SCSS-to-token migration path. Any styling work from Epic 1 onward goes through tokens.
- **`epics.md`** — 94 stories; each names its governing AD.

## Conventions an unattended agent must not get wrong

These are the ones where a wrong guess is expensive and the repo does not currently
say anything:

1. **`contracts/` is a published surface with a CI-enforced purity rule (AD-1).** No
   executable code — CI fails on any `.ts/.js/.tsx/.jsx/.mjs/.cjs` under it. Generators
   live in `packages/` and are never published. An agent that "helpfully" adds a
   TypeScript helper there breaks the build, and the reason will not be obvious.

2. **The token namespace split (AD-14).** `--token-*` is the semantic layer;
   Tailwind's `--color-*` is separate. They must never share a name on both sides of a
   `var()` — that was a shipped-silently critical the UX review caught, because the
   self-reference survives only by cascade accident and dies under a bundler flatten.

3. **The contract folder name is `cuatro-contracts/`** and is a rule, not a suggestion
   (AD-14/AD-16) — a scheduled job locates vendored tokens by that fixed path across
   seven repositories.

4. **`content/projects.ts` is being retired** in favour of hand-authored
   `contracts/registry.json` validated by schema in CI (AD-4, C-6). An agent editing
   `projects.ts` to fix registry data is working on the wrong file from Epic 2 onward.

5. **Accessibility is asserted, not claimed (AD-19).** Playwright is **not currently
   installed** — `@playwright/test` appears only transitively in `pnpm-lock.yaml`, not
   in `package.json`. Epic 1 story 1-10 installs it. Until then, no AC may claim a
   rendered-output check that nothing runs.

6. **One environment, no staging (AD-21).** Every CI gate is blocking; none may be
   downgraded to a warning to get a story green. This is the single most likely
   shortcut an unattended session will reach for.

7. **The site is live.** `cuatro.dev` serves from this repo. Every change leaves a
   working system (NFR-2, AD-20).

## Known pitfalls to record

Real defects and traps found by the planning chain — worth recording so an agent
doesn't trip on them or "fix" them wrongly:

- **`.github/workflows/deploy.yml` runs `docker compose up --build -d` over SSH** — the
  serving two-core box compiles today. This is a *known standing violation* of AD-8,
  tracked in Epic 1 story 1-9 and retired in Epic 3. **Do not let an agent opportunistically
  "fix" it out of sequence** — the replacement depends on GHCR images that do not exist yet.
- **The deployed routing table is not in source.** `docker/Caddyfile` routes only
  `cuatro.dev` and `analytics.cuatro.dev`, yet `cs-tracker.cuatro.dev`,
  `tracker.cuatro.dev` and `library.cuatro.dev` all resolve. Epic 1 story 1-7 enumerates
  it. Until then, treat the Caddyfile as **incomplete, not authoritative**.
- **SCSS alias trap:** `--font-bold` and `--monument-bold` encode *weight* in the family
  name, so a family-only alias silently drops bold — call sites at `ErrorPage.scss:14`
  and `HomeLayout.scss:284`. The regression lands at migration step 2, before step 6
  exists to fix it.
- **`--confillia-normal` has two live call sites** (`HomeLayout.scss:8` and `:246`) and
  needs retargeting, not deletion. `--confillia-bold` has zero and is safe to delete.
- `aria-hidden="true"` wraps the only `<h1>` on `/work` — `components/organisms/WorkHero/WorkHero.tsx:39`
- `boder:` typo — `components/atoms/WorkItem/WorkItem.scss:84`
- `Dev. 2025` should read `Dec.` — `content/work.ts:18`
- `Celeste.tsx` hides the header by mutating the DOM in an effect
- `vaR(--monument-bold)` at `WorkHero.scss:15` and `ProjectsHero.scss:15` **is not a
  bug** — CSS function names are ASCII case-insensitive. A consistency wart. Record it
  so an agent doesn't "fix" it in an unrelated story and pad a diff.

## Commands to verify, not assume

Establish and record the real commands — build, dev, typecheck, lint, test, and how the
Docker build runs. Verify each actually works rather than transcribing `package.json`.
Note where pnpm is required over npm.

## Constraints

- **Solo maintainer.** No team conventions, no review rotation, no merge queue.
- **Commit style:** subject line only. No body, no `Co-Authored-By` trailer, ever.
- Windows host, PowerShell. Repos relocate to WSL2 in Epic 7 — not yet.

## What I want out of it

An `AGENTS.md` managed block that makes an unattended `bmad-build-auto` session
productive on story 1-1 with no other context: what this repo is, verified commands,
the conventions above, and the pitfalls — written so the agent avoids the mistake
rather than merely being told the mistake exists.

Keep it tight. A long file that gets skimmed is worse than a short one that gets read.
