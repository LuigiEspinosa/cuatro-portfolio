---
title: 'Story 2.22: Migration step 7, delete the aliases'
type: 'refactor'
created: '2026-09-23'
status: 'done'
baseline_commit: '809bef76286669898c2323aed6e29a850086414f'
review_loop_iteration: 0
warnings: ['oversized']
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** Story 1-18's alias layer still sits in `app/app.scss`: thirteen Hub properties declared
on `:root` as `var()` references to contract roles, which the base `body` rule reads three of. Story
2-33 rebuilt the last component, so no component stylesheet reads any of them (FR-37's removal
condition, pinned since then), and the layer is now only a second name for the contract to drift
from. Test suites, tooling comments and fixtures across the tree still name the aliases, and three
e2e specs read them at runtime.

**Approach:** Delete the thirteen from `app/app.scss`, repoint the base rule at the roles they named,
and leave `--hero-height` the Hub's one custom property. Rework every suite that measured the layer
into one that measures its absence: a unit search over every file git tracks or would track for the
thirteen names, and a browser read of every compiled stylesheet proving that what reaches `:root` is
the contract's properties plus `--hero-height`. The `/work` comparison runs against the baseline
Story 2-33 captured after the last redesign, unchanged, and a unit pin ties that file to the record.

## Boundaries & Constraints

**Always:**

- The deletion set is the thirteen `app/app.scss` aliases: the story's named ten (`--white-color`,
  `--black-color`, `--light-gray-color`, `--gray-color`, `--page-padding`, and the five font aliases
  `--font-regular`, `--font-bold`, `--monument-regular`, `--monument-bold`, `--font-mono`), plus
  `--accent`, `--accent-dim` and `--confillia-normal`, which the second criterion's "only the
  contract's properties plus `--hero-height`" also removes.
- The base rule reads what `DESIGN.md` § The mapping says each alias becomes: `--token-bg`,
  `--f-body` with `--w-regular`, `--token-text`. No computed value on any route moves.
- `--hero-height: 40vh` stays, authored as a literal on `:root`.
- The search reads every file `git ls-files --cached --others --exclude-standard` lists, text only,
  and excludes exactly: Markdown and `_bmad-output/` (the dated record and the planning documents,
  `epics.md` naming the aliases in this very criterion), the suite that holds the list, and
  Tailwind's own `--font-mono` theme key in its three adapter files. Each allowance must still occur.
- The compiled read covers every `.next/static/chunks` stylesheet, grouping rules included, through
  the browser's own parser, and fails closed on a rule it cannot read.
- `node ops/literal-conformance.mjs` exits 0; the `/work` baseline is not regenerated.
- `AGENTS.md`: only the stale alias line in the managed block, corrected minimally, and the commit
  subject says so (DW-81).

**Ask First:**

- Deleting `--hero-height`, regenerating any baseline, or editing `contracts/`, `epics.md`,
  `DESIGN.md`, `EXPERIENCE.md` or `RESTYLE-SPEC.md`.

**Never:**

- No component stylesheet change beyond comments, no markup change, no new dependency, no new CI job.
- No rewrite of dated records: Markdown history keeps the names; a record gains a dated section or an
  amended cell.
- No `color-scheme` or `::selection` rule (DW-95), and no other redesign residue.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Clean tree | The committed tree after this story | `app/app.scss` declares `--hero-height` alone; the search finds none of the thirteen; the compiled root set is the contract's names plus `--hero-height` | N/A |
| An alias back | `var(--white-color)` or `--accent: x` in any searched file, a stylesheet, a spec, a config or a comment | A finding naming the path and the name | N/A |
| Tailwind's key | `--font-mono` in `contracts/tailwind.css`, `packages/tokens/theme-map.json`, `packages/tokens/__tests__/tailwind-adapter.test.ts` | Allowed | An allowance that no longer occurs: a finding |
| Not a reference | `.link--accent`, `--token-accent`, `--accent-dimmer`, a Markdown record, a binary | No finding | N/A |
| Extra on root | A compiled rule on `:root`, on `html` or inside a group declaring a name outside the contract and `--hero-height` | A finding naming the chunk, the selector and the name | N/A |
| Missing from root | A contract name absent from every compiled root rule | A finding naming it | No build, or no `.css` chunk: throws naming the directory |
| Unreadable rule | A nested style rule in a compiled chunk | A finding, never a skip | N/A |
| Base rule | The 404 at 360 | Ground `--token-bg`, copy `--token-text`, family `--f-body`'s, weight `--w-regular`'s; neither colour pure | N/A |
| Baseline | The committed `/work` PNG | Its sha256 is the record's current value, on the Story 2-33 row or a later one; the harness matches it | A hash absent from the table or on an earlier row: a finding |

