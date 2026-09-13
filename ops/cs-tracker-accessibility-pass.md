# `cs-tracker` accessibility pass

The written record of the AD-19 pass Story 1-20 made over `cs-tracker` after its token adoption:
every visible interactive element on six pages measured with `boundingBox()` in a real Chromium at a
360px-wide viewport against the contract's 44x44 floor, the focus ring read under a real Tab press
on an element sitting on each of the three grounds with `:focus-visible` confirmed and its contrast
computed, every failure recorded as a numbered finding and none of them corrected, and the probe
transcript verbatim.

Written during Story 1-20 on **2026-08-27** (ISO 8601 UTC), against baseline commit `b1ab824` in
`cuatro-portfolio` and `8adb8e2` in `cs-tracker`, and re-run the same day after the story's review
patched the probe; the figures below are the re-run's.

This file is a record, not Registry data, and nothing here is a published contract surface. It
follows the pattern `ops/cs-tracker-token-adoption.md` and `ops/contract-adoption.md` set: every
value is marked **Observed** with its method or **Decision** with its reason (NFR-9), and every date
is ISO 8601 UTC. **Epic 1 story ids are written hyphenated**, as `Story 1-20`; later epics keep
`epics.md`'s dotted form, as `Story 8.1`.

**Nothing in `cs-tracker` was changed by this pass.** AD-19's rule is that a failure is recorded as a
finding rather than silently corrected out of scope, and daisyUI's control geometry is Story 8.1's
restyle under `RESTYLE-SPEC.md` § Family A (AD-20: a step carries nothing else). The only file this
story edits in `cs-tracker` is `AGENTS.md`, for the automation policy, and that edit is not part of
this pass.

## What this pass did, in one paragraph

A Postgres 16 container was started, `cs-tracker`'s development database was created, migrated and
seeded through the application's own schemas from a script outside the repository, the assets were
built, and `mix phx.server` was started with the Owner id in `STEAM_ID` and the kill switch on so no
outbound HTTP left the host. `ops/cs-tracker-accessibility-probe.mjs` then minted the Owner's
session cookie from the committed development secret and salt, proved it by the gate it passes,
opened each of the five owner routes and the sign-in failure page in Playwright's Chromium at
360x800, revealed the mobile menu through the application's own hamburger, let running animations
settle, read every interactive element's bounding box against `--tap` read off `:root`, pressed Tab
until an element on each of the three grounds held focus and read its outline, its `:focus-visible`
state and its ground, and read every element's `transition-property` and `transition-duration`. It
printed a verdict per named case and a numbered finding per failure, and exited 1.

## The headline result

| Figure | Value | Nature |
|---|---|---|
| Pages measured | 6: `/`, `/browse`, `/inventory`, `/wishlist`, `/items/1`, and `/auth/steam/callback?openid.mode=bad` (the sign-in failure page, 401) | **Decision.** The five owner routes `router.ex:46-59` declares, and the one page an anonymous visitor sees |
| Interactive elements read | **117** | **Observed 2026-08-27** |
| Skipped as hidden or zero-area, never counted as passed | **38**: the four desktop nav links (`hidden md:flex`) and the two hidden flash close buttons on every page, plus the two desktop-only buy links on `/items/1` | **Observed 2026-08-27** |
| Measured | **79** | **Observed 2026-08-27** |
| At or over 44x44 on both axes | **5** | **Observed 2026-08-27**: the recently-viewed card and the three quick-link cards on `/`, and the mark-as-owned toggle on `/items/1` |
| Under the floor on at least one axis | **74**, findings F-1 to F-74 below | **Observed 2026-08-27** |
| Focus ring, `--token-bg` | `2px solid rgba(198, 189, 255)` at `3px`, `:focus-visible` true, **11.73:1**, transition-property does not name the outline, on the hamburger | **Observed 2026-08-27**, PASS |
| Focus ring, `--token-bg-raised` | the same four values, `:focus-visible` true, **11.24:1**, on the dashboard's "Browse all" link, whose `transition-property` is `all` over a `transition-duration` of `0s`, which never animates | **Observed 2026-08-27**, PASS |
| Focus ring, `--token-bg-raised-2` | the same four values, `:focus-visible` true, **10.47:1**, not transitioned, on a **planted** daisyUI `.btn`, because no interactive element in the application sits on that ground on any of the six pages | **Observed 2026-08-27**, PASS on a planted control, and the absence is a finding |
| Elements whose `transition-property` names `outline` or `all` over a duration above zero | **38**, findings T-1 to T-38 below | **Observed 2026-08-27** |
| Elements naming `outline` or `all` over `0s`, excluded because they never animate | **29**, listed below | **Observed 2026-08-27** |
| Probe exit | `1`: 13 named cases, 6 PASS, 7 FAIL, 27.6 s | **Observed 2026-08-27** |
| Fixed | nothing | **Decision.** AD-19, AD-20 |

## Environment

| Property | Value | Nature |
|---|---|---|
| Host | Windows 11 Pro 10.0.26200, the development host | **Observed** |
| Browser | Playwright `1.62.1` from this repository's `node_modules`, Chromium `151.0.7922.34`, headless | **Observed**, printed by the probe |
| Viewport | 360x800 CSS pixels, device scale factor 1 | **Decision.** AD-19 names 360 |
| `cs-tracker` | `C:\CuatroEcosystem\cs-tracker-workspace\cs-tracker`, branch `main`, clean. The first run was at `8adb8e2`, Story 1-19's closing commit; the re-run whose transcript is below was at `32a466a`, which is `8adb8e2` plus this story's `AGENTS.md` commit and the Operator's `32a466a` (`mix.exs` only: `cuatro.fonts` taken out of the `assets.setup` alias so the container build can run). Nothing under `lib/`, `assets/` or `priv/` differs between the two, so the pages measured are the same | **Observed** |
| Elixir | `elixir --version` reports `Erlang/OTP 28 [erts-16.4] [source] [64-bit] [smp:12:12] [ds:12:12:10] [async-threads:1] [jit:ns]` on its first line, and `Elixir 1.19.5 (compiled with Erlang/OTP 26)` on its last; Mix 1.19.5. The server ran on OTP 28 | **Observed** |
| Database | `postgres:16` in Docker 29.7.2, container `cuatro-1-20-pg`, PostgreSQL 16.14, published on `127.0.0.1:5432`, user `postgres`, password `postgres`, which is what `config/dev.exs:4-11` expects. Removed after the run | **Decision** |
| Schema | `mix ecto.create` then `mix ecto.migrate`, `MIX_ENV=dev`, all ten migrations forward | **Observed** |
| Seed | `mix run <scratchpad>/seed.exs`, the script quoted below: 12 items, 4 inventory entries, 3 wishlist entries, 1 ownership mark, 3 price snapshots; first item id `1` | **Observed** |
| Assets | `mix assets.build`: `priv/static/assets/css/app.css` at 131,265 bytes, the figure Story 1-19 recorded, and `mix cuatro.fonts` placing the three faces beside it (`assets.build` still runs it at `32a466a`; only `assets.setup` no longer does) | **Observed** |
| Server | `mix phx.server` with `MIX_ENV=dev`, `STEAM_ID=76561198000000000`, `KILL_SWITCH=true`, started through `cmd /c` with both streams redirected to log files; ready when the failure page answered 401 | **Decision.** The id is `test/support/conn_case.ex:39`'s; the kill switch gates every outbound path, `KillSwitch.allow!/0` in each price source, the catalog and inventory syncs, the Steam verifier, and `do_connect/1` of the BitSkins socket, so the run leaves the host only for `localhost` |
| Probe | `node ops/cs-tracker-accessibility-probe.mjs`, no arguments, defaults `http://127.0.0.1:4000` and the id above | **Decision** |

### The seed script, quoted so the run is repeatable

It lives outside `cs-tracker` on purpose, under the session scratchpad, and refuses to run against
a database that already holds items. Every write goes through the application's own schemas and
changesets where one exists (`Item.changeset/2`, `Wishlist.Entry.changeset/2`,
`OwnershipMark.changeset/2`), and through the bare struct where the schema is worker-written by
design (`Inventory.Entry`, `Prices.Snapshot`). The image is a data URI so the browser fetches
nothing off the host.

```elixir
alias CsTracker.Repo
alias CsTracker.Catalog.Item
alias CsTracker.Inventory.Entry
alias CsTracker.Inventory.OwnershipMark
alias CsTracker.Prices.Snapshot
alias CsTracker.Wishlist.Entry, as: WishlistEntry

if Repo.aggregate(Item, :count) > 0 do
  raise "the dev database already holds items; this seed is written for an empty one"
end

now = DateTime.utc_now() |> DateTime.truncate(:second)

image =
  "data:image/svg+xml," <>
    URI.encode(
      ~s(<svg xmlns="http://www.w3.org/2000/svg" width="256" height="192"><rect width="256" height="192" fill="#16151c"/></svg>)
    )

weapons = ~w(AK-47 M4A4 AWP Glock-18)
categories = ~w(Rifle Rifle Sniper\ Rifle Pistol)
rarities = ~w(Covert Classified Restricted Mil-Spec)

items =
  for n <- 1..12 do
    i = rem(n - 1, 4)
    name = "#{Enum.at(weapons, i)} | Probe Finish #{n}"
    mhn = "#{name} (Field-Tested)"

    %Item{}
    |> Item.changeset(%{
      classid: "9000000000#{n}",
      market_hash_name: mhn,
      name: name,
      name_history: [mhn],
      category: Enum.at(categories, i),
      rarity: Enum.at(rarities, i),
      collection: "The Probe Collection",
      type: "Skin",
      weapon: Enum.at(weapons, i),
      image_url: image,
      release_date: ~D[2026-01-15],
      source: "bymykel",
      source_id: "probe-#{n}",
      last_synced_at: now
    })
    |> Repo.insert!()
  end

for {item, n} <- Enum.with_index(Enum.take(items, 4), 1) do
  Repo.insert!(%Entry{
    assetid: "800000000#{n}",
    classid: item.classid,
    instanceid: "0",
    item_id: item.id,
    float: Decimal.new("0.2#{n}"),
    paintseed: 100 + n,
    exterior: "Field-Tested",
    stickers: [],
    raw: %{},
    last_synced_at: now
  })
end

for item <- Enum.slice(items, 4, 3) do
  %WishlistEntry{}
  |> WishlistEntry.changeset(%{item_id: item.id, target_price_cents: 1250, notes: "probe note"})
  |> Repo.insert!()
end

%OwnershipMark{}
|> OwnershipMark.changeset(%{item_id: Enum.at(items, 7).id, note: "probe mark"})
|> Repo.insert!()

for {source, min, median} <- [{"csfloat", 1234, 1500}, {"steam_market", 1300, nil}, {"skinport", nil, nil}] do
  Repo.insert!(%Snapshot{
    item_id: hd(items).id,
    source: source,
    min_price_cents: min,
    median_price_cents: median,
    count_available: if(min, do: 3, else: 0),
    best_listing_url: if(min, do: "https://example.invalid/#{source}", else: nil),
    observed_at: now,
    raw: %{}
  })
end

IO.puts(
  "seeded #{length(items)} items, 4 inventory entries, 3 wishlist entries, 1 ownership mark, 3 price snapshots; first item id #{hd(items).id}"
)
```

