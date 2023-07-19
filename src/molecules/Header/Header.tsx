import Link from 'next/link';
import './header.scss';

import { Logo } from '@/atoms/Logo/Logo';

export const Header = () => (
  <header className='header'>
    <Logo />

    <nav className='navbar'>
      <Link href='https://linkedin.com/in/luigiespinosa' target='_blank'>
        LinkedIn
      </Link>
      <Link href='mailto:luigi@cuatro.dev' target='_blank'>
        Contact Me
      </Link>
    </nav>
  </header>
);
