import type { Metadata } from 'next';
import { Container } from '@/components/atoms/Container/Container';
import { renderedApplications } from '@/lib/registry';
import { ProjectsHero } from '@/components/organisms/ProjectsHero/ProjectsHero';
import { SuiteDirectory } from '@/components/organisms/SuiteDirectory/SuiteDirectory';

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Personal and open-source projects.',
  openGraph: {
    title: 'Projects | Luigi Espinosa',
    description: 'Personal and open-source projects.',
    // Relative, so `metadataBase` in `app/layout.tsx` resolves it against the one declared origin.
    url: '/projects',
  },
};

/**
 * `/projects` renders the same directory the homepage does, rather than a second view of the same
 * data. Two renderings of one Registry is the defect Story 2-14's redirect exists to remove, and
 * one component cannot disagree with itself in the meantime.
 *
 * The directory sits outside `Container` deliberately. `container.scss:2-4` is
 * `width: min(80%, 1920px)`, which leaves 288px of content at a 360px viewport; the directory
 * applies the page gutter itself instead. The hero keeps the wrapper it was authored against, and
 * its eight overflowing elements at 360 are KV-5's remainder on this route: they are booked to
 * **Story 2-14**, which redirects `/projects` and so stops rendering the hero at all, rather than
 * to Story 2-33, whose title scopes it to `WorkHero`.
 */
export default function ProjectsPage() {
  return (
    <>
      <Container>
        <ProjectsHero count={renderedApplications.length} />
      </Container>
      <SuiteDirectory />
    </>
  );
}
