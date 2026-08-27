# Serving the published surface

The written record of how `contracts/` reaches `https://cuatro.dev/contracts/`: the mechanism
and why it was chosen over a Caddy file server and over a committed copy, the content types the
running server was observed sending, the one authored location and how a stale copy is prevented
from shipping, which of Epic 3 and Epic 4 has to touch this, the live baseline this story was
written against, the stated limits, and the work this file hands the Operator.

Written during Story 1-16 on **2026-08-26** (ISO 8601 UTC), against baseline commit `6b134d3`.

This file is a record, not Registry data, and nothing here is a published contract surface. It
follows the pattern `ops/token-contract.md`, `ops/font-contract.md`,
`ops/rendered-output-harness.md` and `ops/tailwind-adapter.md` set: every value is marked
**Observed** with its method or **Decision** with its reason (NFR-9), and every date is ISO 8601
UTC.

## Why the file exists at all

AD-1 makes the entire published surface `contracts/`, served over HTTPS at a stable public URL,
and AD-4 has Satellites fetch `https://cuatro.dev/contracts/registry.json` at build time. Until
this story nothing served it.

**Observed 2026-08-25** and re-confirmed **2026-08-26T05:30Z** from the Windows development
host, before any part of this story was deployed. Verbatim, as the commands were run, so the one
reading the Operator's live confirmation is measured against can be re-run rather than
paraphrased:

```
PS> $r = Invoke-WebRequest -Uri 'https://cuatro.dev/contracts/tokens.css' `
        -Method Head -SkipHttpErrorCheck -TimeoutSec 20
PS> "$($r.StatusCode)  $($r.Headers['Content-Type'])  $($r.Headers['Server'])  $($r.Headers['Via'])"
404  text/html; charset=utf-8  cloudflare  1.1 Caddy

PS> $a = Invoke-WebRequest -Uri 'https://cuatro.dev/' `
        -Method Head -SkipHttpErrorCheck -TimeoutSec 20
PS> "$($a.StatusCode)  $($a.Headers['Server'])"
200  cloudflare
```

The apex answered, the surface did not. Three contract files and three woff2 faces existed in
the repository and were reachable by nobody. That 404 is the baseline the Operator's live
confirmation is measured against, and it is still the live state on `main` until this branch
merges.

## The mechanism

The Hub's own Next server serves the directory. `packages/contracts-serve/publish.mjs` replaces
`public/contracts/` with a copy of `contracts/` at the start of `pnpm build`, and Next serves
`public/` as static files at the document root, so `public/contracts/tokens.css` answers at
`/contracts/tokens.css`.

| Property | Value | Nature |
|---|---|---|
| Publish step | `packages/contracts-serve/publish.mjs`, Node builtins only, no `package.json` in the directory | **Decision.** AD-1: generators live in `packages/` and are never published |
| Wired into | the `build` script itself, `node packages/contracts-serve/publish.mjs && next build` | **Decision.** See "Why not a pnpm lifecycle hook" below |
| Also wired into | `dev`, for parity, so every path that starts a server has the served copy in place | **Decision.** Story 1-16 |
| Named script | `contracts:publish`, on the `packages/<name>/<verb>.mjs` plus `<name>:<verb>` convention `packages/tokens` and `packages/fonts` set | **Decision** |
| Served copy | `public/contracts/`, generated, gitignored, never committed | **Decision.** AD-4: one authored location |
| Files published | **9**: three `.css`, three `.woff2` and three OFL `.txt` under `fonts/` | **Observed 2026-08-26**, by running the publish and by `ops/contract-purity.mjs`, which reads the same nine |
| Reaches production by | `docker/Dockerfile` running `pnpm build` in its builder stage and its runner stage copying `public` | **Observed 2026-08-26**, by reading `docker/Dockerfile:27,32-34`. No Dockerfile change and no new layer. Held by `docker/__tests__/runner-stage.test.ts`, because that COPY line is the single hop carrying the surface into the image and nothing else in the repository fails if it is dropped |
| Reaches the apex by | `docker/Caddyfile:41-49`, one `cuatro.dev` site block reverse-proxying `anchor-app:3000`, which is the Hub's own container | **Observed 2026-08-24** in `ops/routing-inventory.md:301`. No ingress change was needed and this story makes none |
| Files added under `contracts/` | **0**. `docker/`, `.github/`, `pnpm-lock.yaml` and `pnpm-workspace.yaml` are byte-identical to `6b134d3` | **Observed 2026-08-26**, by `git diff --stat` against the baseline |

**The whole directory is copied, not a named list of files.** `contracts/registry.json` (AD-4,
Story 2-5) does not exist yet, and neither does anything else a later story publishes. Copying
the directory means every one of them is served with no change to this mechanism.

### Why `public/` and not a Caddy file server

The box's Caddy is shared with three other projects, its config lives only on the box, and
`docker/Caddyfile` is a fragment installed by hand. Serving `contracts/` from it would put a
required file outside the container, need a bind mount and a manual install step per deploy, and
make the published surface depend on a file no CI job reads. Serving it from the Hub means the
deploy that already ships the contract also ships the serving.

This is also what keeps AD-7 satisfied. `/contracts/` is served by the application that owns the
origin, so no `PathPrefix` routing between applications is introduced.

### Why a build-time copy and not a Next route handler

A route handler reading `contracts/` at request time would be a `.ts` file, would spend Anchor
CPU on every fetch (two vCPU, with CPU the binding constraint), and would have to be traced into
the standalone output. `public/` is served as static files by the same server with no code at
all.

### Why not a pnpm lifecycle hook

