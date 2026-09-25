---
title: 'Story 2.34: FR-17 conformance, no colour literal outside the contract'
type: 'feature'
created: '2026-09-23'
status: 'done'
baseline_commit: '802fbf41065efbc16780161b9a397699c9564fd5'
review_loop_iteration: 0
warnings: ['oversized']
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** Eight redesign stories made the Hub's stylesheets token-native and nothing holds them
there. FR-17 ("no colour, spacing or type value in the Hub's own styling bypasses the token
contract") is enforced by no CI job, although AD-21 lists the FR-17 conformance check among the
blocking gates, so a ninth commit can write `#fff` or `44px` back and ship green. The residue that
check would meet today is `celeste.scss`'s `#444` ground, `#fff` heading, `system-ui` family and
`min(8vw, 5rem)` size, and `app/app.scss`'s dead `--accent-glow: rgba(139, 92, 246, 0.4)`.

**Approach:** Add `ops/literal-conformance.mjs`, a source scan importing only `node:` builtins,
run by a new blocking `literal-conformance` job over every stylesheet git tracks or would track. It
refuses colour literals and a hand-written `44px` anywhere outside the permitted set (`contracts/`
and `app/scss/_print.scss`), spacing literals in spacing properties, type literals in type
properties, and alpha in every stylesheet but the one `--c-scrim` declaration in
`contracts/tokens.css`. Every allowance is a named entry in the gate's configuration with its
reason. Clear the residue with the roles the design documents give, so the gate lands green.

## Boundaries & Constraints

**Always:**

- The permitted set is exactly `contracts/` and `app/scss/_print.scss`; the one alpha allowance
  names the palette declaration `--c-scrim` in `contracts/tokens.css`, never the role
  `--token-scrim`. Both live in the gate's configuration with their reasons, beside the four
  dispositions: `opacity` keyframes allowed, `clip-path` coordinates allowed, a hand-written `44px`
  rejected, `font-variation-settings` axis literals allowed.
- The job is blocking: no `continue-on-error`, `|| true`, `if:` or `needs:`. It installs nothing and
  runs `node ops/literal-conformance.mjs` with no argument and no `env:`; nothing at runtime
  redirects what the gate reads.
- No inline suppression. Comments are never read, so no comment in a stylesheet silences the gate.
- A gate that read nothing refuses: a failed listing, or no stylesheet outside the permitted set,
  exits 1.
- Stylesheets only (`*.css`, `*.scss`; a `*.sass` file is refused as unparsed). Seam S-1, the
  Three.js scene's JS colours, is the declared exception.
- The two suites that pin `ci.yml`'s job set, `ops/__tests__/contract-purity.test.ts` and
  `ops/__tests__/registry-schema.test.ts`, move in the same commit; the new job's wiring cases live
  beside its module.
- `/celeste` keeps its words, markup, centring and hidden header: only its four literal
  declarations change.

**Ask First:**

- Changing `contracts/`, `epics.md`, `DESIGN.md`, `EXPERIENCE.md`, `RESTYLE-SPEC.md` or `AGENTS.md`.
- A third entry in the permitted set, or a second alpha allowance.

**Never:**

- No new dependency (no stylelint, PostCSS or Sass in the gate), no gate over built CSS, and none
  over `.ts` or `.tsx`.
- No F-8 accent-fill grep, F-11 `::selection` rule, `url(` tell or `:hover` gating check: deferred
  entries book them to this story, they are outside its criteria, and each is re-booked with
  evidence.
- No restyle of `/celeste` beyond its literals, and no deletion of the alias layer (Story 2-22)
  beyond `--accent-glow`.
- No `eslint` invocation and no lint criterion.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Clean tree | The committed tree after this story | Exit 0; one line naming the stylesheets read in and outside the permitted set and the one alpha allowed | N/A |
| Colour literal | `#fff`, `#ffff`, `rgb(`, `rgba(`, `hsl(`, `hsla(`, `oklch(`, `color-mix(` or a named colour in any case, in any declaration (custom properties and Sass variables included) or Sass at-rule argument, outside the permitted set | Exit 1, one finding per literal naming `path:line`, the property and the literal | N/A |
| Permitted | The same literals in `contracts/` or `app/scss/_print.scss` | No finding | N/A |
| Alpha | `--c-scrim` with a slash alpha in `contracts/tokens.css` | Allowed | Alpha on any other declaration there, on `--token-scrim`, in `_print.scss`, or a hand-written copy of the scrim value anywhere: a finding |
| Role-named allowance | The allowance written against `--token-scrim`, over the real `contracts/tokens.css` | A finding at `--c-scrim` (review finding HIGH-4) | N/A |
| Dispositions | `opacity` in `@keyframes`; `clip-path: polygon(... 10px ...)`; `font-variation-settings: "wdth" 85, "opsz" 48`; `font-stretch: 85%` | No finding | N/A |
| 44px | `min-height: 44px`, `--tap-local: 44px`, `$tap: 44px`, `calc(44px + 0px)` outside the permitted set | A finding each | N/A |
| Spacing | A non-zero absolute or font-relative length (`px`, `rem`, `em` and their kin) in the `padding`, `margin`, `gap`, `inset`, `scroll-margin` or `scroll-padding` families or `top`, `right`, `bottom`, `left`, a `var()` fallback included | A finding | `0`, `auto`, a `var()` reference, a unitless `calc()` factor, and a percentage or viewport length placing a panel (geometry, like polygon coordinates): no finding |
| Type | Anything but `var()` references and CSS-wide keywords in `font`, `font-family`, `font-size`, `font-weight`, `line-height`, `letter-spacing` | A finding | `font: inherit`: no finding |
| Not a value | A literal in a comment, a string, a `url()`, a `#{}` interpolation, a selector, or a `@media` or `@supports` condition | No finding | N/A |
| Suppression | `/* literal-conformance: ignore */` beside a literal | Still a finding | N/A |
| Out of scope | A `.tsx` carrying `new THREE.Color('#ff0000')` (S-1) | Not read | A `.sass` file: a finding, unparsed syntax |
| Nothing read | No git, not a repository, or no stylesheet outside the permitted set | Exit 1, the refusal naming why | Never exit 0 |

</frozen-after-approval>

## Code Map

**The pattern to follow** (graphify `affected` on either gate reaches its own suite and nothing else)

- `ops/contract-purity.mjs`: the gate's shape to copy: header, `inspect` then `report` then `main`,
  the invoked-directly guard that sets `process.exitCode` before the write (`:392-418`), and
  "nothing redirects it".
- `ops/__tests__/contract-purity.test.ts:890-1047` and `ops/__tests__/registry-schema.test.ts:1604-1735`:
  the CI wiring cases to copy for the new job, and the two exact job-set pins (`:1018-1028`,
  `:1716-1722`) with the step lists beside them (`:1030-1046`, `:1724-1735`) that gain the new job.
- `.github/workflows/ci.yml`: the `registry-schema` job is the shape. The new job goes last, after
  `rendered-output`, because `ops/rendered-output-harness.md:182,209` and three e2e specs cite
  `ci.yml:276-277`, the harness step, by line.
- `app/__tests__/anchor-contract.test.ts:381-398`: `gitLsFiles`, the `git -c core.quotePath=false
  ls-files -z` listing this repository already trusts to leave out `public/contracts/`.

**The residue**

- `components/organisms/Celeste/celeste.scss:2,13,14,16`: the four literals. Line structure kept,
  because `Container.test.tsx:10-11` and `hit-target-floor.pw.ts:93,1402` cite `:1` and `:8-10`.
- `app/app.scss:28-29`: `--accent-glow` and the comment holding it on O-11.
- `app/__tests__/anchor-contract.test.ts`: `HUB_PROPERTY_COUNT` 15 (`:165-170`), `LITERAL_PROPERTIES`
  (`:235-243`), the literal case (`:1103-1117`), the counts' messages (`:739-777`, `:982-988`,
  `:1214-1243`); `TOKEN_NATIVE_STYLESHEETS` (`:278-347`), which `celeste.scss` must join, because the
  consumer partition refuses a role named from an unlisted file.
