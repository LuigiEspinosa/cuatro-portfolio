'use client';

import { usePathname } from 'next/navigation';
import './Header.scss';

import { Logo } from '@/components/atoms/Logo/Logo';
import { Navbar } from '@/components/atoms/Navbar/Navbar';
import { SkipLink } from '@/components/atoms/SkipLink/SkipLink';

export const Header = () => {
  const path = usePathname();

  // **The skip link is this component's first output on every route** (Operator ruling 2026-09-24,
  // DW-43, F-13). The root layout renders the header ahead of every page, so the link is the first
  // tabbable element everywhere from one call site. `/` renders no band, its hero panels being its
  // navigation, so the link stands alone there; everywhere else it is the band's first child, which
  // is also why `/celeste`, whose stylesheet hides the band, shows no control.
  return path !== '/' ? (
    <header className='header-container'>
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
