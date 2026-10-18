# Epic 7 runbook: relocate C:\CuatroEcosystem into the WSL2 ext4 filesystem

**Ruled out of scope 2026-10-18 by the Operator, never executed.** Kept as a record of the inventory and method only.

Written 2026-10-18 at `cuatro-portfolio` `dev` 63f6b06. Covers Story 7.1 (copy the repositories into the
WSL2 ext4 filesystem) and Story 7.2 (repair worktrees and Git configuration).

**Agents never execute this runbook. Luigi runs every step by hand and reports each step's result.**
An agent may read the reports and update the records afterwards; it never runs a step, never deletes
anything under `C:\CuatroEcosystem`, and never edits a repository other than `cuatro-portfolio`.

## 1. Purpose and scope

Move every Git repository, worktree and workspace folder under `C:\CuatroEcosystem` to
`/home/cuatro/CuatroEcosystem` inside the `Ubuntu-22.04` distro, so builds, tests and Git run on ext4
instead of across the 9P bridge to NTFS.

The governing rule is the one in `epics.md` § Epic 7: **copy first, delete only after verification.**
Nothing under `C:\` is removed until its copy has been proven to hold the same commits, the same stash,
the same worktrees and the same uncommitted state, and has built. Deletion then goes one top level entry
at a time, each behind its own final check and a compressed archive.

In scope: the 15 top level folders and 5 loose files of `C:\CuatroEcosystem`, the WSL side's Git, SSH,
`gh` and toolchain setup needed to verify them, the Windows side's Git settings for reaching the new
location, and the pointers that name the old path (Claude Code memory, the maintenance scripts).

Out of scope: the box (`deploy@177.7.52.248`), which is never touched; `C:\Development` and
`C:\MyStudies`; changing any repository's history, branches or remote; committing or pushing anything
in any repository.

Why the copy is `tar` and not `git clone`: a clone carries only what is committed and pushed. Eight
checkouts hold uncommitted work, three hold commits that exist only locally (StreamVault 10,
`cuatro-finance` 36, `poketracker-go` 1 ahead of their upstream), and three repositories own linked
worktrees whose administrative files live in the main checkout's `.git`. A clone would silently lose
all of that. `tar` carries `.git`, the index, the stash, the worktree metadata and every untracked file
byte for byte; only reinstallable build output is left behind.

## 2. Inventory

Taken 2026-10-18 with read only commands (`git status --porcelain` counted, never shown; `git worktree
list`; `git rev-list`; `du -sh`). Ahead and behind are against the local copy of the upstream as last
fetched, so a "behind" figure may be stale. "Copy size" excludes `node_modules`, `.next`, `_build`,
`deps`, `.turbo` and `.pnpm-store`, all gitignored and reinstallable.

### 2.1 Git repositories and worktrees

| # | Path under `C:\CuatroEcosystem` | Kind | Remote (`origin`) | Branch | Ahead / behind | Modified / untracked | Stash | Revisions (`--all`) | Size on disk | Copy size | Excluded from the copy |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `Lumen` | repository | `git@github.com:LuigiEspinosa/Lumen.git` | `main` | 0 / 0 | 0 / 3 | 0 | 13 | 2.9 MB | 2.9 MB | none |
| 2 | `MaiCoin` | repository | `git@github.com:LuigiEspinosa/MaiCoin.git` | `main` | 0 / 0 | 0 / 3 | 0 | 20 | 3.1 MB | 3.1 MB | none |
| 3 | `Mutuo` | repository | `git@github.com:LuigiEspinosa/Mutuo.git` | `main` | 0 / 0 | 0 / 4 | 0 | 30 | 29 MB | 29 MB | none |
| 4 | `StreamVault` | repository (private, stays private) | `git@github.com:LuigiEspinosa/StreamVault.git` | `main` | **10** / 0 | 0 / 4 | 0 | 11 | 3.8 MB | 3.8 MB | none |
| 5 | `connect-four-react` | repository | `git@github.com:LuigiEspinosa/connect-four-react.git` | `main` | 0 / 0 | 0 / 3 | 0 | 14 | 4.1 MB | 4.1 MB | none |
| 6 | `cs-tournament` | repository (superseded by `cuatro-portfolio/apps/tournament`) | `https://github.com/LuigiEspinosa/cs-tournament.git` | `main` | 0 / 0 | **189 / 26** (105 modified, 84 deleted) | 0 | 102 | 1.2 GB | 347 MB | `node_modules`, `.next` |
| 7 | `cuatro-finance` | repository (superseded by `cuatro-portfolio/apps/finance`) | `git@github.com:LuigiEspinosa/cuatro-finance.git` | `main` | **36** / 0 | 0 / 3 | 0 | 37 | 3.7 MB | 3.7 MB | none |
| 8 | `cuatro-portfolio` | repository | `git@github.com:LuigiEspinosa/cuatro-portfolio.git` | `dev` | 0 / 0 | 0 / 0 | 0 | 1094 (grows as records land) | 5.1 GB | about 400 MB | `node_modules` (root, `apps/finance`, `apps/tournament`, `apps/tracker`, `packages/tokens`), `.next` (four apps), `.turbo`, `.pnpm-store` (1.7 GB) |
| 9 | `tcg-tracker` | repository with no commits | `git@github.com:LuigiEspinosa/tcg-tracker.git` | `main` (unborn) | none | 0 / 2 | 0 | 0 | 2.5 MB | 2.5 MB | none |
| 10 | `cs-tracker-workspace/cs-tracker` | main checkout, owns 4 worktrees | `https://github.com/LuigiEspinosa/cs-tracker.git` | `main` | 0 / 40 | **3 / 0** | 0 | 101 | 254 MB | 8.6 MB | `deps`, `_build` |
| 11 | `cs-tracker-workspace/cs-tracker-dev` | worktree of #10 | same | `dev` | 0 / 14 | **2 / 0** | shared with #10 | shared | 103 MB | 7.3 MB | `deps`, `_build` |
| 12 | `cs-tracker-workspace/wt-demo-schema-alone` | worktree of #10 | same | `fix/demo-schema-alone` | 0 / 0 | **2 / 0** | shared | shared | 97 MB | 2.1 MB | `deps`, `_build` |
| 13 | `cs-tracker-workspace/wt-demo-sign-out` | worktree of #10 | same | `fix/demo-sign-out-own-session` | 0 / 0 | **2 / 0** | shared | shared | 68 MB | 2.2 MB | `deps`, `_build` |
| 14 | `cs-tracker-workspace/wt-migrate-bat-demo` | worktree of #10 | same | `fix/migrate-bat-demo` | 0 / 0 | **2 / 0** | shared | shared | 68 MB | 2.1 MB | `deps`, `_build` |
| 15 | `cuatro-tracker-workspace/cuatro-tracker` | repository (superseded by `cuatro-portfolio/apps/tracker`) | `git@github.com:LuigiEspinosa/cuatro-tracker.git` | `dev` | 0 / 0 | **1 / 1** | 0 | 131 | 1.1 GB | about 5 MB | `.pnpm-store` (1.1 GB) |
| 16 | `digital-library-workspace/digital-library` | main checkout, owns 4 worktrees | `git@github.com:LuigiEspinosa/digital-library.git` | `dev` | 0 / 17 | **10 / 1** | 0 | 169 | 46 MB | 46 MB | none |
| 17 | `digital-library-workspace/digital-library-5-8` | worktree of #16 | same | `story-5-8-demo-principal` | 0 / 0 | 0 / 0 | shared with #16 | shared | 1.2 MB | 1.2 MB | none |
| 18 | `digital-library-workspace/wt-demo-principal-one-way` | worktree of #16 | same | `fix/demo-principal-one-way` | 0 / 0 | 0 / 0 | shared | shared | 354 MB | about 2 MB | `node_modules`, `.pnpm-store` (352 MB) |
| 19 | `digital-library-workspace/wt-remove-deploy-job` | worktree of #16 | same | `chore/remove-deploy-job` | 0 / 0 | 0 / 0 | shared | shared | 1.2 MB | 1.2 MB | none |
| 20 | `digital-library-workspace/wt-retro8-cleanup` | worktree of #16 | same | `fix/retro8-field-focus-radius` | 0 / 0 | 0 / 0 | shared | shared | 350 MB | 15 MB | `node_modules` |
| 21 | `list-wheel-workspace/list-wheel` | main checkout, owns 1 worktree | `git@github.com:LuigiEspinosa/list-wheel.git` | `2-25-review-patches` | 0 / 0 | 0 / 0 | 0 | 67 | 260 MB | 5.6 MB | `node_modules` |
| 22 | `list-wheel-workspace/wt-retro8-cleanup` | worktree of #21 | same | `fix/retro8-field-focus-radius` | 0 / 0 | 0 / 0 | shared with #21 | shared | 310 MB | 62 MB | `node_modules` |
| 23 | `poketracker-go-workspace/poketracker-go` | repository | `git@github.com:LuigiEspinosa/poketracker-go.git` | `dev` | **1** / 0 | 0 / 0 | 0 | 19 | 10 MB | 10 MB | none |

