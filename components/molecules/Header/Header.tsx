'use client';

import { usePathname } from 'next/navigation';
import './Header.scss';

import { Logo } from '@/components/atoms/Logo/Logo';
import { Navbar } from '@/components/atoms/Navbar/Navbar';

export const Header = () => {
  const path = usePathname();

  return path !== '/' ? (
    <header className='header-container'>
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
  ) : null;
};
