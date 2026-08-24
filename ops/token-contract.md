# The token contract

The written record of what Story 1-11 published: what `contracts/tokens.css` v1.0.0 carries, what
it deliberately does not, how it is generated, what makes it impossible to hand-edit it into the
tree unnoticed, and what the change cost the production image.

Written during Story 1-11 on **2026-08-24** (ISO 8601 UTC), against baseline commit `064c087`.

This file is a record, not Registry data, and nothing here is a published contract surface. It
follows the pattern `ops/estate.md`, `ops/monitoring.md`, `ops/routing-inventory.md`,
`ops/known-violations.md` and `ops/rendered-output-harness.md` set: every value is marked as either
a decision or an observation, and the two are never presented as the same kind of fact (NFR-9). An
observed value also carries the method that gathered it, because a number without a method is a
claim.

**Story ids are written hyphenated**, as `Story 1-11` and `Story 1-17`, matching the keys in
`_bmad-output/implementation-artifacts/sprint-status.yaml`. `epics.md` writes the same ids dotted.
They are the same stories.

## What v1.0.0 publishes

One file, `contracts/tokens.css`, **6,225 bytes over 145 lines, 1,892 bytes gzipped**
(**observed 2026-08-24**, by `Get-Item`, `Get-Content` and a `GZipStream` at
`CompressionLevel.SmallestSize` on the development host). Its sha256 at the closing commit is
`319a825597995cbecacc43f08da9b24b48db636abc2b1e023ea4387a5cb38462` (**observed 2026-08-24**, by
`Get-FileHash`).

Every name, every value, the section order and the `@media (prefers-reduced-motion: reduce)` block
come from `_bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md`
section `tokens.css`, lines 832 to 957. That is a **decision**: `epics.md:1550` names that block as
what fixes the property set, so it wins wherever anything else disagrees with it.

| Category | Prefix | Count | Nature |
|---|---|---|---|
| Palette, raw | `--c-*` | 12 | **Decision.** All twelve authored in OKLCH on hue 288. Never consumed outside `contracts/` |
| Semantic roles | `--token-*` | 12 | **Decision.** The only layer a consumer reads. Each is a plain `var()` to a `--c-*` value |
| Families | `--f-*` | 3 | **Decision.** Names only. The faces are Story 1.12's `fonts.css` |
| Type scale | `--t-*` | 10 | **Decision.** 1.25 from 16px, plus one `clamp()` display step |
| Weights | `--w-*` | 5 | **Decision** |
| Line heights | `--lh-*` | 5 | **Decision** |
| Tracking | `--tr-*` | 6 | **Decision** |
| Measure | `--measure` | 1 | **Decision** |
| Spacing | `--s-*` plus `--page-pad` | 9 | **Decision.** Eight steps on a 4pt base and one `clamp()` page padding |
| Hit target | `--tap` | 1 | **Decision.** `44px`, on both axes |
| Shape | `--r-*` | 3 | **Decision** |
| Stroke | `--stroke-*` plus `--focus-offset` | 5 | **Decision** |
| Elevation | `--elev-*` | 3 | **Decision.** Lightness, not shadow |
| Motion | `--dur-*` plus `--ease-*` | 7 | **Decision.** Four durations, three easings |
| Layer | `--z-*` | 7 | **Decision** |
| **Total declared in `:root`** | | **89** | **Observed 2026-08-24**, by `packages/tokens/__tests__/tokens-contract.test.ts`, which pins the total as well as every category so a token added to one and dropped from another cannot net out |

Plus the one `@media (prefers-reduced-motion: reduce)` block, which collapses exactly the four
`--dur-*` tokens to `1ms` and nothing else. **The block is derived from the `dur` group at build
time rather than hand-written**, so a duration added to the source cannot be left out of the
reduced-motion contract by omission. **Decision**, `packages/tokens/build.mjs`.

`--c-scrim` carries **the one translucent value in the whole contract**, as
`oklch(12% 0.011 288 / 0.88)`. The FR-17 conformance gate (Story 2.34) must permit the alpha on
that declaration and reject it everywhere else, including any hand-written `rgba()` that reproduces
it. The declaration carries that instruction as a comment in the published file, so a reader of the
contract sees it without reading this record.

## What it deliberately does not publish

Naming these here is the point of the section: a contract that exists is easily mistaken for a
contract that covers everything.

