---
title: 'Story 2.25: Relocate `list-wheel` onto a `cuatro.dev` subdomain'
type: 'feature'
created: '2026-09-13'
status: 'done'
baseline_commit: 'e2d4fa16844682483740e8a3e41d93423996b0e4'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** `list-wheel` is the one rendered Suite Directory entry that leaves the suite's domain:
its Registry `live` is `https://luigiespinosa.github.io/list-wheel/`, so Daniela's click breaks the
framing at the moment it should hold (PRD §5.3, §1). `wheel.cuatro.dev` was ruled the hostname on
2026-09-02 and is NXDOMAIN today. It is the first genuinely new placement on the box, so it is the
first real consumer of the Capacity Gate (AD-9, AD-17c).

**Approach:** Mirror the Anchor's own deploy shape in the `list-wheel` repository (Operator ruling
2026-09-13): a two-stage `Dockerfile` (`node:22-slim` runs `npm ci` and `ng build`, `caddy:2` serves
`dist/list-wheel/browser` on `:80`), a `docker-compose.yml` whose one service `list-wheel` joins
`cs-tracker_default` with no published port, and a `deploy.yml` that checks out `cuatro-portfolio`
at `main`, runs `node ops/capacity-gate.mjs list-wheel` as a blocking step, then `docker compose up
--build -d --remove-orphans` over SSH in `/home/deploy/list-wheel`. On the box the shared Caddyfile
gains a `wheel.cuatro.dev` site block (its own Host-matched router, AD-7) reverse-proxying
`list-wheel:80`. Cloudflare gets a proxied `A` record and WAF rules R1 and R3 gain the hostname;
UptimeRobot gets a monitor. In this repository the Registry entry's `live` becomes
`https://wheel.cuatro.dev` and `tech` becomes `Angular · TypeScript · Docker · Caddy`, the gate's
`placements` logs `list-wheel`, and the eight `ops/` records that state hostname counts move. Last,
after the new hostname is verified serving, `gh-pages` becomes a redirect page so the old URL never
dies. The restyle is Story 8.3 and is not touched (AD-20).

## Boundaries & Constraints

**Always:**

- **The assumption is confirmed, not trusted (AC 2).** Observed 2026-09-13 in the checkout at
  `main` `e589ef3`: `@angular/build:application` with no `server` entry, no `provideRouter`, no
  service worker, no runtime fetch; `gh-pages` `b9ee2b8` holds seven static files. It is static file
  serving, so FR-33's re-gate clause does not fire. The spec records this; the Verification section
  re-states it from the build.
- **Order of operations leaves a working system at every step (AD-20, NFR-2).** The clone on the
  box and the three secrets exist before the `list-wheel` PR merges; the merge is the deploy that
  places the container; WAF rules R1 and R3 gain `wheel.cuatro.dev` **before** the DNS record exists,
  so no hostname is ever live unfiltered (AD-17b); the Caddy block is validated and reloaded, the six
  incumbent hostnames are re-probed, and the block is proved over loopback **before** the DNS record;
  the DNS record, the monitor and the records land in the same session (`ops/monitoring.md:298`);
  the `contracts/registry.json` commit is pushed only after `https://wheel.cuatro.dev/` answers 200
  from off the box, because that push triggers the live check
  (`.github/workflows/registry-verification.yml:24-33`); `gh-pages` becomes a redirect only after
  that, never before.
- **The gate is seen running and passing, not merely present (AC 1).** The Deploy run in
  `list-wheel` that places the container is cited by URL, and its gate step's stdout line (`status is
  open against a threshold of load15 0.60 ... list-wheel may be placed`) is quoted in this spec and
  in `ops/capacity-threshold.md`. The step carries no `continue-on-error` and no `if:`, and sits
  before the `ssh-action` step, the three rules `ops/__tests__/capacity-gate.test.ts:337-361` holds
  the Anchor's workflow to.
- **The compose service and its alias are `list-wheel`** (AD-3: compose service `<id>`), never
  `app`, `web`, `api` or `db` (`ops/routing-inventory.md:1130-1139` records the live `app`
  collision). No `ports`, no `container_name`, a real healthcheck (AD-8's two requirements on every
  service), `restart: unless-stopped`, `cs-tracker_default` declared `external: true`.
- **The site block is the estate's, verbatim in shape**: `tls /data/origin-ca/origin.pem
  /data/origin-ca/origin.key`, the three headers (`X-Content-Type-Options "nosniff"`,
  `X-Frame-Options "DENY"`, `Referrer-Policy "strict-origin-when-cross-origin"`), tab indentation,
  `reverse_proxy list-wheel:80`. No CSP, no HSTS, no `-Server` (`docker/Caddyfile:28-36`).
- **Only the box edits the box.** The shared Caddyfile is a read-only bind mount and a 70-line
  uncommitted working-tree edit in `/home/deploy/cs-tracker` (`ops/routing-inventory.md:611-637`):
  edit the host path, back it up as `Caddyfile.bak-2-25` first, `docker exec cs-tracker-caddy-1
  caddy validate --config /etc/caddy/Caddyfile` before `caddy reload`, and restore the backup if any
  incumbent's status code changes. Never `git` anything in that directory.
- **Every outward-facing write is confirmed with the Operator immediately before it is made**, one
  confirmation per write: each `gh secret set`, the clone on the box, the PR merge, each Cloudflare
  write (two rule edits, one record), the Caddyfile append and reload, the monitor, the `gh-pages`
  push. Nothing is printed that is a secret; the private key reaches `gh secret set` through `cmd /c
  "... < file"` (AGENTS.md, the CRLF pitfall).
- **`contract_version` stays `1.1.0`.** A data edit inside an entry is not a shape change: Story 2-6
  rewrote fourteen descriptions without a bump, and `1.0.0` to `1.1.0` was Story 2-3's schema gate.
  Stated so a reviewer checking `contracts/registry.schema.json:18` finds the ruling.
- **`RxJS` leaves the `tech` array with `GitHub Pages`.** Nothing under `src/` imports it, which
  `deferred-work.md:1798-1817` filed as an FR-9 defect on 2026-09-03; re-shipping a value known to
  be false while editing that line would be a choice. The array is `Angular · TypeScript · Docker ·
  Caddy`, and that deferred entry closes.
- **Every count a record states moves with a date beside it, never over the old figure**
  (`ops/routing-inventory.md:67-69`, `ops/monitoring.md:1054-1064`, `ops/bot-mitigation.md:384-388`).
  Dated observation tables are never edited; a new dated row or paragraph sits beside them.
- **The known-violations register widens KV-1 rather than hiding the second build.** The
  `list-wheel` deploy is a second, knowing AD-8 breach on the same box, ruled tolerated by the
  Operator on 2026-09-13 (this story's clarification, question 2), retired for this half by Story 4.3.
  Keep the `| KV-n |` index row and the `---` separators `ops/__tests__/hit-target-floor.test.ts:749-796`
  parses.

**Ask First:**

- Any change to the shared Caddy beyond appending one site block (a global option, a snippet, a
  header the other blocks do not send).
- An `AAAA` record for `wheel` (the Anchor's three hostnames carry `A` only; the Satellites carry
  both), or any other DNS record.
- Any WAF rule edit beyond adding `wheel.cuatro.dev` to R1's and R3's `http.host in {...}` lists.
- Building the image anywhere but the box (the GHCR path was offered and declined on 2026-09-13).
- A test or CI job in the `list-wheel` repository beyond the deploy workflow.
- Merging `dev` into `main`: that is what publishes the Registry change to the Hub and to
  `https://cuatro.dev/contracts/registry.json`; it is proposed at the end, not assumed.

**Never:**

- No restyle, no token adoption, no change to what `list-wheel` renders (Story 8.3, AD-20). The
  served bundle is `ng build` of `main` `e589ef3`, the same commit `gh-pages` was built from.
