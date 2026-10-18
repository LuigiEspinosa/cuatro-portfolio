import { isValidElement, type ReactElement, type ReactNode } from 'react';
import Script from 'next/script';
import RootLayout from '../layout';

/**
 * The Umami tag the root layout renders (DW-155, NFR-8).
 *
 * Nothing else observes it: `lighthouse.yml` builds with both Umami variables empty, and no
 * browser case loads the tag. `next/script` with `afterInteractive` injects from an effect, so a
 * static render would show nothing either way; these cases read the element tree `RootLayout`
 * returns and find the `Script` element itself, which is what the build compiles into the page.
 */

type Props = { children?: ReactNode; src?: string; 'data-website-id'?: string };

/** Every `Script` element in the tree, depth first. */
const scriptsIn = (node: ReactNode): ReactElement<Props>[] => {
  if (Array.isArray(node)) return node.flatMap(scriptsIn);
  if (!isValidElement<Props>(node)) return [];
  return [...(node.type === Script ? [node] : []), ...scriptsIn(node.props.children)];
};

const layout = () => RootLayout({ children: <main /> });

describe('the root layout carries the first-party Umami tag', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders the script with its src and website id when both variables are set', () => {
    vi.stubEnv('NEXT_PUBLIC_UMAMI_URL', 'https://umami.example.test');
    vi.stubEnv('NEXT_PUBLIC_UMAMI_WEBSITE_ID', 'site-1234');
    const scripts = scriptsIn(layout());
    expect(scripts).toHaveLength(1);
    expect(scripts[0].props.src).toBe('https://umami.example.test/script.js');
    expect(scripts[0].props['data-website-id']).toBe('site-1234');
  });

  it.each([
    ['the URL', 'NEXT_PUBLIC_UMAMI_URL'],
    ['the website id', 'NEXT_PUBLIC_UMAMI_WEBSITE_ID'],
  ])('renders no script when %s is empty', (_, emptied) => {
    vi.stubEnv('NEXT_PUBLIC_UMAMI_URL', 'https://umami.example.test');
    vi.stubEnv('NEXT_PUBLIC_UMAMI_WEBSITE_ID', 'site-1234');
    vi.stubEnv(emptied, '');
    expect(scriptsIn(layout())).toEqual([]);
  });
});