| Not published | Why not | Owner |
|---|---|---|
| `contracts/fonts.css` and any `@font-face` rule | A `url()` in `tokens.css` breaks the moment a Satellite vendors the folder to a different depth. The faces travel in their own file, whose `url()` paths are relative to itself | **Decision.** Story 1.12 |
| ...**and the shipped header already points at that file** | The header reads "Values only. Font files: see fonts.css (same folder)", and `contracts/fonts.css` does not exist yet. **A Satellite that vendors the folder today follows a dangling pointer**: it gets the three `--f-*` family names with no faces behind them, and falls back to a system stack that looks almost right. The header is `DESIGN.md`'s text and stays, because the alternative is a header that changes in Story 1.12 for no reason a consumer can see. Nothing should vendor `contracts/` before Story 1.12 lands | **Observed 2026-08-24**, by reading the published header against `git ls-files contracts`. Owner: Story 1.12, and Story 1.16 which serves the directory |
| `contracts/tailwind.css`, the `@theme inline` adapter | Generated from this file, and it needs `fonts.css` to exist first | **Decision.** Story 1.13 |
| `contracts/registry.json` | Hand-authored Registry data, a different artefact with a different lifecycle | **Decision.** Story 2.x |
| Any light-theme or high-contrast variant | The contract is dark only at v1.0.0, and the header says so | **Decision.** `DESIGN.md` |
| Any structured, machine-typed export (JSON, JS, a Figma payload) | AD-1 puts one published surface under `contracts/` and it is CSS. A structured export is a second contract to version | **Decision.** Story 1-11 scope |
| A computed contrast ratio for any pair of roles | Nothing in this story computes one. The roles were designed against computed contrast; this file does not re-derive it | **Decision.** Epic 1 token stories and Story 2.34 |
| Any proof that a Satellite consumes it | Publishing is not adopting. `app/app.scss` and every component stylesheet are byte-identical to `064c087` | **Decision.** Stories 1.17, 1.18 and 1.19 |
| Enforcement that nothing executable appears under `contracts/` | `AGENTS.md` states CI fails on it, and that CI job does not exist yet. The unit suite asserts it today, which is a weaker place for it than a dedicated blocking job | **Observed 2026-08-24**, by reading `.github/workflows/ci.yml`. Owner: Story 1.14 |

## Why the source authors CSS strings inside DTCG structure

**The decision.** `packages/tokens/tokens/*.json` take DTCG's structure, `$value` / `$type` /
`$description` and `{group.name}` aliases, and author every value as the CSS string `DESIGN.md`
fixes. They do not use DTCG's structured `color`, `dimension` and `duration` object types.

**What forced it.** A spike against **Style Dictionary 5.5.2** on **2026-08-24**, run on the
development host by putting the same tokens through four transform configurations and printing the
emitted declarations. **Observed:**

```
--- structured values, transformGroup css ---
  --c-paper: #060509;
  --c-scrim: rgba(6, 5, 9, 0.88);
  --dur-micro: [object Object];
  --f-display: 'Bricolage Grotesque', Archivo, system-ui, sans-serif;
  --t-base: 1rem;
--- structured values, transforms name/kebab only ---
  --c-paper: [object Object];
  --c-scrim: [object Object];
  --dur-micro: [object Object];
  --f-display: Bricolage Grotesque,Archivo,system-ui,sans-serif;
  --t-base: [object Object];
--- structured values, transforms name/kebab + time/seconds ---
  --c-paper: [object Object];
  --c-scrim: [object Object];
  --dur-micro: [object Object];
  --f-display: Bricolage Grotesque,Archivo,system-ui,sans-serif;
  --t-base: [object Object];
--- string values, transforms name/kebab only ---
  --c-paper: oklch(12% 0.011 288);
  --c-scrim: oklch(12% 0.011 288 / 0.88);
  --dur-micro: 120ms;
  --f-display: "Bricolage Grotesque", "Archivo", system-ui, sans-serif;
  --t-base: 1rem;
  --t-display: clamp(2.25rem, 9vw, 4.5rem);
  --ease-entrance: cubic-bezier(0.16, 1, 0.3, 1);
```

