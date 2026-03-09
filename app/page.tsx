import type { Metadata } from 'next';
import HomeLayout from '@/components/organisms/HomeLayout/HomeLayout';

export const metadata: Metadata = {
  title: 'Luigi Espinosa | Senior Frontend Engineer',
  description:
    'Senior Frontend Engineer and Team Lead specialising in interactive web experiences and Automatization Tools.',
  openGraph: {
    title: 'Luigi Espinosa | Senior Frontend Engineer',
    description:
      'Senior Frontend Engineer and Team Lead specialising in interactive web experiences and Automatization Tools.',
    url: 'https://cuatro.dev',
  },
};

export default function Home() {
  return (
    <main>
      <HomeLayout />
    </main>
  );
}
