import Image from 'next/image';
import './logo.scss';

// Images
import LogoImage from '../../../public/images/logo.png';

export const Logo = () => (
  <div className='logo'>
    <Image
      src={LogoImage}
      width={368}
      height={132}
      alt='Numero Cuatro Logo in white'
      priority={true}
    />
  </div>
);
