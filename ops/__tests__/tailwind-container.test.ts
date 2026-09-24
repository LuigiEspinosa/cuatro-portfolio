// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { compile } from 'tailwindcss';

/**
 * DW-19: what `contracts/tailwind.css` makes `max-w-*` resolve to, pinned.
 *
 * The `tokens-contract` and `fonts-contract` jobs prove the adapter is what the generator makes,
 * and neither says what it means to a consumer. Contract 1.0.0 named its spacing keys
 * `--spacing-2xs` to `--spacing-3xl`, and a named `--spacing-md` outranks Tailwind's own
 * `--container-md`, so `max-w-md` compiled to `var(--s-md)`, 16px, in every consumer (DW-15). The
 * first instrument to see it was a human looking at a screenshot of `cs-tracker`.
 *
 * This compiles what a consumer writes, one `@import` of the published adapter, with the
 * repository's pinned `tailwindcss` through its own `compile()`, and asks for the eight sizes the
 * old keys shadowed. No CLI and no scratch tree: the CLI finds `@import "tailwindcss"` by walking up
 * from its input for `node_modules`, so here the resolver is handed over instead. Red against the
 * 1.0.0 adapter on 2026-09-24, every rule reading `var(--s-<size>)` and no `--container-*` emitted;
 * green from Contract 2.0.0, which renamed the keys to `--spacing-s-*` (`ops/tailwind-adapter.md`).
 *
 * Resolved from the repository root, where Vitest runs, not from `import.meta.url`, which is a vite
 * URL here (the same note `ops/__tests__/contract-purity.test.ts` carries).
 */

const CONTRACTS = resolve(process.cwd(), 'contracts');
const require_ = createRequire(resolve(process.cwd(), 'package.json'));

/**
 * Tailwind 4.3.3's container scale for the eight sizes, as `tailwindcss/theme.css` declares it.
 * Literal rather than read from that file, so a Tailwind bump that moves a width is a reviewed line
 * here, the way the stock utility list in `tests/e2e/contract-tailwind.pw.ts` is.
 */
const CONTAINER_WIDTHS: [size: string, width: string][] = [
  ['2xs', '18rem'],
  ['xs', '20rem'],
  ['sm', '24rem'],
  ['md', '28rem'],
  ['lg', '32rem'],
  ['xl', '36rem'],
  ['2xl', '42rem'],
  ['3xl', '48rem'],
];

const loadStylesheet = async (id: string, base: string) => {
  const path = id === 'tailwindcss' ? require_.resolve('tailwindcss/index.css') : resolve(base, id);
  return { path, base: dirname(path), content: readFileSync(path, 'utf8') };
};

/** One compile for the file, started by the first case that needs it. */
let built: Promise<string> | undefined;
const probe = (): Promise<string> =>
  (built ??= compile('@import "./tailwind.css";', { base: CONTRACTS, loadStylesheet }).then(({ build }) =>
    build(CONTAINER_WIDTHS.map(([size]) => `max-w-${size}`))
  ));

describe('what contracts/tailwind.css makes max-w-* resolve to (DW-19)', () => {
  it.each(CONTAINER_WIDTHS)("max-w-%s reads Tailwind's container width, %s", async (size, width) => {
    const css = await probe();
    const rule = new RegExp(`\\.max-w-${size}\\s*\\{\\s*max-width:\\s*([^;]+);`).exec(css)?.[1];
    expect(
      rule,
      `max-w-${size} compiles to max-width: ${rule ?? 'no rule at all'}, where Tailwind means var(--container-${size}). ` +
        `A spacing key in the adapter is shadowing the container scale (DW-15).`
    ).toBe(`var(--container-${size})`);
    const declared = new RegExp(`--container-${size}:\\s*([^;]+);`).exec(css)?.[1];
    expect(declared, `--container-${size} is ${declared ?? 'not emitted'}, where Tailwind 4.3.3 declares ${width}`).toBe(
      width
    );
  });
});