A `prebuild` script would be the obvious wiring and is the wrong one. `enable-pre-post-scripts`
is a pnpm setting this repository does not pin, and wherever it is off a `prebuild` is skipped
silently. The symptom would be a green build shipping a working site that serves 404s at
`/contracts/`, which is precisely the failure this story exists to end. The step is therefore
part of the `build` command itself, and a standing case asserts both its presence and its
position.

**What the ordering case does and does not protect, stated plainly.** The property that actually
ships is the step being present in `build` at all, plus the removal before the write. A publish
ordered *after* `next build` would still land in the image, because `docker/Dockerfile`'s runner
stage copies `public` out of the builder after the whole `pnpm build` command has finished, and
because Next reads its public directory when the server starts rather than when it builds. So the
ordering is a cheap invariant rather than the guard against a shipped failure: it keeps the step
where a reader expects it, and it stays correct if Next ever starts reading `public/` during the
build. The case that holds it is observed rejecting three wrong scripts on every run, and two of
those three are the ones that matter: the step dropped, and the step present with no `next build`
beside it.

### Why the copy is not committed

AD-4's rule is one authored location. A committed `public/contracts/` would be a second copy a
reviewer must keep in step by hand, and the first time it drifted,
`https://cuatro.dev/contracts/tokens.css` would serve a value no generator produced.
`.gitignore:205-210` ignores `/public/contracts/` with the story and the reason named, following
the Story 1-10 and 1-13 precedent one block up.

## The observed content types

**Content types are observed here, not assumed.** A stylesheet served as
`application/octet-stream` would satisfy a file-list check and fail AD-1's actual claim, which is
that a consumer in any estate language gets the contract with an HTTP GET and a parser.

**Observed 2026-08-26**, quoted verbatim from a `pnpm test:e2e` run against the harness's own
production server (`pnpm build && pnpm start --port 3100`, Next 16.2.1), printed by
`tests/e2e/contract-serving.pw.ts`:

```
contract-serving observed (9 paths):
200 text/css /contracts/fonts.css
200 text/plain /contracts/fonts/OFL-bricolage-grotesque.txt
200 text/plain /contracts/fonts/OFL-geist-mono.txt
200 text/plain /contracts/fonts/OFL-geist.txt
200 font/woff2 /contracts/fonts/bricolage-grotesque-latin.woff2
200 font/woff2 /contracts/fonts/geist-latin.woff2
200 font/woff2 /contracts/fonts/geist-mono-latin.woff2
200 text/css /contracts/tailwind.css
200 text/css /contracts/tokens.css
```

The spec compares on the type's essence, so the `; charset=UTF-8` parameter Next appends to the
two text types is recorded rather than pinned as a value this story decided. The full headers, as
read on the same build with `Invoke-WebRequest`, were `text/css; charset=UTF-8`, `font/woff2` and
`text/plain; charset=UTF-8`.

| Extension | Content type served | Nature |
|---|---|---|
| `.css` | `text/css; charset=UTF-8` | **Observed 2026-08-26** against Next 16.2.1 |
| `.woff2` | `font/woff2` | **Observed 2026-08-26**, same run |
| `.txt` | `text/plain; charset=UTF-8` | **Observed 2026-08-26**, same run |

**Every one is correct, so no `headers()` block was added to `next.config.js`.** Next resolves
these itself. That absence is a checked fact rather than a lucky default: the expected table
lives in `tests/e2e/contract-serving.pw.ts` and a Next version that started serving a stylesheet
as something else fails the `rendered-output` job.

The same spec also compares the served **bytes** against the authored file for all nine paths. A
truncated or stale served copy answers 200 with the right type and hands a consumer a contract
nobody published, which the status alone cannot see.

### Live over HTTPS, 2026-08-27

**Observed 2026-08-27**, Pending Operator action 1, after `main` was deployed at `cb51ed9`. This
is the first time the surface has been read over the real edge rather than off the harness's own
server. The 404 baseline above and the harness table are both left in place: this is a third
reading by a third method, not a correction of either.

Fetched with `Invoke-WebRequest` from a workstation against `https://cuatro.dev`, sending
`cuatro-verify/1.0 (+https://cuatro.dev)` as the user agent, per Pending Operator action 4.

| Path under `/contracts/` | Status | Content type | Bytes | `cf-cache-status` |
|---|---|---|---|---|
| `tokens.css` | 200 | `text/css; charset=UTF-8` | 6225 | REVALIDATED |
| `fonts.css` | 200 | `text/css; charset=UTF-8` | 2957 | REVALIDATED |
| `tailwind.css` | 200 | `text/css; charset=UTF-8` | 4522 | REVALIDATED |
| `fonts/bricolage-grotesque-latin.woff2` | 200 | `font/woff2` | 58992 | REVALIDATED |
| `fonts/geist-latin.woff2` | 200 | `font/woff2` | 24124 | REVALIDATED |
| `fonts/geist-mono-latin.woff2` | 200 | `font/woff2` | 11284 | REVALIDATED |
| `fonts/OFL-bricolage-grotesque.txt` | 200 | `text/plain; charset=UTF-8` | 4403 | DYNAMIC |
| `fonts/OFL-geist.txt` | 200 | `text/plain; charset=UTF-8` | 4383 | DYNAMIC |
| `fonts/OFL-geist-mono.txt` | 200 | `text/plain; charset=UTF-8` | 4383 | DYNAMIC |

**All nine answer 200 with the type the table above predicts**, so the content types Next sends on
the deployed Linux container match the ones observed on the Windows development host. That was an
open question until this reading.

**The edge rewrites the cache header, and the two halves of the surface are treated differently.**
The origin sends `cache-control: public, max-age=0`, as recorded in the limits table. What a
consumer actually receives is:

