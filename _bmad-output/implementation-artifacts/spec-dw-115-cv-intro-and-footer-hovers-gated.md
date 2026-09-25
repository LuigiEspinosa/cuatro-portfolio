---
title: 'DW-115: the CV intro and footer link hovers gated on a pointer that can hover'
type: 'bugfix'
created: '2026-09-23'
status: 'done'
route: 'one-shot'
baseline_commit: '8ba447b79520a2c0c78b39433a6c23b532e12c49'
---

# DW-115: the CV intro and footer link hovers gated on a pointer that can hover

## Intent

**Problem:** `CvIntro.scss:122` and `SiteFooter.scss:89` recoloured their link underlines on
`:hover` outside any `@media (hover: hover)`, so on a touch device a tap painted the hover and left
it painted until the next tap landed elsewhere, against the 2026-09-15 rule in `epic-2-context.md`
that gates every `:hover`. They were the last two of the five rules DW-115 named, left open by
Story 2-22's fix round `d3cc350` because they sat outside its diff.

**Approach:** Each rule moves, unchanged, inside `@media (hover: hover)` under a one-line comment
naming DW-115, and each component's suite reads the gate off the compiled sheet on the `SkipLink`
and `SuiteDirectory` precedent: strip every hover-gated block, find no `:hover` left, pin the gated
rule verbatim, and plant a control the strip must leave standing. DW-115 closes. The fix is
numbered for the deferred-work entry it closes, because the `a-` series is reserved for the
accessibility review's findings.

## Suggested Review Order

**The gate**

- Entry point: the rule moves inside the query unchanged, and one comment line names DW-115
  [`CvIntro.scss:123`](../../components/organisms/CvIntro/CvIntro.scss#L123)

- The same wrap on the footer's one link, the last rule in its file
  [`SiteFooter.scss:90`](../../components/organisms/SiteFooter/SiteFooter.scss#L90)

**Reading the gate off the compiled sheet**

- Strip every gated block, find no hover, pin the rule verbatim, plant a two-sided control
  [`CvIntro.test.tsx:110`](../../components/organisms/CvIntro/__tests__/CvIntro.test.tsx#L110)

- Why that pin is the only hold on the `/cv` recolour: no browser case reads it
  [`CvIntro.test.tsx:99`](../../components/organisms/CvIntro/__tests__/CvIntro.test.tsx#L99)

- The footer's case; the browser half stays with `secondary-surfaces.pw.ts`
  [`SiteFooter.test.tsx:221`](../../components/organisms/SiteFooter/__tests__/SiteFooter.test.tsx#L221)

**The record**

- DW-115 closed, dated, naming what still has no gate
  [`deferred-work.md:5749`](deferred-work.md#L5749)
