---
title: 'Story 8.5: cuatro-tracker visual restyle'
type: 'feature'
created: '2026-10-17'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'dea2f03913b510c6e15def4e8117d5027c7138f8'
context: []
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** `apps/tracker` has not adopted the token contract (DW-273) and renders its one anonymous
surface, `/login`, as the CRT cabinet the restyle retires: a gradient ground, a drop-shadowed bezel, a
filled hover, no focus ring at all, 24px fields.

**Approach:** Vendor the contract as `apps/tracker/app/cuatro-contracts/` and import its `tailwind.css`
(AD-14), apply hand-fix lines 1 to 4, and restyle `/login` natively from `RESTYLE-SPEC.md` `1.1.1`; measure
F-1 to F-12 and AD-19 once by hand, and add the results to Story 8.4's record.

## Boundaries & Constraints

**Always:** presentation only: DOM order of the content, routes, data, behaviour and every string
unchanged; the floor is `RESTYLE-SPEC.md` § The floor as amended (the tracker renders its own sign-in page,
so R2 (a) does not apply and the strict floor stands); failures recorded as findings, not corrected out of
scope; nothing imported from the Anchor beyond the vendored folder (AD-24); no shared component package.

**Never:** a push, a PR, a merge or a box step; a Registry release (cuatro-tracker's entry declares no
`token_contract`, and its `source` is a subtree the verification cannot read); a screenshot committed.

</frozen-after-approval>

## Code Map

- `apps/tracker/app/global.css`: adapter import first, hand-fixes 1 to 4 in `@layer base`, the old `.lc`, `.ti`, `.bt-header`/`.bt-blocks` rules removed
- `apps/tracker/app/(auth)/login/login.css` (new) and `page.tsx`: the floor's vocabulary, scoped to `main.lc`; the channel-flip overlay no longer passed
- `apps/tracker/components/organisms/LoginCRT/LoginCRT.tsx`: `CRTBezel`, `BitmapText`, `StatusBanner`, `CRTPixelButton` (shared with the interior, left untouched) replaced by plain markup
- `apps/tracker/app/cuatro-contracts/` (new, nine files, byte for byte `contracts/`)
- `apps/tracker/__tests__/restyle-floor.test.ts` (new): the check left behind
- `ops/literal-conformance.mjs`: the tracker's `OTHER_APPLICATIONS` reason restated (adopted; the interior's literals deferred)
- `ops/restyle-floor.md` § `cuatro-tracker` and the Pending rows; `deferred-work.md`

## Tasks & Acceptance

**Acceptance Criteria (`epics.md` Story 8.5, in full there):**
- Given AD-20, when sequenced, then the restyle opens only after Story 3.6 shipped (`done`), and lands as its own merge.
- Given a Tailwind consumer, when it consumes the contract, then it imports `tailwind.css`, and `--token-*` and `--color-*` stay distinct.
- Given its family unverified, when the story opens, then what is installed is verified first and the strategy chosen on it, and the floor enumerated by route.
- Given AD-2 and AD-24, when implemented, then no shared React component package is created.
- Given the floor and the ceiling, when complete, then F-1 to F-12 pass on every floor surface by their methods, AD-19 is run and recorded, and the results join Story 8.4's record.

## Spec Change Log

## Design Notes

- **Split or Keep:** did not arise; this section and above are about 1,150 tokens (measured at 4 characters per token).
  An orchestrated builder with no subagent tool; no open question halts it: the two readings below are decisions
  recorded as Pending rows for the Operator, as 8.1 and 8.2 recorded theirs.
- **The floor is `/login`, whole, in its four states** (idle, error, pending, success). Measured anonymously on
  2026-10-17T09:13:03Z: every other route answers 307 to `/login`, `/api/*` is JSON, `/api/auth/error` is
  next-auth's own page, `robots.txt` plain text. The interior is below the floor and is not restyled (R18 asks
  the Operator to confirm; R15 confirmed the same reading for `digital-library` on 2026-10-17).
