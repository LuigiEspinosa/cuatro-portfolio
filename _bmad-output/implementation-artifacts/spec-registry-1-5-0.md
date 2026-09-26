---
title: 'Registry 1.5.0: covidmap and future-vizion listed as Live, KV-3 retired by membership, and every count that moves moved'
type: 'feature'
created: '2026-09-25'
status: 'done'
route: 'dispatch'
baseline_commit: 'ebe9a397d02fedaf77d4c7942ccfc9692a598c93'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** `covidmap.cuatro.dev` and `future-vizion.cuatro.dev` serve from Vercel on the estate's
domain and sit outside the Registry, which is KV-3's breach of AD-6, left standing on 2026-09-25 when
the Operator kept both live. Operator ruling 2026-09-25 reverses the 2026-09-02 exclusion: list both.

**Approach:** Two `Live` entries in `contracts/registry.json` at `1.5.0` (a value change is a minor),
with `tech` read from each repository and both left exactly where they serve. KV-3 retires by
membership; the Estate, the waypoint, the adoption record, the Directory's derived counts and every
pin that reads them move to observed values, each moved pin seen red first. What serving two `Live`
members from Vercel breaches is recorded as a new known violation, not fixed and not hidden.

## Boundaries & Constraints

**Always:**
- Every changed count or behaviour has a test that fails without the change, seen failing. Final tree
  green on typecheck, the whole unit suite, the literal gate, the build, `node ops/registry-schema.mjs`,
  the local Registry verification, the unfiltered container e2e run and a local Lighthouse reading of
  `/` at accessibility 0.95 or more.
- Records take the UTC date and cite "Operator ruling 2026-09-25"; dated history stays as written and
  gets dated amendments. No em-dash, en-dash, double-dash standing in for a dash, or emoji.
- Values are observed and say how: `gh api`, `curl`, `nslookup`, each dated.

**Never:**
- No DNS, Vercel, Cloudflare, UptimeRobot or GitHub setting changed; no other repository touched; no
  push, pull request, rebase or force-push; no SSH.
- No edit to the architecture spine, the schema, the gate's rules, the premise copy, or the frozen
  `ops/registry-inputs.md`; no pin loosened; no test pinning an entry's field values.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Registry gate | final tree | exit 0 at `1.5.0`, 16 applications | N/A |
| Verification, planted and real | committed Registry | 40 checks: 16 exists, 16 resolves (13 by 200, 3 tolerated), 7 live (4 by 200, 3 by 3xx), 1 token | one failing source reads `39 of 40` |
| `/` | final build | `Sixteen personal projects`, `7 running`, eight rows, footer `Eight applications` | a rendered entry with an address that is not `Live` still fails the premise case |
| Waypoint parse | `ops/estate.md` | 13 names, both adoption tables held equal to them | 11 or 12 names fail naming the pinned 13 |

</frozen-after-approval>

## Code Map

- `contracts/registry.json`: the two entries after `list-wheel` (file order is render order within a
  status), `contract_version`. Read by `lib/registry.ts` and `ops/registry-verification.mjs`.
- `ops/__tests__/registry-schema.test.ts:244-270`: the `1.4.0` pin.
- `ops/__tests__/registry-verification.test.ts:229-345`: 34 checks, `main` line counts.
- `lib/__tests__/registry.test.ts:536-554` and `components/organisms/Premise/Premise.tsx:38-44`: the
  band's "one framework on no rendered row" measurement; Vue now renders on `covidmap`.
- `ops/contract-adoption.mjs:4,17,26-30,202,223` and `ops/__tests__/contract-adoption.test.ts`: the
  waypoint pin 11 and its sentence; `ops/contract-adoption.md` § The adopted versions and § The estate,
  observed, one row per waypoint repository.
- `tests/e2e/hit-target-floor.pw.ts:137-143` held to `ops/hit-target-floor.md:98` by
  `ops/__tests__/hit-target-floor.test.ts`: `/` found 17.
- Derived, no pin: `Premise.tsx` (`applications.length`), `SuiteDirectory.tsx:190` (`Live` rows),
  `SiteFooter.tsx` (`renderedApplications`), `CvIntro.tsx`.
- Records: `ops/known-violations.md` KV-3, index, action 6; `ops/estate.md` § Counts, waypoint, the
  disposition table, § The Vercel decommission rows 1 and 2; `ops/routing-inventory.md:488-510,551,1824,1912`;
  `ops/monitoring.md` § What is probed; `ops/bot-mitigation.md`; `ops/registry-verification.md:53,59`;
  `ops/registry-schema.md:658`; `ops/hub-accessibility-pass.md:94`; `AGENTS.md:185`;
  `EXPERIENCE.md:274-295`; ledger DW-246 and new entries from DW-248.
