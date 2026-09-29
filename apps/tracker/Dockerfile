# The tracker's image (AD-8), built the way `apps/hub/Dockerfile` builds the Hub's: the context is the
# repository root, narrowed to the `tracker` workspace with `turbo prune --docker`.
# `.github/workflows/image-tracker.yml` builds it and pushes it to GHCR tagged with the commit sha.
#
# One image, three commands (Story 3-6): the `tracker` service runs the server, `tracker-worker` runs
# the BullMQ worker with `tsx`, and `tracker-migrate` runs the Prisma CLI before a rollout (AD-23). The
# worker and the CLI need the installed workspace rather than a traced server, so the image carries the
# pruned install and the build, every package at the version `pnpm-lock.yaml` resolves.
FROM node:24-slim AS prune
WORKDIR /app
COPY . .
RUN npx --yes turbo@2.10.13 prune tracker --docker

# openssl is what Prisma's engines are built against, for the generate below and for the migration the
# image runs; `node:24-slim` does not carry it.
FROM node:24-slim AS base
RUN apt-get update && apt-get install --yes --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

FROM base AS deps
RUN corepack enable
WORKDIR /app
COPY --from=prune /app/out/json/ ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
RUN corepack enable
WORKDIR /app
COPY --from=deps /app ./
COPY --from=prune /app/out/full/ ./
# `lib/env.ts` validates at runtime, where compose supplies the values; the build has none of them.
ENV NEXT_TELEMETRY_DISABLED=1 SKIP_ENV_VALIDATION=1
# `build` runs `prisma generate` first, since the generated client is never committed. Next's build cache
# is 0.4 GB the server never reads.
RUN pnpm --filter tracker build && rm -rf apps/tracker/.next/cache
# The install scripts that would fetch Prisma's schema engine never ran (`pnpm-workspace.yaml`), so
# the CLI fetches it here, once, rather than on the box at the first `tracker-migrate`.
RUN cd apps/tracker && node node_modules/prisma/build/index.js --version

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
LABEL org.opencontainers.image.source=https://github.com/LuigiEspinosa/cuatro-portfolio
COPY --from=builder --chown=node:node /app ./
WORKDIR /app/apps/tracker
USER node
EXPOSE 3000
# The server alone: migrations never run on boot (AD-23). `tracker-migrate` runs
# `node node_modules/prisma/build/index.js migrate deploy` here before a rollout, and `tracker-worker`
# runs `node node_modules/tsx/dist/cli.mjs worker.ts`.
CMD ["node", "node_modules/next/dist/bin/next", "start"]