**What the `categories` line seeded.** `~w(Rifle Rifle Sniper\ Rifle Pistol)` is five words, not
four: the `~w` sigil splits on whitespace after processing escapes, so `Sniper\ Rifle` is `Sniper`
and `Rifle` (`elixir -e` prints `["Rifle", "Rifle", "Sniper", "Rifle", "Pistol"]`), and
`Enum.at(categories, i)` for `i` in `0..3` gives `Rifle`, `Rifle`, `Sniper`, `Rifle`. Every Glock-18
item was seeded as `Rifle` and no item as `Pistol`, which is why the `/browse` category select reads
"All categories Rifle Sniper" in F-15 and in the transcript while the rarity select carries four. The
script is quoted as it ran; a re-run that wants four categories writes the line as
`categories = ["Rifle", "Rifle", "Sniper Rifle", "Pistol"]`. The measurements are unaffected: the
select's height is what fails, not its option count, and no other control reads the category.
**Observed 2026-08-27**, found on review.

### How to re-run it, in six commands

Assumed done once beforehand: `mix deps.get` in `cs-tracker`, and `corepack pnpm install` then
`corepack pnpm exec playwright install chromium` in `cuatro-portfolio`, the two the probe names
when it refuses with exit 3. The seed file is re-created from the listing above at any path outside
the repository; nothing under `cs-tracker` carries it.

```
docker run -d --name cuatro-1-20-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -p 127.0.0.1:5432:5432 postgres:16
mix ecto.create; mix ecto.migrate; mix assets.build                      # in cs-tracker, MIX_ENV=dev
mix run <path>\seed.exs                                                  # the script above, from outside the repository
$env:STEAM_ID='76561198000000000'; $env:KILL_SWITCH='true'; mix phx.server
node ops/cs-tracker-accessibility-probe.mjs                              # in cuatro-portfolio
docker rm -f cuatro-1-20-pg                                              # afterwards
```

The probe takes `CS_TRACKER_URL` and `CS_TRACKER_STEAM_ID` from the environment if the server is
elsewhere or runs as another id, and refuses up front, with exit 3, a URL that is not a bare
`http(s)` origin (scheme, host and port, with no path, query, fragment or trailing slash, since every
route is appended to it) or an id that is not 17 digits. Read its exit code: `0` every case passed, `1` a named case failed (the
finding signal), `2` a defect in the probe, `3` nothing could be observed (no server, a server that
went away mid-run, no Chromium, no seeded catalog, a contract value missing from `:root`, an
interactive count that moved while a page was read, or a cookie the gate refused).

## Method

### What "interactive" means

Every element matching `a[href]`, `button`, `input`, `select`, `textarea`, `summary`,
`[role=button]`, `[role=link]` or `[tabindex]:not([tabindex="-1"])`, in document order, after the
mobile menu has been revealed by clicking `button[aria-controls="mobile-nav"]` (a click bounded at
five seconds, recorded rather than waited on if it cannot be made) and waiting for `#mobile-nav` to
lose `hidden`, and after every finite running animation has finished or three seconds have passed.
The list is pinned in the probe and in its unit suite, so a dropped selector is a diff and not a
shorter sweep. After a page is read, the probe counts the interactive elements again and refuses
the sweep if the count moved. **Decision.**

### What the Selector column carries

`describeElement` in the probe: the tag, `#id` when there is one, the first four class names
joined with `.`, `[href="..."]` for a link, the element's index in the sweep in square brackets,
and its text in quotes. It is a description for finding the element again by eye and in the
template, not a CSS selector: a class such as `gap-2.5` or `hover:underline` is written as it
appears in the `class` attribute and is not escaped, so pasting a cell into `querySelector` does
not work. **Decision.**

### How the floor and the four ring values were read

Off `:root` of the running page, never off the text of a stylesheet: `--tap` through
`getComputedStyle(document.documentElement).getPropertyValue('--tap')`, which read `44px`;
`--stroke-focus` (`2px`) and `--focus-offset` (`3px`) the same way; `--token-focus` and the three
grounds through a span declaring `background-color: var(<name>)` whose computed colour was
rasterised through a 1x1 canvas to 8-bit sRGB, the same canonicaliser `ops/cs-tracker-adoption-probe.mjs`
uses, so `oklch(84% 0.130 288)` compares as `rgba(198, 189, 255, 1.000)`. A floor that could not be
read throws rather than defaulting to 44, and a ring value that is not declared or not painted on
`:root` stops the run with exit 3 before anything is swept; both refusals have unit cases.
**Decision.**

### How each element was measured

Playwright's `isVisible()` and `boundingBox()` on the element handle. A hidden element or one with a
zero-area box is SKIPPED and counted as skipped, never as passed. A visible element passes only when
both `width` and `height` are at or over the floor; otherwise it fails naming the axis and the value.
Sizes are CSS pixels, fractional where the browser lays them out fractionally, and are quoted as
read. A route's case passes only when something was read, something was measured (a page whose every
element was skipped fails, it does not pass) and nothing measured is under the floor. **Decision.**
The verdict functions have unit cases at `44`, `43.5` on either axis, `0`, hidden, an unreadable
floor, and a route read but never measured.

### How the ground is classified

The ring sits outside the element at `--focus-offset`, so the ground under it is not the element's
own fill but the first painted `background-color` or `background-image` walking from the element's
**parent** upward. A colour is canonicalised and classified as one of the three grounds by equality
with the canonicalised `:root` values; a ground that matches none of the three is reported by value
and fails; an ancestor painting an image before any ground colour is painted and unclassifiable, and
is reported as such. On this run every one of the 79 measured elements classified as one of the
three, and the case passes only when at least one element was measured. **Decision.**

### How the ring was read

Focus is only asserted under `:focus-visible`, which a click deliberately does not satisfy, so the
probe blurs whatever holds focus and presses Tab until `document.activeElement` is the chosen
element, up to the number of interactive elements on the page plus three. It then reads
`document.activeElement.matches(':focus-visible')`, the computed `outline-width`, `outline-style`,
`outline-color` (canonicalised), `outline-offset`, `transition-property` and `transition-duration`
on that element, walks the ground chain again, and computes the WCAG 2.1 contrast of the ring colour
against that ground with `contrastRatio` from the sibling probe. The case passes only with every
ring value equal to the contract's, `:focus-visible` true, the ring on the ground the element was
chosen on, contrast at or over 3:1, and no transition of the outline over a duration above zero;
each departure is named. The element on each ground is the first visible one classified there,
buttons preferred over links. **Decision.** The case verdict has unit cases at 2.99, 3, an unreadable
contrast, a mismatched ground and `:focus-visible` false.

**The planted control.** No interactive element on any of the six pages sits on `--token-bg-raised-2`.
Rather than leave the third ground unread, the probe appends, in the browser only and only after
every route has been swept, a `div` painting `var(--token-bg-raised-2)` around a `button.btn.btn-primary`
(daisyUI's own class string as `core_components.ex:103-130` emits it) to `/`'s `main`, Tabs to it,
and reads the ring. The transcript and this record label that reading PLANTED when no real element
sits on the ground, and UNREACHABLE when real elements do and Tab reached none of them; here it is
PLANTED, and the diagnostics line counts 64, 15 and 0 real elements on the three grounds. What the
reading answers is whether the stylesheet the application ships paints a visible ring on that ground;
what it cannot answer is how a real control there would be laid out, and there is none. **Decision.**

### The cookie

Every owner route sits behind a Steam OpenID round trip no automation can complete.
`Plug.Session`'s cookie store signs `:erlang.term_to_binary(session)` with
`Plug.Crypto.MessageVerifier` (HS256 over `base64url("HS256") <> "." <> base64url(term)`) under a key
derived by PBKDF2-SHA256 from `secret_key_base` with the signing salt, 1000 iterations, 32 bytes.
The probe reads `secret_key_base` out of `config/dev.exs:26` and `key` and `signing_salt` out of
`endpoint.ex:7-25`, refuses an encryption salt, and mints the token for `%{"steam_id" => id}`. **The
salt's value is read at run time and deliberately not recorded here or printed by the probe**:
`cs-tracker` is a private repository and this one is public, and publishing a private repository's
configuration is a decision this record does not make. The cookie name, `_cs_tracker_key`, is
recorded. **The application is the verifier**: the first case is that `GET /` with the cookie
answers `200` and without it answers `302` to `/auth/steam`, and the route sweep repeats that for
every owner route. The bytes are also pinned by unit cases (three segments, `HS256`, the ETF map's
`131, 116` and its `"steam_id"` key, the HMAC recomputed, a changed secret or salt changing only the
signature), against a planted salt. **Decision.**

### What the probe writes, and where

Two attributes on live DOM nodes in the browser (`data-cuatro-probe-index` on every interactive
element, `data-cuatro-planted` on the one planted wrapper), and nothing on disk. **Observed
2026-08-27**: `git -C cs-tracker status --porcelain` after the run was empty.

## The per-route table

**Observed 2026-08-27.** "Read" is every element matching the selector; "measured" is read minus
skipped; "menu" says how the mobile disclosure was opened.

| Route | LiveView | Menu | Read | Measured | At or over 44x44 | Skipped | Findings |
|---|---|---|---|---|---|---|---|
| `/` | connected | revealed by clicking the hamburger | 17 | 11 | 4 | 6 | 7 (F-1 to F-7) |
| `/browse` | connected | revealed | 30 | 24 | 0 | 6 | 24 (F-8 to F-31) |
| `/inventory` | connected | revealed | 20 | 14 | 0 | 6 | 14 (F-32 to F-45) |
| `/wishlist` | connected | revealed | 18 | 12 | 0 | 6 | 12 (F-46 to F-57) |
| `/items/1` | connected | revealed | 19 | 11 | 1 | 8 | 10 (F-58 to F-67) |
| `/auth/steam/callback?openid.mode=bad` | not a LiveView | revealed (the JS command runs without a socket) | 13 | 7 | 0 | 6 | 7 (F-68 to F-74) |
| **Total** | | | **117** | **79** | **5** | **38** | **74** |

The shell (hamburger, wordmark, four mobile nav links) is measured on every page and its findings
repeat six times by design: the route is part of the finding, and a shell that is 40px tall on
`/browse` is a finding on `/browse`.

## The findings, by shape and by cause

**Observed 2026-08-27.** The 74 findings fall into nine shapes. Counted by cause from the table
below, **18 are daisyUI's control defaults** (`--size-field` making a `btn` and an `input` 40 or 35px
tall, `btn-sm` 28, `btn-xs` 21, `select-sm` 28) **and 56 are sizes the application authors in its own
markup** (the wordmark's `px-2 py-1`, the mobile nav links' `px-3 py-2.5`, bare `text-sm` title
links, the 32x32 "Remove" icon buttons, and the small text links). All 74 go to Story 8.1's restyle
under `RESTYLE-SPEC.md` § Family A, not because none is the application's own, but because AD-20
forbids this story fixing any of them: a migration step carries nothing else, and Story 8.1 is the
step that rebuilds these components token-native.

| Shape | Cause | Where | Measured | Count |
|---|---|---|---|---|
| The hamburger, `btn btn-ghost btn-sm btn-square` | daisyUI default | every page | 28 x 28, under on both axes | 6 |
| The wordmark link, `px-2 py-1` around a `size-8` mark | the application's own markup | every page | 128.97 x 40 | 6 |
| The four mobile nav links, `px-3 py-2.5 text-sm` | the application's own markup (`layouts.ex:142`) | every page | 344 x 40 | 24 |
| Item title links inside cards and rows, bare text at `text-sm` | the application's own markup | `/browse` (12), `/inventory` (5), `/wishlist` (3) | 129 to 162 wide x 17 | 20 |
| daisyUI `select` and `input` at the default field size | daisyUI default | `/browse`: three selects, the date input, the search input (`input.grow`, 33 tall) | 302 x 35, 253.31 x 33 | 5 |
| daisyUI `select-sm` | daisyUI default | `/browse` sort, `/inventory` sort | 114 x 28, 132 x 28 | 2 |
| daisyUI `btn` at the default size | daisyUI default | `/items/1` "Add to wishlist" (294 x 35), `/inventory` `#sync-now-btn` (221.81 x 35) | height 35 | 2 |
| daisyUI `btn-xs` | daisyUI default | `/items/1` two buy links (21 tall), `/inventory` "Unmark" (21 tall) | height 21 | 3 |
| Small text links and icon buttons | the application's own markup | `/` "Browse all", `/items/1` "Back to browse", the failure page's "home page", `/wishlist` three "Remove" icon buttons | 58.59 x 17.33, 110.36 x 20, 77.64 x 20, 32 x 32 | 6 |

