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

// The skip-link's target, focusable by script and never a Tab stop (Operator ruling 2026-09-24,
// DW-43): every route carries one, and `Header` carries the link.
export default function WorkPage() {
  return (
    <main id='main' tabIndex={-1}>
      <Container>
        <WorkHero />
        <WorkTimeline />
      </Container>
    </main>
  );
}
