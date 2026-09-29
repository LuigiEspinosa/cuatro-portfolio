'use client';

import type { MouseEvent } from 'react';
import './SkipControl.scss';

/** The fragment the Directory heading carries. `SuiteDirectory.tsx:29` is the declaration. */
const HEADING_ID = 'suite';

/** The label, exactly as `EXPERIENCE.md:286` writes it, minus the glyph that follows it. */
const LABEL = 'Skip to the suite';

/**
 * The direction mark, which is decoration and is not read out.
 *
 * `EXPERIENCE.md:286` writes the control as `Skip to the suite ↓` and the story's acceptance
 * criterion pins that string, so it stays on screen character for character. In the accessibility
 * tree it is noise: a screen reader announces the arrow as "down arrow", or as nothing, and either
 * way the name of the control is the sentence rather than the sentence plus a glyph.
 */
const GLYPH = '↓';

/**
 * The skip control, FR-2's one interaction from a cold arrival (Story 2-13,
 * `EXPERIENCE.md:416-422`).
 *
 * **Distinct from the A-6 skip-link, in every axis that matters.** That one is hidden until
 * focused, is the first tabbable element and targets main content. This one is always visible on
 * the default path, is not first, and targets the Directory heading. `EXPERIENCE.md:421-422`
 * requires them distinct, which is why they are two components rather than one with a prop.
 *
 * **It moves focus, and it lets the browser do everything else** (`EXPERIENCE.md:723`).
 * `SuiteDirectory.tsx:137-139` already ships the heading with `tabIndex={-1}` for exactly this, and
 * browsers agree on the scroll and have never agreed on the focus, so the focus move is explicit
 * and nothing else is. The default action is deliberately not prevented: it is what writes `#suite`
 * into the address bar and pushes the history entry that makes Back undo the jump, and it is what
 * scrolls. `preventScroll` on the focus call leaves that scroll to it rather than racing it.
 *
 * **A modified click is not this control's business.** Ctrl, Cmd, Shift, Alt and any non-primary
 * button mean open elsewhere, and moving focus in this document while a new tab opens in another is
 * a small hostility. The handler bails and the browser is left alone.
 *
 * It is deliberately **not** a `.home-panel`: `HomeLayout.scss:80-82` dims every panel that is not
 * hovered whenever a sibling is, and `HomeLayout.tsx:17`'s `finalState` fades the panels in over
 * two seconds. A control that answers FR-2's cold arrival cannot wait two seconds to exist.
 */
export function SkipControl() {
  const skip = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    document.getElementById(HEADING_ID)?.focus({ preventScroll: true });
  };

  return (
    <a className='skip-control' href={`#${HEADING_ID}`} onClick={skip}>
      {LABEL} <span aria-hidden='true'>{GLYPH}</span>
    </a>
  );
}