- `tests/e2e/anchor-aliases.pw.ts:143-157,357-372,484-523` and `tests/e2e/contract-anchor.pw.ts:110,599`:
  the Hub's count of fifteen and the literal pair.
- `tests/e2e/celeste-header.pw.ts:88-118`: reads `rgb(68, 68, 68)` and `rgb(255, 255, 255)`.

**Records**

- `ops/hub-accessibility-pass.md:416` F-2 (booked to Story 2-34), `:458`, `:629`.
- `ops/anchor-token-adoption.md:403-410` (the `--accent-glow` row), `:776`, `:786` (action 7, O-11).
- `ops/asset-budget.md:22,1729` ("Story 2-34 is where a gate belongs"), § Every route, § Findings.
- `_bmad-output/implementation-artifacts/deferred-work.md`: the Story 2-9 entry booking F-8's grep
  and the dot's exemption here (`:2283-2324`), DW-95 (`:4956`), DW-102 (`:5250`), DW-115 (`:5661`).
- New: `ops/literal-conformance.mjs`, `ops/__tests__/literal-conformance.test.ts`,
  `ops/literal-conformance.md`.

## Tasks & Acceptance

**Execution** (in this order, on `dev`):

- [x] Before any edit: `corepack pnpm build && node ops/asset-budget.mjs`, every chunk gzipped at
      level 9, saved to the scratchpad as the before reading.
