---
title: 'Story 2.9: The Suite Directory'
type: 'feature'
created: '2026-09-06'
status: 'done'
baseline_commit: '85987baaf26f3da1b8d76f2f3dc6f8b712613587'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** The estate has a published Registry and no directory. `lib/registry.ts:107`
`renderedApplications` already answers FR-35 with six `Live` entries, but the only surface reading it
is `/projects`, a three-column `ProjectCard` grid that draws the containing box `DESIGN.md:661` bans,
never renders `status` at all, labels its links `// Github` and `Live →`, and ships them at 45.88x17.00,
under the floor and exempted as `directory-links` with `closedBy: 'Story 2-9'`. `/#suite` does not
exist, so Story 2-14 has nothing to redirect to, and `app/app.scss:100-102` stops the homepage
scrolling at all.

**Approach:** Build one `SuiteDirectory` organism against `RESTYLE-SPEC.md:238-288`, render it on the
homepage under `id="suite"` and repoint `/projects` at the same component, retiring `ProjectCard`.
Curation, ordering and `You are here` are rules over data, written in `lib/registry.ts` beside the
filter Story 2-7 left there. Unlock the homepage scroll and take the `body` block to `100%` with
`overflow-x: clip`.

## Boundaries & Constraints

**Always:**

- **Every rule is over data, and there is no second list.** Reuse `selectRendered`
  (`lib/registry.ts:102`) rather than re-filtering; add ordering and self-identification beside it as
  exported functions over `RegistryEntry`. Flipping an entry to `Live` in a test fixture must surface
  it, and flipping the Hub's `live` must move `You are here`, with no other edit.
- **`You are here` is a property of the current origin.** Declare the Hub's origin once and have
  `app/layout.tsx:11` `metadataBase` consume that same declaration, so the repository holds one
  origin, not two. An entry matching it renders `You are here` and no live link; it keeps its
  `Source` link (`EXPERIENCE.md:331-332`). Never match on `id`.
- **Token-native, and it is the first stylesheet in the Hub that is.** `SuiteDirectory.scss` consumes
  contract roles directly (`--token-*`, `--s-*`, `--stroke-*`, `--t-*`, `--tap`, `--measure`,
  `--page-pad`), never the Epic 1 aliases. The `anchor-contract` partition gains a token-native list;
  the new file is not appended to `WEIGHT_CALL_SITES`, which means something else.
- **The row geometry is transcribed, not designed.** `RESTYLE-SPEC.md:238-274` is the literal grid,
  including `minmax(0, 5fr)` on the description, `align-self: start` on the status, `padding-inline: 0`
  on the row with the page padded instead, and `760px` as the only breakpoint. The Family group is the
  one container (`DESIGN.md:665-670`), and its last member drops its bottom rule.
- **Strings are verbatim from `EXPERIENCE.md:283-295`**: `The Suite`, `{n} running` where `n` is the
  rendered length and never a literal, the bare domain as the live link text, `Source`, `You are here`,
  and `One product family, distinct implementations, deliberately not merged.` Source links carry
  `Source: {name}` as their accessible name (A-10).
- **A repair moves the whole ledger in one commit.** Deleting the `directory-links` exemption moves
  four things (`known-violations.md:341-361`): the row in `hit-target-floor.pw.ts`, the row and the
  counts in `ops/hit-target-floor.md`, KV-4's "What is in breach" cell, and KV-4's index row. The
  `SURFACES` counts for `/` and `/projects` move in both files too, and are **measured from a real
  run, never computed**.
- Both `SURFACES` tables and `EXEMPTIONS` keep their exact reflow shape: one surface per line in field
  order, two-space indent, trailing comma (`ops/__tests__/hit-target-floor.test.ts:159,216-234`).

**Ask First:**

- **Any route gaining horizontal scroll once `hidden` becomes `clip`.** `known-violations.md:390-400`
  predicts this and books the component half to Stories 2-31 and 2-33, not here.
