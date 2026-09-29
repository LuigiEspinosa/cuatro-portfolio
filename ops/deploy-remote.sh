#!/usr/bin/env bash
# The Anchor's deploy on the box: pull the Hub's image for one commit on `main` from GHCR, reset the
# checkout to that commit and roll the Hub's service onto the image with `docker-rollout`. It never
# builds: CI builds the image and pushes it tagged with the commit sha, and the box pulls it (AD-8,
# Story 3-4). `.github/workflows/deploy.yml` reaches it over SSH, and it is the forced command of that
# workflow's key (`ops/contract-serving.md` Pending Operator action 7, DW-94).
#
# It takes one input, the target commit, from one of two places.
#
# - Its argument. While the key is unrestricted, the box's login shell runs the workflow's command
#   string, which fetches `main`, reads this file out of the target commit and runs it with the sha.
#   That is how the first deploy after this file lands brings it onto the box, before any
#   `authorized_keys` line can name it.
# - SSH_ORIGINAL_COMMAND. Under `restrict,command="/bin/bash /home/deploy/cuatro-portfolio/ops/deploy-remote.sh"`
#   sshd runs this file in place of whatever the client asked for and hands the request over in that
#   variable. Its last word is read as the sha, and nothing in it is executed.
#
# Either way the target is refused unless it is 40 lowercase hex characters, an ancestor of
# `origin/main` after a fetch, and a commit that carries this file, so a leaked key can redeploy a
# commit already on `main` and do nothing else. A commit older than this file is refused because a
# reset to it deletes the file the key's line names and stops every later deploy (DW-131). The sha
# stays the last word of the workflow's command string, and this file stays at this path, because
# the key's line names it. Under that line sshd runs the checkout's copy, the one the previous deploy
# left, so a change here first runs on the deploy after the one that brings it (DW-264).
# `ops/__tests__/deploy-remote.test.ts` runs it both ways against a scratch repository.

set -euo pipefail

# The Hub's compose service, and the repository of its image, whose one tag per commit is the full sha
# (AD-3). `docker-compose.yml` names the same image through HUB_TAG.
SERVICE=anchor-app
REPOSITORY=ghcr.io/luigiespinosa/hub

# `docker-rollout` at the stack's v0.14 (the architecture's stack table), as the deploy user's Docker
# CLI plugin. The sha256 is the release asset's: GitHub's recorded digest, and the asset's own hash,
# both read on 2026-09-28.
ROLLOUT_VERSION=v0.14
ROLLOUT_SHA256=cdeaba6ae9eee3b0b606286e585bbda6787283d801a6ad6d9b9d2bc347fda05b

refuse() {
  echo "deploy-remote: refused: $1" >&2
  exit 1
}

rollout_ready() {
  [ "$(docker rollout --version 2>/dev/null)" = "docker-rollout version $ROLLOUT_VERSION" ]
}

# Idempotent: a box whose `docker rollout` already reports the pinned version downloads nothing, and
# anything else fetches the release asset and installs it only if it matches the pinned sha256. The
# download lands beside the plugin directory, never in it, where docker would list a half-written file
# as a plugin candidate.
install_rollout() {
  rollout_ready && return 0
  local plugin="$HOME/.docker/cli-plugins/docker-rollout" download="$HOME/.docker/docker-rollout.download"
  mkdir -p "${plugin%/*}"
  curl --fail --silent --show-error --location --proto '=https' --retry 3 --output "$download" \
    "https://github.com/wowu/docker-rollout/releases/download/$ROLLOUT_VERSION/docker-rollout"
  if ! echo "$ROLLOUT_SHA256  $download" | sha256sum --check --status; then
    rm -f "$download"
    refuse "the docker-rollout $ROLLOUT_VERSION download does not match its pinned sha256"
  fi
  chmod 0755 "$download"
  mv "$download" "$plugin"
  rollout_ready || refuse "docker does not run docker-rollout $ROLLOUT_VERSION from $plugin"
}

main() {
  local target source services running
  if [ "$#" -gt 0 ]; then
    target="$1" source='its argument'
  else
    target="${SSH_ORIGINAL_COMMAND-}" source='SSH_ORIGINAL_COMMAND'
  fi
  target="${target##*[[:space:]]}"
  [[ "$target" =~ ^[0-9a-f]{40}$ ]] || refuse "the target read from $source is not a full lowercase commit sha"

  cd "$HOME/cuatro-portfolio"
  # The destination is named so the ancestor check reads a current `origin/main` whatever the
  # checkout's fetch configuration, and without `+`, so a rewritten `main` fails the deploy.
  git fetch origin main:refs/remotes/origin/main
  git merge-base --is-ancestor "$target" origin/main || refuse "$target is not on origin/main"
  git cat-file -e "$target:ops/deploy-remote.sh" || refuse "$target carries no ops/deploy-remote.sh"
  echo "deploy-remote: deploying $target, read from $source"

  # The two steps that can fail for a reason outside this repository run before the checkout moves,
  # so such a failure leaves the box as it was. The pull is what makes this a deploy of the image CI
  # built: a sha with no image in GHCR stops here, and nothing on the box compiles (AD-8).
  install_rollout
  docker pull "$REPOSITORY:$target"

  # `reset --hard` rather than `pull`: a pull fails or merges if the box checkout has drifted, and a
  # deploy that half-applies is worse than one that refuses. To the target rather than to
  # `origin/main`, which may have moved on since the workflow's gate job checked this commit (DW-93).
  git reset --hard "$target"
  export HUB_TAG="$target"

  # AD-23: a schema migration runs here, as a discrete step before the rollout, against the service's
  # own database and never on container boot. The old container keeps serving until the new one is
  # healthy, so a migration must work with the version still serving: expand first, contract in a
  # later release. A service that owns a schema declares it as the one-off service
  # `<service>-migrate` under the `migrate` profile, which no `up` starts. The Hub owns no schema and
  # declares none, so today this runs nothing.
  services="$(docker compose --env-file .env.production --profile migrate config --services)"
  if grep -qx "$SERVICE-migrate" <<<"$services"; then
    docker compose --env-file .env.production --profile migrate run --rm "$SERVICE-migrate"
  fi

  # Scale then drain: a second container of the service starts beside the first, and the first is
  # stopped and removed only once the new one's healthcheck passes. If it never does, the new one is
  # removed and the old one keeps serving. 120 s outlasts the healthcheck's own verdict, a 30 s start
  # period and five 15 s intervals.
  docker rollout --env-file .env.production --timeout 120 "$SERVICE"

  # docker-rollout exits 0 without rolling anything when the service has a stopped container, which it
  # replaces alone, so the deploy ends on what the service actually runs.
  running="$(docker compose --env-file .env.production ps --format '{{.Image}}' "$SERVICE" | sort -u)"
  [ "$running" = "$REPOSITORY:$target" ] || refuse "$SERVICE runs ${running:-nothing}, not $REPOSITORY:$target"
  echo "deploy-remote: $SERVICE runs $REPOSITORY:$target"
}

# On one line, so bash has read the whole call before `git reset` can replace this file under it.
main "$@"; exit
