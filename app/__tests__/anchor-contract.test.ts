// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';

/**
 * The source half of Anchor migration step 1 (Story 1-17).
 *
 * No browser and no network. `tests/e2e/contract-anchor.pw.ts` is the other half and asserts
 * what the built Hub actually resolves; this file asserts four things about the sources that a
 * rendered check cannot see:
 *
 *  1. **The contract is loaded by `@use`, never by `@import`.** That is the rule, and the
 *     extension is not. **Observed 2026-08-26** against this repository's own Dart Sass 1.98.0
 *     on four one-line fixtures: `@use './t'` and `@use './t.css'` both inline the plain CSS
 *     file and emit byte-identical output, a bare `@import './t'` also inlines it (with a
 *     deprecation warning), and only `@import './t.css'`, the pair of the old rule with an
 *     explicit extension, passes through as a runtime `@import` for the browser to resolve.
 *     A runtime `@import` would fetch the contract from a URL Next never emits and would break
 *     the relative `url("./fonts/<file>.woff2")` resolution. The `@use` assertion is what holds
 *     that shut; the no-extension assertion below is a convention check and says so.
 *  2. **No name collides.** `app/app.scss` declares no custom property of its own (fourteen until
 *     Story 2-22 deleted the thirteen aliases, and one, `--hero-height`, until the Operator ruling of
 *     2026-09-24 deleted it, DW-122), no other stylesheet declares one, and both counts are pinned,
 *     the Hub's at zero and the contract's at eighty-nine, so no name can collide.
 *  3. **The contract is consumed by the global stylesheet's two rules and the token-native
 *     stylesheets, and by nothing else.** Story 1-17 asserted that nothing consumed it at all;
 *     Story 1-18 wrote the alias layer, so the case was **inverted rather than deleted**, and Story
 *     2-22 deleted the layer, so it narrowed again. Every name `contracts/tokens.css` declares is
 *     looked for in every scanned file under every shipped source root, `app/`, `components/`,
 *     `hooks/` and `content/`, and the count of files read is asserted so the scan cannot pass over
 *     an empty selection. `app/app.scss` must reference exactly the eight roles its base and focus
 *     rules name, each token-native rebuild at least one, and every other scanned file none, so a
 *     component stylesheet reaching for a role and a base rule retargeted both fail. (The
 *     `--monument-bold` call sites were a third, narrower allowance, exactly `--w-black`, until
 *     Story 2-33 rebuilt the last of them on 2026-09-23.)
 *  4. **There is no second authored copy.** The Anchor is the publisher, not a Satellite
 *     (AD-1, AD-4), so it loads `contracts/` directly and vendors nothing. The listing is
 *     `git ls-files` rather than the working tree, because `pnpm build` writes the generated,
 *     gitignored served copy into `public/contracts/` (Story 1-16) and a working-tree scan
 *     would read that as an authored file.
 *  5. **The migration is closed** (Story 2-22, migration step 7). None of the thirteen deleted
 *     aliases is named by any file git tracks or would track outside the dated record and this
 *     file, and the `/work` baseline the rendered comparison runs against is the capture the
 *     record names after the last redesign, never an earlier one.
 */

// Vitest runs from the repository root, and `import.meta.url` under Vitest is a vite URL
// rather than a `file:` one. Same treatment as `ops/__tests__/contract-purity.test.ts:31`.
const REPO_ROOT = process.cwd();
const HERE = 'app/__tests__/anchor-contract.test.ts';

const INDEX_SCSS = resolve(REPO_ROOT, 'app/scss/_index.scss');
const APP_SCSS = resolve(REPO_ROOT, 'app/app.scss');
const TOKENS_CSS = resolve(REPO_ROOT, 'contracts/tokens.css');
const FONTS_CSS = resolve(REPO_ROOT, 'contracts/fonts.css');

/** Three published `@font-face` blocks, and since Story 2-20 no local ones. Pinned so an empty list cannot pass. */
const CONTRACT_FACE_COUNT = 3;

/**
 * The families and the path Story 2-20 retired, and the rule that declared them, asserted absent
 * from every scanned source once its comments are stripped.
 *
 * Ten local `@font-face` blocks in `app/scss/_fonts.scss` named five General Sans weights, three
 * Monument Extended weights and two Confillia faces, all served from `public/fonts/`. That partial,
 * the directory and the two preloads in `app/layout.tsx` are gone, and this is what keeps them
 * gone: a `@font-face` declared in any stylesheet, a `font-family` naming an old face, or a
 * preload of a `/fonts/` path fails here naming the file and the string.
 *
 * Three of the matchers are plain substrings, because the old names carried a weight suffix
 * (`MonumentExtended-Bold`) that a bounded match would stop at. The path is anchored: it fires on a
 * root-relative `/fonts/`, the preload's shape, and on `public/fonts/`, the partial's, and not on
 * `./fonts/<file>`, which is how `contracts/fonts.css` names its own folder and how a comment
 * about it reads, nor on `/contracts/fonts/`. `@font-face` is refused in a `.scss` or `.css` only:
 * there it is a face the build emits, and in a `.tsx` it is a string in a template or a fixture.
 */
