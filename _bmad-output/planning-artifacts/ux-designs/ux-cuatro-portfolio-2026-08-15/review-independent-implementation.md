---
lens: independent-implementation
date: 2026-08-15
target: RESTYLE-SPEC.md
read-against:
  - DESIGN.md
  - EXPERIENCE.md
verdict: not-yet-implementable
counts:
  critical: 9
  high: 26
  medium: 24
  low: 9
  total: 68
---

# Independent-implementation review of RESTYLE-SPEC.md

## Method

The specification states its own acceptance test:

> If two people implement the same element from this file and get visibly different results, this
> file is not finished.

That test was run adversarially and literally. For every vocabulary entry the question asked was:
given this entry, `DESIGN.md` and `EXPERIENCE.md`, and nothing else, would an Elixir developer
writing HEEx, a Svelte developer and an Angular developer produce the same rendered pixels? Where
the answer is no, the finding names the specific property and the specific way the three renders
diverge. "Needs more detail" is not recorded as a finding anywhere below.

A second question was asked of every entry: where does the entry rely on a judgement call without
naming the judgement or who makes it? The file forbids this explicitly ("An entry that permits a
judgement call names the judgement and who makes it"), so each instance is a self-test failure and
is recorded as such.

## Verdict

**not-yet-implementable.**

This is not a judgement on the file's quality. The reasoning is unusually good, the precedence
model is stated, the contrast arithmetic is real, and the governing decision is argued rather than
asserted. The file fails its own test for three structural reasons rather than for a long tail of
small gaps:

1. **The vocabulary does not cover what the named applications render.** A books library renders
   cover art, a search field and pagination. A Counter-Strike match tracker renders a scoreboard, a
   live-updating pending state and more than four status values. A random-picker wheel renders a
   textarea and a disabled action. The eight entries specify none of those, and the two entries that
   would carry them (Control, Row) are written as absolutes that forbid the obvious answer without
   supplying a replacement.

2. **The single largest piece of geometry in the system is named and never given.** The row gains
   columns at 760px. No template, no widths, no gap, no alignment, no breakpoint token. Every list
   surface in every application depends on it.

3. **The floor does not test the vocabulary.** F-1 to F-11 check colour, type family, rules, fills,
   corners, focus, shadows, accent share, greyscale, target size and `color-scheme`. Not one of the
   eleven checks whether the Row, the Heading scale, the Label variants or the Separator placement
   match this file. An application can pass all eleven and share no geometry with its siblings, which
   is precisely the drift the file exists to prevent.

The gap to `implementable-with-gaps` is not large in page count. Most of the Critical findings close
with a table, a value or a named owner, and several close with one sentence. The gap is real today.

---

# Part 1: the eight vocabulary entries

Each entry is answered against (a) three-framework convergence, (b) underspecified properties, and
(c) unowned judgement calls.

## 1. Control

**(a) Convergence: no.** Three implementations differ in height, in width on a narrow label, in
whether a hover change is animated and for how long, in what the "current" underline does to the
mandated bottom border, and in whether a nav link is a Control at all.

**(b) Underspecified.**

- **`padding-block` has no value.** The geometry row gives `min-height: 44px`, `inline-flex`,
  `align-items: center` and `padding-inline: var(--s-md)`, and stops. `DESIGN.md` § Components says
  the difference is made up "with `padding-block`" and also gives no number. One implementer writes
  `padding-block: 0` and gets exactly 44px; another writes `padding-block: var(--s-sm)` and gets
  a 44px minimum that becomes 12 + 17 + 12 = 41px, then 44px by the minimum, then more the moment
  the label wraps. In a list of controls the cumulative difference is visible immediately.
- **No `min-width`, and the horizontal 44px rule is contradicted.** `DESIGN.md` says a narrow target
  takes `padding-inline` sufficient "to reach 44px wide". This entry replaces that instruction with a
  fixed `padding-inline: var(--s-md)` (16px). A two-letter mono label at `--t-2xs` measures roughly
  14px, giving 46px; a one-character label gives roughly 39px and fails F-10. The entry gives the
  value and drops the constraint the value was supposed to satisfy.
- **`line-height` is not named.** `--lh-label` (1.4) exists in the contract and is not referenced
  here. It changes the control's intrinsic height and therefore its behaviour at the 44px minimum.
- **`font-weight` is not named.** The Row entry names `var(--w-bold)` for its primary label; this
  entry names face, size, case, tracking and colour but not weight.
- **Hover transition is unstated.** The entry says the border becomes `--token-accent-hover` and that
  nothing else changes, and forbids `transition: all`. It never says whether `border-color`
  transitions, or over which duration token. `EXPERIENCE.md` § Interaction Primitives gives
  `transition: border-color var(--dur-micro) var(--ease-toggle)` as an illustration of naming
  properties, not as the Control's specification. Three implementations: instant, 120ms, 220ms.
- **The "current" underline has no geometry.** A Control carries a 1px border on all four sides. The
  current state adds "a `var(--stroke-emphasis)` `var(--token-accent)` underline". Is that
  `text-decoration` on the label, a `border-bottom` replacing the box's bottom border, a
  `box-shadow` (forbidden), or a pseudo-element? Does the 1px bottom border remain, producing a 1px
  neutral rule 2px below a 2px accent rule? Nothing decides. This is the state that means "you are
  here" and it appears on every navigation surface in the estate.
- **Focus and the corner rule collide.** § 4's rule sets `border-radius: var(--r-hair)` on
  `:focus-visible`. This entry's Forbidden list says "Any `border-radius` other than `0`" with no
  focus carve-out, and F-5's verification is "Computed `border-radius` is `0`". One implementer
  applies the focus radius as written; another refuses it as forbidden. See H-8.
- **Disabled is declared not to exist.** "Does not exist at MVP" is a statement about the Hub. A
  books library has a borrow action on a book that is out; a wheel has a spin action with fewer than
  two entries; every native `<button disabled>` in every form. The escape clause ("If a framework
  forces one") makes the existence of a disabled state a per-implementer judgement.

**(c) Unowned judgement calls.**

- "If a framework forces one" (disabled). No definition of "forces", no arbiter.
- Whether a given element is a Control at all. The definition lists a button, a link styled as a
  button, a disclosure trigger, a tab and a form submit. A nav link, a live link and a source link
  are all things a person activates and none is on that list, and none has an entry of its own. See
  C-2 and C-9.

---

## 2. Row

**(a) Convergence: no, and by the widest margin of any entry.** The desktop layout is not given at
all.

**(b) Underspecified.**

- **The 760px column layout is named and never specified.** The entry says the row "gains columns"
  and stops. `EXPERIENCE.md` § Responsive adds one sentence: name and metadata left, description and
  links centre, status right. There is no `grid-template-columns`, no column widths or fractions, no
  column gap, no vertical alignment, no rule for what happens to the columns when a cell is empty,
  and no statement of whether the mechanism is Grid or Flex. Three implementations produce
  `1fr 2fr auto`, `220px 1fr 120px` and a flex row with `margin-left: auto` on the status. All three
  satisfy every word written. This is Critical finding C-1.
- **No breakpoint token exists.** 760px is a literal in two documents and in five future codebases.
  The contract carries no `--bp-*` scale. `EXPERIENCE.md` § Component Patterns also uses `<768px`
  for the Home surface stack, so the estate already has two breakpoints eight pixels apart with no
  statement of whether that is deliberate.
- **The row has no inline padding value.** Only `padding-block` is given. Whether row content is
  flush to `--page-pad` or inset determines whether the separator (which "runs the content width")
  is flush or inset, which determines whether successive separators align down the page, which is the
  stated reason the rule exists.
- **No internal gaps.** The gap between the primary label, the secondary text, the metadata and the
  status is never given, at any width. Only the Control entry gives a sibling gap, and only for two
  targets on one line.
- **Which separator treatment is never named.** § 3 offers Hairline (`--token-border`, `#282830`) and
  Boundary (`--token-border-interactive`, `#656471`). The Row entry says only "A separator (§ 3)". A
  row carries links a person can act on, so Boundary is a defensible reading; `DESIGN.md` § Registry
  Entry says hairline. The two tokens are 1.39:1 and 3.52:1 on paper, a 2.5x difference in visual
  weight on every row of every list in the estate. This is High finding H-3.
- **How the separator attaches is never stated.** `border-bottom` on every row but the last,
  `border-top` on every row but the first, a `<hr>`, or a pseudo-element. The containment rule ("The
  last member inside a container drops its bottom separator") implies `border-bottom`, but implies is
  not states. Whether the list is bookended (a rule above the first row, below the last) is not
  stated either. Two implementations differ by two visible rules per list.
- **Status placement at 360px is undefined.** "Hangs right" is given without a width qualifier.
  `EXPERIENCE.md` puts status right at 760px and above. At 360px, with a long primary label, the
  status either shares the line and forces the label to wrap, or drops below. A-5 forbids truncation,
  so ellipsis is out, but nothing says what is in.
- **Metadata size is an explicit unowned choice.** "`var(--t-3xs)` or `var(--t-2xs)`". The file's own
  rule is that an entry permitting a judgement names who makes it. This one does not.
  `DESIGN.md` § Registry Entry resolves it for the Hub (tech at `--t-3xs`, links at `--t-2xs`) and the
  generalisation loses that.
- **Primary label colour and line-height are not named.** Face, width axis, weight, size, tracking
  and case are given; colour and line-height are not.
- **Grid or Flex is contradicted upstream.** `DESIGN.md` § Layout says "CSS Grid for page structure,
  Flexbox inside components". `DESIGN.md` § Components calls the Registry Entry "a grid row". A row is
  a component, so the two sentences disagree and the Row entry inherits the disagreement.

**(c) Unowned judgement calls.**

- "a denser list may go to `var(--s-sm)`". No criterion for denser, no owner. Over a twenty-row list
  the two readings differ by 160px of page height.
- Containment: permitted "only when the group carries a name and a framing line that a reader needs
  in order to interpret its members". "Needs" is the judgement. A books library's series grouping, a
  tracker's tournament grouping and a match tracker's map grouping all argue for it. The entry names
  the Tracker Family as the estate's one example and names no arbiter for the next one.

**(b) continued, on the check.** "Render the list in greyscale. Every row must read as separate from
its neighbour" has no threshold. `--token-border` is 1.39:1 on paper. Whether 1.39:1 "reads as
separate" is exactly the question two reviewers answer differently, and it interacts with the
unnamed separator token above.

---

## 3. Separator

**(a) Convergence: partial.** The four treatments are unambiguous as values. Placement, attachment
and the verification are not.

**(b) Underspecified.**

- **The entry's own count is wrong.** "Three widths exist in this system and no fourth is minted",
  followed by a table of four treatments spanning two widths (1px for Hairline, Boundary and Dashed;
  `--stroke-emphasis` 2px for Emphasis). A reader who trusts the sentence will look for a third
  width and will find `--stroke-focus` (2px) or `--focus-offset` (3px) and mint something.
- **"Runs the content width of its container, not the padded width" is undecidable** while the Row
  entry gives no inline padding. If the row has no inline padding, content width and padded width are
  the same and the sentence is inert; if it does, the separator is inset by an unstated amount. The
  stated purpose (successive separators align down the page) is satisfied by both readings only if
  every row uses the same inline padding, which nothing requires.
- **Attachment side is never stated.** See Row.
- **No rule for a separator inside the containment box.** The Tracker Family group has a 1px border
  on four sides and presumably inline padding. Whether member separators run the container's content
  width (inset from the box edge) or its full inner width (touching the box edge) changes the drawn
  result visibly, and both readings are consistent with the sentence.

**(b) continued, on the check.** "Sample the rendered pixel colour of any rule and compare it to the
computed value of `--token-border`. They match exactly, on every ground the rule appears over."

This check is wrong for three of the four treatments it sits under. Boundary and Dashed resolve to
`--token-border-interactive`; Emphasis resolves to `--token-accent`. An implementer running the check
literally against a Boundary rule gets a mismatch and records a defect that is not one.

It is also unrunnable as stated on the primary target device. At a fractional device pixel ratio
(1.5x and 2.75x are both common on Android, and NFR-5 names the phone as the primary surface) a 1px
CSS rule is rasterised across two device pixels with antialiasing, and no sampled pixel matches the
computed value exactly. A correct implementation fails the check on Daniela's device and passes it on
a 1x desktop monitor. The check needs a stated tolerance, a stated DPR, or replacement with a
computed-style assertion.

**(c) Unowned judgement calls.** Which of the four treatments a given divider takes, everywhere
except the two the table pins (Emphasis to current route and active underline; Dashed to one status
value).

---

## 4. Focus treatment

**(a) Convergence: no.** The rule as written will apply in some frameworks and silently fail to
apply in others, and it contradicts two other rules in the same file.

**(b) Underspecified.**

- **`border-radius: var(--r-hair)` contradicts § 1 and F-5.** The snippet sets a 2px radius on the
  focused element. § 1 Forbidden says "Any `border-radius` other than `0`". F-5's verification is
  "Computed `border-radius` is `0`" on every control. There is no CSS property that rounds an outline
  without rounding the element, so the snippet is a real change to the element's computed radius
  while focused. Two implementers: one applies it and produces a subtly rounded box on focus that
  fails F-5 if F-5 is run while focused; one refuses it and produces a hard-cornered ring. Both cite
  the file.
- **The selector has no scope, no specificity guidance and no layer guidance.** A bare
  `:focus-visible` has specificity (0,1,0). In Angular Material it loses to `.mat-mdc-button:focus`
  and `.mdc-button` internals; in daisyUI it loses to `.btn:focus-visible`; in a project using
  Tailwind's preflight inside `@layer base` a global rule authored outside a layer wins, and one
  authored inside `@layer base` loses. The entry says resets "must reinstate it explicitly" and names
  no mechanism. Three implementations: `*:focus-visible` unlayered, `:focus-visible` inside a base
  layer that never wins, and `:focus-visible { outline: ... !important }`. The visible result is that
  some elements ring and some do not, per framework, which is the exact seam (S-2) this section is
  named as the highest-value fix for.
- **`outline-offset: 3px` and clipping.** A positive offset paints outside the border box. Inside any
  ancestor with `overflow: hidden` (common in a framework's own component internals) the ring is
  clipped on one or more sides. The entry does not mention it; `DESIGN.md`'s global
  `overflow-x: clip` covers the page and not a component.
- **Nothing says what is focusable.** The entry specifies the ring and never says which elements must
  be reachable, which is what F-6 then checks ("every interactive element").

**(b) continued, on the internal contradiction with the scrim.** This entry states that over the
scrim the focus ring computes to 3.53:1 and "clears the 3:1 non-text floor", presented as a
permission. The scrim section states that no interactive element may sit on a scrim. If the second
rule holds, the first can never occur. An implementer reading § 4 first will conclude that a focusable
element over a scrim is contemplated and permitted, and will place the skip control there. The same
row appears in `DESIGN.md` § The scrim, so both spines carry it.

**(b) continued, on the check.** "Screenshot the moment focus lands" is not a reproducible procedure.
A human cannot distinguish an instant ring from a 60ms ring by screenshot timing, and the failure the
rule targets (a 200ms fade) is detectable by eye only if the observer knows to look. A computed-style
assertion that `transition-property` contains neither `outline`, `outline-color` nor `box-shadow` is
mechanical, framework-neutral and takes one line.

**(c) Unowned judgement calls.** "Never removed without an equivalent replacement" leaves
"equivalent" undefined and unowned. A 2px `box-shadow` ring is a plausible equivalent and is also
forbidden elsewhere.

---

## 5. Status affordance

**(a) Convergence: no.** The single most visible atom in the system, the `Live` dot, is a square in
two documents and a circle in the third.

**(b) Underspecified.**

- **The dot is a square and a circle.** This entry: "4px square at `var(--r-pill)`".
  `--r-pill` is 999px, so a 4px square at that radius renders as a circle. `DESIGN.md` § Colors says
  "4px filled square". `EXPERIENCE.md` § Inspiration says the system's only glyphs are "an arrow, an
  external-navigation mark and a 4px square". `DESIGN.md` § Shapes assigns `--r-pill` to "The 4px
  `Live` dot", which supports the circle. An Elixir developer renders a square, a Svelte developer
  renders a circle, and the element in question is described by `EXPERIENCE.md` as "the taxonomy's
  load-bearing element, not an ornament".
- **The dot's position and gap are not given.** Leading or trailing relative to the word, and how far
  from it. Both readings are common in the wild.
- **For a Satellite's own vocabulary, the border token is not given.** The property table says
  "Border: `1px`, square, per the value's structural treatment" and never names a colour role. The
  estate's four values get theirs from `DESIGN.md` § Colors. An application inventing its own four
  states has three candidate tokens and no instruction. Three implementations use `--token-border`,
  `--token-border-interactive` and `--token-accent`, differing by 1.39:1, 3.52:1 and 6.20:1.
- **Text colour is not given either**, for the same reason and with the same consequence.
- **The property table asserts a border that rule 2 makes optional.** "Border: `1px`" in the table,
  "a border present or absent" in the rules, and `Archived` in `DESIGN.md` has none.
- **`Archived` has no border, and its box alignment is undefined.** Padding is specified for the type
  generally. A borderless mark with the same padding sits 1px inward relative to a bordered sibling
  in a column of marks. Whether padding is retained is not stated, and the column visibly misaligns
  under one reading.
- **The discipline does not scale past four values.** "The available structural axes are" enumerates
  exactly three binary axes and the entry states that they carry four values. A Counter-Strike match
  tracker plausibly renders Upcoming, Live, Halftime, Finished and Forfeited. The entry gives no
  extension rule, no procedure for minting a fourth axis, and no owner for the decision, while stating
  that the available axes are the three named. An application with five states must either violate the
  entry or collapse its domain.
- **Line-height is not given.**

**(c) Unowned judgement calls.**

- "At most one value earns accent, and it is the one that means actionable right now." In a match
  tracker, is that the live match (watch it now) or the upcoming one (register now)? No arbiter.
- The greyscale check itself: see below.

**(b) continued, on the check.** "Hand the image to someone with no legend. They can tell all values
apart." Three problems. It requires a second person, in a document whose premise is one maintainer
implementing alone across eight repositories. It has no pass threshold: "can tell all values apart"
under what conditions, at what size, in how long. And it is not repeatable, so Story 8.4's per
application SM-12 evidence rests on an unrepeatable subjective judgement by an unnamed observer. F-9
inherits all three problems.

---

## 6. Heading

**(a) Convergence: no.** Bricolage Grotesque's optical-size axis is omitted, and the entry's own
table violates the entry's own Forbidden line.

**(b) Underspecified.**

- **The `opsz` axis is omitted.** `DESIGN.md`'s typography block sets
  `"wdth" 100, "opsz" 48` for display and `"wdth" 85, "opsz" 24` for secondary display. This entry
  names only `wdth`. Bricolage Grotesque is a variable face with a live optical-size axis; the same
  string at `--t-display` renders with visibly different letterform proportions and apparent weight at
  `opsz` default versus `opsz` 48. The display line is the largest element on every page in the
  estate. Three implementations that each set `wdth` correctly still differ.
- **The table's third row violates the entry's Forbidden line.** The table sets Row name at
  `var(--t-base)` (16px). Forbidden includes "a heading below `var(--t-md)`" (20px). One implementer
  follows the table and sets row names at 16px; another follows the prohibition and sets them at 20px.
  Every row of every list differs by 4px.
- **Colour is not given for any level.**
- **There is no slot for a secondary display line.** `--t-xl` is documented in `DESIGN.md` as
  "Secondary display" and this table has three levels, none of which is it. An application whose
  detail page has a title that is not the one display line has no specification.
- **Heading margins are not given, anywhere in any document.** `DESIGN.md` § Layout states only that
  "Section padding varies. Uniform vertical rhythm across every section is a tell." That is an
  instruction to diverge, with no range and no owner. Combined with the missing heading margins, the
  vertical rhythm of every page in the estate is invented per implementer. This is the largest
  cumulative visual divergence in the system and it is the one the file deliberately leaves open.

**(c) Unowned judgement calls.**

- "The visual level and the semantic level are chosen independently and both are stated." Stated by
  whom, in what artifact? No mechanism, no record, no owner. Two implementers of the same surface
  choose different semantic levels and both comply.
- Section padding, per above.

**(b) continued, on the check.** "Run the document outline." The HTML5 outline algorithm was never
implemented by any browser and was removed from the specification. There is no built-in way to run
it. Tooling exists (headingsMap, axe, the HTML validator's outline view) and the entry names none, so
three people run three different tools with three different behaviours on `<section>` nesting.

---

## 7. Label

**(a) Convergence: no.** The colour conflicts with `DESIGN.md`, the rule geometry has no values, and
one variant requires each implementer to invent content.

**(b) Underspecified.**

- **The colour conflicts with `DESIGN.md`.** This entry gives `--token-text-secondary` with no
  variants. `DESIGN.md` § Components specifies the Tracker Family group label as "mono `--t-3xs`
  `+0.14em` uppercase in `--token-accent`". A group label is a Plate mark by every description in both
  files, so the folded component has an accent variant in one document and no accent variant in the
  other. `DESIGN.md` wins on values, which means the Label entry is wrong as written and an
  implementer working from the vocabulary alone (the stated audience) will not know it.
- **The two-corner placement is lost.** `DESIGN.md` § Components: "Section identity in the top-left,
  position or domain top-right." The Label entry's Section variant describes one label above a section
  head. An implementer from `DESIGN.md` renders a pair; an implementer from the vocabulary renders one.
- **The rule geometry has no values.** For the Section and Annotated variants the rule sits "beneath"
  the label. How far beneath: no `padding-block`, no margin, no gap. For Side-ruled,
  `padding-inline-start: var(--s-sm)` is given and the rule's own width is not (1px by the property
  table, but nothing says whether the rule spans the label's height, the content's height, or both).
  Three implementations differ in how tightly the label sits on its rule, on every section head.
- **The subordinate line must be invented per application.** It is required to be `aria-hidden`
  always and is "ornament only", and "A subordinate line that carries information is a defect". So the
  Annotated variant requires a string that means nothing, has no source, and is invisible to assistive
  technology. Five implementers invent five different decorative strings, and the file elsewhere bans
  exactly this pattern ("Never invent a metric to fill a slot"). Either the variant needs a stated
  source for its content or it should not exist.
- **Line-height is not given.**

**(c) Unowned judgement calls.**

- "Mirrors to the trailing edge when the label is end-aligned." Who decides end-alignment.
- "labels appear only where a genuine ordinal or domain exists". "Genuine" is the judgement; the
  anti-pattern it guards against (an eyebrow on every section) is real, and the boundary is unowned.

**(b) continued, on the check.** "Turn off CSS. Every label still reads as a short uppercase string."
With CSS off, `text-transform: uppercase` is gone. For the label to still read as uppercase, the text
must be authored uppercase in the markup. Nothing in either document states that, `DESIGN.md`
elsewhere describes uppercase as a styling decision ("Uppercase is structural, not emphatic"), and
authored uppercase has a known cost with screen readers that spell out short capitalised strings. The
check silently mandates a markup decision the entry never makes, and it mandates the one that conflicts
with the rest of the system. Two implementers author case differently and one fails a check they had
no way to anticipate.

---

## 8. Empty edge

**(a) Convergence: no.** The routing question (omit versus one line) is a judgement with no owner,
and two of the five treatments conflict with the ceiling.

**(b) Underspecified.**

- **The distinguishing test is not testable from the entry.** Row 2 is "a list that cannot be empty
  by construction" and row 3 is "a list that genuinely can be empty". The difference is a property of
  the data model, not of the surface, and nothing says who asserts it or where it is recorded. A books
  library with zero books: is that a construction guarantee (a library always has books) or a genuine
  empty (a fresh install has none)? One implementer renders nothing, one renders a line. Visibly
  different on the first run of the application.
- **The mandated empty line is new copy, which the ceiling forbids.** Row 3 requires "One line of
  `var(--token-text-secondary)` at `var(--t-sm)`". Writing that line is microcopy, and the ceiling's
  final row says "**Microcopy.** Copy stays exactly as it is." A restyle that adds an empty-state
  sentence violates the ceiling; one that does not violates § 8.
- **Removing a placeholder is a field disappearing.** Row 5 requires that an absent value not render,
  "Never a placeholder, never a dash, never `N/A`". An application that renders `N/A` today must stop.
  The ceiling's out-of-scope column lists "A field disappearing". Same collision.
- **The empty line's own geometry is not given.** "occupying the same grid position a row would" fixes
  its column and nothing else. Padding-block, whether separators are drawn above and below it, and
  what it does in the 760px column layout are all open.
- **No loading or pending state exists anywhere in the vocabulary.** § 8 covers empty and error, not
  pending. `EXPERIENCE.md`'s "No skeletons" is scoped to the Hub and justified by static rendering. A
  Phoenix LiveView match tracker updates in place, a library search is asynchronous, and a wheel spins.
  All three render a pending state today and the vocabulary specifies none. See C-3 and H-28.
- **The error surface's exit rule produces a dead end for some applications.** "exactly the exits the
  application's header already carries. Never more exits than the header, never fewer." An application
  whose header carries no exits gets an error surface with no way out, and the rule forbids adding one.

**(c) Unowned judgement calls.** The construction guarantee, per above. Also "An error surface" gives
no rule for which errors (404, 500, a failed fetch inside a rendered page) take it.

**(b) continued, on the check.** "Force each list to zero items." For a list that cannot be empty by
construction, forcing it to zero is either impossible without editing data, or it is the defect the
entry says must not be dressed as a state. The check and the treatment describe incompatible actions.

---

# Part 2: the floor

## Are F-1 to F-11 unambiguously pass or fail?

| # | Verdict | Why |
|---|---|---|
| F-1 | **Partly** | The pass criterion is clear. The method verifies half of it. |
| F-2 | **No** | The method structurally cannot detect the failure it targets. Critical, C-6. |
| F-3 | **No** | Contradicts the 2px Emphasis separator. The method samples one rule to prove a universal. |
| F-4 | **No** | The method (rest screenshot) cannot detect the hover fill the spec itself names as how this check fails. |
| F-5 | **No** | Contradicts § 4's focus radius. |
| F-6 | **Partly** | Traversal proves a ring exists; it cannot prove instant, and cannot reach state-gated elements. |
| F-7 | **No** | The grep has no defined scope; a passing application's bundle still contains library shadows. |
| F-8 | **No** | A numeric threshold verified by eyeball, with the accent set, the state, the viewport and the area metric all undefined. |
| F-9 | **No** | Subjective, no threshold, requires a naive second observer. |
| F-10 | **Yes, mostly** | The strongest check on the list. Needs a sampling rule and a note on hit area versus border box. |
| F-11 | **No** | "`::selection` from the accent" never says background or foreground; the two answers differ in contrast and in F-8 compliance. |

Two checks pass cleanly, F-10 and (with a method fix) F-1.

## F-8 in detail, since it was singled out

Agreed, and it is the weakest check on the list. It is stated as a precise numeric threshold and
verified by a method whose error bar is an order of magnitude wider than the threshold.

What is undefined:

- **Which colours count as accent.** `--c-accent` only, or also `--c-accent-bright` (present whenever
  anything is hovered), `--c-accent-quiet` (the framework band, which is a wide horizontal element),
  and `--c-focus` (present whenever anything is focused).
- **Which state.** At rest with nothing hovered or focused, or in any reachable state. A single
  hovered link changes the accent-bright area; a text selection painted in accent changes it by
  orders of magnitude.
- **Which viewport.** "any viewport" implies all of them; the practical set is undefined. The
  framework band and the display line scale differently with width, so the percentage is not monotonic.
- **What the denominator is.** The visible viewport, or the full scrollable document. The two differ
  by a factor of five to ten on a long page, and the same design passes one and fails the other.
- **What counts as an accent pixel.** Exact sRGB match, or within some tolerance. A 1px accent rule at
  a fractional DPR is mostly antialiased blend pixels that are not the token value, so an exact-match
  count systematically under-reports and a tolerance-based count needs a tolerance nobody has stated.

And "eyeball" cannot resolve 2.8% from 3.2%. Human area estimation for thin scattered strokes on a
dark ground has a documented error far larger than the 3% threshold itself, and it is biased upward by
saliency, which is the whole point of a highlighter.

**What would fix it.** Two options, and the second is the better one.

1. **Make it computational.** Render each in-floor surface at 360px and at 1280px, at rest, with
   nothing hovered or focused, capturing the full document. Count pixels within a stated colour
   distance (for example dE2000 under 5) of `#8f7ef0` and `#ada1ff`. Divide by total pixels. Assert
   under 0.03. That is roughly twenty lines of script, it is repeatable, it produces a number Story
   8.4 can record, and two people running it get the same answer.
2. **Replace the percentage with the structural rule it is a proxy for.** The intent is
   "accent never appears as a filled region". State that instead: accent may appear only as a stroke
   of at most `--stroke-emphasis`, as the 4px dot, or as text. Any painted accent region larger than
   4 by 4 pixels is a defect. That is checkable by inspecting computed `background-color` across the
   DOM and by grepping for accent on a `background` property, it needs no screenshot, and it is what
   the rule actually means. The 3% figure can stay in `DESIGN.md` as the design intent it is.

Keeping both is fine. Keeping only the eyeball is not.

## What the floor does not check at all

None of F-1 to F-11 tests the Row's geometry, the Heading scale, the Label variants, the Separator
placement, the Control's padding or the Status mark's structure. The eleven checks are a
token-adoption floor with three restyle checks bolted on (F-4, F-8, F-9). An application can pass all
eleven while rendering rows in a completely different column layout, headings at a different scale and
controls at a different height from every sibling. Since the file's entire thesis is that a written
vocabulary is what stops five hand-authored implementations from drifting, the floor tests the wrong
thing. This is C-5.

## Scope

The floor's scope is "every surface a Visitor can reach without authenticating", which is stated as
deliberately checkable from outside. That is a good boundary. It is also not enumerable today: O-14 is
open and records that nobody has determined which surfaces of each wave-1 Satellite are
unauthenticated. Until it closes, no application's floor has a denominator and Story 8.4 has nothing
to record against. Related: `cs-tracker`'s primary surface is a match scoreboard, which is dense data
UI and therefore explicitly below the floor (S-6), so the restyle may reach very little of the
application that the daisyUI test was written for.

---

# Part 3: the ceiling

## Is "never reorder what a reader encounters" self-contradictory in practice?

Yes, and the collision is not a corner case. It is the default outcome of the permitted operation.

**The mechanism.** The ceiling permits "Card markup rewritten as row markup" and forbids "The order a
reader encounters information in". The Row entry then prescribes an order: primary label, secondary
text, metadata, with status hanging right. `EXPERIENCE.md` § Registry Entry is more explicit still:
"Reading order serves Daniela: name, status, description, tech, links."

A typical existing card, in any of the five frameworks, renders as image, then title, then
description, then tags, then a status badge, then links. Bringing that card onto the vocabulary
requires the status to move from sixth to second. That is a change to the order a reader encounters
information in, which the ceiling forbids.

The implementer has three exits and each breaks a different rule:

1. **Move the status in the DOM.** Violates the ceiling explicitly.
2. **Leave the DOM alone and move the status visually** with `order`, `grid-area` or
   `margin-left: auto`. This satisfies the letter of the ceiling and produces a visual order that
   differs from the DOM order, which is a reading-order change for every sighted reader and a WCAG
   1.3.2 meaningful-sequence risk. It also means the tab order (`EXPERIENCE.md`: live link, then
   source link) no longer matches the visual arrangement.
3. **Leave both alone and do not adopt the Row entry.** The application does not join the vocabulary,
   which is the failure the whole file exists to prevent.

There is no fourth option, and the ceiling names none. **An implementer must violate one rule to
satisfy another**, and which one they violate is not decided by either document. Two implementers of
the same conversion produce two different DOM structures with two different tab orders. This is C-8.

**A second, sharper instance in the same table.** The Permitted column includes "A wrapper added to
reach a 44px target". The Row entry says targets are "on the element itself and never on a wrapper".
The ceiling permits the exact construction the vocabulary forbids, in two sections of the same file.
This is H-24.

**A third.** The Permitted column includes "A framework component class replaced with plain markup".
For family B (Angular Material, PrimeNG, Vuetify) the unit is a component, not a class, and replacing
`mat-expansion-panel` or `p-dropdown` with plain markup removes behaviour: keyboard models, ARIA
wiring, dismissal. The ceiling's headline is "presentation only, never behaviour". The
component-library section names that replacement as the **preferred** route for family B. The two
sections give opposite instructions for the same edit. This is H-26.

**A fourth, quieter.** The ceiling does not mention semantics. A-8 requires the Suite Directory to be
a `<ul>` of entries. Converting a `<div class="card">` grid into a `<ul>` of `<li>` rows changes the
accessibility tree, which is neither presentation nor behaviour and is therefore neither permitted nor
forbidden. Two implementers make opposite calls.

---

# Part 4: cross-document conflicts

The precedence model is: `DESIGN.md` wins over `RESTYLE-SPEC.md` "on any value", `EXPERIENCE.md` wins
"on any question of behaviour", and `RESTYLE-SPEC.md` states that "Both spines win on conflict with
this file" without qualification. Findings below are places where the spec **contradicts** a spine
rather than restating it.

**A note on the precedence model itself.** `RESTYLE-SPEC.md` claims to own geometry ("Everything below
is stated as a value, a geometry or a check"). The two spines claim values and behaviour. A pure
geometry conflict, for example which side a separator attaches to or what the 760px column template
is, falls to nobody, and `RESTYLE-SPEC.md`'s unqualified deference means a spine can win a question it
disclaims. There is no total order and no named arbiter. This is H-31, and it matters because the
conflicts below are resolved differently depending on which sentence a reader trusts.

## Control versus `DESIGN.md` § Button, § Nav and § Links

The Control entry defines its scope as "Anything a person activates" and then mandates
`1px solid var(--token-border-interactive)` **on all four sides**.

`DESIGN.md` § Nav specifies nav links as "two mono uppercase links" with a current-route underline and
no box. `DESIGN.md` § Links specifies the live link as `--token-text` with an accent underline and the
source link as `--token-text-secondary` with a neutral underline, both unboxed. `DESIGN.md` § Button
is the only boxed control.

So the vocabulary's Control entry, read as written by its stated audience (five framework developers
implementing from it), boxes every nav link and every list link in the estate. `DESIGN.md` wins on
values, so the correct result is unboxed, but nothing in `RESTYLE-SPEC.md` tells the reader that, and
`DESIGN.md`'s Nav entry is written about the Hub's nav rather than as a general rule. This is the most
visible single divergence available and it is C-9.

Related: `DESIGN.md` specifies tech chips as outlined, `1px solid var(--token-border-interactive)`, no
ground, mono `--t-3xs`, square, **and not interactive, taking no target floor**. Under § 1 a tech chip
is visually indistinguishable from a Control. Nothing in the vocabulary distinguishes them, so one
implementer gives chips a 44px minimum height (wrecking the row's vertical rhythm) and one does not.

## Label versus `DESIGN.md` § Plate mark

Two conflicts, both covered in Part 1 § 7: the accent colour of the Tracker Family group label, which
the Label entry has no variant for; and the top-left / top-right placement pair, which the Label entry
drops. Both are values, so `DESIGN.md` wins and `RESTYLE-SPEC.md` is wrong as written.

## Status affordance versus `DESIGN.md` § Colors

Three conflicts:

1. **The dot's shape.** Square in `DESIGN.md` and `EXPERIENCE.md`, `--r-pill` (a circle) in
   `RESTYLE-SPEC.md`. Covered as H-11.
2. **The border's existence.** The `RESTYLE-SPEC.md` property table asserts "Border: `1px`" for the
   type; `DESIGN.md` gives `Archived` no border, and `RESTYLE-SPEC.md`'s own rule 2 lists border
   presence as a structural axis. The table contradicts the rule two paragraphs above it.
3. **The token roles are absent from `RESTYLE-SPEC.md`.** Not a contradiction, an omission, but it is
   the one that bites a Satellite defining its own vocabulary, since it has no `DESIGN.md` table to
   fall back on.

## Row versus `DESIGN.md` § Registry Entry

Two conflicts:

1. **Metadata size.** `DESIGN.md` pins tech to `--t-3xs` and links to `--t-2xs`; `RESTYLE-SPEC.md`
   offers either for all metadata. The generalisation loses a decision `DESIGN.md` had already made.
2. **Grid or Flex.** `DESIGN.md` § Components calls the Registry Entry "a grid row";
   `DESIGN.md` § Layout says "Flexbox inside components". Inherited by the Row entry, which says
   neither.

## The floor versus the vocabulary

- **F-3 versus § 3.** F-3 requires "Every divider is a 1px opaque hairline at a token value". The
  Emphasis separator is `--stroke-emphasis`, 2px, and it is a divider by placement (an underline
  beneath a current route). An application that correctly implements the current-route treatment fails
  F-3 as written. H-7.
- **F-5 versus § 4.** F-5 requires computed `border-radius` of `0` on every control; § 4 sets
  `var(--r-hair)` on `:focus-visible`. H-8.
- **F-8 versus F-11.** F-11 requires `::selection` "from the accent". If accent is the selection
  background, then selecting a paragraph paints a large accent fill, which F-8 forbids in the same
  table ("never a background fill") and which blows the 3% budget instantly. If accent is the
  selection foreground, `--c-accent` on `--c-paper` is 6.20:1 and fine, but nothing says which.
  Additionally, `DESIGN.md` § Rules enumerates where accent appears ("link underlines, the `Live`
  mark, the active nav rule, and nothing else") and `::selection` is not on that list, so the
  mandatory hand-fix is excluded by the rule it is supposed to satisfy. H-23.
- **F-10 versus the Row's dense-list allowance.** A denser list may use
  `padding-block: var(--s-sm)` (12px). With a 16px line that is a 40px row. A 44px target inside a
  40px row extends 2px beyond it top and bottom, so the targets of adjacent rows overlap vertically by
  4px. The system's only overlap rule is the Control's horizontal sibling gap of `--s-lg`, which does
  not address this. One implementer keeps 44px targets and accepts overlapping hit areas; another
  raises the row padding and abandons the dense-list allowance. H-22.

## The scrim versus § 4 and versus `EXPERIENCE.md`

Covered in Part 6. The `RESTYLE-SPEC.md` scrim code block also declares `--token-scrim` as a literal
`oklch(...)` value, whereas `DESIGN.md`'s contract declares `--c-scrim` and aliases
`--token-scrim: var(--c-scrim)`. An implementer copying the `RESTYLE-SPEC.md` block into a Satellite
writes a raw alpha literal outside `contracts/`, which is exactly what Story 2.34's FR-17 grep is
specified to reject. The file's own code block fails the file's own gate. H-32.

---

# Part 5: the component-library section

## Is the family assignment decidable without asking someone?

**No, for a large and common class of stacks.**

The taxonomy is A (utility-first with a component plugin), B (an opinionated component framework), C
(none). Real stacks that do not land cleanly:

- **shadcn/ui and its ports** (shadcn-svelte, shadcn-vue). Utility-first, no plugin, components are
  copied source files in the repository. Family A's strategy ("stop using the plugin's component
  classes") finds nothing to grep, because there are no component classes. Family C's premise
  ("nothing to displace") is false, because the copied components ship rounded corners, filled
  variants and their own focus rings. This is currently the most common way to build a Svelte or Vue
  application, and `digital-library` is a SvelteKit application whose stack is **assumed** family C and
  explicitly not verified (O-15).
- **Headless libraries** (Radix, Headless UI, Melt, Ark). Behaviour without styling. Family B's
  encapsulation reasoning does not apply, family A's grep does not apply, and family C's "nothing to
  displace" is true for styling and false for the markup structure they impose.
- **Bootstrap.** Utility classes and component classes in the same stylesheet with no plugin boundary.
  Both A and B are defensible.
- **CSS-in-JS component kits** (Mantine, Chakra, MUI). Family B by intent, but "a global stylesheet
  does not reach in" is wrong for the reason stated in the entry itself, and the actual obstacle
  (runtime-injected styles with higher specificity, or emotion's insertion order) is not the one named.

No arbiter is named for an ambiguous case, and Story 8.4 records "Framework family: A, B or C" as if
it were a fact rather than a call. H-25.

**Verification has no method either.** "Every application below is verified first: what is actually
installed is checked before the strategy is chosen." Checked how. A `package.json` inspection misses
Phoenix's vendored daisyUI entirely, which `DESIGN.md` documents as a committed
`vendor/daisyui` loaded by `@plugin` with no package manifest. The one application whose stack is
confirmed is the one where the obvious method would have failed.

## Is family B's guidance actionable?

**Route 1 is actionable and collides with the ceiling.** "Do not use the framework's components on
surfaces inside the floor" is concrete, and for a control, a row and a label it is genuinely cheap.
For any component carrying behaviour it is a behaviour change, which the ceiling forbids and which the
same table calls out of scope ("A new interaction, a new control"). The section marks route 1
**preferred**, so the preferred route is the one the ceiling prohibits. H-26.

**Route 2 defers the entire problem.** "Drive it through the framework's own theming API, mapping to
token roles, and then verify every one of F-1 to F-11 against the rendered component."

That is a description of a goal, not a strategy. Angular Material's theming system takes palettes and
typography configs through Sass mixins; the per-component surface that would actually be needed here
is the `--mat-*` and `--mdc-*` custom property layer, which the section does not mention. There is no
palette input for "unfilled" and none for "square", so the section's own escape hatch ("A theming API
that has no input for unfilled or square is telling you route 1 was correct") fires immediately for
Material, which returns the implementer to a route the ceiling forbids.

The asymmetry is the real problem. **Family A gets a countable list before a line is written. Family B
gets no count, no unit of work and no cost bound.** `list-wheel` is assumed family B and unverified.
So the claim that the section makes Story 8.1 bounded holds only for the one application whose stack
is already confirmed.

## Attacking the "bounded by a grep" claim

The claim: "the scope is a grep for the plugin's component class names across the surfaces inside the
floor, and that grep returns a countable list before a line is written."

Countable is not the same as bounded, and the grep is not complete. Seven things it does not capture:

1. **Most of daisyUI.** The section names six classes: `btn`, `card`, `badge`, `alert`, `menu`,
   `navbar`, "and their modifiers". daisyUI ships on the order of sixty components. Absent from the
   list and present in any real Phoenix application: `input`, `input-bordered`, `select`, `checkbox`,
   `radio`, `toggle`, `range`, `textarea`, `file-input`, `tabs`, `tab`, `table`, `divider`, `drawer`,
   `dropdown`, `modal`, `collapse`, `join`, `stat`, `steps`, `breadcrumbs`, `progress`, `loading`,
   `tooltip`, `avatar`, `indicator`, `hero`, `footer`, `link`, `chat`, `timeline`. A grep built from
   the six named classes returns a count that is confidently wrong, and "and their modifiers" does not
   repair it because the missing items are base classes, not modifiers.
2. **`core_components.ex`.** The section names this itself, in the same subsection, and then still
   claims the grep bounds the story. That module is where `<.button>`, `<.input>`, `<.simple_form>`,
   `<.table>`, `<.flash>` and `<.modal>` live, it is generated per application and edited in place, and
   it is not reachable by a class-name grep. The section's own warning contradicts its own boundedness
   claim two paragraphs earlier.
3. **Interpolated and computed class names.** `class={"btn btn-#{@variant}"}`,
   `class={button_class(@kind)}`, and any helper that assembles class strings. A literal grep for `btn`
   catches the first and misses the third.
4. **daisyUI's unclassed effects.** The plugin injects theme variables and base-layer rules that
   affect elements carrying no component class, including radius variables and `color-scheme`. Nothing
   with a class name to grep for, and F-5 and F-11 both depend on it.
5. **Which call sites are inside the floor.** The grep returns call sites across the repository;
   converting that to a scope requires the route enumeration that O-14 records as open. The count is
   not obtainable today, only after O-14 closes.
6. **The cost per call site is not uniform.** A `btn` is one element and a mechanical substitution. A
   `navbar` or a `menu` is a subtree with behaviour, keyboard handling and ARIA. Counting call sites
   as equal units produces a number that looks like an estimate and is not one. The count bounds the
   number of edits, not the work.
7. **"After is zero on those surfaces" is not verifiable by the same grep** if a class moves into an
   `@apply` block, a helper function or a component attribute default. The before-and-after count can
   reach zero while the rendered output is unchanged.

**Conclusion.** The grep is a useful first instrument and it is not a bound. Making the claim true
needs: the full daisyUI class list rather than six examples, an explicit statement that
`core_components.ex` is a separate and separately-counted work item, a rule for interpolated class
names, and the O-14 route enumeration as a prerequisite rather than a parallel open item. This is H-27.

---

# Part 6: the scrim's practical consequence

The rule under test: **no interactive element sits on a scrim.**

The relevant surface guidance, from `EXPERIENCE.md` § Component Patterns and `DESIGN.md` § The
redesigned Hub surfaces: panels sit in the corners of a grid; where a panel overlaps the canvas a
scrim sits between them and that panel carries no interactive element; nav and contact links "move
clear of the overlap"; at widths below 768px the panels stack in reading order.

**Is that achievable? Not as specified, and the specification quietly requires a layout it does not
give.**

Four separate problems, in increasing order of severity.

**1. "Move clear of the overlap" presumes a region that is not over the canvas, and the canvas has no
stated extent.** If the canvas is full-bleed, which is what the shipping `HomeLayout` does and what
nothing here retires, then every corner of the grid is over it and there is nowhere clear to move to.
Resolving this requires one of: insetting the canvas so a chrome region exists, abandoning the
four-corner overlay, or putting interactive content over the canvas without a scrim (which is worse
than the problem the scrim solves, since the ground is then unknown and unmitigated). The documents
choose none of the three. Notably, the **mobile** answer is fully specified (stack, no overlap), which
demonstrates that the authors knew separation was the answer and did not draw the desktop version of
it. Two implementers produce two different homepages. This is C-7.

**2. The sticky nav is above the scrim and over the canvas at every scroll position.**
`EXPERIENCE.md` § Nav: sticky at `--z-sticky` (200), does not hide on scroll. `DESIGN.md`: the scrim
layer sits at `--z-raised` (10). So the nav, which is entirely interactive, is painted above both the
canvas and the scrim. Either reading fails:

- If the nav is treated as not being "on" the scrim because it is above it, then it is a set of links
  over raw moving imagery, which is the exact condition the scrim exists to prevent.
- If the nav is treated as being over the scrim, the rule forbids it outright.

**3. The nav's own states are unrepresentable over the scrim, by the spec's own arithmetic.** The
current route takes a `--token-accent` underline and hover takes `--token-accent-hover`. Over the
scrim those compute to **1.87:1** and **1.31:1**, and both documents mark both **Forbidden**. So the
Hub's specified nav cannot express "you are here" or hover on the Hub's own homepage. Nothing resolves
this, and it is arithmetic the documents themselves supply.

**4. The skip control is jointly over-constrained.** FR-2 and `EXPERIENCE.md` require it above the
fold on the default path, so that a cold arrival reaches the suite in one interaction. Above the fold
on the default path is the narrative canvas. So the skip control is an interactive element over moving
imagery. It cannot take a scrim (rule 2 forbids interactive elements there), and without one its
contrast is unknown by construction. There is no third option and none is given.

**5. § 4 contradicts the rule directly.** § 4 states that the focus ring over the scrim computes to
3.53:1 and is "Permitted" as a non-text indicator, and `DESIGN.md` § The scrim carries the same row.
If nothing focusable may sit on a scrim, that permission describes an impossible pixel. An implementer
reading § 4 will reasonably conclude that focusable content over a scrim is contemplated and will
place the skip control there. Two implementers, two opposite readings, both citing the file.

**What is actually missing.** One paragraph and one number: the canvas's extent as a fraction of the
viewport at each breakpoint, and a statement of which grid areas are guaranteed not to intersect it.
With those, every problem above resolves mechanically. Without them, Story 2.29 is a constraint with
no specified solution.

**The scrim's own check is also weak.** "Screenshot the composited surface, sample the ground colour
beneath the text, and compute the ratio by hand." The imagery moves, so one screenshot samples one
frame of an unbounded set, and the guarantee that makes the scrim safe is the pure-white worst case
already computed in both documents. The useful check is structural, not photometric: confirm that no
accent, no secondary text and no focusable element falls inside the scrim's bounding box. That is
inspectable in DevTools and it is repeatable.

---

# Findings

## Critical (9)

**C-1. § 2 Row, the 760px column layout.** The entry says the row gains columns and gives no template,
no widths, no gap, no alignment and no breakpoint token, so three implementers produce `1fr 2fr auto`,
fixed pixel columns and a flex row with an auto margin, all fully compliant and all visibly different
on every list surface in the estate.

**C-2. No entry for a plain link.** § 2 and § 5 both depend on "the link's underline" and no entry
specifies a link at rest, so an implementer must choose between boxing every link as a Control, copying
the Hub's live-link treatment (accent, 2px) or its source-link treatment (secondary, 1px neutral), and
the three choices are visibly different on every text surface in every application.

**C-3. No entry for form inputs.** F-5 explicitly checks "every control, container and form field" and
three of the named applications are input-driven (library search, Kindle send, wheel entry list,
tracker filters), yet the vocabulary specifies no input, select, textarea, checkbox, radio or field
label, so the floor tests a component the vocabulary does not define and five implementers invent five
form languages.

**C-4. No entry for images or media, and the row-not-card rule forbids the obvious answer.** A books
library's dominant visual element is cover art and a match tracker renders team and map imagery, but
the vocabulary gives no aspect ratio, no border treatment, no radius rule, no placeholder rule (§ 8
forbids placeholders) and states absolutely that a row "is never a card" at any width, so a cover grid
is unbuildable under the spec and no alternative is offered.

**C-5. The floor never tests the vocabulary's geometry.** F-1 to F-11 check colour, type family, rules,
fills, corners, focus, shadows, accent share, greyscale, target size and `color-scheme`, and not one
checks the Row layout, the Heading scale, the Label variants, the Separator placement or the Control's
box, so two applications can pass all eleven checks and share none of the geometry the vocabulary
exists to federate.

**C-6. F-2's verification method cannot detect the failure it targets.** `getComputedStyle().fontFamily`
returns the declared stack, not the resolved face, so an application whose woff2 files 404 (the failure
`DESIGN.md` warns about twice, in the three-file split and in the `tailwind.css` import note) reports
the identical computed style as one where they loaded, and two implementations pass F-2 while rendering
Bricolage Grotesque and `system-ui` respectively.

**C-7. The Home surface's scrim constraint has no specified solution and collides with the sticky nav.**
The canvas's extent is never stated, so "interactive content moves clear of the overlap" has no
guaranteed destination on a full-bleed canvas; meanwhile the sticky nav at `--z-sticky` sits above the
scrim at `--z-raised` and over the canvas at every scroll position, and its accent underline and hover
compute to 1.87:1 and 1.31:1 over the scrim, both marked Forbidden, so the Hub's own specified nav
cannot express current-route or hover on its own homepage.

**C-8. The ceiling's reordering ban and the Row's prescribed order are jointly unsatisfiable for
card-to-row conversion.** A typical card renders status after description; the Row entry and
`EXPERIENCE.md` both place status second in reading order, so the implementer must either move it in
the DOM (violating "The order a reader encounters information in"), move it visually only (creating a
DOM-versus-visual mismatch and breaking the specified tab order), or not adopt the entry, and no rule
says which.

**C-9. § 1 Control mandates a four-sided border on anything a person activates, contradicting
`DESIGN.md` § Nav and § Links.** The stated audience implements from this file, so a Svelte and an
Angular developer will box every nav link, live link and source link in a 1px `--token-border-interactive`
rectangle while the Anchor renders them unboxed with underlines, which is the most visible possible
divergence and appears on every surface of every application.

## High (26)

**H-1. § 1 Control geometry.** No `padding-block`, no `line-height` and no `min-width` are given, and
the fixed `padding-inline: var(--s-md)` replaces `DESIGN.md`'s instruction to pad until the target
reaches 44px wide, so a short label fails F-10 in one implementation and passes in another.

**H-2. § 1 Control states.** The hover border change has no stated transition (instant, 120ms and 220ms
are all compliant), the "current" underline has no geometry against the mandated bottom border, and
disabled is declared not to exist for domains that demonstrably need it.

**H-3. § 2 Row, which separator.** The entry says "a separator (§ 3)" and § 3 offers Hairline
(`--token-border`, 1.39:1) and Boundary (`--token-border-interactive`, 3.52:1), so two implementations
of the same list differ by a factor of 2.5 in the visual weight of every rule on the page.

**H-4. § 2 Row, internal geometry.** No inline padding, no gaps between the primary label, secondary
text, metadata and status, no attachment side for the separator, no bookend rule, and no statement of
what the status does at 360px when the primary label is long while A-5 forbids truncation.

**H-5. § 3 Separator, the check is wrong for three of four treatments.** "Sample the rendered pixel and
compare it to the computed value of `--token-border`" fails on Boundary, Dashed and Emphasis rules,
which resolve to different tokens, and fails on a correct implementation at any fractional device pixel
ratio because a 1px rule is antialiased across two device pixels.

**H-6. F-3 contradicts § 3.** F-3 requires every divider to be a 1px hairline; the Emphasis separator is
`--stroke-emphasis` (2px) and is a divider by placement, so an application correctly implementing the
current-route underline fails F-3 as written.

**H-7. F-4's method cannot detect the failure the spec names.** The verification is a rest-state
screenshot, and the paragraph immediately below the floor table says F-4 fails because "a component
library's button looks unfilled until you check its `:hover`", so the check is stated alongside its own
refutation.

**H-8. § 4's focus radius contradicts § 1 and F-5.** `border-radius: var(--r-hair)` changes the focused
element's computed radius to 2px while § 1 forbids "any `border-radius` other than `0`" and F-5's
verification is "Computed `border-radius` is `0`", so one implementer applies it and one refuses it.

**H-9. § 4's rule has no selector scope, specificity or layer guidance.** A bare `:focus-visible` at
(0,1,0) loses to `.mat-mdc-button:focus` and `.btn:focus-visible`, so the same rule copied verbatim
produces rings in family C and no rings in family B, which is the exact seam (S-2) this section is
named as the highest-value fix for.

**H-10. § 4 permits focus over the scrim while the scrim section forbids anything focusable there.**
Both documents state the focus ring computes to 3.53:1 over the scrim and is "Permitted", which is only
meaningful if something focusable sits there, so one implementer places the skip control on the scrim
and one does not.

**H-11. § 5's `Live` dot is a circle and a square.** `RESTYLE-SPEC.md` says "4px square at
`var(--r-pill)`" (999px radius, therefore a circle), `DESIGN.md` says "4px filled square" and
`EXPERIENCE.md` calls the system's third glyph "a 4px square", so the taxonomy's load-bearing element
renders differently per implementer, and its position and gap relative to the word are unstated.

**H-12. § 5 gives a Satellite's own state vocabulary no tokens.** The border colour and text colour are
never named for values outside the estate's four, and the three enumerated structural axes carry exactly
four values with no extension rule and no owner, so a match tracker with five states must either
violate the entry or collapse its domain.

**H-13. § 6 omits the `opsz` axis.** `DESIGN.md` sets `"opsz" 48` for display and `"opsz" 24` for
secondary display; the Heading table names only `wdth`, so three correct implementations render the
largest element on every page with visibly different letterform proportions.

**H-14. § 6's own table violates its own Forbidden line.** The table sets Row name at `var(--t-base)`
(16px) while the same entry forbids "a heading below `var(--t-md)`" (20px), so every row name in the
estate is either 16px or 20px depending on which line the implementer trusts.

**H-15. Vertical rhythm is an unowned judgement call with no values.** No heading margins are given
anywhere, and `DESIGN.md`'s only guidance is "Section padding varies. Uniform vertical rhythm across
every section is a tell", which is an instruction to diverge with no range and no arbiter, producing the
largest cumulative visual difference between any two implementations.

**H-16. § 7's Label colour conflicts with `DESIGN.md`, and the two-corner placement is lost.**
`DESIGN.md` specifies the Tracker Family group label in `--token-accent` and specifies Plate marks as a
top-left and top-right pair; § 7 gives one colour, no accent variant and one label.

**H-17. § 7's subordinate line must be invented, and its check silently mandates uppercase markup.** The
line is required to be `aria-hidden` and to carry no information, so five implementers write five
different decorative strings with no source; and "Turn off CSS. Every label still reads as a short
uppercase string" can only pass if the text is authored uppercase, which nothing states and which
conflicts with treating uppercase as structural styling.

**H-18. § 8 collides with the ceiling twice, and its routing test is unowned.** The mandated
empty-state line is new microcopy, which the ceiling forbids; removing an existing `N/A` is a field
disappearing, which the ceiling also forbids; and "cannot be empty by construction" versus "genuinely
can be empty" is a data-model assertion with no stated owner, so one implementer renders a line where
another renders nothing.

**H-19. F-7's grep has no defined scope.** A restyled application's built CSS still contains the
component library's `box-shadow` rules for surfaces below the floor, and the check names no exclusion,
so one reviewer greps the whole bundle and fails the application while another greps only restyled files
and passes it; the grep also misses inline styles, JS-applied styles, SVG gradients and
`filter: drop-shadow()`.

**H-20. F-8 is a numeric threshold verified by eyeball.** Which colours count as accent, in which state,
at which viewport, against which denominator, and with what colour tolerance are all undefined, and human
area estimation on thin scattered strokes has an error far wider than the 3% threshold, so two reviewers
disagree about the same screenshot.

**H-21. F-9 and § 5's greyscale check need a naive second observer and have no threshold.** "Hand the
image to someone with no legend" is unrepeatable and contradicts the one-maintainer premise the whole
document is written around, yet it is what SM-12's per-application evidence rests on in Story 8.4.

**H-22. F-10 collides with the Row's dense-list allowance.** At `padding-block: var(--s-sm)` a row is
roughly 40px tall, so a compliant 44px target extends past the row and the targets of adjacent rows
overlap vertically, and the system's only overlap rule is the Control's horizontal `--s-lg` sibling gap.

**H-23. F-11's `::selection` never says background or foreground.** Accent as background paints a large
accent fill (forbidden by F-8 in the same table, and 2.83:1 against ink), accent as foreground does not,
and `DESIGN.md`'s enumeration of where accent may appear omits `::selection` entirely, so the mandatory
hand-fix is excluded by the rule it is meant to satisfy.

**H-24. The ceiling permits a wrapper for a 44px target while § 2 forbids one.** "A wrapper added to
reach a 44px target" is in the Permitted column and "on the element itself and never on a wrapper" is in
the Row entry, so two implementers build two different DOM structures for the same link.

**H-25. The A / B / C family taxonomy has no slot for common stacks and names no arbiter.** shadcn-style
copy-in kits, headless libraries and Bootstrap each fit two families or none, `digital-library` and
`list-wheel` are assumed C and B and explicitly unverified (O-15), and "verified first" names no method,
which would have missed Phoenix's vendored daisyUI since it has no package manifest entry.

**H-26. Family B's preferred route violates the ceiling and its fallback defers the mechanism.**
Replacing a behaviour-carrying framework component with plain markup is a behaviour change the ceiling
forbids, while route 2 says only "drive it through the framework's own theming API" without naming the
`--mat-*` / `--mdc-*` custom property layer that is the actual mechanism, so family B gets no count, no
unit of work and no cost bound.

**H-27. The "bounded by a grep" claim does not hold.** Six daisyUI classes are named out of roughly
sixty (`input`, `select`, `checkbox`, `tabs`, `table`, `dropdown`, `modal`, `collapse`, `join` and two
dozen more are absent), the grep cannot see `core_components.ex` (which the same subsection names as the
easy-to-miss second component layer), it misses interpolated class names, its scope depends on the still
open O-14 route enumeration, and it counts a `btn` and a `navbar` as one unit each.

**H-28. No loading or pending state exists in the vocabulary.** A Phoenix LiveView match tracker updates
in place, a library full-text search is asynchronous and a wheel spins, and § 8 covers empty and error
but never pending, so five implementers invent five pending treatments (or none) on their most
frequently seen state.

**H-29. No pagination and no tab-set geometry.** § 1 names "a tab" as a Control and never specifies the
tab list, the selected indicator's relationship to the Control's mandated four-sided border, or the
panel; pagination is absent entirely though any library or match history needs it.

**H-30. The three permitted glyphs are load-bearing and entirely unspecified.** The
external-navigation mark is described in `EXPERIENCE.md` as "the single detail that stops the panel
reading as tabs, which is FR-14's whole requirement", and no document gives its size, source (SVG, font
glyph or Unicode character), stroke width, colour or `aria-hidden` rule, so it renders differently in
every implementation.

**H-31. Precedence has no total order and geometry has no arbiter.** `DESIGN.md` claims values,
`EXPERIENCE.md` claims behaviour, `RESTYLE-SPEC.md` claims to own geometry while deferring unqualified
to both spines, so a pure geometry conflict (separator attachment, the 760px template) falls to nobody
and a spine can win a question it disclaims.

**H-32. The scrim code block, copied as written, fails the file's own conformance gate.**
`RESTYLE-SPEC.md` declares `--token-scrim` as a literal `oklch(... / 0.88)` while `DESIGN.md` declares
`--c-scrim` and aliases the role, so an implementer copying the spec's block into a Satellite writes a
raw alpha literal outside `contracts/`, which Story 2.34's FR-17 grep is specified to reject.

## Medium (24)

**M-1.** § 3 says "Three widths exist in this system and no fourth is minted" and then tabulates four
treatments across two widths, so a reader hunting the third width will find `--stroke-focus` or
`--focus-offset` and mint something.

**M-2.** § 4 cross-references "the scrim (§ 8)"; § 8 is Empty edge and the scrim is in an unnumbered
section, so a reader following the reference lands on the wrong entry.

**M-3.** § 2's "`var(--t-3xs)` or `var(--t-2xs)`" for metadata is an explicit unowned choice, which is
the exact construction the file's own two-tests section forbids.

**M-4.** § 2's "a denser list may go to `var(--s-sm)`" gives no criterion for denser and no owner, so
the same twenty-row list differs by 160px of page height between two implementations.

**M-5.** § 2's containment exception turns on whether "a reader needs" the framing line, with no
criterion and no arbiter for the second instance after the Tracker Family.

**M-6.** `DESIGN.md` § Layout says Flexbox inside components while `DESIGN.md` § Components calls the
Registry Entry "a grid row", and the Row entry inherits the disagreement without resolving it.

**M-7.** § 5 gives `Archived` no border (per `DESIGN.md`) but does not say whether padding is retained,
so a column of status marks either aligns or sits 1px out depending on the reading.

**M-8.** § 5's "at most one value earns accent, and it is the one that means actionable right now" is a
judgement with no owner; in a match tracker the live match and the upcoming match both qualify.

**M-9.** § 6 gives no colour for any heading level, no slot for `--t-xl` secondary display, and states
that visual and semantic levels are "both stated" without saying by whom or where.

**M-10.** § 6's check names the document outline, which no browser implements and which was removed from
the HTML specification, and names no substitute tool.

**M-11.** § 7 gives no gap between a label and its rule, no padding above the rule, and no span for the
side-ruled variant's leading rule.

**M-12.** § 7's "Mirrors to the trailing edge when the label is end-aligned" leaves the alignment
decision unowned.

**M-13.** § 8's empty line has no padding-block, no statement of whether separators are drawn around it,
and no behaviour in the 760px column layout; and its check ("force each list to zero") contradicts the
treatment for a list that cannot be empty by construction.

**M-14.** § 8's error-surface exit rule produces a dead end for an application whose header carries no
exits, and explicitly forbids adding one.

**M-15.** F-1's method (sample the rendered pixel) verifies the ground but not "no `#000` and no `#fff`
anywhere", which needs a grep; and a hex grep misses `white`, `rgb(255,255,255)`, `oklch(100% 0 0)` and
utility classes.

**M-16.** F-6's keyboard traversal proves a ring exists but cannot establish "instant", and cannot reach
elements gated behind state (an open disclosure, an error surface).

**M-17.** F-10 names no sampling rule for an application with hundreds of targets, and the DevTools box
model reports the border box rather than the hit area, which diverge when a pseudo-element expands the
target.

**M-18.** The floor's scope depends on O-14, which is open, so no application's in-floor surface set is
enumerable today and Story 8.4 has no denominator to record against.

**M-19.** The ceiling addresses presentation and behaviour and never mentions semantics, so converting a
`<div>` card grid into the `<ul>` of `<li>` rows that A-8 requires is neither permitted nor forbidden.

**M-20.** Tech chips are specified as outlined, square, `1px solid var(--token-border-interactive)` and
not interactive, making them visually identical to a Control under § 1 with nothing to distinguish them,
so one implementer applies the 44px floor to a chip and wrecks the row's rhythm.

**M-21.** "Every application below is verified first" names no verification method, and the obvious one
(inspect the package manifest) would have missed the one confirmed case, since daisyUI is vendored into
`cs-tracker` as committed source loaded by `@plugin`.

**M-22.** Date, time and number formatting is unspecified beyond `tabular-nums`, so a books library's
publication years, a tracker's timestamps and a match tracker's durations format three ways.

**M-23.** `cs-tracker`'s primary surface is a match scoreboard, which is dense data UI and therefore
explicitly below the floor (S-6), so the restyle may reach very little of the application the daisyUI
test was written for, and nothing says so.

**M-24.** The estate now carries two breakpoints eight pixels apart (760px in `RESTYLE-SPEC.md` and
`EXPERIENCE.md` § Responsive, 768px in `EXPERIENCE.md` § Home surface) with no statement of whether that
is deliberate and no token for either.

## Low (9)

**L-1.** § 1 names face, size, case, tracking and colour for the control label but not weight, while § 2
names `var(--w-bold)` for its primary label.

**L-2.** Line-height is unnamed for the Control, the Status mark, the Row's secondary text and the Label,
though `--lh-label`, `--lh-heading` and `--lh-body` all exist in the contract.

**L-3.** `outline-offset: var(--focus-offset)` paints outside the border box and is clipped inside any
ancestor with `overflow: hidden`, which is common in framework component internals and is not mentioned.

**L-4.** § 1's stated rationale for the `--s-lg` sibling gap ("so two 44px boxes cannot overlap")
describes horizontal adjacency, while the real overlap risk is vertical, on a wrapped line or in a dense
list.

**L-5.** The "screenshot and diff" checks in § 1 and F-4 give no antialiasing tolerance, so a literal
pixel diff never returns "the only pixels that differ are the border".

**L-6.** `DESIGN.md` § Shapes reserves `--r-pill` for "The 4px `Live` dot. Nothing else", while § 5
generalises it to any status dot in any application.

**L-7.** Story 8.4's record has a field for "Component-class call sites, before and after, where family A
applies" and no equivalent evidence field for families B and C, so two of the three families produce no
countable record.

**L-8.** The mandated skip-control string carries a literal `↓` inside the text, which a screen reader
speaks; `EXPERIENCE.md` flags exactly this pattern for the `//` marker and does not flag the arrows it
mandates.

**L-9.** The Empty edge entry forbids a heading in an empty list treatment but requires one in an error
surface, with no statement of where the boundary sits for a partially failed page (a rendered shell with
a failed region).

---

# What would close the gap

Ordered by ratio of divergence removed to words written.

1. **One table: the 760px row template.** `grid-template-columns`, column gap, vertical alignment, and
   the behaviour when a cell is empty. Closes C-1 and most of H-4. Roughly ten lines.
2. **Three new entries: Link, Field, Media.** They are what the named applications actually render.
   Closes C-2, C-3 and C-4.
3. **Two floor checks that test the vocabulary**, for example F-12 (a row's computed
   `grid-template-columns` matches § 2 at 760px) and F-13 (computed font-size on a heading, a row name
   and a label matches § 6 and § 7). Closes C-5.
4. **Fix four verification methods.** F-2 to `document.fonts.check()`; F-4 to computed
   `background-color` at rest, hover and focus; F-7 to a scoped grep with a stated exclusion for
   below-floor library CSS; F-8 to the pixel-count script or the structural rule in Part 2. Closes C-6,
   H-7, H-19 and H-20.
5. **One paragraph on the Home surface geometry**: the canvas extent per breakpoint and which grid areas
   are guaranteed not to intersect it. Closes C-7 and settles H-10.
6. **One sentence in the ceiling** resolving reading-order versus the Row's prescribed order, naming
   which wins. Closes C-8 and settles H-18 and H-24.
7. **Scope § 1 explicitly** to boxed controls, and point unboxed activatable things at the new Link
   entry. Closes C-9 and M-20.
8. **Name an arbiter.** One line stating who resolves a geometry conflict and in which document the
   resolution is recorded. Closes H-31 and gives every unowned judgement call in Part 1 a destination.
