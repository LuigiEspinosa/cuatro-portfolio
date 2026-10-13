#!/usr/bin/env bash
# The estate's one demo reset scheduler (Story 5.10, AD-13, FR-26).
#
# Run on the box as `deploy` by `/etc/cron.d/cuatro-demo-reset`, a copy of `ops/demo-reset.cron`, every 15
# minutes, from the checkout the deploy keeps at `main`, never from an installed copy (DW-318). It runs each
# participant's `demo:reset` exactly as `ops/demo-principal.md` § The reset item 7 names it: a one-shot
# `docker compose run --rm --no-deps` in the participant's own compose project, so nothing runs inside a
# serving container and no timer lives in one. Participants run one after another, never at once.
#
# `ops/demo-reset.schedule`, beside this file, gives each participant an interval in minutes (a multiple of
# 15, at most 1440) or `off`. A participant is due on a tick whose minute since the epoch, rounded down to
# 15, is a multiple of its interval, so 60 runs at every hour's minute 0 and needs no state. `off` runs
# nothing and prints its `skipped` line on the hourly ticks only. Ids given as arguments run now, whatever
# their interval, `off` still honoured.
#
# Exit 0 when every participant that ran reset; 1 when one failed, timed out or skipped for any reason but its
# own switch being off (the others still run), another run holds the lock, the schedule cannot be read, or
# the installed cron file differs from the committed one. Each participant's own line passes through; then
# one summary line, written whenever the run did anything or failed, and nothing at all on a tick where
# nothing was due. The first failing run after a passing one opens a GitHub issue (`report` below).
#
# Tools: bash and only what `ops/postgres-backup.sh` already runs on the box, plus `docker`, `flock`,
# `timeout` and `curl`, observed there (`ops/demo-principal.md` § The scheduler). PATH is left as cron sets it.

set -uo pipefail
umask 077

PROGRAM='demo-reset'
TZ=UTC
export TZ

HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SCHEDULE="${HERE}/demo-reset.schedule"
CRON_COMMITTED="${HERE}/demo-reset.cron"
CRON_INSTALLED="${DEMO_RESET_CRON:-/etc/cron.d/cuatro-demo-reset}"
STATE_DIR="${DEMO_RESET_DIR:-/home/deploy/demo-reset}"
CHECKOUTS="${DEMO_RESET_CHECKOUTS:-/home/deploy}"
# Per participant. Three that each hang still end inside one 15 minute tick: 3 x (240 + 10) s.
STEP_TIMEOUT="${DEMO_RESET_TIMEOUT:-240}"
NOW="${DEMO_RESET_NOW:-$(date -u +%s)}"
TICK=15
DEFAULT_INTERVAL=60
MAX_INTERVAL=1440

v_lock='not-reached'
v_schedule='not-reached'
v_cron='not-reached'
v_ran=0
v_off=0
v_failed=''
SPOKE=0
tick=0

# Epic 5 retrospective M3: the first failing run after a passing one opens an issue in this repository, which
# reaches the Operator's mailbox as `deploy.yml`'s failure issues do. The header file holds one line,
# `Authorization: Bearer <token>`, and curl reads it itself, so the token never enters this script, its argv
# or the log. The marker holds `open` from the issue until the next passing run, so a failing streak opens one
# issue. Neither a missing header file nor a refused request changes the exit code.
ISSUE_HEADER="${DEMO_RESET_ISSUE_HEADER:-/etc/cuatro/demo-reset-issue.header}"
ISSUE_URL="${DEMO_RESET_ISSUE_URL:-https://api.github.com/repos/LuigiEspinosa/cuatro-portfolio/issues}"
ISSUE_MARKER="${STATE_DIR}/.demo-reset.issue"

# Prints the summary's issue= value for a run that exited $2 with summary $1.
report() {
  local line="$1" code="$2" ts="$3" answer
  if [ "${code}" -eq 0 ]; then
    : 2>/dev/null > "${ISSUE_MARKER}"
    printf 'none'
    return
  fi
  if [ -s "${ISSUE_MARKER}" ]; then printf 'open'; return; fi
  if [ ! -r "${ISSUE_HEADER}" ]; then printf 'unconfigured'; return; fi
  answer="$(printf '{"title":"Demo reset failed at %s","body":"%s\\n\\nThe first failing run since the last passing one. Each participant line is above its summary in /home/deploy/demo-reset/demo-reset.log on the box: ops/demo-principal.md, The scheduler."}' "${ts}" "${line}" \
    | curl -sS --max-time 30 -o /dev/null -w '%{http_code}' -X POST -H "@${ISSUE_HEADER}" \
        -H 'Accept: application/vnd.github+json' --data-binary @- "${ISSUE_URL}")"
  if [ "${answer}" = '201' ]; then
    printf 'open' 2>/dev/null > "${ISSUE_MARKER}"
    printf 'opened'
  else
    printf 'refused'
  fi
}

