import Link from 'next/link';

import { Header } from '@/molecules/Header/Header';
import Sticker from '@/components/Sticker';

export default function Home() {
  return (
    <main className='container'>
      <Header />

      <div className='content'>
        Sorry, I&apos;m currently rebranding my Portfolio. <br />
        If you want to check my projects please go to my github account:{' '}
        <Link href='https://github.com/LuigiEspinosa' target='_blank'>
          https://github.com/LuigiEspinosa
        </Link>
      </div>

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
