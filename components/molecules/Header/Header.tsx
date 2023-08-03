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
      <Navbar />
    </header>
  ) : null;
};
