import Image from 'next/image';
import './logo.scss';

export const Logo = () => (
  <div className='logo'>
    <Image
      src={`${process.env.NEXT_PUBLIC_FIREBASE_DOMAIN}/images/logo.png`}
      width={368}
      height={132}
      alt='Numero Cuatro Logo in white'
      priority={true}
    />
  </div>
);