Three separate failures, and any one of them is disqualifying. A structured `oklch` colour comes
out of `color/css` as `#060509` and `rgba(6, 5, 9, 0.88)`, which discards the authored OKLCH that
`DESIGN.md:239-242` makes the source of truth and the hex merely the fallback. A structured
`duration` renders `[object Object]` under every transform set tried, `time/seconds` included. A
`fontFamily` array renders unquoted and comma joined, which is a different declaration from the one
the design wrote. On top of that, `clamp(2.25rem, 9vw, 4.5rem)` and `cubic-bezier(0.16, 1, 0.3, 1)`
have no structured DTCG representation at all, so two of the contract's categories could not be
authored structurally even if the rest survived.

**The cost, recorded rather than hidden.** A future consumer that wants machine-typed tokens has to
parse the strings. That is a real cost and it is accepted knowingly: the alternative is publishing
values the design did not author, which is a worse cost paid by seven repositories instead of one.

**Why the group key is the emitted prefix.** **Decision.** Style Dictionary builds a name from the
token's path, so a group named `color.palette` would emit `--color-palette-paper`. Naming the
groups `c`, `token`, `t` and so on makes `name/kebab` alone produce the exact names, with no rename
transform to review and nothing to drift. The four tokens that carry no prefix, `--measure`,
`--page-pad`, `--tap` and `--focus-offset`, are authored at the top level of a source file for the
same reason. **Observed 2026-08-24**: `name/kebab` returns `t-3xs`, `s-2xl`, `elev-0`,
`token-bg-raised-2`, `focus-offset` and `page-pad` unchanged, which is the fact the whole naming
scheme rests on.

## Versioning, and who verifies the header

The header is the estate's version statement, and it reads:

```
/* Cuatro Ecosystem, Design Tokens
 * Contract v1.0.0 · dark only · anchor hue 288
 * Values only. Font files: see fonts.css (same folder).
 * A value change or an addition is a MINOR bump. A rename, including fixing a
 * typo in a token name, or a removal is MAJOR.
 * Generated from packages/tokens. Never edit this file by hand.
 */
```

| Rule | Bump | Nature |
|---|---|---|
| A value changes | Minor | **Decision.** `DESIGN.md:1032`. Pixels move, nothing breaks |
| A token is added | Minor | **Decision.** `DESIGN.md:1033-1038`. A consumer that has not adopted it is unaffected. A token present at first publication is not an addition and bumps nothing, which is why `--token-scrim` ships inside v1.0.0 |
| A token is renamed, including fixing a typo in its name | Major | **Decision.** `DESIGN.md:1039`. Contracts break |
| A token is removed | Major | **Decision.** `DESIGN.md:1040-1041`. A consumer's `var()` silently falls back, which is why `--r-pill` stays declared but unused |
| Rollout model | deprecate, migrate, remove | **Decision.** `DESIGN.md:1042-1043`. There are no atomic commits across eight repositories |

**The single source of the version is `packages/tokens/package.json`.** The generator reads it and
writes it into the header, so the two cannot be edited apart. `tokens-contract.test.ts` asserts they
are equal and fails naming both values when they are not, because AD-16 has a scheduled job read
this header out of every Satellite's vendored `cuatro-contracts/tokens.css`: a drifted header is a
broken check across seven repositories at once, and it fails silently rather than loudly.

Recording the version each Satellite has actually adopted, and the policy the scheduled job runs
under, is **Story 1.20**. Nothing in this story claims a Satellite has adopted anything.

## Where `epics.md` and `DESIGN.md` disagree, and how it was settled

`epics.md:1558-1559` calls `--tap` "the only length in the contract authored in `px`".
`DESIGN.md`'s own `tokens.css` block authors `--r-hair: 2px`, `--r-pill: 999px` and all five stroke
values in `px`, and `DESIGN.md:602` states outright that rules are "1px and opaque".

**Settled in favour of the design block.** **Decision.** The acceptance criterion's own governing
clause is that `DESIGN.md` section `tokens.css` fixes the exact property set, so the design block
wins and the `epics.md` sentence is a wording defect about *reader-scaled* lengths: the type scale,
the spacing scale and `--measure`, none of which is authored in `px`. Converting the strokes to
`rem` would make a hairline scale with the root font size, which the design forbids in the same
paragraph.

The contract is published as designed, the exact set of eight `px` tokens is pinned by a test so
neither side can drift unnoticed, and the wording is raised as Pending Operator action 1 below.
This story may not edit planning artefacts.

