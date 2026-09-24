import './celeste.scss';

/** U+1F499 BLUE HEART and U+1F98B BUTTERFLY, the page's two emoji, written as escapes. */
const EMOJI = '\u{1F499}\u{1F98B}';

/**
 * `/celeste`'s one heading. Its copy is unchanged byte for byte: a leading space, the words, one space,
 * then the two emoji with no space between them. Since the Operator ruling of 2026-09-24 (DW-121) the
 * emoji sit in an element of their own, still inside the heading so its name keeps them, which is what
 * lets `celeste.scss` set them on a mono line beneath the words, as S10 draws the page.
 */
export default function CelesteComponent() {
  return <h1> Te amo muchísimo hermosa <span className='celeste__emoji'>{EMOJI}</span></h1>;
}
