import Link from 'next/link';
import './navbar.scss';

export const Navbar = () => (
  <nav className='navbar'>
    <Link href='/work'>Work</Link>
    <Link href='/projects'>Projects</Link>
    <Link href='/blog'>Blog</Link>
    <Link href='https://www.github.com/luigiespinosa' target='_blank' rel='noopener noreferrer'>
      Github
    </Link>
    <Link
      href='https://www.linkedin.com/in/luigiespinosa'
      target='_blank'
      rel='noopener noreferrer'
    >
      LinkedIn
    </Link>
    <Link href='mailto:luigi@cuatro.dev'>Contact Me</Link>
  </nav>
);
