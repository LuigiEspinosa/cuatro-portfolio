import type { Metadata } from 'next';
import { Container } from '@/components/atoms/Container/Container';
import { projects } from '@/content/projects';

export const metadata: Metadata = {
  title: 'Luigi Espinosa | Projects',
  description: 'Personal and open-source projects.',
};

export default function ProjectsPage() {
  return (
    <Container>
      <h1>Projects</h1>
      <ul>
        {projects.map((project) => (
          <li key={project.id}>
            <article>
              <h2>{project.name}</h2>
              <p>{project.description}</p>
              <ul>
                {project.tech.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <p>
                {project.github && (
                  <a href={project.github} target='_blank' rel='noopener noreferrer'>
                    Github
                  </a>
                )}
                {project.live && (
                  <a href={project.live} target='_blank' rel='noopener noreferrer'>
                    Live
                  </a>
                )}
              </p>
            </article>
          </li>
        ))}
      </ul>
    </Container>
  );
}
