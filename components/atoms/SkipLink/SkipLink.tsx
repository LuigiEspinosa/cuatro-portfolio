import './SkipLink.scss';

/**
 * The accessibility skip-link, A-6 (Story 2-13, `EXPERIENCE.md:421-422`).
 *
 * **A-6 had no implementation anywhere in this repository before this story**, and no other story
 * creates one. It is the first tabbable element on the page and it targets main content, which is
 * the whole of what makes it distinct from the skip control beside it: that one is always visible
 * on the default path, is not first, and targets the Directory heading.
 *
 * **No handler and no effect, deliberately.** The browser already moves focus to a `tabindex="-1"`
 * fragment target on a same-document click, so there is nothing here that needs a client boundary of
 * its own. The skip control is the opposite case and says so in its own file.
 *
 * **Rendered by `Header` on every route since the Operator ruling of 2026-09-24** (DW-43, F-13). It
 * was `app/page.tsx`'s alone until then, so `/` was the one route with a way past the chrome. The
 * header renders it as the band's first child, and on `/`, where there is no band, on its own; every
 * route carries the `main#main` it targets.
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
