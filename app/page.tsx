import type { Metadata } from 'next';
import HomeLayout from '@/components/organisms/HomeLayout/HomeLayout';
import { SuiteDirectory } from '@/components/organisms/SuiteDirectory/SuiteDirectory';

export const metadata: Metadata = {
  title: 'Luigi Espinosa | Senior Frontend Engineer',
  description:
    'Senior Frontend Engineer and Team Lead specialising in interactive web experiences and Automatization Tools.',
  openGraph: {
    title: 'Luigi Espinosa | Senior Frontend Engineer',
    description:
      'Senior Frontend Engineer and Team Lead specialising in interactive web experiences and Automatization Tools.',
    // Relative, so `metadataBase` in `app/layout.tsx` resolves it against the one declared origin.
    // A literal here would be a second place the Hub's hostname is written down.
    url: '/',
  },
};

export default function Home() {
  return (
    <main>
      <HomeLayout />
      {/* The hero is one viewport tall and the directory follows it, which is what gives `/#suite`
          a target that resolves. There is no footer component anywhere in the tree, so nothing
          follows this. */}
      <SuiteDirectory />
    </main>
  );
}
