# Re-baseline — UX contract against the merged `dev` tree

**Run:** 2026-08-15, after `main` was merged into `dev` (commit `bc36da3` + merge).
**Why:** `DESIGN.md`, `EXPERIENCE.md` and the epics were authored against **`main`**. `dev`
carried 28 unmerged commits — the "cybercore" rebrand, PRs #46–#70 — that the entire planning
chain never saw. Every file-and-line reference was therefore main-relative and wrong.

Everything below is **measured** against the merged tree, not inherited from a prior document.

---

## Counts

| Claim | Was (`main`) | Is (merged `dev`) |
|---|---|---|
| Custom properties in `app/app.scss` | 12 | **16** |
| Component stylesheets | 12 | **15** |
| Colour literals outside `app.scss` | "eleven places" | **28 lines across 9 files** |

Three stylesheets arrived with the rebrand: `components/atoms/HudLabel/hud-label.scss`,
`components/atoms/ScanlineOverlay/ScanlineOverlay.scss`,
`components/molecules/GlitchText/glitch-text.scss`.

Four custom properties arrived with it: `--accent` (`:9`), `--accent-dim` (`:10`),
`--accent-glow` (`:11`), `--font-mono` (`:31`).

## Token call sites

| Token | Was | Is |
|---|---|---|
| `--confillia-normal` | `HomeLayout.scss:8`, `:246` | **`HomeLayout.scss:117`, `:148`** |
| `--confillia-bold` | zero | zero *(unchanged — safe to delete)* |
| `--font-bold` | live at `ErrorPage.scss:14`, `HomeLayout.scss:284` | **zero — the rebrand retired every call site** |
| `--monument-bold` | `error-page.scss:14`, `HomeLayout.scss:67`, `:284`, `ProjectsHero.scss:15`, `WorkHero.scss:15` | **`glitch-text.scss:5`, `error-page.scss:24`, `ProjectsHero.scss:19`, `WorkHero.scss:19`** |
| `--accent-dim` | did not exist | **15 call sites** |
| `--font-mono` | did not exist | **10 call sites** |
| `--accent-glow` | did not exist | **zero — declared but dead** |

**Consequence for the alias trap.** It is now half gone. `--font-bold` no longer needs
hand-handling at step 2; `--monument-bold` still does, at four sites instead of two.

## Pre-existing defects — three of four were already fixed

The UX validation report recorded four repository defects found by reading `main`. Against the
merged tree:

| Defect | Status |
|---|---|
| `aria-hidden="true"` on the only `<h1>` of `/work` (`WorkHero.tsx:39`) | **Fixed on `dev`.** `WorkHero.tsx:60` now carries a clean `<h1>`. Resolved by PR #65 |
| `boder:` typo (`WorkItem.scss:84`) | **Fixed on `dev`.** File rewritten by PR #61 |
| `vaR(--monument-bold)` case wart (`WorkHero.scss:15`, `ProjectsHero.scss:15`) | **Gone.** Those files were rewritten |
| `Dev. 2025` should read `Dec.` (`content/work.ts:18`) | **Still open.** The only survivor |

Had the loop run against the pre-baseline documents, three stories would have opened to fix
defects that no longer exist.

## Hairlines and literals — the sweep target changed shape

The old white alpha hairlines (`rgba(255,255,255,0.15)` / `(0.3)`) are **gone**. The rebrand
replaced them with a violet set:

- `rgba(91, 33, 182, 0.06)` — `WorkItem.scss:35`, `ProjectCard.scss:36`
- `rgba(91, 33, 182, 0.3)` — `WorkItem.scss:145`, `ProjectCard.scss:67`
- `rgba(10, 0, 20, 0.6)` — `ProjectCard.scss:27`
- `#0a000f` — `HomeLayout.scss:2`, `error-page.scss:7`
- `rgba(140, 90, 210, 0.06)` grid lines — `HomeLayout.scss:4`–`:5`, `error-page.scss:9`–`:10`
- `rgba(139, 92, 246, 0.15)` — `error-page.scss:28`
- `rgba(0, 0, 0, 0.65 / 0.12)` scanlines — `ScanlineOverlay.scss:6`, `:16`, `:17`
- `rgba(255, 0, 80, …)` / `rgba(0, 255, 255, …)` — `glitch-text.scss:33`–`:68`

The bare keyword `color: white` at the old `HomeLayout.scss:122` **no longer exists**; that
file was rebuilt from 305 lines to 227.

**`glitch-text.scss`'s pair is deliberate,** not a stray literal — it encodes a chromatic
aberration effect. Tokenize only if the reconciliation below assigns those colours roles.

---

## The open decision this re-baseline does not make

**O-10 — palette reconciliation. Blocking Epic 1 Step 2.**

`DESIGN.md` specifies a validated OKLCH palette, authored with no knowledge that a rebrand
had already established its own violet design language. These are **two design systems that
must become one**, and choosing between them is a design judgment, not a mechanical merge.

The stale reasoning is visible in the mapping table: `--light-gray-color` is described as
"warm → violet-tinted, **the most visible single change** in the migration." The rebrand
already went violet, so that framing no longer holds.

Three shapes the decision could take:

1. **Contract wins.** The OKLCH palette replaces cybercore's hardcoded values. Cost: undoes
   deliberate visual work across 15 call sites of `--accent-dim` and the whole HomeLayout /
   ErrorPage treatment. Benefit: the palette's contrast pairings are computed and validated —
   the cybercore values are not, and `rgba(139, 92, 246, 0.15)` on `#0a000f` is very unlikely
   to clear 4.5:1.
2. **Cybercore wins.** The contract's palette is re-derived *from* the shipped violet values,
   keeping the visual identity and re-running the OKLCH contrast validation over it. Cost: a
   real design pass, and some cybercore values will fail and need adjusting anyway.
3. **Split by role.** Cybercore keeps the expressive surfaces (glitch, scanline, glow); the
   contract owns the semantic roles (text, bg, border, interactive). Most likely to preserve
   both intents; needs the boundary drawn explicitly or it drifts.

**Recommended:** shape 2 or 3, because the rebrand is shipped work with visual intent behind
it and the contract's real value is the *validated contrast*, not the specific hues. But this
is the Operator's call, and it should be made in a UX pass rather than inside a dev story.

**O-11 — `--accent-glow` is declared and unused.** Confirm before deleting; it may have been
reserved for work not yet done.

---

## What still needs re-checking, and was not done here

- **`epics.md` and `sprint-status.yaml`** were generated from the pre-baseline documents.
  Stories referencing the three now-fixed defects, the old line numbers, or the "twelve
  stylesheets" count are stale. **Not corrected in this pass.**
- **The mockups** (`mockups/key-screens.html`, `secondary-screens.html`) were designed against
  the contract palette and have not been reconciled against cybercore.
- **`review-token-contract.md` and `review-accessibility.md`** validated the contract palette
  in isolation. Their contrast conclusions still hold *for that palette*; they say nothing
  about the cybercore values, which have never been checked.