## The findings, F-1 to F-74

**Observed 2026-08-27**, one row per visible interactive element under 44 on either axis, generated
from the transcript below. Sizes are CSS pixels as `boundingBox()` returned them. One button's own
text carries an em-dash, which this file may not contain; it is written `[U+2014]` here and in the
transcript.

| # | Route | Selector | Text | Measured (w x h) | Under the floor on |
|---|---|---|---|---|---|
| F-1 | `/` | `button.btn.btn-ghost.btn-sm.btn-square [0]` | Toggle navigation | 28 x 28 | width 28 is under 44, height 28 is under 44 |
| F-2 | `/` | `a.flex.items-center.gap-2.5.px-2[href="/"] [1]` | CS CS Tracker skins ledger | 128.96875 x 40 | height 40 is under 44 |
| F-3 | `/` | `a.flex.items-center.px-3.py-2.5[href="/"] [6]` | Dashboard | 344 x 40 | height 40 is under 44 |
| F-4 | `/` | `a.flex.items-center.px-3.py-2.5[href="/browse"] [7]` | Browse | 344 x 40 | height 40 is under 44 |
| F-5 | `/` | `a.flex.items-center.px-3.py-2.5[href="/inventory"] [8]` | Inventory | 344 x 40 | height 40 is under 44 |
| F-6 | `/` | `a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9]` | Wishlist | 344 x 40 | height 40 is under 44 |
| F-7 | `/` | `a.text-xs.text-primary.hover:underline[href="/browse"] [10]` | Browse all | 58.59375 x 17.328125 | height 17.328125 is under 44 |
| F-8 | `/browse` | `button.btn.btn-ghost.btn-sm.btn-square [0]` | Toggle navigation | 28 x 28 | width 28 is under 44, height 28 is under 44 |
| F-9 | `/browse` | `a.flex.items-center.gap-2.5.px-2[href="/"] [1]` | CS CS Tracker skins ledger | 128.96875 x 40 | height 40 is under 44 |
| F-10 | `/browse` | `a.flex.items-center.px-3.py-2.5[href="/"] [6]` | Dashboard | 344 x 40 | height 40 is under 44 |
| F-11 | `/browse` | `a.flex.items-center.px-3.py-2.5[href="/browse"] [7]` | Browse | 344 x 40 | height 40 is under 44 |
| F-12 | `/browse` | `a.flex.items-center.px-3.py-2.5[href="/inventory"] [8]` | Inventory | 344 x 40 | height 40 is under 44 |
| F-13 | `/browse` | `a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9]` | Wishlist | 344 x 40 | height 40 is under 44 |
| F-14 | `/browse` | `input.grow [10]` |  | 253.3125 x 33 | height 33 is under 44 |
| F-15 | `/browse` | `select.select.select-bordered [11]` | All categories Rifle Sniper | 302 x 35 | height 35 is under 44 |
| F-16 | `/browse` | `select.select.select-bordered [12]` | All collections The Probe Collection | 302 x 35 | height 35 is under 44 |
| F-17 | `/browse` | `select.select.select-bordered [13]` | All rarities Classified Covert Mil-Spec Restricted | 302 x 35 | height 35 is under 44 |
| F-18 | `/browse` | `input.input.input-bordered [14]` | Released after | 302 x 35 | height 35 is under 44 |
| F-19 | `/browse` | `select.select.select-bordered.select-sm [15]` | Name Release date Rarity | 114 x 28 | height 28 is under 44 |
| F-20 | `/browse` | `a.hover:text-primary.hover:underline[href="/items/1"] [16]` | AK-47 \| Probe Finish 1 | 136.890625 x 17 | height 17 is under 44 |
| F-21 | `/browse` | `a.hover:text-primary.hover:underline[href="/items/5"] [17]` | AK-47 \| Probe Finish 5 | 139.9375 x 17 | height 17 is under 44 |
| F-22 | `/browse` | `a.hover:text-primary.hover:underline[href="/items/9"] [18]` | AK-47 \| Probe Finish 9 | 139.421875 x 17 | height 17 is under 44 |
| F-23 | `/browse` | `a.hover:text-primary.hover:underline[href="/items/11"] [19]` | AWP \| Probe Finish 11 | 132.5 x 17 | height 17 is under 44 |
| F-24 | `/browse` | `a.hover:text-primary.hover:underline[href="/items/3"] [20]` | AWP \| Probe Finish 3 | 130.140625 x 17 | height 17 is under 44 |
| F-25 | `/browse` | `a.hover:text-primary.hover:underline[href="/items/7"] [21]` | AWP \| Probe Finish 7 | 128.828125 x 17 | height 17 is under 44 |
| F-26 | `/browse` | `a.hover:text-primary.hover:underline[href="/items/12"] [22]` | Glock-18 \| Probe Finish 12 | 161.953125 x 17 | height 17 is under 44 |
| F-27 | `/browse` | `a.hover:text-primary.hover:underline[href="/items/4"] [23]` | Glock-18 \| Probe Finish 4 | 156.40625 x 17 | height 17 is under 44 |
| F-28 | `/browse` | `a.hover:text-primary.hover:underline[href="/items/8"] [24]` | Glock-18 \| Probe Finish 8 | 156.421875 x 17 | height 17 is under 44 |
| F-29 | `/browse` | `a.hover:text-primary.hover:underline[href="/items/10"] [25]` | M4A4 \| Probe Finish 10 | 145.1875 x 17 | height 17 is under 44 |
| F-30 | `/browse` | `a.hover:text-primary.hover:underline[href="/items/2"] [26]` | M4A4 \| Probe Finish 2 | 139.140625 x 17 | height 17 is under 44 |
| F-31 | `/browse` | `a.hover:text-primary.hover:underline[href="/items/6"] [27]` | M4A4 \| Probe Finish 6 | 138.78125 x 17 | height 17 is under 44 |
| F-32 | `/inventory` | `button.btn.btn-ghost.btn-sm.btn-square [0]` | Toggle navigation | 28 x 28 | width 28 is under 44, height 28 is under 44 |
| F-33 | `/inventory` | `a.flex.items-center.gap-2.5.px-2[href="/"] [1]` | CS CS Tracker skins ledger | 128.96875 x 40 | height 40 is under 44 |
| F-34 | `/inventory` | `a.flex.items-center.px-3.py-2.5[href="/"] [6]` | Dashboard | 344 x 40 | height 40 is under 44 |
| F-35 | `/inventory` | `a.flex.items-center.px-3.py-2.5[href="/browse"] [7]` | Browse | 344 x 40 | height 40 is under 44 |
| F-36 | `/inventory` | `a.flex.items-center.px-3.py-2.5[href="/inventory"] [8]` | Inventory | 344 x 40 | height 40 is under 44 |
| F-37 | `/inventory` | `a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9]` | Wishlist | 344 x 40 | height 40 is under 44 |
| F-38 | `/inventory` | `button#sync-now-btn.btn.btn-ghost [10]` | Offline mode [U+2014] sync disabled | 221.8125 x 35 | height 35 is under 44 |
| F-39 | `/inventory` | `select.select.select-bordered.select-sm [11]` | Sort by | 132 x 28 | height 28 is under 44 |
| F-40 | `/inventory` | `a.hover:underline[href="/items/1"] [12]` | AK-47 \| Probe Finish 1 | 136.890625 x 17 | height 17 is under 44 |
| F-41 | `/inventory` | `a.hover:underline[href="/items/2"] [13]` | M4A4 \| Probe Finish 2 | 139.140625 x 17 | height 17 is under 44 |
| F-42 | `/inventory` | `a.hover:underline[href="/items/3"] [14]` | AWP \| Probe Finish 3 | 130.140625 x 17 | height 17 is under 44 |
| F-43 | `/inventory` | `a.hover:underline[href="/items/4"] [15]` | Glock-18 \| Probe Finish 4 | 156.40625 x 17 | height 17 is under 44 |
| F-44 | `/inventory` | `a.hover:underline[href="/items/8"] [16]` | Glock-18 \| Probe Finish 8 | 156.421875 x 17 | height 17 is under 44 |
| F-45 | `/inventory` | `button.btn.btn-ghost.btn-xs.-ml-2 [17]` | Unmark | 72.296875 x 21 | height 21 is under 44 |
| F-46 | `/wishlist` | `button.btn.btn-ghost.btn-sm.btn-square [0]` | Toggle navigation | 28 x 28 | width 28 is under 44, height 28 is under 44 |
| F-47 | `/wishlist` | `a.flex.items-center.gap-2.5.px-2[href="/"] [1]` | CS CS Tracker skins ledger | 128.96875 x 40 | height 40 is under 44 |
| F-48 | `/wishlist` | `a.flex.items-center.px-3.py-2.5[href="/"] [6]` | Dashboard | 344 x 40 | height 40 is under 44 |
| F-49 | `/wishlist` | `a.flex.items-center.px-3.py-2.5[href="/browse"] [7]` | Browse | 344 x 40 | height 40 is under 44 |
| F-50 | `/wishlist` | `a.flex.items-center.px-3.py-2.5[href="/inventory"] [8]` | Inventory | 344 x 40 | height 40 is under 44 |
| F-51 | `/wishlist` | `a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9]` | Wishlist | 344 x 40 | height 40 is under 44 |
| F-52 | `/wishlist` | `button.absolute.right-2.top-2.grid [10]` | Remove | 32 x 32 | width 32 is under 44, height 32 is under 44 |
| F-53 | `/wishlist` | `a.hover:text-primary.hover:underline[href="/items/5"] [11]` | AK-47 \| Probe Finish 5 | 139.9375 x 17 | height 17 is under 44 |
| F-54 | `/wishlist` | `button.absolute.right-2.top-2.grid [12]` | Remove | 32 x 32 | width 32 is under 44, height 32 is under 44 |
| F-55 | `/wishlist` | `a.hover:text-primary.hover:underline[href="/items/6"] [13]` | M4A4 \| Probe Finish 6 | 138.78125 x 17 | height 17 is under 44 |
| F-56 | `/wishlist` | `button.absolute.right-2.top-2.grid [14]` | Remove | 32 x 32 | width 32 is under 44, height 32 is under 44 |
| F-57 | `/wishlist` | `a.hover:text-primary.hover:underline[href="/items/7"] [15]` | AWP \| Probe Finish 7 | 128.828125 x 17 | height 17 is under 44 |
| F-58 | `/items/1` | `button.btn.btn-ghost.btn-sm.btn-square [0]` | Toggle navigation | 28 x 28 | width 28 is under 44, height 28 is under 44 |
| F-59 | `/items/1` | `a.flex.items-center.gap-2.5.px-2[href="/"] [1]` | CS CS Tracker skins ledger | 128.96875 x 40 | height 40 is under 44 |
| F-60 | `/items/1` | `a.flex.items-center.px-3.py-2.5[href="/"] [6]` | Dashboard | 344 x 40 | height 40 is under 44 |
| F-61 | `/items/1` | `a.flex.items-center.px-3.py-2.5[href="/browse"] [7]` | Browse | 344 x 40 | height 40 is under 44 |
| F-62 | `/items/1` | `a.flex.items-center.px-3.py-2.5[href="/inventory"] [8]` | Inventory | 344 x 40 | height 40 is under 44 |
| F-63 | `/items/1` | `a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9]` | Wishlist | 344 x 40 | height 40 is under 44 |
| F-64 | `/items/1` | `a.inline-flex.w-fit.items-center.gap-1[href="/browse"] [10]` | ← Back to browse | 110.359375 x 20 | height 20 is under 44 |
| F-65 | `/items/1` | `button.btn.btn-primary [11]` | Add to wishlist | 294 x 35 | height 35 is under 44 |
| F-66 | `/items/1` | `a.btn.btn-xs.btn-primary.shrink-0[href="https://example.invalid/csfloat"] [14]` | Buy on CSFloat | 94.75 x 21 | height 21 is under 44 |
| F-67 | `/items/1` | `a.btn.btn-xs.btn-primary.shrink-0[href="https://example.invalid/steam_market"] [16]` | Buy on Steam Market | 125.40625 x 21 | height 21 is under 44 |
| F-68 | `/auth/steam/callback?openid.mode=bad` | `button.btn.btn-ghost.btn-sm.btn-square [0]` | Toggle navigation | 28 x 28 | width 28 is under 44, height 28 is under 44 |
| F-69 | `/auth/steam/callback?openid.mode=bad` | `a.flex.items-center.gap-2.5.px-2[href="/"] [1]` | CS CS Tracker skins ledger | 128.96875 x 40 | height 40 is under 44 |
| F-70 | `/auth/steam/callback?openid.mode=bad` | `a.flex.items-center.px-3.py-2.5[href="/"] [6]` | Dashboard | 344 x 40 | height 40 is under 44 |
| F-71 | `/auth/steam/callback?openid.mode=bad` | `a.flex.items-center.px-3.py-2.5[href="/browse"] [7]` | Browse | 344 x 40 | height 40 is under 44 |
| F-72 | `/auth/steam/callback?openid.mode=bad` | `a.flex.items-center.px-3.py-2.5[href="/inventory"] [8]` | Inventory | 344 x 40 | height 40 is under 44 |
| F-73 | `/auth/steam/callback?openid.mode=bad` | `a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9]` | Wishlist | 344 x 40 | height 40 is under 44 |
| F-74 | `/auth/steam/callback?openid.mode=bad` | `a.link[href="/"] [10]` | home page | 77.640625 x 20 | height 20 is under 44 |

