---
title: 'Serve contracts/ at https://cuatro.dev/contracts/'
type: 'feature'
created: '2026-08-25'
status: 'awaiting-operator'
baseline_commit: '6b134d36de5e60f5dab94b23294cb7a93bbbedad'
baseline_revision: '6b134d36de5e60f5dab94b23294cb7a93bbbedad'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/ops/tailwind-adapter.md'
warnings: ['oversized']
operator_actions:
  - 'Merge this branch to `main` so the deploy fires, then confirm the surface live over HTTPS. Fetch https://cuatro.dev/contracts/tokens.css, /contracts/fonts.css, /contracts/tailwind.css, /contracts/fonts/bricolage-grotesque-latin.woff2, /contracts/fonts/geist-latin.woff2, /contracts/fonts/geist-mono-latin.woff2, /contracts/fonts/OFL-bricolage-grotesque.txt, /contracts/fonts/OFL-geist.txt and /contracts/fonts/OFL-geist-mono.txt. A correct answer is 200 with text/css, font/woff2 and text/plain respectively. Record the result as a new dated subsection of ops/contract-serving.md beside the observed 404 baseline, and leave the baseline in place. This is Pending Operator action 1 in that file.'
  - 'Decide the cache policy for the published surface and record it in ops/contract-serving.md. The origin sends `cache-control: public, max-age=0` and the Cloudflare zone in front of it is `cache_level aggressive` with `browser_cache_ttl 14400` and `edge_cache_ttl 7200`, so a contract republished under an unchanged URL can be served stale from the edge for up to four hours. Pending Operator action 2.'
  - 'Settle the Traefik-versus-Hub question before Epic 4 plans its work. epics.md:1741-1742 names it as the interim-versus-final decision and this story treated it as not one to take unattended. Today the Hub serves the directory and Epic 4 then changes nothing; if the answer becomes Traefik, the Epic 3 and Epic 4 table in ops/contract-serving.md is what has to be rewritten. Pending Operator action 3.'
  - 'Tell every Satellite that a build-time fetch of the Registry must send a user agent. Observed 2026-08-26 against the live apex: an empty user agent answers 403 at the Cloudflare edge, and so does GPTBot/1.0. AD-4 has seven repositories fetch https://cuatro.dev/contracts/registry.json at build time, and a fetch that sends no user agent fails against a mechanism that is working perfectly. Pending Operator action 4.'
  - 'Record the first real CI run of the `rendered-output` job with the new spec, from the Actions run summary. The three new browser checks have only ever run against a server started on a Windows development host, so the content types Next sends on Linux are unconfirmed. Pending Operator action 5.'
  - 'Run `/bmad-project-context` to refresh the machine-managed `bmad:context` block in AGENTS.md. Its lines 52 to 57 still describe CI as typecheck and tests only and state that Playwright is not installed, both false, and nothing in it says that `pnpm build` now publishes into `public/contracts/`. Still open from Stories 1-10, 1-12 and 1-13. Pending Operator action 6.'
deferred: []
---

<intent-contract>

## Intent

**Problem:** AD-1 says the entire published surface is `contracts/`, served at
`https://cuatro.dev/contracts/`, and AD-4 says Satellites fetch
`https://cuatro.dev/contracts/registry.json` at build time. Nothing serves it. Observed
2026-08-25: `HEAD https://cuatro.dev/contracts/tokens.css` answers `404` with
`content-type: text/html; charset=utf-8`, while the apex itself answers `200`. Three contract
files and three woff2 faces exist in the repository and are reachable by nobody.

**Approach:** The Hub already owns the apex (`cuatro.dev` reverse-proxies `anchor-app:3000`), so
the least-coupled mechanism is for the Hub's own Next server to serve the directory: a build step
copies `contracts/` into `public/contracts/` before `next build`, and the copy is generated,
gitignored, and never committed. Prove it against the real production server in the Playwright
harness, record the mechanism and its Epic 3 and Epic 4 exposure under `ops/`, and hand the live
HTTPS confirmation to the Operator, who owns the merge to `main` that deploys it.

## Boundaries & Constraints

**Always:**
- `contracts/` has exactly one authored location, the repository root. The served copy is produced
  by the build and is invisible to git.
- The copy step runs before `next build`, wired into the `build` script itself rather than into a
  pnpm lifecycle hook, because `enable-pre-post-scripts` is a pnpm setting this repository does not
  pin and a build that skipped the copy would ship a working site serving nothing at
  `/contracts/`.
- A stale copy cannot ship: the publish step removes the destination before writing it, so a
  contract file that was renamed or deleted at source does not survive in the served tree.
