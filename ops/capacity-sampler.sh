#!/usr/bin/env bash
# The Cuatro capacity sampler (Story 1-5, AD-9).
#
# One run writes one sample: a box row, one row per running container, and a row
# recording what this run itself cost. Every row in a run carries the same
# timestamp, so a container reading and the box's load average can be read
# together rather than correlated by proximity.
#
# What this deliberately does not do:
#
#   * It does not call `docker stats`. That reports a rate over an interval it
#     chose, costs an API round trip per container, and cannot tell a missed
#     sample from an idle minute. Every counter here is read raw and cumulative
#     from cgroup v2, so `ops/capacity-summary.mjs` divides by real elapsed time
#     and a gap stays visible instead of being smoothed away.
#   * It does not compute anything. No rate, no average, no percentage. A
#     summariser can be fixed and rerun against the week; a sampler that threw
#     away the raw counters cannot.
#   * It does not filter. Infrastructure containers are sampled too. Which ids
#     the gate governs is `placements` in `ops/capacity-gate.yml`, a separate
#     question from what actually consumes the box.
#
# It is a guest on a box that is serving. The unit runs it at `Nice=10` in the
# idle IO class, and outside `docker ps` it forks nothing: every other read is a
# bash builtin against `/proc` or `/sys`. Its cost is not asserted to be small,
# it is measured every run and written into the `sampler` row.
#
# Exit codes: 0 a complete sample, 3 the log directory or file is unwritable,
# 4 Docker was unreachable so the box row stands alone. The timer fires on
# `OnUnitActiveSec`, so a non-zero exit does not stop the week.

set -u

# The box is Etc/UTC, so this converts nothing. It is set so that a sampler
# copied to a box that is not UTC still writes ISO 8601 UTC timestamps.
TZ=UTC
export TZ

LOG_DIR="${CAPACITY_LOG_DIR:-/var/log/cuatro-capacity}"
CGROUP_ROOT="${CAPACITY_CGROUP_ROOT:-/sys/fs/cgroup}"
SELF_CGROUP="${CAPACITY_SELF_CGROUP:-${CGROUP_ROOT}/system.slice/capacity-sampler.service}"

# Twelve columns, one shape for every kind of row. The summariser refuses a row
# with a different field count, so nothing written here may contain a comma.
SCHEMA='ts,kind,name,cgroup,usage_usec,psi_some_usec,psi_full_usec,memory_bytes,load1,load5,load15,note'

printf -v ts '%(%Y-%m-%dT%H:%M:%SZ)T' -1
day="${ts%%T*}"
out="${LOG_DIR}/capacity-${day}.csv"

if ! mkdir -p "${LOG_DIR}" 2>/dev/null; then
  printf 'capacity-sampler: cannot create %s\n' "${LOG_DIR}" >&2
  exit 3
fi
if [ ! -f "${out}" ]; then
  if ! printf '%s\n' "${SCHEMA}" > "${out}" 2>/dev/null; then
    printf 'capacity-sampler: cannot write %s\n' "${out}" >&2
    exit 3
  fi
fi

rows=()
status=0

# Strip the two characters that would corrupt a row. A Docker container name
# cannot contain either, so this is a guard rather than an expected path.
sanitise() {
  local value="${1//,/ }"
  printf '%s' "${value//$'\n'/ }"
}

# `total=` from a `/proc/pressure` or `cpu.pressure` line, in microseconds of
# stall. Cumulative since the cgroup was created.
psi_totals() {
  local file="$1" line key rest
  psi_some=''
  psi_full=''
  [ -r "${file}" ] || return 0
  while read -r key rest; do
    case "${key}" in
      some) psi_some="${rest##*total=}" ;;
      full) psi_full="${rest##*total=}" ;;
    esac
  done < "${file}"
  return 0
}

# --- the box -----------------------------------------------------------------
#
# Written before Docker is touched, so a box row exists even when the container
# rows do not.

