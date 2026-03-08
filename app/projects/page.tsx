import type { Metadata } from 'next';
import { Container } from '@/components/atoms/Container/Container';
import { ProjectCard } from '@/components/molecules/ProjectCard/ProjectCard';
import { projects } from '@/content/projects';

export const metadata: Metadata = {
  title: 'Luigi Espinosa | Projects',
  description: 'Personal and open-source projects.',
};

export default function ProjectsPage() {
  return (
    <Container>
      <h1>Projects</h1>
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
