---
title: 'Story 2.1: The pre-existing repository defects'
type: 'bugfix'
created: '2026-08-29'
status: 'done'
baseline_commit: 'f5df8c8cb396aece4a9df9f1ff5c1d7e74b70e3a'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** Two defects survived the cybercore rebrand. `content/work.ts:18` reads `Dev. 2025`
where it means `Dec.`, and it reaches the page: `WorkItem.tsx:76` renders `period` inside the
`work-item__header` button, so the typo is part of that button's accessible name. Separately,
`Celeste.tsx:7-14` hides the site header by writing `display: none` onto another component's DOM
node inside an effect, so if the cleanup never runs the header stays hidden for the rest of the
session.

**Approach:** Correct the month abbreviation. Replace the imperative suppression with the route
identifier the `<body>` already carries. `celeste.scss` is already scoped to `#celeste` and
already contains a rule meant to hide the header; its selector names a class the header has never
had, so the rule is dead and the effect is what actually works. Point the selector at the real
element and delete the effect.

## Boundaries & Constraints

**Always:**

- The `<h1>` content in `Celeste.tsx` is preserved byte for byte, emoji included.
- `/celeste` still renders with no header: that page correctly carries no suite navigation.
- Restoring the header must not depend on a cleanup, an unmount, or an effect running at all.
- Every other `period` string in `content/work.ts` is checked in the same pass.

**Ask First:**

- If the `Dec.` edit shifts the committed `/work` baseline past `maxDiffPixelRatio`, HALT before
  regenerating it. Re-blessing a baseline accepts everything else on that screen too.
- Any change to `app/layout.tsx`, `Header.tsx`, or the `app/` route directory structure.

**Never:**

- Do not mutate another component's DOM node or inline styles to suppress the header.
- Do not introduce route groups or move `<Header />` out of the root layout. Stories 2-13, 2-14,
  2-15 and 2-32 reshape routing and chrome, and it would strip the header from
  `app/not-found.tsx`, which has one today.
- Do not fix unrelated defects opportunistically, and do not rename `header-container`.
- Do not add a lint step: there is no working lint command here.
- Do not run `test:e2e:update` on this host. Baselines are only valid from the pinned container.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Direct load of `/celeste` | `GET /celeste` | `<body id="celeste">`; the `<header>` element is present in the DOM but not visible | N/A |
| Any other rendering route | `GET /work` | header visible, no inline `style` attribute on it | N/A |
| Leaving `/celeste` | `/celeste`, then `/work` | header visible; nothing had to be restored | N/A |
| Celeste mounts beside a header | a `<header>` in the document, `<CelesteComponent />` renders | the header's inline `style.display` is unchanged (empty string) | N/A |
| Home route | `GET /` | unchanged: `Header` already returns `null` on `/` | N/A |
| Period strings | all four entries in `content/work.ts` | every month abbreviation is a real one; only entry 1 changes | N/A |

</frozen-after-approval>

## Code Map

- `content/work.ts:18`: the typo. The other three `period` values (`:61`, `:106`, `:137`) are
  already correct, so confirm rather than edit.
- `components/atoms/WorkItem/WorkItem.tsx:76`: the only render site of `period`, inside the
  `work-item__header` button. Read only.
- `components/organisms/Celeste/Celeste.tsx:7-14`: the effect to delete. Removing it leaves no
  hook, so `'use client'` (`:1`) and the `react` import (`:3`) go with it.
- `components/organisms/Celeste/celeste.scss:8`: `.header { display: none }` nested under
  `#celeste` (`:1`), compiling to `#celeste .header`, which matches nothing.
- `components/molecules/Header/Header.tsx:12-17`: renders `<header class="header-container
  container">` and already returns `null` on `/`. Read only, and the reason `.header` misses.
- `components/atoms/Container/Container.tsx:12-16`: `Body` renders `<body id={route}>` from
  `usePathname()`. The mechanism the fix keys on. It has no test.
- `app/app.scss:100`, `:105-106`, `components/organisms/HomeLayout/HomeLayout.scss:1`: three
  existing rules keyed on the body route id. Precedent, read only.
- `tests/e2e/rendered-output.pw.ts:216-222`: asserts exactly one committed baseline. A new
  snapshot file breaks it; a replaced one does not. Its helper ledger (`:273`) is internal to that
  file, so a separate `.pw.ts` does not disturb it.
- `components/atoms/Navbar/__tests__/Navbar.test.tsx`: the unit-test idiom to follow, including
  the `next/link` shim.

## Tasks & Acceptance

**Execution:**

- [x] `content/work.ts`: change `Dev.` to `Dec.` on line 18, the shipping typo, and verify the
      other three `period` values in the same read.
- [x] `components/organisms/Celeste/celeste.scss`: change the nested `.header` selector to the
      element selector `header`, repairing the rule that was always meant to do this. The element
      selector survives story 2-32 renaming `header-container`.
