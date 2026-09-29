# The tournament's Go demo worker, its own deploy unit (AD-7): image `ghcr.io/luigiespinosa/tournament-worker`,
# compose service `tournament-worker`, built from this directory alone, since Turborepo governs the
# JS/TS side only (AD-2). `.github/workflows/image-tournament.yml` builds it and pushes it tagged with
# the commit sha. It is imaged, not placed (AD-9, Story 3-7). Its tests run in CI's `test` job.
FROM golang:1.26.4-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/worker .

# Alpine rather than an empty image: the compose healthcheck probes `/healthz` with busybox `wget`,
# and the R2 client needs the CA bundle.
FROM alpine:3.22
RUN apk add --no-cache ca-certificates
LABEL org.opencontainers.image.source=https://github.com/LuigiEspinosa/cuatro-portfolio
COPY --from=builder /out/worker /usr/local/bin/worker
USER nobody
EXPOSE 8080
# The HTTP server: MatchZy's upload receiver and the admin presign endpoint, on $PORT (8080).
# `worker ingest` and `worker reparse` are one-off commands run from the same image.
CMD ["worker", "serve"]
