import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile } from 'sass';
import { render } from '@testing-library/react';
import ScanlineOverlay from '../ScanlineOverlay';

const HERE = resolve(__dirname, '..');
const TOKENS_CSS = resolve(HERE, '..', '..', '..', 'contracts', 'tokens.css');

/** The two contract roles the layer consumes (Story 2-28): the one alpha value and the raised level. */
const ROLES = ['--token-scrim', '--z-raised'] as const;

describe('ScanlineOverlay', () => {
  // Story 2-28. The scrim layer: one element, hidden from the tree, carrying nothing. The old
  // raster rendered a `__grain` span inside the box; a child here is a second layer.
  it('renders exactly one aria-hidden div with no child', () => {
    const { container } = render(<ScanlineOverlay />);
    expect(container.children).toHaveLength(1);
    const layer = container.firstElementChild as HTMLElement;
    expect(layer.tagName).toBe('DIV');
    expect(layer.className).toBe('scanline-overlay');
    expect(layer).toHaveAttribute('aria-hidden', 'true');
    expect(layer.childNodes).toHaveLength(0);
    expect(layer.attributes, `the layer carries more than its class and aria-hidden: ${layer.outerHTML}`).toHaveLength(2);
  });

  it('takes no intensity prop: the layer has one state', () => {
    // The directive is the assertion: `corepack pnpm typecheck` refuses this file if the prop returns.
    // @ts-expect-error `intensity` was retired by Story 2-28 (EXPERIENCE.md:477-479)
    const { container } = render(<ScanlineOverlay intensity='light' />);
    expect(container.children).toHaveLength(1);
  });

  it('compiles to exactly five declarations on one selector, reading the two roles the contract declares', () => {
    // The two roles are checked against the contract before they are looked for in the output, so
    // a role renamed in `contracts/tokens.css` fails here naming the stale pin rather than the pin
    // agreeing with a string the contract no longer declares (`anchor-contract.test.ts:854-860`).
    const tokens = readFileSync(TOKENS_CSS, 'utf8');
    for (const role of ROLES) {
      expect(tokens, `${role} is pinned here but contracts/tokens.css no longer declares it`).toMatch(new RegExp(`^\\s*${role}\\s*:`, 'm'));
    }
    // One exact equality on the compiled output rather than a list of refused tokens. It holds the
    // stylesheet to five declarations on one selector, so a `--c-` read, an `@media`, a modifier
    // block, a second rule, `black`, `rgb(`, `hsl(`, a `filter`, a `mix-blend-mode`, a signed or
    // `calc()` z-index and a role that lives only in a comment all fail, and a Sass fault in a
    // stylesheet no build compiles until Story 2-29 places the layer fails here rather than there.
    expect(compile(resolve(HERE, 'ScanlineOverlay.scss'), { style: 'compressed' }).css).toBe(
      '.scanline-overlay{position:absolute;inset:0;z-index:var(--z-raised);pointer-events:none;background-color:var(--token-scrim)}'
    );
  });
});
