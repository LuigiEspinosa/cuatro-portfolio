# UX prompt: the restyle pass

Drafted 2026-08-15, after `bmad-correct-course` produced and the Operator approved
[`sprint-change-proposal-2026-08-15.md`](sprint-change-proposal-2026-08-15.md). Paste the block
below into a **fresh** Claude Code session opened at `c:\Development\cuatro-portfolio`.

This is the **second** UX run. The first
([`ecosystem-ux-prompt.md`](ecosystem-ux-prompt.md)) produced `DESIGN.md` and `EXPERIENCE.md` and
was told, in its own non-goals, **not** to redesign the interior of any application. That
instruction has been overturned by an Operator decision. This run is the consequence.

**Run it before Story 1.11 if you can.** See the note at the end: the timing changes whether the
token contract ships once or twice.

---

/bmad-ux

## What changed, and why you are being asked

**Operator decision, 2026-08-15: every application the Suite Directory renders gets a visual
restyle, not just token adoption.** The approved change proposal is
`_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-15.md`. The PRD, the Architecture
Spine, the epics and sprint tracking have all been amended already. **You are not being asked to
re-decide the scope change.** You are being asked to supply the design contract it depends on, which
does not exist.

The gap, stated plainly: **`EXPERIENCE.md` § Component Patterns specifies the new Suite components
and nothing else.** `GlitchText`, `ScanlineOverlay`, `HudLabel`, `HomeLayout`, `Error404`, `WorkItem`
and the chrome have no design contract anywhere in the planning chain. That was correct while those
components were being *migrated*, because a migration needs a mapping table rather than a design. It
is not correct now that they are being *redesigned*. Fourteen stories are blocked on this run:
Epic 2's Stories 2.27 to 2.34 and all of Epic 8.

## Read these first, in this order

1. `sprint-change-proposal-2026-08-15.md` **in full.** It is the brief. §4.3 carries the three O-12
   dispositions and a recommendation on each; §5.3 states exactly what this run must produce; §6
   states what breaks if it is done badly.
2. `ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md` and `EXPERIENCE.md`, your own prior output.
   Both declare they win on conflict with any mock. **You may amend them; you may not quietly
   contradict them.**
3. `ux-designs/ux-cuatro-portfolio-2026-08-15/rebaseline-2026-08-15.md`, which measured the cybercore
   rebrand against the merged tree and carries O-10's decided mapping and O-12's three surfaces.
4. `architecture/architecture-cuatro-portfolio-2026-08-15/ARCHITECTURE-SPINE.md`, **AD-14, AD-19,
   AD-24, AD-25 and C-11 through C-13**, which are new or amended as of today.
5. `prds/prd-cuatro-portfolio-2026-08-15/prd.md` §3 glossary (Token Adoption versus Visual Restyle),
   §4.4, §8, §9, FR-36 through FR-38.
6. The shipped components themselves, under `components/atoms|molecules|organisms/`. Fifteen
   stylesheets. Read them; the rebaseline's line references are measured and current.

## Three deliverables, in priority order

### 1. The Restyle Specification (highest priority, new artifact)

**This is the artifact AD-24 exists to require, and it is the thing that keeps this programme from
becoming the shared component library PRD §8 rules out.** Seven applications in five frameworks will
implement the same component vocabulary. Something has to federate, and code cannot. A written
specification is the only form that crosses HEEx, Svelte, Angular, React and Vue.

Specify the vocabulary framework-agnostically: what a **control**, a **row**, a **separator**, a
**focus treatment**, a **status affordance**, a **heading**, a **label** and an **empty edge** are in
this system. Written so an Elixir developer, a Svelte developer and an Angular developer can each
implement from it independently and arrive at the same result without seeing each other's work.

Two tests it must pass:

- **The independent-implementation test.** If two people implement the same component from your
  spec and get visibly different results, the spec is not finished.
- **The daisyUI test.** `cs-tracker` runs Tailwind v4 with daisyUI. A daisyUI button carrying token
  colours is still a daisyUI button, and § Components has no filled button anywhere in the system.
  Say what displacing a component library's defaults actually requires, per framework family, so
  Story 8.1 is bounded rather than open-ended.

