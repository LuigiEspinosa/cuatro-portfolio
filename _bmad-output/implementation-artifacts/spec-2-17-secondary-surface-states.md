---
title: 'Story 2.17: Secondary surface states'
type: 'feature'
created: '2026-09-11'
status: 'done'
baseline_commit: '0ad2e4e7f59319b3ec5717ffb6e9bc99d2060cd3'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** Three routes off the homepage still read as half-built. `/recommendation` is a 308 to a PDF
shadowing a dead stub, and nothing links it. `/celeste` is reachable from nowhere, carries no `robots`
directive, and the footer that is meant to be its only entry renders no link, an emptiness three tests
assert. The 404 offers one exit (`← Go home`) where the header offers two, under a stale
`openGraph.title` of `Projects | Luigi Espinosa`. A-13 (distinct `<title>`, `lang` set) holds on every
surface by accident and is asserted nowhere.

**Approach:** Retire `/recommendation` outright (Operator ruling 2026-09-11: redirect and stub both go,
the PDF stays at `/pdf/recommendation-letter.pdf`), so the route answers 404 and every inventory that
classed it as the last surviving 308 moves. Give the footer its one link, to `/celeste`, and give
`/celeste` `robots: { index: false }`. Replace the 404's single exit with the header's own two
destinations, imported rather than retyped, built to `--tap` so the ledger gains no row and `error-back`
is deleted. Assert A-13 across every surface in one new browser spec.

## Boundaries & Constraints

**Always:**

