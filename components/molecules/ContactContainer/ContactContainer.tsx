import Link from 'next/link';

const ContactContainer = () => (
  <div className='contact-container'>
    <Link href='https://www.github.com/LuigiEspinosa' target='_blank' rel='noopener noreferrer'>
      Github
    </Link>
    <Link
      href='https://www.linkedin.com/in/luigiespinosa'
      target='_blank'
      rel='noopener noreferrer'
    >
      LinkedIn
    </Link>
    <Link href='mailto:luigi@cuatro.dev' target='_blank' rel='noopener noreferrer'>
      Email
    </Link>
  </div>
);

export default ContactContainer;