</frozen-after-approval>

## Code Map

**The layer** (graphify has no CSS custom-property edges; `git grep` over the tree is the map)

- `app/app.scss:3-18` the layer's comment, `:20-61` the `:root` block (thirteen aliases and
  `--hero-height` at `:36`), `:63-90` the `--accent-dim` scope history, `:98-108` the focus comment
  ("beyond the alias mapping"), `:124-132` the base rule reading `--black-color`, `--font-regular`,
  `--white-color`. The consumer scan reads this file whole, comments included, so a role named in
  prose counts as a reference.
- `app/scss/_index.scss:31-34` "Story 1-18 redefined the Hub's custom properties": one clause.
- `components/organisms/SuiteDirectory/SuiteDirectory.scss:1-12` names three aliases and "all
  sixteen" in its header comment.

**Unit pins, `app/__tests__/anchor-contract.test.ts`**

- `:8-40` docblock claims 2 and 3; `:173` `HUB_PROPERTY_COUNT = 14` to 1; `:192-224` `MAPPING`,
  `ROLE_ON_ROOT`, `ALIASED_PROPERTIES`, `ALIAS_ROLES`: replace with the base rule's four roles;
  `:226-236` `FOCUS_ROLES` prose; `:361` `ALIAS_LAYER`; `:750-760` the fourteen case; `:879-968`
  claim one; `:970-1129` the thirteen-row case; `:1224-1254` the FR-37 case, which becomes the search.
- Reuse: `gitLsFiles` (`:406`), `referenceTo` (`:550`, bounded both sides), `withoutComments`,
  `DECLARATION`, `atCollection`, `spawned`. The search excludes this file by path.
- `ops/__tests__/hit-target-floor.test.ts:745-765` and its two siblings read
  `ops/rendered-output-harness.md` rows by marker: the alias row's rewrite must not carry another
  spec's `| \`path\` |` cell.

**Browser pins**

- `tests/e2e/anchor-aliases.pw.ts` (whole file): the counters, both parse cases and the resolve case
  go; the literal case (`:488-554`), the base-rule case (`:579-639`, gains family and weight) and the
  route case (`:641-688`) stay. Build read shape: `accessibility-floor.pw.ts:91-92,777-787`.
- `tests/e2e/contract-anchor.pw.ts:110-144` `HUB_DECLARED`, `PRE_CHANGE_NAMES`, `aliasRole`;
  `:597-616` the count of fourteen; `:1016-1031` a comment; `:1050-1159` the base-rule case, whose
  drift loop and `var(--black-color)` probe resolve to nothing once the names are gone.
- `tests/e2e/type-swap.pw.ts:543-548` reads `--confillia-normal` through `rootCustomPropertyValue`,
  which throws on an absent name; `:714-742` measures `var(--monument-regular)` against
  `var(--monument-bold)`: both move to `var(--f-display)` at the inherited weight and at `--w-black`.
  Prose `:10-34`, `:100-121`, `:164`.
- Names in prose or fixtures only: `tests/e2e/rendered-output.pw.ts:14,61,83,138,156`,
  `tests/e2e/harness.ts:31-45`, `tests/e2e/accessibility-floor.pw.ts:1562,2034`,
  `tests/e2e/chrome-nav.pw.ts:545` (cites `app/app.scss:115-118`), `playwright.config.ts:11`,
  `.github/workflows/ci.yml:234` (same line count: records cite `ci.yml:276-277`),
  `ops/asset-budget.mjs:614`, `ops/__tests__/asset-budget.test.ts:806-877`,
  `ops/__tests__/literal-conformance.test.ts:195,410-413`,
  `components/organisms/WorkHero/__tests__/WorkHero.test.tsx:300-311`,
  `components/organisms/WorkTimeline/__tests__/WorkTimeline.test.tsx:131-133`,
  `components/organisms/HomeLayout/__tests__/HomeLayout.test.tsx:252`.