- [x] `ops/literal-conformance.mjs` and `ops/__tests__/literal-conformance.test.ts`: one case per
      matrix row, the configuration pinned, the real tree, both CLI exit paths on a scratch
      repository, the guard's ordering, `node:` imports only, and the job's wiring. Run the gate on
      the baseline tree first and keep its refusal verbatim for the record.
- [x] `.github/workflows/ci.yml`: the `literal-conformance` job. Both job-set suites to seven jobs,
      their step lists naming its command.
- [x] The residue: `celeste.scss`, `app/app.scss`, `anchor-contract.test.ts`, `anchor-aliases.pw.ts`,
      `contract-anchor.pw.ts`, `celeste-header.pw.ts`.
- [x] Records: `ops/literal-conformance.md`; F-2, O-11 and the budget lines annotated; the four
      booked deferred entries annotated and re-booked; one new entry, `/celeste` left unredesigned.
- [x] After build and budget, recorded in `ops/asset-budget.md`; `corepack pnpm typecheck`;
      `corepack pnpm test --run`; the container `pnpm test:e2e`; commit.

**Acceptance Criteria:**

- Given `.github/workflows/ci.yml`, when it is read, then it carries a `literal-conformance` job
  running exactly `node ops/literal-conformance.mjs` on `ubuntu-latest` and Node 22 within
  `timeout-minutes: 5`, with `actions/checkout@v7` and `actions/setup-node@v7`
  (`package-manager-cache: false`) as its only actions and no `continue-on-error`, `|| true`, `if:`,
  `needs:`, `env:` or `on:`; and both job-set suites name the seven jobs.
- Given the gate's configuration, when it is read, then the permitted set is exactly `contracts/`
  and `app/scss/_print.scss`, the alpha allowance names `--c-scrim` in `contracts/tokens.css`, and
  the four dispositions carry the verdicts allowed, allowed, rejected and allowed, every entry with
  a non-empty reason.
- Given the committed tree, when `node ops/literal-conformance.mjs` runs, then it exits 0 having
  read every stylesheet and allowed exactly one alpha; and on the baseline tree it exited 1 naming
  `celeste.scss`'s four literals and `--accent-glow`.
- Given `/celeste` at 360 in the pinned browser, when it is read, then the ground computes
  `--token-bg`, the heading `--token-text`, the display family with its face loaded and
  `--t-display`, the body still centres on a grid and the header is still hidden; a planted `#444`
  ground and a planted family are each reported by the same reads.
- Given `app/app.scss`, when it is read, then it declares fourteen custom properties, `--hero-height`
  the one literal, and the three suites that count them agree.
