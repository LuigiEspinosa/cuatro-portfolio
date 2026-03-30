'use client';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGsapContext } from '@/hooks/useGsapContext';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import type { ProjectEntry } from '@/content/projects';
import './ProjectCard.scss';

gsap.registerPlugin(ScrollTrigger);

interface ProjectCardProps {
  project: ProjectEntry;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const reducedMotion = useReduceMotion();

  const cardRef = useGsapContext<HTMLElement>(() => {
    if (reducedMotion) return;

    gsap.from(cardRef.current, {
      scale: 0.92,
      opacity: 0,
      duration: 0.5,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: cardRef.current,
        start: 'top 85%',
      },
    });
  }, [reducedMotion]);

  return (
    <article className='project-card' ref={cardRef}>
      <h2>{project.name}</h2>
      <p>{project.description}</p>
      <ul className='project-card__tech'>
        {project.tech.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <div className='project-card__links'>
        {project.github && (
          <a href={project.github} target='_blank' rel='noopener noreferrer'>
            // Github
          </a>
        )}
        {project.live && (
          <a href={project.live} target='_blank' rel='noopener noreferrer'>
            Live →
          </a>
        )}
      </div>
    </article>
  );
}