- **CSS and woff2:** `cache-control: public, max-age=14400`, `cf-cache-status: REVALIDATED`. The
  zone's `browser_cache_ttl` of 14400 is being applied and the object is held at the edge.
- **The three OFL licence files:** `cache-control: public, max-age=0`, `cf-cache-status: DYNAMIC`.
  Not cached at the edge at all.

**This sharpens Pending Operator action 2 rather than settling it.** The four-hour staleness
window is not theoretical: it is in the `max-age` a consumer is being handed right now, for
exactly the three contract files that matter. The licence files, which never change, are the ones
being served uncached. That is backwards from what either party would choose deliberately, and it
is a consequence of Cloudflare's default cacheable-extension list rather than any decision recorded
here. The versioned-URL policy decided in "The cache policy" is what makes the CSS half safe; the
`.txt` half costs a request each time and harms nothing.

**Not re-tested here: the empty user agent 403.** A `""` user agent could not be reproduced from
`Invoke-WebRequest`, which substitutes its own default, so the 2026-08-26 observation stands as
recorded and this reading neither confirms nor contradicts it.

## The rendered check, and why the status is the assertion

`contracts/fonts.css` carries `url("./fonts/<file>.woff2")`, relative to the stylesheet itself,
which is what lets a vendored folder resolve at any depth (AD-14). Served at
`/contracts/fonts.css` those must resolve to `/contracts/fonts/<file>.woff2`.

**Observed 2026-08-26**, from a same-origin page linking `/contracts/fonts.css` and setting each
published family on a latin sample at that face's own weight:

```
contract-serving face requests:
200 http://127.0.0.1:3100/contracts/fonts/bricolage-grotesque-latin.woff2
200 http://127.0.0.1:3100/contracts/fonts/geist-latin.woff2
200 http://127.0.0.1:3100/contracts/fonts/geist-mono-latin.woff2
```

The order is whatever the browser scheduled on the day, since the three are requested
concurrently; the three URLs and the three statuses are the observation, and each is asserted by
its own URL.

**`document.fonts.check` reported all three families available on the same load, queried at the
weight the fixture sets rather than at CSS's default 400.** That distinction is load-bearing:
`Bricolage Grotesque` publishes `font-weight: 700 800` and `Geist` publishes `300 600`, so a bare
`16px "Bricolage Grotesque"` asks about a weight no published face declares and can only answer
`true` through font-matching fallback. Asking at 700 and at 300 respectively is what makes the
answer a fact about the published faces. **Observed 2026-08-26**: all three answer `true` at their
own weights.

**Neither half of that is sufficient alone, and the record says so because it is easy to write a
weaker check here by accident.** A computed `font-family` read returns the declared stack and
passes identically when every face has 404'd, which is the trap `RESTYLE-SPEC.md:648` (F-2)
names and `tests/e2e/contract-fonts.pw.ts` records. `document.fonts.check` has the mirror-image
weakness: it answers `true` for a family with no matching `@font-face` rule at all, because an
unmatched family resolves to a system font the browser considers available. So the assertion is
the HTTP status of each face **by its full URL**, which is what makes a request that went to
`/fonts/<file>.woff2` at the document root a failure rather than a pass, plus availability per
family at its own weight, plus a count so a page that fetched nothing cannot satisfy the loop.
The count compares against the number of **distinct** woff2 files the faces name rather than the
number of faces, so two faces sharing one binary would not fail a run in which everything was
served correctly.

The fixture page is fulfilled by the harness at a same-origin URL rather than written into
`public/`. Nothing under `public/` may hold an authored file this story added, and a fixture
written there during a run would be a file in the served tree that no publish produced. What the
check needs from the fixture is the document origin, because that is what `/contracts/fonts.css`
and in turn `./fonts/<file>.woff2` resolve against, and every request the page then makes for the
stylesheet and for the faces goes to the real server.

## One authored location, and how a stale copy is prevented

`contracts/` at the repository root is the one authored location. `public/contracts/` is
produced by the build and is invisible to git.

**The publish removes the destination before it writes it.** A contract file that was renamed or
deleted at source therefore does not survive in the served tree. That is asserted by a case
rather than by the removal being visible in the code: the suite publishes, plants a file the
source does not carry plus a stale nested directory plus a stale copy of a file that does exist,
publishes again, and requires the destination to be exactly the source afterwards.

**That removal is load-bearing on the deploy path specifically, not only in theory.**
`.github/workflows/deploy.yml` runs `docker compose --env-file .env.production up --build -d`
over SSH against a long-lived checkout on the box, and `.dockerignore` excludes `.gitignore` but
not `public/contracts/`. So a served copy left in that checkout by an earlier build is carried
into the builder stage by `COPY . .`, gitignored or not. Overwriting it in place would leave a
contract file that was deleted upstream still being served from the apex. Replacing the directory
is what makes the deployed tree a function of `contracts/` at that commit and of nothing else.

**Nothing redirects the publish at runtime.** No environment variable and no argument selects
either path; both are fixed in the module and resolved beside it. `ci.yml` had to pin two build
inputs empty on each of the two contract drift jobs to close that hole for the generators, and a
redirectable publish has a worse version of it: a build that copies nothing into a directory
nobody reads is green while the published surface serves 404s. Asserted on the source, so a
future variable cannot slip past a case that only knew the old ones.

### What the publish refuses

Each refusal names the offending path and ends with the exact clause "Nothing was published."
**That is structural**: `refuse` appends the clause rather than each message site writing it out,
so the claim this record makes about the whole set cannot drift row by row. The clause means no
publish completed, so nothing under the destination may be read as the published surface.

