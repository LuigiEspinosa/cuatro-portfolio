import './SkipLink.scss';

/**
 * The accessibility skip-link, A-6 (Story 2-13, `EXPERIENCE.md:421-422`).
 *
 * **A-6 had no implementation anywhere in this repository before this story**, and no other story
 * creates one. It is the first tabbable element on the page and it targets main content, which is
 * the whole of what makes it distinct from the skip control beside it: that one is always visible
 * on the default path, is not first, and targets the Directory heading.
 *
 * **A server component, deliberately.** The browser already moves focus to a `tabindex="-1"`
 * fragment target on a same-document click, so there is nothing here that needs a client boundary,
 * and `app/page.tsx` renders this ahead of `<main>` without becoming one. The skip control is the
 * opposite case and says so in its own file.
 *
 * The label is sentence case in the markup and uppercased by the stylesheet, so the accessible
 * name a screen reader announces is a sentence rather than an acronym.
 */
export function SkipLink() {
  return (
    <a className='skip-link' href='#main'>
      Skip to main content
    </a>
  );
}
