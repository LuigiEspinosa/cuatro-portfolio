# The restyle floor, Epic 8

The written answers Story 8.1 owes the three wave-1 Satellites before any restyle is estimated
(`epics.md` § Epic 8, Prerequisite: O-14, O-15 and O-17), `cs-tracker`'s own restyle record, and
`list-wheel`'s (Story 8.3, the same day).
Stories 8.2 and 8.3 consume § O-14 and § O-15 rather than re-deriving them; Story 8.4 records SM-12
from this file and extends it with its per-application table (`RESTYLE-SPEC.md` § Recording a
restyle), § SM-12 per application, Story 8.4's record.

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

**Seam S-8, evaluated (it was moved here, `ops/cs-tracker-token-adoption.md` action 5).** Two kinds
of transition are left. The one in a stylesheet rule is the Control's 120 ms border colour on hover, on
an element LiveView patches in place. The other is the generator's `show/2` and `hide/2` in
`core_components.ex`, which put `transition-all` on the flash and reconnect notices for their 200 to
300 ms entrance and exit, so `.transition-all` ships in the built CSS. Those are LiveView JS commands,
which survive a patch, and no container animates under `phx-update`, so no `phx-update="ignore"` was
added. **Decision**, by reading the templates against the running application. **Seam S-7 stands.**
*(Corrected 2026-10-13 by Story 8.2's builder, from the independent verifier's round 2 note below:
this paragraph first called the border colour the only transition left.)*

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
| F-7 | **Pass from `32c0d73`**: the production image's `app.css` carries one `box-shadow`, Tailwind preflight's `:-moz-ui-invalid{box-shadow:none}` (the selector named 2026-10-17 from `after-round-2\image-app.css` in the evidence folder), and 0 gradients. At `a0bfbb5` it failed as written: 28 `box-shadow` and 6 gradient rules, 27 and 6 inside daisyUI component selectors no template uses (daisyUI 5 emits every component unless told otherwise), and `.shadow`, minted from a word in a comment. The fix: `include: rootcolor, scrollbar;` on the daisyUI `@plugin` block (the plugin stays installed, its theme block untouched) and `@source not inline("shadow transition");` | grep of the image's built CSS |
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

### Independent verification, round 2 (2026-10-13)