**Records**

- `ops/anchor-token-adoption.md`: a dated section after § Story 2-34 (`:866`); pending actions 6 and
  9 (`:785`, `:788`) lose their subject.
- `ops/rendered-output-harness.md:47` the alias row, `:58` the type-swap row's two alias reads,
  § Regenerating the baseline (`:226-231`) the unchanged file.
- `ops/contract-adoption.md:63,383` the Anchor "reads the roles through the alias layer".
- `ops/asset-budget.md` § Every route and § Findings, the 2-34 shape (`:473`, `:1430`).
- `deferred-work.md` DW-81 (`:4525`), owned here; new entries after DW-121.
- `AGENTS.md:87-90` inside `<!-- bmad:context -->`.

## Tasks & Acceptance

**Execution** (in this order, on `dev`):

- [x] Before any edit: `corepack pnpm build && node ops/asset-budget.mjs`, the reading and every
      `.css` chunk kept in the scratchpad.
- [x] `app/app.scss`, `app/scss/_index.scss`, `SuiteDirectory.scss`: delete the thirteen and their
      comments, repoint the base rule, rewrite the comments without a role beyond the file's eight.
- [x] `app/__tests__/anchor-contract.test.ts`: the pins above; the repository search and the
      baseline pin, each with planted controls, seen failing on a planted alias and a planted hash.
- [x] `tests/e2e/anchor-aliases.pw.ts`, `contract-anchor.pw.ts`, `type-swap.pw.ts`: the compiled
      root read with its controls; the base rule's four reads; the runtime alias reads removed.
- [x] Every other file the search names: fixtures renamed, prose reworded, line counts held.
- [x] Records and `AGENTS.md`; DW-81 closed, what the run surfaces filed.
- [x] After: build and budget recorded against Story 2-2's baseline; `corepack pnpm typecheck`;
      `corepack pnpm test --run`; `node ops/literal-conformance.mjs`; the container `pnpm test:e2e`;
      commit.

**Acceptance Criteria:**

- Given `app/app.scss`, when it is read, then `:root` declares `--hero-height: 40vh` and nothing else,
  no other selector declares a custom property, and the file names exactly the eight roles of the
  base and focus rules.
- Given the repository, when the unit search runs, then none of the thirteen names occurs outside the
  stated exclusions, and a planted `var(--white-color)` and a planted `--accent:` are each reported.
- Given the committed tree, when `node ops/literal-conformance.mjs` runs, then it exits 0.
- Given FR-17, when the story closes, then that gate reads every stylesheet and a recorded survey of
  the shipped scripts finds colour literals only in the Three.js scenes, seam S-1, and no spacing or
  type literal in an inline style.
- Given the pinned container, when `pnpm test:e2e` runs with no filter, then every spec passes, the
  compiled root set equals the contract's names plus `--hero-height`, `/work` matches the baseline
  whose sha256 stays `93a1aa4e...`, and every route answers 2xx (NFR-2).
- Given the records, when they are read, then the harness record, the adoption record, the budget
  record and DW-81 say what moved, and `AGENTS.md` states nothing false about the aliases.

## Spec Change Log

## Design Notes

Each resolution below is an assumption taken from the documents in their precedence order
(`DESIGN.md` values, `EXPERIENCE.md` behaviour, `RESTYLE-SPEC.md` geometry and the rest).

**The thirteen, not ten.** `epics.md`'s list was written before Story 2-20 aliased
`--confillia-normal`, and it omits Story 1-18's `--accent` and `--accent-dim` rows, but its second
criterion admits nothing on `:root` beyond the contract and `--hero-height`, and `DESIGN.md` § Sequence
step 7 states the acceptance as "no rule anywhere references an alias name". All thirteen go.

**The base rule.** `DESIGN.md` § The mapping: `--black-color` becomes `--token-bg`, `--white-color`
`--token-text`, `--font-regular` `--f-body` plus `--w-regular`. The alias carried the family only and
the body weight was the initial 400, which `--w-regular` equals today; naming the role makes the
contract its source, and no computed value moves.

```scss
body {
  background: var(--token-bg);
  font-family: var(--f-body);
  font-weight: var(--w-regular);
  color: var(--token-text);
  width: 100%;
  min-height: 100vh;
}
```

