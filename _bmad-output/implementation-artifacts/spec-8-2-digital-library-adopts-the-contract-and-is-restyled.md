---
title: 'Story 8.2: digital-library adopts the contract and is restyled'
type: 'feature'
created: '2026-10-13'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'aea9b97d4b0c8518274ff7459625da0da1a9dd71'
context: []
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** `digital-library` renders its own light WIRED palette and fonts, not the contract, and its
source-owned component layer (`primitives/`, `shell/`) draws filled, 2px-black, rounded-icon controls
the vocabulary forbids. It is the entry a Visitor most often opens from the Suite Directory.

**Approach:** Two shipped steps on two stacked branches: **adopt** (vendor `cuatro-contracts/`, import
the plain `tokens.css` + `fonts.css` pair, map the app's own variables onto the roles, the hand-fix
lines), then **restyle** (family A's strategy on the source-owned layer, `ops/restyle-floor.md` § O-15:
rewrite the components to `RESTYLE-SPEC.md` § 1 to § 10, the cover grid to § 10 Media), measured once by
hand (AD-19).

## Boundaries & Constraints

**Always:** presentation only: DOM order, routes, data, behaviour and every string unchanged; the
restyle opens as a PR only after the adopt merge is verified in production (AD-20); failures recorded,
not corrected out of scope.

**Never:** an Anchor import beyond `cuatro-contracts/` (AD-24); a push, a PR, a merge or a box step; a
Registry `token_contract` before the vendored file is on `digital-library` `main`; a screenshot
committed to a repository.

</frozen-after-approval>

## Code Map

- `apps/web/src/lib/cuatro-contracts/` (new): the nine contract files, verbatim, Contract v2.0.0
- `apps/web/src/routes/layout.css`: imports, `@theme inline` (its `--font-*` self-references go), hand-fixes 1 to 4 unlayered
- `apps/web/src/lib/tokens.css`: adopt rewrites it as the alias layer (S-9); restyle deletes it
- `apps/web/src/routes/+layout.svelte`: the `@fontsource` imports go (the contract ships the faces)
- `apps/web/src/lib/components/primitives/{Button,Input,MonoKicker,HardRule,RoundIconButton,FilterStrip}.svelte`, `shell/{AppNav,UtilityBar,Footer}.svelte`: the component layer the floor routes use
- `apps/web/src/lib/components/ui/` (shadcn-svelte): admin only, below the floor, untouched; `Breadcrumb`, `StatusTag`, `EditorialTable` render on no route, untouched
- `apps/web/src/routes/{login,+page,libraries/[id],libraries/[id]/books/[bookId],logout}/+page.svelte`, new `+error.svelte` (the default error markup, styled)
- Tests under `apps/web/src/**/__tests__/` that pin the old palette or read `tokens.css`

## Tasks & Acceptance

