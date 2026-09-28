import Link from 'next/link';

/**
 * The home hero's three contact links, as a list (Story 2-32).
 *
 * **A list of links, each naming its destination.** `EXPERIENCE.md` § Chrome makes this a list, and
 * A-9 asks each link to name where it goes when read with the surrounding sentence removed: `Github`,
 * `LinkedIn` and `Email` each do, the way `Source` does on a Directory row. The words are unchanged,
 * and so are the destinations and how each opens, because a restyle changes no copy and no
 * interaction (`RESTYLE-SPEC.md` § The ceiling).
 *
 * **`role='list'` is stated rather than implied.** The group is laid out without list markers, and
 * WebKit drops a list's role from the accessibility tree when its markers are removed, which is the
 * shape `WorkItem.tsx` answers the same way. How the group is laid out, and the three links' entrance
 * stagger, stay in `HomeLayout.scss`, which places it in the hero; each link meets the hit-target
 * floor there, measured in a browser by `tests/e2e/hit-target-floor.pw.ts`.
 */
const ContactContainer = () => (
  <ul className='contact-container' role='list'>
    <li>
      <Link href='https://www.github.com/LuigiEspinosa' target='_blank' rel='noopener noreferrer'>
        Github
      </Link>
    </li>
    <li>
      <Link href='https://www.linkedin.com/in/luigiespinosa' target='_blank' rel='noopener noreferrer'>
        LinkedIn
      </Link>
    </li>
    <li>
      <Link href='mailto:luigi@cuatro.dev' target='_blank' rel='noopener noreferrer'>
        Email
      </Link>
    </li>
  </ul>
);

export default ContactContainer;
