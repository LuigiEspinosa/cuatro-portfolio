'use client';

import { usePathname } from 'next/navigation';
import './Header.scss';

import { Logo } from '@/components/atoms/Logo/Logo';
import { Navbar } from '@/components/atoms/Navbar/Navbar';
import { SkipLink } from '@/components/atoms/SkipLink/SkipLink';

/**
 * **The scroll padding follows the band's real block size** (Story 9-15, DW-118). Sticky chrome
 * occludes the top of the viewport's scrollport, so the root element is told how much: the band
 * measures itself and writes that one length as `scroll-padding-block-start` on `<html>`, and takes it
 * back when it unmounts (the route becomes `/`) or measures zero (`/celeste` hides it). A wrapped row
 * or text zoomed past the tap floor grows the band, and the padding grows with it.
 *
 * This is the one write the Header makes outside its own node, and it is the Header's to make:
 * `Header.scss` already owned this property on the root through its `html:has(...)` rule, which
 * stays as the first paint's value (exact for one row) until this runs after hydration. The cleanup is
 * a ref cleanup, so it runs whenever the `<header>` leaves the document, which is what the Story 2-1
 * mutation lacked. Stable at module scope so React does not detach and reattach it on every render.
 */
const reserveScrollPadding = (band: HTMLElement | null) => {
  if (!band) return;
  const root = document.documentElement;
  const observer = new ResizeObserver(() => {
    const height = band.getBoundingClientRect().height;
    if (height > 0) root.style.setProperty('scroll-padding-block-start', `${height}px`);
    else root.style.removeProperty('scroll-padding-block-start');
  });
  // The border box, not the default content box: the band's padding is set in `rem`, so a
  // reader's text size can grow it while the row inside, held to the tap floor, stays the same height.
  observer.observe(band, { box: 'border-box' });
  return () => {
    observer.disconnect();
    root.style.removeProperty('scroll-padding-block-start');
  };
};

export const Header = () => {
  const path = usePathname();

  // **The skip link is this component's first output on every route** (Operator ruling 2026-09-24,
  // DW-43, F-13). The root layout renders the header ahead of every page, so the link is the first
  // tabbable element everywhere from one call site. `/` renders no band, its hero panels being its
  // navigation, so the link stands alone there; everywhere else it is the band's first child, which
  // is also why `/celeste`, whose stylesheet hides the band, shows no control.
  return path !== '/' ? (
    <header className='header-container' ref={reserveScrollPadding}>
      <SkipLink />
      {/* The band paints the ground and the hairline across the whole viewport; the content sits in
          the page's own container inside it, so it aligns with the page below (Story 2-32, DW-63). */}
      <div className='header-container__inner container'>
        <Logo />
        {/* The pathname is handed down rather than read again inside `Navbar` (Story 2-15). It is
            already read here to decide whether this header renders at all, and `Navbar` needs the
            same answer to mark the current destination with `aria-current`. */}
        <Navbar pathname={path} />
      </div>
    </header>
  ) : (
    <SkipLink />
  );
};