- The whole directory is copied rather than a named list of files, so `contracts/registry.json`
  (AD-4, Story 2-5) and any later contract file are served with no change to this mechanism.
- Content types are **observed**, not assumed. The Playwright spec reads the `content-type` the
  running server actually sends for each file. If a type is wrong, the fix is a `headers()` entry
  in `next.config.js` in this same story, and the observed value goes in the record either way.
- The rendered check is a real load: a page served from the same origin links
  `/contracts/fonts.css`, and the assertion is the HTTP status of each `/contracts/fonts/*.woff2`
  request plus `document.fonts.check` per family. `getComputedStyle().fontFamily` returns the
  declared stack even when every face has 404'd, which is the trap
  `tests/e2e/contract-fonts.pw.ts` already records.
- Every version, status code and content type recorded is marked **Observed** with its method or
  **Decision** with its reason (NFR-9). Dates are ISO 8601 UTC.
- Prose carries no em-dash, no en-dash used as a dash, no double-dash standing in for a dash and no
  emoji. The commit is a subject line only, no body and no trailer.

**Block If:**
- The Hub's Next server cannot be made to serve the directory at that path at all, so the mechanism
  would have to become a Caddy `handle_path` block on the shared box or a change in another
  repository. That is the Operator's Traefik-versus-Hub decision, flagged in `epics.md:1738-1742` as
  an assumption stated rather than inherited, and it is not one to take unattended.

**Never:**
- Never edit any file under `contracts/`, `packages/tokens/` or `packages/fonts/`. This story
  publishes the surface, it does not change it, so both drift gates in `.github/workflows/ci.yml`
  must stay green with no rebuild.
- Never commit a second copy of any contract file. `public/contracts/` is generated output and is
  gitignored, and nothing under `app/`, `components/` or `public/` holds an authored copy (this is
  the same rule Story 1.17 is held to).
- Never touch `docker/Caddyfile`, and never change anything on the serving box. The apex already
  reaches the Hub; no ingress change is needed and this story makes none.
- Never introduce `PathPrefix` routing between applications (AD-7). `/contracts/` is served by the
  application that owns the origin, which is what makes it allowed.
- Never add, weaken, skip or `continue-on-error` a CI gate (AD-21). The new checks ride the existing
  blocking `test` and `rendered-output` jobs.
- Never write `_bmad-output/implementation-artifacts/sprint-status.yaml`. It is the orchestrator's.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Three stylesheets served | Production server built by `pnpm build` | `/contracts/tokens.css`, `/fonts.css` and `/tailwind.css` each answer `200` with a `text/css` content type | Any non-200, or a type that is not `text/css`, fails the spec naming the path and what it got |
| Faces served | Same server | Each `/contracts/fonts/<file>.woff2` answers `200` with `font/woff2` | Same, naming the file |
| Relative `url()` resolves against the served location | A same-origin page linking `/contracts/fonts.css` | Every face request goes to `/contracts/fonts/<file>.woff2`, answers `200`, and `document.fonts.check` is true for all three families | A 404 or an unavailable family fails naming the family and the URL requested |
| Served copy equals the authored one | `contracts/` against `public/contracts/` after a publish | Same relative file list, byte-identical contents | A difference fails naming the path, so a lossy or partial copy cannot pass |
| Stale copy | A destination holding a file the source no longer has | The publish removes it; the destination afterwards is exactly the source | A survivor fails the case naming it |
| Missing source | `contracts/` absent | The publish refuses by name and exits non-zero rather than leaving an empty served directory | A silent empty publish would serve 404s from a green build, so it is a refusal |
| Build ordering | `package.json` `build` script | The publish step appears in `build` and precedes `next build` | Either absent, or ordered after, fails the case with the reason: Next reads the public directory when the server starts |
| No committed copy | The working tree | `.gitignore` ignores `public/contracts/`, and `git ls-files -- public/contracts` is empty | A tracked path under it fails the case, which is the AD-4 drift rule |

</intent-contract>

## Code Map

Gathered 2026-08-25 against `6b134d3`, working tree clean.

- `package.json:9-22`: the scripts block. `build` is bare `next build` today, and `test:e2e` is
  `playwright test`. **The publish step is prepended to `build`, and to `dev` for parity**, so every
  path that starts a server has the served copy in place. `packages/tokens/build.mjs` and
  `packages/fonts/*.mjs` set the `packages/<name>/<verb>.mjs` plus `<name>:<verb>` script
  convention this follows.
- `next.config.js:4-27`: `output: 'standalone'` plus two redirects. No `headers()` block exists; one
  is added here **only if** an observed content type is wrong.
