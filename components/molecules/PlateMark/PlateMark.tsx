import './PlateMark.scss';

/**
 * The Plate mark, Section variant (Story 2-11, `DESIGN.md:686-699`).
 *
 * Section identity on the leading edge, the position or domain that section carries on the trailing
 * edge, both sitting on one hairline. It is the signage element the identity is named for: a label
 * over a rule, carrying a fact rather than a decoration.
 *
 * **The Section variant and nothing else.** `DESIGN.md:695-699` mints three, and the other two
 * (Annotated, which adds the subordinate line, and Side-ruled, which moves the rule to the leading
 * edge) arrive with Story 2-31 together with the retirement of `HudLabel` into this component.
 * Until then the two atoms coexist deliberately: `components/atoms/HudLabel/HudLabel.tsx` is still
 * mounted by the hero above this mark, and folding it in early would move a component this story
 * has no mandate over.
 *
 * **`HudLabel`'s prop shape is echoed rather than imported.** Its `label` is this one's, and its
 * `sub` becomes the Annotated variant's subordinate line, not the trailing cell here. The two are
 * different things: the subordinate line takes the muted accent role at 2.74:1 and is `aria-hidden`
 * in every implementation without exception (`DESIGN.md:701-704`), whereas the trailing cell below
 * is ordinary secondary text a reader is meant to read. Importing the old atom to reuse its
 * interface would have tied this component's shape to one it is scheduled to replace.
 *
 * **Nothing here is interactive.** No link, no button, no hover state and no place in the tab
 * order, so the 44px floor `tests/e2e/hit-target-floor.pw.ts` sweeps does not apply and that file's
 * per-surface counts do not move.
 */
export interface PlateMarkProps {
  /**
   * Section identity, leading edge. Never a count and never an eyebrow on a heading.
   *
   * Trimmed, and a label that trims to nothing draws no mark at all rather than an empty box over a
   * hairline. The Registry's schema constrains `name` to a string and not to a non-blank one, so
   * whitespace is a shape a caller can hand this, and a rule with nothing above it is a rule that
   * means nothing.
   */
  label: string;
  /**
   * The position or domain the section carries, trailing edge.
   *
   * Optional because `DESIGN.md:706-707` says a mark appears where a genuine ordinal or domain
   * exists and never above every section. Absent, the cell is not drawn at all: a placeholder, a
   * dash or an empty box would each state that something is missing, which is a different claim
   * from making none.
   */
  domain?: string;
}

export function PlateMark({ label, domain }: PlateMarkProps) {
  const identity = label.trim();
  const trailing = domain?.trim() ?? '';

  // No identity, no mark. Drawing the hairline anyway would put a rule across the page with nothing
  // above it, which reads as a separator the design does not have rather than as a missing label.
  if (identity === '') return null;

  return (
    <div className='plate-mark'>
      <span className='plate-mark__label'>{identity}</span>
      {trailing !== '' && <span className='plate-mark__domain'>{trailing}</span>}
    </div>
  );
}