load1=''
load5=''
load15=''
if [ -r /proc/loadavg ]; then
  read -r load1 load5 load15 _running _last < /proc/loadavg
fi

psi_totals /proc/pressure/cpu
box_some="${psi_some}"
box_full="${psi_full}"

mem_available=''
if [ -r /proc/meminfo ]; then
  while read -r key value _unit; do
    if [ "${key}" = 'MemAvailable:' ]; then
      mem_available=$(( value * 1024 ))
      break
    fi
  done < /proc/meminfo
fi

rows+=("${ts},box,_box,,,${box_some},${box_full},${mem_available},${load1},${load5},${load15},")

# --- the containers ----------------------------------------------------------
#
# Names and ids come from `docker ps` every run rather than from a cached list,
# because a redeploy replaces a container under the same name with a new id, and
# that new id is the cgroup. The id is carried in its own column so the
# summariser can segment on it instead of reading the counter reset as a
# negative delta.

vanished=0
if ! ps_out="$(docker ps --no-trunc --format '{{.ID}} {{.Names}}' 2>/dev/null)"; then
  rows+=("${ts},note,,,,,,,,,,docker unreachable so container rows were skipped")
  status=4
else
  while read -r cid cname; do
    [ -n "${cid}" ] || continue
    scope="${CGROUP_ROOT}/system.slice/docker-${cid}.scope"
    if [ ! -d "${scope}" ]; then
      # The container exited between `docker ps` and this read. Counted rather
      # than written as zeroes, which would read as a container that went idle.
      vanished=$(( vanished + 1 ))
      continue
    fi

    usage=''
    if [ -r "${scope}/cpu.stat" ]; then
      while read -r key value _rest; do
        if [ "${key}" = 'usage_usec' ]; then
          usage="${value}"
          break
        fi
      done < "${scope}/cpu.stat"
    fi

    psi_totals "${scope}/cpu.pressure"

    memory=''
    if [ -r "${scope}/memory.current" ]; then
      read -r memory < "${scope}/memory.current"
    fi

    rows+=("${ts},container,$(sanitise "${cname}"),${cid},${usage},${psi_some},${psi_full},${memory},,,,")
  done <<< "${ps_out}"

  if [ "${vanished}" -gt 0 ]; then
    rows+=("${ts},note,,,,,,,,,,${vanished} container cgroups vanished between docker ps and the read")
  fi
fi

# --- what this run cost ------------------------------------------------------
#
# Read last, so it covers as much of the run as a run can observe of itself. The
# service cgroup is created fresh for each oneshot invocation, so this counter is
# a per-run total and not cumulative, which is the one row in the file the
# summariser must not difference.

self_usec=''
if [ -r "${SELF_CGROUP}/cpu.stat" ]; then
  while read -r key value _rest; do
    if [ "${key}" = 'usage_usec' ]; then
      self_usec="${value}"
      break
    fi
  done < "${SELF_CGROUP}/cpu.stat"
fi
if [ -z "${self_usec}" ] && [ -r /proc/self/stat ]; then
  # Run by hand rather than by the unit, so there is no service cgroup to read.
  # utime, stime, cutime and cstime, in clock ticks.
  read -r -a self_stat < /proc/self/stat
  hz="$(getconf CLK_TCK 2>/dev/null)" || hz=''
  [ -n "${hz}" ] || hz=100
  self_usec=$(( (self_stat[13] + self_stat[14] + self_stat[15] + self_stat[16]) * 1000000 / hz ))
fi

self_peak=''
if [ -r "${SELF_CGROUP}/memory.peak" ]; then
  read -r self_peak < "${SELF_CGROUP}/memory.peak"
fi

rows+=("${ts},sampler,_sampler,,${self_usec},,,${self_peak},,,,per run total and not cumulative")

# --- flush -------------------------------------------------------------------

if ! printf '%s\n' "${rows[@]}" >> "${out}" 2>/dev/null; then
  printf 'capacity-sampler: cannot append to %s\n' "${out}" >&2
  exit 3
fi

exit "${status}"