## The focus ring across the three grounds

**Observed 2026-08-27** under a real Tab press, read on the focused element, contrast by WCAG 2.1
over the canonicalised 8-bit sRGB values. The contract values read off `:root` were `--stroke-focus`
`2px`, `--token-focus` `oklch(84% 0.130 288)` rasterising to `rgba(198, 189, 255, 1.000)`, and
`--focus-offset` `3px`; the grounds rasterised to `rgba(6, 5, 9, 1.000)`, `rgba(13, 12, 19, 1.000)`
and `rgba(22, 21, 28, 1.000)`.

| Ground | Element | Route | Ground under the ring | `:focus-visible` | `outline-width` | `outline-style` | `outline-color` | `outline-offset` | `transition-property` | `transition-duration` | Contrast | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `--token-bg` | `button.btn.btn-ghost.btn-sm.btn-square [0]` "Toggle navigation", the hamburger on the `bg-base-100` navbar | `/` | `rgba(6, 5, 9, 1.000)` | true | `2px` | `solid` | `rgba(198, 189, 255, 1.000)` | `3px` | `color, background-color, border-color, box-shadow` | `0.2s` | **11.73:1** | PASS |
| `--token-bg-raised` | `a.text-xs.text-primary.hover:underline [10]` "Browse all", on the `bg-base-200` shell | `/` | `rgba(13, 12, 19, 1.000)` | true | `2px` | `solid` | `rgba(198, 189, 255, 1.000)` | `3px` | `all` | `0s` | **11.24:1** | PASS: `all` over `0s` never animates |
| `--token-bg-raised-2` | **PLANTED** `button.btn.btn-primary` inside a wrapper painting `var(--token-bg-raised-2)`; no real element sits on this ground | `/` | `rgba(22, 21, 28, 1.000)` | true | `2px` | `solid` | `rgba(198, 189, 255, 1.000)` | `3px` | `color, background-color, border-color, box-shadow` | `0.2s` | **10.47:1** | PASS on a planted control |

The three contrast figures are the same three `ops/cs-tracker-token-adoption.md:196-198` computed
from the compiled stylesheet in a fixture, now read on the running application's own ground under a
real ring with `:focus-visible` matched. The four ring values are Story 1-19's hand-fix 3 (S-2)
holding on the running application: `outline-width` equals `--stroke-focus`, `outline-style` is
`solid`, `outline-color` equals `--token-focus`, `outline-offset` equals `--focus-offset`.

**The ring is visible on all three grounds and is transitioned on 38 of the 79 measured controls.**
The rule the ring is written against (`EXPERIENCE.md` S-2, `RESTYLE-SPEC.md:326-332`) is never
transitioned. Two causes transition it, neither of them `cs-tracker`'s own `:focus-visible` rule:

| Cause | `transition-property` as computed | `transition-duration` | Elements | Count |
|---|---|---|---|---|
| Tailwind v4's `transition-colors` utility, whose property list includes `outline-color` | `color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to` | `0.15s` | the wordmark link and the four mobile nav links on every page (`layouts.ex:71`, `:142`), the three wishlist "Remove" buttons, "Back to browse" and the mark-as-owned toggle on `/items/1` | 35 |
| `transition-property: all` over a real duration, from the application's own `transition-all` on the three quick-link cards on `/` | `all` | `0.15s` | the three quick-link cards on `/` | 3 |

**29 more elements name `all` and are not findings**, because their
`transition-duration` is `0s` and a zero-duration transition never animates: daisyUI's fields (the
search input, the four selects and the date input on `/browse`, the sort select on `/inventory`),
every item title link in cards and rows, "Browse all" on `/`, and the failure page's "home page"
link. They are listed under "Excluded" below so the exclusion is checkable rather than assumed.

What a visitor sees: on the 38 controls the ring's colour animates in over 150 ms rather than
appearing. The 12 measured controls that neither animate nor name the outline are the eleven daisyUI
`.btn` elements, whose own property list is `color, background-color, border-color, box-shadow`, and
the recently-viewed card link `a.group.flex.w-36.shrink-0` on `/`, which is a link with no
transition. This is a finding about the application's use of Tailwind, not about the contract or the
hand-fix rule, and it is handed to the Operator rather than fixed here.

## The transition findings, T-1 to T-38

**Observed 2026-08-27**, one row per visible interactive element whose computed
`transition-property` names `outline`, any `outline-*`, or `all`, over a `transition-duration` above
zero, generated from the transcript below.

| # | Route | Selector | Text | `transition-property` | `transition-duration` |
|---|---|---|---|---|---|
| T-1 | `/` | `a.flex.items-center.gap-2.5.px-2[href="/"] [1]` | CS CS Tracker skins ledger | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-2 | `/` | `a.flex.items-center.px-3.py-2.5[href="/"] [6]` | Dashboard | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-3 | `/` | `a.flex.items-center.px-3.py-2.5[href="/browse"] [7]` | Browse | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-4 | `/` | `a.flex.items-center.px-3.py-2.5[href="/inventory"] [8]` | Inventory | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-5 | `/` | `a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9]` | Wishlist | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-6 | `/` | `a.group.flex.items-center.gap-3.5[href="/browse"] [12]` | Browse Search the full catalog | `all` | `0.15s` |
| T-7 | `/` | `a.group.flex.items-center.gap-3.5[href="/inventory"] [13]` | Inventory Your owned items | `all` | `0.15s` |
| T-8 | `/` | `a.group.flex.items-center.gap-3.5[href="/wishlist"] [14]` | Wishlist Items you're tracking | `all` | `0.15s` |
| T-9 | `/browse` | `a.flex.items-center.gap-2.5.px-2[href="/"] [1]` | CS CS Tracker skins ledger | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-10 | `/browse` | `a.flex.items-center.px-3.py-2.5[href="/"] [6]` | Dashboard | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-11 | `/browse` | `a.flex.items-center.px-3.py-2.5[href="/browse"] [7]` | Browse | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-12 | `/browse` | `a.flex.items-center.px-3.py-2.5[href="/inventory"] [8]` | Inventory | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-13 | `/browse` | `a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9]` | Wishlist | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-14 | `/inventory` | `a.flex.items-center.gap-2.5.px-2[href="/"] [1]` | CS CS Tracker skins ledger | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-15 | `/inventory` | `a.flex.items-center.px-3.py-2.5[href="/"] [6]` | Dashboard | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-16 | `/inventory` | `a.flex.items-center.px-3.py-2.5[href="/browse"] [7]` | Browse | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-17 | `/inventory` | `a.flex.items-center.px-3.py-2.5[href="/inventory"] [8]` | Inventory | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-18 | `/inventory` | `a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9]` | Wishlist | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-19 | `/wishlist` | `a.flex.items-center.gap-2.5.px-2[href="/"] [1]` | CS CS Tracker skins ledger | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-20 | `/wishlist` | `a.flex.items-center.px-3.py-2.5[href="/"] [6]` | Dashboard | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-21 | `/wishlist` | `a.flex.items-center.px-3.py-2.5[href="/browse"] [7]` | Browse | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-22 | `/wishlist` | `a.flex.items-center.px-3.py-2.5[href="/inventory"] [8]` | Inventory | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-23 | `/wishlist` | `a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9]` | Wishlist | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-24 | `/wishlist` | `button.absolute.right-2.top-2.grid [10]` | Remove | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-25 | `/wishlist` | `button.absolute.right-2.top-2.grid [12]` | Remove | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-26 | `/wishlist` | `button.absolute.right-2.top-2.grid [14]` | Remove | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-27 | `/items/1` | `a.flex.items-center.gap-2.5.px-2[href="/"] [1]` | CS CS Tracker skins ledger | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-28 | `/items/1` | `a.flex.items-center.px-3.py-2.5[href="/"] [6]` | Dashboard | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-29 | `/items/1` | `a.flex.items-center.px-3.py-2.5[href="/browse"] [7]` | Browse | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-30 | `/items/1` | `a.flex.items-center.px-3.py-2.5[href="/inventory"] [8]` | Inventory | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-31 | `/items/1` | `a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9]` | Wishlist | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-32 | `/items/1` | `a.inline-flex.w-fit.items-center.gap-1[href="/browse"] [10]` | ← Back to browse | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-33 | `/items/1` | `button.group.flex.items-center.justify-between [12]` | Not in inventory Mark this item as owned Mark as owned | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-34 | `/auth/steam/callback?openid.mode=bad` | `a.flex.items-center.gap-2.5.px-2[href="/"] [1]` | CS CS Tracker skins ledger | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-35 | `/auth/steam/callback?openid.mode=bad` | `a.flex.items-center.px-3.py-2.5[href="/"] [6]` | Dashboard | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-36 | `/auth/steam/callback?openid.mode=bad` | `a.flex.items-center.px-3.py-2.5[href="/browse"] [7]` | Browse | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-37 | `/auth/steam/callback?openid.mode=bad` | `a.flex.items-center.px-3.py-2.5[href="/inventory"] [8]` | Inventory | the `transition-colors` list, which names `outline-color` | `0.15s` |
| T-38 | `/auth/steam/callback?openid.mode=bad` | `a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9]` | Wishlist | the `transition-colors` list, which names `outline-color` | `0.15s` |

