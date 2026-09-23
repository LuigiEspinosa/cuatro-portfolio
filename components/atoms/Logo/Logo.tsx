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
 * keeps as it was. No design document states the site's name, and the Registry and the page metadata
 * each carry a different one, so which of the three is meant is filed for the Operator in
 * `_bmad-output/implementation-artifacts/deferred-work.md` (DW-117) rather than decided here.
 */
export const Logo = () => (
  <Link href='/' className='logo'>
    Cuatro
  </Link>
);
