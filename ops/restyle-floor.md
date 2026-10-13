# The restyle floor, Epic 8

The written answers Story 8.1 owes the three wave-1 Satellites before any restyle is estimated
(`epics.md` § Epic 8, Prerequisite: O-14, O-15 and O-17), and `cs-tracker`'s own restyle record.
Stories 8.2 and 8.3 consume § O-14 and § O-15 rather than re-deriving them; Story 8.4 records SM-12
from this file and extends it with its per-application table (`RESTYLE-SPEC.md` § Recording a
restyle).

Written during Story 8.1 on **2026-10-13** (ISO 8601 UTC). Every value is marked **Observed** with
its method or **Decision** with its reason (NFR-9). This file is a record, not Registry data.

## O-14: what a Visitor reaches without authenticating

**Method, the same for all three.** `curl` from the workstation against each `live` URL in
`contracts/registry.json`, no cookie, no login, at 2026-10-13T15:25:05Z (`cs-tracker`) and
15:25:33Z (the other two): every route the application declares (read from its source on its
default working branch, never by checking out an Operator's tree), plus one path no route declares.
The status, the redirect target and the body are what count.

### `cs-tracker` (`https://cs-tracker.cuatro.dev`), routes from `lib/cs_tracker_web/router.ex` at `origin/dev` `0e5d0c4`

| Route | Anonymous answer | A surface cs-tracker renders? |
|---|---|---|
| `/`, `/browse`, `/wishlist`, `/inventory`, `/items/1` | 302 to `/auth/sign-in` (79-byte redirect stub) | no |
| `/auth/sign-in` | 302 to `https://clerk.id.cuatro.dev/oauth/authorize?...` | no: the issuer's page, not cs-tracker's |
| `/auth/callback` (bare, and with a bad `code` and `state`) | 401 `text/plain`, `Sign-in failed.` | plain text, no stylesheet |
| `/auth/sign-out` | 200 `text/plain`, `Signed out of cs-tracker.` | plain text, no stylesheet |
| `/auth/session` | 401 JSON `{"error":"no session"}` | no |
| `/no-such-path` | 404 `text/html`, the 9 bytes `Not Found` (`ErrorHTML` renders the status text) | plain text, no stylesheet |

**Observed.** **cs-tracker renders no styled surface to an anonymous Visitor.** Its floor, read as
`RESTYLE-SPEC.md` § The floor defines it, is **empty**: every answer is a redirect, JSON or a plain-text
body with no stylesheet for a restyle to reach, and turning one into an HTML page would add a surface,
which the ceiling forbids. This is the case the epic names ("its floor collapses"), one step further:
it collapses to nothing, because the sign-in screen is the issuer's.

**Decision, by the builder of Story 8.1, pending the Operator's ruling (row R2 below).** The restyle was
scoped to the surfaces a Visitor reaches with the demo sign-in once it is published (FR-25,
`ops/demo-principal.md`; DW-335 records that no sign-in page names it yet): the five live routes and
their shell, which is also where the Operator's ruling of 2026-09-24 booked the 74 hit-target and 38
transition findings into this story (`ops/cs-tracker-accessibility-pass.md` action 1). The dense Active
Offers table stays seam S-6. Read strictly, the floor would make Story 8.1 a restyle of nothing.

### `digital-library` (`https://library.cuatro.dev`), routes from `apps/web/src/routes/` at `origin/dev` `777814f`

| Route | Anonymous answer |
|---|---|
| `/` | 302 to `/login` |
| `/login` | **200, the sign-in page** (`Cuatro Library · Sign In`, 3,017 bytes) |
| `/logout`, `/libraries/1`, `/libraries/1/books/1`, `/libraries/1/books/1/read`, `/admin`, `/admin/users` | 302 to `/login` |
| `/register`, `/library`, `/no-such-path` | **404, SvelteKit's error page** (`<h1>404</h1> <p>Not Found</p>`, with the app's stylesheet) |

**Observed. The floor is two surfaces: `/login` and the error page.** The cover grid (§ 10 Media,
`/libraries/[id]`) is behind the sign-in, so for Story 8.2 it is below the floor on this reading;
the same ruling R2 decides whether the demo-reachable interior counts, for all three.

### `list-wheel` (`https://wheel.cuatro.dev`), source at `origin/main` `718f194`