**The published comment on `--tap` deliberately does not match the design block's comment text.**
**Decision.** `DESIGN.md`'s own comment beside `--tap` reads "The ONE px length in the contract, and
deliberately so". Shipping that sentence into a file that goes on to declare seven more `px` values
would have vendored the false claim into seven repositories, where it is read by people who have no
access to this record. The published comment instead says what is true: `--tap` is the one length
authored as a physical-size guarantee, the shape and stroke values are `px` as fixed geometry, and
no reader-scaled length is `px`. **Every name and every value still matches `DESIGN.md:832-957`
exactly**; this is the single place the contract's comment prose diverges from the design block, it
is asserted by a test so it cannot silently revert, and the divergence closes when Pending Operator
action 1 corrects the two planning artefacts.

## How the file is regenerated

```
corepack pnpm tokens:build
```

That runs `node packages/tokens/build.mjs`, which reads every `packages/tokens/tokens/*.json` and
rewrites `contracts/tokens.css`. It is the only thing that writes that file, and the root script is
the only entry point: `packages/tokens/package.json` deliberately declares no `build` script of its
own, because two definitions of one command drift apart and CI drives the root one.

### The two build inputs

The generator reads two environment variables. **Both default to the real paths, so an ordinary
`corepack pnpm tokens:build` needs no environment at all.** They are documented here rather than
left in a code comment because either one present in a runner's environment would redirect the build
away from `contracts/`, leave `git status -- contracts/` clean, and hold the drift gate green over
real drift.

| Variable | Default | What it is for | Nature |
|---|---|---|---|
| `CUATRO_TOKENS_SOURCE` | `packages/tokens/tokens` | The DTCG source directory to read | **Decision.** Used by the tests to run the generator against a scratch source |
| `CUATRO_TOKENS_OUTPUT` | `contracts` | The directory to write `tokens.css` into | **Decision.** Used by the tests to compare a fresh build against the committed file without touching the working tree |

**Neither may be set in CI.** The generator prints both resolved paths on every run, before the
build, so the job log says where it actually wrote rather than where it was assumed to:

```
packages/tokens: reading  /home/runner/work/cuatro-portfolio/cuatro-portfolio/packages/tokens/tokens/*.json
packages/tokens: writing  /home/runner/work/cuatro-portfolio/cuatro-portfolio/contracts/tokens.css
```

`tokens-contract.test.ts` additionally asserts that with neither variable set the output resolves to
`contracts/tokens.css`, and it asserts that without writing anything: it points the source at an
empty directory, which the generator refuses before it writes.

### What the generator refuses

| Refusal | Why | Nature |
|---|---|---|
| A source directory holding no tokens | A moved or emptied source makes the glob match nothing, and publishing an empty `:root` over the file seven repositories vendor is the worst thing this generator could do quietly | **Decision** |
| A `version` that is not exactly `X.Y.Z` | AD-16's scheduled job reads `Contract vX.Y.Z`. A missing version would publish `Contract vundefined` and a prerelease something the job cannot parse | **Decision** |
| A token group with no section | Never emitted into an arbitrary position and never silently dropped | **Decision** |
| A `$description` carrying `/*` or `*/` | It would close the generated comment early and inject its own prose into the published contract as CSS | **Decision** |
| A reference to a token that is not in the dictionary | Style Dictionary refuses first, and the generator refuses again for a reference it resolves itself | **Decision** |

| Property | Value | Nature |
|---|---|---|
| Generator | `packages/tokens/build.mjs` | **Decision.** AD-1: generators live in `packages/` and are never published |
| Tool | `style-dictionary` pinned exactly at `5.5.2` in `packages/tokens/package.json` | **Decision.** 5.5.1 patched a prototype-pollution defect in `convertTokenData` and `DESIGN.md:1023` sets it as the floor. The pin is exact, no caret, matching the convention Story 1-10 set for a version-coupled tool |
| Transforms | `name/kebab`, and nothing else | **Decision.** Every value transform mangles at least one authored value, as the spike above shows |
| References | `outputReferences` on, implemented in the format | **Decision.** A role is published as the `var()` the design authored, not as the palette value it resolves to today. AD-14 depends on the role layer being a reference |
| Version | Read from `packages/tokens/package.json` at build time | **Decision** |
| Section order | `SECTIONS` in `build.mjs`, in `DESIGN.md` order | **Decision.** A group key that is not in that list fails the build rather than being emitted into an arbitrary position or silently dropped |
| Determinism | Two consecutive builds emit identical bytes | **Observed 2026-08-24**, and asserted permanently by `tokens-contract.test.ts` |
| Line endings | `\n`, pinned by `contracts/** text eol=lf` in `.gitattributes` | **Decision.** `core.autocrlf` is true on the authoring machine. Without the rule, whether the drift gate agrees with the generator would depend on whose checkout ran last, and the folder is vendored into seven repositories |
| The workspace | `pnpm-workspace.yaml` gained `packages: ['packages/*']`. `packages/tokens` is `private`, so it can never be published to a registry by accident | **Decision** |

