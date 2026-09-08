'use client';

import { usePathname } from 'next/navigation';
import './header.scss';

import { Logo } from '@/components/atoms/Logo/Logo';
import { Navbar } from '@/components/atoms/Navbar/Navbar';

export const Header = () => {
  const path = usePathname();

  return path !== '/' ? (
    <header className='header-container container'>
      <Logo />
      {/* The pathname is handed down rather than read again inside `Navbar` (Story 2-15). It is
          already read here to decide whether this header renders at all, and `Navbar` needs the
          same answer to mark the current destination with `aria-current`. */}
      <Navbar pathname={path} />
    </header>
  ) : null;
};
