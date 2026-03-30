# CHANGELOG

## [3.2.0] - 2026-03-28

### Added

- `atoms/ParticleWave`: 60x60 interactive particle mesh built on Three.js BufferGeometry. Particle as line segments share a single position buffer updated each frame via spring physics.
- Mouse hover repulsion: particles lift toward the camera within a configurable radius, with quadratic falloff and sprinf return.
- Click-drag rotation wuth intertia: window-level pointer listeners allow free rotation post canvas edges; releases coast to a stop via velocity damping.
- Parabolic fold baked into base positions: centre of the grid is closest to the camera, edges curl away for a draped-cloth silhouette.
- Fullscreen canvas: `.home-gem` uses `position: absolite; inset: 0;` so the wave fills the viewport wihout clipping during rotation.
- Camera pulled back from z=5 to z=2 to preserve apparent figure size at 100vw x 100dvh.
- Mobile canvas at `90vw x 90vw` (static, in flex flow).

### Changed

- `GemComponent`: replaced VenomSculpture, spot lights, Sparkles, and OrbitControls with ParticleWave and simplified Bloom (`luminanceThreshold: 0.2, intensity: 0.55`).
- Home panel text sizes increased: nav and contact links at `clamp(1.5rem, 2.5vw, 2.5rem)`, role at `clamp(1rem, 1.5vw, 1.2rem)`.
- HudLabel `__text` from `0.68rem` to `0.9rem`, `__sub` from `0.62rem` to `0.8rem`.

### Removed

- Marquee strip (visual conflict with the wave aesthetic).
- HudConnectors (visual conflict with the wave aesthetic).
- `atoms/VenomSculpture` (superseded by ParticleWave).

## [3.1.0] - 2026-03-28

### Added

- Background CSS grid on home route - subtle purple grid visible at edges, fades toward Particles Wave.
- Sibling dimming on hover - hovering a HUD panel dims the other three to 0.2 opacity.

### Chaged

- Accent color updated from magenta (`#cc00ff`) to dark violet-800 (`#5b21b6`);
- Particles wave increased over full viewport height.
- `glitch-loop` keyframe enhanced with `clip-path` slice layers for chromatic aberration effect.
- `--light-gray-color` updated from warm gray to purple-tinted `#bab4cc`.

### Removed

- `atoms/ScanlineOverlay` (visual conflict with the wave aesthetic).

## [3.0.0] - 2026-03-28

### Added

- `atoms/ScanlineOverlay`: CSS VHS effect layers (scan lines, grain, CRT vignette) as reusable presentational atom.
- `atoms/HudLabel`: Monospace HUD annotation atom with optional Japanese decorative sub text.
- `molecules/GlitchText`: GSAP SplitText scramble boot animation with looping CSS glitch effect. Respects `prefers-reduced-motion`.
- Home route background `#0a000f` (near-black with purple tint), scoped to `body[id='']`.
- CSS custom properties: `--accent`, `--accent-dim`, `--font-mono`.

## [2.5.0] - 2026-03-09

### Added

- Open Graph and Twitter Card metadata for all pages with shared 1200x630 OG image.
- `GET /api/health` route returning `status`, `version`, and `uptime`.
- Print stylesheet: hides decorative canvases and header, redners text content cleanly.
- Full Docker compose stack: Caddy (auto-HTTPS), Umami analytics, Postgres.
- Umami analytics script wired via `next/script` with `afterInteractive` strategy.
- Lighthouse CI Github Actions workflow with performance, accessibility, best-practices, and SEO budget checks.

## [2.4.0] - 2026-03-08

### Added