Uncommitted work, inventoried only and never modified: `cs-tournament`, the five `cs-tracker` checkouts,
`cuatro-tracker`, and the main `digital-library` checkout. Every untracked entry in rows 1 to 9 is
BMAD or Claude tooling (`.claude/`, `_bmad/`, `_bmad-output/`, `docs/`, a guide file). No repository
uses Git LFS, a repository format extension, or a tracked symbolic link. `git fsck` on
`digital-library` reports dangling objects only, which is normal.

### 2.2 Folders and files that are not repositories

| Path under `C:\CuatroEcosystem` | What it is | Size on disk |
|---|---|---|
| `cs-tracker-workspace/` (outside the checkouts) | `.claude`, `AGENTS.md`, `CLAUDE.md`, `_bmad`, `_bmad-output`, `claude-design`, `docs`, `erl_crash.dump` | total folder 598 MB, copy 33 MB |
| `cuatro-tracker-workspace/` (outside the checkout) | `.agents`, `.claude`, `.devcontainer`, `.obsidian`, BMAD folders, `docs`, notes | total folder 1.2 GB |
| `digital-library-workspace/` (outside the checkouts) | `.claude`, `.nvmrc`, `.obsidian`, BMAD folders, `docs`, `DESIGN.md`, a PDF guide | total folder 755 MB, copy 420 MB before `.pnpm-store` |
| `list-wheel-workspace/` (outside the checkouts) | `.claude`, `DESIGN.md`, BMAD folders, `docs` | total folder 572 MB, copy 70 MB |
| `poketracker-go-workspace/` (outside the checkout) | `.claude`, `.obsidian`, BMAD folders, `docs`, a guide | 14 MB |
| `epic-8-evidence/` | seven Epic 8 evidence folders | 33 MB |
| `.backup-canary` | "backup canary, do not delete. Created 2026-09-20." | 49 bytes |
| `covidmap-workspace.zip`, `future-vizion-workspace.zip` | archives | 2.1 MB, 3.4 MB |
| `sprint-completion-prompt.md`, `vsrv.log` | loose files | 8.5 KB, 114 bytes |

Total on disk is about 10.5 GB; the copy is about 1.2 GB.

### 2.3 WSL and Git findings