- Given the records, when they are read, then `ops/literal-conformance.md` states what the gate
  reads and what it does not, the permitted set, the allowance and the four dispositions with their
  reasons, the job, the first run's refusal verbatim and the stated limits; F-2 and O-11 read closed
  by Story 2-34; and every deferred entry that booked work here says what was taken and re-books
  the rest.
- Given the before and after builds, when `ops/asset-budget.md` is read, then a dated reading gives
  both sides and the non-3D line against Story 2-2's 140,000.
- Given `corepack pnpm typecheck`, `corepack pnpm test --run` and the container `pnpm test:e2e`, when
  run, then every file passes, with no baseline regenerated.

## Spec Change Log

**2026-09-23, during implementation, the spacing row renegotiated.** The gate's first run over the
baseline tree, with the matrix's "length or percentage" rule, refused ten percentage offsets besides
the expected residue: the four home panels' corners in `HomeLayout.scss:82-106` (`top: 12%`,
`left: 8%` and their kin, Story 2-29) and the skip control's `inset-block-end: 4%` and
`inset-inline-start: 50%` in `SkipControl.scss:68-69` (Story 2-13). Those place a panel inside a
composition: geometry, which disposition 2 already keeps out of the check for polygon coordinates,
and exactly the "met at scale on its first run" the dispositions exist to prevent. Amended, acting
for the Operator: the spacing row counts absolute and font-relative lengths only, and a percentage
or a viewport length is geometry. The run on the same tree then read the five residue findings and
nothing else. KEEP: the longhands and physical offsets stay in scope for lengths.

## Design Notes

Each resolution below is an assumption taken from the documents in their precedence order
(`DESIGN.md` values, `EXPERIENCE.md` behaviour, `RESTYLE-SPEC.md` geometry and the rest).