| Route | Anonymous answer |
|---|---|
| `/` | 200, the application (`Cuatro Wheel`, 11,619 bytes) |
| `/no-such-path` | 200, the same document (the static server's fallback) |

**Observed.** No authentication, no router (`src/app/app.config.ts` provides none, nothing imports
`@angular/router`'s `Routes`): **the floor is one surface, `/`, whole.**

## O-15: what each actually has installed

| Application | Evidence, read 2026-10-13 | Family | Against the assumption |
|---|---|---|---|
| `cs-tracker` | `assets/vendor/daisyui.js` (daisyUI `5.0.35`, the bundle's own `version` line) and `daisyui-theme.js`, both `@plugin` in `assets/css/app.css`; Tailwind v4 through the `tailwind` Mix package (`mix.exs`), no `package.json` at all; Phoenix `1.8.7`, LiveView `1.1.30` (`mix.lock`); the generator's `core_components.ex` | **A** | confirmed |
| `digital-library` | `apps/web/package.json`: `tailwindcss ^4.2.0` with `@tailwindcss/vite`, **`bits-ui ^2.16.1`, `tailwind-variants`, `tailwind-merge`, `clsx`, `@lucide/svelte`, `tw-animate-css`**; `apps/web/components.json` is a **shadcn-svelte** configuration, and `src/lib/components/ui/` holds four copied-in components (`button`, `card`, `input`, `label`, 14 files); no daisyUI, no `@plugin`. Its own `src/lib/tokens.css` and a light ground (`body { @apply bg-white ... }` in `src/routes/layout.css`) | **A, in its source-owned form** (utilities plus a component layer committed into the application, as `core_components.ex` is; no plugin) | **contradicts** the assumed C |
| `list-wheel` | `package.json`: Angular `^20.3.0` packages only (`common`, `compiler`, `core`, `forms`, `platform-browser`, `router` declared but unused), `rxjs`, `zone.js`; no Angular Material, CDK, PrimeNG or any component library, no Tailwind; plain component CSS and `src/styles/tokens.css` | **C** | **contradicts** the assumed B |

**Decision: the strategy each affected story takes, stated before it is estimated** (`epics.md`
Stories 8.2 and 8.3 say the family recorded here governs and the strategy is rewritten when it is not
the assumed one):

- **Story 8.2, `digital-library`: family A's strategy, applied to a source-owned layer.** Neutralise the
  component layer, keep the utilities: the four shadcn-svelte components in `src/lib/components/ui/`
  and every `tailwind-variants` recipe in them are the call sites (they are the library, as
  `core_components.ex` is for Phoenix), and `bits-ui` stays only where it carries behaviour (S-4, S-5).
  Family C's two checks still apply on top, because the browser's defaults and a reset reach the
  surfaces whatever the components do: `color-scheme: dark`, `border-radius: 0`, the focus rule, and a
  cleared `outline` in a layer nobody reads. Count the `ui/` call sites before and after, as 8.1 did.
  The adoption half also replaces the light ground and the application's own `tokens.css` with the
  vendored contract. This is the H-25 case (`review-independent-implementation.md`): a copy-in kit fits
  two families, and the one recorded is the one whose work it is.
- **Story 8.3, `list-wheel`: family C.** No component framework to displace, so route 1 and route 2 do
  not arise and H-26 is moot. The work is the plain component CSS plus the two family C checks; the
  independent-implementation test (record every point that had to be inferred) is unchanged.

## O-17: the residual review findings, triaged

A reading pass, not a fix pass, against `RESTYLE-SPEC.md` `1.0.1` and `DESIGN.md` as they stand on
2026-10-13. **Binding** means the named story applies the stated reading; **resolved** means the current
text answers it; **accepted** means it stands and costs this epic nothing.

**The independent-implementation lens** (`review-independent-implementation.md`, 2026-08-15). Its
frontmatter counts 26 High; the file lists **32**, H-1 to H-32, and all 32 are triaged.

| # | Disposition |
|---|---|
| H-1 | **Resolved**: § 1's "Missing geometry" states `padding-block`, `line-height` and `min-width` |
| H-2 | **Resolved**: the transition is `border-color var(--dur-micro) var(--ease-toggle)`, current is the emphasis underline, a forced disabled is specified |
| H-3 | **Binding on 8.1 to 8.3**: § 3's "Means" column answers it, a row separator divides and carries no meaning, so it is the Hairline (`--token-border`) |
| H-4 | **Resolved** in part by § 2's grid block; the separator's side is **binding**: top border between siblings, none on the first |
| H-5 | **Binding on 8.4**: F-3 compares each rule with its own token (Hairline, Boundary, Dashed, Emphasis), read at device scale factor 1 |
| H-6 | **Binding on 8.4**: the Emphasis underline marks state and is not a divider, so F-3 does not apply to it |
| H-7 | **Resolved** for the epic: Story 8.4's F-4 method says "Check `:hover` too"; 8.1 measured every control at rest and on hover |
| H-8 | **Binding on 8.1 to 8.4**: F-5 is read at rest; the ring's `--r-hair` belongs to the focused state only |
| H-9 | **Resolved in cs-tracker** (hand-fix 3 is unlayered, so it beats every layered daisyUI rule); **binding on 8.2**: keep the focus rule unlayered or above the component layer |
| H-10 | **Resolved**: § The scrim rule 1 permits every role over the scrim |
| H-11 | **Binding**: the dot is square at `--r-none` (`DESIGN.md` wins on a value; § 5's table still reads `--r-pill`, a spec defect for Story 8.3's list) |
| H-12 | **Binding**: an application's own states take `--token-border-interactive` for the border and `--token-text` for the word, as 8.1 does |
| H-13 | **Accepted**: `font-optical-sizing: auto` (the default) selects `opsz` from the size |
| H-14 | **Binding**: the Row name level in § 6's table is a level, and the "below `--t-md`" line governs section and display headings only |
| H-15 | **Accepted**: vertical rhythm is each application's judgement |
| H-16 | **Accepted**: no wave-1 Satellite has a Tracker Family group |
| H-17 | **Binding**: no wave-1 story uses a subordinate line, so none is invented |
| H-18 | **Binding on 8.1 to 8.3**: the ceiling wins over § 8; an empty state keeps its strings and its exits and loses only its illustration |
| H-19 | **Binding on 8.4**, and it bites cs-tracker: § cs-tracker below, F-7 |
| H-20 | **Resolved**: F-8 is now a binary grep |
| H-21 | **Resolved**: F-9 masks the words, so one observer can run it |
| H-22 | **Binding**: a row that carries a target keeps `padding-block: var(--s-md)` |
| H-23 | **Resolved**: F-11 names accent ground with `--token-bg` text, and F-8 excludes `::selection` |
| H-24 | **Binding**: the `--tap` geometry goes on the interactive element itself; a wrapper only where no row rule applies |
| H-25 | **Resolved by § O-15** above, `digital-library` being exactly its case |
| H-26 | **Accepted, moot**: `list-wheel` is family C |
| H-27 | **Resolved**: § Family A lists what the grep misses, and 8.1 counted against the bundle's own list |
| H-28 | **Resolved**: § What is deliberately not in the vocabulary, Loading |
| H-29 | **Resolved**: Pagination and Tabs dispositions exist |
| H-30 | **Binding**: the arrow is U+2192 or U+2197 as text, `aria-hidden`, in the link's colour; an icon-only control's glyph is a spec gap (§ cs-tracker, findings) |
| H-31 | **Resolved**: § The vocabulary states a total precedence order |
| H-32 | **Resolved** in prose (the alpha lives on `--c-scrim`); **binding**: never copy § The scrim's code block, which still shows the literal; no wave-1 Satellite uses the scrim |

**The token lens** (`review-restyle-token-contract.md`, 2026-08-15), its six High:

| # | Disposition |
|---|---|
| HIGH-1, HIGH-3 | **Resolved**: § The scrim now carries the gamma-space arithmetic (`L = 0.01718`) and every role is permitted over it |
| HIGH-2 | **Accepted**: the hex fallback is an Anchor document's, and no Satellite reads it |
| HIGH-4 | **Resolved**: the alpha lives on `--c-scrim`, and Story 2.34's gate permits that one declaration (`ops/literal-conformance.md`) |
| HIGH-5 | **Resolved** for the hit target (`--tap` minted 2026-08-16); the font-variation and notch literals are the Anchor gate's business (Story 2.34); **accepted** for Satellites, which have no literal gate: cs-tracker writes `font-stretch: 75% / 85% / 100%` and names them |
| HIGH-6 | **Resolved by events**: the contract moved to 2.0.0 and the process ran (`ops/contract-adoption.md`, ledger row 1) |

## `cs-tracker`, Story 8.1's restyle

The PR is on `cs-tracker` branch `restyle/8-1-visual-restyle`, commits `a0bfbb5` and the fix round's
`32c0d73`, from `origin/dev` `0e5d0c4`, for a PR to `dev` (row R3). Evidence, kept out of every repository:
`C:\CuatroEcosystem\epic-8-evidence\8-1-cs-tracker-visual-restyle\` (`before/` and `after/`: each
route at 360 and 1280 wide, the greyscale renders and each transcript; `method/`: the measurement and
count scripts, the seed and the cookie minter; `count-before.txt`, `count-after.txt`).

### What changed

**Decision.** Family A's strategy: the plugin stays installed for its theme block, and every component
class is replaced by plain markup carrying the vocabulary, written once as `ct-*` classes in
`assets/css/app.css` (Tailwind's components layer, every value a contract role). `core_components.ex`
was read and rewritten: `button/1` is the § 1 Control with no variants (there is no filled control to
vary toward), `badge/1` the § 5 status mark, `input/1` the § 9 Field with a § 7 Label, `flash/1` a
square bordered notice (seam S-5 kept), `empty_state/1` loses its icon and keeps its strings and exits
(H-18). The six generator components no surface calls (`card`, `table`, `list`, `loading`,
`error_state`, `header`) were deleted with their tests rather than restyled. The shell is a plain header
on the page ground (the wordmark at `wdth 75` / 800, nav in mono uppercase, the current route's 2px
accent underline beside `aria-current`), tiles became § 10 Media tiles (border on the image, marks
beneath it), stat, quick-link and status blocks became rows on hairlines, both actions on an item are
Controls. The offline banner lost its red ground, white text and emoji for the page ground and the 4px
square. **The status vocabulary** (Owned, Wishlisted, Manual) is carried structurally: Owned a square
dot on a solid border, Wishlisted a dashed border, Manual a solid border alone. **DOM order, routes,
data and every string are unchanged**; the decorative icons are gone (the system has no icon set), and
the quick links' chevron became the arrow glyph in the same place.

**Seam S-8, evaluated (it was moved here, `ops/cs-tracker-token-adoption.md` action 5).** The only
CSS transition left is the Control's 120 ms border colour on hover, on an element LiveView patches in
place; no container animates, so no `phx-update="ignore"` was added. **Decision**, by reading the
templates against the running application. **Seam S-7 stands.**

### The component-class count (for Story 8.4)

**Observed 2026-10-13**, `method/count-daisy.mjs` over `lib/cs_tracker_web/`: the class list read from
the bundle itself, 58 component roots and 475 classes (daisyUI 5.0.35); every class-bearing string
literal, an interpolated prefix counted by its root, attribute values that are not classes excluded.

| | Call sites | Distinct components |
|---|---|---|
| Before, `0e5d0c4` | **98** (`core_components.ex` 48, `inventory_components.ex` 11, `browse_live.ex` 10, `offers_components.ex` 9, `layouts.ex` 8, `inventory_live.ex` 5, `dashboard_live.ex` 4, `catalog_components.ex` 2, `item_live.ex` 1), two of them mentions rather than uses: a doc example (`core_components.ex:536`) and a comment line (`dashboard_live.ex:265`) | 13: `alert`/`toast`, `badge`, `btn`, `card`, `checkbox`, `fieldset`/`label`, `input`, `select`, `textarea`, `list`, `loading`, `navbar`, `table` |
| After, `a0bfbb5` | **0** | 0 |

`test/cs_tracker_web/restyle_test.exs` holds the zero (and no `transition`, `transition-colors` or
`transition-all` in a template) by the same bundle-read list; a planted `btn btn-ghost
transition-colors` fails it naming the file, 4 tests, 2 failures, then reverted.

### The floor, measured once by hand (AD-19)

**Observed 2026-10-13**, before at 15:37:20Z and after at 15:55:10Z, `method/measure.mjs` in Playwright
`1.62.1`'s Chromium `151.0.7922.34`, device scale factor 1, against `mix phx.server` (dev) on a scratch
`postgres:16` seeded by `method/seed.exs` (the AD-19 pass's seed with four categories and one
sticker), the kill switch on, signed in by a session minted for a stand-in Owner subject with OIDC
configured against `https://issuer.invalid`. Seven pages: `/`, `/browse`, `/browse` filtered to
nothing, `/inventory`, `/wishlist`, `/items/1`, `/items/8` (owned). The mobile menu was opened through
its own control before reading.

| Reading, at 360x800 | Before | After |
|---|---|---|
| Visible interactive elements read | 96 | 96 |
| Under `--tap` on either axis (F-10) | 89 | **0** |
| `transition-property` naming `all`, `outline` or `outline-color` over a duration above 0 (S-2) | 45 | **0** |
| A ground on a control at rest or on hover, fields excluded (F-4) | 85 (26 rest, 59 hover) | **0** |
| A control with a radius above 0 (F-5) | 3 | **0** |
| Keyboard stops without a 2px `:focus-visible` ring (F-6) | 0 | **0**, corrected below the checks |
| Horizontal scroll at 359, 390, 759, 761 on any of the seven (F-12) | 0 | **0** |

| Check | After | How |
|---|---|---|
| F-1 | **Pass**: `body` and `:root` compute `oklch(0.12 0.011 288)`, `--token-bg` (before: `body` transparent, the shell on `--token-bg-raised`) | computed ground |
| F-2 | **Pass**: Bricolage Grotesque, Geist and Geist Mono all `loaded` in `document.fonts` (before: Bricolage never loaded, no display face was used) | `document.fonts` status |
| F-3 | **Pass**: every rule is `1px` `--token-border`, or `--token-border-interactive` on a control or field | the stylesheet's rules |
| F-4, F-5, F-6, F-10 | **Pass**, the table above | browser readings |
| F-7 | **Pass from `32c0d73`**: the production image's `app.css` carries one `box-shadow`, preflight's `box-shadow:none`, and 0 gradients. At `a0bfbb5` it failed as written: 28 `box-shadow` and 6 gradient rules, 27 and 6 inside daisyUI component selectors no template uses (daisyUI 5 emits every component unless told otherwise), and `.shadow`, minted from a word in a comment. The fix: `include: rootcolor, scrollbar;` on the daisyUI `@plugin` block (the plugin stays installed, its theme block untouched) and `@source not inline("shadow transition");` | grep of the image's built CSS |
| F-8 | **Pass**: zero `background`, `background-color` or `fill` declarations reading an accent role outside `::selection` | grep of the image's built CSS |
| F-9 | **Pass**: `after/greyscale-masked-browse.png`, `-inventory.png`, `-item-owned.png`, words made transparent, the three marks still tell apart | greyscale render, words masked |
| F-11 | **Pass**: `color-scheme: dark`; `::selection` accent on `--token-bg` | computed style |
| F-12 | **Pass with a stated reading**: no list in cs-tracker is a § 2 row; its lists are § 10 Media grids (`repeat(auto-fill, minmax(9rem, 1fr))`, `gap: var(--s-md)`), and the key-value list and status line are hairline rows; controls and links meet § 1 and § 1b geometry at every width | the four widths, above |

**Correction, F-6, observed 2026-10-13 by the independent verifier.** The first traversal skipped a Tab
press that stayed on the same element, so it never read the `Released after` date field's calendar button,
its fourth internal stop: there the input matches `:focus-within` but not `:focus-visible`, and it painted no
ring. From `32c0d73`, `.ct-field[type="date"]:focus-within` carries the same ring. Re-measured with
`method-round-2/measure.mjs`, which reads every press and passes a stop on the ring it paints: **0 ringless
over 72 presses** at 360, and `method-round-2/tabs-browse.mjs` at 1280 reads press 13 (the calendar stop)
`fv=false fw=true`, `solid 2px oklch(0.84 0.13 288)` (`after-round-2/browse-1280-tab13.png`). The rest of
that run held: 95 visible interactive elements (the dashboard's recently viewed list was empty in the fresh
database, so one Control stood where two tiles had), 0 under `--tap`, 0 transitioned, 0 grounds, 0 radii,
0 horizontal scroll; F-1, F-2 and F-11 as above.

**The image boot** (cs-tracker has no CI): `docker build` of `a0bfbb5` as
`epic-scratch-8-1-cs-tracker:restyle`, `bin/migrate` then the release against a scratch Postgres 16 at
2026-10-13T15:59:59Z: `GET /` 302, `app.css` and the three woff2 faces 200, the container up; removed
afterwards with its network and database container. `mix precommit` on `a0bfbb5`: **714 tests,
0 failures (4 excluded)**. Again for the fix round, `32c0d73`, at 2026-10-13T16:36:33Z: `bin/migrate`, the
release up, `GET /` 302, `app.css` and the three woff2 faces 200, every scratch object removed;
`mix precommit`: **715 tests, 0 failures (4 excluded)**.

### Findings, recorded rather than corrected (AD-19)

1. **The browse filters' selects and the search field have no visible label** (§ 9 forbids a field with
   no visible label); adding one is microcopy and a field appearing, so out of the ceiling. DW-344.
2. **Heading levels skip** (`h1` to `h3` on `/browse`'s empty state and the media tiles), § 6's check;
   changing levels is a semantic change left to a later story. DW-344.
3. **The spec has no glyph for an icon-only control** (the menu toggle, the flash and wishlist dismiss
   keep their heroicon inside a Control): a defect for Story 8.3's list, H-30.
4. **F-7's scope** (H-19): the bundle carried the unused daisyUI components. DW-343, closed by `32c0d73`.
5. **The AD-19 probe cannot run any more**: `ops/cs-tracker-accessibility-probe.mjs` mints a Steam
   session and measures `/auth/steam/callback`, both deleted by Story 5.7, so this pass used its own
   script. DW-342.
6. **The reconnect notice still spins an icon** (`motion-safe:animate-spin`), inside the S-5 overlay
   cs-tracker keeps as its own.

## Pending Operator actions

| # | Action | Owner | Note | Completed (UTC) |
|---|---|---|---|---|
| R1 | **Sign off the `cs-tracker` restyle visually** (a ruling) | Operator | Added 2026-10-13. Look at `/`, `/browse` (and filtered to nothing), `/inventory`, `/wishlist`, `/items/:id` unowned and owned, at 360 and 1280, plus the open mobile menu and the offline banner. Before and after are `C:\CuatroEcosystem\epic-8-evidence\8-1-cs-tracker-visual-restyle\before\` and `after\` (`<route>-360.png`, `<route>-1280.png`), greyscale renders in `after\greyscale-masked-*.png`. The seed's data-URI images render as their alt text in both sets, so judge the tiles' geometry, not their pictures | _not done_ |
| R2 | **Rule on the floor's denominator for an application whose anonymous surfaces are a redirect, plain text and the issuer's page** | Operator | Added 2026-10-13. § O-14: cs-tracker's strict floor is empty, digital-library's is `/login` and its error page. Options: (a) the demo-reachable interior counts as the floor, which Story 8.1 assumed and built; (b) the strict floor stands, Story 8.1's restyle is beyond it, and 8.2 restyles two surfaces | _not done_ |
| R3 | **Merge the `cs-tracker` PR (`restyle/8-1-visual-restyle`, `32c0d73`) into `dev`, then `dev` into `main`, then roll `cs-tracker`** by the standing redeploy (`ops/cs-tracker-cutover.md` § Later rollouts), no step of its own | Operator | Added 2026-10-13. The independent verifier pushes the branch and opens the PR to `dev`. cs-tracker has no CI and no `.github/`, so no workflow runs on it; the gate is `mix precommit` (715 tests, 0 failures, 4 excluded, on `32c0d73`) and the production image's boot, both above. Nothing changes how it starts; the assets change, which is why the image was booted | _not done_ |
| R4 | **Note that Stories 8.2 and 8.3 open on a changed strategy** | Operator | Added 2026-10-13. § O-15: `digital-library` is family A in its source-owned form, not C; `list-wheel` is C, not B. `epics.md` says the strategy changes before each opens; both were dispatched in parallel with this story | _not done_ |

**Maintaining this file.** When an action is performed, replace its `_not done_` cell with the ISO
8601 UTC date and leave the row in place.