- `docker/Dockerfile:27,32-34`: `RUN pnpm build` in the builder, then the runner copies
  `.next/standalone`, `.next/static` and `public`. **This is why `public/` is the target**: the copy
  is already carried into the served image, with no Dockerfile change and no new layer.
- `.dockerignore:24-31`: `ops` and `_bmad*` are excluded from the build context, `packages` and
  `contracts` are not. **A publish script under `ops/` would break the Docker build**, which is the
  argument for putting it under `packages/`.
- `pnpm-workspace.yaml:1-2` plus `docker/__tests__/deps-stage.test.ts:250-255`: the deps stage must
  COPY the manifest of every `packages/*` directory **that has a `package.json`**, and the pinned
  list is `['packages/tokens']`. `packages/fonts/` has no manifest and is absent from that list.
  **The new package carries no `package.json` either**, so the Dockerfile, the lockfile importers
  and that pinned list are all untouched.
- `docker/Caddyfile:41-49` and `ops/routing-inventory.md:301,566-574`: `cuatro.dev` is one site block
  reverse-proxying `anchor-app:3000`, which is the Hub's own container. **Everything the Hub serves
  is already reachable under the apex over HTTPS**, TLS terminating at Cloudflare with the origin
  presenting the Origin CA certificate. No ingress change is needed or permitted here.
- `contracts/fonts.css:18,37,55`: the three `url("./fonts/<file>.woff2")` references, all relative to
  the stylesheet. Served at `/contracts/fonts.css` they resolve to `/contracts/fonts/<file>.woff2`.
  Families are `"Bricolage Grotesque"`, `"Geist"` and `"Geist Mono"`.
- `contracts/` holds nine files: three `.css`, three `.woff2` and three OFL `.txt` under `fonts/`.
  `contracts/registry.json` does **not** exist yet, which is why the mechanism copies a directory.
- `tests/e2e/contract-fonts.pw.ts:90-95,176-189,291-321`: **the pattern to follow** for a MIME map,
  a face-status listener and the `document.fonts.check` assertion, and the recorded reason a
  computed-style read cannot stand in for it. That spec serves its own scratch tree; this one runs
  against the real server instead, so it reuses the shape and not the file.
- `playwright.config.ts:19-20,84-93`: `webServer` is `pnpm build && pnpm start --port 3100`, never
  reused. **So the harness already exercises the production build**, and the publish step runs
  inside it with no config change. `.github/workflows/ci.yml:179-209` runs the whole suite as the
  blocking `rendered-output` job.
- `.github/workflows/ci.yml:78-88,132-142`: both drift gates read
  `git status --porcelain --ignored=matching -- contracts/`. They are scoped to `contracts/` and
  neither runs `pnpm build`, so `public/contracts/` never reaches them.
- `.gitignore:111-123`: the Story 1-10 and 1-13 precedent for ignoring generated run output with a
  comment naming the story and the reason. The new entry follows it.
- `docker/__tests__/deps-stage.test.ts` and `ops/__tests__/contract-purity.test.ts`: the house
  pattern for a Vitest suite that reads non-TypeScript files off disk and asserts a standing
  obligation, including a planted negative so the assertion is observed rejecting on every run.
- `ops/tailwind-adapter.md`, `ops/contract-purity.md`, `ops/routing-inventory.md`: the record shape,
  including the Observed-or-Decision marking, the "what would invalidate this" table, stated limits
  and a numbered Pending Operator actions table with a `Completed (UTC)` column.
- Live baseline, **observed 2026-08-25**: `HEAD https://cuatro.dev/contracts/tokens.css` returns
  `404` with `content-type: text/html; charset=utf-8`; `HEAD https://cuatro.dev/` returns `200` with
  `server: cloudflare`.

## Tasks & Acceptance

**Execution:**
- `packages/contracts-serve/publish.mjs`: new. The publish step, in the `packages/*.mjs` house style
  with exported path constants and an invoked-directly guard. Removes `public/contracts/`, copies
  `contracts/` into it, prints what it wrote, refuses by name and exits non-zero when the source is
  missing or is not a directory, and carries no environment variable or argument that selects either
  path. Imports only `node:` builtins.
- `package.json`: prepend the publish step to `build` and to `dev`. No new dependency.
- `.gitignore`: ignore `/public/contracts/`, with a comment naming Story 1-16 and the rule it
  serves (AD-4: one authored location, the copy is built).