### Excluded: names `outline` or `all` over `0s`

**Observed 2026-08-27**, the elements the rule reaches on paper and never animates in practice,
generated from the transcript below.

| Route | Selector | Text | `transition-property` | `transition-duration` |
|---|---|---|---|---|
| `/` | `a.text-xs.text-primary.hover:underline[href="/browse"] [10]` | Browse all | `all` | `0s` |
| `/browse` | `input.grow [10]` |  | `all` | `0s` |
| `/browse` | `select.select.select-bordered [11]` | All categories Rifle Sniper | `all` | `0s` |
| `/browse` | `select.select.select-bordered [12]` | All collections The Probe Collection | `all` | `0s` |
| `/browse` | `select.select.select-bordered [13]` | All rarities Classified Covert Mil-Spec Restricted | `all` | `0s` |
| `/browse` | `input.input.input-bordered [14]` | Released after | `all` | `0s` |
| `/browse` | `select.select.select-bordered.select-sm [15]` | Name Release date Rarity | `all` | `0s` |
| `/browse` | `a.hover:text-primary.hover:underline[href="/items/1"] [16]` | AK-47 \| Probe Finish 1 | `all` | `0s` |
| `/browse` | `a.hover:text-primary.hover:underline[href="/items/5"] [17]` | AK-47 \| Probe Finish 5 | `all` | `0s` |
| `/browse` | `a.hover:text-primary.hover:underline[href="/items/9"] [18]` | AK-47 \| Probe Finish 9 | `all` | `0s` |
| `/browse` | `a.hover:text-primary.hover:underline[href="/items/11"] [19]` | AWP \| Probe Finish 11 | `all` | `0s` |
| `/browse` | `a.hover:text-primary.hover:underline[href="/items/3"] [20]` | AWP \| Probe Finish 3 | `all` | `0s` |
| `/browse` | `a.hover:text-primary.hover:underline[href="/items/7"] [21]` | AWP \| Probe Finish 7 | `all` | `0s` |
| `/browse` | `a.hover:text-primary.hover:underline[href="/items/12"] [22]` | Glock-18 \| Probe Finish 12 | `all` | `0s` |
| `/browse` | `a.hover:text-primary.hover:underline[href="/items/4"] [23]` | Glock-18 \| Probe Finish 4 | `all` | `0s` |
| `/browse` | `a.hover:text-primary.hover:underline[href="/items/8"] [24]` | Glock-18 \| Probe Finish 8 | `all` | `0s` |
| `/browse` | `a.hover:text-primary.hover:underline[href="/items/10"] [25]` | M4A4 \| Probe Finish 10 | `all` | `0s` |
| `/browse` | `a.hover:text-primary.hover:underline[href="/items/2"] [26]` | M4A4 \| Probe Finish 2 | `all` | `0s` |
| `/browse` | `a.hover:text-primary.hover:underline[href="/items/6"] [27]` | M4A4 \| Probe Finish 6 | `all` | `0s` |
| `/inventory` | `select.select.select-bordered.select-sm [11]` | Sort by | `all` | `0s` |
| `/inventory` | `a.hover:underline[href="/items/1"] [12]` | AK-47 \| Probe Finish 1 | `all` | `0s` |
| `/inventory` | `a.hover:underline[href="/items/2"] [13]` | M4A4 \| Probe Finish 2 | `all` | `0s` |
| `/inventory` | `a.hover:underline[href="/items/3"] [14]` | AWP \| Probe Finish 3 | `all` | `0s` |
| `/inventory` | `a.hover:underline[href="/items/4"] [15]` | Glock-18 \| Probe Finish 4 | `all` | `0s` |
| `/inventory` | `a.hover:underline[href="/items/8"] [16]` | Glock-18 \| Probe Finish 8 | `all` | `0s` |
| `/wishlist` | `a.hover:text-primary.hover:underline[href="/items/5"] [11]` | AK-47 \| Probe Finish 5 | `all` | `0s` |
| `/wishlist` | `a.hover:text-primary.hover:underline[href="/items/6"] [13]` | M4A4 \| Probe Finish 6 | `all` | `0s` |
| `/wishlist` | `a.hover:text-primary.hover:underline[href="/items/7"] [15]` | AWP \| Probe Finish 7 | `all` | `0s` |
| `/auth/steam/callback?openid.mode=bad` | `a.link[href="/"] [10]` | home page | `all` | `0s` |

## What passed

**Observed 2026-08-27**, the five visible interactive elements at or over 44x44 on both axes: on
`/`, the recently-viewed card `a.group.flex.w-36.shrink-0[href="/items/1"]` at 144 x 199.75 and the
three quick-link cards `a.group.flex.items-center.gap-3.5` at 328 x 74 each; on `/items/1`, the
mark-as-owned toggle `button.group.flex.items-center.justify-between` at 328 x 70. All five are
cards or card-shaped controls the application lays out itself rather than daisyUI form geometry.

## The transcript, verbatim

**Observed 2026-08-27**, `node ops/cs-tracker-accessibility-probe.mjs`, exit 1, on the Windows 11
development host against the server described above. One line is altered: the `#sync-now-btn`
button's own text carries an em-dash, written `[U+2014]` here because this file may not carry the
character. Everything else is byte for byte what the probe printed.