| Check | Finding |
|---|---|
| `wsl -l -v` | `Ubuntu-22.04`, version 2, the default, stopped at the time of the check. `docker-desktop` also present. |
| Distro | Ubuntu 22.04.5 LTS, user `cuatro`, `systemd=true`, 8 CPUs, 15 GB RAM, `networkingMode=mirrored` (`.wslconfig`). |
| Free space in the distro | `/dev/sdd` 1007 GB, 2.4 GB used, **954 GB available** (virtual). |
| Free space on Windows | `C:` 476 GB, **66 GB free** (87% used). The distro's disk is `C:\Users\NumCuatro\AppData\Local\wsl\{635701e5-048e-4536-8108-00caf6c4da9a}\ext4.vhdx`, 4.5 GB today, and it grows on `C:`. **This is the real limit**, not the 954 GB. |
| Git | Windows `git version 2.50.1.windows.1` (scoop); WSL `git version 2.34.1`. 2.34 has `git worktree repair <path>...` (since 2.30), so no upgrade is required. |
| `~/CuatroEcosystem` in WSL | does not exist. |
| WSL `~/.gitconfig` | does not exist (no identity, no `core.autocrlf`). |
| WSL SSH | `~/.ssh/id_ed25519` is the key the box accepts. `github.com` is **not** in `known_hosts` (`Host key verification failed`), and no key is registered for GitHub from WSL. |
| WSL toolchain | **No native** `node`, `pnpm`, `corepack`, `gh`, `go`, `erl`, `elixir`, `mix`, `make`, `gcc`, `unzip`, `claude`. `python3`, `curl`, `tar`, `rsync` are present. `corepack`, `mix`, `elixir` and `docker` resolve to **Windows** binaries through interop on `PATH`, which must not be used for verification. |
| `/mnt/c` permissions | every file reads as mode 777 over DrvFs (`stat` on `cuatro-portfolio/package.json`), so a copy arrives with every file executable until normalized. |
| Windows global Git | `user.name`, `user.email`, `core.editor` (VS Code), `credential.helperselector.selected`, one `includeif` for `C:/Development/Fingerpaint/`, and one stale `safe.directory` naming `//wsl.localhost/Debian/...` (no Debian distro exists). System config: `core.autocrlf=true`, `core.symlinks=false`, Git Credential Manager. No `core.longpaths`. |
| Per repository Git | rows 1 to 10 carry `core.filemode=false`, `core.symlinks=false`, `core.ignorecase=true` (made on Windows). `cuatro-tracker`, `digital-library` and `list-wheel` carry `core.filemode=true`. `poketracker-go` carries `core.filemode=false`. |
| Docker | Docker Desktop not running at the time of the check. |
| Maintenance task | Scheduled task `\AI-Dev-Maintenance` runs `C:\Users\NumCuatro\.ai-dev\bin\maintenance.ps1`; `$ROOTS` at line 61 names `C:\CuatroEcosystem`. The same root list is in `health-check.ps1:27`, `prune-permissions.ps1:26` and `normalize-instructions.ps1:60`. |
| Claude Code memory | `C:\Users\NumCuatro\.claude\projects\c--CuatroEcosystem-cuatro-portfolio\memory\` (19 files) and `...\C--CuatroEcosystem-cuatro-tracker-workspace\memory\` (empty). |

**Blockers: none.** Space suffices on both sides (about 1.2 GB copied plus an estimated 6 to 10 GB of
reinstalled dependencies and archives, against 66 GB free on `C:`). Three gaps must be closed before
verification can run, and the runbook closes them: the WSL toolchain (step B1), GitHub access from WSL
(steps C10 to C12), and the open question of what backs up `C:\CuatroEcosystem` (step D5).

## 3. Conventions in this runbook

- **[WSL]**: a bash shell in the distro, opened from PowerShell with `wsl -d Ubuntu-22.04`.
- **[Git Bash]**: Git for Windows' bash on the Windows side.
- **[PowerShell]**: PowerShell 7 on Windows.
- Every step ends with **Expected** (what a correct run prints) and **Report** (what to send back).
  A step whose output differs from Expected stops the run at that step; report the output and go no
  further.
- The helper files live in `C:\Users\NumCuatro\epic7\` (`/mnt/c/Users/NumCuatro/epic7` from WSL,
  `/c/Users/NumCuatro/epic7` from Git Bash), outside every repository, so both sides read the same copy.
  They are created from WSL so they have LF line endings; never edit them in a Windows editor.

## 4. Preconditions

**P1. Free space.** [PowerShell]
```powershell
Get-PSDrive C | Select-Object @{n='FreeGB';e={[math]::Round($_.Free/1GB,1)}}
wsl -d Ubuntu-22.04 df -h /home/cuatro
```
Expected: `FreeGB` at least 20; the `df` line shows at least 20G under `Avail`.
Report: both figures.

**P2. Every editor and every agent session closed.** Close VS Code, Cursor, Obsidian (three workspaces
carry `.obsidian` vaults), any JetBrains IDE, and every Claude Code or Codex session whose directory is
under `C:\CuatroEcosystem`, this one included. Then [PowerShell]
```powershell
Get-Process Code, Cursor, Obsidian, idea64, webstorm64, rider64, claude, codex -ErrorAction SilentlyContinue | Select-Object Name, Id
```
Expected: no output.
Report: "no output", or the names listed.

**P3. No dev server, watcher or container bound to a checkout.** [PowerShell]
```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='erl.exe' OR Name='beam.smp.exe' OR Name='go.exe' OR Name='python.exe'" | Where-Object { $_.CommandLine -match 'CuatroEcosystem' } | Select-Object ProcessId, Name
docker ps --format "{{.Names}} {{.Mounts}}"
```
Expected: the first command prints nothing. The second prints nothing, or fails with "failed to connect
to the docker API" (Docker Desktop not running), or lists containers none of whose mounts name
`CuatroEcosystem`.
Report: both outputs.

**P4. Pause the weekly maintenance task** so it cannot delete a merged branch or prune a worktree between
the baseline and the final checks. [PowerShell]
```powershell
Disable-ScheduledTask -TaskName 'AI-Dev-Maintenance' | Select-Object TaskName, State
```
Expected: `AI-Dev-Maintenance  Disabled`.
Report: the line.

**P5. Unpushed commits, an informed choice.** StreamVault (10), `cuatro-finance` (36) and
`poketracker-go` (1) hold commits that exist only on this machine. The copy carries them and step E2
archives them, so pushing is not required. Decide whether to push them first by your usual route; this
runbook does not push.
Report: "pushed" or "not pushed".

**P6. No work on `C:\CuatroEcosystem` from step A2 until its entry is deleted in Phase E.** Work after the
baseline would exist only on `C:` and step E1 would refuse that entry's deletion. If that happens,
redo Phase A to C for that entry (see § 10).

## 5. Phase A: copy

**A1. Create the helper files.** [WSL] Paste as one block.
```bash
mkdir -p /mnt/c/Users/NumCuatro/epic7
cat > /mnt/c/Users/NumCuatro/epic7/lists.sh <<'EOF'
MAIN="Lumen MaiCoin Mutuo StreamVault connect-four-react cs-tournament cuatro-finance cuatro-portfolio tcg-tracker cs-tracker-workspace/cs-tracker cuatro-tracker-workspace/cuatro-tracker digital-library-workspace/digital-library list-wheel-workspace/list-wheel poketracker-go-workspace/poketracker-go"
WT="cs-tracker-workspace/cs-tracker-dev cs-tracker-workspace/wt-demo-schema-alone cs-tracker-workspace/wt-demo-sign-out cs-tracker-workspace/wt-migrate-bat-demo digital-library-workspace/digital-library-5-8 digital-library-workspace/wt-demo-principal-one-way digital-library-workspace/wt-remove-deploy-job digital-library-workspace/wt-retro8-cleanup list-wheel-workspace/wt-retro8-cleanup"
ALL="$MAIN $WT"
TOP="Lumen MaiCoin Mutuo StreamVault connect-four-react tcg-tracker cuatro-finance poketracker-go-workspace epic-8-evidence list-wheel-workspace cuatro-tracker-workspace cs-tournament digital-library-workspace cs-tracker-workspace cuatro-portfolio"
LOOSE=".backup-canary covidmap-workspace.zip future-vizion-workspace.zip sprint-completion-prompt.md vsrv.log"
EXCLUDES="--exclude=node_modules --exclude=.next --exclude=_build --exclude=deps --exclude=.turbo --exclude=.pnpm-store"
EOF
cat > /mnt/c/Users/NumCuatro/epic7/snapshot.sh <<'EOF'
#!/usr/bin/env bash
# Usage: snapshot.sh ROOT OUTFILE main|all|<repository path>...
# One block per repository: HEAD, branch, revision count, stash count, worktree count, sorted status.
set -u
# Read only: stop git status from refreshing and rewriting the index of the checkout it reads.
export GIT_OPTIONAL_LOCKS=0
. "$(dirname "$0")/lists.sh"
root=$1; out=$2; shift 2
case "${1:?name main, all, or repository paths}" in
  main) set -- $MAIN ;;
  all) set -- $ALL ;;
esac
: > "$out"
for d in "$@"; do
  r="$root/$d"
  {
    echo "## $d"
    echo "head $(git -C "$r" rev-parse -q --verify HEAD 2>/dev/null || echo none)"
    echo "branch $(git -C "$r" symbolic-ref --short -q HEAD 2>/dev/null || echo detached)"
    echo "revs $(git -C "$r" rev-list --count --all 2>/dev/null || echo 0)"
    echo "stash $(git -C "$r" stash list 2>/dev/null | wc -l)"
    echo "worktrees $(git -C "$r" worktree list 2>/dev/null | wc -l)"
    git -C "$r" status --porcelain 2>/dev/null | LC_ALL=C sort | sed 's/^/st /'
  } >> "$out"
