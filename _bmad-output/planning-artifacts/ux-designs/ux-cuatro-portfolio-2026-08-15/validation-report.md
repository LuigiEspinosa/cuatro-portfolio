# Validation Report: cuatro-portfolio

- **DESIGN.md:** `_bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md`
- **EXPERIENCE.md:** `_bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/EXPERIENCE.md`
- **Run at:** 2026-08-15
- **Lenses:** rubric walker · token-contract conformance · accessibility (3 parallel, user-selected)

## Overall verdict

Three lenses returned **6 critical, 22 high, 29 medium, 25 low** across 82 findings. The
palette survived unchallenged, both independent lenses recomputed the OKLCH→sRGB→luminance
chain and confirmed all fifteen stated contrast pairings and all ten hex values to within
rounding. What failed was everything *around* the palette: the distribution layer, the
taxonomy's structural claim, and the hit-target floor.

**All six criticals are resolved in the spines as they now stand.** Four of them were defects
that would have shipped silently: a `@theme inline` self-reference that survives only by
cascade accident, a Tailwind adapter that loads no fonts, the Step 2 adopter filed under the
wrong consumption route, and a Status taxonomy whose greyscale claim was false as built. None
was visible by eye; each was found by attacking a specific claim the spine made about itself.

The pattern worth naming: **every critical was a place where the document asserted a property
it did not actually implement.** The contrast matrix was right because it was computed. The
44px floor was wrong because it was asserted. That is the difference the reviewers found.

## Category verdicts

| Category | Verdict at review | After fixes |
|---|---|---|
| Flow coverage | strong | strong |
| Token completeness | thin | resolved: frontmatter expanded 5 → 14 groups |
| Component coverage | thin | resolved: Tracker Family + hit targets specified, naming unified |
| State coverage | adequate | improved: secondary surfaces + 404 added |
| Visual reference coverage | thin | resolved: per-file table, spines-win stated once |
| Bloat & overspecification | adequate | unchanged |
| Inheritance discipline | adequate | improved: token refs normalised, `/projects` given a disposition |
| Shape fit | strong | strong |
| **Token contract** | **do not hand-copy** | **3 criticals fixed; 1 blocking verification remains (O-7)** |
| **Accessibility** | conditional | **2 criticals fixed; 2 verifications remain (O-8, O-9)** |

## Findings by severity

### Critical (6): all resolved

**[Token contract] `@theme inline` namespace collision**
`--color-bg: var(--color-bg)`: same name both sides, on 2 of 7 colour keys. Survives only
while `tokens.css` is imported unlayered and out-cascades Tailwind's `theme` layer. Under a
bundler flatten or a layer wrap it is a cycle → invalid at computed-value time →
`background-color: transparent`.
*Fixed:* semantic layer renamed `--color-*` → `--token-*` throughout, matching research §D2's
`--color-brand: var(--token-brand)` convention. Distinct namespaces make the failure
structurally impossible.

**[Token contract] `cs-tracker` filed as a plain-CSS consumer**
Phoenix 1.8.0 ships Tailwind v4 + daisyUI, and research §D2 states a plain `:root` file
generates **zero** utility classes there. The Step 2 adopter that FR-18 is measured on was
routed down a path that silently produces nothing. EXPERIENCE.md seam S-9 already knew this,
so the table contradicted its own companion document.
*Fixed:* Tailwind cluster redefined to include `cs-tracker`; both routes documented; version
check raised as **O-7, blocking Epic 1 Step 2**.

**[Token contract] `tailwind.css` never imports `fonts.css`**
The cluster's documented single entry point would have yielded three named families and no
`@font-face` for any: silent fall to `system-ui`. Precisely the failure the three-file split
was invented to prevent, reproduced inside the contract's own example.
*Fixed:* adapter imports both; import order restated.

**[Accessibility] `Archived` at 70% opacity**
Text composites to 3.87:1 (needs 4.5), meaning-bearing border to 2.24:1 (needs 3). § Colors
claimed "all fifteen pass" but never computed this one.
*Fixed:* `Archived` drops its border rather than fading. Opacity is now barred from expressing
state anywhere in the system.