```
# cs-tracker accessibility pass, Story 1-20, AD-19
# started 2026-08-27T22:54:34.948Z
# cs-tracker:   C:\CuatroEcosystem\cs-tracker-workspace\cs-tracker at 32a466a
# base url:     http://127.0.0.1:4000
# steam id:     76561198000000000 (in the cookie; the server must carry the same value in STEAM_ID)
# cookie:       _cs_tracker_key, HS256 over an ETF map, key = PBKDF2-SHA256(secret_key_base, the signing salt lib/cs_tracker_web/endpoint.ex declares, 1000, 32); the salt is read at run time and not printed
# viewport:     360x800
# interactive:  a[href], button, input, select, textarea, summary, [role=button], [role=link], [tabindex]:not([tabindex="-1"])

# chromium:     151.0.7922.34
PASS  The minted cookie is the one the gate accepts: GET / with the _cs_tracker_key cookie answered 200; without it answered 302 with location "/auth/steam". The application is the verifier of the token, not this file
# warm-up:      visited /items/1 on a connected mount so the dashboard's recently-viewed strip renders
PASS  Route sweep: 6 routes (pinned at 6): /: 200 with, 302 -> "/auth/steam" without; /browse: 200 with, 302 -> "/auth/steam" without; /inventory: 200 with, 302 -> "/auth/steam" without; /wishlist: 200 with, 302 -> "/auth/steam" without; /items/1: 200 with, 302 -> "/auth/steam" without; /auth/steam/callback?openid.mode=bad: 401 anonymous (expected 401)
# floor:        --tap = 44px (read off :root)
# ring:         --stroke-focus = 2px, --token-focus = oklch(84% 0.130 288) -> rgba(198, 189, 255, 1.000), --focus-offset = 3px
# ground:       --token-bg = oklch(12% 0.011 288) -> rgba(6, 5, 9, 1.000)
# ground:       --token-bg-raised = oklch(16% 0.013 288) -> rgba(13, 12, 19, 1.000)
# ground:       --token-bg-raised-2 = oklch(20% 0.014 288) -> rgba(22, 21, 28, 1.000)

FAIL  Hit targets on /: 17 read, 4 at or over 44x44, 6 skipped, 7 under the floor (LiveView connected; mobile menu revealed by clicking the hamburger). 7 under the floor
FAIL  Hit targets on /browse: 30 read, 0 at or over 44x44, 6 skipped, 24 under the floor (LiveView connected; mobile menu revealed by clicking the hamburger). 24 under the floor
FAIL  Hit targets on /inventory: 20 read, 0 at or over 44x44, 6 skipped, 14 under the floor (LiveView connected; mobile menu revealed by clicking the hamburger). 14 under the floor
FAIL  Hit targets on /wishlist: 18 read, 0 at or over 44x44, 6 skipped, 12 under the floor (LiveView connected; mobile menu revealed by clicking the hamburger). 12 under the floor
FAIL  Hit targets on /items/1: 19 read, 1 at or over 44x44, 8 skipped, 10 under the floor (LiveView connected; mobile menu revealed by clicking the hamburger). 10 under the floor
FAIL  Hit targets on /auth/steam/callback?openid.mode=bad: 13 read, 0 at or over 44x44, 6 skipped, 7 under the floor (LiveView not connected; mobile menu revealed by clicking the hamburger). 7 under the floor

# focus ring, under a real Tab press, on one element per ground
PASS  Focus ring on --token-bg: / button.btn.btn-ghost.btn-sm.btn-square [0] "Toggle navigation": ground under the ring rgba(6, 5, 9, 1.000) (--token-bg), :focus-visible true, outline-width 2px, outline-style solid, outline-color rgba(198, 189, 255, 1.000), outline-offset 3px, transition-property "color, background-color, border-color, box-shadow", transition-duration "0.2s", contrast 11.73:1 against a 3:1 floor
PASS  Focus ring on --token-bg-raised: / a.text-xs.text-primary.hover:underline[href="/browse"] [10] "Browse all": ground under the ring rgba(13, 12, 19, 1.000) (--token-bg-raised), :focus-visible true, outline-width 2px, outline-style solid, outline-color rgba(198, 189, 255, 1.000), outline-offset 3px, transition-property "all", transition-duration "0s", contrast 11.24:1 against a 3:1 floor
PASS  Focus ring on --token-bg-raised-2: / button.btn.btn-primary [planted] "planted control" (PLANTED: no interactive element sits on this ground on any route): ground under the ring rgba(22, 21, 28, 1.000) (--token-bg-raised-2), :focus-visible true, outline-width 2px, outline-style solid, outline-color rgba(198, 189, 255, 1.000), outline-offset 3px, transition-property "color, background-color, border-color, box-shadow", transition-duration "0.2s", contrast 10.47:1 against a 3:1 floor
PASS  Every interactive element sits on one of the three grounds: all 79 measured elements' effective grounds were classified as one of --token-bg, --token-bg-raised, --token-bg-raised-2
FAIL  No interactive element transitions its outline: 38 element(s) carry a transition-property naming outline or all over a duration above zero, so the ring on them is transitioned (29 element(s) naming outline or all over 0s are excluded): / a.flex.items-center.gap-2.5.px-2[href="/"] [1] "CS CS Tracker skins ledger" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; / a.flex.items-center.px-3.py-2.5[href="/"] [6] "Dashboard" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; / a.flex.items-center.px-3.py-2.5[href="/browse"] [7] "Browse" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; / a.flex.items-center.px-3.py-2.5[href="/inventory"] [8] "Inventory" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; / a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9] "Wishlist" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; / a.group.flex.items-center.gap-3.5[href="/browse"] [12] "Browse Search the full catalog" "all" over "0.15s"; / a.group.flex.items-center.gap-3.5[href="/inventory"] [13] "Inventory Your owned items" "all" over "0.15s"; / a.group.flex.items-center.gap-3.5[href="/wishlist"] [14] "Wishlist Items you're tracking" "all" over "0.15s"; /browse a.flex.items-center.gap-2.5.px-2[href="/"] [1] "CS CS Tracker skins ledger" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /browse a.flex.items-center.px-3.py-2.5[href="/"] [6] "Dashboard" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /browse a.flex.items-center.px-3.py-2.5[href="/browse"] [7] "Browse" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /browse a.flex.items-center.px-3.py-2.5[href="/inventory"] [8] "Inventory" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /browse a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9] "Wishlist" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /inventory a.flex.items-center.gap-2.5.px-2[href="/"] [1] "CS CS Tracker skins ledger" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /inventory a.flex.items-center.px-3.py-2.5[href="/"] [6] "Dashboard" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /inventory a.flex.items-center.px-3.py-2.5[href="/browse"] [7] "Browse" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /inventory a.flex.items-center.px-3.py-2.5[href="/inventory"] [8] "Inventory" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /inventory a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9] "Wishlist" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /wishlist a.flex.items-center.gap-2.5.px-2[href="/"] [1] "CS CS Tracker skins ledger" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /wishlist a.flex.items-center.px-3.py-2.5[href="/"] [6] "Dashboard" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /wishlist a.flex.items-center.px-3.py-2.5[href="/browse"] [7] "Browse" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /wishlist a.flex.items-center.px-3.py-2.5[href="/inventory"] [8] "Inventory" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /wishlist a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9] "Wishlist" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /wishlist button.absolute.right-2.top-2.grid [10] "Remove" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /wishlist button.absolute.right-2.top-2.grid [12] "Remove" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /wishlist button.absolute.right-2.top-2.grid [14] "Remove" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /items/1 a.flex.items-center.gap-2.5.px-2[href="/"] [1] "CS CS Tracker skins ledger" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /items/1 a.flex.items-center.px-3.py-2.5[href="/"] [6] "Dashboard" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /items/1 a.flex.items-center.px-3.py-2.5[href="/browse"] [7] "Browse" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /items/1 a.flex.items-center.px-3.py-2.5[href="/inventory"] [8] "Inventory" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /items/1 a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9] "Wishlist" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /items/1 a.inline-flex.w-fit.items-center.gap-1[href="/browse"] [10] "← Back to browse" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /items/1 button.group.flex.items-center.justify-between [12] "Not in inventory Mark this item as owned Mark as owned" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /auth/steam/callback?openid.mode=bad a.flex.items-center.gap-2.5.px-2[href="/"] [1] "CS CS Tracker skins ledger" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /auth/steam/callback?openid.mode=bad a.flex.items-center.px-3.py-2.5[href="/"] [6] "Dashboard" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /auth/steam/callback?openid.mode=bad a.flex.items-center.px-3.py-2.5[href="/browse"] [7] "Browse" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /auth/steam/callback?openid.mode=bad a.flex.items-center.px-3.py-2.5[href="/inventory"] [8] "Inventory" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"; /auth/steam/callback?openid.mode=bad a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9] "Wishlist" "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" over "0.15s"

# findings, every visible interactive element under 44 on either axis, numbered
  F-1  /  button.btn.btn-ghost.btn-sm.btn-square [0] "Toggle navigation"  28 x 28  (width 28 is under 44, height 28 is under 44)
  F-2  /  a.flex.items-center.gap-2.5.px-2[href="/"] [1] "CS CS Tracker skins ledger"  128.96875 x 40  (height 40 is under 44)
  F-3  /  a.flex.items-center.px-3.py-2.5[href="/"] [6] "Dashboard"  344 x 40  (height 40 is under 44)
  F-4  /  a.flex.items-center.px-3.py-2.5[href="/browse"] [7] "Browse"  344 x 40  (height 40 is under 44)
  F-5  /  a.flex.items-center.px-3.py-2.5[href="/inventory"] [8] "Inventory"  344 x 40  (height 40 is under 44)
  F-6  /  a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9] "Wishlist"  344 x 40  (height 40 is under 44)
  F-7  /  a.text-xs.text-primary.hover:underline[href="/browse"] [10] "Browse all"  58.59375 x 17.328125  (height 17.328125 is under 44)
  F-8  /browse  button.btn.btn-ghost.btn-sm.btn-square [0] "Toggle navigation"  28 x 28  (width 28 is under 44, height 28 is under 44)
  F-9  /browse  a.flex.items-center.gap-2.5.px-2[href="/"] [1] "CS CS Tracker skins ledger"  128.96875 x 40  (height 40 is under 44)
  F-10  /browse  a.flex.items-center.px-3.py-2.5[href="/"] [6] "Dashboard"  344 x 40  (height 40 is under 44)
  F-11  /browse  a.flex.items-center.px-3.py-2.5[href="/browse"] [7] "Browse"  344 x 40  (height 40 is under 44)
  F-12  /browse  a.flex.items-center.px-3.py-2.5[href="/inventory"] [8] "Inventory"  344 x 40  (height 40 is under 44)
  F-13  /browse  a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9] "Wishlist"  344 x 40  (height 40 is under 44)
  F-14  /browse  input.grow [10]  253.3125 x 33  (height 33 is under 44)
  F-15  /browse  select.select.select-bordered [11] "All categories Rifle Sniper"  302 x 35  (height 35 is under 44)
  F-16  /browse  select.select.select-bordered [12] "All collections The Probe Collection"  302 x 35  (height 35 is under 44)
  F-17  /browse  select.select.select-bordered [13] "All rarities Classified Covert Mil-Spec Restricted"  302 x 35  (height 35 is under 44)
  F-18  /browse  input.input.input-bordered [14] "Released after"  302 x 35  (height 35 is under 44)
  F-19  /browse  select.select.select-bordered.select-sm [15] "Name Release date Rarity"  114 x 28  (height 28 is under 44)
  F-20  /browse  a.hover:text-primary.hover:underline[href="/items/1"] [16] "AK-47 | Probe Finish 1"  136.890625 x 17  (height 17 is under 44)
  F-21  /browse  a.hover:text-primary.hover:underline[href="/items/5"] [17] "AK-47 | Probe Finish 5"  139.9375 x 17  (height 17 is under 44)
  F-22  /browse  a.hover:text-primary.hover:underline[href="/items/9"] [18] "AK-47 | Probe Finish 9"  139.421875 x 17  (height 17 is under 44)
  F-23  /browse  a.hover:text-primary.hover:underline[href="/items/11"] [19] "AWP | Probe Finish 11"  132.5 x 17  (height 17 is under 44)
  F-24  /browse  a.hover:text-primary.hover:underline[href="/items/3"] [20] "AWP | Probe Finish 3"  130.140625 x 17  (height 17 is under 44)
  F-25  /browse  a.hover:text-primary.hover:underline[href="/items/7"] [21] "AWP | Probe Finish 7"  128.828125 x 17  (height 17 is under 44)
  F-26  /browse  a.hover:text-primary.hover:underline[href="/items/12"] [22] "Glock-18 | Probe Finish 12"  161.953125 x 17  (height 17 is under 44)
  F-27  /browse  a.hover:text-primary.hover:underline[href="/items/4"] [23] "Glock-18 | Probe Finish 4"  156.40625 x 17  (height 17 is under 44)
  F-28  /browse  a.hover:text-primary.hover:underline[href="/items/8"] [24] "Glock-18 | Probe Finish 8"  156.421875 x 17  (height 17 is under 44)
  F-29  /browse  a.hover:text-primary.hover:underline[href="/items/10"] [25] "M4A4 | Probe Finish 10"  145.1875 x 17  (height 17 is under 44)
  F-30  /browse  a.hover:text-primary.hover:underline[href="/items/2"] [26] "M4A4 | Probe Finish 2"  139.140625 x 17  (height 17 is under 44)
  F-31  /browse  a.hover:text-primary.hover:underline[href="/items/6"] [27] "M4A4 | Probe Finish 6"  138.78125 x 17  (height 17 is under 44)
  F-32  /inventory  button.btn.btn-ghost.btn-sm.btn-square [0] "Toggle navigation"  28 x 28  (width 28 is under 44, height 28 is under 44)
  F-33  /inventory  a.flex.items-center.gap-2.5.px-2[href="/"] [1] "CS CS Tracker skins ledger"  128.96875 x 40  (height 40 is under 44)
  F-34  /inventory  a.flex.items-center.px-3.py-2.5[href="/"] [6] "Dashboard"  344 x 40  (height 40 is under 44)
  F-35  /inventory  a.flex.items-center.px-3.py-2.5[href="/browse"] [7] "Browse"  344 x 40  (height 40 is under 44)
  F-36  /inventory  a.flex.items-center.px-3.py-2.5[href="/inventory"] [8] "Inventory"  344 x 40  (height 40 is under 44)
  F-37  /inventory  a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9] "Wishlist"  344 x 40  (height 40 is under 44)
  F-38  /inventory  button#sync-now-btn.btn.btn-ghost [10] "Offline mode [U+2014] sync disabled"  221.8125 x 35  (height 35 is under 44)
  F-39  /inventory  select.select.select-bordered.select-sm [11] "Sort by"  132 x 28  (height 28 is under 44)
  F-40  /inventory  a.hover:underline[href="/items/1"] [12] "AK-47 | Probe Finish 1"  136.890625 x 17  (height 17 is under 44)
  F-41  /inventory  a.hover:underline[href="/items/2"] [13] "M4A4 | Probe Finish 2"  139.140625 x 17  (height 17 is under 44)
  F-42  /inventory  a.hover:underline[href="/items/3"] [14] "AWP | Probe Finish 3"  130.140625 x 17  (height 17 is under 44)
  F-43  /inventory  a.hover:underline[href="/items/4"] [15] "Glock-18 | Probe Finish 4"  156.40625 x 17  (height 17 is under 44)
  F-44  /inventory  a.hover:underline[href="/items/8"] [16] "Glock-18 | Probe Finish 8"  156.421875 x 17  (height 17 is under 44)
  F-45  /inventory  button.btn.btn-ghost.btn-xs.-ml-2 [17] "Unmark"  72.296875 x 21  (height 21 is under 44)
  F-46  /wishlist  button.btn.btn-ghost.btn-sm.btn-square [0] "Toggle navigation"  28 x 28  (width 28 is under 44, height 28 is under 44)
  F-47  /wishlist  a.flex.items-center.gap-2.5.px-2[href="/"] [1] "CS CS Tracker skins ledger"  128.96875 x 40  (height 40 is under 44)
  F-48  /wishlist  a.flex.items-center.px-3.py-2.5[href="/"] [6] "Dashboard"  344 x 40  (height 40 is under 44)
  F-49  /wishlist  a.flex.items-center.px-3.py-2.5[href="/browse"] [7] "Browse"  344 x 40  (height 40 is under 44)
  F-50  /wishlist  a.flex.items-center.px-3.py-2.5[href="/inventory"] [8] "Inventory"  344 x 40  (height 40 is under 44)
  F-51  /wishlist  a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9] "Wishlist"  344 x 40  (height 40 is under 44)
  F-52  /wishlist  button.absolute.right-2.top-2.grid [10] "Remove"  32 x 32  (width 32 is under 44, height 32 is under 44)
  F-53  /wishlist  a.hover:text-primary.hover:underline[href="/items/5"] [11] "AK-47 | Probe Finish 5"  139.9375 x 17  (height 17 is under 44)
  F-54  /wishlist  button.absolute.right-2.top-2.grid [12] "Remove"  32 x 32  (width 32 is under 44, height 32 is under 44)
  F-55  /wishlist  a.hover:text-primary.hover:underline[href="/items/6"] [13] "M4A4 | Probe Finish 6"  138.78125 x 17  (height 17 is under 44)
  F-56  /wishlist  button.absolute.right-2.top-2.grid [14] "Remove"  32 x 32  (width 32 is under 44, height 32 is under 44)
  F-57  /wishlist  a.hover:text-primary.hover:underline[href="/items/7"] [15] "AWP | Probe Finish 7"  128.828125 x 17  (height 17 is under 44)
  F-58  /items/1  button.btn.btn-ghost.btn-sm.btn-square [0] "Toggle navigation"  28 x 28  (width 28 is under 44, height 28 is under 44)
  F-59  /items/1  a.flex.items-center.gap-2.5.px-2[href="/"] [1] "CS CS Tracker skins ledger"  128.96875 x 40  (height 40 is under 44)
  F-60  /items/1  a.flex.items-center.px-3.py-2.5[href="/"] [6] "Dashboard"  344 x 40  (height 40 is under 44)
  F-61  /items/1  a.flex.items-center.px-3.py-2.5[href="/browse"] [7] "Browse"  344 x 40  (height 40 is under 44)
  F-62  /items/1  a.flex.items-center.px-3.py-2.5[href="/inventory"] [8] "Inventory"  344 x 40  (height 40 is under 44)
  F-63  /items/1  a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9] "Wishlist"  344 x 40  (height 40 is under 44)
  F-64  /items/1  a.inline-flex.w-fit.items-center.gap-1[href="/browse"] [10] "← Back to browse"  110.359375 x 20  (height 20 is under 44)
  F-65  /items/1  button.btn.btn-primary [11] "Add to wishlist"  294 x 35  (height 35 is under 44)
  F-66  /items/1  a.btn.btn-xs.btn-primary.shrink-0[href="https://example.invalid/csfloat"] [14] "Buy on CSFloat"  94.75 x 21  (height 21 is under 44)
  F-67  /items/1  a.btn.btn-xs.btn-primary.shrink-0[href="https://example.invalid/steam_market"] [16] "Buy on Steam Market"  125.40625 x 21  (height 21 is under 44)
  F-68  /auth/steam/callback?openid.mode=bad  button.btn.btn-ghost.btn-sm.btn-square [0] "Toggle navigation"  28 x 28  (width 28 is under 44, height 28 is under 44)
  F-69  /auth/steam/callback?openid.mode=bad  a.flex.items-center.gap-2.5.px-2[href="/"] [1] "CS CS Tracker skins ledger"  128.96875 x 40  (height 40 is under 44)
  F-70  /auth/steam/callback?openid.mode=bad  a.flex.items-center.px-3.py-2.5[href="/"] [6] "Dashboard"  344 x 40  (height 40 is under 44)
  F-71  /auth/steam/callback?openid.mode=bad  a.flex.items-center.px-3.py-2.5[href="/browse"] [7] "Browse"  344 x 40  (height 40 is under 44)
  F-72  /auth/steam/callback?openid.mode=bad  a.flex.items-center.px-3.py-2.5[href="/inventory"] [8] "Inventory"  344 x 40  (height 40 is under 44)
  F-73  /auth/steam/callback?openid.mode=bad  a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9] "Wishlist"  344 x 40  (height 40 is under 44)
  F-74  /auth/steam/callback?openid.mode=bad  a.link[href="/"] [10] "home page"  77.640625 x 20  (height 20 is under 44)

# findings, every visible interactive element whose transition-property names outline or all over a duration above zero, numbered
  T-1  /  a.flex.items-center.gap-2.5.px-2[href="/"] [1] "CS CS Tracker skins ledger"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-2  /  a.flex.items-center.px-3.py-2.5[href="/"] [6] "Dashboard"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-3  /  a.flex.items-center.px-3.py-2.5[href="/browse"] [7] "Browse"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-4  /  a.flex.items-center.px-3.py-2.5[href="/inventory"] [8] "Inventory"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-5  /  a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9] "Wishlist"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-6  /  a.group.flex.items-center.gap-3.5[href="/browse"] [12] "Browse Search the full catalog"  transition-property "all"  transition-duration "0.15s"
  T-7  /  a.group.flex.items-center.gap-3.5[href="/inventory"] [13] "Inventory Your owned items"  transition-property "all"  transition-duration "0.15s"
  T-8  /  a.group.flex.items-center.gap-3.5[href="/wishlist"] [14] "Wishlist Items you're tracking"  transition-property "all"  transition-duration "0.15s"
  T-9  /browse  a.flex.items-center.gap-2.5.px-2[href="/"] [1] "CS CS Tracker skins ledger"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-10  /browse  a.flex.items-center.px-3.py-2.5[href="/"] [6] "Dashboard"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-11  /browse  a.flex.items-center.px-3.py-2.5[href="/browse"] [7] "Browse"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-12  /browse  a.flex.items-center.px-3.py-2.5[href="/inventory"] [8] "Inventory"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-13  /browse  a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9] "Wishlist"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-14  /inventory  a.flex.items-center.gap-2.5.px-2[href="/"] [1] "CS CS Tracker skins ledger"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-15  /inventory  a.flex.items-center.px-3.py-2.5[href="/"] [6] "Dashboard"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-16  /inventory  a.flex.items-center.px-3.py-2.5[href="/browse"] [7] "Browse"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-17  /inventory  a.flex.items-center.px-3.py-2.5[href="/inventory"] [8] "Inventory"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-18  /inventory  a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9] "Wishlist"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-19  /wishlist  a.flex.items-center.gap-2.5.px-2[href="/"] [1] "CS CS Tracker skins ledger"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-20  /wishlist  a.flex.items-center.px-3.py-2.5[href="/"] [6] "Dashboard"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-21  /wishlist  a.flex.items-center.px-3.py-2.5[href="/browse"] [7] "Browse"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-22  /wishlist  a.flex.items-center.px-3.py-2.5[href="/inventory"] [8] "Inventory"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-23  /wishlist  a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9] "Wishlist"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-24  /wishlist  button.absolute.right-2.top-2.grid [10] "Remove"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-25  /wishlist  button.absolute.right-2.top-2.grid [12] "Remove"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-26  /wishlist  button.absolute.right-2.top-2.grid [14] "Remove"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-27  /items/1  a.flex.items-center.gap-2.5.px-2[href="/"] [1] "CS CS Tracker skins ledger"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-28  /items/1  a.flex.items-center.px-3.py-2.5[href="/"] [6] "Dashboard"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-29  /items/1  a.flex.items-center.px-3.py-2.5[href="/browse"] [7] "Browse"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-30  /items/1  a.flex.items-center.px-3.py-2.5[href="/inventory"] [8] "Inventory"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-31  /items/1  a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9] "Wishlist"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-32  /items/1  a.inline-flex.w-fit.items-center.gap-1[href="/browse"] [10] "← Back to browse"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-33  /items/1  button.group.flex.items-center.justify-between [12] "Not in inventory Mark this item as owned Mark as owned"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-34  /auth/steam/callback?openid.mode=bad  a.flex.items-center.gap-2.5.px-2[href="/"] [1] "CS CS Tracker skins ledger"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-35  /auth/steam/callback?openid.mode=bad  a.flex.items-center.px-3.py-2.5[href="/"] [6] "Dashboard"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-36  /auth/steam/callback?openid.mode=bad  a.flex.items-center.px-3.py-2.5[href="/browse"] [7] "Browse"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-37  /auth/steam/callback?openid.mode=bad  a.flex.items-center.px-3.py-2.5[href="/inventory"] [8] "Inventory"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"
  T-38  /auth/steam/callback?openid.mode=bad  a.flex.items-center.px-3.py-2.5[href="/wishlist"] [9] "Wishlist"  transition-property "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"  transition-duration "0.15s"

# excluded from the transition findings: names outline or all, every duration 0s
  /  a.text-xs.text-primary.hover:underline[href="/browse"] [10] "Browse all"  transition-property "all"  transition-duration "0s"
  /browse  input.grow [10]  transition-property "all"  transition-duration "0s"
  /browse  select.select.select-bordered [11] "All categories Rifle Sniper"  transition-property "all"  transition-duration "0s"
  /browse  select.select.select-bordered [12] "All collections The Probe Collection"  transition-property "all"  transition-duration "0s"
  /browse  select.select.select-bordered [13] "All rarities Classified Covert Mil-Spec Restricted"  transition-property "all"  transition-duration "0s"
  /browse  input.input.input-bordered [14] "Released after"  transition-property "all"  transition-duration "0s"
  /browse  select.select.select-bordered.select-sm [15] "Name Release date Rarity"  transition-property "all"  transition-duration "0s"
  /browse  a.hover:text-primary.hover:underline[href="/items/1"] [16] "AK-47 | Probe Finish 1"  transition-property "all"  transition-duration "0s"
  /browse  a.hover:text-primary.hover:underline[href="/items/5"] [17] "AK-47 | Probe Finish 5"  transition-property "all"  transition-duration "0s"
  /browse  a.hover:text-primary.hover:underline[href="/items/9"] [18] "AK-47 | Probe Finish 9"  transition-property "all"  transition-duration "0s"
  /browse  a.hover:text-primary.hover:underline[href="/items/11"] [19] "AWP | Probe Finish 11"  transition-property "all"  transition-duration "0s"
  /browse  a.hover:text-primary.hover:underline[href="/items/3"] [20] "AWP | Probe Finish 3"  transition-property "all"  transition-duration "0s"
  /browse  a.hover:text-primary.hover:underline[href="/items/7"] [21] "AWP | Probe Finish 7"  transition-property "all"  transition-duration "0s"
  /browse  a.hover:text-primary.hover:underline[href="/items/12"] [22] "Glock-18 | Probe Finish 12"  transition-property "all"  transition-duration "0s"
  /browse  a.hover:text-primary.hover:underline[href="/items/4"] [23] "Glock-18 | Probe Finish 4"  transition-property "all"  transition-duration "0s"
  /browse  a.hover:text-primary.hover:underline[href="/items/8"] [24] "Glock-18 | Probe Finish 8"  transition-property "all"  transition-duration "0s"
  /browse  a.hover:text-primary.hover:underline[href="/items/10"] [25] "M4A4 | Probe Finish 10"  transition-property "all"  transition-duration "0s"
  /browse  a.hover:text-primary.hover:underline[href="/items/2"] [26] "M4A4 | Probe Finish 2"  transition-property "all"  transition-duration "0s"
  /browse  a.hover:text-primary.hover:underline[href="/items/6"] [27] "M4A4 | Probe Finish 6"  transition-property "all"  transition-duration "0s"
  /inventory  select.select.select-bordered.select-sm [11] "Sort by"  transition-property "all"  transition-duration "0s"
  /inventory  a.hover:underline[href="/items/1"] [12] "AK-47 | Probe Finish 1"  transition-property "all"  transition-duration "0s"
  /inventory  a.hover:underline[href="/items/2"] [13] "M4A4 | Probe Finish 2"  transition-property "all"  transition-duration "0s"
  /inventory  a.hover:underline[href="/items/3"] [14] "AWP | Probe Finish 3"  transition-property "all"  transition-duration "0s"
  /inventory  a.hover:underline[href="/items/4"] [15] "Glock-18 | Probe Finish 4"  transition-property "all"  transition-duration "0s"
  /inventory  a.hover:underline[href="/items/8"] [16] "Glock-18 | Probe Finish 8"  transition-property "all"  transition-duration "0s"
  /wishlist  a.hover:text-primary.hover:underline[href="/items/5"] [11] "AK-47 | Probe Finish 5"  transition-property "all"  transition-duration "0s"
  /wishlist  a.hover:text-primary.hover:underline[href="/items/6"] [13] "M4A4 | Probe Finish 6"  transition-property "all"  transition-duration "0s"
  /wishlist  a.hover:text-primary.hover:underline[href="/items/7"] [15] "AWP | Probe Finish 7"  transition-property "all"  transition-duration "0s"
  /auth/steam/callback?openid.mode=bad  a.link[href="/"] [10] "home page"  transition-property "all"  transition-duration "0s"

# passes, every visible interactive element at or over 44 on both axes
  /  a.group.flex.w-36.shrink-0[href="/items/1"] [11] "AK-47 | Probe Finish 1"  144 x 199.75
  /  a.group.flex.items-center.gap-3.5[href="/browse"] [12] "Browse Search the full catalog"  328 x 74
  /  a.group.flex.items-center.gap-3.5[href="/inventory"] [13] "Inventory Your owned items"  328 x 74
  /  a.group.flex.items-center.gap-3.5[href="/wishlist"] [14] "Wishlist Items you're tracking"  328 x 74
  /items/1  button.group.flex.items-center.justify-between [12] "Not in inventory Mark this item as owned Mark as owned"  328 x 70

# skipped, hidden or zero-area, never counted as passed
  /  a.relative.flex.items-center.px-3[href="/"] [2] "Dashboard"  (hidden)
  /  a.relative.flex.items-center.px-3[href="/browse"] [3] "Browse"  (hidden)
  /  a.relative.flex.items-center.px-3[href="/inventory"] [4] "Inventory"  (hidden)
  /  a.relative.flex.items-center.px-3[href="/wishlist"] [5] "Wishlist"  (hidden)
  /  button.group.self-start.cursor-pointer [15] "close"  (hidden)
  /  button.group.self-start.cursor-pointer [16] "close"  (hidden)
  /browse  a.relative.flex.items-center.px-3[href="/"] [2] "Dashboard"  (hidden)
  /browse  a.relative.flex.items-center.px-3[href="/browse"] [3] "Browse"  (hidden)
  /browse  a.relative.flex.items-center.px-3[href="/inventory"] [4] "Inventory"  (hidden)
  /browse  a.relative.flex.items-center.px-3[href="/wishlist"] [5] "Wishlist"  (hidden)
  /browse  button.group.self-start.cursor-pointer [28] "close"  (hidden)
  /browse  button.group.self-start.cursor-pointer [29] "close"  (hidden)
  /inventory  a.relative.flex.items-center.px-3[href="/"] [2] "Dashboard"  (hidden)
  /inventory  a.relative.flex.items-center.px-3[href="/browse"] [3] "Browse"  (hidden)
  /inventory  a.relative.flex.items-center.px-3[href="/inventory"] [4] "Inventory"  (hidden)
  /inventory  a.relative.flex.items-center.px-3[href="/wishlist"] [5] "Wishlist"  (hidden)
  /inventory  button.group.self-start.cursor-pointer [18] "close"  (hidden)
  /inventory  button.group.self-start.cursor-pointer [19] "close"  (hidden)
  /wishlist  a.relative.flex.items-center.px-3[href="/"] [2] "Dashboard"  (hidden)
  /wishlist  a.relative.flex.items-center.px-3[href="/browse"] [3] "Browse"  (hidden)
  /wishlist  a.relative.flex.items-center.px-3[href="/inventory"] [4] "Inventory"  (hidden)
  /wishlist  a.relative.flex.items-center.px-3[href="/wishlist"] [5] "Wishlist"  (hidden)
  /wishlist  button.group.self-start.cursor-pointer [16] "close"  (hidden)
  /wishlist  button.group.self-start.cursor-pointer [17] "close"  (hidden)
  /items/1  a.relative.flex.items-center.px-3[href="/"] [2] "Dashboard"  (hidden)
  /items/1  a.relative.flex.items-center.px-3[href="/browse"] [3] "Browse"  (hidden)
  /items/1  a.relative.flex.items-center.px-3[href="/inventory"] [4] "Inventory"  (hidden)
  /items/1  a.relative.flex.items-center.px-3[href="/wishlist"] [5] "Wishlist"  (hidden)
  /items/1  a.btn.btn-xs.btn-primary[href="https://example.invalid/csfloat"] [13] "Buy on CSFloat"  (hidden)
  /items/1  a.btn.btn-xs.btn-primary[href="https://example.invalid/steam_market"] [15] "Buy on Steam Market"  (hidden)
  /items/1  button.group.self-start.cursor-pointer [17] "close"  (hidden)
  /items/1  button.group.self-start.cursor-pointer [18] "close"  (hidden)
  /auth/steam/callback?openid.mode=bad  a.relative.flex.items-center.px-3[href="/"] [2] "Dashboard"  (hidden)
  /auth/steam/callback?openid.mode=bad  a.relative.flex.items-center.px-3[href="/browse"] [3] "Browse"  (hidden)
  /auth/steam/callback?openid.mode=bad  a.relative.flex.items-center.px-3[href="/inventory"] [4] "Inventory"  (hidden)
  /auth/steam/callback?openid.mode=bad  a.relative.flex.items-center.px-3[href="/wishlist"] [5] "Wishlist"  (hidden)
  /auth/steam/callback?openid.mode=bad  button.group.self-start.cursor-pointer [11] "close"  (hidden)
  /auth/steam/callback?openid.mode=bad  button.group.self-start.cursor-pointer [12] "close"  (hidden)

# per route
  /: 17 read, 4 pass, 6 skipped, 7 findings; LiveView connected; menu revealed by clicking the hamburger
  /browse: 30 read, 0 pass, 6 skipped, 24 findings; LiveView connected; menu revealed by clicking the hamburger
  /inventory: 20 read, 0 pass, 6 skipped, 14 findings; LiveView connected; menu revealed by clicking the hamburger
  /wishlist: 18 read, 0 pass, 6 skipped, 12 findings; LiveView connected; menu revealed by clicking the hamburger
  /items/1: 19 read, 1 pass, 8 skipped, 10 findings; LiveView connected; menu revealed by clicking the hamburger
  /auth/steam/callback?openid.mode=bad: 13 read, 0 pass, 6 skipped, 7 findings; LiveView not connected; menu revealed by clicking the hamburger
# diagnostics, which never carry a verdict
  offline banner (KILL_SWITCH=true)  = rendered
  /items/:id resolved to             = /items/1
  real elements per ground           = --token-bg 64, --token-bg-raised 15, --token-bg-raised-2 0

# 13 cases, 6 PASS, 7 FAIL
# elapsed 27.6s
# finished 2026-08-27T22:55:02.587Z
```

