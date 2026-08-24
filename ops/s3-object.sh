#!/usr/bin/env bash
# The Cuatro S3-compatible object client (Story 1-8, AD-10).
#
# Three subcommands and no more: `put`, `get`, `selftest`. There is deliberately
# no `list` and no `delete`. Offsite retention is a bucket lifecycle rule set in
# the vendor console, which keeps the token this script carries at write-only:
# a box that is compromised can add objects and cannot remove the history that
# would let the estate recover from the compromise.
#
# Why this exists at all, when `restic` and `rclone` are one `apt install` away.
# AD-10 asks a declared non-Postgres store to carry an offsite path equivalent to
# `pg_dump` plus restic. That is a property of the result (encrypted, offsite,
# retained, restorable), not an instruction to run restic. The box has no `node`,
# no `restic`, no `rclone` and no `age`, and putting a third-party binary on a
# serving two-vCPU box, unattended, to move ninety kilobytes a night, buys dedup
# and snapshot management this store cannot use at the price of a dependency
# nobody in this repository can review. AWS SigV4 over `curl` and `openssl` is
# the code below, it is committed, and it is tested. The bucket stays
# S3-compatible, so Story 4-5 can point restic at the same bucket later without
# moving a byte.
#
# Configuration is environment only, never a file in this repository:
#
#   S3_ENDPOINT           https://<account>.r2.cloudflarestorage.com, no trailing key
#   S3_REGION             defaults to `auto`, which is what Cloudflare R2 wants
#   S3_BUCKET             bucket name, used path-style
#   S3_ACCESS_KEY_ID      access key id
#   S3_SECRET_ACCESS_KEY  secret access key
#
# Exit codes: 0 success, 1 any refusal or failure. Every failure names what
# failed and why, because the defect this story replaces failed silently.

set -uo pipefail

PROGRAM='s3-object'

# The three headers this client signs, in the lowercase-sorted order SigV4
# requires. Adding a header here means adding it to `canonical_request` too.
SIGNED_HEADERS='host;x-amz-content-sha256;x-amz-date'

# sha256 of the empty string. The payload hash of any request with no body.
EMPTY_SHA256='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

# The golden vector. `selftest` recomputes the Authorization header from these
# inputs and compares it byte for byte. The credentials are AWS's own published
# example pair, which exist precisely so a signing implementation can be checked
# without a real secret, so nothing here is a credential.
#
# `ops/__tests__/library-backup.test.ts` holds an independent SigV4
# implementation in Node, checks that implementation against two vectors AWS
# publishes with their expected signatures, then derives the value below from
# first principles and pins it. A change to either implementation without the
# other fails the suite.
GOLDEN_ACCESS_KEY_ID='AKIAIOSFODNN7EXAMPLE'
GOLDEN_SECRET_ACCESS_KEY='wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
GOLDEN_REGION='us-east-1'
GOLDEN_HOST='s3.us-east-1.amazonaws.com'
GOLDEN_URI='/examplebucket/digital-library/library-20260824T034500Z.tar.gz.gpg'
GOLDEN_DATE='20260824T034500Z'
GOLDEN_AUTHORIZATION='AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20260824/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=16c2a64a6dd328c0d52c7544842a9c742be8504a5325640801954b32a8d5013b'

die() {
  printf '%s: %s\n' "${PROGRAM}" "$*" >&2
  exit 1
}

usage() {
  cat >&2 <<'USAGE'
usage: s3-object.sh put <local-file> <object-key>
       s3-object.sh get <object-key> <local-file>
       s3-object.sh selftest
USAGE
  exit 1
}

# --- digests -----------------------------------------------------------------
#
# `openssl dgst` prints either `HEX *stdin` (with -r) or `NAME(stdin)= HEX`
# depending on version and build, so both shapes are reduced here rather than
# assumed. The length check is what stops a changed output format from being
# silently reduced to a short string that would then be signed as if it were a
# digest.

_digest() {
  local value
  value="$(tr -d '\n' | sed -e 's/^.*= //' -e 's/ \*.*$//' -e 's/[^0-9a-f]//g')"
  if [ "${#value}" -ne 64 ]; then
    printf '%s: openssl did not return a 64 character sha256 digest\n' "${PROGRAM}" >&2
    return 1
  fi
  printf '%s' "${value}"
}

sha256_string() {
  printf '%s' "$1" | openssl dgst -sha256 -r | _digest
}