| # | Refusal | Why it is a refusal and not a warning |
|---|---|---|
| 1 | The source is missing | Matrix row "Missing source". A silent empty publish would serve 404s from a green build, so the step exits non-zero and leaves no destination behind |
| 2 | The source is a file, not a directory | Same reasoning, different shape |
| 3 | The source is a link | The served copy must be the committed directory. `ops/contract-purity.mjs` refuses a linked surface root for the same reason |
| 4 | The source holds no files | The empty case one level down. A green build must not be able to publish an empty served tree |
| 5 | An entry under the source is a link | What it would serve is decided outside the published folder, and a vendored copy resolves elsewhere or nowhere |
| 6 | An entry under the source is neither a file nor a directory | A socket or a fifo is not something a server can send |
| 7 | The destination's final segment is not `contracts` | The publish opens with a recursive removal of a computed path, and this guard is what keeps a mistake in that computation from taking the rest of `public/` with it |
| 8 | Either path contains the other, equality included | `rmSync(destination)` runs before the copy, so a destination inside the source, or a source inside the destination, deletes the published surface on the way to serving it. Equality was the obvious case and, until this was widened, the only one caught |
| 9 | **The destination will not be removed** | EPERM, EBUSY, a locked file. Left unguarded this raised an error carrying neither this file's name nor the clause, and a stale contract could then have survived underneath a fresh publish |
| 10 | **A copy fails part way through** | ENOSPC, EACCES on file five of nine. A half written served tree is worse than none: it answers 200 for the contract files that made it and 404 for the rest, from a build that exited non-zero somewhere a deploy log may not be read. The partial tree is removed before the refusal, and the refusal says whether that succeeded. This is the one refusal that can leave debris, and when it does it names the leftover path rather than claiming a clean failure |

Every one of the ten has a standing case in
`packages/contracts-serve/__tests__/contracts-serve.test.ts` that runs the real code against a
scratch tree, asserts the message names the path and ends with the clause, and asserts nothing was
written. A further case pins the fixture list at ten, which is what makes that list and this table
edited together: it catches the list shrinking, which is how the claim in this paragraph would
otherwise quietly narrow, and it turns adding an eleventh row here into a failing case rather than
an unbacked sentence. It cannot catch a refusal added to the module and to neither list, which is
what review is for. They are permanent tests, not one-time probes, on the rule Story 1-11's review
established: a gate never observed to fail is not known to work.

**Three of them cannot be built from a real filesystem state on both hosts**, so `publish` takes
an injected host on the `inspect(directory, read)` precedent in `ops/contract-purity.mjs`. It
decides **how** a directory is listed and how bytes are removed and copied, never **which** paths
are read or written. Row 6 needs `mkfifo`, which Windows has no equivalent of; rows 9 and 10 need
a filesystem no portable call can arrange. `main` passes no host, and standing cases run the real
one end to end through a subprocess.

**The invoked-directly guard resolves both paths rather than comparing them as text.** On Windows
the same script reaches `process.argv[1]` with a different drive-letter case, as an 8.3 short path
or through a link, and a textual comparison then answers no, the publish is skipped, and
`pnpm build` exits 0 having shipped a site that serves 404s at `/contracts/`. That is this story's
whole failure mode arriving through the one line meant to prevent it. `realpathSync` on both, with
a `resolve` comparison as the fallback that never answers "no" when a path will not resolve, is
the shape `ops/contract-purity.mjs:432-442` uses. A standing case invokes a scratch copy through a
lower-cased drive letter and requires the publish to have run.

## Which gate covers this, and why no CI job was added

**No CI job was added by this story, and that is the finding rather than an omission.**

| Obligation | Job that holds it | Nature |
|---|---|---|
| The publish behaves, the `build` script's content and ordering, the `.gitignore` entry, no tracked path under `public/contracts` | the blocking `test` job, through the new Vitest suite | **Decision.** Story 1-16 |
| **The deployed image actually carries the served copy**: the builder runs `pnpm build`, and the runner copies the builder's `public` directory to `public` | the blocking `test` job, through `docker/__tests__/runner-stage.test.ts` | **Decision.** Story 1-16. Nothing else notices if `COPY --from=builder /app/public ./public` is dropped or repointed: typecheck, the whole unit suite, all three contract jobs and `rendered-output` read the builder's own tree rather than the image, so every one stays green while the deploy from `main` serves 404 at every `/contracts/` URL. Same shape `docker/__tests__/deps-stage.test.ts` holds one stage up, written as a sibling that imports nothing from it so the two stages have two independent readers |
| Every published file answers 200 with the recorded content type and byte-identical contents, and the relative `url()` paths resolve against the served location | the blocking `rendered-output` job. `playwright.config.ts:84-93` starts the server with `pnpm build && pnpm start`, so the publish runs inside the harness with no config change | **Observed 2026-08-26**, by reading the config and by running the suite |
| Nothing executable under `contracts/` | the existing `contract-purity` job, untouched | **Observed 2026-08-26**: `node ops/contract-purity.mjs` exits 0 with "9 files, none executable and no link" |
| `contracts/` did not drift | the existing `tokens-contract` and `fonts-contract` jobs, untouched. Both read `git status --porcelain --ignored=matching -- contracts/` and neither runs `pnpm build`, so `public/contracts/` never reaches them | **Observed 2026-08-26**, by reading `.github/workflows/ci.yml:78-88,132-142` and by running the command, which is empty |

**Verified rather than assumed**, **observed 2026-08-26**: `git diff` against `6b134d3` leaves
`.github/workflows/ci.yml` byte-identical.

## What Epic 3 and Epic 4 each do to this

