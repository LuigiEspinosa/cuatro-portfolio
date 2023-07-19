import Link from 'next/link';

import { Header } from '@/molecules/Header/Header';
import { ComingSoon } from '@/atoms/ComingSoon/ComingSoon';
import Sticker from '@/components/Sticker';

export default function Home() {
  return (
    <main className='container'>
      <Header />
      <ComingSoon />

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
