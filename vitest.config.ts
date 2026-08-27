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
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
});