done
echo "wrote $(grep -c '^## ' "$out") blocks to $out"
EOF
ls -l /mnt/c/Users/NumCuatro/epic7
```
Expected: two files listed, `lists.sh` and `snapshot.sh`.
Report: the listing.

**A2. Take the Windows baseline, immediately before copying.** [Git Bash]
```bash
bash /c/Users/NumCuatro/epic7/snapshot.sh /c/CuatroEcosystem /c/Users/NumCuatro/epic7/baseline-main.txt main
bash /c/Users/NumCuatro/epic7/snapshot.sh /c/CuatroEcosystem /c/Users/NumCuatro/epic7/baseline-all.txt all
grep -c '^st ' /c/Users/NumCuatro/epic7/baseline-all.txt
grep -E '^(## |head none)' /c/Users/NumCuatro/epic7/baseline-all.txt | grep -B1 'head none'
```
Expected: `wrote 14 blocks to .../baseline-main.txt`, `wrote 23 blocks to .../baseline-all.txt`; the
`st` count is 261 if nothing changed since the 2026-10-18 inventory (the sum of § 2.1's modified and
untracked columns), and a different figure is fine as long as you report it; the last command prints only `## tcg-tracker` and
`head none` (it has no commits). Any other `head none` means that repository did not open; stop.
Report: the four outputs.

**A3. Set the WSL Git settings the comparison depends on.** [WSL] These come before the copy is checked
because they decide what `git status` reports.
```bash
git config --global user.name "$(git.exe config --global user.name | tr -d '\r')"
git config --global user.email "$(git.exe config --global user.email | tr -d '\r')"
git config --global core.autocrlf input
git config --global --list
```
Why `core.autocrlf input`: the Windows checkouts were written under the system setting
`core.autocrlf=true`, so their text files hold CRLF while the commits hold LF. With `input`, Git turns
CRLF into LF whenever it reads a working file, so those files compare clean against their commits, and
it never writes CRLF again. With the Linux default (`false`) every CRLF file would read as modified and
the comparison in step B3 would fail on line endings alone. `true` is wrong on Linux: it would write
CRLF into every file Git checks out.
Expected: three lines, `user.name=...`, `user.email=...`, `core.autocrlf=input`.
Report: the three lines.

**A4. Copy every top level folder.** [WSL]
```bash
. /mnt/c/Users/NumCuatro/epic7/lists.sh
mkdir -p ~/CuatroEcosystem
set -o pipefail
for x in $TOP; do echo "copying $x"; tar -C /mnt/c/CuatroEcosystem $EXCLUDES -cf - "$x" | tar -C ~/CuatroEcosystem -xf - || echo "FAILED $x"; done
set +o pipefail
du -sh ~/CuatroEcosystem
```
`tar` from `/mnt/c` preserves `.git`, the index, stash, worktree metadata, untracked files and
timestamps. The excluded names are gitignored build output and package stores, reinstalled in Phase B
(no tracked path in any repository has a component with one of these names, checked 2026-10-18).
Expected: 15 `copying` lines, no `FAILED` line, and a total of about 1.2G.
Report: any `FAILED` or `tar:` line, and the total.

**A5. Copy the loose files.** [WSL]
```bash
. /mnt/c/Users/NumCuatro/epic7/lists.sh
for f in $LOOSE; do cp -a "/mnt/c/CuatroEcosystem/$f" ~/CuatroEcosystem/ && cmp "/mnt/c/CuatroEcosystem/$f" ~/CuatroEcosystem/"$f" && echo "same $f"; done
```
Expected: five `same` lines.
Report: the lines.

**A6. Normalize file modes in the main checkouts.** [WSL] DrvFs presented every file as 777, so the copy
has every file executable. This resets folders to 755, files to 644, and restores 755 on exactly the
files the index records as executable. Worktrees are done in step C3, after they are repaired.
```bash
. /mnt/c/Users/NumCuatro/epic7/lists.sh
for d in $MAIN; do ( cd ~/CuatroEcosystem/"$d" && find . -path ./.git -prune -o -type d -exec chmod 755 {} + -o -type f -exec chmod 644 {} + && git ls-files -s -z | grep -z '^100755 ' | cut -z -f2- | xargs -0 -r chmod 755 ) && echo "modes $d" || echo "FAILED $d"; done
```
Expected: 14 `modes` lines, no `FAILED`.
Report: any `FAILED` line.

## 6. Phase B: verify each copy

**B1. Install the toolchain inside WSL.** [WSL] Verification must run Linux binaries, never the Windows
ones that interop puts on `PATH`. `mise` is a new tool on the machine (a supply chain decision): it
installs from its official script and manages Node, Go, Erlang and Elixir per version.
```bash
sudo apt-get update && sudo apt-get install -y build-essential autoconf m4 libncurses-dev libssl-dev unzip
curl -fsSL https://mise.run | sh
echo 'eval "$(~/.local/bin/mise activate bash)"' >> ~/.bashrc
echo 'export COREPACK_ENABLE_DOWNLOAD_PROMPT=0' >> ~/.bashrc
exec bash -l
```
Then, in the new shell:
```bash
export KERL_CONFIGURE_OPTIONS="--without-javac --without-wx --without-odbc"
mise use -g node@24 go@1.26.4 erlang@28.5 elixir@1.19.5-otp-28
mise install node@22
command -v node go erl elixir mix corepack
node -v; go version; elixir --version | tail -1
```
Versions: Node 24 is what `cuatro-portfolio`'s CI runs; Node 22 is what `digital-library` requires
(`>=22 <23`); Go 1.26.4 is the newest `go.mod` here (the tournament worker); Erlang 28.5 and Elixir
1.19.5 are what `cs-tracker`'s Dockerfile builds with. Erlang compiles from source and takes 10 to 20
minutes.
Expected: every `command -v` path starts with `/home/cuatro/.local/share/mise/`, none with `/mnt/c/`;
`v24.` and `go1.26.4`, and `Elixir 1.19.5 (compiled with Erlang/OTP 28)`.
Report: the paths and versions.

**B2. Docker for the test databases.** Start Docker Desktop, open Settings, Resources, WSL integration,
and turn on `Ubuntu-22.04`. Then [WSL]
```bash
command -v docker; docker version --format '{{.Server.Version}}'
```
Expected: `/usr/bin/docker` and a server version.
Report: both lines.

**B3. Compare the main checkouts against the baseline.** [WSL]
```bash
bash /mnt/c/Users/NumCuatro/epic7/snapshot.sh ~/CuatroEcosystem /mnt/c/Users/NumCuatro/epic7/wsl-main.txt main
diff /mnt/c/Users/NumCuatro/epic7/baseline-main.txt /mnt/c/Users/NumCuatro/epic7/wsl-main.txt && echo IDENTICAL
```
This proves, per repository: the same HEAD and branch, the same `git rev-list --count --all`, the same
stash count, the same number of worktrees, and the same uncommitted state path by path (not just the
same count).
Expected: `wrote 14 blocks` and `IDENTICAL`.
If not identical: a block of ` M` lines on every file of `cuatro-tracker`, `digital-library` or
`list-wheel` means step A6 did not run there; ` M` lines on text files elsewhere mean step A3's
`core.autocrlf input` is missing. Fix the cause and repeat B3.
Report: `IDENTICAL`, or the `diff` output.