## Stated limits

| Limit | Why it stands | Nature |
|---|---|---|
| **One host, one Chromium, one viewport, one day** | AD-19 asks for the pass once by hand after adoption, and that is what was made. Story 8.1's restyle is the next time it must run, and any Tailwind or daisyUI bump reaching `cs-tracker` is a trigger too | **Decision.** Pending action 2 |
| **The third ground was read on a planted control** | No interactive element in the application sits on `--token-bg-raised-2` on any of the six pages (the diagnostics line counts 0). The reading answers whether the shipped stylesheet paints a visible ring there; it says nothing about a real control's layout, because there is none | **Observed 2026-08-27**, labelled PLANTED in the transcript |
| **The signing salt is read at run time and not recorded** | `cs-tracker` is private and this repository is public. The probe reads the salt out of `endpoint.ex` when it runs and prints only that it did; the unit suite mints against a planted salt. A reader who needs the value has the private repository | **Decision** |
| **Sizes are geometry, not pointer reach** | `boundingBox()` is the element's box in CSS pixels at device scale factor 1. The pass does not evaluate overlap with neighbours, spacing between small targets, or any of the exceptions WCAG allows for an equivalent, inline, user-agent or essential target, under 2.5.5 (Target Size, Enhanced: 44 by 44 CSS pixels, the criterion the contract's floor matches) or 2.5.8 (Target Size, Minimum: 24 by 24, WCAG 2.2); `--tap` is the contract's floor, 44 on both axes, and that is what was measured | **Decision** |
| **Hidden elements were skipped, not measured** | The desktop nav (`hidden md:flex`), the hidden flash close buttons and the two desktop-only buy links have no box at 360px. They are counted as skipped and listed in the transcript, never as passes | **Decision** |
| **A zero-duration transition is excluded by reading, not by reasoning** | The 29 exclusions rest on the computed `transition-duration` being `0s` on every entry of the list. A stylesheet change that gives daisyUI's fields a duration turns every one of them into a finding on the next run. The duration compared is the longest entry in the computed `transition-duration` list, whichever entry the outline's own property occupies in `transition-property`, so a list such as `color, outline-color` over `0.15s, 0s` counts as a finding: the rule over-counts and never under-counts. No reading in this run carried more than one duration | **Observed 2026-08-27** |
| **The seed is synthetic** | Twelve items with probe names, four inventory rows, three wishlist rows, one mark, three snapshots. Real catalog names are longer, which changes link widths and not the heights that fail | **Decision** |
| **The failure page is not a LiveView** | `/auth/steam/callback?openid.mode=bad` is controller-rendered inside `Layouts.app`; the hamburger's JS command still opened the menu without a socket, so the shell was measured there too | **Observed 2026-08-27** |
| **One element per ground** | The ring case reads one element per ground, buttons preferred. The transition rule is read on every element separately, which is why T-1 to T-38 exists beside the three ring rows | **Decision** |
| **The recently-viewed strip is warmed by the probe** | `item_live.ex:57` pushes an item into the in-memory LRU on a connected mount, so the probe visits `/items/1` once before sweeping `/`. Without that, a first run and a second run measure different dashboards, which the first two runs of this pass showed | **Observed 2026-08-27** |
| **The re-run was at `32a466a`, not `8adb8e2`** | The Operator's `32a466a` landed on `cs-tracker`'s `main` between the first run and the re-run; the two commits differ in this story's `AGENTS.md` bullet and that `mix.exs` change only. The measured surface is the same; the commit is named so the transcript's header line is not read as a discrepancy | **Observed 2026-08-27** |
| **Nothing in CI runs this** | It needs a Postgres, a seeded database, a running Phoenix application and a Chromium, none of which is on a runner (AD-21 is about gates that exist). Its pure parts, the cookie, the inputs, the verdicts, the classifier, the transition reader and the summary, carry 44 unit cases at this record's date (the suite's `it` count, which grows with every review) under the blocking `test` job in `ops/__tests__/cs-tracker-accessibility-probe.test.ts` | **Decision** |