- No edit to `.github/workflows/deploy.yml` or `ci.yml` in this repository; no new job; no edit
  to `contracts/registry.schema.json`; no edit to `ops/capacity-gate.mjs`; no change to
  `threshold`, `baseline` or `status` in `ops/capacity-gate.yml` (only `placements` gains an entry).
- No `git reset`, `pull` or `checkout` in `/home/deploy/cs-tracker`; no restart of any container
  other than a `caddy reload` inside `cs-tracker-caddy-1`; no `docker compose down` anywhere.
- No credential created, rotated, revoked or printed. The existing zone token in `.env` performs the
  Cloudflare writes; the existing `deploy` key is what `list-wheel`'s `SSH_PRIVATE_KEY` holds.
- No `docker/Caddyfile` edit here: that file is the Anchor's fragment. The `wheel.cuatro.dev` block
  is recorded verbatim in `ops/routing-inventory.md` and in the `list-wheel` repository.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First placement | Gate `open`, `list-wheel` not in `placements` | Gate step exit 0, stdout names the threshold and `list-wheel may be placed`; SSH step builds and starts the container | A non-zero gate exit stops the job before SSH |
| Redeploy after the placement lands on `main` | `list-wheel` in `placements` | Gate step exit 0, stdout `list-wheel is in placements, the deploy may proceed` | none |
| Redeploy while the entry is only on `dev` | Gate re-blocked in that window | Refused as a new id: stated limit, filed as deferred work | The Operator merges `dev` to `main` or waits |
| Caddy validate fails | A malformed block appended | No reload; restore `Caddyfile.bak-2-25`; incumbents unaffected | validate exit code |
| Reload changes an incumbent | Any of the six codes differs from its baseline | Restore the backup and reload again; the story stops until explained | probe comparison |
| Loopback probe before DNS | `curl --resolve wheel.cuatro.dev:443:127.0.0.1 -k` on the box | 200, `<title>Cuatro Wheel</title>`, the three headers | none |
| Through Cloudflare, browser UA | `GET https://wheel.cuatro.dev/` | 200, `cf-ray` present, hashed `main-*.js` referenced with `<base href="/">` | none |
| `GPTBot` UA | R1 with the new host | 403 | none |
| Empty UA, not a verified bot | R3 with the new host | Managed challenge (403 with `cf-mitigated: challenge`) | none |
| `UptimeRobot` UA | R2 (negation on `analytics` only) | 200, never challenged | none |
| Registry verification agent | `cuatro-registry-verification/1 (+https://cuatro.dev/contracts/registry.json)` | 200 (not on R1's list, not empty for R3) | none |
| Unknown path on the new host | `GET /anything` | 200 with `index.html` (`try_files`), matching Pages today, whose `404.html` is a byte-identical copy of `index.html` | none |
| Old URL after the flip | `GET https://luigiespinosa.github.io/list-wheel/?q=1#x` | 200, a redirect page with `<meta http-equiv="refresh" content="0; url=https://wheel.cuatro.dev/">`, `<link rel="canonical">` and a script carrying search and hash across | A browser without script still follows the meta refresh |
| Old URL, any sub-path | Pages serves `404.html` | The same redirect page | none |
| Registry push run | `contracts/registry.json` pushed to `dev` | Run green: `list-wheel live resolves: https://wheel.cuatro.dev 200` | A red run means the hostname was not serving; it must never be pushed first |

</frozen-after-approval>

## Code Map

**Governing text**

- `ARCHITECTURE-SPINE.md:94-99` AD-3 (compose service and router are the id; the hostname is
  declared, never derived); `:119-123` AD-7 (Host-matched router, `PathPrefix` forbidden); `:125-129`
  AD-8 (build on the box is the standing violation; healthchecks, no `container_name`, no `ports`);
  `:131-135` AD-9; `:179-183` AD-17c; `:234-242` AD-26 (proxied, Origin CA covers `*.cuatro.dev`, the
  orange cloud never comes off). `prd.md:620-624` §5.3; `:632-640` NFR-2, NFR-3, NFR-10.
  `addendum.md:323-345` §G. `epics.md:2957-3003` the story; `:4213-4218` Story 4.3, which moves the
  hostname onto Traefik later and is the closer for the `list-wheel` half of KV-1.
- `epic-2-context.md:83-93` (ids), `:150-154` (Epic 1 gates this placement three times).

**`list-wheel` (checkout `C:\Development\list-wheel-workspace\list-wheel`, `main` `e589ef3`, remote
`git@github.com:LuigiEspinosa/list-wheel.git`, no branch protection, no secrets, no `.github/`)**

- `angular.json:6-14` project `list-wheel`, builder `@angular/build:application`, no `outputPath`,
  so output is `dist/list-wheel/browser/`; `:19-25` assets `public/**/*` (only `favicon.ico`);
  `:28-42` production budgets (initial 500 kB warn, 1 MB error; today 166 kB + 35 kB + 1.6 kB);
  `:49` `defaultConfiguration: production`, so `npm run build` is the production build with
  `<base href="/">` from `src/index.html:7`. The `/list-wheel/` base came only from the `deploy`
  script's flag.
- `package.json:10` the `deploy` script to delete; `:41` `angular-cli-ghpages` to `npm uninstall`
  (lockfile `:3975-4360` and `gh-pages` `:6240-6270` go with it); `:31` `@angular/router` unused but
  not this story's. No `engines`, no `packageManager`; `package-lock.json` lockfileVersion 3, so
  `npm ci`. `@angular/cli` 20.3.3 needs node `^20.19 || ^22.12 || >=24` (`package-lock.json:451-455`):
  `node:22-slim`, the Anchor's base (`docker/Dockerfile:1`).
- `src/index.html:12-14` Google Fonts: the production build inlines the `fonts.googleapis.com` CSS,
  so **the build stage needs HTTPS egress** and the browser fetches only `fonts.gstatic.com` woff2.
  Same as the Pages build today. `src/styles/tokens.css:35-37` system fallbacks, so a blocked font is
  a degrade, not a break.
- `src/app/app.config.ts:1-9` no router, no service worker; `src/app/services/entry.service.ts:128,
  168-176` clipboard and File System Access need a secure context, which HTTPS gives;
  `controls.component.html:44-51` the only external navigation, two `target="_blank"
  rel="noopener noreferrer"` anchors. Nothing fetches from its own origin except the bundles and
  `favicon.ico`.
- `.gitignore:4` `/dist`, `:32` `/.angular/cache`: the `.dockerignore` starts from these.
- `karma.conf.js:25-31` `ChromeHeadlessNoSandbox`; `npm test` needs Chrome. No CI exists; this
  story adds none (DW-90).
- `README.md:7` live demo URL; `:81` `| **Deployment** | angular-cli-ghpages. |`; `:33` a stale
  `window.open` in the diagram, not this story's. `CHANGELOG.md:3` newest entry `## [2026-04-14]`;
  the relocation entry goes above it. `.markdownlint.json:3-7` no line-length rule.
- `origin/gh-pages` `b9ee2b8` (2026-07-12T09:32:34Z, 40 s after `main` `e589ef3`): `.nojekyll`,
  `404.html` (md5 equal to `index.html`), `favicon.ico`, `index.html` with `<base
  href="/list-wheel/">`, `main-3S57BQZJ.js`, `polyfills-5CFQRCPP.js`, `styles-VFKBVUT4.css`. Pages
  config (`gh api repos/LuigiEspinosa/list-wheel/pages`): branch `gh-pages`, path `/`, `cname:
  null`, `custom_404: true`, `https_enforced: true`.

**Shapes to mirror in this repository**

- `docker/Dockerfile:1-36` stages named, `node:22-slim` floating major (the estate pins nothing by
  digest, `ops/routing-inventory.md:1008-1011`), `WORKDIR /app`, no `USER`, no `HEALTHCHECK` in the
  image (health lives in compose); `:4-8` the comment register: why, which story, which failure.
- `docker-compose.yml:20` `name:` equals the id and the checkout directory; `:11-19` why every
  service is prefixed (copy the reasoning, not the prefix: `list-wheel` collides with nothing in
  `ops/routing-inventory.md:1121-1130`); `:23-42` service shape (`build.context`, `networks` with the
  alias, nothing else on the ingress network); `:43-59` healthcheck shape (`CMD-SHELL`, 15 s / 5 s /
  5 / 30 s) with the reason; `:60` restart; `:111-113` the external network. `:27-34` the `:?` guards
  exist only for build secrets: `list-wheel` has none, so no `--env-file`.
- `.dockerignore:1-37` shape; `list-wheel`'s needs `node_modules`, `dist`, `.angular`, `.git`,
  `coverage`, `.vscode`, the compose and Docker files themselves.
- `.github/workflows/deploy.yml:1-9` trigger and job; `:11-22` checkout and `setup-node@v7`
  (`node-version: 22`, `package-manager-cache: false`, with the comment); `:24-36` the gate step and
  its comment; `:40-61` the SSH step (`appleboy/ssh-action@v1`, `set -euo pipefail`, `fetch`,
  `reset --hard origin/main`, `up --build -d --remove-orphans`, with why each is load-bearing).
  Actions pinned by major tag, no `permissions:` block: DW-87 owns that estate-wide
  (`deferred-work.md:4293-4314`). For `list-wheel` the checkout is `actions/checkout@v7` with
  `repository: LuigiEspinosa/cuatro-portfolio`, `ref: main`, `path: cuatro-portfolio`,
  `sparse-checkout: ops`, and the step runs `node cuatro-portfolio/ops/capacity-gate.mjs
  list-wheel`. The checker resolves its file beside itself (`ops/capacity-gate.mjs:14-23, 353`).
- `docker/Caddyfile:1-26` fragment conventions and the install procedure; `:41-49` the block to
  copy; `:38-39` tabs. On the box: `/home/deploy/cs-tracker/Caddyfile` ends with the Anchor's three
  blocks under a `# --- cuatro-portfolio ... Story 1-21. ---` comment (observed 2026-09-13); the
  wheel block is appended after the last `}` with the same comment shape. Backups there:
  `Caddyfile.bak-1-3`, `.bak-1-21`, `.bak-library-`, `.bak-ops1`. Reload: `docker exec
  cs-tracker-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile` (admin API is
  `127.0.0.1:2019`, IPv4, inside the container, `ops/routing-inventory.md:523`).
- The box, observed 2026-09-13 over `wsl -d Ubuntu-22.04 ssh deploy@177.7.52.248`: load15 0.09,
  78 GB free, 5.6 GB available; Docker 29.6.2, Compose v5.3.1; no `node` on the host (the build is
  in the image); `/home/deploy/cuatro-portfolio` is an HTTPS clone of the public repository, so
  `list-wheel` clones the same way with no key; `cs-tracker_default` exists; fourteen containers,
  `cs-tracker-caddy-1` the only port publisher.

**The gate and its suite**

- `ops/capacity-gate.yml:64-76` entry shape (`  - id:` / `    observed:` / `    note: serving
  <hostname>`); `:5-6, 42, 47` the header names one reader, now two. `ops/capacity-gate.mjs:62-63,
  189-223` accepted keys `id`, `observed`, `note`; no tabs, no `#` in a value; `:278-291`
  `evaluate`: an incumbent passes before status is read, an open gate admits a new id naming the
  threshold.
- `ops/__tests__/capacity-gate.test.ts:158-166` pins exactly four ids (fails on the fifth: append
  and retitle); `:119-134`, `:230-238`, `:259-276` use `list-wheel` as the never-placed probe and
  the last two read a load15 figure out of the new-id message, which the incumbent message lacks:
  rename the probe to `cs-tournament`, the other intended addition (`ops/capacity-threshold.md:68`).
  Fixture cases at `:187-223, 282-305, 458-464, 520-568` list only `cuatro-portfolio` and stay. `:14,
  104-110` `parseGate(committed)`, where the new note-names-hostname case sits; `:75-102, 245-254`
  `spawned`/`runAgainst` for the binary.
- `.github/workflows/registry-verification.yml:24-33` `schedule` (from `main`), `workflow_dispatch`,
  and `push` on `contracts/registry.json` with no branch filter: the `dev` push runs the live check.
  `ops/registry-verification.mjs:152-166, 252-259` one GET per `live`, redirects not followed, 2xx
  or 3xx passes. `ops/__tests__/registry-verification.test.ts:128-140` `routesForCommittedRegistry`
  plants every committed `live` at 200 unless in `REDIRECTING` (`:82-87`), so the new URL needs no
  fixture as long as the root answers 200 at the first hop; `:217-237, 249-258` pin 6 live rows as 3
  by 200 and 3 by 3xx, unchanged by a 200.
- `contracts/registry.json:64-73` the entry; `:68` `tech`, `:72` `live`.
  `contracts/registry.schema.json:104` accepts `https://wheel.cuatro.dev`. `lib/__tests__/registry.test.ts:340-354,
  415-425, 455-461` hold on the new values (one Hub-origin entry, one elsewhere, every framework
  resolves). `components/organisms/SuiteDirectory/SuiteDirectory.tsx:59,134` renders the bare
  domain, so `wheel.cuatro.dev` is the label; `tests/e2e/rendered-output.pw.ts:21,104-105` screenshots
  `/work` only, no baseline moves.

**Records, and the exact lines that move** (each file's own rule: standing claims change in place,
dated tables gain a dated row beside them)

- `ops/routing-inventory.md`: `:17, 154-167` "all 25 records", "Six A" (26, seven A, dated);
  `:169-176` DNS table row `wheel.cuatro.dev | A | 177.7.52.248 | proxied | auto`; `:321` the
  no-`AAAA` group becomes four; `:46-54` the invalidation table trips rows 48, 49, 51, 52; `:299-311`
  hostname table row in the `:306` shape (`list-wheel-list-wheel-1`, alias `list-wheel`, port 80);
  `:445-469` AD-3 table row and "Eleven hostnames, five with an id" to twelve and six; `:487, 499-502`
  the `list-wheel` gap closes and "exactly four ids" becomes five; `:526-530, 586-595, 623, 626, 631`
  seven site blocks, the new block verbatim, the loaded host set, the insertion count; `:894-925`
  five compose projects and a `### list-wheel, services list-wheel` subsection; `:1116-1139` alias
  row; `:1410-1423, 1462-1467` seven blocks, whether the block is mirrored in the `list-wheel`
  repository (it is, as `docker/Caddyfile` there), no per-project secrets, `Caddyfile.bak-2-25`,
  the git-state row; `:1504-1514` five projects build on the box; `:1857, 1866, 1957` the appendix
  loops gain `list-wheel`; `:1563-1580` the `## What Story 1.21 changed` table is the shape of the
  new `## What Story 2-25 changed` section (Change, Where, When UTC), listed in the Contents at
  `:11-38`.
- `ops/estate.md:157` the row (Live: `wheel.cuatro.dev`, Pages until the date, now a redirect) with
  an `**Amended 2026-09-13 by Story 2-25.**` line in the file's idiom (`:20-22, 142`).
- `ops/registry-inputs.md:10-11` header amendment; `:70` `live` row and its Nature; `:85`; `:101`
  the tech row; `:111-128` a note that `Docker` and `Caddy` are a Decision (deployment, not a
  manifest), as the Anchor's own array already implies at `:96`; `:212-233` a dated resolution of the
  hostname section (routed, the `:487` citation, `epics.md:2155-2156` met one story later); `:392-394`
  limit 4 gains "gh-pages now holds a redirect page". Per `ops/registry-verification.md:126-129` the
  push run's URL is recorded beside the entry here.
- `ops/monitoring.md:45-53` monitors table row (id, `wheel.cuatro.dev`, HTTP, status code, status at
  creation); `:193-203` probe table row `wheel.cuatro.dev | / | HTTP 200 | Decided. Another
  repository, so no health endpoint is assumed`; `:316-319` becomes dated history naming the monitor
  id; `:30, 34, 35, 142, 901` five/six become six/seven; `:768` seven hostnames; a dated
  certificate row beside `:355-372` (edge issuer as observed, not copied). Settings the record fixes
  for every monitor: HTTP, `/`, interval 300 s (`:34, 519`), redirects followed and 2xx/3xx
  (`:255-256`), SSL error check on (`:713`), alert contact 8726805 (`:30`). Only
  `ops/__tests__/visitor-instrumentation.test.ts:207-213` reads this file (the `:328` paragraph and
  the pointer after it), unaffected.
- `ops/bot-mitigation.md:44-49` rule 1 "all six hostnames" to seven, rule 3 "the five application
  hostnames" to six, dated; `:55-67` five live hostnames behind the rules with the new code, one
  non-Cloudflare `live` left; `:179` seven; `:263-268` `Rules live on:` gains `wheel.cuatro.dev` and
  a dated paragraph under it (the `AD-17b status:` line stays `satisfied`, `:284-289` parse
  contract); a new dated `### Verified, not assumed` table for the hostname in the `:107-121` shape
  (browser UA, `GPTBot`, `Googlebot`, `UptimeRobot`, the verification agent, monitors UP). Ruleset id
  `57602610aea04496a2f8ed13ec584b6c`; R2 is `http.host ne "analytics.cuatro.dev"` (read 2026-09-13),
  so it needs no edit.
- `ops/known-violations.md:70-76` KV-1 scope paragraph widened; the table gains rows for the second
  offending line (`list-wheel/.github/workflows/deploy.yml`), `Ruled by` (Operator, 2026-09-13) and
  `Retired by` (Story 4.3) for that half; `:449-459` no new Operator action, the ruling is taken.
- `ops/capacity-threshold.md:68-70` "relocating" becomes "placed 2026-09-13"; `:98-102` the
  container's observed footprint appended (`docker stats` mean and peak after placement, and the
  build's `uptime` load15 right after the first deploy); `:275-280` the gate now has a second caller
  and the placement passed through it; `:306` the review-date row: the placement is a change the row
  anticipates and the Step 2 charge already covers it, so no re-derivation is owed and the date
  stands; `:322-329` a row recording the footprint check done.
- `ops/registry-verification.md:59, 173` dated cells naming `luigiespinosa.github.io` and "four live
  hostnames": a dated correction beside each; `:202+` the push run joins § Observed runs.
- `deferred-work.md`: next free id **DW-90**; `:2350-2372` (bare domain renders `github.io`)
  closes; `:1798-1817` (`RxJS`) closes; `:515-528` gains a dated half-close (`list-wheel` now calls
  the gate, the three Satellites still do not); `:797-831` four of four becomes five of five with
  KV-1 widened; `:3306-3314` re-owned: this story took no Hub routing decision, the owner is the
  next story that does. New: DW-90 (`list-wheel` deploys on push with no test suite in CI), DW-91
  (the `placements` entry lives on `dev` until the epic merges: a re-block in that window refuses
  `list-wheel` as a new id).
- `ops/contract-adoption.md:256` `list-wheel`'s policy row reads "no workflow": re-observe it once
  `deploy.yml` exists, keeping the cell non-empty (`ops/__tests__/contract-adoption.test.ts:189-194`).

**Cloudflare, read 2026-09-13 with the zone token in `.env`** (`CLOUDFLARE_TOKEN`, DNS edit and,
by the 1-3 precedent, WAF edit; verify `active`): zone `cuatro.dev` (id begins `e90c26`), `wheel`
absent, six proxied `A` at `177.7.52.248` (apex, www, analytics, cs-tracker, tracker, library) and
three proxied `AAAA` (the Satellites). R1 expression: `(http.host in {"cuatro.dev" "www.cuatro.dev"
"analytics.cuatro.dev" "cs-tracker.cuatro.dev" "tracker.cuatro.dev" "library.cuatro.dev"}) and (...)`;
R3: `(http.host in {"cuatro.dev" "www.cuatro.dev" "cs-tracker.cuatro.dev" "tracker.cuatro.dev"
"library.cuatro.dev"}) and http.user_agent eq "" and not cf.client.bot`. Edit each with `PATCH
/zones/{zone}/rulesets/{ruleset}/rules/{rule}` carrying the rule's own `action`, `description` and
the widened `expression`, then read the ruleset back.

**Pins a new file trips:** none in this repository (no test enumerates `ops/*.md` files or
`contracts/registry.json` values beyond the pins above). In `list-wheel`: nothing enumerates files.

## Tasks & Acceptance

**Execution** (in this order; every task in the `list-wheel` repository is prefixed):

- [x] `list-wheel:docker/Caddyfile`: new, the container's own server, `:80 { root * /srv;
      file_server; try_files {path} /index.html }` with a header comment saying this is not the
      `wheel.cuatro.dev` site block, which is in the shared Caddyfile on the box and reproduced in a
      trailing comment here for the record, so the image is self-describing and the record has a
      source.
- [x] `list-wheel:Dockerfile`: new, `FROM node:22-slim AS build`, `WORKDIR /app`, `COPY
      package.json package-lock.json ./`, `RUN npm ci`, `COPY . .`, `RUN npm run build`; `FROM
      caddy:2`, `COPY docker/Caddyfile /etc/caddy/Caddyfile`, `COPY --from=build
      /app/dist/list-wheel/browser /srv`. Comments in the Anchor's register: why the build needs
      egress (font inlining), why `caddy:2` (the ingress image, floating major like the estate).
- [x] `list-wheel:.dockerignore`: new, from `.gitignore:4,32` plus `.git`, `.vscode`,
      `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `*.md` except `README.md`.
