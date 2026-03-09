import Link from 'next/link';
import Image from 'next/image';
import './logo.scss';

export const Logo = () => (
  <div className='logo'>
    <Link href='/'>
      <Image src='/logo.png' width={368} height={132} alt='Numero Cuatro Logo in white' />
    </Link>
  </div>
);