**Never hand-edit `contracts/tokens.css`.** Edit the DTCG source, rebuild, and commit both. The gate
below exists because that instruction alone is not enforcement.

## The drift gate

`.github/workflows/ci.yml` gained one job, `tokens-contract`. The existing `test` and
`rendered-output` jobs were not modified.

| Property | Value | Nature |
|---|---|---|
| Blocking | Yes. No `continue-on-error`, no `|| true`, no soft-fail | **Decision.** AD-21, and `AGENTS.md` under "Policy" |
| Triggers | `push` to `**` and `pull_request` to `main` | **Observed 2026-08-24.** The job sits in the existing file and inherits that file's `on:` block at `:3-7` rather than declaring its own, so the two can never drift |
| Runner | `ubuntu-latest`, Node 22 through `setup-node`, pnpm cache on | **Decision.** The same shape as the `test` job |
| Ceiling | `timeout-minutes: 10` | **Decision.** The job installs, runs one Node script and reads `git status`, so it is the fastest thing in the file. A hung install becomes a failure with a cause rather than a job the platform eventually kills, which is the argument the `rendered-output` job already makes |
| What it does | Installs, runs `pnpm tokens:build`, then fails if `git status --porcelain --ignored=matching -- contracts/` is not empty | **Decision** |
| Why `git status` and not only `git diff` | `git diff --exit-code` is blind to a file the generator newly created, which is exactly the shape of mistake Stories 1.12 and 1.13 will make when they add a second and a third output. `git status --porcelain` also sees an untracked path and a deleted one | **Decision**, demonstrated by Probe 3 below |
| Why `--ignored=matching` | A generated path that `.gitignore` happens to match is otherwise invisible to `git status` too, which is the same hole one level down | **Decision** |
| Why `git add --intent-to-add` before the diff | `git diff` prints nothing for an untracked path, so on the one case this gate exists for the log would carry a filename and no content. The intent-to-add makes the appeared file's content show up in the diff | **Decision** |
| The two existing jobs | Byte-identical to `064c087` | **Observed 2026-08-24**, by extracting both job blocks from `git show 064c087:.github/workflows/ci.yml` and comparing them case-sensitively against the same ranges of the edited file |

**The gate is not the only thing holding the contract.** `packages/tokens/__tests__/tokens-contract.test.ts`
sits inside the already-blocking `test` job and asserts the published file against `DESIGN.md`
declaration by declaration, in order, plus every row of the story's edge-case matrix, plus that the
file is CSS a consumer can `@import`: braces balance, all 89 declarations sit inside the one `:root`
rule, nothing is declared outside a rule, and the reduced-motion query is the only other rule.
`docker/__tests__/deps-stage.test.ts` sits in the same job and holds the Dockerfile obligation
described further down. **Observed 2026-08-24**: 60 cases in the contract file, 6 in the Dockerfile
file, and **281 tests in the whole suite**, up from the 215 recorded at `4f4c751`, all green in
79.8 s by `corepack pnpm test --run`.

## The probe demonstrations

A gate never observed to fail is not known to work. Each probe was applied, run, its output recorded
here, and reverted. **No probe exists in the tree at this story's closing commit**, which is why
their output lives in this file.

**A probe is a one-time demonstration; the standing tests are something else.** **Decision.** A
demonstration recorded in a file proves the gate could fail on 2026-08-24. It proves nothing about
the run after someone deletes an assertion. So the failure paths are also asserted permanently, by
cases that run the same checks against synthetic input or against a scratch build:

- a role pointing at a palette entry that is not declared, and an elevation alias doing the same;
- a role referencing itself, and an elevation alias referencing itself;
- a role that is not a `var()` at all, and one that is more than a single `var()`;
- a role reaching past the palette into another role;
- a header version that disagrees with `package.json`, and a header with no version line;
- a source directory holding no tokens, which must refuse rather than publish an empty contract;
- a token group with no section, which is Probe 4 run on every suite run;
- a `deps` stage with a workspace manifest removed, which is the Dockerfile check observed rejecting.