const RETIRED: readonly { name: string; matches: RegExp; stylesheetsOnly?: true }[] = [
  { name: 'Confillia', matches: /Confillia/ },
  { name: 'MonumentExtended', matches: /MonumentExtended/ },
  { name: 'GeneralSans', matches: /GeneralSans/ },
  { name: '/fonts/', matches: /(?<![\w./-])\/fonts\/|\bpublic\/fonts\// },
  { name: '@font-face', matches: /@font-face/, stylesheetsOnly: true },
];

/** The family name of every `@font-face` block in `source`, unquoted, in source order. */
const familiesIn = (source: string): string[] =>
  [...withoutComments(source).matchAll(/@font-face\s*\{[^}]*?font-family\s*:\s*([^;]+)/g)].map((found) =>
    found[1].trim().replace(/^["']|["']$/g, '')
  );

/**
 * Every directory the Hub compiles shipped source from.
 *
 * `app/` and `components/` are the two the story's own matrix names. `hooks/` and `content/` are
 * here because the claim being made is about the Anchor and not about two of its four source
 * roots: `hooks/useGsapContext.ts` and `hooks/useReduceMotion.ts` are imported by eight
 * components, and a GSAP hook is the most likely place in this repository for a
 * `setProperty('--token-...')` or a token-driven duration to arrive. A scan that stopped at two
 * roots would report "nothing consumes the contract" about a file it never opened.
 *
 * `lib/` arrived with Story 2.7, which retired the Hub's TypeScript copy of the Registry and gave
 * it one typed read of the published JSON instead. It is listed rather than excused: the module is compiled into
 * the route that renders the Suite, so it ships, and the next module to land beside it is exactly
 * the kind of shared helper a token value would arrive in.
 */
const SCANNED = ['app', 'components', 'hooks', 'content', 'lib'] as const;

/** The Hub's one read of `contracts/registry.json`, and the only source outside the alias layer allowed to name the folder. */
const REGISTRY_MODULE = 'lib/registry.ts';

/** The two paths that module may name: the Registry and the schema that fixes its shape (AD-4). */
const REGISTRY_PATHS = ['contracts/registry.json', 'contracts/registry.schema.json'];

/**
 * The extensions a consumer could arrive in: a stylesheet, or a `setProperty('--token-...')`.
 *
 * `.css` is here because Next compiles a plain global stylesheet imported from a component exactly
 * as it compiles a `.scss` one, and the `.js` family because nothing stops a shipped source being
 * written without types. None of the five exist under a scanned root today, which is the reason
 * they were missing and the reason they cost nothing to add: the scan below and the root pin above
 * it both filter on this list, so an extension absent from it is invisible to both.
 */
const SCANNED_EXTENSIONS = ['.scss', '.css', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'] as const;

/** The three of those that a scanned root actually carries today, so "at least one was read" means something. */
const PRESENT_EXTENSIONS = ['.scss', '.ts', '.tsx'] as const;

/**
 * Top-level directories that carry sources in a scanned extension but ship nothing to the browser,
 * so the root pin does not demand they be scanned for consumers.
 *
 * `tests/` is the browser suite, excluded for the same reason `__tests__` is. `contracts/` is the
 * contract itself: it declares the names, it does not consume them, and requiring it to be scanned
 * would ask the publisher to not mention its own tokens. `packages/` generates and publishes the
 * contract at build time and `ops/` is record tooling; neither is compiled into a page. Each is
 * named rather than pattern-matched, so a genuinely new source root still fails the pin.
 */
const NOT_SHIPPED_ROOTS = ['tests', 'contracts', 'packages', 'ops'] as const;

/**
 * Four `.scss` under `app/` and fifteen under `components/`, counted at `b984ca7`, plus the
 * thirty-six non-test `.ts` and `.tsx` files beside them and the four under `hooks/` and
 * `content/`. Asserted as a floor rather than as an equality so a later story adding a component
 * does not fail this file, while a scan that read nothing, or lost a root, or lost an extension,
 * does.
 *
 * Story 2.7 left the total where it was by coincidence rather than by design: the retired module
 * under `content/` was deleted in the same change that added `lib/registry.ts`. The floor is stated
 * here rather than recounted, so that coincidence is recorded and not mistaken for a check that
 * noticed.
 */
const MINIMUM_SCANNED_FILES = 59;

/** Nineteen of those must be stylesheets, which is the count the story's own matrix names. */
const MINIMUM_SCSS_FILES = 19;

/**
 * The counts `contracts/tokens.css` publishes at v1.0.0, pinned rather than bounded.
 *
 * A floor (`toBeGreaterThan(50)`) cannot see a removed name: the loop that reads each one back
 * simply gets shorter and stays green. Pinning is what makes a removal fail here, and a
 * removal is a MAJOR bump under the contract's own rules, so it is meant to be loud.
 */
const DECLARED_COUNT = 89;
const REDUCED_COUNT = 4;

/**
 * The Hub's own custom properties: none.
 *
 * **Sixteen until 2026-09-12.** Story 2-20 deleted `--confillia-bold`, which had zero call sites,
 * with the local face it named. Both suites moved in the same commit. **Fifteen until
 * 2026-09-23.** Story 2-34 deleted `--accent-glow`, a colour literal with zero call sites that the
 * FR-17 conformance gate refuses and `DESIGN.md` § The mapping drops; the three suites that count
 * the Hub's properties moved in the same commit. **Fourteen until later on 2026-09-23.** Story 2-22
 * deleted the thirteen aliases Story 1-18 and Story 2-20 wrote (`DELETED_ALIASES` below), which left
 * the one property that was never an alias. **One until 2026-09-24.** That property, `--hero-height:
 * 40vh`, had no reader since at least 2026-08-26, and the Operator's ruling of that day deleted it
 * and amended Story 2.22's criterion (DW-122), so `:root` carries the contract's properties alone;
 * the same three suites moved to zero in the same commit.
 */
const HUB_PROPERTY_COUNT = 0;

/**
 * **The mapping left on 2026-09-23 with the layer it pinned.** `MAPPING` held Story 1-18's alias
 * layer property by property, the whole content of that story's first acceptance criterion
 * (`epics.md:1821-1836`, `DESIGN.md` § The mapping): thirteen `app/app.scss` properties, each a
 * `var()` reference to the role its row assigned. It was pinned **pairwise, not as a set**, because an
 * earlier set-level pin passed a swap of `--light-gray-color` and `--gray-color` onto each other's
 * roles with every gate green. `--accent-dim` was the one row with two roles, its boundary half
 * carried by scoped redefinitions that Stories 2-9, 2-31 and 2-30 emptied one selector at a time.
 * Story 2-22 deleted the layer once Story 2-33 had rebuilt the last component reading it (FR-37), so
 * the rows went with it, and `ROLE_ON_ROOT`, `ALIASED_PROPERTIES` and `ALIAS_ROLES`, which were
 * derived from them. The names are kept in `DELETED_ALIASES` below, which the repository search pins
 * absent, and `ops/anchor-token-adoption.md` keeps each row as it was read.
 */

/**
 * The four roles the base `body` rule in `app/app.scss` names (Story 2-22).
 *
 * The ground, the body family, the regular weight and the text: what `DESIGN.md` § The mapping says
 * the three aliases the rule read become (`--black-color`, `--font-regular` with its weight, and
 * `--white-color`). The first three resolved to the same ground, family and text, and the weight was
 * the initial 400 the regular role equals, so repointing the rule moved no computed value. Pinned as
 * its own list, beside `FOCUS_ROLES`, so claim one below holds that file to exactly these eight and the
 * selection's accent (`SELECTION_ROLES`, since 2026-09-24).
 */
const BASE_RULE_ROLES = ['--token-bg', '--f-body', '--w-regular', '--token-text'] as const;

/**
 * The four roles the global focus rule names, `RESTYLE-SPEC.md:326-341` § 4 verbatim.
 *
 * Story 2-26 moved the ring out of nine per-component blocks into one `:focus-visible` rule in
 * `app/app.scss`, which was the first rule in that file to consume the contract for something other
 * than an alias. Pinned as a separate list, as `BASE_RULE_ROLES` is, and the two are disjoint. Claim
 * one below asserts the union, so a ninth role arriving in that file, or one of these eight leaving
 * it, is loud.
 */
const FOCUS_ROLES = ['--stroke-focus', '--token-focus', '--focus-offset', '--r-hair'] as const;

/**
 * The one role `RESTYLE-SPEC.md` F-11's selection rule adds (Operator ruling 2026-09-24, DW-95).
 *
 * `::selection` paints the accent ground under `--token-bg` text; the text role is the base rule's
 * ground, already in `BASE_RULE_ROLES`, so this list holds the accent alone and the three stay
 * disjoint. The landmark ring added the same day (F-20) names two of `FOCUS_ROLES` and nothing new.
 */
const SELECTION_ROLES = ['--token-accent'] as const;

/**
 * The one role the landmark ring's layer adds (Operator ruling 2026-09-25, DW-127).
 *
 * `main:focus-visible::after` draws the landmark's ring again above the hero's canvas and scrim,
 * which are positioned inside `<main>` on `/`'s default door. Its ring names two of `FOCUS_ROLES`;
 * what is new is the level it sits at, the one the panels and the scrim use, so the four lists stay
 * disjoint and a fourth role in that layer is loud.
 */
const LANDMARK_LAYER_ROLES = ['--z-raised'] as const;

/**
 * **`LITERAL_PROPERTIES` left on 2026-09-24 with its last member.** It held the properties the alias
 * layer deliberately left authored as literals: four until 2026-09-12 (the two Confillia names, which
 * Story 2-20's type swap retargeted and deleted), two until 2026-09-23 (`--accent-glow`, which Story
 * 2-34 deleted because its `rgba()` is a colour literal the FR-17 gate refuses), then `--hero-height`
 * alone, a layout constant the contract carries no role for, which the Operator's ruling of 2026-09-24
 * deleted (DW-122). The case that read each one's literal went with the list; the case below now holds
 * the file to declaring none.
 */

/**
 * The `--monument-bold` call sites, the only component stylesheets Story 1-18 edits.
 *
 * A family alias cannot carry the weight that lived in the family name `MonumentExtended-Bold`,
 * so each of these sets `font-weight` alongside `font-family` by hand. That makes each of them a
 * second, named consumer of the contract, which is why the scan below allows exactly one role
 * from exactly these paths rather than allowing none from anywhere but `app/app.scss`.
 *
 * **Four until 2026-09-07, three until 2026-09-11, two until 2026-09-14, one now.** Story 2-14
 * redirected `/projects` and deleted `ProjectsHero` with the route, taking `ProjectsHero.scss` and
 * its hand-set weight off disk. The list shrank rather than the rule changing: a path named here
 * that is not scanned fails below as "was not among the scanned files", which is the direction
 * this list is allowed to move in. Story 2-17 then moved `error-page.scss` to
 * `TOKEN_NATIVE_STYLESHEETS` below rather than off disk: it still sets `--w-black` by hand at its
 * `--monument-bold` call site, and it now also names `--tap`, which claim two refuses from a file
 * listed here. The `--monument-bold` call site was unchanged, and `tests/e2e/anchor-aliases.pw.ts`
 * read it at `error-page.scss:24` until Story 2-30 deleted the file on 2026-09-23. Story 2-27 then
 * rebuilt `GlitchText` token-native: `glitch-text.scss` left disk with its alias call site, and
 * `GlitchText.scss` beside the component names the display roles directly, so it is a
 * `TOKEN_NATIVE_STYLESHEETS` entry and not a weight site at all.
 *
 * **Retired on 2026-09-23 with the last site, and the partition with it.** Story 2-33 rebuilt
 * `WorkHero.scss` against the contract: its heading names the display family and the heaviest weight
 * by their roles, so the file joined `TOKEN_NATIVE_STYLESHEETS` below and no `--monument-bold` call
 * site is left anywhere (`tests/e2e/anchor-aliases.pw.ts` pins it at zero). The list, `WEIGHT_ROLE`
 * and claim two, which held each site to naming that one role, went with it: a partition of no
 * files and a claim over none would pass whatever the tree held. This note is where they were.
 */

/**
 * The stylesheets that consume contract roles **directly**, rather than through an alias.
 *
 * Until 2026-09-23 a different partition from the `--monument-bold` call sites (see the note above),
 * which were migrated cybercore files that named exactly `--w-black`, because the weight that lived
 * in the family name `MonumentExtended-Bold` is the one thing a family alias cannot carry. The files
 * here are Epic 2 rebuilds with no old name to keep, so they name whatever roles they need and the
 * alias layer is not in their path at all. **Since Story 2-33 every component stylesheet that names a
 * contract role is on this list**, which is FR-37's removal condition for the alias layer, and Story
 * 2-22 met it by deleting the layer: with no alias left to reach a role through, this list and
 * `app/app.scss` are the whole of the contract's consumers.
 *
 * The list is a whitelist rather than a pattern, and each member is asserted to reference at least
 * one role, so a file added here that consumes nothing is a hole rather than an entry.
 */
const TOKEN_NATIVE_STYLESHEETS = [
  // The chrome, rebuilt by Story 2-32: the page container, the wordmark, the header's two
  // destinations and (below) the header band. Rebuilds like the rest of this list, each written
  // beside its component under its PascalCase name. Story 2-15 had brought the lowercase
  // `navbar.scss` and `header.scss` onto the contract first, the two entries here that were not
  // rebuilds, each naming a role for the one thing that story gave it to do; they left disk with
  // their 2023 declarations, `sans-serif`, `#fff`, the ungated hover and the `140px` among them.
  // `Container.scss` names the page padding alone, and its `1920px` cap is the one length
  // `DESIGN.md` states for it.
  'components/atoms/Container/Container.scss',
  'components/atoms/Logo/Logo.scss',
  'components/atoms/Navbar/Navbar.scss',
  // The scrim layer, rebuilt by Story 2-28. A rebuild like the rest: the 2023 raster left disk with
  // its literals (the `#000` alphas, the two gradients, the grain and the `10` that equalled a level
  // by value), and this file names the scrim role and the raised layer directly.
  'components/atoms/ScanlineOverlay/ScanlineOverlay.scss',
  'components/atoms/SkipControl/SkipControl.scss',
  'components/atoms/SkipLink/SkipLink.scss',
  // The timeline's row, rebuilt by Story 2-31. A rebuild like the rest: the 2023 alpha hover ground,
  // the alpha chip border, the filled chip and the five aliases it read left disk with its literals,
  // and this file names the text, border and accent roles, the display and mono families with their
  // size, weight, line-height and tracking steps, the spacing scale, both strokes, the tap floor and
  // the hover transition's duration and easing directly. Its `::before` left the alias layer's
  // boundary scope in `app/app.scss` in the same commit, having nothing there left to resolve.
  'components/atoms/WorkItem/WorkItem.scss',
  // The display entrance, rebuilt by Story 2-27. A rebuild like the rest: the 2023 `glitch-text.scss`
  // and its `--monument-bold` call site left disk with the loop, and this file sets the display
  // roles (family, weight, size, line-height, tracking, colour) and the three motion roles directly.
  'components/molecules/GlitchText/GlitchText.scss',
  'components/molecules/Header/Header.scss',
  'components/molecules/PlateMark/PlateMark.scss',
  // `/celeste`, the residue no redesign story reached, brought onto the contract by Story 2-34 so the
  // FR-17 conformance gate lands green: its `#444` ground, `#fff` heading, `system-ui` family and
  // `min(8vw, 5rem)` size became the ground, text, display family and display size roles. Restyled to
  // S10 on 2026-09-24 (Operator ruling, DW-121): the heading takes the display row's weight, leading
  // and tracking roles and the emoji line the mono family, size, weight, leading, tracking and space
  // roles. The file keeps its selectors, its centring and the header rule Story 2-1 wrote at the lines
  // two suites and a record cite, and so keeps its 2023 lowercase name as well.
  'components/organisms/Celeste/celeste.scss',
  // The `/cv` intro block, added by Story 2-16. A rebuild like the rest of this list: the route was
  // a redirect until that story, so there is no 2023 stylesheet behind it and no alias name to keep.
  'components/organisms/CvIntro/CvIntro.scss',
  // The 404, rebuilt by Story 2-30. A rebuild like the rest: the 2023 `error-page.scss` left disk
  // with the `#0a000f` ground, its two grid gradients, a bare `z-index`, its four aliases (its
  // `--monument-bold` and `--monument-regular` call sites and the last `--accent-dim` boundary
  // among them) and an invalid transition, and this file, written beside the component, names the
  // text, border and accent roles, the display and mono families with their size, weight,
  // line-height and tracking steps, the spacing scale, the page padding, the measure, the boundary
  // stroke, the tap floor and the motion roles directly. Story 2-17 had moved the old file here
  // from `WEIGHT_CALL_SITES` on the `navbar.scss` precedent, when its exits first named `--tap`.
  'components/organisms/ErrorPage/Error404.scss',
  // The home surface, rebuilt by Story 2-29. A rebuild like the rest: the 2023 literals left disk
  // with the `#0a000f` ground, its two grid gradients, the three bare `z-index` integers and the
  // GSAP timeline, and this file names the ground, the text, border and accent roles, the body and
  // display families with their size, weight, line-height and tracking steps, the spacing scale,
  // the hairline stroke, two z-levels and the entrance's duration and easing directly.
  'components/organisms/HomeLayout/HomeLayout.scss',
  'components/organisms/Premise/Premise.scss',
  'components/organisms/SiteFooter/SiteFooter.scss',
  'components/organisms/SuiteDirectory/SuiteDirectory.scss',
  // The `/work` hero and the timeline, rebuilt by Story 2-33, the last redesign in the group. Rebuilds
  // like the rest: `WorkHero.scss` left its six aliases (the last `--monument-bold` and `--accent-dim`
  // call sites among them), its two bare `z-index` integers, its `42vh` floor and its hand-written
  // lengths, and names the display roles, the boundary stroke and its role, the spacing scale and the
  // entrance's duration and easing directly; `WorkTimeline.scss` left the page-padding alias and names
  // two spacing steps.
  'components/organisms/WorkHero/WorkHero.scss',
  'components/organisms/WorkTimeline/WorkTimeline.scss',
] as const;

/**
 * The one global stylesheet: the base rule and the focus rule, and since 2026-09-24 the landmark's
 * inset ring, the colour scheme and the selection. It carried the alias layer until Story 2-22 deleted
 * it, and was named for it until then, and `--hero-height` until the Operator's ruling of 2026-09-24
 * (DW-122).
 */
const GLOBAL_STYLESHEET = 'app/app.scss';

/**
 * The thirteen properties Story 2-22 deleted from `app/app.scss` (UX-DR14, migration step 7).
 *
 * The story's own list is ten: the four colours, the page padding and the five font aliases Story 1-18
 * wrote (`epics.md` § Story 2.22). The other three go by its second criterion, which admitted nothing on
 * `:root` beyond the contract and `--hero-height` (and nothing beyond the contract since its amendment by
 * the Operator's ruling of 2026-09-24, DW-122): the two accent rows Story 1-18 also wrote and the width
 * alias Story 2-20 added after the story was written.
 *
 * **This file is the one place outside the dated record that names them**, because a search has to name
 * what it pins absent, so the search below excludes it by path.
 */
const DELETED_ALIASES = [
  '--white-color',
  '--black-color',
  '--light-gray-color',
  '--gray-color',
  '--page-padding',
  '--font-regular',
  '--font-bold',
  '--monument-regular',
  '--monument-bold',
  '--font-mono',
  '--accent',
  '--accent-dim',
  '--confillia-normal',
] as const;

/**
 * What the repository search does not read, by reason rather than by pattern.
 *
 * Markdown, wherever it sits, and everything under `_bmad-output/`: the dated record and the planning
 * documents, which name the aliases as history and are never rewritten (`epics.md` names them in Story
 * 2.22's own criterion, so a search that read it could not pass). And this file, which holds the list.
 */
const isSearchExcluded = (path: string): boolean =>
  path.endsWith('.md') || path.startsWith('_bmad-output/') || path === HERE;

/**
 * A different property sharing one of the thirteen names: Tailwind's own `--font-mono` theme key, which
 * `contracts/tailwind.css` publishes for the Tailwind consumers the Anchor is not one of (AD-14),
 * generated from `packages/tokens/theme-map.json` and pinned by the adapter's own suite. Each allowance
 * is claimed back, so one that no longer occurs fails as stale rather than widening the search in silence.
 */
const TAILWIND_KEY: ReadonlyArray<readonly [path: string, name: string]> = [
  ['contracts/tailwind.css', '--font-mono'],
  ['packages/tokens/theme-map.json', '--font-mono'],
  ['packages/tokens/__tests__/tailwind-adapter.test.ts', '--font-mono'],
];

/**
 * Files the search must have read as text, one of each kind the criterion's "repository-wide" reaches
 * beyond the shipped sources: a stylesheet, the global stylesheet, a browser spec, a workflow, a config,
 * record tooling, a published contract file and the manifest. Each is non-empty and names none of the
 * thirteen today, so a listing that lost one fails naming it rather than reading as a clean result.
 */
const SEARCH_SENTINELS = [
  'components/organisms/SuiteDirectory/SuiteDirectory.scss',
  'app/app.scss',
  'tests/e2e/anchor-aliases.pw.ts',
  '.github/workflows/ci.yml',
  'playwright.config.ts',
  'ops/asset-budget.mjs',
  'contracts/tailwind.css',
  'package.json',
] as const;

/** The committed `/work` baseline Story 1-10's harness compares against, and the record that names it. */
const BASELINE = 'tests/e2e/rendered-output.pw.ts-snapshots/work-360x800-chromium-linux.png';
const HARNESS_RECORD = 'ops/rendered-output-harness.md';

/**
 * The story whose regeneration is the redesigned capture: Story 2-33, FR-37's last redesign, which
 * regenerated the baseline after it rebuilt the hero and the timeline. Story 2-22's second criterion
 * compares the render against that capture and never against the pre-redesign build. A later story that
 * changes `/work` appends its own row, as the record requires, and stays on the right side of this one.
 */
const REDESIGNED_BY = 'Story 2-33';

/**
 * One tracked file under each pathspec the copy check lists, so an empty `git ls-files` cannot read
 * as "nothing found" and, more to the point, so a *partly* empty one cannot either. Each of these
 * is load-bearing to the Hub and is not going anywhere without a story of its own.
 */
const KNOWN_TRACKED = [
  'app/app.scss',
  'components/atoms/Container/Container.tsx',
  // `public/fonts/ConfilliaBold-Regular.woff` until Story 2-20 deleted the directory, on 2026-09-12,
  // and `public/logo.png` until Story 2-32 retired the raster for a text wordmark, on 2026-09-23.
  // The CV's PDF is linked from `/cv` and served at its own URL.
  'public/pdf/cv.pdf',
] as const;

/** The three basenames a vendored copy would arrive under (AD-14). */
const CONTRACT_BASENAMES = ['tokens.css', 'fonts.css', 'tailwind.css'];

/** The one fixed folder name a Satellite vendors the contract under (AD-14, AD-16). */
const VENDORED_FOLDER = 'cuatro-contracts';

const atCollection = <T>(why: string, build: () => T): T => {
  try {
    return build();
  } catch (error) {
    throw new Error(`${HERE}: ${why} ${error instanceof Error ? error.message : String(error)}`);
  }
};

// `spawnSync` reports a failure to start in `error` and leaves `status` null, so an unguarded
// `run.status` turns a broken harness into what reads as a finding.
const spawned = <T>(run: SpawnSyncReturns<T>): SpawnSyncReturns<T> => {
  if (run.error) throw run.error;
  return run;
};

/**
 * `git ls-files` over `paths`, as repository-relative paths with forward slashes.
 *
 * `-z` with `core.quotePath=false` rather than plain stdout: by default git C-quotes any path
 * carrying a non-ASCII or unusual byte, wrapping it in quotes and escaping it. A vendored copy
 * under such a path would then match neither the basename filter nor the path-segment filter
 * below, and the check would report "nothing found" about a file that is right there.
 *
 * `flags` widens the listing where a case needs more than the index: the repository search passes
 * `--cached --others --exclude-standard`, the tree a commit would carry, which is the listing
 * `ops/literal-conformance.mjs` reads for the same reason. Duplicates are dropped.
 */
const gitLsFiles = (paths: string[], flags: string[] = []): string[] => {
  const run = spawned(
    spawnSync('git', ['-c', 'core.quotePath=false', 'ls-files', '-z', ...flags, '--', ...paths], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    })
  );
  if (run.status !== 0) {
    throw new Error(`${HERE}: git ls-files ${flags.join(' ')} -- ${paths.join(' ')} exited ${run.status}: ${run.stderr}`);
  }
  return [...new Set(run.stdout.split('\0').filter((line) => line !== ''))];
};

/**
 * Sass and CSS comments removed, so a discussion of a rule is never read as the rule.
 *
 * The `//` strip is guarded on the preceding character against both `:` and `(`, which is what
 * `tests/e2e/contract-anchor.pw.ts` uses. `[^:]` alone covers `url(https://...)` but not a
 * protocol-relative `url(//host/face.woff2)`, which would take the rest of its line with it here
 * and not there. The previous pass corrected the browser half and left this one, so the two halves
 * still parsed the same files by two different rules while a comment in the other file said they
 * had been made to agree. They agree now.
 */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:(])\/\/.*$/gm, '$1');

/**
 * A custom property **declaration**, anchored on the character that can open one.
 *
 * `--name:` on its own is not enough: a BEM modifier carrying a pseudo-class, `.btn--primary:hover`,
 * is `--name:` too. Reading that as a declaration would inflate the Hub's pinned count of zero
 * and fail the collision argument for a reason unrelated to the contract. Anchoring on `;`, `{` or
 * a line start is what separates the two. The same expression is used by every place in this file
 * that counts declarations, so the three cannot drift apart.
 */
const DECLARATION = /(?:^|[;{])\s*(--[A-Za-z0-9_-]+)\s*:/gm;

const INDEX_SOURCE = atCollection('could not read app/scss/_index.scss:', () => readFileSync(INDEX_SCSS, 'utf8'));

/**
 * Every `--name` `contracts/tokens.css` declares, by two independent parsers that must agree.
 *
 * `flat` scans the whole comment-stripped file for a declaration. `structured` takes the
 * `:root` block and the `prefers-reduced-motion` block separately, which is what the browser
 * half needs in order to know which value is expected under which media query. They are
 * cross-checked against each other because they fail differently: the flat parser cannot tell
 * the two blocks apart, and the structured one would silently truncate its list if a second
 * `:root`, an `@layer` wrapper or any nested brace appeared.
 */
const CONTRACT = atCollection('could not parse contracts/tokens.css:', () => {
  const source = withoutComments(readFileSync(TOKENS_CSS, 'utf8'));

  const namesIn = (text: string): string[] => [...text.matchAll(DECLARATION)].map((found) => found[1]);

  const declarationsIn = (block: string): Map<string, string> => {
    const found = new Map<string, string>();
    for (const raw of block.split(';')) {
      const at = raw.indexOf(':');
      if (at === -1) continue;
      const name = raw.slice(0, at).trim();
      if (!name.startsWith('--')) continue;
      found.set(name, raw.slice(at + 1).trim());
    }
    return found;
  };

  const reducedMatch = /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(source);
  const baseMatch = /:root\s*\{([^}]*)\}/.exec(reducedMatch ? source.replace(reducedMatch[0], '') : source);
  if (!reducedMatch || !baseMatch) throw new Error('no :root block or no reduced-motion block was found');

  return {
    flat: namesIn(source),
    base: declarationsIn(baseMatch[1]),
    reduced: declarationsIn(reducedMatch[1]),
  };
});

const TOKEN_NAMES = [...new Set([...CONTRACT.base.keys(), ...CONTRACT.reduced.keys()])];

/** Every `--name` `app/app.scss` declares: none since 2026-09-24 (one from Story 2-22 until then). */
const HUB_NAMES = atCollection('could not parse app/app.scss:', () => {
  const source = withoutComments(readFileSync(APP_SCSS, 'utf8'));
  return [...new Set([...source.matchAll(DECLARATION)].map((found) => found[1]))];
});

/**
 * A Sass load, as it is written in the source: the rule, the quoted path, and where it sits.
 * `@forward` is collected too, so a local partial forwarded above the contract loads is visible
 * to the order case below. Until Story 2-20 one of them carried the Hub's own `@font-face` blocks
 * and the contract loads' position relative to it decided `@font-face` precedence.
 */
interface Load {
  rule: '@use' | '@import' | '@forward';
  path: string;
  at: number;
}

// `\s*` and not `\s+`: Sass accepts `@use'../../contracts/tokens';` with no space before the
// string, so a `\s+` parser would look straight past a load written that way and let the
// `@use`-never-`@import` assertion below pass over a runtime `@import`.
const loadsIn = (scss: string): Load[] =>
  [...withoutComments(scss).matchAll(/@(use|import|forward)\s*(['"])([^'"]+)\2/g)].map((found) => ({
    rule: `@${found[1]}` as Load['rule'],
    path: found[3],
    at: found.index ?? 0,
  }));

/** A load that reaches something under `contracts/`, whichever rule it uses. */
const isContractLoad = (load: Load): boolean => /(^|\/)contracts\//.test(load.path);

/**
 * The file a load points at, as an absolute path.
 *
 * The `.css` is appended only when the path does not already carry it. Appending it
 * unconditionally turned an explicit-extension load into `tokens.css.css`, so the case that
 * exists to name that mistake reported a file that does not exist instead.
 */
const resolvedTarget = (load: Load): string =>
  resolve(dirname(INDEX_SCSS), load.path.endsWith('.css') ? load.path : `${load.path}.css`);

/** Every scanned source file under `directory`, recursively, as repository-relative paths. */
const scannedUnder = (directory: string, found: string[] = []): string[] => {
  const absolute = resolve(REPO_ROOT, directory);
  if (!existsSync(absolute)) return found;
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    // A test that asserts about a token name is not a consumer of it, and this very file names
    // several. Excluding `__tests__` is what keeps the scan measuring the shipped sources.
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') scannedUnder(join(directory, entry.name), found);
      continue;
    }
    if (entry.isFile() && SCANNED_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
      found.push(join(directory, entry.name).split('\\').join('/'));
    }
  }
  return found;
};

