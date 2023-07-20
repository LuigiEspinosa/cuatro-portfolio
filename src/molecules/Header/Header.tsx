import './header.scss';

import { Logo } from '@/atoms/Logo/Logo';
import { Navbar } from '@/atoms/Navbar/Navbar';

export const Header = () => (
  <header className='header'>
    <Logo />
    <Navbar />
  </header>
);