- Evidence, observed 2026-09-25: `covidmap` public, `master` at `3438d1d`, `package.json` Nuxt 3 with
  `@nuxtjs/tailwindcss`, `.vue` components, amCharts 4 loaded by `components/Chart/index.vue`, NewsAPI
  proxied by `server/api/news.js`; `future-vizion` public, `main` at `360f9f1`, one `index.html`, CSS,
  jQuery 1.11.3, README's stack table "Deploy: Vercel". Both answer 200 with `Server: Vercel` and
  resolve to `64.29.17.1` and `216.198.79.1`, not through Cloudflare.

## Tasks & Acceptance

**Execution:**
- [x] Tests first, red on the baseline: version pin, verification counts, the band case, the waypoint
  pin; the `/` hit-target pin from the container's own failure output.
- [x] `contracts/registry.json`: both entries and `1.5.0`.
- [x] `ops/contract-adoption.mjs`, `ops/estate.md`, `ops/contract-adoption.md`: 13 at the waypoint,
  both repositories swept by the record's own `gh api` method.
- [x] Records per Code Map: KV-3 retired, KV-7 opened, amendments dated, ledger filed (nothing open to close).
- [x] Verify per § Verification.

**Acceptance Criteria:**
- Given the baseline tree, when the moved cases run, then each fails for the reason it names.
- Given the final tree, when `node ops/registry-verification.mjs` runs locally with a token, then it
  prints `# 40 of 40 checks passed`.
- Given `ops/known-violations.md`, when a reader opens KV-3, then it is `Retired` 2026-09-26 (the UTC day of the commit) on Operator ruling 2026-09-25,
  and says the 2026-09-02 exclusion was reversed.

## Implementation Notes

- **No subagent could be spawned in this session**, so implementation and the review layers ran
  inline, as the Operator's authorisation of a sub-agent reviewer allows (the precedent is
  `spec-registry-1-2-0.md`).
- **The UTC day turned during the run.** Observations before 2026-09-26T00:00Z (the first `gh api`,
  `curl` and local verification readings) are 2026-09-25; the sweep and every record amendment are
  2026-09-26, and KV-3's `Retired on` is 2026-09-26, the day of the commit. The ruling is cited as
  Operator ruling 2026-09-25 throughout.
- **Red first, observed.** With the four suites moved and the Registry at `1.4.0`:
  `corepack pnpm vitest --run` over `registry-schema`, `registry-verification`, `registry` and
  `contract-adoption` failed 11 of 264, each on its named value (`'1.4.0'` to be `'1.5.0'`, 34 rows
  to be 40, `[ 'Vue' ]` to equal `[]`, 11 to be 13, the missing-list naming `covidmap` and
  `future-vizion`). The `/` hit-target pin failed in the pinned container against 17 with the new
  Registry, printing `/: found 21, skipped 0, measured 21`, and moved to that.
- **Files.** `contracts/registry.json`; pins in `ops/__tests__/registry-schema.test.ts`,
  `ops/__tests__/registry-verification.test.ts`, `lib/__tests__/registry.test.ts`,
  `ops/__tests__/contract-adoption.test.ts`, `ops/contract-adoption.mjs`,
  `tests/e2e/hit-target-floor.pw.ts`; comments in `Premise.tsx` and `SuiteDirectory.tsx`; records in
  `ops/estate.md`, `ops/known-violations.md` (KV-3 retired, KV-7, action 10), `ops/contract-adoption.md`,
  `ops/routing-inventory.md`, `ops/monitoring.md` (action 7), `ops/bot-mitigation.md`,
  `ops/registry-verification.md`, `ops/registry-schema.md`, `ops/hit-target-floor.md`,
  `ops/hub-accessibility-pass.md`, `AGENTS.md`, `EXPERIENCE.md`; ledger DW-246 noted, DW-248 to DW-250
  filed.
- **Nothing in the ledger closes.** The entries about these two applications (DW-145, DW-146) were
  closed on 2026-09-25 against the exclusion; they are dated history and stay as written.

## Spec Change Log

## Review Triage Log

Review, 2026-09-26, loop 0, the six layers inline (no subagent available).

