#!/usr/bin/env bash
# The Anchor's deploy on the box: reset the checkout to one commit on `main` and bring the stack up
# from it. `.github/workflows/deploy.yml` reaches it over SSH, and it is the forced command of that
# workflow's key once the Operator applies `ops/contract-serving.md` Pending Operator action 7
# (DW-94, Operator ruling 2026-09-24).
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
# Either way the target is refused unless it is 40 lowercase hex characters and an ancestor of
# `origin/main` after a fetch, so a leaked key can redeploy a commit already on `main` and do nothing
# else. The sha stays the last word of the workflow's command string, and this file stays at this
# path, because the key's line names it. Epic 3's image-pull deploy (Story 3-4) edits this file.
# `ops/__tests__/deploy-remote.test.ts` runs it both ways against a scratch repository.

set -euo pipefail

refuse() {
  echo "deploy-remote: refused: $1" >&2
  exit 1
}

main() {
  local target source
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
  echo "deploy-remote: deploying $target, read from $source"

  # `reset --hard` rather than `pull`: a pull fails or merges if the box checkout has drifted, and a
  # deploy that half-applies is worse than one that refuses. To the target rather than to
  # `origin/main`, which may have moved on since the workflow's gate step checked this commit (DW-93).
  git reset --hard "$target"

  # `--remove-orphans` is load-bearing, not tidiness. Story 1-21 renamed every service and deleted the
  # `caddy` service; on a host that ran the previous compose file those containers survive as
  # orphans, including a Caddy still binding 80 and 443, and a second binder of those ports is exactly
  # what took cuatro.dev down in the first place. `--build` compiles on the serving box, the standing
  # AD-8 violation `ops/known-violations.md` records as KV-1 until Epic 3.
  docker compose --env-file .env.production up --build -d --remove-orphans
}

# On one line, so bash has read the whole call before `git reset` can replace this file under it.
main "$@"; exit
