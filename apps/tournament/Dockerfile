# The tournament's image (AD-8), built the way `apps/finance/Dockerfile` builds finance's: the context is
# the repository root, narrowed to the `tournament` workspace with `turbo prune --docker`.
# `.github/workflows/image-tournament.yml` builds it and pushes it to GHCR tagged with the commit sha.
# It is placed by hand on the box under AD-9 (`ops/tournament-placement.md`, Story 3-7).
#
# The Go demo worker under `worker/` is another deploy unit with its own image (`worker/Dockerfile`);
# nothing here builds it (AD-2, AD-7).
#
# `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are inlined into the browser bundle at
# build time, so they are build arguments, which `.github/workflows/image-tournament.yml` passes from the
# repository variables of the same names (DW-281). Both are public by design. Without either, the
# browser's Realtime client throws at first use in an image that otherwise passes every probe, so the
# builder refuses to build rather than ship that image. The server reads every other value at runtime.
FROM node:24-slim AS prune
WORKDIR /app
COPY . .
RUN npx --yes turbo@2.10.13 prune tournament --docker

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
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN test -n "$NEXT_PUBLIC_SUPABASE_URL" || { echo 'NEXT_PUBLIC_SUPABASE_URL is empty: pass it with --build-arg (DW-281)' >&2; exit 1; }
RUN test -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" || { echo 'NEXT_PUBLIC_SUPABASE_ANON_KEY is empty: pass it with --build-arg (DW-281)' >&2; exit 1; }
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN pnpm --filter tournament build

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
LABEL org.opencontainers.image.source=https://github.com/LuigiEspinosa/cuatro-portfolio
COPY --from=builder --chown=node:node /app/apps/tournament/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/tournament/.next/static ./apps/tournament/.next/static
USER node
EXPOSE 3000
# The server alone. Nothing migrates on boot (AD-23): the schema lives in Supabase and its SQL
# migrations under `supabase/migrations/` are applied by `supabase db push`, a discrete step.
CMD ["node", "apps/tournament/server.js"]
