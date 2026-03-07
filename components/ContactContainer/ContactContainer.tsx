import Link from 'next/link';

const ContactContainer = () => (
  <div className='contact-container'>
    <Link href='https://www.github.com/luigiespinosa' target='_blank'>
      Github
    </Link>
    <Link href='https://www.linkedin.com/in/luigiespinosa' target='_blank'>
      LinkedIn
    </Link>
    <Link href='mailto:luigi@cuatro.dev' target='_blank'>
      Email
    </Link>
  </div>
);

export default ContactContainer;
