# CHANGELOG

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
