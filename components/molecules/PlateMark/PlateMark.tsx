import './PlateMark.scss';

/**
 * The Plate mark: the Hub's one label component (Stories 2-11 and 2-31, `DESIGN.md:686-707`,
 * `RESTYLE-SPEC.md` § 7 Label).
 *
 * Mono uppercase signage on a hairline, carrying section identity. **Three variants, and no
 * fourth**, each a different position for the rule:
 *
 * - **Section** (the default): identity on the leading edge, the position or domain the section
 *   carries on the trailing edge, the rule beneath both, running the content width.
 * - **Annotated**: the rule beneath, and a subordinate second line under the label.
 * - **Side-ruled**: a label hanging beside content rather than above it, the rule on its leading
 *   edge, mirrored to the trailing edge when the label is end-aligned.
 *
 * **`HudLabel` was folded into this component by Story 2-31 and deleted rather than aliased.** The
 * two were the same atom under two names (decided 2026-08-15); its `sub` is the annotated variant's
 * subordinate line and its right alignment is the side-ruled mirror. The props are a union on
 * `variant`, which refuses another variant's prop, or an annotated mark without its `sub`, only
 * where `variant` is written (TypeScript 5.9.3, checked 2026-09-23). A mark that omits it is a
 * section mark: a `sub`, or an `align` typed as its literal, compiles and is dropped, and a bare
 * `align='end'` fails only because it widens to `string`. A props object spread from a variable
 * is not checked for another variant's prop at all.
 *
 * **The subordinate line is ornament, and hidden from assistive technology in every render.** It
 * takes the muted accent role at 2.74:1 (`DESIGN.md:701-704`), which is barred from carrying
 * anything a reader needs, so a subordinate line that carries information is a defect in the call
 * site, not a styling choice: move the information into the label, which is read. The trailing
 * cell of a section mark is the opposite case, ordinary secondary text a reader is meant to read.
 * **Since 2026-09-24 the line is generated content** (Operator ruling, DW-113): an empty span whose
 * string is `data-ornament`, painted by `PlateMark.scss`, because axe scores contrast on a text node
 * whatever `aria-hidden` says and the muted accent failed Lighthouse's audit on `/work`.
 *
 * **Every cell is uppercase in the document, not only on screen.** `RESTYLE-SPEC.md` § 7 checks a
 * label with CSS turned off and expects a short uppercase string, and § 6 calls uppercase
 * structural rather than emphatic, so the text itself is uppercased here and the stylesheet's
 * `text-transform` restates it rather than supplying it. A label read aloud is therefore the same
 * string a reader sees.
 *
 * **Nothing here is interactive.** No link, no button, no hover state and no place in the tab
 * order, so the 44px floor `tests/e2e/hit-target-floor.pw.ts` sweeps does not apply and that file's
 * per-surface counts do not move. Labels appear where a genuine ordinal or domain exists, never as
 * an eyebrow above every heading.
 */
export type PlateMarkProps =
  | {
      variant?: 'section';
      /**
       * Section identity, leading edge. Never a count and never an eyebrow on a heading.
       *
       * Trimmed, and a label that trims to nothing draws no mark at all rather than an empty box
       * over a hairline. The Registry's schema constrains `name` to a string and not to a non-blank
       * one, so whitespace is a shape a caller can hand this, and a rule with nothing above it is a
       * rule that means nothing.
       */
      label: string;
      /**
       * The position or domain the section carries, trailing edge.
       *
       * Optional because `DESIGN.md:706-707` says a mark appears where a genuine ordinal or domain
       * exists and never above every section. Absent, the cell is not drawn at all: a placeholder,
       * a dash or an empty box would each state that something is missing, which is a different
       * claim from making none.
       */
      domain?: string;
    }
  | {
      variant: 'annotated';
      label: string;
      /** The subordinate line: ornament only, never read. Blank draws no line. */
      sub: string;
    }
  | {
      variant: 'side-ruled';
      label: string;
      /** `end` mirrors the rule to the trailing edge, for a label that hangs at the end of its row. */
      align?: 'start' | 'end';
    };

/** Trimmed and uppercased, the form every cell is drawn in. */
const cell = (text: string): string => text.trim().toUpperCase();

export function PlateMark(props: PlateMarkProps) {
  const identity = cell(props.label);

  // No identity, no mark. Drawing the hairline anyway would put a rule across the page with nothing
  // above it, which reads as a separator the design does not have rather than as a missing label.
  if (identity === '') return null;

  if (props.variant === 'annotated') {
    const sub = cell(props.sub);
    return (
      <div className='plate-mark plate-mark--annotated'>
        <span className='plate-mark__label'>{identity}</span>
        {sub !== '' && <span className='plate-mark__sub' aria-hidden='true' data-ornament={sub} />}
      </div>
    );
  }

  if (props.variant === 'side-ruled') {
    return (
      <div className={props.align === 'end' ? 'plate-mark plate-mark--side-ruled plate-mark--end' : 'plate-mark plate-mark--side-ruled'}>
        <span className='plate-mark__label'>{identity}</span>
      </div>
    );
  }

  const trailing = cell(props.domain ?? '');
  return (
    <div className='plate-mark'>
      <span className='plate-mark__label'>{identity}</span>
      {trailing !== '' && <span className='plate-mark__domain'>{trailing}</span>}
    </div>
  );
}
