import Link from 'next/link';
import './logo.scss';

export const Logo = () => (
  <div className='logo'>
    <Link href='/'>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src='/logo.png' width={368} height={132} alt='Numero Cuatro Logo in white' />
    </Link>
  </div>
);