# shellcheck disable=SC2329 # invoked by the EXIT trap
finish() {
  local code=$? ts line
  if [ "${SPOKE}" -eq 1 ] || [ "${code}" -ne 0 ]; then
    ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    line="$(printf '%s ts=%s tick=%s lock=%s schedule=%s cron=%s ran=%s off=%s failed=%s' \
      "${PROGRAM}" "${ts}" "$(date -u -d "@$(( tick * 60 ))" +%H:%M)" "${v_lock}" \
      "${v_schedule}" "${v_cron}" "${v_ran}" "${v_off}" "${v_failed:-none}")"
    printf '%s issue=%s exit=%s\n' "${line}" "$(report "${line} exit=${code}" "${code}" "${ts}")" "${code}"
  fi
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

fail() {
  printf '%s: %s\n' "${PROGRAM}" "$1" >&2
  exit 1
}

# The record's commands, § The reset item 7, word for word. Sets DIR, SERVICE (the one compose runs) and CMD.
command_for() {
  case "$1" in
    cuatro-tracker)
      DIR='cuatro-portfolio'; SERVICE='tracker'
      CMD=(docker compose --env-file .env.production --profile tracker run --rm --no-deps tracker node node_modules/tsx/dist/cli.mjs scripts/demo-reset.ts) ;;
    cs-tracker)
      DIR='cs-tracker'; SERVICE='app'
      CMD=(docker compose run --rm --no-deps app /app/bin/cs_tracker eval 'CsTracker.Release.demo_reset()') ;;
    digital-library)
      DIR='digital-library'; SERVICE='api'
      CMD=(docker compose run --rm --no-deps api node apps/api/dist/demo-reset.js) ;;
    *) return 1 ;;
  esac
}
PARTICIPANTS=(cuatro-tracker cs-tracker digital-library)

case "${STEP_TIMEOUT}" in ''|0|*[!0-9]*) fail 'DEMO_RESET_TIMEOUT must be a whole number of seconds above 0' ;; esac
case "${NOW}" in ''|*[!0-9]*) fail 'DEMO_RESET_NOW must be seconds since the epoch' ;; esac
minute=$(( NOW / 60 ))
tick=$(( minute - minute % TICK ))

# --- the lock ---------------------------------------------------------------------
# flock's lock belongs to the open descriptor, so a run killed outright releases it with its process: a lock
# file left behind never blocks the next run.
mkdir -p -- "${STATE_DIR}" || fail "cannot create ${STATE_DIR}"
exec 9> "${STATE_DIR}/.demo-reset.lock" || fail "cannot open the lock in ${STATE_DIR}"
if ! flock -n 9; then
  v_lock='held'
  fail 'another run holds the lock; this one started nothing'
fi
v_lock='ok'

# --- the schedule -----------------------------------------------------------------
# Read whole before anything runs: a schedule nobody can read must not run half of itself.
declare -A INTERVAL=()
v_schedule='invalid'
[ -r "${SCHEDULE}" ] || fail "${SCHEDULE} cannot be read"
n=0
while IFS= read -r line || [ -n "${line}" ]; do
  n=$(( n + 1 ))
  case "${line}" in ''|'#'*) continue ;; esac
  if [[ ! "${line}" =~ ^([a-z0-9-]+)\ (off|[0-9]+)$ ]]; then
    fail "${SCHEDULE} line ${n} is not '<registry-id> <minutes|off>'"
  fi
  id="${BASH_REMATCH[1]}"
  value="${BASH_REMATCH[2]}"
  command_for "${id}" || fail "${SCHEDULE} line ${n} names ${id}, which is not a participant"
  [ -z "${INTERVAL[${id}]:-}" ] || fail "${SCHEDULE} line ${n} names ${id} a second time"
  if [ "${value}" != 'off' ]; then
    value=$(( 10#${value} ))
    if [ "${value}" -le 0 ] || [ $(( value % TICK )) -ne 0 ] || [ "${value}" -gt "${MAX_INTERVAL}" ]; then
      fail "${SCHEDULE} line ${n}: ${id}'s interval must be a multiple of ${TICK} minutes from ${TICK} to ${MAX_INTERVAL}"
    fi
  fi
  INTERVAL[${id}]="${value}"
done < "${SCHEDULE}"
for id in "${PARTICIPANTS[@]}"; do
  [ -n "${INTERVAL[${id}]:-}" ] || fail "${SCHEDULE} does not name ${id}"
done
for id in "$@"; do
  command_for "${id}" || fail "${id} is not a participant"
done
v_schedule='ok'

# --- the installed cron file ------------------------------------------------------
# DW-318: what cron runs must be what the checkout holds. A difference is reported and the resets still run.
if [ ! -e "${CRON_INSTALLED}" ]; then
  v_cron='absent'
elif cmp -s -- "${CRON_COMMITTED}" "${CRON_INSTALLED}"; then
  v_cron='match'
else
  v_cron='differs'
fi
case "${v_cron}" in
  absent) printf '%s: %s is not installed: ops/demo-principal.md § The scheduler, DS1\n' "${PROGRAM}" "${CRON_INSTALLED}" >&2 ;;
  differs) printf '%s: %s differs from ops/demo-reset.cron: reinstall it, ops/demo-principal.md § The scheduler, DS1\n' "${PROGRAM}" "${CRON_INSTALLED}" >&2 ;;
