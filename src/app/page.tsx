import Image from 'next/image';
import Link from 'next/link';
import Sticker from '@/components/Sticker';

export default function Home() {
  return (
    <main className='container'>
      <nav className='navbar'>
        <div className='logo'>
          <Image
            src='logo.png'
            width={368}
            height={132}
            alt='Numero Cuatro Logo in white'
            priority={true}
          />
        </div>
      </nav>

      <header className='header'>
        Sorry, I&apos;m currently rebranding my Portfolio. <br />
        If you want to check my projects please go to my github account:{' '}
        <Link href='https://github.com/LuigiEspinosa' target='_blank'>
          https://github.com/LuigiEspinosa
        </Link>
      </header>

      <div className='marquee'>
        <span>
          Coming Soon! Numero Cuatro. Frontend Developer. Coming Soon! Numero Cuatro. Frontend
          Developer. Coming Soon! Numero Cuatro. Frontend Developer. Coming Soon! Numero Cuatro.
          Frontend Developer.
        </span>
      </div>

      <Sticker />
    </main>
  );
}
