#!/usr/bin/env bash
# Provider replaceability, evidenced (Story 5.7, FR-23, AD-11; `ops/identity-issuer.md` § Provider
# replaceability). Starts a second, independently implemented OpenID Provider (dex, pinned below) on a
# scratch internal Docker network, points each participant's built production artefact at it through its
# existing issuer and client variables alone, and completes a sign-in through each with
# `ops/provider-swap-sign-in.mjs`. Never run on the box. Leaves no container, network or file behind.
#
#   HUB_IMAGE=<the Hub's production image> [CS_TRACKER_IMAGE=<cs-tracker's production image>] \
#     bash ops/provider-swap.sh
#
# HUB_IMAGE is built from apps/hub/Dockerfile. CS_TRACKER_IMAGE is built from cs-tracker's own repository
# (its Dockerfile); without it cs-tracker is skipped and says so. The forward-auth service runs from the
# committed ops/traefik/compose.yml. The only thing added beside each participant's variables is trust in
# the scratch certificate authority that signed the issuer's certificate, which an issuer with a publicly
# trusted certificate does not need.
set -euo pipefail
export MSYS_NO_PATHCONV=1

# dex v2.45.1, Apache-2.0, a CNCF project; pinned by its multi-platform index digest, read 2026-10-02.
DEX=ghcr.io/dexidp/dex:v2.45.1@sha256:8499afd690c437f52301efd2b05b2455da5bd2dfc20332cd697dc9937f808462
NODE=node:24-slim
POSTGRES=postgres:18
NET=cs-tracker_default
ISSUER=https://issuer.test:5554
OWNER=owner@example.test
# The bcrypt hash of "password" from dex's own examples/config-dev.yaml. A throwaway login on a scratch
# issuer that exists for one run, never a credential.
HASH='$2a$10$2b2cU8CPhOTaGrs1HRQuAueS7JTT5ZHsHSzYiFPm1leZck7Mc8T4W'
: "${HUB_IMAGE:?set HUB_IMAGE to the Hub production image}"
CS_TRACKER_IMAGE="${CS_TRACKER_IMAGE:-}"

host_path() { if command -v cygpath > /dev/null; then cygpath -m "$1"; else printf '%s\n' "$1"; fi; }
ROOT="$(host_path "$(cd "$(dirname "$0")/.." && pwd)")"
T0="$(mktemp -d)"
W="$(host_path "$T0")"
PROJECT="docker compose -p provider-swap -f $ROOT/ops/traefik/compose.yml -f $W/override.yml --env-file $W/forward-auth.env"

if docker network inspect "$NET" > /dev/null 2>&1; then
  echo "A network named $NET already exists here; this script creates and removes its own. Stopping." >&2
  exit 1
fi
cleanup() {
  $PROJECT --profile forward-auth down -v > /dev/null 2>&1 || true
  docker rm -f provider-swap-issuer provider-swap-hub provider-swap-cs-tracker provider-swap-postgres > /dev/null 2>&1 || true
  docker network rm "$NET" > /dev/null 2>&1 || true
  rm -rf "$T0"
}
trap cleanup EXIT

# Each client is named by its id, as AD-3 derives it: an issuer that lets the id be chosen takes the id itself.
HUB_CLIENT=cuatro-portfolio; CS_CLIENT=cs-tracker; FA_CLIENT=traefik
secret() { openssl rand -hex 32; }
HUB_SECRET="$(secret)"; CS_SECRET="$(secret)"; FA_SECRET="$(secret)"

# The issuer's certificate, for issuer.test, signed by a certificate authority made for this run.
mkdir "$W/tls"
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=provider-swap-ca \
  -addext basicConstraints=critical,CA:TRUE -addext keyUsage=critical,keyCertSign \
  -keyout "$W/tls/ca.key" -out "$W/tls/ca.pem" 2> /dev/null
openssl req -newkey rsa:2048 -nodes -subj /CN=issuer.test -keyout "$W/tls/issuer.key" -out "$W/tls/issuer.csr" 2> /dev/null
printf 'subjectAltName=DNS:issuer.test\nextendedKeyUsage=serverAuth\n' > "$W/tls/issuer.ext"
openssl x509 -req -in "$W/tls/issuer.csr" -CA "$W/tls/ca.pem" -CAkey "$W/tls/ca.key" -CAcreateserial -days 1 \
  -extfile "$W/tls/issuer.ext" -out "$W/tls/issuer.pem" 2> /dev/null
chmod 644 "$W/tls/"*

# The issuer: one user, the three clients, each named as `ops/identity-issuer.md` § The clients derives it.
cat > "$W/dex.yaml" << EOF
issuer: $ISSUER
storage: {type: memory}
web: {https: 0.0.0.0:5554, tlsCert: /tls/issuer.pem, tlsKey: /tls/issuer.key}
oauth2: {skipApprovalScreen: true}
enablePasswordDB: true
staticPasswords:
  - {email: $OWNER, hash: '$HASH', username: owner, userID: 08a8684b-db88-4b73-90a9-3cd1661f5466}
staticClients:
  - {id: $HUB_CLIENT, name: $HUB_CLIENT, secret: $HUB_SECRET, redirectURIs: ['https://cuatro.dev/auth/callback']}
  - {id: $CS_CLIENT, name: $CS_CLIENT, secret: $CS_SECRET, redirectURIs: ['https://cs-tracker.cuatro.dev/auth/callback']}
  - {id: $FA_CLIENT, name: $FA_CLIENT, secret: $FA_SECRET, redirectURIs: ['http://localhost:8080/oauth2/callback']}