| Layer | Finding | Verdict | Evidence and route |
|---|---|---|---|
| Blind | `future-vizion`'s description said "his prints", a gendered reading of a page that names the photographer and never states it | low | Real, and a direct correction: patched to "how to order a print", which is what the page's FAQ covers. Gate green after |
| Blind | The spec's Code Map, Tasks and Verification used a spaced double hyphen as a separator, which the house rule forbids | low | Real; patched to colons outside the frozen block |
| Blind | KV-3's "why exclusion needs a retirement" row still argues that retirement was the one honest resolution | false | It is the 2026-09-02 reasoning; the new § Retired 2026-09-26 by membership and the Status cell say what superseded it, which is the file's no-deletion rule |
| Edge | Two more rows at 360 px could push an element past an edge (KV-5) | false | The unfiltered container run reported `0 element(s) of any kind past an edge` on every surface |
| Edge | `SM-7` is exceeded at 13 and nothing flags it | medium | Real, and not this package's to decide: recorded in `ops/estate.md` and deferred as DW-249 to the Operator |
| Edge | FR-31: the two `Live` hosts are unmonitored | medium | Real; a console act outside the package's permissions. Deferred as DW-248 with `ops/monitoring.md` action 7 |
| Verification gap | The workflow run on a push is not observed | maybe-false | Nothing was pushed (the run's own instruction); the local run read 40 of 40, and the push run is an Operator action |
| Verification gap | Premise, Directory count and footer have no new pin | false | Each is derived from the Registry and already held by derivation cases; the served build was read and shows `Sixteen personal projects`, `7 running` and `Eight applications` |
| Ponytail | | | Lean already: data, pins and records, no code added |
| ECC loop | | | Build, types and the full unit suite pass as § Verification records; lint N/A (no lint command, see AGENTS.md) |
| Design | | | No UI surface in this diff: the two `.tsx` changes are comments; the new rows reuse the Directory unchanged |

## Design Notes

Assumptions, resolved unattended from the ruling, then the design documents:

1. **Split or Keep.** The spec is over the 1600-token budget (about 1,900 by a four-characters-a-token
   count). The orchestrating workflow relayed **Keep** for this spec; it is one Registry change and
   its consequences, and no part ships alone.
2. **Values.** `covidmap`: name `Covidmap` (its README heading), `tech` `Nuxt, Vue, Tailwind CSS,
   amCharts, Vercel`. `future-vizion`: name `Future Vizion` (its README heading), `tech` `HTML, CSS,
   JavaScript, jQuery, Vercel`. `Vercel` is named because `tech` is what an application runs on today
   and `cs-tournament` carried it while it ran there. Both `demo: open`, `identity: none`, no family,
   no token contract. Placed after `list-wheel`.
3. **KV-7, not an architecture edit.** Both hostnames are DNS-only CNAMEs to Vercel, so AD-26 (every
   live `cuatro.dev` hostname proxied, Full strict) and AD-17b (bot mitigation on every live
   subdomain) do not hold for two `Live` members. Ruled tolerated by the keep-live decision; retired by
   nothing unless a ruling moves or retires them. FR-31 (every `Live` application monitored) is not
   admitted: no ruling tolerates it and two monitors close it, so it is an Operator action and DW-248.
4. **The ruling differs from records**: the 2026-09-24 ruling that Vercel leaves the estate, SM-7's
   MVP ceiling of 12 (the waypoint becomes 13) and SM-C2 (entries not added to fill the grid). The
   ruling wins; each difference is recorded where it binds and SM-7 is filed for the Operator.
5. **The band case** now pins the observed state, every framework on a rendered row, with the
   Premise docblock rewritten so the `aria-hidden` argument still rests on FR-4 alone.

## Verification

**Commands:**
- `corepack pnpm typecheck`; `corepack pnpm test --run`; `node ops/literal-conformance.mjs`;
  `node ops/registry-schema.mjs`; `corepack pnpm build`: each exit 0.
- `node ops/registry-verification.mjs` with `REGISTRY_VERIFICATION_TOKEN` from `gh auth token`:
  `# 40 of 40 checks passed`.
- The pinned container `pnpm test:e2e`, no filter: every case passes, no snapshot written.
- Lighthouse in the pinned image per `ops/hub-accessibility-pass.md`: `lhci assert` green, `/`
  accessibility at least 0.95.

**As run, 2026-09-26, on `bc128bc` plus the records in the docs commit:**
- `corepack pnpm typecheck` exit 0; `node ops/literal-conformance.mjs` exit 0; `node ops/registry-schema.mjs`
  exit 0 at 16 applications.
- `corepack pnpm test --run`: 63 files, 1,642 passed (1,634 before plus the eight committed-Registry
  cases that moved, no case added or removed).
- `node ops/registry-verification.mjs`, token from `gh auth token` for the run and printed nowhere, at
  00:31Z: `# 40 of 40 checks passed`.
- `corepack pnpm build` exit 0, build `SJM-8B0xLoCUVW8TuaIxx`, `public/contracts/registry.json` equal to
  the committed file. The served build read `Sixteen personal projects`, `7 running`, `Eight
  applications` on `/` and `The eight personal projects are in` on `/cv`.
- The pinned container, `pnpm test:e2e` with no filter: 343 passed, 0 failed, 7.5 minutes, exit 0, `/`
  at found 21, no snapshot written. An earlier run failed `contract-serving` alone because
  `contracts/registry.json` was edited (one description word) while it ran, so the served copy was the
  older build's; the final run was made with nothing edited.
- Lighthouse in the pinned image, `lhci assert` green: accessibility, best practices and SEO 1.00 on all
  nine runs of `/`, `/work` and `/cv` (recorded in `ops/hub-accessibility-pass.md`).
- Not run: the `registry-verification` workflow on a push, since this run does not push.
