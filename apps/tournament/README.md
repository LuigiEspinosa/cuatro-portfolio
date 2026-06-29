# CS Tournament

A web app to run a Counter-Strike 2 tournament with friends — brackets, automated stat
tracking, and a prize "awards roulette" so everyone (not just the best fragger) has a shot at
winning something.

> **Status:** 🏗️ Kickoff / planning phase. Being built from scratch using the
> [BMad Method](https://docs.bmad-method.org) greenfield workflow. No application code yet.

## Vision

- **Brackets** — double elimination for 8–16 players, with random seeding and drag-and-drop
  to advance winners. Live updates so everyone watching sees results instantly.
- **Automated stats** — match demos (`.dem`) are parsed into per-player stats (kills, ADR,
  knife kills, clutches, entry frags, utility damage, …).
- **Awards roulette** — beyond the champion prize, a spinning roulette draws fun, stat-based
  awards ("most knife kills", "least damage", "most deaths", "best clutch", …) so good and
  not-so-good players alike can win prizes.
- **Profiles & leaderboards**, an **admin panel** for running the event, and a read-only
  **viewer mode** for spectators.

## Planned tech stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui |
| Drag & drop | dnd-kit |
| Backend / data | Supabase (Postgres, Auth, Realtime, Storage) |
| Stat ingestion | Dedicated worker parsing CS2 `.dem` files (`demoinfocs-golang` or `demoparser2`/`awpy`) |
| Hosting | Vercel (app) + Supabase Cloud + worker on Railway/Fly (or local for v1) |

> Stack and architecture are finalized during the BMad Architecture phase — see below.

## How this project is being built (BMad workflow)

Planning artifacts live in [`_bmad-output/planning-artifacts/`](./_bmad-output/planning-artifacts/)
and implementation artifacts in [`_bmad-output/implementation-artifacts/`](./_bmad-output/implementation-artifacts/).

1. **Analysis** — brainstorming, a technical-research spike to de-risk demo parsing, product brief
2. **Planning** — PRD, UX spec
3. **Solutioning** — architecture, epics & stories, implementation-readiness check
4. **Implementation** — sprint planning, then per-story create → dev → review cycles

## Known risk

Neither csstats.gg nor xplay.gg offers a clean official stats API, so granular stats come from
parsing CS2 demo files. A research spike validates this approach before we build around it.