- `packages/contracts-serve/__tests__/contracts-serve.test.ts`: new. The pure suite, in the blocking
  `test` job. Covers the publish against scratch trees (fresh copy, stale destination, missing
  source), the `build` script's content and ordering, the `.gitignore` entry, and that nothing under
  `public/contracts` is tracked. Includes a planted negative for the ordering assertion so it is
  observed rejecting on every run.
- `docker/__tests__/runner-stage.test.ts`: new, added on the review pass. The runner stage is now the
  single hop that carries the published surface into the deployed image, and nothing failed when it
  was dropped. A sibling of `docker/__tests__/deps-stage.test.ts` with its own stage reader, plus
  planted negatives. `docker/Dockerfile` itself is not edited.
- `tests/e2e/contract-serving.pw.ts`: new. Runs against the harness's own production server. Asserts
  each stylesheet and each woff2 answers 200 with its observed content type, and loads a same-origin
  fixture page linking `/contracts/fonts.css` to prove the relative `url()` paths resolve against
  the served location. Logs the observed status and content type per path so the record can quote a
  run rather than assert one.
- `ops/contract-serving.md`: new. The record. The mechanism and why it was chosen over a Caddy
  file server and over a committed copy, the observed content types quoted from a run, the one
  authored location and how staleness is prevented, **which of Epic 3 and Epic 4 has to touch it**,
  the 2026-08-25 live baseline, stated limits (cache headers are not set by this story; the
  Cloudflare zone's `cache_level aggressive` and `browser_cache_ttl 14400` sit in front of it), and
  a numbered Pending Operator actions table.

**Acceptance Criteria:**
- Given AD-1 requires the entire published surface to be reachable by an HTTP GET, when the Hub is
  built and started by the Playwright harness, then `/contracts/tokens.css`, `/contracts/fonts.css`,
  `/contracts/tailwind.css` and every `/contracts/fonts/*.woff2` answer 200 with the content type
  the spec records, and the spec fails naming the path and the value it got if any of them does not.
- Given a stack reads identically when every face has 404'd, when a same-origin page links
  `/contracts/fonts.css`, then each face request is observed going to `/contracts/fonts/<file>.woff2`
  and answering 200, and `document.fonts.check` is true for `Bricolage Grotesque`, `Geist` and
  `Geist Mono`.
- Given two copies of an authored file is the drift AD-4 forbids, when the working tree is read,
  then `.gitignore` ignores `public/contracts/`, `git ls-files -- public/contracts` is empty, and
  the only authored copy of any contract file is under `contracts/`.
- Given a stale served copy would ship a contract that no longer exists, when the publish runs
  against a destination holding a file the source does not, then that file is gone afterwards and
  the destination is byte-identical to the source, asserted by a case rather than by the removal
  being visible in the code.
- Given Next reads its public directory when the server starts, when `package.json` is read, then
  the publish step is part of `build` and precedes `next build`, held by a case that is observed
  rejecting a reordered script on every run.
- Given `epics.md:1762-1765` requires neither later epic to discover this late, when
  `ops/contract-serving.md` is read, then it states in writing which of Epic 3 (the move to
  `apps/hub`) and Epic 4 (Traefik replacing Caddy) would have to touch this mechanism and what
  exactly each would change.
- Given this story publishes the surface and does not change it, when the diff against `6b134d3` is
  read, then `contracts/`, `packages/tokens/`, `packages/fonts/`, `app/`, `components/`, `public/`,
  `docker/Dockerfile`, `docker/Caddyfile`, `.github/`, `pnpm-lock.yaml` and `pnpm-workspace.yaml` are
  byte-identical, and both contract drift gates and the purity gate pass unchanged. (Amended on the
  review pass: this criterion named all of `docker/`, and the pass added
  `docker/__tests__/runner-stage.test.ts`. The two deployed artifacts under `docker/` are named
  instead, which is the invariant the criterion was written for and is no weaker.)
- Given the live URL in AC1 of `epics.md:1746-1752` names `https://cuatro.dev/contracts/`, and a
  deploy fires only on a push to `main`, when the agent's work is committed on `dev`, then the spec
  finalizes to `awaiting-operator` with the live confirmation enumerated under `operator_actions`,
  and `ops/contract-serving.md` carries the same actions with the observed 404 baseline beside them.

## Spec Change Log

## Review Triage Log

### 2026-08-26, Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 20: (high 0, medium 5, low 15)
- defer: 0
- reject: 6: (high 0, medium 0, low 6)
- addressed_findings:
  - `[medium]` `[patch]` **The publish could be skipped silently and the build would still exit 0.**
    `invokedDirectly` compared `process.argv[1]` to the module path as text, so a lower-cased drive
    letter, an 8.3 short path or a linked invocation on Windows made it false, `pnpm build` did no
    copy, and the deploy shipped a working site answering 404 at every `/contracts/` URL. That is
    this story's entire failure mode reached by a path nothing would report. Now `realpathSync` on
    both with the `resolve` fallback, which is the shape `ops/contract-purity.mjs:432-442` uses for
    the same guard, with a case.
  - `[medium]` `[patch]` **"Nothing was published." was not true on every path that printed it.**
    `rmSync` and the copy loop sat outside any `try`, so a failed removal raised a bare `EPERM` with
    neither the script name nor the clause, and a copy failing on file five exited 1 with the
    destination already removed and half rewritten while the record asserts the clause holds for the
    whole set. Both are wrapped now: a removal failure refuses naming the destination and the code, a
    copy failure removes the partial tree and refuses naming the file and the code, and it says so
    when the cleanup also failed rather than claiming a clean failure. `publish` takes an injected
    host on the `inspect(directory, read)` precedent so both are exercised, not merely described.
  - `[medium]` `[patch]` **Three of the seven refusals the record claimed a standing case for had
    none.** A linked surface root, a linked entry, and an entry that is neither a file nor a
    directory: deleting `lstatSync`'s symlink branch left every case green, so the guard
    `ops/contract-purity.md` handed this story could be removed without anything noticing. Cases
    added on the `ops/__tests__/contract-purity.test.ts:86-94` pattern with the Windows `junction`
    fallback, failing by name where a host cannot build the fixture, and every message is in the
    `every refusal` array, whose length is now pinned.
  - `[medium]` `[patch]` **Nothing failed when the runner stage stopped carrying `public`.**
    `docker/Dockerfile:34` is now the single hop that puts the published surface in the deployed
    image, and dropping it left typecheck, the whole unit suite, all three contract jobs and
    `rendered-output` green while the deploy from `main` served 404s everywhere. That is exactly the
    shape `docker/__tests__/deps-stage.test.ts:12-18` was written for one stage up. Added
    `docker/__tests__/runner-stage.test.ts`, a sibling with its own stage reader (the deps reader
    discards the `--from=` flag, which would accept a `COPY public ./public` out of the build context
    as satisfying the obligation), deriving `/app/public` from the builder's own `WORKDIR`, with
    three planted negatives. `docker/Dockerfile` is byte-identical.
  - `[medium]` `[patch]` **The face-availability check asked its question at a weight no published
    face declares.** The fixture set each sample at its own weight and then called
    `document.fonts.check('16px "<family>"')`, which queries 400, while Bricolage Grotesque publishes
    `700 800` and Geist `300 600`. Two of the three families passed through font-matching fallback
    rather than through the loaded face. Queried at the fixture's own weight now, and the record's
    sentence re-taken from the run that followed.
  - `[low]` `[patch]` The equality guard caught only an exactly identical pair while the refusal table
    said "It would delete the published surface". A destination containing the source, or the
    reverse, still reached the recursive removal. Containment is guarded in both directions, with
    cases.
  - `[low]` `[patch]` `process.exit(1)` immediately after `console.error` can cut a refusal off mid
    flush on a pipe, which is what a CI runner gives this process. `process.exitCode` carries the
    verdict and the exit happens in the write callback. Same trap Story 1-14 recorded against
    `ops/capacity-gate.mjs`.
  - `[low]` `[patch]` The `reading` and `writing` lines are argued to be load-bearing in two places
    and were asserted nowhere, so both could be deleted or moved after the copy with every case
    green. Asserted on the refusal path as well as the success path.
  - `[low]` `[patch]` `SERVED_AT` had two spellings: `/contracts/` exported by the module and
    `/contracts` re-declared in the browser spec. The module's own `SURFACE` comment argues at length
    that deriving one name once is what stops a message naming a folder that was not read. Aligned,
    and a case pins the spec's literal equal to the module's export.
  - `[low]` `[patch]` The browser spec built its URLs from `baseURL` without guarding it, so a
    project that started no server would request `undefined/contracts/...` and the failure would read
    as a serving defect.
  - `[low]` `[patch]` Two loops over `FACES.faces` could pass over an empty list, and `weightOf`
    would emit `font-weight: undefined` for a face with no numeric `wght`. Both refuse now.
  - `[low]` `[patch]` The final count compared against `FACES.faces.length`, so two faces sharing one
    woff2 would fail a run in which everything was served correctly. It compares distinct files.
  - `[low]` `[patch]` `EXPECTED_TYPE` had no `.json` entry, so `contracts/registry.json` (AD-4,
    Story 2-5) would have failed the first case with an extension nobody had an expected type for.
    Added ahead of the story that lands it, with an invalidation row saying what else goes stale that
    day: the file count of nine, the content-type table, Pending Operator action 1's URL list and
    Probe 1's output.
  - `[low]` `[patch]` The Epic 3 row told the next epic the move costs "the destination path, and
    nothing else", and was wrong three ways: `.gitignore`'s rule is root-anchored and silently stops
    matching, which makes the generated tree committable and is the AD-4 drift the entry forbids; the
    Vitest suite pins six literals rather than following the exported pair; and the runner stage
    copies the absolute `/app/public`, which stops being the Hub's public directory. The whole point
    of that section is that Epic 3 does not discover this late, and it pointed the wrong way.
    Replaced, and this spec's Design Notes corrected to match.
  - `[low]` `[patch]` The ordering paragraph called the position "not cosmetic" and conceded in the
    same breath that a publish ordered after `next build` would still land in the image. It now says
    what the ordering case does and does not protect, and which two properties actually ship.
  - `[low]` `[patch]` No limit named cross-origin consumption. `docker/Caddyfile` sends no
    `Access-Control-Allow-Origin`, so a site linking the served `fonts.css` cross-origin gets the
    stylesheet and every face fails the CORS check silently. Recorded with why it is not a designed
    path (AD-14 and AD-16 vendor the folder by copy, AD-4 fetches at build time) and what would
    change if it became one.
  - `[low]` `[patch]` No limit named `start`. `dev` and `build` publish; `pnpm start` alone serves
    whatever is on disk, so after a pull that changed `contracts/` it answers 200 with the previous
    surface. Recorded, with why the deploy path is unaffected.
  - `[low]` `[patch]` The 404 baseline was quoted as `$ HEAD https://cuatro.dev/contracts/tokens.css`,
    which is not a command on the Windows host it claims. In a file whose stated standard is Observed
    with its method, the one entry the Operator's live confirmation is measured against was the one
    that could not be re-run. Rewritten as the `Invoke-WebRequest` calls actually made, and re-taken
    2026-08-26T05:30Z, still 404.
  - `[low]` `[patch]` The `.gitignore` citation read `:206-211` where the block is `:205-210`, and
    this record's own Probe 2 output prints `.gitignore:210`.
  - `[low]` `[patch]` AC7 named all of `docker/` as byte-identical, and the runner-stage case above
    adds a file under `docker/__tests__/`. **A deliberate departure, recorded rather than glossed:**
    the criterion now names `docker/Dockerfile` and `docker/Caddyfile`, which are the two deployed
    artifacts it was written to protect, and both are byte-identical to `6b134d3`. The Execution list
    names the new file.

Nothing was deferred: no reviewer surfaced a pre-existing issue outside this story. Six findings were
rejected. That `/public/contracts/` should be added to `.dockerignore` (it should not: the record
analyses that exclusion's absence in place, the publish's removal is a designed and tested guarantee
rather than an accident, and adding the exclusion would make the paragraph explaining why the removal
is load-bearing on the deploy path half wrong, for about 95 KB of build context). That the story
should fix the stale lines in `AGENTS.md` (the `bmad:context` block says in its own header that edits
inside it are replaced on refresh, so a hand edit is written to be overwritten; Pending Operator
action 6 owns it, on the precedent `ops/tailwind-adapter.md` action 5 set). That the pre-existing
`"linkg": "next lint"` typo should be fixed or logged (`AGENTS.md:49-51` records it already and says
not to). That one document should not write both `Story 1-16` and `Story 1.19` (every `ops/` record
in this repository mixes the two the same way: the hyphen is the story key, the dot is the epics
numbering, and both are correct in their place). That the spec file being untracked at review time is
a completeness gap (it is written at finalize and committed with the rest). And that the unit suite
should derive its `.gitignore` path from `DESTINATION` so it follows Epic 3 (the case exists to
assert that a specific literal line is present, and `git check-ignore` already proves it takes
effect; the Epic 3 table now names the literals as deliberate rather than claiming they follow).

**One limit of patch 3's fixture-count pin, stated rather than left implied.** The `every refusal`
array's pinned length catches a refusal added to the module and to only one of the two lists. It
cannot catch one added to the module and to neither. The test comment and the record both say so.

## Design Notes

**Why `public/` and not a Caddy file server.** The box's Caddy is shared with three other projects,
its config lives only on the box, and `docker/Caddyfile` is a fragment installed by hand. Serving
`contracts/` there would put a required file outside the container, need a bind mount and a manual
install step per deploy, and make the published surface depend on a file no CI job reads. Serving it
from the Hub means the deploy that already ships the contract also ships the serving. It also
survives Epic 4 untouched: a Traefik router matching `Host(cuatro.dev)` proxies the same container.

**Why a build-time copy and not a route handler.** A Next route handler reading `contracts/` at
request time would be a `.ts` file, would spend Anchor CPU per fetch, and would have to be traced
into the standalone output. `public/` is served as static files by the same server with no code.

**Why the copy is not committed.** AD-4's rule is one authored location. A committed
`public/contracts/` would be a second copy that a reviewer must keep in step by hand, and the first
time it drifted, `https://cuatro.dev/contracts/tokens.css` would serve a value no generator produced.

**What Epic 3 and Epic 4 each do to this.** Epic 3 moves the Hub to `apps/hub`, so the destination
becomes `apps/hub/public/contracts/` while `contracts/` stays at the repository root. That is more
than the two paths in the module: `.gitignore`'s rule is root-anchored, the Vitest suite pins
literals deliberately, and the runner stage copies the absolute `/app/public`. The full list is the
Epic 3 table in `ops/contract-serving.md`, which is the record the criterion above points a later
epic at. Epic 4 replaces Caddy with Traefik, which changes the ingress and not the path: nothing
here needs touching unless the Operator chooses to have Traefik serve the directory directly, which
`epics.md:1741-1742` names as the interim-versus-final decision.

## Verification

**Commands:**
- `corepack pnpm typecheck`, expected: exit 0 with the three new `.ts` files included.
- `corepack pnpm test --run`, expected: exit 0, totals grow by this story's cases, no pre-existing
  case moved.
- `corepack pnpm build`, expected: exit 0, and `public/contracts/` afterwards holds the same nine
  relative paths as `contracts/`.
- `corepack pnpm test:e2e`, expected: the three `contract-serving` cases pass, with their per-path
  status and content-type lines in the output, and no pre-existing case moves. On this Windows host
  five cases fail for reasons that predate the story (one font-swap tolerance, four tied to the
  Linux screenshot baseline, which `ops/rendered-output-harness.md` pins to
  `mcr.microsoft.com/playwright:v1.62.1-noble`), so the run exits 1 here and the passing count is
  what is compared. Exit 0 is expected only in the pinned container, which is where the blocking
  `rendered-output` job runs it. `pnpm` is not on PATH on this host and `playwright.config.ts`
  invokes it directly for its `webServer`, so a `pnpm` shim forwarding to `corepack pnpm` has to be
  on PATH for a local run.
- `node ops/contract-purity.mjs`, expected: exit 0, `9 files, none executable and no link`.
- `git status --porcelain --ignored=matching -- contracts/`, expected: empty.
- `git ls-files -- public/contracts`, expected: empty. `git check-ignore -v public/contracts/tokens.css`,
  expected: names the new `.gitignore` line.
- `git diff --stat 6b134d3 -- contracts packages/tokens packages/fonts app components public docker/Dockerfile docker/Caddyfile .github pnpm-lock.yaml pnpm-workspace.yaml`,
  expected: empty.
- Punctuation sweep over every file written, run against a positive control carrying an em-dash, an
  en-dash, a double-dash and an emoji so it cannot pass vacuously.

**Manual checks:**
- Read `ops/contract-serving.md` as the Operator would after the deploy: confirm the Pending
  Operator actions name the exact URLs to fetch, what a correct answer looks like, and where to write
  the result.

## Auto Run Result

Status: awaiting-operator
Blocking condition: none

**Summary.** `contracts/` is now served. `packages/contracts-serve/publish.mjs` replaces
`public/contracts/` with a copy of `contracts/` at the start of `pnpm build`, so the Hub's own Next
server answers `/contracts/tokens.css`, `/fonts.css`, `/tailwind.css` and the three woff2 faces, and
`docker/Caddyfile`'s existing `cuatro.dev` site block already reverse-proxies that server. No ingress
change, no Dockerfile change, no second authored copy: the served tree is generated and gitignored.
Observed against the harness's own production build, all nine paths answer 200 with `text/css`,
`font/woff2` and `text/plain`, byte-identical to the authored file, and the relative `url()` paths in
the served `fonts.css` resolve to `/contracts/fonts/<file>.woff2` and load. The live URL that AC1 of
`epics.md:1746-1752` names cannot be asserted from `dev`, because a deploy fires only on a push to
`main`, so the story finalizes at `awaiting-operator` with six `operator_actions`.

**Files changed.**
- `packages/contracts-serve/publish.mjs`: new. The publish step. Node builtins only, no
  `package.json` in the directory, both paths fixed in the module. Refuses ten ways, each naming the
  path and ending "Nothing was published.", and leaves the served tree untouched on every one.
- `package.json`: `build` and `dev` run the publish before `next build` / `next dev`, plus a
  `contracts:publish` script on the house convention.
- `.gitignore`: `/public/contracts/`, with the story and the AD-4 reason named.
- `packages/contracts-serve/__tests__/contracts-serve.test.ts`: new, 40 cases in the blocking `test`
  job. The publish against scratch trees, every refusal, the `build` script's content and ordering
  with three planted negatives, the `.gitignore` line read both from the file and through
  `git check-ignore`, and no tracked path under `public/contracts`.
- `docker/__tests__/runner-stage.test.ts`: new, 8 cases. The runner stage carries `public` into the
  image, with three planted negatives. `docker/Dockerfile` is byte-identical.
- `tests/e2e/contract-serving.pw.ts`: new, 3 cases in the blocking `rendered-output` job, against the
  server `playwright.config.ts` starts with `pnpm build && pnpm start`.
- `ops/contract-serving.md`: new. The record.
- This spec: the review pass in the Review Triage Log, the AC7 amendment, the Epic 3 correction in
  Design Notes, and this result.

**Review findings breakdown.** 20 patches applied (high 0, medium 5, low 15), 0 deferred, 6
rejected, 0 intent gaps, 0 spec repairs.

**Follow-up review recommendation:** `true`. Patched this pass: high 0, medium 5, low 15. Score is
`3 x 5 + 1 x 15 = 30`, which is 5 or more.

**Verification performed**, all re-run after the patches.
- `corepack pnpm typecheck`: exit 0.
- `corepack pnpm test --run`: exit 0, 25 files, 585 cases, up from the 23 files and 537 cases at
  `6b134d3`. No pre-existing case moved.
- `corepack pnpm build`: exit 0, `published 9 files at /contracts/`, and `public/contracts/`
  afterwards holds the same nine relative paths as `contracts/`.
- `corepack pnpm test:e2e`: 19 passed, 5 failed. The three `contract-serving` cases pass. The five
  failures are the pre-existing Windows-host set (one font-swap tolerance, four tied to the Linux
  screenshot baseline) and were confirmed against `6b134d3` with this story stashed: the same five
  names, 16 passing there against 19 here.
- `node ops/contract-purity.mjs`: exit 0, `9 files, none executable and no link`.
- `git status --porcelain --ignored=matching -- contracts/`: empty.
- `git ls-files -- public/contracts`: empty. `git check-ignore -v public/contracts/tokens.css`:
  `.gitignore:210:/public/contracts/`.
- `git diff --stat 6b134d3 -- contracts packages/tokens packages/fonts app components public
  docker/Dockerfile docker/Caddyfile .github pnpm-lock.yaml pnpm-workspace.yaml`: empty.
- Punctuation sweep over every written file against a positive control carrying an em-dash, an
  en-dash used as a dash, a double-dash and an emoji: the control matched all four kinds, the written
  files matched nothing.
- Manual check: `ops/contract-serving.md` read as the Operator would after the deploy. Pending
  Operator action 1 names all nine URLs, the expected status and content type for each, the
  instruction to send a real user agent, and where in the file to write the result beside the
  baseline.

**Residual risks.**
- Everything between the Hub and a Visitor is unasserted by anything in this repository: the deployed
  container, `node server.js` rather than `next start`, Caddy, and the Cloudflare edge. The harness
  runs the same `pnpm build` the Docker builder runs, and that is the whole of the overlap. Pending
  Operator action 1 is the only thing that closes it.
- The content types are observed on Windows against Next 16.2.1. The `rendered-output` job has not
  yet run this spec on Linux in the pinned container, which is Pending Operator action 5.
- A build-time fetch that sends no user agent is answered 403 by the Cloudflare edge, observed on the
  live apex against the same Next `public/` path this story publishes into. AD-4 has seven
  repositories fetch the Registry at build time. Nothing in this repository can detect that, and
  Pending Operator action 4 owns telling them.
- `pnpm start` alone does not publish, so a local server started after a pull that changed
  `contracts/` serves the previous surface with a 200. The deploy path is unaffected because its
  builder always runs `pnpm build`. Recorded as a stated limit rather than fixed, because wiring the
  publish into `start` would run it twice on the harness's own `pnpm build && pnpm start`.
- The `every refusal` array's pinned length catches a refusal added to the module and to one of the
  two lists, not one added to neither. Stated in the test and in the record.
