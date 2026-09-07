import type { Metadata } from 'next';
import { Container } from '@/components/atoms/Container/Container';
import { WorkHero } from '@/components/organisms/WorkHero/WorkHero';
import { WorkTimeline } from '@/components/organisms/WorkTimeline/WorkTimeLine';

export const metadata: Metadata = {
  title: 'Work',
  description: 'Work experience and career timeline.',
  openGraph: {
    title: 'Work | Luigi Espinosa',
    description: 'Work experience and career timeline.',
    // Relative, so `metadataBase` in `app/layout.tsx` resolves it against the one declared origin.
    url: '/work',
  },
};

export default function WorkPage() {
  return (
    <Container>
      <WorkHero />
      <WorkTimeline />
    </Container>
  );
}