Every one asserts that the check rejects, rather than being a broken assertion left behind.

### Probe 1: a source value edited and not rebuilt

| Field | Value | Nature |
|---|---|---|
| The probe | `--c-paper` changed from `oklch(12% 0.011 288)` to `oklch(13% 0.011 288)` in `packages/tokens/tokens/colour.json`, with `contracts/` left as committed | **Decision.** A lightness change is the smallest edit that still matters, and a count test cannot catch one |
| Result | The job's own step failed and printed the offending property | **Observed 2026-08-24** on the development host, by running the step's commands against the committed tree |
| Reverted | Yes, by `git checkout -- packages/tokens/tokens/colour.json` then `corepack pnpm tokens:build` | **Observed**, confirmed by `git status --porcelain` |

The step's output, quoted:

```
contracts/ is not what packages/tokens generates.
Run 'pnpm tokens:build' and commit the result.
 M contracts/tokens.css
diff --git a/contracts/tokens.css b/contracts/tokens.css
index 3ecd9a9..d0f1634 100644
--- a/contracts/tokens.css
+++ b/contracts/tokens.css
@@ -7,7 +7,7 @@
  */
 :root {
   /* ── colour: palette ───────────────────────────────────── */
-  --c-paper:         oklch(12% 0.011 288);
+  --c-paper:         oklch(13% 0.011 288);
```

**One thing this probe establishes that is worth stating.** Before the rebuild step runs,
`git status --porcelain -- contracts/` is empty: the committed output still matches itself. The gate
works only because the job rebuilds first. A job that checked the tree without rebuilding would be
green on exactly this defect.

### Probe 2: a token removed from the source

Removing a palette token has two different outcomes depending on whether a role still points at it,
and both were run.

| Field | Value | Nature |
|---|---|---|
| Probe 2a | `--c-focus` deleted from `packages/tokens/tokens/colour.json`, `--token-focus` left referencing it | **Decision** |
| Result 2a | The build refused and wrote nothing. `git status --porcelain -- contracts/` was empty afterwards, so a broken role can never reach the published file at all | **Observed 2026-08-24** |
| Probe 2b | `--c-focus` and `--token-focus` both deleted, then rebuilt | **Decision.** This is what it takes to get a shrunken contract past the generator and in front of the shape test |
| Result 2b | The build succeeded and five cases in `tokens-contract.test.ts` failed: the palette count, the role count, the 89-property total, the declaration-by-declaration comparison against `DESIGN.md`, and the alias count in the DTCG source | **Observed 2026-08-24** |
| Reverted | Yes, by `git checkout -- packages/tokens/tokens/colour.json` then `corepack pnpm tokens:build` | **Observed**, confirmed by `git status --porcelain` |

Style Dictionary's own line from 2a, quoted:

```
{token.focus} tries to reference {c.focus}, which is not defined.
```

Vitest's lines from 2b, quoted:

```
× declares exactly 12 palette values
× declares exactly 12 semantic roles values
× declares 89 properties in total and no name twice
× declares the same names in the same order with the same values
× authors every value as the CSS string the design fixes, with aliases as {group.name}

AssertionError: expected [ '--c-paper', '--c-surface', ...(9) ] to have a length of 12 but got 11
```

### Probe 3: the generator emits a second file

| Field | Value | Nature |
|---|---|---|
| The probe | `contracts/fonts.css` created in the working tree, standing in for an output a later story's generator adds | **Decision.** This is the mistake Stories 1.12 and 1.13 are positioned to make |
| Result | `git diff --exit-code -- contracts/` **exited 0**, seeing nothing. `git status --porcelain -- contracts/` reported `?? contracts/fonts.css` | **Observed 2026-08-24** |
| Reverted | Yes, the file was removed | **Observed**, confirmed by `git status --porcelain` |

This is the whole reason the gate is written against `git status` rather than against `git diff`. A
`git diff` gate would have let the first new file under `contracts/` ship unreviewed.

### Probe 4: a token whose group has no section

| Field | Value | Nature |
|---|---|---|
| The probe | A token file adding a `shadow` group, which `SECTIONS` in `build.mjs` does not map | **Decision** |
| Result | The build failed, named the group and the token, and wrote no file | **Observed 2026-08-24**, run against a scratch source and output directory through `CUATRO_TOKENS_SOURCE` and `CUATRO_TOKENS_OUTPUT` so the real `contracts/` was never touched |
| Standing test | Yes. `tokens-contract.test.ts` runs this same case on every suite run, so it is a probe and a permanent assertion both | **Decision** |