Also give it a **floor and a ceiling**. The floor is what makes an application count as restyled
(Story 8.4 records SM-12 against it). The ceiling is where a restyle stops and per-app feature work
begins, because PRD §8's carve-out is bounded by exactly that line: presentation only, never
behaviour, routes, data or feature set.

### 2. Component entries in `EXPERIENCE.md` for the redesigned Hub surfaces

At the same depth as the existing Registry Entry and Status mark entries. Cover at minimum:
`GlitchText`, `ScanlineOverlay`, `HudLabel`, `HomeLayout`, `Error404`, `WorkItem`, and the chrome
(`Navbar`, `Header`, `Logo`, `ContactContainer`, `Container`), plus `WorkHero` and `WorkTimeline`.

`ProjectCard` and `ProjectsHero` are retired with `/projects` by Story 2.14 and need nothing.

### 3. `DESIGN.md` § Migrating the Anchor, rewritten

The seven-step sequence is now two steps plus a redesign programme. Steps 1 and 2 survive untouched
(they are Epic 1, Stories 1.17 and 1.18, and FR-18 is measured on them). Step 5 moves to the front of
the redesign. Steps 3, 4 and 6 are struck. Step 7 is retargeted to fire when the last component is
redesigned. Rewrite the section to match, and keep the mapping table, which is still correct and
still load-bearing for Story 1.18.

## What I need decided

1. **How much of cybercore survives.** O-10 decided the *palette*; **it did not decide the
   aesthetic.** The rebrand brought a HUD-and-scanline-and-glitch language, and nothing in the
   planning chain says whether that language survives a token-native redesign or is replaced by the
   quieter typographic system `EXPERIENCE.md` describes. **This is the largest unanswered design
   question in the estate and it governs every other answer below.** Decide it explicitly rather
   than letting it emerge component by component.

2. **O-12 item 1, GlitchText's red and cyan aberration** (`glitch-text.scss:33`-`:68`). Drop it, or
   keep it as a named documented exception? The change proposal recommends dropping it: a documented
   exception on one of the Hub's most visible components undermines the contract at the point a
   reviewer looks, and § Rules permits one accent. Accept or overturn, and say why.

3. **O-12 item 2, ScanlineOverlay's pure blacks** (`:6`, `:16`, `:17`). Does a darkening layer
   survive the redesign at all? If it does, "nothing is pure" still bars `#000`, so specify
   **`--token-scrim`**: its value, what it is layered over, and what it does to the contrast of
   anything beneath it. If no darkening layer survives, say so and the role is not needed.

4. **O-12 item 3, the decorative numeral at `error-page.scss:28`.** The *test* belongs to Story
   2.30: confirm by testing whether it is redundant to a screen reader. **Your job is to specify
   both branches** so the story cannot stall. If redundant, it is `aria-hidden` and
   `--token-accent-muted` (2.74:1, ornament only) is correct. If not redundant, it is text,
   `--token-accent-muted` is forbidden, and you must name the role it takes instead at 4.5:1 or
   better.

5. **Is `HudLabel` the same thing as UX-DR21's Plate mark?** Both are mono, uppercase, tracked,
   sitting on a hairline, carrying section identity. If they are the same component under two names,
   say so and fold one into the other. If they are genuinely different, say what distinguishes them,
   because two near-identical label atoms in a fifteen-component system is a smell.

6. **O-11, `--accent-glow`.** Declared at `app/app.scss:11` with zero call sites, arrived with the
   rebrand. Confirm it is genuinely unused rather than reserved, and delete or keep.

7. **What happens to the mockups.** `mockups/key-screens.html` and `secondary-screens.html` were
   designed against the contract palette and were never reconciled against cybercore. Under a
   redesign they stop being something to reconcile and start being the target. Update them to show
   the redesigned components, or state that they are superseded by the Restyle Specification and
   retire them. Do not leave them stale and ambiguous.

## The invariants that do not move

- **AD-24: no shared component library, and this change does not reopen it.** The evidence is
  unchanged: Google defunded Material Web (2024-06), GitHub retired Primer ViewComponents (2026-02),
  Adobe maintains parallel implementations with no consolidation plan. If your specification implies
  shared component code crossing the Turborepo boundary, it is mis-scoped. Recurrence of a component
  across three or more applications is evidence the **specification** should be better, never that a
  **package** should exist.
