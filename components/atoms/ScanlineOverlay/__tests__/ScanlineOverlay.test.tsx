import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import ScanlineOverlay from '../ScanlineOverlay';

const HERE = resolve(__dirname, '..');
const REPO_ROOT = resolve(HERE, '..', '..', '..');

/**
 * Every `--name` `contracts/tokens.css` declares, comments stripped, so the two roles the
 * stylesheet case pins are checked against the contract before they are looked for in the
 * source (`app/__tests__/anchor-contract.test.ts:854-860`). A role renamed in the contract fails
 * here naming the stale pin, rather than the pin agreeing with a string the contract no longer
 * declares.
 */
const contractNames = (): string[] => {
  const source = readFileSync(resolve(REPO_ROOT, 'contracts', 'tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  return [...source.matchAll(/(?:^|[;{])\s*(--[a-z0-9-]+)\s*:/gm)].map((found) => found[1]);
};

/** The two contract roles the layer consumes (Story 2-28): the one alpha value and the raised level. */
const ROLES = ['--token-scrim', '--z-raised'] as const;

describe('ScanlineOverlay', () => {
  // Story 2-28. The scrim layer: one element, hidden from the tree, carrying nothing. The old
  // raster rendered a `__grain` span inside the box; a child here is a second layer.
  it('renders exactly one aria-hidden div with no child, no text, no role and no tabindex', () => {
    const { container, queryAllByRole } = render(<ScanlineOverlay />);
    expect(container.children).toHaveLength(1);
    const layer = container.firstElementChild as HTMLElement;
    expect(layer.tagName).toBe('DIV');
    expect(layer.className).toBe('scanline-overlay');
    expect(layer).toHaveAttribute('aria-hidden', 'true');
    expect(layer.childNodes).toHaveLength(0);
    expect(layer.textContent).toBe('');
    expect(layer).not.toHaveAttribute('role');
    expect(layer).not.toHaveAttribute('tabindex');
    expect(layer.attributes, `the layer carries more than its class and aria-hidden: ${layer.outerHTML}`).toHaveLength(2);
    expect(queryAllByRole('button')).toHaveLength(0);
    expect(queryAllByRole('link')).toHaveLength(0);
  });

  it('takes no intensity prop: the layer has one state', () => {
    // `corepack pnpm typecheck` refuses this file if the prop is ever accepted again, because the
    // directive below then has nothing to expect. At runtime the prop is ignored and the render is
    // the same one element, which is asserted so the case is not vacuous on the runtime side.
    // @ts-expect-error `intensity` was retired by Story 2-28 (EXPERIENCE.md:477-479)
    const { container } = render(<ScanlineOverlay intensity='light' />);
    expect(container.children).toHaveLength(1);
    expect((container.firstElementChild as HTMLElement).className).toBe('scanline-overlay');
  });

  it('ships a stylesheet that names the two contract roles and pointer-events: none, and none of the raster', () => {
    const declared = contractNames();
    for (const role of ROLES) {
      expect(declared, `${role} is pinned here but contracts/tokens.css no longer declares it`).toContain(role);
    }
    // Comments are inside the scan on purpose: a comment naming a gradient, the grain or a
    // modifier fails this case, so the stylesheet cannot drift back towards the raster through
    // its prose either (the `GlitchText.test.tsx` precedent).
    const source = readFileSync(resolve(HERE, 'ScanlineOverlay.scss'), 'utf8');
    for (const role of ROLES) {
      expect(source, `ScanlineOverlay.scss does not read ${role}`).toContain(`var(${role})`);
    }
    expect(source).toMatch(/pointer-events:\s*none/);
    for (const forbidden of ['rgba(', '#000', 'gradient(', 'url(', '@keyframes', 'animation', 'opacity', '__light', '__full', '__grain']) {
      expect(source, `ScanlineOverlay.scss names ${forbidden}`).not.toContain(forbidden);
    }
    expect(source, 'ScanlineOverlay.scss writes a z-index literal instead of a contract level').not.toMatch(/z-index:\s*\d/);
  });
});