The generator's own line, quoted:

```
Error: packages/tokens/build.mjs: token group "shadow" (from --shadow-soft) has no section. Add it to SECTIONS in packages/tokens/build.mjs, in the position DESIGN.md gives it.
```

## What the change cost the production image

`docker/Dockerfile:4` copied `package.json` and `pnpm-lock.yaml` alone and then ran
`pnpm install --frozen-lockfile`. A workspace lockfile with an importer whose manifest that stage
cannot see fails that install, and `cuatro.dev` deploys from `main` on every push, so this is the
one part of the story that could have taken the site down. The `deps` stage now also copies
`pnpm-workspace.yaml` and `packages/tokens/package.json`. The install command itself is unchanged.

**Method.** `docker build --no-cache --target deps` on the Windows 11 development host, Docker
server 29.7.2, with `node:22-slim` already in the local content store. "Before" is the `064c087`
`package.json`, `pnpm-lock.yaml` and `deps` stage in a scratch context holding only those files.
"After" is the same shape with `pnpm-workspace.yaml` and `packages/tokens/package.json` added. Three
runs each, alternating, so a slow network minute cannot land entirely on one side.

| Figure | Before | After | Nature |
|---|---|---|---|
| Packages resolved by pnpm | 512 | 574 | **Observed 2026-08-24**, from pnpm's own progress line. The generator's tree adds **62 packages** |
| pnpm install step, as pnpm reports it | 11.8 s, 13.6 s, 10.8 s | 12.1 s, 12.3 s, 15.6 s | **Observed 2026-08-24** |
| Whole `deps` target, wall | 69.8 s, 69.8 s, 73.1 s | 64.8 s, 72.1 s, 84.1 s | **Observed 2026-08-24**, timed around `docker build` |
| The real command, `docker build --no-cache -f docker/Dockerfile --target deps .` from the repository root | not applicable | **75.9 s wall, 13.3 s install, 574 packages, exit 0** | **Observed 2026-08-24** |

**What these numbers do and do not say.** The package count is a hard figure: 62 more packages are
installed into the deps layer than before, and they are there only so a later stage could run the
generator, which it never does. The **wall-time ranges overlap**, so this host cannot measure the
added time and **no figure for it is claimed here**. A reader who wants one should take it from the
first real deploy rather than from this table. The honest reading is that the cost is small enough
to sit under this host's run-to-run variance, not that it is zero.

**A cheaper shape exists and was not taken.** Filtering the deps install to the root importer would
keep the 62 packages out of the production image entirely. It changes the install command, which
Story 1-11's boundaries forbid, and it would make the deps layer stop matching the lockfile the
`test` job installs from. It is recorded here as the obvious next move if the deps layer ever
becomes a problem, not as a defect in this story.

**The obligation this created has a standing check, not a comment.** The `deps` stage now has to
mirror every workspace manifest by hand, and a comment is not enforcement: Story 1.12 adding
`packages/fonts` without a `COPY` line would pass typecheck, the unit suite, the drift gate and the
rendered-output harness, and fail first on the deploy from `main`, where there is no staging to
catch it. `docker/__tests__/deps-stage.test.ts` therefore reads `pnpm-workspace.yaml`, expands its
`packages:` globs, and asserts that `pnpm-workspace.yaml` and every matched `package.json` appears on
a `COPY` line of the `deps` stage. It fails naming the manifest that is missing, and it runs inside
the already-blocking `test` job. **Observed 2026-08-24**, by deleting the
`COPY packages/tokens/package.json` line and watching the case fail with that manifest named, then
restoring it.

**`.dockerignore` gained `**/node_modules`.** **Decision.** A `.dockerignore` pattern with no slash
matches at the context root only, so the existing `node_modules` line left `packages/*/node_modules`
in the build context and `COPY . .` dragged a workspace package's pnpm symlink tree into the builder
stage on top of the `node_modules` the deps stage had already placed there. The existing root-level
line is kept beside the new one rather than replaced, so the intent stays readable.

## Stated limits

