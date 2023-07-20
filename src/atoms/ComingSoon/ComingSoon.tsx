import Link from 'next/link';
import './coming-soon.scss';

export const ComingSoon = () => (
  <section className='content'>
    Sorry, I&apos;m currently rebranding my Portfolio; <br />
    If you want to check my projects please go to my github account:{' '}
    <Link href='https://github.com/LuigiEspinosa' target='_blank'>
      https://github.com/LuigiEspinosa
    </Link>
    .
  </section>
);