- [x] `components/organisms/Celeste/Celeste.tsx`: delete the `useEffect`, the `react` import and
      the now-unneeded `'use client'`, because the suppression is the stylesheet's job. Leave the
      `<h1>` and the `./celeste.scss` import untouched.
- [x] `components/organisms/Celeste/__tests__/Celeste.test.tsx`, new: render the component with a
      `<header>` already in the document and assert it is still untouched afterwards, and that the
      heading text is unchanged. This is the regression guard for the defect itself. jsdom applies
      no stylesheet, so it cannot assert the hiding.
- [x] `components/atoms/Container/__tests__/Container.test.tsx`, new: mock `next/navigation` and
      pin the route-id derivation, including a multi-segment path. The suppression now depends on
      this value and nothing tested it.
- [x] `tests/e2e/celeste-header.pw.ts`, new: assert in a real browser that `/celeste` carries
      `body#celeste` and shows no header, that `/work` shows one, that `/` renders no header
      element at all, and that a 404 keeps one. Assertions only, no screenshot.
- [x] `content/__tests__/work.test.ts`, new, added by the step-03 matrix audit: assert every
      `period` in the whole array parses to two real months in the twelve-month set, with the end
      year not before the start year. The period-strings matrix row was otherwise verified only by
      reading, which does not survive the next edit.

**Acceptance Criteria:**

- Given `/celeste` is loaded in a browser, when the page settles, then no header is visible and
  the `<header>` element carries no inline `style` attribute.
- Given the site header, when any route other than `/celeste` and `/` is loaded, then it is
  visible, whether that route was reached directly or immediately after `/celeste`.
- Given a review of the diff, when `Celeste.tsx` is read, then it contains no reference to
  `document`, no effect and no import from `react`.
- Given `corepack pnpm test --run` and `corepack pnpm typecheck`, when both run, then both pass
  with the four new test files included, and the Playwright spec passes in the pinned container.

## Spec Change Log

Empty. No finding reached `intent_gap` or `bad_spec`, so nothing inside or outside
`<frozen-after-approval>` was renegotiated and no code was re-derived.

## Review Triage Log

Three layers ran in parallel against the full change set on 2026-08-29: blind hunter, edge case
hunter, verification gap. Twenty-two findings after deduplication. The source change itself, three
lines, drew no correctness finding from any layer, and the verification-gap layer returned no gap.
Everything actionable was test hardening or record keeping, so all of it is `patch` or `defer`.

**Patched.** The `AGENTS.md` context block still recorded both defects as open and told the next
agent to leave them alone, and pinned a suite size two rounds stale. `content/work.ts`'s guard
carried a tautological vacuity check (`checked` could not diverge from `work.length`), a bounded
rather than pinned entry count, and threw away both captured years, so a transposed or absurd year
passed. `Container.test.tsx` never exercised `replaceAll('/', '-')` and asserted
`toHaveBeenCalled()` on a mock nothing clears, which cannot fail. `Celeste.test.tsx` read only the
inline style, so `hidden`, a class or `remove()` would have passed a guard whose comment claimed
otherwise. `celeste-header.pw.ts` read `body#celeste`, derived from the URL alone, without
confirming the page rendered, covered one declaration of a six-declaration block, never measured
the 404 header the Never clause rests on, and misattributed `app/app.scss:100`. The spec used
` -- ` as a dash separator and an em-dash in its frozen tag, both against `AGENTS.md` and both
already ruled on in `spec-1-1`'s own triage log.

**Deferred** as DW-21 (four sibling content defects of the same class in `content/work.ts`, held
back by this spec's Never clause), DW-22 (two implementations of the same Playwright navigation
guard) and DW-23 (the container invocation that actually runs the e2e suite is recorded nowhere,
and the obvious one fails with exit 127).

**Rejected.** That `toBeHidden()` also passes for an absent element (the case already asserts
`toHaveCount(1)` first, and says why). That a hydration-time effect could slip past the inline
style read (the jsdom guard catches reintroduction on mount, and a timing wait would be worse).
`#celeste > header` over the descendant combinator (brittle if the tree gains a wrapper). Editing
DW-6 in place (the ledger is append only). That the third e2e case is redundant (it is, and its
comment says so; the unit test is what discriminates).

**Noted, not acted on.** Thirteen specs from 1-6 onward name the frozen block `<intent-contract>`
while this one uses the template's `<frozen-after-approval>`, which steps 2 and 4 of the running
workflow read by that name. Renaming mid-run would break a resume, so it is flagged rather than
changed.

## Design Notes

The AC offers a route-group layout or a `<body>` class. This takes the second because the repo
already implements it: `Body` writes the route onto `<body id>` and three stylesheets key on that
id today. The dead rule at `celeste.scss:8` shows the original author reached for the same
mechanism, then patched around it in JavaScript when the class name did not match. The route-group
option was rejected on cost: `<Header />` lives in the root layout and a nested layout cannot
remove what a parent renders, so five route directories would move and `app/not-found.tsx` would
lose the header it has now.

