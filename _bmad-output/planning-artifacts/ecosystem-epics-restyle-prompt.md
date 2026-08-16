# Epics prompt: the restyle stories

Drafted 2026-08-15, after `bmad-ux` completed the restyle pass and produced
[`RESTYLE-SPEC.md`](ux-designs/ux-cuatro-portfolio-2026-08-15/RESTYLE-SPEC.md) plus amendments to
both spines. Paste the block below into a **fresh** Claude Code session opened at
`c:\Development\cuatro-portfolio`.

This is item 4 of the change proposal's routing table
([`sprint-change-proposal-2026-08-15.md`](sprint-change-proposal-2026-08-15.md) §7.2). Items 1, 2
and 3 are done: the PRD, the Architecture Spine and the UX contract have all been amended. **The
blocker on Stories 2.27 to 2.34 and all of Epic 8 is lifted.** What remains is that the stories were
written before the design contract existed, so their acceptance criteria describe work whose target
was still unknown.

**One of them is now factually wrong**, not merely thin. See deliverable 1.

---

/bmad-create-epics-and-stories

## What changed, and why you are being asked

The UX restyle pass closed on 2026-08-15 and produced three things the epics do not yet know about.

**1. The Restyle Specification now exists.** `RESTYLE-SPEC.md` is the framework-agnostic component
vocabulary AD-24 requires: ten elements, twelve floor checks (F-1 to F-12), a stated ceiling, and a
per-framework answer to what displacing a component library actually costs. Stories 2.27 to 2.34 and
8.1 to 8.6 can now be written against a target instead of toward one.

**2. `--token-scrim` ships in `v1.0.0`, not `v1.1.0`.** Story 1.11 was still `backlog` when the role
was decided, so it goes into the contract's first published version and the contract ships once.
**Story 2.28's acceptance criteria currently require the opposite** and are wrong on three counts.

**3. The governing aesthetic decision was made.** The cybercore effects retire (the glitch loop, the
red and cyan aberration, the scanline raster, the radial vignette, the film grain); the signage
survives (mono uppercase labels on a hairline, the notched panel silhouette, the readout register).
Several stories currently describe migrating or excepting things that no longer exist.

**You are not being asked to re-decide any of that.** You are being asked to make the stories match
it, and to give Epic 8 the acceptance criteria it has never had.

## Read these first, in this order

1. `ux-designs/ux-cuatro-portfolio-2026-08-15/RESTYLE-SPEC.md` **in full.** It is the target. § The
   floor is what Story 8.4 records; § The ceiling is what bounds every Epic 8 story; § Displacing a
   component library is what makes Story 8.1 estimable.
2. `ux-designs/ux-cuatro-portfolio-2026-08-15/EXPERIENCE.md` § Component Patterns, the redesigned Hub
   surfaces (behaviour for Stories 2.27 to 2.33) and § Open Items (O-13 through O-17 are new).
3. `ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md` § The scrim, § Components, the redesigned
   Hub surfaces, and § Migrating the Anchor, whose Sequence is now two steps plus an R0 to R8
   programme mapped story by story.
4. `epics.md`, Stories 2.27 to 2.34 (lines 2860 to 2990 or thereabouts) and Epic 8 (from line 3790).
5. `implementation-artifacts/sprint-status.yaml`, keys `2-27-*` to `2-34-*` and `8-1-*` to `8-6-*`.
   All are `backlog`; nothing has started.
6. `ux-designs/ux-cuatro-portfolio-2026-08-15/review-independent-implementation.md` and
   `review-restyle-token-contract.md`, the two lenses that reviewed the pass. The criticals are
   resolved; the residue is O-17 and some of it belongs in stories.

## Four deliverables, in priority order

### 1. Correct Story 2.28. It is wrong, not merely stale. (highest priority)

`epics.md:2921` titles it *"Redesign `ScanlineOverlay` token-native and add `--token-scrim`"*. The
role is no longer added by this story. Three specific corrections:

| Line | Currently says | Should say |
|---|---|---|
| `:2921` | Title includes "and add `--token-scrim`" | The story **consumes** a role that `contracts/tokens.css` already carries from Story 1.11 |
| `:2938` | "**Or** a `--token-scrim` role is **added** to `contracts/tokens.css`" | The role exists at `v1.0.0`. The conditional is resolved: **a darkening layer does survive**, so the second branch is the only branch |
| `:2941` to `:2947` | "the contract header moves to `Contract v1.1.0`" | **Delete.** No version bump occurs. `cs-tracker`'s `token_contract` declaration stays correct with no re-vendor |
| `:2949` to `:2953` | Records this as "the first of the three hand-copied token changes that earn Epic 6" | **Delete, and see the decision below.** A value present at first publication was never a change |

**Also stale for the same reason:** `epics.md:3832` (Story 8.1's acceptance intent) says the
vendored contract version is re-checked "since Epic 2 may have moved the contract to v1.1.0". Epic 2
does not move it.

**And Story 2.28's conditional is now resolved.** Its current text says O-12 item 2 "dissolves if
the redesign drops the darkening layer" and stays open otherwise. The UX pass decided: the effects
retire, but the **legibility** job survives as `--token-scrim`, specified with a worst-case contrast
guarantee. Write the story against that, not against a fork.

### 2. Re-open acceptance criteria for Stories 2.27 to 2.34

They were written to be safe in the absence of a design contract. One now exists, so the acceptance
criteria should be **visual and checkable** rather than protective. Each story's target is named
precisely:

| Story | Target |
|---|---|
| 2.27 | `EXPERIENCE.md` § Display entrance, `DESIGN.md` § Components. **Also fixes O-13** at `GlitchText.tsx:72` |
| 2.28 | `DESIGN.md` § The scrim, and § Scrim layer in `EXPERIENCE.md` |
| 2.29 | `EXPERIENCE.md` § Home surface. **Carries the z-level trap**: the scrim's guarantee is a property of the stack, so a sticky header above the scrim is over the imagery, not over the scrim |
| 2.30 | `EXPERIENCE.md` § Error surface. **Both O-12 item 3 branches are specified**, with the test and the treatment for each. **Also fixes O-13** at `Error404.tsx:41`. The mockup renders both branches side by side |
| 2.31 | `RESTYLE-SPEC.md` § 7 Label. **`HudLabel` is folded into Plate mark**, so this story retires an atom rather than restyling two |
| 2.32 | `DESIGN.md` § Chrome. The 44px floor is the acceptance condition, **measured, not read off the CSS** |
| 2.33 | `DESIGN.md` § Work hero and timeline |
| 2.34 | The FR-17 grep. **It needs one exception and the exception is precise:** the alpha literal lives on `--c-scrim` inside `contracts/`, not on `--token-scrim`. A gate written against the role name rejects the contract file itself |

**Story 2.34 has four uncovered collisions** the token lens surfaced and no story currently names:
`opacity` keyframes (2.27), `clip-path` notch geometry (2.29), the `44px` hit-target literal (the
contract mints no token for it, and all three mockups had to invent one), and
`font-variation-settings` axis literals. Each is either an allowed pattern or a new token. Decide
per case; do not leave the grep to discover them.

### 3. Full acceptance criteria for Epic 8, Stories 8.1 to 8.6

**Epic 8 has "acceptance intent" and no acceptance criteria.** It is the only epic in the plan in
that state, and it is the one whose stories touch repositories outside this one.

- **8.1 is now bounded and the spec says how.** `RESTYLE-SPEC.md` § Displacing a component library,
  family A: map daisyUI's theme variables onto token roles, stop using its component classes on
  surfaces inside the floor, keep the plugin and every utility. The scope is a grep, **and the spec
  names five things the grep does not catch**. Put those in the story rather than in the estimate.
- **8.4 records the floor.** F-1 to F-12 per application, with the method each check names. Three of
  the twelve were rewritten because their original method was "look at it"; use the stated methods.
- **8.2, 8.3, 8.5, 8.6** each ship as their own step. AD-20 binds: 8.3 never shares a commit with
  Story 2.25's relocation, and 8.5 and 8.6 wait for their Epic 3 merges.

### 4. Fold the new open items into the stories that close them

`EXPERIENCE.md` § Open Items gained five. Four belong in stories:

| Item | Belongs to |
|---|---|
| **O-13**, `aria-label` on generic roles at `GlitchText.tsx:72` and `Error404.tsx:41` | Stories 2.27 and 2.30, as acceptance criteria |
| **O-14**, which surfaces of each wave-1 Satellite a Visitor reaches without authenticating | A prerequisite of estimating 8.1, 8.2 and 8.3. It sets the floor's denominator and is answerable today, from outside each application |
| **O-15**, what each wave-1 Satellite actually has installed, so the right framework family applies | Same. `cs-tracker` is confirmed family A; `digital-library` and `list-wheel` are **assumed** C and B and were not verified |
| **O-17**, residual review findings below the criticals | Triage before 8.1 opens. Most bite a Satellite implementer, not the Anchor |

## What I need decided

1. **Epic 6's trigger now counts to two, not three.** Its trigger is "three hand-copied token changes
   actually performed" (`epics.md:3731`), and `--token-scrim` was going to be the first. Shipping it
   inside `v1.0.0` removes it from the count. Either restate the trigger, re-derive the number, or
   accept that Epic 6 is now further away. **Say which, and say what the trigger counts instead.**
   Do not quietly leave a counter that can no longer reach three on the timeline anyone expected.

2. **AD-16's change process loses its cheap rehearsal, and `epics.md` called that a benefit.** Lines
   `:2949` to `:2953` make the explicit argument that exercising the change process on the cheapest
   possible change, months before anything expensive depends on it, is worth having. Shipping at
   `v1.0.0` deletes that rehearsal. **This is a real cost of the tidier outcome and it was not
   weighed when the timing was decided.** Confirm it is acceptable, or say what else rehearses the
   process before the first expensive change.

3. **The Story 2.28 sprint key.** It reads
   `2-28-redesign-scanlineoverlay-token-native-and-add-token-scrim`, and the title it derives from is
   changing. The change proposal's §7.3 rule is that **no existing key changes meaning**, which was
   written to protect keys against renumbering. Nothing has started, so renaming is safe here.
   Rename the key with the title, or keep the key and accept drift between key and title. **Pick one
   and apply it consistently**, because a key that describes work the story no longer does is the
   same defect the rule exists to prevent.

4. **Where O-14 and O-15 land.** They are verification, not implementation, and both are answerable
   in an afternoon. Either a small Epic 8 story ahead of 8.1, or a prerequisite recorded against
   8.1, 8.2 and 8.3 individually. **A prerequisite nobody owns is how an estimate ends up built on
   an assumed surface count.**

## The invariants that do not move

- **FR-18 is not raised.** It stays satisfied by Token Adoption alone, and Story 1.19 alone still
  satisfies it. If FR-18 comes to mean "restyled", Epic 1 blocks on Epic 8, which blocks on Epic 2,
  and the foundation epic stops delivering visible value on its own. Spine C-13.
- **Epic 1 is untouched.** All twenty stories survive verbatim and Story 1.1 can open regardless of
  anything in this prompt. The only Epic 1 change anywhere is that Story 1.11 now publishes a
  contract that includes `--token-scrim`.
- **AD-24: no shared component library.** The vocabulary federates as `RESTYLE-SPEC.md` and never as
  code. A story that implies shared component code crossing the Turborepo boundary is mis-scoped.
  Recurrence across three or more applications is evidence the **specification** should be better.
- **AD-25: restyle follows visibility.** No story exists for `StreamVault`, `MaiCoin`,
  `poketracker-go`, `Mutuo` or `cuatro-finance`. SM-C6 targets zero restyles ahead of rendering, and
  a restyle work item for an unrendered application is a defect.
- **AD-20: every step leaves a working system.** Story 8.3 never shares a commit with Story 2.25.
  Story 2.22 (delete the aliases) fires when the last Hub component is redesigned, which is 2.33.
- **Story 2.20 precedes every redesign story.** The type layer is global, and redesigning against
  `--f-display` while Monument Extended is still shipped means designing against a face about to be
  deleted.
- **Seams S-4, S-5 and S-6 stay accepted permanently.** The restyle raises the ceiling; it does not
  dissolve it. No story invents a cross-framework overlay, validation or table convention.

## Constraints that do not change

- **Solo maintainer**, five frameworks, no shared code, indefinitely.
- **The restyle floor is every surface a Visitor reaches without authenticating.** Authenticated
  interiors, admin surfaces and dense data views are below it. This is deliberately checkable
  without a login, and it is what makes 8.4 a real record rather than an assertion.
- **The restyle ceiling permits markup changes** where layout requires them, and forbids any change
  to information, destinations, interactions, DOM order or copy. **A restyle diff is therefore not
  reviewable as a CSS-only diff**, which is a real review cost and should be visible in the stories.
- **UX-DR49's 140 KB non-3D budget binds every redesign story**, measured against SM-C5. Story 2.20
  deletes three font binaries and 2.27 deletes the glitch keyframes; those are the offsets.
- **AD-19's manual accessibility pass applies to every restyled application**, not to `cs-tracker`
  alone. Three passes in wave 1, two in wave 2. Recorded per application.
- **AD-21: every CI gate is blocking.** Story 2.34's grep is a gate, never a warning.
- `cuatro-portfolio` ships at v2.5.3 and four subdomains serve throughout.

## Non-goals

- Re-deciding the scope change, the palette, the cybercore disposition, the scrim, the floor, the
  ceiling or the daisyUI strategy. All are decided and recorded.
- Renumbering anything. The holes at 2.18, 2.19 and 2.21 are deliberate.
- Writing stories for the four unbuilt applications, or for `cuatro-finance`.
- Feature work of any kind inside any application.
- Re-opening Epic 1, Epic 3, Epic 4, Epic 5 or Epic 7.

## Output

1. **Story 2.28 corrected**, with the version-bump criteria removed and the conditional resolved.
2. **Acceptance criteria for Stories 2.27 to 2.34** written against the design contract that now
   exists, each naming the specification section it is measured against.
3. **Full acceptance criteria for Stories 8.1 to 8.6**, with 8.4 carrying F-1 to F-12 and their
   stated methods.
4. **O-13, O-14, O-15 and O-17 placed** in the stories or prerequisites that close them.
5. **The four decisions above made explicitly**, especially Epic 6's trigger, which currently counts
   toward a number it can no longer reach as planned.
6. **`epics.md:3832` corrected** and any other reference to `v1.1.0` swept.
7. **Regeneration instructions for `sprint-status.yaml`**, including the Story 2.28 key decision.
   Actionable stories stay at 93.

Flag anything where a story-level decision would make a settled product or architectural decision
untenable, the way PRD §12 and spine C-1 through C-13 do. Better found here than in a dev story.

---

## Appendix: one documentation task that is not story work

**`DESIGN.md` and `EXPERIENCE.md` carry 109 and 182 em-dashes**, nearly all of them written in the
first UX run. The house writing rule bars an em-dash in any file written into a repository, and
`RESTYLE-SPEC.md` and `mockups/redesigned-components.html` were authored clean against it.

**This is not a straight sweep**, which is why it is a decision rather than a chore:
`DESIGN.md` § Typography specifies the em-dash as **correct typeset punctuation for the product's
own UI copy** ("Punctuation is typeset. Curly quotes, `—` em-dash, `…` ellipsis"). Sweeping the
documents' prose without touching that rule leaves the rule and the prose disagreeing; sweeping both
overturns a design decision that was made deliberately.

The distinction that resolves it, if you want one: **the rule governs what the product renders; the
house rule governs what the repository stores.** Those can differ, and saying so once in `DESIGN.md`
costs a sentence.

Not blocking on anything. Worth doing before the spines are read by five implementers.