**[Accessibility] No interactive element reaches 44×44px**
Entry links ~47×29.2px; header nav `CV` ~16×26.6px; the Hub's own `Source` link ~16px tall
with zero padding. Only the switcher row passed. Vertical padding on a plain inline element
paints outward without growing the hit area.
*Fixed:* `min-height: 44px` + `inline-flex` + `padding-inline`, in the spine and both mockups;
underline moved onto an inner `<span>`. Flagged as the easiest floor to miss while appearing
to meet it. Browser measurement raised as **O-8**.

**[Rubric] 19 of 20 `{token}` references unresolvable**
The full token set lived in DESIGN.md's prose but only a subset in its frontmatter, so
EXPERIENCE.md's cross-references pointed at nothing: the exact join a downstream consumer
extracts through.
*Fixed:* frontmatter expanded from 5 groups to 14; every reference normalised to a frontmatter
group name.

### High (22): resolved in these spines

Status taxonomy refuted (`Live` vs `Complete` 1.13:1 in greyscale, the 4px dot was carrying
the distinction uncredited; taxonomy restated on three structural axes) · `role="menu"` on the
switcher contradicting the spec's own "Tab leaves the panel normally" · `--color-focus`
declared focus-exclusive then spent on hover (new `--token-accent-hover` at 9.00:1, giving
rest/hover/focus three legible steps) · `/projects` a live route with no disposition under
NFR-2 (301 to `/#suite`) · nav underline specified at both 1px and 2px · `Status pill` /
`Status mark` name divergence · Tracker Family group had behaviour but no visual spec ·
mockups linked as an undifferentiated pair.

### Medium (29) / Low (25)

Migration counts corrected against disk: twelve custom properties not ten, twelve component
stylesheets not sixteen, eleven colour values not six, and `color: white` at
`HomeLayout.scss:122` invisible to a hex-and-`rgba` sweep. Alias trap documented:
`--font-bold` and `--monument-bold` encode *weight* in the family name, so a family-only alias
silently drops bold at `ErrorPage.scss:14` and `HomeLayout.scss:284`: and the regression lands
at step 2, before step 6 exists to fix it. `--confillia-normal` has two live call sites and
needed a target, not a deletion.

### Found outside the review, by reading the repository

- **FR-9 defect:** `digital-library` runs on **SQLite**, not Postgres. Earlier drafts in this
  run said Postgres. Real stack: SvelteKit · Fastify · SQLite · Redis · BullMQ · Docker.
- `aria-hidden="true"` wraps the only `<h1>` on `/work`: [`WorkHero.tsx:39`](../../../../components/organisms/WorkHero/WorkHero.tsx#L39)
- `boder:`: [`WorkItem.scss:84`](../../../../components/atoms/WorkItem/WorkItem.scss#L84)
- `Dev. 2025` should read `Dec.`: [`work.ts:18`](../../../../content/work.ts#L18)
- `Celeste.tsx` hides the header by mutating the DOM in an effect

## What the reviewers got wrong

Recorded because a review is evidence, not an oracle.

- The rubric brief assumed DESIGN.md's two invented sections sat *after* Do's and Don'ts,
  breaking the canonical order lock. The reviewer checked and **inverted the premise on the
  facts**: they sit between Components and Do's and Don'ts, all eight canonical sections
  present in canonical relative order. No fix was needed.
- `vaR(--monument-bold)` at `WorkHero.scss:15` and `ProjectsHero.scss:15` looks like a defect
  but is not: CSS function names are ASCII case-insensitive, so it resolves. A consistency
  wart, not a bug, and not worth a commit of its own.

## Reviewer files

- [`review-rubric.md`](review-rubric.md): 1 critical · 8 high · 12 medium · 9 low
- [`review-token-contract.md`](review-token-contract.md): 3 critical · 6 high · 8 medium · 9 low
- [`review-accessibility.md`](review-accessibility.md): 2 critical · 8 high · 9 medium · 7 low
