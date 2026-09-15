# Apple design review: the Hub as built on `dev`

**Lens:** `apple-design` (emilkowalski/skills, installed 2026-09-15), cross-read with
`emil-design-eng` for easing and `mobile-native` for touch. **Date:** 2026-09-15.
**Target:** `dev` at `58ddebc`, after Story 2-28.
**Scope:** the shipped stylesheets and motion code under `app/` and `components/`, held against
`DESIGN.md`, `EXPERIENCE.md` and `RESTYLE-SPEC.md` so every gap is graded as one of three things:
unbooked (no story owns it), booked (a story already names it), or by-spec (the Hub diverges from
Apple on purpose and the spec says so). Code-level only; no browser run was made for this pass.

---

## Overall verdict

**The system already holds most of what the skill asks for, and the spec owns the rest by
decision.** Size-specific tracking, instant focus rings, one orchestrated entrance, a flat
first paint under `prefers-reduced-motion`, specific nav labels, 44px targets and a 404 whose
exits equal the header's are all in place. The seven items in section A are the ones the spec
agrees with and no story closes. One of them (Lenis) was already rated `[high]` by the
accessibility lens on 2026-08-15 and never reached a story.

Where the Hub and Apple disagree (press feedback, gestures, springs, translucent chrome, the
system font), the spec chose deliberately and this review does not reopen it.

---

## A. Unbooked: the spec agrees, no story closes it

Ordered by how much of the site each one touches.

### A-1. Lenis runs for every visitor, reduced motion included