sha256_file() {
  openssl dgst -sha256 -r < "$1" | _digest
}

# HMAC-SHA256 with a hex key, printing a hex digest, so the whole derivation
# chain stays in hex and never passes raw bytes through a shell variable.
hmac_hex() {
  printf '%s' "$2" | openssl dgst -sha256 -mac HMAC -macopt "hexkey:$1" -r | _digest
}

hex_of_string() {
  printf '%s' "$1" | od -An -v -tx1 | tr -d ' \n'
}

# --- signing -----------------------------------------------------------------

# Every argument is explicit rather than read from the environment, so
# `selftest` can sign the golden vector without the real configuration being
# present and without mutating it.
sigv4_authorization() {
  local access_key="$1" secret="$2" region="$3" method="$4" uri="$5" query="$6"
  local host="$7" payload_hash="$8" amz_date="$9"
  local stamp="${amz_date:0:8}"
  local scope="${stamp}/${region}/s3/aws4_request"
  local canonical canonical_hash string_to_sign key signature

  canonical="$(printf '%s\n%s\n%s\nhost:%s\nx-amz-content-sha256:%s\nx-amz-date:%s\n\n%s\n%s' \
    "${method}" "${uri}" "${query}" "${host}" "${payload_hash}" "${amz_date}" \
    "${SIGNED_HEADERS}" "${payload_hash}")"

  canonical_hash="$(sha256_string "${canonical}")" || return 1

  string_to_sign="$(printf 'AWS4-HMAC-SHA256\n%s\n%s\n%s' \
    "${amz_date}" "${scope}" "${canonical_hash}")"

  key="$(hmac_hex "$(hex_of_string "AWS4${secret}")" "${stamp}")" || return 1
  key="$(hmac_hex "${key}" "${region}")" || return 1
  key="$(hmac_hex "${key}" 's3')" || return 1
  key="$(hmac_hex "${key}" 'aws4_request')" || return 1
  signature="$(hmac_hex "${key}" "${string_to_sign}")" || return 1

  printf 'AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s' \
    "${access_key}" "${scope}" "${SIGNED_HEADERS}" "${signature}"
}

# --- guards ------------------------------------------------------------------