**B4. Object store integrity.** [WSL]
```bash
. /mnt/c/Users/NumCuatro/epic7/lists.sh
for d in $MAIN; do printf '%s ' "$d"; git -C ~/CuatroEcosystem/"$d" fsck --no-dangling --no-progress >/dev/null 2>&1 && echo ok || echo FAIL; done
```
Expected: 14 `ok` lines. If a line reads `FAIL`, run `git -C /c/CuatroEcosystem/<that path> fsck
--no-dangling` in [Git Bash]: a failure the source shares is pre-existing and is reported, not fixed here.
Report: the 14 lines.

**B5. Build and test each repository that builds.** [WSL] One block per repository, each from its own
AGENTS.md or package scripts. Run them one at a time.

A rule for every block: if a command fails in WSL, run the same command in the Windows checkout before
calling it a relocation fault. A failure that also happens on Windows is pre-existing and is recorded,
not fixed here.

B5.1 `cuatro-portfolio` (AGENTS.md § Running and verifying):
```bash
cd ~/CuatroEcosystem/cuatro-portfolio && corepack pnpm install --frozen-lockfile && corepack pnpm typecheck && corepack pnpm test --run
```
Expected: install completes, typecheck prints no error, Vitest ends with every file passed (about 1845
tests in 75 files at `a9bc0d7`; the count grows, never assert on it).

B5.2 `cs-tracker` (main checkout). This runs the compile and test halves of `mix precommit` but not
`mix precommit` itself: precommit also runs `mix format` and `mix deps.unlock --unused`, which rewrite
files, and this checkout holds uncommitted work that the copy must keep exactly as it is.
```bash
docker run -d --rm --name epic7-pg -e POSTGRES_HOST_AUTH_METHOD=trust -p 5432:5432 postgres:17-alpine
cd ~/CuatroEcosystem/cs-tracker-workspace/cs-tracker && mix local.hex --force && mix local.rebar --force && mix deps.get && mix compile --warnings-as-errors && mix test
docker stop epic7-pg
```
Expected: the compile prints no warning, `mix test` ends `0 failures`. If `docker run` fails with
"port is already allocated", a Postgres is already listening on 5432: skip the two `docker` lines and
run the middle line against it.

B5.3 `digital-library` (main checkout, Node 22):
```bash
cd ~/CuatroEcosystem/digital-library-workspace/digital-library && mise exec node@22 -- corepack pnpm install --frozen-lockfile && mise exec node@22 -- corepack pnpm typecheck && mise exec node@22 -- corepack pnpm test
```
Expected: no type error; Vitest reports every file passed.

B5.4 `cuatro-tracker`:
```bash
cd ~/CuatroEcosystem/cuatro-tracker-workspace/cuatro-tracker && corepack pnpm install --frozen-lockfile && corepack pnpm typecheck
```
Expected: no type error.

B5.5 `cuatro-finance`:
```bash
cd ~/CuatroEcosystem/cuatro-finance && corepack pnpm install --frozen-lockfile && corepack pnpm typecheck && corepack pnpm test
```
Expected: no type error; Vitest passes.

B5.6 `cs-tournament` (uncommitted work of 189 tracked changes, so its result on Windows is the reference):
```bash
cd ~/CuatroEcosystem/cs-tournament && npm ci && npm test
```
Expected: the same outcome the Windows checkout gives.

B5.7 `list-wheel` (main checkout; `npm test` needs a Chrome for Karma, so this checks the compile):
```bash
cd ~/CuatroEcosystem/list-wheel-workspace/list-wheel && npm ci && npx tsc -p tsconfig.app.json --noEmit
```
Expected: no output from `tsc`.

B5.8 `poketracker-go`:
```bash
cd ~/CuatroEcosystem/poketracker-go-workspace/poketracker-go/backend && go vet ./... && go test ./...
```
Expected: `go vet` silent; every package `ok` or `[no test files]`.

B5.9 `connect-four-react`:
```bash
cd ~/CuatroEcosystem/connect-four-react && npm ci && npx vitest run
```
Expected: Vitest passes.

B5.10 `MaiCoin`:
```bash
cd ~/CuatroEcosystem/MaiCoin && npm ci && npx hardhat compile
```
Expected: `Compiled ... Solidity file(s) successfully` or `Nothing to compile`.

B5.11 `StreamVault` (frontend):
```bash
cd ~/CuatroEcosystem/StreamVault/frontend && corepack pnpm install --frozen-lockfile && corepack pnpm exec vitest run
```
Expected: Vitest passes.

Git verification only, nothing to build: `Lumen` and `tcg-tracker` (documents only), `Mutuo` (Bun, with no
committed application code to build on this host).
Report for B5: per block, pass, or the failing command and its last 20 lines.

**B6. Prove the builds rewrote nothing.** [WSL]
```bash
bash /mnt/c/Users/NumCuatro/epic7/snapshot.sh ~/CuatroEcosystem /mnt/c/Users/NumCuatro/epic7/wsl-main-after-build.txt main
diff /mnt/c/Users/NumCuatro/epic7/baseline-main.txt /mnt/c/Users/NumCuatro/epic7/wsl-main-after-build.txt && echo IDENTICAL
```
Expected: `IDENTICAL`. A new `st ?? <folder>/` line is a build output that is not gitignored: delete that
folder in the WSL copy and repeat. Any other difference means a build rewrote a file: re-copy that
entry (§ 10, before Phase E) and give it git verification only.
Report: `IDENTICAL`, or the `diff` output.

## 7. Phase C: Git repair (Story 7.2)

**C1. Repair the worktrees from each main checkout.** [WSL] Each worktree's `.git` file and each main
checkout's `.git/worktrees/<name>/gitdir` still name `C:/CuatroEcosystem/...`. Run from the main
checkout and naming every worktree's new path, `git worktree repair` rewrites both directions.
```bash
cd ~/CuatroEcosystem/cs-tracker-workspace && git -C cs-tracker worktree repair "$PWD/cs-tracker-dev" "$PWD/wt-demo-schema-alone" "$PWD/wt-demo-sign-out" "$PWD/wt-migrate-bat-demo"
cd ~/CuatroEcosystem/digital-library-workspace && git -C digital-library worktree repair "$PWD/digital-library-5-8" "$PWD/wt-demo-principal-one-way" "$PWD/wt-remove-deploy-job" "$PWD/wt-retro8-cleanup"
cd ~/CuatroEcosystem/list-wheel-workspace && git -C list-wheel worktree repair "$PWD/wt-retro8-cleanup"
for m in cs-tracker-workspace/cs-tracker digital-library-workspace/digital-library list-wheel-workspace/list-wheel; do git -C ~/CuatroEcosystem/$m worktree list; done
```
Expected: `repair:` lines naming the corrected files and no `error:`; the three listings show 5, 5 and 2
lines, every path under `/home/cuatro/CuatroEcosystem/`, none marked `prunable`.
Report: the three listings.

