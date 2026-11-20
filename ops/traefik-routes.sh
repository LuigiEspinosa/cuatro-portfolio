#!/usr/bin/env bash
# Traefik's routing, proven before it reaches the box (Story 9-21, DW-299; `ops/traefik-cutover.md` § Rehearsed
# off the box). Starts the committed `ops/traefik/compose.yml` service, with the committed `traefik.yml` and
# `dynamic/` exactly as the box mounts them, on a scratch internal Docker network where one whoami stand-in
# answers under each upstream alias `dynamic/routes.yml` dials. It then probes every router, in both branches
# of the dashboard's template, and fails on any difference from the expected answers below: a file Traefik
# rejects loads no router and fails every probe, and a router sent to the wrong alias names the wrong stand-in.
# The `traefik-routes` job in `ci.yml` runs it on every push. Never run on the box. Leaves nothing behind.
#
#   bash ops/traefik-routes.sh
#
# TRAEFIK_ROUTES_PREFIX names every container, network and volume it creates (default `traefik-routes`).
set -euo pipefail
export MSYS_NO_PATHCONV=1

# whoami v1.11, Traefik's own echo server, as the 2026-09-30 rehearsal ran it, and curl 8.11.1 for `%header{}`;
# each pinned by its multi-platform index digest, read 2026-10-18.
WHOAMI=traefik/whoami:v1.11@sha256:200689790a0a0ea48ca45992e0450bc26ccab5307375b41c84dfc4f2475937ab
CURL=curlimages/curl:8.11.1@sha256:c1fe1679c34d9784c1b0d1e5f62ac0a79fca01fb6377cdd33e90473c6f9f9a69
P="${TRAEFIK_ROUTES_PREFIX:-traefik-routes}"
NET="$P-net"
# Every upstream `dynamic/routes.yml` dials, alias:port, and the forward-auth service its `on` branch dials.
STAND_INS='anchor-app:3000 anchor-umami:3000 app:4000 cuatro-app:3000 library-web:3000 library-api:4000 list-wheel:80 tournament:3000 forward-auth:4180'
# A throwaway login for the dashboard's basic auth, on a network nothing outside this run can reach.
DASHBOARD_LOGIN=operator:throwaway

host_path() { if command -v cygpath > /dev/null; then cygpath -m "$1"; else printf '%s\n' "$1"; fi; }
ROOT="$(host_path "$(cd "$(dirname "$0")/.." && pwd)")"
T0="$(mktemp -d)"
W="$(host_path "$T0")"
PROJECT="docker compose -p $P -f $ROOT/ops/traefik/compose.yml -f $W/override.yml"

if docker network inspect "$NET" > /dev/null 2>&1; then
  echo "A network named $NET already exists here; this script creates and removes its own. Stopping." >&2
  exit 1
fi
cleanup() {
  $PROJECT down -v > /dev/null 2>&1 || true
  for a in $STAND_INS; do docker rm -f "$P-stand-in-${a%%:*}" > /dev/null 2>&1 || true; done
  docker network rm "$NET" > /dev/null 2>&1 || true
  rm -rf "$T0"
}
trap cleanup EXIT

# A self-signed pair in place of the Origin CA's, for the names the real one covers.
mkdir "$W/origin-ca"
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=throwaway-origin \
  -addext 'subjectAltName=DNS:cuatro.dev,DNS:*.cuatro.dev' \
  -keyout "$W/origin-ca/origin.key" -out "$W/origin-ca/origin.pem" 2> /dev/null
chmod 644 "$W/origin-ca/"*

# The ingress as committed, but published nowhere, given a scratch `.env`, the scratch pair, and the scratch
# network under the name its compose file joins. Image, `traefik.yml` and `dynamic/` are not overridden.
printf '%s\n' 'services:' '  ingress:' '    ports: !reset []' "    env_file: !override [$W/routes.env]" \
  '    volumes:' "      - $W/origin-ca:/etc/traefik/origin-ca:ro" \
  'networks:' '  cs-tracker_default:' "    name: $NET" '    external: true' > "$W/override.yml"