**Observed 2026-10-13 by the independent verifier** on `cs-tracker` `32c0d73`, with its own script
(`C:\CuatroEcosystem\epic-8-evidence\8-1-cs-tracker-visual-restyle\verifier-round-2\`: `measure.mjs`, `transcript.txt`,
screenshots). The script ran against the **production image** (`bin/migrate`, then the release on a scratch Postgres 16,
seeded with `method/seed.exs`, a session minted inside the release, a local TLS front so the socket meets
`check_origin`). Chromium `151.0.7922.34`, device scale factor 1. Eight pages (the seven above plus `/items/5`,
wishlisted), each at 360 and 1280, with the mobile menu open at 360.

- **Targets:** 296 visible readings, 0 under 44px on either axis, 0 filled at rest or on hover, 0 radii, 0 transitions
  naming `all` or `outline`. There are 15 overlaps, all at 360 with the menu open: the open menu sits inside the sticky
  header and covers the content scrolled beneath it, so no two adjacent targets overlap (`menu-open-360.png`).
- **Keyboard:** 188 stops (the date field's four stops included), 0 without a solid 2px ring, and 0 rings transitioned.
  Clicking the menu toggle paints no ring. The ring is `oklch(0.84 0.13 288)` on `--token-bg`. On the third ground,
  the flash notice on `--token-bg-raised`, the close Control's ring was read as `solid 2px` (`flash-1280-focus.png`).
- **Other checks:** no horizontal scroll at 359, 390, 759 or 761. F-1, F-2 (`document.fonts.check` true for all three)
  and F-11 hold. F-9 holds: the greyscale masked renders tell Owned, Wishlisted and Manual apart.
- **The image's `app.css`** is 26,825 bytes. It has one `box-shadow` (`none`), 0 gradients, and no accent ground but
  `::selection`.
- **Gates:** `mix precommit` 715 tests, 0 failures (4 excluded). Anchor root suite: 73 files passed, and the 7 DW-135
  WSL-bash files failed in the full run and each passed alone.
- **Two corrections to the record above, neither a floor failure.**
  - The S-8 paragraph says the Control's border colour is the only CSS transition left. That is not quite true:
    the generator's `show/2` and `hide/2` still put `transition-all` on the flash and reconnect notices for their
    200 to 300 ms entrance and exit, so `.transition-all` is in the built CSS. These are LiveView JS commands, which
    survive a patch, so no `phx-update="ignore"` is needed.
  - Hand-fix 3's `:focus-visible` rule omits § 4's `border-radius: var(--r-hair)`, a Story 1.19 rule this story
    did not touch.

## `list-wheel`, Story 8.3's adoption and restyle

The branch is `list-wheel` `restyle/8-3-visual-restyle`, from `origin/main` `718f194`, for a PR to
`main` (row R6): `e7b7887` adopts the contract and `c665ee9` restyles. They are two commits on one branch,
so the adoption and the restyle each land as their own commit and reach the Visitor as one merge (AD-20,
`epics.md` Story 8.3). Story 2.25's relocation is verified and merged (`main` `00f5957`, PR #3; its board
row reads `done`), so the restyle is a separate step after it. Evidence, kept out of every repository:
`C:\CuatroEcosystem\epic-8-evidence\8-3-list-wheel-visual-restyle\` (`before/` and `after/`: nine states
at 360 and 1280, `empty` and `winner` also at 359, 390, 759 and 761, the greyscale masked renders and each
`transcript.txt`; `method/measure.mjs`).

### What changed

**Decision: family C, as § O-15 recorded.** There is nothing to displace, so route 1 and route 2 do not
arise; the work is the plain component CSS plus family C's two checks. No reset ships: the only rules
that cleared `outline` were the editor's own `:focus { outline: none }` pair, deleted.

- **The adoption** (`e7b7887`). `list-wheel` was `not adopted` (`ops/contract-adoption.md`). The nine
  token-contract files are vendored at `src/styles/cuatro-contracts/`, each blob equal to this
  repository's `contracts/` blob at `46c8b68` (`git rev-parse` on both sides), and loaded first in
  `angular.json` (build and test). Hand-fix lines 1 to 4 are in `src/styles.css`; line 5 mapped the
  application's own variables onto the roles. The Google Fonts stylesheet and Rubik went: `ng build`
  copies the three woff2 faces into `media/`, so the build fetches no font host, and the Dockerfile
  comment says so now.
- **The restyle** (`c665ee9`). The vocabulary is written once in `src/styles.css`: § 1 Control for every
  `button`, the button-styled links and the file input's button; § 9 Field; a checkbox (I-1 below). The
  component stylesheets only lay it out. The glass panel and the wheel's box became sections on a 1px
  hairline; the display line is § 6 Display; the history table keeps seam S-6 with the separator, the
  Label and `tabular-nums`; the error banner is text in `--token-text` on a boundary (S-4). The wheel's
  colours left the SVG attributes for classes reading the roles, its spokes and rim are 1px at any size
  (`vector-effect: non-scaling-stroke`), and its pointer is `--token-text`, not accent. The winner badge
  is opaque `--token-bg`, square, on `--token-border-interactive`. `src/styles/tokens.css` is deleted.
  **DOM order, routes, data and every string are unchanged**: the template diff is the wheel's colour
  attributes turned into classes and the three font links removed from `<head>`.
- **The check left behind**: `src/app/restyle.spec.ts`, 3 cases on the rendered page in Karma's Chrome:
  every control unfilled, square, unshadowed, `border-color` its only transition, at least 44px on both
  axes; no radius and no shadow on any element; fields square on the page ground. A planted
  `background: var(--token-accent); border-radius: 4px` on the Control failed it (`1 FAILED, 147 SUCCESS`),
  then was reverted.

### The floor, measured once by hand (AD-19)

**Observed 2026-10-13**, before at 17:31:29Z and after at 17:32:05Z, by `method/measure.mjs` in
Playwright `1.62.1`'s Chromium `151.0.7922.34`, device scale factor 1, against each production build
served statically (`718f194`, built in a scratch worktree removed afterwards, and `c665ee9`). The floor
is one surface, `/` (§ O-14), read in the nine states its own controls reach, with `showOpenFilePicker`
stubbed so a file opens headless: `empty`, `empty-fallback` (no File System Access, so the file input),
`loaded`, `banner` (write permission denied), `winner`, `winner-url` (Link 1 and Link 2), `copied`,
`history`, `editor`. Autofocus is dropped before reading, because F-5 is read at rest (§ O-17 H-8).

| Reading, at 360x800 | Before | After |
|---|---|---|
| Visible interactive elements read | 75 | 75 |
| Under `--tap` on either axis (F-10); a checkbox measured by its wrapping label | 73 | **0** |
| Two adjacent targets overlapping | 0 | **0** |
| A ground on a control at rest (F-4), fields and checkboxes excluded | 61 | **0** |
| A ground, shadow or transform on hover (F-4) | 45 | **0** |
| A radius above 0 (F-5) | 65 | **0** |
| A `box-shadow` | 49 | **0** |
| `opacity` below 1 | 15 | **0** |
| `transition-property` naming `all` or `outline` over a duration | 0 | **0** |
| Keyboard stops without a solid 2px `:focus-visible` ring (F-6) | 3 (the editor's two find fields and its textarea) | **0** |
| A mouse click painting a ring | 0 | **0** |
| Horizontal scroll at 359, 390, 759, 761 | 2 (`empty-fallback` at 359 and 390) | **0** |

| Check | After | How |
|---|---|---|
| F-1 | **Pass**: pixel (2,2) reads `6,5,9`, equal to `--token-bg` drawn to a canvas, `6,5,9` (before `31,22,51`, `#1f1633`) | the page's own screenshot, decoded in the page |
| F-2 | **Pass**: Bricolage Grotesque `700 800`, Geist `300 600` and Geist Mono `400` all `loaded` in `document.fonts`; the three woff2 answered 200 from `media/`; no Rubik face (before: Rubik from fonts.gstatic.com and no contract face) | `document.fonts` status and the network |
| F-3 | **Pass**: the section hairline's pixel `40,40,48` equals `--token-border`, `40,40,48`, computed `1px` | a sampled rule |
| F-4, F-5, F-6, F-10 | **Pass**, the table above | browser readings |
| F-7 | **Pass**: 0 `box-shadow` and 0 `gradient(` in `styles-W6ATMQFT.css` and in `main-QUMLPMPG.js`, where Angular inlines the component styles (before: 12 `box-shadow` in the bundle) | grep of the built CSS and bundle |
| F-8 | **Pass**: the one accent ground is `::selection{background-color:var(--token-accent)}`, which F-8 excludes; no `fill` reads an accent role | the same grep |
| F-9 | **Pass**: in `after/greyscale-masked-empty.png`, `-history.png` and `-editor.png`, every word transparent, an enabled control (Boundary) tells from a disabled one (Hairline), and a checked box (a square mark inside it) from an unchecked one | greyscale render, words masked |
| F-11 | **Pass**: `:root` `color-scheme: dark` (before `normal`); `::selection` `oklch(0.66 0.165 288)` on `oklch(0.12 0.011 288)` | computed style |
| F-12 | **Pass with a stated reading**: the surface has no § 2 row (its one list, the history, is a table under seam S-6); controls and links meet § 1 geometry at every width; `760px` is the one breakpoint (the old `640px` and `768px` are gone) | the four widths, above |

**SM-12's four manual checks.** Keyboard-only traversal, 360 with no horizontal scroll and the greyscale
render are above. **`prefers-reduced-motion` forced** (`reduce`, Instant results off): Spin still turns
the wheel, `rotate(0)` at the click and about `rotate(200)` 500 ms later. Finding 2.

**The image.** `docker build` of `c665ee9` as `epic-scratch-8-3-list-wheel:c665ee9`, run on loopback,
twice: `GET /` 200 at 3,151 bytes (the live page was 11,619 with Google's CSS inlined, § O-14),
`styles-W6ATMQFT.css` 200, the three woff2 200 `font/woff2` (58,992, 24,124 and 11,284 bytes on the first
run; the second, at 2026-10-13T17:37:53Z, read the statuses and types), `/no-such-path` 200 (the
fallback), no `googleapis` in the page; container and image removed both times. **Gates on
`c665ee9`**: `npm test` **148 SUCCESS** (145 at `718f194`, plus the 3 restyle cases); `node --test
ops/deploy-remote.test.mjs` **27 pass, 0 fail**; `npm run build` with no budget warning.

### Findings, recorded rather than corrected (AD-19)

1. **The editor's two find fields and its textarea have no visible label** (§ 9 forbids a field with no
   visible label; they carry `aria-label` and a placeholder). A visible label is microcopy and a field
   appearing, so it is outside the ceiling. DW-345.
2. **Spin ignores `prefers-reduced-motion`**: the turn is a `requestAnimationFrame` loop that never reads
   the setting. Instant results is the reader's own way out; honouring the setting is a behaviour change.
   DW-345.
3. **The `Copied!` toast never renders**, before or after: copying removes the winner, and the toast sits
   inside `@if (winner)`. It is behaviour on `main` before this story, so the `.buttons-row .toast` style
   never shows and the `copied` screenshots carry no toast. Recorded by the independent verifier,
   2026-10-13. DW-353.

### Where the implementer had to infer (the independent-implementation test)

These are recorded as defects in `RESTYLE-SPEC.md`, per Story 8.3, and go back to it rather than being
solved locally (DW-346, row R7). What this story chose is stated so the next framework can see it.
**Settled 2026-10-17** by the Operator's ruling on R7: `RESTYLE-SPEC.md` `1.1.0` states each point where it belongs
(§ Readings settled 2026-10-17), with 8.3's reading for I-1 to I-9, the dot square for I-10, and no radius on a
field's focus ring for I-11, which makes `list-wheel`'s focused textarea a defect (fixed on a branch, row R16).

| # | Point | What 8.3 chose |
|---|---|---|
| I-1 | **A checkbox is in no entry.** § 1 is boxed actions and § 9 is text input; F-4 says no control has a ground, and a checked mark is one | A square unfilled box (`--s-md`, Boundary); checked draws a `--token-text` square inside it, never accent |
| I-2 | **A checkbox's target.** H-24 puts `--tap` on the element itself, but a native checkbox's hit area is its wrapping `<label>` | `--tap` on the label; F-10 measured the label |
| I-3 | **§ 1's sibling gap on the wrap axis.** "`--s-lg` minimum" does not say whether wrapped rows of controls count as siblings | `--s-lg` on both axes |
| I-4 | **§ 1 Disabled names `aria-disabled`.** A native `disabled` already exposes the state, and adding the attribute is a markup change | Not added |
| I-5 | **§ 6's `wdth 85` and `wdth 100`** name a variation axis, not a property, so `font-stretch` or `font-variation-settings` is left to infer | `font-stretch`, which the contract's `@font-face` range (`75% 100%`) serves |
| I-6 | **A scaled SVG graphic.** Nothing says whether a graphic's strokes are dividers under F-3, or what 1px means inside a `viewBox` that scales | Roles for every colour; spokes and rim 1px by `vector-effect: non-scaling-stroke`; the badge's border scales with the wheel: it is 0.4 in the wheel's own SVG units, about 3px at 1280, a fourth stroke width beside § 3's three (R5) |
| I-7 | **The external-navigation mark.** It is one of the system's three glyphs, but no entry says when a `target="_blank"` control must carry it, and adding it is new content | Not added |
| I-8 | **The page-level breakpoint.** § 2 makes `760px` the row's one breakpoint; whether a page layout may keep others is unsaid | `760px` only |
| I-9 | **The page's maximum width.** No token or entry gives one | The application's own `72rem` kept |
| I-10 | **Carried from Story 8.1**: § 5's table gives the dot `--r-pill` where `DESIGN.md` gives `--r-none` (H-11), and there is no glyph for an icon-only control (H-30) | Not reached: `list-wheel` has neither |
| I-11 | **§ 4's ring radius against F-5.** § 4 gives the focused element `--r-hair`; F-5 wants every field square, and H-8 reads F-5 at rest only. Added 2026-10-13 from the independent verifier's round 1 | Neither, by accident: the editor `textarea` rounds to `--r-hair` while focused, because the `:focus-visible` rule outranks the bare `textarea` selector, while the find inputs (`input[type='text']`, more specific) stay square. `cs-tracker`'s hand-fix 3 omits the radius altogether (§ cs-tracker, round 2). **A probe sees it without a keyboard too** (an earlier verifier's minor finding, recorded 2026-10-17): reading the radius right after clicking Edit finds the textarea at `2px`, because Angular focuses it when the editor opens and a focused text field matches `:focus-visible`. Observed live on `https://wheel.cuatro.dev` at 2026-10-17T08:21:24Z (`epic-8-evidence\8-spec-restyle-spec-amendment\live.txt`) |

