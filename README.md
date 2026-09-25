# Cuatro Porfolio

My Personal portfolio, deployed at [cuatro.dev](https://cuatro.dev). High-quality visuals, 3D interactive scenes, and scroll-driven storytelling. Fully self-hostable via Docker Compose.

- **Design:** [Figma](https://www.figma.com/design/g5PkF4kBfTuhY6ASeE5oMT/Cuatro-Portfolio?m=auto&t=9mx0OLX8cx7YJoKy-1)

## Tech Stack

| Layer         | Technology                                                |
| ------------- | --------------------------------------------------------- |
| Framework     | Next.js 16 (App Router, standalone output)                |
| UI            | React 19                                                  |
| Language      | TypeScript 5.9                                            |
| 3D / WebGL    | Three.js 0.183 + React Three Fiber v9 + @react-three/drei |
| Post FX       | @react-three/postprocessing (Bloom, chromatic aberration) |
| Animations    | GSAP 3.14 + ScrollTrigger                                 |
| Styles        | Sass 1.97 (SCSS)                                          |
| Analytics     | Unami (self-hosted)                                       |
| Reverse Proxy | Caddy (auto-HTTPS)                                        |
| Testing       | Vitest + Playwright                                       |

## Local Development

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm typecheck
pnpm build
```

## Docker

`docker-compose.yml` is the **production** stack for the Hostinger VPS and does not run
locally. It publishes no ports and joins `cs-tracker_default`, an external network owned by
another stack on that box, so `docker compose up` fails immediately anywhere else. That is
deliberate: the shared Caddy on the VPS is the sole ingress, and a second process binding 80
or 443 there is what took `cuatro.dev` down in August 2026. Use `pnpm dev` for local work.

To build the image alone, without the stack:

```bash
docker build -f docker/Dockerfile \
  --build-arg NEXT_PUBLIC_UMAMI_WEBSITE_ID=local \
  --build-arg NEXT_PUBLIC_UMAMI_URL=https://analytics.cuatro.dev \
  -t cuatro-portfolio-app .
docker run --rm -p 3000:3000 cuatro-portfolio-app   # http://localhost:3000
```

Both build args are required by the stack and are inlined at build time. Three-stage build:
deps to builder to runner (Node 22-slim)

```mermaid
flowchart LR
    A[deps<br/>node:22-slim<br/>pnpm install] --> B[builder<br/>node:22-slim<br/>pnpm build]
    B --> C[runner<br/>node:22-slim<br/>node server.js]
    B -- .next/standalone --> C
    B -- .next/static --> C
    B -- public/ --> C
```

## One-command deploy

```bash
docker compose --env-file .env.production up --build -d
```

```mermaid
graph LR
    Internet --> Caddy
    Caddy -->|cuatro.dev| App
    Caddy -->|analytics.cuatro.dev| Umami
    Umami --> Postgres
```

## Environment Varialbes

Copy `.env.example` and fill in values. Variables prefixed `NEXT_PUBLIC_` are inlined at build time.

| Variables                    | Description                    | Required |
| ---------------------------- | ------------------------------ | -------- |
| NEXT_PUBLIC_UMAMI_WEBSITE_ID | Umami site ID                  |          |
| NEXT_PUBLIC_UMAMI_URL        | <https://analytics.cuatro.dev> |          |

## Routing

| Route             | Description                                       |
| ----------------- | ------------------------------------------------- |
| `/`               | Home - GSAP layout + 3D gem                       |
| `/work`           | Experience Timeline                               |
| `/celeste`        | Standalone page, rendered with no header, `noindex`, linked from the footer alone (Story 2-17) |
| `/projects`       | 301 to `/#suite` (Story 2-14)                     |
| `/cv`             | CV: intro block plus the Experience Timeline (Story 2-16) |
| `/api/health`     | JSON health endpoint                              |
| Anything else     | `app/not-found.tsx`, 404, with the header's two exits (Story 2-17) |

Four corrections landed here with Story 2-15 (DW-60): the `recommendation-letter.pdf` filename was
spelled `remmendation-letter.pdf`, which is a path nothing serves, and `/celeste`, `/api/health`
and the 404 were all absent while the rendered-output suite sweeps them as real surfaces. The
served paths are `/pdf/...`; `public/` is the directory they are served from and is not part of
any URL.

`/cv` answered a 308 to `/pdf/cv.pdf` until 2026-09-10, which shadowed the route file behind it, so
the page had never rendered. Story 2-16 removed the redirect and built the page: it mounts the same
`WorkTimeline` `/work` does, above it an intro block, and it links `/pdf/cv.pdf`, which is still
served at its own URL for anyone holding it. `/work` goes on rendering the timeline standalone.

`/recommendation` answered a 308 to `/pdf/recommendation-letter.pdf` until 2026-09-11, shadowing a
stub that had never rendered, and nothing linked it. Story 2-17 retired the route outright on the
Operator ruling of that day, so it answers 404 like any other unrouted path. The PDF is neither
moved nor renamed: `/pdf/recommendation-letter.pdf` is still served at its own URL for anyone holding
it. The one redirect `next.config.js` still declares is `/projects`; the 308 a trailing slash
answers, as in `/cv/` to `/cv`, is Next's own.

The header presents two of these routes, `/#suite` and `/cv`. `SiteFooter` presents one more,
`/celeste`, inside `<nav aria-label="Footer">`, and it is the only way onto that route: Story 2-17
gave the footer the link the design assigns it, and `/celeste` declares `robots: { index: false }`.
The 404 offers the header's two destinations as its exits, mapped from the same list the header
renders. **Every other route is reached only by an inbound link or by typing it.**

**Hub URLs are case-sensitive, by policy** (Operator ruling 2026-09-24, DW-74 and DW-56): a route
answers at its lowercase path alone, so `/CV`, `/WORK` and `/CELESTE` answer 404, while the one
redirect in `next.config.js` matches its source in any case, as Next compiles every `redirects()`
source, so `/Projects` and `/PROJECTS` answer the same 301 as `/projects`.

## Animation Architecture

The page scrolls natively on every route. Lenis owned the scroll position for a visitor who allowed
motion until 2026-09-24, when DW-36 removed it with `app/providers.tsx` on the Operator ruling of that
day, so there is no client wrapper round the routes.

Entrances are CSS keyframes on each component's own stylesheet. GSAP runs in two places, and each
imports it itself: `WorkItem`, whose disclosure tweens its panel's height on `/work` and `/cv`, and
`TorusCanvas`, which registers `ScrollTrigger` and binds the `/work` torus's rotation to the scroll.
`TorusCanvas` sits behind `WorkHero`'s one `next/dynamic` boundary and is rendered only where motion
is allowed, so `ScrollTrigger` arrives with the torus or not at all.

```mermaid
flowchart TD
    RM[useReduceMotion] -->|draws the torus or not| WH[WorkHero]
    RM -->|tween duration| WI[WorkItem]
    WH -->|next/dynamic, triggerRef| TC[TorusCanvas]
    TC -->|useGsapContext| ST[gsap.to with ScrollTrigger, scrub]
    ST -->|scrollRef| T[Torus useFrame]
    WI -->|gsap.to height| P[the item's panel]
```
