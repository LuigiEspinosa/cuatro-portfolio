---
title: 'Story 2.7: Retire `content/projects.ts`; the Hub imports the published Registry'
type: 'refactor'
created: '2026-09-04'
status: 'done'
baseline_commit: '3b3d53e3b5dc1583ac0aad92d2a44303c67ca293'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** The repository holds two registries. `content/projects.ts` is a typed TypeScript
array of one entry that no Elixir or Go consumer can read, and it carries the estate's one
surviving stale Hetzner claim (`ops/known-violations.md:175`). Beside it `contracts/registry.json`
now carries all fourteen entries with confirmed values and a blocking schema gate, so FR-12 is
unmet only because the second representation still exists.

**Approach:** Delete the TypeScript module and the `ProjectEntry` interface it exported, and give
the Hub one typed read of the published JSON. `/projects` keeps its URL and its `ProjectCard`,
now rendering the entries the Registry marks `Live`.

## Boundaries & Constraints

**Always:**

- **The Hub reads `contracts/registry.json` itself**, the same bytes served at
  `https://cuatro.dev/contracts/registry.json`. No emitted copy, no build-time transform, no
  fetch: a static JSON import through the `@/*` alias, `resolveJsonModule` already being on
  (`tsconfig.json:16`).
- **Which entries render is a rule over `status`, written once.** Six are `Live` today. Flipping
  an entry to `Live` must surface it with no second edit, because AD-4 forbids a hand-maintained
  list and Story 2.9 reuses this rule for the Directory.
- **`/projects` never spends a commit broken** (NFR-2). The card design, its class names and its
  link text are unchanged; the card count goes from one to six, which is what changing the data
  source means here. Retiring the route is Story 2.14's job.
- **A new top-level source root is a deliberate change.** `app/__tests__/anchor-contract.test.ts`
  fails on any tracked root carrying shipped sources that is absent from its `SCANNED` list. Add
  the new root there with its reason.
- Typecheck is a blocking gate (AD-21) and every CI gate stays blocking.

**Ask First:**

- Rendering anything other than the `Live` entries, or ordering them by anything but file order.
- Any edit to `contracts/registry.json` or `contracts/registry.schema.json`. A defect found in
  the data is recorded here, never repaired.
- Adding a dependency, a CI job, a runtime fetch, or a runtime schema validation.
- Changing `ProjectCard`'s markup, class names or link text. Only its data source moves.

**Never:**

- Do not add a file under `contracts/`. Three committed listings pin that folder path by path and
  a new file fails all three at once (`AGENTS.md:129-137`).
- Do not delete `content/work.ts` or the `content/` root. Work experience is content, not Registry
  data, and `/work` renders from it.
- Do not add `/suite`, redirect `/projects`, or touch the homepage. Stories 2.9 and 2.14.
- Do not rewrite or lowercase a `source` URL to match an `id`. Four of them would 404
  (`ops/registry-inputs.md:370-373`).
- Do not repair `list-wheel`'s `tech` or any other Registry defect met on the way. Record it.
- Do not widen `NOT_SHIPPED_ROOTS` in `anchor-contract.test.ts`. The new module ships to the
  browser; declaring otherwise to quiet the pin is the failure that guard exists to catch.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| The committed Registry | `contracts/registry.json` as it stands | `/projects` renders the six `Live` entries in file order, each with `name`, `description`, the `tech` list, a Github link to `source` and a Live link to `live` | N/A |
| An entry becomes Live | `status` flipped to `Live` with a `live` hostname | It renders, and the hero's count follows, with no other edit to any file | N/A |
| An entry leaves Live | `status` `Live` to `Archived`, `live` removed | It stops rendering in the same change | The schema gate already forbids `live` on `Archived`, so the two can never disagree |
| A rendered entry with no `live` | Not reachable from the committed data, since `live` is required when `status` is `Live` | The live link is omitted, never rendered with an empty or undefined `href` | The card keeps the conditional; a required field is not a reason to render a broken link |
| `source` is required | Every entry carries one, unlike the retired module's optional `github` | The Github link always renders | The absent-link case moves to `live`, which is genuinely optional, rather than being deleted |
| The published file over HTTP | `GET /contracts/registry.json` against the built server | 200, `application/json`, parses, byte-identical to the authored file | Already asserted by `tests/e2e/contract-serving.pw.ts`, which walks the whole folder. This story adds no test there and must not weaken it |

</frozen-after-approval>

## Code Map