- **The 404's exits are the header's list, not a copy of it.** Export `DESTINATIONS` from
  `Navbar.tsx:57-60` and map over it in `Error404.tsx`, so `RESTYLE-SPEC.md:472` ("never more exits
  than the header, never fewer") is structural rather than asserted.
- **New controls meet the floor.** Both exits and the footer link are `--tap` on both axes
  (`navbar.scss:23-47`, `CvIntro.scss:74-86` are the shape), so the exemption ledger gains no row and
  `error-back` is deleted with the element it described. That deletion moves three things at once
  (`ops/hit-target-floor.md:679-684`): the record's row, `EXEMPTIONS`, and KV-4's prose, plus the literal
  `'Stories 2-30 and 2-32'` pinned at `ops/__tests__/hit-target-floor.test.ts:775,792`, which narrows to
  `'Story 2-32'` the way `:770-774` says it narrowed for 2-15.
- **`error-page.scss` naming `--tap` moves it from `WEIGHT_CALL_SITES` to `TOKEN_NATIVE_STYLESHEETS`**
  (`anchor-contract.test.ts:217-259`): claim two at `:798-803` allows a weight call site exactly
  `--w-black`. `navbar.scss` is the precedent, written into the list's own comment at `:241-247`. Keep
  `error-page.scss:24,40,59` on their line numbers: `anchor-aliases.pw.ts:396,434,464` cite them.
- **The surviving 308 is the framework's.** `/cv/` answers 308 to `/cv` from Next's own trailing-slash
  row (`node_modules/next/dist/lib/load-custom-routes.js:565-572`, `permanent: true`, installed because
  `next.config.js` sets neither `trailingSlash` nor `skipTrailingSlashRedirect`). Both controls that
  leaned on `/recommendation` (`projects-redirect.pw.ts:179-196`, `cv.pw.ts:201-208`) repoint there.
  Measure it before writing it down.
- **No loop is left iterating nothing.** `narrative.pw.ts:82,1202-1207` and
  `anchor-aliases.pw.ts:1003-1005` go vacuous once the redirect set is empty. Delete them rather than
  leave `[]` behind; the pin `toEqual([])` at `:1000` stays, because it still catches a redirect arriving.
- `SURFACES` rows stay one line each in field order (`hit-target-floor.test.ts:226-249`). Counts are read
  off the sweep's failure output, written into both files, and recorded in a dated paragraph
  (`ops/hit-target-floor.md:686-691`).
- Every new predicate is watched failing on a browser-planted control, touching no file
  (`cv.pw.ts` is the newest example). The new spec takes no screenshot (`rendered-output.pw.ts:216-223`).
- `SiteFooter.tsx` and `SiteFooter.scss` are scanned by `Premise.test.tsx:197-206` for spelled-out counts
  and estate names. The label `Celeste` is safe; keep it that.

**Ask First:**

- Any footer link other than `/celeste`. `README.md:112` promised `/recommendation` too; the ruling above
  retires it.
- `robots` anywhere but `/celeste`, or a `robots.txt` or sitemap. None exists today and none is asked for.
- The 404's title text, numeral, `HudLabel` or `ScanlineOverlay`: Story 2-30's.
- Any `SURFACES` row other than `/` and the 404 moving, or a `MINIMUM_*` floor moving.

**Never:**

- Do not restyle the 404 (Story 2-30), sweep its literals (2-34), or replace its focus ring:
  `EXPERIENCE.md:540-542` books that to 2-30. Two size lines and an exits wrapper, nothing else.
- Do not touch `WorkTimeline`, `CvIntro`, the header, or `Navbar`'s markup. The `export` is the only
  change in `Navbar.tsx`.
- Do not add a second link to `/celeste` anywhere, an exit on `/celeste`, or a header on it.
- Do not move or rename `public/pdf/recommendation-letter.pdf`.
- Do not edit a historical dated paragraph in any `ops/` record. Append.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Retired route | `GET /recommendation` | 404, `text/html`, rendered by `Error404` with the two exits, no `Location` | 308 today; `projects-redirect.pw.ts:90` and six inventories in the Code Map say so and move |
| The PDF | `GET /pdf/recommendation-letter.pdf` | 200, `application/pdf`, unchanged | Never touched |
| Framework 308 | `GET /cv/`, `maxRedirects: 0` | 308, `Location: /cv` | The control both redirect specs discriminate against from now on |
| Footer link | `/` rendered | Exactly one `a[href]` in `footer.site-footer`, `href='/celeste'`, inside `<nav aria-label='Footer'>`, `--tap` on both axes | `SiteFooter.test.tsx:27-46` asserts the opposite four ways; rewritten, not patched |
| Footer only | Every route in `SURFACES` | `a[href='/celeste']` matches nowhere except the home footer | Control: one planted in the 404 body |
| No exit | `/celeste` | Zero visible interactive elements; `<meta name='robots' content='noindex'>`; header still `display: none` | The other four surfaces carry no `robots` meta |
| 404 exits | `NOT_FOUND` | `.error-page a[href]` reads `[['Suite','/#suite'],['CV','/cv']]`, equal to `nav.navbar a` on the same page, each at or above `--tap` on both axes | Control: a third link planted in `.error-page` |
| A-13 | `/`, `/work`, `/cv`, `/celeste`, `NOT_FOUND` | `html[lang='en']` on each; the five `<title>` values have no duplicate | Control: `document.title` overwritten with another route's on one page. `/recommendation` is the 404 document, so it is not a sixth title |
| Server output | `renderToStaticMarkup(<Error404 />)` | Two links, in the header's order, no `aria-current` | jsdom unit case; `gsap` mocked as `WorkTimeline.test.tsx:26` does |
| NFR-2 | `/`, `/work`, `/cv`, `/celeste`, `/api/health` | Each answers as it did at `0ad2e4e` | Only `/recommendation` changes status |

</frozen-after-approval>

## Code Map

**`/recommendation`, the retirement**

- `next.config.js:75-79` the row; `:40-52` the docblock that cites it as the 308 example and counts "one
  permanent redirect". After: no row carries `permanent: true`, and the 301 contrast is against the
  framework's trailing-slash 308.
- `app/recommendation/page.tsx`: delete, with its directory. `routesOnDisk(app)` in
  `hit-target-floor.pw.ts` then stops seeing it, which is why `NON_HUB_ROUTES` at `:133` shrinks in the
  same commit.
- `tests/e2e/projects-redirect.pw.ts:77,84-92,179-196`: the `UNTOUCHED` row and the control.
  `tests/e2e/cv.pw.ts:201-208`: the second control, same shape.
- `tests/e2e/anchor-aliases.pw.ts:123-130` (`ROUTES`, "six"), `:909-910`, `:965-971`, `:999-1005`.
- `tests/e2e/narrative.pw.ts:68-82` and `:1202-1207`.
- `tests/e2e/hit-target-floor.pw.ts:121-133` and `:1625-1647`: the `toBe(1)` PDF count goes with its
  member; the content-type case stays.
- `tests/e2e/chrome-nav.pw.ts:8`; `tests/e2e/contract-anchor.pw.ts:1105-1118` takes a third amendment.
- `ops/hit-target-floor.md:185-197`; `ops/anchor-token-adoption.md:283-294,312,322,613-647,693` (line
  693 predicted this story by name); `ops/asset-budget.md:352-354` (already wrong about `/cv`; fix in
  passing) plus a new dated reading under § Every route and § Findings pasted verbatim from
  `node ops/asset-budget.mjs`; `README.md:94,98-99,109-112`.
- `deferred-work.md`: DW-6's summary names `/recommendation` and is re-scoped; DW-74's table names it
  as a control and is historical, leave it.

**`/celeste` and the footer**

- `components/organisms/SiteFooter/SiteFooter.tsx:5-24,58-62` docblock and JSX; `SiteFooter.scss`,
  already in `TOKEN_NATIVE_STYLESHEETS` (`anchor-contract.test.ts:257`). `EXPERIENCE.md:1024`: "one row
  of links". The link is the Secondary kind (`RESTYLE-SPEC.md:191,194-206`): `--token-text-secondary`,
  `--stroke-hair` in `--token-border-interactive` drawn on an inner span, hover to
  `--token-accent-hover`, the standard focus ring, `inline-flex` with `min-block-size: var(--tap)`.
- `components/organisms/SiteFooter/__tests__/SiteFooter.test.tsx:26-46`; `tests/e2e/premise.pw.ts:892-933`
  (drop `.site-footer, .site-footer *` from the sweep at `:900`; the control at `:913-933` plants into
  `.premise__band` and stays).
- `app/celeste/page.tsx:4-6` metadata; `components/organisms/Celeste/Celeste.tsx` renders one `<h1>`
  and no link; `celeste.scss:8-10` is the `#celeste header` rule and `tests/e2e/celeste-header.pw.ts:53-86`
  proves it. `Container.tsx:12-16` derives the body id.
- `tests/e2e/hit-target-floor.pw.ts:114` the `/` row; `ops/hit-target-floor.md:98,104`.

**The 404**

- `components/atoms/Navbar/Navbar.tsx:57-60` `DESTINATIONS` (`href`, `label`, `route`);
  `Navbar.test.tsx:44-49` pins the pairs.
- `components/organisms/ErrorPage/Error404.tsx:44-46` the link; `:10-31` the tween targets
  `.error-page__back`, so both exits keep the class and fade in together. `error-page.scss:52-75`
  `&__back`: add `min-block-size` and `min-inline-size: var(--tap)` after `:60`; add `&__exits` (flex,
  wrap, centred, `gap: var(--s-lg)` per `RESTYLE-SPEC.md:206`) after `:75`, so no cited line shifts.
- `app/app.scss:82-85` scopes `--accent-dim` on `.error-page__back` and `anchor-contract.test.ts:978`
  pins that selector. Keeping the class keeps both.
- `app/not-found.tsx:4-11`: drop the `openGraph` block (Next resolves it from `title`) and fix
  `does not exists`.
- `tests/e2e/hit-target-floor.pw.ts:118,226-234,250-258`; `ops/hit-target-floor.md:102,230,295`;
  `ops/known-violations.md:65,308` ("Seven controls", "one 404 back link", "9 of the 37 elements");
  `ops/__tests__/hit-target-floor.test.ts:770-775,791-793`.
- `app/__tests__/anchor-contract.test.ts:212-221,240-259`: move the path; correct "three now".

**Test conventions**

- `tests/e2e/cv.pw.ts` is the newest spec: `goTo`, planted controls,
  `rootCustomPropertyValue(page, '--tap')`. `app/cv/__tests__/page.test.tsx:268-274` is the metadata
  unit shape. A new `.pw.ts` needs no config (`playwright.config.ts:33-34`).
- `ops/rendered-output-harness.md:48-49` carries one row per browser spec; add one.

## Tasks & Acceptance

**Execution:**

- [x] `next.config.js`, `app/recommendation/page.tsx`: delete the row and the stub; rewrite `:40-52` so
      the 301 contrast points at the framework's trailing-slash 308 and the count reads zero.
- [x] `tests/e2e/projects-redirect.pw.ts`, `tests/e2e/cv.pw.ts`: repoint both controls at `/cv/` (308,
      `Location: /cv`), saying in the comment that it is Next's own row. Drop the `UNTOUCHED` row.
- [x] `tests/e2e/anchor-aliases.pw.ts`, `narrative.pw.ts`, `hit-target-floor.pw.ts`, `chrome-nav.pw.ts`,
      `contract-anchor.pw.ts`: remove `/recommendation` from every inventory, pin the redirect set at
      `[]`, delete the two loops that would iterate nothing, drop the PDF count, amend the docblocks.
- [x] `components/atoms/Navbar/Navbar.tsx`: `export` `DESTINATIONS`. Nothing else.
- [x] `components/organisms/ErrorPage/Error404.tsx`, `error-page.scss`: replace the back link with
      `DESTINATIONS.map(...)` inside `<div className='error-page__exits'>`, each `Link` keeping
      `error-page__back`; add the two size lines and the wrapper rule; note in a comment that the class
      name is 2023 legacy Story 2-30 retires.
- [x] `app/not-found.tsx`: the metadata fix.
- [x] `app/__tests__/anchor-contract.test.ts`: move `error-page.scss` between the two lists with a
      comment on the `navbar.scss` precedent; correct the weight-sites count and its docblock.
- [x] `components/organisms/ErrorPage/__tests__/Error404.test.tsx`: **new.** Exactly two links, equal
      pairwise to `DESTINATIONS`, no `aria-current`, in server output.
- [x] `components/organisms/SiteFooter/SiteFooter.tsx`, `SiteFooter.scss`: add
      `<nav className='site-footer__nav' aria-label='Footer'>` holding one `Link` to `/celeste` labelled
      `Celeste`, underline on an inner span, `--tap` box; rewrite the docblock.
- [x] `components/organisms/SiteFooter/__tests__/SiteFooter.test.tsx`: the four emptiness assertions
      become one `nav`, one link, `href='/celeste'`, nothing else interactive.
- [x] `app/celeste/page.tsx`: `robots: { index: false }`. `app/celeste/__tests__/page.test.tsx`: **new.**
      Title and robots on the exported metadata.
- [x] `tests/e2e/premise.pw.ts`: narrow the sweep at `:900` to `.premise, .premise *`; correct the prose.
- [x] `tests/e2e/secondary-surfaces.pw.ts`: **new, no screenshot.** The matrix rows Retired route,
      Footer only, No exit, 404 exits and A-13, each watched failing on its planted control.
- [x] `tests/e2e/hit-target-floor.pw.ts`, `ops/hit-target-floor.md`, `ops/known-violations.md`,
      `ops/__tests__/hit-target-floor.test.ts`: `/` and 404 rows to the figures the sweep prints; delete
      `error-back` in both files; KV-4 index row and cell to six controls and `Story 2-32`; narrow the
      two pinned literals; a dated paragraph in the record.
- [x] `ops/anchor-token-adoption.md`, `ops/rendered-output-harness.md`, `ops/asset-budget.md` (new
      dated reading after `corepack pnpm build`), `README.md`: bring the records in line, byte-identical
      wherever an ops test pins a literal.
- [x] `deferred-work.md`: re-scope DW-6; file the 404 entrance tween running under reduced motion
      (`hooks/useGsapContext.ts` reads no preference) if no entry has it; file whatever the run surfaces.

**Acceptance Criteria:**

- Given `corepack pnpm test --run`, `corepack pnpm typecheck` and `corepack pnpm build`, when they run,
  then all three pass, `/recommendation` is absent from the route list, and no floor in
  `anchor-contract.test.ts` moved.
- Given `corepack pnpm test:e2e` inside `mcr.microsoft.com/playwright:v1.62.1-noble`, when it runs, then
  it passes with no exemption row added and `error-back` gone, and every control in the new spec and the
  two new unit files has been observed failing its clean counterpart on the same build.
- Given the sweep's own output, when the ledger is read, then the `/` and 404 rows equal what the run
  printed, `ops/known-violations.md` counts six controls, and the pinned closer literal reads
  `Story 2-32`.
- Given `/`, `/work`, `/cv`, `/celeste` and `/api/health`, when each is requested, then each answers
  exactly as at `0ad2e4e`; `/recommendation` answers 404; `/pdf/recommendation-letter.pdf` answers 200.
- Given `git status --porcelain -- tests/e2e/*-snapshots` after a full run, when it is read, then it is
  empty.

## Spec Change Log

- **2026-09-11, implementation finding, no change to the frozen intent.** The `No exit` matrix row
  says "The other four surfaces carry no `robots` meta". Measured against `pnpm start`, the 404
  carries `<meta name="robots" content="noindex">` on every response, injected by Next's not-found
  boundary (`node_modules/next/dist/client/components/http-access-fallback/error-boundary.js:81-84`),
  while `app/not-found.tsx` declares none. `/`, `/work` and `/cv` carry none, as the row says.
  `tests/e2e/secondary-surfaces.pw.ts` asserts the three routed pages bare and pins the 404 to
  exactly the framework's one tag, rather than asserting a bare 404 the build cannot produce. Filed
  as DW-78; the row is left as written because the frozen block is human-owned.
- **2026-09-11, implementation finding.** The planted unfloored control for the footer link had to
  be appended to the `<footer>` rather than the `<nav>`: the nav is a flex row, so a plant there
  became a flex item, stretched to the real link's 44px and passed the floor it exists to fail.
  Recorded in the spec file's comment; no matrix row moved.

## Design Notes

**Why retire rather than keep the 308 unlinked.** The AC is met either way. The Operator chose retirement
on 2026-09-11 so no route on disk is a placeholder. `next.config.js:66-67` reads NFR-2 as forbidding a
404 to a held URL, but that reading was written for `/projects`, a page live at v2.5.3. `/recommendation`
was never a page; its only public surface is the PDF's own URL, which stays.

**Why the footer link is Secondary and sits in a `<nav>`.** The line it joins is mono at `--t-3xs` in
`--token-text-secondary`; a Primary underline there would out-weigh the Directory above it. One link in
a `<nav>` is still footer navigation, and `aria-label='Footer'` is what tells it apart from `nav.navbar`
for assistive tech. `chrome-nav.pw.ts` selects `nav.navbar a` throughout, so nothing there sees it.

**Why the 404 exits meet the floor now.** `error-back` was booked to 2-30 because the back link was 2023
markup nobody was rewriting. Two links written today under the floor would be a new KV-4 breach, which
`ops/known-violations.md:289-294` has no shape for. Two size lines cost less than a ledger row, and 2-30
still owns everything else on the surface.

## Verification

**Commands:**

- `corepack pnpm test --run`: passes; the fast gate for every literal cross-check.
- `corepack pnpm typecheck`: passes.
- `corepack pnpm build`: passes; `/recommendation` absent from the route list, `/celeste` and `/cv`
  static.
- `corepack pnpm test:e2e` inside `mcr.microsoft.com/playwright:v1.62.1-noble`: passes; no baseline
  regenerated.
- `curl -sS -o NUL -w "%{http_code} %{redirect_url}\n" http://localhost:3000/recommendation` and the
  same for `/cv/` against `pnpm start`: `404` with no redirect URL, then `308 http://localhost:3000/cv`.

**Manual checks:**

- Load `/celeste` and view source: `<meta name="robots" content="noindex">`, no header painted, no link
  anywhere on the page.
- Tab through the 404: two exits, the focus ring visible on each. **The two landings are automated
  since the review pass of 2026-09-11**: `tests/e2e/secondary-surfaces.pw.ts` clicks `Suite` from the
  404 and asserts `/` with `#suite` applied and the Directory heading in view, then clicks `CV` and
  asserts `/cv` with its own `<h1>`, on the shape `chrome-nav.pw.ts` has for the header's pair.
- Tab to the footer on `/`: one stop, labelled `Celeste`. The ring on that stop is automated in the
  same file, against `--stroke-focus` and `--token-focus` probes.

## Suggested Review Order

**The 404's exits are the header's list**

- Start here: the same `DESTINATIONS` the header renders, mapped, so a third exit cannot arrive alone.
  [`Error404.tsx:72`](../../components/organisms/ErrorPage/Error404.tsx#L72)

- The one-word change in `Navbar.tsx`, and the docblock that names its second consumer.
  [`Navbar.tsx:63`](../../components/atoms/Navbar/Navbar.tsx#L63)

- Two size lines on a 2023 block, placed so the three cited lines above them keep their numbers.
  [`error-page.scss:69`](../../components/organisms/ErrorPage/error-page.scss#L69)

- Naming `--tap` moved the file between the two partitions, on the `navbar.scss` precedent.
  [`anchor-contract.test.ts:267`](../../app/__tests__/anchor-contract.test.ts#L267)

- The stale `Projects |` Open Graph title dropped rather than retyped; Next fills it from `title`.
  [`not-found.tsx:4`](../../app/not-found.tsx#L4)

**The footer's one link and `/celeste`**

- One `<nav aria-label='Footer'>`, one link, the only way onto the route.
  [`SiteFooter.tsx:74`](../../components/organisms/SiteFooter/SiteFooter.tsx#L74)

- The Secondary kind: `--tap` box, hairline on the inner span, hover recolours, standard ring.
  [`SiteFooter.scss:53`](../../components/organisms/SiteFooter/SiteFooter.scss#L53)

- The first `robots` directive in the tree, and why the 404's is not the second.
  [`page.tsx:12`](../../app/celeste/page.tsx#L12)

**Retiring `/recommendation`**

- No `permanent: true` row of the file's own, and the 301 contrast now against the framework's 308.
  [`next.config.js:50`](../../next.config.js#L50)

- The control that lost its subject, repointed at Next's own trailing-slash redirect.
  [`projects-redirect.pw.ts:195`](../../tests/e2e/projects-redirect.pw.ts#L195)

- The second control of the same shape.
  [`cv.pw.ts:209`](../../tests/e2e/cv.pw.ts#L209)

- The redirect set pinned empty, its per-member loop deleted rather than left iterating nothing.
  [`anchor-aliases.pw.ts:1012`](../../tests/e2e/anchor-aliases.pw.ts#L1012)

- One non-Hub route left, JSON; the PDF-landing count went with its member.
  [`hit-target-floor.pw.ts:139`](../../tests/e2e/hit-target-floor.pw.ts#L139)

**The ledger shrinks by a row**

- `/` 17 to 18, the 404 4 to 5, both read off the sweep's failure output.
  [`hit-target-floor.pw.ts:119`](../../tests/e2e/hit-target-floor.pw.ts#L119)

- `error-back` deleted, and why a story the row did not name deleted it.
  [`hit-target-floor.md:311`](../../ops/hit-target-floor.md#L311)

- KV-4 at six controls, closed by Story 2-32 alone.
  [`known-violations.md:65`](../../ops/known-violations.md#L65)

- The pinned closer literal narrowed with the register, as its own comment said it would.
  [`hit-target-floor.test.ts:778`](../../ops/__tests__/hit-target-floor.test.ts#L778)

**The new browser spec**

- Every surface list in this file is held equal to the sweep's, which derives from `app/`.
  [`secondary-surfaces.pw.ts:270`](../../tests/e2e/secondary-surfaces.pw.ts#L270)

- The retired route answers the 404 document, with the framework's 308 as the reader's control.
  [`secondary-surfaces.pw.ts:307`](../../tests/e2e/secondary-surfaces.pw.ts#L307)

- Second-entrance check on the resolved pathname, so `/celeste/` and the absolute form are seen.
  [`secondary-surfaces.pw.ts:258`](../../tests/e2e/secondary-surfaces.pw.ts#L258)

- The exits: equal to `nav.navbar a` on the same page, at the floor, `--s-lg` apart, landings clicked.
  [`secondary-surfaces.pw.ts:609`](../../tests/e2e/secondary-surfaces.pw.ts#L609)

- A-13, read for the first time: five distinct titles, `lang` on each, and the 404's `og:title`.
  [`secondary-surfaces.pw.ts:771`](../../tests/e2e/secondary-surfaces.pw.ts#L771)

**Peripherals**

- Server output: two links, pairwise equal to the export, and a plant the reader is shown to see.
  [`Error404.test.tsx:70`](../../components/organisms/ErrorPage/__tests__/Error404.test.tsx#L70)

- The four emptiness assertions rewritten, not patched.
  [`SiteFooter.test.tsx:45`](../../components/organisms/SiteFooter/__tests__/SiteFooter.test.tsx#L45)

- The premise sweep narrowed to the premise block through one constant.
  [`premise.pw.ts:905`](../../tests/e2e/premise.pw.ts#L905)

- The 404's `noindex` is Next's, not the Hub's: the finding the matrix did not predict.
  [`deferred-work.md:4003`](deferred-work.md#L4003)

- The planning artifacts still place `/recommendation`; the correction is the retro's.
  [`deferred-work.md:4035`](deferred-work.md#L4035)