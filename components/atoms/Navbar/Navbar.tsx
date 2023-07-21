import Link from 'next/link';
import './navbar.scss';

export const Navbar = () => (
  <nav className='navbar'>
    <Link href='https://linkedin.com/in/luigiespinosa' target='_blank'>
      LinkedIn
    </Link>
    <Link href='mailto:luigi@cuatro.dev' target='_blank'>
      Contact Me
    </Link>
  </nav>
);