- `content/projects.ts`: **deleted whole.** 35 lines: the `ProjectEntry` interface (`:1-8`) and a
  one-element `projects` array. `:30` is the `'Hetzner VPS'` value `ops/known-violations.md:175`
  records as open. Nothing else in the repository defines `ProjectEntry`.
- `lib/registry.ts`: **new, the only import site of the JSON.** Exports the entry type, the full
  list, and the `Live` rule. See the Design Note for the one type assertion it needs.
- `app/projects/page.tsx`: `:4` the import to repoint, `:22` the `.map`, `:20` the hero. A server
  component; keep it one.
- `components/molecules/ProjectCard/ProjectCard.tsx`: `:7` the type import, `:13` the prop, `:44`
  `project.github` becomes `project.source`. `:36-42` name, description and `tech` need no change:
  the Registry spells those three fields identically. `'use client'` for a GSAP entrance tween.
- `components/molecules/ProjectCard/__tests__/ProjectCard.test.tsx`: `:26-33` the fixture becomes a
  Registry entry (`source`, plus the required `status`, `demo`, `identity`). `:65-69` the
  absent-`github` case has no referent once `source` is required; it becomes the absent-`live`
  case, which the eight non-`Live` entries make real.
- `components/organisms/ProjectsHero/ProjectsHero.tsx`: `:10` and `:15`, where `PROJECT_COUNT` is
  read off the retired module at module scope. It is a client component, so importing the Registry
  here would bundle all fourteen entries into the browser; take the number as a prop instead.
  `:59` renders it.
- `components/organisms/ProjectsHero/__tests__/ProjectsHero.test.tsx`: `:31`, `:36`, `:41` render
  the hero with no props and each needs the new one.
- `app/__tests__/anchor-contract.test.ts`: `:80` `SCANNED`, the list to extend, whose `:73-79`
  comment explains why a root is added rather than excused. `:106` `NOT_SHIPPED_ROOTS`, which does
  not move. `:115` `MINIMUM_SCANNED_FILES` is a floor and one file leaves as one arrives, so it
  holds; `:634-661` is the guard that fails if the new root is unlisted.
- `ops/known-violations.md`: `:175`, the third row of KV-1's naming table. Deleting the file closes
  it, so the row states the closure, this story and the commit. `:171-174` are the two halves
  already closed by Story 1-21 and are the wording to copy.
- `ops/registry-inputs.md`: `:152-156` and `:434`, which name this story as the retirement.
  **Read only**, and still true afterwards.
- `contracts/registry.json`: **read only.** Six `Live`, five `In progress`, three `Archived`.
  `digital-library`'s `tech` is the corrected six-value array; the stale claim was never copied
  across.
- `.github/workflows/ci.yml`: the `test` job runs `pnpm typecheck` then `pnpm test --run`. No job
  is added, so the two suites pinning its job-name set do not move (`AGENTS.md:138-142`).

## Tasks & Acceptance

**Execution:**

- [x] `lib/registry.ts`: add the entry type, the full list and the `Live` rule, over a static
      import of `@/contracts/registry.json`. One assertion at the boundary, with the reason.
- [x] `lib/__tests__/registry.test.ts`: assert the rule, not the data. Every returned entry has
      `status: 'Live'` and a `live` hostname, no `Live` entry is missing from the result, and the
      full list is the file's own length. A count is asserted as a floor, never as six.
- [x] `app/projects/page.tsx`: render from the `Live` rule and pass the count to the hero.
- [x] `components/molecules/ProjectCard/ProjectCard.tsx`: take the Registry entry type and read
      `source` where it read `github`. Markup unchanged.
- [x] `components/organisms/ProjectsHero/ProjectsHero.tsx`: take the count as a required prop and
      drop the module-scope import.
- [x] `content/projects.ts`: delete.
- [x] Both affected test files: update the fixtures and the three prop-less renders, keeping the
      conditional-link coverage the retired `github` case provided.
- [x] `app/__tests__/anchor-contract.test.ts`: add the new root to `SCANNED` with its reason,
      matching the comment style of the two roots already there. **Also narrowed its
      `contracts/`-mention case**, which the new module tripped for real; see the Change Log.
- [x] `ops/known-violations.md`: close the `:175` row against the deletion.
- [x] `deferred-work.md`: file what this pass found and may not fix, the `content/projects.ts:NN`
      citations left dangling in `ops/backup-digital-library.md:46,54` and `CHANGELOG.md:111`
      among them.
- [x] `app/projects/__tests__/page.test.tsx`: **added, not in the original list.** Matrix row one
      is about what the route renders and no test covered the route at all.

**Acceptance Criteria:**