The workspace's own `DESIGN.md` (`C:\CuatroEcosystem\list-wheel-workspace\DESIGN.md`, the Sentry-inspired
system the 2026-04 theme followed) is outside the repository. It now describes a design `list-wheel` no
longer renders; it was read and not touched (row R12). **Retired 2026-10-17** on the Operator's ruling: the file is
now a short pointer to the Cuatro token contract and `RESTYLE-SPEC.md`.

## `digital-library`, Story 8.2's adoption and restyle

Two branches, because Story 8.2's criteria make them **two merges** and the first is verified in
production before the second opens (`epics.md` Story 8.2, AD-20): `digital-library`
`restyle/8-2-adopt-contract` (`960050b`, from `origin/dev` `777814f`) adopts the contract, and
`restyle/8-2-visual-restyle` (`c138c6a`, `3c9b68c`, `3f2687b`, `c25f830`, on top of `960050b`) restyles.
The adopt branch goes to `dev` first (row R9); the restyle branch's PR opens only after that merge is
verified in production (row R10). Evidence, kept out of every repository:
`C:\CuatroEcosystem\epic-8-evidence\8-2-digital-library-adopts-the-contract-and-is-restyled\` (`before/`,
`adopt/` and `after/`: every page at 360 and 1280, the four widths, each `transcript.txt`; `after/`
also `greyscale-masked-grid.png`, `pixels.txt`, `reduced-motion.txt`, `image-css/` and `below-floor/`;
`method/`: the scripts, the scratch stack and its seed; `count.txt`).

### The floor this story measured (ruling R2 pending)

**Decision, by the builder of Story 8.2, as Story 8.1 decided for `cs-tracker`.** The strict floor is
`/login` and the error page (§ O-14). The restyle also covers what a signed-in reader reaches, which is
what the demo sign-in will reach: `/`, `/libraries/[id]` (the cover grid the story's § 10 criterion
names), `/libraries/[id]/books/[bookId]` and `/logout`. Below it, untouched beyond the adoption: `/admin`
(the only user of `src/lib/components/ui/`) and the reader at `.../read`, whose ground is the reader's
own theme setting (light, sepia or dark). Both still work on the dark ground (`after/below-floor/`).

**§ O-15, read closer.** The family A strategy stands, but the call sites are not the shadcn-svelte
`ui/` layer: no floor route imports it. The floor's component layer is the in-house `primitives/` and
`shell/` folders, so that layer is what was rewritten and counted.

### What changed

- **The adoption** (`960050b`). The nine token-contract files are vendored at
  `apps/web/src/lib/cuatro-contracts/`, each committed blob's sha256 equal to this repository's
  `contracts/` file at `46c8b68` (`tokens.css` `dd7bf3c2...`, `fonts.css` `c2c0a2f7...`). `layout.css`
  imports `tailwindcss`, then the plain `tokens.css` and `fonts.css` pair (not the adapter), then the
  application's own variables mapped onto the roles (hand-fix line 5), then hand-fix lines 1 to 4
  unlayered in the seams inventory's order. Its theme keys read the roles: `--font-display:
  var(--font-display)` had resolved only because an unlayered `:root` rule won (AD-14's case). Tailwind's
  stone palette, which the book page wrote, reads roles too for that one step (S-7: no surface stays
  light). Only stone and white were remapped, so on the adopt step alone the book page's format chip
  keeps Tailwind's light `emerald-100` ground; the restyle removes it (independent verifier, 2026-10-13). The four `@fontsource` packages are gone; Vite rebases `fonts.css`'s `url()`s, so the three
  woff2 ship hashed under `_app/immutable/assets/`. **The reset (Tailwind's preflight) clears no
  outline.** The only rules that do are utilities (`.outline-none`, `focus:outline-none`), which the
  unlayered `:focus-visible` beats, and `Input`'s own read-only rule, removed in the restyle.
- **The restyle** (`c138c6a` and the three after it). `Button` is the § 1 Control with no filled
  variant (`primary` and `inverted` render alike, a pressed segment carries the emphasis underline),
  `tertiary` is a § 1b Link; `Input` is the § 9 Field under a § 7 Label; `MonoKicker` is the § 7 Label;
  every `HardRule` weight is the Hairline; the round icon buttons are square Controls holding their glyph;
  `FilterStrip` is Tabs with `--s-lg` between Controls; the session bar, the nav and the footer sit on the
  page ground over hairlines, never on a band. `/`'s rows are § 2 rows (`grid-template-areas`, the one
  760px breakpoint, `minmax(0, 5fr)`), each one link, so the whole row stays its target. The cover grid is
  § 10 Media: `repeat(auto-fill, minmax(10rem, 1fr))` at `--s-md`, the border on the image box,
  `width="200" height="300"` on the image, the tile no card and no rule, and a missing cover the empty
  bordered box (its old in-box text sat inside an `aria-hidden` link; format, title and author still render
  beneath, but the catalogue number, `N° NN`, rendered nowhere else and is gone with the box: § 10 requires
  the box empty, so it stands, as the independent verifier ruled). The § 10 border sits on the `.cover`
  wrapper, which reserves the 2:3 space, not on the `img` itself; it renders the same, and an `img` that
  has not arrived could not hold the border open. The reading state is a § 5 mark: Unread dashed, Reading solid, Finished solid with the 4px
  square. The book page's Tailwind stone classes became classes reading the roles, `Read` a Control and the
  tags § 1b Links. A new `+error.svelte` renders SvelteKit's default error markup (`<h1>` status, `<p>`
  message) with § 8's type. `src/lib/tokens.css` (the alias layer) is deleted, and `@source not
  inline("shadow ring")` stops Tailwind minting `.shadow` and `.ring` from prose. **DOM order, routes,
  data and every string are unchanged**; a coverless tile's in-box text (format and catalogue number,
  title, author) is the only markup removed.
- **The check left behind**: `apps/web/src/lib/__tests__/restyle-floor.test.ts`, 18 cases: the vendored
  folder is the nine files with `Contract v2.0.0`; `layout.css` imports the pair and applies the hand-fixes
  in order, unlayered; on every floor source no ground other than the page's (and § 5's dot), no shadow,
  no gradient, no radius, no removed outline, no transitioned ring, no literal colour, no Tailwind palette
  utility. A planted `background: var(--token-accent)` on `Button` failed it (`1 failed | 17 passed`),
  then was reverted. Its hand-fix order case fails on a checkout with `core.autocrlf=true`, because its
  regex does not allow a carriage return before each line end (independent verifier, 2026-10-13). DW-352.

### The component layer's count (for Story 8.4)

**Observed 2026-10-13** by `method/count.mjs` over the floor's six routes and nine components:

| | `ui/` call sites on floor routes | In-house component call sites | Declarations the vocabulary forbids |
|---|---|---|---|
| Before, `777814f` | 0 | 51 | **92** (grounds on controls, 2px borders, a 50% radius, per-component 2px black rings, literal colours, stone, rounded and shadow utilities) |
| After, `c25f830` | 0 | 49 (the coverless tile's two `MonoKicker`s) | **0** |

### The floor, measured once by hand (AD-19)

**Observed 2026-10-13**, the runs starting 18:07:02Z (before), 18:09:21Z (adopt) and 18:12:09Z (after), by `method/measure.mjs` in Playwright `1.62.1`'s
Chromium `151.0.7922.34`, device scale factor 1, against the **production images** built from each sha
(`epic-scratch-8-2-web:before`, `:adopt`, `:restyle`) behind the production Caddyfile's routing, on a
scratch API and Redis seeded by `method/seed.py` and `seed-progress.py` (two libraries, one empty; seven
books, four with a cover; one Unread, two Reading, one Finished), signed in as a non-admin reader through
the form. Ten pages: `/login` and `/no-such-path` signed out, `/`, the grid, the grid filtered to nothing,
the empty library, `/logout`, a book with and without a cover, signed in.

| Reading, at 360x800 | Before `777814f` | Adopt `960050b` | After `c25f830` |
|---|---|---|---|
| Visible interactive elements read | 73 | 73 | 73 |
| Under `--tap` on either axis (F-10) | 41 | 41 | **0** |
| Two targets overlapping | 12 | 12 | **0** |
| A ground on a control at rest or on hover (F-4), fields excluded | 38 | 38 | **0** |
| A radius above 0 (F-5) | 8 | 8 | **0** |
| `transition-property` naming `all` or `outline` over a duration | 6 | 6 | **0** |
| Keyboard stops (360 and 1280) without a solid 2px ring (F-6) | 46 of 132 | 0 of 132 | **0 of 132** |
| Stops whose ring eases in | 12 | 12 | **0** |
| Horizontal scroll at 359, 390, 759, 761 | 6 | 3 | **0** |

| Check | After | How |
|---|---|---|
| F-1 | **Pass**: pixel (2,600) reads `6,5,9` on `/login`, `/` and the grid, equal to `--token-bg` drawn to a canvas (before: `body` `rgb(255, 255, 255)`) | the page's own screenshot, decoded in the page (`pixels.txt`) |
| F-2 | **Pass**: Bricolage Grotesque, Geist and Geist Mono `loaded` (before: none of the three loaded; the faces were Playfair, Source Serif, Inter, JetBrains Mono). **Read across the floor, not page by page** (added 2026-10-17 from an earlier verifier's minor finding): the error page (`/no-such-path`) has no interactive element and sets no text in the mono family, so it never loads Geist Mono, and that is correct. A later F-2 check run on that page alone would read Geist Mono as not loaded; it is not a failure, because the browser fetches a face only when some rendered text uses it | `document.fonts` status |
| F-3 | **Pass**: the nav's hairline reads `40,40,48`, equal to `--token-border` | a sampled rule |
| F-4, F-5, F-6, F-10 | **Pass**, the table above. The ring is `solid 2px oklch(0.84 0.13 288)` at the first stop of every page | browser readings |
| F-7 | **Fails as written, passes on the floor.** The image's CSS (53,137 bytes) has 0 gradients and 7 `box-shadow` rules: `:-moz-ui-invalid{box-shadow:none}` (Tailwind preflight's, the selector named 2026-10-17 from `image-css/grep.txt`) and six Tailwind utilities (`shadow-xs`, `-sm`, `-xl`, `-2xl`, `focus-visible:ring-1`, `-[3px]`) written only by `/admin`'s `ui/` components and the reader, below the floor. No floor element carries one. Story 8.1's DW-343 removed the same class of rule because it could; removing these means restyling `/admin`. DW-350 | grep of the image's built CSS (`image-css/grep.txt`) |
| F-8 | **Pass**: the one accent ground is `::selection` | the same grep |
| F-9 | **Pass**: `after/greyscale-masked-grid.png`, every word transparent: dashed, solid, and solid with the square tell Unread, Reading and Finished apart (before: the state was its word alone) | greyscale render, words masked |
| F-11 | **Pass**: `color-scheme: dark` (before `normal`); `::selection` `oklch(0.66 0.165 288)` on `oklch(0.12 0.011 288)` | computed style |
| F-12 | **Pass**: `/`'s rows are § 2's grid at both widths (`w759-picker.png`, `w761-picker.png`); controls and links meet § 1 and § 1b geometry at every width; the cover grid is § 10, the one place the row gives way | the four widths |

**§ 10's load check.** The grid on a throttled connection (400 ms latency, 50 KB/s), five covers still
loading at `DOMContentLoaded`: every title's top is the same before and after the images arrive
(`759` for all seven), cumulative layout shift `0.0009` (the font swap; before `0.0007`).

**SM-12's reduced-motion check.** Forced `reduce`, the book page's GSAP entrance still slides the cover
in (`matrix(..., -22.87, 0)` at 80 ms, settled at 400 ms), and the layout's route transition reads no
setting either. Finding 2.

**Gates.** `pnpm test` in `node:22-bookworm` (CI's Node), `c25f830`: **33 files, 560 tests passed**
(`777814f`: 32 files, 544; the 21 guards that pinned the WIRED design rewritten or retired with the
list and folds they held, net 3 fewer, then 18 in `restyle-floor.test.ts` and 1 for the reading marks). `pnpm typecheck`: `svelte-check
found 0 errors and 0 warnings`. The `960050b` adopt step alone: 544 passed, 0 errors. Both production
images built from `apps/web/Dockerfile` with `--frozen-lockfile`.

### Findings, recorded rather than corrected (AD-19)

1. **The grid's search field has no visible label** (§ 9; it carries `aria-label` and a placeholder). A
   visible label is microcopy and a field appearing, outside the ceiling. DW-349.
2. **The GSAP motion ignores `prefers-reduced-motion`** and is written in literal durations: the
   layout's route transition and the book page's entrance. Reading the setting is a behaviour change.
   DW-349.
3. **The book page's coverless box keeps its `No cover` text** (§ 10 forbids it). Unlike the grid's,
   it is read by a screen reader, so removing it is microcopy. DW-349.
4. **`Breadcrumb`, `StatusTag` and `EditorialTable` render on no route** and keep their WIRED geometry
   (`StatusTag` a gradient and fills), with their colours renamed onto the roles so nothing names a
   deleted variable. A story that renders one restyles it first. DW-349.
5. **F-7's scope**, above. DW-350.

## SM-12 per application, Story 8.4's record

**The record `RESTYLE-SPEC.md` § Recording a restyle asks for, per application**, written by Story 8.4 on
**2026-10-13** from the three sections above and from Story 8.4's own runs (evidence, kept out of every repository:
`C:\CuatroEcosystem\epic-8-evidence\8-4-record-the-restyle-floor-and-the-per-application-coherence-ch\`). **It is
recorded against the branch heads, not the live hostnames**: on 2026-10-13 every restyle is a branch or an open PR
awaiting the Operator, and `cs-tracker.cuatro.dev`, `library.cuatro.dev` and `wheel.cuatro.dev` still serve the
presentation from before Epic 8. SM-12 holds on a live hostname once its merge rolls (R3, R6, R9 then R10), and each of
those rows already names the production check.

| Field | `cs-tracker` | `digital-library` | `list-wheel` |
|---|---|---|---|
| Application id | `cs-tracker` | `digital-library` | `list-wheel` |
| Head measured | `restyle/8-1-visual-restyle` `32c0d73`, PR #11 to `dev`, open | `restyle/8-2-visual-restyle` `c25f830` (on adopt `960050b`, PR #66 to `dev`, open; the restyle PR opens after R9) | `restyle/8-3-visual-restyle` `c665ee9`, PR #4 to `main`, open |
| Framework family, as verified in Story 8.1 (§ O-15) | **A** (daisyUI 5.0.35 on Tailwind v4, plus `core_components.ex`) | **A, source-owned** (Tailwind v4, shadcn-svelte copied into `ui/`; the floor's layer is the in-house `primitives/` and `shell/`) | **C** (Angular only, no component library) |
| Surfaces inside the floor, by route (§ O-14) | Strict floor **empty** (every anonymous answer is a redirect, JSON or plain text). **The floor is the demo-reachable interior** (R2 (a), ruled 2026-10-17, `RESTYLE-SPEC.md` § The floor): `/`, `/browse`, `/inventory`, `/wishlist`, `/items/:id` and their shell | **`/login` and the error page**: R2 (a) applies only where nothing anonymous is the application's own, and `/login` is. Also restyled, beyond the floor: `/`, `/libraries/[id]`, `/libraries/[id]/books/[bookId]`, `/logout` (row R15 asks the Operator to confirm this reading) | `/`, whole, in the nine states its controls reach |
| Component-class call sites, before and after (family A) | **98 to 0**, 13 distinct components, by the bundle's own class list | `ui/` call sites on floor routes **0 and 0**; declarations the vocabulary forbids in the in-house layer **92 to 0** | Not applicable (family C) |
| AD-19 manual pass | **2026-10-13**, 15:37:20Z and 15:55:10Z, then the independent verifier's round 2 on the production image of `32c0d73`; found: 89 targets under `--tap` and 45 transitions naming `all` or `outline` before, 0 and 0 after; F-6 missed the date field's calendar stop until `32c0d73` (§ cs-tracker, correction); findings 1 to 6, and finding 7 from Story 8.4 below | **2026-10-13**, 18:07:02Z, 18:09:21Z, 18:12:09Z on the production images; found: 41 targets under `--tap` and 46 of 132 stops without a ring before, 0 and 0 after; findings 1 to 5, F-7 among them | **2026-10-13**, 17:31:29Z and 17:32:05Z on production builds; found: 73 targets under `--tap` and 3 ringless stops before, 0 and 0 after; findings 1 to 3 |
| Greyscale render, words masked | `greyscale\cs-tracker-greyscale-masked-browse.png`, `-inventory.png`, `-item-owned.png` | `greyscale\digital-library-greyscale-masked-grid.png` | `greyscale\list-wheel-greyscale-masked-empty.png`, `-history.png`, `-editor.png` |
| Contract version consumed, the Registry `token_contract` (`contracts/registry.json` 1.10.0) | **`2.0.0`** | **none**: the field is absent until the adopt branch is on `main` (DW-351, after R9) | **none**: absent until PR #4 is on `main` (DW-347, after R6) |

The greyscale files are copies, gathered in one folder under the evidence path above, of each story's own `after\`
renders.

### F-1 to F-12, pass or fail, each by the method `RESTYLE-SPEC.md` § The floor states

| # | `cs-tracker` | `digital-library` | `list-wheel` | The method each used |
|---|---|---|---|---|
| F-1 | **Pass** | **Pass** | **Pass** | Rendered pixel against `--token-bg` drawn to a canvas: `6,5,9` on every page sampled. For `cs-tracker` Story 8.1 read the computed ground, so Story 8.4 sampled it: `pixels-cs-tracker.txt`, four routes at 360 and 1280 |
| F-2 | **Pass** | **Pass** | **Pass** | `document.fonts.check()` true for all three families (`cs-tracker`, verifier round 2); each `FontFace` `loaded`, which needs the woff2 fetched and parsed (`digital-library`); `loaded` and the three woff2 at 200 in the network (`list-wheel`). None used `getComputedStyle().fontFamily`. Read per application across the floor: `digital-library`'s error page alone sets no mono text and so never loads Geist Mono, which is correct and not a fail (§ `digital-library`, F-2) |
| F-3 | **Pass** | **Pass** | **Pass** | A sampled rule against its own token at device scale factor 1 (H-5): the Hairline reads `40,40,48`, equal to `--token-border`, in all three; on `cs-tracker` (sampled by Story 8.4) a Control's border reads `101,100,113`, equal to `--token-border-interactive`, and the disabled sync Control's reads the Hairline, as § 1 Disabled says (`probe-offline.txt`) |
| F-4 | **Pass** | **Pass** | **Pass** | Every surface screenshotted at 360 and 1280, and every control read for a ground at rest and on hover: 0 in each |
| F-5 | **Pass** | **Pass** | **Pass on `c665ee9` as F-5 stood; Fail on `main` `0ee1fcb` as amended**, until R16 | Computed `border-radius` at rest (H-8): 0 above 0 in each. **Re-read 2026-10-17 as amended** (a field also at `0` while focused, I-11): `cs-tracker` `0px` on its text, search, date (every stop), select, textarea and checkbox fields, and its status dot `0px`; `digital-library` `0px` on `/login`'s two fields and the grid's search and sort; `list-wheel` `2px` on the focused textarea live (`0px` on its find fields and checkbox), `0px` on every field at fix commit `2d1b8b8`. `cs-tracker` and `digital-library` were read by keyboard in Chromium `151.0.7922.34` on a page carrying only each production image's own CSS (`cs-tracker` `32c0d73`, whose tree `origin/dev` `1e7cd07` carries unchanged; `digital-library` `c25f830`) and the field markup each source renders; `list-wheel` on `https://wheel.cuatro.dev` and on the fix build. Transcripts and scripts in `epic-8-evidence\8-spec-restyle-spec-amendment\` |
| F-6 | **Pass** | **Pass** | **Pass** | Keyboard-only traversal, every Tab press read: 188 stops, 132 stops, and every stop of the nine states, 0 without the solid 2px ring and 0 rings eased in |
| F-7 | **Pass** | **Pass, under R13 (a)** (2026-10-17; recorded **Fail** on 2026-10-13 under F-7 as it stood) | **Pass** | Grep of the built CSS. `digital-library`'s image CSS carries 7 `box-shadow` rules, `:-moz-ui-invalid{box-shadow:none}` and six Tailwind utilities that only `/admin`'s `ui/` components and the reader write, below the floor; no floor element carries one. On 2026-10-13 the method was binding as written, so it was a fail (DW-350, row R13). **Re-read 2026-10-17 by the amended method** (only the rules a floor surface can match): the one rule `/login` or the error page can match is `:-moz-ui-invalid{box-shadow:none}`, which draws none; `git grep` of `c25f830` finds the six utilities written only in `src/lib/components/ui/` (which no floor route imports), `src/lib/readers/PdfReader.svelte`, `routes/libraries/[id]/books/[bookId]/read/+page.svelte` and `routes/admin/libraries/[id]/+page.svelte`. Below the floor, recorded beside the check as the amended F-7 asks: the reader writes `shadow-xl` and `shadow-2xl` (row R15). `cs-tracker` passes from `32c0d73` (DW-343), its one rule the same `:-moz-ui-invalid{box-shadow:none}`; `list-wheel` 0 in its CSS and in the bundle where Angular inlines component styles |
| F-8 | **Pass** | **Pass** | **Pass** | Grep of the built CSS: the one accent ground in each is `::selection` |
| F-9 | **Pass** | **Pass** | **Pass** | The greyscale renders above, words made transparent: Owned, Wishlisted and Manual; Unread, Reading and Finished; enabled and disabled, checked and unchecked, each still told apart |
| F-10 | **Pass** | **Pass** | **Pass** | Boxes measured in Chromium at device scale factor 1, never read off the CSS: 0 under 44px on either axis; 0 adjacent overlaps (`cs-tracker`'s 15 are the open menu over content scrolled beneath the sticky header) |
| F-11 | **Pass** | **Pass** | **Pass** | Computed `color-scheme: dark` on `:root`; `::selection` `oklch(0.66 0.165 288)` on `oklch(0.12 0.011 288)` |
| F-12 | **Pass** (R14, ruled 2026-10-17) | **Pass** | **Pass** (R14, ruled 2026-10-17) | The four widths, 359, 390, 759 and 761. `digital-library`'s `/` rows are § 2's grid at both widths. `cs-tracker` and `list-wheel` render no § 2 row (Media grids, hairline rows, a seam S-6 table), so F-12 is read on their § 1 and § 1b geometry and the one 760px breakpoint, which `RESTYLE-SPEC.md` § The floor now states (R14) |

**Restyled, as § The floor counts it** (all twelve hold), **re-read 2026-10-17 under `RESTYLE-SPEC.md` `1.1.0`**:
**`cs-tracker` yes** (on R2 (a) and R14, both ruled 2026-10-17); **`digital-library` yes** (on R13 (a), on its strict
floor; it read no on 2026-10-13, on F-7 alone); **`list-wheel` yes on fix commit `2d1b8b8`, no on `main` `0ee1fcb`**,
on the amended F-5 alone (the focused textarea), until R16 merges and deploys. On 2026-10-13 the verdicts were
`cs-tracker` yes and `list-wheel` yes, `digital-library` no. No F-check covers motion, so the floor count does not see the one manual check that fails in all three
(below): **SM-12's four checks are clean in no application**, and each failure is a finding, not a correction. **F-4, F-6 and F-10 were the three that failed most often before**, as the epic expected: 85, 0 and 89
in `cs-tracker`, 38, 46 and 41 in `digital-library`, 61, 3 and 73 in `list-wheel`. F-6 also failed while appearing to
pass in `cs-tracker`, the one stop the first traversal never pressed.

### SM-12's four manual checks, and AD-19's measured floor

| Check | `cs-tracker` | `digital-library` | `list-wheel` |
|---|---|---|---|
| Keyboard-only traversal | **Pass** (F-6) | **Pass** (F-6) | **Pass** (F-6) |
| 360px, no horizontal scroll (also 359, 390, 759, 761) | **Pass** | **Pass** | **Pass** |
| Greyscale, the Status taxonomy still tellable | **Pass** (F-9) | **Pass** (F-9) | **Pass** (F-9) |
| `prefers-reduced-motion` forced | **Fail, finding**: the disconnect notice still fades in and slides 16px over 300 ms; everything else stops | **Fail, finding**: the GSAP route transition and the book page's entrance still move (finding 2, DW-349) | **Fail, finding**: Spin still turns the wheel (finding 2, DW-345) |
| AD-19's 44 by 44, measured in a browser | **0 under** | **0 under** | **0 under** |
| The ring against all three grounds | **Visible**: read in the browser on `--token-bg` and on the flash's `--token-bg-raised` | **Visible**: read on `--token-bg` | **Visible**: read on `--token-bg` |
| The ring not transitioned | **0 eased** | **0 eased** | **0 eased** |

**Observed 2026-10-13, Story 8.4: `cs-tracker`'s reduced-motion check**, which Story 8.1 had not run. `method/rm-cs-tracker.mjs`
against the production image of `32c0d73` (`docker build` from `git archive`, `epic-scratch-8-4-cs-tracker:32c0d73`,
`bin/migrate` then the release on a scratch `postgres:16` with an empty database, the kill switch on, a session minted
inside the release, `method/tls-proxy.mjs` in front so the socket meets `check_origin`), Chromium `151.0.7922.34`,
360x800, at 19:33:38Z (`reduce`) and 19:33:52Z (`no-preference`). With `reduce` forced: 0 running animations after load,
0 elements with a transition or animation over 1ms (6 without it: the Controls' 120 ms border colour and the reconnect
icon's spin), and the reconnect icon's `animation-name` `none`. Then the app's container was stopped so the socket
dropped: the generator's disconnect notice runs `show/2`'s `transition-all ease-out duration-300` from `opacity-0
translate-y-4`, and under `reduce` it still went from opacity 0 and `translate 0px 16px` to 1 and `0px 0px` over about
300 ms, frame for frame the same as `no-preference` (`rm-cs-tracker-reduce.txt`, `rm-cs-tracker-no-preference.txt`). The
Controls' transition collapses because it reads `--dur-micro`, which the contract sets to 1ms under `reduce`; the
generator's `duration-300` is a literal Tailwind utility the contract cannot reach. Finding 7 below. Every scratch
object was removed afterwards.

**The ring against all three grounds, computed.** The ring is `--c-focus`, and the three grounds are `--token-bg`,
`--token-bg-raised` and `--token-bg-raised-2`. The vendored `tokens.css` is byte for byte the Anchor's on all three heads
(sha256 `dd7bf3c2ab826c8480e1fdca1ea51ba0d5377d202b4024976b9f9a6dc0e43e32` for the Anchor's `contracts/tokens.css` at
`5b7395b`, `cs-tracker` `32c0d73` and `origin/main` `4d94dbc`, `digital-library` `960050b`, `list-wheel` `c665ee9`), so
the ring's contrast is the same in each: **11.70:1, 11.19:1 and 10.45:1** (`method/ring-contrast.mjs`, OKLCH to sRGB
relative luminance, `ring-contrast.txt`), every one above the 3:1 a non-text indicator needs. No restyled surface
in `digital-library` or `list-wheel` paints `--token-bg-raised` or `--token-bg-raised-2`, so the browser readings there
are on the page ground only.

**Finding 7, recorded rather than corrected (AD-19).** `cs-tracker`'s disconnect notices ignore `prefers-reduced-motion`:
`show/2` and `hide/2` in `core_components.ex` carry literal `duration-300` and `duration-200` utilities. Adding a
`motion-reduce:` variant would change no behaviour, but it is a change to the generator's JS commands that Story 8.1 did
not make and Story 8.4 does not make (it records). DW-354.

### Each application's vendored contract version, against the current one

| | The contract now | `cs-tracker` | `digital-library` | `list-wheel` |
|---|---|---|---|---|
| Vendored on the default branch (what the live hostname serves) | `Contract v2.0.0` (`contracts/tokens.css`) | `v2.0.0` at `assets/css/cuatro-contracts/` (`main` `4d94dbc`) | **none** (`main` `8d48846` has no `cuatro-contracts/`) | **none** (`main` `718f194`) |
| Vendored on the restyle head | | `v2.0.0` (`32c0d73`) | `v2.0.0` at `apps/web/src/lib/cuatro-contracts/` (`960050b`) | `v2.0.0` at `src/styles/cuatro-contracts/` (`c665ee9`) |
| Behind? | | **No** | **Not adopted** until R9 | **Not adopted** until R6 |

Remote heads read by `git ls-remote` at 2026-10-13T19:39:35Z, each equal to the local `origin/` ref the blobs were read
from. **This is the gap AD-18 does not cover, by design, not a duplicate of it.** AD-18's scheduled check compares each
Satellite's `token_contract` with **its own vendored file**, so an application that vendored `v2.0.0` and declares
`2.0.0` passes it whether the contract has since moved to `v3.0.0` or not. Only a row like this one, the vendored version
beside the current one, shows who is behind; on 2026-10-13 no adopter is.

### SM-C6

**SM-C6 reads zero.** All three are `status: Live` in every Registry release from `1.1.0` to `1.10.0` (the 14 commits to
`contracts/registry.json` since 2026-09-01, read one by one), so the Suite Directory, which renders `Live` and `Complete`
(`apps/hub/lib/registry.ts`, `selectRendered`), rendered each before any restyle opened. Observed live too:
`https://cuatro.dev/` answered 200 at 2026-10-13T19:35:30Z and links `https://cs-tracker.cuatro.dev`,
`https://library.cuatro.dev` and `https://wheel.cuatro.dev` once each. No restyle work item exists for an unrendered
application.

**`RESTYLE-SPEC.md` counts twelve.** The epic's note that § Recording a restyle reads `F-1 … F-11` and § The floor
"eleven" is resolved: both read twelve in the file as it stands (§ The floor, "all **twelve** hold"; § Recording a
restyle, `F-1 … F-12`).

## Pending Operator actions

| # | Action | Owner | Note | Completed (UTC) |
|---|---|---|---|---|
| R1 | **Sign off the `cs-tracker` restyle visually** (a ruling) | Operator | Added 2026-10-13. Look at `/`, `/browse` (and filtered to nothing), `/inventory`, `/wishlist`, `/items/:id` unowned and owned, at 360 and 1280, plus the open mobile menu and the offline banner. Before and after are `C:\CuatroEcosystem\epic-8-evidence\8-1-cs-tracker-visual-restyle\before\` and `after\` (`<route>-360.png`, `<route>-1280.png`), greyscale renders in `after\greyscale-masked-*.png`. The seed's data-URI images render as their alt text in both sets, so judge the tiles' geometry, not their pictures | Signed off 2026-10-17T07:53:14Z: the Operator merged PR #11 on the handover of 2026-10-13, which asked for this sign-off before that merge |
| R2 | **Rule on the floor's denominator for an application whose anonymous surfaces are a redirect, plain text and the issuer's page** | Operator | Added 2026-10-13. § O-14: cs-tracker's strict floor is empty, digital-library's is `/login` and its error page. Options: (a) the demo-reachable interior counts as the floor, which Story 8.1 assumed and built; (b) the strict floor stands, Story 8.1's restyle is beyond it, and 8.2 restyles two surfaces | Ruled 2026-10-17: **(a)**, for an application whose anonymous surfaces are a redirect, plain text and the issuer's page. Written into `RESTYLE-SPEC.md` § The floor (`1.1.0`) and § SM-12 per application re-read the same day by the specification amendment story |
| R3 | **Merge `cs-tracker` PR #11 (`restyle/8-1-visual-restyle`, `32c0d73`, opened by the independent verifier on 2026-10-13) into `dev`, then `dev` into `main`, then roll `cs-tracker`** by the standing redeploy (`ops/cs-tracker-cutover.md` § Later rollouts), no step of its own | Operator | Added 2026-10-13. The independent verifier pushed the branch and opened PR #11 to `dev` on 2026-10-13; `gh pr checks 11` reports no checks and the check-runs and status APIs on `32c0d73` count 0, because cs-tracker has no CI and no `.github/`; the gate is `mix precommit` (715 tests, 0 failures, 4 excluded, on `32c0d73`) and the production image's boot, both above. Nothing changes how it starts; the assets change, which is why the image was booted | Part done 2026-10-17T07:53:14Z: PR #11 merged into `dev` as `1e7cd07`. Pending: `dev` into `main`, then the roll |
| R4 | **Note that Stories 8.2 and 8.3 open on a changed strategy** | Operator | Added 2026-10-13. § O-15: `digital-library` is family A in its source-owned form, not C; `list-wheel` is C, not B. `epics.md` says the strategy changes before each opens; both were dispatched in parallel with this story | _not done_ |
| R5 | **Sign off the `list-wheel` restyle visually** (a ruling) | Operator | Added 2026-10-13. The one surface, `/`, in the nine states its controls reach: `empty`, `empty-fallback` (the file input a browser without File System Access gets), `loaded`, `banner`, `winner`, `winner-url`, `copied`, `history`, `editor`, at 360 and 1280. Before and after are `C:\CuatroEcosystem\epic-8-evidence\8-3-list-wheel-visual-restyle\before\` and `after\` (`<state>-360.png`, `<state>-1280.png`; `empty` and `winner` also at 359, 390, 759 and 761), greyscale renders in `after\greyscale-masked-*.png`. A hovered control in a 1280 shot shows its hover border, the one thing hover changes. The independent verifier's own renders of the same states are in `verifier\` beside them, with the measurement's `report.json`; look at the winner badge's border, which scales with the wheel to about 3px at 1280 (I-6) | Signed off 2026-10-17T07:58:34Z: the Operator merged PR #4 on the handover of 2026-10-13, which asked for this sign-off before that merge |
| R6 | **Merge the `list-wheel` PR from `restyle/8-3-visual-restyle` (PR [#4](https://github.com/LuigiEspinosa/list-wheel/pull/4), head `c665ee9`, two commits, opened to `main` by the independent verifier on 2026-10-13) into `main`**, which is the deploy: `.github/workflows/deploy.yml` runs its `test` job, then its `deploy` job (the Capacity Gate, then `ops/deploy-remote.sh` on the box, which builds there, KV-1). No step by hand on the box | Operator | Added 2026-10-13. PR #4 reports no checks (`deploy.yml` runs on a push to `main` only; check-runs and statuses on `c665ee9` count 0). A dated completion names the Deploy run on the merge sha and both its jobs, never "CI green" (Epic 5 retro action 8); `main` is unprotected and no check is required, so read the run. Then `https://wheel.cuatro.dev/` answers 200 with a `styles-*.css` and three `media/*.woff2` at 200, and no `googleapis`. DW-347 follows: the adoption observation, then the Registry `token_contract` | Done 2026-10-17T07:58:34Z: PR #4 merged into `main` as `0ee1fcb`. Deploy run 39015622421 on `0ee1fcb`: `test` success, `deploy` success (`report` skipped). Checked 2026-10-17T08:01:46Z: `https://wheel.cuatro.dev/` 200, `styles-W6ATMQFT.css` with `--token-*` roles, `media/bricolage-grotesque-latin-STMCHML5.woff2`, `media/geist-latin-LIRDV4QV.woff2` and `media/geist-mono-latin-PAW6OWVW.woff2` 200, no `googleapis` in the page or the stylesheet. DW-347 next |
| R7 | **Rule on Story 8.3's specification defects, I-1 to I-11** (`list-wheel` § Where the implementer had to infer): amend `RESTYLE-SPEC.md` per point, or accept what 8.3 chose as the reading | Operator | Added 2026-10-13. `epics.md` Story 8.3 sends these back to the specification rather than solving them locally; wave 2 (8.5, 8.6) meets the same points in two more frameworks. DW-346 | Ruled 2026-10-17: accept 8.3's readings for I-1 to I-10 as recorded, except that I-10's dot is square (`DESIGN.md`, no radius); I-11, a field's focus ring takes no radius. Written into `RESTYLE-SPEC.md` `1.1.0` (§ Readings settled 2026-10-17) the same day; DW-346 closed; the `list-wheel` defect it exposes is R16 |
| R8 | **Sign off the `digital-library` restyle visually** (a ruling) | Operator | Added 2026-10-13. Look at `/login` and the error page (`/no-such-path`) signed out, then signed in: `/`, the grid (and filtered to nothing, and the empty library), a book with a cover and one without, and `/logout`, at 360 and 1280. Before, adopt and after are `C:\CuatroEcosystem\epic-8-evidence\8-2-digital-library-adopts-the-contract-and-is-restyled\before\`, `adopt\` and `after\` (`<page>-360.png`, `<page>-1280.png`; `w359-`, `w390-`, `w759-`, `w761-` for `/login`, `/`, the grid and a book), the greyscale render `after\greyscale-masked-grid.png`, and `/admin` and the reader below the floor in `after\below-floor\`. The seed's covers are flat colour blocks; judge the geometry, not the pictures | Signed off 2026-10-17T07:58:01Z: the Operator merged PR #66 on the handover of 2026-10-13, which asked for this sign-off before that merge |
| R9 | **Merge the adopt branch, `digital-library` `restyle/8-2-adopt-contract` (head `960050b`, one commit), (PR [#66](https://github.com/LuigiEspinosa/digital-library/pull/66), opened to `dev` by the independent verifier on 2026-10-13) into `dev`, then `dev` into `main`, then redeploy** by `digital-library`'s standing redeploy, its README § Deploying (the box's `~/library-redeploy.sh`, `ops/demo-principal.md` DL3); nothing in this change adds a step by hand on the box | Operator | Added 2026-10-13. Story 8.2 makes adopt and restyle two merges, the first verified in production before the second opens. A dated completion names the runs read on each merge sha, `ci.yml` (`CI`) and `test.yml` (`Test`, on `main`), never "CI green" (Epic 5 retro action 8). The production check: `https://library.cuatro.dev/login` 200 on the dark ground, the three woff2 under `/_app/immutable/assets/` 200, `document.fonts` loading Bricolage Grotesque, Geist and Geist Mono. Then DW-351: the dated adoption observation, then the Registry `token_contract` | Part done 2026-10-17T07:58:01Z: PR #66 merged into `dev` as `4843bf2`. Pending: `dev` into `main`, the redeploy, the production check |
| R10 | **After R9's production check, merge the restyle branch, `restyle/8-2-visual-restyle` (head `c25f830`, four commits on `960050b`), once its PR to `dev` is opened (the branch is pushed, 2026-10-13, with no PR; opening it after R9 is an agent step), then `dev` into `main`, then redeploy** the same way | Operator | Added 2026-10-13. The PR is not opened before R9 is done (`epics.md` Story 8.2: "the first is verified in production before the second opens"); after the adopt merge the branch carries only its four commits over `dev`. Name the runs read on each merge sha, as R9. The production check is R8's surfaces on `https://library.cuatro.dev` | Part done 2026-10-17: PR [#67](https://github.com/LuigiEspinosa/digital-library/pull/67) opened to `dev` by the orchestrator before R9's production check, against this row, and converted to draft at once; it stays a draft until R9's check passes |
| R11 | **Rule on the workspace's `DESIGN.md` (WIRED editorial)**, which `digital-library-workspace/AGENTS.md` calls "the law" and which the restyle supersedes for every surface it touched | Operator | Added 2026-10-13. Both files are the Operator's, at the workspace root outside any repository, and Story 8.2 did not touch them. Options: retire it, or amend it to name the Cuatro contract and `RESTYLE-SPEC.md` as the source for the floor's surfaces. Until then, an agent reading the workspace first is told to keep the light WIRED system | Ruled 2026-10-17: retire. Done 2026-10-17 by the specification amendment story: `digital-library-workspace/DESIGN.md` is a short pointer to the contract and `RESTYLE-SPEC.md`, and the workspace `AGENTS.md` lines that called it the law name those instead (both files outside any repository, so no commit carries them; the old text of both is kept at `epic-8-evidence\8-spec-restyle-spec-amendment\retired\`) |
| R12 | **Rule on `list-wheel`'s workspace `DESIGN.md`** (`C:\CuatroEcosystem\list-wheel-workspace\DESIGN.md`, the Sentry-inspired system the 2026-04 theme followed), which no longer describes what `list-wheel` renders once PR #4 merges | Operator | Added 2026-10-13 from Story 8.3's independent verifier, as R11 is for `digital-library`. The file is the Operator's, outside any repository, and no story touched it. Options: retire it, or amend it to name the Cuatro contract and `RESTYLE-SPEC.md` | Ruled 2026-10-17: retire. Done 2026-10-17 by the specification amendment story: `list-wheel-workspace/DESIGN.md` is a short pointer to the contract and `RESTYLE-SPEC.md`, outside any repository, so no commit carries it; the workspace has no `AGENTS.md` or `CLAUDE.md`, so no instruction line named it. The old text is kept at `epic-8-evidence\8-spec-restyle-spec-amendment\retired\` |
| R13 | **Rule on F-7's scope for `digital-library`** (DW-350): (a) amend `RESTYLE-SPEC.md` § The floor so F-7 greps only the rules a floor surface can match, which passes `digital-library` as it stands; or (b) keep F-7 as written, so `digital-library` counts as restyled only once `/admin`'s `ui/` components and the reader stop writing the six `box-shadow` utilities, a restyle of surfaces below the floor | Operator | Added 2026-10-13 by Story 8.4, which recorded F-7 as a fail by the binding method (§ SM-12 per application). `cs-tracker` met F-7 as written by not emitting daisyUI's unused rules (DW-343); `digital-library` cannot do the same without touching `/admin`. Until this is ruled, `digital-library` reads restyled: no | Ruled 2026-10-17: **(a)**. Written into `RESTYLE-SPEC.md` § The floor, F-7 (`1.1.0`); `digital-library` re-read the same day: F-7 passes and it reads restyled: yes (§ SM-12 per application). DW-350 closed |
| R14 | **Rule on F-12's stated reading for an application that renders no § 2 row** (`cs-tracker`, `list-wheel`): accept that F-12 is read on § 1 and § 1b geometry and the one `760px` breakpoint, or amend `RESTYLE-SPEC.md` § The floor so F-12 says what an application without a § 2 row is compared against | Operator | Added 2026-10-13 by Story 8.4's independent verifier. § SM-12 per application records both as F-12 "Pass, on a stated reading", so their "restyled: yes" stands on this reading as well as on R2 (a). Wave 2 (8.5, 8.6) meets the same question | Ruled 2026-10-17: accept the stated reading. Written into `RESTYLE-SPEC.md` § The floor, F-12 (`1.1.0`) the same day |
| R15 | **Confirm that R2 (a) leaves `digital-library` on its strict floor** (`/login` and the error page), so the reader and `/admin` stay below it | Operator | Added 2026-10-17 by the specification amendment story. The ruling reads "for an application whose anonymous surfaces are a redirect, plain text and the issuer's page", and `digital-library` renders its own `/login`, so `RESTYLE-SPEC.md` § The floor keeps its strict floor and its restyled interior is beyond it. Read the other way, the demo principal's interior would count, and that includes the reader: the demo fixture is three PDFs (`ops/demo-principal.md`), and the reader writes `shadow-xl` (`PdfReader.svelte`) and `shadow-2xl` (`read/+page.svelte`), so F-7 would fail again and the reader's light and sepia themes would meet F-1. `digital-library` has no demo account yet (DW-337), so nothing reaches that interior today. If the Operator rules the other way, F-7 and F-1 are re-read and the reader becomes restyle work | _not done_ |
| R16 | **Merge the `list-wheel` PR from `fix/8-spec-field-focus-radius` (PR [#5](https://github.com/LuigiEspinosa/list-wheel/pull/5), head `2d1b8b8`, one commit on `main` `0ee1fcb`, pushed and opened to `main` by the independent verifier on 2026-10-17) into `main`**, which is the deploy, as R6: `.github/workflows/deploy.yml` runs `test`, then `deploy`. No step by hand on the box | Operator | Added 2026-10-17 by the specification amendment story. Under I-11 as ruled, `list-wheel`'s editor textarea is `2px` round while it holds focus (live, 2026-10-17T08:21:24Z); the commit keeps the textarea and the find fields square at `:focus-visible` and adds a `restyle.spec.ts` case (planted before the fix: `1 FAILED, 148 SUCCESS`; after: `149 SUCCESS`). PR #5 reports no checks (`deploy.yml` runs on a push to `main` only; check-runs and statuses on `2d1b8b8` count 0, read 2026-10-17). A dated completion names the Deploy run on the merge sha and both its jobs, never "CI green". The production check: after clicking Edit on `https://wheel.cuatro.dev/`, the focused textarea's computed `border-radius` is `0px` (`epic-8-evidence\8-spec-restyle-spec-amendment\method\probe-list-wheel.mjs`) | _not done_ |

**Maintaining this file.** When an action is performed, replace its `_not done_` cell with the ISO
8601 UTC date and leave the row in place.
