import './header.scss';

import { Logo } from '@/components/atoms/Logo/Logo';
import { Navbar } from '@/components/atoms/Navbar/Navbar';

export const Header = () => (
  <header className='header container'>
    <Logo />
    <Navbar />
  </header>
);