**"Repository-wide".** A search that read Markdown would have to rewrite dated history, and
`epics.md` itself, to pass. Everything else is read: specs, fixtures, tooling, workflow comments. The
list the search runs on has to name what it pins absent, so that one file is excluded by path.
Tailwind's `--font-mono` is a different property in a different namespace, published for Tailwind
consumers the Anchor is not one of (AD-14).

**"`:root` carries".** Custom properties, because the contract's `:root` carries nothing else. A rule
counts when its selector names `:root` or matches the root element, so `html` and a state such as
`:root:hover` are read too; a nested style rule (none in flattened output) fails closed.

**"The redesigned baseline".** The capture Story 2-33 regenerated after the last redesign
(`93a1aa4e...`). The e2e comparison already runs against the committed file; the unit pin makes "this
file is that capture" a check, and a later regeneration only has to append its row, as the process
already requires.

**FR-17 and S-1.** Story 2-34's gate is the FR-17 check AD-21 names, and it reads stylesheets only
by that story's decision; no gate over `.ts` or `.tsx` is added here either. The closing claim is a
survey instead, recorded with its command: colour literals in shipped scripts sit in the four
Three.js scene files (`Gem`, `ParticleWave`, `Torus`, `VenomSculpture`), and the inline styles carry a
cursor, a collapsed disclosure's height and three entrance custom properties, none a colour, spacing
or type value.

**Filed, not decided.** `--hero-height` has had no call site since at least 2026-08-26 and survives because
this story's criterion names it: a DW entry for the Operator.

**Rollback.** Revert the commit: the layer, the suites and the records return together.

## Verification

**Commands:**

- `corepack pnpm typecheck`: expected clean.
- `corepack pnpm test --run`: expected every file to pass (1,545 tests in 59 files after Story 2-34,
  less the cases retired, plus this story's).
- `node ops/literal-conformance.mjs`: expected exit 0.
- `git grep -n -i -E "['\"]#[0-9a-f]{3,8}['\"]|0x[0-9a-f]{6}|rgba?\(|hsla?\(|oklch\(" -- app components hooks content lib ':(exclude)**/__tests__/**' ':(exclude)*.scss'`
  and `git grep -n -E "style=\{|\.style\." -- app components hooks content lib ':(exclude)**/__tests__/**'`,
  the FR-17 survey: expected the four scene files, and the inline styles named in the Design Notes.
- `corepack pnpm build && node ops/asset-budget.mjs`: expected only the global stylesheet to move,
  lighter; recorded against Story 2-2's 140,000.
- The container `pnpm test:e2e`, no filter: expected green, no snapshot written, the baseline's
  sha256 unchanged.

**Manual checks:**

- None needed: no computed value moves. Lighthouse runs outside `ci.yml` and is not run here for
  that reason.

**As run, 2026-09-23:**

- `app/__tests__/anchor-contract.test.ts`, once the three stylesheets were edited and before any other
  file moved: the repository search failed on the tree with 37 findings across 14 files (every spec,
  fixture, config, tooling comment and workflow comment the Code Map lists), which is the search seen
  failing on real aliases; after the cleanup it passed, 18 of 18 in the file. The planted controls in the same case report `var(--white-color)`, `--accent:`, a
  runtime lookup, a workflow comment and a stale allowance, and pass a BEM modifier, a longer role, a
  longer name and a binary buffer; the baseline pin refuses an unrecorded hash, a current value the
  table lacks and Story 1-10's capture.
- `corepack pnpm typecheck`: clean, before and after the review patches.
- `corepack pnpm test --run`: 59 files, 1,546 tests, all passed (1,545 in 59 before the story: the
  thirteen-row case became the one-property case, the FR-37 case became the search, and the baseline
  pin is new), in 73.5 s, run twice.
- `node ops/literal-conformance.mjs`: exit 0, "read 25 stylesheets, 21 outside the permitted set and 4
  inside it", one alpha allowed, run twice.
- The FR-17 survey: colour literals in `Gem.tsx:27,35`, `ParticleWave.tsx:240,244`, `Torus.tsx:24` and
  `VenomSculpture.tsx:29,37,100,107` only, all Three.js material values (S-1); inline styles in
  `ParticleWave.tsx` (the cursor, five lines), `WorkItem.tsx:160` (a collapsed disclosure's `height: 0`
  and `overflow`) and `GlitchText.tsx:41,43` (`--count`, `--delay`, `--i`). No colour, spacing or type
  literal in an inline style.
- `corepack pnpm build && node ops/asset-budget.mjs`: before `vgd007GkAU7Lyi6-3J296` (Story 2-34's
  chunks exactly), after `37FF9P8STslG2tLdxZeOq`: the global stylesheet 420 bytes lighter on disk and
  112 gzipped, every other stylesheet and every `.js` chunk byte for byte; `/work` 253,763 on the wire,
  113,763 over Story 2-2's 140,000. Filed in `ops/asset-budget.md`.
- Container `pnpm test:e2e`, `mcr.microsoft.com/playwright:v1.62.1-noble`, no filter: 325 passed in
  6.0 minutes, then a filtered run of the three reworked specs (17 of 17) after the build-read controls
  were added, then 325 passed in 5.8 minutes on the final tree after the review patches. No snapshot
  written; the baseline read `93a1aa4e9c8374207ae689707b1e843285ba927fb762ed2f09d105050b9a59d8` before
  and after. The compiled root read logged "12 built stylesheets read, 106 root declarations, 90
  distinct names", all in the global stylesheet: the contract's 89 (the twelve palette colours again
  inside `@supports (color: lab(0% 0 0))`, the four durations again under reduced motion) and
  `--hero-height`.

