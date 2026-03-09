import type { Metadata } from 'next';
import { Container } from '@/components/atoms/Container/Container';
import { ProjectCard } from '@/components/molecules/ProjectCard/ProjectCard';
import { projects } from '@/content/projects';
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
      <ProjectsHero />
      <ul className='projects-grid'>
        {projects.map((project) => (
          <li key={project.id}>
            <ProjectCard project={project} />
          </li>
        ))}
      </ul>
    </Container>
  );
}
