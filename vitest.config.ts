import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // The Playwright specs are named `*.pw.ts` so Vitest's default include globs never see
    // them. This exclude is the second, independent guard: renaming one to `*.spec.ts` must
    // not drag a browser into `pnpm test`. `configDefaults.exclude` is spread back in so the
    // guard cannot itself drop `node_modules` and friends.
    //
    // `apps/finance` is its own workspace with its own alias and environment, and runs its suite by
    // filter in CI's `test` job (Story 3-5, DW-258). Under this config `@` would name the Hub.
    exclude: [...configDefaults.exclude, 'tests/e2e/**', 'apps/finance/**'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'apps/hub'),
    },
  },
});