**The gate is R8 in full: colour, spacing and type.** The story's title and first criterion name
colour; its dispositions presuppose the other two ("the spacing check scopes to spacing
properties", "rejects a hand-written `44px` like any other spacing literal", axis literals "not
values on the `--t-*` scale"). `DESIGN.md:1228` defines R8 as "no colour, spacing or type literal
outside `contracts/` and `_print.scss`", as do the spine's Styling convention and FR-17, and
`ops/hub-accessibility-pass.md:416` books `celeste.scss`'s `system-ui` to this story.

**Scopes.** Spacing: the story names padding, margin, gap and the inset shorthands; their longhands,
the physical offsets `inset` expands to, and `scroll-margin` and `scroll-padding` are included,
because a check its own longhand bypasses is not a check. A spacing literal is a non-zero absolute
or font-relative length, the kind a step replaces: "Spacing is a scale, not a value" (`DESIGN.md`
§ Layout & Spacing). A percentage or a viewport length placing a panel is geometry, the same kind of
value as a polygon coordinate (disposition 2), and the contract carries none. Type: the five
properties the contract scales (`--f-*`, `--t-*`, `--w-*`, `--lh-*`, `--tr-*`) and the `font`
shorthand; anything but a `var()` or Sass variable reference and a CSS-wide keyword is a literal.
`font-stretch` carries the same `wdth` coordinates as `font-variation-settings` and stands under
disposition 4. The `44px` rule reads every declaration outside the permitted set, custom properties
and Sass variables included ("no local-constant allowance"). Alpha: `rgba(`, `hsla(`, a four or
eight digit hex, a colour function with a slash or a fourth comma argument, and `color-mix()` with
`transparent`. `transparent`, `currentcolor` and system colours are not named colours.

**What is read.** Declarations, and Sass at-rules that carry values (`@include`, `@mixin` and
`@function` defaults, `@return`, `@if`, `@each`); never selectors, comments, strings, `url()`,
interpolation, `@use`, `@forward`, `@import`, `@extend`, or the conditions of `@media`, `@supports`,
`@container`, `@keyframes`, `@font-face`, `@layer` and `@page`. A statement that is none of these is
a finding, so the gate fails closed rather than skipping text. Masking keeps every offset, so a
finding prints the original text at its real line.

**The listing.** `git ls-files -z --cached --others --exclude-standard` for `*.css`, `*.scss` and
`*.sass`, run in the root resolved beside the module: the committed tree plus whatever a commit would
carry. Gitignored build output (`public/contracts/`, `.next/`) is never a stylesheet a commit
carries. Git and Node are on the runner, so the job installs nothing and still reports on a run
whose install fails.

**The residue.** `#444` becomes `var(--token-bg)`: `RESTYLE-SPEC.md` F-1, "Ground is
`var(--token-bg)`". `#fff` becomes `var(--token-text)`: `DESIGN.md` § The mapping, "Pure white
retired". `system-ui` becomes `var(--f-display)`: `DESIGN.md` § Typography gives Bricolage to
display and headings, and the heading keeps the user agent's bold, 700, inside the face's 700 to
800, so nothing synthesises. `min(8vw, 5rem)` becomes `var(--t-display)`: `DESIGN.md` § Scale, "the
one display line per page". `/celeste` therefore paints `--token-bg` under `--token-text` in
Bricolage, 36px at 360 where it read 28.8px, 72px at 1280 where it read 80. `--accent-glow` is
deleted: `DESIGN.md` § The mapping drops it and closes O-11 (2026-08-15); Story 1-18 kept it on
`epics.md:1835` and left the disagreement to the Operator as action 7; it has zero call sites, the
gate cannot land green over it, and the precedence order gives `DESIGN.md` the value. No other
route renders differently and the `/work` baseline is untouched.

```scss
#celeste {
  background-color: var(--token-bg);
  // ...
  h1 {
    font-family: var(--f-display);
    font-size: var(--t-display);
    text-align: center;
    color: var(--token-text);
  }
}
```

**The booked deferred items, and why each stays out.** The Story 2-9 entry and DW-95 book F-8's
accent-fill grep, with named exemptions for the status dot and `::selection`, to this story. F-8
is a rule about roles, not literals, it is in none of this story's criteria, and the criteria say
the permitted set "carries no component-level entry at all": both are re-booked, unassigned, for an
Operator ruling. DW-102's low-alpha tell is taken at the source by the alpha rule; its `url(` half is
not a literal and is not taken. DW-115's `:hover` gating is not a literal and is not taken.

**Filed, not decided.** `/celeste` takes the display family and size from their roles and keeps the
user agent's weight, case and leading, where `DESIGN.md`'s display row is 800, uppercase and
`--lh-display`, and `mockups/secondary-screens.html` S10 draws a restyle no story owns: one new
deferred entry for the Operator. A spacing or type literal laundered through a local custom property
(`--x: 12px; padding: var(--x)`) passes the property-scoped checks, because `--hero-height: 40vh`,
which Story 2-22 keeps, is the same shape: a stated limit in the record, while colour and `44px` are
read in every declaration and cannot be laundered that way.

**Rollback.** Revert the commit: the job, the gate, the residue, both suites' job sets and the
records return together.

## Verification

**Commands:**

- `node ops/literal-conformance.mjs`: expected exit 0 on the committed tree.
- `corepack pnpm typecheck`: expected clean.
- `corepack pnpm test --run`: expected every file to pass (1,446 tests in 58 files after Story 2-33,
  plus this story's).
- `corepack pnpm build && node ops/asset-budget.mjs`: expected a reading the recorded delta
  accounts for.
- The container `pnpm test:e2e` with no filter: expected green, no snapshot written.

**Manual checks:**

- Look at `/celeste` at 360 and 1280: the paper ground, the ink heading in the display face, centred,
  no header.

**As run, 2026-09-23:**

- `node ops/literal-conformance.mjs`: over the baseline tree at `802fbf4`, exit 1 with five findings,
  `app/app.scss:29` (`--accent-glow`) and `celeste.scss:2,13,14,16`, filed verbatim in
  `ops/literal-conformance.md` § The first run; after the residue, exit 0, "read 25 stylesheets, 21
  outside the permitted set and 4 inside it", one alpha allowed, in 296 ms. The first draft of the
  spacing rule also refused ten percentage offsets, which the change log above records.
- `corepack pnpm typecheck`: clean.
- `corepack pnpm test --run`: 59 files, 1,545 tests, all passed (1,446 in 58 before the story). The
  new suite read 8 of its cases failing before the job and the residue existed (the real tree, the
  command's exit 0 and the six wiring cases) and 90 passing, every fixture row among them.
- `corepack pnpm build && node ops/asset-budget.mjs`: before `eZg2jFEWKmNPSm_vK1LsG` (Story 2-33's
  after chunks exactly), after `zZ7f-R4Ufn4KQJqPQZi4Q`: the directory 10 bytes heavier on disk and 11
  gzipped lighter, all of it the global stylesheet losing `--accent-glow` and `/celeste`'s sheet
  naming four roles; every `.js` chunk byte for byte; the non-3D line `/work` at 113,879 over Story
  2-2's 140,000. Filed in `ops/asset-budget.md`.
- Container `pnpm test:e2e`, `mcr.microsoft.com/playwright:v1.62.1-noble`, no filter: 325 passed in
  5.9 minutes, the rewritten `/celeste` case among them, no snapshot written, the `/work` baseline
  still `93a1aa4e...`. Read in that run: `accessibility-floor` "off-contract families: none" and
  "synthesised weights: none" over 346 text reads, so `/celeste`'s heading computes the display face
  at 700 without synthesis; the whole-page census 0 elements past an edge on all five surfaces.

**The Step-04 review, 2026-09-23.** All six layers ran in this session, because it had no tool to
start a subagent, so none of them is independent of the implementation (the 2-30 to 2-33
precedent); the independent verifier is the check that is. No intent gap and no spec defect, so no
loopback (`review_loop_iteration` stays 0). Patches: the unreadable-file refusal had no standing case,
so one builds it portably (a tracked path that is a directory on disk reads `EISDIR`); and the record
states two more limits, stroke, radius, `z-index` and motion values being outside R8, and a CSS escape
or a Sass nested property carrying a literal past a text scan. Rejected: completing `/celeste`'s
display row (weight, case, leading), which the frozen boundaries keep out and DW-121 files; `//`
read as a comment in a plain `.css` file, since CSS has no line comment and anything after one on the
line is an invalid construct the browser drops, so nothing hidden there paints; a third pin of the job
set in the new suite, which would falsify `AGENTS.md`'s "two suites" pitfall and add nothing the two
pins do not hold; and an independent Codex round trip, which the verifier replaces. The ECC loop read
the build, the types and the whole suite green, and found no secret-like string, no `console.log` in a
shipped source and no dash character in an added line. The design layer approved: the one surface is
`/celeste`, `--token-text` on `--token-bg` at 17.54:1 where it read 9.74:1, the display face loaded at
700 with nothing synthesised, and no hover or motion touched. Re-run after the patches: typecheck
clean, 59 files and 1,545 tests passed, the gate exit 0; the container run above ran on the final
product code, the patches touching one unit suite and one record.

## Suggested Review Order

**The gate's configuration: every allowance, named, with its reason**

- Start here: the permitted set is exactly two paths, each carrying why it may hold literals.
  [`literal-conformance.mjs:37`](../../ops/literal-conformance.mjs#L37)

- The one alpha allowance, keyed on the palette entry `--c-scrim`, never the role.
  [`literal-conformance.mjs:57`](../../ops/literal-conformance.mjs#L57)

- The four dispositions as data, so an allowance reads differently from an oversight.
  [`literal-conformance.mjs:71`](../../ops/literal-conformance.mjs#L71)

- The scopes that implement them: spacing properties, scale units, the scaled type properties.
  [`literal-conformance.mjs:109`](../../ops/literal-conformance.mjs#L109)

**Reading a stylesheet without being fooled by it**

- Comments, strings, `url()` and interpolation masked one character for one, so lines survive.
  [`literal-conformance.mjs:182`](../../ops/literal-conformance.mjs#L182)

- Statements split on braces and semicolons; a selector is never read as a value.
  [`literal-conformance.mjs:246`](../../ops/literal-conformance.mjs#L246)

- Hex, colour functions and named colours, each marked with whether it carries alpha.
  [`literal-conformance.mjs:307`](../../ops/literal-conformance.mjs#L307)

**The rules, in the order the scan applies them**

- A statement the gate cannot read is a finding: it fails closed, never skips.
  [`literal-conformance.mjs:427`](../../ops/literal-conformance.mjs#L427)

- Outside the set a colour is refused; inside it only alpha is, bar the allowance.
  [`literal-conformance.mjs:437`](../../ops/literal-conformance.mjs#L437)

- A hand-written `44px` anywhere outside the set, custom properties and Sass variables included.
  [`literal-conformance.mjs:447`](../../ops/literal-conformance.mjs#L447)

- Spacing and type literals, each only in the properties the contract scales.
  [`literal-conformance.mjs:451`](../../ops/literal-conformance.mjs#L451)

**What the gate reads, and how it refuses**

- git's listing, tracked and untracked, so gitignored build output is never a stylesheet.
  [`literal-conformance.mjs:493`](../../ops/literal-conformance.mjs#L493)

- A tree that could not be listed, or held nothing outside the set, never passes.
  [`literal-conformance.mjs:595`](../../ops/literal-conformance.mjs#L595)

- The verdict recorded before the write, so a lost callback cannot exit 0.
  [`literal-conformance.mjs:669`](../../ops/literal-conformance.mjs#L669)

**The job**

- Blocking, installs nothing, one command, last in the file so cited line numbers hold.
  [`ci.yml:290`](../../.github/workflows/ci.yml#L290)

**The residue the first run named**

- `/celeste`'s four literals became the ground, text, display family and display size roles.
  [`celeste.scss:2`](../../components/organisms/Celeste/celeste.scss#L2)

- `--accent-glow` deleted: `DESIGN.md` dropped it and O-11 was closed; the gate refuses it.
  [`app.scss:15`](../../app/app.scss#L15)

- `celeste.scss` joins the stylesheets that name contract roles directly.
  [`anchor-contract.test.ts:328`](../../app/__tests__/anchor-contract.test.ts#L328)

**The records**

- The gate's record: what it reads, the rules, the allowances, the first run verbatim.
  [`literal-conformance.md:113`](../../ops/literal-conformance.md#L113)

- O-11 and action 7 closed on the design document's own closure.
  [`anchor-token-adoption.md:866`](../../ops/anchor-token-adoption.md#L866)

- F-2 closed, all four literals, read in the pinned image.
  [`hub-accessibility-pass.md:416`](../../ops/hub-accessibility-pass.md#L416)

- The weighed build: 11 gzipped bytes lighter, the global stylesheet only.
  [`asset-budget.md:473`](../../ops/asset-budget.md#L473)

- The booked F-8 grep re-booked, and `/celeste`'s unowned restyle filed.
  [`deferred-work.md:2328`](deferred-work.md#L2328)

**Peripherals**

- HIGH-4 shown: an allowance written against the role refuses the real contract.
  [`literal-conformance.test.ts:275`](../../ops/__tests__/literal-conformance.test.ts#L275)

- The four dispositions, each against a fixture that fails where it should.
  [`literal-conformance.test.ts:286`](../../ops/__tests__/literal-conformance.test.ts#L286)

- Three suppression comments, none of which suppresses anything.
  [`literal-conformance.test.ts:469`](../../ops/__tests__/literal-conformance.test.ts#L469)

- The committed tree passes, all 25 stylesheets read, one alpha allowed.
  [`literal-conformance.test.ts:585`](../../ops/__tests__/literal-conformance.test.ts#L585)

- The command's both exits, on a scratch repository carrying a literal and then not.
  [`literal-conformance.test.ts:611`](../../ops/__tests__/literal-conformance.test.ts#L611)

- The job's wiring, read beside the module it runs.
  [`literal-conformance.test.ts:659`](../../ops/__tests__/literal-conformance.test.ts#L659)

- `/celeste` read against its roles in a browser, planted `#444` and family reported.
  [`celeste-header.pw.ts:88`](../../tests/e2e/celeste-header.pw.ts#L88)

- The two job-set pins at seven jobs.
  [`contract-purity.test.ts:1038`](../../ops/__tests__/contract-purity.test.ts#L1038)
