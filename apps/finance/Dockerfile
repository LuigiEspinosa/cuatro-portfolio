# The finance application's image (AD-8), built the way `apps/hub/Dockerfile` builds the Hub's: the
# context is the repository root, narrowed to the `finance` workspace with `turbo prune --docker`.
# `.github/workflows/image-finance.yml` builds it and pushes it to GHCR tagged with the commit sha.
# It is merged and imaged, not placed on the box: placement is a separate decision under AD-9.
FROM node:24-slim AS prune
WORKDIR /app
COPY . .
RUN npx --yes turbo@2.10.13 prune finance --docker

FROM node:24-slim AS deps
RUN corepack enable
WORKDIR /app
COPY --from=prune /app/out/json/ ./
RUN pnpm install --frozen-lockfile

FROM node:24-slim AS builder
RUN corepack enable
WORKDIR /app
COPY --from=deps /app ./
COPY --from=prune /app/out/full/ ./
# `build` runs `prisma generate` first, since the generated client is never committed.
RUN pnpm --filter finance build

# AD-23: the migration toolchain, apart from the server. The traced standalone output carries no
# Prisma CLI, so the one-off `finance-migrate` service runs this directory's copy, at the versions
# `pnpm-lock.yaml` resolves for `apps/finance` (`docker/__tests__/finance-image.test.ts` holds them
# equal). npm runs Prisma's install script here, which fetches the schema engine the CLI migrates with.
FROM node:24-slim AS migrate
WORKDIR /app/migrate
RUN apt-get update && apt-get install --yes --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN npm install --no-save --no-audit --no-fund prisma@7.6.0 dotenv@17.3.1

FROM node:24-slim AS runner
# openssl is for the schema engine `finance-migrate` runs from this image; the server needs none.
RUN apt-get update && apt-get install --yes --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
LABEL org.opencontainers.image.source=https://github.com/LuigiEspinosa/cuatro-portfolio
COPY --from=builder /app/apps/finance/.next/standalone ./
COPY --from=builder /app/apps/finance/.next/static ./apps/finance/.next/static
COPY --from=builder /app/apps/finance/public ./apps/finance/public
COPY --from=migrate /app/migrate/node_modules ./migrate/node_modules
COPY --from=builder /app/apps/finance/prisma.config.ts ./migrate/prisma.config.ts
COPY --from=builder /app/apps/finance/prisma/schema.prisma ./migrate/prisma/schema.prisma
COPY --from=builder /app/apps/finance/prisma/migrations ./migrate/prisma/migrations
EXPOSE 3000
# The server alone: migrations never run on boot (AD-23). `finance-migrate` runs
# `node migrate/node_modules/prisma/build/index.js migrate deploy` from `/app/migrate` before a rollout.
CMD ["node", "apps/finance/server.js"]
