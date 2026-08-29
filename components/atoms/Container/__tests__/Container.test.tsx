import { renderToStaticMarkup } from 'react-dom/server';
import { Body } from '../Container';

/**
 * `Body` writes the current route onto `<body id>`, and five rules across three stylesheets
 * key on that id:
 *
 *  1. `app/app.scss:100` -- `body[id='']`, `overflow: hidden` on the home route
 *  2. `app/app.scss:105-106` -- `body#work, body#projects`, the grid ground
 *  3. `components/organisms/HomeLayout/HomeLayout.scss:1` -- `body[id='']`, the home ground
 *  4. `components/organisms/Celeste/celeste.scss:1` -- `#celeste`, the whole `/celeste` surface
 *  5. `components/organisms/Celeste/celeste.scss:8` -- `#celeste header`, added by Story 2-1
 *
 * The header suppression on `/celeste` now depends on this value, and nothing tested it. A
 * silent change to the derivation, a leading slash left on or the attribute dropped when the
 * pathname is `/`, would put the header back on `/celeste` or take the home ground off `/`,
 * with the whole suite green.
 */

// Mock the App Router hook so the component renders outside a router context. `vi.hoisted`
// because `vi.mock` is hoisted above the imports, and a plain `const` would not exist yet when
// the factory runs.
const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn<() => string>() }));

vi.mock('next/navigation', () => ({ usePathname }));

/**
 * The markup `Body` emits for `pathname`.
 *
 * Server-rendered rather than mounted through `@testing-library/react`: React 19 treats `<body>`
 * as a document singleton, so mounting one inside a container div applies its props to the real
 * `document.body` and warns that the nesting is invalid. The markup is what ships to the browser
 * and what `#celeste header` selects against, so the markup is what is read here.
 */
const markupFor = (pathname: string): string => {
  // **Cleared immediately before the render**, which is what makes the count below a real
  // reading of the hook for *this* pathname. The mock is module-level and `vitest.config.ts`
  // sets no `clearMocks`, so without the clear a bare `toHaveBeenCalled()` is satisfied forever
  // by the first render in the file and can never fail again.
  usePathname.mockClear();
  usePathname.mockReturnValue(pathname);

  const markup = renderToStaticMarkup(<Body>content</Body>);

  expect(
    usePathname,
    `Body did not read the pathname exactly once while rendering "${pathname}", so the id below ` +
      `is not derived from the value this call supplied`
  ).toHaveBeenCalledTimes(1);

  return markup;
};

/** The same, parsed back into an element. */
const bodyFor = (pathname: string): HTMLElement => {
  const markup = markupFor(pathname);

  // `DOMParser` answers with a `<body>` for any input at all, including none. Markup that
  // stopped being a `<body>` element would be parsed into an empty one carrying no id, and the
  // home-route case below would still read `''` off it. So what was rendered is confirmed to be
  // a `<body>` before anything is read off the parse.
  expect(markup, `Body rendered no <body> element for the pathname "${pathname}"`).toMatch(
    /^<body[ >]/
  );

  return new DOMParser().parseFromString(markup, 'text/html').body;
};

describe('Body', () => {
  it('writes the route onto <body id>', () => {
    expect(bodyFor('/celeste').id).toBe('celeste');
    expect(bodyFor('/work').id).toBe('work');

    // The home route derives the empty string, and the attribute is still written. Two
    // stylesheets select `body[id='']`, which an omitted attribute would not match.
    const home = bodyFor('/');
    expect(home.id).toBe('');
    expect(home.getAttribute('id')).toBe('');
  });

  it('hyphenates a nested route rather than emitting a second slash', () => {
    // `Container.tsx:14` is `pathname.substring(1).replaceAll('/', '-')`, and the `replaceAll`
    // is the one step none of the routes above exercises: `/celeste`, `/work` and `/` carry no
    // second slash. A `/` left in the id is not a stray character, it is an invalid id that no
    // `#id` selector can address, so the next nested route would silently lose whatever ground
    // a stylesheet keyed on it.
    expect(bodyFor('/blog/a-post').id).toBe('blog-a-post');
    expect(bodyFor('/blog/2026/a-post').id).toBe('blog-2026-a-post');

    // The control: the derivation strips only the leading slash, so the separator really is
    // being replaced rather than the whole path being flattened by something else.
    expect(bodyFor('/blog/a-post').id).not.toContain('/');
  });

  it('renders its children inside the body it writes', () => {
    expect(bodyFor('/work').textContent).toBe('content');
  });
});