**C2. Run repair inside each worktree.** [WSL] With C1 done this should change nothing; it proves each
worktree resolves its main repository on its own.
```bash
. /mnt/c/Users/NumCuatro/epic7/lists.sh
for w in $WT; do printf '%s ' "$w"; git -C ~/CuatroEcosystem/"$w" worktree repair && git -C ~/CuatroEcosystem/"$w" rev-parse --abbrev-ref HEAD; done
```
Expected: nine lines, each a worktree path followed by its branch from the inventory, no `fatal:`.
Report: the nine lines.

**C3. Normalize file modes in the worktrees.** [WSL] Same reasoning as A6.
```bash
. /mnt/c/Users/NumCuatro/epic7/lists.sh
for d in $WT; do ( cd ~/CuatroEcosystem/"$d" && find . -path ./.git -prune -o -type d -exec chmod 755 {} + -o -type f -exec chmod 644 {} + && git ls-files -s -z | grep -z '^100755 ' | cut -z -f2- | xargs -0 -r chmod 755 ) && echo "modes $d" || echo "FAILED $d"; done
```
Expected: nine `modes` lines.
Report: any `FAILED` line.

**C4. Per repository settings for ext4.** [WSL] Worktrees share their main checkout's config, so this
covers all 23.
```bash
. /mnt/c/Users/NumCuatro/epic7/lists.sh
for d in $MAIN; do git -C ~/CuatroEcosystem/"$d" config core.filemode true && git -C ~/CuatroEcosystem/"$d" config core.ignorecase false && git -C ~/CuatroEcosystem/"$d" config core.symlinks true && echo "config $d"; done
```
Why: `core.filemode true` because ext4 stores the executable bit and A6 and C3 made the bits on disk
match the index, so Git can now track mode changes as it does on any Linux checkout (on Windows it
could not). `core.ignorecase false` because ext4 is case sensitive and `true` would hide a rename that
only changes case. `core.symlinks true` because Linux has real symbolic links (no repository tracks one
today, so nothing changes now).
Expected: 14 `config` lines.
Report: any missing line.

**C5. Compare all 23 against the baseline.** [WSL]
```bash
bash /mnt/c/Users/NumCuatro/epic7/snapshot.sh ~/CuatroEcosystem /mnt/c/Users/NumCuatro/epic7/wsl-all.txt all
diff /mnt/c/Users/NumCuatro/epic7/baseline-all.txt /mnt/c/Users/NumCuatro/epic7/wsl-all.txt && echo IDENTICAL
```
Expected: `wrote 23 blocks` and `IDENTICAL`.
Report: `IDENTICAL`, or the `diff` output.

**C6. Rewrite CRLF working files as LF, in checkouts with no tracked change only.** [WSL] Files written on
Windows still hold CRLF; a shell script with CRLF fails under bash. `git checkout-index --force --all`
rewrites every tracked file from the index, so it runs only where no tracked file is modified; the
guard checks that per checkout at run time. Untracked files are never touched.
```bash
. /mnt/c/Users/NumCuatro/epic7/lists.sh
for d in $ALL; do r=~/CuatroEcosystem/"$d"; if [ -n "$(git -C "$r" rev-parse -q --verify HEAD)" ] && [ -z "$(git -C "$r" status --porcelain --untracked-files=no)" ]; then git -C "$r" checkout-index --force --all && echo "refreshed $d"; else echo "skipped $d"; fi; done
bash /mnt/c/Users/NumCuatro/epic7/snapshot.sh ~/CuatroEcosystem /mnt/c/Users/NumCuatro/epic7/wsl-all-lf.txt all
diff /mnt/c/Users/NumCuatro/epic7/baseline-all.txt /mnt/c/Users/NumCuatro/epic7/wsl-all-lf.txt && echo IDENTICAL
```
Expected: `skipped` for `tcg-tracker` (no commits), `cs-tournament`, the five `cs-tracker` checkouts,
`cuatro-tracker` and the main `digital-library` checkout; `refreshed` for the other 14; then `IDENTICAL`.
The skipped checkouts keep CRLF in their files until their work is committed; a later
`git checkout-index --force --all` there, with a clean status, finishes the job.
Report: the `skipped` names and `IDENTICAL`.