/**
 * A reference to `name`, bounded so `--token-bg` does not match inside `--token-bg-raised`.
 * The name is escaped rather than interpolated raw, because a custom property name is not a
 * regular expression and a future one carrying a `.` would quietly match anything.
 */
const referenceTo = (name: string): RegExp =>
  new RegExp(`(?<![A-Za-z0-9_-])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_-])`);

/** A tracked path whose final segment is one of the three published contract files. */
const isContractCopy = (path: string): boolean => CONTRACT_BASENAMES.includes(path.split('/').pop() ?? '');

/** A tracked path with `cuatro-contracts` as one of its segments. */
const isVendoredPath = (path: string): boolean => path.split('/').includes(VENDORED_FOLDER);

describe('the token contract is wired into the Anchor stylesheet graph', () => {
  it('reads a real contract by two agreeing parsers, so every case below measures something', () => {
    expect(INDEX_SOURCE.trim(), 'app/scss/_index.scss is empty').not.toBe('');
    expect(existsSync(TOKENS_CSS), `${TOKENS_CSS} does not exist`).toBe(true);
    expect(existsSync(FONTS_CSS), `${FONTS_CSS} does not exist`).toBe(true);

    // Pinned, not bounded. A removed name shortens every loop in both halves of this story and
    // would otherwise pass in silence, which is what made the record's "fails naming the
    // property" claim untrue before this case existed.
    expect(CONTRACT.base.size, 'contracts/tokens.css no longer declares 89 custom properties on :root').toBe(
      DECLARED_COUNT
    );
    expect(CONTRACT.reduced.size, 'the reduced-motion block no longer redefines 4 values').toBe(REDUCED_COUNT);

    // The two parsers, against each other. They truncate differently, so agreement is evidence
    // that neither did.
    expect(
      [...new Set(CONTRACT.flat)].sort(),
      'the flat and the structured parse of contracts/tokens.css disagree, so one of them truncated'
    ).toEqual([...TOKEN_NAMES].sort());
    expect(
      CONTRACT.flat.length,
      'contracts/tokens.css does not carry 93 declarations in total, 89 on :root and 4 under reduced motion'
    ).toBe(DECLARED_COUNT + REDUCED_COUNT);

    for (const name of ['--token-bg', '--f-body', '--tap']) {
      expect(TOKEN_NAMES, `contracts/tokens.css no longer declares ${name}`).toContain(name);
    }
    for (const [name, value] of CONTRACT.base) expect(value, `${name} parsed to an empty value`).not.toBe('');
    for (const [name, value] of CONTRACT.reduced) {
      expect(value, `${name} parsed to an empty value under reduced motion`).not.toBe('');
      expect(TOKEN_NAMES, `${name} is redefined under reduced motion but never declared`).toContain(name);
    }

    // The matcher, on a planted positive control. A scan whose regex had stopped firing would
    // otherwise report zero references from a file full of them.
    expect(referenceTo('--token-bg').test('  color: var(--token-bg);')).toBe(true);
    expect(referenceTo('--token-bg').test('  color: var(--token-bg-raised);')).toBe(false);
    expect(referenceTo('--tap').test('min-height: var(--tap);')).toBe(true);

    // The load parser, likewise, including the comment stripping a commented-out load needs.
    expect(loadsIn(`@use '../../contracts/tokens';`)).toEqual([
      { rule: '@use', path: '../../contracts/tokens', at: 0 },
    ]);
    expect(loadsIn('/* nothing here */')).toEqual([]);
    expect(loadsIn(`// @use '../../contracts/tokens';`), 'a commented-out load is counted as live wiring').toEqual([]);
    expect(loadsIn(`/* @use '../../contracts/tokens'; */`), 'a block-commented load is counted').toEqual([]);
    expect(loadsIn(`@use 'https://example.test/x';`).length, 'comment stripping ate a protocol slash').toBe(1);
    expect(
      loadsIn(`@use'../../contracts/tokens';`),
      'a load written with no space before the string is invisible to the parser'
    ).toEqual([{ rule: '@use', path: '../../contracts/tokens', at: 0 }]);

    // The path resolver, on the shape that used to double the extension.
    expect(resolvedTarget({ rule: '@use', path: '../../contracts/tokens.css', at: 0 })).toBe(TOKENS_CSS);
    expect(resolvedTarget({ rule: '@use', path: '../../contracts/tokens', at: 0 })).toBe(TOKENS_CSS);
  });

  it('loads the contract by @use, never by @import, which is the rule that keeps it inlined', () => {
    const contractLoads = loadsIn(INDEX_SOURCE).filter(isContractLoad);
    expect(contractLoads.length, 'app/scss/_index.scss loads nothing under contracts/').toBeGreaterThan(0);

    for (const load of contractLoads) {
      // The assertion that actually holds the failure mode shut. Observed against Dart Sass
      // 1.98.0: `@use` inlines a plain CSS file with or without the extension, and only
      // `@import` with an explicit `.css` extension becomes a runtime `@import`.
      expect(
        load.rule,
        `${load.rule} '${load.path}' loads the contract. Only @use is safe here: @import with an ` +
          `explicit .css extension compiles to a runtime @import, which fetches the contract from a ` +
          `URL Next never emits and breaks the relative url() resolution in contracts/fonts.css.`
      ).toBe('@use');
    }

    // The convention check, stated as one. The extensionless spelling is not what makes the
    // load inline, it is what makes it unambiguous, and the message says so rather than
    // repeating a rule that is not true of `@use`.
    for (const load of contractLoads) {
      expect(
        load.path.endsWith('.css'),
        `@use '${load.path}' carries an explicit .css extension. Sass inlines it either way, so this ` +
          `is a convention check and not a correctness one: the house spelling is extensionless.`
      ).toBe(false);
    }

    // The planted controls for both matchers, so neither can pass because it stopped looking.
    expect(loadsIn(`@import '../../contracts/tokens.css';`).filter(isContractLoad).map((load) => load.rule)).toEqual([
      '@import',
    ]);
    expect(loadsIn(`@use '../../contracts/tokens.css';`).filter((load) => load.path.endsWith('.css')).length).toBe(1);

    // And no plain CSS `@import` written by hand anywhere in the file, with the matcher shown
    // firing first: an absence check whose regex stopped matching reads exactly like a clean
    // file, which is the one way this assertion could be green over the failure it names.
    const RAW_IMPORT = /@import\s*url\(/;
    expect(RAW_IMPORT.test(`@import url('../../contracts/tokens.css');`), 'the raw @import matcher no longer fires').toBe(
      true
    );
    expect(RAW_IMPORT.test(`@use '../../contracts/tokens';`)).toBe(false);
    expect(INDEX_SOURCE, 'app/scss/_index.scss carries a raw url() @import').not.toMatch(RAW_IMPORT);
  });

  it('loads both contract files, each resolving to the one authored copy', () => {
    const contractLoads = loadsIn(INDEX_SOURCE).filter(isContractLoad);

    // Claim one: both files are loaded, identified by what the path resolves to on disk rather
    // than by how it is spelled, so this is not a check on `../../`.
    const resolved = contractLoads.map(resolvedTarget);
    expect(resolved, 'app/scss/_index.scss does not load both contracts/tokens.css and contracts/fonts.css').toEqual(
      expect.arrayContaining([TOKENS_CSS, FONTS_CSS])
    );
    expect(resolved.length, 'app/scss/_index.scss loads something under contracts/ beyond the two files').toBe(2);

    // Claim two: every one of them lands inside `contracts/` and nowhere else.
    for (const target of resolved) {
      expect(existsSync(target), `a contract load resolves to ${target}, which does not exist`).toBe(true);
      expect(
        relative(resolve(REPO_ROOT, 'contracts'), target).split('\\').join('/'),
        `a contract load resolves outside contracts/, to ${target}`
      ).not.toMatch(/^\.\./);
    }
  });

  it('loads tokens before fonts', () => {
    const loads = loadsIn(INDEX_SOURCE);
    const at = (target: string): number => {
      const found = loads.find((load) => resolvedTarget(load) === target);
      if (!found) throw new Error(`${HERE}: nothing in app/scss/_index.scss loads ${target}`);
      return found.at;
    };

    // Claim three, on its own, and falsifiable on its own: AD-14's file order. Claim four, the
    // contract loads sitting above `@forward './fonts'`, left with that partial on 2026-09-12:
    // Story 2-20 deleted the Hub's ten local `@font-face` blocks, so there is no second emitter
    // of a `@font-face` for the contract's three to precede. The guard below is what replaced it.
    expect(at(TOKENS_CSS), 'contracts/fonts.css is loaded before contracts/tokens.css').toBeLessThan(at(FONTS_CSS));
  });

  it('names no retired family, no /fonts/ path and no @font-face from any scanned source, which is what keeps the swap done', () => {
    // Until Story 2-20 this slot held the case that the ten local faces shared no family name
    // with the three published ones, so emission order could not silently decide a winner. There
    // are no local faces now, and what has to stay true instead is that nothing brings one back:
    // a `@font-face` declared in a stylesheet, a `font-family` naming an old face by its literal,
    // or a preload of a `/fonts/` path would each reintroduce a binary the build no longer ships,
    // and none of them is visible to the token scan or the family scan below. The same `SCANNED`
    // set the consumer partition walks and pins non-empty; the one sentinel here is the partial.
    const scanned = SCANNED.flatMap((directory) => scannedUnder(directory)).sort();
    expect(scanned, 'the partial Story 2-20 deleted is back on disk').not.toContain('app/scss/_fonts.scss');

    // Comments stripped first, by the same stripper every other case here uses, so a comment about
    // the contract's `./fonts/` folder or about the retired face is prose and not a reference.
    const namesRetired = (file: string, contents: string): string[] =>
      RETIRED.filter(
        (retired) =>
          (!retired.stylesheetsOnly || /\.s?css$/.test(file)) && retired.matches.test(withoutComments(contents))
      ).map((retired) => retired.name);

    const references: string[] = [];
    for (const file of scanned) {
      for (const retired of namesRetired(file, readFileSync(resolve(REPO_ROOT, file), 'utf8'))) {
        references.push(`${file} names ${retired}`);
      }
    }
    expect(
      references,
      `a scanned source names a family, a path or a rule Story 2-20 retired, which brings a local binary back ` +
        `into the build:\n${references.join('\n')}`
    ).toEqual([]);

    // The matcher, live, before its zero result is read as good news. One positive in the shape
    // the deleted partial had, and one negative carrying every shape that must not fire: the
    // family in a comment, the contract's own `./fonts/` folder, the served `/contracts/fonts/`
    // path, `@font-face` outside a stylesheet, and the lowercase alias name.
    expect(
      namesRetired('control.scss', `@font-face { src: url('../../public/fonts/GeneralSans-Light.woff2'); }`)
    ).toEqual(['GeneralSans', '/fonts/', '@font-face']);
    expect(
      namesRetired(
        'control.tsx',
        `// Confillia\nconst x = './fonts/a.woff2 /contracts/fonts/b.woff2 @font-face var(--confillia-normal)';`
      )
    ).toEqual([]);

    // The `_index.scss` half stated on its own, so a `@forward './fonts'` put back fails naming
    // itself rather than as a count.
    const forwards = loadsIn(INDEX_SOURCE).filter((load) => load.rule === '@forward');
    expect(forwards.map((load) => load.path), `app/scss/_index.scss forwards './fonts' again`).not.toContain('./fonts');
  });
});

describe('no contract name collides with a name the Hub already declares', () => {
  it('found no custom property in app/app.scss, and none in any other stylesheet', () => {
    // The "identical by construction" argument rests on this count. If the Hub declared one
    // somewhere else, the intersection below would be empty for the wrong reason. Fourteen until
    // Story 2-22 deleted the thirteen aliases, whose four named members this loop used to read, and
    // one, `--hero-height`, until the Operator's ruling of 2026-09-24 deleted it (DW-122).
    expect(HUB_NAMES, 'app/app.scss declares a custom property of its own again').toEqual([]);
    expect(HUB_NAMES.length).toBe(HUB_PROPERTY_COUNT);

    // No component stylesheet declares one, which is the other half of the same argument.
    //
    // `DECLARATION` anchors on the character that opens a declaration rather than matching any
    // `--name:` text, because a BEM modifier carrying a pseudo-class (`.btn--primary:hover`) is
    // `--name:` too and would be counted as a declared custom property, failing the count above
    // for a reason that has nothing to do with the contract. No such selector exists in this
    // repository today, which is why the loose form has cost nothing so far.
    const elsewhere: string[] = [];
    for (const file of SCANNED.flatMap((directory) => scannedUnder(directory))) {
      if (file === 'app/app.scss' || !file.endsWith('.scss')) continue;
      const declared = [...withoutComments(readFileSync(resolve(REPO_ROOT, file), 'utf8')).matchAll(DECLARATION)];
      for (const found of declared) elsewhere.push(`${file} declares ${found[1]}`);
    }

    // The matcher, on a planted pair, before its empty result is read as good news.
    expect([...'.a { --x: 1px; }'.matchAll(DECLARATION)].map((found) => found[1])).toEqual(['--x']);
    expect([...'.btn--primary:hover { color: red; }'.matchAll(DECLARATION)]).toEqual([]);
    expect(
      elsewhere,
      `a stylesheet other than app/app.scss declares a custom property, so the collision check above ` +
        `no longer covers every name the Hub has:\n${elsewhere.join('\n')}`
    ).toEqual([]);
  });

  it('shares no name with the contract, in either direction', () => {
    // Both sides of the intersection are pinned. The contract's side at eighty-nine, so an empty
    // intersection is not an empty contract; the Hub's at zero since 2026-09-24, so the intersection
    // is empty because the Hub declares nothing, which is the strongest form of the argument the
    // whole story rests on, and a name put back is refused by the count before it can collide.
    expect(TOKEN_NAMES.length, 'the contract declares a different number of distinct names').toBe(DECLARED_COUNT);
    expect(HUB_NAMES.length, 'app/app.scss declares a different number of custom properties').toBe(HUB_PROPERTY_COUNT);

    const collisions = HUB_NAMES.filter((name) => TOKEN_NAMES.includes(name));
    expect(
      collisions,
      `the contract and app/app.scss declare the same custom property, so wiring the contract in is ` +
        `not appearance-neutral:\n${collisions.join('\n')}`
    ).toEqual([]);

    // The intersection, on a planted control. An empty result means nothing unless the
    // predicate is seen to fire.
    expect([...HUB_NAMES, '--tap'].filter((name) => TOKEN_NAMES.includes(name))).toEqual(['--tap']);
  });
});

describe('the Anchor consumes the contract in its global stylesheet and its token-native stylesheets, and nowhere else', () => {
  const files = atCollection(`could not scan ${SCANNED.join(', ')}:`, () =>
    SCANNED.flatMap((directory) => scannedUnder(directory)).sort()
  );

  it('scanned every stylesheet and every shipped source under every source root', () => {
    // The root list is pinned against the tracked tree rather than trusted. `SCANNED` was two
    // entries while `hooks/` and `content/` shipped unread, and nothing failed: every other
    // guard in this file checks the scanned roots against themselves and so cannot see a
    // missing one. This is the guard that can. A new top-level source directory fails here
    // rather than silently escaping the scan below.
    const roots = new Set(
      gitLsFiles(['.'])
        .filter((path) => path.includes('/'))
        .filter((path) => SCANNED_EXTENSIONS.some((extension) => path.endsWith(extension)))
        .filter((path) => !path.split('/').includes('__tests__'))
        .map((path) => path.split('/')[0])
        // Not shipped sources, each named in `NOT_SHIPPED_ROOTS` with its reason. A leading `.`
        // or `_` is tooling or BMad output.
        .filter(
          (root) =>
            !NOT_SHIPPED_ROOTS.includes(root as (typeof NOT_SHIPPED_ROOTS)[number]) &&
            !root.startsWith('.') &&
            !root.startsWith('_')
        )
    );
    expect(roots.size, 'no tracked source root was found, so the comparison below is vacuous').toBeGreaterThan(0);
    const unscanned = [...roots].filter((root) => !SCANNED.includes(root as (typeof SCANNED)[number])).sort();
    expect(
      unscanned,
      `a top-level directory carries shipped ${SCANNED_EXTENSIONS.join('/')} sources and is not in SCANNED, so a ` +
        `consumer arriving there would be invisible to the check below:\n${unscanned.join('\n')}`
    ).toEqual([]);

    expect(
      files.length,
      `only ${files.length} scanned files were found under ${SCANNED.join(', ')}, so the scan below ` +
        `would pass over almost nothing`
    ).toBeGreaterThanOrEqual(MINIMUM_SCANNED_FILES);
    expect(
      files.filter((file) => file.endsWith('.scss')).length,
      'fewer than nineteen stylesheets were scanned'
    ).toBeGreaterThanOrEqual(MINIMUM_SCSS_FILES);

    // Two different claims, because the list holds two different kinds of extension.
    //
    // `PRESENT_EXTENSIONS` exist under a scanned root today, so "at least one was read" is a real
    // measurement and losing one is loud. The rest are anticipatory: a `.css`, `.js`, `.jsx`,
    // `.mjs` or `.cjs` consumer is a shape nothing in the Anchor takes yet, and demanding a file
    // that does not exist would fail the run for the wrong reason. What is asserted for those is
    // that the scan's own filter would pick them up, which is the property that was actually
    // missing while the list read `.scss`, `.ts`, `.tsx` and the scan claimed to cover consumers.
    for (const extension of PRESENT_EXTENSIONS) {
      expect(
        files.some((file) => file.endsWith(extension)),
        `no ${extension} file was scanned, so a consumer arriving in one would be invisible`
      ).toBe(true);
    }
    for (const extension of SCANNED_EXTENSIONS) {
      expect(
        SCANNED_EXTENSIONS.some((candidate) => `consumer${extension}`.endsWith(candidate)),
        `the scan filter does not accept ${extension}, so a consumer arriving in one would be skipped`
      ).toBe(true);
    }
    for (const directory of SCANNED) {
      expect(
        files.some((file) => file.startsWith(`${directory}/`)),
        `nothing under ${directory}/ was scanned`
      ).toBe(true);
    }
    expect(files, 'app/app.scss was not among the scanned files').toContain('app/app.scss');
    for (const file of files) {
      expect(statSync(resolve(REPO_ROOT, file)).size, `${file} is empty`).toBeGreaterThan(0);
    }
  });

  it('is consumed by the base, focus and selection rules in app/app.scss and the token-native stylesheets, and by nothing else', () => {
    // Story 1-17's case asserted zero references from every scanned file, and its failure
    // message said a consumer "is Story 1-18's act and not this one's". That act wrote the alias
    // layer, so the case was inverted rather than deleted: the same scan, over the same files, says
    // exactly where a contract name is allowed to appear and exactly which names are allowed there.
    // Story 2-22 deleted the layer, so the global stylesheet's allowance narrowed to its two rules.
    const referencesBy = new Map<string, string[]>();
    let scanned = 0;

    for (const file of files) {
      const contents = readFileSync(resolve(REPO_ROOT, file), 'utf8');
      scanned += 1;
      const found = TOKEN_NAMES.filter((name) => referenceTo(name).test(contents)).sort();
      if (found.length > 0) referencesBy.set(file, found);
    }

    expect(scanned, 'no file was read').toBe(files.length);
    expect(files, `${GLOBAL_STYLESHEET} was not among the scanned files, so the case below is vacuous`).toContain(
      GLOBAL_STYLESHEET
    );
    for (const site of TOKEN_NATIVE_STYLESHEETS) {
      expect(files, `${site} was not among the scanned files`).toContain(site);
    }

    // The pinned lists are checked against the contract before they are compared against the
    // sources. A role renamed in `contracts/tokens.css` would otherwise make every list below
    // agree on a name the contract no longer declares, and a MAJOR bump is meant to be loud.
    for (const role of [...BASE_RULE_ROLES, ...FOCUS_ROLES, ...SELECTION_ROLES, ...LANDMARK_LAYER_ROLES]) {
      expect(TOKEN_NAMES, `${role} is in a pinned list but the contract no longer declares it`).toContain(role);
    }

    // Claim one: the global stylesheet references exactly the four roles its base rule names and
    // the four the focus rule names since Story 2-26, and the accent F-11's selection rule adds since
    // 2026-09-24. Until Story 2-22 the first four were the roles the alias layer mapped onto (see the
    // note where `MAPPING` was). A base rule retargeted to some other role fails here, and so does one
    // dropped altogether; so does a ring rule that names a fifth role, or loses one of its four. The
    // three lists are disjoint, and that is asserted too, so a role cannot be counted as two.
    expect(
      FOCUS_ROLES.filter((role) => (BASE_RULE_ROLES as readonly string[]).includes(role)),
      'a focus role is also a base-rule role'
    ).toEqual([]);
    expect(
      SELECTION_ROLES.filter((role) => ([...BASE_RULE_ROLES, ...FOCUS_ROLES] as readonly string[]).includes(role)),
      'a selection role is also a base-rule or focus role'
    ).toEqual([]);
    expect(
      LANDMARK_LAYER_ROLES.filter((role) => ([...BASE_RULE_ROLES, ...FOCUS_ROLES, ...SELECTION_ROLES] as readonly string[]).includes(role)),
      'a landmark layer role is also a base-rule, focus or selection role'
    ).toEqual([]);
    expect(
      referencesBy.get(GLOBAL_STYLESHEET) ?? [],
      `${GLOBAL_STYLESHEET} does not reference exactly the four roles DESIGN.md § The mapping gives the ` +
        `body, the four RESTYLE-SPEC.md § 4 names for the ring, the accent F-11 gives the selection and the ` +
        `level the landmark ring's layer takes (DW-127). A ` +
        `base rule retargeted to a different role changes what every page paints from one line; a fifth ` +
        `role in the ring rule, or one of its four missing, changes what every focused element paints.`
    ).toEqual([...BASE_RULE_ROLES, ...FOCUS_ROLES, ...SELECTION_ROLES, ...LANDMARK_LAYER_ROLES].sort());

    // Claim two held the `--monument-bold` call sites to naming exactly `--w-black`, the weight a
    // family alias cannot carry, until Story 2-33 rebuilt the last of them on 2026-09-23. With no site
    // left the claim went with its list (see the note where `WEIGHT_CALL_SITES` was), and the
    // numbering is kept so the claims below still read as they are cited.

    // Claim three: the token-native stylesheets consume roles directly, and each really does.
    // Listed rather than pattern-matched, and asserted non-empty in both directions: a file named
    // here that references nothing is a hole in claim four below rather than an entry, and it
    // would read as "the rebuild happened" while the file still consumed nothing (it went through
    // the alias layer while there was one).
    for (const site of TOKEN_NATIVE_STYLESHEETS) {
      expect(
        (referencesBy.get(site) ?? []).length,
        `${site} is listed as token-native and names no contract role, so listing it exempts a file ` +
          `that is not consuming the contract at all`
      ).toBeGreaterThan(0);
    }

    // Claim four: nothing else reaches for a role at all. A component stylesheet consuming a
    // token role directly is an Epic 2 rebuild, which is what the list above admits one file at a
    // time; anywhere else it is a consumer no list names, which is what a partition exists to refuse.
    const allowed = new Set<string>([GLOBAL_STYLESHEET, ...TOKEN_NATIVE_STYLESHEETS]);
    const elsewhere = [...referencesBy]
      .filter(([file]) => !allowed.has(file))
      .map(([file, names]) => `${file} references ${names.join(', ')}`);
    expect(
      elsewhere,
      `a source outside the global stylesheet and the token-native list consumes the contract, so ` +
        `the partition no longer describes who reads it:\n${elsewhere.join('\n')}`
    ).toEqual([]);

    // The scan, against planted control strings rather than against a file. A run that read
    // every file and matched nothing looks identical to a run whose matcher was broken, and this
    // is what separates the two. Both shapes a consumer could take, through the same predicate
    // the loop above calls.
    for (const planted of [
      `.control { color: var(${TOKEN_NAMES[0]}); }`,
      `element.style.setProperty('${TOKEN_NAMES[0]}', 'red');`,
    ]) {
      expect(
        TOKEN_NAMES.some((name) => referenceTo(name).test(planted)),
        `the scan does not fire on "${planted}", so its zero result means nothing`
      ).toBe(true);
    }
    expect(
      TOKEN_NAMES.some((name) => referenceTo(name).test('.control { min-height: var(--a-local-name); }')),
      'the scan fires on a name the contract does not declare, so the partition above cannot tell a role from it'
    ).toBe(false);
  });

  it('declares no custom property, on :root or on any other selector', () => {
    // Story 2-22's criteria as the Operator's ruling of 2026-09-24 amended them (DW-122), read off the
    // file rather than the browser, because what is asserted is what the file authors
    // (`tests/e2e/anchor-aliases.pw.ts` reads what the build ships). Until that story this case held
    // the thirteen aliases to their roles row by row, and the scoped `--accent-dim` redefinitions to
    // their selectors (see the note where `MAPPING` was); until the ruling it held `--hero-height` to
    // being the one declaration, on `:root`, as a literal that named no role.
    const source = withoutComments(readFileSync(APP_SCSS, 'utf8'));
    const root = /:root\s*\{([^}]*)\}/.exec(source);
    expect(root, 'no :root block was parsed out of app/app.scss, so this case measures nothing').not.toBeNull();
    expect(root?.[1] ?? '', 'the :root block parsed is not the colour scheme, the one :root rule the file keeps').toMatch(
      /color-scheme\s*:\s*dark/
    );

    // **Every declaration in the file, whatever its selector.** A custom property redeclared on
    // `body` or on a component selector is an alias by another route, which is the shape the
    // boundary scope had, so the whole file is read and not only `:root`.
    expect(
      [...source.matchAll(DECLARATION)].map((found) => found[1]),
      'app/app.scss declares a custom property, on :root or on another selector'
    ).toEqual([]);

    // The matcher, on planted controls, before the empty verdict is read as good news: the property
    // this file declared until the ruling, as it was written, is read, and so is a redefinition scoped
    // on a pseudo-element in a selector list, the shape that defeats a first-colon split.
    expect([...':root {\n  --hero-height: 40vh;\n}'.matchAll(DECLARATION)].map((found) => found[1])).toEqual(['--hero-height']);
    expect(
      [...'.work-item::before, .a { --accent-dim: var(--x); }'.matchAll(DECLARATION)].map((found) => found[1])
    ).toEqual(['--accent-dim']);
  });

  it('names none of the three families the font contract publishes, from any of them', () => {
    // The token half of "consumed by nothing" was asserted name by name; the font half was not
    // asserted at all. It carries the same weight: "an unused `@font-face` is never downloaded"
    // is one of the two pillars the appearance-neutrality argument rests on, and the other
    // (no custom property collides) was already pinned on both sides. A Hub stylesheet adding
    // `font-family: Geist` would start a download and paint different glyphs while the token
    // scan, the face-URL check and `document.fonts` all stayed green, because none of them asks
    // whether anything in the Hub *uses* a published family.
    const published = familiesIn(readFileSync(FONTS_CSS, 'utf8'));
    expect(published.length, 'contracts/fonts.css declares no family, so the scan below is vacuous').toBe(
      CONTRACT_FACE_COUNT
    );

    const references: string[] = [];
    for (const file of files) {
      const contents = readFileSync(resolve(REPO_ROOT, file), 'utf8');
      for (const family of published) {
        if (referenceTo(family).test(contents)) references.push(`${file} names ${family}`);
      }
    }
    expect(
      references,
      `a source already sets a published contract family, which would download the face and change ` +
        `what the Hub paints:\n${references.join('\n')}`
    ).toEqual([]);

    // The matcher, through the same predicate the scan calls, on both shapes a use could take.
    for (const planted of [
      `.control { font-family: ${published[0]}, sans-serif; }`,
      `element.style.fontFamily = '"${published[0]}", sans-serif';`,
    ]) {
      expect(
        published.some((family) => referenceTo(family).test(planted)),
        `the family scan does not fire on "${planted}", so its zero result means nothing`
      ).toBe(true);
    }
    expect(
      published.some((family) => referenceTo(family).test('.control { font-family: system-ui; }')),
      'the family scan fires on a stylesheet naming no contract family'
    ).toBe(false);
  });

  it('mentions contracts/ in the wiring file and nowhere else', () => {
    const mentions = files.filter((file) => /contracts\//.test(readFileSync(resolve(REPO_ROOT, file), 'utf8')));
    expect(
      mentions,
      'contracts/ is mentioned by a source other than the two this repository wires it into'
    ).toEqual(['app/scss/_index.scss', REGISTRY_MODULE].sort());

    // The second file is allowed the App Registry and nothing else. `contracts/` publishes two
    // unrelated things: a stylesheet the alias layer loads, and a JSON document the Hub reads as
    // data (AD-4, Story 2.7). Widening the file list above without this would let a token or font
    // stylesheet reach the Hub through the Registry module, which is the exact bypass the case was
    // written to refuse.
    //
    // Asserted as a subset rather than as an equality, because the schema path is named only in the
    // comment explaining why that module's one type assertion is safe: an equality would turn red
    // on a comment edit and say "named something beyond the Registry", which is the opposite of
    // what happened. The Registry itself is required separately, so the subset cannot pass by the
    // module naming nothing at all.
    const named = [
      ...new Set(
        [...readFileSync(resolve(REPO_ROOT, REGISTRY_MODULE), 'utf8').matchAll(/contracts\/[\w.-]+/g)].map(
          (found) => found[0]
        )
      ),
    ].sort();
    expect(named, `${REGISTRY_MODULE} does not import the Registry it exists to read`).toContain(
      'contracts/registry.json'
    );
    expect(
      named.filter((path) => !REGISTRY_PATHS.includes(path)),
      `${REGISTRY_MODULE} names something under contracts/ beyond the Registry pair`
    ).toEqual([]);
  });

  it('writes the hit-target floor by hand in no stylesheet, so every control reads it off the contract', () => {
    // Story 2-32's criterion, and the rule Story 2-34's gate enforces in every declaration outside the
    // permitted set (`ops/literal-conformance.mjs`, `DESIGN.md` § The hit-target floor): the floor is
    // `--tap`, minted so that five frameworks cannot each write their own. Comments are stripped first, because a sentence about the number is
    // not a declaration of it; a declaration anywhere in a scanned stylesheet fails naming the file.
    const floorLiteral = /(?<![\w.-])44px\b/;
    const written = files
      .filter((file) => file.endsWith('.scss') || file.endsWith('.css'))
      .filter((file) => floorLiteral.test(withoutComments(readFileSync(resolve(REPO_ROOT, file), 'utf8'))));
    expect(written, `a stylesheet writes the floor by hand instead of reading --tap:\n${written.join('\n')}`).toEqual([]);

    // The scan, on planted controls: a declaration fires, a comment and a longer number do not.
    expect(floorLiteral.test(withoutComments('.a { min-block-size: 44px; }'))).toBe(true);
    expect(floorLiteral.test(withoutComments('// a 44px box on a line of prose\n.a { color: red; }'))).toBe(false);
    expect(floorLiteral.test(withoutComments('.a { inline-size: 144px; }'))).toBe(false);
  });

  // **The FR-37 case left on 2026-09-23 with the layer.** It held every stylesheet but `app/app.scss`
  // to reading none of the Hub's fourteen properties, FR-37's removal condition, which Story 2-33 met.
  // Story 2-22 deleted the thirteen that were aliases, so the case's subject is gone; the repository
  // search below reads every stylesheet, and every other file git tracks, for the names themselves.
});

/**
 * The search, pure over its inputs so the planted controls go through the same code as the tree:
 * every one of the thirteen that occurs in a file, less the allowances, plus every allowance nothing
 * claimed. Bounded on both sides by `referenceTo`, so `.link--accent`, `--token-accent` and
 * `--accent-dimmer` are not the names they contain.
 */
const aliasFindings = (
  files: ReadonlyArray<readonly [path: string, text: string]>,
  allowed: ReadonlyArray<readonly [path: string, name: string]>
): string[] => {
  const findings: string[] = [];
  const claimed = new Set<string>();
  for (const [path, text] of files) {
    for (const name of DELETED_ALIASES) {
      if (!referenceTo(name).test(text)) continue;
      if (allowed.some(([at, key]) => at === path && key === name)) claimed.add(`${path} ${name}`);
      else findings.push(`${path} names ${name}`);
    }
  }
  for (const [path, name] of allowed) {
    if (!claimed.has(`${path} ${name}`)) {
      findings.push(`${path} is allowed ${name} and no longer carries it, so the allowance is stale`);
    }
  }
  return findings;
};

/** Binary by git's own rule: a NUL in the first 8000 bytes. The search reads text only. */
const isBinary = (bytes: Buffer): boolean => bytes.subarray(0, 8000).includes(0);

/** The current value the harness record states, and its regeneration table's rows in order. */
const baselineRecord = (record: string): { current: string | null; rows: { sha: string; by: string }[] } => ({
  current: /Its sha256 is `([0-9a-f]{64})`/.exec(record)?.[1] ?? null,
  rows: [...record.matchAll(/^\| `([0-9a-f]{64})` \| (Story \d+-\d+)/gm)].map((found) => ({
    sha: found[1],
    by: found[2],
  })),
});

/** Why `digest` is not the redesigned baseline by the record's own account, or null when it is. */
const baselineVerdict = (digest: string, record: string): string | null => {
  const { current, rows } = baselineRecord(record);
  const redesigned = rows.findIndex((row) => row.by === REDESIGNED_BY);
  const at = rows.findIndex((row) => row.sha === digest);
  if (redesigned === -1) return `${HARNESS_RECORD} carries no ${REDESIGNED_BY} row, so there is nothing to compare against`;
  if (current !== digest) return `the committed baseline is ${digest}, and ${HARNESS_RECORD} says the current one is ${current}`;
  if (at === -1) return `${digest} is not a row of the regeneration table in ${HARNESS_RECORD}`;
  if (at < redesigned) return `${digest} is ${rows[at].by}'s capture, taken before ${REDESIGNED_BY}'s redesigned one`;
  return null;
};

describe('the migration is closed (Story 2-22, migration step 7)', () => {
  it('names none of the thirteen deleted aliases in any file git tracks or would track, outside the record and this list', () => {
    // `epics.md` Story 2.22: "a repository-wide search returns zero remaining references to any of
    // them", and "no component stylesheet in the tree still consumes an alias name", FR-37's first
    // consequence, which this reads as a special case. `DESIGN.md` § Sequence step 7 states the same
    // acceptance as "no rule anywhere references an alias name".
    //
    // **The tree a commit would carry**, tracked and untracked but not ignored, which keeps `.next/`,
    // `node_modules/` and the generated `public/contracts/` out. **Raw text, comments included**: a
    // name in a comment is a name the next reader copies. A file whose first 8000 bytes carry a NUL
    // is binary, which is git's own rule, and a listed file gone from the working tree is a deletion
    // not yet staged, which nothing reads.
    const listed = atCollection('could not list the repository:', () =>
      gitLsFiles(['.'], ['--cached', '--others', '--exclude-standard'])
    );
    const read: [string, string][] = [];
    let excluded = 0;
    let binary = 0;
    for (const path of listed) {
      if (isSearchExcluded(path)) {
        excluded += 1;
        continue;
      }
      let bytes: Buffer;
      try {
        bytes = readFileSync(resolve(REPO_ROOT, path));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
        throw error;
      }
      if (isBinary(bytes)) {
        binary += 1;
        continue;
      }
      read.push([path, bytes.toString('utf8')]);
    }

    // Measured, not assumed: the listing reached every kind of file the criterion names, it skipped
    // the record and at least one binary by the rules above, and this file is among what it skipped.
    for (const sentinel of SEARCH_SENTINELS) {
      expect(
        read.map(([path]) => path),
        `${sentinel} was not read as text, so the search says nothing about it`
      ).toContain(sentinel);
    }
    expect(excluded, 'no Markdown or _bmad-output file was listed, so the exclusion rule is untested').toBeGreaterThan(0);
    expect(binary, 'no binary was listed, so the NUL rule is untested').toBeGreaterThan(0);
    expect(listed, `${HERE} was not listed, so its own exclusion is untested`).toContain(HERE);

    const findings = aliasFindings(read, TAILWIND_KEY);
    expect(
      findings,
      `a file names an alias Story 2-22 deleted, so the contract is not the only source:\n${findings.join('\n')}`
    ).toEqual([]);

    // The search, on planted controls through the same function: a read, a declaration and a runtime
    // lookup each fire; a BEM modifier, a longer role and a longer name do not; an allowance is
    // honoured where its key occurs and refused as stale where it does not.
    expect(aliasFindings([['x.scss', '.a { color: var(--white-color); }']], [])).toEqual(['x.scss names --white-color']);
    expect(aliasFindings([['x.scss', ':root { --accent: red; }']], [])).toEqual(['x.scss names --accent']);
    expect(aliasFindings([['x.ts', "rootCustomPropertyValue(page, '--confillia-normal');"]], [])).toEqual([
      'x.ts names --confillia-normal',
    ]);
    expect(
      aliasFindings([['x.tsx', "<a className='link--accent' style={{ color: 'var(--token-accent)' }} /> // --accent-dimmer"]], [])
    ).toEqual([]);
    expect(aliasFindings([['t.css', '--font-mono: var(--f-mono);']], [['t.css', '--font-mono']])).toEqual([]);
    expect(aliasFindings([['t.css', '--f-mono: x;']], [['t.css', '--font-mono']])).toEqual([
      't.css is allowed --font-mono and no longer carries it, so the allowance is stale',
    ]);
    expect(aliasFindings([['t.css', '--font-mono: x; --font-bold: y;']], [['t.css', '--font-mono']])).toEqual([
      't.css names --font-bold',
    ]);
    // A comment is read: a workflow comment naming an alias is a finding, as a prose line is.
    expect(aliasFindings([['ci.yml', '    # the 2023 --font-mono stack had no Courier New']], [])).toEqual([
      'ci.yml names --font-mono',
    ]);
    // The binary rule, on planted buffers: a NUL early marks a file binary whatever text follows it,
    // and a text file carrying an alias name is not binary.
    expect(isBinary(Buffer.from('PNG\0 --accent'))).toBe(true);
    expect(isBinary(Buffer.from(':root { --accent: red; }'))).toBe(false);

    // The exclusions, by the same predicate: the record and this file are skipped, a spec and a
    // stylesheet are read.
    expect(isSearchExcluded('ops/anchor-token-adoption.md')).toBe(true);
    expect(isSearchExcluded('_bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/mockups/directions-4.html')).toBe(true);
    expect(isSearchExcluded(HERE)).toBe(true);
    expect(isSearchExcluded('tests/e2e/anchor-aliases.pw.ts')).toBe(false);
    expect(isSearchExcluded('app/app.scss')).toBe(false);
  });

  it('compares /work against the redesigned baseline, the capture the record names, never an earlier one', () => {
    // `epics.md` Story 2.22: "the rendered result is asserted against the redesigned baseline captured
    // by Story 1.10's harness, not against the pre-redesign build". `tests/e2e/rendered-output.pw.ts`
    // compares `/work` against the committed file; this holds the committed file to being that capture,
    // by its sha256 against `ops/rendered-output-harness.md`, so a baseline regenerated over a regression
    // and not recorded, or an older capture put back, fails here rather than passing the comparison.
    const digest = createHash('sha256').update(readFileSync(resolve(REPO_ROOT, BASELINE))).digest('hex');
    const record = readFileSync(resolve(REPO_ROOT, HARNESS_RECORD), 'utf8');
    const { rows } = baselineRecord(record);
    expect(rows.length, `no regeneration row was parsed out of ${HARNESS_RECORD}`).toBeGreaterThanOrEqual(7);
    expect(rows[0].by, 'the first row is no longer Story 1-10, the original capture').toBe('Story 1-10');

    expect(baselineVerdict(digest, record)).toBeNull();

    // The verdict, on planted records through the same function: an unrecorded file, a current value
    // the table does not carry, and a capture from before the redesign are each refused.
    const recordSaying = (sha: string): string => record.replace(/Its sha256 is `[0-9a-f]{64}`/, `Its sha256 is \`${sha}\``);
    const unknown = 'f'.repeat(64);
    expect(baselineVerdict(unknown, record)).toMatch(/says the current one is/);
    expect(baselineVerdict(unknown, recordSaying(unknown))).toMatch(/is not a row of the regeneration table/);
    expect(baselineVerdict(rows[0].sha, recordSaying(rows[0].sha))).toBe(
      `${rows[0].sha} is Story 1-10's capture, taken before ${REDESIGNED_BY}'s redesigned one`
    );
    expect(baselineVerdict(digest, record.replace(`| ${REDESIGNED_BY} |`, '| Story 0-0 |'))).toMatch(/carries no Story 2-33 row/);
  });
});

describe('the Anchor holds no second authored copy of the contract', () => {
  const tracked = atCollection('could not list app, components and public:', () =>
    gitLsFiles(['app', 'components', 'public'])
  );

  it('listed a real tree, so an empty listing cannot read as nothing found', () => {
    expect(tracked.length, 'git ls-files over app, components and public returned nothing').toBeGreaterThan(0);

    // One sentinel per pathspec, not one for all three. `app/app.scss` alone proved only that
    // `app/` was read: if `components/` or `public/` ever left the listing, by a rename, a move or
    // an over-broad ignore rule, the case below would have stayed green over a directory it never
    // opened. That is the same fail-open shape every count in this file is pinned to prevent.
    for (const sentinel of KNOWN_TRACKED) {
      expect(tracked, `${sentinel} is not in the listing, so its pathspec contributed nothing`).toContain(sentinel);
    }
  });

  it('tracks no tokens.css, fonts.css or tailwind.css under app/, components/ or public/', () => {
    const copies = tracked.filter(isContractCopy);
    expect(
      copies,
      `a contract file is authored a second time outside contracts/, which AD-4 forbids:\n${copies.join('\n')}`
    ).toEqual([]);

    // The same predicate the assertion uses, on a planted control. Duplicating the expression
    // here instead would let a change to the real filter leave the control green.
    expect(['public/css/tokens.css', 'public/logo.png'].filter(isContractCopy)).toEqual(['public/css/tokens.css']);

    // And no binary under the directory Story 2-20 deleted, so a face committed back there fails
    // naming its path rather than passing as a file the retired-family scan never opens.
    expect(
      tracked.filter((path) => path.startsWith('public/fonts/')),
      'a file is tracked under public/fonts/, which Story 2-20 deleted whole'
    ).toEqual([]);
  });

  it('has no cuatro-contracts directory anywhere in the repository', () => {
    const everything = atCollection('could not list the repository:', () => gitLsFiles(['.']));
    expect(everything.length, 'git ls-files over the repository returned nothing').toBeGreaterThan(tracked.length);
    expect(everything, 'package.json is not in the listing').toContain('package.json');

    const vendored = everything.filter(isVendoredPath);
    expect(
      vendored,
      `${VENDORED_FOLDER}/ is the name a Satellite vendors the contract under. The Anchor is the ` +
        `publisher and loads contracts/ directly:\n${vendored.join('\n')}`
    ).toEqual([]);

    expect([`assets/${VENDORED_FOLDER}/tokens.css`, 'assets/design/tokens.css'].filter(isVendoredPath)).toEqual([
      `assets/${VENDORED_FOLDER}/tokens.css`,
    ]);
  });
});