`epics.md:1762-1765` requires neither later epic to discover this late, so it is stated here in
the terms each epic will actually meet it in.

| Epic | What it changes | What has to be touched here |
|---|---|---|
| **Epic 3**, the move to `apps/hub` | The Hub stops being the repository root and becomes one workspace application | **Five things, not one.** They are enumerated below, because "the destination path" is what this row said first and it was wrong in three places |
| **Epic 4**, Traefik replacing Caddy | The ingress in front of the box | **Nothing.** A Traefik router matching `Host(cuatro.dev)` proxies the same container to the same port, and `/contracts/` is served by the application behind it either way. The path is not part of the ingress |

### The five things Epic 3 has to touch

An earlier draft of the row above said "the destination path, and nothing else". That was wrong in
three of the five, and each of the three fails in a way the epic would not notice at the time.

| # | What moves | Why it is not automatic |
|---|---|---|
| 1 | `SOURCE` and `DESTINATION` in `packages/contracts-serve/publish.mjs` | `contracts/` **stays at the repository root**, because it is the estate's published surface and not the Hub's asset. `REPO_ROOT` gains a directory level and `DESTINATION` becomes `apps/hub/public/contracts/`, so the two constants stop being siblings under one root and have to be derived separately |
| 2 | The `build` and `dev` scripts | They move into `apps/hub/package.json`, and the publish step's relative path `node packages/contracts-serve/publish.mjs` is resolved from wherever the script runs. Turborepo runs a package script with that package as the working directory, so the path changes |
| 3 | **`.gitignore`'s `/public/contracts/`** | The leading slash anchors it at the repository root. After the move the generated tree is at `apps/hub/public/contracts/`, the rule stops matching, and the served copy becomes committable: **the exact AD-4 drift the entry exists to forbid**, arriving silently. The `git check-ignore` case fails, which is the intended alarm, but the entry has to be re-anchored in the same change |
| 4 | **Every literal in `packages/contracts-serve/__tests__/contracts-serve.test.ts`** | The suite does **not** simply follow the module. It pins `resolve(REPO_ROOT, 'contracts')`, `resolve(REPO_ROOT, 'public', 'contracts')`, the script path, the manifest path, the `.gitignore` path, the browser spec's path and the `PUBLISH_COMMAND` string as literals, deliberately, because a suite that derived them from the module could not catch the module moving to the wrong place. All of them move with the epic |
| 5 | **`docker/Dockerfile`'s runner stage, and `docker/__tests__/runner-stage.test.ts` with it** | `COPY --from=builder /app/public ./public` copies an **absolute** builder path. Once the Hub is a workspace application its public directory is no longer `/app/public`, so the line copies a directory that does not exist or one that is empty. The runner-stage case derives the absolute path from the builder's own `WORKDIR`, so it holds while both move together and fails when only one does |

**The one thing that would change that.** `epics.md:1738-1742` flags the Traefik-versus-Hub
choice as an assumption stated rather than inherited: if the Operator prefers Traefik serving
`contracts/` directly, this mechanism is the interim and this file is where that is recorded.
Nothing in this story forecloses it. Deciding it is not an unattended call, which is why the
story treated it as a blocking condition rather than a design option, and why Pending Operator
action 3 exists.

## Stated limits

