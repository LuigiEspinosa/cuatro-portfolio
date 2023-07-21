import Link from 'next/link';

import { Header } from '@/components/molecules/Header/Header';
import { ComingSoon } from '@/components/atoms/ComingSoon/ComingSoon';
import { Marquee } from '@/components/atoms/Marquee/Marquee';
import { Sticker } from '@/components/atoms/Sticker/Sticker';

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
