# CHANGELOG

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