**Execution:**
- [x] adopt branch `restyle/8-2-adopt-contract`: vendor, imports, alias layer, hand-fixes, font deps removed; suite, typecheck, build
- [x] restyle branch `restyle/8-2-visual-restyle`, from adopt: components and floor routes to the vocabulary, alias layer deleted, tests moved; count `primitives/` + `ui/` call sites on floor routes before and after
- [x] AD-19 pass in a browser at 360 and 1280 on the production images; evidence under `C:\CuatroEcosystem\epic-8-evidence\8-2-...\`
- [x] Anchor: `ops/restyle-floor.md` § digital-library, Pending rows, board row

**Acceptance Criteria (`epics.md` Story 8.2, in full there):**
- Given adoption, when it ships, then the folder is `cuatro-contracts/` exactly, the pair is imported, the hand-fixes apply in the seams order, and the Registry gains `token_contract` once it is on `main`.
- Given family C's checks, when restyled, then `color-scheme: dark`, radius 0 and the focus rule hold, and no reset clears `outline`.
- Given the cover grid, when restyled, then `repeat(auto-fill, minmax(...))` at `--s-md`, border on the image with intrinsic size, a missing image is the empty bordered box with the name beneath, nothing shifts on a throttled load.
- Given the floor, when complete, then F-1 to F-12 are measured by § The floor's methods.

## Design Notes

- **Split or Keep:** did not arise: about 1,216 tokens (4,865 characters before Implementation Notes, at 4 per
  token), measured at planning. No subagent tool, so the review layers ran inline, as 8.1's builder's did. The two halves are the story's own two merges, not a multi-goal split.
- **The floor (ruling R2 pending):** strict floor `/login` and the error page; the restyle also takes the demo-reachable interior (`/`, `/libraries/[id]`, the book page, `/logout`), as 8.1 did and as the cover-grid criterion needs. The reader (`/read`, a user-themed reading surface) and `/admin` stay below.
- **O-15, corrected by reading the routes:** the floor routes import nothing from `ui/`; their component layer is `primitives/` and `shell/`, written in-house. That is the count.
- **Missing cover:** the grid's coverless box loses its in-box text (format, catalogue number, title, author). § 10 and the criterion require it empty; the link holding it is `aria-hidden`, so no reader loses anything, and title, author and format stay beneath.

## Implementation Notes

**First commit, `ed3a9f9`** (rebased onto `origin/dev` `3233a5a`): the handover. The S-8 wording in
`ops/restyle-floor.md` and `ops/cs-tracker-token-adoption.md` now names the generator's `show/2` and `hide/2`
`transition-all` beside the Control's border colour; hand-fix 3's missing `border-radius: var(--r-hair)` is
DW-348 (8.3 had taken DW-345 to 347); `epics.md` Stories 8.2 and 8.3 carry dated notes restating the families;
DW-342 carries the verifier-round-2 seed (session minted in the release, a TLS front for `check_origin`).

**digital-library**, worktree `C:\CuatroEcosystem\digital-library-workspace\wt-8-2-digital-library-adopts-the-contract-and-is-restyled`,
from `origin/dev` `777814f`: `restyle/8-2-adopt-contract` `960050b` (14 files), and `restyle/8-2-visual-restyle`
`c138c6a`, `3c9b68c`, `3f2687b`, `c25f830` on top of it (29 files over the adopt commit). What changed, the
count, the floor and the findings are in `ops/restyle-floor.md` § `digital-library`; rows R8 to R11; DW-349 to 351.

**Tests and measurements, real output:**
- `pnpm test` (node:22-bookworm, CI's Node 22; the host's Node 24 cannot build `canvas`): `777814f` 32 files,
  544 passed; `960050b` 544 passed; `c25f830` **33 files, 560 passed**. `pnpm typecheck`: `svelte-check found 0
  errors and 0 warnings` on both branches. `restyle-floor.test.ts` mutant (planted accent ground on `Button`):
  `1 failed | 17 passed`, reverted.
- Component layer on the floor: `ui/` call sites 0 and 0; forbidden declarations **92 before, 0 after**.
- AD-19, production images, 10 pages, 73 interactive at 360: under `--tap` 41 to **0**, overlaps 12 to **0**,
  grounds 38 to **0**, radii 8 to **0**, ringless stops 46 of 132 to **0**, eased rings 12 to **0**, horizontal
  scroll 6 to **0**. F-1 `6,5,9` = `--token-bg`, F-2 three faces loaded, F-3 `40,40,48` = `--token-border`, F-8,
  F-9, F-11, F-12 pass; **F-7 fails as written** on six `box-shadow` utilities from `/admin` and the reader, none
  on the floor (DW-350). Throttled grid: no title moves, CLS `0.0009`.

- Anchor root suite, `corepack pnpm test --run`: `Test Files 7 failed | 73 passed (80)`, `Tests 7 failed | 1972
  passed | 1 skipped (1980)`; the seven were the DW-135 WSL-bash files, each alone then passing: demo-reset 30,
  deploy-remote 28, library-backup 59, postgres-backup 20 + 1 skipped, postgres-init 17, tournament-backup 15,
  tracker-backup 11.

Scratch Docker objects are `epic-scratch-8-2-*`; removed at handover (see Verification).

## Verification

**Independent verifier, round 1 (2026-10-13): pass with minor findings.** No builder context; every claim
re-run, not read.

- **Diffs read against their bases**, templates included: `777814f..960050b` and `960050b..c25f830`. The nine
  vendored blobs hash equal to `contracts/` at `46c8b68` and at `origin/dev`. Script and markup of every
  component and of `/`, `/login` are byte-identical to the adopt step; the grid's only markup change is the
  coverless tile's emptied box, the reading-state classes and `width`/`height` on the image; the book page and
  `/logout` change class attributes only (the book page's `FORMAT_COLORS` map goes); `+error.svelte` renders
  SvelteKit's default `<h1>` status and `<p>` message. DOM order, routes, data and strings unchanged otherwise.
  No import from the Anchor beyond `cuatro-contracts/`; no floor route imports `ui/`.
- **`digital-library` gates**, in `node:22-bookworm` with CI's canvas packages, from exports of each sha:
  `960050b` `pnpm test -- --coverage` 32 files, 544 passed, `pnpm typecheck` 0 errors and 0 warnings, the web
  build done; `c25f830` 33 files, 560 passed (a first run from a CRLF export failed one `restyle-floor.test.ts`
  case; re-exported with LF, as CI checks out, all 560 passed), typecheck 0 errors and 0 warnings, build done.
  GitHub, workflow `CI`: on `960050b` push run 38451924411 success and pull_request run 38451957664 success; on
  `c25f830` push run 38451928868 success.
- **Anchor root suite**, `corepack pnpm test --run` in this worktree at `c6087b5`: 80 files passed, 1979 tests
  passed, 1 skipped; no DW-135 failure this run.
- **AD-19, measured again by the verifier** with its own script (`verifier/method/verify.mjs` in the evidence
  folder), Playwright `1.62.1` Chromium, device scale factor 1, against production images built from each sha
  on a scratch stack (seed as the builder's: seven books, two coverless, Unread, Reading, Finished). Ten pages,
  `/login` and `/no-such-path` signed out, then `/`, the grid, the grid filtered to nothing, the empty library,
  `/logout`, a book with and without a cover. `c25f830` at 360: 66 visible interactive elements (excluding the
  `aria-hidden` cover links), 0 under 44px, 0 overlaps, 0 grounds at rest or hover, 0 radii, 0 transitions on
  `all` or `outline`, 0 shadows; 132 keyboard stops at 360 and 1280, every one a solid 2px
  `oklch(0.84 0.13 288)` ring, none eased; no horizontal scroll at 359, 390, 759, 761. F-1 pixel `6,5,9` equals
  `--token-bg`; F-2 the three faces `loaded`; F-11 `color-scheme: dark`, `::selection` accent on `--token-bg`;
  F-8 the one accent ground is `::selection`; F-9 the masked greyscale grid tells dashed, solid and solid with
  the square apart; § 10's throttled load (400 ms, 50 KB/s, five images pending at `DOMContentLoaded`) moved no
  title, CLS 0.0008. F-7 fails as written exactly as recorded: six Tailwind `box-shadow` utilities in the
  built CSS, sourced only from `ui/`, `/admin` and the reader (DW-350). The adopt image `960050b` served every
  page on the dark ground with the three faces loaded and a ring at every stop. Screenshots:
  `C:\CuatroEcosystem\epic-8-evidence\8-2-digital-library-adopts-the-contract-and-is-restyled\verifier\` (`restyle\`,
  `adopt\`, each with `transcript.txt`).

**Minor findings, none blocking:**
1. The coverless grid tile also loses its catalogue number (`N° 01`, numbered across the result set), which
   rendered nowhere else; `ops/restyle-floor.md` says only format, title and author remain beneath, and the
   spec's Design Notes name it. § 10 and the story's criterion require the empty box, so it stands; recorded.
2. On the adopt step alone the book page's format chip keeps Tailwind's light `emerald-100` ground (only stone
   and white were remapped); the restyle removes it. Transitional, not on the floor's strict reading.
3. The border sits on the image's wrapper box (`.cover`, which reserves the 2:3 space), not on `<img>`; the
   image fills it, so it renders as § 10 asks.
4. `restyle-floor.test.ts`'s hand-fix order case fails on a CRLF checkout (a Windows clone with
   `core.autocrlf=true`); CI is unaffected.

**PRs.** `digital-library` PR [#66](https://github.com/LuigiEspinosa/digital-library/pull/66), `restyle/8-2-adopt-contract`
to `dev`, head `960050b`, opened by the verifier and left open (row R9). `restyle/8-2-visual-restyle` (head
`c25f830`) is pushed with **no PR**: Story 8.2 opens it only after the adopt merge is verified in production
(row R10).
