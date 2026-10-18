# CS Tournament

> **Now part of the Anchor.** This application was merged with its history into
> `cuatro-portfolio` at `apps/tournament/` (Story 3-7, 2026-09-29) and is the pnpm workspace
> `tournament`. Install from the repository root, then run `pnpm --filter tournament dev`, `test`,
> `typecheck` or `build`; the Go worker in `worker/` builds and tests with `go` from that directory.
> Both are imaged in CI (`.github/workflows/image-tournament.yml`); Vercel was left on 2026-09-24, and
> the placement on the box at `tournament.cuatro.dev` is `ops/tournament-placement.md` (2026-09-29).
> The source repository's kickoff notes, hosting plan and planning-artifact links were removed by
> Story 9-18 (DW-283): its planning history stays in that repository.

A web app to run a Counter-Strike 2 tournament with friends: brackets, automated stat
tracking, and a prize "awards roulette" so everyone (not just the best fragger) has a shot at
winning something.

## Vision

- **Brackets**: double elimination for 8 to 16 players, with random seeding and drag-and-drop
  to advance winners. Live updates so everyone watching sees results instantly.
- **Automated stats**: match demos (`.dem`) are parsed into per-player stats (kills, ADR,
  knife kills, clutches, entry frags, utility damage, and more).
- **Awards roulette**: beyond the champion prize, a spinning roulette draws fun, stat-based
  awards ("most knife kills", "least damage", "most deaths", "best clutch") so good and
  not-so-good players alike can win prizes.
- **Profiles and leaderboards**, an **admin panel** for running the event, and a read-only
  **viewer mode** for spectators.