# The permitted character set is not a style preference. Every character in
# `[A-Za-z0-9._/-]` is unreserved in a SigV4 canonical URI, so a key drawn from
# it needs no percent-encoding and the signature cannot disagree with the path
# curl actually sends. A key outside the set is refused rather than encoded,
# because an encoder that disagreed with the signer by one character would
# produce a signature mismatch at 03:45 with no useful message.
validate_key() {
  local key="$1"
  local newline='
'
  [ -n "${key}" ] || die 'refusing an empty object key'
  case "${key}" in
    /*) die "refusing an unsafe object key (leading slash): ${key}" ;;
    *..*) die "refusing an unsafe object key (contains ..): ${key}" ;;
    *"${newline}"*) die 'refusing an unsafe object key (contains a newline)' ;;
  esac
  if ! printf '%s' "${key}" | grep -Eq '^[A-Za-z0-9._/-]+$'; then
    die "refusing an unsafe object key (characters outside [A-Za-z0-9._/-]): ${key}"
  fi
}

require_config() {
  local missing=()
  [ -n "${S3_ENDPOINT:-}" ] || missing+=('S3_ENDPOINT')
  [ -n "${S3_BUCKET:-}" ] || missing+=('S3_BUCKET')
  [ -n "${S3_ACCESS_KEY_ID:-}" ] || missing+=('S3_ACCESS_KEY_ID')
  [ -n "${S3_SECRET_ACCESS_KEY:-}" ] || missing+=('S3_SECRET_ACCESS_KEY')
  if [ "${#missing[@]}" -gt 0 ]; then
    die "missing required configuration: ${missing[*]}"
  fi
  S3_REGION="${S3_REGION:-auto}"
}

endpoint_host() {
  local rest="${S3_ENDPOINT#*://}"
  printf '%s' "${rest%%/*}"
}

# --- subcommands -------------------------------------------------------------

cmd_put() {
  [ "$#" -eq 2 ] || usage
  local file="$1" key="$2"
  [ -f "${file}" ] || die "put: no such file: ${file}"
  require_config
  validate_key "${key}"

  local host uri url amz_date payload auth status rc
  host="$(endpoint_host)"
  uri="/${S3_BUCKET}/${key}"
  url="${S3_ENDPOINT%/}${uri}"
  amz_date="$(date -u +%Y%m%dT%H%M%SZ)"
  payload="$(sha256_file "${file}")" || die "put: cannot hash ${file}"
  auth="$(sigv4_authorization "${S3_ACCESS_KEY_ID}" "${S3_SECRET_ACCESS_KEY}" \
    "${S3_REGION}" 'PUT' "${uri}" '' "${host}" "${payload}" "${amz_date}")" \
    || die 'put: could not compute the request signature'

  # `--data-binary` reads the whole body into memory. That is acceptable only
  # because `library-backup.sh` refuses to call this above MAX_ARCHIVE_BYTES,
  # and that ceiling is the reason the check exists.
  status="$(curl -sS -o /dev/null -w '%{http_code}' -X PUT \
    --data-binary "@${file}" \
    -H "Host: ${host}" \
    -H "x-amz-content-sha256: ${payload}" \
    -H "x-amz-date: ${amz_date}" \
    -H "Authorization: ${auth}" \
    "${url}")"
  rc=$?
  [ "${rc}" -eq 0 ] || die "put: ${key} could not be sent, curl exit ${rc}"
  case "${status}" in
    2??) ;;
    *) die "put: ${key} was refused by the endpoint with HTTP ${status}" ;;
  esac

  printf '%s\n' "${payload}"
}

cmd_get() {
  [ "$#" -eq 2 ] || usage
  local key="$1" out="$2"
  require_config
  validate_key "${key}"

  local host uri url amz_date auth status rc partial
  host="$(endpoint_host)"
  uri="/${S3_BUCKET}/${key}"
  url="${S3_ENDPOINT%/}${uri}"
  amz_date="$(date -u +%Y%m%dT%H%M%SZ)"
  auth="$(sigv4_authorization "${S3_ACCESS_KEY_ID}" "${S3_SECRET_ACCESS_KEY}" \
    "${S3_REGION}" 'GET' "${uri}" '' "${host}" "${EMPTY_SHA256}" "${amz_date}")" \
    || die 'get: could not compute the request signature'

  # Downloaded beside the destination and moved into place only on a 2xx, so a
  # caller comparing checksums never reads an error body as if it were an object.
  partial="${out}.partial.$$"
  status="$(curl -sS -o "${partial}" -w '%{http_code}' -X GET \
    -H "Host: ${host}" \
    -H "x-amz-content-sha256: ${EMPTY_SHA256}" \
    -H "x-amz-date: ${amz_date}" \
    -H "Authorization: ${auth}" \
    "${url}")"
  rc=$?
  if [ "${rc}" -ne 0 ]; then
    rm -f "${partial}"
    die "get: ${key} could not be fetched, curl exit ${rc}"
  fi
  case "${status}" in
    2??) ;;
    *)
      rm -f "${partial}"
      die "get: ${key} was refused by the endpoint with HTTP ${status}"
      ;;
  esac
  if ! mv "${partial}" "${out}"; then
    rm -f "${partial}"
    die "get: cannot write ${out}"
  fi

  sha256_file "${out}" || die "get: cannot hash ${out}"
}

cmd_selftest() {
  local auth
  auth="$(sigv4_authorization "${GOLDEN_ACCESS_KEY_ID}" "${GOLDEN_SECRET_ACCESS_KEY}" \
    "${GOLDEN_REGION}" 'PUT' "${GOLDEN_URI}" '' "${GOLDEN_HOST}" \
    "${EMPTY_SHA256}" "${GOLDEN_DATE}")" \
    || die 'selftest: the signature could not be computed at all'

  printf 'expected: %s\n' "${GOLDEN_AUTHORIZATION}"
  printf 'computed: %s\n' "${auth}"
  if [ "${auth}" != "${GOLDEN_AUTHORIZATION}" ]; then
    die 'selftest: the computed Authorization header does not match the golden vector'
  fi
  printf 'selftest: the golden SigV4 vector matches byte for byte\n'
}

main() {
  [ "$#" -ge 1 ] || usage
  local subcommand="$1"
  shift
  case "${subcommand}" in
    put) cmd_put "$@" ;;
    get) cmd_get "$@" ;;
    selftest) cmd_selftest "$@" ;;
    *) usage ;;
  esac
}

main "$@"