esac

# --- the resets -------------------------------------------------------------------
# A serving container's image tag, the form `ops/tracker-cutover.md` reads TRACKER_TAG in. `docker ps` lists
# newest first, so while a rollout holds two containers of the service the first line is the incoming image.
tag_of() {
  local images
  images="$(timeout 30 docker ps --filter label=com.docker.compose.project=cuatro-portfolio \
    --filter "label=com.docker.compose.service=$1" --format '{{.Image}}')"
  printf '%s\n' "${images%%$'\n'*}" | cut -d: -f2
}

# The one-off containers of this participant's service, by the labels compose gives a `run` container.
oneoffs() {
  timeout 30 docker ps -q --filter "label=com.docker.compose.project.working_dir=${CHECKOUTS}/${DIR}" \
    --filter "label=com.docker.compose.service=${SERVICE}" --filter label=com.docker.compose.oneoff=True
}

run_one() {
  local id="$1" code hub='' tracker='' before container out last
  command_for "${id}"
  before=$'\n'"$(oneoffs)"$'\n'
  if [ "${id}" = 'cuatro-tracker' ]; then
    hub="$(tag_of anchor-app)"
    tracker="$(tag_of tracker)"
    if [ -z "${hub}" ] || [ -z "${tracker}" ]; then
      printf 'demo:reset %s failed: anchor-app or tracker is not running, so HUB_TAG and TRACKER_TAG are unknown\n' "${id}" >&2
      return 1
    fi
  fi
  out="$(
    if [ "${id}" = 'cuatro-tracker' ]; then
      HUB_TAG="${hub}"
      TRACKER_TAG="${tracker}"
      export HUB_TAG TRACKER_TAG
    fi
    cd -- "${CHECKOUTS}/${DIR}" 2>/dev/null \
      || { printf 'demo:reset %s failed: no directory %s\n' "${id}" "${CHECKOUTS}/${DIR}" >&2; exit 1; }
    exec timeout --kill-after=10 "${STEP_TIMEOUT}" "${CMD[@]}" < /dev/null
  )"
  code=$?
  [ -z "${out}" ] || printf '%s\n' "${out}"
  case "${code}" in
    0)
      # Epic 5 retrospective M3: a participant the schedule runs must reset. Its own switch off is its
      # `demo access is off` and passes; any other skipped, the principal absent above all, is a hollow run,
      # and so is an exit 0 whose last line is neither (§ The reset item 8 promises exactly one).
      last="${out##*$'\n'}"
      case "${last}" in
        "demo:reset ${id} reset rows="*|"demo:reset ${id} skipped: demo access is off") return 0 ;;
        "demo:reset ${id} skipped: "*)
          printf 'demo:reset %s failed: skipped (%s) while the schedule runs it\n' "${id}" \
            "${last#"demo:reset ${id} skipped: "}" >&2 ;;
        *) printf 'demo:reset %s failed: exit 0 without its reset or skipped line\n' "${id}" >&2 ;;
      esac
      return 1 ;;
    124|137)
      printf 'demo:reset %s failed: timed out after %s s\n' "${id}" "${STEP_TIMEOUT}" >&2
      # Killing `docker compose run --rm` leaves its container running, holding its connection and its
      # transaction (observed 2026-10-03), so the one this run started goes too, and only that one.
      for container in $(oneoffs); do
        case "${before}" in
          *$'\n'"${container}"$'\n'*) ;;
          *) timeout 30 docker rm -f "${container}" > /dev/null \
               || printf 'demo:reset %s: cannot remove its container %s\n' "${id}" "${container}" >&2 ;;
        esac
      done ;;
  esac
  return 1
}

for id in "${PARTICIPANTS[@]}"; do
  interval="${INTERVAL[${id}]}"
  if [ "$#" -gt 0 ]; then
    named=0
    for arg in "$@"; do [ "${arg}" = "${id}" ] && named=1; done
    [ "${named}" -eq 1 ] || continue
  elif [ "${interval}" = 'off' ]; then
    [ $(( tick % DEFAULT_INTERVAL )) -eq 0 ] || continue
  elif [ $(( tick % interval )) -ne 0 ]; then
    continue
  fi
  SPOKE=1
  if [ "${interval}" = 'off' ]; then
    v_off=$(( v_off + 1 ))
    printf 'demo:reset %s skipped: off in ops/demo-reset.schedule\n' "${id}"
    continue
  fi
  v_ran=$(( v_ran + 1 ))
  run_one "${id}" || v_failed="${v_failed:+${v_failed},}${id}"
done

[ -z "${v_failed}" ] && [ "${v_cron}" = 'match' ] || exit 1
exit 0