- **AD-25: restyle follows visibility.** Specify for what the Suite Directory renders. Do not design
  for `StreamVault`, `MaiCoin`, `poketracker-go`, `Mutuo` or `cuatro-finance`; they are unrendered
  and therefore unrestyled, and SM-C6 targets zero restyles ahead of rendering.
- **FR-18 is not yours to raise.** It stays satisfied by Token Adoption alone, because Epic 1's
  standalone claim rests on it. If FR-18 comes to mean "restyled", Epic 1 becomes blocked on Epic 8
  and the foundation epic stops delivering visible value on its own. See spine C-13.
- **The contract is dark-only.** A light theme is deferred and seam S-7 is accepted deliberately.
- **Seams S-4, S-5 and S-6 stay accepted permanently**: form validation states, overlays, dense data
  UI. The restyle raises the ceiling; it does not dissolve it. Do not invent a cross-framework
  overlay convention.
- **Seam S-1 stands.** The Three.js narrative's colours are JS values a custom property cannot
  reach. It is a declared FR-17 exception and is out of scope here.

## Constraints that do not change

- **Solo maintainer**, five frameworks, no shared code, indefinitely. Anything specified must be
  implementable and maintainable by one person by hand.
- **UX-DR49's asset budget binds the redesign**: 140 KB gzipped on the non-3D path, of which 120 KB
  is fonts. SM-C5 counts Hub asset weight as a counter-metric. Story 2.20 deletes three font
  binaries, which is the offset available to you.
- **UX-DR50's anti-pattern floor** (`nutlope/hallmark`) is a floor, not a suggestion. Purple is not
  the problem; purple used as a fill is.
- **The colour and depth rules hold**: accent under 3% of any viewport and never a background fill,
  no `#000` and no `#fff` outside the print stylesheet, no shadows at all, no gradients, alpha is not
  a colour, opacity never expresses state, six named z-levels only.
- **AD-19's accessibility floor now applies to every restyled application**, not to `cs-tracker`
  alone. Whatever you specify has to survive a hand measurement in a browser on five stacks.
- **AD-14: a Satellite adopts the whole contract or none of it**, but that binds the contract
  *import*, not the restyle. A restyle ships as one merge off a branch.
- **AD-16: contract changes are versioned.** A value addition is a minor bump; any rename is major,
  including fixing a typo in a token name.
- `cuatro-portfolio` is shipping at v2.5.3 and four subdomains serve throughout. This is still a
  reshape of a working site.

## Non-goals

- Re-deciding the scope change, the palette (O-10 is decided), or the token contract's existing
  property set beyond adding `--token-scrim`.
- Feature work in any application. Presentation only. A restyle that changes behaviour, routes, data
  or feature set has left PRD §8's carve-out.
- Designing the Suite Switcher, which is v2 and already specified as UX-DR23.
- A light theme.
- Anything for the four unbuilt applications.

## Output

Enough that Stories 2.27 to 2.34 and 8.1 to 8.3 can be given their visual acceptance criteria
without a designer in the room:

1. **The Restyle Specification**, framework-agnostic, with its floor and its ceiling.
2. **`EXPERIENCE.md` § Component Patterns entries** for every redesigned Hub component.
3. **`DESIGN.md` § Migrating the Anchor**, rewritten to two steps plus the redesign programme.
4. **`--token-scrim`** specified, or explicitly not needed.
5. **O-11 and O-12 closed**, with item 3's two branches both specified.
6. **A decision on the cybercore aesthetic**, stated once, at the top, governing everything else.
7. **The mockups updated or retired**, not left stale.

Flag anything where a design decision would make a settled technical or product decision untenable,
the way PRD §12 and spine C-1 through C-13 do. I would rather find it here than in a dev story.

## One timing note that saves a version bump

Epic 1's **Story 1.11 publishes `contracts/tokens.css` as `Contract v1.0.0`**. If this run lands
**before** Story 1.11 opens, `--token-scrim` goes into v1.0.0 and the contract ships once. If it
lands after, Story 2.28 adds the role as a v1.1.0 minor bump, `cs-tracker` re-vendors, and AD-16's
change process gets rehearsed early on a cheap change. **Both outcomes are fine and neither blocks
anything** (a value addition forces no consumer to migrate), but the first is tidier and it is free
if the sequencing allows. Epic 1's other nineteen stories are unaffected either way and Story 1.1 can
open regardless.