| Limit | Why it stands | Nature |
|---|---|---|
| **`/contracts/` itself has no index** | Next serves files from `public/`, not directory listings. `GET /contracts/` answers the Hub's 404 page. The published surface is reachable file by file, which is what AD-1 asks for ("a consumer uses it with a file read and a parser") and what AD-4's build-time fetch of a named file needs. A machine-readable index of the folder, if one is ever wanted, is a contract file rather than a server feature | **Observed 2026-08-26**: `GET /contracts/` returned 404 with `text/html; charset=utf-8` |
| **This story sets no cache headers** | Next serves `public/` files with `cache-control: public, max-age=0`, and the Cloudflare zone in front of it is `cache_level aggressive` with `browser_cache_ttl 14400` and `edge_cache_ttl 7200` (`ops/routing-inventory.md:234`). So a consumer's freshness is decided by the zone, not by this mechanism, and a contract republished under the same URL can be served stale from the edge for up to four hours. Setting a policy here means deciding one for a versioned artifact whose version lives in its header rather than in its URL, which is AD-16's question and not this story's | **Observed 2026-08-26** for the origin header, **Observed 2026-08-24** for the zone settings. Pending Operator action 2 |
| **This story sets no `Access-Control-Allow-Origin` either, so cross-origin request-time use does not work** | `docker/Caddyfile`'s `cuatro.dev` block sends `X-Content-Type-Options`, `X-Frame-Options` and `Referrer-Policy` and no CORS header at all. A site that links `https://cuatro.dev/contracts/fonts.css` from another origin therefore gets the stylesheet, because a plain `<link>` is not a CORS request, and then every `@font-face` fetch fails the CORS check **silently**: fonts are always fetched in CORS mode, so each face is blocked and the page falls back to a system stack that looks almost right. **That is a limit and not a defect, because cross-origin request-time consumption is not a designed path.** AD-14 and AD-16 have consumers vendor the folder by copy under the fixed name `cuatro-contracts/`, which makes every face same-origin wherever it lands, and AD-4 has Satellites fetch the Registry **at build time**, where there is no origin to be cross to. If it ever becomes a designed path, the change is a `header` line in the `cuatro.dev` site block, which is a shared-box edit outside this repository, plus a decision about which origins may read the surface | **Decision**, with the mechanism **Observed 2026-08-26** by reading `docker/Caddyfile:41-49`. Not exercised: this story asserts nothing cross-origin, because the harness serves one origin |
| **`pnpm start` on its own does not publish** | `dev` and `build` both run the publish; `start` is unchanged and serves whatever `public/contracts/` is already on disk. So a developer who pulls a commit that changed `contracts/` and then runs `pnpm start` without rebuilding gets 200s carrying the previous surface. **The deploy path is unaffected**, because `docker/Dockerfile`'s builder stage always runs `pnpm build` and the runner stage copies the result of that build into a fresh image, so a deployed container cannot serve a surface its own build did not write. `start` was left alone deliberately: prepending the publish to it would mean a command whose job is to serve an existing build silently rewriting part of it, which is a worse property than the stale read it would prevent, and `next start` already warns that it is not how this `output: 'standalone'` application runs in production | **Decision.** Story 1-16 |
| **A build-time fetch with an empty user agent is blocked at the edge** | `ops/bot-mitigation.md` rule 3 issues a managed challenge to requests with an empty user agent that are not verified bots, on all five application hostnames. A non-browser client cannot solve one, so it reads as a 403. AD-4 has Satellites fetch the Registry at build time, and a fetch library that sends no user agent will fail against a mechanism that is working perfectly. Rule 1 blocks a list of crawler user agents outright, `Scrapy` among them | **Observed 2026-08-26** against the live apex on `/logo.png`, which is served by the same Next `public/` path this story publishes into: a normal user agent answered **200**, an explicitly empty one **403**, and `GPTBot/1.0` **403**. Pending Operator action 4 |
| **Nothing consumes the served URL yet** | Publishing is not adopting. Story 1.19 is where `cs-tracker` first vendors the folder, and `contracts/registry.json` arrives in Story 2-5. The URL is proved reachable, not proved used | **Decision.** Story 1-16 scope |
| **The served result is only ever asserted against the harness's own server** | `playwright.config.ts` starts `pnpm build && pnpm start` on `127.0.0.1:3100`. That is the same build the Docker builder stage runs, but it is not the deployed container, not behind Caddy, and not behind Cloudflare. Everything between the Hub and a Visitor is asserted by the Operator's live confirmation and by nothing in CI | **Decision**, with the residual risk stated. Pending Operator action 1 |
| **`next start` is not how production runs** | `next.config.js` sets `output: 'standalone'`, and `next start` prints a warning saying so. The harness uses it anyway because the alternative is running `.next/standalone/server.js`, which the config was not written for here, and because the file serving under test is the same static handler in both. A deploy runs `node server.js` in the runner stage | **Observed 2026-08-26**, in the harness's own web server output. Pre-existing, inherited from Story 1-10 |
| **Three Playwright specs fail on a Windows development host** | Unrelated to this story and pre-existing: one font-swap tolerance and the screenshot baselines, which were captured in `mcr.microsoft.com/playwright:v1.62.1-noble` and are not portable. Verified pre-existing by running the whole suite against `6b134d3` with this story's files stashed: the same five cases failed, 16 passed, against 19 passing with this story's three added | **Observed 2026-08-26**, by the stashed comparison run |

## Probe output

### Probe 1: the publish, against the committed surface

**Observed 2026-08-26** on the Windows development host. Verbatim, with the absolute paths as
printed:

```
$ node packages/contracts-serve/publish.mjs
packages/contracts-serve: reading  C:/CuatroEcosystem/cuatro-portfolio/contracts
packages/contracts-serve: writing  C:/CuatroEcosystem/cuatro-portfolio/public/contracts
packages/contracts-serve:   /contracts/fonts.css
packages/contracts-serve:   /contracts/fonts/OFL-bricolage-grotesque.txt
packages/contracts-serve:   /contracts/fonts/OFL-geist-mono.txt
packages/contracts-serve:   /contracts/fonts/OFL-geist.txt
packages/contracts-serve:   /contracts/fonts/bricolage-grotesque-latin.woff2
packages/contracts-serve:   /contracts/fonts/geist-latin.woff2
packages/contracts-serve:   /contracts/fonts/geist-mono-latin.woff2
packages/contracts-serve:   /contracts/tailwind.css
packages/contracts-serve:   /contracts/tokens.css
packages/contracts-serve: published 9 files at /contracts/
```

The two "reading" and "writing" lines are printed before the copy, so a redirected run would be
visible in a job log even when the publish then refuses.

### Probe 2: the working tree carries no second copy

**Observed 2026-08-26**, after the publish above. Verbatim:

```
$ git ls-files -- public/contracts
(no output)

$ git check-ignore -v public/contracts/tokens.css
.gitignore:210:/public/contracts/        public/contracts/tokens.css

$ git status --porcelain --ignored=matching -- contracts/
(no output)
```

The third command is the contract drift gate's own check, run over the same tree. It is clean,
which is the point: this story publishes the surface and does not change it.

## The deploy pipeline was broken, and had been for twelve days

**Observed and repaired 2026-08-27.** Recorded here because this story is the one that found it,
and because nothing else in the estate would have.

**What happened.** Merging `main` at `cb51ed9` fired the `Deploy` workflow, which failed in twelve
seconds: `ssh: handshake failed: unable to authenticate, attempted methods [none publickey]`. The
box's `/home/deploy/.ssh/authorized_keys` held exactly one key, the Operator's own. The GitHub
Actions deploy key was not on the machine at all.

**Why.** Story 1-21 restored `cuatro.dev` onto a new Hostinger VPS on 2026-07-20. The
`SERVER_HOST` secret was updated for the new box on 2026-08-17. `SSH_PRIVATE_KEY` and
`SERVER_USER` were not: both still dated from **2026-03-09** and described the machine that had
been replaced. The host was updated and the credentials were forgotten.