**The Step-04 review, 2026-09-23.** All six layers ran in this session, because it had no tool to
start a subagent, so none of them is independent of the implementation (the 2-30 to 2-34 precedent);
the independent verifier is the check that is. No intent gap and no spec defect, so no loopback
(`review_loop_iteration` stays 0). Patches, each with a planted control: the compiled root read took a
rule as reaching the root only if it named `:root` or matched now, so a custom property on
`html:has(...)`, which the build carries for the header, or on a hover state of `html`, would have been
missed on a page that does not meet the condition, and `*:not(:root)` would have been a textual false
positive; the read now strips the moment-dependent conditions before matching. A constructed
stylesheet drops an `@import` silently, so a chunk carrying one is now reported as unread. The literal
case's colour route, its four alpha controls and the quote normaliser served no literal the Hub keeps
(Ponytail) and went, the canvas refusal control moving to the base-rule case that uses the helper. One
docblock item in `contract-anchor.pw.ts` described the comparison the file no longer makes. Rejected: a
bare `:hover` rule carrying a custom property (none in any build, and the Hub's own stylesheets are
held to declaring none by the unit suite); the base rule not naming `--lh-body` (it never did, and
adding it moves a render this story must not move); an independent Codex round trip, which the
verifier replaces. The ECC loop read the build, the types, the whole suite and the gate green, found no
secret-like string and no dash character in an added line. The design layer approved: the one surface
is the base rule, which names four roles in place of three aliases resolving to the same values, and no
hover, focus or motion changed.

## Suggested Review Order

**The layer, deleted**

