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
    // `apps/finance` and `apps/tracker` are workspaces with their own aliases and environments, and
    // run their suites by filter in CI's `test` job (Stories 3-5 and 3-6, DW-258). Under this config
    // `@` would name the Hub.
    exclude: [...configDefaults.exclude, 'tests/e2e/**', 'apps/finance/**', 'apps/tracker/**'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'apps/hub'),
    },
  },
});
