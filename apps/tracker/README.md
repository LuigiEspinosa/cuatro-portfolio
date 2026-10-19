# Cuatro Tracker

> **Now part of the Anchor.** This application was merged with its history into
> `cuatro-portfolio` at `apps/tracker/` (Story 3-6, 2026-09-29) and is the pnpm workspace `tracker`.
> Install from the repository root, then run `corepack pnpm --filter tracker dev`, `test`, `typecheck` or
> `build`. Its image is built in CI by `.github/workflows/image-tracker.yml` from `apps/tracker/Dockerfile`,
> and rolled onto the box by hand as `ops/tracker-cutover.md` § The sequence, Later rollouts, describes. The old
> repository's CI workflow, compose files, Caddy build and e2e suite were removed in Story 9-19.

A self-hosted, privacy-first media tracker. Tracks movies, TV shows, anime, manga, and video games in a unified
PostgreSQL database.

The defining feature is a **chronological timeline** - every item is sortable by original release date across all
media types, powered by four external APIs normalised into a single schema.

- **Live:** [tracker.cuatro.dev](https://tracker.cuatro.dev)
- **Design:** [Figma](https://www.figma.com/design/tltAHHZbUAtmHHklmHUTp1/Cuatro-Tracker?m=auto&t=1flYz4U3SUHFLwBX-1)

## Stack

| Layer         | Technology                                           |
| ------------- | ---------------------------------------------------- |
| Framework     | Next.js 15 (App Router, standalone output)           |
| UI            | React 19                                             |
| Language      | TypeScript 5.7 (strict, `moduleResolution: bundler`) |
| Styling       | Tailwind CSS v4 (CSS-first, no config file)          |
| Animation     | GSAP 3 + ScrollTrigger                               |
| Database      | PostgreSQL 16 + Prisma 6                             |
| Auth          | NextAuth v4 (email/password credentials)             |
| Client state  | Zustand                                              |
| Server state  | TanStack Query v5                                    |
| Job queue     | BullMQ + Redis                                       |
| Validation    | Zod v4                                               |
| Reverse proxy | Traefik (the estate ingress, `ops/traefik/`)         |

## External APIs

| API           | Covers                          | Auth                      |
| ------------- | ------------------------------- | ------------------------- |
| TMDB          | Movies, TV, streaming providers | API key (free)            |
| AniList       | Anime, manga (GraphQL)          | No key for public queries |
| IGDB          | Games, covers, platforms        | Twitch app token (free)   |
| Steam Web API | Library, achievements, playtime | API key + Steam ID        |

## Development

The unit suite needs a Redis on `localhost:6379`; the dev server also needs a Postgres named by
`DATABASE_URL` in `.env.local` (start from `.env.example`). From the repository root:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm --filter tracker exec prisma migrate dev
corepack pnpm --filter tracker exec prisma db seed
corepack pnpm --filter tracker dev
```
