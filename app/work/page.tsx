import type { Metadata } from 'next';
import { Container } from '@/components/atoms/Container/Container';
import { WorkTimeline } from '@/components/organisms/WorkTimeline/WorkTimeLine';

export const metadata: Metadata = {
  title: 'Luigi Espinosa | Work',
  description: 'Work experience and career timeline.',
};

export default function WorkPage() {
  return (
    <Container>
      <h1>Work</h1>
      <WorkTimeline />
    </Container>
  );
}
