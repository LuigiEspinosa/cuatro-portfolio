import Link from 'next/link';

import { Header } from '@/molecules/Header/Header';
import { ComingSoon } from '@/atoms/ComingSoon/ComingSoon';
import { Marquee } from '@/atoms/Marquee/Marquee';
import { Sticker } from '@/atoms/Sticker/Sticker';

export default function Home() {
  return (
    <main className='container'>
      <Header />
      <ComingSoon />

      <Marquee
        label='
          Coming Soon! Numero Cuatro. Frontend Developer.
          Coming Soon! Numero Cuatro. Frontend Developer.
          Coming Soon! Numero Cuatro. Frontend Developer.
          Coming Soon! Numero Cuatro. Frontend Developer.
        '
      />

      <Sticker />
    </main>
  );
}