EOF
chmod 644 "$W/dex.yaml"

docker network create --internal "$NET" > /dev/null
drive() {
  docker run --rm --network "$NET" -v "$ROOT/ops/provider-swap-sign-in.mjs:/sign-in.mjs:ro" -v "$W/tls/ca.pem:/ca.pem:ro" \
    -e CA_FILE=/ca.pem -e LOGIN="$OWNER" "$NODE" node /sign-in.mjs "$@"
}

echo "== issuer: $(docker run --rm --entrypoint dex "$DEX" version | head -1), $ISSUER"
docker run -d --name provider-swap-issuer --network "$NET" --network-alias issuer.test \
  -v "$W/dex.yaml:/etc/dex/config.yaml:ro" -v "$W/tls:/tls:ro" "$DEX" dex serve /etc/dex/config.yaml > /dev/null
drive wait "$ISSUER/.well-known/openid-configuration"

echo "== the Hub ($HUB_IMAGE): OIDC_ISSUER, CUATRO_PORTFOLIO_OIDC_CLIENT_ID and _SECRET"
docker run -d --name provider-swap-hub --network "$NET" --network-alias hub \
  -e OIDC_ISSUER="$ISSUER" -e CUATRO_PORTFOLIO_OIDC_CLIENT_ID="$HUB_CLIENT" -e CUATRO_PORTFOLIO_OIDC_CLIENT_SECRET="$HUB_SECRET" \
  -e NODE_EXTRA_CA_CERTS=/ca.pem -v "$W/tls/ca.pem:/ca.pem:ro" "$HUB_IMAGE" > /dev/null
drive wait http://hub:3000/api/health
drive hub | tee "$W/hub.out"
SUB="$(sed -n 's/^sub=//p' "$W/hub.out")"

if [ -n "$CS_TRACKER_IMAGE" ]; then
  echo "== cs-tracker ($CS_TRACKER_IMAGE): OIDC_ISSUER, CS_TRACKER_OIDC_CLIENT_ID, _SECRET and _OWNER_SUB (the Hub's sub)"
  # What its production release needs to boot at all, as on the box, then the four OIDC values.
  printf '%s\n' "DATABASE_URL=ecto://postgres:throwaway@postgres/postgres" "SECRET_KEY_BASE=$(secret)$(secret)" \
    PHX_HOST=cs-tracker.cuatro.dev STEAM_ID=76561198000000000 > "$W/cs-tracker.env"
  docker run -d --name provider-swap-postgres --network "$NET" --network-alias postgres -e POSTGRES_PASSWORD=throwaway "$POSTGRES" > /dev/null
  for i in $(seq 60); do docker exec provider-swap-postgres pg_isready -U postgres -h 127.0.0.1 > /dev/null 2>&1 && break; sleep 1; done
  docker run --rm --network "$NET" --env-file "$W/cs-tracker.env" "$CS_TRACKER_IMAGE" /app/bin/migrate > /dev/null
  docker run --rm --entrypoint cat "$CS_TRACKER_IMAGE" /etc/ssl/certs/ca-certificates.crt > "$W/tls/cs-tracker-bundle.pem"
  cat "$W/tls/ca.pem" >> "$W/tls/cs-tracker-bundle.pem"
  docker run -d --name provider-swap-cs-tracker --network "$NET" --network-alias cs-tracker --env-file "$W/cs-tracker.env" \
    -e OIDC_ISSUER="$ISSUER" -e CS_TRACKER_OIDC_CLIENT_ID="$CS_CLIENT" -e CS_TRACKER_OIDC_CLIENT_SECRET="$CS_SECRET" \
    -e CS_TRACKER_OIDC_OWNER_SUB="$SUB" -v "$W/tls/cs-tracker-bundle.pem:/etc/ssl/certs/ca-certificates.crt:ro" \
    "$CS_TRACKER_IMAGE" > /dev/null
  drive wait http://cs-tracker:4000/no-such-route
  drive cs-tracker | tee "$W/cs-tracker.out"
  [ "$(sed -n 's/^sub=//p' "$W/cs-tracker.out")" = "$SUB" ] || { echo "FAIL cs-tracker's sub differs from the Hub's" >&2; exit 1; }
  echo "one identity: cs-tracker's sub equals the Hub's"
else
  echo "== cs-tracker: skipped, CS_TRACKER_IMAGE unset"
fi

echo "== forward-auth (ops/traefik/compose.yml): OIDC_ISSUER, TRAEFIK_OIDC_CLIENT_ID and _SECRET"
printf '%s\n' "OIDC_ISSUER=$ISSUER" "TRAEFIK_OIDC_CLIENT_ID=$FA_CLIENT" "TRAEFIK_OIDC_CLIENT_SECRET=$FA_SECRET" \
  "TRAEFIK_OIDC_OWNER_EMAIL=$OWNER" "TRAEFIK_FORWARD_AUTH_COOKIE_SECRET=$(openssl rand -base64 32 | tr -- '+/' '-_')" > "$W/forward-auth.env"
# Only the scratch authority's trust is added; the ingress is never started, its env_file only made to exist.
printf '%s\n' 'services:' '  ingress:' "    env_file: !override [$W/forward-auth.env]" '  forward-auth:' \
  "    volumes: ['$W/tls/ca.pem:/etc/ssl/certs/ca-certificates.crt:ro']" > "$W/override.yml"
$PROJECT --profile forward-auth up -d forward-auth
drive wait http://forward-auth:4180/ping
drive forward-auth

echo "== every participant signed in at $ISSUER"