- Given `git grep -n "content/projects\|ProjectEntry" -- app components content hooks lib`, when it
  runs, then it returns nothing.
- Given `corepack pnpm typecheck`, when it runs, then it passes with no `any` and no
  `@ts-expect-error` added.
- Given the built `/projects`, when it is read against the pre-change route, then the card markup,
  class names and link text are identical and only the entries differ.
- Given `git status --porcelain -- contracts/`, when it is read, then it is empty: nothing under
  `contracts/` changed and no file was added there.
- Given `package.json`, when its dependency lists are compared to the baseline commit, then they
  are unchanged.

## Spec Change Log

**2026-09-04, implementation.** No change to the frozen intent. Three decisions taken inside its
boundaries:

- **`anchor-contract.test.ts` needed a second change the Code Map did not predict.** Beyond the
  `SCANNED` root, its case "mentions contracts/ in the wiring file and nowhere else" asserts that
  exactly one source names the folder, and the new module names it for real. That case is about the
  **token** contract reaching the Hub outside the alias layer; the Registry is a different contract
  published in the same folder and read as data (AD-4). It was narrowed rather than widened: the
  file list now holds two entries, and a second assertion pins what the Registry module may name
  under `contracts/` to the Registry pair, so a stylesheet reaching the Hub through the JSON module
  still fails. It failed first against the real tree, which is how it was found.
- **A route-level test was added.** Matrix row one states what `/projects` renders and nothing
  covered the route; the card tests cover one card in isolation. `ProjectsHero` is mocked there
  because jsdom has no WebGL renderer, and its one prop is asserted rather than assumed.
- **One comment was reworded rather than kept.** The acceptance criterion greps `app components
  content hooks lib` for `content/projects`, and the `SCANNED` comment explaining why `lib/` exists
  named the retired path. It now names the story instead, so the criterion holds literally and the
  comment still explains itself.

**2026-09-04, review.** Three layers, no loopback. One finding changed behaviour and was
renegotiated with the Operator; the rest were patched in place.

