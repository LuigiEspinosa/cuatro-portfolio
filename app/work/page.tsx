import type { Metadata } from 'next';
import { Container } from '@/components/atoms/Container/Container';
import { WorkHero } from '@/components/organisms/WorkHero/WorkHero';
import { WorkTimeline } from '@/components/organisms/WorkTimeline/WorkTimeLine';

export const metadata: Metadata = {
  title: 'Luigi Espinosa | Work',
  description: 'Work experience and career timeline.',
};

export default function WorkPage() {
  return (
    <>
      <Container>
        <WorkHero />
        <WorkTimeline />
      </Container>
    </>
  );
}
