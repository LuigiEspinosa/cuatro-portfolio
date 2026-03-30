import Link from 'next/link';
import './navbar.scss';

export const Navbar = () => (
  <nav className='navbar'>
    <Link href='/work'>Work</Link>
    <Link href='/projects'>Projects</Link>
    <Link href='/blog'>Blog</Link>
    <Link href='https://www.github.com/luigiespinosa' target='_blank'>
      Github
    </Link>
    <Link href='https://www.linkedin.com/in/luigiespinosa' target='_blank'>
      LinkedIn
    </Link>
    <Link href='mailto:luigi@cuatro.dev' target='_blank'>
      Contact Me
    </Link>
  </nav>
);