- **The rendered rule was `Live` only and FR-35 says `Live` or `Complete`** (`epics.md:86`, and
  `contracts/registry.schema.json:60` states it too: "the Suite Directory renders Live and Complete
  (FR-35)"). No entry is `Complete` today, so the rendered set is the same six either way and
  nothing visible moved, which is what made it a trap rather than a bug: the rule Story 2.9
  inherits would have contradicted the requirement it implements. **Renegotiated with the
  Operator**: `selectLive` became `selectRendered` over `RENDERED_STATUSES`, and the frozen matrix's
  `Live` rows all still hold, since a `Live` entry renders either way. **KEEP:** name a selector for
  the rule it implements, not for the value it happens to match today.
- **The type mirrored the schema on `status` and not on `demo` or `identity`**, both of which the
  schema closes with an enum, and nothing compared either list to the schema at all. The gate
  validates the JSON and never opens the module, so a fifth status would have left the assertion
  quietly lying. The value lists are now exported and compared against the schema's own `enum` and
  `required` arrays, with the contract major pinned beside them.
- **Two tests were asserting their own implementation.** The order case compared `renderedApplications`
  to the same filter that produced it, and the hero's count was asserted only against a mock of the
  hero, so a component that ignored the prop and printed a literal would have shipped green under
  six cards. Both now read the committed file or the real component, and the hero's cases use two
  counts, neither of them today's.
- **The invariant behind the `count` prop was left on trust.** Nothing stopped a client component
  importing the Registry and shipping all fourteen entries to the browser. A case now scans the
  shipped roots for that, exempting `import type`, which is erased: it caught `ProjectCard` on its
  first run, which is how the exemption was found to be necessary rather than assumed.
- **The new `contracts/` whitelist was coupled to comment prose.** It required the schema path to
  appear in `lib/registry.ts`, where it appears only inside a doc comment, so rewording that comment
  would have turned the case red under a message describing the opposite. It is a subset assertion
  now, with the Registry import required separately so it cannot pass vacuously.
- Corrected throughout: `live` is absent from **eight** entries, not eleven; a plain **annotation**
  is what TypeScript rejects, not a plain `as`; the absent-`live` card case is justified by
  `Complete` rather than by entries the route never renders; the closed `known-violations.md` row
  says the fix lands at the epic merge rather than today, matching the `0baf1b0` precedent, and its
  table no longer claims one date for rows that moved on three.

## Design Notes

**Why the typed view needs one assertion.** TypeScript infers a JSON module structurally: `status`
widens to `string`, and `live` is simply absent from the eight entries that do not declare it, so
the array's element type is a union no `RegistryEntry[]` is assignable to in either direction. A
plain annotation is rejected and the honest fix is one asserted read at the single import site,
named and explained, rather than an optional-everything type that would make the status rule
unwritable. The assertion is safe because `ops/registry-schema.mjs` is a blocking CI gate over the
exact file being imported: the shape is established before the build, which is also why no runtime
validation is added here. That gate never opens the module, so the value lists the types are built
from are compared against the schema's own `enum` and `required` arrays in the unit suite.

**Why the count is a prop.** `ProjectsHero` is a client component. A module-scope import of the
Registry there would ship all fourteen entries to the browser to render one number, against a
non-3D budget of 140 KB gzipped that Story 2.2 measures. The page is a server component and
already holds the list.

## Verification

**Commands:**

- `corepack pnpm typecheck`: passes. AD-21 makes this the blocking gate the story names.
- `corepack pnpm test --run`: passes. Expect roughly 900 cases. Watch three files specifically:
  `anchor-contract`, `ProjectCard` and `ProjectsHero`.
- `node ops/registry-schema.mjs`: still exits 0, its green line naming four rules. Nothing in this
  story should be able to move it, which is the point of running it.
- `git grep -n "content/projects" -- app components content hooks lib`: no output.

**Manual checks:**

- Run `corepack pnpm dev` and read `/projects`: six cards, each Github link resolving to a real
  repository with its capitalisation intact, each Live link to its declared hostname, and the hero
  reading six.
- The rendered-output and serving assertions run in CI's containerised job. Do not regenerate a
  Playwright baseline on this host: glyph rasterization is not portable and a locally regenerated
  snapshot fails CI (`AGENTS.md:64-67`).

## Suggested Review Order

**The rule, which two later stories inherit**

- Live or Complete, verbatim from FR-35. The review changed this; read why in the Change Log.
  [`registry.ts:91`](../../lib/registry.ts#L91)

- A rule over status and nothing else, taking the list so it can be tested off a state the file is not in.
  [`registry.ts:102`](../../lib/registry.ts#L102)

**The one assertion, and what stands behind it**

- The whole typed view rests on this line. The paragraph above it argues why it is safe.
  [`registry.ts:81`](../../lib/registry.ts#L81)

- The gate validates the JSON and never opens this module. That is the gap named here.
  [`registry.ts:18`](../../lib/registry.ts#L18)

- So the value lists are compared against the schema's own enum and required arrays.
  [`registry.test.ts:63`](../../lib/__tests__/registry.test.ts#L63)

**The boundary the design depends on**

- A client component importing the Registry ships fourteen entries to render one number.
  [`registry.test.ts:189`](../../lib/__tests__/registry.test.ts#L189)

- Which is why the hero takes a number and not the list.
  [`ProjectsHero.tsx:19`](../../components/organisms/ProjectsHero/ProjectsHero.tsx#L19)

**The guard the new module tripped for real**

- A new shipped source root fails this pin rather than escaping the scan.
  [`anchor-contract.test.ts:85`](../../app/__tests__/anchor-contract.test.ts#L85)

- Narrowed, not widened: a stylesheet reaching the Hub through the JSON module still fails.
  [`anchor-contract.test.ts:1004`](../../app/__tests__/anchor-contract.test.ts#L1004)

**The route, unchanged in everything but its source**

- Six cards from the rule, and the count handed to the hero.
  [`page.tsx:22`](../../app/projects/page.tsx#L22)

- `source` has no exceptions in the Registry, so this link stopped being conditional.
  [`ProjectCard.tsx:45`](../../components/molecules/ProjectCard/ProjectCard.tsx#L45)

**The record**

- Closed against the deletion, and dated to the epic merge rather than to today.
  [`known-violations.md:176`](../../ops/known-violations.md#L176)

- Four filed, not fixed: pluralisation, the empty state, the AGENTS.md line, the JSON extension.
  [`deferred-work.md:1949`](deferred-work.md#L1949)

**Peripherals**

- Cards found through their own heading: the schema does not make `name` unique.
  [`page.test.tsx:42`](../../app/projects/__tests__/page.test.tsx#L42)

- Two counts, neither of them six, so a hardcoded number fails whatever it is.
  [`ProjectsHero.test.tsx:50`](../../components/organisms/ProjectsHero/__tests__/ProjectsHero.test.tsx#L50)

- The conditional-link coverage the retired `github` field used to provide.
  [`ProjectCard.test.tsx:84`](../../components/molecules/ProjectCard/__tests__/ProjectCard.test.tsx#L84)
