import Link from 'next/link';
import './Logo.scss';

/**
 * The wordmark (Story 2-32): the site's name set as type, where a raster of it stood.
 *
 * **Text, so its accessible name is its words.** The 2023 logo was a 184 x 66 image of the word
 * inside a link whose own box was the 20px line box beneath it, with alternative text describing
 * a picture ("Numero Cuatro Logo in white"). `EXPERIENCE.md` § Chrome retires the raster and names
 * the link by the site's name, so the name is the content and nothing else: no `alt`, no
 * `aria-label`, and the uppercase is the stylesheet's, so a screen reader reads a word rather than
 * spelling out letters (the `SkipLink.tsx` shape).
 *
 * **The string is `Cuatro`**, the word the raster drew and the design's mock sets, the copy a restyle
 * keeps as it was. The Registry and the page metadata each carry a different name, and the Operator
 * confirmed this one on 2026-09-24, with its size and tracking in `Logo.scss` (DW-117), which
 * `EXPERIENCE.md` § UI strings records.
 */
export const Logo = () => (
  <Link href='/' className='logo'>
    Cuatro
  </Link>
);