- [x] `list-wheel:docker-compose.yml`: new, `name: list-wheel`; service `list-wheel` with
      `build: { context: ., dockerfile: Dockerfile }`, `networks: cs-tracker_default: aliases:
      [list-wheel]`, healthcheck `['CMD-SHELL', 'wget -q -O /dev/null http://127.0.0.1/ || exit 1']`
      at 15 s / 5 s / 5 / 30 s (busybox `wget` is in `caddy:2`; the server binds every interface,
      so loopback is right here and the Anchor's `HOSTNAME` note explains why it is not there),
      `restart: unless-stopped`; `networks: cs-tracker_default: external: true`. No `ports`, no
      `container_name`.
- [x] `list-wheel:.github/workflows/deploy.yml`: new, the Anchor's `deploy.yml` with: checkout of
      `LuigiEspinosa/cuatro-portfolio` at `main` into `cuatro-portfolio` (sparse `ops`), the gate
      step `node cuatro-portfolio/ops/capacity-gate.mjs list-wheel` before `appleboy/ssh-action@v1`
      with no `continue-on-error` and no `if:`, and the script `cd ~/list-wheel`, `git fetch origin
      main`, `git reset --hard origin/main`, `docker compose up --build -d --remove-orphans`.
- [x] `list-wheel:package.json`, `package-lock.json`: `npm uninstall angular-cli-ghpages`; delete
      the `deploy` script, since the workflow is the deploy now, and a script that republishes to Pages
      would undo the redirect.
- [x] `list-wheel:README.md:7,81`, `CHANGELOG.md`: the live URL, the deployment row (Docker, the
      shared Caddy on cuatro.dev's box, the workflow), and a `## [2026-09-13]` entry (Changed: hosting;
      Removed: the script and the dependency; the old URL redirects).
- [x] `list-wheel`: branch `2-25-relocate-onto-wheel-cuatro-dev`, one commit per coherent change,
      PR to `main` titled `2-25: relocate onto wheel.cuatro.dev`. If the local Docker daemon is up,
      `docker build -t list-wheel:local .` and `docker run --rm -p 8080:80 list-wheel:local` prove the
      image before the PR; otherwise the first build on the box is the proof and the spec says so.
- [x] `list-wheel` secrets: `gh secret set SERVER_HOST` (`177.7.52.248`) and `SERVER_USER`
      (`deploy`), both public facts in `ops/routing-inventory.md`; `SSH_PRIVATE_KEY` from the new
      ed25519 key the Spec Change Log entry of 2026-09-13 records (the Anchor's key could not be
      reused; the gitignored `.env` names the file as `LIST_WHEEL_DEPLOY_KEY_FILE`), via `cmd /c
      "gh secret set SSH_PRIVATE_KEY --repo LuigiEspinosa/list-wheel < <file>"`. Confirmed before
      each.
- [x] the box: `git clone https://github.com/LuigiEspinosa/list-wheel.git /home/deploy/list-wheel`
      (confirm first). Nothing else until the merge.
- [x] `list-wheel` PR merge: confirm, merge, watch the Deploy run: gate stdout quoted, SSH step
      green, `docker ps` shows `list-wheel-list-wheel-1` `(healthy)`, `uptime` and `docker stats
      --no-stream list-wheel-list-wheel-1` recorded for `ops/capacity-threshold.md`.
- [x] Cloudflare R1 and R3: confirm, `PATCH` each rule's expression to include
      `"wheel.cuatro.dev"`, read the ruleset back and quote both expressions.
- [x] the box: `cp Caddyfile Caddyfile.bak-2-25` in `/home/deploy/cs-tracker`; probe the six
      hostnames over loopback with `--resolve` and record the codes; append the block; `caddy
      validate`; `caddy reload`; re-probe the six and diff; probe `wheel.cuatro.dev` over loopback:
      200, title, headers. Confirm before the append.
- [x] Cloudflare DNS: confirm, create `A wheel 177.7.52.248 proxied`; from this host probe
      `https://wheel.cuatro.dev/` with a browser UA, `GPTBot`, an empty UA, `UptimeRobot` and the
      verification agent string; record the codes.
- [x] UptimeRobot: confirm, create the HTTP monitor for `https://wheel.cuatro.dev` with the
      record's settings; record its id and first status.
- [x] `contracts/registry.json:68,72`: `tech` to `["Angular", "TypeScript", "Docker", "Caddy"]`,
      `live` to `https://wheel.cuatro.dev`.
- [x] `ops/capacity-gate.yml`: append `  - id: list-wheel` / `    observed: 2026-09-13` /
      `    note: serving wheel.cuatro.dev`; header comment: two readers now, naming the second.
- [x] `ops/__tests__/capacity-gate.test.ts`: five ids and the title; probe id `cs-tournament` at
      `:126, 129, 233, 261`; one new case under `parseGate(committed)`: the `list-wheel` entry's
      `note` names the host of the Registry entry's `live` (read `contracts/registry.json`), seen
      failing with the note planted as `serving list-wheel.cuatro.dev`.
- [x] `ops/routing-inventory.md`, `ops/estate.md`, `ops/registry-inputs.md`, `ops/monitoring.md`,
      `ops/bot-mitigation.md`, `ops/known-violations.md`, `ops/capacity-threshold.md`,
      `ops/registry-verification.md`, `ops/contract-adoption.md`: every line the Code Map names,
      dated, with the observed values from the tasks above; the `## What Story 2-25 changed` table
      with UTC times.
- [x] `deferred-work.md`: the five entries the Code Map names, DW-90 and DW-91.
- [x] `corepack pnpm test --run`, `corepack pnpm typecheck`, `node ops/capacity-gate.mjs
      list-wheel` (now "is in placements"), then commit on a branch off `dev`, push, and watch the
      `registry-verification` push run: green, the `list-wheel live resolves` line quoted; record
      the run URL in `ops/registry-inputs.md` beside the entry in a second commit. PR to `dev`.
- [x] `list-wheel:gh-pages`: confirm, then replace the tree with `index.html`, an identical
      `404.html` (the redirect page of the matrix) and `.nojekyll`; push; probe the old URL for 200
      and the `meta refresh`; open it once in a browser and land on `wheel.cuatro.dev`.
- [ ] This spec's Verification and the sprint board (`review`), and the proposal to merge `dev` into
      `main` so the published Registry carries the new `live`.

**Acceptance Criteria:**

- Given `ops/capacity-gate.yml` at `status: open` and `list-wheel` absent from `placements`, when
  the `list-wheel` Deploy run executes, then its Capacity Gate step exits 0 with stdout naming
  `load15 0.60` and `list-wheel may be placed`, the SSH step runs only after it, and the run URL is
  in this spec and in `ops/capacity-threshold.md`; and given the gate re-read with `status:
  blocked`, when `node ops/capacity-gate.mjs list-wheel` runs against that copy, then it exits 1
  (the existing `BLOCKED` fixture cases already prove this; the story quotes one run of them).
- Given the checkout at `e589ef3`, when the build stage runs `npm run build`, then the output is
  `dist/list-wheel/browser` with `index.html`, `favicon.ico` and three hashed assets and nothing
  that needs a runtime, which the spec records as the confirmation PRD §15 asked for.
- Given the shared Caddy reloaded with the new block, when `https://wheel.cuatro.dev/` is requested
  through Cloudflare, then it answers 200 with the three headers and the application, the six
  incumbent hostnames answer the same codes as before the reload, and no `PathPrefix` or path
  routing exists for it anywhere.
- Given the flip has not happened, when `https://luigiespinosa.github.io/list-wheel/` is requested,
  then the application still serves; and given the new hostname verified, when the flip lands, then
  the old URL answers 200 with a page that carries the visitor to `https://wheel.cuatro.dev/`.
- Given the Registry commit, when it is pushed, then the `registry-verification` push run is green
  with `list-wheel live resolves: https://wheel.cuatro.dev 200`, and `corepack pnpm test --run` and
  `corepack pnpm typecheck` pass with the new case seen failing against its planted control.
- Given the records after the story, when the Operator reads `ops/routing-inventory.md`,
  `ops/monitoring.md`, `ops/bot-mitigation.md` and `ops/capacity-threshold.md`, then each states
  `wheel.cuatro.dev` with a dated Observed or Decision, and the AD-17b `Rules live on:` line names
  it.

## Spec Change Log

**2026-09-13, during implementation, Operator ruling.** The frozen Never line "No credential
created" assumed the Anchor's deploy key could be reused. It cannot: `ops/contract-serving.md:458-462`
records that its private half was deleted after being written to the Anchor's secret on 2026-08-27,
so it exists nowhere readable. The Operator instructed a new ed25519 pair for `list-wheel`,
generated at 17:24Z through `cmd /c ssh-keygen -N ""` (the 2026-08-27 procedure): the public half,
comment `github-actions-deploy@list-wheel`, fingerprint `SHA256:w24gXBJVlcbMOKWYk1Qr7LsFXD7TbPEumAkVYoreldI`,
appended to `/home/deploy/.ssh/authorized_keys` on the box (now three keys, backup
`authorized_keys.bak-2-25`); the private half set as `SSH_PRIVATE_KEY` on `LuigiEspinosa/list-wheel`
over byte-exact stdin. On a second Operator instruction the key file was kept rather than deleted,
and the gitignored `.env` names its location as `LIST_WHEEL_DEPLOY_KEY_FILE`, so the secret can be
re-set without a new key. One key per consumer, so `authorized_keys` names each. KEEP: the frozen
line stands for everything else in the story.

**2026-09-13, review pass.** Applied: the container's Caddyfile in `list-wheel` sends
`Cache-Control: no-cache` on the shell, so a browser revalidates `index.html` and picks up a new
bundle hash on the next deploy; `.dockerignore` trimmed; the `gh-pages` line-ending finding
dissolved on inspection (the CR bytes were in the working file only: `git add` under
`core.autocrlf=true` stored both blobs as LF, `git cat-file -p origin/gh-pages:index.html` has no
CR byte and neither does the served page, so no second commit exists); `ops/__tests__/capacity-gate.test.ts`'s
note case generalised over
every placement whose Registry entry has a `live`, anchored at the end of the note, reading the
typed `applications` array; the record corrections in `ops/estate.md`, `ops/registry-inputs.md`,
`ops/routing-inventory.md`, `ops/known-violations.md`, `ops/monitoring.md` and `deferred-work.md`
(tense on the `gh-pages` flip, the Story 2-25 table rows, the KV-1 hostname count and citation,
the unmonitored old URL, the no-`AAAA` group, the two placeholder times above, the key task line
and the key path); DW-93 (the deploy trigger and concurrency policy now duplicated in two
repositories) and DW-94 (both deploy keys unrestricted in `authorized_keys`) filed. Rejected:
shrinking the comments in the `list-wheel` files, because the Anchor's register was mirrored on
purpose and a second register is a second shape; a soft-404 handler for missing assets, because
bundle hashes are unique per build and the shell is now revalidated, so a stale reference
resolves on the next load; the verification-gap headline that `list-wheel` deploys with no test
in CI, because DW-90 already files it. KEEP: the placement order (the block before the record, the
record before the Registry push, the push before the flip); the gate read from `main`; `try_files`
as the Pages-equivalent fallback.

## Design Notes

**Why the build is on the box and not in CI.** AD-8 is the target and the Anchor's own deploy is
its recorded standing violation, closed by Epic 3 in a fixed order; placing a new application by the
same mechanism widens a known breach by one small, rare compile (`list-wheel` changed three times
in 2026) rather than opening a second deploy shape the estate would carry until Epic 4 rewrote it.
The GHCR path was offered and the Operator chose the mirror on 2026-09-13. KV-1 records it.

**Why the gate is read from `main`.** That is the published gate. It is `open`, so a new id passes
before its `placements` entry exists, which is the order the story's first AC states ("once
placed"). The cost is DW-91: until the epic merges, a re-block would refuse `list-wheel` as new.

**Why `try_files` on a site with no routes.** Pages serves `404.html`, a byte-identical copy of
`index.html`, for every unknown path today. The relocation changes where the bytes come from and
nothing else (AD-20), so the fallback stays. One line.

**Why the redirect is a page.** A Pages project site has no server-side redirect; `meta refresh`
plus a script that carries search and hash is what the platform offers, and the page keeps a
canonical link and a plain anchor for a client that follows neither.

**Skipped: a test in `list-wheel` for the three gate-wiring rules.** The repository has no CI to run
it under; DW-90 files that. Add it when a CI job exists there.

**Rollback.** The old build is `gh-pages` `b9ee2b8`: `git revert 52698eb` on that branch restores
it and Pages rebuilds within a minute. The Registry `live` and `tech` revert is one commit here. The
box keeps serving through both. The site block and the DNS record can stay, since an unreachable
container behind a Caddy block answers 502 for that hostname only.

## Verification

**Commands:**

- `corepack pnpm test --run`: expected all files pass, `capacity-gate.test.ts` among them with
  the five-id pin and the new note case.
- `corepack pnpm typecheck`: expected exit 0.
- `node ops/capacity-gate.mjs list-wheel`: expected before the placements edit exit 0, `may be
  placed`; after: exit 0, `is in placements`.
- `node ops/capacity-gate.mjs cs-tournament`: expected exit 0 naming the threshold (the new-id
  path still measured).
- `gh run list --repo LuigiEspinosa/list-wheel --workflow Deploy` and `gh run view <id> --log`:
  expected the gate step's stdout line, then the SSH step green.
- On the box: `docker ps --filter name=list-wheel`, `docker stats --no-stream`, `uptime`:
  expected `(healthy)`, a footprint in the low tens of MB, load15 recorded.
- `curl -sI https://wheel.cuatro.dev/`, and the same with `-A GPTBot`, `-A ''`, `-A UptimeRobot/2.0`,
  `-A 'cuatro-registry-verification/1 (+https://cuatro.dev/contracts/registry.json)'`: expected
  200, 403, challenge, 200, 200.
- `gh run list --workflow registry-verification.yml` after the push: expected green.
- `curl -s https://luigiespinosa.github.io/list-wheel/ | grep -c 'wheel.cuatro.dev'` after the flip:
  expected at least 3 (meta, canonical, anchor).

**Manual checks:**

- One ordinary browser visit to `https://wheel.cuatro.dev/`: the wheel renders, the fonts load, a
  spin works, no console error; the old URL lands on the new one after the flip.
- The six incumbent hostnames' status codes before and after the reload, diffed by hand, in
  `ops/routing-inventory.md`'s new section.

**Observed 2026-09-13, the placement, by the orchestrating session.** Every value the records
state comes from here; times are UTC.

- **`list-wheel` repository.** Branch `2-25-relocate-onto-wheel-cuatro-dev` off `main` `e589ef3`,
  four commits (`7d40b57` image and compose, `4155be6` deploy workflow, `f7130a5` script and
  dependency removed, `1771a00` README and CHANGELOG). Local proof with the Docker daemon up
  (29.7.2): `docker build` exit 0, output hashes `main-3S57BQZJ.js`, `polyfills-5CFQRCPP.js`,
  `styles-VFKBVUT4.css` identical to `gh-pages`; `/srv` holds exactly `index.html`, `favicon.ico`
  and those three, nothing that needs a runtime (AC 2 confirmed from the build); `GET /` and
  `GET /no/such/route` both 200 with the 11,619-byte `index.html`; `caddy validate` exit 0. PR
  `LuigiEspinosa/list-wheel#2` opened 16:50:34Z, merged by the Operator at 17:30:56Z as `11f15cb`.
- **Secrets on `list-wheel`.** `SERVER_HOST` 17:02:09Z, `SERVER_USER` 17:02:10Z, `SSH_PRIVATE_KEY`
  17:24:59Z (the new key of the Spec Change Log). `/home/deploy/.ssh/authorized_keys` on the box:
  three keys (`luigi@cuatro.dev`, `github-actions-deploy@cuatro-portfolio`,
  `github-actions-deploy@list-wheel` SHA256:w24gXBJVlcbMOKWYk1Qr7LsFXD7TbPEumAkVYoreldI), backup
  `authorized_keys.bak-2-25` with the previous two, written 17:29Z.
- **Clone on the box.** `/home/deploy/list-wheel` from `https://github.com/LuigiEspinosa/list-wheel.git`
  at 17:02Z, at `e589ef3`; reset to `11f15cb` by the deploy.
- **The placement (AC 1).** Deploy run 34771823648,
  `https://github.com/LuigiEspinosa/list-wheel/actions/runs/34771823648`, created 17:30:59Z,
  conclusion success, steps `actions/checkout@v7` (sparse `ops` of `cuatro-portfolio` at `main`),
  `actions/setup-node@v7`, `Capacity Gate`, `Deploy over SSH to SERVER_HOST`, all success. Gate
  stdout at 17:31:05Z: `capacity gate: status is open against a threshold of load15 0.60 on 2 vCPU,
  derived in ops/capacity-threshold.md from the week to 2026-08-25T00:33:34Z, list-wheel may be
  placed`. SSH step 17:31:05Z to 17:31:32Z (27 s): `npm ci` 18.6 s, `npm run build` 6.3 s, image
  `list-wheel-list-wheel:latest` 88.7 MB, container `list-wheel-list-wheel-1` started 17:31:32Z.
- **Footprint on the box.** At 17:32:05Z: container `Up 31 seconds (healthy)`, `docker stats`
  0.00% CPU, 10.4 MiB RSS; `uptime` load 0.43, 0.23, 0.14 (before the run at 16:19Z: 0.09, 0.09,
  0.09; the 0.43 is the build's one-minute tail). Network `cs-tracker_default`, address
  172.18.0.10, aliases `list-wheel-list-wheel-1` and `list-wheel`; no published port (`80/tcp`
  and the Caddy image's `443/tcp, 2019/tcp, 443/udp` are `EXPOSE`, unmapped).
  `docker exec cs-tracker-caddy-1 wget http://list-wheel:80/` 200, 11,619 bytes. Box: Docker
  29.6.2, Compose v5.3.1, 78 GB free, 5.6 GB available.
- **WAF, before DNS.** Ruleset `57602610aea04496a2f8ed13ec584b6c` version 4, `last_updated`
  17:31:31Z: R1 `http.host in {"cuatro.dev" "www.cuatro.dev" "analytics.cuatro.dev"
  "cs-tracker.cuatro.dev" "tracker.cuatro.dev" "library.cuatro.dev" "wheel.cuatro.dev"}`, R3
  `http.host in {"cuatro.dev" "www.cuatro.dev" "cs-tracker.cuatro.dev" "tracker.cuatro.dev"
  "library.cuatro.dev" "wheel.cuatro.dev"}`; R2 (`http.host ne "analytics.cuatro.dev"`) and R4
  unchanged, order unchanged, read back after the two `PATCH` calls.
- **The site block.** `/home/deploy/cs-tracker/Caddyfile` backed up as `Caddyfile.bak-2-25`
  (3,663 bytes, `cmp` identical) before the append; the block appended after the Anchor's three,
  under `# --- list-wheel: wheel.cuatro.dev. Story 2-25. ---` and three comment lines, exactly the
  block in `list-wheel:docker/Caddyfile`'s trailing comment; `caddy validate` `Valid
  configuration`; `caddy reload` at 17:36:54Z exit 0; the loaded config lists
  `"wheel.cuatro.dev"`. Seven site blocks now. Incumbents over loopback (`--resolve` to
  127.0.0.1, `-k`) before and after, identical: `cuatro.dev` 200, `www.cuatro.dev` 301,
  `analytics.cuatro.dev` 200 (the challenge is at the edge, so 200 at origin), `cs-tracker.cuatro.dev`
  302, `tracker.cuatro.dev` 307, `library.cuatro.dev` 302. `wheel.cuatro.dev` over loopback
  before the block: 200 with 0 bytes (Caddy's empty answer for an unmatched host, which is why the
  block precedes the record); after: `HTTP/2 200`, 11,619 bytes, `referrer-policy:
  strict-origin-when-cross-origin`, `x-content-type-options: nosniff`, `x-frame-options: DENY`,
  `server: Caddy`, `<title>Cuatro Wheel</title>`, `<base href="/">`, `main-3S57BQZJ.js`;
  `/no/such/path` 200 with the same 11,619 bytes.
- **DNS.** `A wheel.cuatro.dev 177.7.52.248`, proxied, TTL auto, id
  `78b65a274cd071446893928b554e3c18`, created 17:37:10Z, comment `list-wheel, Story 2-25,
  2026-09-13`. Zone now 26 records, seven `A`, three `AAAA`, every `A` and `AAAA` proxied.
  Resolves to the edge (`172.67.181.184`, `2606:4700:3037::ac43:b5b8`, `2606:4700:3035::6815:2ba5`).
- **Through Cloudflare, 17:37Z to 17:38Z.** Browser UA 200; `GPTBot` 403; empty UA 403 with
  `cf-mitigated: challenge`; `UptimeRobot/2.0` 200; `cuatro-registry-verification/1
  (+https://cuatro.dev/contracts/registry.json)` 200; `Googlebot` 200. Headers on the 200:
  `Content-Type: text/html; charset=utf-8`, the three origin headers intact, `Server: cloudflare`,
  `CF-RAY a3a8ec031b44437d-MIA`, 11,619 bytes. Assets: `main-3S57BQZJ.js` 200 165,968 B,
  `polyfills-5CFQRCPP.js` 200 34,585 B, `styles-VFKBVUT4.css` 200 1,615 B. Edge certificate
  `C=US, O=Google Trust Services, CN=WE1`, notBefore 2026-08-21T00:18:46Z, notAfter
  2026-11-19T01:16:34Z.
- **UptimeRobot.** Monitor 803983277 `wheel.cuatro.dev`, `https://wheel.cuatro.dev`, HTTP,
  interval 300 s, timeout 30 s, `checkSSLErrors` true, `followRedirections` true, success `2xx`
  and `3xx`, SSL and domain reminders off, alert contact 8726805, created 17:38:14Z, first check
  UP. All seven active monitors UP afterwards (803749849, 803750016, 803750023, 803750025,
  803756083, 803756371, 803983277); 803750027 paused as before.
- **Not yet done at this point:** the `cuatro-portfolio` changes, the Registry push and its
  verification run, the `gh-pages` flip, the browser visit.

**Observed 2026-09-13, after the placement, by the orchestrating session.**

- **This repository.** Branch `2-25-relocate-list-wheel` off `dev` `e2d4fa1`: `f0eeda1` (Registry,
  gate, suite), `da9c743` (nine records), `8a68f59` (ledger, spec, board), `6b61196` (the push run
  recorded). Build session's suite run over the first three: `corepack pnpm test --run` `Test Files
  53 passed (53)`, `Tests 1298 passed (1298)`, 100.37 s; `corepack pnpm typecheck` exit 0; `node
  ops/capacity-gate.mjs list-wheel` `capacity gate: list-wheel is in placements, the deploy may
  proceed`; `node ops/capacity-gate.mjs cs-tournament` the open-gate line naming `load15 0.60`.
  Planted control: the placement note as `serving list-wheel.cuatro.dev` failed exactly `notes the
  host the Registry says list-wheel is live on` (`expected 'serving wheel.cuatro.dev'`), then 81
  passed again with the note restored. After `6b61196`: `ops/__tests__/registry-verification.test.ts`
  and `contract-adoption.test.ts` `2 passed (2)`, `85 passed (85)`. CI run 34773443362 on `8a68f59`:
  six jobs green (`contract-purity`, `tokens-contract`, `rendered-output`, `registry-schema`,
  `fonts-contract`, `test`).
- **The refusal (AC 1, second clause), observed 2026-09-13 by the orchestrating session.** Against
  a copy of the committed gate with `status: blocked` and nothing else changed, in a temporary
  directory beside a copy of the checker (the `runAgainst` shape): `node capacity-gate.mjs
  cs-tournament` exit 1, on stderr `capacity gate: REFUSED` / `ops/capacity-gate.yml has status:
  blocked, and placements does not list "cs-tournament".` / `Unproven capacity fails closed
  (AD-9)...` / `Ids that pass today: cuatro-portfolio, cs-tracker, cuatro-tracker, digital-library,
  list-wheel`; against the same blocked copy `node capacity-gate.mjs list-wheel` exit 0, on stdout
  `capacity gate: list-wheel is in placements, the deploy may proceed`. So a re-block refuses the
  next new id and keeps admitting the placed one, which is the AD-9 shape the AC asks to see run.
- **The Registry push run (AC 5).** Pushing the branch at 18:03Z fired `registry-verification` run
  34773443302 (`push`, no branch filter): success, `PASS  list-wheel live: https://wheel.cuatro.dev
  answered 200`, the other five `live` codes unchanged (200, 307, 302, 302, 200), `# 35 of 35 checks
  passed`, runner `2.337.0` on `ubuntu-24.04`. Recorded in `ops/registry-inputs.md` beside the entry
  and as run 3 in `ops/registry-verification.md` § Observed runs.
- **The `gh-pages` flip (AC 4, second half).** With the Operator's go: `gh-pages` `52698eb` on
  `b9ee2b8`, `docs: redirect the GitHub Pages URL to wheel.cuatro.dev`, three files (`index.html`,
  byte-identical `404.html`, `.nojekyll`), committed 18:25:47Z; Pages build `built` at that commit.
  `https://luigiespinosa.github.io/list-wheel/?q=1` 200, `text/html`, `Cache-Control: max-age=600`,
  five occurrences of `wheel.cuatro.dev` (meta refresh, canonical, anchor href and text, script);
  `/list-wheel/some/deep/path` 404 status with the same redirect body (Pages' custom-404
  semantics, the status it already gave with the app body); `/list-wheel/main-3S57BQZJ.js` 404.
  The working file the page was written from carried CR bytes; `git add` under `core.autocrlf=true`
  stored both blobs as LF (verified after review: `git cat-file -p origin/gh-pages:index.html` and
  the served page carry none).
- **The browser (manual check).** Chrome through the extension: `https://luigiespinosa.github.io/list-wheel/?from=pages#top`
  landed on `https://wheel.cuatro.dev/?from=pages#top` within 3 s (query and hash carried); the
  wheel renders, title `Cuatro Wheel`, the Rubik face loaded (`fonts.gstatic.com/s/rubik/v31/...woff2`
  200), `main-3S57BQZJ.js`, `polyfills-5CFQRCPP.js`, `styles-VFKBVUT4.css` 200; no console message
  of any level on a reload with tracking on. **Not performed:** a spin, which needs a `.txt` through
  the File System Access picker, a native dialog the extension cannot drive; one click for the
  Operator.
- **Found, not this story's:** for browser requests (`Accept: text/html`), the Cloudflare edge
  injects `<script defer src="https://static.cloudflareinsights.com/beacon.min.js/...">` and the
  page posts to `/cdn-cgi/rum`: Cloudflare Web Analytics, zone-wide. Seen on `cuatro.dev`,
  `tracker.cuatro.dev`, `library.cuatro.dev` and now `wheel.cuatro.dev`; absent from the origin
  response over loopback; absent from every `ops/` record. It predates this story and touches
  NFR-8's letter. Filed as DW-92; the Operator rules.

**Observed 2026-09-13, after the review patch, by the orchestrating session.** `list-wheel#3`
merged by the Operator at 19:10:26Z as `00f5957`; Deploy run 34776876533 success, gate stdout at
19:10:38Z the new-id line again (the `placements` entry is on this branch, not on `main`: DW-91),
`npm ci` from the layer cache, `npm run build` 6.8 s, container recreated by 19:10:47Z. Through
the edge at 19:12Z: `/`, `/index.html`, `/no/such/path` 200 with `Cache-Control: no-cache`;
`main-3S57BQZJ.js` and `styles-VFKBVUT4.css` 200 with the edge's `max-age=14400`. A conditional
`GET /` answers 200, not 304: the edge strips the shell's `ETag` when it injects the DW-92 beacon,
so revalidation costs the full 11,619 bytes; the origin's own 304 was seen in the local proof.
Recorded in `ops/routing-inventory.md` § What Story 2-25 changed.

**Matrix Test Audit.** Rows with a standing test that ran green in the runs above: first placement
(`capacity-gate.test.ts`, the open-gate new-id cases on `cs-tournament`, the same code path the
Deploy run took), redeploy after the placement lands (the five-id pin and the incumbent path),
redeploy under a re-blocked gate (`BLOCKED` fixture cases refusing `list-wheel`), registry push run
(`registry-verification.test.ts` plants every committed `live` at 200, and the real run 34773443302).
Rows that are operations on systems no unit test can reach, each verified once by the observation
named beside it and by nothing standing: Caddy validate fails and reload changes an incumbent (the
restore path in the append script, exercised by inspection only: validate passed and the six codes
matched, so neither branch ran), loopback probe before DNS, browser UA, `GPTBot`, empty UA,
`UptimeRobot`, verification agent, unknown path (local Docker proof and loopback), old URL after
the flip, old URL sub-path. The audit is stated rather than satisfied by a test for those rows;
the record that carries them is `ops/routing-inventory.md` § What Story 2-25 changed.

## Suggested Review Order

**The placement, the estate's first new id through the gate**

- Start here: the second caller of the gate, reading the published gate at `main` and naming a new id.
  [`deploy.yml:21`](../../../../Development/list-wheel-workspace/list-wheel/.github/workflows/deploy.yml#L21)

- The gate step, blocking, before the SSH step: the shape the Anchor's own suite pins for its workflow.
  [`deploy.yml:43`](../../../../Development/list-wheel-workspace/list-wheel/.github/workflows/deploy.yml#L43)

- The build on the box, a knowing second AD-8 breach, chosen over GHCR on 2026-09-13.
  [`deploy.yml:71`](../../../../Development/list-wheel-workspace/list-wheel/.github/workflows/deploy.yml#L71)

- The placement logged after the fact, the order AC 1 states.
  [`capacity-gate.yml:81`](../../ops/capacity-gate.yml#L81)

- Two readers now, named in the file that is a contract rather than prose.
  [`capacity-gate.yml:5`](../../ops/capacity-gate.yml#L5)

**The image and the container**

- Node builds, Caddy serves, nothing else in the served image; egress for font inlining stated.
  [`Dockerfile:13`](../../../../Development/list-wheel-workspace/list-wheel/Dockerfile#L13)

- The container's own `:80` server, not the public block; `try_files` keeps Pages' custom-404 behaviour.
  [`Caddyfile:24`](../../../../Development/list-wheel-workspace/list-wheel/docker/Caddyfile#L24)

- After review: the shell revalidated on every visit, inside `route` so the fallback gets it too.
  [`Caddyfile:29`](../../../../Development/list-wheel-workspace/list-wheel/docker/Caddyfile#L29)

- Service and alias are the Registry id; no port, no TLS, a real healthcheck, the external network.
  [`docker-compose.yml:23`](../../../../Development/list-wheel-workspace/list-wheel/docker-compose.yml#L23)

**The hostname**

- The Host-matched router, verbatim in the estate's shape, as appended to the shared Caddyfile.
  [`routing-inventory.md:628`](../../ops/routing-inventory.md#L628)

- What was done, where and when, in the order that kept every step serving.
  [`routing-inventory.md:1693`](../../ops/routing-inventory.md#L1693)

- The one status the move changed, and the rollback.
  [`routing-inventory.md:1714`](../../ops/routing-inventory.md#L1714)

- WAF rules widened before the record existed, then proved by request.
  [`bot-mitigation.md:147`](../../ops/bot-mitigation.md#L147)

- The monitor added in the same change, per the record's own rule.
  [`monitoring.md:215`](../../ops/monitoring.md#L215)

**The Registry**

- The two values: `live` on the suite's domain, `tech` honest about what serves it.
  [`registry.json:68`](../../contracts/registry.json#L68)

- The 2.23 job confirming the new `live`, on the push, before any merge.
  [`registry-verification.md:214`](../../ops/registry-verification.md#L214)

- The hostname section resolved, one story later than the epic's wording.
  [`registry-inputs.md:258`](../../ops/registry-inputs.md#L258)

**What the story admits**

- KV-1 widened: the second offending line, the ruling and its closer.
  [`known-violations.md:100`](../../ops/known-violations.md#L100)

- The measured cost of the build and the container, against the charge the threshold reserved.
  [`capacity-threshold.md:117`](../../ops/capacity-threshold.md#L117)

- DW-90 to DW-94: no CI in `list-wheel`, the `placements` window, the edge beacon, duplicated deploy policy, unrestricted keys.
  [`deferred-work.md:4408`](deferred-work.md#L4408)

**The suite**

- Every placement's note held to the host its Registry entry is live on, anchored at the end.
  [`capacity-gate.test.ts:177`](../../ops/__tests__/capacity-gate.test.ts#L177)

- Five ids on the box.
  [`capacity-gate.test.ts:159`](../../ops/__tests__/capacity-gate.test.ts#L159)

**Peripherals**

- The estate record's row and its dated amendment.
  [`estate.md:146`](../../ops/estate.md#L146)

- The redirect that keeps the old link alive, on the generated branch.
  [`list-wheel gh-pages 52698eb`](https://github.com/LuigiEspinosa/list-wheel/commit/52698eb)