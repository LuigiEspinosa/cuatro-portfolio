import type { Metadata } from 'next';
import { Container } from '@/components/atoms/Container/Container';
import { ProjectCard } from '@/components/molecules/ProjectCard/ProjectCard';
import { renderedApplications } from '@/lib/registry';
import { ProjectsHero } from '@/components/organisms/ProjectsHero/ProjectsHero';

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Personal and open-source projects.',
  openGraph: {
    title: 'Projects | Luigi Espinosa',
    description: 'Personal and open-source projects.',
    url: 'https://cuatro.dev/projects',
  },
};

export default function ProjectsPage() {
  return (
    <Container>
      <ProjectsHero count={renderedApplications.length} />
      <ul className='projects-grid'>
        {renderedApplications.map((application) => (
          <li key={application.id}>
            <ProjectCard project={application} />
          </li>
        ))}
      </ul>
    </Container>
  );
}