- **Family C** (Tailwind v4 utilities, no component plugin; the CRT atoms are the application's own).
- **The interior is untouched by design,** except what adopting the adapter reaches app-wide: the `font-mono`
  utility (41 call sites) now names Geist Mono, and hand-fixes 2 to 4. The palette is not mapped onto roles
  (hand-fix 5 is "where applicable"): the interior's five LED states are told apart by hue, so a mapping would
  collapse them. That is the interior's restyle, DW-357.

## Implementation Notes

**First commit, `1e83852` (rebased onto `origin/dev` `dea2f03`); the story is `b238394`, the records the commit after it:** the minor findings handed over by an earlier verifier.
- Applied: `RESTYLE-SPEC.md` `1.1.1`: § 9 Disabled follows § 1 Disabled (I-4); § Icons reconciled with the icon-only
  control row in wording, and the row's confirmation asked of the Operator as `ops/restyle-floor.md` R17; § Family A no
  longer calls O-14 open; § Family C names `list-wheel`, and says O-15 found `digital-library` family A. The § 4 citation
  in `anchor-contract.test.ts` (and the same stale one in `apps/hub/app/app.scss`) names the section, not old line
  numbers. The R11 row says line 7 of the workspace `AGENTS.md` changed, not "lines".
- Not applicable to this story, filed instead: `cs-tracker`'s `.rounded` leak (DW-355; 8.5 does not touch `cs-tracker`)
  and `digital-library`'s code comments citing the retired WIRED `DESIGN.md` (DW-356; its checkouts are the Operator's and
  PR #67 is held). The tracker's floor renders no icon-only control, so R17 does not bear on 8.5.

**The story:** the files in the Code Map, plus `ops/__tests__/accent-fill.test.ts` (a third exemption, the tracker's
`::selection`) and `apps/hub/app/__tests__/anchor-contract.test.ts` (`VENDORED_IN_APPS`: the one `cuatro-contracts/` folder
the repository may hold, the tracker's, and a case holding it equal to `contracts/` file for file; the ban on a vendored
folder anywhere else, the Hub included, stands), DW-273 closed in part into DW-357, and DW-357 to DW-359 filed. The full record, before and after, is
`ops/restyle-floor.md` § `cuatro-tracker`, Story 8.5's adoption and restyle; the Pending rows are R18 (the floor reading),
R19 (visual sign-off) and R20 (promotion to `main`, then the tracker's standing rollout). Evidence:
`C:\CuatroEcosystem\epic-8-evidence\8-5-cuatro-tracker-visual-restyle\`.

**Tests and measurements, real output:**
- AD-19 and F-1 to F-12 (`method/measure.mjs`, Chromium `151.0.7922.34`, `next start` of each production build), `/login`
  in four states at 360 and 1280: under `--tap` 2 to **0**, ringless keyboard stops 18 of 18 to **0** of 18, grounds on
  hover 1 to **0**, radii 1 to **0**, transitions naming `box-shadow` 2 to **0**, matched shadow or gradient rules 5 or 6 to
  **0**; F-1 pixel `6,5,9`, F-2 three faces `loaded` (none before), F-3 `40,40,48`, F-8 0, F-11 accent on `--token-bg`,
  no horizontal scroll at 359/390/759/761; reduced motion: no boot overlay, the 1ms border colour alone.
- `ops/literal-conformance.mjs` `scan`: `login.css` 0 findings; the interior 1,052 (1,081 before).
- `restyle-floor.test.ts` 9 passed and the new `LoginCRT` case passed; planted `box-shadow` and `4px` radius in `login.css`:
  2 failed; planted `bt` class and inline `textShadow` in `LoginCRT`: 1 failed; both reverted.
- `corepack pnpm --filter tracker test` (scratch Redis and Postgres on `127.0.0.1`): `Test Files 108 passed (108)`,
  `Tests 1245 passed (1245)`. With `localhost` in `TRACKER_DEMO_RESET_DATABASE_URL` the demo-reset file could not reach
  Postgres on this host (`localhost` resolved to `::1`), which is the host, not the change.
- `corepack pnpm --filter tracker typecheck`: exit 0. `corepack pnpm --filter tracker build`: exit 0.
- Root suite, `corepack pnpm test --run`: `Test Files 80 passed (80)`, `Tests 1980 passed | 1 skipped (1981)` on the final tree. The first run
  failed `accent-fill.test.ts` on the tracker's new `::selection` fill; the exemption fixed it. Once the folder was
  committed, `anchor-contract.test.ts` failed "has no cuatro-contracts directory anywhere in the repository" (it lists the
  index, so the untracked folder had passed): `VENDORED_IN_APPS` admits that one path; a `--tap` changed in the vendored
  `tokens.css` failed the new equality case, reverted.
- Production image (`epic-scratch-8-5-tracker:restyle`) booted with stand-in values: `/login` 200 restyled, three woff2 200,
  `/` 307; every `epic-scratch-8-5-*` container and image removed (`postgres:16` and `redis:7-alpine` left pulled).
- Not run: `apps/tracker/e2e/login.spec.ts` (Playwright against a seeded database and `ADMIN_PASS`, not in CI).

**Review layers:** no subagent tool in this run, so they ran inline, as wave 1's builders' did; an independent verifier
follows.

## Review Triage Log

| # | Layer | Finding | Verdict | Route |
|---|---|---|---|---|
| 1 | Design review | The Control's `:hover` was not gated on `@media (hover: hover)` (NFR-5, sticky on touch) | medium | patch: gated, re-measured at 09:46:35Z |
| 2 | Edge case | `body:has(main.lc)` paints nothing where `:has` is unsupported | low: `.lc` itself paints `--token-bg` at `min-height: 100vh`, full width | rejected |
| 3 | Ponytail | `LoginCRT`'s `channelFlipOverlay` prop has no caller left | low: the component's interface is kept so the overlay can return without touching it | rejected |
| 4 | Verification gap | The e2e login spec was not run | real, not runnable here (needs a seeded database) | recorded under Tests |
| 5 | Blind | Adopting the adapter changes interior fonts | medium, known and bounded: `font-mono` utility and the default mono family only, recorded | recorded in the ops record and Design Notes |

## Verification

**Commands:**
- `corepack pnpm --filter tracker typecheck` and `corepack pnpm --filter tracker test` (Redis and Postgres on `127.0.0.1`).
- `corepack pnpm test --run`, expected: every file passes (DW-135 files re-run alone if they fail).

**Independent verifier**, 2026-10-17, round 1: **pass with minor findings**. No Satellite repository is touched, so no
PR is open for this story; the Anchor commits go to `dev`, and R17 to R20 remain the Operator's.

- **Diffs read** against `origin/dev` `dea2f03` (`1e83852`, `b238394`, `5e116b6`), templates included. `LoginCRT.tsx` renders
  the header, the version, the copyright, the form (two fields, the alert, the submit) and the boot overlay in the old order,
  and every string is unchanged. What left the tree was `aria-hidden` only: the cabinet SVG with its `CUATRO` and `PWR` marks,
  the block glyphs, and the channel-flip overlay, which carries no text. `TerminalInput`, whose `.ti` rules left `global.css`,
  has no caller but `LoginCRT`. No route, data or behaviour change, no shared package, nothing from the Anchor but the
  vendored folder. No em-dash, en-dash, dash-standing double-dash or emoji in any added line; the three subjects are
  subject-only Conventional Commits.
- **Gates, re-run:** tracker typecheck exit 0; tracker suite `Test Files 108 passed (108)`, `Tests 1245 passed (1245)` (a
  first run with `localhost` failed `demo-reset.test.ts` on "Can't reach database server", this host's `::1` resolution, as
  the builder recorded); tracker build exit 0. Root suite: `Test Files 4 failed | 76 passed (80)`, the four failures the
  DW-135 WSL files `demo-reset`, `deploy-remote`, `library-backup` and `postgres-backup`, each then passing alone (30, 28, 59,
  and 20 with 1 skipped).
- **Image:** `docker build -f apps/tracker/Dockerfile` of the final tree (the builder's image predated the hover gate),
  booted with stand-in values: `/login` 200 with `lc-wordmark` and no `crt-shell`, `/x` 307 to `/login`, the three contract
  faces under `/_next/static/media/` 200 `font/woff2` at 58,992, 24,124 and 11,284 bytes. Scratch containers and image removed.
- **Floor re-measured** by the verifier's own probe, Chromium `151.0.7922.34`, `next start` of the final build, `/login` at
  360 and 1280 with motion on and reduced. Three targets, 320 or 460 by 44 and 95 by 44, none under `--tap`, and 44 tall at
  359, 390, 759 and 761 with no horizontal scroll at any. F-1: pixels (2,2) and (2,600) read `6,5,9`, equal to `--token-bg`.
  F-2: Bricolage Grotesque, Geist and Geist Mono `loaded`. F-4: the submit has no ground at rest or on hover
  (`rgba(0, 0, 0, 0)`), the fields sit on `--token-bg`. F-5: no element with a radius, 0px at focus. F-6: three stops, each
  `solid 2px oklch(0.84 0.13 288)` at offset 3px, no transition on the outline. F-7: no element with a computed shadow or
  gradient in idle or error; the only rules the walk matched were interior `@keyframes` text-shadow frames that no element
  animates. F-8: the built CSS's one accent fill is `::selection`. F-11: `color-scheme: dark`, the selection accent on
  `--token-bg`. The error path shows the bordered alert with focus on the password field; greyscale with words masked shows
  the fields, the hairline and the Control. Reduced motion: no animation runs.
- **Minor, not blocking:** the record's "the boot overlay never mounts" under reduced motion is loose (`BootSequence` mounts
  at its final frame, with no motion). Two slips are corrected in this commit: R19's evidence path lacked a separator before
  `before`, and DW-357 said the `anchor-contract.test.ts` admission goes with the interior's restyle, when the vendored
  folder stays either way.