**Why nobody noticed.** A deploy fires only on a push to `main`, and nothing merged to `main`
between 2026-08-15 and 2026-08-27. The pipeline was broken for twelve days without a single
failing run, because it never ran. This is the same class of silent failure that
`ops/backup-digital-library.md` names in its limit 3, where a nightly job's exit status is written
to a log nobody reads. **No monitor in this estate watches whether a deploy succeeds.**

**What was wrong, in the order it was found.** Each fix exposed the next, which is worth recording
because a reader hitting one of these will likely hit the rest:

| # | Symptom | Cause |
|---|---|---|
| 1 | `handshake failed ... [none publickey]` | No deploy public key in `authorized_keys` on the new box |
| 2 | `ssh.ParsePrivateKey: ssh: no key found` | The private key was piped into `gh secret set` through PowerShell, which re-encoded the line endings. OpenSSH keys need LF and a trailing newline |
| 3 | `ssh: this private key is passphrase protected` | `ssh-keygen -N '""'` in PowerShell passes a literal two-character passphrase, not an empty one |
| 4 | `handshake failed ... [none publickey]`, key valid | `SERVER_USER` still named the old box's user. `sshd` has `permitrootlogin no` and only `deploy` owns a repo checkout |

**The repair.** A fresh ed25519 key was generated with `cmd /c ssh-keygen -N ""`, so the empty
passphrase survives; the public half replaced the stale entry in `authorized_keys`, leaving the
Operator's own key untouched; the private half was written to the secret with
`cmd /c "gh secret set SSH_PRIVATE_KEY < <file>"`, whose redirection is byte-exact where a
PowerShell pipe is not; `SERVER_USER` was set to `deploy`; and the key material was deleted.

**What is still owed.** Nothing watches this pipeline. A deploy that fails now is as silent as the
twelve days above, and the next person to notice will be whoever wonders why the site is stale.
That belongs with the monitoring gap already in the deferred ledger, not in this file.

## The cache policy

**Decided 2026-08-27**, Pending Operator action 2. **The decision only. Nothing below is built,
and no story has yet been written to build it.**

**The rule: a published contract is fetched at a versioned URL, and versioned URLs are cached
hard at the edge.** A URL, once published, never changes what it returns. Republishing means
publishing a new URL.

Why this rather than lowering the TTL:

- **It removes staleness by construction rather than by tuning.** A shorter edge TTL narrows the
  window in which a consumer reads yesterday's contract; it does not close it. Under versioned
  URLs the question cannot arise, because the bytes behind a URL are immutable.
- **It already matches how the contract is versioned.** AD-16 has a scheduled job read the
  `Contract vX.Y.Z` header across seven repositories, so a version is a concept the surface
  already carries. Putting that version in the path makes the URL agree with the header instead
  of leaving the header as the only place the version appears.
- **It suits AD-16's deprecate, migrate, remove.** All three states need the old contract to keep
  answering while consumers move. Under an unchanged URL, "the old one still works" and "the new
  one is published" are the same fact and cannot both be true.
- **The alternative puts the correctness of the surface in the zone config**, outside this
  repository, where nothing in CI can assert it and `ops/routing-inventory.md` records that the
  ruleset entrypoints are not even readable with the token the estate holds.

**What this costs.** The unversioned paths under "The observed content types" stay as they are, so
this is additive rather than a migration. Something has to publish both a versioned path and a
stable alias, and something has to decide what the alias points at. **Neither exists**, and until
they do the four-hour staleness window in the limits table is still the live behaviour.

**What must not be concluded from this.** The gap between deciding and building is real, and while
it is open a republished contract at an unchanged URL can still be served stale for up to four
hours. This entry records a direction, not a fix.

## The adoption instruction every Satellite needs

**Written 2026-08-27**, Pending Operator action 4. Recorded here so seven repositories can be
pointed at one paragraph instead of seven retellings.

> **A build-time fetch of anything under `https://cuatro.dev/contracts/` must send a real
> `User-Agent` header.** The Cloudflare bot mitigation from Story 1-3 answers **403** to an empty
> user agent, and also to `GPTBot/1.0`. Several HTTP clients send no user agent by default. A
> Satellite that fetches the Registry with such a client gets a 403 from a mechanism that is
> working exactly as designed, and the failure looks like the contract surface being down.

Suggested value: the consuming repository's own name, for example
`cuatro-portfolio-build/1.0 (+https://cuatro.dev)`, so an edge log attributes a build fetch to the
repository that made it.

**Observed 2026-08-26** against the live apex, recorded in Story 1-16's probes. It pairs with
`ops/tailwind-adapter.md` Pending Operator action 3: both are adoption instructions that fail
silently when missed, and both are owed to the same seven repositories.

**Not yet delivered.** `cs-tracker` is the first Satellite to adopt, in Story 1-19, so it is the
first place this has to land.

## Pending Operator actions

This file hands the Operator work it cannot do from a development host. They are tracked here
rather than left in prose, in the shape `ops/token-contract.md`, `ops/font-contract.md`,
`ops/rendered-output-harness.md` and `ops/tailwind-adapter.md` use.

