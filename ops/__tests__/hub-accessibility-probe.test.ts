// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ACCENT_DISTANCE,
  ACCENT_TOKENS,
  DEFAULT_BASE_URL,
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

/** An RGBA buffer of `width * height` pixels, every one `fill`, then `overrides` at given pixel indexes. */
const image = (width: number, height: number, fill: [number, number, number], overrides: Record<number, [number, number, number]> = {}): Buffer => {
  const raw = Buffer.alloc(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const [r, g, b] = overrides[pixel] ?? fill;
    raw[pixel * 4] = r;
    raw[pixel * 4 + 1] = g;
    raw[pixel * 4 + 2] = b;
    raw[pixel * 4 + 3] = 255;
  }
  return raw;
};

describe('the accent share', () => {
  const accent: [number, number, number] = [143, 126, 240];
  const ground: [number, number, number] = [10, 0, 15];

  it('counts the pixels within the stated distance of any target over the viewport, and no others', () => {
    const raw = image(4, 2, ground, { 0: accent, 5: [143, 126, 238], 7: [200, 200, 200] });
    const share = accentShare(raw, 4, 2, [accent]);
    expect(share).toEqual({ accent: 2, total: 8, share: 0.25 });
  });

  it('counts a pixel once even when it is near two targets', () => {
    const raw = image(2, 1, accent);
    expect(accentShare(raw, 2, 1, [accent, [144, 126, 240]])).toEqual({ accent: 2, total: 2, share: 1 });
  });

  it('applies the distance as a Euclidean bound, so a pixel just outside it is not accent', () => {
    const outside: [number, number, number] = [accent[0] + ACCENT_DISTANCE + 1, accent[1], accent[2]];
    const inside: [number, number, number] = [accent[0] + ACCENT_DISTANCE, accent[1], accent[2]];
    expect(accentShare(image(1, 1, outside), 1, 1, [accent]).accent).toBe(0);
    expect(accentShare(image(1, 1, inside), 1, 1, [accent]).accent).toBe(1);
    // And a tighter distance handed in is honoured.
    expect(accentShare(image(1, 1, inside), 1, 1, [accent], 4).accent).toBe(0);
  });

  it('answers zero accent on a ground-only render rather than a small share by accident', () => {
    expect(accentShare(image(3, 3, ground), 3, 3, [accent])).toEqual({ accent: 0, total: 9, share: 0 });
  });

  it('refuses a buffer that is not the size the dimensions promise, so a truncated decode is never a small share', () => {
    expect(() => accentShare(image(2, 2, ground), 3, 2, [accent])).toThrow(/16 bytes for 3x2 pixels, expected 24/);
    expect(() => accentShare(image(1, 1, ground), 1, 1, [])).toThrow(/no target colour/);
    expect(() => accentShare('not a buffer' as unknown as Buffer, 1, 1, [accent])).toThrow(/needs a byte buffer/);
  });

  it('reads an r,g,b,a canvas reading into a triple and refuses anything else', () => {
    expect(tripleOf('143,126,240,255')).toEqual([143, 126, 240]);
    for (const bad of ['', '1,2,3', '1,2,3,4,5', 'a,b,c,d', '256,0,0,255', '-1,0,0,255']) {
      expect(() => tripleOf(bad), `"${bad}" was accepted`).toThrow(/is not an r,g,b,a reading/);
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
    expect(() => parseArgs(['--out', 'x', '--verbose'])).toThrow(/unknown argument --verbose/);
    expect(() => parseArgs(['--out'])).toThrow(/--out needs a value/);
    expect(() => parseArgs(['--out', '--base-url', 'http://x'])).toThrow(/--out needs a value/);
    for (const bad of ['ftp://x', 'http://x/work', 'http://x/?q=1', 'http://x/#top', 'not a url']) {
      expect(() => parseArgs(['--base-url', bad, '--out', 'x']), `${bad} was accepted`).toThrow(/is not a bare http\(s\) origin/);
    }
  });

  it('pins the two viewports and the three accent roles the transcript reports', () => {
    expect(VIEWPORTS).toEqual([
      { width: 360, height: 800 },
      { width: 1280, height: 800 },
    ]);
    expect(ACCENT_TOKENS).toEqual(['--token-accent', '--token-accent-hover', '--token-accent-muted']);
    expect(ACCENT_DISTANCE).toBeGreaterThan(0);
    expect(ACCENT_DISTANCE).toBeLessThan(64);
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