| Limit | Why it is here | Owner |
|---|---|---|
| Nothing renders this file yet | Publishing is not adopting. The Hub's render is unchanged and the rendered-output harness still matches its committed baseline | **Decision.** Stories 1.17 and 1.18 |
| The contract test reads `DESIGN.md` off disk | That is what makes "every name and value matches the design" a machine assertion rather than a manual diff. It also couples the unit suite to a planning artefact. The coupling is deliberate and it fails loudly: one case asserts the heading and the fenced block were found and that the block holds more than eighty declarations, so a moved heading fails rather than passing over an empty parse | **Decision.** Story 1-11 |
| The published file's whitespace is the generator's, not `DESIGN.md`'s | Values are aligned per section rather than per subgroup, and an inline comment sits three spaces after the semicolon. Every name and every value matches; the column positions do not, and are not asserted | **Decision.** Story 1-11 |
| The published comment on `--tap` is not the design block's comment text | The design block's comment states a claim its own file contradicts. Rewording it is the only way to avoid vendoring that claim into seven repositories. The divergence is one comment, it is asserted by a test, and it is the only prose in the contract that differs from the design | **Decision.** Story 1-11, closed by Pending Operator action 1 |
| The CSS is parsed by a brace counter and a regex, not by a CSS parser | Enough to assert that braces balance, that all 89 declarations sit inside the one `:root` rule, and that the reduced-motion query is the only other rule. It is not enough to assert that every value is valid for its property, which no test here claims | **Decision.** Story 1-11 |
| No contrast ratio, no colour-literal conformance, no hit-target assertion | None of those instruments exists yet, and this story ships the values they will be computed from | **Decision.** Story 2.34 and Story 2.8 |
| The section rules in the file are box-drawing characters | `U+2500`, copied from the design block. They are not dashes and not emoji, and the punctuation sweep is built so it does not confuse them for either | **Observed 2026-08-24**, by running the sweep against a positive control carrying an em-dash, an en-dash, a double-dash and two emoji, and confirming all five patterns fired before the sweep reported on real files |
| The DTCG source carries `$description` only where `DESIGN.md` carries a comment | Descriptions are emitted into the published file as comments, so adding one everywhere would put prose into the contract that the design did not write | **Decision.** Story 1-11 |

## Pending Operator actions

This file hands the Operator work this story could not do. They are tracked here rather than left in
prose, in the shape `ops/known-violations.md` and `ops/rendered-output-harness.md` use.

| # | Action | Owner | Note | Completed (UTC) |
|---|---|---|---|---|
| 1 | **Correct the `px` wording in `epics.md:1558-1559` and in `DESIGN.md:540`** so both read as statements about reader-scaled lengths rather than about every length in the contract | Operator | Both carry the same false claim, and `DESIGN.md`'s is the one the published comment was copied from. `DESIGN.md` authors eight `px` values and the contract ships all eight. This story is forbidden from editing planning artefacts, so the published comment was reworded instead and the divergence is recorded under "Where `epics.md` and `DESIGN.md` disagree". Correcting both closes it | _not done_ |
| 2 | **Record the first real CI timing of the `tokens-contract` job**, from the Actions run summary | Operator | Every figure in "What the change cost the production image" is a local host's, and says so. The job has never run on a runner | _not done_ |
| 3 | **Run `/bmad-project-context` to refresh the `bmad:context` block in `AGENTS.md`** | Operator | Already open as action 3 in `ops/rendered-output-harness.md`, and this story adds to it. `AGENTS.md:52-53` says CI "runs typecheck and tests only", which is now false twice over. `AGENTS.md:64-66` says CI fails on an executable file under `contracts/`, which is the intent but not yet a job; `contracts/` and `packages/` now exist, which that block predates | _not done_ |
| 4 | **Decide whether the deps layer should stop installing the generator's 62 packages** | Operator | Not a defect and not urgent. Recorded so the option is on the table before the image grows again, and so the next person to look at the deps stage does not rediscover it from scratch | _not done_ |

**Maintaining this file.** When an action is performed, replace its `_not done_` cell with the ISO
8601 UTC completion date and leave the row in place. When a figure is re-measured, add the new row
with its own date and method and keep the old one, so a later reader can see whether a number moved
or was simply re-stated. Deletion is not used here.

**When the contract version moves.** Three things change together and a change to fewer than all
three is a defect: the `version` in `packages/tokens/package.json`, the regenerated
`contracts/tokens.css` whose header carries it, and the counts and figures in this file. The
generator reads the version out of the manifest precisely so the first two cannot be done apart, and
`tokens-contract.test.ts` fails naming both values if they ever are.