`app/providers.tsx:14` constructs `new Lenis()` unconditionally. Nothing reads the motion
preference, so a visitor who asked for stillness gets rAF-driven inertial scrolling on every
route, including the flat front door that exists for them. Apple § 14 (reduced motion is a
gentler equivalent, not the same motion) and § 1 (audit every latency on the input path:
Lenis's lerp is one). `review-accessibility.md:320-349` rated this `[high]` and proposed A-17;
A-17 is absent from `EXPERIENCE.md` and no story carries it. Exposure is wheel and trackpad
only, since Lenis's documented default leaves touch on native scroll.

*Fix:* one guard at the top of the effect, `if (window.matchMedia('(prefers-reduced-motion:
reduce)').matches) return;`, and a `change` listener that destroys the instance if the
preference flips (the second half of A-17). `hooks/useReduceMotion.ts` already does the
subscribing and can be read here instead of a second `matchMedia`.
*Owner:* none. Needs a DW row or a story of its own; it is global, so it fits no component
restyle.

### A-2. The 404 entrance ignores reduced motion

`components/organisms/ErrorPage/Error404.tsx:34-55` runs three `gsap.from` tweens, two of
them spatial (`y: 20`, `y: 10`), with no `useReduceMotion` read. GSAP durations are JS
literals, so the contract's 1ms collapse cannot reach them. `WorkHero.tsx:25` shows the guard
this file lacks. Apple § 14.

*Fix:* either the `WorkHero` guard, or the `GlitchText.scss` pattern (a CSS keyframe on
`opacity` at `--dur-minor`, `--ease-entrance`, `animation: none` under the query), which gets
reduced motion from the contract for free and removes GSAP from the surface.
*Owner:* Story 2-30 restyles this surface, but its text (`EXPERIENCE.md:534-566`) never
mentions the entrance. Add it to 2-30's scope so the redesign does not carry the defect over.

### A-3. The timeline's scroll fade-up is the banned pattern and ignores reduced motion

`components/organisms/WorkTimeline/WorkTimeLine.tsx:18-30` batches every `.work-item` into a
`y: 40` fade-up on scroll entry. `EXPERIENCE.md:693-694`: "One orchestrated entrance per page
load, then content simply exists. Universal scroll-triggered fade-up is banned." It also reads
no motion preference. Apple § 14 and § 16 (restraint).

*Fix:* delete the batch. The rows are content; they exist.
*Owner:* Story 2-33 says it "changes nothing about what it renders or how it behaves"
(`EXPERIENCE.md:598-599`), which as written preserves the ban's violation. A scope ruling is
needed: either 2-33 deletes it, or a DW row does.

### A-4. The disclosure closes on an ease-in

`components/atoms/WorkItem/WorkItem.tsx:90-94` closes the panel with `power2.in` over 0.3s.
An ease-in delays visible movement to exactly the frames after the click, which reads as lag
(Apple § 1; `emil-design-eng`: "Never use ease-in for UI animations"). The open branch's
`power2.out` is right; the close should match it in character and be shorter.

*Fix:* `ease: 'power2.out'` (or `expo.out`) at 165ms, which is `--dur-exit`.
*Owner:* Story 2-31. The height tween itself stays: `EXPERIENCE.md:584-587` names it as the
one layout-property exception.

**Contract note, not a stylesheet fix.** `contracts/tokens.css:125` publishes `--ease-exit` as
`cubic-bezier(0.7, 0, 0.84, 0)`, a pure ease-in, so every Satellite that adopts the token gets
the same sluggish exit. Changing a published token is an AD-16 propagation, so this is a
candidate for the next contract minor with `--ease-exit` retargeted to an ease-out (the
`--ease-entrance` curve at `--dur-exit` is the smallest change), not an edit to make now.

### A-5. Hover rules are not gated on a hover-capable pointer

No stylesheet uses `@media (hover: hover)`. On a touch device a tap paints the hover state and
leaves it there until the next tap elsewhere: the `.work-item__header` ground at
`WorkItem.scss:34-36`, the `.nav-link` colour at `HomeLayout.scss:131-133`, the navbar
underline at `navbar.scss:44-46`, the `.error-page__back` hover, and the dim-siblings rule at
`HomeLayout.scss:80-82`, which on a phone dims three panels because one was tapped.
`mobile-native` (sticky hover); Apple § 16 Familiarity. NFR-5 makes touch the primary user.

*Fix:* wrap each `:hover` block in `@media (hover: hover)`. One media query per file, no new
tokens.
*Owner:* each restyle story owns its own file: 2-29 (`HomeLayout`, and it already retires the
dim-siblings rule), 2-30, 2-31, 2-32. Worth one line in each so none of the four forgets.

### A-6. The sticky header has no edge

`components/molecules/Header/header.scss:51-59` pins the header on opaque `--token-bg` with
nothing on its block-end edge. Content scrolling under it is cut by an invisible line. Apple
§ 12 asks for a scroll-edge treatment where floating chrome meets content; the spec's own
vocabulary for depth is "lightness, then a hairline, then a rule" (`DESIGN.md:1266`), and
the opaque ground is correct by `DESIGN.md:1281-1283`.

*Fix:* `border-block-end: var(--stroke-hair) solid var(--token-border)` on `.header-container`.
Opaque, one token, no alpha.
*Owner:* Story 2-32.

### A-7. The torus lags the wheel by 1.5 seconds

`components/organisms/WorkHero/WorkHero.tsx:48` sets `scrub: 1.5`, so the torus's
scroll-bound value trails the scroll position by up to 1.5s. Apple § 1 and § 2 (1:1 tracking,
every latency on the input path is a regression). Scroll-linked motion should track the scroll.

*Fix:* `scrub: true`, or at most `0.3` if some smoothing is wanted.
*Owner:* Story 2-33. Taste item; lowest priority in this section.

---

## B. Booked: a story already names it

Verified against the spec text rather than assumed.

| Gap | Where | Story | Spec line |
|---|---|---|---|
| Hover ground is an alpha fill and a second signal | `WorkItem.scss:34-36` | 2-31 | `EXPERIENCE.md:578-579` |
| Sibling panels dimmed with `opacity: 0.2` on hover (state by opacity) | `HomeLayout.scss:80-82` | 2-29 | `EXPERIENCE.md:524-526` |
| Torus canvas requested under reduced motion | `WorkHero.tsx:67-69`, `TorusCanvas.tsx` | 2-33 | `EXPERIENCE.md:594-595` |
| Literal tracking (`0.1em`, `0.08em`, `0.06em`, `0.04em`, `-0.02em`) instead of `--tr-*` | `WorkItem.scss`, `WorkHero.scss`, `HomeLayout.scss`, `hud-label.scss`, `error-page.scss` | 2-29, 2-30, 2-31, 2-33 | Apple § 15; `DESIGN.md` type roles |
| Browser default `ease` on every legacy transition | same five files | same four stories | `EXPERIENCE.md:697-699` |
| Fixed 140px header height, `scroll-padding` as a literal | `header.scss:16` | 2-32 (DW-62) | `epics.md:3566-3567` |
| `color: #fff`, `sans-serif`, `1.2em` in the navbar | `navbar.scss:38-42` | 2-32 | file header comment |

---

## C. By spec: the Hub diverges from Apple on purpose

Recorded so the next reader does not file them as defects.

| Apple asks for | The Hub does | Decided at |
|---|---|---|
| Feedback on pointer-down (`:active` scale, § 1) | No active treatment; "the action is the feedback" | `RESTYLE-SPEC.md:159` |
| Springs, velocity handoff, momentum projection, rubber-banding (§ 3 to § 10) | No drag, swipe or gesture anywhere; every interaction is a tap or click | `EXPERIENCE.md:735` |
| Bounce on momentum interactions (§ 4, damping 0.8) | Bounce, elastic and overshoot banned | `EXPERIENCE.md:697` |
| Translucent chrome with `backdrop-filter` (§ 12) | Alpha barred except `--c-scrim`; header opaque on `--token-bg` | `DESIGN.md:1281-1283`, `EXPERIENCE.md:522-523` |
| `prefers-reduced-transparency` handling (§ 14) | Moot: nothing but the scrim is translucent, and it is a legibility layer | follows from the above |
| Default to the system font (§ 15) | Published display, body and mono faces are the brand | `DESIGN.md` § Type |
| Dim-and-push-back for modal tasks (§ 12) | No modals; focus is never trapped | `EXPERIENCE.md:722` |

---

## D. Already met

- **Tracking is size-specific, negative for display and positive for small text**
  (`contracts/tokens.css:72-77`: `--tr-display -0.05em` through `--tr-label 0.14em`), which is
  § 15 to the letter. Every rebuilt stylesheet reads those roles.
- **The focus ring is instant, never transitioned, never removed** (`app/app.scss:105-109`), § 1.
- **One orchestrated entrance, no loops.** Both repeating animations are gone (Stories 2-27,
  2-28); `HomeLayout.tsx:61-83` is one timeline with no `repeat`.
- **Reduced motion gets a flat first paint from CSS, before any script** (`HomeLayout.scss:327-329`),
  and `GlitchText.scss:54-58` sets `animation: none` rather than a 1ms run that would still wait
  out its delay. § 14 done properly.
- **Wayfinding.** Nav labels are specific ("Professional Experience", "Suite Directory"), the
  current route carries `aria-current` with a structural mark, and the 404 renders the header's
  own `DESTINATIONS`, § 16.
- **Targets are 44px on the element itself** and measured in a browser, not read off the CSS
  (`navbar.scss:31-36`, `tests/e2e/hit-target-floor.pw.ts`).
- **The disclosure animates from its live height on close** (`WorkItem.tsx:89`), which is
  § 3's "start from the presentation value".

---

## Method

Read: `app/app.scss`, `app/providers.tsx`, `HomeLayout.tsx` and `.scss`, `WorkItem.tsx` and
`.scss`, `WorkHero.tsx`, `TorusCanvas.tsx`, `WorkTimeLine.tsx`, `Error404.tsx`, `header.scss`,
`navbar.scss`, `GlitchText.scss`, `contracts/tokens.css` (motion, tracking, stroke roles),
`EXPERIENCE.md` § Motion, § Reduced motion, § Pointer and touch, § Home, § Error surface,
§ Work item, § Work hero; `RESTYLE-SPEC.md` § 1 States; `DESIGN.md` § Rules;
`review-accessibility.md:320-349`. Swept every `.scss` for `transition`, `@keyframes`,
`animation`, `prefers-*`, `backdrop-filter`, `letter-spacing`, `transform-origin`, `:active`,
`will-change`, `hover: hover`, and every `.tsx` for `gsap`, `lenis`, `useReducedMotion`,
`matchMedia`, pointer handlers.
