import type { Metadata } from 'next';
import { metadata } from '../page';

/**
 * The `/celeste` route's metadata (Story 2-17).
 *
 * The route is reachable from the footer alone, renders one heading and no exit, and is the one
 * routed page that declares a `robots` directive: `index: false`, which Next renders as
 * `<meta name="robots" content="noindex">`. `/`, `/work` and `/cv` declare none. The 404 carries a
 * `noindex` as well, and that one is the framework's: Next's not-found boundary injects it into
 * every not-found response while `app/not-found.tsx` declares nothing (DW-78). The rendered tags
 * are read in `tests/e2e/secondary-surfaces.pw.ts`, on this page, on the three that must carry
 * none and on the 404; this file reads the export, in the shape
 * `app/cv/__tests__/page.test.tsx:268-274` set, so a directive dropped from the object fails here
 * before a build is made.
 */

/**
 * Whether a metadata export asks not to be indexed.
 *
 * Next accepts `robots` as a string or an object. Only the object form with `index: false` is what
 * this route declares, and the predicate reads exactly that: a string `'noindex'` would render the
 * same tag and is not what is asserted, so it is reported as not matching rather than folded in.
 */
const declinesIndexing = (candidate: Metadata): boolean =>
  typeof candidate.robots === 'object' && candidate.robots !== null && candidate.robots.index === false;

describe('the /celeste route', () => {
  it('names itself once, the layout template supplying the rest', () => {
    // `app/layout.tsx:15-18` applies `'%s | Luigi Espinosa'`, so the title is the page's own
    // part and nothing more. Unchanged by Story 2-17; pinned so the directive below cannot be
    // added by replacing the object and losing the title with it.
    expect(metadata.title).toBe('I Love U <3');
  });

  it('declines indexing, and declares nothing else about robots', () => {
    expect(declinesIndexing(metadata), '/celeste no longer declares robots.index false').toBe(true);
    expect(metadata.robots, 'the robots object carries more than the one directive').toEqual({ index: false });
  });

  it('declares no Open Graph block and no description of its own, so Next fills og:title from the title and the layout supplies the rest', () => {
    // A claim about this page's export only. The built document still carries an `og:title`,
    // resolved from `title`, plus the `og:image` and `siteName` `app/layout.tsx` declares; what is
    // pinned here is that none of that is written a second time in this file.
    expect(metadata.openGraph).toBeUndefined();
    expect(metadata.description).toBeUndefined();
  });

  it('and the predicate refuses a metadata object without the directive, so the reading above is a measurement', () => {
    // The control. The same predicate over the two shapes a regression would take: the key
    // missing, and the key present with the wrong value.
    expect(declinesIndexing({ title: 'I Love U <3' }), 'the predicate passes an object with no robots key').toBe(false);
    expect(declinesIndexing({ robots: { index: true } }), 'the predicate passes index: true').toBe(false);
    expect(declinesIndexing({ robots: 'noindex' }), 'the predicate folds the string form in').toBe(false);
  });
});