- Adding a dependency, a CI job, a Playwright project, a second breakpoint, or a client component.
- Editing anything under `contracts/`, `registry.json` included.
- Rendering any entry outside `selectRendered`, or ordering by anything but status then file order.

**Never:**

- **Do not write the Status mark's assertions.** Story 2.10 owns them and depends on this. Render all
  three axes correctly; assert nothing about them here.
- **Do not repair `WorkItem.scss:64` or `WorkHero.scss`.** They own 28 of KV-5's 36 overflowing
  elements and belong to Stories 2-31 and 2-33. KV-5 stays `Open` after this story.
- Do not add the skip control, the premise block, the framework band, the nav reshape or the
  `/projects` redirect: Stories 2-11, 2-12, 2-13, 2-14 and 2-15, each of which depends on this one.
- Do not delete the alias layer (`app/app.scss:18-60`); Story 2-22 owns it. Remove only the two
  `.project-card` scoped selectors, because their subject is gone.
- Do not take a screenshot or call `toHaveScreenshot`: `rendered-output.pw.ts:216-223` keeps exactly
  one committed baseline, and `ops/__tests__/hit-target-floor.test.ts:612-618` forbids the call here.
- No empty state, skeleton, spinner, toast, card, box, shadow, gradient, radius, filled control,
  emoji or invented metric. An empty render is a defect, not a state (`EXPERIENCE.md:636`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| The curated set | Six `Live`, five `In progress`, three `Archived` | Six rows render; the other eight do not | The count in the heading is the rendered length, never a literal |
| A status flips | A fixture entry moved to `Live` | It appears with no other edit, and disappears when moved back | Asserted in both directions, so the filter cannot be a list |
| Ordering | A fixture holding `Complete` before `Live` in file order | Every `Live` precedes every `Complete`; within a status, file order is preserved | Stable sort, not alphabetical and not by date |
| The Hub's own entry | `live` matching the declared origin | `You are here`, not a link; `Source` still renders | Move the origin and the mark moves with it |
| `Complete` entry | `status: Complete`, no `live` | No live link at all, and no disabled one | The slot does not render; never a placeholder or a dash |
| The Family group | Two of three `tracker-family` members pass the filter | One nested `<ul>` with an accessible name, a framing line naming no count, last member drops its rule | A family of one still renders as a group; the line does not change |
| A long unbroken token | A stack name or URL wider than its column | `minmax(0, 5fr)` absorbs it | Without it the grid blows out and A-5 fails at 360px |
| Two destinations on one row | Live and source links | Two independently addressable targets, each at least `--tap` on both axes, `--s-lg` apart | The row is never wholly clickable and the box is never on a wrapper |
| Hover | Pointer over either link | Only the existing underline recolours to `--token-accent-hover` | No lift, scale, shadow, ground or width change |
| Registry unreachable | Any network state | Unchanged: the render is from the build-time static import | There is no fetch to fail |

</frozen-after-approval>

## Code Map

**The component**

- `components/organisms/SuiteDirectory/SuiteDirectory.tsx`: **new.** A **server** component, so the
  Registry stays out of the client bundle and `lib/__tests__/registry.test.ts:189-235` (which fails any
  `'use client'` file value-importing `@/lib/registry`) is satisfied by construction rather than by a
  mock. No GSAP: the orchestrated entrance is Story 2-12's. `<ul>` of entries with the Family group a
  nested `<ul>` carrying an accessible name (A-8, `EXPERIENCE.md:767`); heading `<h2 id="suite">` or a
  container id with the heading focusable, because `EXPERIENCE.md:420` moves focus to the heading.
  DOM order per `EXPERIENCE.md:317-320`: name, status, description, tech, links.
- `components/organisms/SuiteDirectory/SuiteDirectory.scss`: **new.** Flat BEM root, imported from the
  TSX as a side effect, the idiom at `ProjectsHero.tsx:10`. Declares **no** custom property
  (`app/__tests__/anchor-contract.test.ts:609-623` fails any stylesheet outside `app/app.scss` that
  does). Grid verbatim from `RESTYLE-SPEC.md:238-266`; separator `1px solid var(--token-border)`
  (`DESIGN.md:595`) at content width (`:312-313`); links `min-height: var(--tap)` with `inline-flex`,
  the underline on an **inner span** (`RESTYLE-SPEC.md:198-199`), `--stroke-emphasis` accent on live
  and `--stroke-hair` `--token-border-interactive` on source (`DESIGN.md:672-676`). Do not use
  `--accent-dim`, `--monument-bold` or `--monument-regular`: `anchor-aliases.pw.ts:350-422` counts
  their call sites exactly.
- Status mark values: `DESIGN.md:298-323` is the table and `:621-624` settles the dot as a **4px square
  at `--r-none`**. `RESTYLE-SPEC.md:387` says `--r-pill` and is a residual typo that DESIGN.md wins.
- Two details no spine states directly, both settled from the contract rather than invented: the
  `tech` separator is ` · `, already the product's own vocabulary in the footer line at
  `EXPERIENCE.md:295`; the rule under the `The Suite` heading is a hairline, because
  `RESTYLE-SPEC.md:302-304` reads a heading rule that marks nothing actionable as one.

**Data**

- `lib/registry.ts`: `:102` `selectRendered` and `:91` `RENDERED_STATUSES` are reused unchanged. Add
  the ordering rule and the origin rule here as exported functions taking their inputs, matching the
  `:93-101` docblock's reason for doing so: a rule that takes its list can be exercised against a state
  the committed file is not in. `:60-73` `RegistryEntry`; `:29` the four-value union.
- `contracts/registry.json`: **read only.** Fourteen entries, `:6` `cuatro-portfolio` is the Hub's own
  (`live: https://cuatro.dev`), `tracker-family` has three members of which two are `Live`. Nothing is
  `Complete` today, so the `Complete` arms of the filter, the ordering and the no-live-link rule are
  provable only against fixtures.
- `app/layout.tsx:11`: `metadataBase: new URL('https://cuatro.dev')`, the origin that becomes the one
  declaration both this file and the directory read.

**Mount points**

- `app/page.tsx:18-21`: `<main><HomeLayout /></main>`. The directory is the next sibling inside
  `<main>`. There is **no footer component anywhere in the tree**, so nothing follows it.
- `app/projects/page.tsx:17-30`: keep `<ProjectsHero count={renderedApplications.length} />`, replace
  the `<ul className='projects-grid'>` block with `<SuiteDirectory />`. The route is not deleted;
  Story 2-14 redirects it.
- `components/molecules/ProjectCard/**`: **delete** the component, `ProjectCard.scss` and its
  `__tests__`. This is what closes the exemption row.
- Do **not** put the directory inside `Container` (`container.scss:2-4`, `width: min(80%, 1920px)`),
  which leaves 288px of content at 360px and is what `known-violations.md:399` blames for the hero
  overflow. The list pads itself with `var(--page-pad)`.

**The stylesheet repair**

- `app/app.scss:92-103`: `width: 100vw` becomes `100%`; `overflow-x: hidden` becomes
  `html, body { overflow-x: clip }` (`DESIGN.md:558-559`); the nested `&[id=''] { overflow: hidden }`
  at `:100-102` is **removed**, because it is the single reason a homepage section cannot be scrolled
  to. `height: 100vh` at `:97` clamps the body to one viewport and becomes a `min-height`.
- `app/app.scss:74-84`: drop `.project-card` and `.project-card__tech li` from the scoped `--accent-dim`
  block; keep `.work-item::before` and `.error-page__back`.
- `components/organisms/HomeLayout/HomeLayout.scss:8-10`: `body[id=''] { overflow: auto }` under
  `max-width: 767px` is an override of a rule that no longer exists. **Read it before editing**: it is
  either dead or load-bearing on mobile, and the answer decides whether it goes.
- `HomeLayout.scss:14-20` `height: 100dvh` stays: the hero is one viewport and the directory follows it.

**Gates that move, all of which fail with a message that does not say what happened**

- `tests/e2e/hit-target-floor.pw.ts`: delete `:211-218` (`directory-links`); move `SURFACES` `:82` (`/`)
  and `:84` (`/projects`). `:329` walks routes off disk, so a new route would have to be declared;
  this story adds none. `ENTRANCE_SELECTOR` `:108` needs no change, since a server component with no
  GSAP animates nothing.
- `ops/hit-target-floor.md`: the mirror. Surfaces table `:89-97` including the total on `:97`, the row
  at `:152`, the detail rows `:183-184`, and the tolerated-breach counts `:199-202`. Rules `:430-444`.
- `ops/known-violations.md`: KV-4 index row `:65` and entry `:287-361` (four surfaces become three);
  KV-5 index row `:66` and entry `:365-409`, whose stylesheet half closes here while the entry stays
  `Open` for the component half. The index is **derived**: edit the entry's cells first (`:55-58`).
- `ops/__tests__/hit-target-floor.test.ts:664-690` pins KV-4 and KV-5 index cells as **literals**, so
  narrowing either row edits this file too. `:537-558` is the gate that forces the deletion: it fails
  the moment `2-9-the-suite-directory` reads `done` while its row survives. `:692-715` forbids a dotted
  `Story 2.9`.
- `app/__tests__/anchor-contract.test.ts`: `:766-777` restricts contract-token references to
  `app/app.scss` plus the four `WEIGHT_CALL_SITES` `:212-217`; `:912` pins the four scoped selectors as
  an exact sorted array, two of which are being deleted. `:345` `HUB_PROPERTY_COUNT = 16` and `:143`
  `DECLARED_COUNT = 89` are exact; `:131-134` are floors and are safe.
- `tests/e2e/anchor-aliases.pw.ts`: `:57-79` throws on two component stylesheets sharing a basename;
  `:350-419` `CALL_SITES` with `:421` `CALL_SITE_COUNT = 15` and `:422` `BOUNDARY_COUNT = 4` are exact
  counts of `var(--accent-dim)` call sites, and deleting `ProjectCard.scss` moves them. `:123` `ROUTES`
  is hand-listed and unchanged, since no route is added.
- `.github/workflows/ci.yml`: **read only.** `:276-277` already runs the whole `tests/e2e` directory. A
  seventh job fails `ops/__tests__/contract-purity.test.ts:1027` and `registry-schema.test.ts:1721` at
  once, neither saying a job was added.

**Test idioms to copy**

- `app/projects/__tests__/page.test.tsx`: the route-level idiom, rewritten here. jsdom applies no
  stylesheets, so every 44x44 and overflow claim is Playwright's, never Vitest's.
- `lib/__tests__/registry.test.ts:130-190`: the fixture-driven idiom for proving a rule against a state
  the committed Registry is not in. This is where the `Complete` arms and the status-flip demonstration
  belong.

## Tasks & Acceptance

**Execution:**

- [x] `lib/registry.ts`: add the ordering rule (`Live` before `Complete`, then file order) and the
      origin rule behind `You are here`, both as functions over their inputs beside `selectRendered`.
- [x] `app/layout.tsx`: consume the single origin declaration for `metadataBase`, so the origin the
      directory compares against and the origin the site declares cannot drift apart.
- [x] `components/organisms/SuiteDirectory/SuiteDirectory.tsx` and `.scss`: **new.** The `<ul>`, the
      Family group, the Status mark, the two links, the strings, and the grid from
      `RESTYLE-SPEC.md:238-274`, token-native.
- [x] `app/page.tsx`: render the directory after `<HomeLayout />` inside `<main>`, giving `/#suite` a
      target that resolves and moves focus to the heading.
- [x] `app/projects/page.tsx`: render the directory in place of the `ProjectCard` grid; delete
      `components/molecules/ProjectCard/` whole.
- [x] `app/app.scss`: `100%`, `overflow-x: clip` on `html, body`, remove the home-route
      `overflow: hidden`, `min-height` in place of `height: 100vh`, and drop the two dead
      `.project-card` scoped selectors.
- [x] `app/__tests__/anchor-contract.test.ts` and `tests/e2e/anchor-aliases.pw.ts`: admit the
      token-native stylesheet, re-pin the scoped-selector array, and move the `--accent-dim` call-site
      counts that deleting `ProjectCard.scss` changes.
- [x] `components/organisms/SuiteDirectory/__tests__/`, `lib/__tests__/registry.test.ts` and
      `app/projects/__tests__/page.test.tsx`: cover every row of the I/O matrix that jsdom can see,
      the status-flip demonstration and the ordering rule among them.
- [x] `tests/e2e/hit-target-floor.pw.ts`, `ops/hit-target-floor.md`, `ops/known-violations.md` and
      `ops/__tests__/hit-target-floor.test.ts`: delete the `directory-links` row, move both `SURFACES`
      counts from a real run, and bring KV-4, KV-5 and their pinned literals into line.

Added during execution, beyond the list above:

- [x] `tests/e2e/suite-directory.pw.ts`: **new.** The two matrix rows no jsdom test can reach, the
      long unbroken token and the hover rule, each with a control verified to fire. Planting the
      token found a real defect rather than a missing test: `.suite-directory__rule` is a flex item
      whose automatic minimum is its min-content width, so a long hostname put its right edge at
      1007px against a 360px viewport. Fixed with `min-inline-size: 0`, measured not reasoned.
- [x] `components/organisms/SuiteDirectory/SuiteDirectory.tsx`: export `SuiteDirectoryRow` so a
      `Complete` entry can be rendered from a fixture without mocking `@/lib/registry`. No `entries`
      prop was added to the section, so rendering something other than the rendered set stays
      structurally unreachable.
- [x] `ops/__tests__/hit-target-floor.test.ts`: normalise line endings in its one `read()` helper.
      Its parsers anchor on `\n` and `.gitattributes` deliberately does not cover `.ts`, so on a
      Windows checkout the suite failed at collection with "no EXEMPTIONS literal was found", which
      reads as a deleted const rather than as a checkout property. Pre-existing at
      `85987ba`; repaired here because it left this story's own acceptance criterion unsatisfiable
      on the authoring machine and the ledger this story rewrote verifiable only in CI.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md`: file the F-8 tension. The `Live` dot
      correctly fills 4px with `--token-accent` per `DESIGN.md:298-303`, which the binary grep at
      `RESTYLE-SPEC.md:654` expects zero of. Story 2-34 needs a named exemption scoped to the dot's
      selector, as `::selection` has at `:657`, rather than a softened predicate.
- [x] `ops/rendered-output-harness.md`, `ops/anchor-token-adoption.md`, `README.md`,
      `app/scss/_print.scss`: the counts and references that moved with the deleted component.

**Acceptance Criteria:**

- Given `corepack pnpm test:e2e` inside `mcr.microsoft.com/playwright:v1.62.1-noble`, when it runs,
  then it passes with no exemption naming Story 2-9 left in the ledger, and the `/` and `/projects`
  counts in the spec and in `ops/hit-target-floor.md` are the measured ones.
- Given the homepage at 360px, when it is loaded, then the directory is reachable by scrolling, its
  heading is `The Suite` beside the real rendered count, and `document.scrollingElement.scrollWidth`
  does not exceed `innerWidth` on **any** route: the `clip` swap must not turn KV-5's clipped overflow
  into scrollable overflow.
- Given the six rendered entries, when they are inspected, then each carries a Status mark, a
  description and a `tech` line; the Hub's carries `You are here` and a `Source` link and no live link;
  and every other carries a bare-domain live link and a `Source` link at least 44x44 by
  `boundingBox()`, `--s-lg` apart.
- Given `corepack pnpm test --run` and `corepack pnpm typecheck`, when they run, then both pass, and
  no test mocks `@/lib/registry` to make the directory render.
- Given `git grep -n "project-card"`, when it runs after the change, then it returns nothing outside
  `_bmad-output/` and `ops/`.
- Given `git status --porcelain -- tests/e2e/*-snapshots`, when it is read after a full run, then it is
  empty: no snapshot directory was created or changed.

## Design Notes

**Why one component on two routes rather than a homepage-only build.** The `directory-links` exemption
names `Story 2-9` as its closer, and `ops/__tests__/hit-target-floor.test.ts:537-558` fails the moment
this story reads `done` on the board while that row survives. So `/projects` is in scope whether or not
the epic text says so. Repointing it at the same component is the only shape that cannot disagree with
the homepage rendering, which is the defect Story 2-14 exists to prevent. Two mount points collapse to
one when that redirect lands.

**Why server-rendered with no client boundary.** `lib/__tests__/registry.test.ts:189-235` fails any
`'use client'` file that value-imports the Registry, because a client component ships all fourteen
entries to a visitor who may see six. A server component satisfies that without a props-drilling
ceremony, and the directory has no state: hover and focus are CSS, and the entrance belongs to
Story 2-12.

**Why `clip` is expected to be safe here and is still verified.** `overflow-x: clip` clips exactly as
`hidden` does; what it does not do is make the element a scroll container, which is why `hidden` breaks
descendant `position: sticky` (`DESIGN.md:558`). On that reading KV-5's warning at
`known-violations.md:390-400` is about a hazard the swap does not create. The reading is not asserted:
the acceptance criterion measures `scrollWidth` on every route, and a route that gains real scroll is
an Ask First, because the elements that would overflow belong to Stories 2-31 and 2-33.

## Verification

**Commands:**

- `corepack pnpm test --run`: passes. Roughly 890 tests today, less whatever `ProjectCard`'s suite
  contributed, plus the directory's own.
- `corepack pnpm typecheck`: passes. AD-21 makes it blocking.
- `corepack pnpm test:e2e`: run inside the pinned image only; DW-23 records the working container
  invocation.
- `corepack pnpm build`: passes, confirming the static Registry import still resolves at build time.

**Manual checks:**

- Render the directory in greyscale at 360px and confirm every row reads as separate from its
  neighbour and no row has become a card (`RESTYLE-SPEC.md:291-292`). Story 2.10 owns the recorded
  greyscale check for the Status marks; this is the row-separation half.
- Confirm the `SURFACES` counts were read off a real run rather than computed from the entry count,
  and that no `44` literal was written into the spec (`ops/__tests__/hit-target-floor.test.ts:588-610`).
- Confirm no description was edited to fit the layout. `contracts/registry.json` is read only here, and
  the editorial pass that authored them was Story 2-6.

## Suggested Review Order

**The rules, which is where the design actually lives**

- Start here: four exported rules over data, so the directory holds no second list.
  [`registry.ts:118`](../../lib/registry.ts#L118)

- `You are here` compares origins, never ids, so moving the Hub moves the mark.
  [`registry.ts:140`](../../lib/registry.ts#L140)

- Rank comes from `RENDERED_STATUSES`, so ordering is the same fact that decides rendering.
  [`registry.ts:157`](../../lib/registry.ts#L157)

- Where grouping beats ordering, and why FR-11 says it should.
  [`registry.ts:192`](../../lib/registry.ts#L192)

**The component, and why it has no client boundary**

- A server component by necessity: a client one ships all fourteen entries to see six.
  [`SuiteDirectory.tsx:13`](../../components/organisms/SuiteDirectory/SuiteDirectory.tsx#L13)

- `You are here` replaces the live link only; `Source` survives on every entry.
  [`SuiteDirectory.tsx:105`](../../components/organisms/SuiteDirectory/SuiteDirectory.tsx#L105)

**The row, transcribed rather than designed**

- The grid from `RESTYLE-SPEC.md:238-274`, `minmax(0, 5fr)` included.
  [`SuiteDirectory.scss:75`](../../components/organisms/SuiteDirectory/SuiteDirectory.scss#L75)

- The double-hairline fix: a row before the family group drops its rule.
  [`SuiteDirectory.scss:108`](../../components/organisms/SuiteDirectory/SuiteDirectory.scss#L108)

- Three structural axes, written for all four values though two never render today.
  [`SuiteDirectory.scss:170`](../../components/organisms/SuiteDirectory/SuiteDirectory.scss#L170)

**Unlocking the homepage, which is KV-5's stylesheet half**

- `clip` clips as `hidden` does; what it stops doing is creating a scroll container.
  [`app.scss:97`](../../app/app.scss#L97)

- Deleted, not kept: an `overflow` shorthand would have undone the new `clip` at 360.
  [`HomeLayout.scss:6`](../../components/organisms/HomeLayout/HomeLayout.scss#L6)

- The mount that gives `/#suite` something to resolve to.
  [`page.tsx:26`](../../app/page.tsx#L26)

**What holds the change honest**

- The repair is pinned, so reverting `clip` to `hidden` now fails instead of passing.
  [`suite-directory.pw.ts:256`](../../tests/e2e/suite-directory.pw.ts#L256)

- Lenis does not eat the fragment: the heading is scrolled to and focused.
  [`suite-directory.pw.ts:323`](../../tests/e2e/suite-directory.pw.ts#L323)

- Hover reads twenty properties and compares nineteen as one object.
  [`suite-directory.pw.ts:497`](../../tests/e2e/suite-directory.pw.ts#L497)

- Counts measured off a real run: `/` 5 to 16, `/projects` 19 to 18.
  [`hit-target-floor.pw.ts:85`](../../tests/e2e/hit-target-floor.pw.ts#L85)

- A control that used to pass for an unrelated reason, re-measured and renamed.
  [`hit-target-floor.pw.ts:1323`](../../tests/e2e/hit-target-floor.pw.ts#L1323)

- The floor and the `--s-lg` separation, both read from the running page.
  [`hit-target-floor.pw.ts:1483`](../../tests/e2e/hit-target-floor.pw.ts#L1483)

**The ledger, where the tolerated breaches shrank**

- Fifteen controls to thirteen: the two card links went with their component.
  [`known-violations.md:287`](../../ops/known-violations.md#L287)

- Stays `Open`. Only the stylesheet half closed; the component half is 2-31 and 2-33.
  [`known-violations.md:367`](../../ops/known-violations.md#L367)

**Peripherals**

- The Hub's first token-native stylesheet, admitted by name and asserted non-empty.
  [`anchor-contract.test.ts:236`](../../app/__tests__/anchor-contract.test.ts#L236)

- One origin for the whole app, now enforced across every `.tsx` under `app/`.
  [`registry.test.ts:285`](../../lib/__tests__/registry.test.ts#L285)

- The `Complete` arm the committed Registry cannot reach, proved on fixtures.
  [`SuiteDirectory.test.tsx:240`](../../components/organisms/SuiteDirectory/__tests__/SuiteDirectory.test.tsx#L240)

- The homepage mount, which nothing pinned until review asked.
  [`page.test.tsx:1`](../../app/__tests__/page.test.tsx#L1)

- Print keeps the dot, the one medium where greyscale is the whole argument.
  [`_print.scss:4`](../../app/scss/_print.scss#L4)