HASH="$(openssl passwd -apr1 "${DASHBOARD_LOGIN#*:}")"
env_file() { printf '%s\n' "TRAEFIK_DASHBOARD_USERS='${DASHBOARD_LOGIN%%:*}:$HASH'" CF_DNS_API_TOKEN=throwaway "$@" > "$W/routes.env"; }

# Internal: no egress, so the DNS-01 resolver never reaches Let's Encrypt or Cloudflare.
docker network create --internal "$NET" > /dev/null
for a in $STAND_INS; do
  docker run -d --name "$P-stand-in-${a%%:*}" --network "$NET" --network-alias "${a%%:*}" \
    "$WHOAMI" --port "${a##*:}" --name "${a%%:*}" > /dev/null
done

# One line per probe: label, status, X-Frame-Options, the stand-in that answered, redirect target ('-' if none).
# Then the routers the file provider loaded and every router's status, read from the dashboard's API.
PROBES='
p() { l=$1; shift; r=$(curl -sk --connect-to ::ingress: -w "\n@@%{http_code}|%header{x-frame-options}|%{redirect_url}" "$@");
  w=$(printf "%s" "$r" | sed -n "s/^@@//p"); n=$(printf "%s" "$r" | sed -n "s/^Name: //p" | tr -d "\r");
  s=${w%%|*}; d=${w##*|}; x=${w#*|}; x=${x%|*};
  echo "$l $s ${x:--} ${n:--} ${d:--}"; }
for i in $(seq 30); do [ "$(curl -sk --connect-to ::ingress: -o /dev/null -w "%{http_code}" https://cuatro.dev/)" = 200 ] && break; sleep 1; done
p cuatro.dev https://cuatro.dev/
p www https://www.cuatro.dev/some/path?q=1
p analytics https://analytics.cuatro.dev/
p cs-tracker https://cs-tracker.cuatro.dev/
echo "cs-tracker-upgrade $(curl -sk --http1.1 --connect-to ::ingress: -H "Connection: Upgrade" -H "Upgrade: websocket" https://cs-tracker.cuatro.dev/ | sed -n "s/^X-Forwarded-Proto: //p" | tr -d "\r")"
p tracker https://tracker.cuatro.dev/
p library https://library.cuatro.dev/books
p library-api https://library.cuatro.dev/api/x
p library-files https://library.cuatro.dev/files/y
p wheel https://wheel.cuatro.dev/
p tournament https://tournament.cuatro.dev/
p dns01-probe https://dns01-probe.scratch.cuatro.dev/
p unknown-host https://nope.cuatro.dev/
p plain-http http://cuatro.dev/some/path
p dashboard http://localhost:8080/dashboard/
p dashboard-login -u "$LOGIN" http://localhost:8080/dashboard/
p dashboard-oauth2 http://localhost:8080/oauth2/x
p dashboard-on-websecure -H "Host: localhost" https://ingress/dashboard/
a=$(curl -s --connect-to ::ingress: -u "$LOGIN" "http://localhost:8080/api/http/routers?per_page=1000")
echo "routers $(printf "%s" "$a" | grep -o "\"name\":\"[^\"]*@file\"" | sed "s/\"name\":\"//; s/@file\"//" | sort | paste -sd, -)"
echo "statuses $(printf "%s" "$a" | grep -o "\"status\":\"[^\"]*\"" | sed "s/\"status\":\"//; s/\"//" | sort -u | paste -sd, -)"
'

COMMON='cuatro.dev 200 DENY anchor-app -
www 301 DENY - https://cuatro.dev/some/path?q=1
analytics 200 DENY anchor-umami -
cs-tracker 200 - app -
cs-tracker-upgrade https
tracker 200 DENY cuatro-app -
library 200 SAMEORIGIN library-web -
library-api 200 SAMEORIGIN library-api -
library-files 200 SAMEORIGIN library-api -
wheel 200 DENY list-wheel -
tournament 200 DENY tournament -
dns01-probe 418 - - -
unknown-host 404 - - -
plain-http 301 - - https://cuatro.dev/some/path'

run() {
  local branch="$1" expected="$2"; shift 2
  env_file "$@"
  echo "== Traefik ($(sed -n 's/^ *image: \(traefik:.*\)/\1/p' "$ROOT/ops/traefik/compose.yml")), dashboard branch: $branch"
  $PROJECT up -d --wait --force-recreate ingress > /dev/null 2>&1 || { $PROJECT logs ingress; exit 1; }
  docker run --rm --network "$NET" -e LOGIN="$DASHBOARD_LOGIN" --entrypoint sh "$CURL" -c "$PROBES" | tee "$W/$branch.out"
  if ! printf '%s\n' "$expected" | diff -u - "$W/$branch.out"; then
    echo "FAIL: Traefik answered differently from the expected lines above (- expected, + answered). Its log:" >&2
    $PROJECT logs ingress >&2
    exit 1
  fi
}

run off "$COMMON
dashboard 401 - - -
dashboard-login 200 - - -
dashboard-oauth2 401 - - -
dashboard-on-websecure 404 - - -
routers analytics,cs-tournament,cs-tracker,cuatro-portfolio,cuatro-tracker,dashboard,digital-library,digital-library-api,dns01-probe,list-wheel,www
statuses enabled"

# The `on` branch: the forward-auth stand-in answers 200, so the gate admits, and its own paths reach it.
run on "$COMMON
dashboard 200 - - -
dashboard-login 200 - - -
dashboard-oauth2 200 - forward-auth -
dashboard-on-websecure 404 - - -
routers analytics,cs-tournament,cs-tracker,cuatro-portfolio,cuatro-tracker,dashboard,dashboard-oauth2,digital-library,digital-library-api,dns01-probe,list-wheel,www
statuses enabled" DASHBOARD_FORWARD_AUTH=on

echo "== every router answered as expected, in both dashboard branches"