- Start here: `:root` carries the one property that was never an alias, and nothing else.
  [`app.scss:17`](../../app/app.scss#L17)

- The base rule names the four roles its three aliases resolved to, the weight made explicit.
  [`app.scss:57`](../../app/app.scss#L57)

- The thirteen names, held in the one file allowed to name them.
  [`anchor-contract.test.ts:362`](../../app/__tests__/anchor-contract.test.ts#L362)

**Proving the tree names none of them**

- What the search skips, by reason: the dated record and the list's own holder.
  [`anchor-contract.test.ts:385`](../../app/__tests__/anchor-contract.test.ts#L385)

- Tailwind's own `--font-mono` key, a different property, allowed and claimed back.
  [`anchor-contract.test.ts:394`](../../app/__tests__/anchor-contract.test.ts#L394)

- The search as a pure function, so planted controls run the same code as the tree.
  [`anchor-contract.test.ts:1211`](../../app/__tests__/anchor-contract.test.ts#L1211)

- Every file git tracks or would track, raw text, binaries skipped by git's rule.
  [`anchor-contract.test.ts:1257`](../../app/__tests__/anchor-contract.test.ts#L1257)

- `app/app.scss` declares `--hero-height` alone, on `:root`, anywhere in the file.
  [`anchor-contract.test.ts:1045`](../../app/__tests__/anchor-contract.test.ts#L1045)

- Claim one narrowed: the base rule's four roles and the ring's four, exactly.
  [`anchor-contract.test.ts:977`](../../app/__tests__/anchor-contract.test.ts#L977)

**Proving what the build puts on `:root`**

- Every compiled stylesheet through the browser's parser, conditions of the moment stripped.
  [`anchor-aliases.pw.ts:179`](../../tests/e2e/anchor-aliases.pw.ts#L179)

- The allowed set, derived from the contract and `app/app.scss`, never typed.
  [`anchor-aliases.pw.ts:129`](../../tests/e2e/anchor-aliases.pw.ts#L129)

- The case: nothing extra, nothing missing, `--hero-height` once, planted controls firing.
  [`anchor-aliases.pw.ts:383`](../../tests/e2e/anchor-aliases.pw.ts#L383)

- An `@import` or a nested rule is reported unread rather than skipped.
  [`anchor-aliases.pw.ts:213`](../../tests/e2e/anchor-aliases.pw.ts#L213)

- The base rule's ground, copy, family and weight read against probes of the roles.
  [`anchor-aliases.pw.ts:488`](../../tests/e2e/anchor-aliases.pw.ts#L488)

**The redesigned baseline**

- The capture the comparison runs against, pinned to the record's Story 2-33 row or later.
  [`anchor-contract.test.ts:1347`](../../app/__tests__/anchor-contract.test.ts#L1347)

- The verdict as a function: unrecorded, off the table, or pre-redesign are each refused.
  [`anchor-contract.test.ts:1245`](../../app/__tests__/anchor-contract.test.ts#L1245)

- The record: compared against `93a1aa4e…`, not regenerated.
  [`rendered-output-harness.md:247`](../../ops/rendered-output-harness.md#L247)

**Suites that read the aliases at runtime**

- The base-rule case on `/work`: the alias drift loop and the old-name probe left.
  [`contract-anchor.pw.ts:1026`](../../tests/e2e/contract-anchor.pw.ts#L1026)

- The weight distinction measured on `--f-display` where it read the two display aliases.
  [`type-swap.pw.ts:713`](../../tests/e2e/type-swap.pw.ts#L713)

- The hero groups' case no longer reads the retired narrow alias, which would throw.
  [`type-swap.pw.ts:540`](../../tests/e2e/type-swap.pw.ts#L540)

**Records**

- The managed `AGENTS.md` line corrected to state the deletion (DW-81).
  [`AGENTS.md:87`](../../AGENTS.md#L87)

- Step 2's record closed: which sections stopped being true, and their successors.
  [`anchor-token-adoption.md:898`](../../ops/anchor-token-adoption.md#L898)

- The weighed build: the global stylesheet 112 gzipped lighter, nothing else moved.
  [`asset-budget.md:473`](../../ops/asset-budget.md#L473)

- DW-81 closed by its owner, and `--hero-height`'s fate filed for the Operator.
  [`deferred-work.md:4582`](deferred-work.md#L4582)
  [`deferred-work.md:5928`](deferred-work.md#L5928)

- The adoption ledger's Anchor row no longer says the alias layer reads the roles.
  [`contract-adoption.md:63`](../../ops/contract-adoption.md#L63)

**Peripherals**

- A fixture renamed so a colour word inside a reference is still tested.
  [`literal-conformance.test.ts:195`](../../ops/__tests__/literal-conformance.test.ts#L195)

- The two-hop resolver fixture renamed off the deleted names.
  [`asset-budget.test.ts:806`](../../ops/__tests__/asset-budget.test.ts#L806)

- The 2023 sheet's planted rule carries stand-in names for its two alias reads.
  [`WorkHero.test.tsx:301`](../../components/organisms/WorkHero/__tests__/WorkHero.test.tsx#L301)

- A workflow comment reworded on the same line count, since records cite `ci.yml:276-277`.
  [`ci.yml:234`](../../.github/workflows/ci.yml#L234)

- The first token-native stylesheet's header, reworded without the old names.
  [`SuiteDirectory.scss:6`](../../components/organisms/SuiteDirectory/SuiteDirectory.scss#L6)