| # | Action | Owner | Note | Completed (UTC) |
|---|---|---|---|---|
| 1 | **Confirm the surface live over HTTPS after the merge to `main`** | Operator | A deploy fires only on a push to `main`, and this story's work is committed on `dev`, so no agent here can assert the live URL. After the deploy, fetch each of these and record the status and the `content-type`: `https://cuatro.dev/contracts/tokens.css`, `/contracts/fonts.css`, `/contracts/tailwind.css`, `/contracts/fonts/bricolage-grotesque-latin.woff2`, `/contracts/fonts/geist-latin.woff2`, `/contracts/fonts/geist-mono-latin.woff2`, `/contracts/fonts/OFL-bricolage-grotesque.txt`, `/contracts/fonts/OFL-geist.txt`, `/contracts/fonts/OFL-geist-mono.txt`. **A correct answer is `200` with `text/css`, `font/woff2` and `text/plain` respectively**, matching the table under "The observed content types". Send a real user agent, per action 4. Write the result into this file as a new dated subsection under that heading, beside the 404 baseline, and leave the baseline in place | **2026-08-27.** All nine answer 200 with the expected type. Recorded as "Live over HTTPS, 2026-08-27" under that heading, with the 404 baseline left in place. **The deploy that made this possible had to be repaired first**: see "The deploy pipeline was broken" below |
| 2 | **Decide the cache policy for the published surface** | Operator | The origin sends `max-age=0` and the zone is `cache_level aggressive` with `browser_cache_ttl 14400` and `edge_cache_ttl 7200`, so a republished contract can be served stale from the edge for up to four hours under an unchanged URL. AD-16's versioning is deprecate, migrate, remove, which tolerates that; a consumer polling for a fresh Registry does not. Decide it once, record it here, and purge the edge on a contract publish if the answer is to keep the zone default | **2026-08-27. Ruling: version the URL and let the edge cache hard.** See "The cache policy" below. The decision is recorded; **the implementation is not built** and is not this story's work |
| 3 | **Settle the Traefik-versus-Hub question before Epic 4 plans its work** | Operator | `epics.md:1741-1742` names it as the interim-versus-final decision and this story treated it as not one to take unattended. Today's answer is the Hub, and the table under "What Epic 3 and Epic 4 each do to this" says Epic 4 then changes nothing here. If the answer becomes Traefik, that table is what has to be rewritten, and this mechanism becomes the interim | _not done_ |
| 4 | **Tell every Satellite that a build-time fetch must send a user agent** | Operator | Observed on the live apex: an empty user agent answers **403** at the Cloudflare edge, and so does `GPTBot/1.0`. AD-4 has seven repositories fetch `https://cuatro.dev/contracts/registry.json` at build time, and a fetch that sends no user agent fails against a mechanism that is working perfectly. This pairs with `ops/tailwind-adapter.md` Pending Operator action 3, which is the other adoption instruction that fails silently if it is missed | **Written down 2026-08-27** as "The adoption instruction every Satellite needs" below, so the instruction exists in one citable place. **Not yet delivered to any Satellite**: `cs-tracker` is the only one that has begun adoption, in Story 1-19, and it is the first consumer this has to reach |
| 5 | **Record the first real CI run of the `rendered-output` job with the new spec**, from the Actions run summary | Operator | The three new browser checks have only ever run against a server started on a Windows development host. The runner figures, and the content types Next sends on Linux, are unknown until the job runs once. Same open item as `ops/tailwind-adapter.md` action 4 | **2026-08-27.** Run `33104210025` on `main`, `rendered-output: success`, 18:35:14Z to 18:36:51Z, **97 s**. All five jobs in that run passed: `test`, `tokens-contract`, `fonts-contract`, `contract-purity`, `rendered-output`. The Linux content types the spec asserts are separately confirmed against the live edge under "Live over HTTPS, 2026-08-27" |
| 6 | **Run `/bmad-project-context` to refresh the `bmad:context` block in `AGENTS.md`** | Operator | Still open from Stories 1-10, 1-12 and 1-13, and this story widens it again. `AGENTS.md:52-53` describes CI as typecheck and tests only, against a file with five jobs, and `AGENTS.md:55-57` says Playwright is not installed and that no acceptance criterion may claim a browser check, which is now false for four spec files. Nothing in `AGENTS.md` yet says that `pnpm build` publishes into `public/contracts/`, which is the first thing an agent editing the build script needs to know | _not done_ |

**Maintaining this file.** When an action is performed, replace its `_not done_` cell with the ISO
8601 UTC completion date and leave the row in place. When a figure is re-measured, add the new row
with its own date and method and keep the old one, so a later reader can see whether a number
moved or was simply re-stated. Deletion is not used here.

## What would invalidate this record

| If this changes | This record is wrong until it is re-read |
|---|---|
| `docker/Dockerfile`'s runner stage stops copying `public` | The served copy never reaches the image, and every URL in this file 404s from a green build |
| `next.config.js` gains a `basePath`, an `assetPrefix` or a rewrite over `/contracts` | The served path is no longer `/contracts/` |
| The `build` script stops running the publish, or runs it after `next build` | The standing case fails first, which is the intent |
| `docker/Caddyfile`'s `cuatro.dev` block stops reverse-proxying `anchor-app:3000` | The apex no longer reaches the Hub, and nothing here reaches a Visitor |
| The Next version changes what it sends for `.css`, `.woff2` or `.txt` | The `rendered-output` job fails naming the path and the value it got, and the table under "The observed content types" is stale |
| A Cloudflare rule starts challenging or caching `/contracts/*` differently | The two limits about the edge, and Pending Operator actions 2 and 4, are stale |
| **`contracts/registry.json` arrives in Story 2-5**, or any later story publishes a tenth file | Four things in this file go stale together, and none of them is wrong today: the file count of **nine** in the mechanism table, the content-type table (which has a `.json` row in `tests/e2e/contract-serving.pw.ts` but no observed value here, because nothing publishes JSON yet), Pending Operator action 1's list of **nine** URLs to fetch, and Probe 1's transcript. The mechanism itself needs no change, which is the whole point of copying a directory rather than a named list, so this is a record to re-read rather than a step to redesign |