## Pending Operator actions

Mirrored as actions 3 and 4 of `ops/contract-adoption.md`; completing one completes both.

| # | Action | Owner | Note | Completed (UTC) |
|---|---|---|---|---|
| 1 | **Decide the disposition of the 74 hit-target findings and the 38 transition findings** | Operator | The geometry is Story 8.1's restyle (`RESTYLE-SPEC.md` § Family A), 18 findings from daisyUI's defaults and 56 from the application's own markup. The two causes behind the transition findings are not geometry: Tailwind v4's `transition-colors` names `outline-color` at 150 ms on 35 controls, and the application's own `transition-all` on the three quick-link cards names `all`, so the ring's colour animates on 38 controls against S-2's never-transitioned rule. Both alternatives cost something a story must decide: excluding `outline-color` from the transition at the `:focus-visible` rule, or dropping `transition-colors` from the shell | _not done_ |
| 2 | **Re-run `node ops/cs-tracker-accessibility-probe.mjs` after Story 8.1, after any Tailwind or daisyUI bump reaching `cs-tracker`, and on AD-22's refresh schedule**, and add this probe to that scope beside the two sibling probes | Operator | The six commands above are the whole setup. The probe exits 1 while any finding remains, so the run is the check | _not done_ |

**Maintaining this file.** When an action is performed, replace its `_not done_` cell with the ISO
8601 UTC completion date and leave the row in place. When the pass is re-run, add a new headline row
and transcript with their own date and keep the old ones, so a later reader can see whether a figure
moved or was simply re-stated. Deletion is not used here.