Specificity holds (`#celeste header` is 101 against `.header-container`'s 10, which sets
`display: flex`, not `none`). The restore is structural rather than a code path: nothing is
mutated, so the selector simply stops matching the moment `Body` writes a different id, abnormal
unmount included, because no unmount is involved.

```scss
#celeste {
  header { display: none; }
}
```

## Verification

Observed 2026-08-29 on Windows 11, after the review patches.

**Commands:**

- `corepack pnpm typecheck`: clean.
- `corepack pnpm test --run`: 738 tests across 32 files, all passing, 90.2 seconds. Baseline was
  730 across 29.
- The container run, which is the only place the e2e suite can pass: 45 passed, including all six
  `celeste-header.pw.ts` cases, the `/work` baseline comparison and `keeps exactly one committed
  baseline`. **The invocation in the first draft of this spec does not work.** `webServer.command`
  is `pnpm build && pnpm start` and bare `pnpm` is not on PATH in that image, so it dies with exit
  127. What ran is `corepack enable && corepack pnpm install --frozen-lockfile && corepack pnpm
  test:e2e` inside `mcr.microsoft.com/playwright:v1.62.1-noble`, with `node_modules` masked by a
  Docker volume so the Linux install does not overwrite the host's. Filed as DW-23, because
  `ops/rendered-output-harness.md` is where that belongs and it is outside this spec.
- This host cannot run the suite: the committed baseline is suffixed `-chromium-linux` and Windows
  looks for `-win32`.

**The Ask First gate did not trigger.** The `Dec.` edit does not move the committed `/work`
baseline. Confirmed twice and independently: the container comparison passed unchanged, and
cropping the committed PNG shows the entry reading `Oct. 2023 - De`, clipped at x=360, so the one
character that differs falls outside the captured viewport. Nothing was regenerated.

**Each new guard was proved to fire**, rather than assumed from a green run. Restoring the pre-fix
`Celeste.tsx` failed the mount read with `expected 'none' to be ''`. Reintroducing `Dev. 2025`
failed naming the entry and the render site. Transposing a period to `Dec. 2025 - Oct. 2023`, and
shortening one to `Aug. 2020 - Jun. 2020`, both failed as `ends before it starts`, across years
and within one. Deleting an entry failed with `expected 3 to be 4`. Making `Header` return `null`
on the 404 failed that case on `toHaveCount(1)` while its `.error-page` control stayed green. All
sources were restored byte-identical afterwards.

## Suggested Review Order

**The header suppression**

- Start here. One character is the entire mechanism, and it was always meant to be.
  [`celeste.scss:8`](../../components/organisms/Celeste/celeste.scss#L8)

- What is left once the effect goes: no hook, so no client bundle.
  [`Celeste.tsx:3`](../../components/organisms/Celeste/Celeste.tsx#L3)

- Where the id above comes from. Unchanged, but the rule now depends on it.
  [`Container.tsx:12`](../../components/atoms/Container/Container.tsx#L12)

**Proof in a real browser, which is the only place a cascade exists**

- Attached first, then hidden, then computed, then no inline style. Four different claims.
  [`celeste-header.pw.ts:53`](../../tests/e2e/celeste-header.pw.ts#L53)

- The 404 keeps its header. This is the cost the route-group option would have carried.
  [`celeste-header.pw.ts:136`](../../tests/e2e/celeste-header.pw.ts#L136)

- The other five declarations in the block the selector was edited into.
  [`celeste-header.pw.ts:88`](../../tests/e2e/celeste-header.pw.ts#L88)

- `/` renders no header at all, a different mechanism from hiding one.
  [`celeste-header.pw.ts:166`](../../tests/e2e/celeste-header.pw.ts#L166)

**The typo, and the guard meant to outlive it**

- The defect. One character, reaching a button's accessible name.
  [`work.ts:18`](../../content/work.ts#L18)

- Whole array, not four indexes: real months, running forwards, `Present` allowed.
  [`work.test.ts:121`](../../content/__tests__/work.test.ts#L121)

- The planted controls. `Dev.` passes the shape check; set membership is what catches it.
  [`work.test.ts:154`](../../content/__tests__/work.test.ts#L154)

**Supporting**

- The regression guard proper: the node is compared whole, mounted and unmounted.
  [`Celeste.test.tsx:41`](../../components/organisms/Celeste/__tests__/Celeste.test.tsx#L41)

- The one non-trivial step in the derivation, previously exercised by no route.
  [`Container.test.tsx:87`](../../components/atoms/Container/__tests__/Container.test.tsx#L87)

- Two pitfalls this story made false, replaced by the mechanism that supersedes them.
  [`AGENTS.md:120`](../../AGENTS.md#L120)

- Found while writing the 404 assertion above, and it cost two failed probes.
  [`AGENTS.md:124`](../../AGENTS.md#L124)
