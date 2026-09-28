# The Hub's image (AD-8). The build context is the repository root, and the first stage narrows it
# to the `hub` workspace with `turbo prune --docker`: an app-directory context cannot see the
# lockfile or the workspace, and the whole root would carry the monorepo into the build.
# `.github/workflows/image.yml` builds this on every push and pushes it to GHCR tagged with the
# commit sha (Story 3-3); until Story 3-4 the box builds it too, through `docker-compose.yml`.
FROM node:24-slim AS prune
WORKDIR /app
COPY . .
# `hub` is the workspace, and the version is the root manifest's exact `turbo` pin, which
# `docker/__tests__/deps-stage.test.ts` holds this line to.
RUN npx --yes turbo@2.10.13 prune hub --docker

FROM node:24-slim AS deps
RUN corepack enable
WORKDIR /app
# turbo writes the pruned lockfile, `pnpm-workspace.yaml` and every manifest that lockfile names
# under `out/json/`, and this stage copies that and nothing from the build context. The install sees
# the root and `apps/hub` importers alone, so the token generator's packages stay out unless the Hub
# comes to depend on them (`ops/token-contract.md` action 4), and a workspace added later needs no
# line here.
COPY --from=prune /app/out/json/ ./
RUN pnpm install --frozen-lockfile

FROM node:24-slim AS builder
RUN corepack enable
WORKDIR /app
# The install with the lockfile it came from, since Next finds the workspace root by the lockfile.
COPY --from=deps /app ./
COPY --from=prune /app/out/full/ ./
# Neither is a workspace, so the prune leaves both out, and the Hub's build reads both: its `build`
# script runs the publish, and its stylesheets and the Registry module read `contracts/` (DW-257).
COPY --from=prune /app/contracts ./contracts
COPY --from=prune /app/packages/contracts-serve ./packages/contracts-serve

# Both are required. apps/hub/app/layout.tsx renders the tracking script only
# when the id AND the url are set, and Next inlines NEXT_PUBLIC_* at build time,
# so a missing arg here produces a working site that silently measures nothing.
ARG NEXT_PUBLIC_UMAMI_WEBSITE_ID
ENV NEXT_PUBLIC_UMAMI_WEBSITE_ID=$NEXT_PUBLIC_UMAMI_WEBSITE_ID
ARG NEXT_PUBLIC_UMAMI_URL
ENV NEXT_PUBLIC_UMAMI_URL=$NEXT_PUBLIC_UMAMI_URL

RUN pnpm --filter hub build

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# The label GitHub documents for connecting a container package to its repository, recommended so
# a workflow's `GITHUB_TOKEN` keeps the access it needs; a push from the workflow links it as well.
LABEL org.opencontainers.image.source=https://github.com/LuigiEspinosa/cuatro-portfolio
# Next traces the standalone output from the workspace root, so it mirrors the
# repository: the server is `apps/hub/server.js`, and the static chunks and the
# public directory go beside it, where it serves them from.
COPY --from=builder /app/apps/hub/.next/standalone ./
COPY --from=builder /app/apps/hub/.next/static ./apps/hub/.next/static
COPY --from=builder /app/apps/hub/public ./apps/hub/public
EXPOSE 3000
CMD ["node", "apps/hub/server.js"]
