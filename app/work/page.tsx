import type { Metadata } from 'next';
import { Container } from '@/components/atoms/Container/Container';
import { work } from '@/content/work';

export const metadata: Metadata = {
  title: 'Luigi Espinosa | Work',
  description: 'Work experience and career timeline.',
};

export default function WorkPage() {
  return (
    <Container>
      <h1>Work</h1>
      <ul>
        {work.map((entry) => (
          <li key={entry.id}>
            <article>
              <h2>{entry.company}</h2>
              <h3>{entry.role}</h3>
              {entry.initiative && (
                <p>
                  <strong>{entry.initiative}</strong>
                </p>
              )}
              <p>
                {entry.period} &middot; {entry.location}
              </p>
              <p>{entry.description}</p>
              <ul>
                {entry.highlights.map((highlight, i) => (
                  <li key={i}>{highlight}</li>
                ))}
              </ul>
              <ul>
                {entry.tech.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </article>
          </li>
        ))}
      </ul>
    </Container>
  );
}
