# Re-baseline: UX contract against the merged `dev` tree

**Run:** 2026-08-15, after `main` was merged into `dev` (commit `bc36da3` + merge).
**Why:** `DESIGN.md`, `EXPERIENCE.md` and the epics were authored against **`main`**. `dev`
carried 28 unmerged commits (the "cybercore" rebrand, PRs #46–#70) that the entire planning
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
| `--confillia-bold` | zero | zero *(unchanged: safe to delete)* |
| `--font-bold` | live at `ErrorPage.scss:14`, `HomeLayout.scss:284` | **zero: the rebrand retired every call site** |
| `--monument-bold` | `error-page.scss:14`, `HomeLayout.scss:67`, `:284`, `ProjectsHero.scss:15`, `WorkHero.scss:15` | **`glitch-text.scss:5`, `error-page.scss:24`, `ProjectsHero.scss:19`, `WorkHero.scss:19`** |
| `--accent-dim` | did not exist | **15 call sites** |
| `--font-mono` | did not exist | **10 call sites** |
| `--accent-glow` | did not exist | **zero: declared but dead** |

**Consequence for the alias trap.** It is now half gone. `--font-bold` no longer needs
hand-handling at step 2; `--monument-bold` still does, at four sites instead of two.

## Pre-existing defects, three of four were already fixed

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

## Hairlines and literals: the sweep target changed shape

The old white alpha hairlines (`rgba(255,255,255,0.15)` / `(0.3)`) are **gone**. The rebrand
replaced them with a violet set:

- `rgba(91, 33, 182, 0.06)`: `WorkItem.scss:35`, `ProjectCard.scss:36`
- `rgba(91, 33, 182, 0.3)`: `WorkItem.scss:145`, `ProjectCard.scss:67`
- `rgba(10, 0, 20, 0.6)`: `ProjectCard.scss:27`
- `#0a000f`: `HomeLayout.scss:2`, `error-page.scss:7`
- `rgba(140, 90, 210, 0.06)` grid lines: `HomeLayout.scss:4`–`:5`, `error-page.scss:9`–`:10`
- `rgba(139, 92, 246, 0.15)`: `error-page.scss:28`
- `rgba(0, 0, 0, 0.65 / 0.12)` scanlines: `ScanlineOverlay.scss:6`, `:16`, `:17`
- `rgba(255, 0, 80, …)` / `rgba(0, 255, 255, …)`: `glitch-text.scss:33`–`:68`

The bare keyword `color: white` at the old `HomeLayout.scss:122` **no longer exists**; that
file was rebuilt from 305 lines to 227.

**`glitch-text.scss`'s pair is deliberate,** not a stray literal: it encodes a chromatic
aberration effect. Tokenize only if the reconciliation below assigns those colours roles.

---

## O-10: DECIDED 2026-08-15: the contract palette wins

**Operator decision: shape 1.** `DESIGN.md`'s validated OKLCH palette (anchor hue 288) is the
contract. Cybercore's hardcoded values are replaced by token roles. This overrides the
recommendation below, which favoured re-deriving from the shipped values; it is recorded
unchanged so the reasoning that was set aside stays visible.

**The decision is cheaper than it first appeared.** Both systems are violet. `--c-paper`
(`#060509`) and cybercore's `#0a000f` are near-neighbours, and `--c-accent` (`#8f7ef0`) sits in
the same family as `rgba(139, 92, 246, …)`. The visual identity largely survives; what changes
is that every value becomes a role with a computed contrast behind it.

### The mapping

| Cybercore value | Where | Becomes |
|---|---|---|
| `#0a000f` | `HomeLayout.scss:2`, `error-page.scss:7` | `--token-bg` (`--c-paper` `#060509`) |
| `rgba(10, 0, 20, 0.6)` | `ProjectCard.scss:27` | `--token-bg-raised` (`--c-surface`) |
| `rgba(91, 33, 182, 0.06)` | `WorkItem.scss:35`, `ProjectCard.scss:36` | `--token-bg-raised-2` (`--c-surface-high`) |
| `rgba(91, 33, 182, 0.3)` | `WorkItem.scss:145`, `ProjectCard.scss:67` | `--token-border-interactive` (`--c-line-strong`, 3.52:1) |
| `rgba(140, 90, 210, 0.06)` grid | `HomeLayout.scss:4`–`:5`, `error-page.scss:9`–`:10` | `--token-border` (`--c-line`, decorative, carries no meaning) |
| `--accent` | `app.scss:9` | `--token-accent` (`--c-accent`, 6.20:1) |
| `--accent-dim` (15 sites) | `app.scss:10` | `--token-accent-muted` (`--c-accent-quiet`) where ornamental; `--token-border-interactive` where it is a boundary. **Per call site: it is doing both jobs today** |
| `--accent-glow` | `app.scss:11` | **dropped**: zero call sites (O-11) |
| `--font-mono` (10 sites) | `app.scss:31` | `--f-mono` |

**Opacity is barred from expressing state** (§ Colors), and five of the rows above are alpha
values doing exactly that. They resolve to flat tokens, not to `rgba()` with an alpha.

### Three things "contract wins" does not resolve

Each is a place where cybercore's expressive surfaces have no role in a single-hue palette.
**None should be decided inside a dev story.**

1. **GlitchText's chromatic aberration**: `rgba(255, 0, 80, …)` / `rgba(0, 255, 255, …)` at
   `glitch-text.scss:33`–`:68`. The effect *requires* opposing hues; a hue-288 palette
   structurally cannot supply them, and § Rules says "one accent." Either GlitchText keeps a
   **documented, named exception** (recommended: the effect is deliberate and it is ornament,
   never text), or the component loses the aberration and becomes a plain glitch.
2. **ScanlineOverlay's blacks**: `rgba(0, 0, 0, 0.65 / 0.12)` at `ScanlineOverlay.scss:6`,
   `:16`, `:17`. § Rules says **"nothing is pure: no `#000`, no `#fff` anywhere."** A scanline
   is a multiply-style darkening, not a surface colour, so it needs either a named
   `--token-scrim` role or the same documented exception.
3. **`rgba(139, 92, 246, 0.15)` at `error-page.scss:28`**: a large decorative numeral. The
   nearest role is `--token-accent-muted` (`--c-accent-quiet`, 2.74:1), which § Semantic roles
   marks **"ornament only, never text."** It is literally text, but decorative text that
   duplicates the visible 404 message. Confirm it is genuinely redundant to a screen reader and
   `aria-hidden`, in which case the role is correct and the contrast floor does not apply.

Recorded as **O-12**. Blocks migration steps 3–4 (Stories 2.18–2.19), not Story 1.18.

---

## The recommendation that was set aside

*Retained for the record. The Operator chose shape 1 above.*

**O-10: palette reconciliation. Blocking Epic 1 Step 2.**

`DESIGN.md` specifies a validated OKLCH palette, authored with no knowledge that a rebrand
had already established its own violet design language. These are **two design systems that
must become one**, and choosing between them is a design judgment, not a mechanical merge.

The stale reasoning is visible in the mapping table: `--light-gray-color` is described as
"warm → violet-tinted, **the most visible single change** in the migration." The rebrand
already went violet, so that framing no longer holds.

Three shapes the decision could take:

1. **Contract wins.** The OKLCH palette replaces cybercore's hardcoded values. Cost: undoes
   deliberate visual work across 15 call sites of `--accent-dim` and the whole HomeLayout /
   ErrorPage treatment. Benefit: the palette's contrast pairings are computed and validated,
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

**O-11: `--accent-glow` is declared and unused.** Confirm before deleting; it may have been
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
