import { metadata } from '../not-found';

/**
 * The 404's metadata (Story 2-17).
 *
 * `app/not-found.tsx` carried an `openGraph` block whose `title` was `Projects | Luigi Espinosa`, a
 * page that has not existed since Story 2-14, so every unrouted path shared as a link previewed
 * under another route's name; its description also read `does not exists`. Story 2-17 dropped the
 * block and fixed the sentence. Next resolves `openGraph.title` from `title` when none is declared,
 * and `tests/e2e/secondary-surfaces.pw.ts` reads the rendered `og:title` on the 404 and holds it
 * equal to the document title; this file pins the export, in the shape
 * `app/celeste/__tests__/page.test.tsx` set, so the block cannot come back with the old name.
 *
 * The `robots` `noindex` the built 404 carries is not declared here and is not asserted here: it is
 * Next's own, injected by its not-found boundary (DW-78).
 */

describe('the 404 metadata', () => {
  it('names itself once, the layout template supplying the rest', () => {
    expect(metadata.title).toBe('Page not Found');
  });

  it('describes itself in one correct sentence', () => {
    expect(metadata.description).toBe('This page does not exist.');
  });

  it('declares no Open Graph block, so og:title resolves from the title rather than from a retired route', () => {
    expect(metadata.openGraph, 'the 404 declares its own Open Graph block again').toBeUndefined();
  });

  it('declares no robots directive of its own; the one the document carries is the framework’s', () => {
    expect(metadata.robots).toBeUndefined();
  });
});
