# CHANGELOG

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
