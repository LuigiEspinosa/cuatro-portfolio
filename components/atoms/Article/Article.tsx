import Link from 'next/link';
import { Container } from '../Container/Container';
import './article.scss';

interface ArticleProps {
  title: string;
  date: string;
  contentHTML: string;
}

export default function Article({ title, date, contentHTML }: ArticleProps) {
  return (
    <main className='article'>
      <Container>
        <p className='article-date'>{date}</p>
        <h1 className='article-title'>{title}</h1>

        <section className='article-section'>
          <article className='article-content' dangerouslySetInnerHTML={{ __html: contentHTML }} />

          <div className='btn-back'>
            <Link href='/blog'>Back to Blog</Link>
          </div>
        </section>
      </Container>
    </main>
  );
}
