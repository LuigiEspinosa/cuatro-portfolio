import type { Metadata } from 'next';
import HomeLayout from '@/components/organisms/HomeLayout/HomeLayout';
import { Premise } from '@/components/organisms/Premise/Premise';
import { SiteFooter } from '@/components/organisms/SiteFooter/SiteFooter';
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
    <>
      <main>
        <HomeLayout />
        {/* The hero is one viewport tall and the directory follows it, which is what gives
            `/#suite` a target that resolves. The premise sits between them, so the claim is
            encountered before the evidence for it rather than after (FR-4). */}
        <Premise />
        <SuiteDirectory />
      </main>
      {/* Outside `<main>`, because a footer is not part of the document's main content. Nothing
          follows the Directory except this, which is what FR-1 asks. */}
      <SiteFooter />
    </>
  );
}