**C7. Integrity and worktree health after the repair.** [WSL]
```bash
. /mnt/c/Users/NumCuatro/epic7/lists.sh
for d in $MAIN; do printf '%s ' "$d"; git -C ~/CuatroEcosystem/"$d" fsck --no-dangling --no-progress >/dev/null 2>&1 && echo ok || echo FAIL; done
for m in cs-tracker-workspace/cs-tracker digital-library-workspace/digital-library list-wheel-workspace/list-wheel; do git -C ~/CuatroEcosystem/$m worktree prune --dry-run --verbose; done
```
Expected: 14 `ok` lines (fsck also checks every worktree's HEAD and index); the prune dry runs print
nothing.
Report: the lines.

**C8. `safe.directory` on the WSL side.** [WSL]
```bash
. /mnt/c/Users/NumCuatro/epic7/lists.sh
for d in $ALL; do git config --global --add safe.directory "$HOME/CuatroEcosystem/$d"; done
git config --global --get-all safe.directory | wc -l
```
Why: every copied file is owned by `cuatro`, so Git's ownership check passes today and nothing failed
without this. The entries are set deliberately so a checkout restored by `sudo tar` or another user
still opens, instead of failing with "detected dubious ownership" at the worst moment. They name exact
paths, never `*`, so no other directory is trusted.
Expected: `23`.
Report: the number.

**C9. Windows side: reach the new location safely.** [PowerShell]
```powershell
git config --global --add safe.directory '%(prefix)///wsl.localhost/Ubuntu-22.04/home/cuatro/CuatroEcosystem/*'
git config --global core.longpaths true
git config --global --fixed-value --unset safe.directory '%(prefix)///wsl.localhost/Debian/home/cuatro/development/*'
git config --global --get-all safe.directory
git config --global --get core.longpaths
```
Why: through `\\wsl.localhost\Ubuntu-22.04\...` the files are owned by a Linux user, so Windows Git
refuses them without a `safe.directory` entry. `core.longpaths` exists only in Git for Windows (Linux has
no 260 character path limit, so setting it in WSL does nothing); on Windows it stops a deep
`node_modules` path from failing a checkout or status reached through that share. The third line
removes the entry for the Debian distro that no longer exists; skip it to keep that entry.
Caution: Windows Git sees the worktrees' recorded paths (`/home/cuatro/...`) as missing, so a Windows
`git worktree prune` against these repositories would delete every worktree's registration. Run Git for
the relocated repositories from WSL; § 8 step D2 keeps the maintenance task away from them for this
reason.
Expected: the `Ubuntu-22.04` entry listed (and no `Debian` entry if the third line ran); `true`.
Report: both outputs.

**C10. A GitHub SSH key for WSL.** [WSL] The existing `~/.ssh/id_ed25519` is the key the box accepts;
it keeps that single job. GitHub gets its own key.
```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_github -C "cuatro@wsl-ubuntu-22.04 github"
printf 'Host github.com\n  IdentityFile ~/.ssh/id_ed25519_github\n  IdentitiesOnly yes\n' >> ~/.ssh/config
chmod 600 ~/.ssh/config
ssh-keyscan -t ed25519 github.com >> ~/.ssh/known_hosts
ssh-keygen -lf ~/.ssh/known_hosts -F github.com
```
Choose a passphrase at the prompt (or none; that is your call).
Expected: the last line shows `SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU` (ED25519), which is
GitHub's published host key fingerprint. If it shows anything else, remove the line from
`~/.ssh/known_hosts` and stop.
Report: the fingerprint line.

**C11. `gh` in WSL, and the credential helper.** [WSL] Install from GitHub's apt repository:
```bash
sudo mkdir -p -m 755 /etc/apt/keyrings
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null
sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt-get update && sudo apt-get install -y gh
gh auth login --hostname github.com --git-protocol ssh --web --skip-ssh-key
gh auth refresh --hostname github.com --scopes admin:public_key
gh ssh-key add ~/.ssh/id_ed25519_github.pub --title "WSL Ubuntu-22.04"
gh auth setup-git
gh auth status
ssh -T git@github.com
```
Why `gh auth setup-git`: `cs-tournament` and `cs-tracker` use HTTPS remotes. It makes `gh` the
credential helper for `github.com`, so HTTPS pushes use the token `gh` holds, and the Windows Git
Credential Manager (a Windows binary) is not needed inside WSL. The SSH remotes use the key from C10.
The token stays in `gh`'s store; never print it.
Expected: `gh auth status` shows `Logged in to github.com account LuigiEspinosa`; `ssh -T` prints
`Hi LuigiEspinosa! You've successfully authenticated, but GitHub does not provide shell access.`
Report: those two lines.

**C12. Every remote answers, and routine operations work.** [WSL]
```bash
. /mnt/c/Users/NumCuatro/epic7/lists.sh
for d in $MAIN; do printf '%s ' "$d"; git -C ~/CuatroEcosystem/"$d" ls-remote origin >/dev/null 2>&1 && echo ok || echo FAIL; done
for d in $ALL; do printf '%s ' "$d"; git -C ~/CuatroEcosystem/"$d" log -1 --format=%h >/dev/null 2>&1 && git -C ~/CuatroEcosystem/"$d" stash list >/dev/null && git -C ~/CuatroEcosystem/"$d" branch -vv >/dev/null && echo ok || echo FAIL; done
```
Expected: 14 `ok` lines for the remotes. For the 23 routine checks, `ok` everywhere except
`tcg-tracker`, which reads `FAIL` because it has no commit for `git log` to show (expected, unchanged
from Windows).
Report: any other `FAIL`.

Story 7.2's acceptance is met when C1 to C12 match their Expected lines.

## 8. Phase D: cut over

**D1. Claude Code inside WSL, with its memory.** Claude Code names a project's folder after its path,
so the Windows memory at `C:\Users\NumCuatro\.claude\projects\c--CuatroEcosystem-cuatro-portfolio\memory\`
is not found from `/home/cuatro/CuatroEcosystem/cuatro-portfolio`. The global instructions
(`C:\Users\NumCuatro\.claude\CLAUDE.md` and `rules\`) do not load in WSL either. [WSL]
```bash
curl -fsSL https://claude.ai/install.sh | bash
mkdir -p ~/.claude && cp -r /mnt/c/Users/NumCuatro/.claude/CLAUDE.md /mnt/c/Users/NumCuatro/.claude/rules ~/.claude/
cd ~/CuatroEcosystem/cuatro-portfolio && claude
```
Exit Claude Code at once, then:
```bash
ls ~/.claude/projects/
```
Copy the memory into the folder that listing shows for `cuatro-portfolio` (expected
`-home-cuatro-CuatroEcosystem-cuatro-portfolio`):
```bash
mkdir -p ~/.claude/projects/-home-cuatro-CuatroEcosystem-cuatro-portfolio/memory
cp -a /mnt/c/Users/NumCuatro/.claude/projects/c--CuatroEcosystem-cuatro-portfolio/memory/. ~/.claude/projects/-home-cuatro-CuatroEcosystem-cuatro-portfolio/memory/
ls ~/.claude/projects/-home-cuatro-CuatroEcosystem-cuatro-portfolio/memory | wc -l
```
The `cuatro-tracker-workspace` project's memory folder is empty, so nothing to copy there. The rules
copied above still name `C:\CuatroEcosystem` as a root (see D3).
Expected: the project folder name, and `19`.
Report: both.

**D2. The maintenance scripts.** `maintenance.ps1:61`, `health-check.ps1:27`, `prune-permissions.ps1:26`
and `normalize-instructions.ps1:60` under `C:\Users\NumCuatro\.ai-dev\bin\` list `C:\CuatroEcosystem`
as a root. Do **not** repoint them at `\\wsl.localhost\Ubuntu-22.04\home\cuatro\CuatroEcosystem`:
`maintenance.ps1` § 2 runs Windows `git worktree prune`, which would treat every relocated worktree as
missing and delete its registration (see C9). Remove `'C:\CuatroEcosystem', ` from each of the four
lines in your editor (keeping `C:\Development` and `C:\MyStudies`), then [PowerShell]
```powershell
Select-String -Path C:\Users\NumCuatro\.ai-dev\bin\*.ps1 -Pattern "C:\\CuatroEcosystem" | Select-Object Filename, LineNumber
Enable-ScheduledTask -TaskName 'AI-Dev-Maintenance' | Select-Object TaskName, State
```
Expected: the only remaining matches are the prose mentions in `install-scheduled-task.ps1:75` and
`sync-standard.ps1:41`; the task reads `Ready`. Running maintenance over the WSL tree from inside WSL
is a follow-up for a later change to `~/.ai-dev`, not part of this runbook.
Report: both outputs.

**D3. Text that still names the old path.** [WSL] These are records and instructions, edited in their
own changes, never by this runbook:
```bash
grep -rlI --exclude-dir=node_modules --exclude-dir=.git -e 'C:\\CuatroEcosystem' -e 'C:/CuatroEcosystem' ~/CuatroEcosystem/cuatro-portfolio/AGENTS.md ~/CuatroEcosystem/*/AGENTS.md ~/CuatroEcosystem/*/CLAUDE.md ~/.claude/CLAUDE.md ~/.claude/rules /mnt/c/Users/NumCuatro/.ai-dev/standard 2>/dev/null
```
Known ones: the Development Constitution names `C:\CuatroEcosystem` among its three roots (canonical
source in `C:\Users\NumCuatro\.ai-dev\standard\`, synced by `sync-standard.ps1`), and
`cuatro-portfolio/AGENTS.md` mounts `C:/CuatroEcosystem/cuatro-portfolio` in the rendered-output
`docker run` command and carries Windows host workarounds (the `corepack` prefix, the WSL bash flake
DW-135, reaching the box through `wsl`). File each as a follow-up.
Expected: a list of files.
Report: the list.

**D4. Editors and terminals.** Open the relocated folders from the WSL side (VS Code's WSL remote, a
Windows Terminal profile for `Ubuntu-22.04` starting in `~/CuatroEcosystem`). Opening them through
`\\wsl.localhost` with Windows tools runs Windows Git against them, which C9 explains.
Report: nothing.

**D5. Backup coverage, a decision before Phase E.** `C:\CuatroEcosystem\.backup-canary` ("backup canary,
do not delete", 2026-09-20) shows a Windows side backup watches this folder. Inside WSL the files live in
one `ext4.vhdx`, which a file level backup does not see file by file. Decide what backs up
`~/CuatroEcosystem` before deleting the `C:` copies, and whether the canary moves with it.
Report: the decision.

## 9. Phase E: delete from C:\ one entry at a time

Run E1 to E4 for one entry, then the next, in this order (smallest and least active first,
`cuatro-portfolio` last): `Lumen`, `MaiCoin`, `Mutuo`, `StreamVault`, `connect-four-react`,
`tcg-tracker`, `cuatro-finance`, `poketracker-go-workspace`, `epic-8-evidence`, `list-wheel-workspace`,
`cuatro-tracker-workspace`, `cs-tournament`, `digital-library-workspace`, `cs-tracker-workspace`,
`cuatro-portfolio`. Phase E starts only when B3 to B6 and C1 to C12 all matched, and D5 is decided.

**E1. Final check: nothing landed on `C:` since the baseline, and nothing exists only there.**

E1a, for an entry that holds a repository (every entry except `epic-8-evidence`). [Git Bash] Set `X` to
the entry's name.
```bash
X=Lumen
. /c/Users/NumCuatro/epic7/lists.sh
R=$(for d in $ALL; do case $d in "$X"|"$X"/*) printf '%s ' "$d";; esac; done)
bash /c/Users/NumCuatro/epic7/snapshot.sh /c/CuatroEcosystem /c/Users/NumCuatro/epic7/final-$X.txt $R
diff <(awk -v x="$X" '/^## /{k=($2==x || index($2,x"/")==1)} k' /c/Users/NumCuatro/epic7/baseline-all.txt) /c/Users/NumCuatro/epic7/final-$X.txt && echo UNCHANGED
```
Expected: `UNCHANGED`. Anything else means work happened on `C:` after the copy: do not delete; redo
that entry from Phase A (§ 10).

E1b, for every entry. [WSL]
```bash
X=Lumen
L() { cd "$1" && find . \( -name node_modules -o -name .next -o -name _build -o -name deps -o -name .turbo -o -name .pnpm-store -o -name .git \) -prune -o -type f -print | LC_ALL=C sort; }
echo "only-on-C: $(diff <(L /mnt/c/CuatroEcosystem/$X) <(L ~/CuatroEcosystem/$X) | grep -c '^<')"
```
Expected: `only-on-C: 0` (files only in WSL are build output from Phase B, and allowed). Anything above
0: show them with the same `diff` piped to `grep '^<'`, and do not delete.
Report: E1a and E1b results.

**E2. Archive the `C:` copy into WSL.** [WSL]
```bash
X=Lumen
. /mnt/c/Users/NumCuatro/epic7/lists.sh
mkdir -p ~/epic7-archive && tar -C /mnt/c/CuatroEcosystem $EXCLUDES -czf ~/epic7-archive/$X.tar.gz "$X" && tar -tzf ~/epic7-archive/$X.tar.gz | wc -l && ls -lh ~/epic7-archive/$X.tar.gz
```
Expected: a file count above zero and the archive's size.
Report: both.

**E3. Delete the `C:` copy.** [PowerShell] Set `$X` to the same entry.
```powershell
$X = 'Lumen'
Remove-Item -LiteralPath "C:\CuatroEcosystem\$X" -Recurse -Force
Test-Path -LiteralPath "C:\CuatroEcosystem\$X"
```
Expected: `False`.
Report: the line, or any error.

**E4. The WSL copy still opens.** [WSL]
```bash
X=Lumen
. /mnt/c/Users/NumCuatro/epic7/lists.sh
for d in $ALL; do case $d in "$X"|"$X"/*) printf '%s ' "$d"; git -C ~/CuatroEcosystem/"$d" status --porcelain | wc -l;; esac; done
```
Expected: one line per repository in the entry, each count equal to that repository's `st` line count
in `baseline-all.txt` (for `epic-8-evidence`, no output).
Report: the lines.

**E5. After the last entry: the loose files and the folder.** Only after D5 is decided. [WSL] then
[PowerShell]
```bash
. /mnt/c/Users/NumCuatro/epic7/lists.sh
for f in $LOOSE; do cmp "/mnt/c/CuatroEcosystem/$f" ~/CuatroEcosystem/"$f" && echo "same $f"; done
```
```powershell
Get-ChildItem -Force C:\CuatroEcosystem | Select-Object Name
```
Expected: five `same` lines; the listing shows only the five loose files. Delete them and the folder
with `Remove-Item -LiteralPath C:\CuatroEcosystem -Recurse -Force`, unless D5 decided the canary stays.
Report: the listing and what was deleted.

Story 7.1's acceptance is met when every entry has passed E1 before its E3, B3 to B6 matched, and E5 is
done or deliberately held by D5.

## 10. Rollback

- **Before an entry's E3** (the `C:` copy is untouched and authoritative): delete that entry's WSL copy
  with `rm -rf ~/CuatroEcosystem/<entry>` [WSL] and keep working on `C:`. To retry, run A4's loop with
  `TOP` set to that entry alone (`TOP=<entry>` after sourcing `lists.sh`), then A6 or C3, B3 and C1 to
  C7 for its repositories.
- **After an entry's E3**: restore the archive to `C:` [WSL]
  `tar -C /mnt/c/CuatroEcosystem -xzf ~/epic7-archive/<entry>.tar.gz`. The archive holds the original
  `.git`, uncommitted work, unpushed commits and worktree paths as they were on `C:`, so the restored
  checkout behaves exactly as before; reinstall its dependencies on Windows. The archive excludes only
  build output.
- **Abandoning Epic 7 entirely**: restore any deleted entries as above, `rm -rf ~/CuatroEcosystem`
  [WSL], re-enable the maintenance task (`Enable-ScheduledTask -TaskName 'AI-Dev-Maintenance'`) and
  restore its root lines if D2 changed them. The WSL Git, SSH and `gh` settings harm nothing and may stay.
- Keep `~/epic7-archive` and `C:\Users\NumCuatro\epic7\` until the relocated repositories have been used
  normally for a while; delete them by hand when satisfied.

## 11. Report back sheet

| Step | Result |
|---|---|
| P1 to P6 | |
| A1 to A6 | |
| B1, B2 | |
| B3 (`IDENTICAL`?) | |
| B4 | |
| B5.1 to B5.11 | |
| B6 (`IDENTICAL`?) | |
| C1 to C12 | |
| D1 to D5 | |
| E1 to E4, per entry (15 rows) | |
| E5 | |
