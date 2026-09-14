// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ACCENT_DISTANCE,
  ACCENT_TOKENS,
  DEFAULT_BASE_URL,
  ENTRANCE_SELECTOR,
  STATUS_VALUES,
  VIEWPORTS,
  accentShare,
  parseArgs,
  samePath,
  tripleOf,
} from '../hub-accessibility-probe.mjs';

// `ops/hub-accessibility-probe.mjs` writes the two renders the Operator's eyeball checks are read
// on and prints the accent share of the homepage viewport (Story 2-26). Nothing in CI runs it: it
// needs a browser and a running server. These cases run under the blocking `test` job with neither,
// and they are what keep the pure parts able to fail after a later edit. The module's Playwright
// and `sharp` reads sit inside the run function, so importing it pulls in neither.

type Rgb = [number, number, number];

/** An RGBA buffer of the given pixels, row-major, every one opaque. */
const image = (pixels: readonly Rgb[]): Buffer => Buffer.from(pixels.flatMap(([r, g, b]) => [r, g, b, 255]));

describe('the accent share', () => {
  const accent: Rgb = [143, 126, 240];
  const ground: Rgb = [10, 0, 15];

  it('counts the pixels within the stated distance of any target over the viewport, and no others', () => {
    const raw = image([accent, ground, ground, ground, ground, [143, 126, 238], ground, [200, 200, 200]]);
    expect(accentShare(raw, 4, 2, [accent])).toEqual({ accent: 2, total: 8, share: 0.25 });
  });

  it('counts a pixel once even when it is near two targets', () => {
    expect(accentShare(image([accent, accent]), 2, 1, [accent, [144, 126, 240]])).toEqual({ accent: 2, total: 2, share: 1 });
  });

  it('applies the distance as a Euclidean bound, so a pixel just outside it is not accent', () => {
    const outside: Rgb = [accent[0] + ACCENT_DISTANCE + 1, accent[1], accent[2]];
    const inside: Rgb = [accent[0] + ACCENT_DISTANCE, accent[1], accent[2]];
    expect(accentShare(image([outside]), 1, 1, [accent]).accent).toBe(0);
    expect(accentShare(image([inside]), 1, 1, [accent]).accent).toBe(1);
    // And a tighter distance handed in is honoured.
    expect(accentShare(image([inside]), 1, 1, [accent], 4).accent).toBe(0);
  });

  it('answers zero accent on a ground-only render rather than a small share by accident', () => {
    expect(accentShare(image(Array(9).fill(ground)), 3, 3, [accent])).toEqual({ accent: 0, total: 9, share: 0 });
  });

  it('refuses a buffer that is not the size the dimensions promise, so a truncated decode is never a small share', () => {
    expect(() => accentShare(image(Array(4).fill(ground)), 3, 2, [accent])).toThrow(/16 bytes for 3x2 pixels, expected 24/);
    expect(() => accentShare(image([ground]), 1, 1, [])).toThrow(/no target colour/);
    expect(() => accentShare('not a buffer' as unknown as Buffer, 1, 1, [accent])).toThrow(/needs a byte buffer/);
  });

  it('reads an opaque r,g,b,a canvas reading into a triple and refuses anything else', () => {
    expect(tripleOf('143,126,240,255')).toEqual([143, 126, 240]);
    for (const bad of ['', '1,2,3', '1,2,3,4,5', 'a,b,c,d', '256,0,0,255', '-1,0,0,255', '1,,3,255', '1,2,3,254', '1.5,2,3,255']) {
      expect(() => tripleOf(bad), `"${bad}" was accepted`).toThrow(/is not an opaque r,g,b,a reading/);
    }
  });
});

describe('the arguments', () => {
  it('takes --base-url and --out, defaulting the origin and requiring the directory', () => {
    expect(parseArgs(['--out', 'renders'])).toEqual({ baseUrl: DEFAULT_BASE_URL, out: 'renders' });
    expect(parseArgs(['--base-url', 'http://localhost:3000/', '--out', 'x'])).toEqual({ baseUrl: 'http://localhost:3000', out: 'x' });
    expect(parseArgs(['--out', 'x', '--base-url', 'https://cuatro.dev'])).toEqual({ baseUrl: 'https://cuatro.dev', out: 'x' });
  });

  it('refuses a missing directory, an unknown flag, a flag with no value and a base URL that is not a bare origin', () => {
    expect(() => parseArgs([])).toThrow(/--out <dir> is required/);
    expect(() => parseArgs(['--out', 'x', '--verbose'])).toThrow(/Unknown option '--verbose'/);
    expect(() => parseArgs(['--out'])).toThrow(/Option '--out <value>' argument missing/);
    expect(() => parseArgs(['--out', '--base-url', 'http://x'])).toThrow(/Option '--out' argument is ambiguous/);
    for (const bad of ['ftp://x', 'http://x/work', 'http://x/?q=1', 'http://x/#top', 'not a url']) {
      expect(() => parseArgs(['--base-url', bad, '--out', 'x']), `${bad} was accepted`).toThrow(/is not a bare http\(s\) origin/);
    }
  });

  it('pins the two viewports, the three accent roles, the entrance and the taxonomy the transcript reports', () => {
    expect(VIEWPORTS).toEqual([
      { width: 360, height: 800 },
      { width: 1280, height: 800 },
    ]);
    expect(ACCENT_TOKENS).toEqual(['--token-accent', '--token-accent-hover', '--token-accent-muted']);
    expect(ACCENT_DISTANCE).toBeGreaterThan(0);
    expect(ACCENT_DISTANCE).toBeLessThan(64);
    // The same entrance the sweep settles on, read out of the spec rather than restated twice.
    const spec = readFileSync(resolve(process.cwd(), 'tests', 'e2e', 'accessibility-floor.pw.ts'), 'utf8');
    expect(spec).toContain(`const ENTRANCE_SELECTOR = '${ENTRANCE_SELECTOR}';`);
    // The taxonomy planted before the greyscale render is the schema's enum, in its order.
    const schema = JSON.parse(readFileSync(resolve(process.cwd(), 'contracts', 'registry.schema.json'), 'utf8'));
    const status = (JSON.stringify(schema) as string).match(/"status":\{[^}]*"enum":\[([^\]]*)\]/)?.[1];
    expect(status, 'contracts/registry.schema.json no longer declares a status enum this read can find').toBeDefined();
    expect(STATUS_VALUES).toEqual((status ?? '').split(',').map((value: string) => JSON.parse(value)));
  });

  it('compares two spellings of one path as one file, on either separator', () => {
    expect(samePath('C:\\repo\\ops\\..\\ops\\probe.mjs', 'C:/repo/ops/probe.mjs')).toBe(true);
    expect(samePath('/w/ops/probe.mjs', '/w/ops/other.mjs')).toBe(false);
  });
});