- `atoms/Scene`: Shared R3F Canvas wrapper with ACESFilmic tone mapping, DPR cap, PerformanceMonitor, and WebGL context-loss handler.
- `atoms/Gem`: Three.js gem mesh atom split from GemComponent; material set once in useEffect, scale normalised for camera distance.
- `atoms/Torus`: Wireframe torus atom driven by a mutable scroll ref via useFrame.
- `atoms/TorusKnot`: Wireframe torus knot atom driven by a mutable scroll ref via useFrame.
- `molecules/TorusCanvas`: Scene + Torus canvas molecule with scroll ref bridge.
- `molecules/TorusKnotCanvas`: Scene + Torus Knot canvas molecule with scroll ref bridge.
- `organism/WorkHero`: Two-column hero section with scroll-linked torus rotation (GSAP scrub -> mutable ref -> useFrame).
- `organism/ProjectsHero`: Two-column hero section with scroll-linked torus knot rotation (GSAP scrub -> mutable ref -> useFrame).
- Bloom (luminanceThreshold: 0.85, intensity: 0.4, radius: 0.3) and Sparkles on GemComponent.
- OrbitControls on GemComponent: auto-rotates on idle, pauses on drag, resumes after 0.8s.
- CSS custom properties: `--page-padding`, `--hero-height`; `color: var(--white-color)` on body.

## Changed

- `GemComponent`: upgraded to use shared Scene atom, Gem atom, Bloom, Sparkles, OrbitControls; removed inline Canvas.
- `app/work/page.tsx`: WorkHero added above the timeline.
- `app/projects/page.tsx`: ProjectsHero added above the project cards grid.
- `app.scss`: Body now sets `color: var(--white-color)` globally for internal pages.

## [2.3.0] - 2026-03-08

### Added

- `app/providers.tsx`: Lenis smooth scroll wired to GSAP ScrollTrigger; active on every route from the first render.
- `hooks/useGsapContext.ts`: GSAP context hook scoped to a DOM ref, reverts on unmount, preventing stale tweens across route navigations.
- `organisms/WorkTimeline/`: Accordion component with GSAP height animation and `ScrollTrigger.batch` staggered entrance (6 tests).
- `molecules/ProjectCard/`: Scroll-triggered scale-in entrance animation per card (6 tests).
- 12 new component and hook tests (23 total).

### Changed

- `organisms/HomeLayout`: Migrated from raw `useLayoutEffect` + manual `gsap.context` to `useGsapContext` hook.
- `app/layout.tsx`: Children wrapped in `<Providers>` so Lenis is active on all routes.
- `app/work/page.tsx`: Replaced plain list with `WorkTimeline` accordion.
- `app/projects/page.tsx`: Replaced plain list with `ProjectCard` grid.

## [2.2.0] - 2026-03-07

### Added

- `content/work.ts`: typed TypeScript array of 4 work experience exntries.
- `content/projects.ts`: typed TypeScript array with 1 project entry.
- `app/work/page.ts`: static server-rendered work timeline page (unstyled).
- `app/projects/page.ts`: static server-rendered projects page (unstyled).
- Vitest + React Testing Library infraestructure (`vitest.config.ts`, `vitest.setup.ts`).
- Nabar unit tests (covering links hrefs and external links attributes).

### Changed

- Navbar: replaced dead `/blog` link with `/work` and `/projects` internal links.
- External Navbar links: added `rel='noopener noreferrer'` for security.
- `tsconfig.json`: added `vitst/globals` to types for IDE support.
- `package.json`: added `eslint-plugin-vitest-globals` for ESLint globals support.

## [2.1.0] - 2026-03-07

### Added

- Docker standalone build: three-stage Dockerfile (deps / builder / runner) with Node 22 slim.
- App-only `docker-compose.yml` for local container testing.
- `sharp` in production dependencies for Next.js image optimisation in Docker.
- Missing scripts: `start`, `test`, `typecheck`, `lint`.
- `image.formats` (avif + webp) to `next.config.js` for optimised delivery.

### Changed

- Moved `@types/react`, `@types/react-dom`, `eslint`, `eslint-config-next`, `typescript` from `dependencies` to `devDependencies`.
- `tsconfig.json`: removed `forceConsistentCasingInFileNames` (redundant with `strict: true`) and `"types": ["node"]` (auto-resolved by `@types/node`).
- `app/layout.tsx`: changed `import { Metadata }` to `import type { Metadata }` (best practice with `erasableSyntaxOnly`).

### Removed

- All Vercel environment variables from `.env.local` (replaced with self-hosted Umami placeholders).
